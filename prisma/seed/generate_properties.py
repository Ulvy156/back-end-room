#!/usr/bin/env python3
"""
generate_properties.py  —  Rent Room fake property generator

Inserts fake properties directly into the database by default.
Reads DATABASE_URL from the project .env file automatically.

Usage:
  python generate_properties.py --user-id <UUID>
  python generate_properties.py --user-id <UUID> --count 50
  python generate_properties.py --user-id <UUID> --district 314 --district 315
  python generate_properties.py --user-id <UUID> --url postgresql://user:pass@host/db

  # Offline output (no DB connection):
  python generate_properties.py --user-id <UUID> --dry-run          # SQL to stdout
  python generate_properties.py --user-id <UUID> --dry-run --out seed.sql
  python generate_properties.py --user-id <UUID> --format ts        # TypeScript snippet

Requirements:
  pip install psycopg2-binary
"""

import argparse
import os
import random
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse


# ─────────────────────────────────────────────────────────────────────────────
# Data pools  (edit to match your DB reference tables)
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_DISTRICT_IDS = [314, 315, 316, 317, 318, 319, 320, 321, 322, 323]

PROPERTY_TYPE_IDS = [1, 2, 3, 4, 5]

PROPERTY_TYPES = {
    1: "Room",
    2: "Apartment",
    3: "House",
    4: "Condo",
    5: "Villa",
}

AREAS = [
    "Sensok", "Toul Kork", "BKK1", "BKK2", "Chamkarmon",
    "Daun Penh", "Meanchey", "Chbar Ampov", "Russey Keo", "Prek Pnov",
]

LANDMARKS = [
    "Aeon 2 Mall", "Royal Hospital", "Naga World", "Independence Monument",
    "Tuol Sleng Museum", "Phsar Thmei Market", "Olympic Stadium",
    "Russian Market", "Calmette Hospital", "IFL University",
    "Northbridge International School", "Canadian International School",
]

STREET_NAMES = [
    "Street 271", "Street 163", "Street 51", "Street 240",
    "Norodom Blvd", "Monivong Blvd", "Mao Tse Tung Blvd",
    "Russian Blvd", "Charles de Gaulle Blvd", "Kampuchea Krom",
]

TITLE_PATTERNS = [
    "{beds}BR {type} For Rent – {area}",
    "{type} For Rent – Near {landmark}",
    "Affordable {beds}BR {type} in {area}",
    "Luxury {type} For Rent – {area}",
    "Cozy {beds}BR {type} Near {landmark}",
    "Furnished {beds}BR {type} – {area}",
    "{beds}BR {type} – {street}, {area}",
    "Modern {type} For Rent – {area}",
    "Spacious {beds}BR {type} Close to {landmark}",
    "Brand New {type} in {area}",
]

DESCRIPTION_PATTERNS = [
    "𝐅𝐨𝐫 𝐑𝐞𝐧𝐭: {beds}BR {type} – {area}. Fully furnished, walking distance to {landmark}.",
    "Bright and airy {beds}-bedroom {type} on floor {floor}. Close to {landmark} and local markets.",
    "Modern {beds}BR unit with balcony, city view. {minutes} min walk to {landmark}.",
    "{beds}-bedroom {type} available now. Quiet neighbourhood in {area}. Near {landmark}.",
    "Well-maintained {beds}BR {type}. Utilities not included. Close to {landmark}.",
    "Spacious {type} in {area}. {beds} bedrooms, {baths} bathrooms. {sqm}sqm.",
    "High-floor {beds}BR {type} with panoramic view. Full kitchen, gym access.",
    "Family-sized {beds}BR {type} in {area}. Balcony, parking, near {landmark}.",
    "Affordable {beds}BR unit near {landmark}. {sqm}sqm, {baths} bathrooms.",
    "Executive {beds}BR {type} on floor {floor}. Near {landmark} and embassies.",
]

ADDRESS_PATTERNS = [
    "{street}, {area}, Phnom Penh",
    "Sangkat {area}, {street}",
    "{area} – Near {landmark}",
    "{street}, Sangkat {area}",
    "Village 3, Sangkat {area}, Khan {area}",
]


