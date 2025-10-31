# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "fastapi==0.115.0",
#     "litellm==1.78.5",
#     "python-dotenv==1.1.1",
#     "pydantic==2.12.3",
#     "uvicorn==0.32.0",
# ]
# ///

import asyncio
import json
import os
import time
import uuid
from enum import Enum
from typing import Any, AsyncIterable, Dict

import litellm
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse

load_dotenv()
app = FastAPI(title="AGUI Weather Chat")


# ============================================================
#  EVENT TYPES
# ============================================================


class AGEventType(str, Enum):
    RUN_STARTED = "RunStarted"
    RUN_FINISHED = "RunFinished"
    RUN_ERROR = "RunError"
    TEXT_START = "TextMessageStart"
    TEXT_CONTENT = "TextMessageContent"
    TEXT_END = "TextMessageEnd"
    TOOL_START = "ToolCallStart"
    TOOL_ARGS = "ToolCallArgs"
    TOOL_END = "ToolCallEnd"
    TOOL_RESULT = "ToolCallResult"
    HUMAN_CONFIRMATION = "HumanConfirmation"


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
#  TOOLS
# ============================================================


def get_weather(location: str):
    return f"The temperature in {location} is 20°C."


tools = [
    {
        "type": "function",
        "name": "get_weather",
        "description": "Get current temperature for provided coordinates in Celsius.",
        "parameters": {
            "type": "object",
            "properties": {"location": {"type": "string"}},
            "required": ["location"],
        },
        "strict": True,
    }
]


# ============================================================
#  AGENT
# ============================================================


class AGUIAgent:
    def __init__(self, model: str):
        self.model = model

    async def run(self, user_input: str) -> AsyncIterable[Dict[str, Any]]:
        run_id = str(uuid.uuid4())
        yield make_event(
            AGEventType.RUN_STARTED, {"runId": run_id, "input": user_input}
        )
        yield make_event(
            AGEventType.TEXT_START, {"role": "user", "content": user_input}
        )

        messages = [
            {
                "role": "system",
                "content": "You're a helpful weather assistant.",
            },
            {"role": "user", "content": user_input},
        ]

        try:
            completion = litellm.completion(
                model=self.model, messages=messages, tools=tools
            )
            message = completion.choices[0].message

            if message.tool_calls:
                for tool_call in message.tool_calls:
                    tool_name = tool_call.function.name
                    tool_args = json.loads(tool_call.function.arguments)

                    yield make_event(
                        AGEventType.TOOL_START, {"toolName": tool_name}
                    )
                    yield make_event(
                        AGEventType.HUMAN_CONFIRMATION,
                        {"toolName": tool_name, "approved": True},
                    )
                    result = self.call_function(tool_name, tool_args)
                    yield make_event(
                        AGEventType.TOOL_RESULT,
                        {"toolName": tool_name, "result": result},
                    )
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": result,
                        }
                    )
            else:
                yield make_event(
                    AGEventType.TEXT_CONTENT, {"content": message.content}
                )

            yield make_event(AGEventType.RUN_FINISHED, {"runId": run_id})
        except Exception as e:
            yield make_event(
                AGEventType.RUN_ERROR, {"error": str(e), "runId": run_id}
            )

    def call_function(self, name: str, args: Dict[str, Any]):
        if name == "get_weather":
            return get_weather(**args)
        raise ValueError(f"Unknown function {name}")


# ============================================================
#  FASTAPI ROUTES
# ============================================================


@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    """Serve simple but pretty React chat UI."""
    return HTMLResponse(
        """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AGUI Weather Chat</title>
  <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.3.1",
        "react-dom/client": "https://esm.sh/react-dom@18.3.1"
      }
    }
  </script>
</head>
<body style="font-family: system-ui, sans-serif; background:#f3f4f6; margin:0; padding:0;">
  <div id="root"></div>
  <script type="module">
    import React, { useState, useEffect, useRef } from "react";
    import { createRoot } from "react-dom/client";

    function ChatApp() {
      const [input, setInput] = useState("");
      const [messages, setMessages] = useState([]);
      const [loading, setLoading] = useState(false);
      const chatRef = useRef(null);

      useEffect(() => {
        if (chatRef.current) {
          chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
      }, [messages]);

      async function sendMessage() {
        if (!input.trim()) return;
        const userMsg = { role: "user", content: input };
        setMessages((m) => [...m, userMsg]);
        setInput("");
        setLoading(true);

        const res = await fetch(`/stream?input=${encodeURIComponent(userMsg.content)}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary;
          while ((boundary = buffer.indexOf("\\n")) >= 0) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 1);
            if (chunk.trim()) {
              try {
                const ev = JSON.parse(chunk);
                if (ev.type === "TextMessageContent") {
                  setMessages((m) => [...m, { role: "assistant", content: ev.payload.content }]);
                } else if (ev.type === "ToolCallResult") {
                  setMessages((m) => [...m, { role: "assistant", content: ev.payload.result }]);
                }
              } catch (e) {
                console.error("JSON parse error:", e);
              }
            }
          }
        }
        setLoading(false);
      }

      const bubbleStyle = (role) => ({
        alignSelf: role === "user" ? "flex-end" : "flex-start",
        background: role === "user" ? "#2563eb" : "#e5e7eb",
        color: role === "user" ? "white" : "black",
        padding: "0.6em 1em",
        borderRadius: "1em",
        margin: "0.25em 0",
        maxWidth: "70%",
        wordBreak: "break-word"
      });

      return (
        React.createElement("div", { style: { height: "100vh", display: "flex", flexDirection: "column" } },
          React.createElement("div", {
              ref: chatRef,
              style: {
                flex: 1,
                overflowY: "auto",
                padding: "1em",
                display: "flex",
                flexDirection: "column",
                gap: "0.5em",
                background: "#f9fafb"
              }
            },
            messages.map((msg, i) =>
              React.createElement("div", { key: i, style: bubbleStyle(msg.role) }, msg.content)
            )
          ),
          React.createElement("div", {
              style: {
                padding: "0.5em",
                background: "white",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                gap: "0.5em"
              }
            },
            React.createElement("input", {
              value: input,
              onChange: (e) => setInput(e.target.value),
              onKeyDown: (e) => e.key === "Enter" && sendMessage(),
              placeholder: "Ask about weather...",
              style: {
                flex: 1,
                padding: "0.75em",
                border: "1px solid #d1d5db",
                borderRadius: "0.5em"
              }
            }),
            React.createElement("button", {
              onClick: sendMessage,
              disabled: loading,
              style: {
                padding: "0.75em 1em",
                background: loading ? "#9ca3af" : "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "0.5em",
                cursor: "pointer"
              }
            }, loading ? "..." : "Send")
          )
        )
      );
    }

    createRoot(document.getElementById("root")).render(React.createElement(ChatApp));
  </script>
</body>
</html>
        """
    )


@app.get("/stream")
async def stream_events(input: str):
    agent = AGUIAgent(model="gemini/gemini-2.0-flash")

    async def event_stream():
        async for event in agent.run(input):
            yield json.dumps(event) + "\n"
            await asyncio.sleep(0.05)

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


# ============================================================
#  MAIN
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
