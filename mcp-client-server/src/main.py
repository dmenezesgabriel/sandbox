import asyncio
from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path
from typing import Dict, List, Union

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import (AIMessage, BaseMessage, HumanMessage,
                                     SystemMessage)
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from pydantic import BaseModel, ConfigDict

load_dotenv()

current_dir = Path(__file__).parent
venv_python = current_dir.parent / ".venv/bin/python3"
db_server_script = current_dir.parent / "src/mcp/db_server.py"
math_server_script = current_dir.parent / "src/mcp/math_server.py"


class ChatRequest(BaseModel):
    messages: List[Union[HumanMessage, AIMessage, SystemMessage]]
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
                ]
            }
        }
    )


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

    workflow = StateGraph(MessagesState)
    workflow.add_node(call_model)
    workflow.add_node(ToolNode(tools))
    workflow.add_edge(START, "call_model")
    workflow.add_conditional_edges(
        "call_model",
        tools_condition,
    )
    workflow.add_edge("tools", "call_model")
    graph = workflow.compile()
    return graph

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


@app.post("/chat/invoke")
async def chat_endpoint(request: ChatRequest):
    async with AsyncExitStack() as stack:
        graph = await create_graph(stack)
        response = await graph.ainvoke({"messages": request.messages})
        return {"messages": response["messages"]}


if __name__ == "__main__":
   uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

