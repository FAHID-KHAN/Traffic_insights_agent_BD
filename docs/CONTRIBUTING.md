# Contributing

## Branch Rules

| Branch | Purpose | Direct push? |
|--------|---------|--------------|
| `main` | Production-ready code | **No** — PR only |
| `dev` | Integration / staging | **No** — PR only |
| `feature/*` | New features | Yes |
| `fix/*` | Bug fixes | Yes |
| `docs/*` | Documentation only | Yes |

### Naming Examples

```
feature/add-weekly-analysis
fix/scraper-timeout-handling
docs/update-api-endpoints
```

## Pull Request Rules

1. **All changes to `main` must go through a PR** — no direct pushes.
2. **CI must pass** — the GitHub Actions workflow runs lint + import checks on every PR.
3. **At least 1 approval** required before merging.
4. **Use the PR template** — fill in the description and checklist.
5. **Keep PRs focused** — one feature or fix per PR.
6. **Squash merge** preferred to keep `main` history clean.

## Setting Up Branch Protection on GitHub

Go to **Settings → Branches → Add rule** for the `main` branch and enable:

- [x] Require a pull request before merging
- [x] Require approvals (1)
- [x] Require status checks to pass before merging → select **lint-and-test**
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings

Repeat for `dev` if desired.

## Local Development Workflow

```bash
# 1. Create a feature branch from main
git checkout main && git pull
git checkout -b feature/your-feature-name

# 2. Make changes, test locally
python run.py                      # verify server starts
flake8 app/                        # lint check

# 3. Commit and push
git add -A
git commit -m "feat: describe your change"
git push -u origin feature/your-feature-name

# 4. Open a PR on GitHub targeting main
```
