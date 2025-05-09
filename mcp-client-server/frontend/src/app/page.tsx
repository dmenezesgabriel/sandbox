"use client";

import { useChat } from "@ai-sdk/react";

export default function Page() {
  const { messages, input, handleSubmit, handleInputChange, status } = useChat({
    api: "http://localhost:8000/chat/invoke",
    streamProtocol: "text",
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 p-4">
        {JSON.stringify(messages.at(-1), null, 2)}
        {messages.map((message) => (
          <div key={message.id} className="flex flex-row gap-2">
            <div className="flex-shrink-0 w-24 text-zinc-500">{`${message.role}: `}</div>
            <div className="flex flex-col gap-2">{message.content}</div>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="fixed bottom-0 flex flex-col w-full border-t"
      >
        <input
          value={input}
          placeholder="Why is the sky blue?"
          onChange={handleInputChange}
          className="w-full p-4 bg-transparent outline-none"
          disabled={status !== "ready"}
        />
      </form>
    </div>
  );
}
