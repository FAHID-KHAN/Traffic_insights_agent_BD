### Need to discard these artilces as they don't have daily accident news: 

- Pedestrian fatalities dominate Dhaka road deaths: report
- Minister’s denial can’t hide road safety crisis
- 619 people killed in road accidents across Bangladesh in March: report
- 20 people killed daily in road accidents during Eid: report
- Eid-time road deaths 351


### Handle the edge cases:

These edge cases needs to be handled carefully. If one article covers 2 or more locations and seperate accident incidents, each should be created as new accident record in DB with the same published date as accident date.

**Samples**
- Four killed in road accidents in Dhaka
- Three killed in Cox’s Bazar road accidents
- 9 killed in road accidents in 3 districts

LLM, while going through the article content, need to understand if the news is for one insident or multiple insidents combind. If there are multiple insidents, then create seperate records for each one in the accident db with the same published article date as accident date.