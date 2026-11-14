/**
 * The frozen data contract between the pipeline and the app.
 *
 * Types only, no runtime code. The written contract is docs/data-contract.md;
 * these types mirror it field by field. A change to either needs the
 * director's approval.
 *
 * Two rules run through every type here:
 *  - 0 means the satellites looked and saw no fire. null means there was no
 *    measurement at all.
 *  - Every record that stands for a place carries type, lat, lon and
 *    precision_radius_km, so the app never has to guess how precise a value is.
 */

/** How the harmonized value for a month was produced. */
export type SrcLabel =
  | 'estimated_terra'
  | 'estimated_modis'
  | 'measured'
  | 'measured_calibrated'
  | 'provisional';

/** Notes attached to one record. Closed set. */
export type FlagLabel = 'example' | 'partial_month' | 'snpp_gap_filled' | 'low_confidence';

/** What a record stands for. */
export type PointType = 'cell' | 'country' | 'detection';

/** Every record that stands for a place carries these four fields (M29). */
export interface PointHead {
  type: PointType;
  /** Degrees, -90 to 90. Cell records use the cell centre. */
  lat: number;
  /** Degrees, -180 to 180. Cell records use the cell centre. */
  lon: number;
  /** km. How far a point inside the record's area can be from lat/lon. */
  precision_radius_km: number;
}

/** One month of values for one place. All counts are whole numbers. */
export interface MonthValues {
  /** Calendar year. */
  y: number;
  /** Calendar month, 1 to 12. */
  m: number;
  /** Harmonized hotspots, at VIIRS level. null = no measurement. */
  hot: number | null;
  /** Lower end of the hotspot range. */
  hot_lo: number | null;
  /** Upper end of the hotspot range. */
  hot_hi: number | null;
  /** Harmonized fire days (0.25 degree cell-days), at VIIRS level. */
  cd: number | null;
  /** Lower end of the fire-day range. */
  cd_lo: number | null;
  /** Upper end of the fire-day range. */
  cd_hi: number | null;
  /** Total fire radiative power in MW, whole numbers. Not harmonized. */
  frp: number | null;
  src: SrcLabel;
  flags: FlagLabel[];
}

/** Raw hotspot counts per satellite, as that satellite measured them. */
export interface RawPerSatellite {
  terra: number | null;
  aqua: number | null;
  snpp: number | null;
  noaa20: number | null;
  noaa21: number | null;
}

/** One month in a country file: harmonized values plus the raw series. */
export type CountryMonth = MonthValues & RawPerSatellite;

/** web/public/data/countries/<ISO3>.json */
export interface CountryFile extends PointHead {
  schema: 'emerge-country-1';
  /** true while the numbers are stand-ins rather than a real conversion. */
  example: boolean;
  built: string;
  iso3: string;
  /** Translation key for the country name. */
  name_key: string;
  type: 'country';
  /** First month in months, as "YYYY-MM". */
  first_month: string;
  /** Last month in months, as "YYYY-MM". */
  last_month: string;
  /** Every month from first_month to last_month, in order, with no gaps. */
  months: CountryMonth[];
}

/** One year of officially reported figures. null = not published or not fetched. */
export interface ReportedYear {
  y: number;
  /** Number of fires the authority reported. */
  fires: number | null;
  /** Burned area in hectares. */
  burned_ha: number | null;
}

/** Where a set of reported figures came from. */
export interface ReportedSource {
  name: string;
  url: string | null;
  /** ISO date the figures were fetched, or null. */
  fetched: string | null;
  /** First and last year the source covers. */
  covers: [number, number];
  /** Plain-language caveat shown next to the figures. */
  note: string | null;
}

/** web/public/data/reported/<ISO3>.json */
export interface ReportedFile {
  schema: 'emerge-reported-1';
  example: boolean;
  built: string;
  iso3: string;
  /** National totals. Shown in full for a country, as context for a smaller area. */
  scope: 'national';
  source: ReportedSource;
  units: { fires: 'count'; burned_ha: 'hectares' };
  years: ReportedYear[];
}

/**
 * One cell inside a tile. Parallel arrays, all the same length, indexed by
 * position in mi. Only months with fire are listed; a missing month inside the
 * coverage period means 0.
 */
export interface TileCell extends PointHead {
  type: 'cell';
  /** Cell id: row * 1440 + col. */
  id: number;
  /** Month indexes, ascending. January 2000 is 0. */
  mi: number[];
  hot: number[];
  hot_lo: number[];
  hot_hi: number[];
  cd: number[];
  cd_lo: number[];
  cd_hi: number[];
  frp: number[];
  /** Index into the file's src_labels. */
  src: number[];
  /** Bit set over the file's flag_labels. 0 = no flags. */
  flags: number[];
}

