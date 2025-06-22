from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Calculator")


@mcp.tool(description="Add two numbers")
def add(a: float, b: float) -> float:
    return a + b


@mcp.tool(description="Multiply two numbers")
def multiply(a: float, b: float) -> float:
    return a * b


if __name__ == "__main__":
    mcp.run(transport="stdio")
