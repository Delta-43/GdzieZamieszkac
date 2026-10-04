"""Series, compare, personas and recommend audit, including invalid weights."""
import sys,collections,json; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import *
L='pl'
codes=[d['code'] for d in get('/districts',L)[2]['districts']]
issues=[]
def bad(m): issues.append(m)
print('SERIES')
tot=collections.Counter()
for code in codes:
    c,h,j=get(f'/districts/{code}/series/sale_price_median_m2',L)
    if c!=200: bad(f'series {code} -> {c}'); continue
    p=j['points']; q=[x['period_start'] for x in p]
    if q!=sorted(q) or len(q)!=len(set(q)): bad(f'series order/duplicates {code}')
    lo=sum(1 for x in p if x['low_confidence']); tot[len(p)]+=1
    nulls=[x for x in p if x.get('value') is None]
    if nulls: bad(f'series {code} has null values: {len(nulls)}')
    if any(x['n_obs'] is not None and x['n_obs']<j.get('min_obs',0) and not x['low_confidence'] for x in p): bad(f'series {code}: n_obs below min_obs without low_confidence')
print(' points per district (count of districts):',dict(tot))
last={get(f'/districts/{c}/series/sale_price_median_m2',L)[2]['points'][-1]['period_end'] for c in codes}; print(' latest period_end:',last)
c,h,j=get('/districts/stare-miasto/series/rent_price_median_m2',L); print(' series for a metric without history ->',c, j.get('title') if isinstance(j,dict) else '')
print('COMPARE')
for q in ('stare-miasto,nowa-huta','nowa-huta,stare-miasto','stare-miasto,nowa-huta,podgorze,debniki','stare-miasto','stare-miasto,nowa-huta,podgorze,debniki,krowodrza','stare-miasto,stare-miasto','stare-miasto,nope','','stare-miasto,,nowa-huta','STARE-MIASTO,nowa-huta'):
    c,h,j=get('/compare?codes='+q,L)
    order=[d['code'] for d in j['districts']] if c==200 else None
    print(f'  codes={q!r:62} -> {c} {order or (j.get("detail") if isinstance(j,dict) else "")}')
print('PERSONAS / RECOMMEND')
cats={'transport','demographics','livability','amenities','environment','cost','safety'}
ps=get('/personas',L)[2]['personas']; print(' personas',[p['key'] for p in ps])
for p in ps:
    unk=set(p['weights'].get('category',{}))-cats
    if unk: bad(f"persona {p['key']} unknown categories {unk}")
    c,h,j=get('/recommend',L,method='POST',body=json.dumps({'weights':p['weights'],'lang':L}).encode(),headers={'content-type':'application/json'})
    if c!=200: bad(f"recommend persona {p['key']} -> {c}")
    else: print('  ',p['key'],'top3',[r['code'] for r in j['ranking'][:3]],'used',j['metrics_used'])
def rec(body,ct='application/json'): 
    c,h,j=get('/recommend',L,method='POST',body=body if isinstance(body,bytes) else json.dumps(body).encode(),headers={'content-type':ct}); return c,(j.get('detail') if isinstance(j,dict) else j)
for name,b in [('negative',{'weights':{'category':{'cost':-1}}}),('too big',{'weights':{'category':{'cost':9}}}),('unknown category',{'weights':{'category':{'xx':1}}}),('unknown metric',{'weights':{'metric':{'nope':1}}}),('neutral metric',{'weights':{'metric':{'population_density':1}}}),('all zero',{'weights':{'category':{c:0 for c in ('transport','livability','amenities','environment','cost','safety')}}}),('bad lang',{'lang':'de'}),('string weight',{'weights':{'category':{'cost':'a'}}}),('extra field',{'foo':1}),('empty body',b''),('not json',b'{bad'),]:
    print(f'  recommend {name:16} ->',rec(b))
print('  recommend wrong content-type ->',rec(b'{}','text/plain'))
print('\nISSUES:'); [print(' -',i) for i in issues] or print(' none')
