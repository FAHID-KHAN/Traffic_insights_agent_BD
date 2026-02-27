"""
NLP-based accident data extractor.
Parses article text to extract structured data:
  - Accident type
  - Location (district, division)
  - Casualties (deaths, injuries)
  - Vehicles involved
  - Summary
"""
import re
import logging
from datetime import date
from typing import Optional, Dict

from app.config import BANGLADESH_DISTRICTS, BANGLADESH_DIVISIONS
from app.database import insert_accident

logger = logging.getLogger(__name__)

# ─── Approximate coordinates for map plotting ──────────────────
DISTRICT_COORDINATES = {
    "Dhaka": (23.8103, 90.4125),
    "Chittagong": (22.3569, 91.7832), "Chattogram": (22.3569, 91.7832),
    "Rajshahi": (24.3745, 88.6042),
    "Khulna": (22.8456, 89.5403),
    "Barisal": (22.7010, 90.3535), "Barishal": (22.7010, 90.3535),
    "Sylhet": (24.8949, 91.8687),
    "Rangpur": (25.7439, 89.2752),
    "Mymensingh": (24.7471, 90.4203),
    "Gazipur": (23.9999, 90.4203),
    "Narayanganj": (23.6238, 90.5000),
    "Comilla": (23.4607, 91.1809), "Cumilla": (23.4607, 91.1809),
    "Cox's Bazar": (21.4272, 92.0058),
    "Bogra": (24.8465, 89.3773), "Bogura": (24.8465, 89.3773),
    "Tangail": (24.2513, 89.9167),
    "Faridpur": (23.6070, 89.8429),
    "Jessore": (23.1665, 89.2139), "Jashore": (23.1665, 89.2139),
    "Dinajpur": (25.6279, 88.6332),
    "Brahmanbaria": (23.9571, 91.1115),
    "Sirajganj": (24.4533, 89.7001),
    "Pabna": (24.0064, 89.2372),
    "Narsingdi": (23.9322, 90.7151),
    "Manikganj": (23.8617, 90.0053),
    "Munshiganj": (23.5422, 90.5305),
    "Gopalganj": (23.0050, 89.8266),
    "Kishoreganj": (24.4449, 90.7766),
    "Noakhali": (22.8696, 91.0995),
    "Feni": (23.0159, 91.3976),
    "Chandpur": (23.2333, 90.6712),
    "Lakshmipur": (22.9425, 90.8281),
    "Habiganj": (24.3740, 91.4166),
    "Moulvibazar": (24.4829, 91.7774),
    "Sunamganj": (25.0658, 91.3950),
    "Kushtia": (23.9013, 89.1200),
    "Satkhira": (22.7185, 89.0714),
    "Bagerhat": (22.6510, 89.7897),
    "Natore": (24.4206, 89.0000),
    "Naogaon": (24.7936, 88.9318),
    "Chapainawabganj": (24.5965, 88.2775),
    "Joypurhat": (25.0968, 89.0227),
    "Panchagarh": (26.3334, 88.5556),
    "Thakurgaon": (26.0336, 88.4616),
    "Nilphamari": (25.9310, 88.8560),
    "Lalmonirhat": (25.9174, 89.4445),
    "Kurigram": (25.8054, 89.6362),
    "Gaibandha": (25.3288, 89.5286),
    "Sherpur": (25.0200, 90.0132),
    "Netrokona": (24.8700, 90.7278),
    "Jamalpur": (24.9375, 89.9372),
    "Pirojpur": (22.5841, 89.9750),
    "Jhalokati": (22.6406, 90.1987),
    "Barguna": (22.1510, 90.1266),
    "Patuakhali": (22.3596, 90.3299),
    "Bhola": (22.6859, 90.6482),
    "Bandarban": (22.1953, 92.2184),
    "Khagrachari": (23.1193, 91.9847),
    "Rangamati": (22.7324, 92.2985),
    "Chuadanga": (23.6402, 88.8420),
    "Jhenaidah": (23.5448, 89.1539),
    "Meherpur": (23.7627, 88.6318),
    "Narail": (23.1725, 89.5127),
    "Magura": (23.4878, 89.4199),
    "Rajbari": (23.7574, 89.6445),
    "Shariatpur": (23.2423, 90.4348),
    "Madaripur": (23.1641, 90.1978),
    "Tongi": (23.8783, 90.4008),
    "Savar": (23.8583, 90.2667),
    "Keraniganj": (23.7000, 90.3500),
    "Uttara": (23.8750, 90.3950),
    "Mirpur": (23.8042, 90.3667),
    "Mohammadpur": (23.7650, 90.3589),
    "Dhanmondi": (23.7461, 90.3742),
    "Gulshan": (23.7925, 90.4078),
    "Motijheel": (23.7333, 90.4167),
    "Jatrabari": (23.7100, 90.4333),
    "Demra": (23.7167, 90.4833),
    "Tejgaon": (23.7636, 90.3933),
    "Turag": (23.8750, 90.3800),
    "Gabtali": (23.8167, 90.3500),
    "Ashulia": (23.8833, 90.3167),
}

