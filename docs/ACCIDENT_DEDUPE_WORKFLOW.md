# Accident Dedupe Workflow

This document explains the current accident ingestion and dedupe flow:

`Scrape -> LLM extraction -> Normalize and score -> Update existing record or insert new record`

It exists as a debugging reference for duplicate accidents, missed merges, false merges, and skipped LLM output.

## Problem

New Age can publish the same accident more than once with different wording. Examples:

- `bus-train collision at level crossing`
- `train hits bus at rail crossing`
- `auto-rickshaw crash into road divider`
- `auto-rickshaw crashed into road divider`

Before dedupe scoring became more semantic, these could look different even when they described the same incident. At the same time, the system must not merge unrelated same-district accidents just because they share deaths, vehicles, or a broad type such as `collision`.

The desired behavior is:

- Merge same real-world incidents when there is strong evidence.
- Keep separate accidents separate, especially same-district events at different locations.
- Preserve the canonical rule that `accidents.accident_date` comes from the article `published_date`, not from LLM-provided event dates.
- Never create placeholder `accidents` rows for editorials, reports, aggregate stories, outside-Bangladesh events, or empty/null LLM payloads.

## Solution Summary

The dedupe layer now uses deterministic accident-family extraction in `app/dedupe/similarity.py`.

The scorer reads local event fields only:

- `accident_type`
- `summary`
- `location_raw`

It derives family labels such as:

- `rail_crossing_collision`
- `head_on_collision`
- `pedestrian_collision`
- `vehicle_into_ditch`
- `road_divider_collision`
- `rear_end_collision`

If the current event and candidate share at least one family, the scorer adds the signal:

- `same_accident_family`

This signal is supporting evidence only. It does not replace district filtering, distinctive location overlap, vehicle overlap, casualty compatibility, road-name matching, or update wording.

Important safety rules:

- Same district remains a hard candidate filter in `app/dedupe/accident_dedupe.py`.
- `HIGH_CONFIDENCE_THRESHOLD` remains `75`.
- `AMBIGUOUS_THRESHOLD` remains `50`.
- Candidate lookup remains limited to `CANDIDATE_WINDOW_DAYS = 3`.
- Family matching alone must not cause an update.
- Generic location words such as `rail`, `railway`, `level`, and `crossing` are not enough to count as distinctive location overlap.
- District names are removed from location-overlap tokens because candidates are already filtered by district.

## End-To-End Flow

### 1. Scrape

Entry point:

- `app/scraper.py`
- `NewAgeScraper.run_scrape()`

The scraper:

1. Starts a scrape-log row through `start_scrape_log()`.
2. Fetches article links from `NEWS_SOURCE_ACCIDENT_URL`.
3. Paginates up to `MAX_PAGES_PER_SCRAPE`.
4. Skips URLs already present in `articles`.
5. Scrapes each new article page.
6. Extracts article title, URL, content, and `published_date`.
7. Inserts the raw article into `articles`.
8. Calls `AccidentExtractor.process_article(...)`.
9. Finishes the scrape-log row through `finish_scrape_log(...)`.

The scraper intentionally stores raw source articles first. Some unrelated/sidebar/latest-news articles may remain in `articles`; the LLM extraction and backend guardrails decide whether they create `accidents` rows.

### 2. LLM Extraction

Entry point:

- `app/extractor.py`
- `app/llm/llm_extractor.py`
- `LLMAccidentExtractor.process_article(...)`

The LLM receives:

- article title
- URL
- content
- article `published_date`

The LLM returns strict JSON with:

- `article_type`
- `skip_reason`
- `accidents`

Valid article classifications include:

- `daily_incident`
- `time_window_roundup`
- `non_incident_report`
- `outside_bangladesh`
- `unknown`

Discarded article types return no accident rows. These are logged to `data/non_incident_report.log`.

For `daily_incident` or usable `unknown` output, each event is validated by backend guardrails before dedupe:

- aggregate or historical language is skipped
- outside-Bangladesh events are skipped
- non-incident phrases are skipped
- empty payloads are skipped
- events without concrete incident signal are skipped
- casualty outliers are skipped

