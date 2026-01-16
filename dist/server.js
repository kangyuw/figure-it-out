"use strict";
// Minimal HTTP server exposing a broken CSV export endpoint.
// Your task: replace the in-memory implementation with a streaming one.
Object.defineProperty(exports, "__esModule", { value: true });
// Using CommonJS require for Node built-ins to avoid requiring @types/node.
const http = require('http');
const url = require('url');
const stream = require('stream');
const { pipeline } = stream;
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);
const residents_1 = require("./db/residents");
const csvTransform_1 = require("./lib/csvTransform");
const memoryDiagnostics_1 = require("./lib/memoryDiagnostics");
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
function parseCount(reqUrl) {
    const parsed = url.parse(reqUrl, true);
    const raw = parsed.query?.count;
    const def = 10000; // safer default for local testing
    const n = raw ? Number(raw) : def;
    if (!Number.isFinite(n) || n <= 0)
        return def;
    return Math.floor(n);
}
function notFound(res) {
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
const server = http.createServer(async (req, res) => {
    const { pathname } = url.parse(req.url, true);
    if (pathname === '/residents/export.csv') {
        // Streaming implementation using pipeline for robust error handling
        const count = parseCount(req.url);
        console.log(`Starting streaming export for count=${count}`);
        logMemory('before');
        (0, memoryDiagnostics_1.logDetailedMemory)('before-detail');
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
        const source = (0, residents_1.createResidentGenerator)(count);
        const transform = (0, csvTransform_1.createResidentCsvTransform)({ includeHeader: true });
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
            const gcCallCount = transform.getGcCallCount ? transform.getGcCallCount() : 0;
            const m = process.memoryUsage();
            const rss = Math.round(m.rss / (1024 * 1024));
            const heapUsed = Math.round(m.heapUsed / (1024 * 1024));
            const heapTotal = Math.round(m.heapTotal / (1024 * 1024));
            console.log(`[after] rss=${rss}MB heapUsed=${heapUsed}MB heapTotal=${heapTotal}MB gcCalls=${gcCallCount}`);
            (0, memoryDiagnostics_1.logDetailedMemory)('after-detail');
            console.log('Export completed successfully');
        }
        catch (err) {
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
