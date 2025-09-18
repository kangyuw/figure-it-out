// Lightly typed to avoid requiring @types/node.
// Uses CommonJS require to keep typings permissive.
const stream: any = require('stream');
import { toCsvHeader, toCsvRow } from './csv';
import type { Resident } from '../types';

export function createResidentCsvTransform(opts: { includeHeader?: boolean } = {}) {
  const includeHeader = opts.includeHeader !== false;
  let headerPushed = false;
  return new stream.Transform({
    objectMode: true,
    highWaterMark: 64,
    transform(chunk: Resident, _enc: any, cb: (err?: Error | null) => void) {
      try {
        if (includeHeader && !headerPushed) {
          headerPushed = true;
          this.push(toCsvHeader());
        }
        this.push(toCsvRow(chunk));
        cb();
      } catch (err: any) {
        cb(err);
      }
    },
  });
}

