import asyncio
import json
import os
import time
import uuid
from enum import Enum
from typing import Any, Dict, List, Optional

import duckdb
import litellm
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel

import streamlit as st

load_dotenv()

# ----------------------------
# Persistent DuckDB connection
# ----------------------------
DB_PATH = "data.duckdb"
os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)


def get_connection():
    """Get or create a DuckDB connection for this session."""
    if "db_connection" not in st.session_state:
        st.session_state.db_connection = duckdb.connect(DB_PATH)
    return st.session_state.db_connection


console = Console()


# ----------------------------
# MAJOR FIX #7: State Machine Pattern
# ----------------------------
class AgentState(str, Enum):
    """Agent state machine for clear state tracking."""

    IDLE = "idle"
    THINKING = "thinking"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    EXECUTING_TOOL = "executing_tool"
    FINISHED = "finished"
    ERROR = "error"


# ----------------------------
# AG-UI Event Types & Utilities
# ----------------------------
class AGEventType(str, Enum):
    # Lifecycle
    RUN_STARTED = "RunStarted"
    RUN_FINISHED = "RunFinished"
    RUN_ERROR = "RunError"
    STEP_STARTED = "StepStarted"
    STEP_FINISHED = "StepFinished"
    # Text messages (streaming)
    TEXT_START = "TextMessageStart"
    TEXT_CONTENT = "TextMessageContent"
    TEXT_END = "TextMessageEnd"
    TEXT_CHUNK = "TextMessageChunk"
    # Tool calls (streaming args)
    TOOL_START = "ToolCallStart"
    TOOL_ARGS = "ToolCallArgs"
    TOOL_END = "ToolCallEnd"
    TOOL_RESULT = "ToolCallResult"
    # Human confirmation
    HUMAN_CONFIRMATION = "HumanConfirmation"
    # State management
    STATE_SNAPSHOT = "StateSnapshot"
    STATE_DELTA = "StateDelta"
    MESSAGES_SNAPSHOT = "MessagesSnapshot"
    # Special / raw / custom
    RAW = "Raw"
    CUSTOM = "Custom"
    # Drafts (reasoning/activity)
    ACTIVITY_SNAPSHOT = "ActivitySnapshotEvent"
    ACTIVITY_DELTA = "ActivityDeltaEvent"
    REASONING_START = "ReasoningStart"
    REASONING_MESSAGE_START = "ReasoningMessageStart"
    REASONING_MESSAGE_CONTENT = "ReasoningMessageContent"
    REASONING_MESSAGE_END = "ReasoningMessageEnd"
    REASONING_MESSAGE_CHUNK = "ReasoningMessageChunk"
    REASONING_END = "ReasoningEnd"
    META_EVENT = "MetaEvent"


def make_event(
    event_type: AGEventType, payload: Dict[str, Any]
) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "type": event_type.value,
        "timestamp": int(time.time() * 1000),
        "payload": payload,
    }


# ----------------------------
# MAJOR FIX #8: Constants
# ----------------------------
MAX_AGENT_LOOPS = 8  # Prevents infinite loops; adjust based on task complexity
DEFAULT_SAMPLE_SIZE = 5  # Balance between context and token usage
DEBUG = os.getenv("DEBUG", "false").lower() == "true"


def debug_log(msg, *args, **kwargs):
    """Conditional debug logging."""
    if DEBUG:
        console.log(msg, *args, **kwargs)


# ----------------------------
# MINOR FIX #10: Standardized Tool Result Format
# ----------------------------
def format_tool_result(data: Any, reasoning: str = "") -> str:
    """
    Standardize tool results as JSON for consistent handling.

    Args:
        data: The result data (can be list, dict, string, etc.)
        reasoning: Optional reasoning string to include

    Returns:
        JSON-formatted string with result and metadata
    """
    result = {
        "success": True,
        "data": data,
    }
    if reasoning:
        result["reasoning"] = reasoning
    return json.dumps(result, indent=2)


def format_tool_error(error: Exception, tool_name: str) -> str:
    """Format tool errors consistently."""
    return json.dumps(
        {
            "success": False,
            "error": str(error),
            "tool": tool_name,
        },
        indent=2,
    )


