import argparse
import json
import os
from abc import ABC
from enum import Enum
from typing import Any, Dict, List

import duckdb
import litellm
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel

ToolCall = Dict[str, Any]

load_dotenv()

console = Console()

con = duckdb.connect(":default:")


class FileTypes(Enum):
    CSV = "csv"
    JSON = "json"
    PARQUET = "parquet"
    AVRO = "avro"


class LLMConfig:
    model_name: str
    temperature: float
    max_tokens: int | None
    timeout: int | None
    max_retries: int


class LLMProviderStrategy(ABC):
    def create_model(self, config: LLMConfig) -> Any:
        raise NotImplementedError(
            "This method should be overridden by subclasses."
        )


def parse_file_paths(file_paths_string: str) -> List[str]:
    return [
        path.strip() for path in file_paths_string.split(",") if path.strip()
    ]


def get_file_type(file_path: str) -> FileTypes:
    _, ext = os.path.splitext(file_path)
    ext = ext.lower().lstrip(".")
    if ext in FileTypes._value2member_map_:
        return FileTypes(ext)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def get_file_name(file_path: str) -> str:
    return os.path.splitext(os.path.basename(file_path))[0]


def ingest_csv_dataset(con: duckdb.DuckDBPyConnection, file_path: str) -> None:
    file_name = get_file_name(file_path)
    con.execute(
        f"CREATE OR REPLACE TABLE {file_name}"
        f" AS SELECT * FROM read_csv_auto('{file_path}')"
    )


def get_ingestion_function(file_type: FileTypes):
    functions_map = {
        FileTypes.CSV: ingest_csv_dataset,
        FileTypes.JSON: None,
        FileTypes.PARQUET: None,
        FileTypes.AVRO: None,
    }
    return functions_map.get(file_type, None)


# ---- Tool Implementations ----


def list_tables(reasoning: str) -> List[str]:
    """Returns a list of tables in the database.

    The agent uses this to discover available tables and make informed decisions.

    Args:
        reasoning (str): Explanation of why we're listing tables relative to user request.

    Returns:
        List[str]: A list of table names in the DuckDB database.
    """
    try:
        con.execute("SHOW TABLES")
        tables = con.fetchall()
        result = [table[0] for table in tables]
        console.log(f"[blue]List Tables Tool[/blue] - Reasoning: {reasoning}")
        return result
    except Exception as e:
        console.log(f"[red]Error in List Tables Tool: {str(e)}[/red]")
        return []


def describe_table(reasoning: str, table_name: str) -> str:
    """Returns schema information about the specified table.

    The agent uses this to understand table structure and available columns.

    Args:
        reasoning (str): Explanation of why we need to describe this table.
        table_name (str): The name of the table to describe.

    Returns:
        str: A string describing the schema of the table.

    """
    try:
        con.execute(f"DESCRIBE {table_name}")
        schema = con.fetchall()
        result = "\n".join([f"{col[0]}: {col[1]}" for col in schema])
        console.log(
            f"[blue]Describe Table Tool[/blue] - Table: {table_name} - Reasoning: {reasoning}"
        )
        return result
    except Exception as e:
        console.log(f"[red]Error in Describe Table Tool: {str(e)}[/red]")
        return f"Error describing table {table_name}: {str(e)}"


def sample_table(reasoning: str, table_name: str, row_sample_size: int) -> str:
    """Returns a sample of rows from the specified table.

    The agent uses this to understand actual data content and patterns.

    Args:
        reasoning: Explanation of why we're sampling this table
        table_name: Name of table to sample from
        row_sample_size: Number of rows to sample aim for 3-5 rows

    Returns:
        str: String containing sample rows in readable format.
    """
    try:
        con.execute(f"SELECT * FROM {table_name} LIMIT {row_sample_size};")
        sample = con.fetchall()
        result = "\n".join([str(row) for row in sample])
        console.log(
            f"[blue]Sample Table Tool[/blue] - Table: {table_name} - Reasoning: {reasoning}"
        )
        return result
    except Exception as e:
        console.log(f"[red]Error in Sample Table Tool: {str(e)}[/red]")
        return f"Error sampling table {table_name}: {str(e)}"


def run_test_sql_query(reasoning: str, sql_query: str) -> str:
    """Executes a test SQL query and returns results.

    The agent uses this to validate queries before finalizing them.
    Results are only shown to the agent, not the user.

    Args:
        reasoning: Explanation of why we're running this test query
        sql_query: The SQL query to test

    Returns:
        str: The result of the SQL query execution.
    """
    try:
        con.execute(sql_query)
        result = con.fetchall()
        console.log(
            f"[blue]Run Test SQL Query Tool[/blue] - Query: {sql_query} - Reasoning: {reasoning}"
        )
        console.log(f"[dim]Query: {sql_query}[/dim]")
        return "\n".join([str(row) for row in result])
    except Exception as e:
        console.log(f"[red]Error in Run Test SQL Query Tool: {str(e)}[/red]")
        return f"Error executing query: {str(e)}"


