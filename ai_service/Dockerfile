FROM python:3.12-slim
WORKDIR /app
COPY ai_service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY ai_service ./ai_service
COPY src/data/legal-data.json src/data/legal-articles.json ./src/data/
COPY scripts/index_laws.py ./scripts/index_laws.py
ENV LAW_CATALOG=/app/src/data/legal-articles.json
EXPOSE 8000
CMD ["uvicorn", "ai_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
