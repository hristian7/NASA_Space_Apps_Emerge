"""V-M38 reference check: does the engine's fitted El Nino effect point the way the
standard NOAA/IRI impact maps say, region by region?

Reference (written before looking at engine output): the ENSO dashboard's list of
typical El Nino effects, simplified from NOAA and IRI impact maps. Expected fire
direction: 'dry' -> more fire, 'wet' -> less, 'warm' -> more; an explicit fire
direction on the list overrides. A unit counts if its tile centre lies inside the
region's ellipse and its fire season overlaps the region's months.
"""
import sys
import numpy as np
import pandas as pd

MON = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
REF = [  # name, effect, months, lat, lon, rLat, rLon, explicit fire direction
    ("Indonesia and the Philippines", "dry", "Aug to Feb", 2, 116, 12, 18, "up"),
    ("Eastern Australia", "dry", "Jun to Feb", -26, 146, 12, 9, None),
    ("Northern Australia", "dry", "Dec to Feb", -15, 132, 5, 12, "down"),
    ("Southern Africa", "dry", "Dec to Mar", -20, 29, 9, 12, "up"),
    ("Northern South America and the Amazon", "dry", "Dec to Apr", 0, -60, 9, 16, "up"),
    ("Central America and the Caribbean", "dry", "Jun to Mar", 14, -80, 6, 13, "up"),
    ("India (summer monsoon)", "dry", "Jun to Sep", 22, 79, 9, 9, None),
    ("Southern United States and northern Mexico", "wet", "Dec to Feb", 31, -98, 6, 19, None),
    ("Southeastern South America", "wet", "Oct to Feb", -30, -56, 7, 8, None),
    ("Western Canada and the northern US", "warm", "Dec to Feb", 53, -108, 8, 22, None),
]


def months(span):
    a, b = (MON[x] for x in span.split(" to "))
    return [((a - 1 + i) % 12) + 1 for i in range((b - a) % 12 + 1)]


def season_months(code):
    a, b = (int(x) for x in code.split("-"))
    return [((a - 1 + i) % 12) + 1 for i in range((b - a) % 12 + 1)]


res = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "../../docs/engine-results/results.csv")
res = res[(res.n >= 30) & (res["lead"].astype(str) == "0")]
lat0 = res.unit.str.split("_").str[0].astype(float) + 2.5
lon0 = res.unit.str.split("_").str[1].astype(float) + 2.5
rows = []
for name, kind, when, la, lo, rla, rlo, fire in REF:
    expect = {"up": 1, "down": -1}.get(fire, {"dry": 1, "wet": -1, "warm": 1}[kind])
    inside = ((lat0 - la) / rla) ** 2 + ((lon0 - lo) / rlo) ** 2 <= 1
    overlap = res.season.apply(lambda s: bool(set(season_months(s)) & set(months(when))))
    d = res[inside & overlap]
    b = d["b_ocean:nino34"].dropna()
    rows.append({"region": name, "expected fire": "more" if expect > 0 else "less", "units": len(b),
                 "agree": int((np.sign(b) == expect).sum()),
                 "agree_%": round(100 * float((np.sign(b) == expect).mean()), 0) if len(b) else None})
out = pd.DataFrame(rows)
tot = out[out.units > 0]
print(out.to_string(index=False))
print(f"\nAll matched units: {tot.agree.sum()} of {tot.units.sum()} agree "
      f"({100 * tot.agree.sum() / tot.units.sum():.0f}%); chance would be about 50%.")
