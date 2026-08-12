import { Body, Controller, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { ChatMessage, LlmService } from "./llm.service";

const SYSTEM_PROMPT =
  "Stick to UK welfare. Do not invent figures. Be honest if you do not know or are uncertain.";
const CLASSIFIER_PROMPT =
  "You are a classifier that determines whether a question is in scope for UK welfare benefits. Answer with a JSON object with two fields: `in_scope` (boolean) and `reason` (string). Be honest if you do not know or are uncertain.";
const ScopeCheckSchema = z.object({
  in_scope: z.boolean(),
  reason: z.string(),
});

@Controller("llm")
export class LlmController {
  constructor(private readonly llmService: LlmService) {}
  @Post("chat")
  async chat(@Body() body: { question: string }) {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: body.question },
    ];
    const answer = await this.llmService.complete(messages);
    return { answer };
  }
  @Post("chat-stream")
  async chatStream(@Body() body: { question: string }, @Res() res: Response) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: body.question },
    ];
    await this.llmService.completeStream(messages, (token) => {
      res.write(token);
    });
    res.end();
  }
  @Post("classify")
  async classify(@Body() body: { question: string }) {
    const messages: ChatMessage[] = [
      { role: "system", content: CLASSIFIER_PROMPT },
      { role: "user", content: body.question },
    ];
    const result = await this.llmService.completeStructured(
      messages,
      ScopeCheckSchema,
      "scope_check",
    );
    return result;
  }
}
