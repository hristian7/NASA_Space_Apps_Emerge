"""5 km cells over Bulgaria, each assigned to its municipality (geoBoundaries ADM2)."""
import json
import numpy as np
import pandas as pd
from shapely.geometry import shape, Point
from shapely.prepared import prep

CELL = 0.05
g = json.load(open("bgr_adm2.geojson"))
munis = [(f["properties"]["shapeName"], f["properties"]["shapeID"], shape(f["geometry"])) for f in g["features"]]
prepared = [(n, i, prep(s)) for n, i, s in munis]
minx = min(s.bounds[0] for *_, s in munis); miny = min(s.bounds[1] for *_, s in munis)
maxx = max(s.bounds[2] for *_, s in munis); maxy = max(s.bounds[3] for *_, s in munis)
rows = []
for a in range(int(np.floor(miny / CELL)), int(np.ceil(maxy / CELL))):
    for b in range(int(np.floor(minx / CELL)), int(np.ceil(maxx / CELL))):
        p = Point((b + 0.5) * CELL, (a + 0.5) * CELL)
        for n, i, s in prepared:
            if s.contains(p):
                rows.append({"ga": a, "gb": b, "lat": (a + 0.5) * CELL, "lon": (b + 0.5) * CELL, "muni": n, "muni_id": i})
                break
cells = pd.DataFrame(rows)
cells.to_csv("cells.csv", index=False)
print(len(cells), "cells;", cells.muni_id.nunique(), "municipalities; median cells per municipality",
      int(cells.groupby("muni_id").size().median()), "; bbox", round(minx, 2), round(miny, 2), round(maxx, 2), round(maxy, 2))
