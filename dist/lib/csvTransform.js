"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResidentCsvTransform = createResidentCsvTransform;
// Lightly typed to avoid requiring @types/node.
// Uses CommonJS require to keep typings permissive.
const stream = require('stream');
const csv_1 = require("./csv");
// Memory constraint: RSS should not exceed ~100MB
// Each Resident is ~1KB, so we must limit buffering aggressively
const GC_INTERVAL = 500; // GC every N records
const MEMORY_CHECK_INTERVAL = 100; // Check memory every N records
const HIGH_WATER_MARK = 128; // Buffer size for memory control
const RSS_LIMIT_MB = 90; // Trigger aggressive GC when approaching 100MB limit
const RSS_EXCEEDED_THRESHOLD = 100; // Track if RSS ever exceeds this
function createResidentCsvTransform(opts = {}) {
    const includeHeader = opts.includeHeader !== false;
    let headerPushed = false;
    let processedCount = 0;
    // Get GC function (requires --expose-gc flag)
    const gc = typeof global !== 'undefined' && global.gc;
    let gcCallCount = 0;
    let streamStarted = false;
    let peakRssMB = 0;
    // Stats for memory-aware GC
    let memoryAwareGcCount = 0;
    let memoryAwareGcProcessedSum = 0;
    let rssExceeded100 = false;
    const transform = new stream.Transform({
        objectMode: true,
        highWaterMark: HIGH_WATER_MARK,
        readableHighWaterMark: HIGH_WATER_MARK,
        writableHighWaterMark: HIGH_WATER_MARK,
        transform(chunk, _enc, cb) {
            try {
                // Log at the start of stream processing
                if (!streamStarted) {
                    streamStarted = true;
                    const mem = process.memoryUsage();
                    console.log(`[Stream Start] rss=${Math.round(mem.rss / 1024 / 1024)}MB ` +
                        `heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB ` +
                        `highWaterMark=${HIGH_WATER_MARK}`);
                }
                if (includeHeader && !headerPushed) {
                    headerPushed = true;
                    this.push((0, csv_1.toCsvHeader)());
                }
                // Convert to CSV row and push
                this.push((0, csv_1.toCsvRow)(chunk));
                processedCount++;
                // Memory-aware GC: check RSS and trigger GC more aggressively near limit
                if (processedCount % MEMORY_CHECK_INTERVAL === 0) {
                    const rssMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
                    peakRssMB = Math.max(peakRssMB, rssMB);
                    if (rssMB >= RSS_EXCEEDED_THRESHOLD) {
                        rssExceeded100 = true;
                    }
                    if (rssMB >= RSS_LIMIT_MB && gc) {
                        memoryAwareGcCount++;
                        memoryAwareGcProcessedSum += processedCount;
                        gcCallCount++;
                        gc();
                    }
                }
                // Regular interval GC
                if (processedCount % GC_INTERVAL === 0 && gc) {
                    gcCallCount++;
                    gc();
                }
                cb();
            }
            catch (err) {
                cb(err);
            }
        },
        flush(cb) {
            if (gc) {
                gcCallCount++;
                gc();
            }
            cb();
        }
    });
    // GC on drain events (when backpressure releases)
    if (gc) {
        transform.on('drain', () => {
            gcCallCount++;
            gc();
        });
    }
    // Expose stats as properties
    transform.getGcCallCount = () => gcCallCount;
    transform.getPeakRssMB = () => peakRssMB;
    // Log summary at the end of stream processing
    transform.on('end', () => {
        const mem = process.memoryUsage();
        const avgProcessedAtMemGc = memoryAwareGcCount > 0
            ? Math.round(memoryAwareGcProcessedSum / memoryAwareGcCount)
            : 0;
        console.log(`[Stream End] processed=${processedCount} rows | ` +
            `memoryAwareGC: count=${memoryAwareGcCount}, avgProcessedCount=${avgProcessedAtMemGc} | ` +
            `rssExceeded100MB=${rssExceeded100} peakRss=${peakRssMB}MB | ` +
            `final: rss=${Math.round(mem.rss / 1024 / 1024)}MB heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
    });
    return transform;
}
