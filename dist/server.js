const http = require('http');
const url = require('url');
const { fetchAllResidents } = require('./db/residents');
const { toCsvHeader, toCsvRow } = require('./lib/csv');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

function parseCount(reqUrl) {
  const { query } = url.parse(reqUrl, true);
  const raw = query.count;
  const def = 10000;
  const n = raw ? Number(raw) : def;
  if (!Number.isFinite(n) || n <= 0) return def;
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
    try {
      const count = parseCount(req.url);
      console.log(`Starting BROKEN export for count=${count}`);
      logMemory('before');

      const rows = await fetchAllResidents(count);

      const header = toCsvHeader();
      const body = rows.map(toCsvRow).join('');
      const csv = header + body;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="residents.csv"');
      res.setHeader('Cache-Control', 'no-store');
      res.end(csv);
      logMemory('after');
      return;
    } catch (err) {
      console.error('BROKEN export failed:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Internal Server Error');
      return;
    }
  }

  return notFound(res);
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

setInterval(() => logMemory('tick'), 5000).unref();

