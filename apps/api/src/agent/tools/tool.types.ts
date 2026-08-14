import { z } from "zod";

export interface Tool<TArgs> {
  name: string;
  description: string;
  parameters: z.ZodType<TArgs>;
  execute: (args: TArgs) => Promise<unknown>;
}

export interface RegisteredTool {
  name: string;
  description: string;
  jsonSchema: Record<string, unknown>;
  run: (rawArgs: unknown) => Promise<unknown>;
}

export function defineTool<TArgs>(tool: Tool<TArgs>): RegisteredTool {
  const jsonSchema = z.toJSONSchema(tool.parameters) as Record<string, unknown>;
  delete jsonSchema.$schema;

  return {
    name: tool.name,
    description: tool.description,
    jsonSchema,
    run: async (rawArgs: unknown) => {
      const parsedArgs = tool.parameters.parse(rawArgs);
      return await tool.execute(parsedArgs);
    },
  };
}
