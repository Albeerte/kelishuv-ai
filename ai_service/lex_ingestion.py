"""Selected normative articles with exact LexUZ anchors and edition metadata."""
from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid4, uuid5

import httpx
from bs4 import BeautifulSoup

ALL_TYPES = ["MEHNAT", "SHARTNOMA", "QOSHNI", "OILA", "ISTE_MOLCHI", "BIZNES", "YER_MULK", "BOSHQA"]
LAWS = [
    ("3805227", "Mediatsiya to‘g‘risida", "O‘RQ-482", ["3", "7", "12", "16", "19", "20", "22", "23", "27", "28", "29", "29¹"], ALL_TYPES),
    ("1072079", "Hakamlik sudlari to‘g‘risida", "O‘RQ-64", ["5", "9", "11", "12", "13"], ALL_TYPES),
    ("5294106", "Xalqaro tijorat arbitraji to‘g‘risida", "O‘RQ-674", ["4", "12"], ["BIZNES", "SHARTNOMA"]),
    ("6257288", "Mehnat kodeksi", "O‘RQ-798", ["253", "542"], ["MEHNAT"]),
    ("111189", "Fuqarolik kodeksi, birinchi qism", "163-I", ["234", "236"], ["SHARTNOMA", "QOSHNI", "BIZNES", "YER_MULK"]),
    ("4704", "Iste’molchilarning huquqlarini himoya qilish to‘g‘risida", "221-I", ["13", "19"], ["ISTE_MOLCHI"]),
    ("104720", "Oila kodeksi", "607-I", ["96", "131"], ["OILA"]),
    ("152653", "Yer kodeksi", "598-I", ["89"], ["YER_MULK"]),
    ("3517337", "Fuqarolik protsessual kodeksi", "O‘RQ-460", ["26", "33"], ALL_TYPES),
    ("3523891", "Iqtisodiy protsessual kodeksi", "O‘RQ-461", ["25"], ["BIZNES", "SHARTNOMA"]),
    ("3527353", "Ma’muriy sud ishlarini yuritish to‘g‘risidagi kodeks", "O‘RQ-462", ["26", "27"], ["YER_MULK", "BOSHQA"]),
]
SUPERSCRIPTS = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")
ARTICLE = re.compile(r"^(\d+(?:\s*[⁰¹²³⁴⁵⁶⁷⁸⁹])*)\s*[-–]\s*modda\b", re.IGNORECASE)


def parse_articles(html: str):
    soup = BeautifulSoup(html, "html.parser")
    body = soup.select_one("#divCont")
    if body is None:
        raise ValueError("LexUZ normative body #divCont was not found")
    edition_node = soup.select_one(".lx_date_selected")
    if edition_node is None:
        label = soup.find(string=re.compile("Кучга кириш санаси|Kuchga kirish sanasi", re.I))
        if label:
            edition_node = label.parent.find_next_sibling(class_="docHeader__item-value")
    edition = edition_node.get_text(" ", strip=True) if edition_node else ""
    edition = edition[:10]
    for element in body.select(".COMMENT, .CHANGES_ORIGINS, .INDEXES_ON_REF, .lx_elem2, script, style"):
        element.decompose()
    articles = {}
    current = None
    for block in body.select(".lx_elem"):
        for sup in block.select("sup"):
            sup.replace_with(sup.get_text(strip=True).translate(SUPERSCRIPTS))
        value = block.find(attrs={"id": re.compile(r"^-?\d+$")}, recursive=False)
        if value is None:
            continue
        text = re.sub(r"[ \t\xa0]+", " ", value.get_text(" ", strip=True)).strip()
        if not text:
            continue
        match = ARTICLE.match(text)
        if match and "CLAUSE_DEFAULT" in block.get("class", []):
            current = re.sub(r"\s+", "", match[1])
            text = current + "-modda" + text[match.end():]
            if current in articles:
                raise ValueError(f"Duplicate article heading {current}")
            articles[current] = {"heading": text, "anchor": value["id"], "paragraphs": []}
        elif "TEXT_HEADER_DEFAULT" in block.get("class", []) and re.search(r"\d+\s*[-–]\s*(bob|bo‘lim|boʻlim)", text, re.I):
            current = None
        elif current and set(block.get("class", [])) & {"ACT_TEXT", "BY_DEFAULT", "TEXT_HEADER_DEFAULT"}:
            articles[current]["paragraphs"].append(text)
    return articles, edition


