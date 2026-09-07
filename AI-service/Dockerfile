FROM python:3.12-slim

WORKDIR /service

# Install CPU-only torch first to prevent sentence-transformers from pulling
# the massive GPU CUDA packages (~2.5 GB). CPU torch is ~200 MB and fully
# sufficient for embedding inference in a container without a GPU.
COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/service/data/hf_cache

RUN mkdir -p data/qdrant data/hf_cache

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

