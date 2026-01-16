// Memory diagnostics to understand RSS vs heap usage

export function getDetailedMemoryInfo() {
  const mem = process.memoryUsage();
  
  // Calculate external memory (RSS - heap - arrayBuffers)
  // External includes: stream buffers, socket buffers, native C++ objects, etc.
  const external = mem.rss - mem.heapTotal - (mem.arrayBuffers || 0);
  
  return {
    rss: Math.round(mem.rss / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    external: Math.round(external / 1024 / 1024),
    arrayBuffers: Math.round((mem.arrayBuffers || 0) / 1024 / 1024),
    // Calculate what's not accounted for in heap
    nonHeap: Math.round((mem.rss - mem.heapTotal) / 1024 / 1024),
  };
}

export function logDetailedMemory(prefix = 'mem') {
  const info = getDetailedMemoryInfo();
  console.log(
    `[${prefix}] rss=${info.rss}MB ` +
    `heapUsed=${info.heapUsed}MB heapTotal=${info.heapTotal}MB ` +
    `external=${info.external}MB arrayBuffers=${info.arrayBuffers}MB ` +
    `nonHeap=${info.nonHeap}MB`
  );
}
