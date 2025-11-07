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

    # Run is now synchronous
    def run_sync(
        self, user_input: str, messages: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Synchronous agent loop adapted for Streamlit reruns.
        It processes one LLM call + all subsequent tool calls until the LLM returns text or the run finishes/errors.
        """

        loops = 0
        while loops < self.max_loops:
            loops += 1
            console.log(f"[yellow]Agent Loop #{loops}[/yellow]")

            # Call LLM with tools
            console.log(f"[cyan]Calling LLM...[/cyan]")

            # --- LOGGING (As Requested) ---
            # Log the message history being sent to the LLM
            console.log("[cyan]Sending messages to LLM:[/cyan]", messages)
            # --- END LOGGING ---

            try:
                completion = litellm.completion(
                    model=self.model, messages=messages, tools=TOOLS_SCHEMA
                )
            except Exception as e:
                console.log(f"[red]LLM call failed: {e}[/red]")
                # Try to provide a graceful response
                error_msg = f"I encountered an error: {str(e)[:200]}. Please try rephrasing your request or start a new conversation."
                messages.append(
                    {
                        "role": "assistant",
                        "content": error_msg,
                    }
                )
                st.error(f"LLM Call Failed: {str(e)[:200]}")
                return messages

            choice = completion.choices[0].message
            tool_calls = getattr(choice, "tool_calls", None)
            assistant_text = getattr(choice, "content", "") or ""

            # If LLM wants to call tools
            if tool_calls:
                console.log(
                    f"[magenta]LLM proposed {len(tool_calls)} tool call(s).[/magenta]"
                )
                # Add assistant message with tool metadata (for potential future use/debugging)
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

                should_finish = False

                # Process ALL tool calls sequentially (blocking)
                for tc in tool_calls:
                    tool_name = tc.function.name
                    args_str = tc.function.arguments
                    tool_call_id = tc.id or str(uuid.uuid4())

                    try:
                        args = json.loads(args_str)
                    except Exception:
                        args = {}

                    # --- HITL Confirmation Logic in Streamlit ---
                    if tool_name in AVAILABLE_FUNCTIONS:
                        console.log(
                            f"[yellow]Pausing for Human Confirmation for tool: {tool_name}[/yellow]"
                        )
                        # 1. Show tool call start/args (minimal display)
                        messages.append(
                            {
                                "role": "tool_call_start",
                                "tool_call_id": tool_call_id,
                                "tool_name": tool_name,
                                "args": args,
                            }
                        )

                        # 2. Emit HUMAN_CONFIRMATION event (handled by Streamlit session state)
                        st.session_state.pending_confirmation = {
                            "toolCallId": tool_call_id,
                            "toolName": tool_name,
                            "args": args,
                            "prompt": f"Agent proposes to call `{tool_name}`. Please confirm.",
                            "full_args": json.dumps(args, indent=2),
                            "run_id": st.session_state.run_id,
                        }

                        # 3. Force UI redraw to show confirmation box
                        # The st.rerun() will be called by the main script logic

                        # Execution pauses here until the user clicks a button
                        return messages

                    else:
                        # Unknown tool - treat as an error result for this tool call
                        console.log(f"[red]Unknown tool: {tool_name}[/red]")
                        result_text = f"Unknown tool: {tool_name}"

                    # --- Tool Execution (Synchronous) ---
                    # (This part is only reachable for non-HITL tools, which you don't have)
                    console.log(
                        f"[green]Executing non-HITL tool: {tool_name}[/green]"
                    )
                    func = AVAILABLE_FUNCTIONS.get(tool_name)
                    result_text = "Tool execution error/unknown."
                    if func:
                        try:
                            # ... (tool execution logic) ...
                            if tool_name == "list_tables":
                                result_text = json.dumps(
                                    func(args.get("reasoning", ""))
                                )
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
                            else:
                                result_text = func(**args)
                        except Exception as e:
                            result_text = f"Error executing {tool_name}: {e}"
                            st.error(f"Tool execution error: {e}")

                    # --- Emit Tool Result (Append to messages for next LLM call) ---
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call_id,
                            "content": result_text,
                        }
                    )
                    st.success(f"Tool **{tool_name}** executed.")

                    if tool_name == "run_final_sql_query":
                        should_finish = True
                        break

                if should_finish:
                    console.log(
                        "[green]run_final_sql_query was called, finishing run.[/green]"
                    )
                    return messages

                # Continue loop with updated messages
                console.log("[cyan]Looping again with tool results...[/cyan]")
                time.sleep(0.5)
                continue

            else:
                # No tool calls => send assistant content to user and finish
                console.log(
                    "[green]LLM returned text, no tools. Finishing run.[/green]"
                )
                if assistant_text:
                    messages.append(
                        {"role": "assistant", "content": assistant_text}
                    )
                return messages  # Agent finished naturally

        # Max loops reached
        console.log("[red]Max loops reached. Finishing run.[/red]")
        messages.append(
            {
                "role": "assistant",
                "content": "Agent reached max loops. Run finished.",
            }
        )
        return messages


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


st.set_page_config(page_title="AG-UI DuckDB Agent (Streamlit)")
st.title("🦆 DuckDB SQL Agent (Streamlit)")


# --- Agent Execution Logic ---
def run_agent_logic(user_input: str):
    """Wrapper to execute the agent and handle state updates for the agent loop."""

    console.log(f"--- Running Agent Logic (Input: {user_input[:20]}...) ---")

    agent = AGUIAgent(model=st.session_state.llm_model)

    # --- Conversation Preparation ---
    current_messages = [
        {
            "role": "system",
            "content": "You are a DuckDB SQL expert. Use tools to explore the DB, test queries, and only call run_final_sql_query when correct.",
        },
    ]

    # Reconstruct LLM history from Streamlit messages
    for msg in st.session_state.messages:
        # Skip the initial welcome message - it's UI only
        if msg["role"] == "assistant" and msg.get("content", "").startswith(
            "Welcome!"
        ):
            continue
        # Skip tool_call_start and confirmation messages - they're UI only
        if msg["role"] in ["tool_call_start", "confirmation"]:
            continue

        # We only need to rebuild the history for the LLM, not for display
        if msg["role"] == "user":
            current_messages.append(
                {"role": "user", "content": msg["content"]}
            )
        elif msg["role"] == "assistant" and "tool_calls" in msg:
            current_messages.append(
                {
                    "role": "assistant",
                    "content": msg.get("content", ""),
                    "tool_calls": msg.get("tool_calls", []),
                }
            )
        elif msg["role"] == "assistant":
            current_messages.append(
                {"role": "assistant", "content": msg["content"]}
            )
        elif msg["role"] == "tool":
            current_messages.append(
                {
                    "role": "tool",
                    "tool_call_id": msg.get("tool_call_id"),
                    "content": msg["content"],
                }
            )

    final_messages = current_messages

    # Set running state and get run_id if starting fresh
    if (
        not st.session_state.agent_running
        and st.session_state.confirmation_result is None
    ):
        console.log("Setting agent_running=True and starting new run_id.")
        st.session_state.agent_running = True
        st.session_state.run_id = str(uuid.uuid4())
        # Only add user input if it's not already in the messages (avoid duplicates)
        if (
            not final_messages
            or final_messages[-1].get("content") != user_input
        ):
            final_messages.append({"role": "user", "content": user_input})

    # --- Main synchronous agent execution loop ---
    while st.session_state.agent_running:

        # 1. Process a pending confirmation result from a previous rerun
        if (
            st.session_state.confirmation_result is not None
            and st.session_state.pending_confirmation
        ):
            console.log(
                f"[blue]Processing Confirmation Result (Approved: {st.session_state.confirmation_result})[/blue]"
            )

            approved = st.session_state.confirmation_result
            p = st.session_state.pending_confirmation
            tool_call_id = p["toolCallId"]
            tool_name = p["toolName"]
            args = p["args"]

            # Clear the confirmation states for the next cycle
            st.session_state.confirmation_result = None
            st.session_state.pending_confirmation = (
                None  # Clear confirmation UI
            )

            if not approved:
                # User denied: Finish the run immediately
                console.log("[red]User denied tool call. Finishing run.[/red]")
                final_content = (
                    f"Tool execution **{tool_name}** cancelled by user."
                )
                final_messages.append(
                    {"role": "assistant", "content": final_content}
                )
                st.session_state.agent_running = False
                st.session_state.messages.append(
                    {
                        "role": "assistant",
                        "content": f"🛑 **Run Cancelled:**\n{final_content}",
                    }
                )
                st.session_state.user_input = ""
                return  # Exit function
            else:
                # User approved: Execute the tool and append result
                console.log(
                    f"[green]User approved. Executing tool: {tool_name}[/green]"
                )

                # CRITICAL FIX: We need to find and include the assistant message with tool_calls
                # that corresponds to this tool execution
                # Look for the most recent assistant message with tool_calls in session state
                assistant_with_tools = None
                for msg in reversed(st.session_state.messages):
                    if msg.get("role") == "assistant" and "tool_calls" in msg:
                        assistant_with_tools = msg
                        break

                # If we found it and it's not already in final_messages, add it
                if assistant_with_tools:
                    # Check if this message is already in final_messages
                    already_added = False
                    for msg in final_messages:
                        if msg.get("role") == "assistant" and msg.get(
                            "tool_calls"
                        ) == assistant_with_tools.get("tool_calls"):
                            already_added = True
                            break

                    if not already_added:
                        console.log(
                            "[cyan]Adding missing assistant tool_calls message to history[/cyan]"
                        )
                        final_messages.append(assistant_with_tools)

                func = AVAILABLE_FUNCTIONS.get(tool_name)
                result_text = f"Error: Unknown tool {tool_name}"

                if func:
                    try:
                        # Synchronous tool call execution
                        if tool_name == "list_tables":
                            result_text = json.dumps(
                                func(args.get("reasoning", ""))
                            )
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
                        else:
                            result_text = func(**args)
                    except Exception as e:
                        console.log(f"[red]Tool execution error: {e}[/red]")
                        result_text = f"Error executing {tool_name}: {e}"
                        st.error(f"Tool execution error: {e}")

                # Append tool result to LLM history
                final_messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": result_text,
                    }
                )

                # Append tool result to Streamlit messages for display
                st.session_state.messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "tool_name": tool_name,
                        "content": result_text,
                    }
                )

                # After executing the tool, we need to continue the loop
                # back to the LLM to get its next response.
                console.log(
                    f"[green]Tool result processed. Continuing to next iteration.[/green]"
                )
                # The loop will continue automatically - do NOT break here

        # 2. LLM Turn (If no confirmation is pending)
        elif st.session_state.pending_confirmation is None:
            console.log(
                "[blue]No confirmation pending, proceeding to LLM turn.[/blue]"
            )

            # --- START FIX ---
            # Capture old length, as run_sync mutates the list
            old_message_count = len(final_messages)

            # Execute the main synchronous agent logic for one step/turn
            with st.spinner("🤔 Agent is thinking..."):
                # run_sync mutates final_messages and returns it
                new_messages = agent.run_sync(user_input, final_messages)

            # Sync session state with any new messages (like tool_call_start)
            new_message_count = len(new_messages) - old_message_count
            # --- END FIX ---

            if new_message_count > 0:
                console.log(
                    f"Adding {new_message_count} new messages to session state."
                )
                for msg in new_messages[-new_message_count:]:
                    # Only add displayable messages to session state
                    if msg["role"] in ["assistant", "tool_call_start"]:
                        st.session_state.messages.append(msg)

            final_messages = new_messages  # Keep local copy in sync

            # Check if agent paused for confirmation
            if st.session_state.pending_confirmation:
                console.log(
                    "[yellow]Agent paused for confirmation. Exiting logic function.[/yellow]"
                )
                return  # Exit function, main script will rerun

            # If agent returned text without tools, the agent loop in run_sync breaks
            if (
                final_messages[-1].get("role") == "assistant"
                and "tool_calls" not in final_messages[-1]
            ):
                console.log(
                    "[green]Agent finished with text response. Setting agent_running=False.[/green]"
                )
                st.session_state.agent_running = False
                break  # Break the while loop
        else:
            # This shouldn't happen, but safety check
            console.log(
                "[red]Unexpected state: confirmation pending but not processed.[/red]"
            )
            break

    # --- Run Finished ---
    console.log(
        f"--- Agent Logic Function Finished (Running: {st.session_state.agent_running}) ---"
    )

    # Update messages with the final result state for display
    final_result_msg = (
        final_messages[-1]
        if final_messages and final_messages[-1].get("role") == "assistant"
        else None
    )

    if final_result_msg:
        final_content = final_result_msg.get("content", "Run finished.")

        # Only add if it's not a tool call proposal
        if not final_result_msg.get("tool_calls"):
            console.log("Adding final text message to session state.")
            # Check for duplicates before adding
            if (
                not st.session_state.messages
                or st.session_state.messages[-1].get("content")
                != final_content
            ):
                # Check if this is an error message
                if any(
                    err in final_content
                    for err in ["Error", "error", "failed", "Failed"]
                ):
                    st.session_state.messages.append(
                        {
                            "role": "assistant",
                            "content": f"⚠️ {final_content}",
                        }
                    )
                else:
                    st.session_state.messages.append(
                        {"role": "assistant", "content": final_content}
                    )

    st.session_state.user_input = ""  # Clear the input box on final run


# --- Main Chat Display ---
for msg in st.session_state.messages:
    # Display user messages
    if msg["role"] == "user":
        st.chat_message("user").write(msg["content"])

    # Display tool proposals in an expander
    elif msg["role"] == "tool_call_start":
        with st.chat_message("assistant"):
            with st.expander(f"🚀 Proposing Tool: `{msg['tool_name']}`"):
                st.json(msg["args"])

    # Display tool results in an expander
    elif msg["role"] == "tool":
        with st.chat_message("assistant"):
            with st.expander(
                f"🔧 Tool Output for `{msg.get('tool_name', 'tool')}`"
            ):
                st.markdown(f"```\n{msg['content']}\n```")

    # Display user decisions in an expander
    elif msg["role"] == "confirmation":
        with st.chat_message("assistant"):
            with st.expander("👤 User Decision", expanded=False):
                st.caption(msg["content"])

    # Display final agent text/final results (not in an expander)
    elif msg["role"] == "assistant" and "tool_calls" not in msg:
        st.chat_message("assistant").write(msg["content"])

# --- Confirmation Handling (now as a form at the end of the chat) ---
if st.session_state.pending_confirmation:
    p = st.session_state.pending_confirmation

    with st.chat_message("assistant"):
        st.warning(p["prompt"])

        # Use st.form for confirmation
        with st.form(key=f"confirm_form_{p['toolCallId']}"):
            st.json(p["full_args"])  # Show full arguments clearly

            col1, col2, _ = st.columns([1, 1, 3])
            with col1:
                confirm_button = st.form_submit_button(
                    "✅ Confirm", type="primary"
                )
            with col2:
                cancel_button = st.form_submit_button("❌ Cancel")

            if confirm_button or cancel_button:
                approved = confirm_button

                # 1. Update messages to reflect user decision
                decision_msg = {
                    "role": "confirmation",
                    "toolCallId": p["toolCallId"],
                    "toolName": p["toolName"],
                    "approved": approved,
                    "content": f"User {'approved' if approved else 'denied'} tool call **{p['toolName']}**.",
                }
                st.session_state.messages.append(decision_msg)

                # 2. Signal the agent loop what to do on next execution
                st.session_state.confirmation_result = approved

                # 3. Rerun to resume the agent loop
                console.log(
                    f"Confirmation Form Submitted (Approved: {approved}). Rerunning."
                )
                st.rerun()


# --- Input Area ---
is_confirmation_pending = st.session_state.pending_confirmation is not None
user_input = st.chat_input(
    "Ask about your data...",
    disabled=st.session_state.agent_running or is_confirmation_pending,
)

# DEBUG: Log state on every rerun
console.log(
    f"Rerun state: running={st.session_state.agent_running}, "
    f"pending_confirm={is_confirmation_pending}, "
    f"confirm_result={st.session_state.confirmation_result is not None}, "
    f"user_input_stored={st.session_state.user_input != ''}"
)

# === HANDLER 1: New User Input ===
if (
    user_input
    and not st.session_state.agent_running
    and not is_confirmation_pending
):
    console.log("Handler 1: New user input.")
    st.session_state.messages.append({"role": "user", "content": user_input})
    st.session_state.user_input = user_input  # Store the input

    run_agent_logic(user_input)

    st.rerun()

# === HANDLER 2: Process Confirmation Result ===
elif (
    st.session_state.agent_running
    and st.session_state.confirmation_result is not None
):
    console.log("Handler 2: Processing confirmation result.")

    # Spinner context is now inside run_agent_logic for more granular control
    original_input = st.session_state.user_input
    run_agent_logic(original_input)

    st.rerun()

# --- Status & Sidebar ---
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
        st.rerun()
