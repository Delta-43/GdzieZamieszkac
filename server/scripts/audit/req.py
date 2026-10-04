"""Request handling audit: errors, languages, methods, headers, limits and odd inputs."""
import sys,json,urllib.request,urllib.error; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from lib import *
def show(label,path,lang=None,**kw):
    c,h,j=get(path,lang,**kw); hl={k.lower():v for k,v in h.items()}
    t=hl.get('content-type','')[:28]
    d=(j.get('detail') or j.get('title')) if isinstance(j,dict) else (j[:60] if isinstance(j,str) else '')
    print(f'{label:34} {c} {t:28} {str(d)[:70]}')
    return c,hl,j
print('--- unknown things')
show('unknown district','/districts/nope','pl')
show('unknown district (upper)','/districts/STARE-MIASTO','pl')
show('unknown metric','/metrics/nope/values','pl')
show('series for unknown metric','/districts/stare-miasto/series/nope','pl')
show('unknown path','/nothing','pl')
show('trailing slash','/districts/','pl')
show('similar limit 0','/districts/stare-miasto/similar?limit=0','pl')
show('similar limit 11','/districts/stare-miasto/similar?limit=11','pl')
show('similar limit abc','/districts/stare-miasto/similar?limit=abc','pl')
show('commute unknown from','/commute?from=nope','pl')
show('commute no from','/commute','pl')
print('--- language handling')
show('lang=de','/districts','de')
show('lang=PL (upper)','/districts','PL')
c,hl,j=show('Accept-Language pl','/districts',headers={'Accept-Language':'pl-PL,pl;q=0.9'}); print('   lang echoed:',j.get('lang'))
c,hl,j=show('Accept-Language de','/districts',headers={'Accept-Language':'de'}); print('   lang echoed:',j.get('lang'))
c,hl,j=show('no lang at all','/districts'); print('   lang echoed:',j.get('lang'))
print('--- methods and headers')
show('POST on GET route','/districts',method='POST',body=b'{}',headers={'content-type':'application/json'})
show('GET on POST route','/recommend')
show('DELETE','/districts',method='DELETE')
c,hl,_=show('HEAD','/districts',method='HEAD')
c,hl,_=show('OPTIONS preflight','/districts',method='OPTIONS',headers={'Origin':'http://localhost:5173','Access-Control-Request-Method':'GET'}); print('   allow-origin:',hl.get('access-control-allow-origin'))
c,hl,_=show('OPTIONS bad origin','/districts',method='OPTIONS',headers={'Origin':'http://evil.example','Access-Control-Request-Method':'GET'})
c,hl,j=get('/districts','pl',raw=False); 
c,h,raw=get('/districts','pl',raw=True); hl={k.lower():v for k,v in h.items()}
print('headers on /districts:',{k:hl[k][:40] for k in ('etag','cache-control','content-security-policy','x-content-type-options','referrer-policy','x-request-id','content-encoding') if k in hl})
et=hl.get('etag'); 
c2,h2,_=get('/districts','pl',headers={'If-None-Match':et},raw=True); print('If-None-Match ->',c2)
c3,h3,_=get('/districts','pl',headers={'Accept-Encoding':'gzip'},raw=True); print('gzip ->',{k.lower():v for k,v in h3.items()}.get('content-encoding'))
c4,h4,_=get('/districts','pl',headers={'X-Request-ID':'audit-123'},raw=True); print('request id echoed:',{k.lower():v for k,v in h4.items()}.get('x-request-id'))
c5,h5,_=get('/districts','pl',headers={'X-Request-ID':'bad id with spaces & <script>'},raw=True); print('bad request id replaced:',{k.lower():v for k,v in h5.items()}.get('x-request-id'))
print('--- limits')
show('body 17 KB','/recommend','pl',method='POST',body=b'{"weights":{}'+b' '*17000+b'}',headers={'content-type':'application/json'})
print('--- odd inputs')
show('code with sql','/districts/x%27%3B%20drop%20table%20a%3B--','pl')
show('very long code','/districts/'+'a'*5000,'pl')
show('unicode code','/districts/%C5%81%C3%B3d%C5%BA','pl')
show('compare 5 codes','/compare?codes=a,b,c,d,e','pl')