# ----------------------------
# DuckDB tools (MINOR FIX #17: Added complete type hints)
# ----------------------------
def list_tables(reasoning: str) -> str:
    """
    List all tables in the database.

    Args:
        reasoning: Explanation of why this tool is being called

    Returns:
        JSON-formatted string with list of table names

    Raises:
        Exception: If database query fails
    """
    try:
        con = get_connection()
        con.execute("SHOW TABLES")
        rows = con.fetchall()
        result = [r[0] for r in rows]
        debug_log(
            f"[blue]list_tables[/blue] - reasoning: {reasoning} -> {result}"
        )
        st.toast(f"Tool: list_tables executed. Found: {result}")
        return format_tool_result(result, reasoning)
    except Exception as e:
        console.log(f"[red]list_tables error[/red] {e}")
        st.error(f"list_tables error: {e}")
        raise


def describe_table(reasoning: str, table_name: str) -> str:
    """
    Get schema information for a table.

    Args:
        reasoning: Explanation of why this tool is being called
        table_name: Name of the table to describe

    Returns:
        JSON-formatted string with schema information

    Raises:
        Exception: If table doesn't exist or query fails
    """
    try:
        con = get_connection()
        con.execute(f"DESCRIBE {table_name}")
        schema = con.fetchall()
        result = {col[0]: col[1] for col in schema}
        debug_log(f"[blue]describe_table[/blue] - {table_name} - {reasoning}")
        st.toast(f"Tool: describe_table for {table_name} executed.")
        return format_tool_result(result, reasoning)
    except Exception as e:
        console.log(f"[red]describe_table error[/red] {e}")
        st.error(f"describe_table error: {e}")
        raise


def sample_table(reasoning: str, table_name: str, row_sample_size: int) -> str:
    """
    Get sample rows from a table.

    Args:
        reasoning: Explanation of why this tool is being called
        table_name: Name of the table to sample
        row_sample_size: Number of rows to retrieve

    Returns:
        JSON-formatted string with sample rows

    Raises:
        Exception: If table doesn't exist or query fails
    """
    try:
        con = get_connection()
        con.execute(
            f"SELECT * FROM {table_name} LIMIT {int(row_sample_size)};"
        )
        sample = con.fetchall()
        result = [str(r) for r in sample]
        debug_log(f"[blue]sample_table[/blue] - {table_name} - {reasoning}")
        st.toast(f"Tool: sample_table for {table_name} executed.")
        return format_tool_result(result, reasoning)
    except Exception as e:
        console.log(f"[red]sample_table error[/red] {e}")
        st.error(f"sample_table error: {e}")
        raise


def run_test_sql_query(reasoning: str, sql_query: str) -> str:
    """
    Test a SQL query (result only visible to agent).

    Args:
        reasoning: Explanation of why this query is being tested
        sql_query: The SQL query to execute

    Returns:
        JSON-formatted string with query results

    Raises:
        Exception: If query is invalid or execution fails
    """
    console.print(f"[dim]Test query: {sql_query}[/dim]")
    try:
        con = get_connection()
        con.execute(sql_query)
        rows = con.fetchall()
        result = [str(r) for r in rows]
        debug_log(
            f"[blue]run_test_sql_query[/blue] - {sql_query} - {reasoning}"
        )
        st.toast("Test SQL executed (result visible only to agent).")
        return format_tool_result(result, reasoning)
    except Exception as e:
        console.log(f"[red]run_test_sql_query error[/red] {e}")
        st.error(f"Test Query Error: {e}")
        raise


