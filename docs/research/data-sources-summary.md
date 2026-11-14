# Data sources: short version

Summary of [`data-sources-fire.md`](data-sources-fire.md) and [`data-sources-satellites.md`](data-sources-satellites.md) (14 Nov 2026). Tags: `[V]` checked at the source · `[D]` directional · `[U]` our guess.

## The question

Besides NASA's MODIS and VIIRS fire points (FIRMS, our core), what other data could extend, fill in or check our fire record, or feed the risk outlook?

## All options, by verdict

**Use** = in the build · **Check** = only as an outside check or if time allows · **Skip** = not this weekend.

| Need | Option | Verdict | Why |
|---|---|---|---|
| **2026 fire points** | **firms-catalog** (free online copy of NASA's data) | **Use** | Already up to 14 Nov 2026, no key `[V]` |
| | FIRMS API with a free key | Backup | Works for the whole world in 5-day pieces `[V]` |
| **Before 2000** | ATSR World Fire Atlas (1995–2012) | Skip | Night-time only, different sensor: can't be joined fairly |
| | TRMM VIRS (from 1998) | Skip | Tropics only |
| | AVHRR fire data | Skip | Not researched in time |
| **Other satellites** | Sentinel-3 fire product (2020+) | Check | Independent sensor; a ready monthly grid exists `[D]` |
| | Meteosat (Europe, Africa) | Check | Best extra satellite for Bulgaria; needs an account |
| | GOES (Americas) | Check | Good for the USA, heavy to process |
| | Himawari (Asia) | Skip | Registration, and companies must notify Japan's agency `[V]` |
| **Outside checks** | **EFFIS Bulgaria statistics** (2006–2026) | **Use** | Free data feed `[V]` |
| | **NIFC US statistics** (1983–2025) | **Use** | Free table `[V]` |
| | **MODIS burned area (MCD64A1)** | **Use** | Different measurement, so a real outside check |
| | GFED5, FireCCI, GWIS burned area | Check | Stop in 2020 or measure burned area, not hot spots |
| **Risk outlook** | **Copernicus fire weather index**, history and forecast | **Use** | Free since July 2025 with credit `[V]` |
| | NASA fire weather index (GFWED) | Check | Coarser grid |
| | Drought, soil moisture, lightning | Skip | Some are non-commercial; not needed now |
| | Smoke (CAMS, NOAA) | Skip | Out of scope |
| | Disasters (EM-DAT and others) | Skip | EM-DAT is paid for commercial use |
| | El Niño indexes (NOAA) | Check | A strong El Niño now `[V]`, but little effect on Bulgaria |

## Recommendation

1. **Keep NASA FIRMS as the only fire data in the calendar.** It's what the challenge asks for.
2. **Get 2026 from firms-catalog**, with the FIRMS API as the backup. Label recent months "provisional".
3. **Start the calendar in Nov 2000.** Older satellites can't be joined on honestly.
4. **Prove it with outside data:** EFFIS for Bulgaria, NIFC for the USA, and MODIS burned area. Compare which years were worst, not raw numbers.
5. **Risk outlook:** show the official Copernicus forecast with credit; don't invent our own.

**Why:** fewer sources means a cleaner story and less risk. Outside checks make the record trustworthy for judges.

## Watch out

- **MODIS ends soon:** Terra about Feb 2027, Aqua about Sep 2027 `[V]`. VIIRS on NOAA-20 and NOAA-21 carries the record on.
- **firms-catalog:** the `type` column is empty for the last 3–4 months, so don't filter it out.
- **EFFIS counts only fires of about 30 ha or more** `[D]`, far fewer than satellite hot spots.
