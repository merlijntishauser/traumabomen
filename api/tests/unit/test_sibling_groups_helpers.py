"""Unit tests for sibling_groups helpers."""

import uuid

from app.routers.sibling_groups import _find_conflicting_person_ids


async def test_find_conflicting_person_ids_empty_input_returns_empty_set():
    # Returns before touching the database, so db can be None.
    result = await _find_conflicting_person_ids([], uuid.uuid4(), None)
    assert result == set()
