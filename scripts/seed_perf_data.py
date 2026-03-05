#!/usr/bin/env python3
"""Seed performance test data for load testing.

Creates two accounts (user + admin), three trees (small/medium/large) with
proportional entity counts. Outputs perf_accounts.json for Locust consumption.

Run from project root: python3 scripts/seed_perf_data.py
"""

import json
import subprocess
import sys
import uuid
from pathlib import Path

try:
    import httpx
except ImportError:
    print("httpx is required: pip install httpx>=0.28.0")
    sys.exit(1)

BASE_URL = "http://localhost:8000"
OUTPUT_PATH = Path(__file__).parent / "perf_accounts.json"

USER_EMAIL = "perf-user@example.com"
ADMIN_EMAIL = "perf-admin@example.com"
PASSWORD = "PerfTest1234!"
ENCRYPTION_SALT = "perf-test-salt-deterministic"

TIERS = {
    "small": {
        "persons": 8,
        "relationships": 10,
        "events": 5,
        "life_events": 4,
        "classifications": 2,
    },
    "medium": {
        "persons": 30,
        "relationships": 40,
        "events": 20,
        "life_events": 15,
        "classifications": 8,
    },
    "large": {
        "persons": 80,
        "relationships": 110,
        "events": 50,
        "life_events": 40,
        "classifications": 20,
    },
}


def register_account(client: httpx.Client, email: str) -> None:
    """Register an account, ignoring 409 if it already exists."""
    resp = client.post(
        f"{BASE_URL}/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "encryption_salt": ENCRYPTION_SALT,
        },
    )
    if resp.status_code == 201:
        print(f"  Registered {email}")
    elif resp.status_code == 409:
        print(f"  {email} already exists (409), skipping")
    else:
        resp.raise_for_status()


def promote_admin(email: str) -> None:
    """Promote a user to admin via direct DB update."""
    sql = f"UPDATE users SET is_admin = TRUE WHERE email = '{email}';"
    result = subprocess.run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "db",
            "psql",
            "-U",
            "traumabomen",
            "-d",
            "traumabomen",
            "-c",
            sql,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  Warning: promote admin failed: {result.stderr}")
    else:
        print(f"  Promoted {email} to admin")


def login(client: httpx.Client, email: str) -> str:
    """Login and return the access token."""
    resp = client.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    print(f"  Logged in as {email}")
    return token


def delete_existing_trees(client: httpx.Client, token: str) -> None:
    """Delete all existing trees for idempotency."""
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get(f"{BASE_URL}/trees", headers=headers)
    resp.raise_for_status()
    trees = resp.json()
    for tree in trees:
        tree_id = tree["id"]
        del_resp = client.delete(f"{BASE_URL}/trees/{tree_id}", headers=headers)
        if del_resp.status_code in (200, 204):
            print(f"  Deleted existing tree {tree_id}")


def create_tree(client: httpx.Client, token: str, tier: str) -> str:
    """Create a tree and return its ID."""
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post(
        f"{BASE_URL}/trees",
        headers=headers,
        json={"encrypted_data": f"perf-tree-{tier}"},
    )
    resp.raise_for_status()
    tree_id = resp.json()["id"]
    print(f"  Created {tier} tree: {tree_id}")
    return tree_id


