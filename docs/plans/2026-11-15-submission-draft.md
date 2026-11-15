# Emerge: submission draft for team editing

**Editorial status:** The historical calendar and an unofficial next-day risk outlook are available, with published test results and limitations. `[V]`

**Before pasting into NASA's form, remove the `[V]`, `[D]` and `[U]` evidence tags.**

Tags: `[V]` verified in a primary project artifact or observed public page; `[D]` directional evidence; `[U]` proposed use, inference or untested plan. A project result tagged `[V]` is not independent scientific certification. Numbers in identifiers and source URLs are identifiers, not measurements.

## Submission field and requirement map

The [rules summary](../rules-and-judging.md) names required content but does not reproduce the portal's complete field list or character limits. The field titles below are editorial containers. Check the actual form on Sunday and distribute this text across its labels without dropping a requirement.

| Documented requirement | Draft section or action |
|---|---|
| Answer the official challenge | Challenge; Project summary; Detailed project description |
| All form fields in English | All field text below; compare with the portal before submission |
| Public final-project link | Project links |
| Public demo without login, English or English subtitles | Demo link and description |
| Video up to 30 seconds `[V]`, or up to 7 slides `[V]` including title | Demo link and description; submission checks |
| Every external resource, including reused earlier code | References; final resource reconciliation |
| SI usage note | Super Intelligence usage |
| Registered event members, not waitlisted, on the team page; membership fixed after submission | Submission checks, confirmed by the team outside this document |
| Terms and Conditions; Confirm All Work is Original | Submission checks; the team makes these declarations |
| Open-source release and rights to submitted material | References; submission checks |
| No images, video, voices or likeness of anyone under 18 `[V]` | Submission checks |

| Judging criterion | Where the draft answers it |
|---|---|
| Impact | Intended users and impact: a concrete planning use, with benefits described as unmeasured |
| Creativity | What is distinctive: a comparable record with uncertainty and visible weak spots |
| Validity | How it works; What was tested; Limitations; risk results |
| Relevance | Challenge; Project summary: satellite harmonization and the burning activity calendar are the core |
| Presentation | Short summary; demo description: problem, selection, calendar, evidence, limitations |

## Project title

Emerge

## Challenge

Harmonization of MODIS and VIIRS Hot Spots

## Short description

Emerge brings NASA's satellite fire records onto a common scale and turns them into a burning activity calendar. Choose a place, examine historical patterns and unusual conditions, and see which values are measured, estimated or missing. A public proof page reports the tests and limitations. `[V]`

## Project summary

A change in satellite instruments can look like a change in fire activity. MODIS and VIIRS observe the ground differently, so their raw hotspot counts cannot simply be joined into a comparable history. `[V]`

Emerge addresses the challenge's call for a harmonized burning activity calendar. It combines the extensive historical series of MODIS with the continuity and greater detail of VIIRS. The current record runs from November 2000 to 14 November 2026 `[V]`. Users can select a country, a point with a search distance, or a drawn area, then explore the monthly record. Estimated values carry uncertainty ranges, and missing observations are distinguished from measured zero activity. `[V]`

The conversion was tested on years excluded from fitting, across every country in the exported model. Results are stronger for world totals than for small areas, and the proof page reports those differences. Emerge is a research prototype for exploring fire history and an unofficial next-day risk outlook, with results and limitations shown on the proof page. `[V]`

## Detailed project description

### The problem and the challenge response

A hotspot is a satellite detection of heat, not a count of separate wildfire incidents. The instruments differ in resolution, sensitivity and observation schedules. Without harmonization, a user cannot tell how much of a change in counts comes from burning activity and how much comes from the sensor. `[V]`

Emerge puts the monthly records on a common reference scale and presents them as a calendar. This supports the challenge's focus on historical fire patterns, unusual conditions and critical periods within a selected area of interest. NASA active-fire data is the input to the conversion and the evidence used to test it. `[V]`

### How it works

