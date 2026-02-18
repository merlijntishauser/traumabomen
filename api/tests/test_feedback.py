import pytest


@pytest.mark.asyncio
class TestSubmitFeedback:
    async def test_submit_feedback(self, client, headers):
        resp = await client.post(
            "/feedback",
            json={"category": "bug", "message": "Something is broken"},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data

    async def test_submit_anonymous_feedback(self, client, headers, db_session):
        resp = await client.post(
            "/feedback",
            json={"category": "feature", "message": "Add dark mode", "anonymous": True},
            headers=headers,
        )
        assert resp.status_code == 201

        # Verify user_id is null in the database
        from sqlalchemy import select

        from app.models.feedback import Feedback

        result = await db_session.execute(select(Feedback))
        feedback = result.scalar_one()
        assert feedback.user_id is None
        assert feedback.category == "feature"
        assert feedback.message == "Add dark mode"

    async def test_submit_non_anonymous_stores_user_id(self, client, headers, user, db_session):
        resp = await client.post(
            "/feedback",
            json={"category": "general", "message": "Great app"},
            headers=headers,
        )
        assert resp.status_code == 201

        from sqlalchemy import select

        from app.models.feedback import Feedback

        result = await db_session.execute(select(Feedback))
        feedback = result.scalar_one()
        assert feedback.user_id == user.id

    async def test_submit_feedback_unauthenticated(self, client):
        resp = await client.post(
            "/feedback",
            json={"category": "bug", "message": "Something is broken"},
        )
        assert resp.status_code in (401, 403)

    async def test_submit_feedback_invalid_category(self, client, headers):
        resp = await client.post(
            "/feedback",
            json={"category": "invalid", "message": "test"},
            headers=headers,
        )
        assert resp.status_code == 422

    async def test_submit_feedback_empty_message(self, client, headers):
        resp = await client.post(
            "/feedback",
            json={"category": "bug", "message": ""},
            headers=headers,
        )
        assert resp.status_code == 422

    async def test_submit_feedback_message_too_long(self, client, headers):
        resp = await client.post(
            "/feedback",
            json={"category": "bug", "message": "x" * 2001},
            headers=headers,
        )
        assert resp.status_code == 422

    async def test_submit_feedback_message_at_max_length(self, client, headers):
        resp = await client.post(
            "/feedback",
            json={"category": "bug", "message": "x" * 2000},
            headers=headers,
        )
        assert resp.status_code == 201


@pytest.mark.asyncio
class TestAdminFeedback:
    async def test_admin_get_feedback(self, client, headers, admin_headers):
        # Submit some feedback first
        await client.post(
            "/feedback",
            json={"category": "bug", "message": "Bug report"},
            headers=headers,
        )
        await client.post(
            "/feedback",
            json={"category": "feature", "message": "Feature request", "anonymous": True},
            headers=headers,
        )

        # Admin fetches feedback
        resp = await client.get("/admin/feedback", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        categories = {item["category"] for item in data["items"]}
        assert categories == {"bug", "feature"}
        # Verify anonymous feedback has no email
        anon_item = next(i for i in data["items"] if i["category"] == "feature")
        assert anon_item["user_email"] is None
        bug_item = next(i for i in data["items"] if i["category"] == "bug")
        assert bug_item["user_email"] == "test@example.com"

    async def test_admin_feedback_includes_is_read(self, client, headers, admin_headers):
        await client.post(
            "/feedback",
            json={"category": "bug", "message": "Test is_read"},
            headers=headers,
        )
        resp = await client.get("/admin/feedback", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["is_read"] is False

    async def test_admin_feedback_forbidden_for_non_admin(self, client, headers):
        resp = await client.get("/admin/feedback", headers=headers)
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestMarkFeedbackRead:
    async def test_mark_read_happy_path(self, client, headers, admin_headers):
        # Submit feedback
        submit_resp = await client.post(
            "/feedback",
            json={"category": "bug", "message": "Mark me read"},
            headers=headers,
        )
        feedback_id = submit_resp.json()["id"]

        # Mark as read
        resp = await client.patch(f"/admin/feedback/{feedback_id}/read", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_read"] is True
        assert data["id"] == feedback_id

        # Verify in list
        list_resp = await client.get("/admin/feedback", headers=admin_headers)
        item = next(i for i in list_resp.json()["items"] if i["id"] == feedback_id)
        assert item["is_read"] is True

    async def test_mark_read_not_found(self, client, admin_headers):
        resp = await client.patch(
            "/admin/feedback/00000000-0000-0000-0000-000000000000/read",
            headers=admin_headers,
        )
        assert resp.status_code == 404

    async def test_mark_read_forbidden_for_non_admin(self, client, headers):
        resp = await client.patch(
            "/admin/feedback/00000000-0000-0000-0000-000000000000/read",
            headers=headers,
        )
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestDeleteFeedback:
    async def test_delete_happy_path(self, client, headers, admin_headers, db_session):
        # Submit feedback
        submit_resp = await client.post(
            "/feedback",
            json={"category": "feature", "message": "Delete me"},
            headers=headers,
        )
        feedback_id = submit_resp.json()["id"]

        # Delete it
        resp = await client.delete(f"/admin/feedback/{feedback_id}", headers=admin_headers)
        assert resp.status_code == 204

        # Verify gone from list
        list_resp = await client.get("/admin/feedback", headers=admin_headers)
        ids = [i["id"] for i in list_resp.json()["items"]]
        assert feedback_id not in ids

    async def test_delete_not_found(self, client, admin_headers):
        resp = await client.delete(
            "/admin/feedback/00000000-0000-0000-0000-000000000000",
            headers=admin_headers,
        )
        assert resp.status_code == 404

    async def test_delete_forbidden_for_non_admin(self, client, headers):
        resp = await client.delete(
            "/admin/feedback/00000000-0000-0000-0000-000000000000",
            headers=headers,
        )
        assert resp.status_code == 403
