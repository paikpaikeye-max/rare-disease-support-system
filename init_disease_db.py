import csv
import os
import sqlite3
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "rare_diseases_v2.db"


def find_source_csv() -> Path:
    for name in os.listdir(BASE_DIR):
        if name.endswith(".csv") and "orphanet_hybrid" in name and "미분류" not in name:
            return BASE_DIR / name
    raise FileNotFoundError("Source CSV not found")


def reset_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        DROP TABLE IF EXISTS disease_specialties;
        DROP TABLE IF EXISTS diseases;
        DROP TABLE IF EXISTS specialties;

        CREATE TABLE diseases (
            id TEXT PRIMARY KEY,
            korean_name TEXT NOT NULL,
            english_name TEXT,
            kcd TEXT,
            vcode TEXT,
            support TEXT,
            primary_specialty TEXT,
            classification_source TEXT,
            status TEXT,
            orpha_code TEXT,
            orpha_name TEXT
        );

        CREATE TABLE disease_specialties (
            disease_id TEXT NOT NULL,
            specialty TEXT NOT NULL,
            PRIMARY KEY (disease_id, specialty),
            FOREIGN KEY (disease_id) REFERENCES diseases(id) ON DELETE CASCADE
        );

        CREATE TABLE specialties (
            name TEXT PRIMARY KEY
        );
        """
    )


def normalize_specialties(primary: str, all_specialties: str) -> list[str]:
    result = []
    seen = set()
    for specialty in [primary, *[s.strip() for s in (all_specialties or "").split(";")]]:
        if specialty and specialty != "미분류" and specialty not in seen:
            seen.add(specialty)
            result.append(specialty)
    return result


def import_csv(conn: sqlite3.Connection, source_csv: Path) -> None:
    specialty_names = set()
    with source_csv.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            specialties = normalize_specialties(
                row.get("PrimarySpecialty", ""),
                row.get("AllSpecialties", ""),
            )
            primary = row.get("PrimarySpecialty", "") or (specialties[0] if specialties else "미분류")
            conn.execute(
                """
                INSERT INTO diseases (
                    id, korean_name, english_name, kcd, vcode, support,
                    primary_specialty, classification_source, status, orpha_code, orpha_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row.get("No", ""),
                    row.get("KoreanName", ""),
                    row.get("EnglishName", ""),
                    row.get("KCD", ""),
                    row.get("VCode", ""),
                    row.get("Support", ""),
                    primary if primary else "미분류",
                    row.get("ClassificationSource", ""),
                    row.get("Status", ""),
                    row.get("OrphaCode", ""),
                    row.get("OrphaName", ""),
                ),
            )
            for specialty in specialties:
                specialty_names.add(specialty)
                conn.execute(
                    "INSERT OR IGNORE INTO disease_specialties (disease_id, specialty) VALUES (?, ?)",
                    (row.get("No", ""), specialty),
                )

    for specialty in sorted(specialty_names):
        conn.execute("INSERT OR IGNORE INTO specialties (name) VALUES (?)", (specialty,))


def main() -> None:
    source_csv = find_source_csv()
    conn = sqlite3.connect(DB_PATH)
    try:
      conn.execute("PRAGMA journal_mode=MEMORY")
      conn.execute("PRAGMA synchronous=OFF")
      conn.execute("PRAGMA temp_store=MEMORY")
      conn.execute("PRAGMA foreign_keys = ON")
      reset_schema(conn)
      import_csv(conn, source_csv)
      conn.commit()
      count = conn.execute("SELECT COUNT(*) FROM diseases").fetchone()[0]
      print(f"Initialized {DB_PATH.name} with {count} diseases from {source_csv.name}")
    finally:
      conn.close()


if __name__ == "__main__":
    main()
