// ---------------------------------------------------------------------------
// Types for what we SEND to the model.
// These are plain TypeScript types: compile-time only, erased when built.
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  }
}

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };