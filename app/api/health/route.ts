/**
 * Health check endpoint
 * Returns server status without needing database
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const startTime = process.uptime();
  
  const health = {
    status: 'ok',
    service: 'sinmoniker',
    version: '2.0.0',
    uptime: Math.floor(startTime),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    memory: process.memoryUsage ? {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    } : null,
  };

  return Response.json(health, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json',
    },
  });
}
