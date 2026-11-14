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
  /**
   * Harmonized fire days, at VIIRS level: the number of (0.01 degree cell,
   * day) pairs with fire, added up over this record's area. Not a count of
   * days, so it has no 31-day ceiling and is never capped. See section 3.1 of
   * docs/data-contract.md. The interface may label it "fire days".
   */
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

/**
 * What a set of figures is. The two kinds are never mixed in one series.
 *
 * `national_report` is what a national authority reported: counts of fires and
 * burned area by its own definition. `satellite_estimate` is an agency's
 * estimate made by mapping burned areas in satellite images, such as EFFIS and
 * GWIS; it misses small fires and is not a report.
 */
export type ReportedKind = 'national_report' | 'satellite_estimate';

/** Where a set of reported figures came from. */
export interface ReportedSource {
  name: string;
  url: string | null;
  /** ISO date the figures were fetched, or null. */
  fetched: string | null;
  /** The licence or terms as the source states them. */
  licence?: string | null;
  /** First and last year the source covers. */
  covers: [number, number];
  /** Plain-language caveat shown next to the figures. */
  note: string | null;
}

/** One labelled series of figures for a country. */
export interface ReportedSeries {
  kind: ReportedKind;
  source: ReportedSource;
  /** One entry per year from the first to the last the source covers. */
  years: ReportedYear[];
}

