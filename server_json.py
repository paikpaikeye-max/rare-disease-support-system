import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, unquote


BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "webapp"
STORE_PATH = BASE_DIR / "rare_diseases_store.json"
HOST = "127.0.0.1"
PORT = 8000
ADMIN_PASSWORD = "1918"


def load_store() -> dict:
    if not STORE_PATH.exists():
        raise FileNotFoundError("rare_diseases_store.json not found. Run init_disease_store.py first.")
    return json.loads(STORE_PATH.read_text(encoding="utf-8"))


def save_store(payload: dict) -> None:
    STORE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def get_disease(store: dict, disease_id: str) -> dict | None:
    for disease in store["diseases"]:
        if disease["id"] == disease_id:
            return disease
    return None


def is_authorized(handler: "AppHandler", body: dict | None = None) -> bool:
    candidates = [
        handler.headers.get("X-Admin-Password", ""),
        (body or {}).get("password", ""),
    ]
    return any(candidate == ADMIN_PASSWORD for candidate in candidates)


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
            store = load_store()
            query = parse_qs(parsed.query)
            search = (query.get("search", [""])[0]).strip().lower()
            specialty = (query.get("specialty", [""])[0]).strip()
            items = []
            for disease in store["diseases"]:
                haystack = " ".join([
                    disease["koreanName"],
                    disease["englishName"],
                    disease["kcd"],
                    disease["vcode"],
                    disease["primarySpecialty"],
                    " ".join(disease["allSpecialties"]),
                ]).lower()
                if search and search not in haystack:
                    continue
                if specialty and specialty not in disease["allSpecialties"]:
                    continue
                items.append(disease)
            return self.send_json({"items": items})

        if parsed.path == "/api/specialties":
            store = load_store()
            return self.send_json({"items": store["specialties"]})

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        parts = parsed.path.strip("/").split("/")
        if len(parts) >= 3 and parts[0] == "api" and parts[1] == "diseases":
            body = self.read_json_body()
            if not is_authorized(self, body):
                return self.send_json({"error": "Invalid password"}, HTTPStatus.FORBIDDEN)
            disease_id = parts[2]
            store = load_store()
            disease = get_disease(store, disease_id)
            if not disease:
                return self.send_json({"error": "Disease not found"}, HTTPStatus.NOT_FOUND)

            if len(parts) == 4 and parts[3] == "primary":
                specialty = body.get("specialty", "").strip()
                if not specialty:
                    return self.send_json({"error": "specialty is required"}, HTTPStatus.BAD_REQUEST)
                if specialty not in disease["allSpecialties"]:
                    disease["allSpecialties"].append(specialty)
                disease["primarySpecialty"] = specialty
                if specialty not in store["specialties"]:
                    store["specialties"].append(specialty)
                    store["specialties"].sort()
                save_store(store)
                return self.send_json(disease)

            if len(parts) == 4 and parts[3] == "specialties":
                specialty = body.get("specialty", "").strip()
                if not specialty:
                    return self.send_json({"error": "specialty is required"}, HTTPStatus.BAD_REQUEST)
                if specialty not in disease["allSpecialties"]:
                    disease["allSpecialties"].append(specialty)
                    disease["allSpecialties"].sort()
                if disease["primarySpecialty"] == "미분류":
                    disease["primarySpecialty"] = specialty
                if specialty not in store["specialties"]:
                    store["specialties"].append(specialty)
                    store["specialties"].sort()
                save_store(store)
                return self.send_json(disease)

        return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        parts = parsed.path.strip("/").split("/")
        if len(parts) == 5 and parts[0] == "api" and parts[1] == "diseases" and parts[3] == "specialties":
            if not is_authorized(self):
                return self.send_json({"error": "Invalid password"}, HTTPStatus.FORBIDDEN)
            disease_id = parts[2]
            specialty = unquote(parts[4])
            store = load_store()
            disease = get_disease(store, disease_id)
            if not disease:
                return self.send_json({"error": "Disease not found"}, HTTPStatus.NOT_FOUND)
            disease["allSpecialties"] = [item for item in disease["allSpecialties"] if item != specialty]
            if disease["primarySpecialty"] == specialty:
                disease["primarySpecialty"] = disease["allSpecialties"][0] if disease["allSpecialties"] else "미분류"
            save_store(store)
            return self.send_json(disease)
        return self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)


def main():
    if not STORE_PATH.exists():
        raise FileNotFoundError("rare_diseases_store.json not found. Run init_disease_store.py first.")
    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print(f"Serving http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
