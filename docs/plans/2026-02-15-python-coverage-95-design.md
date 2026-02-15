# Design: Python test coverage 78% -> 95%

## Gap analysis

| File | Missed lines | Coverage | What |
|------|-------------|---------|------|
| admin.py | 113 | 21% | All 7 analytics endpoints |
| classifications.py | 49 | 33% | Full CRUD |
| auth.py (router) | 38 | 68% | Email verify, resend, password, salt, delete account |
| sync.py | 30 | 81% | Classification create/update/delete in bulk sync |
| email.py | 19 | 27% | SMTP email sending |
| auth.py (module) | 4 | 91% | Admin token claim + require_admin guard |
| relationships.py | 1 | 98% | Update source_person_id |
| config.py | 1 | 94% | Settings() instantiation |

Total: 255 missed lines out of 1176. Need <= 58 to hit 95%.

## Test plan

| File | Covers | Tests |
|------|--------|-------|
| `tests/test_admin.py` (new) | admin.py + auth admin guard | ~14 |
| `tests/test_classifications.py` (new) | classifications.py CRUD | ~10 |
| `tests/test_auth.py` (extend) | verify, resend, password, salt, delete | ~12 |
| `tests/test_sync.py` (extend) | classification sync ops | ~8 |
| `tests/test_email.py` (new) | email.py (mock SMTP) | ~4 |
| `tests/test_relationships.py` (extend) | source_person_id update | ~1 |

## Fixtures needed

- `admin_user`: User with `is_admin=True` in conftest
- `admin_headers`: Auth headers for admin user
- `login_event`: Creates LoginEvent rows for admin stats tests