/** web/public/data/reported/<ISO3>.json */
export interface ReportedFile {
  schema: 'emerge-reported-1' | 'emerge-reported-2';
  example: boolean;
  built: string;
  iso3: string;
  /** National totals. Shown in full for a country, as context for a smaller area. */
  scope: 'national';
  /** The kind of the primary series, the one `source` and `years` hold. */
  kind?: ReportedKind;
  source: ReportedSource;
  units: { fires: 'count'; burned_ha: 'hectares' };
  years: ReportedYear[];
  /**
   * Every series for the country, the primary one first. The primary series is
   * the national report when the country has one, otherwise the satellite
   * estimate.
   */
  series?: ReportedSeries[];
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
  /**
   * Group this cell belongs to, for the background and factor lookup in
   * background.json. An opaque key: never take it apart. The empty string
   * means the conversion gave this cell no group, so it has no background
   * (count it as 0) and its daily values cannot be scaled.
   */
  g: string;
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

/** The two periods that have a background value. */
export type BackgroundPeriod = 'estimated_terra' | 'estimated_modis';

/**
 * One group's background and conversion factors for one period. Each array
 * holds 12 values, January first.
 *
 * The background arrays are whole hundredths: 37 means 0.37. Their lower end
 * is always 0, so it is not stored.
 *
 * The factor arrays are whole thousandths: 2700 means a factor of 2.7. They
 * turn a raw daily count from that period's sensor into a harmonized value
 * (ruling 11).
 */
export interface BackgroundSeries {
  hot: number[];
  hot_hi: number[];
  cd: number[];
  cd_hi: number[];
  k_hot: number[];
  k_cd: number[];
}

/** web/public/data/background.json */
export interface BackgroundFile {
  schema: 'emerge-background-1';
  example: boolean;
  built: string;
  /** Present only while the numbers are stand-ins. */
  note?: string;
  units: { background: 'hundredths'; factors: 'thousandths' };
  periods: BackgroundPeriod[];
  /** Keyed by the group id a tile cell carries in its `g` field. */
  groups: Record<string, Record<BackgroundPeriod, BackgroundSeries>>;
}

/** One country in the search index. */
export interface CountryIndexEntry {
  iso3: string;
  /** English name, for the search box. */
  name: string;
  /** The country file's summary point. */
  lat: number;
  lon: number;
  /**
   * [west, south, east, north] in degrees, around the country's fire cells.
   * `west` greater than `east` means the box crosses the 180 degree line.
   */
  bbox: [number, number, number, number];
}

/** web/public/data/countries/index.json */
export interface CountryIndexFile {
  schema: 'emerge-country-index-1';
  example: boolean;
  built: string;
  countries: CountryIndexEntry[];
}

/**
 * Columnar yearly totals. Every array has n entries and shares one index.
 * There is no lat, lon or precision_radius_km here: the globe layer works
 * them out from `id` with cellCenter and precisionRadiusKm.
 */
export interface GlobeColumns {
  id: number[];
  hot: number[];
  cd: number[];
  frp: number[];
}

/** web/public/data/globe/<year>.json.gz, after unzipping. */
export interface GlobeFile {
  schema: 'emerge-globe-1';
  example: boolean;
  built: string;
  year: number;
  type: 'cell';
  cell_deg: number;
  /** Always true: the point is derived from the cell id, not stored. */
  point_from_id: true;
  /** True when the record stops inside this year, so it is not a whole year. */
  part_year: boolean;
  /** Last month of this year the record covers, 1 to 12. */
  last_month: number;
  /** Number of cells, equal to the length of every array in cols. */
  n: number;
  cols: GlobeColumns;
}

/**
 * Which single sensor a raw daily value came from: Terra before July 2002,
 * Aqua from July 2002 to January 2012, S-NPP from February 2012.
 */
export type SensorLabel = 'terra' | 'aqua' | 'snpp';

/** One year of the daily window for one cell. Only days with fire are listed. */
export interface DailyYear {
  /** Year in which the window starts. */
  y: number;
  /** Index into the file's src_labels, for the whole year's window. */
  src: number;
  /** Bit set over the file's flag_labels, for the whole year's window. */
  flags: number;
  /**
   * Index into the file's sensor_labels. The daily values are RAW, so a year
   * seen by MODIS cannot be compared with a VIIRS year without scaling.
   */
  sensor: number;
  /** Day offsets from the window start, 0 to days - 1, ascending. */
  d: number[];
  /** Raw hotspots that sensor counted on that day. Not harmonized. */
  hot: number[];
  /** Fire radiative power in MW on that day, whole numbers. */
  frp: number[];
}

/** One cell in a daily-window file. */
export interface DailyCell extends PointHead {
  type: 'cell';
  id: number;
  /**
   * Group this cell belongs to, for the conversion factor in background.json.
   * An opaque key: never take it apart. The empty string means the conversion
   * gave this cell no group, so its values before February 2012 cannot be
   * scaled and the app shows them as estimated only.
   */
  g: string;
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
  /** Always "raw": the daily values are not harmonized. */
  values: 'raw';
  /** Label for each index used in DailyYear.sensor. */
  sensor_labels: SensorLabel[];
  /**
   * Set when the reference satellite stopped inside the current year's window.
   * From `first_day` the counts are the named sensor's own, multiplied by
   * `ratio` and rounded, so the window stays one series. The FRP is that
   * sensor's own and is not scaled.
   */
  calibrated_from: {
    sensor: string;
    first_day: string;
    ratio: number;
    note: string;
  } | null;
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
    cd: 'fire_cell_days';
    frp: 'MW';
    precision_radius_km: 'km';
  };
  src_labels: Record<SrcLabel, string>;
  flag_labels: Record<FlagLabel, string>;
  /** Which src label applies to which period, in order. */
  src_periods: { from: string; to: string | null; src: SrcLabel }[];
  /** What each satellite reached, and how the newest days were made. */
  coverage: {
    last_day_per_satellite: Record<string, string>;
    /** Last day the reference satellite produced, or null while it still flies. */
    snpp_last_day: string | null;
    snpp_note: string;
    calibration: Record<string, Record<string, number | string>>;
    /** Months that come from near-real-time data, as "YYYY-MM". */
    provisional_months: string[];
    /** Months carried by a second satellite brought to the reference level. */
    measured_calibrated_months: string[];
    /** Months whose reference gap days were filled from a second satellite. */
    snpp_gap_filled_months: string[];
    /** Share of each month that is provisional, 0 to 1, keyed "YYYY-MM". */
    provisional_share_by_month: Record<string, number>;
    /** Set when the last month holds only part of its days. */
    part_month: { month: string; days: number; days_in_month: number } | null;
  };
  /** Plain sentences about what this data set cannot do. */
  limits: Limit[];
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
    /** Always "raw": the daily files hold raw counts, not harmonized ones. */
    values: 'raw';
  };
  /** ISO3 codes with a countries/<ISO3>.json file. */
  countries: string[];
  /** ISO3 codes with a reported/<ISO3>.json file. */
  reported: string[];
  /** Tile keys with a tiles/<key>.json.gz file. */
  tiles: string[];
  /** Tile keys with a daily/<key>.json.gz file. */
  daily: string[];
  /** Years with a globe/<year>.json.gz file. */
  globe_years: number[];
  /** Globe years the record stops inside, so not whole years. */
  globe_part_years: number[];
  sources: SourceEntry[];
}

