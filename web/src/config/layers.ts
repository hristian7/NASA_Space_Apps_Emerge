/**
 * Data layer registry. One entry per layer the app can show.
 *
 * A new layer is one new entry here and nothing else: the type carries where
 * the data comes from, what unit it is in, how it steps through time, who
 * must be credited, and which loader reads it. A loader that does not exist
 * yet is declared with `status: "not_built"`, so a layer can be listed and
 * planned before its reader is written, and nothing silently pretends to
 * have numbers.
 */

import type { Unit } from '../types/ui';

/** What the layer draws. */
export type LayerKind =
  | 'harmonized_cells'
  | 'detections'
  | 'raster_tiles';

/** How the layer steps through time. */
export type LayerTimeStep = 'month' | 'year' | 'day' | 'none';

/** Where the bytes come from. */
export type LayerSource =
  | {
      kind: 'static_files';
      /** Paths under web/public/data, with <> standing for a parameter. */
      paths: string[];
    }
  | {
      kind: 'api_route';
      /** Route inside this app. */
      path: string;
    }
  | {
      kind: 'tile_template';
      /**
       * Address template. `{date}` is replaced with an ISO date and the
       * remaining placeholders are the map library's own.
       */
      urlTemplate: string;
      tileSize: number;
      /** Earliest date the service answers for, or null when it has no history. */
      firstDate: string | null;
    };

/** Which reader turns the source into numbers the screens can use. */
export type LayerLoader =
  | {
      status: 'built';
      /** Module the function is exported from. */
      module: string;
      /** Exported function name. */
      fn: string;
    }
  | {
      status: 'not_built';
      /** What has to exist before this layer can be switched on. */
      note: string;
    }
  | {
      /** The map library fetches the tiles itself; there is no loader. */
      status: 'none';
    };

export interface LayerDefinition {
  id: string;
  /** Key in the message files, under the `layers` namespace. */
  nameKey: string;
  kind: LayerKind;
  /** Units the layer can be shown in. Empty when it carries no measurement. */
  units: Unit[];
  timeStep: LayerTimeStep;
  source: LayerSource;
  /** Credit line the layer must show, exactly as the provider asks. */
  credit: string;
  loader: LayerLoader;
  /**
   * true when the address or the file was requested and answered as expected.
   * false means it still has to be checked.
   */
  verified: boolean;
}

export const LAYERS: readonly LayerDefinition[] = [
  {
    id: 'harmonized-history',
    nameKey: 'layers.harmonizedHistory',
    kind: 'harmonized_cells',
    units: ['hot', 'cd'],
    timeStep: 'month',
    source: {
      kind: 'static_files',
      paths: [
        'meta.json',
        'countries/<ISO3>.json',
        'tiles/<lat0>_<lon0>.json.gz',
        'globe/<year>.json',
        'daily/<lat0>_<lon0>.json.gz',
      ],
    },
    credit: 'NASA FIRMS (MODIS and VIIRS active fire data), harmonized by this project',
    loader: { status: 'built', module: 'lib/data/api', fn: 'getSeries' },
    verified: true,
  },
  {
    id: 'recent-fires',
    nameKey: 'layers.recentFires',
    kind: 'detections',
    units: ['hot'],
    timeStep: 'day',
    source: { kind: 'api_route', path: '/api/hotspots' },
    credit: 'NASA FIRMS, via the public active fire archive (CC0-1.0)',
    loader: {
      status: 'not_built',
      note: 'needs the hotspots route that reads only the blocks overlapping the selection',
    },
    verified: false,
  },
  {
    id: 'fire-danger',
    nameKey: 'layers.fireDanger',
    kind: 'raster_tiles',
    units: [],
    timeStep: 'day',
    source: {
      kind: 'tile_template',
      urlTemplate:
        'https://maps.effis.emergency.copernicus.eu/gwis?service=WMS&version=1.1.1&request=GetMap&layers=ecmwf.fwi&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=256&height=256&time={date}&bbox={bbox-epsg-3857}',
      tileSize: 256,
      firstDate: '2018-01-01',
    },
    credit: 'Copernicus Emergency Management Service, Global Wildfire Information System',
    loader: { status: 'none' },
    verified: true,
  },
];

/** One layer by id, or undefined when nothing carries that id. */
export function layer(id: string): LayerDefinition | undefined {
  return LAYERS.find((entry) => entry.id === id);
}

/** Fills a tile template's date, leaving the map library's placeholders alone. */
export function layerUrl(source: LayerSource, date: string): string | null {
  if (source.kind !== 'tile_template') return null;
  return source.urlTemplate.replace('{date}', date);
}
