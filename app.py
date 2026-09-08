import hmac
import io
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from bson import ObjectId
from flask import Flask, jsonify, render_template, request, send_file, send_from_directory, session
from gridfs import GridFSBucket
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError
from werkzeug.security import check_password_hash, generate_password_hash


APP_ROOT = Path(__file__).resolve().parent
GEMINI_MODEL = "gemini-3.6-flash"
DATA_KEYS = {
    "notes",
    "flashcards",
    "quiz_history",
    "bookmarks",
    "recall_sessions",
    "settings",
    "profile",
    "reading_history",
    "ocr_cache",
    "annotations",
    "daily_study",
}


def load_env_file():
    env_path = APP_ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        os.environ.setdefault(name.strip(), value.strip().strip('"').strip("'"))


load_env_file()
app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.getenv("SECRET_KEY") or secrets.token_hex(32),
    MAX_CONTENT_LENGTH=25 * 1024 * 1024,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true",
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
)

mongo_client = None
mongo_db = None
gridfs_bucket = None


def get_db():
    global mongo_client, mongo_db, gridfs_bucket
    if mongo_db is not None:
        return mongo_db
    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI is not set in .env")
    mongo_client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    parsed = urlparse(uri)
    database_name = os.getenv("MONGODB_DB_NAME") or parsed.path.strip("/") or "ImpactX"
    mongo_db = mongo_client[database_name]
    mongo_db.users.create_index("email", unique=True)
    mongo_db.study_data.create_index([("userId", ASCENDING), ("key", ASCENDING)], unique=True)
    mongo_db.pdfs.create_index([("userId", ASCENDING), ("uploadedAt", ASCENDING)])
    gridfs_bucket = GridFSBucket(mongo_db, bucket_name="pdf_files")
    return mongo_db


def now_utc():
    return datetime.now(timezone.utc)


def public_user(user):
    return {
        "id": str(user["_id"]),
        "name": user.get("name", "Student"),
        "email": user["email"],
        "createdAt": user.get("createdAt", now_utc()).isoformat(),
    }


def current_user():
    user_id = session.get("user_id")
    if not user_id or not ObjectId.is_valid(user_id):
        return None
    return get_db().users.find_one({"_id": ObjectId(user_id)})


