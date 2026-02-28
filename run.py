#!/usr/bin/env python3
"""Entry point – run the Traffic Insights Bangladesh server."""

import uvicorn
from app.server import create_app
from app.config import API_HOST, API_PORT, DEBUG


app = create_app()

if __name__ == "__main__":
    uvicorn.run(
        "run:app",
        host=API_HOST,
        port=API_PORT,
        reload=DEBUG,
        log_level="debug" if DEBUG else "warning",
    )
