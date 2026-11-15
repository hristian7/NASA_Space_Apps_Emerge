import { expect, test } from '@playwright/test';
import { closeLayers, openLayers } from './helpers';

declare global { interface Window { __windMetrics: { frames: number[]; builds: number[]; strokes: number } } }

test.use({ reducedMotion: 'reduce', launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] } });

const drivers = [
  { name: 'NASA fire-weather index (as shown in GWIS), experimental', address: 'nasa_geos5.fwi', date: new Date().toISOString().slice(0, 10) },
  { name: 'Soil moisture', address: 'SMAP_L3_Passive_Enhanced_Day_Soil_Moisture', date: '2026-11-11' },
  { name: 'Plant greenness (index, 8 days)', address: 'VIIRS_NOAA20_NDVI_8Day', date: '2026-11-13' },
  { name: 'Land type (2024)', address: 'MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual', date: '2024-01-01' },
];

test('each driver requests its own data and displays its date', async ({ page }) => {
  await page.route('https://api.open-meteo.com/v1/forecast**', async route => {
    const url = new URL(route.request().url());
    const result = (url.searchParams.get('latitude') ?? '').split(',').map((_, i) => ({ current: { wind_speed_10m: 12, wind_direction_10m: (i % 4) * 90, time: '2026-11-14T12:00' } }));
    await route.fulfill({ json: result, headers: { 'access-control-allow-origin': '*' } });
  });
  // The driver layers belong to the Forecast view; the list opens from the map's tool column.
  await page.goto('/?v=f&lay=', { waitUntil: 'domcontentloaded' });
  await openLayers(page);
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
  const arrows = page.locator('[data-wind-arrow]');
  await expect(arrows).toHaveCount(25);
  const assertRotations = async () => {
    const rotations = await arrows.evaluateAll(nodes => nodes.map(node => ({
      from: Number((node as HTMLElement).dataset.direction),
      transform: (node as HTMLElement).style.transform,
    })));
    expect(new Set(rotations.map(p => p.from)).size).toBe(4);
    for (const arrow of rotations) expect(arrow.transform).toContain(`rotateZ(${(arrow.from + 90) % 360}deg)`);
  };
  await assertRotations();
  // Real input makes MapLibre rewrite marker positions and transforms.
  await closeLayers(page);
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  if (!box) throw new Error('Map did not render');
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await assertRotations();
});

