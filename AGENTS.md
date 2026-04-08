# Repository Guidelines

## Project Structure & Module Organization
- `run.py`: local entry point (`uvicorn` app loader).
- `app/`: backend code.
- `app/scraper.py`: Daily Star scraping pipeline.
- `app/llm/`: OpenAI integration (`openai_client.py`, `llm_schema.py`, `llm_extractor.py`).
- `app/database.py`: SQLite schema and query helpers.
- `app/routes.py`: FastAPI API endpoints.
- `app/geo.py`, `app/normalize.py`: district normalization, division mapping, coordinates.
- `static/`: frontend assets (`index.html`, `js/`, `css/`).
- `data/`: runtime artifacts (`accidents.db`, LLM response/failure logs).

## Build, Test, and Development Commands
- Setup:
  - `python3 -m venv .venv && source .venv/bin/activate`
  - `pip install -r requirements.txt`
- Configure API key:
  - `cp .env.example .env`
  - set `OPENAI_API_KEY` in `.env`
- Run app:
  - `python run.py`
- Trigger scrape manually:
  - `curl -X POST http://localhost:8000/api/scrape`
- Start from fresh DB:
  - `rm -f data/accidents.db`
  - `rm -f data/llm_extraction_responses.log data/llm_extraction_failures.log`
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
- Keep guardrails enabled: strict JSON schema, aggregate/historical filtering, and casualty sanity caps.

## Testing Guidelines
- There is currently no dedicated `tests/` suite.
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
