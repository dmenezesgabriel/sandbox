from contextlib import AsyncExitStack
from pathlib import Path
from typing import List

from langchain_mcp_adapters.client import BaseTool, MultiServerMCPClient

current_dir = Path(__file__).parent.parent.parent
venv_python = current_dir.parent / ".venv/bin/python3"
db_server_script = current_dir.parent / "src/mcp/db_server.py"
math_server_script = current_dir.parent / "src/mcp/math_server.py"


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
