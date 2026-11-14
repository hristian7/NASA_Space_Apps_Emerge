# The reported numbers: what they are and where they come from

Fetched Fri 14 Nov 2026 by `pipeline/fetch_reported.py`. Addresses and terms: [`../references.md`](../references.md). Format: [`../data-contract.md`](../data-contract.md) section 6.

## The two kinds, which are never mixed

- **National report.** What a country's own authority reported: counts of fires and burned area by that authority's own definition of a fire. Countries count differently, so they are not directly comparable.
- **Satellite estimate.** An agency's estimate made by mapping burned areas in satellite images. EFFIS maps mainly fires of about 30 hectares or more, so smaller fires are missing. It is not a report, and this is the mistake the old card made: it showed EFFIS estimates under the word "reported".

## What was fetched

| Source | Kind | Coverage |
|---|---|---|
| EFFIS estimates by country | satellite estimate | 65 countries, 2006 to 2026 `[V]` |
| GWIS estimates by country | satellite estimate | 256 countries, 2012 to 2026 `[V]` |
| NIFC "Total Wildland Fires and Acres" | national report | USA, 43 years, 1983 to 2025 `[V]` |
| EFFIS annual report 2024, Table 1 | national report | 29 countries, 2024 only `[V]` |
| EFFIS annual report 2024, Table 2 | national report | Bulgaria, 10 years, 2015 to 2024 `[V]` |

## Coverage

256 countries have a file `[V]`. 30 of them lead with a national report `[V]`; the other 226 have a satellite estimate only `[V]`. Every file keeps every series it has, so a country with a report also keeps its estimates beside it.

## The two rows that were wrong or thin

- Bulgaria 2024. The authority (Executive Forest Agency) reported **595 forest fires and 17,116.4 ha** `[V]`. EFFIS's own satellite estimate for the same year is **133 fires and 44,745 ha** `[V]`, and GWIS's is 155 fires and 49,341 ha `[V]`. The old file showed the EFFIS estimate labelled as the national report. The burned area is larger in the estimate because it maps all land cover, while the national figure counts forest territory.
- USA 2024. **64,897 fires** `[V]`, which confirms the figure in the specification, and **3,611,772.4 ha** `[V]` converted from 8,924,884 acres. All 43 years now carry burned area; the old file carried none.

## Limits

- Burned area is in hectares. Acres are converted at 1 acre = 0.40468564224 ha `[V]`, and the series note says so.
- 2024 is the only year of national report for 28 of the 30 countries, because the annual report prints one year per country `[V]`. Earlier annual reports were not fetched.
- The 2026 year in both estimate series is a season still running, not a full year `[D]`.
- NIFC states no reuse licence; its site links only a disclaimer of liability, so the file says "terms not stated" rather than guessing `[V]`.
- NIFC marks 2004 with an asterisk: its figures leave out state lands for North Carolina `[V]`. The note carries that sentence.
- Reading the annual report's tables needs the Poppler tool `pdftotext`. Without it the run skips that source and says so, rather than inventing a figure `[V]`.
