import sqlite3
from pathlib import Path

from loguru import logger
from mcp.server.fastmcp import FastMCP

current_dir = Path(__file__).parent
db_path = current_dir.parent.parent / "database.db"

mcp = FastMCP("SQL Agent Server")


@mcp.tool()
def create_table(table_name:str, attributes: str) -> str:
    """Create a table in the database."""
    logger.info(f"Creating table {table_name} with attributes {attributes}")
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(f"CREATE TABLE IF NOT EXISTS {table_name} ({attributes})")
        conn.commit()
        return f"Table {table_name} created successfully."
    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        conn.close()

@mcp.tool()
def insert_data(table_name: str, values: str) -> str:
    """Insert data into a table."""
    logger.info(f"Inserting data into {table_name} with values {values}")
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(f"INSERT INTO {table_name} VALUES ({values})")
        conn.commit()
        return f"Data inserted into {table_name} successfully."
    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        conn.close()

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
