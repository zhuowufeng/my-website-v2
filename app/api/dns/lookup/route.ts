/**
 * DNS Lookup API
 * 使用 Node.js 内置 dns 模块进行多维度 DNS 查询
 * 支持多公共 DNS 服务器模拟多地解析
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resolver } from 'node:dns/promises';

// ============ Types ============

interface DNSRecord {
  type: string;
  value: string;
  priority?: number;
}

interface ResolverResult {
  resolver: string;
  location: string;
  records: DNSRecord[];
  time: number;
  error?: string;
}

interface DNSLookupResult {
  domain: string;
  resolvers: ResolverResult[];
  summary: {
    totalResolvers: number;
    successCount: number;
    errorCount: number;
    avgTime: number;
  };
  health: HealthCheck[];
}

interface HealthCheck {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  detail?: string;
}

// ============ Resolver Config ============

const RESOLVERS = [
  { ip: '1.1.1.1', name: 'Cloudflare', location: '全球 (Anycast)' },
  { ip: '8.8.8.8', name: 'Google', location: '全球 (Anycast)' },
  { ip: '9.9.9.9', name: 'Quad9', location: '全球 (Anycast)' },
  { ip: '208.67.222.222', name: 'OpenDNS', location: '全球 (Anycast)' },
  { ip: '114.114.114.114', name: '114DNS', location: '中国 (国内)' },
];

// ============ Query helper with timeout ============

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

// ============ Query resolver ============

async function queryResolver(resolverIp: string, domain: string): Promise<ResolverResult> {
  const resolver = new Resolver();
  resolver.setServers([resolverIp]);

  const resolverInfo = RESOLVERS.find(r => r.ip === resolverIp) || { name: 'Unknown', location: 'Unknown' };
  const records: DNSRecord[] = [];
  const start = Date.now();

  // Helper to safely try a lookup and suppress ENOTFOUND/ENODATA
  async function tryLookup<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await withTimeout(fn(), 5000);
    } catch (e: any) {
      if (e?.code === 'ENOTFOUND' || e?.code === 'ENODATA' || e?.code === 'ENOTIMP') return null;
      throw e;
    }
  }

  try {
    // A records
    const a = await tryLookup(() => resolver.resolve4(domain));
    if (a) { for (const v of a) records.push({ type: 'A', value: v }); }

    // AAAA records
    const aaaa = await tryLookup(() => resolver.resolve6(domain));
    if (aaaa) { for (const v of aaaa) records.push({ type: 'AAAA', value: v }); }

    // CNAME
    const cname = await tryLookup(() => resolver.resolveCname(domain));
    if (cname) { for (const v of cname) records.push({ type: 'CNAME', value: v }); }

    // MX
    const mx = await tryLookup(() => resolver.resolveMx(domain));
    if (mx) { for (const v of mx) records.push({ type: 'MX', value: `${v.exchange} (优先级 ${v.priority})`, priority: v.priority }); }

    // NS
    const ns = await tryLookup(() => resolver.resolveNs(domain));
    if (ns) { for (const v of ns) records.push({ type: 'NS', value: v }); }

    // TXT
    const txt = await tryLookup(() => resolver.resolveTxt(domain));
    if (txt) { for (const group of txt) records.push({ type: 'TXT', value: group.join(' ') }); }
  } catch (e: any) {
    const time = Date.now() - start;
    return {
      resolver: resolverInfo.name,
      location: resolverInfo.location,
      records,
      time,
      error: e?.message || 'UNKNOWN_ERROR',
    };
  }

  const time = Date.now() - start;

  return {
    resolver: resolverInfo.name,
    location: resolverInfo.location,
    records,
    time,
    ...(records.length === 0 ? { error: 'NO_DATA' } : {}),
  };
}

// ============ Health Checks ============

function runHealthChecks(result: ResolverResult[], avgTime: number): HealthCheck[] {
  const checks: HealthCheck[] = [];

  const allARecords = result.flatMap(r => r.records.filter(rec => rec.type === 'A'));
  const allCNAME = result.flatMap(r => r.records.filter(rec => rec.type === 'CNAME'));
  const workingResolvers = result.filter(r => r.records.length > 0);

  // Check 1: Does the domain resolve?
  if (workingResolvers.length === 0) {
    checks.push({
      type: 'error',
      message: '❌ 域名无法解析！',
      detail: '所有 DNS 服务器均无法解析该域名，可能域名未注册、DNS 配置错误或已过期。',
    });
  } else {
    checks.push({
      type: 'success',
      message: `✅ 域名解析成功（${workingResolvers.length}/${result.length} 个解析器成功）`,
    });
  }

  // Check 2: Response speed
  if (avgTime > 2000) {
    checks.push({
      type: 'warning',
      message: `⚠️ DNS 响应偏慢（平均 ${Math.round(avgTime)}ms）`,
      detail: '正常应在 200ms 以内。建议检查 DNS 服务商或使用 CDN 加速。',
    });
  } else if (avgTime > 500) {
    checks.push({
      type: 'warning',
      message: `⏱ DNS 响应一般（平均 ${Math.round(avgTime)}ms）`,
      detail: '还可以接受，但优化到 200ms 以内会更好。',
    });
  } else {
    checks.push({
      type: 'success',
      message: `⚡ DNS 响应快（平均 ${Math.round(avgTime)}ms）`,
    });
  }

  // Check 3: CNAME conflict
  if (allCNAME.length > 0 && allARecords.length > 0) {
    checks.push({
      type: 'warning',
      message: '⚠️ CNAME 记录与 A 记录共存',
      detail: '根域名（apex domain）的 CNAME 记录会与其他记录冲突。建议将 CNAME 用于子域名，根域名使用 A/AAAA 记录。',
    });
  }

  // Check 4: Global consistency
  const uniqueAValues = new Set(allARecords.map(r => r.value));
  if (uniqueAValues.size > 1 && workingResolvers.length > 1) {
    checks.push({
      type: 'info',
      message: '🌍 多地 DNS 解析结果不一致',
      detail: `不同 DNS 服务器解析到不同 IP 地址（共 ${uniqueAValues.size} 个不同 IP）。如果使用 CDN/GSLB 这是正常的。`,
    });
  } else if (workingResolvers.length > 0) {
    checks.push({
      type: 'success',
      message: '✅ 多地解析结果一致',
    });
  }

  // Check 5: MX records
  const mxRecords = result.flatMap(r => r.records.filter(rec => rec.type === 'MX'));
  if (mxRecords.length === 0) {
    checks.push({
      type: 'info',
      message: '📧 未检测到 MX 记录',
      detail: '如果没有使用该域名收发邮件，这是正常的。',
    });
  } else {
    checks.push({
      type: 'success',
      message: `📧 MX 记录存在（${mxRecords.length} 条）`,
    });
  }

  // Check 6: Partial failures
  const resolversFailed = result.filter(r => r.records.length === 0).map(r => r.resolver);
  if (resolversFailed.length > 0 && resolversFailed.length < result.length && workingResolvers.length > 0) {
    checks.push({
      type: 'warning',
      message: `⚠️ 部分 DNS 解析器无响应：${resolversFailed.join(', ')}`,
      detail: '可能是 DNS 传播延迟或某些地区的 DNS 服务商问题。',
    });
  }

  return checks;
}

// ============ Route Handler ============

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return NextResponse.json(
      { error: '请提供 domain 参数，如 ?domain=example.com' },
      { status: 400 }
    );
  }

  // Sanitize domain
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  // Validate domain format
  const domainRegex = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
  if (!domainRegex.test(cleanDomain)) {
    return NextResponse.json(
      { error: '域名格式不正确，请输入有效域名（如 example.com）' },
      { status: 400 }
    );
  }

  // Query all resolvers in parallel
  const results = await Promise.all(
    RESOLVERS.map(r => queryResolver(r.ip, cleanDomain))
  );

  // Summary
  const successCount = results.filter(r => r.records.length > 0).length;
  const errorCount = results.length - successCount;
  const avgTime = results.reduce((s, r) => s + r.time, 0) / results.length;

  // Health checks
  const health = runHealthChecks(results, avgTime);

  const lookupResult: DNSLookupResult = {
    domain: cleanDomain,
    resolvers: results,
    summary: {
      totalResolvers: results.length,
      successCount,
      errorCount,
      avgTime: Math.round(avgTime),
    },
    health,
  };

  return NextResponse.json(lookupResult);
}
