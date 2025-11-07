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
con = duckdb.connect(DB_PATH)

console = Console()


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
    # Drafts (reasoning/activity) - included for completeness
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
# DuckDB tools
# ----------------------------
def list_tables(reasoning: str) -> List[str]:
    try:
        con.execute("SHOW TABLES")
        rows = con.fetchall()
        result = [r[0] for r in rows]
        console.log(
            f"[blue]list_tables[/blue] - reasoning: {reasoning} -> {result}"
        )
        st.toast(f"Tool: list_tables executed. Found: {result}")
        return result
    except Exception as e:
        console.log(f"[red]list_tables error[/red] {e}")
        st.error(f"list_tables error: {e}")
        return []


def describe_table(reasoning: str, table_name: str) -> str:
    try:
        con.execute(f"DESCRIBE {table_name}")
        schema = con.fetchall()
        result = "\n".join([f"{col[0]}: {col[1]}" for col in schema])
        console.log(
            f"[blue]describe_table[/blue] - {table_name} - {reasoning}"
        )
        st.toast(f"Tool: describe_table for {table_name} executed.")
        return result
    except Exception as e:
        console.log(f"[red]describe_table error[/red] {e}")
        st.error(f"describe_table error: {e}")
        return f"Error describing {table_name}: {e}"


def sample_table(reasoning: str, table_name: str, row_sample_size: int) -> str:
    try:
        con.execute(
            f"SELECT * FROM {table_name} LIMIT {int(row_sample_size)};"
        )
        sample = con.fetchall()
        result = "\n".join([str(r) for r in sample])
        console.log(f"[blue]sample_table[/blue] - {table_name} - {reasoning}")
        st.toast(f"Tool: sample_table for {table_name} executed.")
        return result
    except Exception as e:
        console.log(f"[red]sample_table error[/red] {e}")
        st.error(f"sample_table error: {e}")
        return f"Error sampling {table_name}: {e}"


def run_test_sql_query(reasoning: str, sql_query: str) -> str:
    console.print(f"[dim]Test query: {sql_query}[/dim]")
    try:
        con.execute(sql_query)
        rows = con.fetchall()
        console.log(
            f"[blue]run_test_sql_query[/blue] - {sql_query} - {reasoning}"
        )
        st.toast("Test SQL executed (result visible only to agent).")
        return "\n".join([str(r) for r in rows])
    except Exception as e:
        console.log(f"[red]run_test_sql_query error[/red] {e}")
        st.error(f"Test Query Error: {e}")
        return f"Error executing test query: {e}"


def run_final_sql_query(reasoning: str, sql_query: str) -> str:
    console.print(
        Panel(
            f"[green]Final Query/Statement[/green]\nReasoning: {reasoning}\nQuery: {sql_query}"
        )
    )
    try:
        # Handle both queries (SELECT) and statements (CREATE, INSERT, etc.)
        if sql_query.strip().upper().startswith("SELECT"):
            con.execute(sql_query)
            rows = con.fetchall()
            result = "\n".join([str(r) for r in rows])
        else:
            con.execute(sql_query)
            # For DDL/DML, fetchall might fail or return nothing, so just confirm execution
            result = f"Statement executed successfully: {sql_query[:50]}..."

        console.log(f"[green]run_final_sql_query[/green] - success")
        st.success("Final Statement Executed!")
        return result
    except Exception as e:
        console.log(f"[red]run_final_sql_query error[/red] {e}")
        st.error(f"Final Statement Error: {e}")
        return f"Error executing final statement: {e}"


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
# CRITICAL FIX #2: Separate message types
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

        elif role == "assistant" and "tool_calls" in msg:
            llm_messages.append(
                {
                    "role": "assistant",
                    "content": msg.get("content", ""),
                    "tool_calls": msg["tool_calls"],
                }
            )

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
# CRITICAL FIX #3 & #4: Improved tool execution
# ----------------------------
def execute_tool_safely(
    tool_name: str, args: Dict[str, Any]
) -> tuple[str, bool]:
    """
    Execute a tool and return (result, should_finish).
    Returns should_finish=True if this tool ends the agent run.
    """
    func = AVAILABLE_FUNCTIONS.get(tool_name)
    if not func:
        return f"Error: Unknown tool {tool_name}", False

    try:
        if tool_name == "list_tables":
            result_text = json.dumps(func(args.get("reasoning", "")))
        elif tool_name == "describe_table":
            result_text = func(
                args.get("reasoning", ""),
                args.get("table_name"),
            )
        elif tool_name == "sample_table":
            result_text = func(
                args.get("reasoning", ""),
                args.get("table_name"),
                int(args.get("row_sample_size", 3)),
            )
        elif tool_name == "run_test_sql_query":
            result_text = func(
                args.get("reasoning", ""),
                args.get("sql_query"),
            )
        elif tool_name == "run_final_sql_query":
            result_text = func(
                args.get("reasoning", ""),
                args.get("sql_query"),
            )
            # CRITICAL FIX #3: Explicitly signal run should finish
            return result_text, True
        else:
            result_text = func(**args)

        return result_text, False

    except Exception as e:
        console.log(f"[red]Tool execution error: {e}[/red]")
        st.error(f"Tool execution error: {e}")
        return f"Error executing {tool_name}: {e}", False


