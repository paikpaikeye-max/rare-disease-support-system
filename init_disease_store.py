import csv
import json
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
STORE_PATH = BASE_DIR / "rare_diseases_store.json"


def find_source_csv() -> Path:
    for name in os.listdir(BASE_DIR):
        if name.endswith(".csv") and "orphanet_hybrid" in name and "미분류" not in name:
            return BASE_DIR / name
    raise FileNotFoundError("Source CSV not found")


def normalize_specialties(primary: str, all_specialties: str) -> list[str]:
    result = []
    seen = set()
    for specialty in [primary, *[s.strip() for s in (all_specialties or "").split(";")]]:
        if specialty and specialty != "미분류" and specialty not in seen:
            seen.add(specialty)
            result.append(specialty)
    return result


def main() -> None:
    source_csv = find_source_csv()
    diseases = []
    specialty_names = set()

    with source_csv.open("r", encoding="utf-8-sig", newline="") as f:
      reader = csv.DictReader(f)
      for row in reader:
          specialties = normalize_specialties(
              row.get("PrimarySpecialty", ""),
              row.get("AllSpecialties", ""),
          )
          primary = row.get("PrimarySpecialty", "") or (specialties[0] if specialties else "미분류")
          diseases.append({
              "id": row.get("No", ""),
              "koreanName": row.get("KoreanName", ""),
              "englishName": row.get("EnglishName", ""),
              "kcd": row.get("KCD", ""),
              "vcode": row.get("VCode", ""),
              "support": row.get("Support", ""),
              "primarySpecialty": primary if primary else "미분류",
              "allSpecialties": specialties,
              "classificationSource": row.get("ClassificationSource", ""),
              "status": row.get("Status", ""),
              "orphaCode": row.get("OrphaCode", ""),
              "orphaName": row.get("OrphaName", ""),
          })
          specialty_names.update(specialties)

    payload = {
        "specialties": sorted(specialty_names),
        "diseases": diseases,
    }
    STORE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Initialized {STORE_PATH.name} with {len(diseases)} diseases from {source_csv.name}")


if __name__ == "__main__":
    main()
