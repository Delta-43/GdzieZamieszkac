"""Language audit: free text identical in Polish and English, and English-looking text in the Polish answers."""
import sys,re,collections; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import *
from helpers import leaves, guess
TEXT={'licence','caveat','method','description','label','reason','note','text','summary','title','unit','score_note','direction','higher_is_label','explanation','display','narrative','detail'}
eps=['/meta','/districts','/districts/stare-miasto','/districts/nowa-huta','/districts/stare-miasto/report','/districts/stare-miasto/similar','/districts/stare-miasto/series/sale_price_median_m2','/districts/stare-miasto/outlook','/districts/stare-miasto/rent-vs-buy?area_m2=50','/metrics','/metrics/sale_price_median_m2/values','/metrics/crimes_per_10k/values','/compare?codes=stare-miasto,nowa-huta','/commute?from=stare-miasto','/personas']
same=collections.defaultdict(set); eng=collections.defaultdict(set)
for e in eps:
    pl=dict(leaves(get(e,'pl')[2])); en=dict(leaves(get(e,'en')[2]))
    # leaves() flattens lists with [] so duplicate paths overwrite: use list-aware compare
    plL=list(leaves(get(e,'pl')[2])); enL=list(leaves(get(e,'en')[2]))
    for (p,a),(p2,b) in zip(plL,enL):
        last=p.split('.')[-1]
        if last not in TEXT: continue
        if len(a)<4 or re.fullmatch(r'[\d\W]+',a): continue
        if a==b and re.search(r'[A-Za-z]{4,} [A-Za-z]{3,}',a): same[last].add((e[:42],a[:100]))
        elif guess(a)=='en' : eng[last].add((e[:42],a[:100]))
print("IDENTICAL IN PL AND EN (free text):")
for k,v in same.items():
    print(f' [{k}] {len(v)}'); [print('    ',x) for x in sorted(v)[:5]]
print("\nENGLISH-LOOKING IN PL:")
for k,v in eng.items():
    print(f' [{k}] {len(v)}'); [print('    ',x) for x in sorted(v)[:6]]
