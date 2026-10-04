"""Helpers for the language audit: walk the leaves of a JSON answer, and guess whether a sentence is English or Polish."""
import sys,re,json,collections; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import *
EN=set('the of and per from with within for to in is are not no by on at as or a an this that data source number total median mean share rate index latest area district city'.split())
PL=set('i w z na do nie jest są dla od po przez oraz lub który która które liczba średnia mediana udział wskaźnik dane źródło dzielnica miasto brak'.split())
def leaves(o,path=''):
    if isinstance(o,dict):
        for k,v in o.items(): yield from leaves(v,f'{path}.{k}')
    elif isinstance(o,list):
        for i,v in enumerate(o): yield from leaves(v,f'{path}[]')
    elif isinstance(o,str): yield path,o
def guess(s):
    words=re.findall(r"[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]+",s.lower())
    if len(words)<3: return None
    en=sum(w in EN for w in words); pl=sum(w in PL for w in words)+sum(bool(re.search('[ąćęłńóśźż]',w)) for w in words)
    return 'en' if en>pl else 'pl' if pl>en else None
