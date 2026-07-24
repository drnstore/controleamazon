FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --no-cache-dir "psycopg[binary]==3.2.9"

COPY . .

CMD ["python", "server.py"]
