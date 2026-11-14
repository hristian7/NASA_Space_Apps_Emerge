// Builds web/public/geo/countries.json, the country outlines the map uses for
// picking a country by click and drawing its border.
// Input: Natural Earth admin-0 countries GeoJSON (public domain), 10m scale.
// Usage: node scripts/make-country-outlines.mjs <ne_10m_admin_0_countries.geojson>
import { readFileSync, writeFileSync } from 'node:fs';
import { simplify } from '@turf/turf';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/make-country-outlines.mjs <ne_10m_admin_0_countries.geojson>');
  process.exit(1);
}
const source = JSON.parse(readFileSync(input, 'utf8'));
const round = (value) => Math.round(value * 100) / 100;
const roundRing = (ring) => ring.map(([x, y]) => [round(x), round(y)]);

const features = [];
for (const feature of source.features) {
  const p = feature.properties;
  // ISO_A3 is "-99" for a few countries (France, Norway, Kosovo); ADM0_A3 fills the gap.
  const iso3 = p.ISO_A3 && p.ISO_A3 !== '-99' ? p.ISO_A3 : p.ADM0_A3;
  if (!iso3 || !feature.geometry) continue;
  const slim = simplify(feature, { tolerance: 0.05, highQuality: false, mutate: false });
  const g = slim.geometry;
  const coordinates =
    g.type === 'Polygon'
      ? g.coordinates.map(roundRing)
      : g.coordinates.map((poly) => poly.map(roundRing));
  features.push({ type: 'Feature', properties: { iso3, name: p.NAME_EN ?? p.NAME }, geometry: { type: g.type, coordinates } });
}
writeFileSync(new URL('../public/geo/countries.json', import.meta.url), JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`countries: ${features.length}`);
