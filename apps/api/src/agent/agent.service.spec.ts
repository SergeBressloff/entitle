import { LlmService } from "../llm/llm.service";
import { AssistantReply, ChatMessage, ToolCall } from "../llm/llm.types";
import { AgentService } from "./agent.service";

/**
 * A stand-in for LlmService that returns scripted replies instead of calling
 * a model, and records the conversation it was given on each call.
 *
 * `replies` is read in order. Once it runs out the last entry repeats, which
 * is how the iteration-cap test keeps the model "asking" forever.
 */
function makeFakeLlm(replies: AssistantReply[]) {
  const seen: ChatMessage[][] = [];
  let callCount = 0;

  const llm = {
    completeWithTools: async (messages: ChatMessage[]) => {
      // Copy: the loop keeps pushing to the same array, so storing a
      // reference would leave every captured entry looking identical.
      seen.push([...messages]);

      const reply = replies[callCount] ?? replies[replies.length - 1];
      callCount++;
      return reply;
    },
    // AgentService only ever calls completeWithTools, so the rest of the
    // real class is deliberately absent. Hence the cast.
  } as unknown as LlmService;

  return { llm, seen };
}

/** A reply that asks for one tool, followed by a reply that finishes. */
function scriptOneToolCall(call: ToolCall): AssistantReply[] {
  return [
    { content: null, tool_calls: [call], finish_reason: "tool_calls" },
    { content: "done", finish_reason: "stop" },
  ];
}

describe("AgentService", () => {
  const unknownToolCall: ToolCall = {
    id: "call_1",
    type: "function",
    function: { name: "does_not_exist", arguments: "{}" },
  };

  it("tells the model when it asked for a tool that does not exist", async () => {
    const { llm, seen } = makeFakeLlm(scriptOneToolCall(unknownToolCall));

    const answer = await new AgentService(llm).ask("anything");

    // seen[0] is [system, user]; seen[1] also has the assistant reply and
    // the tool result the loop appended.
    const toolMessage = seen[1].find((m) => m.role === "tool");

    expect(toolMessage?.content).toContain("Unknown tool");
    // The message must list what IS available, so the model can correct itself.
    expect(toolMessage?.content).toContain("lookup_benefit_rate");

    // The loop recovered rather than dying.
    expect(answer).toBe("done");
  });

  it("tells the model when the arguments are not valid JSON", async () => {
    const { llm, seen } = makeFakeLlm(
      scriptOneToolCall({
        id: "call_2",
        type: "function",
        function: { name: "lookup_benefit_rate", arguments: "{bad json}" },
      }),
    );

    const answer = await new AgentService(llm).ask("anything");

    const toolMessage = seen[1].find((m) => m.role === "tool");

    expect(toolMessage?.content).toContain("not valid JSON");
    expect(answer).toBe("done");
  });

  it("tells the model when the arguments fail validation", async () => {
    // Valid JSON, but "nonsense" is not one of the permitted benefits — a
    // different code path from the test above.
    const { llm, seen } = makeFakeLlm(
      scriptOneToolCall({
        id: "call_3",
        type: "function",
        function: {
          name: "lookup_benefit_rate",
          arguments: '{"benefit":"nonsense","tax_year":"2026-27"}',
        },
      }),
    );

    const answer = await new AgentService(llm).ask("anything");

    const toolMessage = seen[1].find((m) => m.role === "tool");

    expect(toolMessage?.content).toContain("Invalid arguments");
    expect(answer).toBe("done");
  });

  it("gives up once the model stops settling", async () => {
    // Only one scripted reply, so the fake repeats it and the model never
    // produces a final answer.
    const { llm, seen } = makeFakeLlm([
      {
        content: null,
        tool_calls: [unknownToolCall],
        finish_reason: "tool_calls",
      },
    ]);

    await expect(new AgentService(llm).ask("anything")).rejects.toThrow(
      /iterations/i,
    );

    // Stopped at exactly MAX_ITERATIONS rather than some other number.
    expect(seen).toHaveLength(6);
  });
});
