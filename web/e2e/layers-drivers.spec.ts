import { expect, test } from '@playwright/test';

test.use({ launchOptions: { args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

const drivers = [
  { name: 'NASA fire-weather index (as shown in GWIS), experimental', address: 'nasa_geos5.fwi', date: new Date().toISOString().slice(0, 10) },
  { name: 'Soil moisture', address: 'SMAP_L3_Passive_Enhanced_Day_Soil_Moisture', date: '2026-11-11' },
  { name: 'Plant greenness (index, 8 days)', address: 'VIIRS_NOAA20_NDVI_8Day', date: '2026-11-13' },
  { name: 'Land type (2024)', address: 'MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual', date: '2024-01-01' },
];

test('each driver requests its own data and displays its date', async ({ page }) => {
  await page.route('https://api.open-meteo.com/v1/forecast**', async route => {
    const url = new URL(route.request().url());
    const result = (url.searchParams.get('latitude') ?? '').split(',').map(() => ({ current: { wind_speed_10m: 12, wind_direction_10m: 90, time: '2026-11-14T12:00' } }));
    await route.fulfill({ json: result, headers: { 'access-control-allow-origin': '*' } });
  });
  // The driver layers belong to the Forecast view; the list opens from the map's tool column.
  await page.goto('/?v=f&lay=', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Layers and legend' }).click();
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

const date = (day: number) => new Date(Date.now() + day * 86400000).toISOString().slice(0, 10);

test('forecast temperature uses one grid request and follows the day control', async ({ page }) => {
  let requests = 0;
  await page.route('https://api.open-meteo.com/v1/forecast**', async route => {
    requests++;
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('daily')).toBe('temperature_2m_max');
    expect(params.get('forecast_days')).toBe('2');
    expect(params.get('latitude')?.split(',')).toHaveLength(64);
    const result = params.get('latitude')!.split(',').map(lat => ({ daily_units: { temperature_2m_max: '°C' }, daily: { time: [date(0), date(1)], temperature_2m_max: [30 - Math.abs(Number(lat)), 33 - Math.abs(Number(lat))] } }));
    await route.fulfill({ json: result });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?v=f&lay=', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Layers and legend' }).click();
  const row = page.locator('.layer-row').filter({ has: page.getByRole('switch', { name: 'Air temperature (forecast)', exact: true }) });
  await row.getByRole('switch').check();
  await expect(row.locator('[data-temperature-state]')).toHaveAttribute('data-temperature-state', 'ready');
  await expect(row).toContainText(date(0));
  await expect(row).toContainText('°C');
  await expect(row).toContainText('Open-Meteo.com');
  await page.getByRole('slider', { name: 'Forecast day' }).fill('1');
  await expect(row).toContainText(date(1));
  await expect(row.locator('[data-temperature-state]')).toHaveAttribute('data-temperature-state', 'ready');
  expect(requests).toBe(1);
  await page.getByRole('slider', { name: 'Forecast day' }).fill('2');
  await expect(row).toContainText('No temperature data');
  await expect(row.locator('[data-temperature-state]')).toHaveAttribute('data-temperature-state', 'empty');
  await page.getByRole('slider', { name: 'Forecast day' }).fill('0');
  await expect(row.locator('[data-temperature-state]')).toHaveAttribute('data-temperature-state', 'ready');
  await row.getByRole('switch').uncheck();
  await row.getByRole('switch').check();
  await expect(row.locator('[data-temperature-state]')).toHaveAttribute('data-temperature-state', 'ready');
  expect(requests).toBe(1);
  expect(errors).toEqual([]);
});

test('forecast temperature reports unavailable data without a fabricated field', async ({ page }) => {
  await page.route('https://api.open-meteo.com/v1/forecast**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/?v=f&lay=t', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Layers and legend' }).click();
  const row = page.locator('.layer-row').filter({ has: page.getByRole('switch', { name: 'Air temperature (forecast)', exact: true }) });
  await expect(row.locator('[data-temperature-state]')).toHaveAttribute('data-temperature-state', 'failed');
  await expect(row).toContainText('No temperature data');
});
