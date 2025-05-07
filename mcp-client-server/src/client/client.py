import asyncio
from pathlib import Path
from pprint import pprint

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.tools import load_mcp_tools
from langgraph.prebuilt import create_react_agent
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

load_dotenv()

current_dir = Path(__file__).parent
venv_python = current_dir.parent.parent / ".venv/bin/python3"
db_server_script = current_dir.parent.parent / "src/server/db_server.py"


model = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)

server_params = StdioServerParameters(
    command=str(venv_python),
    args=[str(db_server_script)],
)


async def run_agent():
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await load_mcp_tools(session)
            print(tools)

            agent = create_react_agent(model, tools)
            agent_response = await agent.ainvoke({"messages": "use the tools at your disposal to create a simple test sqlite table with id and name attributes"})

            return agent_response

if __name__ == "__main__":
    result = asyncio.run(run_agent())
    pprint(result)