def run_final_sql_query(reasoning: str, sql_query: str) -> str:
    """Executes the final SQL query and returns results to user.

    This is the last tool call the agent should make after validating the query.

    Args:
        reasoning: Final explanation of how this query satisfies user request
        sql_query: The validated SQL query to run

    Returns:
        str: The result of the final SQL query execution.
    """
    try:
        con.execute(sql_query)
        result = con.fetchall()
        console.log(
            Panel(
                f"[green]Final Query Tool[/green]\nReasoning: {reasoning}\nQuery: {sql_query}"
            )
        )
        console.log(f"[dim]Query: {sql_query}[/dim]")
        return "\n".join([str(row) for row in result])
    except Exception as e:
        console.log(f"[red]Error in Run Final SQL Query Tool: {str(e)}[/red]")
        return f"Error executing final query: {str(e)}"


#  ---- Agent prompt ----

AGENT_PROMPT = """<purpose>
    You are a world-class expert at crafting precise DuckDB SQL queries.
    Your goal is to generate accurate queries that exactly match the user's data needs.
</purpose>

<instructions>
    <instruction>Use the provided tools to explore the database and construct the perfect query.</instruction>
    <instruction>Start by listing tables to understand what's available.</instruction>
    <instruction>Describe tables to understand their schema and columns.</instruction>
    <instruction>Sample tables to see actual data patterns.</instruction>
    <instruction>Test queries before finalizing them.</instruction>
    <instruction>Only call run_final_sql_query when you're confident the query is perfect.</instruction>
    <instruction>Be thorough but efficient with tool usage.</instruction>
    <instruction>If you find your run_test_sql_query tool call returns an error or won't satisfy the user request, try to fix the query or try a different query.</instruction>
    <instruction>Think step by step about what information you need.</instruction>
    <instruction>Be sure to specify every parameter for each tool call.</instruction>
    <instruction>Every tool call should have a reasoning parameter which gives you a place to explain why you are calling the tool.</instruction>
</instructions>

<tools>
    <tool>
        <name>list_tables</name>
        <description>Returns list of available tables in database</description>
        <parameters>
            <parameter>
                <name>reasoning</name>
                <type>string</type>
                <description>Why we need to list tables relative to user request</description>
                <required>true</required>
            </parameter>
        </parameters>
    </tool>

    <tool>
        <name>describe_table</name>
        <description>Returns schema info for specified table</description>
        <parameters>
            <parameter>
                <name>reasoning</name>
                <type>string</type>
                <description>Why we need to describe this table</description>
                <required>true</required>
            </parameter>
            <parameter>
                <name>table_name</name>
                <type>string</type>
                <description>Name of table to describe</description>
                <required>true</required>
            </parameter>
        </parameters>
    </tool>

    <tool>
        <name>sample_table</name>
        <description>Returns sample rows from specified table, always specify row_sample_size</description>
        <parameters>
            <parameter>
                <name>reasoning</name>
                <type>string</type>
                <description>Why we need to sample this table</description>
                <required>true</required>
            </parameter>
            <parameter>
                <name>table_name</name>
                <type>string</type>
                <description>Name of table to sample</description>
                <required>true</required>
            </parameter>
            <parameter>
                <name>row_sample_size</name>
                <type>integer</type>
                <description>Number of rows to sample aim for 3-5 rows</description>
                <required>true</required>
            </parameter>
        </parameters>
    </tool>

    <tool>
        <name>run_test_sql_query</name>
        <description>Tests a SQL query and returns results (only visible to agent)</description>
        <parameters>
            <parameter>
                <name>reasoning</name>
                <type>string</type>
                <description>Why we're testing this specific query</description>
                <required>true</required>
            </parameter>
            <parameter>
                <name>sql_query</name>
                <type>string</type>
                <description>The SQL query to test</description>
                <required>true</required>
            </parameter>
        </parameters>
    </tool>

    <tool>
        <name>run_final_sql_query</name>
        <description>Runs the final validated SQL query and shows results to user</description>
        <parameters>
            <parameter>
                <name>reasoning</name>
                <type>string</type>
                <description>Final explanation of how query satisfies user request</description>
                <required>true</required>
            </parameter>
            <parameter>
                <name>sql_query</name>
                <type>string</type>
                <description>The validated SQL query to run</description>
                <required>true</required>
            </parameter>
        </parameters>
    </tool>
</tools>

<user-request>
    {{user_request}}
</user-request>
"""

# ---- Tool Schema ----

