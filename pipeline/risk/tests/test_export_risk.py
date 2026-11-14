import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from export_risk import ranked_spots


def test_ranked_spots_excludes_null_and_keeps_zero():
    rows = pd.DataFrame([
        {'country': 'AAA', 'region_id': 'A', 'spot_id': 1, 'p': None, 'hist_p': 1, 'tie_order': 1},
        {'country': 'AAA', 'region_id': 'A', 'spot_id': 2, 'p': 0, 'hist_p': 0, 'tie_order': 2},
        {'country': 'AAA', 'region_id': 'A', 'spot_id': 3, 'p': .5, 'hist_p': 0, 'tie_order': 3},
    ])
    assert ranked_spots(rows).spot_id.tolist() == [3, 2]