def run_final_sql_query(reasoning: str, sql_query: str) -> str:
    """
    Execute the final validated SQL query or statement.

    Args:
        reasoning: Explanation of what this query accomplishes
        sql_query: The final SQL query/statement to execute

    Returns:
        JSON-formatted string with execution results

    Raises:
        Exception: If query is invalid or execution fails
    """
    console.print(
        Panel(
            f"[green]Final Query/Statement[/green]\nReasoning: {reasoning}\nQuery: {sql_query}"
        )
    )
    try:
        con = get_connection()
        # Handle both queries (SELECT) and statements (CREATE, INSERT, etc.)
        if sql_query.strip().upper().startswith("SELECT"):
            con.execute(sql_query)
            rows = con.fetchall()
            result = [str(r) for r in rows]
        else:
            con.execute(sql_query)
            result = f"Statement executed successfully: {sql_query[:50]}..."

        console.log(f"[green]run_final_sql_query[/green] - success")
        st.success("Final Statement Executed!")
        return format_tool_result(result, reasoning)
    except Exception as e:
        console.log(f"[red]run_final_sql_query error[/red] {e}")
        st.error(f"Final Statement Error: {e}")
        raise


TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "list_tables",
            "description": "Returns list of available tables in database",
            "parameters": {
                "type": "object",
                "properties": {"reasoning": {"type": "string"}},
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
                    "reasoning": {"type": "string"},
                    "table_name": {"type": "string"},
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
                    "reasoning": {"type": "string"},
                    "table_name": {"type": "string"},
                    "row_sample_size": {"type": "integer"},
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
                    "reasoning": {"type": "string"},
                    "sql_query": {"type": "string"},
                },
                "required": ["reasoning", "sql_query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_final_sql_query",
            "description": "Runs the final validated SQL query or data manipulation/definition (DML/DDL) statement (like CREATE TABLE, INSERT, DELETE, etc.) and shows results to user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reasoning": {"type": "string"},
                    "sql_query": {"type": "string"},
                },
                "required": ["reasoning", "sql_query"],
            },
        },
    },
]

AVAILABLE_FUNCTIONS = {
    "list_tables": list_tables,
    "describe_table": describe_table,
    "sample_table": sample_table,
    "run_test_sql_query": run_test_sql_query,
    "run_final_sql_query": run_final_sql_query,
}