/** What one scored row of the validation stands for. */
export type ValidationScope =
  | 'country_month'
  | 'country_month_joint_range'
  | 'cell_month'
  | 'circle_month'
  | 'circle_month_weighted'
  | 'cell_month_0p1';

/**
 * One row of the world scope: the model the app uses, fitted on every country
 * and tested on years it had never seen. `group` is "all", "small", "medium",
 * "large" or "pooled_world"; the percentile fields are across countries and
 * the pooled fields are the world total added month by month, so a row has
 * one set or the other.
 */
export interface WorldScopeRow {
  test: string;
  unit: 'hot' | 'cd';
  group: string;
  /** Countries in this group. */
  n_countries: number | null;
  /** Countries left out because they had too little fire to judge. */
  too_little_fire: number | null;
  nrmse_p50: number | null;
  nrmse_p10: number | null;
  nrmse_p90: number | null;
  bias_p50: number | null;
  bias_p10: number | null;
  bias_p90: number | null;
  /** Share of countries whose stated range held 80 to 97 per cent of values. */
  coverage_in_range: number | null;
  mean_truth_min: number | null;
  mean_truth_max: number | null;
  pooled_nrmse: number | null;
  pooled_bias: number | null;
  pooled_r: number | null;
}

/** One country's own result from the world test, for one test. */
export interface CountryScore {
  n: number | null;
  nrmse: number | null;
  bias_pct: number | null;
  /** How often the stated range held, as a percentage. */
  coverage_pct: number | null;
  /** False where there was too little fire to judge. */
  scorable: boolean;
}

/** One hold-out run of the conversion. null until the run exists. */
export interface HoldoutResult {
  /** "forward" = learn early years, test later ones. "reverse" = the other way. */
  direction: 'forward' | 'reverse';
  /** The scorer's name for this split, such as "t1". Read defensively. */
  test?: string;
  /** The country this row is about, in the provider's own name form. */
  country?: string;
  /** True for the split that runs into the years the older sensor drifts. */
  drift_years?: boolean;
  unit: 'hot' | 'cd';
  /**
   * What each scored row is. The last two are reported for information:
   * circle_month_weighted weights each cell by the share of it inside the
   * circle, and cell_month_0p1 is the finer 0.1 degree grid.
   */
  scope: ValidationScope;
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
  scope: ValidationScope;
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
    /**
     * The fields below are written by the exporter and read defensively by the
     * app, so they are optional here: a screen must still work against a file
     * that predates them.
     */
    model_note?: string;
    /** Countries the method comparison was decided on. */
    tested_countries?: string[];
    tested_countries_note?: string;
    /** How many countries the model the app uses was fitted on. */
    world_fit_countries?: number;
    /** The months the model was fitted on, as "YYYY-MM to YYYY-MM". */
    fit_months?: string;
  };
  holdout: HoldoutResult[];
  /** The world test: see WorldScopeRow. Absent before that test exists. */
  world_scope?: WorldScopeRow[];
  world_scope_note?: string;
  /** One country's own result, by ISO3 code, then by test. */
  countries?: Record<string, Record<string, CountryScore>>;
  countries_note?: string;
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
