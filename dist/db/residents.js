const { Readable } = require('stream');

const FILLER_BASE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
function makeFiller(targetBytes) {
  let s = '';
  while (Buffer.byteLength(s) < targetBytes) s += FILLER_BASE + ' ';
  return s.slice(0, targetBytes);
}

function makeResident(id) {
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

async function fetchAllResidents(count) {
  const arr = new Array(count);
  for (let i = 0; i < count; i++) arr[i] = makeResident(i + 1);
  return arr;
}

async function* residentGenerator(count, { simulateLatency = false } = {}) {
  for (let i = 0; i < count; i++) {
    if (simulateLatency && i % 1000 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
    yield makeResident(i + 1);
  }
}

function createResidentGenerator(count, opts) {
  const gen = residentGenerator(count, opts);
  return Readable.from(gen, { objectMode: true, highWaterMark: 64 });
}

module.exports = {
  fetchAllResidents,
  createResidentGenerator,
};

