/**
 * NASA FIRMS near-real-time active fire files, the public ones that need no
 * key and no account.
 *
 * Checked on 14 Nov 2026 with a request carrying an `Origin` header: all six
 * files answer 200 and none sends an allow-origin header, so a browser cannot
 * read them. They are fetched by the route in `app/api/recent` instead.
 *
 * The S-NPP file is left out on purpose: its 24 hour copy was 112 bytes, a
 * header row with no detections, and two days stale.
 */

export type RecentWindow = '24h' | '7d';

export const recentWindows: readonly RecentWindow[] = ['24h', '7d'];

export const defaultRecentWindow: RecentWindow = '24h';

export function isRecentWindow(value: string | null | undefined): value is RecentWindow {
  return value === '24h' || value === '7d';
}

export interface FirmsFile {
  /** Index into the satellite labels a reply carries. */
  sat: number;
  sensor: 'modis' | 'viirs';
  label: string;
  url: string;
}

const base = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire';

export const satelliteLabels: readonly string[] = [
  'MODIS, Terra and Aqua',
  'VIIRS, NOAA-20',
  'VIIRS, NOAA-21',
];

/** The three files that make up one window. */
export function firmsFiles(window: RecentWindow): FirmsFile[] {
  const span = window === '24h' ? '24h' : '7d';
  return [
    {
      sat: 0,
      sensor: 'modis',
      label: satelliteLabels[0],
      url: `${base}/modis-c6.1/csv/MODIS_C6_1_Global_${span}.csv`,
    },
    {
      sat: 1,
      sensor: 'viirs',
      label: satelliteLabels[1],
      url: `${base}/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_${span}.csv`,
    },
    {
      sat: 2,
      sensor: 'viirs',
      label: satelliteLabels[2],
      url: `${base}/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_${span}.csv`,
    },
  ];
}
