# Changelog fragments

Every pull request adds **one new file here** instead of editing `ON_SITE_CHANGELOG.md`. Two pull requests never touch the same file, so GitHub never reports a conflict in the changelog.

## How to add one

Create `changelog/YYYY-MM-DD-<area>-<short-slug>.md` (for example `2026-10-04-frontend-header-320px.md`). The file holds the entry, exactly as it would appear in the changelog: one bullet, starting with `- `, giving what changed and why. A change to imported code gets its own bullet that says so. Keep each file to a few lines.

```
- `frontend/src/styles.css`: below 26rem the header wraps, so no page scrolls sideways at 320 pixels (issue #45). No imported code changed.
```

Use a new file name every time. Never edit another pull request's fragment.

## What the coordinator does

Before a merge of `develop` into `main` (and before the freeze and the submission), run from the repository root:

```bash
python3 scripts/build_changelog.py        # appends every fragment to ON_SITE_CHANGELOG.md, oldest first, and deletes the fragment files
git add -A changelog ON_SITE_CHANGELOG.md
```

Commit the result in the pull request that merges into `main`. `python3 scripts/build_changelog.py --check` lists what is waiting and exits with 1 if there are fragments. Judges read `ON_SITE_CHANGELOG.md`, so it must be built before the submission.

The history of both files stays in git. Never rewrite it.
