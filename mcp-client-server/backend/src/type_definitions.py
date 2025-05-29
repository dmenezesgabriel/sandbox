from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class GraphState(TypedDict, total=False):
    """
    @see https://langchain-ai.github.io/langgraph/concepts/low_level/#serialization
    """

    messages: Annotated[list[AnyMessage], add_messages]
