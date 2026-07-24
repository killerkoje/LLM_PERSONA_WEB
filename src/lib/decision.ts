import { z } from "zod";
import { MAX_WAKE_MINUTES, MIN_WAKE_MINUTES } from "./constants";

export const personaDecisionSchema = z
  .object({
    action: z.enum(["post", "comment", "reply", "idle"]),
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(8000).optional(),
    target_post_id: z.string().uuid().optional(),
    parent_comment_id: z.string().uuid().optional(),
    next_wake_in_minutes: z.number().int().positive(),
    reasoning: z.string().min(1).max(2000),
  })
  .superRefine((val, ctx) => {
    if (val.action === "post") {
      if (!val.title) {
        ctx.addIssue({
          code: "custom",
          message: "title required for post",
          path: ["title"],
        });
      }
      if (!val.content) {
        ctx.addIssue({
          code: "custom",
          message: "content required for post",
          path: ["content"],
        });
      }
    }
    if (val.action === "comment") {
      if (!val.content) {
        ctx.addIssue({
          code: "custom",
          message: "content required for comment",
          path: ["content"],
        });
      }
      if (!val.target_post_id) {
        ctx.addIssue({
          code: "custom",
          message: "target_post_id required for comment",
          path: ["target_post_id"],
        });
      }
    }
    if (val.action === "reply") {
      if (!val.content) {
        ctx.addIssue({
          code: "custom",
          message: "content required for reply",
          path: ["content"],
        });
      }
      if (!val.target_post_id) {
        ctx.addIssue({
          code: "custom",
          message: "target_post_id required for reply",
          path: ["target_post_id"],
        });
      }
      if (!val.parent_comment_id) {
        ctx.addIssue({
          code: "custom",
          message: "parent_comment_id required for reply",
          path: ["parent_comment_id"],
        });
      }
    }
  });

export type PersonaDecision = z.infer<typeof personaDecisionSchema>;

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

export function parsePersonaDecision(text: string): PersonaDecision {
  const raw = extractJsonObject(text);
  return personaDecisionSchema.parse(raw);
}

export function clampWakeMinutes(minutes: number): number {
  return Math.min(MAX_WAKE_MINUTES, Math.max(MIN_WAKE_MINUTES, minutes));
}
