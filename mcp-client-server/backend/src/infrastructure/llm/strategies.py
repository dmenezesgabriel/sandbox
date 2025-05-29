from langchain_core.language_models.chat_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from src.domain.llm.models import LLMConfig


class GoogleLLMStrategy:
    def create_model(self, config: LLMConfig) -> BaseChatModel:
        return ChatGoogleGenerativeAI(
            model=config.model_name,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
            timeout=config.timeout,
            max_retries=config.max_retries,
        )


class AzureLLMStrategy:
    def create_model(self, config: LLMConfig) -> BaseChatModel:
        # Azure implementation
        pass
