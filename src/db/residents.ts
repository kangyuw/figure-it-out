// Simulated residents database with both naive and streaming APIs.
// Uses CommonJS require to avoid needing @types/node.
const stream: any = require('stream');
import type { Resident } from '../types';

const FILLER_BASE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

function makeFiller(targetBytes: number): string {
  let s = '';
  while (Buffer.byteLength(s) < targetBytes) s += FILLER_BASE + ' ';
  return s.slice(0, targetBytes);
}

function makeResident(id: number): Resident {
  const approxDataBytes = 900;
  return {
    id,
    first_name: `First${id}`,
    last_name: `Last${id}`,
    email: `user${id}@example.com`,
    phone: `+1-555-01${String(id % 10000).padStart(4, '0')}`,
    address: `123 Main St Apt ${id}`,
    city: `City${id % 1000}`,
    state: `ST`,
    postal_code: String(10000 + (id % 90000)),
    notes: makeFiller(approxDataBytes),
  };
}

export async function fetchAllResidents(count: number): Promise<Resident[]> {
  const arr = new Array<Resident>(count);
  for (let i = 0; i < count; i++) arr[i] = makeResident(i + 1);
  return arr;
}

async function* residentGenerator(
  count: number,
  opts: { simulateLatency?: boolean } = {}
): AsyncGenerator<Resident> {
  const { simulateLatency = false } = opts;
  for (let i = 0; i < count; i++) {
    if (simulateLatency && i % 1000 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
    yield makeResident(i + 1);
  }
}

export function createResidentGenerator(
  count: number,
  opts: { simulateLatency?: boolean } = {}
): any {
  const gen = residentGenerator(count, opts);
  // Very small highWaterMark to minimize buffering
  // This is critical for memory control - larger values cause memory bloat
  return stream.Readable.from(gen, { objectMode: true, highWaterMark: 4 });
}

