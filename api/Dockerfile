FROM python:3.14-slim AS dev
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock* ./
RUN uv sync

COPY . .

FROM dev AS build
RUN uv sync --no-dev

FROM dhi.io/python:3.14 AS production
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/site-packages
COPY --from=build /app/.venv/lib/python3.14/site-packages /app/site-packages
COPY --from=build /app .

EXPOSE 8000
CMD ["python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
