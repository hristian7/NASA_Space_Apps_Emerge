/**
 * Shared setup for the data-layer tests: a source reading the real example
 * files from web/public/data on disk, with node:zlib for the gzipped ones.
 *
 * These tests import by relative path because the vitest config carries no
 * alias for the tsconfig paths and another stream owns that config.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { DataSource, setDataSource } from '../../src/lib/data/source';
import { diskSource } from '../../src/lib/data/source.node';

const here = path.dirname(fileURLToPath(import.meta.url));

/** web/public/data */
export const DATA_DIR = path.resolve(here, '../../public/data');

/** The repository root, for the expected answers under tests/. */
export const REPO_ROOT = path.resolve(here, '../../..');

let shared: DataSource | null = null;

/** The source every test uses, installed as the shared one on first call. */
export function testSource(): DataSource {
  if (!shared) {
    shared = diskSource(DATA_DIR);
    setDataSource(shared);
  }
  return shared;
}
