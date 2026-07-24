import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AgentError, callJsonAgent, parseAndValidateAgentJson } from "./llm";

const TestOutputSchema = z.object({
  value: z.string()
});

function providerResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: { content }
        }
      ]
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}

function callTestAgent() {
  return callJsonAgent({
    agentName: "Test Agent",
    schema: TestOutputSchema,
    system: "Return the requested test value.",
    user: JSON.stringify({ request: "test" })
  });
}

describe("parseAndValidateAgentJson", () => {
  it("extracts and validates a JSON object wrapped in surrounding text", () => {
    expect(
      parseAndValidateAgentJson(
        'Here is the result:\n```json\n{"value":"wrapped"}\n```\nDone.',
        TestOutputSchema,
        "Test Agent"
      )
    ).toEqual({ value: "wrapped" });
  });

  it.each([
    ["a response with no object", "No structured result is available."],
    ["a response with malformed JSON", 'Result: {"value": }']
  ])("reports PARSE for %s", (_label, content) => {
    expect(() => parseAndValidateAgentJson(content, TestOutputSchema, "Test Agent")).toThrowError(
      expect.objectContaining<Partial<AgentError>>({ code: "PARSE" })
    );
  });

  it("reports VALIDATION when parsed JSON does not match the schema", () => {
    expect(() =>
      parseAndValidateAgentJson('{"value":42}', TestOutputSchema, "Test Agent")
    ).toThrowError(expect.objectContaining<Partial<AgentError>>({ code: "VALIDATION" }));
  });
});

describe("callJsonAgent repair retry", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("retries once after malformed model JSON and returns the validated repair", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(providerResponse('{"value": }'))
      .mockResolvedValueOnce(providerResponse('{"value":"repaired"}'));

    await expect(callTestAgent()).resolves.toEqual({ value: "repaired" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(secondRequest.messages[0]?.content).toContain("Try once more");
  });

  it("retries once after schema-invalid JSON", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(providerResponse('{"value":42}'))
      .mockResolvedValueOnce(providerResponse('{"value":"valid"}'));

    await expect(callTestAgent()).resolves.toEqual({ value: "valid" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the typed second failure after two invalid responses", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(providerResponse("No JSON object"))
      .mockResolvedValueOnce(providerResponse('{"value": }'));

    await expect(callTestAgent()).rejects.toMatchObject({ code: "PARSE" } satisfies Partial<AgentError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry provider failures", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("upstream unavailable", { status: 503 }));

    await expect(callTestAgent()).rejects.toMatchObject({ code: "PROVIDER" } satisfies Partial<AgentError>);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
