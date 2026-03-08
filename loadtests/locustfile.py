"""Locust load test scenarios for Traumabomen API.

Two user classes:
- TreeUser (weight=9): reads tree data, syncs mixed payloads, saves positions
- AdminUser (weight=1): queries admin stats endpoints

Loads perf_accounts.json for tree/entity IDs. Authenticates fresh on each
user start to avoid expired JWT tokens.
"""

import json
import random
import uuid
from pathlib import Path

from locust import HttpUser, between, task

ACCOUNTS_PATH = Path(__file__).parent.parent / "scripts" / "perf_accounts.json"

with ACCOUNTS_PATH.open() as f:
    ACCOUNTS = json.load(f)

TIERS = list(ACCOUNTS["trees"].keys())

# Must match scripts/seed_perf_data.py
PASSWORD = "PerfTest1234!"


def _login(client, email: str) -> str:
    """Login and return a fresh access token."""
    resp = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    resp.raise_for_status()
    return resp.json()["access_token"]


class TreeUser(HttpUser):
    """Simulates a normal user interacting with tree data."""

    weight = 9
    wait_time = between(0.5, 2.0)

    def on_start(self) -> None:
        token = _login(self.client, ACCOUNTS["user"]["email"])
        self.headers = {"Authorization": f"Bearer {token}"}

    @task(50)
    def read_tree_data(self) -> None:
        """GET persons, relationships, events, life-events, classifications."""
        tier = random.choice(TIERS)
        tree_id = ACCOUNTS["trees"][tier]["id"]

        endpoints = [
            "persons",
            "relationships",
            "events",
            "life-events",
            "classifications",
        ]
        for ep in endpoints:
            self.client.get(
                f"/trees/{tree_id}/{ep}",
                headers=self.headers,
                name=f"GET /trees/[id]/{ep} [{tier}]",
            )

    @task(25)
    def sync_mixed_payload(self) -> None:
        """POST sync with person updates + event creates (medium/large trees)."""
        tier = random.choice(["medium", "large"])
        tree_data = ACCOUNTS["trees"][tier]
        tree_id = tree_data["id"]
        person_ids = tree_data["person_ids"]

        # 3-5 person updates
        n_updates = random.randint(3, 5)
        persons_update = [
            {
                "id": pid,
                "encrypted_data": f"perf-updated-{uuid.uuid4().hex[:8]}",
            }
            for pid in random.sample(person_ids, min(n_updates, len(person_ids)))
        ]

        # 1-2 new events
        n_events = random.randint(1, 2)
        events_create = [
            {
                "person_ids": random.sample(person_ids, min(2, len(person_ids))),
                "encrypted_data": f"perf-new-event-{uuid.uuid4().hex[:8]}",
            }
            for _ in range(n_events)
        ]

        payload = {
            "persons_update": persons_update,
            "events_create": events_create,
        }

        self.client.post(
            f"/trees/{tree_id}/sync",
            headers=self.headers,
            json=payload,
            name=f"POST /trees/[id]/sync [mixed-{tier}]",
        )

    @task(15)
    def drag_save_positions(self) -> None:
        """POST sync with persons_update only (position drag saves)."""
        tier = random.choice(TIERS)
        tree_data = ACCOUNTS["trees"][tier]
        tree_id = tree_data["id"]
        person_ids = tree_data["person_ids"]

        # 8-15 position updates (or all persons if fewer)
        n_updates = min(random.randint(8, 15), len(person_ids))
        persons_update = [
            {
                "id": pid,
                "encrypted_data": f"perf-pos-{uuid.uuid4().hex[:8]}",
            }
            for pid in random.sample(person_ids, n_updates)
        ]

        payload = {"persons_update": persons_update}

        self.client.post(
            f"/trees/{tree_id}/sync",
            headers=self.headers,
            json=payload,
            name=f"POST /trees/[id]/sync [positions-{tier}]",
        )


class AdminUser(HttpUser):
    """Simulates an admin checking dashboard stats."""

    weight = 1
    wait_time = between(1.0, 3.0)

    def on_start(self) -> None:
        token = _login(self.client, ACCOUNTS["admin"]["email"])
        self.headers = {"Authorization": f"Bearer {token}"}

    @task(1)
    def admin_stats(self) -> None:
        """GET admin stats endpoints."""
        endpoints = [
            "admin/stats/overview",
            "admin/stats/usage",
            "admin/stats/activity",
        ]
        for ep in endpoints:
            self.client.get(
                f"/{ep}",
                headers=self.headers,
                name=f"GET /{ep}",
            )
