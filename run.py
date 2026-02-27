#!/usr/bin/env python3
"""Entry point – run the Traffic Insights Bangladesh server."""

import uvicorn
from app.server import create_app


app = create_app()

if __name__ == "__main__":
    uvicorn.run("run:app", host="0.0.0.0", port=8000, reload=True)
