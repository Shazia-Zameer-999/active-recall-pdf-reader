import hmac
import io
import json
import os
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from bson import ObjectId
from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    send_file,
    send_from_directory,
    session,
)
from flask_socketio import SocketIO, emit, join_room, leave_room
from gridfs import GridFSBucket
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError

from security import hash_password, migrate_password, verify_password

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
socketio = SocketIO(
    app,
    cors_allowed_origins=os.getenv("SOCKETIO_CORS_ORIGINS") or None,
    manage_session=True,
    async_mode="threading",
)
configured_secret_key = os.getenv("SECRET_KEY")
if not configured_secret_key and os.getenv("VERCEL") == "1":
    raise RuntimeError("SECRET_KEY must be configured in Vercel environment variables")
app.config.update(
    SECRET_KEY=configured_secret_key or secrets.token_hex(32),
    MAX_CONTENT_LENGTH=25 * 1024 * 1024,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=(
        os.getenv("VERCEL") == "1"
        or os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
    ),
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
)

mongo_client = None
mongo_db = None
gridfs_bucket = None
presence_by_sid = {}
rate_limit_state = {}
socket_rate_limit_state = {}


@app.after_request
def disable_api_caching(response):
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def socket_user():
    user_id = session.get("user_id")
    if not user_id or not ObjectId.is_valid(user_id):
        return None
    return get_db().users.find_one({"_id": ObjectId(user_id)})


def safe_page(value, default=1):
    try:
        return max(1, min(int(value), 100000))
    except (TypeError, ValueError):
        return default


def socket_rate_limited(event_name, limit=60, window_seconds=60):
    now = time.monotonic()
    key = (request.sid, event_name)
    timestamps = [
        stamp
        for stamp in socket_rate_limit_state.get(key, [])
        if now - stamp < window_seconds
    ]
    if len(timestamps) >= limit:
        return True
    timestamps.append(now)
    socket_rate_limit_state[key] = timestamps
    return False


def friend_user_ids(user_id):
    database = get_db()
    return [
        (
            record["recipientId"]
            if record["requesterId"] == user_id
            else record["requesterId"]
        )
        for record in database.friendships.find(
            {
                "status": "accepted",
                "$or": [{"requesterId": user_id}, {"recipientId": user_id}],
            },
            {"requesterId": 1, "recipientId": 1},
        )
    ]


def user_has_live_socket(user_id):
    return any(
        entry.get("userId") == str(user_id) for entry in presence_by_sid.values()
    )


def emit_friend_notification(user_id, notification_type, payload):
    database = get_db()
    for friend_id in friend_user_ids(user_id):
        notification = create_notification(
            database, friend_id, notification_type, payload
        )
        socketio.emit(
            "notification_created",
            notification_payload(notification),
            to=f"user:{friend_id}",
        )


def presence_payload(entry):
    return {
        "userId": entry["userId"],
        "name": entry["name"],
        "avatar": entry.get("avatar", "🧑‍🎓"),
        "groupId": entry.get("groupId"),
        "pdfId": entry.get("pdfId"),
        "pdfName": entry.get("pdfName"),
        "currentPage": entry.get("currentPage", 1),
        "startedAt": entry.get("studyStartedAt") or entry["startedAt"],
        "status": entry.get("status", "online"),
        "online": True,
    }


def broadcast_group_presence(group_id):
    if not group_id:
        return
    emit(
        "presence_snapshot",
        {
            "members": [
                presence_payload(item)
                for item in presence_by_sid.values()
                if item.get("groupId") == group_id
            ]
        },
        to=f"group:{group_id}",
    )


def broadcast_group_member_count(group_id):
    if not group_id:
        return
    count = get_db().group_members.count_documents(
        {"groupId": ObjectId(group_id), "status": "active"}
    )
    socketio.emit(
        "group_member_count_updated",
        {"groupId": group_id, "count": count},
        to=f"group:{group_id}",
    )


@socketio.on("connect")
def socket_connect():
    user = socket_user()
    if not user:
        return False
    was_online = user_has_live_socket(user["_id"])
    presence_by_sid[request.sid] = {
        "userId": str(user["_id"]),
        "name": user.get("name", "Student"),
        "avatar": user.get("avatar", "🧑‍🎓"),
        "startedAt": now_utc().isoformat(),
        "status": "online",
    }
    join_room(f"user:{user['_id']}")
    if not was_online:
        emit_friend_notification(
            user["_id"],
            "friend_online",
            {"userId": str(user["_id"]), "name": user.get("name", "Student")},
        )


@socketio.on("disconnect")
def socket_disconnect():
    entry = presence_by_sid.pop(request.sid, None)
    socket_rate_limit_state.pop((request.sid, "typing"), None)
    socket_rate_limit_state.pop((request.sid, "send_message"), None)
    if entry and entry.get("groupId"):
        emit(
            "presence_offline",
            {"userId": entry["userId"], "name": entry["name"], "online": False},
            to=f"group:{entry['groupId']}",
        )
        broadcast_group_presence(entry["groupId"])
    if entry and not user_has_live_socket(entry["userId"]):
        emit_friend_notification(
            ObjectId(entry["userId"]),
            "friend_offline",
            {"userId": entry["userId"], "name": entry["name"]},
        )


@socketio.on("join_group")
def socket_join_group(data):
    entry = presence_by_sid.get(request.sid)
    group_id = str((data or {}).get("groupId", ""))
    if not entry or not ObjectId.is_valid(group_id):
        return
    if not group_member(get_db(), ObjectId(group_id), ObjectId(entry["userId"])):
        return
    previous_group_id = entry.get("groupId")
    if previous_group_id and previous_group_id != group_id:
        leave_room(f"group:{previous_group_id}")
        broadcast_group_presence(previous_group_id)
    entry["groupId"] = group_id
    entry["status"] = "online"
    join_room(f"group:{group_id}")
    broadcast_group_presence(group_id)


