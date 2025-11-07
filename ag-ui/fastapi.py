# /// script
# requires-python = "==3.12"
# dependencies = [
#     "fastapi==0.115.0",
#     "uvicorn==0.32.0",
#     "duckdb==1.4.1",
#     "litellm==1.78.5",
#     "python-dotenv==1.1.1",
#     "pydantic==2.12.3",
#     "rich==14.0.0",
# ]
# ///

import asyncio
import json
import os
import time
import uuid
from enum import Enum
from typing import Any, AsyncIterable, Dict, List, Optional

import duckdb
import litellm
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from rich.console import Console
from rich.panel import Panel

load_dotenv()

# ----------------------------
# Persistent DuckDB connection
# ----------------------------
DB_PATH = "data.duckdb"
os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
con = duckdb.connect(DB_PATH)

console = Console()

# ----------------------------
# FastAPI app & confirmation store
# ----------------------------
app = FastAPI(title="AG-UI DuckDB Agent (Full AGEventType)")
confirmation_futures: Dict[str, asyncio.Future] = {}


# ============================================================
# Full AG-UI Event Types (expanded)
# ============================================================
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


# ============================================================
# DuckDB tools (based on your script)
# ============================================================
def list_tables(reasoning: str) -> List[str]:
    try:
        con.execute("SHOW TABLES")
        rows = con.fetchall()
        result = [r[0] for r in rows]
        console.log(
            f"[blue]list_tables[/blue] - reasoning: {reasoning} -> {result}"
        )
        return result
    except Exception as e:
        console.log(f"[red]list_tables error[/red] {e}")
        return []


def describe_table(reasoning: str, table_name: str) -> str:
    try:
        con.execute(f"DESCRIBE {table_name}")
        schema = con.fetchall()
        result = "\n".join([f"{col[0]}: {col[1]}" for col in schema])
        console.log(
            f"[blue]describe_table[/blue] - {table_name} - {reasoning}"
        )
        return result
    except Exception as e:
        console.log(f"[red]describe_table error[/red] {e}")
        return f"Error describing {table_name}: {e}"


def sample_table(reasoning: str, table_name: str, row_sample_size: int) -> str:
    try:
        con.execute(
            f"SELECT * FROM {table_name} LIMIT {int(row_sample_size)};"
        )
        sample = con.fetchall()
        result = "\n".join([str(r) for r in sample])
        console.log(f"[blue]sample_table[/blue] - {table_name} - {reasoning}")
        return result
    except Exception as e:
        console.log(f"[red]sample_table error[/red] {e}")
        return f"Error sampling {table_name}: {e}"


def run_test_sql_query(reasoning: str, sql_query: str) -> str:
    console.print(f"[dim]Test query: {sql_query}[/dim]")
    try:
        con.execute(sql_query)
        rows = con.fetchall()
        console.log(
            f"[blue]run_test_sql_query[/blue] - {sql_query} - {reasoning}"
        )
        return "\n".join([str(r) for r in rows])
    except Exception as e:
        console.log(f"[red]run_test_sql_query error[/red] {e}")
        return f"Error executing test query: {e}"


def run_final_sql_query(reasoning: str, sql_query: str) -> str:
    console.print(
        Panel(
            f"[green]Final Query[/green]\nReasoning: {reasoning}\nQuery: {sql_query}"
        )
    )
    try:
        con.execute(sql_query)
        rows = con.fetchall()
        console.log(f"[green]run_final_sql_query[/green] - success")
        return "\n".join([str(r) for r in rows])
    except Exception as e:
        console.log(f"[red]run_final_sql_query error[/red] {e}")
        return f"Error executing final query: {e}"


# Tools schema (OpenAI-style function descriptors)
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
            "description": "Runs the final validated SQL query and shows results to user",
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


