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


def test_fixed_level_band_boundaries():
    import numpy as np
    from export_risk import LEVEL_BANDS
    assert (np.searchsorted(LEVEL_BANDS, [0, .0099, .01, .02, .05, .10], side='right') + 1).tolist() == [1, 1, 2, 3, 4, 5]


def test_context_categories_use_unrounded_inputs():
    from export_risk import fwi_category, usual_category
    assert fwi_category(11.19) == 0
    assert fwi_category(11.2) == 1
    assert fwi_category(None) is None
    assert usual_category(.00669, .01) == 0
    assert usual_category(.0067, .01) == 1
    assert usual_category(.015, .01) == 1
    assert usual_category(.01501, .01) == 2
    assert usual_category(None, .01) is None


def test_export_defaults_follow_the_published_model_version():
    import json, re
    from pathlib import Path
    root = Path(__file__).resolve().parents[3]
    source = (root / 'pipeline/risk/export_risk.py').read_text()
    meta = json.loads((root / 'web/public/data/risk/meta.json').read_text())
    version = re.search(r'v(\d+)$', meta['model_version']).group(1)
    assert f"model_v{version}.json" in source
    assert f"predictions_live_v{version}.parquet" in source
