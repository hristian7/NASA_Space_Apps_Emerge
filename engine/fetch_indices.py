"""Download the ocean and atmosphere indices the engine uses (all NOAA, no login).

  nina34.anom.data   Nino 3.4 SST anomaly                  NOAA PSL
  tna.data           Tropical Northern Atlantic index       NOAA PSL
  mnth.ersstv6...    Dipole Mode Index (IOD), ERSSTv6       NOAA CPC
  ersst.v5.pdo.dat   Pacific Decadal Oscillation, ERSSTv5   NOAA NCEI
  nao_cpc.txt        North Atlantic Oscillation             NOAA CPC
  ao_cpc.txt         Arctic Oscillation                     NOAA CPC
  aao_cpc.txt        Southern Annular Mode (AAO)            NOAA CPC
"""
import os
import urllib.request

FILES = {
    "nina34.anom.data": "https://psl.noaa.gov/data/correlation/nina34.anom.data",
    "tna.data": "https://psl.noaa.gov/data/correlation/tna.data",
    "mnth.ersstv6.clim19912020.dmi_current.txt":
        "https://www.cpc.ncep.noaa.gov/products/international/ocean_monitoring/indian/IODMI/"
        "mnth.ersstv6.clim19912020.dmi_current.txt",
    "ersst.v5.pdo.dat": "https://www.ncei.noaa.gov/pub/data/cmb/ersst/v5/index/ersst.v5.pdo.dat",
    "nao_cpc.txt": "https://www.cpc.ncep.noaa.gov/products/precip/CWlink/pna/norm.nao.monthly.b5001.current.ascii",
    "ao_cpc.txt": "https://www.cpc.ncep.noaa.gov/products/precip/CWlink/daily_ao_index/monthly.ao.index.b50.current.ascii",
    "aao_cpc.txt": "https://www.cpc.ncep.noaa.gov/products/precip/CWlink/daily_ao_index/aao/"
                   "monthly.aao.index.b79.current.ascii",
}

if __name__ == "__main__":
    os.makedirs("idx", exist_ok=True)
    for name, url in FILES.items():
        with urllib.request.urlopen(url, timeout=60) as r:
            open(f"idx/{name}", "wb").write(r.read())
        print("ok", name)
