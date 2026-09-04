from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GROQ_API_KEY: str | None = None
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_TIMEOUT_SECONDS: float = 30.0
    GROQ_TEMPERATURE: float = 0.2
    GROQ_MAX_TOKENS: int = 512

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5434/distrosync_ai"
    CONVERSATION_HISTORY_LIMIT: int = 20

    QDRANT_PATH: str = "./data/qdrant"
    QDRANT_URL: str | None = None
    QDRANT_API_KEY: str | None = None
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 150
    DENSE_WEIGHT: float = 0.7
    SPARSE_WEIGHT: float = 0.3
    TOP_K: int = 5

    # ERP Service Settings
    ERP_SERVICE_URL: str = "http://localhost:4002"
    ERP_SERVICE_API_KEY: str = "65c47afdd3eff0ebc554035a37dcf700e12c8fd7b634962ebf24126a5c5f08b5"
    ERP_TIMEOUT_SECONDS: float = 15.0

    # Semantic Search & Entity Resolution Settings
    SEMANTIC_SEARCH_HIGH_THRESHOLD: float = 0.85
    SEMANTIC_SEARCH_MEDIUM_THRESHOLD: float = 0.55
    SEMANTIC_SEARCH_MIN_SCORE: float = 0.45
    SEMANTIC_SEARCH_AMBIGUITY_GAP: float = 0.05
    # Dense embeddings are optional for entity lookup. The local character
    # vector fallback keeps search available without model downloads at runtime.
    SEMANTIC_SEARCH_ENABLE_EMBEDDINGS: bool = False
    SEMANTIC_SEARCH_TOP_K: int = 5

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