Only surviving concrete accident events are passed to dedupe.

### 3. Normalize

Entry point:

- `app/dedupe/accident_dedupe.py`
- `_normalize_event(...)`

Before scoring or insertion, the event is normalized:

- `district` is normalized through `normalize_district(...)`.
- Non-district localities such as `Tongi`, `Savar`, `Mirpur`, `Tejgaon`, and similar are rejected as districts.
- `division` is derived from district when missing.
- `latitude` and `longitude` are assigned from `DISTRICT_COORDINATES`.
- `vehicles_involved` is converted from list to comma-separated string.
- `road_name` is normalized through `normalize_road_name(...)`.
- `accident_date` is set from article `published_date`.

The LLM-provided event date is ignored for database writes.

### 4. Candidate Lookup

Entry point:

- `_candidate_accidents(...)` in `app/dedupe/accident_dedupe.py`

Candidates are loaded only when the normalized event has:

- `accident_date`
- `district`

The query requires:

- same district
- accident date within `published_date +/- 3 days`

This district filter is the first major safety guard. Events from different districts are never scored against each other.

### 5. Score

Entry point:

- `score_accident_similarity(...)` in `app/dedupe/similarity.py`

Current score signals:

| Signal | Points | Meaning |
| --- | ---: | --- |
| `same_district` | 20 | District text matches. Candidate query already enforces this for normal dedupe. |
| `same_road_name` | 25 | Normalized road names match exactly. |
| `location_overlap` | 20 | Distinctive location tokens overlap. Generic crossing/rail terms and district name do not count. |
| `vehicle_overlap` | 15 | At least one vehicle token overlaps. |
| `compatible_accident_type` | 10 | Accident type wording is text-compatible after simple morphology/synonym normalization. |
| `same_accident_family` | 10 | Deterministic family labels overlap. |
| `casualties_compatible` | 10 | New deaths/injuries are greater than or equal to candidate values. |
| `update_wording` | 15 | Title or summary has update language such as death toll rises/later died. |

The score is capped at `100`.

Accident-type compatibility recognizes simple variants and synonyms such as:

- `hit`
- `hits`
- `hit by`
- `struck`
- `rammed`
- `collided`
- `collision`
- `crash`
- `crashed`

### 6. Update Or Insert

Entry point:

- `upsert_accident_event(...)` in `app/dedupe/accident_dedupe.py`

Decision rules:

1. If best candidate score is `>= 75`, update the existing accident.
2. If best candidate score is `>= 50` and `< 75`, insert a new accident and log it as ambiguous.
3. If best candidate score is `< 50`, insert a new accident and log it as low confidence.
4. If there is no same-district candidate, insert a new accident and log that dedupe had no candidate.
5. If district is missing, insert without dedupe and log missing district.

When updating an existing accident:

- the existing accident ID is preserved
- deaths become `max(existing.deaths, new.deaths)`
- injuries become `max(existing.injuries, new.injuries)`
- `accident_date` becomes the earliest date between existing and new article published dates
- summary is updated only when the new event has higher casualties or same casualties with update wording

## What The Current Fix Solves

The accident-family fix helps merge semantically identical incident descriptions with different wording.

Positive examples:

- Cumilla rail crossing:
  - `bus-train collision at level crossing`
  - `train hits bus at rail crossing`
  - expected result: one merged row, max injuries retained

- Dhaka Tejgaon road divider:
  - `auto-rickshaw crash into road divider`
  - `auto-rickshaw crashed into road divider`
  - expected result: one merged row

Negative examples that should remain separate:

- same district + same vehicle + same deaths, but different distinctive locations
- same district + same accident family, but no distinctive location overlap

## Log Files

### `scrape_logs` table

Database table, not a file.

Used by:

- `start_scrape_log(...)`
- `finish_scrape_log(...)`

Purpose:

- records one row per scrape run
- stores start/end status
- stores article counts found and newly inserted
- powers scrape history and admin diagnostics

Use this first when checking whether a scrape cycle ran and whether it completed.

### `data/llm_extraction_responses.log`

Format:

- plain text blocks
- includes timestamp and `article_id`
- includes raw LLM response

Purpose:

