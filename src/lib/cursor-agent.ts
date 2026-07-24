import { Agent } from "@cursor/sdk";

export type AgentRunOutcome = {
  status: string;
  resultText: string;
  runId?: string;
};

export async function runPersonaAgent(prompt: string): Promise<AgentRunOutcome> {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY is not set");
  }

  const modelId = process.env.CURSOR_MODEL_ID ?? "grok-4.5";
  const runtime = process.env.CURSOR_RUNTIME ?? "local";

  const options =
    runtime === "cloud"
      ? {
          apiKey,
          model: { id: modelId },
          cloud: {
            repos: [
              {
                url: process.env.CURSOR_REPO_URL!,
                startingRef: process.env.CURSOR_REPO_REF ?? "main",
              },
            ],
          },
        }
      : {
          apiKey,
          model: { id: modelId },
          local: { cwd: process.cwd() },
        };

  if (runtime === "cloud" && !process.env.CURSOR_REPO_URL) {
    throw new Error("CURSOR_REPO_URL is required when CURSOR_RUNTIME=cloud");
  }

  const result = await Agent.prompt(prompt, options);
  return {
    status: result.status,
    resultText: result.result ?? "",
    runId: result.id,
  };
}
