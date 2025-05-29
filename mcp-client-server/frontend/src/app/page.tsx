"use client";

import React, { useEffect, useRef, useState } from "react";

function TableComponent({ data }: { data: any[] }) {
  if (!data || (Array.isArray(data) && data.length === 0))
    return <div>No data</div>;

  // Normalize: if data is not an array, wrap it in an array
  let rows = Array.isArray(data) ? data : [data];
  if (typeof rows[0] === "string") {
    try {
      rows = rows.map((row) => JSON.parse(row));
    } catch {
      rows = rows.map((row) => ({ value: row }));
    }
  }

  const columns = Object.keys(rows[0] || {});

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} className="border px-2 py-1 bg-gray-100">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col} className="border px-2 py-1">
                  {row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListComponent({ data }: { data: string[] }) {
  return (
    <ul className="list-disc pl-5">
      {data.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const TOOL_NAMES = ["list_tables", "describe_table", "select_data"] as const;
type ToolName = (typeof TOOL_NAMES)[number];

type ToolComponent = {
  loading: (props?: any) => React.JSX.Element;
  final: (props?: any) => React.JSX.Element;
};

type ToolComponentMap = {
  [tool in ToolName]: ToolComponent;
};

const TOOL_COMPONENT_MAP: ToolComponentMap = {
  list_tables: {
    loading: () => <div>Loading tables...</div>,
    final: (props: any) => (
      <ListComponent
        data={props.data.map((row: any) =>
          typeof row === "string"
            ? JSON.parse(row).name || row
            : row.name || JSON.stringify(row)
        )}
      />
    ),
  },
  describe_table: {
    loading: () => <div>Loading table description...</div>,
    final: (props: any) => <TableComponent data={props.data} />,
  },
  select_data: {
    loading: () => <div>Loading data...</div>,
    final: (props: any) => <TableComponent data={props.data} />,
  },
};

// Helper to detect tool call and extract tool name/data from new JSON message format
function parseToolMessage(
  msg: any
): { tool: ToolName; loading?: boolean; data?: any[] } | null {
  // Tool call (AI message with function_call)
  if (
    msg.type === "ai" &&
    msg.additional_kwargs &&
    msg.additional_kwargs.function_call &&
    TOOL_NAMES.includes(msg.additional_kwargs.function_call.name)
  ) {
    return {
      tool: msg.additional_kwargs.function_call.name as ToolName,
      loading: true,
    };
  }
  // Tool result (tool message with name)
  if (msg.type === "tool" && TOOL_NAMES.includes(msg.name)) {
    let data = [];
    try {
      data = JSON.parse(msg.content);
    } catch {}
    return { tool: msg.name as ToolName, data };
  }
  return null;
}

function ToolMessage({
  toolInfo,
}: {
  toolInfo: ReturnType<typeof parseToolMessage>;
}) {
  if (!toolInfo) return null;
  const tool = toolInfo.tool;
  if (toolInfo.loading) {
    return TOOL_COMPONENT_MAP[tool].loading();
  }
  return TOOL_COMPONENT_MAP[tool].final({ data: toolInfo.data });
}

// InterruptMessage component for __interrupt__ blocks
function InterruptMessage({
  question,
  onContinue,
  loading,
}: {
  question: string;
  onContinue: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <div className="self-center bg-yellow-100 border border-yellow-300 text-yellow-900 px-4 py-3 rounded-2xl max-w-[80%] flex flex-col items-center gap-2 mt-2">
      <div>{question}</div>
      <button
        onClick={onContinue}
        disabled={loading}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {loading ? "..." : "Continue"}
      </button>
    </div>
  );
}

function MessageList({
  messages,
  interrupt,
  onContinue,
  continueLoading,
}: {
  messages: any[];
  interrupt: { question: string } | null;
  onContinue: () => Promise<void>;
  continueLoading: boolean;
}) {
  return (
    <div className="min-h-[200px] mb-4 flex flex-col gap-2">
      {messages.map((msg: any, i: number) => {
        const toolInfo = msg._raw ? parseToolMessage(msg._raw) : null;
        if (toolInfo && TOOL_NAMES.includes(toolInfo.tool)) {
          return (
            <div
              key={i}
              className="self-start bg-gray-100 text-gray-900 px-4 py-2 rounded-2xl max-w-[80%] border border-gray-200"
            >
              <ToolMessage toolInfo={toolInfo} />
            </div>
          );
        }
        return (
          <div
            key={i}
            className={
              msg.role === "user"
                ? "self-end bg-blue-500 text-white px-4 py-2 rounded-2xl max-w-[80%]"
                : "self-start bg-gray-100 text-gray-900 px-4 py-2 rounded-2xl max-w-[80%] border border-gray-200"
            }
            style={{ whiteSpace: "pre-wrap" }}
          >
            {msg.content}
          </div>
        );
      })}
      {interrupt && (
        <InterruptMessage
          question={interrupt.question}
          onContinue={onContinue}
          loading={continueLoading}
        />
      )}
    </div>
  );
}

function MessageInput({
  input,
  setInput,
  loading,
  threadId,
  onSend,
  inputRef,
}: {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  threadId: string | null;
  onSend: (e: React.FormEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <form onSubmit={onSend} className="flex gap-2">
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type your message..."
        className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        disabled={loading || !threadId}
      />
      <button
        type="submit"
        disabled={loading || !input.trim() || !threadId}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {loading ? "..." : "Send"}
      </button>
    </form>
  );
}

function Chat() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [interrupt, setInterrupt] = useState<{ question: string } | null>(null);
  const [continueLoading, setContinueLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Create a thread on mount
    fetch("http://localhost:8000/chat/thread", { method: "POST" })
      .then((res) => res.json())
      .then((data) => setThreadId(data.thread_id));
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId) return;
    setLoading(true);
    setInterrupt(null);
    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    try {
      const res = await fetch(
        `http://localhost:8000/chat/thread/${threadId}/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ type: "human", content: userMsg }],
            thread_id: threadId,
          }),
        }
      );
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        setMessages(
          data.messages
            .filter((msg: any) => msg.type !== "system")
            .map((msg: any) => ({
              role: msg.type === "human" ? "user" : "assistant",
              content: msg.content,
              _raw: msg,
            }))
        );
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "[No response]" },
        ]);
      }
      // Interrupt detection
      if (
        data &&
        Array.isArray(data.__interrupt__) &&
        data.__interrupt__[0]?.value?.question
      ) {
        setInterrupt({ question: data.__interrupt__[0].value.question });
      } else {
        setInterrupt(null);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "[Error sending message]" },
      ]);
      setInterrupt(null);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleContinue = async () => {
    if (!threadId) return;
    setContinueLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/chat/thread/${threadId}/continue`,
        { method: "GET" }
      );
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        setMessages(
          data.messages
            .filter((msg: any) => msg.type !== "system")
            .map((msg: any) => ({
              role: msg.type === "human" ? "user" : "assistant",
              content: msg.content,
              _raw: msg,
            }))
        );
      }
      // Check for further interrupt
      if (
        data &&
        Array.isArray(data.__interrupt__) &&
        data.__interrupt__[0]?.value?.question
      ) {
        setInterrupt({ question: data.__interrupt__[0].value.question });
      } else {
        setInterrupt(null);
      }
    } catch {
      // Optionally handle error
      setInterrupt(null);
    } finally {
      setContinueLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 border border-gray-200 rounded-lg bg-white shadow">
      <MessageList
        messages={messages}
        interrupt={interrupt}
        onContinue={handleContinue}
        continueLoading={continueLoading}
      />
      <MessageInput
        input={input}
        setInput={setInput}
        loading={loading}
        threadId={threadId}
        onSend={sendMessage}
        inputRef={inputRef}
      />
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Chat />
    </div>
  );
}
