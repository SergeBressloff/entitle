import { z } from "zod";

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
  };
}

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

// ---------------------------------------------------------------------------
// Schema for what we EXPECT BACK.
// This is a Zod schema: it exists at runtime and actually checks the data.
// Only the fields we use are described; unknown fields are ignored.
// ---------------------------------------------------------------------------
export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export const ChatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.string(),
          // Can be null when the model returns tool calls instead of text.
          content: z.string().nullable(),
          tool_calls: z.array(ToolCallSchema).nullish(),
        }),
        finish_reason: z.string().nullable(),
      }),
    )
    .min(1),
});

// Derive the TypeScript type from the schema, so the shape is written once.
export type ChatCompletion = z.infer<typeof ChatCompletionSchema>;

// Streaming sends many small chunks with a different shape: `delta` (the new
// fragment) rather than `message` (the whole reply). `content` is optional
// because the first chunk carries only the role, and the last carries only
// finish_reason.
export const StreamChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z.object({
          content: z.string().nullish(),
        }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

// Health check type for the ping endpoint. The server returns a JSON
// object with an "ok" boolean and an optional "message" string.
export interface PingResult {
  ok: boolean;
  message?: string;
}

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AssistantReply = {
  content: string | null;
  tool_calls?: ToolCall[];
  finish_reason: string | null;
};
