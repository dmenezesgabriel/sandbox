import functools
import json
import uuid
from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path
from typing import Annotated, List, Literal, Optional, TypedDict, Union

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    AnyMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_core.runnables import RunnableConfig
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.client import BaseTool, MultiServerMCPClient
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.graph import CompiledGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.types import Command, interrupt
from loguru import logger
from openinference.instrumentation.langchain import LangChainInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter,
)
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import (
    ConsoleSpanExporter,
    SimpleSpanProcessor,
)
from pydantic import BaseModel, ConfigDict
from template import html

load_dotenv()


current_dir = Path(__file__).parent
venv_python = current_dir.parent / ".venv/bin/python3"
db_server_script = current_dir.parent / "src/mcp/db_server.py"
math_server_script = current_dir.parent / "src/mcp/math_server.py"


llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)


def enable_telemetry():
    endpoint = "http://127.0.0.1:6006/v1/traces"
    tracer_provider = trace_sdk.TracerProvider()
    trace_api.set_tracer_provider(tracer_provider)
    tracer_provider.add_span_processor(
        SimpleSpanProcessor(OTLPSpanExporter(endpoint))
    )
    tracer_provider.add_span_processor(
        SimpleSpanProcessor(ConsoleSpanExporter())
    )

    LangChainInstrumentor().instrument()


class ChatRequest(BaseModel):
    messages: List[Union[HumanMessage, AIMessage, SystemMessage]]
    thread_id: Optional[str] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "messages": [
                    {
                        "type": "system",
                        "content": (
                            "You are a helpful assistant. \n"
                            "You're provided with a list of tools, and a input from the user.\n"
                            "Your job is to determine whether or not you have a tool which can handle the users input, "
                            "or respond with plain text.\n"
                        ),
                    },
                    {"type": "human", "content": "How much is 2+2?"},
                ],
                "thread_id": str(uuid.uuid4()),
            }
        }
    )


class GraphState(TypedDict, total=False):
    """
    @see https://langchain-ai.github.io/langgraph/concepts/low_level/#serialization
    """

    messages: Annotated[list[AnyMessage], add_messages]


async def get_tools(stack: AsyncExitStack) -> List[BaseTool]:
    client = await stack.enter_async_context(
        MultiServerMCPClient(
            {
                "math": {
                    "command": str(venv_python),
                    "args": [str(math_server_script)],
                    "transport": "stdio",
                },
                "database": {
                    "command": str(venv_python),
                    "args": [str(db_server_script)],
                    "transport": "stdio",
                },
            }
        )
    )
    return client.get_tools()


def call_llm(state: GraphState, tools) -> GraphState:
    response = llm.bind_tools(tools).invoke(state["messages"])
    return {"messages": response}


def human_review_node(
    state: GraphState,
) -> Command[Literal["call_llm", "run_tool"]]:
    last_message = state["messages"][-1]
    tool_call = last_message.tool_calls[-1]

    human_review = interrupt(
        {
            "question": "Continue?",
            "tool_call": tool_call,
        }
    )

    review_action = human_review["action"]
    review_data = human_review.get("data")

    if review_action == "continue":
        return Command(goto="run_tool")

    if review_action == "update":
        updated_message = {
            "role": "ai",
            "content": last_message.content,
            "tool_calls": [
                {
                    "id": tool_call["id"],
                    "name": tool_call["name"],
                    # This the update provided by the human
                    "args": review_data,
                }
            ],
            # This is important - this needs to be the same as the message you replacing!
            # Otherwise, it will show up as a separate message
            "id": last_message.id,
        }
        return Command(goto="run_tool", update={"messages": [updated_message]})

    if review_action == "feedback":
        # NOTE: we're adding feedback message as a ToolMessage
        # to preserve the correct order in the message history
        # (AI messages with tool calls need to be followed by tool call messages)
        tool_message = {
            "role": "tool",
            # This is our natural language feedback
            "content": review_data,
            "name": tool_call["name"],
            "tool_call_id": tool_call["id"],
        }
        return Command(goto="call_llm", update={"messages": [tool_message]})