def build_sync_payload(tier: str, counts: dict) -> tuple[dict, dict]:
    """Build a sync payload with pre-generated UUIDs.

    Returns (payload, ids_map) where ids_map contains all generated IDs.
    """
    person_ids = [str(uuid.uuid4()) for _ in range(counts["persons"])]
    relationship_ids = [str(uuid.uuid4()) for _ in range(counts["relationships"])]
    event_ids = [str(uuid.uuid4()) for _ in range(counts["events"])]
    life_event_ids = [str(uuid.uuid4()) for _ in range(counts["life_events"])]
    classification_ids = [str(uuid.uuid4()) for _ in range(counts["classifications"])]

    # Persons
    persons_create = [
        {"id": pid, "encrypted_data": f"perf-blob-person-{i}"}
        for i, pid in enumerate(person_ids)
    ]

    # Relationships: chain persons linearly first, then fill remaining with cycled pairs
    relationships_create = []
    n_persons = len(person_ids)
    for i, rid in enumerate(relationship_ids):
        if i < n_persons - 1:
            src = person_ids[i]
            tgt = person_ids[i + 1]
        else:
            idx = i % n_persons
            src = person_ids[idx]
            tgt = person_ids[(idx + 1) % n_persons]
        relationships_create.append(
            {
                "id": rid,
                "source_person_id": src,
                "target_person_id": tgt,
                "encrypted_data": f"perf-blob-rel-{i}",
            }
        )

    # Events: each linked to 1-2 persons (cycling)
    events_create = [
        {
            "id": eid,
            "person_ids": [
                person_ids[i % n_persons],
                person_ids[(i + 1) % n_persons],
            ],
            "encrypted_data": f"perf-blob-event-{i}",
        }
        for i, eid in enumerate(event_ids)
    ]

    # Life events
    life_events_create = [
        {
            "id": lid,
            "person_ids": [person_ids[i % n_persons]],
            "encrypted_data": f"perf-blob-life-event-{i}",
        }
        for i, lid in enumerate(life_event_ids)
    ]

    # Classifications
    classifications_create = [
        {
            "id": cid,
            "person_ids": [
                person_ids[i % n_persons],
                person_ids[(i + 1) % n_persons],
            ],
            "encrypted_data": f"perf-blob-classification-{i}",
        }
        for i, cid in enumerate(classification_ids)
    ]

    payload = {
        "persons_create": persons_create,
        "persons_update": [],
        "persons_delete": [],
        "relationships_create": relationships_create,
        "relationships_update": [],
        "relationships_delete": [],
        "events_create": events_create,
        "events_update": [],
        "events_delete": [],
        "life_events_create": life_events_create,
        "life_events_update": [],
        "life_events_delete": [],
        "classifications_create": classifications_create,
        "classifications_update": [],
        "classifications_delete": [],
        "turning_points_create": [],
        "turning_points_update": [],
        "turning_points_delete": [],
        "patterns_create": [],
        "patterns_update": [],
        "patterns_delete": [],
        "journal_entries_create": [],
        "journal_entries_update": [],
        "journal_entries_delete": [],
    }

    ids_map = {
        "person_ids": person_ids,
        "relationship_ids": relationship_ids,
        "event_ids": event_ids,
        "life_event_ids": life_event_ids,
        "classification_ids": classification_ids,
    }

    return payload, ids_map


def seed_tree(
    client: httpx.Client, token: str, tree_id: str, tier: str, counts: dict
) -> dict:
    """Seed a tree with entities via the sync endpoint."""
    headers = {"Authorization": f"Bearer {token}"}
    payload, ids_map = build_sync_payload(tier, counts)

    resp = client.post(
        f"{BASE_URL}/trees/{tree_id}/sync",
        headers=headers,
        json=payload,
    )
    resp.raise_for_status()

    result = resp.json()
    created_total = (
        len(result.get("persons_created", []))
        + len(result.get("relationships_created", []))
        + len(result.get("events_created", []))
        + len(result.get("life_events_created", []))
        + len(result.get("classifications_created", []))
    )
    print(f"  Synced {tier} tree: {created_total} entities created")

    return {"id": tree_id, **ids_map}


def main() -> None:
    print("Seeding performance test data...")
    print()

    client = httpx.Client(timeout=30.0)

    # 1. Register accounts
    print("Step 1: Register accounts")
    register_account(client, USER_EMAIL)
    register_account(client, ADMIN_EMAIL)
    print()

    # 2. Promote admin
    print("Step 2: Promote admin")
    promote_admin(ADMIN_EMAIL)
    print()

    # 3. Login both accounts
    print("Step 3: Login")
    user_token = login(client, USER_EMAIL)
    admin_token = login(client, ADMIN_EMAIL)
    print()

    # 4. Delete existing trees for idempotency
    print("Step 4: Clean up existing trees")
    delete_existing_trees(client, user_token)
    print()

    # 5. Create trees and seed data
    print("Step 5: Create and seed trees")
    trees = {}
    for tier, counts in TIERS.items():
        tree_id = create_tree(client, user_token, tier)
        trees[tier] = seed_tree(client, user_token, tree_id, tier, counts)
    print()

    # 6. Write output
    output = {
        "user": {"email": USER_EMAIL, "token": user_token},
        "admin": {"email": ADMIN_EMAIL, "token": admin_token},
        "trees": trees,
    }
    OUTPUT_PATH.write_text(json.dumps(output, indent=2))
    print(f"Output written to {OUTPUT_PATH}")
    print("Done!")

    client.close()


if __name__ == "__main__":
    main()
