# Number logic: the exact rules behind every figure in the app

Frozen on Sat 14 Nov 2026 before the logic code exists. Two separate agents work from this page: one writes the expected answers (`tests/expected/logic/`), the other writes the code (`web/src/lib/`). Neither sees the other's work. The shapes are in [`../web/src/types/ui.ts`](../web/src/types/ui.ts); the files are in [`data-contract.md`](data-contract.md). Choices marked `[U]` are our own.

## 1. From a selection to cells

Each 0.25 degree cell is split into 25 x 25 sub-cells of 0.01 degree. For cell `row`, `col` the sub-cell centres are `lat = 90 - row * 0.25 - (i + 0.5) * 0.01`, `lon = -180 + col * 0.25 + (j + 0.5) * 0.01`, with `i`, `j` from 0 to 24.

| Selection | Weight of a cell |
|---|---|
| Point + distance | Share of its 625 sub-cell centres within the distance (great-circle distance, haversine, Earth radius 6371.0088 km). A centre exactly at the distance counts as inside |
| Polygon | Share of its 625 sub-cell centres inside the ring (even-odd rule on plain longitude and latitude; a ring crossing the 180 degree line is not supported) |
| Country | No cells: the country file is used as it is |

- Cells with weight 0 are left out.
- **Small selections:** if all weights add up to less than 1, the selection is smaller than one cell. Then the single cell that contains the point (or the polygon's vertex average) is used with weight 1, and the result is marked `lowConfidence`.
- The measured comparison behind this rule: adding cells by overlap cut the error on 50 km circles in all four test cases (`research/bakeoff-results.md`, level c2) `[V]`.

## 2. From cells to a monthly series

- Value of a month = sum over cells of `weight x cell value`; `lo` and `hi` the same way. Not rounded here; screens round for display.
- The series lists **every** month from Nov 2000 to the last data month in `meta.json`.
- A month a cell does not list counts as 0 for that cell. A month inside a no-data period from `meta.json` is `null`. If no selected cell has any fire ever, every covered month is 0.
- `src` of a month: the label the contract's date rule gives. `flags`: the union of the contributing cells' flags, plus `low_confidence` when `lowConfidence` is true.

## 3. "Is this unusual?" (a finished month)

Input: a series, a year `y` and a month `m`.
- History = the same month `m` in every year before `y` with a value that is not null.
- Fewer than 3 history years `[U]`: status `no_history`.
- `median` and `mean` of the history. `ratioMedian = value / median`, null when the median is 0. `ratioMean` likewise.
- `higherThan` = history years with a value strictly below the current one; `years` = size of the history.
- Status `[U]`: `above` when value > 1.25 x median; `below` when value < 0.75 x median; otherwise `near`. When the median is 0: `above` if value > 0, otherwise `near`.

## 4. "Is this unusual so far?" (the unfinished month)

Uses the daily files. With `D` = the day of the month of the last data day: the current value is the sum of days 1 to `D` of the current month; the history is the same days 1 to `D` of that month in each past year. Then the rules of section 3. If `D` is under 8: status `too_early` (NASA warns that shorter periods are biased `[V]`).

## 5. Chance of fire this month

Input: a series, a month `m`, and the year `y` being asked about.
- `years` = years before `y` whose month `m` is not null. `fireYears` = those with a value of 0.5 or more `[U]`.
- `p = fireYears / years`; null when `years` is 0.
- Range: the 5% and 95% points of a Beta(`fireYears + 0.5`, `years - fireYears + 0.5`) distribution (a Jeffreys interval). When `fireYears` is 0 the lower end is 0; when `fireYears` equals `years` the upper end is 1.

## 6. This fire vs past fires

Input: the daily files for the selected cells (weights as in section 1) and a window length, 8 days by default.
- The window ends on the last data day and covers `days` calendar days.
- For each past year, take the same month-and-day window. 29 Feb in the current window maps to 28 Feb in a year without one. A window that crosses 1 Jan uses the two matching years.
- `hot` and `frp` are weighted sums over the cells. A year whose window has any no-data day gives null and is left out of the ranking.
- `rank` = 1 + the number of past years with a strictly higher `hot`. Ties share the better rank. `of` = ranked past years + 1.
- `estimated` is true for years before 2012.

## 7. Trend and extremes

- Yearly totals use only years where all 12 months are not null.
- `slopePerYear`: slope of an ordinary straight-line fit of yearly total on year. Fewer than 5 such years `[U]`: null.
- `perDecadeShare` = 10 x slope / mean yearly total; null when the mean is 0.
- `worstMonth`: the month with the highest value; a tie goes to the earliest. `worstYear`: the complete year with the highest total; a tie goes to the earliest.

## 8. Downloads

- **Monthly CSV** columns: `year,month,unit,value,low,high,source,flags`. Null is an empty field; zero is `0`. Values rounded to whole numbers.
- **Summary CSV** columns: `key,value`, one row per figure (worst month, worst year, trend per decade, this month's status and ratios, chance of fire and its range).
- Both start with comment lines beginning with `#`: the title, the selection in words, the date range, the data date, the sources, and the line "empty = no measurement, 0 = no fire seen".
- Line ends are `\n`; fields with a comma are quoted.
