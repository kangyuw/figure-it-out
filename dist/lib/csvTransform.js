const { Transform } = require('stream');
const { toCsvHeader, toCsvRow } = require('./csv');

function createResidentCsvTransform({ includeHeader = true } = {}) {
  let headerPushed = false;
  return new Transform({
    objectMode: true,
    highWaterMark: 64,
    transform(chunk, _enc, cb) {
      try {
        if (includeHeader && !headerPushed) {
          headerPushed = true;
          this.push(toCsvHeader());
        }
        this.push(toCsvRow(chunk));
        cb();
      } catch (err) {
        cb(err);
      }
    },
  });
}

module.exports = { createResidentCsvTransform };

