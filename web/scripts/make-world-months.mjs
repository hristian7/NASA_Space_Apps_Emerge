// Builds web/public/geo/world-months.json: fire cell-days per month summed over
// every country file, for the activity strip behind the timeline when no place
// is chosen. Detections outside any country (open sea, unassigned cells) are not
// in a country file and so not in this sum.
// Usage: node scripts/make-world-months.mjs   (run after the country files change)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../public/data/countries/', import.meta.url);
const totals = new Map();
let first = null;
let last = null;
for (const name of readdirSync(dir)) {
  if (!/^[A-Z]{3}\.json$/.test(name)) continue;
  const file = JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
  for (const month of file.months ?? []) {
    const key = `${month.y}-${String(month.m).padStart(2, '0')}`;
    if (typeof month.cd !== 'number') continue;
    totals.set(key, (totals.get(key) ?? 0) + month.cd);
    if (first === null || key < first) first = key;
    if (last === null || key > last) last = key;
  }
}
const months = [];
let [y, m] = first.split('-').map(Number);
for (;;) {
  const key = `${y}-${String(m).padStart(2, '0')}`;
  months.push(Math.round(totals.get(key) ?? 0));
  if (key === last) break;
  m += 1;
  if (m > 12) { m = 1; y += 1; }
}
writeFileSync(new URL('../public/geo/world-months.json', import.meta.url), JSON.stringify({ unit: 'fire_cell_days', first, last, months }));
console.log(`world months: ${first} to ${last}, ${months.length} months`);
