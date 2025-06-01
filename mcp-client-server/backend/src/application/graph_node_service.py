import json
from typing import Literal, Protocol

from langgraph.types import Command, interrupt
from loguru import logger
from src.domain.chat.interfaces import GraphNodeService
from src.domain.llm.interfaces import LLMProvider, LLMService
from src.type_definitions import GraphState


class ReviewActionStrategy(Protocol):
    def execute(self) -> Command: ...


class ContinueStrategy:
    def execute(self) -> Command:
        return Command(goto="run_tool")


class UpdateStrategy:
    def __init__(self, last_message, tool_call, review_data):
        self.last_message = last_message
        self.tool_call = tool_call
        self.review_data = review_data

    def execute(self) -> Command:
        updated_message = {
            "role": "ai",
            "content": self.last_message.content,
            "tool_calls": [
                {
                    "id": self.tool_call["id"],
                    "name": self.tool_call["name"],
                    "args": self.review_data,
                }
            ],
            "id": self.last_message.id,
        }
        return Command(goto="run_tool", update={"messages": [updated_message]})


class FeedbackStrategy:
    def __init__(self, tool_call, review_data):
        self.tool_call = tool_call
        self.review_data = review_data

    def execute(self) -> Command:
        tool_message = {
            "role": "tool",
            "content": self.review_data,
            "name": self.tool_call["name"],
            "tool_call_id": self.tool_call["id"],
        }
        return Command(goto="call_llm", update={"messages": [tool_message]})


def get_review_action_strategy_class(review_action: str):
    review_action_strategy_classes = {
        "continue": ContinueStrategy,
        "update": UpdateStrategy,
        "feedback": FeedbackStrategy,
    }

    return review_action_strategy_classes.get(review_action)


class GraphNodeServiceImpl(GraphNodeService):
    def __init__(self, llm_service: LLMService):
        self._llm_service = llm_service
        self._tools = None
        self._frontend_actions = None

    def get_frontend_actions(self, state: GraphState):
        if self._frontend_actions is not None:
            return self._frontend_actions

        copilotkit = state.get("copilotkit", {})
        self._frontend_actions = copilotkit.get("actions", [])
        return self._frontend_actions

    def call_llm(self, state: GraphState, tools) -> GraphState:
        llm = self._llm_service.get_chat_model(LLMProvider.GOOGLE)
        self._tools = tools

        copilotkit_actions = self.get_frontend_actions(state)
        self._tools = [*copilotkit_actions, *tools]

        response = llm.bind_tools(self._tools).invoke(state["messages"])
        return {"messages": response}

    def human_review_node(
        self,
        state: GraphState,
    ) -> Command[Literal["call_llm", "run_tool"]]:
        last_message = state["messages"][-1]
        tool_call = last_message.tool_calls[-1]

        human_review = interrupt(
            {
                "type": "human_review",
                "question": "Continue?",
                "tool_call": tool_call,
            }
        )

        if isinstance(human_review, str):
            json_review = json.loads(human_review)
            human_review = json_review

        review_action = human_review["action"]
        review_data = human_review.get("data")

        strategy_cls = get_review_action_strategy_class(review_action)
        if not strategy_cls:
            raise ValueError(f"Unknown review_action: {review_action}")

        strategy_args = {
            "continue": (),
            "update": (last_message, tool_call, review_data),
            "feedback": (tool_call, review_data),
        }
        strategy = strategy_cls(*strategy_args[review_action])
        return strategy.execute()

    async def run_tool(self, state: GraphState, tools):
        new_messages = []
        tool_calls = state["messages"][-1].tool_calls

        for tool_call in tool_calls:
            tool = next(
                (tool for tool in tools if tool.name == tool_call["name"]),
                None,
            )
            result = await tool.ainvoke(tool_call["args"])
            new_messages.append(
                {
                    "role": "tool",
                    "name": tool_call["name"],
                    "content": result,
                    "tool_call_id": tool_call["id"],
                }
            )
        return {"messages": new_messages}

    def route_after_llm(self, state):
        if len(state["messages"][-1].tool_calls) == 0:
            return "END"

        frontend_actions_names = [
            action["name"] for action in self.get_frontend_actions(state)
        ]

        if (
            state["messages"][-1].tool_calls[-1]["name"]
            in frontend_actions_names
        ):
            return "END"

        if state["messages"][-1].tool_calls[-1]["name"] in [
            "create_Table",
            "insert_data",
        ]:
            return "human_review_node"
        return "run_tool"
