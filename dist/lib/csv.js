"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csvEscape = csvEscape;
exports.toCsvHeader = toCsvHeader;
exports.toCsvRow = toCsvRow;
function csvEscape(value) {
    if (value == null)
        return "";
    const s = String(value);
    if (/[",\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}
function toCsvHeader() {
    const cols = [
        "id",
        "first_name",
        "last_name",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "postal_code",
        "notes",
    ];
    return cols.join(",") + "\n";
}
function toCsvRow(row) {
    const cols = [
        row.id,
        row.first_name,
        row.last_name,
        row.email,
        row.phone,
        row.address,
        row.city,
        row.state,
        row.postal_code,
        row.notes,
    ];
    return cols.map(csvEscape).join(",") + "\n";
}
