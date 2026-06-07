// lib/logger.ts — 结构化日志系统
// 模块8 运维：替代 console.log，提供可查询的日志

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, any>;
  error?: string;
  requestId?: string;
  duration?: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LOG_LEVEL: LogLevel = 
  (process.env.LOG_LEVEL as LogLevel) || 'info';

/**
 * 生成唯一请求 ID
 */
let requestCounter = 0;
export function generateRequestId(): string {
  requestCounter = (requestCounter + 1) % 100000;
  return `req-${Date.now().toString(36)}-${requestCounter.toString(36).padStart(3, '0')}`;
}

/**
 * 获取请求 ID 从 headers
 */
export function getRequestId(request: Request): string {
  const existing = request.headers.get('x-request-id');
  if (existing) return existing;
  return generateRequestId();
}

/**
 * 结构化日志
 */
function log(level: LogLevel, module: string, message: string, extra?: Partial<LogEntry>): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[CURRENT_LOG_LEVEL]) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...extra,
  };

  const logStr = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(logStr);
      break;
    case 'warn':
      console.warn(logStr);
      break;
    case 'debug':
      console.debug(logStr);
      break;
    default:
      console.log(logStr);
  }

  // In production, also report errors (optional)
  if (level === 'error' && process.env.NODE_ENV === 'production') {
    // Future: send to error tracking service (Sentry, etc.)
    // captureError(entry);
  }
}

export const logger = {
  debug: (module: string, message: string, data?: Record<string, any>) =>
    log('debug', module, message, { data }),
  
  info: (module: string, message: string, data?: Record<string, any>) =>
    log('info', module, message, { data }),
  
  warn: (module: string, message: string, data?: Record<string, any>) =>
    log('warn', module, message, { data }),
  
  error: (module: string, message: string, error?: Error | string, data?: Record<string, any>) =>
    log('error', module, message, {
      error: typeof error === 'string' ? error : error?.message,
      data,
    }),

  request: (request: Request, method: string, path: string, status: number, duration: number) => {
    const reqId = getRequestId(request);
    log('info', 'http', `${method} ${path} → ${status}`, {
      requestId: reqId,
      duration,
      data: {
        method,
        path,
        status,
        userAgent: request.headers.get('user-agent')?.substring(0, 80),
        referer: request.headers.get('referer')?.substring(0, 100),
      },
    });
  },
};

/**
 * 将现有 console 调用桥接到结构化日志
 * 在 app 入口处调用一次
 */
export function patchConsole() {
  if (typeof globalThis !== 'undefined' && !(globalThis as any).__loggerPatched) {
    (globalThis as any).__loggerPatched = true;
  }
}

export default logger;
