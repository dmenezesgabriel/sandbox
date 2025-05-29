# src/dependencies.py
from fastapi import Depends
from src.application.chat_service import ChatServiceImpl
from src.application.graph_node_service import GraphNodeServiceImpl
from src.domain.chat.interfaces import ChatService, GraphNodeService
from src.domain.llm.interfaces import LLMService
from src.infrastructure.graph.graph_factory import GraphFactory
from src.infrastructure.llm.service import LLMServiceImpl


def get_llm_service() -> LLMService:
    return LLMServiceImpl()


def get_graph_node_service(
    llm_service: LLMService = Depends(get_llm_service),
) -> GraphNodeService:
    return GraphNodeServiceImpl(llm_service)


def get_graph_factory(
    node_service: GraphNodeService = Depends(get_graph_node_service),
) -> GraphFactory:
    return GraphFactory(node_service)


def get_chat_service(
    graph_factory: GraphFactory = Depends(get_graph_factory),
) -> ChatService:
    return ChatServiceImpl(graph_factory)
