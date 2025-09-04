/**
 * @fileoverview HTTPS server for InDesign MCP with native SSL and ngrok support
 * Provides secure endpoints with self-signed certificates or custom SSL certificates
 */

import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
// TODO: This should import from @mcp/indesign-server when available
// import { createInDesignMcpServer, SERVER_CONFIG } from '@mcp/indesign-server';
const createInDesignMcpServer = null as any;
const SERVER_CONFIG = { name: 'indesign-mcp', version: '1.0.0' };
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { spawn } from 'child_process';
import { URL } from 'url';
import { 
  CertificateConfig, 
  getDefaultCertPaths, 
  certificatesExist, 
  generateSelfSignedCertificate,
  generateMkcertCertificate,
  installMkcertCA,
  loadCertificates,
  checkOpenSSLAvailable,
  checkMkcertAvailable,
  getCertificateInfo
} from './utils/certificates.js';

interface HttpsServerConfig {
  port: number;
  httpsPort?: number;
  enableHttps: boolean;
  enableNgrok: boolean;
  ngrokAuthToken?: string;
  corsOrigin?: string;
  certificateConfig?: CertificateConfig;
  forceHttpsRedirect?: boolean;
}

const DEFAULT_CONFIG: HttpsServerConfig = {
  port: parseInt(process.env.MCP_PORT || '3000'),
  httpsPort: parseInt(process.env.MCP_HTTPS_PORT || '3443'),
  enableHttps: process.env.ENABLE_HTTPS !== 'false',
  enableNgrok: process.env.ENABLE_NGROK === 'true',
  ngrokAuthToken: process.env.NGROK_AUTH_TOKEN,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  forceHttpsRedirect: process.env.FORCE_HTTPS_REDIRECT === 'true'
};

class HttpsServer {
  private httpServer: any;
  private httpsServer: any;
  private config: HttpsServerConfig;
  private ngrokProcess?: any;
  private ngrokUrl?: string;
  private mcpServer: any;
  private activeSessions = new Map<string, SSEServerTransport>();
  private certificates?: { key: string; cert: string };

  constructor(config: Partial<HttpsServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (!this.config.certificateConfig) {
      this.config.certificateConfig = getDefaultCertPaths();
    }
  }

