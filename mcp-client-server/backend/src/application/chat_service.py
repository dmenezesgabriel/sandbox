from contextlib import AsyncExitStack

from langgraph.types import Command
from src.domain.chat.interfaces import ChatService
from src.infrastructure.graph.graph_factory import GraphFactory


class ChatServiceImpl(ChatService):
    def __init__(self, graph_factory: GraphFactory):
        self._graph_factory = graph_factory

    async def process_chat(self, thread_id: str, messages: list) -> dict:
        config = {"configurable": {"thread_id": thread_id}}
        graph = await self._graph_factory.create_graph()
        response = await graph.ainvoke({"messages": messages}, config=config)
        return response

    async def update_tool_call(self, thread_id: str, args: dict) -> dict:
        config = {"configurable": {"thread_id": thread_id}}
        graph = await self._graph_factory.create_graph()
        response = await graph.ainvoke(
            Command(resume={"action": "update", "data": args}),
            config=config,
        )
        return response

    async def provide_feedback(self, thread_id: str, feedback: str) -> dict:
        config = {"configurable": {"thread_id": thread_id}}
        graph = await self._graph_factory.create_graph()
        response = await graph.ainvoke(
            Command(resume={"action": "feedback", "data": feedback}),
            config=config,
        )
        return response

    async def continue_chat(self, thread_id: str) -> dict:
        config = {"configurable": {"thread_id": thread_id}}
        graph = await self._graph_factory.create_graph()
        response = await graph.ainvoke(
            Command(resume={"action": "continue"}),
            config=config,
        )
        return response
