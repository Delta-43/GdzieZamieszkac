# Review checklist for frontend pull requests

For `unicorn-alex`, and for anyone who reviews a frontend pull request. The author runs the same list before asking for a review.
A review should take minutes. Comment on each failed item, and approve only when every item passes or has an agreed exception.

## 1. Contract

- [ ] The API types come from the current `backend/openapi.yaml`. No response shape is written by hand.
- [ ] The pull request does not call an endpoint that is not in the contract.
- [ ] If the pull request needs an API change, the contract change is in its own pull request first.
- [ ] A `501` answer hides the feature. It does not show an error page.

## 2. Provenance and wording

- [ ] Every value shows its `display` string as given. No number is formatted in the browser.
- [ ] Every value shows its data kind badge, source, date and caveat.
- [ ] A metric without data shows its reason. It never shows a zero or an empty cell.
- [ ] Crime is worded "recorded crimes per 10 000 residents". The words "safe" and "dangerous" appear nowhere.
- [ ] A score is shown with its note that it compares the districts of one city only.
- [ ] Every AI-written report shows the AI label.
- [ ] No page shows a price forecast or ranks districts by predicted growth.

## 3. Licences and attribution

- [ ] The footer and the sources page show the credit line of every source from `/meta`.
- [ ] The road accident credit line is visible wherever those values appear.
- [ ] No request goes to a third party: no font, tile, script, analytics or tracker.
- [ ] The only item stored in the browser is the language choice.

## 4. Language

- [ ] Polish is the default. The toggle switches to English and back.
- [ ] Every request carries `lang`.
- [ ] `pl.json` and `en.json` have the same keys. The test for that passes.
- [ ] Text from the API is not translated in the browser.

### Reviewing Polish text

1. Read every changed string in `pl.json` in context, on the running page.
2. For a wrong term, comment with the correct one. Use the project's terms: "ofertowa cena najmu" for asking rent, and "wskaźnik jakości życia" for the livability score.
3. Check units, plural forms and agreement in the interface strings. The API's display strings are not part of the pull request. Report a problem in them to the coordinator.
4. Record a correction as a suggestion in the pull request. The author applies it.

## 5. Accessibility (WCAG 2.2 AA)

- [ ] Keyboard only: you can reach and use everything, in a sensible order, with a visible focus indicator.
- [ ] The skip link works. Focus moves to the main region after navigation.
- [ ] Headings are in order, with one `h1`. The page has a title.
- [ ] Contrast: the theme test passes. Meaning never depends on colour alone.
- [ ] 320 pixels wide, 200 percent text and 400 percent zoom: no loss of content and no horizontal page scroll.
- [ ] Every control has a visible label. Pointer targets are at least 24 by 24 pixels.
- [ ] Results and errors are announced (`role="status"` or `role="alert"`).
- [ ] The map has a table equivalent. A chart has a text summary and a data table.
- [ ] The automated accessibility tests pass for each page, in both languages.
- [ ] For a pull request that changes the main flow: a screen reader pass. NVDA with Firefox or Chrome on Windows, or VoiceOver on iOS.

## 6. Quality

- [ ] The pull request is small and does one thing.
- [ ] Lint, type check and tests pass.
- [ ] No secret, no personal data, no real database address.
- [ ] No synthetic data in the product. Test fixtures stay in tests.
