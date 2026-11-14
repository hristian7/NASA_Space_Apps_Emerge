/**
 * The static data source behind every number in the app.
 *
 * One small object holds a base path, a fetcher and a gunzip function, so the
 * same loaders run in the browser (fetch from /data, DecompressionStream) and
 * in a test process (read from disk, node:zlib). Nothing here imports a
 * platform module, so this file is safe in a browser bundle; the disk
 * adapter lives in source.node.ts.
 *
 * Two rules the whole data layer rests on:
 *  - A file that does not exist is not an error. The fetcher answers null and
 *    the caller decides what absence means. For a tile it means "no fire cells
 *    in that square".
 *  - Any other failure throws a DataError, which carries enough to show.
 */

/** Bytes of one file, or null when the file does not exist. */
export type Fetcher = (url: string) => Promise<Uint8Array | null>;

/** Gunzip for the pre-gzipped files. */
export type Gunzip = (bytes: Uint8Array) => Promise<Uint8Array>;

export type DataErrorKind = 'fetch' | 'decompress' | 'parse';

/** A failure the caller can show. A missing file never produces one. */
export class DataError extends Error {
  readonly kind: DataErrorKind;
  readonly path: string;
  readonly status: number | null;

  constructor(kind: DataErrorKind, path: string, message: string, status: number | null = null) {
    super(message);
    this.name = 'DataError';
    this.kind = kind;
    this.path = path;
    this.status = status;
  }
}

export interface DataSourceOptions {
  /** Prefix put in front of every path. No trailing slash. */
  basePath?: string;
  fetcher?: Fetcher;
  gunzip?: Gunzip;
}

/** Default fetcher for a browser: HTTP, with 404 and 410 read as "no file". */
export function httpFetcher(): Fetcher {
  return async (url: string) => {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (cause) {
      throw new DataError('fetch', url, `could not reach ${url}: ${String(cause)}`);
    }
    if (res.status === 404 || res.status === 410) return null;
    if (!res.ok) {
      throw new DataError('fetch', url, `${url} answered ${res.status}`, res.status);
    }
    return new Uint8Array(await res.arrayBuffer());
  };
}

/** Default gunzip for a browser. */
export async function streamGunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  return out;
}

const UTF8 = new TextDecoder('utf-8');

/**
 * Caches one promise per path, so several callers asking for the same file at
 * the same time share one fetch. A failed promise is dropped, so a retry is
 * a real retry rather than the same error again.
 */
export class DataSource {
  readonly basePath: string;
  private readonly fetcher: Fetcher;
  private readonly gunzip: Gunzip;
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(options: DataSourceOptions = {}) {
    this.basePath = (options.basePath ?? '/data').replace(/\/+$/, '');
    this.fetcher = options.fetcher ?? httpFetcher();
    this.gunzip = options.gunzip ?? streamGunzip;
  }

  /** Full address of a path inside the data set, for example "tiles/40_20.json.gz". */
  url(path: string): string {
    return `${this.basePath}/${path.replace(/^\/+/, '')}`;
  }

  /** Reads one JSON file, unzipping it when the name ends in .gz. null = no file. */
  json<T>(path: string): Promise<T | null> {
    const known = this.cache.get(path);
    if (known) return known as Promise<T | null>;
    const started = this.read<T>(path);
    this.cache.set(path, started);
    void started.catch(() => {
      if (this.cache.get(path) === started) this.cache.delete(path);
    });
    return started;
  }

  private async read<T>(path: string): Promise<T | null> {
    const url = this.url(path);
    const raw = await this.fetcher(url);
    if (raw === null) return null;
    let bytes = raw;
    if (path.endsWith('.gz')) {
      try {
        bytes = await this.gunzip(raw);
      } catch (cause) {
        throw new DataError('decompress', path, `${url} is not valid gzip: ${String(cause)}`);
      }
    }
    try {
      return JSON.parse(UTF8.decode(bytes)) as T;
    } catch (cause) {
      throw new DataError('parse', path, `${url} is not valid JSON: ${String(cause)}`);
    }
  }

  /** Forgets every cached file. */
  clear(): void {
    this.cache.clear();
  }

  /** Paths held in the cache, for tests and for a diagnostics panel. */
  cached(): string[] {
    return [...this.cache.keys()];
  }
}

let current: DataSource | null = null;

/** The source every loader uses unless one is passed in. */
export function dataSource(): DataSource {
  if (!current) current = new DataSource();
  return current;
}

/** Replaces the shared source. A test process calls this once with its own. */
export function setDataSource(source: DataSource): void {
  current = source;
}
