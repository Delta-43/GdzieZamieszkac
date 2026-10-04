"""Deeper endpoint audit: similar, outlook, rent-vs-buy and commute for every district."""
import sys,collections,json; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import *
L='pl'
codes=[d['code'] for d in get('/districts',L)[2]['districts']]
issues=[]
def bad(m): issues.append(m)
# similar
c,h,j=get('/districts/stare-miasto/similar',L); print('similar keys',list(j.keys()), 'n',len(j['similar']), json.dumps(j['similar'][0],ensure_ascii=False)[:200])
for code in codes:
    c,h,j=get(f'/districts/{code}/similar?limit=5',L)
    if c!=200: bad(f'similar {code} {c}'); continue
    s=j['similar']
    if any(x['code']==code for x in s): bad(f'similar contains self {code}')
    if len(s)!=5: bad(f'similar {code} returned {len(s)}')
    sims=[x['similarity'] for x in s]
    if sims!=sorted(sims,reverse=True): bad(f'similar not sorted {code}')
    if any(not(0<=x<=1) for x in sims): bad(f'similarity out of 0..1 {code} {sims}')
# outlook
c,h,j=get('/districts/stare-miasto/outlook',L); print('\noutlook keys',list(j.keys()))
print(json.dumps({k:(v if not isinstance(v,(list,dict)) else '...') for k,v in j.items()},ensure_ascii=False)[:500])
for code in codes:
    c,h,j=get(f'/districts/{code}/outlook',L)
    if c!=200: bad(f'outlook {code} {c}')
    else:
        txt=json.dumps(j,ensure_ascii=False).lower()
        if 'forecast' in txt or 'prognoz' in txt: print('  outlook mentions forecast:',code, [w for w in ('forecast','prognoz') if w in txt])
# rent vs buy
c,h,j=get('/districts/stare-miasto/rent-vs-buy?area_m2=50',L); print('\nrent-vs-buy',json.dumps(j,ensure_ascii=False)[:600])
for a in ('14','15','250','251','abc','-5','50.5',''):
    c,h,j=get(f'/districts/stare-miasto/rent-vs-buy?area_m2={a}',L); print('  area',repr(a),'->',c, (j.get('title') if isinstance(j,dict) else ''))
nr=[code for code in codes if get(f'/districts/{code}/rent-vs-buy?area_m2=50',L)[0]!=200]; print('  districts without rent-vs-buy:',nr)
# commute
c,h,j=get('/commute?from=stare-miasto',L); print('\ncommute keys',list(j.keys())); print(json.dumps(j,ensure_ascii=False)[:500])
mins=[d.get('minutes') for d in j.get('destinations',j.get('districts',[]))]; print('  n dest',len(mins),'null',sum(m is None for m in mins),'min',min(m for m in mins if m is not None),'max',max(m for m in mins if m is not None))
asym=0
M={}
for a in codes:
    jj=get(f'/commute?from={a}',L)[2]
    for d in jj.get('destinations',jj.get('districts',[])): M[(a,d.get('code') or d.get('to'))]=d.get('minutes')
for (a,b),v in M.items():
    w=M.get((b,a))
    if a!=b and v is not None and w is not None and abs(v-w)>15: asym+=1
print('  pairs differing >15 min between directions:',asym,'; self minutes sample:',M.get(('stare-miasto','stare-miasto')))
# series
c,h,j=get('/districts/stare-miasto/series/sale_price_median_m2',L); print('\nseries keys',list(j.keys())); pts=j.get('points') or j.get('series') or []
print('  n points',len(pts), json.dumps(pts[0],ensure_ascii=False)[:160], '...', json.dumps(pts[-1],ensure_ascii=False)[:200])
for code in codes:
    c,h,j=get(f'/districts/{code}/series/sale_price_median_m2',L)
    if c!=200: bad(f'series {code} -> {c}'); continue
    p=j.get('points') or j.get('series') or []
    q=[x.get('quarter') or x.get('period') for x in p]
    if q!=sorted(q): bad(f'series not sorted {code}')
    if len(q)!=len(set(q)): bad(f'series duplicate quarter {code}')
    lo=sum(1 for x in p if x.get('low_confidence'))
    print(f'   {code:26} {len(p):>2} quarters {q[0] if q else ""}-{q[-1] if q else ""} low_conf {lo}') if code in codes[:0] else None
print('\nISSUES:'); [print(' -',i) for i in issues] or print(' none')
