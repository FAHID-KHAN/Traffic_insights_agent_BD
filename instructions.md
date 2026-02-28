# Codex Instructions — Replace Regex Extraction with Ollama (Llama 3.2) While Keeping UI + DB Contract

This repo currently:
- Scrapes Daily Star articles.
- Inserts the article into `articles`.
- Runs `app/extractor.py` (regex) to extract one accident per article and inserts into `accidents`.
- UI + APIs read from SQLite and **must remain unchanged**.

Goal:
- Keep **all existing DB schema + queries** and **all UI behavior** unchanged.
- Keep hard-coded **district coordinates** and **division mapping** from `app/extractor.py`.
- Replace regex extraction with an LLM-based extractor using **Ollama Llama 3.2**.
- Support **multiple accidents inside one article** (LLM returns a list; insert multiple rows for one `article_id`).

References:
- Current extractor flow and coordinate lookup live in `app/extractor.py`. 
- DB insert contract is `insert_accident(...)` in `app/database.py`.

---

## 0) Clarifications to confirm (leave TODO markers until answered)

1. **Ollama model name** you will use (exact): e.g. `llama3.2` or `llama3.2:latest`.
2. Do you want to **store the LLM raw JSON response** for debugging (recommended)? If yes, we add a new table or log file.
3. If article contains **multiple accidents on different dates**, should we store each event’s `accident_date` (preferred), or always use `published_date`?
4. If the LLM cannot confidently pick a district, should we:
   - (A) insert the accident row with `district=NULL` (no map marker), or
   - (B) still insert with best guess (not recommended), or
   - (C) skip inserting that event?

Proceed with defaults in this doc:
- model: `llama3.2`
- store no raw JSON in DB (log it)
- accident_date: event date if present else published_date
- district unknown: insert row with `district=NULL` and `lat/lon=NULL`

---

## 1) Design constraints we must preserve

### DB contract (do not change)
`accidents` table columns must be filled as before:
- `article_id`, `accident_type`, `location_raw`, `district`, `division`, `latitude`, `longitude`, `deaths`, `injuries`, `vehicles_involved`, `accident_date`, `summary`.

This contract is used by existing query methods in `app/database.py`.

### Coordinates must come from existing mapping
- Keep `DISTRICT_COORDINATES` in `app/extractor.py`.
- Do **not** ask the LLM for lat/lon.
- LLM must output a district string that matches keys in `DISTRICT_COORDINATES`.

### Multiple accidents per article
- One article row in `articles`.
- Many rows in `accidents` can reference the same `article_id`.

---

## 2) Implementation plan (high-level)

1. **Extract geo constants** (optional but recommended): Move `DISTRICT_COORDINATES` and `_DIVISION_MAP` into a small module to avoid circular imports.
2. Add `llm/ollama_client.py`: tiny wrapper around Ollama HTTP API (`http://localhost:11434`).
3. Add `llm/llm_schema.py`: Pydantic models to validate the LLM output.
4. Add `llm/llm_extractor.py`: new extractor that calls Ollama and returns `List[AccidentEvent]`.
5. Update the pipeline (where `AccidentExtractor.process_article(...)` is used) to instead call the LLM extractor and **insert multiple accidents**.
6. Keep the UI endpoints and DB queries unchanged.

---

## 3) Step-by-step tasks for Codex

### Task A — Create `llm/ollama_client.py`

Implement a minimal Ollama chat client using `requests`.

Requirements:
- Uses endpoint: `POST http://localhost:11434/api/chat`
- Body fields:
  - `model`: TODO (default `llama3.2`)
  - `messages`: list of `{role, content}`
  - `format`: `"json"` (forces JSON-only output if supported)
  - `options`: set `temperature: 0` for stability
  - `stream`: false

Return:
- The assistant message content as a string.

Add timeouts and basic retry (2 retries).

### Task B — Create `llm/llm_schema.py`

Define Pydantic models:

- `AccidentEvent`
  - `accident_type: str | None`
  - `location_raw: str | None`
  - `district: str | None`
  - `division: str | None`
  - `deaths: int` (>= 0)
  - `injuries: int` (>= 0)
  - `vehicles_involved: list[str] | None`
  - `accident_date: str | None`  # ISO `YYYY-MM-DD`
  - `summary: str | None`
  - `confidence: float | None`   # optional

- `ExtractionResult`
  - `accidents: list[AccidentEvent]`

Validation rules:
- Clamp negative deaths/injuries to 0.
- Strip whitespace.

### Task C — Create `llm/llm_extractor.py`

Implement `LLMAccidentExtractor` with:

- `extract_events(content: str, published_date: date | None) -> list[AccidentEvent]`

Prompting rules:
- Provide the list of allowed districts (from `app.config.BANGLADESH_DISTRICTS`).
- Instruct model:
  - Return **only** JSON for `ExtractionResult`.
  - `district` must be one of the allowed district strings. If unsure, return `null`.
  - If multiple accidents are described, return multiple entries.
  - Do not invent numbers; if unclear, return 0 and lower confidence.
  - `accident_date` should be an ISO date if explicitly present; else `null`.
  - `vehicles_involved` should be an array of canonical vehicle tokens (bus, truck, car, motorcycle, train, boat, etc.).

Implementation details:
- Build system + user messages.
- Call `ollama_client.chat_json(...)`.
- Parse JSON → `ExtractionResult`.
- If parsing fails, log and return empty list.

### Task D — Keep coordinate mapping from extractor.py

We need to convert `district -> (lat, lon)` using existing constants.

Recommended refactor to avoid importing the old extractor class:

1) Create `app/geo.py` and move:
- `DISTRICT_COORDINATES`
- `_DIVISION_MAP`
- helper `district_to_division(district: str) -> str | None`