# ============================================================
# Agentic loop using litellm and AG-UI events with HITL
# ============================================================
class AGUIAgent:
    def __init__(
        self,
        model: str = os.getenv("LLM_MODEL", "gemini/gemini-2.0-flash"),
        max_loops: int = 8,
    ):
        self.model = model
        self.max_loops = max_loops

    async def run(self, user_input: str) -> AsyncIterable[Dict[str, Any]]:
        """
        Agent loop:
          - Build messages
          - Ask LLM (with tools schema)
          - If LLM returns tool calls -> emit tool events + HumanConfirmation, wait for user decision
          - If approved -> execute tool, emit TOOL_RESULT, append tool response to messages and loop
          - If tool is run_final_sql_query -> emit final TOOL_RESULT (visible to user) and finish
          - If LLM returns no tools -> emit TEXT content and finish
        """
        run_id = str(uuid.uuid4())
        yield make_event(
            AGEventType.RUN_STARTED, {"runId": run_id, "input": user_input}
        )
        messages = [
            {
                "role": "system",
                "content": "You are a DuckDB SQL expert. Use tools to explore the DB, test queries, and only call run_final_sql_query when correct.",
            },
            {"role": "user", "content": user_input},
        ]

        loops = 0
        while loops < self.max_loops:
            loops += 1
            console.log(f"[yellow]LLM call #{loops}[/yellow]")

            # Call LLM with tools
            try:
                completion = litellm.completion(
                    model=self.model, messages=messages, tools=TOOLS_SCHEMA
                )
            except Exception as e:
                yield make_event(
                    AGEventType.RUN_ERROR, {"message": f"LLM call failed: {e}"}
                )
                return

            choice = completion.choices[0].message
            tool_calls = getattr(choice, "tool_calls", None)
            assistant_text = getattr(choice, "content", "") or ""

            # If LLM wants to call tools
            if tool_calls:
                # keep assistant message in transcript with tool metadata
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

                # Process ALL tool calls before next LLM call
                should_finish = False
                for tc in tool_calls:
                    tool_name = tc.function.name
                    args_str = tc.function.arguments
                    try:
                        args = json.loads(args_str)
                    except Exception:
                        args = {}

                    tool_call_id = tc.id or str(uuid.uuid4())

                    # Emit tool start/args/end events (streaming pattern)
                    yield make_event(
                        AGEventType.TOOL_START,
                        {
                            "toolCallId": tool_call_id,
                            "toolCallName": tool_name,
                        },
                    )
                    yield make_event(
                        AGEventType.TOOL_ARGS,
                        {"toolCallId": tool_call_id, "delta": args},
                    )
                    yield make_event(
                        AGEventType.TOOL_END, {"toolCallId": tool_call_id}
                    )

                    # Emit HUMAN_CONFIRMATION and wait for frontend action
                    yield make_event(
                        AGEventType.HUMAN_CONFIRMATION,
                        {
                            "toolCallId": tool_call_id,
                            "toolName": tool_name,
                            "args": args,
                            "prompt": f"Agent proposes to call `{tool_name}` with args: {json.dumps(args)}. Confirm?",
                        },
                    )

                    fut = asyncio.get_event_loop().create_future()
                    confirmation_futures[tool_call_id] = fut
                    try:
                        approved = await asyncio.wait_for(fut, timeout=None)
                    except asyncio.CancelledError:
                        approved = False
                    finally:
                        confirmation_futures.pop(tool_call_id, None)

                    if not approved:
                        # User denied -> emit cancellation and finish run
                        yield make_event(
                            AGEventType.HUMAN_CONFIRMATION,
                            {"toolCallId": tool_call_id, "approved": False},
                        )
                        yield make_event(
                            AGEventType.RUN_FINISHED,
                            {"runId": run_id, "result": "Cancelled by user."},
                        )
                        return
                    else:
                        # Execute tool
                        func = AVAILABLE_FUNCTIONS.get(tool_name)
                        if not func:
                            result_text = f"Unknown tool: {tool_name}"
                        else:
                            try:
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
                                result_text = (
                                    f"Error executing {tool_name}: {e}"
                                )

                        # Emit the tool result
                        yield make_event(
                            AGEventType.TOOL_RESULT,
                            {
                                "toolCallId": tool_call_id,
                                "toolName": tool_name,
                                "content": result_text,
                                "role": "tool",
                            },
                        )

                        # Append tool output into LLM conversation
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": tool_call_id,
                                "content": result_text,
                            }
                        )

                        # If final tool, mark to finish after all tools processed
                        if tool_name == "run_final_sql_query":
                            should_finish = True

                # After processing ALL tool calls, check if we should finish
                if should_finish:
                    yield make_event(
                        AGEventType.RUN_FINISHED,
                        {"runId": run_id, "result": "Query completed"},
                    )
                    return

                # Continue loop with updated messages (one LLM call for all tools)
                # Add small delay to respect rate limits
                await asyncio.sleep(0.5)
                continue

            else:
                # No tool calls => send assistant content to user and finish
                if assistant_text:
                    yield make_event(
                        AGEventType.TEXT_CONTENT, {"content": assistant_text}
                    )
                yield make_event(
                    AGEventType.RUN_FINISHED,
                    {"runId": run_id, "result": assistant_text},
                )
                return

        # Max loops reached
        yield make_event(
            AGEventType.RUN_FINISHED,
            {"runId": run_id, "result": "Reached max agent loops."},
        )
        return


