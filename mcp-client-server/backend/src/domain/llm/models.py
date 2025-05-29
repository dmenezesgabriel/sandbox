# src/domain/llm/models.py
from dataclasses import dataclass


@dataclass
class LLMConfig:
    model_name: str
    temperature: float
    max_tokens: int | None
    timeout: int | None
    max_retries: int
