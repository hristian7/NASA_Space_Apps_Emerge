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
| EFFIS annual report 2024, annex Tables 101 to 104, with Table 1 for 2024 and Table 2 for Bulgaria | national report | 31 countries, 1980 to 2024 `[V]` |

## Coverage

256 countries have a file `[V]`. 32 of them lead with a national report `[V]`, every one of them over several years, and the other 224 have a satellite estimate only `[V]`. Every file keeps every series it has, so a country with a report also keeps its estimates beside it.

## The two rows that were wrong or thin

- Bulgaria 2024. The authority (Executive Forest Agency) reported **595 forest fires and 17,116.4 ha** `[V]`. EFFIS's own satellite estimate for the same year is **133 fires and 44,745 ha** `[V]`, and GWIS's is 155 fires and 49,341 ha `[V]`. The old file showed the EFFIS estimate labelled as the national report. The burned area is larger in the estimate because it maps all land cover, while the national figure counts forest territory.
- USA 2024. **64,897 fires** `[V]`, which confirms the figure in the specification, and **3,611,772.4 ha** `[V]` converted from 8,924,884 acres. All 43 years now carry burned area; the old file carried none.

## Limits

- Burned area is in hectares. Acres are converted at 1 acre = 0.40468564224 ha `[V]`, and the series note says so.
- The national series come from the annual report's annex, whose titles read "Number of forest fires" and "Burnt area (hectares)" and whose source line reads "JRC's elaboration of the country reports" `[V]`. Their fire counts agree with the report's own Table 1 for all 29 countries it covers in 2024 `[V]`; their burned areas agree for 18 and differ for 6 only because the annex rounds to whole hectares (140 against 140.4, 49 against 49.47) `[V]`.
- Two annex rows were left out rather than guessed, because the report's typesetting merged two columns in them: the 2024 burned-area row of the five southern countries (it prints Italy as "5 2623") and the 2023 fire-count row `[V]`. Table 1 and Table 2 supply those 2024 and 2023 values, so nothing is missing for those years.
- EFFIS also publishes a spreadsheet of 1980 to 2024 totals at data.effis.emergency.copernicus.eu, which is not used: that host's certificate expired on 11 November 2026 `[V]`, so the file cannot be authenticated, and nothing can be established from a file that cannot be fetched safely.
- Bulgaria's own 2025 report revises 2024 to 565 fires on the same area, 171,164 decares, which is 17,116.4 hectares `[V]`. The series keeps the 595 the 2024 report printed and says so in its note.
- The 2026 year in both estimate series is a season still running, not a full year `[D]`.
- NIFC states no reuse licence; its site links only a disclaimer of liability, so the file says "terms not stated" rather than guessing `[V]`.
- NIFC marks 2004 with an asterisk: its figures leave out state lands for North Carolina `[V]`. The note carries that sentence.
- Reading the annual report's tables needs the Poppler tool `pdftotext`. Without it the run skips that source and says so, rather than inventing a figure `[V]`.
