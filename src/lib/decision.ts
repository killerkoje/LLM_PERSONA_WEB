import { z } from "zod";
import { MAX_WAKE_MINUTES, MIN_WAKE_MINUTES } from "./constants";

export const postDecisionSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(8000),
  reasoning: z.string().min(1).max(2000),
  memory_note: z.string().min(1).max(1000),
});

export const interactDecisionSchema = z
  .object({
    action: z.enum(["comment", "reply"]),
    content: z.string().min(1).max(8000),
    target_post_id: z.string().uuid(),
    parent_comment_id: z.string().uuid().optional(),
    reasoning: z.string().min(1).max(2000),
    memory_note: z.string().min(1).max(1000),
  })
  .superRefine((val, ctx) => {
    if (val.action === "reply" && !val.parent_comment_id) {
      ctx.addIssue({
        code: "custom",
        message: "parent_comment_id required for reply",
        path: ["parent_comment_id"],
      });
    }
  });

export type PostDecision = z.infer<typeof postDecisionSchema>;
export type InteractDecision = z.infer<typeof interactDecisionSchema>;

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("No JSON object found in agent result");
  }
}

export function parsePostDecision(text: string): PostDecision {
  return postDecisionSchema.parse(extractJsonObject(text));
}

export function parseInteractDecision(text: string): InteractDecision {
  return interactDecisionSchema.parse(extractJsonObject(text));
}

export function clampWakeMinutes(minutes: number): number {
  return Math.min(MAX_WAKE_MINUTES, Math.max(MIN_WAKE_MINUTES, minutes));
}
