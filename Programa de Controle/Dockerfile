FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --no-cache-dir "psycopg[binary]==3.2.9"

COPY . .

CMD ["sh", "-c", "SERVER=$(find /app -name server.py -print -quit); if [ -z \"$SERVER\" ]; then echo 'server.py nao encontrado'; find /app -maxdepth 4 -type f; exit 1; fi; APP_DIR=$(dirname \"$SERVER\"); cd \"$APP_DIR\" && exec python server.py"]