/** web/public/data/tiles/<lat0>_<lon0>.json.gz, after unzipping. */
export interface TileFile {
  schema: 'emerge-tile-1';
  example: boolean;
  built: string;
  tile: { lat0: number; lon0: number; deg: number };
  type: 'cell';
  cell_deg: number;
  /** Label for each index used in TileCell.src. */
  src_labels: SrcLabel[];
  /** Label for each bit used in TileCell.flags, lowest bit first. */
  flag_labels: FlagLabel[];
  /** Lowest and highest month index present in this file. */
  months: { first: number; last: number };
  cells: TileCell[];
}

/** Columnar yearly totals. Every array has n entries and shares one index. */
export interface GlobeColumns {
  id: number[];
  lat: number[];
  lon: number[];
  precision_radius_km: number[];
  hot: number[];
  hot_lo: number[];
  hot_hi: number[];
  cd: number[];
  cd_lo: number[];
  cd_hi: number[];
  frp: number[];
  src: number[];
  flags: number[];
}

/** web/public/data/globe/<year>.json */
export interface GlobeFile {
  schema: 'emerge-globe-1';
  example: boolean;
  built: string;
  year: number;
  type: 'cell';
  cell_deg: number;
  src_labels: SrcLabel[];
  flag_labels: FlagLabel[];
  /** Number of cells, equal to the length of every array in cols. */
  n: number;
  cols: GlobeColumns;
}

/** One year of the daily window for one cell. Only days with fire are listed. */
export interface DailyYear {
  /** Year in which the window starts. */
  y: number;
  /** Index into the file's src_labels, for the whole year's window. */
  src: number;
  /** Bit set over the file's flag_labels, for the whole year's window. */
  flags: number;
  /** Day offsets from the window start, 0 to days - 1, ascending. */
  d: number[];
  /** Harmonized hotspots on that day. */
  hot: number[];
  /** Fire radiative power in MW on that day, whole numbers. */
  frp: number[];
}

/** One cell in a daily-window file. */
export interface DailyCell extends PointHead {
  type: 'cell';
  id: number;
  /** Only years with at least one fire day are listed, ascending. */
  years: DailyYear[];
}

/** web/public/data/daily/<lat0>_<lon0>.json.gz, after unzipping. */
export interface DailyFile {
  schema: 'emerge-daily-1';
  example: boolean;
  built: string;
  tile: { lat0: number; lon0: number; deg: number };
  type: 'cell';
  cell_deg: number;
  window: {
    /** Length of the window in days. */
    days: number;
    /** Last day of data, as "YYYY-MM-DD". */
    latest_day: string;
    /** First day of the window as "MM-DD". */
    start_md: string;
    /** Last day of the window as "MM-DD". */
    end_md: string;
    /** true when the window runs past 31 December into the next year. */
    wraps_year: boolean;
  };
  /** Every year the window is held for, ascending. */
  years: number[];
  src_labels: SrcLabel[];
  flag_labels: FlagLabel[];
  cells: DailyCell[];
}

/** A period with no measurement at all, listed once so files can stay small. */
export interface NoDataPeriod {
  /** "global" = nothing was measured. "satellite" = one satellite is missing. */
  scope: 'global' | 'satellite';
  /** Satellite key when scope is "satellite". */
  sat: keyof RawPerSatellite | null;
  /** ISO date, or null for "since the beginning". */
  from: string | null;
  /** ISO date, or null for "until now". */
  to: string | null;
  /** Number of missing days, when the period is a scatter of days. */
  days: number | null;
  reason: string;
}

/** One data source, for the credits and the About page. */
export interface SourceEntry {
  id: string;
  name: string;
  /** What this source is used for, in plain words. */
  used_for: string;
  url: string | null;
  licence: string | null;
  /** ISO date the data was fetched, or null. */
  fetched: string | null;
}

