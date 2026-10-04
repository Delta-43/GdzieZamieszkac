"""Consistency audit: same districts, metrics and values across all endpoints; the default score equals the stored one; sources cover every metric. Prints ISSUES: none when clean."""
import sys,collections,json; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import *
issues=[]
def bad(msg): issues.append(msg)
L='pl'
meta=get('/meta',L)[2]; dl=get('/districts',L)[2]; geo=get('/districts.geojson',L)[2]; cat=get('/metrics',L)[2]['metrics']
codes=[d['code'] for d in dl['districts']]
print('districts',len(codes),'meta.district_count',meta['district_count'],'geojson',len(geo['features']))
if meta['district_count']!=len(codes): bad('meta.district_count != /districts')
gc={f['properties']['code'] for f in geo['features']}
if gc!=set(codes): bad(f'geojson codes differ: {gc^set(codes)}')
names={f['properties']['code']:f['properties']['name'] for f in geo['features']}
for d in dl['districts']:
    if names.get(d['code'])!=d['name']: bad(f"name differs {d['code']}: geojson {names.get(d['code'])} vs list {d['name']}")
byk={m['key']:m for m in cat}
print('metrics',len(cat),'available',sum(m['available'] for m in cat),'has_series',[m['key'] for m in cat if m.get('has_series')])
for m in cat:
    if not m['available'] and not m.get('reason'): bad(f"unavailable metric without reason: {m['key']}")
    if m['available'] and m.get('reason'): bad(f"available metric with a reason: {m['key']}")
# sources cover
srcmap=collections.defaultdict(list)
for s in meta['sources']:
    for k in s.get('metric_keys',[]): srcmap[k].append(s['name'])
nosrc=[m['key'] for m in cat if m['available'] and m['key'] not in srcmap and m['data_kind']!='derived']
print('available metrics without a source entry in /meta:',nosrc)
dup=[k for k,v in srcmap.items() if len(v)>1]; print('metrics in several sources:',dup)
unknown=[k for k in srcmap if k not in byk]; print('source metric_keys not in catalogue:',unknown)
# values endpoint vs detail vs list
vals={}
for m in cat:
    c,h,j=get(f"/metrics/{m['key']}/values",L)
    if m['available']:
        if c!=200: bad(f"values {m['key']} -> {c}")
        else: vals[m['key']]={v['district']:v for v in j['values']}
    else:
        if c==200 and j.get('values'): bad(f"unavailable metric {m['key']} returns values")
for k,v in vals.items():
    missing=set(codes)-set(v)
    if missing and len(missing)>0: print(f'  metric {k}: no value for {len(missing)} districts: {sorted(missing)[:4]}')
det={}
for code in codes:
    c,h,j=get(f'/districts/{code}',L); det[code]=j
    if c!=200: bad(f'detail {code} -> {c}')
mism=0; checked=0
for code,d in det.items():
    for cg in d['categories']:
        for m in cg['metrics']:
            k=m['key']
            if k not in byk: bad(f'detail has metric not in catalogue: {k}'); continue
            v=vals.get(k,{}).get(code)
            if m.get('available',True) and v:
                checked+=1
                if m.get('display')!=v['display'] or (m.get('rank') or {}).get('position')!=(v.get('rank') or {}).get('position'):
                    mism+=1
                    if mism<=5: bad(f"{code}/{k}: detail {m.get('display')} rank {(m.get('rank') or {}).get('position')} vs values {v['display']} rank {(v.get('rank') or {}).get('position')}")
print('detail vs values checked',checked,'mismatches',mism)
# livability score consistency
sc={d['code']:d['livability_score'] for d in dl['districts']}
for code in codes:
    if det[code].get('livability_score')!=sc[code]: bad(f'score differs {code}: list {sc[code]} detail {det[code].get("livability_score")}')
    a=det[code].get('area_km2'); b=[d['area_km2'] for d in dl['districts'] if d['code']==code][0]
    if a!=b: bad(f'area differs {code}: {a} vs {b}')
rv=vals.get('livability_score_default',{})
for code in codes:
    if code in rv and abs(rv[code]['value']-(sc[code] or 0))>0.051: bad(f'score values endpoint differs {code}: {rv[code]["value"]} vs {sc[code]}')
rec=get('/recommend',L,method='POST',body=b'{}',headers={'content-type':'application/json'})
print('recommend no weights ->',rec[0])
for r in rec[2]['ranking']:
    if abs(r['score']-(sc[r['code']] or 0))>0.051: bad(f"recommend default score != stored {r['code']}: {r['score']} vs {sc[r['code']]}")
print('ranking order equals score order:', [r['code'] for r in rec[2]['ranking']]==[c for c,_ in sorted(sc.items(), key=lambda x:(-(x[1] or -1)))])
print('\nISSUES:'); [print(' -',i) for i in issues] or print(' none')
