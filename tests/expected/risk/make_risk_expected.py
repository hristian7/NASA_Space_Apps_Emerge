#!/usr/bin/env python3
"""Independent, deterministic plan 2 examples. Standard library only."""
import hashlib
import json
import math
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2] / 'data/raw/ne_10m_admin_1_states_provinces.geojson'
DIGEST = '22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5'

def save(name, obj):
    (HERE / (name + '.json')).write_text(json.dumps(obj, sort_keys=True, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

def num(x):
    return float(x)

def spot(lat, lon, g):
    lat, lon, g = map(lambda x: F(str(x)), (lat, lon, g))
    row, col = (90-lat)//g, (lon+180)//g
    cols = int(360/g)
    clat, clon = 90-(row+F(1,2))*g, -180+(col+F(1,2))*g
    a, b = map(math.radians, (float(clat+g/2), float(clat-g/2)))
    dl = math.radians(float(g))
    h = math.sin((b-a)/2)**2 + math.cos(a)*math.cos(b)*math.sin(dl/2)**2
    radius = 6371 * math.asin(math.sqrt(max(0, min(1, h))))
    return dict(lat=num(lat), lon=num(lon), g=num(g), row=row, col=col, spot_id=row*cols+col, center_lat=num(clat), center_lon=num(clon), precision_radius_km=round(radius, 6))

points = [('Rila',42.15,23.45),('Strandzha',42.05,27.65),('equator',0,0),('north pole',90,0),('south pole',-90,0),('east antimeridian',0,180),('west antimeridian',0,-180),('northeast',35.123,139.456),('northwest',40.7128,-74.006),('southeast',-33.8688,151.2093),('southwest',-23.5505,-46.6333),('edge',42.25,23.5),('northwest of edge',42.250001,23.499999),('southeast of edge',42.249999,23.500001),('near south pole',-89.999999,179.999999),('near north pole',89.999999,-179.999999),('prime meridian west',0,-0.000001),('prime meridian east',0,0.000001)]
cases=[]
for name, lat, lon in points:
    for g in (0.25,0.1):
        x=spot(lat,lon,g); x['name']=name
        if lat == -90 or lon == 180:
            x['ambiguous']=True
            x['note']='Formula gives an out-of-range index; wrapping longitude and clamping the south pole are alternatives not specified here.'
            alt=spot(-89.999999 if lat == -90 else lat, -180 if lon == 180 else lon,g)
            x['alternative_wrapped_or_clamped']={k:alt[k] for k in ('row','col','spot_id','center_lat','center_lon','precision_radius_km')}
        cases.append(x)
save('spot_id', {'earth_radius_km':6371,'radius_method':'Half the great-circle distance between opposite grid corners, spherical Earth.','cases':cases})

# Geographical containment is evaluated independently from the supplied Natural Earth source.
def ring_contains(ring, x, y):
    inside=False
    for (x1,y1,*_), (x2,y2,*_) in zip(ring, ring[1:]+ring[:1]):
        if (y1>y)!=(y2>y) and x < (x2-x1)*(y-y1)/(y2-y1)+x1:
            inside=not inside
    return inside

def contains(poly,x,y):
    return ring_contains(poly[0],x,y) and not any(ring_contains(r,x,y) for r in poly[1:])

raw=SOURCE.read_bytes()
if hashlib.sha256(raw).hexdigest()!=DIGEST:
    raise ValueError('Natural Earth file differs from the recorded source snapshot')
features=json.loads(raw)['features']
locations=[('Rila',42.15,23.45),('Strandzha',42.05,27.65),('Sofia city',42.6977,23.3219),('California',34.0522,-118.2437),('New York',40.7128,-74.006),('Sao Paulo',-23.5505,-46.6333),('New South Wales',-33.8688,151.2093),('Tokyo',35.6762,139.6503),('Gauteng',-26.2041,28.0473),('Kenya',-1.2921,36.8219),('France',48.8566,2.3522),('near US Canada border',49.01,-122.75)]
regions=[]
for name,lat,lon in locations:
    matches=[]
    for f in features:
        geom=f.get('geometry')
        if not geom: continue
        polys=[geom['coordinates']] if geom['type']=='Polygon' else geom['coordinates'] if geom['type']=='MultiPolygon' else []
        if any(contains(p,lon,lat) for p in polys):
            p=f['properties']; matches.append({'iso_3166_2':p.get('iso_3166_2'),'name':p.get('name')})
    if len(matches)!=1: raise ValueError((name,matches))
    regions.append({'name':name,'lat':lat,'lon':lon,'expected':matches[0]})
save('regions',{'source_url':'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson','download_date':'2026-11-14','sha256':DIGEST,'method':'Ray casting, with holes and multipolygons. Points are away from polygon boundaries.','cases':regions})

# Hand-written target-day examples; day offsets relative to D.
def det(day, spot, sat='NOAA-20', confidence='n', static=False):
    return {'day':day,'spot':spot,'satellite':sat,'confidence':confidence,'static_source':static}
label_cases=[
 ('new', [det(0,[1,1])], 'new'),
 ('continuing same', [det(-1,[1,1]),det(0,[1,1])], 'continuing'),
 ('continuing diagonal D-2', [det(-2,[0,0]),det(0,[1,1])], 'continuing'),
 ('three days earlier', [det(-3,[1,1]),det(0,[1,1])], 'new'),
 ('other satellites ignored', [det(0,[1,1],'S-NPP'),det(0,[1,1],'NOAA-21')], None),
 ('low confidence ignored', [det(0,[1,1],confidence='l')], None),
 ('static source ignored', [det(0,[1,1],static=True)], None),
 ('ignored earlier detections', [det(-1,[0,1],'NOAA-21'),det(-2,[1,0],confidence='l'),det(-1,[2,1],static=True),det(0,[1,1])], 'new'),
 ('wrap neighbour', [det(-1,[1,3]),det(0,[1,0])], 'continuing'),
 ('all eight neighbours', [det(-2,[r,c]) for r,c in [(0,0),(0,1),(0,2),(1,0),(1,2),(2,0),(2,1),(2,2)]]+[det(0,[1,1])], 'continuing')]
neighbour_probes=[{'prior_detection':det(-day,[r,c]),'current_detection':det(0,[1,1]),'expected':'continuing'} for day in (1,2) for r,c in [(0,0),(0,1),(0,2),(1,0),(1,2),(2,0),(2,1),(2,2)]]
save('labels',{'neighbour_probes':neighbour_probes,'grid':{'rows':3,'columns':4,'longitude_wrap':True},'day_offsets':'D = 0; offsets are UTC days','cases':[{'name':n,'detections':d,'target_spot':[1,0] if n=='wrap neighbour' else [1,1],'expected':v} for n,d,v in label_cases]})

# Fixed seed rule: SHA-256 of a documented string, ascending hexadecimal digest.
rows=[{'spot_id':i,'region':'A' if i<=10 else 'B','p':p,'history':h} for i,p,h in [(1,.9,.2),(2,.8,.5),(3,.8,.7),(4,.8,.7),(5,.7,.1),(6,.7,.2),(7,.6,.9),(8,.5,.1),(9,None,.99),(10,0,.3),(11,.99,.9),(12,.98,.9)]]
def tie(i): return hashlib.sha256(('risk-oracle-seed-17:'+str(i)).encode()).hexdigest()
ranked=sorted((r for r in rows if r['region']=='A' and r['p'] is not None),key=lambda r:(-r['p'],-r['history'],tie(r['spot_id'])))
save('ranking',{'top_n':5,'region':'A','seed_rule':'Ascending SHA-256 hex digest of UTF-8 risk-oracle-seed-17:<spot_id>.','rows':rows,'expected_spot_ids':[r['spot_id'] for r in ranked[:5]],'all_ranked_spot_ids':[r['spot_id'] for r in ranked]})

# Each region-day has the same six explicitly scored spots; region sizes include unlisted spots.
# Rational arithmetic calculates all measures, including the Brier baseline.
region_sizes={'A':24,'B':30,'small':12}
fire_sets={'A':[[1,6],[2],[],[6],[4,5,6],[3]],'B':[[6],[1],[],[2,6],[4],[5,6]],'small':[[1],[6],[],[2,3],[6],[4]]}
continuing={'A':[[6],[1],[],[2],[1],[6]],'B':[[1],[],[2],[6],[],[3]],'small':[[],[1],[6],[],[2],[6]]}
pred=[F(1,2),F(2,5),F(3,10),F(1,5),F(1,10),F(1,10)]
hist=[F(1,5)]*6

def rat(x): return {'numerator':x.numerator,'denominator':x.denominator,'value':round(float(x),8)}
def measures(days):
    fires=sum(len(d['new']) for d in days); captured=sum(len(set(d['new']) & set(d['top5'])) for d in days)
    eligible=[d for d in days if d['new']]
    hits=sum(bool(set(d['new']) & set(d['top5'])) for d in eligible)
    bs=sum((pred[i]-(1 if i+1 in d['new'] else 0))**2 for d in days for i in range(6))
    base=sum((hist[i]-(1 if i+1 in d['new'] else 0))**2 for d in days for i in range(6))
    cf=sum(len(d['continuing']) for d in days); cc=sum(len(set(d['continuing']) & set(d['top5'])) for d in days)
    return {'new_fires':fires,'captured_new':captured,'eligible_days':len(eligible),'hit_days':hits,'capture':rat(F(captured,fires)),'hit_rate':rat(F(hits,len(eligible))),'brier_mean':rat(bs/(6*len(days))),'history_brier_mean':rat(base/(6*len(days))),'brier_skill':rat(1-bs/base),'continuing_fires':cf,'captured_continuing':cc,'continuing_capture':rat(F(cc,cf))}
days=[]
for region in region_sizes:
    for i in range(6):
        days.append({'region':region,'day':f'2025-07-{i+1:02d}','new':fire_sets[region][i],'continuing':continuing[region][i],'top5':[1,2,3,4,5]})
regional={}
for region,size in region_sizes.items():
    m=measures([d for d in days if d['region']==region]); m['land_spots']=size; m['report_separately']=size<20; m['lift_over_random']=rat(F(m['captured_new'],m['new_fires']) / F(5,size)); regional[region]=m
save('scores',{'spot_ids':[1,2,3,4,5,6],'probabilities':[num(x) for x in pred],'history_probabilities':[num(x) for x in hist],'days':days,'regions':regional,'pooled':measures(days),'notes':['Hit rate denominator is region-days with at least one new fire, as section 6.1 states.','Brier uses all six listed spot-days, including no-fire days; region sizes affect lift only.','Unlisted land spots are outside this toy probability sample; continuing labels are scored separately.']})

leak=[('training permitted','2023-12-31','2023-12-29',True),('training cutoff violated','2023-12-31','2023-12-30',False),('validation date in training','2024-01-01','2023-12-30',False),('test date in training','2025-01-01','2024-12-30',False),('training older input','2023-06-01','2023-05-29',True),('same day input','2023-06-01','2023-06-01',False)]
save('leakage',{'train':'before 2024-01-01','validation':'2024','test':'2025','input_cutoff':'end of D-2 UTC','cases':[{'name':n,'day':d,'latest_input_day':i,'allowed_in_training':v} for n,d,i,v in leak]})
columns=['grid_g','spot_id','day','p']
def file_case(name, cols, rows, valid, reason): return {'name':name,'columns':cols,'rows':rows,'valid':valid,'reason':reason}
base=[0.25,1,'2025-01-01',0.2]
save('model_file',{'expected_grid_g':0.25,'cases':[file_case('valid',columns,[base],True,'Required columns and valid values.'),file_case('wrong grid',columns,[[0.1,1,'2025-01-01',0.2]],False,'Grid differs from the run grid.'),file_case('probability outside range',columns,[[0.25,1,'2025-01-01',1.01]],False,'p exceeds 1.'),file_case('duplicate spot day',columns,[base,base],False,'Duplicate spot and day.'),file_case('missing column',columns[:-1],[[0.25,1,'2025-01-01']],False,'p column is missing.'),file_case('null probability',columns,[[0.25,1,'2025-01-01',None]],True,'Null p means no data.') ]})
