"""Two figures for the validation page and the docs (reference palette, light mode)."""
import json
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap

INK, INK2, MUTED, GRID, BASE, SURF = "#0b0b0b", "#52514e", "#898781", "#e1e0d9", "#c3c2b7", "#fcfcfb"
SERIES = {"dryness_memory": ("#2a78d6", "Soil and air dryness (last known month)", "o"),
          "ocean": ("#eb6834", "Ocean state (El Niño, IOD, ...)", "s"),
          "fuel_growth": ("#1baf7a", "Fuel growth (last year's rain)", "^"),
          "trend": ("#eda100", "Long-term trend (people, policy)", "D")}
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "text.color": INK,
                     "axes.edgecolor": BASE, "axes.labelcolor": INK2, "xtick.color": MUTED,
                     "ytick.color": MUTED, "axes.facecolor": SURF, "figure.facecolor": SURF})
rep = json.load(open("report.json"))
pr = pd.DataFrame(rep["pass_rates"])

# Figure 1: which factor earns weight, by lead
def spread(vals, gap):
    """Nudge label positions apart so none overlap (keeps their order)."""
    order = np.argsort(vals)
    pos = np.array(vals, dtype=float)
    for _ in range(50):
        for a, b in zip(order[:-1], order[1:]):
            if pos[b] - pos[a] < gap:
                mid = (pos[a] + pos[b]) / 2
                pos[a], pos[b] = mid - gap / 2, mid + gap / 2
    return pos


fig, ax = plt.subplots(figsize=(9.6, 4.6))
leads, xs = ["0", "1", "3"], [0, 1, 3]
ys = {g: [float(pr[(pr.lead == l) & (pr.group == g)]["units_passing_%"].iloc[0]) for l in leads]
      for g in SERIES}
end_pos = dict(zip(SERIES, spread([ys[g][-1] for g in SERIES], 2.6)))
start_pos = dict(zip(SERIES, spread([ys[g][0] for g in SERIES], 2.6)))
for g, (col, label, mk) in SERIES.items():
    y = ys[g]
    ax.plot(xs, y, color=col, lw=2, marker=mk, ms=8, mec=SURF, mew=2, zorder=3,
            ls=(0, (5, 2)) if g == "trend" else "-")
    ax.text(3.15, end_pos[g], f"{label}  {y[-1]:.0f}%", color=INK, va="center", fontsize=9)
    ax.text(-0.12, start_pos[g], f"{y[0]:.0f}%", color=INK2, va="center", ha="right", fontsize=9)
chance = float(pr[pr.lead == "0"]["expected_by_chance_%"].mean())
ax.axhline(chance, color=MUTED, lw=1.2, ls=(0, (4, 3)), zorder=2)
ax.text(1.5, chance + 1.2, f"expected by chance ({chance:.0f}%)", color=MUTED, fontsize=9, ha="center")
ax.set_xticks(xs, ["Issued at the start\nof the month", "1 month\nahead", "3 months\nahead"])
ax.set_ylabel("Fire units where the factor beats\nshuffled data (%)")
ax.set_ylim(0, max(55, ax.get_ylim()[1]))
ax.set_xlim(-0.5, 3.0)
ax.grid(axis="y", color=GRID, lw=0.8, zorder=0)
for s in ("top", "right", "left"):
    ax.spines[s].set_visible(False)
ax.set_title("Which factor carries weight depends on how far ahead you look", loc="left",
             fontsize=12, fontweight="bold", color=INK, pad=14)
fig.text(0.01, 0.045, "Held-out years 2003-2021, 499 fire units in 26 countries. Aqua MODIS fire cell-days; "
         "NASA POWER weather; NOAA ocean indices.", color=MUTED, fontsize=8)
fig.text(0.01, 0.01, "Trend (dashed) is gated by a fixed bar of +0.05 skill; shuffling years cannot test it "
         "against chance.", color=MUTED, fontsize=8)
fig.subplots_adjust(left=0.12, right=0.6, bottom=0.22, top=0.86)
fig.savefig("fig_weights_by_lead.png", dpi=200)

# Figure 2: which factor earns weight, by climate (issued at the start of the month)
res = pd.read_csv("results.csv")
res["lead"] = res.lead.astype(str)
thr = rep["null_thresholds"]
d = res[res.lead == "0"].copy()
d["climate"] = pd.cut(d.rain_mm_yr, [0, 500, 1000, 1600, 1e9],
                      labels=["Arid (<500 mm/yr)", "Semi-arid (500-1000)", "Sub-humid (1000-1600)", "Humid (>1600)"])
d["zone"] = np.where(d.abs_lat < 23.5, "Tropics", "Outside tropics")
rows, labels = [], []
for (z, c), g in d.groupby(["zone", "climate"], observed=True):
    if len(g) < 8:
        continue
    rows.append([100 * (g[f"phi_{k}"] > thr["0"][k]).mean() for k in SERIES])
    labels.append(f"{z}, {c}  (n={len(g)})")
M = np.array(rows)
cmap = LinearSegmentedColormap.from_list("seq", ["#f0efec", "#b7d3f6", "#6da7ec", "#2a78d6", "#184f95", "#0d366b"])
fig, ax = plt.subplots(figsize=(8.6, 0.55 * len(rows) + 1.8))
im = ax.imshow(M, cmap=cmap, vmin=0, vmax=80, aspect="auto")
for i in range(M.shape[0]):
    for j in range(M.shape[1]):
        ax.text(j, i, f"{M[i, j]:.0f}%", ha="center", va="center", fontsize=9,
                color="#ffffff" if M[i, j] > 45 else INK)
ax.set_xticks(range(len(SERIES)), ["Dryness\n(last month)", "Ocean\nstate", "Fuel\ngrowth", "Trend"])
ax.set_yticks(range(len(labels)), labels, color=INK2)
ax.tick_params(length=0)
for s in ax.spines.values():
    s.set_visible(False)
ax.set_xticks(np.arange(-0.5, M.shape[1]), minor=True)
ax.set_yticks(np.arange(-0.5, M.shape[0]), minor=True)
ax.grid(which="minor", color=SURF, lw=2)
fig.suptitle("Where each factor earns weight", x=0.01, ha="left", fontsize=12, fontweight="bold")
ax.set_title("% of fire units in each climate, forecast issued at the start of the month", loc="left",
             fontsize=9, color=INK2, pad=10)
fig.text(0.01, 0.01, f"Chance level about {chance:.0f}% (trend: fixed bar). Groups with fewer than 8 units "
         "are left out.", color=MUTED, fontsize=8)
fig.tight_layout(rect=(0, 0.03, 1, 1))
fig.savefig("fig_weights_by_climate.png", dpi=200)
print("ok")