# ─── Division look-up ──────────────────────────────────────────
_DIVISION_MAP = {
    "Dhaka": [
        "Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj",
        "Madaripur", "Manikganj", "Munshiganj", "Narayanganj",
        "Narsingdi", "Rajbari", "Shariatpur", "Tangail", "Tongi",
        "Savar", "Keraniganj", "Uttara", "Mirpur", "Mohammadpur",
        "Dhanmondi", "Gulshan", "Motijheel", "Jatrabari", "Demra",
        "Tejgaon", "Turag", "Gabtali", "Ashulia",
    ],
    "Chittagong": [
        "Chittagong", "Chattogram", "Comilla", "Cumilla",
        "Cox's Bazar", "Feni", "Brahmanbaria", "Chandpur",
        "Lakshmipur", "Noakhali", "Khagrachari", "Bandarban", "Rangamati",
    ],
    "Rajshahi": [
        "Rajshahi", "Bogra", "Bogura", "Chapainawabganj",
        "Joypurhat", "Naogaon", "Natore", "Nawabganj", "Pabna", "Sirajganj",
    ],
    "Khulna": [
        "Khulna", "Bagerhat", "Chuadanga", "Jessore", "Jashore",
        "Jhenaidah", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira",
    ],
    "Barisal": [
        "Barisal", "Barishal", "Barguna", "Bhola",
        "Jhalokati", "Patuakhali", "Pirojpur",
    ],
    "Sylhet": ["Sylhet", "Habiganj", "Moulvibazar", "Sunamganj"],
    "Rangpur": [
        "Rangpur", "Dinajpur", "Gaibandha", "Kurigram",
        "Lalmonirhat", "Nilphamari", "Panchagarh", "Thakurgaon",
    ],
    "Mymensingh": ["Mymensingh", "Jamalpur", "Netrokona", "Sherpur"],
}


