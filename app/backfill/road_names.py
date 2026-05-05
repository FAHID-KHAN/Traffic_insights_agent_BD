"""Backfill existing accident road names to canonical values."""
from __future__ import annotations

from app import database as db
from app.normalize_roads import normalize_road_name


def normalize_existing_road_names(*, apply: bool = False, sample_limit: int = 20) -> dict:
    """Normalize accidents.road_name values and optionally persist changes."""
    with db.get_db() as conn:
        rows = conn.execute(
            """SELECT id, road_name
               FROM accidents
               WHERE road_name IS NOT NULL AND road_name != ''
               ORDER BY id"""
        ).fetchall()

        changes = []
        for row in rows:
            current = row["road_name"]
            normalized = normalize_road_name(current)
            if normalized and normalized != current:
                changes.append({
                    "id": row["id"],
                    "before": current,
                    "after": normalized,
                })

        if apply and changes:
            conn.executemany(
                "UPDATE accidents SET road_name = ? WHERE id = ?",
                [(change["after"], change["id"]) for change in changes],
            )

    return {
        "dry_run": not apply,
        "scanned": len(rows),
        "changed": len(changes),
        "sample": changes[:sample_limit],
    }
