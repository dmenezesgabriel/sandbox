from contextlib import AsyncExitStack

from copilotkit import LangGraphAgent
from src.application.graph_node_service import GraphNodeServiceImpl
from src.infrastructure.graph.graph_factory import GraphFactory
from src.infrastructure.llm.service import LLMServiceImpl


async def build_agents(context):
    llm_service = LLMServiceImpl()
    node_service = GraphNodeServiceImpl(llm_service)
    graph_factory = GraphFactory(node_service)

    async with AsyncExitStack() as stack:
        graph = await graph_factory.create_graph(stack)
        return [
            LangGraphAgent(
                name="agent",
                description="This agent does something",
                graph=graph,
            )
        ]
