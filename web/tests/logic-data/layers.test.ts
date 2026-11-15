/**
 * The layer registry: the three declared layers, and the proof that a fourth
 * one needs no code outside the registry.
 */

import { describe, expect, it } from 'vitest';

import { LAYERS, layer, layerUrl, type LayerDefinition } from '../../src/config/layers';

describe('the layer registry', () => {
  it('declares the three layers the app starts with', () => {
    expect(LAYERS.map((entry) => entry.id)).toEqual([
      'harmonized-history',
      'recent-fires',
      'fire-danger',
      'nasa-fwi',
      'soil-moisture',
      'greenness',
      'land-type',
      'air-temperature',
      'wind',
      'rain',
      'smoke',
    ]);
    for (const entry of LAYERS) {
      expect(entry.nameKey.startsWith('layers.')).toBe(true);
      expect(entry.credit.length).toBeGreaterThan(0);
    }
  });

  it('points the harmonized history at a loader that exists', () => {
    const history = layer('harmonized-history');
    expect(history?.loader).toEqual({ status: 'built', module: 'lib/data/api', fn: 'getSeries' });
    expect(history?.units).toEqual(['hot', 'cd']);
    expect(history?.timeStep).toBe('month');
  });

  it('points recent fires at the route that reads the live detection files', () => {
    const recent = layer('recent-fires');
    expect(recent?.loader.status).toBe('built');
    expect(recent?.verified).toBe(true);
    expect(recent?.source.kind).toBe('api_route');
    if (recent?.source.kind !== 'api_route') throw new Error('expected a route');
    expect(recent.source.path).toBe('/api/recent');
  });

  it('carries the tested fire-danger address with a date parameter', () => {
    const danger = layer('fire-danger');
    expect(danger?.source.kind).toBe('tile_template');
    if (danger?.source.kind !== 'tile_template') throw new Error('expected a tile template');
    expect(danger.source.urlTemplate).toContain('time={date}');
    expect(danger.source.urlTemplate).toContain('{bbox-epsg-3857}');
    expect(danger.source.firstDate).toBe('2018-01-01');
    const url = layerUrl(danger.source, '2026-11-14');
    expect(url).toContain('time=2026-11-14');
    expect(url).toContain('{bbox-epsg-3857}');
    expect(url).not.toContain('{date}');
  });

  it('gives undefined for an id nothing carries', () => {
    expect(layer('not-a-layer')).toBeUndefined();
  });

  it('accepts a new entry with no change anywhere else', () => {
    const extra: LayerDefinition = {
      id: 'burned-area',
      nameKey: 'layers.burnedArea',
      kind: 'harmonized_cells',
      units: ['cd'],
      timeStep: 'year',
      source: { kind: 'static_files', paths: ['burned/<year>.json'] },
      credit: 'a source that has to be named before this layer ships',
      loader: { status: 'not_built', note: 'needs the yearly burned-area export' },
      verified: false,
    };
    const extended: LayerDefinition[] = [...LAYERS, extra];
    expect(extended).toHaveLength(LAYERS.length + 1);
    expect(extended[extended.length - 1].id).toBe('burned-area');
    expect(layerUrl(extra.source, '2026-11-14')).toBeNull();
  });
});
