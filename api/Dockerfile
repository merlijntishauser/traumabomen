FROM python:3.13-slim AS dev
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

COPY pyproject.toml uv.lock* ./
RUN uv sync

COPY . .

FROM dev AS build
RUN uv sync --no-dev

FROM dhi.io/python:3.13 AS production
WORKDIR /app

ENV PYTHONPATH=/app/site-packages
COPY --from=build /app/.venv/lib/python3.13/site-packages /app/site-packages
COPY --from=build /app .

EXPOSE 8000
CMD ["python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
