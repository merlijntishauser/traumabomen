"""Tests for FAQ endpoints (public read + admin CRUD)."""

import uuid

import pytest

from app.models.faq import FAQEntry


def _entry(**overrides) -> FAQEntry:
    data = {
        "question_en": "Q en",
        "answer_en": "A en",
        "question_nl": "V nl",
        "answer_nl": "A nl",
        "sort_order": 0,
        "published": True,
    }
    data.update(overrides)
    return FAQEntry(**data)


class TestGetFaq:
    """GET /faq - public, published entries only, ordered."""

    @pytest.mark.asyncio
    async def test_public_no_auth_required(self, client):
        """The endpoint is reachable without authentication."""
        resp = await client.get("/faq")
        assert resp.status_code == 200
        assert resp.json() == {"entries": []}

    @pytest.mark.asyncio
    async def test_returns_only_published(self, client, db_session):
        """Drafts are excluded from the public response."""
        db_session.add(_entry(question_en="Shown", published=True))
        db_session.add(_entry(question_en="Hidden", published=False))
        await db_session.commit()

        resp = await client.get("/faq")
        assert resp.status_code == 200
        entries = resp.json()["entries"]
        assert len(entries) == 1
        assert entries[0]["question_en"] == "Shown"

    @pytest.mark.asyncio
    async def test_ordered_by_sort_order(self, client, db_session):
        """Entries come back in ascending sort_order."""
        db_session.add(_entry(question_en="Second", sort_order=2))
        db_session.add(_entry(question_en="First", sort_order=1))
        await db_session.commit()

        resp = await client.get("/faq")
        questions = [e["question_en"] for e in resp.json()["entries"]]
        assert questions == ["First", "Second"]

    @pytest.mark.asyncio
    async def test_includes_both_languages(self, client, db_session):
        """Both language fields are returned so the client can pick."""
        db_session.add(_entry(question_en="EN q", question_nl="NL v"))
        await db_session.commit()

        entry = (await client.get("/faq")).json()["entries"][0]
        assert entry["question_en"] == "EN q"
        assert entry["question_nl"] == "NL v"
        assert "sort_order" not in entry  # admin-only field


class TestAdminListFaq:
    """GET /admin/faq - all entries including drafts (admin only)."""

    @pytest.mark.asyncio
    async def test_returns_drafts_and_published(self, client, admin_headers, db_session):
        db_session.add(_entry(question_en="Published", published=True))
        db_session.add(_entry(question_en="Draft", published=False))
        await db_session.commit()

        resp = await client.get("/admin/faq", headers=admin_headers)
        assert resp.status_code == 200
        entries = resp.json()["entries"]
        assert len(entries) == 2
        assert {"sort_order", "published"} <= entries[0].keys()

    @pytest.mark.asyncio
    async def test_non_admin_returns_403(self, client, headers):
        resp = await client.get("/admin/faq", headers=headers)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_returns_401(self, client):
        resp = await client.get("/admin/faq")
        assert resp.status_code == 401


class TestAdminCreateFaq:
    """POST /admin/faq - create (admin only)."""

    @pytest.mark.asyncio
    async def test_creates_entry(self, client, admin_headers):
        resp = await client.post(
            "/admin/faq",
            json={
                "question_en": "New?",
                "answer_en": "Yes.",
                "question_nl": "Nieuw?",
                "answer_nl": "Ja.",
                "sort_order": 3,
                "published": True,
            },
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["question_en"] == "New?"
        assert data["published"] is True
        assert data["sort_order"] == 3
        assert uuid.UUID(data["id"])

    @pytest.mark.asyncio
    async def test_defaults_to_unpublished(self, client, admin_headers):
        resp = await client.post(
            "/admin/faq",
            json={
                "question_en": "Q",
                "answer_en": "A",
                "question_nl": "V",
                "answer_nl": "A",
            },
            headers=admin_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["published"] is False
        assert resp.json()["sort_order"] == 0

    @pytest.mark.asyncio
    async def test_empty_question_returns_422(self, client, admin_headers):
        resp = await client.post(
            "/admin/faq",
            json={"question_en": "", "answer_en": "A", "question_nl": "V", "answer_nl": "A"},
            headers=admin_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_non_admin_returns_403(self, client, headers):
        resp = await client.post(
            "/admin/faq",
            json={"question_en": "Q", "answer_en": "A", "question_nl": "V", "answer_nl": "A"},
            headers=headers,
        )
        assert resp.status_code == 403


class TestAdminUpdateFaq:
    """PUT /admin/faq/{id} - update (admin only)."""

    @pytest.mark.asyncio
    async def test_updates_fields(self, client, admin_headers, db_session):
        entry = _entry(question_en="Old", published=False, sort_order=0)
        db_session.add(entry)
        await db_session.commit()
        entry_id = entry.id

        resp = await client.put(
            f"/admin/faq/{entry_id}",
            json={
                "question_en": "Updated",
                "answer_en": "A",
                "question_nl": "V",
                "answer_nl": "A",
                "sort_order": 5,
                "published": True,
            },
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["question_en"] == "Updated"
        assert data["published"] is True
        assert data["sort_order"] == 5

    @pytest.mark.asyncio
    async def test_missing_returns_404(self, client, admin_headers):
        resp = await client.put(
            f"/admin/faq/{uuid.uuid4()}",
            json={"question_en": "Q", "answer_en": "A", "question_nl": "V", "answer_nl": "A"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_non_admin_returns_403(self, client, headers):
        resp = await client.put(
            f"/admin/faq/{uuid.uuid4()}",
            json={"question_en": "Q", "answer_en": "A", "question_nl": "V", "answer_nl": "A"},
            headers=headers,
        )
        assert resp.status_code == 403


class TestAdminDeleteFaq:
    """DELETE /admin/faq/{id} - delete (admin only)."""

    @pytest.mark.asyncio
    async def test_deletes_entry(self, client, admin_headers, db_session):
        entry = _entry()
        db_session.add(entry)
        await db_session.commit()
        entry_id = entry.id

        resp = await client.delete(f"/admin/faq/{entry_id}", headers=admin_headers)
        assert resp.status_code == 204

        # Gone from the public list too.
        assert (await client.get("/faq")).json()["entries"] == []

    @pytest.mark.asyncio
    async def test_missing_returns_404(self, client, admin_headers):
        resp = await client.delete(f"/admin/faq/{uuid.uuid4()}", headers=admin_headers)
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_non_admin_returns_403(self, client, headers):
        resp = await client.delete(f"/admin/faq/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 403
