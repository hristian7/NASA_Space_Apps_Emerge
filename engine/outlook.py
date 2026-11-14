"""Stage 5: live outlook, issued 15 Nov 2026, latest complete month October 2026.

Target month -> model lead (data known up to the month before issue = October):
  Dec 2026 -> lead 1 (latest known month 2 months back: Oct)
  Jan 2027 -> lead 3 model on Sep data (lead 2 not fitted; older data is safe)
  Feb 2027 -> lead 3 (Oct)
Only units whose fire season covers the target month and whose gates (analyze.py)
passed at that lead. Weather for 2026: NASA POWER monthly (Jan-Sep) and daily
(October, averaged). Ocean indices not yet published for October (IOD: Aug,
TNA: Sep) carry their latest value forward (persistence), flagged in the output.
"""
import json
import os
import urllib.request
import numpy as np
import pandas as pd
import engine as e
import forecast as fc
import fetch_power as fp

TARGETS = {(2026, 12): 1, (2027, 1): 3, (2027, 2): 3}
# MODIS exaggerates fire swings: VIIRS log-anomalies = 0.79 x MODIS log-anomalies
# (median over 76 units, 2012-2021, verify/m21_viirs_anomalies.py). Factors are
# also given at VIIRS level; probabilities don't change (terciles move together).
VIIRS_SLOPE = 0.79
DAILY = ("https://power.larc.nasa.gov/api/temporal/daily/point?parameters="
         "T2M_MAX,RH2M,PRECTOTCORR,GWETROOT,WS2M&community=AG"
         "&longitude={lon}&latitude={lat}&start=20260101&end=20261031&format=JSON")
MONTHLY26 = fp.URL.replace("start=2001&end=2025", "start=2026&end=2026")


def _get(url, path):
    if not os.path.exists(path):
        with urllib.request.urlopen(url, timeout=90) as r:
            open(path, "wb").write(r.read())
    return json.load(open(path))["properties"]["parameter"]


def point_2026(lat, lon):
    """Monthly 2026 Jan-Oct at a point: monthly API where published, daily mean after."""
    m = pd.DataFrame(_get(MONTHLY26.format(lat=lat, lon=lon), f"power/{lat:+.1f}_{lon:+.1f}_2026m.json"))
    m = m[~m.index.str.endswith("13")].replace(-999.0, np.nan)
    m.index = [(int(k[:4]), int(k[4:])) for k in m.index]
    d = pd.DataFrame(_get(DAILY.format(lat=lat, lon=lon), f"power/{lat:+.1f}_{lon:+.1f}_2026d.json"))
    d = d.replace(-999.0, np.nan)
    d.index = pd.to_datetime(d.index, format="%Y%m%d")
    dm = d.groupby([d.index.year, d.index.month]).mean()
    out = m.combine_first(dm.set_axis(list(dm.index), axis=0))     # monthly first, daily fills gaps
    out = out.loc[[(2026, k) for k in range(1, 11)]]
    es = 0.6108 * np.exp(17.27 * out.T2M_MAX / (out.T2M_MAX + 237.3))
    out["VPD"] = es * (1 - out.RH2M / 100)
    out.index = pd.MultiIndex.from_tuples(out.index, names=["y", "mo"])
    return out


def extend_weather(w, pts):
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(4) as ex:
        frames = list(ex.map(lambda r: point_2026(r[0], r[1]), zip(pts.lat, pts.lon)))
    wt = pts.n / pts.n.sum()
    w26 = sum(f[w.columns] * wi for f, wi in zip(frames, wt))
    future = pd.MultiIndex.from_tuples([(2026, 11), (2026, 12), (2027, 1), (2027, 2)], names=["y", "mo"])
    return pd.concat([w[w.index.get_level_values("y") <= 2025], w26,
                      pd.DataFrame(index=future, columns=w.columns, dtype=float)])


def freeze_trend(groups_feats_year_cap=2021):
    """Never extrapolate the fitted trend past the training years: the year
    feature is capped at 2021 for every target (level persists)."""
    orig = e.features

    def patched(w, ocean, lead, lat=0.0):
        g = orig(w, ocean, lead, lat)
        g["trend"] = g["trend"].clip(upper=groups_feats_year_cap)
        return g
    e.features = patched


def contributions(fire, w, ocean, lead, months, lat, groups, target):
    """Which factor pushes the forecast, and which way (in log units)."""
    X, y = fc.design(fire, w, ocean, lead, months, lat, groups)
    tr = X.index.get_level_values("y").isin(e.TRAIN_YEARS) & X.notna().all(1).to_numpy()
    mos = X.index.get_level_values("mo").to_numpy()[tr]
    anom = y.to_numpy()[tr] - pd.Series(y.to_numpy()[tr]).groupby(mos).transform("mean").to_numpy()
    A = X.to_numpy()[tr]
    mu, sd = A.mean(0), A.std(0) + 1e-9
    Z = (A - mu) / sd
    beta = np.linalg.solve(Z.T @ Z + e.ALPHA * np.eye(Z.shape[1]), Z.T @ (anom - anom.mean()))
    z = (X.loc[target].to_numpy() - mu) / sd
    out = {}
    for g in groups:
        idx = [i for i, c in enumerate(X.columns) if c.startswith(g + ":")]
        out[g] = float(np.sum(beta[idx] * z[idx]))
    return out


