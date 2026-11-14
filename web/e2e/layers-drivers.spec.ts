import { expect, test } from '@playwright/test';

const drivers = [
  { name: 'NASA fire-weather index (as shown in GWIS), experimental', address: 'nasa_geos5.fwi', date: new Date().toISOString().slice(0, 10) },
  { name: 'Soil moisture', address: 'SMAP_L3_Passive_Enhanced_Day_Soil_Moisture', date: '2026-11-11' },
  { name: 'Plant greenness (index, 8 days)', address: 'VIIRS_NOAA20_NDVI_8Day', date: '2026-11-13' },
  { name: 'Land type (2024)', address: 'MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual', date: '2024-01-01' },
  { name: 'Air temperature (satellite pass, gaps between passes)', address: 'AIRS_L2_Surface_Air_Temperature_Day', date: '2026-11-14' },
];

test('each driver requests its own data and displays its date', async ({ page }) => {
  await page.route('https://api.open-meteo.com/v1/forecast**', async route => {
    const url = new URL(route.request().url());
    const result = (url.searchParams.get('latitude') ?? '').split(',').map(() => ({ current: { wind_speed_10m: 12, wind_direction_10m: 90, time: '2026-11-14T12:00' } }));
    await route.fulfill({ json: result, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/?lay=', { waitUntil: 'domcontentloaded' });
  for (const driver of drivers) {
    const row = page.locator('.layer-row').filter({ has: page.getByRole('switch', { name: driver.name, exact: true }) });
    const request = page.waitForRequest(req => req.url().includes(driver.address) && (req.url().includes('GetMap') || /\/\d+\/\d+\/\d+\.png/.test(req.url())));
    await row.getByRole('switch').check();
    expect((await request).url()).toContain(driver.date);
    await expect(row).toContainText(driver.date);
    await row.getByRole('switch').uncheck();
  }
  const wind = page.locator('.layer-row').filter({ has: page.getByRole('switch', { name: 'Wind', exact: true }) });
  const windRequest = page.waitForRequest(req => req.url().includes('api.open-meteo.com/v1/forecast'));
  await wind.getByRole('switch').check();
  expect((await windRequest).url()).toContain('wind_speed_10m');
  await expect(wind).toContainText('2026-11-14T12:00');
  await expect(page.locator('.maplibregl-marker')).toHaveCount(25);
});
