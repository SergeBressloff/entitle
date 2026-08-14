import { Injectable, Logger } from "@nestjs/common";
import { LlmService } from "../llm/llm.service";
import { ChatMessage, ToolCall, ToolDefinition } from "../llm/llm.types";
import { tools } from "./tools";
import { RegisteredTool } from "./tools/tool.types";

/**
 * How many times the model may be called for a single question. Without a cap,
 * a model that keeps requesting the same tool loops forever.
 */
const MAX_ITERATIONS = 6;

const AGENT_PROMPT = [
  "You are an assistant that helps people understand UK welfare benefits.",
  "Always use the available tools to look up figures. Never state a benefit",
  "amount from memory — rates change every tax year.",
  "If a tool reports that information is missing, ask the user for it rather",
  "than guessing.",
  "If a question is not about UK welfare benefits, say that it is outside",
  "what you can help with.",
].join(" ");

/** JavaScript allows throwing anything, so a caught value is `unknown`. */
function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

@Injectable()
export class AgentService {
  private readonly toolsByName: Map<string, RegisteredTool>;
  private readonly toolDefinitions: ToolDefinition[];
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly llmService: LlmService) {
    // Both are built once at startup. The registry never changes at runtime.
    this.toolsByName = new Map();
    for (const tool of tools) {
      this.toolsByName.set(tool.name, tool);
    }

    this.toolDefinitions = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.jsonSchema,
      },
    }));
  }

  /**
   * Answer a question, calling tools as many times as the model asks.
   *
   * The `messages` array is the entire state of the conversation. Each pass
   * sends all of it — the model remembers nothing between requests.
   */
  async ask(question: string): Promise<string> {
    const messages: ChatMessage[] = [
      { role: "system", content: AGENT_PROMPT },
      { role: "user", content: question },
    ];

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      const reply = await this.llmService.completeWithTools(
        messages,
        this.toolDefinitions,
      );

      // Push the reply verbatim, including tool_calls. Without this record the
      // model has no memory of having asked, and will ask again next pass.
      messages.push({
        role: "assistant",
        content: reply.content,
        tool_calls: reply.tool_calls,
      });

      // No tool calls means the model is done. This is the only way out.
      if (!reply.tool_calls || reply.tool_calls.length === 0) {
        this.logger.log(`Answered after ${iteration} iteration(s)`);
        return reply.content ?? "";
      }

      this.logger.log(
        `Iteration ${iteration}: model requested ${reply.tool_calls.length} tool call(s)`,
      );

      // Every call needs a matching tool message before the next model call,
      // or the conversation is malformed and llama-server will reject it.
      for (const call of reply.tool_calls) {
        const result = await this.runToolCall(call);

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          // Must be a string: the model reads this as text.
          content: JSON.stringify(result),
        });
      }
    }

    // Reaching here means the model never settled. Better to fail loudly than
    // to keep going.
    throw new Error(
      `Agent did not produce an answer within ${MAX_ITERATIONS} iterations`,
    );
  }

  /**
   * Run one tool call. Never throws: every failure is returned as data so the
   * model can read it on the next pass and correct itself.
   */
  private async runToolCall(call: ToolCall): Promise<unknown> {
    const { name, arguments: rawArgs } = call.function;
    this.logger.log(`Calling ${name} with ${rawArgs}`);

    const tool = this.toolsByName.get(name);

    if (!tool) {
      const available = [...this.toolsByName.keys()].join(", ");
      const message = `Unknown tool "${name}". Available: ${available}`;
      this.logger.warn(message);
      return { error: message };
    }

    // Model-generated text, so it may not be valid JSON at all.
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(rawArgs);
    } catch (error) {
      this.logger.warn(`${name}: arguments were not valid JSON — ${rawArgs}`);
      return {
        error: "Arguments were not valid JSON",
        details: describeError(error),
      };
    }

    try {
      // tool.run validates with Zod before executing, so a wrong or missing
      // field throws here and the message names the offending property.
      const result = await tool.run(parsedArgs);
      this.logger.log(`${name} returned ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      const details = describeError(error);
      this.logger.warn(`${name}: invalid arguments — ${details}`);
      return { error: "Invalid arguments", details };
    }
  }
}