- audit exactly what the LLM returned
- debug malformed JSON
- compare LLM output against backend skip/upsert behavior

Use this when an article exists but the extracted events look wrong or missing.

### `data/llm_extraction_failures.log`

Format:

- plain text blocks
- includes timestamp, stage, error, content preview, and sometimes raw response

Purpose:

- records OpenAI client errors
- records JSON parse failures
- records Pydantic validation failures
- records other extraction-stage exceptions

Use this when an article produced no events and there may have been an extraction failure.

### `data/non_incident_report.log`

Format:

- newline-delimited JSON

Purpose:

- records article-level discards
- records event-level discards
- confirms that skipped output did not create placeholder `accidents` rows

Article-level discard shape:

```json
{
  "timestamp": "...",
  "article_id": 123,
  "published_date": "2026-05-09",
  "reason": "time_window_roundup",
  "title": "...",
  "url": "...",
  "skip_reason": "...",
  "event": null
}
```

Event-level discard shape:

```json
{
  "timestamp": "...",
  "article_id": 123,
  "published_date": "2026-05-09",
  "reason": "aggregate_or_historical",
  "event": {
    "accident_type": "...",
    "location_raw": "...",
    "district": "...",
    "division": "...",
    "deaths": 0,
    "injuries": 0,
    "vehicles_involved": ["..."],
    "road_name": "...",
    "summary": "..."
  }
}
```

Common reasons:

- `time_window_roundup`
- `non_incident_report`
- `outside_bangladesh`
- `aggregate_or_historical`
- `non_incident`
- `empty_payload`
- `no_concrete_incident`
- `casualty_outlier`

Use this when a source article was scraped but no accident row should have been inserted.

### `data/dedupe/accident_update_events.log`

Format:

- newline-delimited JSON

Purpose:

- records high-confidence dedupe merges
- proves which existing accident was updated
- records score, matched signals, current event, candidate snapshot, and before/after merge result

Important fields:

- `decision`: usually `updated_existing`
- `score`
- `matched_signals`
- `current_article`
- `current_event`
- `existing_candidate`
- `merge_result.before`
- `merge_result.after`

Use this when an event merged and you need to verify why.

### `data/dedupe/accident_dedupe_ambiguity.log`

Format:

- newline-delimited JSON

Purpose:

- records events that had a possible duplicate candidate but did not reach update threshold
- these events were inserted as new rows
- useful for manual QA and future scorer tuning

Important decision:

- `inserted_ambiguous_possible_duplicate`

Use this when a likely duplicate was not merged. The matched signals show what evidence was missing.

### `data/dedupe/accident_dedupe_decisions.log`

Format:

- newline-delimited JSON

Purpose:

- records lower-confidence insert decisions
- records no-candidate inserts
- records missing-district dedupe skips

Common decisions:

- `inserted_low_confidence`
- `inserted_no_same_district_candidate`
- `inserted_dedupe_skipped_missing_district`

Use this when an event inserted as new and was not considered ambiguous.

## Debugging Checklist

When a duplicate looks wrong:

1. Confirm the article exists in `articles`.
2. Check `scrape_logs` to confirm the scrape completed.
3. Check `data/llm_extraction_responses.log` for the raw LLM event payload.
4. Check `data/non_incident_report.log` to see if the article or event was discarded.
5. Check normalized fields in `accidents`: district, road name, location, vehicles, deaths, injuries, date.
6. Check `data/dedupe/accident_update_events.log` if a merge happened.
7. Check `data/dedupe/accident_dedupe_ambiguity.log` if a possible duplicate inserted instead.
8. Check `data/dedupe/accident_dedupe_decisions.log` if it inserted with low confidence or no candidate.
9. Compare `matched_signals` against expected evidence.
10. If same-district incidents merged incorrectly, inspect whether location tokens were too generic.
11. If same incident did not merge, inspect whether family, vehicle, road name, casualties, or update wording was missing.

## Validation Commands

Use these after changing dedupe, extraction guardrails, or workflow docs:

```bash
python3 -m compileall app run.py
.venv/bin/pytest tests/test_dedupe.py tests/test_extractor.py -q
```

