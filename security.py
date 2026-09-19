import hashlib

import bcrypt
from werkzeug.security import check_password_hash, generate_password_hash

BCRYPT_PREFIX = "$2"


def _bcrypt_input(password):
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(password):
    return bcrypt.hashpw(_bcrypt_input(password), bcrypt.gensalt()).decode("ascii")


def verify_password(password, stored_hash):
    if stored_hash.startswith(BCRYPT_PREFIX):
        return bcrypt.checkpw(_bcrypt_input(password), stored_hash.encode("ascii"))
    return check_password_hash(stored_hash, password)


def needs_rehash(stored_hash):
    return not stored_hash.startswith(BCRYPT_PREFIX)


def migrate_password(password, stored_hash):
    if verify_password(password, stored_hash) and needs_rehash(stored_hash):
        return hash_password(password)
    return None


__all__ = ["hash_password", "verify_password", "migrate_password"]
