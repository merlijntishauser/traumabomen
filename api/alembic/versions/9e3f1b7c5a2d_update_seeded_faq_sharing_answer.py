"""update seeded faq: sharing answer, retire duplicate question

The seeded "Who can see my data?" answer said "There is no sharing feature",
which reads as a permanent limit; sharing is planned. "Can you read what I
write?" duplicates it. Fold the technical detail into one answer and
unpublish the duplicate.

Both changes are guarded on the exact seeded text, so an entry an admin has
already edited is left alone.

Revision ID: 9e3f1b7c5a2d
Revises: 7c1a9b2d4e6f
Create Date: 2026-10-03 19:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9e3f1b7c5a2d"
down_revision: str | None = "7c1a9b2d4e6f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_WHO_QUESTION_EN = "Who can see my data?"
_WHO_SEEDED_EN = (
    "Only you. Everything is encrypted on your device before it reaches "
    "our server, and your encryption key never leaves your device. There "
    "is no sharing feature and no way for us to look inside."
)
_WHO_SEEDED_NL = (
    "Alleen jij. Alles wordt op je eigen apparaat versleuteld voordat het "
    "onze server bereikt, en je encryptiesleutel verlaat je apparaat "
    "nooit. Er is geen deelfunctie en wij kunnen niet meekijken."
)
_WHO_NEW_EN = (
    "Only you. Everything is encrypted on your device with AES-256-GCM, under "
    "a key derived from your encryption key with Argon2id, before it reaches "
    "our server. We store only unreadable ciphertext and cannot look inside. "
    "Sharing a tree with someone you choose, such as a therapist, is planned "
    "but not available yet."
)
_WHO_NEW_NL = (
    "Alleen jij. Alles wordt op je eigen apparaat versleuteld met AES-256-GCM, "
    "met een sleutel die met Argon2id uit je encryptiesleutel wordt afgeleid, "
    "voordat het onze server bereikt. We bewaren alleen onleesbare cijfertekst "
    "en kunnen niet meekijken. Een boom delen met iemand die je kiest, zoals "
    "een therapeut, staat gepland maar is nog niet beschikbaar."
)

_DUP_QUESTION_EN = "Can you read what I write?"
_DUP_SEEDED_EN = (
    "No. Your entries are encrypted on your device before they reach our server, "
    "using Argon2id and AES-256-GCM. We store only unreadable ciphertext and have no "
    "way to decrypt it."
)

_faq = sa.table(
    "faq_entries",
    sa.column("question_en", sa.Text()),
    sa.column("answer_en", sa.Text()),
    sa.column("answer_nl", sa.Text()),
    sa.column("published", sa.Boolean()),
)


def _set_who_answer(from_en: str, from_nl: str, to_en: str, to_nl: str) -> None:
    op.execute(
        _faq.update()
        .where(
            _faq.c.question_en == _WHO_QUESTION_EN,
            _faq.c.answer_en == from_en,
            _faq.c.answer_nl == from_nl,
        )
        .values(answer_en=to_en, answer_nl=to_nl)
    )


def _set_duplicate_published(published: bool) -> None:
    op.execute(
        _faq.update()
        .where(
            _faq.c.question_en == _DUP_QUESTION_EN,
            _faq.c.answer_en == _DUP_SEEDED_EN,
        )
        .values(published=published)
    )


def upgrade() -> None:
    _set_who_answer(_WHO_SEEDED_EN, _WHO_SEEDED_NL, _WHO_NEW_EN, _WHO_NEW_NL)
    _set_duplicate_published(False)


def downgrade() -> None:
    _set_who_answer(_WHO_NEW_EN, _WHO_NEW_NL, _WHO_SEEDED_EN, _WHO_SEEDED_NL)
    _set_duplicate_published(True)
