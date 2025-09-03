/**
 * @fileoverview SSL certificate utilities for HTTPS server
 * Generates self-signed certificates for development and handles custom certificates
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

export interface CertificateConfig {
  keyPath: string;
  certPath: string;
  commonName?: string;
  organization?: string;
  country?: string;
}

/**
 * Default certificate paths
 */
export function getDefaultCertPaths(): CertificateConfig {
  const certDir = join(homedir(), '.indesign-mcp', 'certs');
  if (!existsSync(certDir)) {
    mkdirSync(certDir, { recursive: true });
  }
  
  return {
    keyPath: join(certDir, 'server.key'),
    certPath: join(certDir, 'server.crt'),
    commonName: 'localhost',
    organization: 'InDesign MCP Server',
    country: 'US'
  };
}

/**
 * Check if certificates exist and are valid
 */
export function certificatesExist(config: CertificateConfig): boolean {
  return existsSync(config.keyPath) && existsSync(config.certPath);
}

/**
 * Generate self-signed certificate using OpenSSL
 */
export async function generateSelfSignedCertificate(config: CertificateConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const subject = `/C=${config.country}/O=${config.organization}/CN=${config.commonName}`;
    
    const openssl = spawn('openssl', [
      'req',
      '-x509',
      '-newkey', 'rsa:2048',
      '-keyout', config.keyPath,
      '-out', config.certPath,
      '-days', '365',
      '-nodes',
      '-subj', subject,
      '-extensions', 'v3_req',
      '-config', '-'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    // OpenSSL config for SAN (Subject Alternative Names)
    const opensslConfig = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C=${config.country}
O=${config.organization}
CN=${config.commonName}

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = 127.0.0.1
DNS.4 = *.ngrok.app
DNS.5 = *.ngrok.io
IP.1 = 127.0.0.1
IP.2 = ::1
`;

    openssl.stdin.write(opensslConfig);
    openssl.stdin.end();

    let stdout = '';
    let stderr = '';

    openssl.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    openssl.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    openssl.on('close', (code) => {
      if (code === 0) {
        console.error(`🔐 Generated self-signed certificate:`);
        console.error(`   Key: ${config.keyPath}`);
        console.error(`   Certificate: ${config.certPath}`);
        resolve();
      } else {
        reject(new Error(`OpenSSL failed with code ${code}: ${stderr}`));
      }
    });

    openssl.on('error', (error) => {
      reject(new Error(`Failed to start OpenSSL: ${error.message}`));
    });
  });
}

/**
 * Read certificate files and return as objects
 */
export function loadCertificates(config: CertificateConfig): { key: string; cert: string } {
  try {
    const key = readFileSync(config.keyPath, 'utf8');
    const cert = readFileSync(config.certPath, 'utf8');
    return { key, cert };
  } catch (error) {
    throw new Error(`Failed to load certificates: ${error}`);
  }
}

/**
 * Check if OpenSSL is available
 */
export async function checkOpenSSLAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const openssl = spawn('openssl', ['version'], { stdio: 'pipe' });
    openssl.on('close', (code) => {
      resolve(code === 0);
    });
    openssl.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Check if mkcert is available
 */
export async function checkMkcertAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const mkcert = spawn('mkcert', ['-version'], { stdio: 'pipe' });
    mkcert.on('close', (code) => {
      resolve(code === 0);
    });
    mkcert.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Generate trusted local certificate using mkcert
 */
export async function generateMkcertCertificate(config: CertificateConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    // mkcert arguments for localhost and common development domains
    const domains = [
      'localhost',
      '127.0.0.1',
      '::1',
      '*.localhost',
      '*.ngrok.app',
      '*.ngrok.io'
    ];

    const mkcertArgs = [
      '-key-file', config.keyPath,
      '-cert-file', config.certPath,
      ...domains
    ];

    const mkcert = spawn('mkcert', mkcertArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    mkcert.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    mkcert.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    mkcert.on('close', (code) => {
      if (code === 0) {
        console.error(`🔐 Generated trusted local certificate using mkcert:`);
        console.error(`   Key: ${config.keyPath}`);
        console.error(`   Certificate: ${config.certPath}`);
        console.error(`   Domains: ${domains.join(', ')}`);
        console.error(`   ✅ Certificate is trusted by your browser and system`);
        resolve();
      } else {
        reject(new Error(`mkcert failed with code ${code}: ${stderr}`));
      }
    });

    mkcert.on('error', (error) => {
      reject(new Error(`Failed to start mkcert: ${error.message}`));
    });
  });
}

/**
 * Install mkcert root CA (one-time setup)
 */
export async function installMkcertCA(): Promise<void> {
  return new Promise((resolve, reject) => {
    const mkcert = spawn('mkcert', ['-install'], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    mkcert.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    mkcert.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    mkcert.on('close', (code) => {
      if (code === 0) {
        console.error(`✅ mkcert root CA installed - certificates will be trusted by browsers`);
        resolve();
      } else {
        // Code 1 often means CA is already installed
        if (stderr.includes('already exists') || stderr.includes('already installed')) {
          console.error(`✅ mkcert root CA already installed`);
          resolve();
        } else {
          reject(new Error(`mkcert CA installation failed: ${stderr}`));
        }
      }
    });

    mkcert.on('error', (error) => {
      reject(new Error(`Failed to install mkcert CA: ${error.message}`));
    });
  });
}

/**
 * Get certificate info (expiry, subject, etc.)
 */
export async function getCertificateInfo(certPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const openssl = spawn('openssl', ['x509', '-in', certPath, '-text', '-noout'], { stdio: 'pipe' });
    
    let stdout = '';
    let stderr = '';

    openssl.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    openssl.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    openssl.on('close', (code) => {
      if (code === 0) {
        // Parse certificate info
        const info = {
          subject: stdout.match(/Subject: (.+)/)?.[1] || 'Unknown',
          issuer: stdout.match(/Issuer: (.+)/)?.[1] || 'Unknown',
          notAfter: stdout.match(/Not After : (.+)/)?.[1] || 'Unknown',
          notBefore: stdout.match(/Not Before: (.+)/)?.[1] || 'Unknown',
        };
        resolve(info);
      } else {
        reject(new Error(`OpenSSL failed: ${stderr}`));
      }
    });

    openssl.on('error', (error) => {
      reject(new Error(`Failed to read certificate: ${error.message}`));
    });
  });
}