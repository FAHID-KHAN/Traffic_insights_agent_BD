#!/usr/bin/env python3
"""Entry point – run the Traffic Insights Bangladesh server."""

from pathlib import Path

import uvicorn
from app.server import create_app
from app.config import API_HOST, API_PORT, DEBUG


app = create_app()
BASE_DIR = Path(__file__).resolve().parent

if __name__ == "__main__":
    uvicorn_kwargs = {
        "host": API_HOST,
        "port": API_PORT,
        "reload": DEBUG,
        "log_level": "debug" if DEBUG else "warning",
    }

    if DEBUG:
        uvicorn_kwargs.update(
            {
                "reload_dirs": [
                    str(BASE_DIR / "app"),
                    str(BASE_DIR / "tests"),
                ],
                "reload_includes": ["*.py"],
                "reload_excludes": [
                    ".git/*",
                    ".venv/*",
                    "__pycache__/*",
                    "data/*",
                    "frontend/*",
                    "static/dist/*",
                ],
            }
        )

    uvicorn.run("run:app", **uvicorn_kwargs)