The deployed conversion learns relationships between the older and reference sensors by country, latitude band and calendar month. Where observations are sparse, it draws on broader country and world patterns. It includes a background estimate for months when the older sensor detected nothing but the newer sensor could have detected burning. This describes the deployed method, rather than every method proposed during research. `[V]`

The app provides hotspot counts and fire cell-days. A fire cell-day counts a small ground cell once per satellite stream on a day with a detection, reducing repeated counting within that stream, cell and day. The harmonized calendar is monthly. Recent daily detections and heat output are separate measurements; they are not a harmonized daily forecast. `[V]`

The calendar lets users examine seasonal patterns and compare current activity with historical activity. Its selection and download tools help users take the record into their own analysis. Nationally reported incidents and satellite estimates are presented under separate labels because they measure different things. `[V]`

### Intended users and impact

Emerge is intended for emergency responders, land managers, scientists and people responsible for local fire planning. A user could select a district before the fire season, identify historically active months, and inspect whether current burning is unusual. The intended benefit is easier access to a comparable history and its limitations. We have not measured operational time savings, adoption or reduced fire losses. `[U]`

A firefighter interview informed the proposed next-day extension. That is design input from a practitioner, not evidence that Emerge improves operational decisions. `[V]`

### What is distinctive

Emerge brings the converted history, area selection and public evidence together. Users can ask about a place, see how its past compares, and inspect where the method is weak. The contribution is this combination of a harmonized calendar and inspectable uncertainty. We do not claim that Emerge is the first or only system to offer fire information. `[U]`

### What was tested

The deployed model was fitted across 235 countries `[V]` and tested on held-out years for every country. Separately, the choice between conversion methods was evaluated on Bulgaria and the United States using hand-checked truth. These are different experiments; the detailed method comparison is not a worldwide comparison of competing methods. `[V]`

The following results concern **monthly fire cell-days**, not next-day risk or separate wildfire incidents. Normalized root mean squared error, or nRMSE, describes the size of monthly errors relative to the mean observed value. It is not the percentage of predictions that are correct.

| Test and scope | Result from the committed validation file |
|---|---|
| Forward hold-out: fit 2012 to 2018, test 2019 to 2022 `[V]` | Pooled world nRMSE: 0.100241 `[V]` |
| Reverse hold-out: fit 2016 to 2022, test 2012 to 2015 `[V]` | Pooled world nRMSE: 0.059073 `[V]` |
| Forward hold-out, country results | 203 countries scored; 32 had too little fire to judge `[V]` |
| Forward hold-out, median country error | nRMSE 0.400645 overall; 0.220016 in the group with most burning; 1.070233 in the group with least burning `[V]` |
| Reverse hold-out, country results | 200 countries scored; 35 had too little fire to judge `[V]` |
| Recorded acceptance failure | Bulgaria's forward country-level gate records nRMSE 0.3233 against a maximum of 0.30 `[V]`. This is the gate entry, not the pooled world result. |

The validation file records that hand-computed truth samples match raw files and that exported tile totals match conversion totals. It also records that the scorer did not recompute the daily-to-monthly control total. We therefore do not describe all checks as passed. `[V]`

### Limitations and work not yet validated

- **Local precision:** the harmonized grid is 0.25 degrees `[V]`. Selecting a smaller area does not create a finer measurement. Individual cell-months and places with little burning can have large errors.
- **Estimated history:** values before February 2012 `[V]` are converted estimates, not observations by the reference sensor. Error ranges express uncertainty; summed ranges for larger totals can be overly wide.
- **Recent coverage:** recent data is provisional. The final month contains only 14 days `[V]`, so it must not be compared as if it were complete. Some newest detections have no country assignment and are absent from country totals.
- **Different quantities:** hotspots, fire cell-days, reported incidents and burned area are not interchangeable. Displaying national reports beside satellite estimates is not proof that they agree.
- **Unscored probability:** the historical chance-of-fire measure has no completed probability score. It must not be presented as a validated forecast.
- **Risk limits:** the week outlook has not been scored, the daily log is only starting, and plant greenness is displayed but was not used by the model. Some city squares are overstated: Sofia is about 4 times its own history `[V]`.