// A synthetic varying vector field makes motion/direction checks independent of
// provider uptime. Positions are still projected by the real globe renderer.
test.describe('animated wind field', () => {
  test.use({ reducedMotion: 'no-preference' });
  for (const width of [375, 1280]) {
    test(`flow, camera alignment and motion preference at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      let requests = 0;
      await page.route('https://api.open-meteo.com/v1/forecast**', async route => {
        requests++;
        const url = new URL(route.request().url());
        const result = (url.searchParams.get('latitude') ?? '').split(',').map((_, i) => ({
          current: { wind_speed_10m: 12 + (i % 5) * 8, wind_direction_10m: 210 + Math.floor(i / 5) * 25 + (i % 5) * 10, time: '2026-11-14T12:00' },
        }));
        await route.fulfill({ json: result });
      });
      await page.addInitScript(() => {
        const metrics = { frames: [] as number[], builds: [] as number[], strokes: 0 };
        Object.defineProperty(window, '__windMetrics', { value: metrics });
        const stroke = CanvasRenderingContext2D.prototype.stroke;
        CanvasRenderingContext2D.prototype.stroke = function (path?: Path2D) {
          if (this.canvas.hasAttribute('data-wind-flow')) metrics.strokes++;
          return Reflect.apply(stroke, this, path ? [path] : []);
        };
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = callback => raf(time => {
          const before = metrics.strokes;
          const building = document.querySelector('[data-wind-flow]')?.getAttribute('data-state') === 'sampling';
          const start = performance.now();
          callback(time);
          const elapsed = performance.now() - start;
          if (metrics.strokes > before) metrics.frames.push(elapsed);
          else if (building) metrics.builds.push(elapsed);
        });
      });
      await page.goto('/?v=f&lay=w', { waitUntil: 'domcontentloaded' });
      const flow = page.locator('[data-wind-flow]');
      await expect(flow).toHaveAttribute('data-state', 'running');
      await expect(page.locator('[data-wind-arrow]')).toHaveCount(0);
      await page.waitForTimeout(1500);
      const pixels = () => flow.evaluate(node => {
        const canvas = node as HTMLCanvasElement;
        const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 20) painted++;
        return { painted, image: canvas.toDataURL() };
      });
      const first = await pixels();
      expect(first.painted).toBeGreaterThan(1000);
      await page.screenshot({ path: testInfo.outputPath(`wind-${width}-frame-a.png`) });
      await page.waitForTimeout(500);
      const second = await pixels();
      expect(second.image).not.toBe(first.image);
      await page.screenshot({ path: testInfo.outputPath(`wind-${width}-frame-b.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      // Blank space in the top corners of the phone globe must stay blank.
      if (width === 375) {
        expect(await flow.evaluate(node => {
          const canvas = node as HTMLCanvasElement;
          return Array.from(canvas.getContext('2d')!.getImageData(0, 0, 20, 20).data).every(n => n === 0);
        })).toBe(true);
      }
      const box = await page.locator('.maplibregl-canvas').boundingBox();
      if (!box) throw new Error('Map did not render');
      await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.53, { steps: 10 });
      await expect(flow).toHaveAttribute('data-state', 'paused');
      expect((await pixels()).painted).toBe(0);
      await page.mouse.up();
      await expect(flow).toHaveAttribute('data-state', 'running');
      const beforeZoom = requests;
      await page.mouse.wheel(0, -350);
      await expect.poll(() => requests).toBeGreaterThan(beforeZoom);
      await expect(flow).toHaveAttribute('data-state', 'running');
      await page.waitForTimeout(1000);
      expect((await pixels()).painted).toBeGreaterThan(1000);
      await page.screenshot({ path: testInfo.outputPath(`wind-${width}-after-camera.png`) });
      if (width === 1280) {
        // The original rounded grid collapsed here. Real zoom-button input also
        // crosses the globe-to-flat projection transition along the way.
        for (let i = 0; i < 17; i++) {
          await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
          await page.waitForTimeout(350);
        }
        await expect(flow).toHaveAttribute('data-state', 'running');
        await page.waitForTimeout(800);
        expect((await pixels()).painted).toBeGreaterThan(1000);
        await page.screenshot({ path: testInfo.outputPath('wind-street-zoom.png') });
      }
      // Exercise visibility handling deterministically without freezing the test runner.
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(flow).toHaveAttribute('data-state', 'paused');
      expect((await pixels()).painted).toBe(0);
      await page.waitForTimeout(300);
      expect((await pixels()).painted).toBe(0);
      await page.evaluate(() => {
        Reflect.deleteProperty(document, 'hidden');
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(flow).toHaveAttribute('data-state', 'running');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(flow).toHaveCount(0);
      await expect(page.locator('[data-wind-arrow]')).toHaveCount(25);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await expect(page.locator('[data-wind-arrow]')).toHaveCount(0);
      await expect(flow).toHaveAttribute('data-state', 'running');
      const metrics = await page.evaluate(() => {
        const m = window.__windMetrics;
        const sorted = m.frames.toSorted((a, b) => a - b);
        return { frames: sorted.length, median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted.at(-1), buildMax: Math.max(...m.builds) };
      });
      console.log(`Wind frame cost ${width}px: ${JSON.stringify(metrics)}`);
      expect(metrics.frames).toBeGreaterThan(30);
      expect(metrics.p95).toBeLessThanOrEqual(3);
      expect(errors).toEqual([]);
      await openLayers(page);
      await page.getByRole('switch', { name: 'Wind', exact: true }).uncheck();
      await expect(flow).toHaveCount(0);
      await expect(page.locator('[data-wind-arrow]')).toHaveCount(0);
    });
  }
});

const date = (day: number) => new Date(Date.now() + day * 86400000).toISOString().slice(0, 10);

test('forecast temperature uses one ten-day grid request and follows the day control', async ({ page }) => {
  let requests = 0;
  await page.route('https://api.open-meteo.com/v1/forecast**', async route => {
    requests++;
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('daily')).toBe('temperature_2m_max');
    expect(params.get('forecast_days')).toBe('10');
    expect(params.get('latitude')?.split(',')).toHaveLength(64);
    // Day 3 is left without values, to check that a missing day reads as no data.
    const result = params.get('latitude')!.split(',').map(lat => ({ daily_units: { temperature_2m_max: '°C' }, daily: { time: Array.from({ length: 10 }, (_, i) => date(i)), temperature_2m_max: Array.from({ length: 10 }, (_, i) => (i === 3 ? null : 30 + i - Math.abs(Number(lat)))) } }));
    await route.fulfill({ json: result });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?v=f&lay=', { waitUntil: 'domcontentloaded' });
  await openLayers(page);
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
  await expect(row).toContainText(date(2));
  await expect(row.locator('[data-temperature-state]')).toHaveAttribute('data-temperature-state', 'ready');
  await page.getByRole('slider', { name: 'Forecast day' }).fill('3');
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
  await openLayers(page);
  const row = page.locator('.layer-row').filter({ has: page.getByRole('switch', { name: 'Air temperature (forecast)', exact: true }) });
  await expect(row.locator('[data-temperature-state]')).toHaveAttribute('data-temperature-state', 'failed');
  await expect(row).toContainText('No temperature data');
});
