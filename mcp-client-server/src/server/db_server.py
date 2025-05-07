import sqlite3
from pathlib import Path

from loguru import logger
from mcp.server.fastmcp import FastMCP

current_dir = Path(__file__).parent
db_path = current_dir.parent.parent / "database.db"

mcp = FastMCP("SQL Agent Server")

@mcp.tool()
def query_data(sql: str) -> str:
    """Execute SQL queries safely."""
    logger.info(f"Executing SQL query: {sql}")
    conn = sqlite3.connect(str(db_path))
    try:
        result = conn.execute(sql).fetchall()
        conn.commit()
        return "\n".join(str(row) for row in result)
    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        conn.close()

if __name__ == "__main__":
    print("Starting server...")
    mcp.run(transport="stdio")