# ─────────────────────────────────────────────────────────────────────────────
# Property generator
# ─────────────────────────────────────────────────────────────────────────────

def rand_price(beds: int) -> int:
    ranges = {1: (250, 700), 2: (600, 1200), 3: (900, 1800), 4: (1500, 3000), 5: (2500, 5000)}
    lo, hi = ranges.get(beds, (300, 1000))
    return round(random.randint(lo, hi) / 50) * 50


def rand_sqm(beds: int) -> int:
    ranges = {1: (25, 55), 2: (50, 90), 3: (80, 130), 4: (120, 200), 5: (180, 350)}
    lo, hi = ranges.get(beds, (30, 80))
    return random.randint(lo, hi)


def make_property(user_id: str, district_ids: list) -> dict:
    prop_type_id = random.choice(PROPERTY_TYPE_IDS)
    prop_type    = PROPERTY_TYPES[prop_type_id]
    beds         = random.randint(1, 5)
    baths        = max(1, beds - random.randint(0, 1))
    floor        = random.randint(1, 12)
    total_floors = max(floor, floor + random.randint(0, 8))
    sqm          = rand_sqm(beds)
    price        = rand_price(beds)
    area         = random.choice(AREAS)
    landmark     = random.choice(LANDMARKS)
    street       = random.choice(STREET_NAMES)
    now          = datetime.now(timezone.utc)
    open_close   = random.random() > 0.5

    title = random.choice(TITLE_PATTERNS).format(
        beds=beds, type=prop_type, area=area, landmark=landmark, street=street
    )
    description = random.choice(DESCRIPTION_PATTERNS).format(
        beds=beds, type=prop_type, area=area, landmark=landmark,
        floor=floor, baths=baths, sqm=sqm, minutes=random.randint(2, 15),
    )
    address = random.choice(ADDRESS_PATTERNS).format(
        street=street, area=area, landmark=landmark,
    )

    return {
        "id":                  str(uuid.uuid4()),
        "user_id":             user_id,
        "district_id":         random.choice(district_ids),
        "address":             address,
        "lat":                 None,
        "lng":                 None,
        "nearby_location":     "",
        "title":               title,
        "description":         description,
        "monthly_price":       price,
        "deposit":             price if random.random() > 0.3 else price * 2,
        "bedroom":             beds,
        "bathroom":            baths,
        "floor":               floor,
        "totalFloors":         total_floors,
        "is_available":        random.random() > 0.15,
        "available_from":      now - timedelta(days=random.randint(0, 60)),
        "is_featured":         False,
        "featured_at":         None,
        "total_views":         random.randint(0, 500),
        "property_type_id":    prop_type_id,
        "size_sqm":            sqm,
        "furnished":           random.random() > 0.2,
        "is_published":        True,
        "minimum_stay_length": random.choice([1, 3, 6, 12]),
        "open_time":           f"{random.randint(7,10):02d}:00" if open_close else None,
        "close_time":          f"{random.randint(17,20):02d}:00" if open_close else None,
        "created_at":          now,
        "updated_at":          now,
    }


# ─────────────────────────────────────────────────────────────────────────────
# .env loader  (stdlib — no python-dotenv needed)
# ─────────────────────────────────────────────────────────────────────────────

def load_dotenv(path: Path) -> None:
    """Parse a .env file and inject values into os.environ (skips existing keys)."""
    if not path.exists():
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key, val)


def resolve_database_url(override: str | None) -> str:
    if override:
        return _strip_prisma_params(override)

    # walk up from the script's location until we find a .env file
    here = Path(__file__).resolve().parent
    for candidate in [here, here.parent, here.parent.parent]:
        load_dotenv(candidate / ".env")

    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit(
            "❌  DATABASE_URL not found.\n"
            "    Set it in your .env file or pass --url postgresql://..."
        )
    return _strip_prisma_params(url)


