"""
Shared pytest fixtures.
Creates a temporary SQLite DB for each test session so tests never
touch production data.
"""
import os
import pytest
import tempfile

# Override DB_PATH before any app module is imported
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DB_PATH"] = _tmp.name
_tmp.close()

from app import database as db  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_db():
    """Re-initialise the database before every test."""
    db.init_db()
    yield
    # Wipe tables after each test
    with db.get_db() as conn:
        conn.execute("DELETE FROM accidents")
        conn.execute("DELETE FROM articles")
        conn.execute("DELETE FROM scrape_logs")
