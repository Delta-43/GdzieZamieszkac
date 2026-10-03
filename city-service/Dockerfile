# City service image. Configure it by environment only (see README.md). The feedback database is a volume at /data.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 ENVIRONMENT=production FEEDBACK_DB_PATH=/data/feedback.sqlite
WORKDIR /srv

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin app && mkdir /data && chown 10001 /data
USER 10001
VOLUME /data

EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8100/v1/health', timeout=4).status == 200 else 1)"

# One worker: the rate limits and the SQLite writes stay simple. No access log: the service must not record requests.
CMD ["sh", "-c", "exec uvicorn app.main:app_from_env --factory --host 0.0.0.0 --port 8100 --no-server-header --no-access-log"]