Historical limitations are documented in the [data contract](../data-contract.md) and [validation file](../../web/public/data/validation.json); risk test limitations are in the [protocol](../../pipeline/risk/PROTOCOL.md). `[V]`

### Next-day extension: Risk outlook (unofficial)

The unofficial next-day outlook ranks forest and wildland locations using fire weather, earlier fire history and majority land class. Plant greenness was not an input. The app publishes static predictions for 14 and 15 November 2026 `[V]`; a daily log is only starting. The separate week outlook uses fire weather and has not been scored. `[V]`

The test ranks the top 5 spots per region and day `[V]`. Pooled capture is the share of eligible new satellite-detected fires in those spots, not a measure of crew safety. The shipped grid is 0.25 degrees `[V]`; a 0.1 degree run was not made `[V]`. The 2025 test spans 1 January to 31 December with weather available on 361 days `[V]`. The Europe test covers 10,374 fire-positive region-days and the world test 106,994 `[V]`. Missing scores and weather limit coverage; eligible fires on forecast days remain in the denominator even when a spot has no score. `[V]`

LightGBM version 2 was chosen by world forest and wildland capture on 2024 validation data `[V]`. Version 1, a logistic model, had also been scored on 2025 before version 2 was selected `[V]`, so the hold-out was not used only once as the protocol intended. The published metadata marks the engine ready `[V]`; this is a research prototype, not an operational certification. `[U]`

| 2025 forest and wildland, top 5 pooled capture | Model | Earlier-years history | NASA fire-weather index | Random |
|---|---|---|---|---|
| Europe | 53.8% `[V]` | 51.0% `[V]` | 41.1% `[V]` | 39.4% `[V]` |
| World | 20.4% `[V]` | 16.7% `[V]` | 11.2% `[V]` | 10.5% `[V]` |

In Europe the model exceeded the NASA index by 12.679 percentage points, with a 95% interval of 11.191 to 14.192 points `[V]`; it exceeded history by 2.840 points, with an interval of 2.243 to 3.475 points `[V]`. The intervals use 2,000 non-overlapping weekly block bootstrap draws `[V]`, a resampling method for estimating uncertainty. The scorecard's claim rule is met for both comparisons in Europe and worldwide `[V]`. These results describe this ranking test, not every place or future season. `[U]`

The model captured at least one new fire on 60.9% of fire-positive region-days in Europe and 42.5% worldwide `[V]`. On scored spots in fire-positive region-days, Brier skill against history was 0.593 in Europe and 0.940 worldwide `[V]`; positive values mean a lower average squared probability error than history in that test. Reliability is imperfect: in Europe's lowest probability bin, the average prediction was 0.51% and the observed rate was 4.13% `[V]`. The supplementary all-scored-day probability results include days without fires and answer a different question. `[V]`

Performance varies by land type and place. In Europe, forest-only capture was 42.0% for the model versus 41.2% for history `[V]`. The model overstates some city squares: Sofia is about 4 times its own history `[V]`. Majority land classes are not fuel shares, and the aggregated detection grid has a latitude-boundary ambiguity `[V]`. The independent oracle and scorer still disagree on probability-day scope and seeded tie handling `[V]`; further review is needed. `[U]`

Any released list must be titled **“Risk outlook (unofficial)”**. Retain the specified safety text: **“Research prototype. Not an official warning. Follow local authorities (112).”** `[V]` If crew advice is added, use “consider” and end with “Decisions rest with the fire service.” Do not use official warning classes or imply dispatch authority.

## Project links

