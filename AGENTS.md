# Repository Guidelines

## Project Structure & Module Organization
- `run.py`: local entry point (`uvicorn` app loader).
- `app/`: backend code.
- `app/scraper.py`: New Age Bangladesh scraping pipeline.
- `app/llm/`: OpenAI integration (`openai_client.py`, `llm_schema.py`, `llm_extractor.py`, `fake_data.py`).
- `app/database.py`: SQLite schema and query helpers.
- `app/routes.py`: FastAPI API endpoints.
- `app/geo.py`, `app/normalize.py`: district normalization, division mapping, coordinates.
- `static/`: frontend assets (`index.html`, `js/`, `css/`).
- `data/`: runtime artifacts (`accidents.db`, LLM response/failure logs, non-incident discard log).

## Build, Test, and Development Commands
- Setup:
  - `python3 -m venv .venv && source .venv/bin/activate`
  - `pip install -r requirements.txt`
- Configure API keys:
  - `cp .env.example .env`
  - set `OPENAI_API_KEY` and `ADMIN_API_KEY` in `.env`
- Run app:
  - `python run.py`
- Trigger scrape manually:
  - `curl -X POST http://localhost:8000/api/scrape -H "x-admin-key: $ADMIN_API_KEY"`
- Start from fresh DB:
  - `rm -f data/accidents.db`
  - `rm -f data/llm_extraction_responses.log data/llm_extraction_failures.log data/non_incident_report.log`
  - `python run.py` then trigger scrape
- Quick quality checks:
  - `flake8 app/`
  - `python3 -m compileall app run.py`

## Coding Style & Naming Conventions
- Python: PEP 8, 4-space indentation, `snake_case` for functions/variables, `PascalCase` for classes.
- Keep modules focused (scraping, extraction, DB, routes separated).
- Preserve API/DB contract used by UI (do not change response shapes or required columns without coordinated update).
- Use explicit, structured logging for scraper and LLM paths.
- Keep canonical date rule: `accidents.accident_date` must come from article `published_date` (not LLM content date).
- Keep guardrails enabled: strict JSON schema, aggregate/historical filtering, non-incident/null-payload skip checks, and casualty sanity caps.

## Scraper Source Rules
- The live source is New Age's broader accident tag: `https://www.newagebd.net/tags/accident`.
- `app/config.py` stores this as `NEWS_SOURCE_ACCIDENT_URL`; `app/scraper.py` appends `?page={page}` when paginating.
- Do not revert to the older `https://www.newagebd.net/tags/Road%20accident` source; it misses newer/general accident-tag articles such as `296824`.
- Keep `MAX_PAGES` configurable through `.env`; default local pagination is `3` pages.
- Existing article URLs are skipped because `articles.url` is unique. To reprocess local data for testing, delete linked `accidents` rows before deleting the target `articles` rows.

## LLM Extraction & Discard Rules
- `articles` should store scraped source content, including editorials, reports, and non-incident stories.
- `accidents` must store only concrete accident event rows. If the LLM output or backend guardrail decides an event is editorial, research/report-style, aggregate/historical, empty/null, or not a concrete incident, skip insertion entirely.
- Do not create placeholder `accidents` rows with mostly `NULL` fields or zero casualties just to mark a discarded article.
- `app/llm/llm_extractor.py` uses `_skip_reason()` before `insert_accident(...)`; preserve this pre-insert gate when changing extraction logic.
- Skipped LLM events are written as newline-delimited JSON to `data/non_incident_report.log` with `article_id`, `published_date`, `reason`, and an event snapshot for manual QA.
- Non-incident phrase guardrails live in `app/llm/fake_data.py` as `NON_INCIDENT_PHRASES`; update that list when new report/editorial false positives are found.
- Valid multi-incident daily news should still insert one `accidents` row per concrete incident, all using the source article `published_date`.

## Testing Guidelines
- Backend tests live in `tests/` and frontend unit tests live in `frontend/src/__tests__/`.
- For each change, validate:
  - server boot,
  - one scrape cycle,
  - key APIs (`/api/overview`, `/api/daily`, `/api/map-data`),
  - UI tab smoke check.
- If adding tests, place them in `tests/` and use `test_*.py` naming.

## Commit & Pull Request Guidelines
- Branch naming:
  - `feature/*`, `fix/*`, `docs/*` (e.g., `feature/llm-parser-hardening`).
- Prefer Conventional Commit style (`feat:`, `fix:`, `docs:`).
- `main` and `dev` require PRs (no direct push).
- PRs should be focused, linked to issue/context, and pass CI checks.
- Include screenshots for UI changes and sample request/response for API-impacting changes.

## Security & Configuration Tips
- Do not commit `data/*.db`, local logs, or secrets.
- Keep OpenAI model/timeouts configurable through `app/config.py` and `.env`.
- Validate and sanitize LLM outputs before DB insertion (Pydantic schema is required).
