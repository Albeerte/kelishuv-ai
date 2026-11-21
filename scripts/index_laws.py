"""Refresh selected official articles. Embeddings require an explicit --embed flag."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ai_service.lex_ingestion import build_catalog, embed_catalog, write_catalog


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "src/data/legal-articles.json")
    parser.add_argument("--as-of", default="2026-11-20", help="Edition cut-off in YYYY-MM-DD form")
    parser.add_argument("--embed", action="store_true", help="Build and activate a staged Qdrant collection")
    parser.add_argument("--cached", action="store_true", help="Embed the existing catalog without fetching")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if args.embed and not (os.getenv("OPENAI_API_KEY") and os.getenv("QDRANT_URL")):
        parser.error("--embed requires OPENAI_API_KEY and QDRANT_URL")
    catalog = json.loads(args.output.read_text(encoding="utf-8")) if args.cached else build_catalog(args.as_of)
    if not args.cached:
        write_catalog(args.output, catalog)
    if args.embed:
        embed_catalog(catalog)
    print(f"Ready: {len(catalog['sources'])} selected articles in {args.output}")


if __name__ == "__main__":
    main()
