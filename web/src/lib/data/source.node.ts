/**
 * The disk adapter for the data source: the same loaders, reading
 * web/public/data from the file system and unzipping with node:zlib.
 *
 * Only a test process imports this file, so node:fs never reaches a browser
 * bundle.
 */

import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

import { DataError, DataSource, type Fetcher, type Gunzip } from './source';

interface ErrnoLike {
  code?: string;
}

/** Reads files from a directory. A missing file answers null, like a 404. */
export function diskFetcher(): Fetcher {
  return async (path: string) => {
    try {
      const bytes = await readFile(path);
      return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    } catch (cause) {
      const code = (cause as ErrnoLike).code;
      if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR') return null;
      throw new DataError('fetch', path, `could not read ${path}: ${String(cause)}`);
    }
  };
}

export const nodeGunzip: Gunzip = async (bytes: Uint8Array) => {
  const out = gunzipSync(bytes);
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
};

/** A source reading the example data set from a directory on disk. */
export function diskSource(dataDir: string): DataSource {
  return new DataSource({ basePath: dataDir, fetcher: diskFetcher(), gunzip: nodeGunzip });
}
