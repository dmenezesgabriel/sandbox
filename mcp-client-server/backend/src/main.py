from contextlib import asynccontextmanager

from copilotkit import CopilotKitRemoteEndpoint
from copilotkit.integrations.fastapi import add_fastapi_endpoint
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.chat_controller import router
from src.infrastructure.copilotkit.copilotkit import build_agents
from src.instrumentation import enable_telemetry

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.agents = await build_agents({})
    enable_telemetry()
    yield


app = FastAPI(
    title="LangChain Server",
    version="1.0",
    description="A simple api server using Langchain's Runnable interfaces",
    lifespan=lifespan,
    debug=True,
)


origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(router)
sdk = CopilotKitRemoteEndpoint(agents=lambda _: app.state.agents)
add_fastapi_endpoint(app, sdk, "/copilotkit")
