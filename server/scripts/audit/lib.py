"""Shared by the audit scripts: GET or POST against the API in API (default http://localhost:8000/v1)."""
import json, urllib.request, urllib.error, urllib.parse
import os
B=os.environ.get('API','http://localhost:8000/v1')
def get(path, lang=None, method='GET', body=None, headers=None, raw=False):
    url=B+path
    if lang:
        url+=('&' if '?' in url else '?')+'lang='+lang
    req=urllib.request.Request(url, method=method, data=body, headers=headers or {})
    try:
        r=urllib.request.urlopen(req, timeout=30)
        data=r.read(); h=dict(r.headers); code=r.status
    except urllib.error.HTTPError as e:
        data=e.read(); h=dict(e.headers); code=e.code
    if raw: return code,h,data
    try: j=json.loads(data)
    except Exception: j=data.decode('utf8','replace')
    return code,h,j
