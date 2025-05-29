from langchain_core.language_models.chat_models import BaseChatModel
from src.domain.llm.interfaces import LLMProvider, LLMService
from src.domain.llm.models import LLMConfig
from src.infrastructure.llm.strategies import (
    AzureLLMStrategy,
    GoogleLLMStrategy,
)


class LLMServiceImpl(LLMService):
    def __init__(self):
        self._strategies = {
            LLMProvider.GOOGLE: GoogleLLMStrategy(),
            LLMProvider.AZURE: AzureLLMStrategy(),
        }
        self._configs = {
            LLMProvider.GOOGLE: LLMConfig(
                model_name="gemini-2.0-flash",
                temperature=0,
                max_tokens=None,
                timeout=None,
                max_retries=2,
            )
        }

    def get_chat_model(self, provider: LLMProvider) -> BaseChatModel:
        strategy = self._strategies.get(provider)
        config = self._configs.get(provider)
        if not strategy or not config:
            raise ValueError(f"Unsupported provider: {provider}")
        return strategy.create_model(config)