/** web/public/data/meta.json */
export interface MetaFile {
  schema: 'emerge-meta-1';
  /** true while any file in the set holds stand-in numbers. */
  example: boolean;
  /** Version of the data set, not of the format. */
  data_version: string;
  /** ISO date the files were built. */
  built: string;
  /** Last day of satellite data in the set, as "YYYY-MM-DD". */
  last_data_day: string;
  /** First and last month in the monthly files, as "YYYY-MM". */
  first_month: string;
  last_month: string;
  grid: {
    cell_deg: number;
    rows: number;
    cols: number;
    tile_deg: number;
    /** Month index 0, as "YYYY-MM". */
    month_epoch: string;
  };
  units: {
    hot: 'hotspots';
    cd: 'cell_days';
    frp: 'MW';
    precision_radius_km: 'km';
  };
  src_labels: Record<SrcLabel, string>;
  flag_labels: Record<FlagLabel, string>;
  /** Which src label applies to which period, in order. */
  src_periods: { from: string; to: string | null; src: SrcLabel }[];
  no_data: NoDataPeriod[];
  daily_window: {
    days: number;
    latest_day: string;
    start_md: string;
    end_md: string;
    wraps_year: boolean;
    years: number[];
    /** Shortest run of days that may be summed and compared. */
    min_compare_days: number;
  };
  /** ISO3 codes with a countries/<ISO3>.json file. */
  countries: string[];
  /** ISO3 codes with a reported/<ISO3>.json file. */
  reported: string[];
  /** Tile keys with a tiles/<key>.json.gz file. */
  tiles: string[];
  /** Tile keys with a daily/<key>.json.gz file. */
  daily: string[];
  /** Years with a globe/<year>.json file. */
  globe_years: number[];
  sources: SourceEntry[];
}

/** One hold-out run of the conversion. null until the run exists. */
export interface HoldoutResult {
  /** "forward" = learn early years, test later ones. "reverse" = the other way. */
  direction: 'forward' | 'reverse';
  unit: 'hot' | 'cd';
  /** What each scored row is: a country-month, a cell-month or a 50 km circle. */
  scope: 'country_month' | 'cell_month' | 'circle_month';
  train_years: [number, number] | null;
  test_years: [number, number] | null;
  n: number | null;
  nrmse: number | null;
  mae: number | null;
  /** Bias of the totals, as a percentage. */
  bias_pct: number | null;
  r: number | null;
  slope: number | null;
}

/** One slice of the hold-out result, so weak groups cannot hide in an average. */
export interface SliceResult {
  slice: 'country' | 'month' | 'latitude_band' | 'year' | 'fire_size';
  key: string;
  unit: 'hot' | 'cd';
  n: number | null;
  nrmse: number | null;
  bias_pct: number | null;
}

/** Two satellites that see the same thing, compared. */
export interface AgreementResult {
  pair: string;
  unit: 'hot' | 'cd';
  years: [number, number] | null;
  n: number | null;
  /** Typical difference between the two, as a percentage. */
  diff_pct: number | null;
}

/** Our ratio next to a published one. */
export interface PublishedRatio {
  scope: string;
  unit: 'hot' | 'cd';
  ours: number | null;
  published: number | null;
  published_source: string | null;
  note: string | null;
}

/** Does the stated range really hold that share of the values? */
export interface RangeCoverage {
  /** The range we claim, for example 90. */
  level_pct: number;
  unit: 'hot' | 'cd';
  scope: 'country_month' | 'cell_month' | 'circle_month';
  n: number | null;
  /** The share the range actually held. */
  observed_pct: number | null;
}

/** One bin of the chance-of-fire reliability chart. */
export interface ReliabilityBin {
  /** Lower and upper edge of the predicted-chance bin. */
  bin: [number, number];
  predicted: number | null;
  observed: number | null;
  n: number | null;
}

/** A check that a total did not change along the way. */
export interface ControlTotal {
  check: string;
  passed: boolean | null;
  detail: string | null;
}

/** Something the data cannot do, said plainly. */
export interface Limit {
  id: string;
  text: string;
}

/** web/public/data/validation.json */
export interface ValidationFile {
  schema: 'emerge-validation-1';
  example: boolean;
  built: string;
  method: {
    grid_deg: number;
    time_step: 'month';
    /** Name of the winning conversion, or null before the bake-off. */
    model: string | null;
    reference: string;
    train_years: [number, number] | null;
    test_years: [number, number] | null;
    /** true when the pass rule was written down before any score existed. */
    pre_registered: boolean | null;
    /** How the split was checked for leakage, or null. */
    leakage_check: string | null;
  };
  holdout: HoldoutResult[];
  slices: SliceResult[];
  satellite_agreement: AgreementResult[];
  published_ratios: PublishedRatio[];
  range_coverage: RangeCoverage[];
  chance_of_fire: {
    /** Brier score; lower is better. */
    brier: number | null;
    reliability: ReliabilityBin[];
  };
  control_totals: ControlTotal[];
  limits: Limit[];
}
