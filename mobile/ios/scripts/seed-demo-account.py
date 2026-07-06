"""Seed a local dev account for iOS app development.

Creates (or recreates) an e2e- prefixed account against the compose stack
with a tree, a wrapped key ring, and a few journal entries encrypted in the
real client format (libsodium Argon2id + AES-256-GCM), so the app has
something true to log into.

Run: /tmp/spike-venv/bin/python seed-demo-account.py
(venv: python3 -m venv /tmp/spike-venv && pip install pynacl cryptography requests
 or use urllib as below; no requests needed)
"""

import base64
import json
import os
import urllib.request

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from nacl import bindings

API = os.environ.get("TRAUMABOMEN_LIVE_API", "http://localhost:8000")
EMAIL = "e2e-ios@example.org"
PASSWORD = "iOS-demo-Password1"
PASSPHRASE = "stille-boom-1938"

ENTRIES = [
    {"title": "Zondagochtend", "content": "Wat nooit werd gezegd, wist iedereen. Vandaag voor het eerst opgeschreven."},
    {"title": "Na het telefoontje met mama", "content": "Ze noemde oma's verhuizing weer 'die toestand'. Drie generaties en hetzelfde woord."},
    {"title": "Keerpunt", "content": "Besloten dat stilte niet hetzelfde is als rust. Dit is het begin."},
]


def call(method, path, body=None, token=None):
    req = urllib.request.Request(f"{API}{path}", method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path} -> {e.code}: {e.read().decode()[:200]}")


def encrypt_for_api(obj, key):
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, json.dumps(obj).encode(), None)
    return json.dumps({"iv": base64.b64encode(iv).decode(), "ciphertext": base64.b64encode(ct).decode()})


def main():
    salt = os.urandom(16)
    call("POST", "/auth/register", {
        "email": EMAIL, "password": PASSWORD,
        "encryption_salt": base64.b64encode(salt).decode(),
        "passphrase_hint": "boomsoort en jaartal",
    })
    tokens = call("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})
    access = tokens["access_token"]

    master = bindings.crypto_pwhash_alg(
        outlen=32, passwd=PASSPHRASE.encode(), salt=salt,
        opslimit=3, memlimit=65536 * 1024,
        alg=bindings.crypto_pwhash_ALG_ARGON2ID13,
    )
    tree_key = os.urandom(32)
    tree = call("POST", "/trees", {"encrypted_data": encrypt_for_api({"name": "Familie Van Dijk"}, tree_key)}, access)
    tree_id = tree["id"]
    call("PUT", "/auth/key-ring", {
        "encrypted_key_ring": encrypt_for_api({tree_id: base64.b64encode(tree_key).decode()}, master),
    }, access)

    for entry in ENTRIES:
        call("POST", f"/trees/{tree_id}/journal", {"encrypted_data": encrypt_for_api(entry, tree_key)}, access)

    print(f"seeded {EMAIL} / {PASSWORD}")
    print(f"passphrase: {PASSPHRASE} (hint: boomsoort en jaartal)")
    print(f"tree {tree_id} with {len(ENTRIES)} journal entries")


if __name__ == "__main__":
    main()
