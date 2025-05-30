interface InterruptFormProps {
  question: string;
  tool_call: {
    name: string;
    args: Record<string, any>;
    id: string;
    type: string;
  };
  onConfirm: (data: string) => void;
}

export function InterruptForm({
  question,
  tool_call,
  onConfirm,
}: InterruptFormProps) {
  return (
    <div className="p-4 bg-gray-100 rounded shadow">
      <p>{question}</p>
      <p>{tool_call.name}</p>
      {Object.entries(tool_call.args || {}).map(([key, value]) => (
        <div key={key}>
          {key}: {value}
        </div>
      ))}
      <button
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
        onClick={() => onConfirm(JSON.stringify({ action: "continue" }))}
      >
        Confirm
      </button>
    </div>
  );
}
