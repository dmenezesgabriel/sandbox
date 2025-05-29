# src/domain/llm/interfaces.py
from abc import ABC, abstractmethod
from enum import Enum

from langchain_core.language_models.chat_models import BaseChatModel


class LLMProvider(Enum):
    GOOGLE = "google"
    AZURE = "azure"
    OPENAI = "openai"


class LLMService(ABC):
    @abstractmethod
    def get_chat_model(self, provider: LLMProvider) -> BaseChatModel:
        pass