class AccidentExtractor:
    """Extracts structured accident data from article text using NLP / regex."""

    def process_article(self, article_id: int, content: str,
                        published_date: date = None) -> Optional[int]:
        """Process article content and insert extracted accident data."""
        if not content or len(content) < 50:
            logger.warning(f"Article {article_id}: Content too short")
            return None

        accident_keywords = [
            "killed", "died", "dead", "death", "injured",
            "accident", "crash", "collision", "overturn",
            "hit", "struck", "plunged", "crushed", "drowned",
            "capsize", "derail",
        ]
        if not any(kw in content.lower() for kw in accident_keywords):
            logger.info(f"Article {article_id}: Not accident-related, skipping")
            return None

        accident_type = self._extract_accident_type(content)
        location = self._extract_location(content)
        casualties = self._extract_casualties(content)
        vehicles = self._extract_vehicles(content)
        summary = self._generate_summary(content)

        lat, lon = None, None
        district = location.get("district")
        if district and district in DISTRICT_COORDINATES:
            lat, lon = DISTRICT_COORDINATES[district]

        accident_id = insert_accident(
            article_id=article_id,
            accident_type=accident_type,
            location_raw=location.get("raw", ""),
            district=district,
            division=location.get("division"),
            latitude=lat, longitude=lon,
            deaths=casualties.get("deaths", 0),
            injuries=casualties.get("injuries", 0),
            vehicles_involved=vehicles,
            accident_date=published_date,
            summary=summary,
        )
        logger.info(
            f"Extracted accident #{accident_id} from article #{article_id}: "
            f"type={accident_type}, loc={district}, "
            f"deaths={casualties.get('deaths', 0)}, injuries={casualties.get('injuries', 0)}"
        )
        return accident_id

    # ── private helpers ─────────────────────────────────────────

    def _extract_accident_type(self, content: str) -> str:
        cl = content.lower()
        type_priority = [
            ("train accident", ["train accident", "train crash", "rail accident", "derail", "train collid"]),
            ("boat accident", ["boat capsize", "boat sank", "launch capsize", "launch accident", "ferry accident", "boat accident", "trawler capsize"]),
            ("hit-and-run", ["hit-and-run", "hit and run", "fled the scene", "fled after hitting"]),
            ("head-on collision", ["head-on collision", "head on collision", "head-on crash"]),
            ("bus accident", ["bus accident", "bus crash", "bus overturn", "bus collid", "bus fell", "bus plunge"]),
            ("truck accident", ["truck accident", "truck crash", "truck overturn", "truck collid", "covered van"]),
            ("motorcycle accident", ["motorcycle accident", "motorbike", "bike accident", "motorcycle crash", "bike crash"]),
            ("auto-rickshaw accident", ["auto-rickshaw", "cng", "three-wheeler", "auto rickshaw"]),
            ("rickshaw accident", ["rickshaw accident", "rickshaw crash", "van puller"]),
            ("car accident", ["car accident", "car crash", "private car", "microbus", "sedan"]),
            ("pedestrian accident", ["pedestrian", "walking", "crossing the road", "hit while crossing"]),
            ("vehicle fire", ["vehicle fire", "caught fire", "bus fire", "truck fire"]),
            ("road accident", ["road accident", "road crash", "highway accident", "highway crash"]),
            ("collision", ["collision", "collided", "crashed into"]),
            ("overturn", ["overturn", "overturned", "fell off", "plunged"]),
        ]
        for type_name, keywords in type_priority:
            if any(kw in cl for kw in keywords):
                return type_name
        return "road accident"

    def _extract_location(self, content: str) -> Dict:
        result: Dict = {"raw": "", "district": None, "division": None}

        found_districts = []
        for district in BANGLADESH_DISTRICTS:
            if re.search(r"\b" + re.escape(district) + r"\b", content, re.IGNORECASE):
                found_districts.append(district)

        if found_districts:
            specific = [d for d in found_districts if d not in BANGLADESH_DIVISIONS]
            result["district"] = specific[0] if specific else found_districts[0]

        for division in BANGLADESH_DIVISIONS:
            if re.search(r"\b" + re.escape(division) + r"\b", content, re.IGNORECASE):
                result["division"] = division
                break

        if result["district"] and not result["division"]:
            result["division"] = self._district_to_division(result["district"])

        location_patterns = [
            r"(?:in|at|near|on|from)\s+([A-Z][a-zA-Z\s]+(?:highway|road|bridge|area|district|upazila|union|village|town|city))",
            r"([A-Z][a-zA-Z]+\s+(?:highway|expressway|bridge|road))",
            r"(?:on the|on a)\s+([A-Z][a-zA-Z\s-]+)\s+(?:highway|road|bridge)",
        ]
        for pattern in location_patterns:
            match = re.search(pattern, content)
            if match:
                result["raw"] = match.group(1).strip()
                break

        if not result["raw"] and result["district"]:
            result["raw"] = result["district"]
        return result

    @staticmethod
    def _district_to_division(district: str) -> Optional[str]:
        for division, districts in _DIVISION_MAP.items():
            if district in districts:
                return division
        return None

    def _extract_casualties(self, content: str) -> Dict:
        deaths, injuries = 0, 0
        cl = content.lower()

        word_to_num = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
            "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
            "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40,
            "fifty": 50, "a": 1, "an": 1, "several": 3, "many": 5,
            "dozens": 24, "hundreds": 100,
        }
        num = (
            r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten|"
            r"eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|"
            r"eighteen|nineteen|twenty|thirty|forty|fifty|a|an|several|many|dozens)"
        )

        for pattern in [
            rf"({num})\s+(?:people\s+)?(?:were\s+)?(?:killed|died|dead|perished|lost (?:their|his|her) lives?)",
            rf"(?:killed|claimed the lives? of|death toll[:\s]+)\s*({num})",
            rf"({num})\s+(?:people\s+)?(?:death|fatalities|casualties)",
            rf"(?:at least\s+)?({num})\s+(?:people\s+)?(?:were\s+)?killed",
            rf"killing\s+(?:at least\s+)?({num})",
        ]:
            for m in re.findall(pattern, cl):
                ns = m if isinstance(m, str) else m[0]
                n = word_to_num.get(ns)
                if n is None:
                    try:
                        n = int(ns)
                    except ValueError:
                        n = 0
                deaths = max(deaths, n)

        for pattern in [
            rf"({num})\s+(?:people\s+)?(?:were\s+)?(?:injured|hurt|wounded|hospitalized|hospitalised)",
            rf"(?:injuring|injured)\s+(?:at least\s+)?({num})",
            rf"({num})\s+(?:others?\s+)?(?:were\s+)?injured",
        ]:
            for m in re.findall(pattern, cl):
                ns = m if isinstance(m, str) else m[0]
                n = word_to_num.get(ns)
                if n is None:
                    try:
                        n = int(ns)
                    except ValueError:
                        n = 0
                injuries = max(injuries, n)

        return {"deaths": deaths, "injuries": injuries}

    @staticmethod
    def _extract_vehicles(content: str) -> Optional[str]:
        cl = content.lower()
        vehicles = [
            ("bus", ["bus", "buses"]),
            ("truck", ["truck", "lorry", "covered van"]),
            ("car", ["car", "private car", "sedan"]),
            ("microbus", ["microbus", "micro bus"]),
            ("motorcycle", ["motorcycle", "motorbike", "bike"]),
            ("auto-rickshaw", ["auto-rickshaw", "cng", "three-wheeler", "auto rickshaw"]),
            ("rickshaw", ["rickshaw", "easy bike"]),
            ("train", ["train"]),
            ("boat", ["boat", "launch", "ferry", "trawler"]),
            ("pickup", ["pickup", "pick-up"]),
            ("ambulance", ["ambulance"]),
        ]
        found = [name for name, kws in vehicles if any(kw in cl for kw in kws)]
        return ", ".join(found) if found else None

    @staticmethod
    def _generate_summary(content: str, max_length: int = 200) -> str:
        sentences = re.split(r"(?<=[.!?])\s+", content)
        summary = ""
        for s in sentences[:3]:
            if len(summary) + len(s) <= max_length:
                summary += s + " "
            else:
                break
        return summary.strip() or content[:max_length].strip()


def reprocess_all_articles():
    """Re-process all existing articles through the extractor."""
    from app import database as db
    conn = db.get_connection()
    articles = conn.execute("SELECT id, content, published_date FROM articles").fetchall()
    conn.close()

    extractor = AccidentExtractor()
    processed = 0
    for article in articles:
        pub_date = None
        if article["published_date"]:
            from datetime import datetime
            try:
                pub_date = datetime.strptime(article["published_date"], "%Y-%m-%d").date()
            except (ValueError, TypeError):
                pub_date = None
        if extractor.process_article(article["id"], article["content"], pub_date):
            processed += 1

    logger.info(f"Reprocessed {processed}/{len(articles)} articles")
    return processed
