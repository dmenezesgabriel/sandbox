# src/infrastructure/graph/graph_factory.py
import functools
from contextlib import AsyncExitStack

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import START, StateGraph
from langgraph.graph.graph import CompiledGraph
from src.domain.chat.interfaces import GraphNodeService
from src.infrastructure.graph.utils import get_tools
from src.type_definitions import GraphState


class GraphFactory:

    def __init__(
        self,
        node_service: GraphNodeService,
        checkpointer: AsyncSqliteSaver,
        stack: AsyncExitStack,
    ):
        self._node_service = node_service
        self._checkpointer = checkpointer
        self._stack = stack

    async def create_graph(self) -> CompiledGraph:
        tools = await get_tools(self._stack)

        call_llm_bound = lambda state: self._node_service.call_llm(
            state, tools
        )
        run_tool_bound = functools.partial(
            self._node_service.run_tool, tools=tools
        )

        builder = StateGraph(GraphState)
        builder.add_node("call_llm", call_llm_bound)
        builder.add_node("run_tool", run_tool_bound)
        builder.add_node(
            "human_review_node", self._node_service.human_review_node
        )

        builder.add_edge(START, "call_llm")
        builder.add_conditional_edges("call_llm", self._route_after_llm)
        builder.add_edge("run_tool", "call_llm")

        graph = builder.compile(checkpointer=self._checkpointer)
        return graph

    def _route_after_llm(self, state):
        if len(state["messages"][-1].tool_calls) == 0:
            return "END"
        if state["messages"][-1].tool_calls[-1]["name"] in [
            "create_Table",
            "insert_data",
        ]:
            return "human_review_node"
        return "run_tool"
