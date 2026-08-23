from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    QDRANT_PATH: str = "./data/qdrant"
    QDRANT_URL: str | None = None
    QDRANT_API_KEY: str | None = None
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 150
    DENSE_WEIGHT: float = 0.7
    SPARSE_WEIGHT: float = 0.3
    TOP_K: int = 5

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
