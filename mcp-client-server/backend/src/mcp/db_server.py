import sqlite3
from pathlib import Path

from loguru import logger
from mcp.server.fastmcp import FastMCP

current_dir = Path(__file__).parent
db_path = current_dir.parent.parent / "database.db"

mcp = FastMCP("SQL Agent Server")


@mcp.tool()
def list_tables() -> str:
    """List all tables in the database."""
    logger.info("Listing all tables in the database.")
    conn = sqlite3.connect(str(db_path))
    try:
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table';"
        )
        tables = cursor.fetchall()
        return "\n".join(table[0] for table in tables)
    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        conn.close()


@mcp.tool()
def describe_table(table_name: str) -> str:
    """Describe a table in the database."""
    logger.info(f"Describing table {table_name}.")
    conn = sqlite3.connect(str(db_path))
    try:
        cursor = conn.execute(f"PRAGMA table_info({table_name});")
        columns = cursor.fetchall()
        return "\n".join(f"{col[1]}: {col[2]}" for col in columns)
    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        conn.close()


@mcp.tool()
def create_table(sql: str) -> str:
    """Create a table in the database."""
    if not sql.lower().startswith("create table"):
        raise ValueError("SQL statement must start with 'CREATE TABLE'")
    logger.info(f"Creating table with SQL: {sql}")
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(sql)
        conn.commit()
        return "Table created successfully."
    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        conn.close()


@mcp.tool()
def insert_data(sql: str) -> str:
    """Insert data into a table."""
    if not sql.lower().startswith("insert into"):
        raise ValueError("SQL statement must start with 'INSERT INTO'")
    logger.info(f"Inserting data with SQL: {sql}")
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(sql)
        conn.commit()
        return "Data inserted successfully."
    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        conn.close()


@mcp.tool()
def select_data(sql: str) -> str:
    """Execute SQL queries safely."""
    if not sql.lower().startswith("select"):
        raise ValueError("SQL statement must start with 'SELECT'")
    logger.info(f"Selecting data with SQL: {sql}")
    conn = sqlite3.connect(str(db_path))
    try:
        cursor = conn.execute(sql)
        rows = cursor.fetchall()
        return "\n".join(str(row) for row in rows)
    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        conn.close()


if __name__ == "__main__":
    print("Starting server...")
    mcp.run(transport="stdio")
