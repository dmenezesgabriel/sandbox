import asyncio
from pathlib import Path
from pprint import pprint

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

load_dotenv()

current_dir = Path(__file__).parent
venv_python = current_dir.parent.parent / ".venv/bin/python3"
db_server_script = current_dir.parent.parent / "src/server/db_server.py"
math_server_script = current_dir.parent.parent / "src/server/math_server.py"

model = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)


async def run_agent():
    async with MultiServerMCPClient(
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
    ) as client:
        agent = create_react_agent(model, client.get_tools())
        response = await agent.ainvoke({"messages": "show the available tables on sqlite database"})
        pprint(response)

if __name__ == "__main__":
    result = asyncio.run(run_agent())
