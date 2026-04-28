### Need to discard these articles as they do not have daily accident news:

- Pedestrian fatalities dominate Dhaka road deaths: report
- Minister’s denial can’t hide road safety crisis
- 619 people killed in road accidents across Bangladesh in March: report
- 20 people killed daily in road accidents during Eid: report
- Eid-time road deaths 351
- 13 killed in road accidents in 2 days
- Pry scholarship exams start in 61 dists

These articles should not create `accidents` rows. The LLM receives both the article title and content, classifies article-level roundups as `time_window_roundup`, classifies non-accident/report/editorial articles as `non_incident_report`, and logs discarded articles to `data/non_incident_report.log`.

Foreign accident reports should also not create `accidents` rows. The LLM/backend should classify article-level or event-level accidents outside Bangladesh as `outside_bangladesh` and log them to `data/non_incident_report.log`.

### Handle the edge cases:

These edge cases needs to be handled carefully. If one article covers 2 or more locations and seperate accident incidents, each should be created as new accident record in DB with the same published date as accident date.

**Samples**
- Four killed in road accidents in Dhaka
- Three killed in Cox’s Bazar road accidents
- 9 killed in road accidents in 3 districts

LLM, while going through the article content, need to understand if the news is for one insident or multiple insidents combind. If there are multiple insidents, then create seperate records for each one in the accident db with the same published article date as accident date.

Discarded LLM articles/events must not create placeholder rows in `accidents`. They should be logged to `data/non_incident_report.log` with the skip reason, title/URL for article-level discards, and event snapshot for event-level discards. Valid discard reasons include `time_window_roundup`, `non_incident_report`, `outside_bangladesh`, empty/null payloads, aggregate summaries, and casualty outliers.