if __name__ == "__main__":
    freeze_trend()
    gates = pd.read_csv("gates.csv")
    gates["gated"] = gates.gated.apply(eval)
    ocean = e.ocean_indices()
    stale = {c: "-".join(str(int(v)) for v in ocean[c].last_valid_index()) for c in ocean}
    full = pd.MultiIndex.from_product([range(2000, 2028), range(1, 13)], names=["y", "mo"])
    ocean = ocean.reindex(full)
    ocean.loc[ocean.index <= (2026, 10)] = ocean.loc[ocean.index <= (2026, 10)].ffill()
    rows = []
    for (country, unit, cls, season), g in gates.groupby(["country", "unit", "cls", "season"]):
        fire = pd.read_csv(f"fire/{country}.csv")
        fire = fire[(fire.unit == unit) & (fire.cls == cls)]
        months, _ = e.fire_seasons(fire)[season]
        targets = [t for t in TARGETS if t[1] in months]
        if not targets:
            continue
        w = pd.read_csv(f"weather/{country}.csv").drop(columns="country")
        w = w[(w.unit == unit) & (w.cls == cls)].drop(columns=["unit", "cls"]).set_index(["y", "mo"])
        pts = pd.read_csv(f"fire/{country}_points.csv")
        pts = pts[(pts.unit == unit) & (pts.cls == cls)]
        lat = g.lat.iloc[0]
        wx = None
        for t in targets:
            lead = TARGETS[t]
            groups = [x for x in g[g.lead.astype(str) == str(lead)].gated.iloc[0] if x != "dryness_now"]
            if not groups:
                continue
            if wx is None:
                wx = extend_weather(w, pts)
            h = fc.hindcast(fire, w, e.ocean_indices(), lead, months, lat, groups)
            gated_skill = 1 - np.sum((h.obs - h.pred) ** 2) / np.sum(h.obs ** 2)
            if gated_skill < 0.05:
                continue                       # the gated model must itself beat history
            res = fc.outlook(fire, wx, ocean, lead, months, lat, groups, [t])
            if not res:
                continue
            con = contributions(fire, wx, ocean, lead, months, lat, groups, t)
            rows.append({"country": country, "unit": unit, "kind": cls, "season": season,
                         "target": f"{t[0]}-{t[1]:02d}", "lead": lead, "groups": groups,
                         **res[0], "drivers": {k: round(v, 2) for k, v in con.items()},
                         "skill_held_out": round(float(gated_skill), 3)})
    out = pd.DataFrame(rows)
    for c in ("factor", "factor_lo", "factor_hi"):
        out[c.replace("factor", "factor_viirs")] = np.exp(VIIRS_SLOPE * np.log(out[c]))
    # Evidence tier (verify/m58_physics_only.csv): on unseen years 2022-2025 the
    # weather and ocean factors beat history only in the wet tropics (|lat| < 23.5,
    # > 1000 mm/yr). Elsewhere the skill rests on held-out years 2003-2021 only.
    res = pd.read_csv("results.csv")[["country", "unit", "cls", "season", "abs_lat", "rain_mm_yr"]].drop_duplicates()
    out = out.merge(res.rename(columns={"cls": "kind"}), on=["country", "unit", "kind", "season"], how="left")
    wet_tropics = (out.abs_lat < 23.5) & (out.rain_mm_yr > 1000)
    physical = out.groups.apply(lambda g: any(x in g for x in ("ocean", "dryness_memory", "fuel_growth")))
    out["evidence"] = np.where(wet_tropics & physical, "confirmed on unseen years (wet tropics)",
                      np.where(physical, "held-out years only", "recent level only (trend)"))
    out.to_csv("outlook_2026-11-15.csv", index=False)
    json.dump({"issued": "2026-11-15", "latest_month_used": "2026-10",
               "index_last_published": stale, "rows": len(out)}, open("outlook_meta.json", "w"), indent=1)
    cols = ["country", "unit", "kind", "target", "factor", "factor_lo", "factor_hi", "p_above", "p_below",
            "skill_held_out", "drivers"]
    srt = out.sort_values("p_above", ascending=False)
    print("MOST LIKELY ABOVE NORMAL"); print(srt[cols].head(25).round(2).to_string(index=False))
    print("MOST LIKELY BELOW NORMAL"); print(srt[cols].tail(15).round(2).to_string(index=False))
    print("units:", out.groupby(["country", "unit", "kind"]).ngroups, "| median factor", round(out.factor.median(), 2))