# ----------------------------
# Agentic loop adapted for Streamlit
# ----------------------------
class AGUIAgent:
    def __init__(
        self,
        model: str = os.getenv("LLM_MODEL", "gemini/gemini-2.0-flash"),
        max_loops: int = 8,
    ):
        self.model = model
        self.max_loops = max_loops

    def run_sync(
        self, messages: List[Dict[str, Any]]
    ) -> tuple[List[Dict[str, Any]], bool]:
        """
        Synchronous agent loop - performs ONE LLM call and proposes tools.
        Returns (updated_messages, needs_confirmation).

        CRITICAL FIX #4: This method no longer contains unreachable code.
        All tools go through HITL confirmation in the outer loop.
        """
        console.log("[cyan]Agent: Making LLM call...[/cyan]")
        console.log("[cyan]Messages being sent to LLM:[/cyan]", messages)

        # CRITICAL FIX #6: Improved error handling
        try:
            completion = litellm.completion(
                model=self.model, messages=messages, tools=TOOLS_SCHEMA
            )
        except Exception as e:
            console.log(f"[red]LLM call failed: {e}[/red]")
            st.error(f"LLM Error: {str(e)[:200]}")
            # Don't pollute message history with error - let caller handle it
            raise

        choice = completion.choices[0].message
        tool_calls = getattr(choice, "tool_calls", None)
        assistant_text = getattr(choice, "content", "") or ""

        # If LLM wants to call tools
        if tool_calls:
            console.log(
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
            # (We process tools one at a time for HITL)
            return messages, True
        else:
            # No tool calls => LLM finished with text response
            console.log("[green]LLM returned text, no tools.[/green]")
            if assistant_text:
                messages.append(
                    {"role": "assistant", "content": assistant_text}
                )
            return messages, False


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
if "run_id" not in st.session_state:
    st.session_state.run_id = None
if "pending_confirmation" not in st.session_state:
    st.session_state.pending_confirmation = None
if "confirmation_result" not in st.session_state:
    st.session_state.confirmation_result = None
if "agent_running" not in st.session_state:
    st.session_state.agent_running = False
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
# CRITICAL FIX #1, #2, #3: Refactored agent logic
# ----------------------------
def run_agent_logic():
    """
    Main agent execution logic with proper state management.
    This function handles the agent loop with HITL confirmation.
    """
    console.log("--- Running Agent Logic ---")

    agent = AGUIAgent(model=st.session_state.llm_model)

    # CRITICAL FIX #1: Check for duplicate user input before adding
    # Only add user input if we're starting fresh and it's not already there
    if st.session_state.user_input and not st.session_state.agent_running:
        user_input = st.session_state.user_input

        # Check last few messages to avoid duplicates
        is_duplicate = False
        for msg in st.session_state.messages[-3:]:
            if msg.get("role") == "user" and msg.get("content") == user_input:
                is_duplicate = True
                break

        if not is_duplicate:
            console.log(
                f"[blue]Adding new user message: {user_input[:50]}...[/blue]"
            )
            st.session_state.messages.append(
                {"role": "user", "content": user_input}
            )
        else:
            console.log(
                "[yellow]User input already in history, skipping duplicate[/yellow]"
            )

        st.session_state.agent_running = True
        st.session_state.run_id = str(uuid.uuid4())
        st.session_state.loop_count = 0

    # Main agent loop
    while st.session_state.agent_running:
        st.session_state.loop_count += 1
        console.log(
            f"[yellow]Agent Loop #{st.session_state.loop_count}[/yellow]"
        )

        # Check max loops
        if st.session_state.loop_count > 8:
            console.log("[red]Max loops reached[/red]")
            st.session_state.messages.append(
                {
                    "role": "assistant",
                    "content": "⚠️ I've reached the maximum number of steps. Please rephrase your question or break it into smaller parts.",
                }
            )
            st.session_state.agent_running = False
            st.session_state.user_input = ""
            return

        # STEP 1: Process pending confirmation result
        if (
            st.session_state.confirmation_result is not None
            and st.session_state.pending_confirmation
        ):

            approved = st.session_state.confirmation_result
            p = st.session_state.pending_confirmation

            console.log(
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
                st.session_state.agent_running = False
                st.session_state.user_input = ""
                return

            # User approved - execute tool
            console.log(f"[green]Executing tool: {p['toolName']}[/green]")

            # CRITICAL FIX: Add the assistant message with tool_calls BEFORE tool result
            # This ensures the LLM sees the proper tool call -> tool result pairing
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
                console.log(
                    "[cyan]Adding assistant tool_calls message to history[/cyan]"
                )
                st.session_state.messages.append(assistant_tool_msg)

            # CRITICAL FIX #3: Use safe execution with proper finish signaling
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

            # CRITICAL FIX #3: Check if this tool ends the run
            if should_finish:
                console.log("[green]Final query executed. Ending run.[/green]")
                st.session_state.agent_running = False
                st.session_state.user_input = ""
                return

            # Continue to next LLM call with tool result
            continue

        # STEP 2: Make LLM call (no pending confirmation)
        elif st.session_state.pending_confirmation is None:
            # CRITICAL FIX #2: Use rebuilt history for LLM
            llm_messages = rebuild_llm_history(st.session_state.messages)

            # CRITICAL FIX #6: Better error handling
            try:
                with st.spinner("🤔 Agent is thinking..."):
                    updated_messages, needs_confirmation = agent.run_sync(
                        llm_messages
                    )
            except Exception as e:
                console.log(f"[red]Agent execution failed: {e}[/red]")
                st.session_state.messages.append(
                    {
                        "role": "assistant",
                        "content": f"⚠️ I encountered an error: {str(e)[:200]}. Please try again or rephrase your question.",
                    }
                )
                st.session_state.agent_running = False
                st.session_state.user_input = ""
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

                    # Add assistant message to display
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

                    console.log("[yellow]Pausing for confirmation[/yellow]")
                    return  # Exit to show confirmation UI
            else:
                # LLM finished with text response
                console.log("[green]LLM finished with text[/green]")
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

                st.session_state.agent_running = False
                st.session_state.user_input = ""
                return
        else:
            # Shouldn't reach here
            console.log("[red]Unexpected state![/red]")
            st.session_state.agent_running = False
            return


# --- Main Chat Display ---
for msg in st.session_state.messages:
    if msg["role"] == "user":
        st.chat_message("user").write(msg["content"])

    elif msg["role"] == "tool_call_start":
        with st.chat_message("assistant"):
            with st.expander(f"🚀 Proposing Tool: `{msg['tool_name']}`"):
                st.json(msg["args"])

    elif msg["role"] == "tool":
        with st.chat_message("assistant"):
            # CRITICAL FIX: Expand tool results by default for visibility
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
                console.log(f"Confirmation submitted: {confirm_button}")
                st.rerun()


# --- Input Area ---
is_confirmation_pending = st.session_state.pending_confirmation is not None
user_input = st.chat_input(
    "Ask about your data...",
    disabled=st.session_state.agent_running or is_confirmation_pending,
)


# --- Input Handler ---
if (
    user_input
    and not st.session_state.agent_running
    and not is_confirmation_pending
):
    console.log(f"[blue]New user input: {user_input[:50]}...[/blue]")
    st.session_state.user_input = user_input
    run_agent_logic()
    st.rerun()

# --- Confirmation Handler ---
elif (
    st.session_state.agent_running
    and st.session_state.confirmation_result is not None
):
    console.log("[blue]Processing confirmation in main loop[/blue]")
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
        st.session_state.agent_running = False
        st.session_state.pending_confirmation = None
        st.session_state.confirmation_result = None
        st.session_state.run_id = None
        st.session_state.user_input = ""
        st.session_state.loop_count = 0
        st.rerun()
