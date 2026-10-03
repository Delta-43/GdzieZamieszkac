Closes #

## What changed and why

## Checks

- [ ] I added one new file to `changelog/` with the date and the reason (every change to imported code too). I did not edit `ON_SITE_CHANGELOG.md`.
- [ ] Backend changes: the contract (`backend/openapi.yaml`) changed first, and `cd backend && .venv/bin/python -m pytest -q -m "not live"` passes.
- [ ] Frontend changes: it works in Polish and in English, with the keyboard only, and at 320 pixels and 200 percent zoom.
- [ ] No invented numbers. Every value shows its provenance. A metric without data shows its reason, never a zero.
- [ ] Crime is worded "recorded crimes per 10 000 residents". The words "safe" and "dangerous" do not appear.
- [ ] No secret, token, database URL, personal email or private network address is in this change.
- [ ] No request goes to a third party, and nothing new is stored in the browser.

## Review

`unicorn-alex` reviews frontend changes: the contract, the licences and the Polish text.
