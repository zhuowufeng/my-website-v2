/**
 * HTTP Inspector API
 * 探测 HTTP 响应状态、响应头、重定向链路、SSL 证书详情、响应时间
 * 使用 Node.js fetch + tls 模块实现
 */

import { NextRequest, NextResponse } from 'next/server';
import { connect } from 'node:tls';
import { lookup } from 'node:dns/promises';

// ============ Types ============

interface RedirectStep {
  url: string;
  status: number;
  statusText: string;
}

interface SSLInfo {
  valid: boolean;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  sni: string;
  altNames: string[];
}

interface HttpInspectResult {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  redirectChain: RedirectStep[];
  responseTime: number;
  ssl: SSLInfo | null;
  bodyPreview: string;
  contentType: string | null;
}

// ============ SSL Certificate Inspection ============

async function inspectSSL(hostname: string, port: number = 443): Promise<SSLInfo | null> {
  return new Promise((resolve) => {
    try {
      const socket = connect({
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 8000,
      }, () => {
        try {
          const cert = socket.getPeerCertificate();
          if (!cert || Object.keys(cert).length === 0) {
            socket.destroy();
            resolve(null);
            return;
          }

          const now = new Date();
          const validTo = new Date(cert.valid_to);
          const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          const altNames: string[] = [];
          if (cert.subjectaltname) {
            cert.subjectaltname.split(', ').forEach((name: string) => {
              name = name.trim();
              if (name.startsWith('DNS:')) altNames.push(name.replace('DNS:', ''));
            });
          }

          function str(v: string | string[] | undefined): string {
            if (Array.isArray(v)) return v[0] || 'Unknown';
            return v || 'Unknown';
          }

          resolve({
            valid: daysRemaining > 0,
            issuer: str(cert.issuer?.O) || str(cert.issuer?.CN) || 'Unknown',
            subject: str(cert.subject?.CN) || 'Unknown',
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            daysRemaining: Math.max(0, daysRemaining),
            sni: hostname,
            altNames,
          });
        } catch {
          resolve(null);
        }
        socket.destroy();
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(null);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

// ============ HTTP Request Helpers ============

async function fetchWithRedirects(
  url: string,
  maxRedirects: number = 10
): Promise<{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyPreview: string;
  responseTime: number;
  redirectChain: RedirectStep[];
  finalUrl: string;
}> {
  const chain: RedirectStep[] = [];
  let currentUrl = url;
  let finalStatus = 0;
  let finalStatusText = '';
  let finalHeaders: Record<string, string> = {};
  let finalBody = '';
  let finalTime = 0;
  let finalUrl = '';

  for (let i = 0; i <= maxRedirects; i++) {
    const start = Date.now();
    let response: Response;

    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SinmonikerHTTPChecker/1.0; +https://sinmoniker.com/http-checker)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(10000),
      });
    } catch (err: any) {
      // If it's the first request and fails, propagate
      if (i === 0) throw err;
      // On redirect follow failure, stop here
      break;
    }

    const elapsed = Date.now() - start;
    finalStatus = response.status;
    finalStatusText = response.statusText || '';
    finalTime = elapsed;

    // Convert headers to plain object
    const headerObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headerObj[key.toLowerCase()] = value;
    });
    finalHeaders = headerObj;

    chain.push({
      url: currentUrl,
      status: response.status,
      statusText: response.statusText || '',
    });

    // Check for redirect
    const location = headerObj['location'];
    if (location && [301, 302, 303, 307, 308].includes(response.status)) {
      try {
        currentUrl = new URL(location, currentUrl).toString();
      } catch {
        break;
      }
      continue;
    }

    // Not a redirect — read body preview
    try {
      const text = await response.text();
      finalBody = text.slice(0, 500);
    } catch {
      finalBody = '<binary or unreadable content>';
    }

    finalUrl = currentUrl;
    return {
      status: finalStatus,
      statusText: finalStatusText,
      headers: finalHeaders,
      bodyPreview: finalBody,
      responseTime: finalTime,
      redirectChain: chain,
      finalUrl,
    };
  }

  // Exceeded redirect limit
  return {
    status: finalStatus,
    statusText: finalStatusText,
    headers: finalHeaders,
    bodyPreview: finalBody,
    responseTime: finalTime,
    redirectChain: chain,
    finalUrl: currentUrl,
  };
}

// ============ Helper Functions ============

function extractHostname(url: string): { hostname: string; port: number; protocol: string } {
  try {
    const u = new URL(url);
    return {
      hostname: u.hostname,
      port: u.port ? parseInt(u.port) : (u.protocol === 'https:' ? 443 : 80),
      protocol: u.protocol,
    };
  } catch {
    return { hostname: '', port: 443, protocol: 'https:' };
  }
}

function sanitizeUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  // Validate URL
  try {
    const u = new URL(url);
    if (!u.hostname || !u.hostname.includes('.')) return '';
    return url;
  } catch {
    return '';
  }
}

// ============ Route Handler ============

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json(
      { error: '请提供 url 参数，如 ?url=example.com' },
      { status: 400 }
    );
  }

  const cleanUrl = sanitizeUrl(urlParam);
  if (!cleanUrl) {
    return NextResponse.json(
      { error: 'URL 格式不正确，请输入有效网址（如 example.com 或 https://example.com）' },
      { status: 400 }
    );
  }

  try {
    // Parallel: HTTP inspection + SSL inspection
    const { hostname, port } = extractHostname(cleanUrl);
    const isHttps = cleanUrl.startsWith('https://');

    const [httpResult, sslResult] = await Promise.all([
      fetchWithRedirects(cleanUrl).catch(err => ({
        status: 0,
        statusText: err?.message || 'NETWORK_ERROR',
        headers: {},
        bodyPreview: '',
        responseTime: 0,
        redirectChain: [],
        finalUrl: cleanUrl,
      })),
      isHttps ? inspectSSL(hostname, port) : Promise.resolve(null),
    ]);

    // DNS resolution info
    let dnsInfo: { ip: string; time: number } | null = null;
    try {
      const dnsStart = Date.now();
      const addresses = await lookup(hostname);
      dnsInfo = {
        ip: addresses.address,
        time: Date.now() - dnsStart,
      };
    } catch {
      dnsInfo = null;
    }

    const result: HttpInspectResult = {
      url: cleanUrl,
      status: httpResult.status,
      statusText: httpResult.statusText,
      headers: httpResult.headers,
      redirectChain: httpResult.redirectChain,
      responseTime: httpResult.responseTime,
      ssl: sslResult,
      bodyPreview: httpResult.bodyPreview,
      contentType: httpResult.headers['content-type'] || null,
    };

    // Attach DNS info
    const response = {
      ...result,
      dns: dnsInfo,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      { error: `探测失败: ${err?.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
