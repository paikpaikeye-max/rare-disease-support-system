import json
import sqlite3
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "webapp"
DB_PATH = BASE_DIR / "rare_diseases_v2.db"
HOST = "127.0.0.1"
PORT = 8000


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=MEMORY")
    conn.execute("PRAGMA synchronous=OFF")
    conn.execute("PRAGMA temp_store=MEMORY")
    return conn


def get_disease_payload(conn: sqlite3.Connection, disease_id: str) -> dict | None:
    disease = conn.execute("SELECT * FROM diseases WHERE id = ?", (disease_id,)).fetchone()
    if not disease:
        return None
    specialties = [
        row["specialty"]
        for row in conn.execute(
            "SELECT specialty FROM disease_specialties WHERE disease_id = ? ORDER BY specialty",
            (disease_id,),
        ).fetchall()
    ]
    return {
        "id": disease["id"],
        "koreanName": disease["korean_name"],
        "englishName": disease["english_name"] or "",
        "kcd": disease["kcd"] or "",
        "vcode": disease["vcode"] or "",
        "support": disease["support"] or "",
        "primarySpecialty": disease["primary_specialty"] or "미분류",
        "allSpecialties": specialties,
        "status": disease["status"] or "",
        "classificationSource": disease["classification_source"] or "",
        "orphaCode": disease["orpha_code"] or "",
        "orphaName": disease["orpha_name"] or "",
    }


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def send_json(self, payload, status=HTTPStatus.OK):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/diseases":
            with get_connection() as conn:
                query = parse_qs(parsed.query)
                search = (query.get("search", [""])[0]).strip().lower()
                specialty = (query.get("specialty", [""])[0]).strip()
                rows = conn.execute("SELECT id FROM diseases ORDER BY CAST(id AS INTEGER) DESC").fetchall()
                items = []
                for row in rows:
                    payload = get_disease_payload(conn, row["id"])
                    if not payload:
                        continue
                    haystack = " ".join([
                        payload["koreanName"],
                        payload["englishName"],
                        payload["kcd"],
                        payload["vcode"],
                        payload["primarySpecialty"],
                        " ".join(payload["allSpecialties"]),
                    ]).lower()
                    if search and search not in haystack:
                        continue
                    if specialty and specialty not in payload["allSpecialties"]:
                        continue
                    items.append(payload)
                return self.send_json({"items": items})

        if parsed.path == "/api/specialties":
            with get_connection() as conn:
                items = [row["name"] for row in conn.execute("SELECT name FROM specialties ORDER BY name").fetchall()]
                return self.send_json({"items": items})

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        parts = parsed.path.strip("/").split("/")
        if len(parts) >= 3 and parts[0] == "api" and parts[1] == "diseases":
            disease_id = parts[2]
            if len(parts) == 4 and parts[3] == "primary":
                body = self.read_json_body()
                specialty = body.get("specialty", "").strip()
                if not specialty:
                    return self.send_json({"error": "specialty is required"}, HTTPStatus.BAD_REQUEST)
                with get_connection() as conn:
                    conn.execute("UPDATE diseases SET primary_specialty = ? WHERE id = ?", (specialty, disease_id))
                    conn.execute("INSERT OR IGNORE INTO disease_specialties (disease_id, specialty) VALUES (?, ?)", (disease_id, specialty))
                    conn.execute("INSERT OR IGNORE INTO specialties (name) VALUES (?)", (specialty,))
                    conn.commit()
                    return self.send_json(get_disease_payload(conn, disease_id))

            if len(parts) == 4 and parts[3] == "specialties":
                body = self.read_json_body()
                specialty = body.get("specialty", "").strip()
                if not specialty:
                    return self.send_json({"error": "specialty is required"}, HTTPStatus.BAD_REQUEST)
                with get_connection() as conn:
                    conn.execute("INSERT OR IGNORE INTO disease_specialties (disease_id, specialty) VALUES (?, ?)", (disease_id, specialty))
                    conn.execute("INSERT OR IGNORE INTO specialties (name) VALUES (?)", (specialty,))
                    disease = conn.execute("SELECT primary_specialty FROM diseases WHERE id = ?", (disease_id,)).fetchone()
                    if disease and (not disease["primary_specialty"] or disease["primary_specialty"] == "미분류"):
                        conn.execute("UPDATE diseases SET primary_specialty = ? WHERE id = ?", (specialty, disease_id))
                    conn.commit()
                    return self.send_json(get_disease_payload(conn, disease_id))

        return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        parts = parsed.path.strip("/").split("/")
        if len(parts) == 5 and parts[0] == "api" and parts[1] == "diseases" and parts[3] == "specialties":
            disease_id = parts[2]
            specialty = parts[4]
            with get_connection() as conn:
                conn.execute("DELETE FROM disease_specialties WHERE disease_id = ? AND specialty = ?", (disease_id, specialty))
                disease = conn.execute("SELECT primary_specialty FROM diseases WHERE id = ?", (disease_id,)).fetchone()
                remaining = [
                    row["specialty"]
                    for row in conn.execute(
                        "SELECT specialty FROM disease_specialties WHERE disease_id = ? ORDER BY specialty",
                        (disease_id,),
                    ).fetchall()
                ]
                if disease and disease["primary_specialty"] == specialty:
                    conn.execute(
                        "UPDATE diseases SET primary_specialty = ? WHERE id = ?",
                        ((remaining[0] if remaining else "미분류"), disease_id),
                    )
                conn.commit()
                return self.send_json(get_disease_payload(conn, disease_id))
        return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)


def main():
    if not DB_PATH.exists():
        raise FileNotFoundError("rare_diseases.db not found. Run init_disease_db.py first.")
    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print(f"Serving http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
