import json
import uuid
from contextlib import AsyncExitStack, asynccontextmanager
from http.client import HTTPResponse
from pathlib import Path
from typing import AsyncGenerator, List, Union

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from pydantic import BaseModel, ConfigDict
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

async def create_graph(stack: AsyncExitStack):
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
    builder.add_edge("call_model", END)
    graph = builder.compile(checkpointer=MemorySaver())
    return graph


async def stream_response(graph, messages) -> AsyncGenerator[str, None]:
    async for chunk in graph.astream({"messages": messages}):
        if "messages" in chunk:
            yield f"data: {json.dumps(chunk)}\n\n"

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

class ChatRequest(BaseModel):
    messages: List[Union[HumanMessage, AIMessage, SystemMessage]]
    thread_id: str

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "messages": [
                    {
                        "type": "system",
                        "content": "You are a helpful assistant"
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


@app.get("/", response_class=HTMLResponse)
async def get():
    return html

@app.post("/chat/invoke")
async def chat_endpoint(request: ChatRequest):
    config = {"configurable": {"thread_id": request.thread_id}}
    async with AsyncExitStack() as stack:
        graph = await create_graph(stack)
        response = await graph.ainvoke({"messages": request.messages}, config=config)
        return {"messages": response["messages"][-1].content}

@app.websocket("/chat/ws/{thread_id}")
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