def _strip_prisma_params(url: str) -> str:
    """Remove Prisma-only query params (e.g. schema=) that psycopg2 rejects."""
    PRISMA_ONLY = {"schema", "connection_limit", "pool_timeout", "socket_timeout",
                   "pgbouncer", "statement_cache_size", "application_name"}
    parsed = urlparse(url)
    qs = {k: v for k, v in parse_qs(parsed.query).items() if k not in PRISMA_ONLY}
    cleaned = parsed._replace(query=urlencode(qs, doseq=True))
    return urlunparse(cleaned)


# ─────────────────────────────────────────────────────────────────────────────
# DB insertion
# ─────────────────────────────────────────────────────────────────────────────

# Each entry: (db_column_name, dict_key)
# db_column_name is used verbatim in SQL (camelCase columns need quoting — handled below).
# dict_key is the key used in the property dict returned by make_property().
COLUMN_MAP = [
    ("id",                   "id"),
    ("user_id",              "user_id"),
    ("district_id",          "district_id"),
    ("address",              "address"),
    ("lat",                  "lat"),
    ("lng",                  "lng"),
    ("nearby_location",      "nearby_location"),
    ("title",                "title"),
    ("description",          "description"),
    ("monthly_price",        "monthly_price"),
    ("deposit",              "deposit"),
    ("bedroom",              "bedroom"),
    ("bathroom",             "bathroom"),
    ("floor",                "floor"),
    ('"totalFloors"',        "totalFloors"),   # no @map() → camelCase in DB
    ("is_available",         "is_available"),
    ("available_from",       "available_from"),
    ("is_featured",          "is_featured"),
    ("featured_at",          "featured_at"),
    ("total_views",          "total_views"),
    ("property_type_id",     "property_type_id"),
    ("size_sqm",             "size_sqm"),
    ("furnished",            "furnished"),
    ("is_published",         "is_published"),
    ("minimum_stay_length",  "minimum_stay_length"),
    ("open_time",            "open_time"),
    ("close_time",           "close_time"),
    ("created_at",           "created_at"),
    ("updated_at",           "updated_at"),
]

# Convenience aliases
_DB_COLS  = [col  for col, _   in COLUMN_MAP]
_DICT_KEYS = [key for _,   key in COLUMN_MAP]


def fetch_district_ids(db_url: str) -> list:
    """Return all district IDs that exist in the DB."""
    try:
        import psycopg2
    except ImportError:
        sys.exit("❌  psycopg2 is not installed.\n    Run: pip install psycopg2-binary")
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM districts ORDER BY id;")
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def insert_to_db(properties: list, db_url: str) -> None:
    try:
        import psycopg2
    except ImportError:
        sys.exit(
            "❌  psycopg2 is not installed.\n"
            "    Run: pip install psycopg2-binary"
        )

    col_list     = ", ".join(_DB_COLS)
    placeholders = ", ".join(f"%({k})s" for k in _DICT_KEYS)
    upsert_sets  = ",\n".join(
        f"  {col} = EXCLUDED.{col}"
        for col, key in COLUMN_MAP if key != "id"
    )
    sql = (
        f"INSERT INTO properties ({col_list})\n"
        f"VALUES ({placeholders})\n"
        f"ON CONFLICT (id) DO UPDATE SET\n"
        + upsert_sets + ";"
    )

    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                for i, prop in enumerate(properties, 1):
                    cur.execute(sql, prop)
                    print(f"  [{i}/{len(properties)}] inserted: {prop['title'][:60]}")
        print(f"\n✅  {len(properties)} properties inserted successfully.")
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Offline formatters (--dry-run / --format ts)
# ─────────────────────────────────────────────────────────────────────────────

def sql_val(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, datetime):
        return f"'{v.strftime('%Y-%m-%dT%H:%M:%S.000Z')}'"
    return "'" + str(v).replace("'", "''") + "'"


def to_sql(properties: list) -> str:
    col_list = ", ".join(_DB_COLS)
    rows = []
    for p in properties:
        vals = ", ".join(sql_val(p[k]) for k in _DICT_KEYS)
        rows.append(f"  ({vals})")
    return (
        f"-- Generated by generate_properties.py  |  {len(properties)} rows\n\n"
        f"INSERT INTO properties ({col_list})\nVALUES\n"
        + ",\n".join(rows) + ";"
    )


