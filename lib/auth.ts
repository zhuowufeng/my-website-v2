// lib/auth.ts — JWT 鉴权系统
// 模块8 安全：替代原先无状态的 userId 参数，提供真实鉴权

const JWT_SECRET = process.env.JWT_SECRET || 'mo-yan-jwt-secret-change-in-production-2026';
const TOKEN_EXPIRY = '7d';

export interface TokenPayload {
  userId: number;
  identifier: string;
  role: 'user' | 'admin';
}

/**
 * 生成 JWT 令牌
 */
export async function createToken(payload: TokenPayload): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 7 * 24 * 60 * 60; // 7 days
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const base64UrlEncode = (obj: any) => {
    const json = JSON.stringify(obj);
    const bytes = encoder.encode(json);
    // Use Buffer for encoding since this runs on server
    return Buffer.from(bytes).toString('base64url');
  };

  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(tokenPayload);
  const signature = await createSignature(`${headerB64}.${payloadB64}`, JWT_SECRET);
  
  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * 验证 JWT 令牌
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = await createSignature(`${headerB64}.${payloadB64}`, JWT_SECRET);
    
    // Constant-time comparison
    if (!constantTimeCompare(signature, expectedSig)) return null;

    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    );

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      userId: payload.userId,
      identifier: payload.identifier,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/**
 * 从请求中提取用户身份
 */
export async function getAuthUser(request: Request): Promise<TokenPayload | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  return verifyToken(token);
}

/**
 * 从请求中提取用户身份（从 cookie 回退到 header）
 */
export async function getAuthUserFromRequest(request: Request): Promise<TokenPayload | null> {
  // Try Authorization header first
  const user = await getAuthUser(request);
  if (user) return user;

  // Try cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const tokenCookie = cookies['mo-yan-token'];
  if (tokenCookie) {
    return verifyToken(tokenCookie);
  }

  return null;
}

/**
 * 创建基于 HMAC-SHA256 的签名
 */
async function createSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Buffer.from(new Uint8Array(signature)).toString('base64url');
}

/**
 * 常量时间比较防止时序攻击
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still run a comparison to prevent length-based timing
    let result = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      result |= (a.charCodeAt(Math.min(i, a.length - 1)) ^ b.charCodeAt(Math.min(i, b.length - 1)));
    }
    return result === 0;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * 简单 cookie 解析
 */
function parseCookies(cookieString: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieString) return result;
  cookieString.split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key && rest.length) {
      result[key.trim()] = decodeURIComponent(rest.join('='));
    }
  });
  return result;
}