tools = [
    {
        "type": "function",
        "function": {
            "name": "list_tables",
            "description": "Returns list of available tables in database",
            "parameters": {
                "type": "object",
                "properties": {
                    "reasoning": {
                        "type": "string",
                        "description": "Explanation for listing tables",
                    }
                },
                "required": ["reasoning"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "describe_table",
            "description": "Returns schema info for specified table",
            "parameters": {
                "type": "object",
                "properties": {
                    "reasoning": {
                        "type": "string",
                        "description": "Why we need to describe this table",
                    },
                    "table_name": {
                        "type": "string",
                        "description": "Name of table to describe",
                    },
                },
                "required": ["reasoning", "table_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "sample_table",
            "description": "Returns sample rows from specified table",
            "parameters": {
                "type": "object",
                "properties": {
                    "reasoning": {
                        "type": "string",
                        "description": "Why we need to sample this table",
                    },
                    "table_name": {
                        "type": "string",
                        "description": "Name of table to sample",
                    },
                    "row_sample_size": {
                        "type": "integer",
                        "description": "Number of rows to sample aim for 3-5 rows",
                    },
                },
                "required": ["reasoning", "table_name", "row_sample_size"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_test_sql_query",
            "description": "Tests a SQL query and returns results (only visible to agent)",
            "parameters": {
                "type": "object",
                "properties": {
                    "reasoning": {
                        "type": "string",
                        "description": "Why we're testing this specific query",
                    },
                    "sql_query": {
                        "type": "string",
                        "description": "The SQL query to test",
                    },
                },
                "required": ["reasoning", "sql_query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_final_sql_query",
            "description": "Runs the final validated SQL query and shows results to user",
            "parameters": {
                "type": "object",
                "properties": {
                    "reasoning": {
                        "type": "string",
                        "description": "Final explanation of how query satisfies user request",
                    },
                    "sql_query": {
                        "type": "string",
                        "description": "The validated SQL query to run",
                    },
                },
                "required": ["reasoning", "sql_query"],
            },
        },
    },
]


#  ---- Main Loop ----


def main():
    parser = argparse.ArgumentParser(description="DuckDB Agent")
    parser.add_argument(
        "-f",
        "--files",
        type=str,
        help="Path to the files, separated by commas if multiple",
        required=True,
    )
    parser.add_argument(
        "-p", "--prompt", type=str, help="The user's request", required=True
    )
    parser.add_argument(
        "-c",
        "--compute",
        type=int,
        help="Max agent loops",
        default=10,
        required=True,
    )
    args = parser.parse_args()

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        console.print(
            "[red]Error: GEMINI_API_KEY environment variable is not set[/red]"
        )
    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY

    file_paths = parse_file_paths(args.files)
    for file_path in file_paths:
        file_type = get_file_type(file_path)
        ingestion_function = get_ingestion_function(file_type)
        ingestion_function(con, file_path)

    complete_prompt = AGENT_PROMPT.replace("{{user_request}}", args.prompt)

    messages = [{"role": "user", "content": complete_prompt}]

    available_functions = {
        "list_tables": list_tables,
        "describe_table": describe_table,
        "sample_table": sample_table,
        "run_test_sql_query": run_test_sql_query,
        "run_final_sql_query": run_final_sql_query,
    }

    compute_iterations = 0
    while True:
        compute_iterations += 1
        console.rule(
            f"[yellow]Agent Loop {compute_iterations}/{args.compute}[/yellow]"
        )

        if compute_iterations >= int(args.compute):
            console.print(f"[yellow]Reached max compute loops[/yellow]")
            break

        response = litellm.completion(
            model="gemini/gemini-2.0-flash",
            messages=messages,
            tools=tools,
            tool_choice="required",
        )

        choice = response.choices[0].message
        tool_calls = getattr(choice, "tool_calls", None)

        if tool_calls:
            messages.append(
                {
                    "role": "assistant",
                    "content": getattr(choice, "content", ""),
                    "tool_calls": [
                        {
                            "id": tool_call.id,
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments,
                                "type": "function",
                            },
                        }
                        for tool_call in tool_calls
                    ],
                    "function_call": getattr(choice, "function_call", None),
                }
            )
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_args_str = tool_call.function.arguments
                function_args = json.loads(function_args_str)
                console.print(
                    f"[blue]Function Call:[/blue] {function_name}({function_args})"
                )
                function_to_call = available_functions.get(function_name)
                if function_to_call:
                    result = function_to_call(**function_args)
                    if function_name == "run_final_sql_query":
                        console.print("\n[green]Final Results:[/green]")
                        console.print(result)
                        return
                else:
                    result = f"Unknown function: {function_name}"

                if tool_call.id:
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": json.dumps({"result": result}),
                        }
                    )
                else:
                    console.print(
                        f"[red]Tool call ID is missing for function: {function_name}[/red]"
                    )
        else:
            if isinstance(choice, str):
                messages.append(
                    {"role": "assistant", "content": choice.content}
                )
                console.print(choice.content)
            else:
                console.print(
                    "[red]No Error: Assistant response content is not a string.[/red]"
                )


if __name__ == "__main__":
    main()
