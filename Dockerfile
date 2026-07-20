# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build          # outputs /web/dist

# ---- Stage 2: Python backend that also serves the built frontend ----
FROM python:3.11-slim
WORKDIR /app

# fonts help PDF/handwriting rendering; kept minimal
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
# copy the frontend build to where main.py serves it (./static)
COPY --from=web /web/dist ./static

ENV PYTHONUNBUFFERED=1 \
    AUTO_SEED=true \
    LLM_PROVIDER=mock \
    UPLOAD_DIR=/app/uploads

EXPOSE 8000
# Render/Fly provide $PORT; default to 8000 locally
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
