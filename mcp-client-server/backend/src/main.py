from contextlib import asynccontextmanager

from copilotkit import CopilotKitRemoteEndpoint
from copilotkit.integrations.fastapi import add_fastapi_endpoint
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from src.api.chat_controller import ChatApiAdapter
from src.application.chat_service import ChatServiceImpl
from src.application.graph_node_service import GraphNodeServiceImpl
from src.infrastructure.copilotkit.copilotkit import build_agents
from src.infrastructure.graph.graph_factory import GraphFactory
from src.infrastructure.llm.service import LLMServiceImpl
from src.instrumentation import enable_telemetry

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_name = "./checkpointer.db"
    async with AsyncSqliteSaver.from_conn_string(db_name) as checkpointer:

        enable_telemetry()

        llm_service = LLMServiceImpl()
        node_service = GraphNodeServiceImpl(llm_service)
        graph_factory = GraphFactory(node_service, checkpointer)
        chat_service = ChatServiceImpl(graph_factory)
        chat_api_adapter = ChatApiAdapter(chat_service)

        app.state.agents = await build_agents({}, checkpointer)

        app.include_router(chat_api_adapter.router)
        sdk = CopilotKitRemoteEndpoint(agents=lambda _: app.state.agents)
        add_fastapi_endpoint(app, sdk, "/copilotkit")
        yield


app = FastAPI(
    title="LangChain Server",
    version="1.0",
    description="A simple api server using Langchain's Runnable interfaces",
    lifespan=lifespan,
    debug=True,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)
