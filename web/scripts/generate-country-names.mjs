import { readFileSync, writeFileSync } from "node:fs";

// Use the application's ISO mapping; XK is the CLDR region code for Kosovo.
const source = readFileSync(new URL("../src/components/app/country-codes.ts", import.meta.url), "utf8");
const codes = Object.fromEntries([...source.matchAll(/\b([A-Z]{3}): "([A-Z]{2})"/g)].map((match) => [match[1], match[2]]));
codes.XKX = "XK";

for (const locale of ["en", "bg"]) {
  const path = new URL(`../messages/country.${locale}.json`, import.meta.url);
  const existing = JSON.parse(readFileSync(path, "utf8"));
  const display = new Intl.DisplayNames([locale], { type: "region" });
  for (const [iso3, iso2] of Object.entries(codes)) {
    const name = display.of(iso2);
    if (!name || name === iso2) throw new Error(`Missing ${locale} name for ${iso3}`);
    existing[iso3] ??= name;
  }
  writeFileSync(path, `${JSON.stringify(Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
}