_CAMEL = {
    "user_id": "userId", "district_id": "districtId",
    "monthly_price": "monthly_price", "is_available": "isAvailable",
    "available_from": "availableFrom", "is_featured": "isFeatured",
    "featured_at": "featuredAt", "total_views": "totalViews",
    "property_type_id": "propertyTypeId", "size_sqm": "sizeSqm",
    "is_published": "isPublished", "minimum_stay_length": "minimumStayLength",
    "open_time": "openTime", "close_time": "closeTime",
    "totalFloors": "totalFloors", "created_at": "createdAt", "updated_at": "updatedAt",
}


def ts_val(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, datetime):
        return f'new Date("{v.strftime("%Y-%m-%dT%H:%M:%S.000Z")}")'
    return '"' + str(v).replace("\\", "\\\\").replace('"', '\\"') + '"'


def to_ts(properties: list) -> str:
    lines = [f"// Generated by generate_properties.py  |  {len(properties)} rows\n", "const properties = ["]
    for p in properties:
        lines.append("  {")
        for dict_key, v in p.items():
            camel = _CAMEL.get(dict_key, dict_key)
            lines.append(f"    {camel}: {ts_val(v)},")
        lines.append("  },")
    lines += [
        "];", "",
        "for (const p of properties) {",
        "  await prisma.property.upsert({ where: { id: p.id }, create: p, update: p });",
        "}",
    ]
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate and insert fake properties into the Rent Room database.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Insert 10 properties straight into the DB (reads .env automatically)
  python generate_properties.py --user-id <UUID>

  # Insert 50 properties
  python generate_properties.py --user-id <UUID> --count 50

  # Use specific districts only
  python generate_properties.py --user-id <UUID> --district 314 --district 315

  # Override database URL
  python generate_properties.py --user-id <UUID> --url postgresql://user:pass@localhost/mydb

  # Preview as SQL without touching the DB
  python generate_properties.py --user-id <UUID> --dry-run
  python generate_properties.py --user-id <UUID> --dry-run --out seed.sql

  # Output as TypeScript snippet
  python generate_properties.py --user-id <UUID> --format ts
        """,
    )
    p.add_argument("--user-id",  required=True, help="Landlord user UUID (from the users table)")
    p.add_argument("--count",    type=int, default=10, help="Number of properties to generate (default: 10)")
    p.add_argument("--district", action="append", dest="districts", metavar="ID",
                   help="District ID to use (repeatable; default: IDs 314–323)")
    p.add_argument("--url",      metavar="DATABASE_URL",
                   help="PostgreSQL connection string (overrides .env)")
    p.add_argument("--dry-run",  action="store_true",
                   help="Print SQL to stdout instead of inserting into the DB")
    p.add_argument("--format",   choices=["sql", "ts"],
                   help="Offline output format: sql or ts (implies --dry-run)")
    p.add_argument("--out",      metavar="FILE",
                   help="Write offline output to FILE instead of stdout")
    p.add_argument("--seed",     type=int, help="Random seed for reproducible output")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    offline = args.dry_run or args.format

    if offline:
        district_ids = [int(d) for d in args.districts] if args.districts else DEFAULT_DISTRICT_IDS
        properties   = [make_property(args.user_id, district_ids) for _ in range(args.count)]
        fmt    = args.format or "sql"
        output = to_ts(properties) if fmt == "ts" else to_sql(properties)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as f:
                f.write(output + "\n")
            print(f"✅  {args.count} properties written to {args.out}", file=sys.stderr)
        else:
            print(output)
    else:
        db_url = resolve_database_url(args.url)
        if args.districts:
            district_ids = [int(d) for d in args.districts]
        else:
            district_ids = fetch_district_ids(db_url)
            if not district_ids:
                sys.exit("❌  No districts found in the DB. Run the district seed first.")
            print(f"  Found {len(district_ids)} districts in DB.", file=sys.stderr)
        properties = [make_property(args.user_id, district_ids) for _ in range(args.count)]
        insert_to_db(properties, db_url)


if __name__ == "__main__":
    main()
