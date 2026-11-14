/** Static pipeline contract. All probabilities are research estimates [U]. */
export interface RiskMeta {
  engine_ready: boolean;
  example: boolean;
  model_version: string;
  made_at: string;
  grid_g: number;
  days: { today: string; tomorrow: string };
  fire_weather_run: string;
  sources: { name: string; url: string; date: string }[];
}
export interface RiskRegion {
  region_id: string;
  name_en: string;
  name_local: string;
  country: string;
  bbox: [number, number, number, number];
  spots: number;
}
export interface RiskInputs {
  fwi: number | null; ffmc: number | null; dmc: number | null; dc: number | null;
  t_max_c: number | null; rh_min: number | null; wind_max_kmh: number | null;
  wind_dir_deg: number | null; rain_3d_mm: number | null; ndvi_diff: number | null;
  forest: number | null; farm: number | null; grass_shrub: number | null;
  hist_p: number | null; fire_near_3d: boolean | null;
}
export interface RiskSpot {
  type: "fire_risk";
  spot_id: number;
  lat: number; lon: number; precision_radius_km: number;
  region_id: string; day: string; rank: number;
  p: number | null;
  level: 1 | 2 | 3 | 4 | 5;
  fire_type: "forest" | "farmland" | "grass_shrub";
  inputs: RiskInputs;
  why: string[];
}
export interface RiskCountry {
  country: string;
  days: string[];
  regions: Record<string, Record<string, RiskSpot[]>>;
  all_vegetation?: Record<string, Record<string, RiskSpot[]>>;
}
export interface RiskIndex { meta: RiskMeta | null; regions: RiskRegion[] }
export type CountryResult = { status: "ready" | "missing"; file: RiskCountry };
