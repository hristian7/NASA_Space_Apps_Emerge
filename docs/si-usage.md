# How we used AI

For the AI-usage note of the NASA submission. Updated at each checkpoint. All work started on Sat 14 Nov 2026 after 09:00.

**Tool:** AI coding assistants (large language models) working in this repository under the team's direction. People chose the scope, the method and every decision in [`../specs/specification.md`](../specs/specification.md), section 11.

**Our rule: the AI is never its own judge.** Expected answers are written before the code, by a separate agent that never sees that code, from raw NASA files. Results are checked against real data, a second satellite or published numbers ([`verification-plan.md`](verification-plan.md)).

| When (Sofia time) | What AI did | How it was checked |
|---|---|---|
| Sat 14 Nov, day | Research summaries in `docs/research/`; the download and cell-count scripts in `pipeline/`; the design preview in `web/preview/` | Control totals (V-M125), hard limits (V-M32), sources read at the original page where tagged `[V]` |
| Sat 14 Nov, 17:15 to 17:45 | Read the whole repo for contradictions; wrote [`plans/build-plan.md`](plans/build-plan.md) | A second agent reviewed the files independently; its main claims were spot-checked by hand |
| Sat 14 Nov, from 17:45 | Bake-off of the two conversion plans ([`../pipeline/bakeoff/PROTOCOL.md`](../pipeline/bakeoff/PROTOCOL.md)): two agents build one pipeline each, a third writes the scoring and hand-computed answers first | The winner rule was committed before any score existed |
| Sat 14 Nov, evening | Web research on similar tools ([`research/competitors.md`](research/competitors.md)); draft plan for the video and pitch ([`plans/2026-11-15-video-and-pitch.md`](plans/2026-11-15-video-and-pitch.md)); the report card linking to FIRMS, GWIS and EFFIS | Each tool's claims read on its own page or an official source and tagged; dated or secondary sources tagged `[D]`; every link format loaded in a browser before use; 10 tests on the links |
| Sat 14 Nov, 20:27 to 20:50 | A second AI research agent mapped 16 fire sites and tools against our code ([`research/feature-map.md`](research/feature-map.md)) | A report shape check written before the run; a sample of its claims re-checked against the sites, the PDF text and our files |
| Sat 14 Nov, 20:00 to 21:30 | Turned the team's notes from a firefighter interview into a structured record; drafted plan 2 (next-day fire risk) and its build spec; a research agent checked the data sources | The team member who held the interview checked the record line by line; data sources tagged `[V]` were read at the official pages |
| Sat 14 Nov, 21:40 to 22:40 | Plan 2 double-checked: own fact checks at the official sources (GitHub schedule rule, NASA product catalogue), then an independent review agent read the plan against the code and repo; its 16 findings were applied | Facts tagged `[V]` were read at the source; the reviewer had no access to the author's conclusions |
