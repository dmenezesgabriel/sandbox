from contextlib import AsyncExitStack

from copilotkit import LangGraphAgent


async def build_agents(context, graph_factory):
    async with AsyncExitStack() as stack:
        graph = await graph_factory.create_graph(stack)
        return [
            LangGraphAgent(
                name="agent",
                description="This agent does something",
                graph=graph,
            )
        ]
