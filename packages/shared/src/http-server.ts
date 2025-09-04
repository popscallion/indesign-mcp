/**
 * @fileoverview HTTP server for InDesign MCP with SSE transport
 * Provides HTTP/HTTPS endpoint that can be proxied through ngrok
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
// TODO: This should import from @mcp/indesign-server when available
// import { createInDesignMcpServer, SERVER_CONFIG } from '@mcp/indesign-server';
const createInDesignMcpServer = null as any;
const SERVER_CONFIG = { name: 'indesign-mcp', version: '1.0.0' };
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { spawn } from 'child_process';
import { URL } from 'url';

interface HttpServerConfig {
  port: number;
  enableNgrok: boolean;
  ngrokAuthToken?: string;
  corsOrigin?: string;
}

const DEFAULT_CONFIG: HttpServerConfig = {
  port: parseInt(process.env.MCP_PORT || '3000'),
  enableNgrok: process.env.ENABLE_NGROK === 'true',
  ngrokAuthToken: process.env.NGROK_AUTH_TOKEN,
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

class HttpMcpServer {
  private server: any;
  private config: HttpServerConfig;
  private ngrokProcess?: any;
  private mcpServer: any;
  private activeSessions = new Map<string, SSEServerTransport>();

  constructor(config: Partial<HttpServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set CORS headers for all responses
   */
  private setCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', this.config.corsOrigin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-ID');
    res.setHeader('Access-Control-Expose-Headers', 'X-Session-ID');
  }

  /**
   * Handle CORS preflight requests
   */
  private handleOptions(res: ServerResponse): void {
    this.setCorsHeaders(res);
    res.writeHead(200);
    res.end();
  }

  /**
   * Parse session ID from URL or headers
   */
  private getSessionId(req: IncomingMessage, url: URL): string | null {
    // Try URL parameter first
    const sessionFromUrl = url.searchParams.get('session');
    if (sessionFromUrl) return sessionFromUrl;
    
    // Try header
    const sessionFromHeader = req.headers['x-session-id'] as string;
    if (sessionFromHeader) return sessionFromHeader;
    
    return null;
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost:${this.config.port}`);
    
    this.setCorsHeaders(res);
    
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
        activeSessions: this.activeSessions.size
      }));
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
      res.end(JSON.stringify({
        name: SERVER_CONFIG.name,
        version: SERVER_CONFIG.version,
        transport: 'SSE',
        endpoints: {
          connect: '/mcp (GET - establish SSE connection)',
          message: '/mcp/message (POST - send messages)',
          health: '/health (GET - server status)'
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
  private async handleSseConnection(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      // Create SSE transport
      const transport = new SSEServerTransport('/mcp/message', res);
      
      // Store session
      this.activeSessions.set(transport.sessionId, transport);

      // Set up event handlers
      transport.onclose = () => {
        console.error(`SSE connection closed: ${transport.sessionId}`);
        this.activeSessions.delete(transport.sessionId);
      };

      transport.onerror = (error: Error) => {
        console.error(`SSE transport error for ${transport.sessionId}:`, error);
        this.activeSessions.delete(transport.sessionId);
      };

      // Connect to MCP server
      await this.mcpServer.connect(transport);
      
      // Start the SSE connection
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
  private async handlePostMessage(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
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

      // Read request body
      let body = '';
      req.on('data', (chunk) => {
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
   * Start ngrok tunnel
   */
  private async startNgrok(): Promise<string> {
    return new Promise((resolve, reject) => {
      const ngrokArgs = ['http', this.config.port.toString()];
      
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
        // Look for tunnel URL in stderr output
        const urlMatch = line.match(/https:\/\/[^\s]+\.ngrok[^\s]*/);
        if (urlMatch) {
          resolve(urlMatch[0]);
        }
      });

      this.ngrokProcess.on('error', (error: Error) => {
        reject(new Error(`Failed to start ngrok: ${error.message}`));
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Ngrok startup timeout'));
      }, 10000);
    });
  }

  /**
   * Start the HTTP MCP server
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

      // Create HTTP server
      this.server = createServer(this.handleRequest.bind(this));
      
      // Start listening
      await new Promise<void>((resolve) => {
        this.server.listen(this.config.port, () => {
          console.error(`🚀 InDesign MCP HTTP Server started on port ${this.config.port}`);
          resolve();
        });
      });

      // Start ngrok if enabled
      if (this.config.enableNgrok) {
        try {
          const ngrokUrl = await this.startNgrok();
          console.error(`🌐 Ngrok tunnel established: ${ngrokUrl}`);
          console.error(`   MCP endpoint: ${ngrokUrl}/mcp`);
          console.error(`   Health check: ${ngrokUrl}/health`);
          console.error(`   API info: ${ngrokUrl}/info`);
        } catch (error) {
          console.error(`⚠️ Failed to start ngrok: ${error}`);
          console.error(`   Server still available at http://localhost:${this.config.port}`);
        }
      } else {
        console.error(`📡 Server endpoints:`);
        console.error(`   MCP: http://localhost:${this.config.port}/mcp`);
        console.error(`   Health: http://localhost:${this.config.port}/health`);
        console.error(`   Info: http://localhost:${this.config.port}/info`);
      }

    } catch (error) {
      console.error('Failed to start HTTP MCP server:', error);
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
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => resolve());
      });
    }

    // Stop ngrok
    if (this.ngrokProcess) {
      this.ngrokProcess.kill();
    }
  }
}

async function main(): Promise<void> {
  const server = new HttpMcpServer();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\n🛑 Shutting down HTTP MCP server...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\n🛑 Shutting down HTTP MCP server...');
    await server.stop();
    process.exit(0);
  });

  await server.start();
}

// Export for testing and external use
export { HttpMcpServer };
export type { HttpServerConfig };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('HTTP server failed:', error);
    process.exit(1);
  });
}