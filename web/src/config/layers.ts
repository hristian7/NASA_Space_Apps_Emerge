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
  | 'raster_tiles'
  | 'wind';

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
      /** Fixed observation date, when the tiles are not a forecast. */
      date?: string;
      /**
       * Deepest zoom the service has tiles for. Beyond it the service answers
       * with an error, so the map must enlarge this level instead of asking.
       */
      maxzoom?: number;
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

/** How a layer's legend is drawn. */
export type LayerLegend =
  /** A sequential ramp from the look tokens, with the class breaks beside it. */
  | { kind: 'ramp' }
  /** Fixed classes the provider itself draws, each with its own colour. */
  | { kind: 'classes' }
  /** Points sized by a measurement, explained in words. */
  | { kind: 'points' };

/**
 * What the layer panel needs in order to list a layer. A layer without this
 * block exists in the registry but is not offered on screen, which is how a
 * layer can be declared before its panel wording is written.
 */
export interface LayerPanelInfo {
  /** Where it sits in the panel, lowest first. */
  order: number;
  /** Key under the `layers` namespace for the one-line explanation. */
  explainKey: string;
  /** Key under the `layers` namespace for the line about the data's time. */
  timeKey: string;
  /** Which control sits under the switch. */
  control: 'history_year' | 'recent_window' | 'danger_day' | 'none';
  legend: LayerLegend;
  defaultOn: boolean;
  /** Short key this layer uses in the address bar. */
  urlKey: string;
  /** true when the project disclaimer must be visible while the layer is on. */
  showsDisclaimer?: boolean;
}

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
  /** Present when the layer is offered in the layer panel. */
  panel?: LayerPanelInfo;
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
    panel: {
      order: 1,
      explainKey: 'layers.harmonizedHistoryExplain',
      timeKey: 'layers.harmonizedHistoryTime',
      control: 'history_year',
      legend: { kind: 'ramp' },
      defaultOn: true,
      urlKey: 'h',
    },
  },
  {
    id: 'recent-fires',
    nameKey: 'layers.recentFires',
    kind: 'detections',
    units: ['hot'],
    timeStep: 'day',
    source: { kind: 'api_route', path: '/api/recent' },
    credit: 'NASA FIRMS near-real-time active fire data (MODIS and VIIRS)',
    loader: { status: 'built', module: 'lib/layers/recent', fn: 'compactRecent' },
    verified: true,
    panel: {
      order: 2,
      explainKey: 'layers.recentFiresExplain',
      timeKey: 'layers.recentFiresTime',
      control: 'recent_window',
      legend: { kind: 'points' },
      defaultOn: false,
      urlKey: 'r',
    },
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
    credit:
      'Copernicus GWIS (EFFIS), licence under review',
    loader: { status: 'none' },
    verified: true,
    panel: {
      order: 3,
      explainKey: 'layers.fireDangerExplain',
      timeKey: 'layers.fireDangerTime',
      control: 'danger_day',
      legend: { kind: 'classes' },
      defaultOn: false,
      urlKey: 'd',
      showsDisclaimer: true,
    },
  },
  {
    id: 'nasa-fwi', nameKey: 'layers.nasaFwi', kind: 'raster_tiles', units: [], timeStep: 'day',
    source: { kind: 'tile_template', urlTemplate: 'https://maps.effis.emergency.copernicus.eu/gwis?service=WMS&version=1.1.1&request=GetMap&layers=nasa_geos5.fwi&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=256&height=256&time={date}&bbox={bbox-epsg-3857}', tileSize: 256, firstDate: null },
    credit: 'Copernicus GWIS, NASA GEOS-5', loader: { status: 'none' }, verified: true,
    panel: { order: 4, explainKey: 'layers.nasaFwiExplain', timeKey: 'layers.nasaFwiTime', control: 'danger_day', legend: { kind: 'classes' }, defaultOn: false, urlKey: 'f' },
  },
  {
    id: 'soil-moisture', nameKey: 'layers.soilMoisture', kind: 'raster_tiles', units: [], timeStep: 'day',
    source: { kind: 'tile_template', urlTemplate: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SMAP_L3_Passive_Enhanced_Day_Soil_Moisture/default/{date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png', tileSize: 256, firstDate: null, date: '2026-11-11', maxzoom: 6 },
    credit: 'NASA SMAP / NASA GIBS', loader: { status: 'none' }, verified: true,
    panel: { order: 5, explainKey: 'layers.soilMoistureExplain', timeKey: 'layers.soilMoistureTime', control: 'none', legend: { kind: 'classes' }, defaultOn: false, urlKey: 's' },
  },
  {
    id: 'greenness', nameKey: 'layers.greenness', kind: 'raster_tiles', units: [], timeStep: 'day',
    source: { kind: 'tile_template', urlTemplate: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_NDVI_8Day/default/{date}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png', tileSize: 256, firstDate: null, date: '2026-11-13', maxzoom: 8 },
    credit: 'NOAA-20 VIIRS / NASA GIBS', loader: { status: 'none' }, verified: true,
    panel: { order: 6, explainKey: 'layers.greennessExplain', timeKey: 'layers.greennessTime', control: 'none', legend: { kind: 'classes' }, defaultOn: false, urlKey: 'g' },
  },
  {
    id: 'land-type', nameKey: 'layers.landType', kind: 'raster_tiles', units: [], timeStep: 'day',
    source: { kind: 'tile_template', urlTemplate: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual/default/{date}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png', tileSize: 256, firstDate: null, date: '2024-01-01', maxzoom: 8 },
    credit: 'NASA MODIS / NASA GIBS', loader: { status: 'none' }, verified: true,
    panel: { order: 7, explainKey: 'layers.landTypeExplain', timeKey: 'layers.landTypeTime', control: 'none', legend: { kind: 'classes' }, defaultOn: false, urlKey: 'l' },
  },
  {
    id: 'air-temperature', nameKey: 'layers.airTemperature', kind: 'raster_tiles', units: [], timeStep: 'day',
    source: { kind: 'tile_template', urlTemplate: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/AIRS_L2_Surface_Air_Temperature_Day/default/{date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png', tileSize: 256, firstDate: null, date: '2026-11-14', maxzoom: 6 },
    credit: 'NASA AIRS / NASA GIBS', loader: { status: 'none' }, verified: true,
    panel: { order: 8, explainKey: 'layers.airTemperatureExplain', timeKey: 'layers.airTemperatureTime', control: 'none', legend: { kind: 'classes' }, defaultOn: false, urlKey: 't' },
  },
  {
    id: 'wind', nameKey: 'layers.wind', kind: 'wind', units: [], timeStep: 'day',
    source: { kind: 'api_route', path: 'https://api.open-meteo.com/v1/forecast' },
    credit: 'Weather data by Open-Meteo.com', loader: { status: 'built', module: 'lib/layers/wind', fn: 'fetchWind' }, verified: true,
    panel: { order: 9, explainKey: 'layers.windExplain', timeKey: 'layers.windTime', control: 'none', legend: { kind: 'classes' }, defaultOn: false, urlKey: 'w' },
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
