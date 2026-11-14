/**
 * The mechanics of the data source: unzipping a real tile, sharing one fetch
 * between callers, and telling a missing file apart from a broken one.
 */

import { describe, expect, it } from 'vitest';

import type { TileFile } from '../../src/types/data';
import { DataError, DataSource } from '../../src/lib/data/source';
import { nodeGunzip } from '../../src/lib/data/source.node';
import { loadTile } from '../../src/lib/data/loaders';
import { DATA_DIR, testSource } from './helpers';

describe('the data source, gunzip', () => {
  it('reads a real pre-gzipped tile back into the contract shape', async () => {
    const tile = await loadTile('40_20', testSource());
    expect(tile).not.toBeNull();
    const file = tile as TileFile;
    expect(file.schema).toBe('emerge-tile-1');
    expect(file.tile).toEqual({ lat0: 40, lon0: 20, deg: 5 });
    expect(file.cells.length).toBeGreaterThan(0);
    const cell = file.cells[0];
    const length = cell.mi.length;
    for (const array of [cell.hot, cell.hot_lo, cell.hot_hi, cell.cd, cell.cd_lo, cell.cd_hi, cell.frp, cell.src, cell.flags]) {
      expect(array).toHaveLength(length);
    }
  });

  it('unzips a plain .json file without touching it', async () => {
    const meta = await testSource().json<{ schema: string }>('meta.json');
    expect(meta?.schema).toBe('emerge-meta-1');
  });
});

describe('the data source, caching', () => {
  it('shares one fetch between callers asking at the same time', async () => {
    let calls = 0;
    const source = new DataSource({
      basePath: DATA_DIR,
      gunzip: nodeGunzip,
      fetcher: async (url: string) => {
        calls += 1;
        const { readFile } = await import('node:fs/promises');
        const bytes = await readFile(url);
        return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      },
    });
    const [a, b, c] = await Promise.all([
      source.json<TileFile>('tiles/40_20.json.gz'),
      source.json<TileFile>('tiles/40_20.json.gz'),
      source.json<TileFile>('tiles/40_20.json.gz'),
    ]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(source.cached()).toEqual(['tiles/40_20.json.gz']);

    await source.json<TileFile>('tiles/40_20.json.gz');
    expect(calls).toBe(1);

    source.clear();
    await source.json<TileFile>('tiles/40_20.json.gz');
    expect(calls).toBe(2);
  });

  it('does not keep a failure in the cache', async () => {
    let calls = 0;
    const source = new DataSource({
      basePath: '/nowhere',
      fetcher: async () => {
        calls += 1;
        throw new DataError('fetch', 'x', 'the host said no');
      },
    });
    await expect(source.json('meta.json')).rejects.toBeInstanceOf(DataError);
    await expect(source.json('meta.json')).rejects.toBeInstanceOf(DataError);
    expect(calls).toBe(2);
    expect(source.cached()).toEqual([]);
  });
});

describe('a missing file', () => {
  it('means no fire cells in that square, not an error', async () => {
    const tile = await loadTile('0_0', testSource());
    expect(tile).toBeNull();
  });

  it('is told apart from a file that is there but broken', async () => {
    const source = new DataSource({
      basePath: DATA_DIR,
      fetcher: async () => new Uint8Array([1, 2, 3]),
      gunzip: nodeGunzip,
    });
    await expect(source.json('tiles/40_20.json.gz')).rejects.toMatchObject({
      name: 'DataError',
      kind: 'decompress',
    });
    await expect(source.json('meta.json')).rejects.toMatchObject({
      name: 'DataError',
      kind: 'parse',
    });
  });

  it('is an error for meta.json, which nothing can run without', async () => {
    const source = new DataSource({ basePath: '/nowhere', fetcher: async () => null });
    const { loadMeta } = await import('../../src/lib/data/loaders');
    await expect(loadMeta(source)).rejects.toBeInstanceOf(DataError);
  });
});