- Final project: [Emerge](https://emerge-beta-ten.vercel.app/).
- Method, results and limitations: [How we know it is right](https://emerge-beta-ten.vercel.app/proof).
- Project scope and credits: [About Emerge](https://emerge-beta-ten.vercel.app/about).
- **FILL-PUBLIC-SOURCE-LINK:** insert the team's final public source link after checking access without login. Do not substitute an unpublished working copy.

## Demo link and description

**FILL-DEMO-LINK:** insert the final public video URL, tested without login.

Suggested description: “See why satellite fire counts need harmonization, select an area in Emerge, read its burning activity calendar, and inspect the evidence and limitations behind the estimates.” `[U]`

The video should show the historical calendar first, then a measured result on the proof page. Keep estimated and provisional labels visible. Show next-day risk with the status supported by its scorecard. Use a video no longer than 30 seconds `[V]`, in English or with English subtitles. A slide alternative may contain no more than 7 slides `[V]`, including the title. The [production plan](2026-11-15-video-and-pitch.md) supplies the shot sequence, but its older numerical claims must be checked against this draft's sources before recording.

## References

Suggested field text:

“Emerge uses NASA active-fire observations as its core data. The complete external-resource register lists the data, software, imagery, source links, uses and recorded licence terms. Research references are listed separately from deployed inputs. Display layers and model inputs are identified separately; their inclusion is not a claim that the model uses every layer.”

Include these linked registers with the field text, and expand their entries if the portal requires an inline list:

| Reference group | Source list to include |
|---|---|
| Historical and recent satellite detections; public archive mirror | [Data register](../references.md#data), historical country files, active-fire files and archive-mirror entries |
| Fire-weather maps; satellite estimates; national reported statistics and reports | [Data register](../references.md#data), weather-service, country-estimate and national-report entries |
| Street maps, country boundaries and satellite background imagery | [Data and software registers](../references.md), map-data, boundaries and imagery entries |
| Next-day inputs, display layers and backup sources | [Data register](../references.md#data), forecast archive, regional boundaries, land cover, vegetation, backup mosaic, regional grouping and regional weather entries |
| Pipeline, application, mapping, geometry, charts, downloads, translation and test software | [Complete software register](../references.md#software), every entry |
| Scientific papers, sensor user guides, statistical methods, research code and agency background | [Conversion research sources](../conversion-plan.md#10-sources), every entry; these are research references, not evidence that every proposed technique was implemented |
| Fonts used by the live site | [About page credits](https://emerge-beta-ten.vercel.app/about), font entry and its recorded licence; this entry supplements the repository register |
| Challenge wording and submission requirements | [Challenge source](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/); [submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/); [judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/); [participant guidance](https://www.spaceappschallenge.org/resources/participant-faqs/); [terms](https://www.spaceappschallenge.org/legal/); [local event](https://www.spaceappschallenge.org/2026/local-events/sofia/) |
| Project licence | [Licence register](../references.md#licence-text) and [repository licence](../../LICENSE) |

**Final resource reconciliation:** turn repository-relative links into public source links when pasting into the portal. Add the final demo's music, images, voice assets and any reused earlier code if used; no such final asset inventory was available for this draft. Reconcile the merged reference register with the released build. Do not declare all rights settled: the register leaves endpoint-specific fire-weather terms and some national-source terms unresolved. `[V]`

## Super Intelligence usage

We used AI coding assistants under team direction for research summaries, planning, code, interface work, data preparation, model implementation, tests and documentation, including this submission draft. People set the scope and make the submission decisions. `[V]`

To avoid using AI output as its own proof, expected answers were prepared separately from implementation and compared with raw satellite records. Separate agents reviewed work, and factual sources were checked against original pages. These checks do not make every AI-generated claim correct: the submission distinguishes measured results, untested plans and unresolved checks. `[V]`

The [AI-use record](../si-usage.md) describes the completed work and its checks. This draft adds the current use of an assistant to reconcile that evidence and prepare submission text. The team must review the wording and reconcile any further AI use in the final demo before submitting.

## Submission checks for the team

- Compare every portal field and length limit with this document. Replace editorial link markers only with verified links; remove evidence tags before pasting into the form.
- Confirm event registration, eligibility and team-page membership outside this public draft. Do not add personal details here.
- Check project, demo, source and reference links without login. Confirm English text or subtitles and the demo length limit above.
- Review all media rights and the age restriction above. Record external media, earlier code and further AI use in the submission inventories.
- Review the required open-source licence, source-specific reuse terms and unresolved licence entries. The team must affirm **“Terms and Conditions”** and **“Confirm All Work is Original”** in the portal; this draft does not tick or certify either declaration.
- The recorded local video deadline is Sunday 15 November, 14:00 Sofia time `[V]`; the NASA submission deadline is Sunday 15 November, 23:59 Sofia time `[V]`. Use the portal's submission action and check that it confirms receipt.

## Claims check

The rows below cover the factual claim groups in the field text. Proposed benefits and features remain explicitly untested.

| Claim | Traceable source | Tag |
|---|---|---|
| Instrument differences require harmonization; target users and challenge objectives | [Challenge brief](../challenge-brief.md) | `[V]` |
| Live historical calendar, area selection, estimates, missing-data distinction | [Live About page](https://emerge-beta-ten.vercel.app/about); [overview](../../specs/overview.md) | `[V]` |
| Record start, last data day, partial month and provisional coverage | [Metadata](../../web/public/data/meta.json): `first_month`, `last_data_day`, `coverage`, `limits`; public metadata matched the committed file | `[V]` |
| Deployed conversion groups and background estimate | [Validation](../../web/public/data/validation.json): `method.model_note` | `[V]` |
| Fire cell-day definition; monthly conversion; raw daily values and unconverted heat output | [Data contract](../data-contract.md#31-what-a-fire-day-cd-is); validation `limits` | `[V]` |
| Calendar comparisons and downloads | [Overview](../../specs/overview.md); [build plan](build-plan.md#81-where-we-stand) | `[V]` for documented status, not a fresh end-to-end feature test |
| Reports and satellite estimates have separate labels | [Build plan](build-plan.md#81-where-we-stand) | `[V]` |
| Worldwide fit and hold-out testing differ from method selection in Bulgaria and the United States | [Data contract](../data-contract.md#10-validationjson), “What was tested, stated accurately”; validation `world_scope`, `countries`, `limits` | `[V]` |
| All reported historical test scores, country counts and test periods | Validation `world_scope`, `holdout`, `world_gate`; [live proof](https://emerge-beta-ten.vercel.app/proof) | `[V]` |
| Truth-sample and export checks passed; daily-to-monthly scorer check not computed | Validation `control_totals`, `world_gate` | `[V]` |
| Grid, small-area error, estimated early values, country gaps, wide summed ranges | Validation `limits`; metadata `limits` | `[V]` |
| Historical probability remains unscored | Validation `chance_of_fire`; [build plan](build-plan.md#81-where-we-stand) | `[V]` |
| Firefighter interview informed next-day scope | [Risk overview](../../specs/plan-2-fire-risk/overview.md); [AI-use record](../si-usage.md) | `[V]` for documented design input, not general evidence about all services |
| Intended planning benefits and distinctive combination | [Project overview](../../specs/overview.md); team interpretation in this draft | `[U]` |
| Risk inputs, selection, hold-out results, coverage and probability checks | [Risk scorecard](../../web/public/data/risk/scorecard.json); [risk metadata](../../web/public/data/risk/meta.json); [test protocol](../../pipeline/risk/PROTOCOL.md) | `[V]` for recorded results; protocol deviations remain open |
| Static demo output and an unscored week outlook | [Build plan](build-plan.md#83-where-this-night-builds-differently-from-spec-section-11) | `[V]` for documented plan |
| Risk title, safety text and crew-advice wording | [Risk wording rules](../../specs/plan-2-fire-risk/specification.md#10-wording-and-safety) | `[V]` |
| Resource uses, credits and unresolved terms | [References](../references.md); [live About credits](https://emerge-beta-ten.vercel.app/about) | `[V]` for recorded terms; unresolved permissions are not verified |
| AI activities and checks | [AI-use record](../si-usage.md); this draft's preparation record | `[V]` |
| Form requirements, demo restrictions, declarations, deadlines and judging criteria | [Rules and judging](../rules-and-judging.md) | `[V]` as recorded there; exact portal field names and limits still need checking |
