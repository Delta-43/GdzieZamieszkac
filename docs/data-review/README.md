# Data verification

A person who knows Kraków checks our figures against the real city. This is the best test of the data that we have. This file says how to do it and what happens next.
The first round is by `unicorn-alex`. She records her findings in a form, and the coordinator turns each finding into a fix or a caveat.

## What to check

Check what you can see for yourself. Good checks:

- **Commute.** Pick district pairs you know. Compare our minutes with a journey planner for the same start and end points. We know long trips run 9 to 19 minutes fast.
- **Stops and routes.** Count stops near a place you know, and check the night lines.
- **Amenities.** Schools, clinics, parks, gyms and shops in a district you know.
- **Prices.** Is the sale price per square metre and the asking rent plausible for the district?
- **Noise, air and green space.** Does the ranking of districts match what you know?
- **Polish text.** Wrong or odd terms in labels, notes and reports.

## Rules

- Use any map or planner as a person. Do not copy its data into this repository or into the database. Its terms forbid storing it.
- Record only your own observation and a verdict. Write what you saw, in your words.
- Mark each row **OK**, **Fix** or **Unsure**. For a **Fix**, say what you expect and why.
- Do not guess. If you cannot check something, mark it **Unsure** and say what you would need.

## What happens next

1. The coordinator reads every **Fix** and **Unsure** row.
2. For each one, the coordinator finds the cause: a wrong value, a method limit, or a difference in what is measured.
3. The outcome is one of three: the value is fixed in the database, a caveat is added so the screen explains the limit, or the finding is closed with a reason.
4. The result is written next to the finding, and the change goes in `../../ON_SITE_CHANGELOG.md` if it touches imported code.
5. The reviewer is told what changed.

## Record the findings

Copy `TEMPLATE.md` to `YYYY-MM-DD-<handle>.md` in this folder and fill it in. If you use a form, put its content in this file format so it can be searched and reviewed.