@socketio.on("read_message")
def socket_read_message(data):
    user = socket_user()
    message_id = str((data or {}).get("messageId", ""))
    if not user or not ObjectId.is_valid(message_id):
        return
    database = get_db()
    message = database.messages.find_one({"_id": ObjectId(message_id)})
    if not message or not group_member(database, message["groupId"], user["_id"]):
        return
    now = now_utc()
    database.message_reads.update_one(
        {"messageId": message["_id"], "userId": user["_id"]},
        {"$set": {"readAt": now}},
        upsert=True,
    )
    emit(
        "message_read",
        {
            "messageId": message_id,
            "userId": str(user["_id"]),
            "readAt": now.isoformat(),
        },
        to=f"group:{message['groupId']}",
    )


@socketio.on("leave_group")
def socket_leave_group(data):
    entry = presence_by_sid.get(request.sid)
    group_id = entry.get("groupId") if entry else str((data or {}).get("groupId", ""))
    if entry:
        entry.pop("groupId", None)
    if group_id:
        leave_room(f"group:{group_id}")
        broadcast_group_presence(group_id)


@socketio.on("study_started")
def socket_study_started(data):
    entry = presence_by_sid.get(request.sid)
    if not entry or not entry.get("groupId"):
        return
    was_studying = entry.get("status") == "studying"
    active_session = get_db().study_sessions.find_one(
        {"userId": ObjectId(entry["userId"]), "status": {"$in": ["active", "paused"]}},
        {"startedAt": 1},
    )
    entry.update(
        {
            "pdfId": str((data or {}).get("pdfId", "")),
            "pdfName": str((data or {}).get("pdfName", ""))[:200],
            "currentPage": safe_page((data or {}).get("currentPage", 1)),
            "status": "studying",
            "studyStartedAt": entry.get("studyStartedAt")
            or (
                active_session["startedAt"].isoformat()
                if active_session
                else now_utc().isoformat()
            ),
        }
    )
    emit("presence_updated", presence_payload(entry), to=f"group:{entry['groupId']}")
    emit("study_timer_started", presence_payload(entry), to=f"group:{entry['groupId']}")
    if not was_studying:
        emit_friend_notification(
            ObjectId(entry["userId"]),
            "friend_studying",
            {
                "userId": entry["userId"],
                "name": entry["name"],
                "pdfId": entry["pdfId"],
                "currentPage": entry["currentPage"],
            },
        )


@socketio.on("study_updated")
def socket_study_updated(data):
    socket_study_started(data)


@socketio.on("study_stopped")
def socket_study_stopped():
    entry = presence_by_sid.get(request.sid)
    if not entry:
        return
    group_id = entry.get("groupId")
    entry.pop("pdfId", None)
    entry.pop("pdfName", None)
    entry.pop("studyStartedAt", None)
    entry["status"] = "online"
    if group_id:
        emit("presence_updated", presence_payload(entry), to=f"group:{group_id}")
        emit("study_timer_stopped", {"userId": entry["userId"]}, to=f"group:{group_id}")
        emit_friend_notification(
            ObjectId(entry["userId"]),
            "friend_study_stopped",
            {"userId": entry["userId"], "name": entry["name"]},
        )


@socketio.on("study_paused")
def socket_study_paused():
    entry = presence_by_sid.get(request.sid)
    if not entry or not entry.get("groupId"):
        return
    entry["status"] = "paused"
    emit("study_timer_paused", presence_payload(entry), to=f"group:{entry['groupId']}")


@socketio.on("study_resumed")
def socket_study_resumed():
    entry = presence_by_sid.get(request.sid)
    if not entry or not entry.get("groupId"):
        return
    entry["status"] = "studying"
    emit("study_timer_resumed", presence_payload(entry), to=f"group:{entry['groupId']}")


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
    mongo_db.users.create_index("username", unique=True)
    mongo_db.study_data.create_index(
        [("userId", ASCENDING), ("key", ASCENDING)], unique=True
    )
    mongo_db.pdfs.create_index([("userId", ASCENDING), ("uploadedAt", ASCENDING)])
    mongo_db.friendships.create_index(
        [("requesterId", ASCENDING), ("recipientId", ASCENDING)], unique=True
    )
    mongo_db.friendships.create_index(
        [("recipientId", ASCENDING), ("status", ASCENDING)]
    )
    mongo_db.friendships.create_index(
        [("requesterId", ASCENDING), ("status", ASCENDING)]
    )
    mongo_db.friend_requests.create_index(
        [("requesterId", ASCENDING), ("recipientId", ASCENDING)], unique=True
    )
    mongo_db.friend_requests.create_index(
        [("recipientId", ASCENDING), ("status", ASCENDING)]
    )
    mongo_db.groups.create_index([("createdAt", ASCENDING)])
    mongo_db.group_members.create_index(
        [("groupId", ASCENDING), ("userId", ASCENDING)], unique=True
    )
    mongo_db.group_members.create_index([("userId", ASCENDING), ("status", ASCENDING)])
    mongo_db.group_invites.create_index(
        [("groupId", ASCENDING), ("inviteeId", ASCENDING)], unique=True
    )
    mongo_db.study_sessions.create_index(
        [("userId", ASCENDING), ("startedAt", ASCENDING)]
    )
    mongo_db.study_sessions.create_index([("userId", ASCENDING), ("status", ASCENDING)])
    mongo_db.study_sessions.create_index(
        [("groupId", ASCENDING), ("startedAt", ASCENDING)]
    )
    mongo_db.messages.create_index([("groupId", ASCENDING), ("createdAt", ASCENDING)])
    mongo_db.message_reads.create_index(
        [("messageId", ASCENDING), ("userId", ASCENDING)], unique=True
    )
    mongo_db.notifications.create_index(
        [("recipientId", ASCENDING), ("createdAt", ASCENDING)]
    )
    mongo_db.notifications.create_index(
        [("recipientId", ASCENDING), ("readAt", ASCENDING)]
    )
    mongo_db.user_achievements.create_index(
        [("userId", ASCENDING), ("achievementId", ASCENDING)], unique=True
    )
    gridfs_bucket = GridFSBucket(mongo_db, bucket_name="pdf_files")
    return mongo_db


