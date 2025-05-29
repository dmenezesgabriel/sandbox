from abc import ABC, abstractmethod
from typing import AsyncGenerator

from langgraph.types import Command
from src.type_definitions import GraphState


class ChatService(ABC):
    @abstractmethod
    async def process_chat(self, thread_id: str, messages: list) -> dict:
        pass

    @abstractmethod
    async def update_tool_call(self, thread_id: str, args: dict) -> dict:
        pass

    @abstractmethod
    async def provide_feedback(self, thread_id: str, feedback: str) -> dict:
        pass

    @abstractmethod
    async def continue_chat(self, thread_id: str) -> dict:
        pass


class GraphNodeService(ABC):
    @abstractmethod
    def call_llm(self, state: GraphState, tools) -> GraphState:
        pass

    @abstractmethod
    def human_review_node(self, state: GraphState) -> Command:
        pass

    @abstractmethod
    async def run_tool(self, state: GraphState, tools):
        pass
