"""V-M21 differential test on an independent satellite: Terra (morning) vs Aqua.

For each unit with gated factors (issued at the start of the month), refit the same
gated model with Terra's fire record (2003-2019, before Terra's orbit drift) and
compare: do the fitted factor directions agree, and does the model still beat
history on held-out years? Physics, not an Aqua quirk, should survive the swap.
"""
from pathlib import Path
import sys
import duckdb
import numpy as np
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import engine as e
import forecast as fc

ENG = Path(__file__).resolve().parents[1]
RAW = ENG.parent / "data" / "raw" / "modis"
gates = pd.read_csv(ENG / "gates.csv")
gates = gates[gates.lead.astype(str) == "0"]
gates["gated"] = gates.gated.apply(eval).apply(lambda g: [x for x in g if x != "dryness_now"])
gates = gates[gates.gated.apply(len) > 0]
ocean = e.ocean_indices(str(ENG / "idx"))
con = duckdb.connect()
rows = []
for c, gc in gates.groupby("country"):
    con.execute(f"""CREATE OR REPLACE TABLE m AS SELECT DISTINCT floor(latitude*100) a, floor(longitude*100) b,
        CAST(acq_date AS DATE) d, satellite s FROM read_csv('{RAW}/*/modis_*_{c}.csv', union_by_name=true,
        types={{'confidence':'VARCHAR','acq_time':'VARCHAR','satellite':'VARCHAR'}})
        WHERE type=0 AND TRY_CAST(confidence AS INT)>=30""")
    con.execute("""CREATE OR REPLACE TABLE cls5 AS SELECT floor(a/5) ga, floor(b/5) gb,
        CASE WHEN count(DISTINCT year(d)) >= 10 THEN 'recurrent' ELSE 'episodic' END cls
        FROM m WHERE s IN ('Aqua','A') AND year(d) BETWEEN 2003 AND 2021 GROUP BY 1, 2""")
    T = con.execute("""SELECT CAST(floor(a/500)*5 AS INT) || '_' || CAST(floor(b/500)*5 AS INT) AS unit,
            coalesce(cls5.cls, 'episodic') AS cls, year(d) y, month(d) mo, count(*) cd
        FROM (SELECT DISTINCT a, b, d FROM m WHERE s IN ('Terra','T')) t
        LEFT JOIN cls5 ON floor(a/5) = ga AND floor(b/5) = gb GROUP BY ALL""").df()
    fire_a = pd.read_csv(ENG / "fire" / f"{c}.csv")
    W = pd.read_csv(ENG / "weather" / f"{c}.csv").drop(columns="country")
    for r in gc.itertuples():
        fa = fire_a[(fire_a.unit == r.unit) & (fire_a.cls == r.cls)]
        ft = T[(T.unit == r.unit) & (T.cls == r.cls)][["y", "mo", "cd"]]
        w = W[(W.unit == r.unit) & (W.cls == r.cls)].drop(columns=["unit", "cls"]).set_index(["y", "mo"])
        months, _ = e.fire_seasons(fa)[r.season]
        out = {}
        for name, f in (("aqua", fa), ("terra", ft)):
            X, y = fc.design(f, w, ocean, 0, months, r.lat, r.gated)
            yrs = X.index.get_level_values("y")
            ok = X.notna().all(1).to_numpy() & yrs.isin(range(2003, 2020))
            X, y = X[ok], y[ok]
            mos = X.index.get_level_values("mo")
            an = y - y.groupby(mos).transform("mean")
            Z = (X - X.mean()) / (X.std() + 1e-9)
            beta = np.linalg.solve(Z.T @ Z + e.ALPHA * np.eye(Z.shape[1]), Z.T @ (an - an.mean()))
            out[name] = pd.Series(beta, index=X.columns)
        # held-out skill of the gated model on Terra
        e_train = e.TRAIN_YEARS
        e.TRAIN_YEARS = list(range(2003, 2020))
        h = fc.hindcast(ft, w, ocean, 0, months, r.lat, r.gated)
        e.TRAIN_YEARS = e_train
        skill_t = 1 - np.sum((h.obs - h.pred) ** 2) / np.sum(h.obs ** 2) if len(h) else np.nan
        main = out["aqua"].abs().idxmax()
        rows.append({"country": c, "unit": r.unit, "cls": r.cls, "season": r.season, "groups": "+".join(r.gated),
                     "main_feature": main, "same_sign_main": bool(np.sign(out["aqua"][main]) == np.sign(out["terra"][main])),
                     "coef_corr": float(np.corrcoef(out["aqua"], out["terra"])[0, 1]) if len(out["aqua"]) > 1 else np.nan,
                     "terra_skill": float(skill_t)})
d = pd.DataFrame(rows)
d.to_csv("m21_terra.csv", index=False)
print(f"Units {len(d)} | main factor same direction on Terra: {100 * d.same_sign_main.mean():.0f}% | "
      f"median coefficient correlation {d.coef_corr.median():.2f} | "
      f"Terra held-out skill > 0: {100 * (d.terra_skill > 0).mean():.0f}% (median {d.terra_skill.median():.2f})")
