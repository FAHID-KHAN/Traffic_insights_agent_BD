# Future Feature Improvements

## LLM Extraction Accuracy Checks

Planned validation layers to add to `app/llm/llm_extractor.py` before DB insertion:

- **Confidence threshold** — Reject events with LLM confidence < 0.4
- **Ghost event filter** — Reject events with no district/location AND no casualties/summary
- **Summary sanity** — Reject summaries < 10 chars; truncate > 300 chars
- **Casualty cross-validation** — Verify death/injury counts actually appear in the article text (numeric or word-form); clamp hallucinated numbers to 0
- **Accident type normalization** — Fuzzy-match against the known types list in `app/config.py`; standardize casing
- **District-division consistency** — Always derive division from district via `app/geo.py` mapping instead of trusting LLM output
- **Duplicate event detection** — Dedup events within the same article by (district, type, deaths, injuries) signature
- **Per-article event cap** — Limit to 8 events per article to prevent runaway extraction

## Multi-Source Scraping

- Add Daily Star, Dhaka Tribune, and Prothom Alo English as additional news sources
- Cross-validate incidents across sources for higher confidence
- Dedup articles that cover the same accident from different outlets

## Natural Language Query (Ask the Data)

- Chat box where users type questions like "How many people died in Chittagong this year?"
- LLM converts natural language → SQL → runs query → formats response
- Leverages existing OpenAI integration

## Push Alerts / Notification System

- Let users subscribe to alerts for their district or division
- Browser push notifications or email on high-severity incidents
- Useful for commuters, logistics companies, parents

## Automated PDF Report Generation

- Monthly/yearly downloadable PDF reports with key stats, charts, and trend summaries
- Auto-generated on the 1st of each month
- Target audience: government agencies, NGOs, researchers
