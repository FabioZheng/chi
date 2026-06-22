import { z } from "zod";

type Provider = "openai" | "openrouter";

type CallJsonAgentArgs<T> = {
  agentName: string;
  schema: z.ZodType<T>;
  system: string;
  user: string;
  temperature?: number;
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ProviderConfig = {
  url: string;
  model: string;
  headers: Record<string, string>;
};

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: "CONFIG" | "PROVIDER" | "PARSE" | "VALIDATION"
  ) {
    super(message);
  }
}

const JSON_RULES = [
  "Return one JSON object only.",
  "Do not wrap the JSON in markdown.",
  "Do not include raw chain-of-thought, hidden reasoning, or private deliberation.",
  "Use concise rationale and summary fields only.",
  "Every array item must include a stable id."
].join(" ");

function resolveProvider(): Provider {
  const configured = process.env.LLM_PROVIDER?.toLowerCase();

  if (configured === "openrouter") {
    return "openrouter";
  }

  if (configured === "openai") {
    return "openai";
  }

  return process.env.OPENROUTER_API_KEY ? "openrouter" : "openai";
}

function providerConfig(provider: Provider): ProviderConfig {
  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new AgentError("Missing OPENROUTER_API_KEY in .env.", "CONFIG");
    }

    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME || "Assumption-Aware Agent Planner"
      }
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new AgentError("Missing OPENAI_API_KEY in .env.", "CONFIG");
  }

  return {
    url: "https://api.openai.com/v1/chat/completions",
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  };
}

function parseJsonObject(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new AgentError("The model response did not contain a JSON object.", "PARSE");
    }

    try {
      return JSON.parse(content.slice(start, end + 1));
    } catch {
      throw new AgentError("The model response contained malformed JSON.", "PARSE");
    }
  }
}

function extractMessageContent(payload: unknown): string {
  const parsed = z
    .object({
      choices: z
        .array(
          z.object({
            message: z.object({
              content: z.union([z.string(), z.array(z.unknown())]).nullable()
            })
          })
        )
        .min(1)
    })
    .parse(payload);

  const content = parsed.choices[0]?.message.content;

  if (typeof content === "string") {
    return content;
  }

  throw new AgentError("The provider returned an unsupported message content shape.", "PROVIDER");
}

export async function callJsonAgent<T>({
  agentName,
  schema,
  system,
  user,
  temperature = 0.2
}: CallJsonAgentArgs<T>): Promise<T> {
  const provider = resolveProvider();
  const config = providerConfig(provider);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${system}\n\n${JSON_RULES}`
    },
    {
      role: "user",
      content: user
    }
  ];

  const response = await fetch(config.url, {
    method: "POST",
    headers: config.headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new AgentError(`${agentName} provider call failed: ${detail}`, "PROVIDER");
  }

  const payload = await response.json();
  const content = extractMessageContent(payload);
  const rawJson = parseJsonObject(content);
  const validated = schema.safeParse(rawJson);

  if (!validated.success) {
    throw new AgentError(
      `${agentName} returned JSON that failed validation: ${validated.error.message}`,
      "VALIDATION"
    );
  }

  return validated.data;
}
