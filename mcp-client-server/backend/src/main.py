import json
import uuid
from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path
from typing import List, Optional, Union

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from loguru import logger
from pydantic import BaseModel, ConfigDict
from langgraph.checkpoint.memory import InMemorySaver
from template import html

load_dotenv()

current_dir = Path(__file__).parent
venv_python = current_dir.parent / ".venv/bin/python3"
db_server_script = current_dir.parent / "src/mcp/db_server.py"
math_server_script = current_dir.parent / "src/mcp/math_server.py"


model = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)


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
                        )
                    },
                    {
                        "type": "human",
                        "content": "What's 2+2?"
                    }
                ],
                "thread_id": str(uuid.uuid4())
            }
        }
    )


async def create_graph(stack: AsyncExitStack):
    db_name = f"./checkpointer.db"

    checkpointer = await stack.enter_async_context(
        AsyncSqliteSaver.from_conn_string(db_name)
    )

    client = await stack.enter_async_context(MultiServerMCPClient(
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
    ))
    tools = client.get_tools()

    def call_model(state: MessagesState):
        response = model.bind_tools(tools).invoke(state["messages"])
        logger.info(f"Input messages to model: {state['messages']}")
        return {"messages": response}

    builder = StateGraph(MessagesState)
    builder.add_node(call_model)
    builder.add_node(ToolNode(tools))
    builder.add_edge(START, "call_model")
    builder.add_conditional_edges(
        "call_model",
        tools_condition,
    )
    builder.add_edge("tools", "call_model")

    graph = builder.compile(checkpointer=checkpointer)
    runnable = graph.with_types(input_type=ChatRequest, output_type=dict)
    return runnable


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for FastAPI."""
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

@app.post("/chat/thread")
async def create_thread():
    thread_id = str(uuid.uuid4())
    return {"thread_id": thread_id}

@app.post("/chat/thread/{thread_id}/run/stream")
async def run_thread_stream(
    request: ChatRequest,
):
    config = {"configurable": {"thread_id": request.thread_id}}
    stack = AsyncExitStack()

    async def generate_response():
        try:
            async with stack:
                graph = await create_graph(stack)
                async for chunk in graph.astream({"messages": request.messages}, config=config, stream_mode="values"):
                    if "messages" not in chunk:
                        continue
                    ai_messages = list(filter(lambda x: isinstance(x, AIMessage), chunk["messages"]))
                    if not ai_messages:
                        continue
                    if len(ai_messages[-1].content) == 0:
                        continue
                    logger.debug(ai_messages)
                    last_message = ai_messages[-1].content if ai_messages else ""
                    yield f"data: {last_message}\n\n"
        finally:
            await stack.aclose()

    return StreamingResponse(
        generate_response(),
        media_type="text/event-stream"
    )

@app.get("/chat/thread/{thread_id}/history")
async def get_thread_history(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    async with AsyncExitStack() as stack:
        graph = await create_graph(stack)
        history = []
        async for item in graph.aget_state_history(config=config):
            history.append(item)
        logger.info(history)
        return history

@app.post("/chat/invoke")
async def chat_endpoint(request: ChatRequest):
    config = {"configurable": {"thread_id": request.thread_id}}
    async with AsyncExitStack() as stack:
        graph = await create_graph(stack)
        response = await graph.ainvoke({"messages": request.messages}, config=config)
        return {"messages": response["messages"][-1].content}


@app.websocket("/chat/stream/{thread_id}")
async def websocket_endpoint(websocket: WebSocket, thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    await websocket.accept()
    async with AsyncExitStack() as stack:
        graph = await create_graph(stack)
        while True:
            data = await websocket.receive_text()
            async for event in graph.astream({"messages": [data]}, config=config, stream_mode="messages"):
                await websocket.send_text(event[0].content)


if __name__ == "__main__":
   uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
