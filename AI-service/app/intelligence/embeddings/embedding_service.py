from sentence_transformers import SentenceTransformer
from app.core.config import settings


class EmbeddingService:
    def __init__(self):
        self.model = SentenceTransformer(settings.EMBEDDING_MODEL)

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate normalized embedding vectors for a list of text strings."""
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()
