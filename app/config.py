"""
Configuration settings for the Traffic Insights Agent.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ─── Base Paths ────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
STATIC_DIR = os.path.join(BASE_DIR, "static")
DB_PATH = os.path.join(DATA_DIR, "accidents.db")

# ─── Scraper Settings ──────────────────────────────────────────
NEWS_SOURCE_NAME = "New Age"
NEWS_SOURCE_BASE_URL = "https://www.newagebd.net"
NEWS_SOURCE_ACCIDENT_URL = "https://www.newagebd.net/tags/Road%20accident"
SCRAPE_INTERVAL_HOURS = 6
REQUEST_TIMEOUT = 30
REQUEST_DELAY = 2
MAX_PAGES_PER_SCRAPE = 16
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# ─── NLP / Extraction Settings ─────────────────────────────────
BANGLADESH_DIVISIONS = [
    "Dhaka", "Chittagong", "Chattogram", "Rajshahi", "Khulna",
    "Barisal", "Barishal", "Sylhet", "Rangpur", "Mymensingh",
]

BANGLADESH_DISTRICTS = [
    "Barguna", "Barisal", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur",
    "Bandarban", "Brahmanbaria", "Chandpur", "Chittagong", "Chattogram", "Comilla",
    "Cumilla", "Cox's Bazar", "Feni", "Khagrachari", "Lakshmipur", "Noakhali",
    "Rangamati", "Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj",
    "Madaripur", "Manikganj", "Munshiganj", "Narayanganj", "Narsingdi", "Rajbari",
    "Shariatpur", "Tangail", "Bagerhat", "Chuadanga", "Jessore", "Jashore",
    "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira",
    "Jamalpur", "Mymensingh", "Netrokona", "Sherpur", "Bogra", "Bogura",
    "Chapainawabganj", "Joypurhat", "Naogaon", "Natore", "Nawabganj", "Pabna",
    "Rajshahi", "Sirajganj", "Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat",
    "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon", "Habiganj", "Moulvibazar",
    "Sunamganj", "Sylhet", "Tongi", "Savar", "Keraniganj", "Uttara", "Mirpur",
    "Mohammadpur", "Dhanmondi", "Gulshan", "Motijheel", "Jatrabari", "Demra",
    "Tejgaon", "Turag", "Gabtali", "Ashulia",
]

ACCIDENT_TYPES = [
    "bus accident", "bus crash", "truck accident", "truck crash",
    "car accident", "car crash", "motorcycle accident", "bike accident",
    "rickshaw accident", "auto-rickshaw accident", "cng accident",
    "train accident", "train crash", "rail accident",
    "boat accident", "boat capsize", "launch accident", "ferry accident",
    "road accident", "road crash", "highway accident",
    "hit-and-run", "hit and run",
    "collision", "head-on collision", "rear-end collision",
    "overturn", "overturned", "plunged", "fell off",
    "pile-up", "pileup",
    "pedestrian accident", "pedestrian hit",
    "bridge collapse", "vehicle fire",
]

# ─── Server Settings ───────────────────────────────────────────
API_HOST = "0.0.0.0"
API_PORT = 8000

# ─── LLM Extraction Settings ────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TIMEOUT_SECONDS = int(os.getenv("OPENAI_TIMEOUT_SECONDS", "60"))
OPENAI_RETRIES = int(os.getenv("OPENAI_RETRIES", "2"))
MAX_DEATHS_PER_EVENT = int(os.getenv("MAX_DEATHS_PER_EVENT", "50"))
MAX_INJURIES_PER_EVENT = int(os.getenv("MAX_INJURIES_PER_EVENT", "200"))

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)