async def run_tool(state: GraphState, tools):
    new_messages = []
    tool_calls = state["messages"][-1].tool_calls

    for tool_call in tool_calls:
        tool = next(
            (tool for tool in tools if tool.name == tool_call["name"]), None
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


def route_after_llm(state) -> Literal[END, "human_review_node"]:
    if len(state["messages"][-1].tool_calls) == 0:
        return END
    return "human_review_node"


async def create_graph(stack: AsyncExitStack) -> CompiledGraph:
    """
    @see https://github.com/langchain-ai/langchain-mcp-adapters
    Implements human-in-the-loop before tool execution using LangGraph's interrupt.
    """
    db_name = f"./checkpointer.db"

    checkpointer = await stack.enter_async_context(
        AsyncSqliteSaver.from_conn_string(db_name)
    )

    tools = await get_tools(stack)

    sync_run_tools = functools.partial(
        run_tool, tools=tools
    )  # langgraph only accept sync nodes

    builder = StateGraph(GraphState)
    builder.add_node("call_llm", lambda state: call_llm(state, tools))
    builder.add_node("run_tool", sync_run_tools)
    builder.add_node(human_review_node)
    builder.add_edge(START, "call_llm")
    builder.add_conditional_edges(
        "call_llm",
        route_after_llm,
    )
    builder.add_edge("run_tool", "call_llm")

    graph = builder.compile(checkpointer=checkpointer)
    runnable = graph.with_types(input_type=ChatRequest, output_type=dict)

    return runnable


async def generate_chat_response_stream(
    stack: AsyncExitStack,
    messages: List[Union[HumanMessage, AIMessage, SystemMessage]],
    config: RunnableConfig,
):
    """
    @see https://langchain-ai.github.io/langgraph/how-tos/streaming
    """
    async with stack:
        graph = await create_graph(stack)
        tool_calls = []
        async for message_chunk, metadata in graph.astream(
            input={"messages": messages}, config=config, stream_mode="messages"
        ):

            data = {}

            if hasattr(message_chunk, "tool_calls"):
                tool_calls.extend(message_chunk.tool_calls)
            if (
                "langgraph_node" in metadata
                and metadata["langgraph_node"] == "tools"
            ):
                data = {"type": "tool", "content": message_chunk.content}
                yield f"data: {json.dumps(data)}\n\n"

            elif message_chunk.content:
                data = {"type": "message", "content": message_chunk.content}
                yield f"data: {json.dumps(data)}\n\n"


async def generate_chat_response_stream_events(
    stack: AsyncExitStack,
    messages: List[Union[HumanMessage, AIMessage, SystemMessage]],
    config: RunnableConfig,
):
    async with stack:
        graph = await create_graph(stack)
        async for event in graph.astream_events(
            input={"messages": messages},
            config=config,
            version="v1",
        ):
            # logger.debug(event)
            if event["event"] != "on_chat_model_stream":
                continue
            if not isinstance(event["data"]["chunk"], AIMessageChunk):
                continue
            message_chunk = event["data"]["chunk"]
            if not message_chunk.content:
                continue
            yield f"data: {message_chunk.content}\n\n"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for FastAPI."""
    enable_telemetry()
    yield


app = FastAPI(
    title="LangChain Server",
    version="1.0",
    description="A simple api server using Langchain's Runnable interfaces",
    lifespan=lifespan,
)

origins = [
    "http://localhost",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
async def get():
    return html


@app.post("/chat/thread", tags=["chat"])
async def create_thread():
    thread_id = str(uuid.uuid4())

    return {"thread_id": thread_id}


@app.get("/chat/thread/{thread_id}", tags=["chat"])
async def get_thread(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    stack = AsyncExitStack()
    async with stack:
        graph = await create_graph(stack)
        threads = []
        async for thread in graph.checkpointer.alist(config=config):
            threads.append(thread)

        return {"threads": threads}


@app.post("/chat/thread/{thread_id}/ask", tags=["chat"])
async def chat_endpoint(request: ChatRequest):
    config = {"configurable": {"thread_id": request.thread_id}}
    async with AsyncExitStack() as stack:
        graph = await create_graph(stack)
        response = await graph.ainvoke(
            {"messages": request.messages}, config=config
        )

        # to return only the last message:
        # return {"messages": response["messages"][-1].content}
        return response


@app.get("/chat/thread/{thread_id}/continue", tags=["chat"])
async def continue_chat(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    stack = AsyncExitStack()
    async with stack:
        graph = await create_graph(stack)
        response = await graph.ainvoke(
            Command(resume={"action": "continue"}),
            config=config,
        )

        # to return only the last message:
        # return {"messages": response["messages"][-1].content}
        return response


@app.get("/chat/thread/{thread_id}/history", tags=["chat"])
async def get_thread_history(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    stack = AsyncExitStack()

    async with stack:
        graph = await create_graph(stack)
        snapshots = []
        async for state_snapshot in graph.aget_state_history(config=config):
            snapshots.append(state_snapshot)

        return {"history": snapshots}


@app.get("/chat/thread/{thread_id}/ask/{messages}", tags=["chat"])
async def run_thread_stream(
    thread_id: str,
    messages: str,
):
    config = {"configurable": {"thread_id": thread_id}}
    stack = AsyncExitStack()
    return StreamingResponse(
        generate_chat_response_stream(
            stack=stack, messages=messages, config=config
        ),
        media_type="text/event-stream",
    )


@app.get("/chat/thread/{thread_id}/ask/{messages}/events", tags=["chat"])
async def run_thread_stream_events(
    thread_id: str,
    messages: str,
):
    config = {"configurable": {"thread_id": thread_id}}
    stack = AsyncExitStack()
    return StreamingResponse(
        generate_chat_response_stream_events(
            stack=stack, messages=messages, config=config
        ),
        media_type="text/event-stream",
    )


@app.get("/graph/mermaid", tags=["graph"])
async def get_graph_mermaid():
    async with AsyncExitStack() as stack:
        graph = await create_graph(stack)
        return Response(
            graph.get_graph().draw_mermaid(), media_type="text/plain"
        )


@app.websocket("/chat/thread/{thread_id}/ask/websocket/stream")
async def websocket_endpoint(websocket: WebSocket, thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    await websocket.accept()
    async with AsyncExitStack() as stack:
        graph = await create_graph(stack)
        while True:
            data = await websocket.receive_text()
            async for event in graph.astream(
                {"messages": [data]}, config=config, stream_mode="messages"
            ):
                await websocket.send_text(event[0].content)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
