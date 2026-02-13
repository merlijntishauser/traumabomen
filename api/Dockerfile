FROM python:3.13-slim AS dev
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

COPY pyproject.toml uv.lock* ./
RUN uv sync

COPY . .

FROM dhi.io/python:3.13 AS production
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev

COPY . .

RUN adduser --disabled-password --no-create-home appuser
USER appuser

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
