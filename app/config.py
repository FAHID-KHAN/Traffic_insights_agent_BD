"""
Configuration settings for the Traffic Insights Agent.
Supports dev / prod environments via APP_ENV environment variable.
"""
import os
from dotenv import load_dotenv

# Load the repository .env so settings work regardless of working directory.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# ─── Environment ───────────────────────────────────────────────
APP_ENV = os.getenv("APP_ENV", "development")       # "development" | "production"
DEBUG = APP_ENV == "development"
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG" if DEBUG else "WARNING")

# ─── Base Paths ────────────────────────────────────────────────
DATA_DIR = os.getenv("DATA_DIR", os.path.join(BASE_DIR, "data"))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DB_PATH = os.getenv("DB_PATH", os.path.join(DATA_DIR, "accidents.db"))

# ─── Scraper Settings ──────────────────────────────────────────
NEWS_SOURCE_NAME = "New Age"
NEWS_SOURCE_BASE_URL = "https://www.newagebd.net"
NEWS_SOURCE_ACCIDENT_URL = "https://www.newagebd.net/tags/Road%20accident"
SCRAPE_INTERVAL_HOURS = int(os.getenv("SCRAPE_INTERVAL_HOURS", "24"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
REQUEST_DELAY = int(os.getenv("REQUEST_DELAY", "2"))
MAX_PAGES_PER_SCRAPE = int(os.getenv("MAX_PAGES", "3"))
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

# ─── Server Settings ───────────────────────────────────────────
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
WEB_WORKERS = int(os.getenv("WEB_WORKERS", "1" if DEBUG else "4"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")   # comma-separated in prod

# ─── LLM Extraction Settings ────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TIMEOUT_SECONDS = int(os.getenv("OPENAI_TIMEOUT_SECONDS", "60"))
OPENAI_RETRIES = int(os.getenv("OPENAI_RETRIES", "2"))
MAX_DEATHS_PER_EVENT = int(os.getenv("MAX_DEATHS_PER_EVENT", "50"))
MAX_INJURIES_PER_EVENT = int(os.getenv("MAX_INJURIES_PER_EVENT", "200"))

os.makedirs(DATA_DIR, exist_ok=True)