# ============================================================
# FastAPI endpoints (UI + stream + confirm)
# ============================================================
INDEX_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>AG-UI DuckDB Chat</title>
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18",
    "react-dom/client": "https://esm.sh/react-dom@18"
  }
}
</script>
<style>
  body{font-family:system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; margin:0; background:#f3f4f6}
  #root{height:100vh;display:flex;flex-direction:column}
  .chat{flex:1;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:8px}
  .bubble{padding:10px 14px;border-radius:18px;max-width:70%;word-break:break-word}
  .user{align-self:flex-end;background:#2563eb;color:#fff}
  .assistant{align-self:flex-start;background:#e5e7eb;color:#111}
  .confirm{align-self:center;background:#fff7ed;border:1px solid #fcd34d;padding:10px;border-radius:12px;max-width:80%}
  .input{display:flex;padding:12px;gap:8px;border-top:1px solid #e5e7eb;background:#fff}
  textarea{flex:1;padding:10px;border:1px solid #d1d5db;border-radius:8px;resize:vertical;min-height:60px;font-family:inherit;font-size:14px}
  button{padding:10px 14px;border-radius:8px;border:none;background:#2563eb;color:#fff;cursor:pointer}
</style>
</head>
<body>
<div id="root"></div>
<script type="module">
import React, {useState,useRef,useEffect} from "react";
import {createRoot} from "react-dom/client";

function Bubble({role, children}) {
  const cls = role === "user" ? "bubble user" : "bubble assistant";
  return React.createElement("div", {className:cls}, children);
}

function ConfirmBox({id,prompt,onConfirm,onCancel}) {
  return React.createElement("div",{className:"confirm"},
    React.createElement("div",null,prompt),
    React.createElement("div",{style:{marginTop:8,textAlign:"right"}},
      React.createElement("button",{onClick:()=>onConfirm(id),style:{background:"#16a34a",marginRight:8}}, "Confirm"),
      React.createElement("button",{onClick:()=>onCancel(id),style:{background:"#ef4444"}}, "Cancel")
    )
  );
}

function App(){
  const [messages,setMessages]=useState([]);
  const [pending,setPending]=useState({});
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const chatRef=useRef(null);

  useEffect(()=>{ if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages, pending]);

  function append(msg){
    setMessages(prev=>{
      const last = prev[prev.length-1];
      // dedupe only exact consecutive duplicates
      if(last && last.role===msg.role && last.content===msg.content) return prev;
      return [...prev,msg];
    });
  }

  async function send(){
    if(!input.trim()) return;
    const text=input.trim();
    append({role:"user",content:text});
    setInput("");
    setLoading(true);

    const res = await fetch('/stream?input='+encodeURIComponent(text));
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while(true){
      const {value,done} = await reader.read();
      if(done) break;
      buf += decoder.decode(value,{stream:true});
      let idx;
      while((idx = buf.indexOf("\\n")) >= 0){
        const line = buf.slice(0, idx);
        buf = buf.slice(idx+1);
        if(!line.trim()) continue;
        try{
          const ev = JSON.parse(line);
          // handle events
          switch(ev.type){
            case "TextMessageContent":
              append({role:"assistant",content: ev.payload.content});
              break;
            case "ToolCallStart":
              append({role:"assistant",content:`[tool start] ${ev.payload.toolCallName || ev.payload.toolName || ""}`});
              break;
            case "ToolCallArgs":
              // optional: show args summary
              break;
            case "ToolCallEnd":
              break;
            case "ToolCallResult":
              append({role:"assistant",content: ev.payload.content});
              break;
            case "HumanConfirmation":
              // store pending confirmation by id to render ConfirmBox
              const p = ev.payload;
              setPending(prev=>({...prev, [p.toolCallId]:p}));
              break;
            case "RunFinished":
              if(ev.payload && ev.payload.result){
                append({role:"assistant",content:String(ev.payload.result)});
              }
              break;
            case "RunError":
              append({role:"assistant",content:"Error: "+(ev.payload.message || JSON.stringify(ev.payload))});
              break;
            default:
              // ignore other events or debug-show them
              // append({role:"assistant", content: JSON.stringify(ev)});
              break;
          }
        }catch(err){
          console.error("parse err", err, line);
        }
      }
    }
    setLoading(false);
  }

  async function confirmAction(id, approved){
    // remove pending UI
    setPending(prev=>{ const c = {...prev}; delete c[id]; return c; });
    try{
      await fetch("/confirm", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({toolCallId:id, approved: !!approved})
      });
    }catch(err){
      console.error("confirm err", err);
    }
  }

  return React.createElement("div", {style:{height:"100vh",display:"flex",flexDirection:"column"}},
    React.createElement("div",{ref:chatRef,className:"chat"},
      messages.map((m,i)=> React.createElement(Bubble,{key:i,role:m.role}, m.content)),
      Object.entries(pending).map(([id,p]) => React.createElement(ConfirmBox,{key:id,id:id,prompt:p.prompt || JSON.stringify(p), onConfirm:()=>confirmAction(id,true), onCancel:()=>confirmAction(id,false)}))
    ),
    React.createElement("div",{className:"input"},
      React.createElement("textarea",{value:input,onChange:e=>setInput(e.target.value),onKeyDown:e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}},placeholder:"Ask about your data... (Shift+Enter for new line)"}),
      React.createElement("button",{onClick:send,disabled:loading}, loading? "..." : "Send")
    )
  );
}

createRoot(document.getElementById("root")).render(React.createElement(App));
</script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def index():
    return HTMLResponse(INDEX_HTML)


@app.get("/stream")
async def stream(input: str):
    agent = AGUIAgent()

    async def gen():
        async for ev in agent.run(input):
            # produce newline-delimited JSON (NDJSON)
            yield json.dumps(ev, ensure_ascii=False) + "\n"
            # small pause for nicer progressive UI
            await asyncio.sleep(0.01)

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@app.post("/confirm")
async def confirm(request: Request):
    body = await request.json()
    tool_call_id = body.get("toolCallId")
    approved = bool(body.get("approved"))
    fut = confirmation_futures.get(tool_call_id)
    if fut and not fut.done():
        fut.set_result(approved)
        return {"ok": True, "toolCallId": tool_call_id, "approved": approved}
    else:
        return {
            "ok": False,
            "error": "No pending confirmation for this id",
            "toolCallId": tool_call_id,
        }


# ============================================================
# Run with uvicorn when executed directly
# ============================================================
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
