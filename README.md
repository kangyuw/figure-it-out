ExaCare 'Figure It Out' Interview

# Context

## Overview
- There is a CSV export endpoint at `GET /residents/export.csv` that crashes with large datasets (>=1M rows).
- Your task: fix it to efficiently handle millions of rows while staying memory-safe and resilient.

## Scenario
- The database contains millions of resident records (simulated).
- Each exported row is approximately 1KB in CSV.
- You should support exports bigger than 1GB

## Constraints
- Memory usage must stay under 100MB regardless of dataset size.
- Implement true streaming from the DB to the HTTP response.
- No buffering of the entire dataset in memory at any point.
- Properly handle backpressure for slow clients.
- Pause database/producer when the client/socket cannot keep up.
- Handle client abort (Ctrl+C, network drop, etc.) cleanly without leaking resources.
- Use Node.js streams with thoughtful `highWaterMark` configuration.
- No external dependencies; use Node core modules only.

## Environment
- Requires Node.js 18 or newer.
- TypeScript source is in `src/`; prebuilt JavaScript is in `dist/` so you can run without installing anything.

## What’s Provided
- TypeScript source in `src/`:
  - `src/server.ts`: tiny HTTP server exposing `/residents/export.csv` (BROKEN implementation on purpose).
  - `src/db/residents.ts`: simulated DB with both naive and streaming-friendly APIs.
  - `src/lib/csv.ts`: CSV helpers/utilities for safe CSV output.
  - `src/lib/csvTransform.ts`: Transform stream to convert objects to CSV lines.
- Prebuilt JS in `dist/` mirrors the above so you can run immediately.

# Your Goal
Replace the broken export with a streaming implementation that:
- Streams from the simulated DB to the response without accumulating all rows.
- Properly propagates backpressure (pause producer when needed, resume when drained).
- Cleans up on client abort (close streams, stop producer, free resources).
- Keeps memory usage comfortably under 100MB for 1M rows.

# Details
## Runing the app
- Start the server: `npm start` (runs `node dist/server.js`)
- Endpoint: `http://localhost:3000/residents/export.csv?count=1000000`
  - You can adjust `count` for smaller tests: `?count=10000`, `?count=250000`, etc.

## Building
- `npm run build` (requires `typescript` to be available in your environment).


## Easy test scripts
- Slow client/backpressure: `npm run test:slow` (10 KB/s)
- Slow + small dataset: `npm run test:slow:small`
- Quick small download: `npm run test:small`
- Abort manually: `npm run test:abort` then press Ctrl+C


## Hints
- Do not materialize all rows in memory (the current code does this and crashes).
- Use a `Readable` from an async generator or a DB-like cursor.
- Convert objects to CSV in a `Transform` stream.
- Use `stream.pipeline(...)` (or `pipeline` promise wrapper) for robust piping and error handling.
- Wire the response abort/close events to cancel upstream production.
- Tune `highWaterMark` to balance throughput and memory.

## Discussion questions
- What is backpressure and why is it important here?
- What happens if we don’t handle the client abort event?
- Explain your choice of `highWaterMark` value.
- How would you add progress reporting to this export?
- What would happen if we used `Promise.all` to process all rows?

## Definition of Done
- Export 1M rows without exceeding ~100MB RSS.
- Works with slow clients (limited rate) and client aborts without crashing or leaking.
- No external dependencies added.
- Clean, readable code with comments explaining key choices.
