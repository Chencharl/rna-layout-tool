import type { ValidationMessage } from "@/lib/types";

type ValidationPanelProps = {
  messages: ValidationMessage[];
};

export function ValidationPanel({ messages }: ValidationPanelProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Validation</h2>
      </div>
      <div className="validation-list">
        {messages.map((message) => (
          <div key={message.id} className={`validation-item ${message.level}`}>
            <strong>{message.level === "success" ? "Ready" : message.level}</strong>
            <span>{message.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