# ----------------------------
# Message History Management
# ----------------------------
def rebuild_llm_history(
    display_messages: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Rebuild clean LLM message history from display messages.
    This ensures the LLM gets proper conversation context without UI artifacts.

    CRITICAL: Maintains proper tool call -> tool result pairing.
    """
    llm_messages = [
        {
            "role": "system",
            "content": "You are a DuckDB SQL expert. Use tools to explore the DB, test queries, and only call run_final_sql_query when correct.",
        },
    ]

    # Track tool calls that need to be paired with results
    pending_tool_calls = {}

    for msg in display_messages:
        role = msg.get("role")

        # Skip welcome message
        if role == "assistant" and msg.get("content", "").startswith(
            "Welcome!"
        ):
            continue

        # Skip confirmation messages (UI only)
        if role == "confirmation":
            continue

        # Handle tool_call_start - store for later pairing
        if role == "tool_call_start":
            tool_call_id = msg.get("tool_call_id")
            pending_tool_calls[tool_call_id] = {
                "id": tool_call_id,
                "type": "function",
                "function": {
                    "name": msg.get("tool_name"),
                    "arguments": json.dumps(msg.get("args", {})),
                },
            }
            continue

        # Add standard messages
        if role == "user":
            llm_messages.append({"role": "user", "content": msg["content"]})

        # --- FIX APPLIED HERE: REMOVED THE DUPLICATE ADDITION OF assistant+tool_calls ---
        # The following block was removed to fix the litellm error:
        # elif role == "assistant" and "tool_calls" in msg:
        #     llm_messages.append(
        #         {
        #             "role": "assistant",
        #             "content": msg.get("content", ""),
        #             "tool_calls": msg["tool_calls"],
        #         }
        #     )

        elif role == "assistant":
            llm_messages.append(
                {"role": "assistant", "content": msg["content"]}
            )

        elif role == "tool":
            tool_call_id = msg.get("tool_call_id")

            # If we have a pending tool call that wasn't added yet, add it now
            if tool_call_id in pending_tool_calls:
                # Add the assistant message with tool call
                llm_messages.append(
                    {
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [pending_tool_calls[tool_call_id]],
                    }
                )
                # Remove from pending
                del pending_tool_calls[tool_call_id]

            # Now add the tool result
            llm_messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "content": msg["content"],
                }
            )

    return llm_messages


# ----------------------------
# MINOR FIX #16: Consistent Error Handling Wrapper
# ----------------------------
def safe_tool_execution(func, tool_name: str, *args, **kwargs) -> str:
    """
    Safely execute a tool function with consistent error handling.

    Args:
        func: The tool function to execute
        tool_name: Name of the tool (for error reporting)
        *args, **kwargs: Arguments to pass to the function

    Returns:
        Tool result as JSON string

    Raises:
        Exception: Re-raises any exception after logging
    """
    try:
        return func(*args, **kwargs)
    except Exception as e:
        console.log(f"[red]Tool error: {tool_name}[/red] {e}")
        error_result = format_tool_error(e, tool_name)
        raise Exception(error_result)


# ----------------------------
# MAJOR FIX #6: Improved Tool Execution with Better Error Handling
# ----------------------------
def execute_tool_safely(
    tool_name: str, args: Dict[str, Any]
) -> tuple[str, bool]:
    """
    Execute a tool and return (result, should_finish).
    Returns should_finish=True if this tool ends the agent run.

    MAJOR FIX: All exceptions are now raised rather than returned as strings,
    allowing proper error handling at the caller level.

    Args:
        tool_name: Name of the tool to execute
        args: Dictionary of arguments for the tool

    Returns:
        Tuple of (result_string, should_finish_bool)

    Raises:
        ValueError: If tool name is unknown
        Exception: If tool execution fails
    """
    func = AVAILABLE_FUNCTIONS.get(tool_name)
    if not func:
        error_msg = f"Error: Unknown tool {tool_name}"
        console.log(f"[red]{error_msg}[/red]")
        raise ValueError(error_msg)

    # Execute tool with safe wrapper
    if tool_name == "list_tables":
        result_text = safe_tool_execution(
            func, tool_name, args.get("reasoning", "")
        )
    elif tool_name == "describe_table":
        result_text = safe_tool_execution(
            func,
            tool_name,
            args.get("reasoning", ""),
            args.get("table_name"),
        )
    elif tool_name == "sample_table":
        result_text = safe_tool_execution(
            func,
            tool_name,
            args.get("reasoning", ""),
            args.get("table_name"),
            int(args.get("row_sample_size", DEFAULT_SAMPLE_SIZE)),
        )
    elif tool_name == "run_test_sql_query":
        result_text = safe_tool_execution(
            func,
            tool_name,
            args.get("reasoning", ""),
            args.get("sql_query"),
        )
    elif tool_name == "run_final_sql_query":
        result_text = safe_tool_execution(
            func,
            tool_name,
            args.get("reasoning", ""),
            args.get("sql_query"),
        )
        # CRITICAL: Final query ends the run
        return result_text, True
    else:
        result_text = safe_tool_execution(func, tool_name, **args)

    return result_text, False


# ----------------------------
# Agentic loop
# ----------------------------
class AGUIAgent:
    def __init__(
        self,
        model: str = os.getenv("LLM_MODEL", "gemini/gemini-2.0-flash"),
        max_loops: int = MAX_AGENT_LOOPS,
    ):
        self.model = model
        self.max_loops = max_loops

    def run_sync(
        self, messages: List[Dict[str, Any]]
    ) -> tuple[List[Dict[str, Any]], bool]:
        """
        Synchronous agent loop - performs ONE LLM call and proposes tools.
        Returns (updated_messages, needs_confirmation).

        All tools go through HITL confirmation in the outer loop.
        """
        debug_log("[cyan]Agent: Making LLM call...[/cyan]")
        debug_log("[cyan]Messages being sent to LLM:[/cyan]", messages)

        # MAJOR FIX #6: Better error handling - exceptions propagate
        completion = litellm.completion(
            model=self.model, messages=messages, tools=TOOLS_SCHEMA
        )

        choice = completion.choices[0].message
        tool_calls = getattr(choice, "tool_calls", None)
        assistant_text = getattr(choice, "content", "") or ""

        # If LLM wants to call tools
        if tool_calls:
            debug_log(
                f"[magenta]LLM proposed {len(tool_calls)} tool call(s).[/magenta]"
            )

            # Add assistant message with tool call metadata
            messages.append(
                {
                    "role": "assistant",
                    "content": assistant_text,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in tool_calls
                    ],
                }
            )

            # Return with first tool call for confirmation
            return messages, True
        else:
            # No tool calls => LLM finished with text response
            debug_log("[green]LLM returned text, no tools.[/green]")
            if assistant_text:
                messages.append(
                    {"role": "assistant", "content": assistant_text}
                )
            return messages, False


# ----------------------------
# MAJOR FIX #12: Conversation Persistence
# ----------------------------
def save_conversation(conversation_id: str, messages: List[Dict[str, Any]]):
    """Save conversation to database for persistence."""
    try:
        con = get_connection()
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id VARCHAR PRIMARY KEY,
                messages JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )
        con.execute(
            """
            INSERT OR REPLACE INTO conversations (id, messages, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        """,
            [conversation_id, json.dumps(messages)],
        )
        debug_log(f"[green]Conversation {conversation_id} saved[/green]")
    except Exception as e:
        console.log(f"[red]Error saving conversation: {e}[/red]")


def load_conversation(conversation_id: str) -> Optional[List[Dict[str, Any]]]:
    """Load conversation from database."""
    try:
        con = get_connection()
        result = con.execute(
            "SELECT messages FROM conversations WHERE id = ?",
            [conversation_id],
        ).fetchone()
        if result:
            debug_log(f"[green]Conversation {conversation_id} loaded[/green]")
            return json.loads(result[0])
        return None
    except Exception as e:
        console.log(f"[red]Error loading conversation: {e}[/red]")
        return None


def list_conversations() -> List[tuple]:
    """List all saved conversations."""
    try:
        con = get_connection()
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id VARCHAR PRIMARY KEY,
                messages JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )
        results = con.execute(
            "SELECT id, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
        ).fetchall()
        return results
    except Exception as e:
        console.log(f"[red]Error listing conversations: {e}[/red]")
        return []


# ----------------------------
# Streamlit UI Logic
# ----------------------------

# --- Session State Initialization ---
if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "assistant",
            "content": "Welcome! I'm your DuckDB SQL Agent. Ask me a question about the data in your database.",
        }
    ]
if "conversation_id" not in st.session_state:
    st.session_state.conversation_id = str(uuid.uuid4())
if "run_id" not in st.session_state:
    st.session_state.run_id = None
if "pending_confirmation" not in st.session_state:
    st.session_state.pending_confirmation = None
if "confirmation_result" not in st.session_state:
    st.session_state.confirmation_result = None
# MAJOR FIX #7: Use state machine
if "agent_state" not in st.session_state:
    st.session_state.agent_state = AgentState.IDLE
if "llm_model" not in st.session_state:
    st.session_state.llm_model = os.getenv(
        "LLM_MODEL", "gemini/gemini-2.0-flash"
    )
if "user_input" not in st.session_state:
    st.session_state.user_input = ""
if "loop_count" not in st.session_state:
    st.session_state.loop_count = 0


st.set_page_config(page_title="AG-UI DuckDB Agent (Streamlit)")
st.title("🦆 DuckDB SQL Agent (Streamlit)")


# ----------------------------
# Main Agent Logic with State Machine
# ----------------------------
def run_agent_logic():
    """
    Main agent execution logic with state machine pattern.
    MAJOR FIX #7: Clear state transitions instead of multiple boolean flags.
    MAJOR FIX #6: Proper error recovery with graceful degradation.
    """
    debug_log(
        f"--- Running Agent Logic (State: {st.session_state.agent_state}) ---"
    )

    agent = AGUIAgent(model=st.session_state.llm_model)

    # Check for duplicate user input before adding
    if (
        st.session_state.user_input
        and st.session_state.agent_state == AgentState.IDLE
    ):
        user_input = st.session_state.user_input

        # Check last few messages to avoid duplicates
        is_duplicate = False
        for msg in st.session_state.messages[-3:]:
            if msg.get("role") == "user" and msg.get("content") == user_input:
                is_duplicate = True
                break

        if not is_duplicate:
            debug_log(
                f"[blue]Adding new user message: {user_input[:50]}...[/blue]"
            )
            st.session_state.messages.append(
                {"role": "user", "content": user_input}
            )
        else:
            debug_log(
                "[yellow]User input already in history, skipping duplicate[/yellow]"
            )

        st.session_state.agent_state = AgentState.THINKING
        st.session_state.run_id = str(uuid.uuid4())
        st.session_state.loop_count = 0

    # Main agent loop
    while st.session_state.agent_state not in [
        AgentState.IDLE,
        AgentState.FINISHED,
        AgentState.ERROR,
    ]:
        st.session_state.loop_count += 1
        debug_log(
            f"[yellow]Agent Loop #{st.session_state.loop_count} (State: {st.session_state.agent_state})[/yellow]"
        )

        # Check max loops
        if st.session_state.loop_count > MAX_AGENT_LOOPS:
            console.log("[red]Max loops reached[/red]")
            st.session_state.messages.append(
                {
                    "role": "assistant",
                    "content": "⚠️ I've reached the maximum number of steps. Please rephrase your question or break it into smaller parts.",
                }
            )
            st.session_state.agent_state = AgentState.FINISHED
            st.session_state.user_input = ""
            save_conversation(
                st.session_state.conversation_id, st.session_state.messages
            )
            return

        # STATE: EXECUTING_TOOL - Process confirmation result
        if st.session_state.agent_state == AgentState.EXECUTING_TOOL:
            if st.session_state.confirmation_result is None:
                # Waiting for user decision
                debug_log("[yellow]Waiting for confirmation result[/yellow]")
                return

            approved = st.session_state.confirmation_result
            p = st.session_state.pending_confirmation

            debug_log(
                f"[blue]Processing confirmation (approved={approved})[/blue]"
            )

            # Record user decision
            st.session_state.messages.append(
                {
                    "role": "confirmation",
                    "toolCallId": p["toolCallId"],
                    "toolName": p["toolName"],
                    "approved": approved,
                    "content": f"User {'approved' if approved else 'denied'} tool call **{p['toolName']}**.",
                }
            )

            # Clear confirmation state
            st.session_state.confirmation_result = None
            st.session_state.pending_confirmation = None

            if not approved:
                # User denied - end run
                console.log("[red]User denied tool. Ending run.[/red]")
                st.session_state.messages.append(
                    {
                        "role": "assistant",
                        "content": f"🛑 Tool execution cancelled. Run finished.",
                    }
                )
                st.session_state.agent_state = AgentState.FINISHED
                st.session_state.user_input = ""
                save_conversation(
                    st.session_state.conversation_id, st.session_state.messages
                )
                return

            # User approved - execute tool
            console.log(f"[green]Executing tool: {p['toolName']}[/green]")

            # Add the assistant message with tool_calls BEFORE tool result
            assistant_tool_msg = {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": p["toolCallId"],
                        "type": "function",
                        "function": {
                            "name": p["toolName"],
                            "arguments": json.dumps(p["args"]),
                        },
                    }
                ],
            }

            # Check if this assistant message is already in the messages
            already_has_tool_call = False
            for msg in st.session_state.messages:
                if (
                    msg.get("role") == "assistant"
                    and msg.get("tool_calls")
                    and msg["tool_calls"][0].get("id") == p["toolCallId"]
                ):
                    already_has_tool_call = True
                    break

            if not already_has_tool_call:
                debug_log(
                    "[cyan]Adding assistant tool_calls message to history[/cyan]"
                )
                st.session_state.messages.append(assistant_tool_msg)

            # MAJOR FIX #6: Better error handling with try-except
            try:
                result_text, should_finish = execute_tool_safely(
                    p["toolName"], p["args"]
                )

                # Add tool result to messages
                st.session_state.messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": p["toolCallId"],
                        "tool_name": p["toolName"],
                        "content": result_text,
                    }
                )

                # Check if this tool ends the run
                if should_finish:
                    console.log(
                        "[green]Final query executed. Ending run.[/green]"
                    )
                    st.session_state.agent_state = AgentState.FINISHED
                    st.session_state.user_input = ""
                    save_conversation(
                        st.session_state.conversation_id,
                        st.session_state.messages,
                    )
                    return

                # Continue to next LLM call
                st.session_state.agent_state = AgentState.THINKING
                continue

            except Exception as e:
                # MAJOR FIX #6: Graceful error recovery
                console.log(f"[red]Tool execution failed: {e}[/red]")
                error_msg = f"Tool execution failed: {str(e)[:200]}"

                # Add error as tool result so LLM can see it and potentially recover
                st.session_state.messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": p["toolCallId"],
                        "tool_name": p["toolName"],
                        "content": f"ERROR: {error_msg}",
                    }
                )

                # Let the agent try to recover
                st.session_state.agent_state = AgentState.THINKING
                st.error(error_msg)
                continue

        # STATE: THINKING - Make LLM call
        elif st.session_state.agent_state == AgentState.THINKING:
            # Rebuild LLM history
            llm_messages = rebuild_llm_history(st.session_state.messages)

            # MAJOR FIX #6: Better error handling
            try:
                with st.spinner("🤔 Agent is thinking..."):
                    updated_messages, needs_confirmation = agent.run_sync(
                        llm_messages
                    )
            except Exception as e:
                console.log(f"[red]LLM call failed: {e}[/red]")
                st.session_state.messages.append(
                    {
                        "role": "assistant",
                        "content": f"⚠️ I encountered an error while thinking: {str(e)[:200]}. Please try again or rephrase your question.",
                    }
                )
                st.session_state.agent_state = AgentState.ERROR
                st.session_state.user_input = ""
                st.error(f"LLM Error: {str(e)[:200]}")
                save_conversation(
                    st.session_state.conversation_id, st.session_state.messages
                )
                return

            if needs_confirmation:
                # Extract tool call for confirmation
                last_msg = updated_messages[-1]
                if (
                    last_msg.get("role") == "assistant"
                    and "tool_calls" in last_msg
                ):
                    tc = last_msg["tool_calls"][0]  # Get first tool call

                    try:
                        args = json.loads(tc["function"]["arguments"])
                    except:
                        args = {}

                    tool_call_id = tc["id"]
                    tool_name = tc["function"]["name"]

                    # Add tool_call_start to display
                    st.session_state.messages.append(
                        {
                            "role": "tool_call_start",
                            "tool_call_id": tool_call_id,
                            "tool_name": tool_name,
                            "args": args,
                        }
                    )

                    # Set pending confirmation
                    st.session_state.pending_confirmation = {
                        "toolCallId": tool_call_id,
                        "toolName": tool_name,
                        "args": args,
                        "prompt": f"Agent proposes to call `{tool_name}`. Please confirm.",
                        "full_args": json.dumps(args, indent=2),
                    }

                    st.session_state.agent_state = (
                        AgentState.AWAITING_CONFIRMATION
                    )
                    debug_log(
                        "[yellow]State -> AWAITING_CONFIRMATION[/yellow]"
                    )
                    return  # Exit to show confirmation UI
            else:
                # LLM finished with text response
                debug_log("[green]LLM finished with text[/green]")
                last_msg = updated_messages[-1]

                if last_msg.get("role") == "assistant":
                    # Check for duplicate before adding
                    is_duplicate = (
                        st.session_state.messages
                        and st.session_state.messages[-1].get("content")
                        == last_msg.get("content")
                    )

                    if not is_duplicate:
                        st.session_state.messages.append(last_msg)

                st.session_state.agent_state = AgentState.FINISHED
                st.session_state.user_input = ""
                save_conversation(
                    st.session_state.conversation_id, st.session_state.messages
                )
                return

        # STATE: AWAITING_CONFIRMATION - Transition handled by user button click
        elif st.session_state.agent_state == AgentState.AWAITING_CONFIRMATION:
            # When user clicks confirm/cancel, we transition to EXECUTING_TOOL
            if st.session_state.confirmation_result is not None:
                st.session_state.agent_state = AgentState.EXECUTING_TOOL
                debug_log("[yellow]State -> EXECUTING_TOOL[/yellow]")
            return  # Wait for user action

        else:
            # Unknown state - safety fallback
            console.log(
                f"[red]Unknown state: {st.session_state.agent_state}[/red]"
            )
            st.session_state.agent_state = AgentState.ERROR
            return


# ----------------------------
# UI Rendering
# ----------------------------

# --- Main Chat Display ---
for msg in st.session_state.messages:
    if msg["role"] == "user":
        st.chat_message("user").write(msg["content"])

    elif msg["role"] == "tool_call_start":
        with st.chat_message("assistant"):
            # MAJOR FIX #5: Tool results expanded by default
            with st.expander(
                f"🚀 Proposing Tool: `{msg['tool_name']}`", expanded=True
            ):
                st.json(msg["args"])

    elif msg["role"] == "tool":
        with st.chat_message("assistant"):
            # MAJOR FIX #5: Tool results expanded by default for visibility
            with st.expander(
                f"🔧 Tool Output: `{msg.get('tool_name', 'tool')}`",
                expanded=True,
            ):
                st.code(msg["content"], language="text")

    elif msg["role"] == "confirmation":
        with st.chat_message("assistant"):
            with st.expander("👤 User Decision", expanded=False):
                st.caption(msg["content"])

    elif msg["role"] == "assistant" and "tool_calls" not in msg:
        st.chat_message("assistant").write(msg["content"])


# --- Confirmation UI ---
if st.session_state.pending_confirmation:
    p = st.session_state.pending_confirmation

    with st.chat_message("assistant"):
        st.warning(p["prompt"])

        with st.form(key=f"confirm_form_{p['toolCallId']}"):
            st.json(p["full_args"])

            col1, col2, _ = st.columns([1, 1, 3])
            with col1:
                confirm_button = st.form_submit_button(
                    "✅ Confirm", type="primary"
                )
            with col2:
                cancel_button = st.form_submit_button("❌ Cancel")

            if confirm_button or cancel_button:
                st.session_state.confirmation_result = confirm_button
                st.session_state.agent_state = AgentState.EXECUTING_TOOL
                debug_log(f"Confirmation submitted: {confirm_button}")
                st.rerun()


# --- Input Area ---
is_busy = st.session_state.agent_state not in [
    AgentState.IDLE,
    AgentState.FINISHED,
    AgentState.ERROR,
]
is_awaiting = st.session_state.agent_state == AgentState.AWAITING_CONFIRMATION

user_input = st.chat_input(
    "Ask about your data...",
    disabled=is_busy or is_awaiting,
)


# --- Input Handler ---
if user_input and st.session_state.agent_state in [
    AgentState.IDLE,
    AgentState.FINISHED,
    AgentState.ERROR,
]:
    debug_log(f"[blue]New user input: {user_input[:50]}...[/blue]")
    st.session_state.user_input = user_input
    st.session_state.agent_state = (
        AgentState.IDLE
    )  # Reset to IDLE before processing
    run_agent_logic()
    st.rerun()

# --- Confirmation Handler ---
elif (
    st.session_state.agent_state == AgentState.EXECUTING_TOOL
    and st.session_state.confirmation_result is not None
):
    debug_log("[blue]Processing confirmation in main loop[/blue]")
    run_agent_logic()
    st.rerun()


# --- Sidebar ---
with st.sidebar:
    st.header("Settings")
    st.text(f"LLM Model: {st.session_state.llm_model}")
    st.caption("DuckDB file: `data.duckdb`")

    if st.button("Clear Chat History", key="clear_chat_btn"):
        console.log("Clearing chat history.")
        st.session_state.messages = [
            {
                "role": "assistant",
                "content": "Chat history cleared. Ready for a new query.",
            }
        ]
        st.session_state.agent_state = AgentState.IDLE
        st.session_state.pending_confirmation = None
        st.session_state.confirmation_result = None
        st.session_state.run_id = None
        st.session_state.user_input = ""
        st.session_state.loop_count = 0
        st.rerun()