def require_auth(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify(error="Authentication required"), 401
        return handler(user, *args, **kwargs)

    return wrapped


def csrf_is_valid():
    token = session.get("csrf_token")
    supplied = request.headers.get("X-CSRF-Token")
    return bool(token and supplied and hmac.compare_digest(token, supplied))


def require_csrf():
    if not csrf_is_valid():
        return jsonify(error="Invalid or missing CSRF token"), 403
    return None


def parse_json():
    return request.get_json(silent=True) or {}


@app.get("/api/auth/csrf")
def csrf():
    session.setdefault("csrf_token", secrets.token_urlsafe(32))
    return jsonify(token=session["csrf_token"])


@app.get("/api/auth/me")
def me():
    user = current_user()
    if not user:
        return jsonify(user=None), 401
    return jsonify(user=public_user(user))


@app.post("/api/auth/register")
def register():
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    payload = parse_json()
    name = str(payload.get("name", "Student")).strip()[:80] or "Student"
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    if "@" not in email or len(email) > 254:
        return jsonify(error="Enter a valid email address"), 400
    if len(password) < 8 or len(password) > 128:
        return jsonify(error="Password must be between 8 and 128 characters"), 400

    user = {
        "name": name,
        "email": email,
        "passwordHash": generate_password_hash(password),
        "createdAt": now_utc(),
        "updatedAt": now_utc(),
    }
    try:
        result = get_db().users.insert_one(user)
    except DuplicateKeyError:
        return jsonify(error="An account with that email already exists"), 409

    user["_id"] = result.inserted_id
    session.clear()
    session.permanent = True
    session["user_id"] = str(result.inserted_id)
    session["csrf_token"] = secrets.token_urlsafe(32)
    return jsonify(user=public_user(user)), 201


@app.post("/api/auth/login")
def login():
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    payload = parse_json()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    user = get_db().users.find_one({"email": email})
    if not user or not check_password_hash(user["passwordHash"], password):
        return jsonify(error="Invalid email or password"), 401

    session.clear()
    session.permanent = True
    session["user_id"] = str(user["_id"])
    session["csrf_token"] = secrets.token_urlsafe(32)
    return jsonify(user=public_user(user))


@app.post("/api/auth/logout")
def logout():
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    session.clear()
    return jsonify(success=True)


@app.post("/api/auth/change-password")
@require_auth
def change_password(user):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    payload = parse_json()
    current_password = str(payload.get("currentPassword", ""))
    new_password = str(payload.get("newPassword", ""))
    if not check_password_hash(user["passwordHash"], current_password):
        return jsonify(error="Current password is incorrect"), 400
    if len(new_password) < 8 or len(new_password) > 128:
        return jsonify(error="Password must be between 8 and 128 characters"), 400
    get_db().users.update_one(
        {"_id": user["_id"]},
        {"$set": {"passwordHash": generate_password_hash(new_password), "updatedAt": now_utc()}},
    )
    return jsonify(success=True)


@app.delete("/api/auth/account")
@require_auth
def delete_account(user):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    database = get_db()
    user_id = user["_id"]
    for pdf in database.pdfs.find({"userId": user_id}, {"fileId": 1}):
        gridfs_bucket.delete(pdf["fileId"])
    database.pdfs.delete_many({"userId": user_id})
    database.study_data.delete_many({"userId": user_id})
    database.users.delete_one({"_id": user_id})
    session.clear()
    return jsonify(success=True)


@app.get("/api/data")
@require_auth
def get_data(user):
    records = get_db().study_data.find({"userId": user["_id"]})
    return jsonify({record["key"]: record["value"] for record in records})


@app.put("/api/data/<key>")
@require_auth
def save_data(user, key):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if key not in DATA_KEYS:
        return jsonify(error="Unsupported data key"), 400
    value = parse_json().get("value")
    if len(json.dumps(value)) > 2_000_000:
        return jsonify(error="Stored data is too large"), 413
    get_db().study_data.update_one(
        {"userId": user["_id"], "key": key},
        {"$set": {"value": value, "updatedAt": now_utc()}},
        upsert=True,
    )
    return jsonify(success=True)


@app.delete("/api/data")
@require_auth
def clear_data(user):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    get_db().study_data.delete_many({"userId": user["_id"]})
    return jsonify(success=True)


@app.get("/api/pdfs")
@require_auth
def list_pdfs(user):
    records = get_db().pdfs.find({"userId": user["_id"]}).sort("uploadedAt", -1)
    return jsonify(
        pdfs=[
            {
                "id": record["_id"],
                "name": record["name"],
                "totalPages": record.get("totalPages"),
                "uploadedAt": record["uploadedAt"].isoformat(),
            }
            for record in records
        ]
    )


@app.post("/api/pdfs")
@require_auth
def upload_pdf(user):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename.lower().endswith(".pdf"):
        return jsonify(error="Please upload a PDF file"), 400

    client_id = request.form.get("id") or secrets.token_urlsafe(16)
    name = request.form.get("name") or uploaded_file.filename
    total_pages = request.form.get("totalPages")
    file_id = gridfs_bucket.upload_from_stream(
        uploaded_file.filename,
        uploaded_file.stream,
        metadata={"userId": user["_id"], "clientId": client_id},
    )
    record = {
        "_id": client_id,
        "userId": user["_id"],
        "name": name,
        "totalPages": int(total_pages) if total_pages and total_pages.isdigit() else None,
        "uploadedAt": now_utc(),
        "fileId": file_id,
    }
    get_db().pdfs.replace_one({"_id": client_id, "userId": user["_id"]}, record, upsert=True)
    return jsonify(id=client_id, name=name, totalPages=record["totalPages"]), 201


@app.get("/api/pdfs/<pdf_id>")
@require_auth
def download_pdf(user, pdf_id):
    record = get_db().pdfs.find_one({"_id": pdf_id, "userId": user["_id"]})
    if not record:
        return jsonify(error="PDF not found"), 404
    stream = gridfs_bucket.open_download_stream(record["fileId"])
    return send_file(io.BytesIO(stream.read()), mimetype="application/pdf", download_name=record["name"])


@app.delete("/api/pdfs/<pdf_id>")
@require_auth
def delete_pdf(user, pdf_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    database = get_db()
    record = database.pdfs.find_one_and_delete({"_id": pdf_id, "userId": user["_id"]})
    if not record:
        return jsonify(error="PDF not found"), 404
    gridfs_bucket.delete(record["fileId"])
    return jsonify(success=True)


@app.delete("/api/pdfs")
@require_auth
def delete_all_pdfs(user):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    database = get_db()
    for record in database.pdfs.find({"userId": user["_id"]}, {"fileId": 1}):
        gridfs_bucket.delete(record["fileId"])
    database.pdfs.delete_many({"userId": user["_id"]})
    return jsonify(success=True)


@app.post("/api/gemini")
@require_auth
def generate_with_gemini(user):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify(error="GEMINI_API_KEY is not set in .env"), 500
    payload = parse_json()
    prompt = payload.get("prompt")
    if not prompt:
        return jsonify(error='Missing "prompt" in request body'), 400

    model = payload.get("model") or GEMINI_MODEL
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    body = json.dumps({"contents": [{"parts": [{"text": prompt }]}]}).encode()
    gemini_request = Request(
        endpoint,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(gemini_request, timeout=90) as response:
            return jsonify(json.loads(response.read().decode())), response.status
    except HTTPError as error:
        try:
            data = json.loads(error.read().decode())
        except (json.JSONDecodeError, UnicodeDecodeError):
            data = {}
        message = data.get("error", {}).get("message", f"Gemini API error: {error.code}")
        temporary = message.lower()
        retryable = error.code in {429, 500, 503} or any(
            phrase in temporary for phrase in ("quota", "high demand", "temporarily")
        )
        return jsonify(error="RATE_LIMIT" if retryable else message), error.code
    except (TimeoutError, URLError):
        return jsonify(error="Failed to reach Gemini API"), 502


@app.get("/")
def serve_frontend():
    return render_template("index.html")


@app.get("/<path:file_path>")
def serve_static_file(file_path):
    if file_path.startswith("api/") or file_path in {".env", "app.py"}:
        return jsonify(error="Not found"), 404
    file_path_obj = APP_ROOT / file_path
    if not file_path_obj.is_file():
        return jsonify(error="File not found"), 404
    return send_from_directory(APP_ROOT, file_path)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    print(f"Active Recall is running at http://localhost:{port}")
    app.run(host="127.0.0.1", port=port)
