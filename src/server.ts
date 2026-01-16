// Minimal HTTP server exposing a broken CSV export endpoint.
// Your task: replace the in-memory implementation with a streaming one.

// Using CommonJS require for Node built-ins to avoid requiring @types/node.
const http: any = require('http');
const url: any = require('url');
const stream: any = require('stream');
const { pipeline } = stream;
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);

import { createResidentGenerator } from './db/residents';
import { createResidentCsvTransform } from './lib/csvTransform';
import { logDetailedMemory, getDetailedMemoryInfo } from './lib/memoryDiagnostics';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

function parseCount(reqUrl: string): number {
  const parsed = url.parse(reqUrl, true);
  const raw = parsed.query?.count as string | undefined;
  const def = 10000; // safer default for local testing
  const n = raw ? Number(raw) : def;
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.floor(n);
}

function notFound(res: any) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not Found');
}

function logMemory(prefix = 'mem') {
  const m = process.memoryUsage();
  const rss = Math.round(m.rss / (1024 * 1024));
  const heapUsed = Math.round(m.heapUsed / (1024 * 1024));
  const heapTotal = Math.round(m.heapTotal / (1024 * 1024));
  console.log(`[${prefix}] rss=${rss}MB heapUsed=${heapUsed}MB heapTotal=${heapTotal}MB`);
}

const server = http.createServer(async (req: any, res: any) => {
  const { pathname } = url.parse(req.url, true);

  if (pathname === '/residents/export.csv') {
    // Streaming implementation using pipeline for robust error handling
    const count = parseCount(req.url);
    console.log(`Starting streaming export for count=${count}`);
    logMemory('before');
    logDetailedMemory('before-detail');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="residents.csv"');
    res.setHeader('Cache-Control', 'no-store');
    
    // CRITICAL: Reduce the response stream's internal buffer
    // Default is 16KB which causes memory accumulation with slow clients
    // Cork/uncork can help batch writes more efficiently
    if (res.writableHighWaterMark !== undefined) {
      // Note: Cannot change highWaterMark after creation, but we can work with it
      console.log(`[Response] writableHighWaterMark=${res.writableHighWaterMark}`);
    }

    // Create the stream chain with minimal buffering
    const source = createResidentGenerator(count);
    const transform = createResidentCsvTransform({ includeHeader: true });

    // Handle client abort (Ctrl+C, network drop, etc.)
    const cleanup = () => {
      console.log('Client aborted, cleaning up streams');
      source.destroy();
      transform.destroy();
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);

    try {
      // Use pipeline for robust error handling and automatic cleanup
      await pipelineAsync(source, transform, res);
      const gcCallCount = (transform as any).getGcCallCount ? (transform as any).getGcCallCount() : 0;
      const m = process.memoryUsage();
      const rss = Math.round(m.rss / (1024 * 1024));
      const heapUsed = Math.round(m.heapUsed / (1024 * 1024));
      const heapTotal = Math.round(m.heapTotal / (1024 * 1024));
      console.log(`[after] rss=${rss}MB heapUsed=${heapUsed}MB heapTotal=${heapTotal}MB gcCalls=${gcCallCount}`);
      logDetailedMemory('after-detail');
      console.log('Export completed successfully');
    } catch (err: any) {
      // Pipeline already cleaned up streams, but log the error
      if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
        console.error('Export failed:', err);
      }

      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Internal Server Error');
      }
    }
    return;
  }

  return notFound(res);
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// Periodic memory logging to make problems obvious during testing
setInterval(() => logMemory('tick'), 5000).unref();
