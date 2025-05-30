from copilotkit import LangGraphAgent


async def build_agents(context, graph_factory):
    graph = await graph_factory.create_graph()
    return [
        LangGraphAgent(
            name="agent",
            description="This agent does something",
            graph=graph,
        )
    ]