def now_utc():
    return datetime.now(timezone.utc)


def public_user(user):
    return {
        "id": str(user["_id"]),
        "name": user.get("name", "Student"),
        "email": user["email"],
        "username": user["username"],
        "avatar": user.get("avatar", "🧑‍🎓"),
        "bio": user.get("bio", ""),
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


def rate_limit(limit, window_seconds):
    def decorator(handler):
        @wraps(handler)
        def wrapped(*args, **kwargs):
            key = (handler.__name__, request.remote_addr or "unknown")
            now = time.monotonic()
            timestamps = [
                stamp
                for stamp in rate_limit_state.get(key, [])
                if now - stamp < window_seconds
            ]
            if len(timestamps) >= limit:
                return jsonify(error="Too many requests. Please try again later."), 429
            timestamps.append(now)
            rate_limit_state[key] = timestamps
            return handler(*args, **kwargs)

        return wrapped

    return decorator


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


@app.get("/api/profile")
@require_auth
def get_profile(user):
    database = get_db()
    study_records = {
        record["key"]: record["value"]
        for record in database.study_data.find({"userId": user["_id"]})
    }
    daily_study = study_records.get("daily_study", {}) or {}
    recent_pdfs = list(
        database.pdfs.find({"userId": user["_id"]}, {"name": 1, "uploadedAt": 1})
        .sort("uploadedAt", -1)
        .limit(5)
    )
    return jsonify(
        **public_user(user),
        stats={
            "pdfs": database.pdfs.count_documents({"userId": user["_id"]}),
            "flashcards": len(study_records.get("flashcards", []) or []),
            "quizzes": len(study_records.get("quiz_history", []) or []),
            "notes": len(study_records.get("notes", []) or []),
            "studyMinutes": sum(float(value or 0) for value in daily_study.values()),
        },
        recentPdfs=[
            {"id": pdf["_id"], "name": pdf.get("name", "Untitled PDF")}
            for pdf in recent_pdfs
        ],
    )


@app.put("/api/profile")
@require_auth
def update_profile(user):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    payload = parse_json()
    name = (
        str(payload.get("name", user.get("name", "Student"))).strip()[:80] or "Student"
    )
    bio = str(payload.get("bio", user.get("bio", ""))).strip()[:500]
    avatar = (
        str(payload.get("avatar", user.get("avatar", "🧑‍🎓"))).strip()[:16] or "🧑‍🎓"
    )
    get_db().users.update_one(
        {"_id": user["_id"]},
        {"$set": {"name": name, "bio": bio, "avatar": avatar, "updatedAt": now_utc()}},
    )
    user.update({"name": name, "bio": bio, "avatar": avatar})
    return jsonify(user=public_user(user))


def friendship_user(database, user_id):
    profile = database.users.find_one({"_id": user_id})
    return public_user(profile) if profile else None


@app.get("/api/users/search")
@require_auth
def search_users(user):
    query = str(request.args.get("q", "")).strip()[:80]
    if len(query) < 2:
        return jsonify(users=[])
    pattern = re.compile(re.escape(query), re.IGNORECASE)
    matches = (
    get_db()
    .users.find(
        {
            "_id": {"$ne": user["_id"]},
            "$or": [{"name": pattern}, {"email": pattern}],
        },
        {"email": 1, "name": 1, "username": 1, "avatar": 1, "bio": 1, "createdAt": 1},
    )
    .limit(20)
)
    return jsonify(users=[public_user(match) for match in matches])


@app.get("/api/friends")
@require_auth
def list_friends(user):
    database = get_db()
    records = database.friendships.find(
        {
            "status": "accepted",
            "$or": [{"requesterId": user["_id"]}, {"recipientId": user["_id"]}],
        }
    )
    friends = []
    for record in records:
        friend_id = (
            record["recipientId"]
            if record["requesterId"] == user["_id"]
            else record["requesterId"]
        )
        profile = friendship_user(database, friend_id)
        if profile:
            friends.append({"friendshipId": str(record["_id"]), "user": profile})
    return jsonify(friends=friends)


@app.get("/api/friends/requests")
@require_auth
def list_friend_requests(user):
    database = get_db()
    records = database.friendships.find(
        {"recipientId": user["_id"], "status": "pending"}
    )
    requests = []
    for record in records:
        profile = friendship_user(database, record["requesterId"])
        if profile:
            requests.append(
                {
                    "id": str(record["_id"]),
                    "user": profile,
                    "createdAt": record["createdAt"].isoformat(),
                }
            )
    return jsonify(requests=requests)


@app.post("/api/friends/requests")
@require_auth
def send_friend_request(user):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    recipient_id = str(parse_json().get("userId", ""))
    if not ObjectId.is_valid(recipient_id) or recipient_id == str(user["_id"]):
        return jsonify(error="Invalid friend user"), 400
    database = get_db()
    recipient = database.users.find_one({"_id": ObjectId(recipient_id)})
    if not recipient:
        return jsonify(error="User not found"), 404
    existing = database.friendships.find_one(
        {
            "$or": [
                {"requesterId": user["_id"], "recipientId": recipient["_id"]},
                {"requesterId": recipient["_id"], "recipientId": user["_id"]},
            ]
        }
    )
    if existing:
        return jsonify(error="A friendship or request already exists"), 409
    now = now_utc()
    result = database.friendships.insert_one(
        {
            "requesterId": user["_id"],
            "recipientId": recipient["_id"],
            "status": "pending",
            "createdAt": now,
            "updatedAt": now,
        }
    )
    database.friend_requests.insert_one(
        {
            "_id": result.inserted_id,
            "requesterId": user["_id"],
            "recipientId": recipient["_id"],
            "status": "pending",
            "createdAt": now,
            "updatedAt": now,
        }
    )
    notification = create_notification(
        database,
        recipient["_id"],
        "friend_request",
        {"actorId": str(user["_id"]), "actorName": user.get("name", "Student")},
    )
    socketio.emit(
        "notification_created",
        notification_payload(notification),
        to=f"user:{recipient_id}",
    )
    return jsonify(id=str(result.inserted_id)), 201


@app.post("/api/friends/requests/<request_id>/accept")
@require_auth
def accept_friend_request(user, request_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(request_id):
        return jsonify(error="Request not found"), 404
    result = get_db().friendships.update_one(
        {"_id": ObjectId(request_id), "recipientId": user["_id"], "status": "pending"},
        {"$set": {"status": "accepted", "updatedAt": now_utc()}},
    )
    if result.matched_count == 0:
        return jsonify(error="Request not found"), 404
    get_db().friend_requests.update_one(
        {"_id": ObjectId(request_id), "recipientId": user["_id"], "status": "pending"},
        {"$set": {"status": "accepted", "updatedAt": now_utc()}},
    )
    return jsonify(success=True)


@app.post("/api/friends/requests/<request_id>/reject")
@require_auth
def reject_friend_request(user, request_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(request_id):
        return jsonify(error="Request not found"), 404
    result = get_db().friendships.delete_one(
        {"_id": ObjectId(request_id), "recipientId": user["_id"], "status": "pending"}
    )
    if result.deleted_count == 0:
        return jsonify(error="Request not found"), 404
    get_db().friend_requests.delete_one(
        {"_id": ObjectId(request_id), "recipientId": user["_id"], "status": "pending"}
    )
    return jsonify(success=True)


@app.delete("/api/friends/<friend_id>")
@require_auth
def remove_friend(user, friend_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(friend_id):
        return jsonify(error="Friend not found"), 404
    result = get_db().friendships.delete_one(
        {
            "status": "accepted",
            "$or": [
                {"requesterId": user["_id"], "recipientId": ObjectId(friend_id)},
                {"requesterId": ObjectId(friend_id), "recipientId": user["_id"]},
            ],
        }
    )
    if result.deleted_count == 0:
        return jsonify(error="Friend not found"), 404
    return jsonify(success=True)


def group_member(database, group_id, user_id):
    return database.group_members.find_one(
        {"groupId": group_id, "userId": user_id, "status": "active"}
    )


def group_payload(database, group):
    member_count = database.group_members.count_documents(
        {"groupId": group["_id"], "status": "active"}
    )
    return {
        "id": str(group["_id"]),
        "name": group["name"],
        "description": group.get("description", ""),
        "ownerId": str(group["ownerId"]),
        "memberCount": member_count,
        "createdAt": group["createdAt"].isoformat(),
    }


@app.get("/api/groups")
@require_auth
def list_groups(user):
    database = get_db()
    memberships = database.group_members.find(
        {"userId": user["_id"], "status": "active"}
    )
    joined_ids = {membership["groupId"] for membership in memberships}
    groups = list(database.groups.find({}).sort("createdAt", -1).limit(50))
    return jsonify(
        groups=[
            {**group_payload(database, group), "joined": group["_id"] in joined_ids}
            for group in groups
        ]
    )


@app.post("/api/groups")
@require_auth
def create_group(user):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    payload = parse_json()
    name = str(payload.get("name", "")).strip()[:80]
    description = str(payload.get("description", "")).strip()[:500]
    if len(name) < 2:
        return jsonify(error="Group name must contain at least two characters"), 400
    database = get_db()
    now = now_utc()
    group = {
        "name": name,
        "description": description,
        "ownerId": user["_id"],
        "createdAt": now,
        "updatedAt": now,
    }
    result = database.groups.insert_one(group)
    group["_id"] = result.inserted_id
    database.group_members.insert_one(
        {
            "groupId": result.inserted_id,
            "userId": user["_id"],
            "role": "owner",
            "status": "active",
            "joinedAt": now,
        }
    )
    return jsonify(group=group_payload(database, group)), 201


@app.get("/api/groups/<group_id>")
@require_auth
def get_group(user, group_id):
    if not ObjectId.is_valid(group_id):
        return jsonify(error="Group not found"), 404
    database = get_db()
    group = database.groups.find_one({"_id": ObjectId(group_id)})
    if not group or not group_member(database, group["_id"], user["_id"]):
        return jsonify(error="Group not found"), 404
    members = []
    for membership in database.group_members.find(
        {"groupId": group["_id"], "status": "active"}
    ):
        profile = friendship_user(database, membership["userId"])
        if profile:
            members.append({"role": membership["role"], "user": profile})
    return jsonify(group={**group_payload(database, group), "members": members})


@app.post("/api/groups/<group_id>/join")
@require_auth
def join_group(user, group_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(group_id):
        return jsonify(error="Group not found"), 404
    database = get_db()
    object_id = ObjectId(group_id)
    if not database.groups.find_one({"_id": object_id}):
        return jsonify(error="Group not found"), 404
    existing = database.group_members.find_one(
        {"groupId": object_id, "userId": user["_id"]}
    )
    if existing and existing.get("status") == "active":
        return jsonify(error="You are already a member"), 409
    now = now_utc()
    database.group_members.update_one(
        {"groupId": object_id, "userId": user["_id"]},
        {"$set": {"role": "member", "status": "active", "joinedAt": now}},
        upsert=True,
    )
    broadcast_group_member_count(group_id)
    return jsonify(success=True)


@app.post("/api/groups/<group_id>/leave")
@require_auth
def leave_group(user, group_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(group_id):
        return jsonify(error="Group not found"), 404
    database = get_db()
    result = database.group_members.update_one(
        {
            "groupId": ObjectId(group_id),
            "userId": user["_id"],
            "status": "active",
            "role": {"$ne": "owner"},
        },
        {"$set": {"status": "left", "leftAt": now_utc()}},
    )
    if result.matched_count == 0:
        return jsonify(error="Owners cannot leave their group"), 400
    broadcast_group_member_count(group_id)
    return jsonify(success=True)


@app.post("/api/groups/<group_id>/invites")
@require_auth
def invite_to_group(user, group_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    invitee_id = str(parse_json().get("userId", ""))
    if not ObjectId.is_valid(group_id) or not ObjectId.is_valid(invitee_id):
        return jsonify(error="Invalid group or user"), 400
    database = get_db()
    group_object_id = ObjectId(group_id)
    if not group_member(database, group_object_id, user["_id"]):
        return jsonify(error="You are not a group member"), 403
    if not database.users.find_one({"_id": ObjectId(invitee_id)}):
        return jsonify(error="User not found"), 404
    try:
        database.group_invites.insert_one(
            {
                "groupId": group_object_id,
                "inviterId": user["_id"],
                "inviteeId": ObjectId(invitee_id),
                "status": "pending",
                "createdAt": now_utc(),
            }
        )
    except DuplicateKeyError:
        return jsonify(error="An invite already exists"), 409
    notification = create_notification(
        database,
        ObjectId(invitee_id),
        "group_invite",
        {
            "groupId": group_id,
            "groupName": database.groups.find_one({"_id": group_object_id}).get(
                "name", "Study group"
            ),
        },
    )
    socketio.emit(
        "notification_created",
        notification_payload(notification),
        to=f"user:{invitee_id}",
    )
    return jsonify(success=True), 201


@app.get("/api/group-invites")
@require_auth
def list_group_invites(user):
    database = get_db()
    records = database.group_invites.find(
        {"inviteeId": user["_id"], "status": "pending"}
    )
    invites = []
    for record in records:
        group = database.groups.find_one({"_id": record["groupId"]})
        if group:
            invites.append(
                {"id": str(record["_id"]), "group": group_payload(database, group)}
            )
    return jsonify(invites=invites)


@app.post("/api/group-invites/<invite_id>/accept")
@require_auth
def accept_group_invite(user, invite_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(invite_id):
        return jsonify(error="Invite not found"), 404
    database = get_db()
    invite = database.group_invites.find_one(
        {"_id": ObjectId(invite_id), "inviteeId": user["_id"], "status": "pending"}
    )
    if not invite:
        return jsonify(error="Invite not found"), 404
    now = now_utc()
    database.group_members.update_one(
        {"groupId": invite["groupId"], "userId": user["_id"]},
        {"$set": {"role": "member", "status": "active", "joinedAt": now}},
        upsert=True,
    )
    database.group_invites.update_one(
        {"_id": invite["_id"]}, {"$set": {"status": "accepted", "acceptedAt": now}}
    )
    return jsonify(success=True)


@app.get("/api/groups/<group_id>/stats")
@require_auth
def group_stats(user, group_id):
    if not ObjectId.is_valid(group_id):
        return jsonify(error="Group not found"), 404
    database = get_db()
    group_object_id = ObjectId(group_id)
    if not group_member(database, group_object_id, user["_id"]):
        return jsonify(error="Group not found"), 404
    totals = list(
        database.study_sessions.aggregate(
            [
                {"$match": {"groupId": group_object_id, "status": "finished"}},
                {"$group": {"_id": "$userId", "seconds": {"$sum": "$durationSeconds"}}},
                {"$sort": {"seconds": -1}},
            ]
        )
    )
    return jsonify(
        members=database.group_members.count_documents(
            {"groupId": group_object_id, "status": "active"}
        ),
        studyHours=[
            {"userId": str(item["_id"]), "hours": round(item["seconds"] / 3600, 2)}
            for item in totals
        ],
    )


@app.post("/api/groups/<group_id>/members/<member_id>/role")
@require_auth
def change_group_role(user, group_id, member_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(group_id) or not ObjectId.is_valid(member_id):
        return jsonify(error="Invalid group or member"), 400
    database = get_db()
    group_object_id = ObjectId(group_id)
    owner = database.group_members.find_one(
        {
            "groupId": group_object_id,
            "userId": user["_id"],
            "role": "owner",
            "status": "active",
        }
    )
    if not owner:
        return jsonify(error="Only the group owner can change roles"), 403
    role = str(parse_json().get("role", "member"))
    if role not in {"admin", "member"}:
        return jsonify(error="Invalid role"), 400
    result = database.group_members.update_one(
        {
            "groupId": group_object_id,
            "userId": ObjectId(member_id),
            "status": "active",
            "role": {"$ne": "owner"},
        },
        {"$set": {"role": role}},
    )
    if result.matched_count == 0:
        return jsonify(error="Member not found"), 404
    return jsonify(success=True)


def session_payload(record):
    return {
        "id": str(record["_id"]),
        "pdfId": record.get("pdfId"),
        "groupId": str(record["groupId"]) if record.get("groupId") else None,
        "startedAt": record["startedAt"].isoformat(),
        "endedAt": record.get("endedAt").isoformat() if record.get("endedAt") else None,
        "durationSeconds": record.get("durationSeconds", 0),
        "pausedSeconds": record.get("pausedSeconds", 0),
        "currentPage": record.get("currentPage", 1),
        "status": record.get("status", "active"),
    }


@app.post("/api/study-sessions")
@require_auth
def start_study_session(user):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    payload = parse_json()
    pdf_id = str(payload.get("pdfId", "")).strip() or None
    group_id = str(payload.get("groupId", "")).strip() or None
    database = get_db()
    if group_id:
        if not ObjectId.is_valid(group_id) or not group_member(
            database, ObjectId(group_id), user["_id"]
        ):
            return jsonify(error="You are not a member of this group"), 403
    active = database.study_sessions.find_one(
        {"userId": user["_id"], "status": {"$in": ["active", "paused"]}}
    )
    if active:
        return jsonify(session=session_payload(active))
    now = now_utc()
    record = {
        "userId": user["_id"],
        "pdfId": pdf_id,
        "groupId": ObjectId(group_id) if group_id else None,
        "startedAt": now,
        "lastActiveAt": now,
        "currentPage": max(1, int(payload.get("currentPage", 1))),
        "status": "active",
        "durationSeconds": 0,
        "pausedSeconds": 0,
    }
    result = database.study_sessions.insert_one(record)
    record["_id"] = result.inserted_id
    return jsonify(session=session_payload(record)), 201


@app.put("/api/study-sessions/<session_id>")
@require_auth
def update_study_session(user, session_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(session_id):
        return jsonify(error="Study session not found"), 404
    page = max(1, int(parse_json().get("currentPage", 1)))
    result = get_db().study_sessions.update_one(
        {"_id": ObjectId(session_id), "userId": user["_id"], "status": "active"},
        {"$set": {"currentPage": page, "lastActiveAt": now_utc()}},
    )
    if result.matched_count == 0:
        return jsonify(error="Study session not found"), 404
    return jsonify(success=True)


@app.post("/api/study-sessions/<session_id>/pause")
@require_auth
def pause_study_session(user, session_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(session_id):
        return jsonify(error="Study session not found"), 404
    result = get_db().study_sessions.update_one(
        {"_id": ObjectId(session_id), "userId": user["_id"], "status": "active"},
        {"$set": {"status": "paused", "pausedAt": now_utc()}},
    )
    if result.matched_count == 0:
        return jsonify(error="Study session is not active"), 409
    return jsonify(success=True)


@app.post("/api/study-sessions/<session_id>/resume")
@require_auth
def resume_study_session(user, session_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(session_id):
        return jsonify(error="Study session not found"), 404
    database = get_db()
    record = database.study_sessions.find_one(
        {"_id": ObjectId(session_id), "userId": user["_id"], "status": "paused"}
    )
    if not record:
        return jsonify(error="Study session is not paused"), 409
    resumed_at = now_utc()
    paused_seconds = record.get("pausedSeconds", 0) + max(
        0, int((resumed_at - record["pausedAt"]).total_seconds())
    )
    database.study_sessions.update_one(
        {"_id": record["_id"]},
        {
            "$set": {
                "status": "active",
                "pausedSeconds": paused_seconds,
                "lastActiveAt": resumed_at,
            },
            "$unset": {"pausedAt": ""},
        },
    )
    return jsonify(success=True)


@app.post("/api/study-sessions/<session_id>/finish")
@require_auth
def finish_study_session(user, session_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(session_id):
        return jsonify(error="Study session not found"), 404
    database = get_db()
    record = database.study_sessions.find_one(
        {
            "_id": ObjectId(session_id),
            "userId": user["_id"],
            "status": {"$in": ["active", "paused"]},
        }
    )
    if not record:
        return jsonify(error="Study session not found"), 404
    ended_at = now_utc()
    paused_seconds = record.get("pausedSeconds", 0)
    if record.get("status") == "paused" and record.get("pausedAt"):
        paused_seconds += max(0, int((ended_at - record["pausedAt"]).total_seconds()))
    duration = max(
        0, int((ended_at - record["startedAt"]).total_seconds()) - paused_seconds
    )
    database.study_sessions.update_one(
        {"_id": record["_id"]},
        {
            "$set": {
                "endedAt": ended_at,
                "lastActiveAt": ended_at,
                "durationSeconds": duration,
                "pausedSeconds": paused_seconds,
                "status": "finished",
            }
        },
    )
    record.update(
        {
            "endedAt": ended_at,
            "lastActiveAt": ended_at,
            "durationSeconds": duration,
            "pausedSeconds": paused_seconds,
            "status": "finished",
        }
    )
    award_achievement(database, user["_id"], "first_session")
    lifetime = database.study_sessions.aggregate(
        [
            {"$match": {"userId": user["_id"], "status": "finished"}},
            {"$group": {"_id": None, "seconds": {"$sum": "$durationSeconds"}}},
        ]
    )
    total_seconds = next(lifetime, {}).get("seconds", 0)
    if total_seconds >= 10 * 3600:
        award_achievement(database, user["_id"], "ten_hours")
    leaderboard_payload = {
        "userId": str(user["_id"]),
        "hours": round(total_seconds / 3600, 2),
    }
    socketio.emit("leaderboard_updated", leaderboard_payload)
    if record.get("groupId"):
        socketio.emit(
            "group_leaderboard_updated",
            leaderboard_payload,
            to=f"group:{record['groupId']}",
        )
    return jsonify(session=session_payload(record))


@app.get("/api/study-stats")
@require_auth
def study_stats(user):
    records = list(
        get_db().study_sessions.find({"userId": user["_id"], "status": "finished"})
    )
    now = now_utc()
    starts = {
        "daily": now - timedelta(days=1),
        "weekly": now - timedelta(days=7),
        "monthly": now - timedelta(days=30),
    }
    totals = {period: 0 for period in ["daily", "weekly", "monthly", "lifetime"]}
    for record in records:
        duration = record.get("durationSeconds", 0)
        totals["lifetime"] += duration
        for period, start in starts.items():
            if record["startedAt"] >= start:
                totals[period] += duration
    return jsonify(
        {period: round(seconds / 3600, 2) for period, seconds in totals.items()}
    )


def notification_payload(record):
    return {
        "id": str(record["_id"]),
        "type": record["type"],
        "payload": record.get("payload", {}),
        "readAt": record.get("readAt").isoformat() if record.get("readAt") else None,
        "createdAt": record["createdAt"].isoformat(),
    }


def create_notification(database, recipient_id, notification_type, payload):
    record = {
        "recipientId": recipient_id,
        "type": notification_type,
        "payload": payload,
        "createdAt": now_utc(),
        "readAt": None,
    }
    result = database.notifications.insert_one(record)
    record["_id"] = result.inserted_id
    return record


def award_achievement(database, user_id, achievement_id):
    try:
        database.user_achievements.insert_one(
            {"userId": user_id, "achievementId": achievement_id, "earnedAt": now_utc()}
        )
    except DuplicateKeyError:
        return None
    notification = create_notification(
        database,
        user_id,
        "achievement_earned",
        {"achievementId": achievement_id, "name": ACHIEVEMENTS[achievement_id][0]},
    )
    socketio.emit(
        "notification_created", notification_payload(notification), to=f"user:{user_id}"
    )
    return notification


@app.get("/api/notifications")
@require_auth
def list_notifications(user):
    records = (
        get_db()
        .notifications.find({"recipientId": user["_id"]})
        .sort("createdAt", -1)
        .limit(50)
    )
    return jsonify(notifications=[notification_payload(record) for record in records])


@app.post("/api/notifications/<notification_id>/read")
@require_auth
def mark_notification_read(user, notification_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(notification_id):
        return jsonify(error="Notification not found"), 404
    get_db().notifications.update_one(
        {"_id": ObjectId(notification_id), "recipientId": user["_id"]},
        {"$set": {"readAt": now_utc()}},
    )
    return jsonify(success=True)


@app.post("/api/notifications/read-all")
@require_auth
def mark_all_notifications_read(user):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    get_db().notifications.update_many(
        {"recipientId": user["_id"], "readAt": None}, {"$set": {"readAt": now_utc()}}
    )
    return jsonify(success=True)


def message_payload(database, record):
    sender = database.users.find_one({"_id": record["senderId"]})
    return {
        "id": str(record["_id"]),
        "groupId": str(record["groupId"]),
        "sender": public_user(sender) if sender else None,
        "body": record.get("body", ""),
        "attachments": record.get("attachments", []),
        "pinned": bool(record.get("pinned")),
        "createdAt": record["createdAt"].isoformat(),
    }


@app.get("/api/groups/<group_id>/messages")
@require_auth
def list_messages(user, group_id):
    if not ObjectId.is_valid(group_id):
        return jsonify(error="Group not found"), 404
    database = get_db()
    group_object_id = ObjectId(group_id)
    if not group_member(database, group_object_id, user["_id"]):
        return jsonify(error="Group not found"), 404
    records = (
        database.messages.find({"groupId": group_object_id})
        .sort("createdAt", -1)
        .limit(100)
    )
    messages = [message_payload(database, record) for record in reversed(list(records))]
    return jsonify(messages=messages)


@app.post("/api/groups/<group_id>/messages")
@require_auth
def create_message(user, group_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(group_id):
        return jsonify(error="Group not found"), 404
    payload = parse_json()
    body = str(payload.get("body", "")).strip()[:2000]
    database = get_db()
    group_object_id = ObjectId(group_id)
    if not group_member(database, group_object_id, user["_id"]):
        return jsonify(error="Group membership required"), 403
    attachments = payload.get("attachments", [])
    if not isinstance(attachments, list) or len(attachments) > 5:
        return jsonify(error="Invalid attachments"), 400
    if not body and not attachments:
        return jsonify(error="Message or attachment is required"), 400
    record = {
        "groupId": group_object_id,
        "senderId": user["_id"],
        "body": body,
        "attachments": attachments[:5],
        "pinned": False,
        "createdAt": now_utc(),
    }
    result = database.messages.insert_one(record)
    record["_id"] = result.inserted_id
    payload = message_payload(database, record)
    socketio.emit("message_created", payload, to=f"group:{group_id}")
    return jsonify(message=payload), 201


@app.post("/api/groups/<group_id>/attachments")
@require_auth
def upload_group_attachment(user, group_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(group_id):
        return jsonify(error="Group not found"), 404
    database = get_db()
    group_object_id = ObjectId(group_id)
    if not group_member(database, group_object_id, user["_id"]):
        return jsonify(error="Group membership required"), 403
    uploaded = request.files.get("file")
    allowed_types = {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
    }
    if not uploaded or uploaded.mimetype not in allowed_types:
        return jsonify(error="Only PDF and image attachments are supported"), 400
    content = uploaded.read()
    if len(content) > 10 * 1024 * 1024:
        return jsonify(error="Attachments must be 10 MB or smaller"), 413
    file_id = gridfs_bucket.upload_from_stream(
        uploaded.filename,
        io.BytesIO(content),
        metadata={
            "kind": "group_attachment",
            "groupId": group_object_id,
            "userId": user["_id"],
            "contentType": uploaded.mimetype,
        },
    )
    return (
        jsonify(
            attachment={
                "id": str(file_id),
                "name": uploaded.filename,
                "contentType": uploaded.mimetype,
            }
        ),
        201,
    )


@app.get("/api/group-attachments/<attachment_id>")
@require_auth
def download_group_attachment(user, attachment_id):
    if not ObjectId.is_valid(attachment_id):
        return jsonify(error="Attachment not found"), 404
    try:
        stream = gridfs_bucket.open_download_stream(ObjectId(attachment_id))
    except Exception:
        return jsonify(error="Attachment not found"), 404
    metadata = stream.metadata or {}
    if metadata.get("kind") != "group_attachment" or not group_member(
        get_db(), metadata.get("groupId"), user["_id"]
    ):
        return jsonify(error="Attachment not found"), 404
    return send_file(
        io.BytesIO(stream.read()),
        mimetype=metadata.get("contentType", "application/octet-stream"),
        download_name=stream.filename,
    )


@app.post("/api/messages/<message_id>/pin")
@require_auth
def pin_message(user, message_id):
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    if not ObjectId.is_valid(message_id):
        return jsonify(error="Message not found"), 404
    database = get_db()
    record = database.messages.find_one({"_id": ObjectId(message_id)})
    if not record or not group_member(database, record["groupId"], user["_id"]):
        return jsonify(error="Message not found"), 404
    database.messages.update_one(
        {"_id": record["_id"]}, {"$set": {"pinned": not record.get("pinned", False)}}
    )
    return jsonify(success=True)


ACHIEVEMENTS = {
    "first_session": ("First Session", "Complete your first study session."),
    "ten_hours": ("Ten Hours", "Complete ten hours of study."),
    "first_quiz": ("Quiz Starter", "Complete your first quiz."),
}


@app.get("/api/achievements")
@require_auth
def list_achievements(user):
    records = (
        get_db().user_achievements.find({"userId": user["_id"]}).sort("earnedAt", -1)
    )
    return jsonify(
        achievements=[
            {
                "id": record["achievementId"],
                "name": ACHIEVEMENTS.get(
                    record["achievementId"], (record["achievementId"], "")
                )[0],
                "description": ACHIEVEMENTS.get(record["achievementId"], ("", ""))[1],
                "earnedAt": record["earnedAt"].isoformat(),
            }
            for record in records
        ]
    )


@app.get("/api/leaderboards")
@require_auth
def leaderboards(user):
    pipeline = [
        {"$match": {"status": "finished"}},
        {"$group": {"_id": "$userId", "seconds": {"$sum": "$durationSeconds"}}},
        {"$sort": {"seconds": -1}},
        {"$limit": 25},
    ]
    entries = []
    database = get_db()
    for rank, item in enumerate(database.study_sessions.aggregate(pipeline), 1):
        profile = database.users.find_one({"_id": item["_id"]})
        if profile:
            entries.append(
                {
                    "rank": rank,
                    "user": public_user(profile),
                    "hours": round(item["seconds"] / 3600, 2),
                }
            )
    return jsonify(leaderboard=entries)


@socketio.on("send_message")
def socket_send_message(data):
    if socket_rate_limited("send_message", limit=30, window_seconds=60):
        return
    user = socket_user()
    group_id = str((data or {}).get("groupId", ""))
    body = str((data or {}).get("body", "")).strip()[:2000]
    if not user or not ObjectId.is_valid(group_id) or not body:
        return
    database = get_db()
    if not group_member(database, ObjectId(group_id), user["_id"]):
        return
    record = {
        "groupId": ObjectId(group_id),
        "senderId": user["_id"],
        "body": body,
        "attachments": [],
        "pinned": False,
        "createdAt": now_utc(),
    }
    result = database.messages.insert_one(record)
    record["_id"] = result.inserted_id
    emit("message_created", message_payload(database, record), to=f"group:{group_id}")


@socketio.on("typing")
def socket_typing(data):
    if socket_rate_limited("typing", limit=120, window_seconds=60):
        return
    entry = presence_by_sid.get(request.sid)
    group_id = str((data or {}).get("groupId", ""))
    if entry and group_id and entry.get("groupId") == group_id:
        emit(
            "typing",
            {
                "userId": entry["userId"],
                "name": entry["name"],
                "isTyping": bool((data or {}).get("isTyping")),
            },
            to=f"group:{group_id}",
            include_self=False,
        )


@app.post("/api/auth/register")
@rate_limit(10, 300)
def register():
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    payload = parse_json()
    name = str(payload.get("name", "Student")).strip()[:80] or "Student"
    username = str(payload.get("username", "")).strip().lower()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    if not re.fullmatch(r"[a-z0-9_]{3,20}", username):
        return jsonify(
        error="Username must contain only lowercase letters, numbers, and underscores (3–20 characters)."
    ), 400
    if "@" not in email or len(email) > 254:
        return jsonify(error="Enter a valid email address"), 400
    if len(password) < 8 or len(password) > 128:
        return jsonify(error="Password must be between 8 and 128 characters"), 400

    user = {
        "name": name,
        "username": username,
        "email": email,
        "passwordHash": hash_password(password),
        "createdAt": now_utc(),
        "updatedAt": now_utc(),
    }
    try:
        result = get_db().users.insert_one(user)
    except DuplicateKeyError as exc:
        key_pattern = (exc.details or {}).get("keyPattern", {})
        if "email" in key_pattern:
            message = "An account with that email already exists. Try logging in instead."
        elif "username" in key_pattern:
            message = "That username is already taken. Please choose another one."
        else:
            message = "Email or username already exists."
        return jsonify(error=message), 409

    user["_id"] = result.inserted_id
    session.clear()
    session.permanent = True
    session["user_id"] = str(result.inserted_id)
    session["csrf_token"] = secrets.token_urlsafe(32)
    return jsonify(user=public_user(user)), 201


@app.post("/api/auth/login")
@rate_limit(20, 300)
def login():
    csrf_error = require_csrf()
    if csrf_error:
        return csrf_error
    payload = parse_json()
    identifier = str(payload.get("identifier", "")).strip().lower()
    password = str(payload.get("password", ""))
    user = get_db().users.find_one({
        "$or": [
            {"email": identifier},
            {"username": identifier}
        ]
    })
    if not user or not verify_password(password, user["passwordHash"]):
        return jsonify(
            error="Invalid username/email or password"
        ), 401

    migrated_hash = migrate_password(password, user["passwordHash"])
    if migrated_hash:
        get_db().users.update_one(
            {"_id": user["_id"]},
            {"$set": {"passwordHash": migrated_hash, "updatedAt": now_utc()}},
        )

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
    if not verify_password(current_password, user["passwordHash"]):
        return jsonify(error="Current password is incorrect"), 400
    if len(new_password) < 8 or len(new_password) > 128:
        return jsonify(error="Password must be between 8 and 128 characters"), 400
    get_db().users.update_one(
        {"_id": user["_id"]},
        {"$set": {"passwordHash": hash_password(new_password), "updatedAt": now_utc()}},
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
        "totalPages": (
            int(total_pages) if total_pages and total_pages.isdigit() else None
        ),
        "uploadedAt": now_utc(),
        "fileId": file_id,
    }
    get_db().pdfs.replace_one(
        {"_id": client_id, "userId": user["_id"]}, record, upsert=True
    )
    return jsonify(id=client_id, name=name, totalPages=record["totalPages"]), 201


@app.get("/api/pdfs/<pdf_id>")
@require_auth
def download_pdf(user, pdf_id):
    record = get_db().pdfs.find_one({"_id": pdf_id, "userId": user["_id"]})
    if not record:
        return jsonify(error="PDF not found"), 404
    stream = gridfs_bucket.open_download_stream(record["fileId"])
    return send_file(
        io.BytesIO(stream.read()),
        mimetype="application/pdf",
        download_name=record["name"],
    )


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
@rate_limit(30, 60)
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
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode()
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
        message = data.get("error", {}).get(
            "message", f"Gemini API error: {error.code}"
        )
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
    socketio.run(app, host="127.0.0.1", port=port)