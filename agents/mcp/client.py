import asyncio
import json
from typing import Any, Dict

import litellm
from rich.console import Console

from mcp import ClientSession, StdioServerParameters, types
from mcp.client.stdio import stdio_client

console = Console()

server_params = StdioServerParameters(
    command="python",
    args=["server.py"],
    env=None,
)


def convert_schema(tool: types.Tool) -> Dict[str, Any]:
    return dict(
        name=tool.name,
        description=tool.description,
        parameters=tool.inputSchema,
    )


async def main():
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            mcp_tools = await session.list_tools()
            tools = list(
                map(
                    lambda tool: convert_schema(tool),
                    mcp_tools.tools,
                )
            )

            messages = [
                {"role": "user", "content": "What is the sum of 3 and 5?"},
                {"role": "user", "content": "What is 4 times 7?"},
            ]
            response = litellm.completion(
                model="gemini/gemini-2.0-flash",
                messages=messages,
                tools=tools,
            )

            choice = response.choices[0].message
            tool_calls = getattr(choice, "tool_calls", None)
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_args_str = tool_call.function.arguments
                function_args = json.loads(function_args_str)
                console.print(
                    f"Calling tool: {function_name} with args: {function_args}"
                )
                tool_result = await session.call_tool(
                    name=function_name, arguments=function_args
                )
                console.print(f"Tool result: {tool_result.content[0].text}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
