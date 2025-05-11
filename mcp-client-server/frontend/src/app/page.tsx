"use client";
import React, { useEffect, useRef, useState } from "react";

export default function Home() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [chat, setChat] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const evtSourceRef = useRef<EventSource | null>(null);

  // Create a new thread on mount
  useEffect(() => {
    fetch("http://localhost:8000/chat/thread", { method: "POST" })
      .then((res) => res.json())
      .then((data) => setThreadId(data.thread_id));
    return () => {
      if (evtSourceRef.current) evtSourceRef.current.close();
    };
  }, []);

  const sendMessage = () => {
    if (!input.trim() || !threadId) return;
    setChat((prev) => [...prev, `You: ${input}`]);
    setLoading(true);

    // Close previous stream if open
    if (evtSourceRef.current) evtSourceRef.current.close();

    // Stream response from backend
    const url = `http://localhost:8000/chat/thread/${threadId}/ask/${encodeURIComponent(
      input
    )}`;
    const evtSource = new EventSource(url);
    evtSourceRef.current = evtSource;

    let response = "";
    evtSource.onmessage = (event) => {
      response += event.data;
      setChat((prev) => {
        // Replace last AI message or add new
        const last = prev[prev.length - 1];
        if (last && last.startsWith("AI:")) {
          return [...prev.slice(0, -1), `AI: ${response}`];
        }
        return [...prev, `AI: ${response}`];
      });
    };

    evtSource.onerror = () => {
      setLoading(false);
      evtSource.close();
    };

    setInput("");
  };

  return (
    <div className="min-h-screen bg-blue-gray-50 flex flex-col items-center py-10">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Chat API Streaming Data
      </h1>
      <div className="w-full max-w-2xl bg-white rounded shadow p-6">
        <div
          className="space-y-2 mb-6 h-64 overflow-y-auto border rounded p-3 bg-blue-gray-100"
          id="data-container"
        >
          {chat.map((msg, i) => (
            <div
              key={i}
              className={msg.startsWith("You:") ? "text-right" : "text-left"}
            >
              <span
                className={
                  msg.startsWith("You:") ? "text-blue-700" : "text-green-700"
                }
              >
                {msg}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border rounded px-3 py-2 focus:outline-none"
            placeholder="Type your message here"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={loading}
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
