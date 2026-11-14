"""Tables from res2_*.json (test 2025 unless noted)."""
import json, glob, sys

SET = sys.argv[1] if len(sys.argv) > 1 else "test2025"


def load(tag):
    try:
        return json.load(open(f"res2_{tag}.json"))
    except FileNotFoundError:
        return None


def row(tag):
    r = load(tag)
    if not r:
        return None
    s = r[SET]
    c, p = s["top5_per_province_cell"], s["top5_per_province_spot10"]
    f, a, n = s["one_spot_per_municipality_15km"], s["municipality_ranking_auc"], s["national_28_teams_catch"]
    return r, s, c, p, f, a, n


print(f"== {SET}: top 5 per province, capture (hit) ==")
print(f"{'run':24s} {'model 5km':>12s} {'fwi':>12s} {'history':>12s} {'lastwk':>12s} {'random':>12s} | {'model 11km':>12s} {'history':>12s} {'fwi':>12s} | CI vs history (5km)")
for tag in sorted(t[5:-5] for t in glob.glob("res2_*.json")):
    x = row(tag)
    if not x:
        continue
    r, s, c, p, f, a, n = x
    def fm(d): return f"{d['capture']:.3f}({d['hit']:.2f})"
    ci = c["model_minus_baseline_capture_95ci"]["history"]
    print(f"{tag:24s} {fm(c['model']):>12s} {fm(c['fwi']):>12s} {fm(c['history']):>12s} {fm(c['last_week']):>12s} {fm(c['random']):>12s} | "
          f"{fm(p['model']):>12s} {fm(p['history']):>12s} {fm(p['fwi']):>12s} | [{ci[0]:+.3f},{ci[1]:+.3f}]")
print(f"\n== {SET}: firefighter (1 spot/municipality, 15 km), municipality AUC, 28 teams ==")
for tag in sorted(t[5:-5] for t in glob.glob("res2_*.json")):
    x = row(tag)
    if not x:
        continue
    r, s, c, p, f, a, n = x
    print(f"{tag:24s} 1spot model {f['model']['hit']:.3f} hist {f['history']['hit']:.3f} lastwk {f['last_week']['hit']:.3f} rand {f['random']['hit']:.3f} | "
          f"AUC model {a['model']['any']:.3f} fwi {a['fwi']['any']:.3f} hist {a['history']['any']:.3f} | 28t model {n['model']['any']:.3f} hist {n['history']['any']:.3f} | BSS {s['brier_skill_vs_history']:.3f}"
          + (f" | trees {r.get('trees')}" if r.get('trees') else f" | epochs {r.get('epochs')}"))
