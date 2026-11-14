import type { Map as MapLibreMap } from 'maplibre-gl';
import { createWindField, type Bounds, type WindPoint } from '@/lib/layers/wind';

const spacing = 12;
const colors = ['rgba(215,239,255,0.3)', 'rgba(215,239,255,0.48)', 'rgba(230,247,255,0.7)', 'rgba(255,255,255,0.92)'];

/**
 * A stationary-camera screen field, sampled through MapLibre's public projection
 * API. Round trips reject space outside the globe. Rebuilt in small time slices
 * after camera changes, so neither stale trails nor back-side winds are drawn.
 */
export function createWindFlow(map: MapLibreMap) {
  const canvas = document.createElement('canvas');
  canvas.dataset.windFlow = '';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;width:100%;height:100%';
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  map.getCanvasContainer().appendChild(canvas);
  let points: WindPoint[] = [], bounds: Bounds | null = null;
  let frame = 0, disposed = false, last = 0;
  let width = 0, height = 0, cols = 0, rows = 0;
  let field = new Float32Array(0), valid = new Uint8Array(0);
  let seeds: number[] = [];
  const capacity = 2400;
  const px = new Float32Array(capacity), py = new Float32Array(capacity);
  const age = new Float32Array(capacity), life = new Float32Array(capacity);
  let count = capacity;
  let vx = 0, vy = 0, speed = 0;
  let expensiveFrames = 0;

  const clear = () => ctx.clearRect(0, 0, width, height);
  const pause = () => {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    canvas.dataset.state = 'paused'; clear();
  };
  const blocked = () => disposed || document.hidden || map.isMoving();
  const sample = (x: number, y: number) => {
    const gx = x / spacing, gy = y / spacing;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    if (x < 0 || y < 0 || x >= width || y >= height || ix >= cols - 1 || iy >= rows - 1) return false;
    const a = iy * cols + ix, b = a + 1, c = a + cols, d = c + 1;
    if (!valid[a] || !valid[b] || !valid[c] || !valid[d]) return false;
    const tx = gx - ix, ty = gy - iy;
    const wa = (1 - tx) * (1 - ty), wb = tx * (1 - ty), wc = (1 - tx) * ty, wd = tx * ty;
    vx = field[a * 3] * wa + field[b * 3] * wb + field[c * 3] * wc + field[d * 3] * wd;
    vy = field[a * 3 + 1] * wa + field[b * 3 + 1] * wb + field[c * 3 + 1] * wc + field[d * 3 + 1] * wd;
    speed = field[a * 3 + 2] * wa + field[b * 3 + 2] * wb + field[c * 3 + 2] * wc + field[d * 3 + 2] * wd;
    return true;
  };
  const seed = (i: number) => {
    const cell = seeds[Math.floor(Math.random() * seeds.length)];
    px[i] = (cell % cols + Math.random()) * spacing;
    py[i] = (Math.floor(cell / cols) + Math.random()) * spacing;
    age[i] = 0; life[i] = 0.7 + Math.random() * 1.4;
  };
  const animate = (time: number) => {
    frame = 0;
    if (blocked()) { pause(); return; }
    const started = performance.now();
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
    last = time;
    // Erase alpha rather than painting a dark veil over the basemap.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${1 - Math.exp(-dt * 5)})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    // Batch strokes by speed/brightness, avoiding thousands of draw calls.
    const paths = colors.map(() => new Path2D());
    for (let i = 0; i < count; i++) {
      age[i] += dt;
      if (age[i] > life[i] || !sample(px[i], py[i])) { seed(i); continue; }
      const x = px[i], y = py[i];
      // Midpoint integration follows curved streamlines across cell boundaries.
      if (!sample(x + vx * dt / 2, y + vy * dt / 2)) { seed(i); continue; }
      const nx = x + vx * dt, ny = y + vy * dt;
      const bucket = Math.min(3, Math.floor(speed / 15));
      if (!sample(nx, ny)) { seed(i); continue; }
      paths[bucket].moveTo(x, y); paths[bucket].lineTo(nx, ny);
      px[i] = nx; py[i] = ny;
    }
    ctx.lineWidth = 1.25; ctx.lineCap = 'round';
    for (let i = 0; i < paths.length; i++) { ctx.strokeStyle = colors[i]; ctx.stroke(paths[i]); }
    // Keep headroom on slower machines without changing wind speed.
    if (performance.now() - started > 2.5) expensiveFrames++; else expensiveFrames = 0;
    if (expensiveFrames >= 5) { count = Math.max(600, Math.floor(count * 0.85)); expensiveFrames = 0; }
    frame = requestAnimationFrame(animate);
  };
  const rebuild = () => {
    pause();
    if (blocked() || !bounds || !points.length) return;
    width = map.getCanvas().clientWidth; height = map.getCanvas().clientHeight;
    if (!width || !height) return;
    // Cap backing resolution to avoid excessive compositing cost on dense screens.
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    cols = Math.ceil(width / spacing) + 1; rows = Math.ceil(height / spacing) + 1;
    field = new Float32Array(cols * rows * 3); valid = new Uint8Array(cols * rows); seeds = [];
    const geographic = createWindField(points, bounds);
    // A subpixel geographic probe remains local even at street-level zoom.
    const probe = Math.max(1e-9, Math.min(0.01, (bounds.east - bounds.west) / width / 10));
    let cursor = 0;
    canvas.dataset.state = 'sampling';
    const build = () => {
      frame = 0;
      if (blocked()) { pause(); return; }
      const started = performance.now();
      while (cursor < cols * rows && performance.now() - started < 2) {
        const i = cursor++, x = (i % cols) * spacing, y = Math.floor(i / cols) * spacing;
        const location = map.unproject([x, y]);
        const back = map.project(location);
        if (!Number.isFinite(location.lat) || Math.abs(location.lat) > 89 || Math.hypot(back.x - x, back.y - y) > 0.5) continue;
        const velocity = geographic(location.lng, location.lat);
        if (!velocity) continue;
        const magnitude = Math.hypot(velocity.east, velocity.north);
        const cos = Math.cos(location.lat * Math.PI / 180);
        const step = magnitude > 0 ? probe / magnitude : 0;
        const end = map.project([location.lng + velocity.east * step / cos, location.lat + velocity.north * step]);
        const dx = end.x - back.x, dy = end.y - back.y, length = Math.hypot(dx, dy);
        if (!Number.isFinite(length) || length > width / 2) continue;
        // Visual advection is accelerated, not a claim about real travel distance.
        const scale = length > 1e-9 ? Math.min(120, magnitude * 1.8) / length : 0;
        field[i * 3] = dx * scale; field[i * 3 + 1] = dy * scale; field[i * 3 + 2] = magnitude;
        valid[i] = 1;
      }
      if (cursor < cols * rows) { frame = requestAnimationFrame(build); return; }
      for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols - 1; x++) {
        const i = y * cols + x;
        if (valid[i] && valid[i + 1] && valid[i + cols] && valid[i + cols + 1]) seeds.push(i);
      }
      if (!seeds.length) { canvas.dataset.state = 'empty'; return; }
      count = Math.min(capacity, Math.max(1200, Math.round(width * height / 350)));
      for (let i = 0; i < count; i++) { seed(i); age[i] = Math.random() * life[i]; }
      canvas.dataset.state = 'running';
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(build);
  };
  const visibility = () => { if (document.hidden) pause(); else rebuild(); };
  map.on('movestart', pause);
  map.on('moveend', rebuild);
  map.on('resize', rebuild);
  map.on('projectiontransition', rebuild);
  document.addEventListener('visibilitychange', visibility);
  return {
    setData(next: WindPoint[], area: Bounds) { points = next; bounds = area; rebuild(); },
    clear() { points = []; bounds = null; pause(); },
    destroy() {
      disposed = true; pause(); canvas.remove();
      map.off('movestart', pause); map.off('moveend', rebuild);
      map.off('resize', rebuild); map.off('projectiontransition', rebuild);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
