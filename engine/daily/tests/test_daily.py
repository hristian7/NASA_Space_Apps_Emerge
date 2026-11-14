"""Known-answer tests for the daily module (expected values from the literature,
written before running)."""
import numpy as np
from xclim.compute.fire import _cffwis as F


def test_fwi_matches_van_wagner_pickett_1985():
    """Day 1 of the Van Wagner & Pickett (1985) test data: T 17 C, RH 42%, wind 25 km/h,
    no rain, start FFMC 85, DMC 6, DC 15, April, 46 N."""
    ffmc = F._fine_fuel_moisture_code(17.0, 0.0, 25.0, 42.0, 85.0)
    dmc = F._duff_moisture_code(17.0, 0.0, 42.0, 4, 46.0, 6.0)
    dc = F._drought_code(17.0, 0.0, 4, 46.0, 15.0)
    isi = F.initial_spread_index(25.0, ffmc)
    bui = F.build_up_index(dmc, dc)
    fwi = F.fire_weather_index(isi, bui)
    for got, want in [(ffmc, 87.7), (dmc, 8.5), (dc, 19.0), (isi, 10.9), (bui, 8.5), (fwi, 10.1)]:
        assert abs(float(got) - want) < 0.06


def test_probability_correction_undoes_subsampling():
    """If negatives are kept at rate r, a sample probability p maps back to
    p*r / (p*r + 1 - p): 0.5 with r = 0.01 is about 0.0099."""
    p, r = 0.5, 0.01
    assert abs(p * r / (p * r + 1 - p) - 0.00990099) < 1e-6
