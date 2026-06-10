"""seed three more faq entries

Revision ID: 7c1a9b2d4e6f
Revises: 34cd55d04bad
Create Date: 2026-06-10 19:40:00.000000

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7c1a9b2d4e6f"
down_revision: str | None = "34cd55d04bad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Question texts double as the downgrade selector; keep them in sync.
_QUESTIONS_EN = [
    "What is intergenerational trauma?",
    "Who can see my data?",
    "Can I delete my data?",
]


def upgrade() -> None:
    faq_table = sa.table(
        "faq_entries",
        sa.column("id", sa.Uuid()),
        sa.column("question_en", sa.Text()),
        sa.column("answer_en", sa.Text()),
        sa.column("question_nl", sa.Text()),
        sa.column("answer_nl", sa.Text()),
        sa.column("sort_order", sa.Integer()),
        sa.column("published", sa.Boolean()),
    )
    seed = [
        {
            "question_en": _QUESTIONS_EN[0],
            "answer_en": (
                "Hardship that echoes from one generation to the next. Events in the "
                "lives of parents and grandparents can shape how a family talks, "
                "copes, and connects, long after the events themselves. Mapping them "
                "can make those echoes visible."
            ),
            "question_nl": "Wat is intergenerationeel trauma?",
            "answer_nl": (
                "Leed dat doorklinkt van de ene generatie naar de volgende. "
                "Gebeurtenissen in de levens van ouders en grootouders kunnen bepalen "
                "hoe een familie praat, omgaat met moeilijkheden en zich verbindt, "
                "lang nadat de gebeurtenissen zelf voorbij zijn. Door ze in kaart te "
                "brengen worden die echo's zichtbaar."
            ),
        },
        {
            "question_en": _QUESTIONS_EN[1],
            "answer_en": (
                "Only you. Everything is encrypted on your device before it reaches "
                "our server, and your encryption key never leaves your device. There "
                "is no sharing feature and no way for us to look inside."
            ),
            "question_nl": "Wie kan mijn gegevens zien?",
            "answer_nl": (
                "Alleen jij. Alles wordt op je eigen apparaat versleuteld voordat het "
                "onze server bereikt, en je encryptiesleutel verlaat je apparaat "
                "nooit. Er is geen deelfunctie en wij kunnen niet meekijken."
            ),
        },
        {
            "question_en": _QUESTIONS_EN[2],
            "answer_en": (
                "Yes. You can delete individual entries, whole trees, or your entire "
                "account in settings. Deleting your account permanently removes all "
                "associated data from our systems."
            ),
            "question_nl": "Kan ik mijn gegevens verwijderen?",
            "answer_nl": (
                "Ja. Je kunt losse notities, hele bomen of je volledige account "
                "verwijderen in de instellingen. Als je je account verwijdert, worden "
                "alle bijbehorende gegevens permanent uit onze systemen verwijderd."
            ),
        },
    ]
    op.bulk_insert(
        faq_table,
        [
            {**row, "id": uuid.uuid4(), "sort_order": i, "published": True}
            for i, row in enumerate(seed, start=5)
        ],
    )


def downgrade() -> None:
    questions = ", ".join(f"'{q}'" for q in _QUESTIONS_EN)
    op.execute(f"DELETE FROM faq_entries WHERE question_en IN ({questions})")  # noqa: S608
