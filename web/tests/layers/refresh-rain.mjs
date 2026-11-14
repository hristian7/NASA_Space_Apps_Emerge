// Refresh only the IMERG observation date. Run from any directory.
import { readFile, writeFile } from 'node:fs/promises';
const response = await fetch('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml');
if (!response.ok) throw new Error(`Capabilities: ${response.status}`);
const xml = await response.text();
const entry = xml.split('<Layer>').find(block => /<ows:Identifier>IMERG_Precipitation_Rate<\/ows:Identifier>/.test(block));
const date = entry?.match(/<Default>(\d{4}-\d{2}-\d{2})<\/Default>/)?.[1];
if (!date) throw new Error('IMERG date absent from capabilities');
const file = new URL('../../src/config/layers.ts', import.meta.url);
const before = await readFile(file, 'utf8');
const after = before.replace(/(IMERG_Precipitation_Rate[^\n]*date: ')[^']+(')/, `$1${date}$2`);
if (!after.includes(`firstDate: '2000-06-01', date: '${date}'`)) throw new Error('IMERG registry entry not found');
await writeFile(file, after);
console.log(`IMERG latest date: ${date} [V]`);
