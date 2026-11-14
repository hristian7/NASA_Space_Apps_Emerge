/**
 * Shared setup for the data-layer tests: a source reading the real example
 * files from web/public/data on disk, with node:zlib for the gzipped ones.
 *
 * These tests import by relative path because the vitest config carries no
 * alias for the tsconfig paths and another stream owns that config.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { DataSource, setDataSource, type Fetcher } from '../../src/lib/data/source';
import { diskSource, nodeGunzip } from '../../src/lib/data/source.node';

const here = path.dirname(fileURLToPath(import.meta.url));

/** web/public/data */
export const DATA_DIR = path.resolve(here, '../../public/data');

/** The repository root, for the expected answers under tests/. */
export const REPO_ROOT = path.resolve(here, '../../..');

/** The independent expected answers for the number logic. */
export const LOGIC_DIR = path.join(REPO_ROOT, 'tests/expected/logic');

let shared: DataSource | null = null;

/** The source every test uses, installed as the shared one on first call. */
export function testSource(): DataSource {
  if (!shared) {
    shared = diskSource(DATA_DIR);
    setDataSource(shared);
  }
  return shared;
}

/**
 * A source that answers the given paths from the given objects and everything
 * else from disk. Used to pretend a file says something else, for example a
 * different last data day or an added no-data period.
 */
export function patchedSource(overrides: Record<string, unknown>): DataSource {
  const encoder = new TextEncoder();
  const fetcher: Fetcher = async (url: string) => {
    for (const [inside, value] of Object.entries(overrides)) {
      if (url === `${DATA_DIR}/${inside}`) return encoder.encode(JSON.stringify(value));
    }
    const { readFile } = await import('node:fs/promises');
    try {
      const bytes = await readFile(url);
      return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    } catch {
      return null;
    }
  };
  return new DataSource({
    basePath: DATA_DIR,
    fetcher,
    gunzip: async (bytes: Uint8Array) => {
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) return nodeGunzip(bytes);
      return bytes;
    },
  });
}

/** The example meta with one field replaced. */
export async function metaWith(changes: Record<string, unknown>): Promise<Record<string, unknown>> {
  const meta = (await testSource().json<Record<string, unknown>>('meta.json')) as Record<
    string,
    unknown
  >;
  return { ...meta, ...changes };
}