  /**
   * Set CORS headers for all responses
   */
  private setCorsHeaders(res: any): void {
    res.setHeader('Access-Control-Allow-Origin', this.config.corsOrigin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-ID');
    res.setHeader('Access-Control-Expose-Headers', 'X-Session-ID');
  }

  /**
   * Handle HTTPS redirect
   */
  private handleHttpsRedirect(req: any, res: any): boolean {
    if (this.config.forceHttpsRedirect && this.config.enableHttps && !req.connection.encrypted) {
      const httpsUrl = `https://${req.headers.host?.replace(':' + this.config.port, ':' + this.config.httpsPort)}${req.url}`;
      res.writeHead(301, { 'Location': httpsUrl });
      res.end();
      return true;
    }
    return false;
  }

  /**
   * Handle CORS preflight requests
   */
  private handleOptions(res: any): void {
    this.setCorsHeaders(res);
    res.writeHead(200);
    res.end();
  }

  /**
   * Parse session ID from URL or headers
   */
  private getSessionId(req: any, url: URL): string | null {
    const sessionFromUrl = url.searchParams.get('session');
    if (sessionFromUrl) return sessionFromUrl;
    
    const sessionFromHeader = req.headers['x-session-id'] as string;
    if (sessionFromHeader) return sessionFromHeader;
    
    return null;
  }

  /**
   * Handle incoming HTTP/HTTPS requests
   */
  private async handleRequest(req: any, res: any): Promise<void> {
    const url = new URL(req.url || '/', `${req.connection.encrypted ? 'https' : 'http'}://localhost:${this.config.port}`);
    
    this.setCorsHeaders(res);
    
    // Handle HTTPS redirect
    if (this.handleHttpsRedirect(req, res)) {
      return;
    }
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      this.handleOptions(res);
      return;
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        server: SERVER_CONFIG.name,
        version: SERVER_CONFIG.version,
        activeSessions: this.activeSessions.size,
        https: req.connection.encrypted ? 'enabled' : 'disabled',
        ngrok: this.ngrokUrl ? 'connected' : 'disabled'
      }));
      return;
    }

    // SSL certificate info endpoint
    if (url.pathname === '/ssl-info' && this.config.enableHttps) {
      try {
        const certInfo = await getCertificateInfo(this.config.certificateConfig!.certPath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          certificate: certInfo,
          paths: {
            key: this.config.certificateConfig!.keyPath,
            cert: this.config.certificateConfig!.certPath
          }
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read certificate info' }));
      }
      return;
    }

    // MCP SSE endpoint for establishing connections
    if (url.pathname === '/mcp' && req.method === 'GET') {
      await this.handleSseConnection(req, res);
      return;
    }

    // MCP message endpoint for sending messages
    if (url.pathname === '/mcp/message' && req.method === 'POST') {
      await this.handlePostMessage(req, res, url);
      return;
    }

    // API info endpoint
    if (url.pathname === '/' || url.pathname === '/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const baseUrl = this.ngrokUrl || 
        (req.connection.encrypted ? 
          `https://localhost:${this.config.httpsPort}` : 
          `http://localhost:${this.config.port}`);
      
      res.end(JSON.stringify({
        name: SERVER_CONFIG.name,
        version: SERVER_CONFIG.version,
        transport: 'SSE',
        security: {
          https: req.connection.encrypted,
          ngrok: !!this.ngrokUrl,
          certificates: this.config.enableHttps ? 'self-signed' : 'none'
        },
        endpoints: {
          connect: `${baseUrl}/mcp (GET - establish SSE connection)`,
          message: `${baseUrl}/mcp/message (POST - send messages)`,
          health: `${baseUrl}/health (GET - server status)`,
          sslInfo: this.config.enableHttps ? `${baseUrl}/ssl-info (GET - certificate info)` : 'N/A'
        },
        usage: {
          connect: 'GET /mcp to establish SSE connection',
          send: 'POST /mcp/message with JSON-RPC messages'
        }
      }));
      return;
    }

    // 404 for unknown endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }

  /**
   * Handle SSE connection establishment
   */
  private async handleSseConnection(req: any, res: any): Promise<void> {
    try {
      const transport = new SSEServerTransport('/mcp/message', res);
      this.activeSessions.set(transport.sessionId, transport);

      transport.onclose = () => {
        console.error(`SSE connection closed: ${transport.sessionId}`);
        this.activeSessions.delete(transport.sessionId);
      };

      transport.onerror = (error: Error) => {
        console.error(`SSE transport error for ${transport.sessionId}:`, error);
        this.activeSessions.delete(transport.sessionId);
      };

      await this.mcpServer.connect(transport);
      await transport.start();
      
      console.error(`New MCP connection established: ${transport.sessionId}`);
      
    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to establish connection' }));
    }
  }

  /**
   * Handle POST messages from clients
   */
  private async handlePostMessage(req: any, res: any, url: URL): Promise<void> {
    try {
      const sessionId = this.getSessionId(req, url);
      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session ID required' }));
        return;
      }

      const transport = this.activeSessions.get(sessionId);
      if (!transport) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const parsedBody = JSON.parse(body);
          await transport.handlePostMessage(req, res, parsedBody);
        } catch (error) {
          console.error('Failed to handle POST message:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });

    } catch (error) {
      console.error('Failed to handle POST message:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Initialize SSL certificates
   */
  private async initializeCertificates(): Promise<void> {
    if (!this.config.enableHttps) return;

    const certConfig = this.config.certificateConfig!;
    
    // Check if certificates exist
    if (!certificatesExist(certConfig)) {
      console.error('🔐 SSL certificates not found, generating certificates...');
      
      // Try mkcert first (creates trusted certificates)
      if (await checkMkcertAvailable()) {
        try {
          // Install mkcert CA if needed (one-time setup)
          await installMkcertCA();
          
          // Generate trusted certificate
          await generateMkcertCertificate(certConfig);
          console.error('🎉 Generated browser-trusted certificates! No security warnings.');
        } catch (error) {
          console.error(`⚠️ mkcert failed: ${error}`);
          console.error('Falling back to self-signed certificate generation...');
          
          // Fallback to OpenSSL
          if (!(await checkOpenSSLAvailable())) {
            throw new Error('Both mkcert and OpenSSL failed. Install with: brew install mkcert openssl');
          }
          
          await generateSelfSignedCertificate(certConfig);
          console.error('⚠️ Using self-signed certificate. Browser will show security warning.');
        }
      } else {
        console.error('💡 Install mkcert for browser-trusted certificates: brew install mkcert');
        
        // Check if OpenSSL is available
        if (!(await checkOpenSSLAvailable())) {
          throw new Error('OpenSSL is required for HTTPS but not found. Install with: brew install openssl');
        }
        
        await generateSelfSignedCertificate(certConfig);
        console.error('⚠️ Using self-signed certificate. Browser will show security warning.');
      }
    } else {
      console.error('🔐 Using existing SSL certificates');
      try {
        const certInfo = await getCertificateInfo(certConfig.certPath);
        console.error(`   Subject: ${certInfo.subject}`);
        console.error(`   Valid until: ${certInfo.notAfter}`);
        
        // Check if this is an mkcert certificate
        if (certInfo.issuer.includes('mkcert')) {
          console.error('   ✅ Certificate is trusted by your browser (mkcert)');
        } else {
          console.error('   ⚠️ Self-signed certificate - browser may show warnings');
        }
      } catch (error) {
        console.error('   Warning: Could not read certificate info');
      }
    }

    // Load certificates
    this.certificates = loadCertificates(certConfig);
  }

  /**
   * Start ngrok tunnel
   */
  private async startNgrok(): Promise<string> {
    return new Promise((resolve, reject) => {
      const port = this.config.enableHttps ? this.config.httpsPort : this.config.port;
      const protocol = this.config.enableHttps ? 'https' : 'http';
      
      const ngrokArgs = [protocol, port!.toString()];
      
      if (this.config.ngrokAuthToken) {
        ngrokArgs.unshift('--authtoken', this.config.ngrokAuthToken);
      }

      this.ngrokProcess = spawn('ngrok', ngrokArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
      
      let output = '';
      this.ngrokProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      this.ngrokProcess.stderr.on('data', (data: Buffer) => {
        const line = data.toString();
        // Look for tunnel URL in stderr output (ngrok v3 format)
        const urlMatch = line.match(/https:\/\/[a-zA-Z0-9-]+\.ngrok[a-zA-Z0-9.-]*\/?\s/);
        if (urlMatch) {
          const url = urlMatch[0].trim().replace(/\/$/, ''); // Remove trailing slash
          resolve(url);
        }
      });

      this.ngrokProcess.on('error', (error: Error) => {
        reject(new Error(`Failed to start ngrok: ${error.message}`));
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        reject(new Error('Ngrok startup timeout'));
      }, 15000);
    });
  }

  /**
   * Start the HTTPS MCP server
   */
  async start(): Promise<void> {
    try {
      // Auto-detect telemetry mode for evolutionary testing
      const enableTelemetry = process.env.TELEMETRY_ENABLED === 'true' ||
                             process.env.EVOLUTION_SESSION_ID !== undefined ||
                             process.env.TELEMETRY_SESSION_ID !== undefined;
      
      // Create MCP server instance
      this.mcpServer = await createInDesignMcpServer(enableTelemetry);
      
      if (enableTelemetry) {
        console.error("🔬 MCP Server started with telemetry enabled");
      }

      // Initialize SSL certificates if HTTPS is enabled
      if (this.config.enableHttps) {
        await this.initializeCertificates();
      }

      // Create HTTP server
      this.httpServer = createHttpServer(this.handleRequest.bind(this));
      
      // Create HTTPS server if enabled
      if (this.config.enableHttps && this.certificates) {
        this.httpsServer = createHttpsServer(this.certificates, this.handleRequest.bind(this));
      }

      // Start HTTP server
      await new Promise<void>((resolve) => {
        this.httpServer.listen(this.config.port, () => {
          console.error(`🚀 InDesign MCP HTTP Server started on port ${this.config.port}`);
          resolve();
        });
      });

      // Start HTTPS server if enabled
      if (this.httpsServer) {
        await new Promise<void>((resolve) => {
          this.httpsServer.listen(this.config.httpsPort, () => {
            console.error(`🔒 InDesign MCP HTTPS Server started on port ${this.config.httpsPort}`);
            resolve();
          });
        });
      }

      // Start ngrok if enabled
      if (this.config.enableNgrok) {
        try {
          this.ngrokUrl = await this.startNgrok();
          console.error(`🌐 Ngrok tunnel established: ${this.ngrokUrl}`);
          console.error(`   MCP endpoint: ${this.ngrokUrl}/mcp`);
          console.error(`   Health check: ${this.ngrokUrl}/health`);
          console.error(`   API info: ${this.ngrokUrl}/info`);
          if (this.config.enableHttps) {
            console.error(`   SSL info: ${this.ngrokUrl}/ssl-info`);
          }
        } catch (error) {
          console.error(`⚠️ Failed to start ngrok: ${error}`);
          console.error(`   Servers still available locally:`);
          console.error(`   HTTP: http://localhost:${this.config.port}`);
          if (this.config.enableHttps) {
            console.error(`   HTTPS: https://localhost:${this.config.httpsPort}`);
          }
        }
      } else {
        console.error(`📡 Server endpoints:`);
        console.error(`   HTTP: http://localhost:${this.config.port}/mcp`);
        if (this.config.enableHttps) {
          console.error(`   HTTPS: https://localhost:${this.config.httpsPort}/mcp`);
          console.error(`   SSL Info: https://localhost:${this.config.httpsPort}/ssl-info`);
        }
        console.error(`   Health: http://localhost:${this.config.port}/health`);
        console.error(`   Info: http://localhost:${this.config.port}/info`);
      }

    } catch (error) {
      console.error('Failed to start HTTPS MCP server:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the server and cleanup
   */
  async stop(): Promise<void> {
    // Close all active sessions
    for (const [sessionId, transport] of this.activeSessions) {
      try {
        await transport.close();
      } catch (error) {
        console.error(`Failed to close session ${sessionId}:`, error);
      }
    }
    this.activeSessions.clear();

    // Stop HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => resolve());
      });
    }

    // Stop HTTPS server
    if (this.httpsServer) {
      await new Promise<void>((resolve) => {
        this.httpsServer.close(() => resolve());
      });
    }

    // Stop ngrok
    if (this.ngrokProcess) {
      this.ngrokProcess.kill();
    }
  }
}

async function main(): Promise<void> {
  const server = new HttpsServer();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\n🛑 Shutting down HTTPS MCP server...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\n🛑 Shutting down HTTPS MCP server...');
    await server.stop();
    process.exit(0);
  });

  await server.start();
}

// Export for testing and external use
export { HttpsServer };
export type { HttpsServerConfig };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('HTTPS server failed:', error);
    process.exit(1);
  });
}