Then:
- `extractor.py` imports from `app.geo`.
- `llm_extractor.py` imports from `app.geo`.

If you prefer not to refactor, you may import `DISTRICT_COORDINATES` and `_DIVISION_MAP` from `app.extractor`, but beware circular imports if `app.extractor` imports DB and the LLM extractor imports DB.

### Task E — Update insertion logic to insert a LIST of accidents

Currently `AccidentExtractor.process_article(...)` inserts **one** accident row per article.

Change the pipeline so it does:

1) Get events = `LLMAccidentExtractor.extract_events(content, published_date)`.
2) For each event:
   - `district = normalize_district(event.district)`
   - `division = event.division or district_to_division(district)`
   - `lat, lon = DISTRICT_COORDINATES.get(district, (None, None))`
   - `vehicles_involved = ', '.join(event.vehicles_involved) if list else event.vehicles_involved`
   - `accident_date = parse(event.accident_date) if present else published_date`
   - call `insert_accident(...)`

Return:
- list of inserted accident IDs (or count)

Important:
- Do not break existing routes: routes likely expect extraction returns something truthy. If needed, return `count > 0`.

### Task F — Normalization helpers

Create `app/normalize.py`:
- `normalize_district(name: str | None) -> str | None`
  - strip
  - title-case
  - alias mapping examples:
    - `Chittagong` ↔ `Chattogram`
    - `Comilla` ↔ `Cumilla`
    - `Barisal` ↔ `Barishal`
    - `Bogra` ↔ `Bogura`
    - `Jessore` ↔ `Jashore`
  - ensure the final value exists in `DISTRICT_COORDINATES` or in `BANGLADESH_DISTRICTS`; else return None.

---

## 4) Exact JSON format the LLM must return

The model must output ONLY JSON, no markdown.

Example:

```json
{
  "accidents": [
    {
      "accident_type": "bus accident",
      "location_raw": "on the Dhaka-Mymensingh highway in Gazipur",
      "district": "Gazipur",
      "division": "Dhaka",
      "deaths": 3,
      "injuries": 12,
      "vehicles_involved": ["bus", "truck"],
      "accident_date": "2026-02-27",
      "summary": "A bus collided with a truck...",
      "confidence": 0.82
    },
    {
      "accident_type": "motorcycle accident",
      "location_raw": "near Tongi",
      "district": "Tongi",
      "division": "Dhaka",
      "deaths": 1,
      "injuries": 0,
      "vehicles_involved": ["motorcycle"],
      "accident_date": null,
      "summary": "A separate crash involved...",
      "confidence": 0.55
    }
  ]
}
```

Notes:
- `district` must match your mapping keys so coordinates can be attached.
- If `accident_date` is null, code should fall back to article `published_date`.

---

## 5) Where to wire this in the code

Search for where the scraper calls the extractor.

Typical pattern in this repo:
- Scraper inserts article via `insert_article(...)`.
- Then calls `AccidentExtractor().process_article(article_id, content, published_date)`.

Replace with:
- `LLMAccidentExtractor().process_article(article_id, content, published_date)`

Implementation option:
- Keep the same class name `AccidentExtractor`, but change its internals to call LLM and loop insert.
- Or create a new class `LLMAccidentExtractor` and switch import usage.

Prefer: new class + feature flag.

---

## 6) Feature flag (recommended)

Add to `app/config.py`:

- `USE_LLM_EXTRACTION = True`
- `OLLAMA_MODEL = "llama3.2"`


---

## 7) Testing checklist

1) Unit test with a known article text:
- Contains multiple accidents → ensure multiple rows inserted.

2) DB validation:
- Confirm `accident_date` is not null for inserted rows (unless you allow null). Many queries depend on `accident_date`.

3) Map validation:
- Confirm `latitude/longitude` populated when district recognized.
- Confirm `/api/map-data` still returns points.

4) Dashboard:
- Overview totals match inserted records.
- Daily/monthly breakdown works.

5) Error handling:
- If Ollama is not running, extraction should fail gracefully (no crash), log error, and continue scraping.

---

## 8) Suggested prompts (copy/paste)

### System message

"""You are an information extraction engine. Extract road-accident events from a news article.
Return ONLY valid JSON matching the given schema. Do not include markdown.
Do not invent facts. If a field is not stated, use null (or 0 for counts).
If multiple accidents are described, return multiple entries."""

### User message template

Include:
- article published date
- the list of allowed districts (or tell it to pick from the provided list)
- article content

"""Published date: {published_date}

Allowed districts (must choose exactly one or null): {district_list}

Task:
Extract accident events into JSON. Each event should include:
- accident_type
- location_raw
- district (one of allowed list or null)
- division (optional; if unknown leave null)
- deaths (int)
- injuries (int)
- vehicles_involved (array of strings)
- accident_date (YYYY-MM-DD if explicitly stated else null)
- summary (<= 200 chars)

Article:
{content}
"""

---

## 9) Important notes about accuracy

- LLMs can hallucinate. Always enforce:
  - temperature=0
  - strict JSON parsing
  - district allow-list
  - sanity checks on deaths/injuries

- Keep `summary` short (your UI expects a short tooltip-like text).

---

## 10) Deliverables checklist for Codex PR

- [ ] `llm/ollama_client.py`
- [ ] `llm/llm_schema.py`
- [ ] `llm/llm_extractor.py`
- [ ] `app/normalize.py`
- [ ] (Optional) `app/geo.py` refactor, update imports in `extractor.py`
- [ ] Pipeline updated to insert **multiple** accidents per article
- [ ] Config feature flag
- [ ] Basic test script (optional): `python -m app.llm_extractor --sample sample_article.txt`

