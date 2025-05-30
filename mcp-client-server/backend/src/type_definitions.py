from typing import Annotated, TypedDict

from copilotkit import CopilotKitState
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

# class GraphState(TypedDict, total=False):


class GraphState(CopilotKitState):
    """
    @see https://langchain-ai.github.io/langgraph/concepts/low_level/#serialization
    """

    messages: Annotated[list[AnyMessage], add_messages]
