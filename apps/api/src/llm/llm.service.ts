import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { ChatMessage } from "./llm.types";

// ---------------------------------------------------------------------------
// Schema for what we EXPECT BACK.
// This is a Zod schema: it exists at runtime and actually checks the data.
// Only the fields we use are described; unknown fields are ignored.
// ---------------------------------------------------------------------------

const ChatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.string(),
          // Can be null when the model returns tool calls instead of text.
          content: z.string().nullable(),
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
const StreamChunkSchema = z.object({
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

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly baseUrl: string;

  constructor(configService: ConfigService) {
    const baseUrl = configService.get<string>("LLM_BASE_URL");

    // Fail at startup, not on the first request.
    if (!baseUrl) {
      throw new Error("LLM_BASE_URL is not set. Add it to apps/api/.env");
    }

    // Drop a trailing slash so we never build ".../v1//chat/completions".
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Send a conversation to the model and return its reply as text.
   */
  async complete(messages: ChatMessage[]): Promise<string> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        // Google's defaults for Gemma 4. Not arbitrary.
        temperature: 1.0,
        top_p: 0.95,
        top_k: 64,
        stream: false,
      }),
    });

    // fetch only rejects on network failure. A 500 is a fulfilled promise.
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `llama-server returned ${response.status}: ${body.slice(0, 500)}`,
      );
    }

    // `unknown`, not `any` — nothing may touch it until it has been validated.
    const raw: unknown = await response.json();

    // Throws immediately, at the boundary, if the shape is wrong.
    const parsed = ChatCompletionSchema.parse(raw);

    const choice = parsed.choices[0];
    if (choice.message.content === null) {
      throw new Error(
        `Model returned no text content (finish_reason: ${choice.finish_reason})`,
      );
    }

    this.logger.log(`Completion finished: ${choice.finish_reason}`);

    return choice.message.content;
  }

  /**
   * Send a conversation to the model and return its reply as streamed text.
   */
  async completeStream(
    messages: ChatMessage[],
    onToken: (token: string) => void,
  ): Promise<string> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        temperature: 1.0,
        top_p: 0.95,
        top_k: 64,
        stream: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `llama-server returned ${response.status}: ${body.slice(0, 500)}`,
      );
    }

    if (!response.body) {
      throw new Error("llama-server returned no response body");
    }

    // ONE decoder for the whole stream. `{ stream: true }` below makes it
    // hold on to partial multi-byte characters (a "£" is two bytes) until
    // the rest arrives in the next chunk.
    const decoder = new TextDecoder();

    // Chunk boundaries do not line up with line boundaries. Whatever is
    // left over after the last complete line waits here for the next chunk.
    let buffer = "";
    let fullResponse = "";

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });

      const lines = buffer.split("\n");
      // The final element is either an incomplete line or an empty string.
      // Either way it is not ready yet, so put it back in the buffer.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        // Blank lines separate events; anything else is not ours.
        if (trimmed === "" || !trimmed.startsWith("data: ")) {
          continue;
        }

        const payload = trimmed.slice("data: ".length);

        // The terminator is the literal text [DONE], not JSON.
        if (payload === "[DONE]") {
          continue;
        }

        let json: unknown;
        try {
          json = JSON.parse(payload);
        } catch {
          this.logger.warn(`Could not parse chunk: ${payload.slice(0, 200)}`);
          continue;
        }

        // safeParse returns a result object instead of throwing, so one
        // odd chunk cannot kill the whole stream.
        const result = StreamChunkSchema.safeParse(json);
        if (!result.success) {
          this.logger.warn(`Unexpected chunk shape: ${payload.slice(0, 200)}`);
          continue;
        }

        const token = result.data.choices[0].delta.content;
        if (token) {
          fullResponse += token;
          onToken(token);
        }
      }
    }

    return fullResponse;
  }

  /**
   * Ask the model for JSON matching a schema, and return it as a typed object.
   *
   * The schema is sent to llama-server, which turns it into a grammar and
   * restricts sampling so that only schema-valid output can be generated.
   * Malformed JSON is impossible rather than merely unlikely.
   */
  async completeStructured<T>(
    messages: ChatMessage[],
    schema: z.ZodType<T>,
    schemaName = "response",
  ): Promise<T> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    // Zod is a TypeScript library; llama.cpp speaks JSON Schema. Translate.
    const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;

    // Zod adds a "$schema" declaration that llama.cpp has no use for.
    delete jsonSchema.$schema;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        temperature: 1.0,
        top_p: 0.95,
        top_k: 64,
        stream: false,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema: jsonSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `llama-server returned ${response.status}: ${body.slice(0, 500)}`,
      );
    }

    const raw: unknown = await response.json();
    const parsed = ChatCompletionSchema.parse(raw);

    const content = parsed.choices[0].message.content;
    if (content === null) {
      throw new Error("Model returned no content for a structured request");
    }

    // The grammar makes this very unlikely, but the server could be older or
    // have ignored the schema, so never assume.
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      throw new Error(`Model returned invalid JSON: ${content.slice(0, 300)}`);
    }

    // The grammar guarantees the SHAPE. It says nothing about whether the
    // values are sensible, so validate anyway.
    return schema.parse(json);
  }

  /**
   * Check whether llama-server is reachable and ready to serve.
   *
   * On failure the reason is returned as well as logged, so the health
   * endpoint can report it rather than leaving it buried in the logs.
   * The three failure modes are worth distinguishing: connection refused
   * (not running), timeout (running but wedged), and an HTTP error —
   * llama.cpp answers 503 with "Loading model" while weights are still
   * loading, which is temporary rather than broken.
   */
  async ping(): Promise<PingResult> {
    const url = `${this.baseUrl}/health`;

    try {
      const response = await fetch(url, {
        method: "GET",
        // A health check must give a fast, definite answer. Without this,
        // a wedged server would hang the whole /health endpoint.
        signal: AbortSignal.timeout(2000),
      });

      if (!response.ok) {
        // A response body can only be read once, so capture it rather than
        // consuming it inside the log call.
        const body = (await response.text()).trim();
        const message = `llama-server returned ${response.status}${
          body ? `: ${body.slice(0, 200)}` : ""
        }`;

        this.logger.warn(message);
        return { ok: false, message };
      }

      return { ok: true };
    } catch (error) {
      // JavaScript allows throwing anything, so a caught value is `unknown`
      // until proven otherwise — the same principle as validating with Zod.
      const cause = error instanceof Error ? error.message : String(error);
      const message = `llama-server unreachable: ${cause}`;

      this.logger.warn(message);
      return { ok: false, message };
    }
  }
}
