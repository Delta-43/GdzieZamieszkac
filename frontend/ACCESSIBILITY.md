# Accessibility guide: WCAG 2.2 level AA

The target is WCAG 2.2 level AA, decided on 3 October 2026. Polish law requires WCAG 2.1 level AA from public bodies, so 2.1 AA is the legal floor.
Level 2.2 AA covers that floor. The portal is pitched as a city service, so treat every item here as a requirement, not a wish.

The law also requires an accessibility statement. The city reviews it by 31 March each year. It must say how users can report a problem.
The app provides the statement page and a footer link. The city completes the content.

## What WCAG 2.2 adds

| Criterion | Level | What it means here |
|---|---|---|
| 2.4.11 Focus not obscured (minimum) | AA | A sticky header or banner must never cover the focused element. |
| 2.5.7 Dragging movements | AA | Anything you can do by dragging must also work with a single click or tap. |
| 2.5.8 Target size (minimum) | AA | Every pointer target is at least 24 by 24 CSS pixels. Aim for 44. |
| 3.2.6 Consistent help | A | If you add a help or contact link, put it in the same place on every page. |
| 3.3.7 Redundant entry | A | Do not ask the user to enter the same information twice in one flow. |
| 3.3.8 Accessible authentication (minimum) | AA | A login must not need a memory, puzzle or object-recognition test. Allow paste and password managers. |
| 4.1.1 Parsing | removed | You no longer test for it. Valid HTML is still good practice. |

## Rules for this app

### Structure and navigation

- Put a skip link first. Use landmarks: header, navigation, main and footer. Give each navigation a label.
- Use one `h1` per page and a logical heading order. Do not skip levels.
- Give every page a title that says what it is.
- After a route change, move focus to the main region.
- Keep the navigation in the same order on every page.

### Language

- Set the page language attribute to the chosen language, and update it when the user toggles.
- Mark a passage in the other language with its own `lang` attribute. Proper nouns, such as district names, need no mark.

### Keyboard

- Every function works with the keyboard alone. Nothing traps focus.
- The focus indicator is always visible and has at least 3:1 contrast with its surroundings.
- Tab order follows the visual order.
- A region that scrolls must be focusable and have a label, so keyboard users can scroll it.

### Pointer targets

- Buttons, links, toggles and map districts are at least 24 by 24 CSS pixels. Aim for 44 on touch screens.

### Colour and contrast

- Text has at least 4.5:1 contrast. Large text has at least 3:1.
- Borders, icons, focus rings and map colours that carry meaning have at least 3:1 against their neighbours.
- Never use colour as the only signal. The data kind badge uses text and a shape. A low-confidence mark has a sentence.
- Choose a map colour scale that works for people with colour blindness. Add patterns for districts without data.
- Keep all colours as tokens in one file. Add a test that checks the contrast of every token pair, so a new theme cannot break it.

### Reflow, zoom and spacing

- The page reflows at 320 CSS pixels wide with no horizontal page scroll. A wide table scrolls inside its own region.
- Text resizes to 200 percent with no loss. The layout survives 400 percent zoom.
- Use `rem` units and no fixed heights, so user text spacing settings do not break the layout.
- A tooltip or popover shown on hover or focus must be dismissible, hoverable and persistent.
- Respect `prefers-reduced-motion`. Start no animation that the user did not ask for.

### Forms (household profile, sliders, budget)

- Every field has a visible label tied to it. Put instructions before the field.
- Use a native `input type="range"` for sliders. Show the current value as text. Allow arrow keys.
- Name an error in text, next to the field, and say how to fix it. Do not use colour alone.
- Use the right `autocomplete` token for any personal data field.
- Do not ask for the same information twice in one flow.

### Maps and charts

- The map is an SVG. Each district is a focusable link with an accessible name that includes its value.
- The table of districts is a full equivalent. No information exists only in the map.
- A chart comes with a one-sentence text summary and a data table of the same values.
- Never rely on hover to reveal information.

### Tables

- Use a `caption`, `th` elements with `scope`, and no layout tables.

### Dynamic content

- Announce loading results and filter results through a polite live region (`role="status"`).
- Show an error with `role="alert"`, and say what to do next.
- Announce the result of "find a district" when it arrives.

### Images and icons

- Mark a decorative symbol `aria-hidden="true"`. Give an informative image a text alternative.
- Do not use an icon without a text label.

### Markup

- Use a native element before you add ARIA. Do not repeat a role the element already has.
- Give every control a name, a role and a state that assistive software can read.

### Login (phase 3)

- A login must pass criterion 3.3.8. Allow paste and password managers. Offer the national login node, which uses no puzzle.
- Do not add a CAPTCHA that needs object recognition.

## Hard parts to plan early

1. The map. It needs keyboard access, a legend, patterns and the table equivalent.
2. The price chart. It needs a text summary, a data table and a clear low-confidence mark.
3. The sliders. They need labels, text values and keyboard control.
4. The wide tables. They need a scrollable, labelled region.

## How to test

Run all six steps before each release. Automated tools catch only part of the problems.

1. **Lint.** Use `eslint-plugin-jsx-a11y` and treat its warnings as errors.
2. **Component tests.** Run `axe` through `vitest-axe` on each page, in both languages. This runs in jsdom, which cannot check colour contrast.
3. **Browser check.** Run `axe-core` in a real browser on every page, in both languages. This is where contrast problems appear. Playwright can drive it.
4. **Keyboard pass.** Tab through every page. Check the order, the focus indicator and that nothing traps focus.
5. **Zoom and reflow.** Check 320 pixels wide, 200 percent text and 400 percent zoom.
6. **Screen reader pass.** Use NVDA with Firefox or Chrome on Windows, and VoiceOver on iOS Safari. Walk the main flow: home, districts, one district, find a district.

Record the result of each run in a file in the repository, with the date and the build. List any known failure and its fix date.

## Before a release

- [ ] No known WCAG 2.2 level A or AA failure remains.
- [ ] The accessibility statement lists every exception that remains.
- [ ] The contrast test for the theme tokens passes.
- [ ] `unicorn-alex` has reviewed the Polish interface text.