def build_catalog(as_of: str):
    cut_off = date.fromisoformat(as_of)
    retrieved = datetime.now(timezone.utc).isoformat()
    sources = []
    with httpx.Client(timeout=60, follow_redirects=True, headers={"User-Agent": "MediMatch-Selected-Articles/2.0"}) as client:
        for law_id, title, number, selected, types in LAWS:
            url = f"https://lex.uz/docs/-{law_id}"
            response = client.get(url)
            response.raise_for_status()
            if response.url.host != "lex.uz":
                raise ValueError("Unexpected redirect outside lex.uz")
            articles, edition = parse_articles(response.text)
            if edition and datetime.strptime(edition, "%d.%m.%Y").date() > cut_off:
                soup = BeautifulSoup(response.text, "html.parser")
                dates = [datetime.strptime(node.get_text(strip=True), "%d.%m.%Y").date()
                         for node in soup.select(".lx_date_link")
                         if re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", node.get_text(strip=True))]
                earlier = [value for value in dates if value <= cut_off]
                if not earlier:
                    raise ValueError(f"No edition available by {as_of} for {law_id}")
                response = client.get(url, params={"ONDATE": max(earlier).strftime("%d.%m.%Y")})
                response.raise_for_status()
                articles, edition = parse_articles(response.text)
            if not edition or datetime.strptime(edition, "%d.%m.%Y").date() > cut_off:
                raise ValueError(f"Missing or future edition date for {law_id}")
            for article in selected:
                item = articles.get(article)
                if not item or not item["paragraphs"]:
                    raise ValueError(f"Required normative article {article} missing from {law_id}")
                content = item["heading"] + "\n" + "\n".join(item["paragraphs"])
                preview = item["paragraphs"][0]
                sources.append({
                    "id": f"lex-{law_id}-{article}", "lawId": law_id, "title": title,
                    "lawNumber": number, "article": item["heading"], "articleNumber": article,
                    "summary": preview if len(preview) <= 500 else preview[:497] + "…",
                    "content": content, "url": f"{url}#{item['anchor']}", "types": types,
                    "verifiedAt": as_of, "editionDate": datetime.strptime(edition, "%d.%m.%Y").date().isoformat(),
                    "retrievedAt": retrieved, "contentHash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
                    "keywords": [title, item["heading"], "mediatsiya" if law_id == "3805227" else "huquq"],
                })
            print(f"Fetched {title}: {len(selected)} articles, edition {edition}", flush=True)
    return {"schemaVersion": 1, "asOf": as_of, "retrievedAt": retrieved, "sources": sources}


def write_catalog(destination: Path, catalog: dict):
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=destination.parent, suffix=".tmp")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump(catalog, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def embed_catalog(catalog: dict):
    import tiktoken
    from openai import OpenAI
    from qdrant_client import QdrantClient, models

    codec = tiktoken.get_encoding("cl100k_base")
    llm = OpenAI(timeout=60, max_retries=2)
    qdrant = QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.getenv("QDRANT_API_KEY"), timeout=60)
    version = uuid4().hex
    staged = f"uzbek_laws_{version}"
    active_alias = os.getenv("QDRANT_COLLECTION", "uzbek_laws_active")
    existing = {alias.alias_name for alias in qdrant.get_aliases().aliases}
    if active_alias not in existing and qdrant.collection_exists(active_alias):
        raise ValueError("QDRANT_COLLECTION names a physical collection. Set it to a new alias name.")
    chunks = []
    for source in catalog["sources"]:
        tokens = codec.encode(source["content"])
        for index in range(0, len(tokens), 462):
            chunks.append((source, index, codec.decode(tokens[index:index + 512])))
    if not chunks:
        raise ValueError("The selected article catalog is empty")
    for start in range(0, len(chunks), 64):
        batch = chunks[start:start + 64]
        embeddings = llm.embeddings.create(model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"), input=[item[2] for item in batch]).data
        if start == 0:
            qdrant.create_collection(staged, vectors_config=models.VectorParams(size=len(embeddings[0].embedding), distance=models.Distance.COSINE))
        points = []
        for index, embedding in enumerate(embeddings):
            source, offset, content = batch[index]
            points.append(models.PointStruct(id=str(uuid5(NAMESPACE_URL, f"{source['url']}:{offset}")), vector=embedding.embedding, payload={
                "source_id": source["id"], "law_title": source["title"], "article": source["article"],
                "text": content, "url": source["url"], "types": source["types"],
                "content_hash": source["contentHash"], "edition_date": source["editionDate"],
                "retrieved_at": source["retrievedAt"], "catalog_version": version,
            }))
        qdrant.upsert(staged, points=points, wait=True)
    operations = []
    if active_alias in existing:
        operations.append(models.DeleteAliasOperation(delete_alias=models.DeleteAlias(alias_name=active_alias)))
    operations.append(models.CreateAliasOperation(create_alias=models.CreateAlias(collection_name=staged, alias_name=active_alias)))
    qdrant.update_collection_aliases(change_aliases_operations=operations)
    print(f"Activated Qdrant alias {active_alias} -> {staged}")
