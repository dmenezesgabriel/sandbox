import asyncio
from contextlib import AsyncExitStack

from main import get_tools

# print (get_tools) result


async def print_tools():
    async with stack:
        tools = await get_tools(stack)
        tool = next((tool for tool in tools if tool.name == "add"), None)
        print(tool.name)
        print(await tool.ainvoke({"a": 1, "b": 2}))


if __name__ == "__main__":
    stack = AsyncExitStack()
    asyncio.run(print_tools())
