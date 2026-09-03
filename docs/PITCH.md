# Traffic Insight BD — Partner Pitch

> **Live platform:** https://trafficinsightbd.org

---

## The Problem

Bangladesh loses **over 7,000 lives** to road accidents every year — one of the highest road fatality rates in Asia. Yet no centralised, structured, real-time database of these incidents exists.

Accident reports are scattered across dozens of newspaper editions, published in Bangla and English, read once and forgotten. Researchers manually read articles. Policymakers lack evidence to target interventions. Journalists cannot identify patterns or emerging hotspots. The data exists — it just isn't accessible.

---

## What We Built

**Traffic Insight BD** is an AI-powered platform that automatically reads every road accident report published by leading Bangladeshi newspapers and converts unstructured text into structured, searchable intelligence.

**How it works:**
1. A scanner monitors New Age Bangladesh around the clock
2. Each article is processed by a GPT-4 pipeline that extracts: accident type, location (mapped to Bangladesh's 64 districts), casualties, vehicles involved, road name, and time of occurrence
3. A deduplication engine ensures each real-world accident is counted once — even when covered by multiple articles
4. Data is stored, aggregated, and served through an interactive dashboard and API

---

## The Data

| Metric | Value |
|---|---|
| Accident records | **862** |
| Deaths tracked | **1,642** |
| Injuries tracked | **2,575** |
| Articles processed | **638** |
| Districts covered | **64 / 64** |
| Data range | April 2024 — present |
| Update frequency | Every 6 hours (automated) |

Every record includes: district, division, accident type, vehicle types, road/highway name, death count, injury count, and — where stated in the article — exact time of occurrence.

---

## What the Platform Offers

- **Interactive dashboard** — accident trends, danger zone maps, district deep-dives, year-over-year comparisons
- **Time-of-day analysis** — when do accidents happen most (dawn, morning, night)
- **Road & highway rankings** — most dangerous roads by fatality rate
- **Geographic clustering** — which regions of Bangladesh have the densest accident concentration
- **Accident cluster detection** — districts with repeat incidents within a 7-day window
- **CSV and PDF export** — filtered data ready for reports and presentations
- **REST API** — programmatic access for integration into your own tools and research pipelines

---

## Why Now

- Road accident data in Bangladesh has never been systematically collected in real time
- AI makes it possible to do this at scale and low cost — what previously required a research team of 10 can now run automatically
- The platform is live, battle-tested, and already tracking data across all 64 districts

---

## What We're Looking For

We are open to three types of partnerships:

**1. Data Partnership**
Your organisation gets full API access and monthly data exports. In return: a co-branding acknowledgement and a testimonial we can use in future outreach. Ideal for research institutes and NGOs.

**2. Paid Data Access**
Monthly subscription for CSV exports, PDF reports, and API access. Pricing tailored to organisation size and use case.

**3. Grant / Project Funding**
We are open to conversations about incorporating Traffic Insight BD into a funded road safety research project. We can provide the data infrastructure; your organisation provides domain expertise and outreach.

---

## Who This Is For

- Road safety NGOs (Road Safety Foundation, Nirapad Sarak Chai)
- Research institutes (BRAC Institute for Governance, BUET Accident Research Institute)
- Journalism outlets with data desks (Prothom Alo, The Daily Star, New Age)
- Government bodies (BRTA, Ministry of Road Transport)
- International organisations active in Bangladesh (WHO, UNDP, World Bank)

---

## The Team

**Fahid Khan** — Software Engineer. Built the platform infrastructure, backend API, interactive dashboard, and deployment pipeline.

**Rafeed Chowdhury** — AI Software Developer. Designed the GPT-4 extraction pipeline, deduplication system, and data validation architecture.

---

## Get In Touch

**Platform:** https://trafficinsightbd.org  
**Email:** fahidkhan1999.fk@gmail.com

We are happy to arrange a 20-minute walkthrough of the platform, share a sample dataset, or discuss how the data can serve your specific research or reporting needs.
