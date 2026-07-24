import { and, desc, eq, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activityLog,
  comments,
  dailyStats,
  personaMemory,
  personas,
  posts,
} from "@/db/schema";
import {
  DAILY_AGENT_SOFT_CAP,
  DAILY_POST_SOFT_CAP,
  RECENT_CONTEXT_LIMIT,
} from "@/lib/constants";
import { runPersonaAgent } from "@/lib/cursor-agent";
import {
  clampWakeMinutes,
  parsePersonaDecision,
  type PersonaDecision,
} from "@/lib/decision";
import { buildPersonaPrompt } from "@/lib/prompt";

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

async function bumpDaily(field: "postCount" | "agentCalls", by = 1) {
  const db = getDb();
  const day = utcDay();
  await db
    .insert(dailyStats)
    .values({
      day,
      postCount: field === "postCount" ? by : 0,
      agentCalls: field === "agentCalls" ? by : 0,
    })
    .onConflictDoUpdate({
      target: dailyStats.day,
      set: {
        postCount:
          field === "postCount"
            ? sql`${dailyStats.postCount} + ${by}`
            : dailyStats.postCount,
        agentCalls:
          field === "agentCalls"
            ? sql`${dailyStats.agentCalls} + ${by}`
            : dailyStats.agentCalls,
      },
    });
}

async function getDaily() {
  const db = getDb();
  const day = utcDay();
  const [row] = await db
    .select()
    .from(dailyStats)
    .where(eq(dailyStats.day, day))
    .limit(1);
  return {
    postCount: row?.postCount ?? 0,
    agentCalls: row?.agentCalls ?? 0,
  };
}

async function loadContext(personaId: string) {
  const db = getDb();
  const allPersonas = await db.select().from(personas);
  const nameById = new Map(allPersonas.map((p) => [p.id, p.name]));

  const ownPostsRaw = await db
    .select()
    .from(posts)
    .where(eq(posts.personaId, personaId))
    .orderBy(desc(posts.createdAt))
    .limit(RECENT_CONTEXT_LIMIT);

  const otherPostsRaw = await db
    .select()
    .from(posts)
    .where(ne(posts.personaId, personaId))
    .orderBy(desc(posts.createdAt))
    .limit(RECENT_CONTEXT_LIMIT);

  const recentCommentsRaw = await db
    .select()
    .from(comments)
    .orderBy(desc(comments.createdAt))
    .limit(RECENT_CONTEXT_LIMIT);

  const [memory] = await db
    .select()
    .from(personaMemory)
    .where(eq(personaMemory.personaId, personaId))
    .orderBy(desc(personaMemory.createdAt))
    .limit(1);

  const mapPost = (p: (typeof ownPostsRaw)[number]) => ({
    id: p.id,
    personaName: nameById.get(p.personaId) ?? "?",
    title: p.title,
    content: p.content,
    createdAt: p.createdAt,
  });

  return {
    memorySummary: memory?.summary ?? null,
    ownPosts: ownPostsRaw.map(mapPost),
    otherPosts: otherPostsRaw.map(mapPost),
    recentComments: recentCommentsRaw.map((c) => ({
      id: c.id,
      postId: c.postId,
      personaName: nameById.get(c.personaId) ?? "?",
      parentCommentId: c.parentCommentId,
      content: c.content,
      createdAt: c.createdAt,
    })),
  };
}

async function applyDecision(
  personaId: string,
  decision: PersonaDecision,
  meta: { runId?: string },
) {
  const db = getDb();
  const wakeMinutes = clampWakeMinutes(decision.next_wake_in_minutes);
  const nextWakeAt = new Date(Date.now() + wakeMinutes * 60_000);

  let actionType = decision.action;

  if (decision.action === "post" && decision.title && decision.content) {
    await db.insert(posts).values({
      personaId,
      title: decision.title,
      content: decision.content,
    });
    await bumpDaily("postCount");
  } else if (
    decision.action === "comment" &&
    decision.content &&
    decision.target_post_id
  ) {
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, decision.target_post_id))
      .limit(1);
    if (!post) {
      actionType = "idle";
    } else {
      await db.insert(comments).values({
        postId: post.id,
        personaId,
        content: decision.content,
        parentCommentId: null,
      });
    }
  } else if (
    decision.action === "reply" &&
    decision.content &&
    decision.target_post_id &&
    decision.parent_comment_id
  ) {
    const [parent] = await db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.id, decision.parent_comment_id),
          eq(comments.postId, decision.target_post_id),
        ),
      )
      .limit(1);
    if (!parent) {
      actionType = "idle";
    } else {
      await db.insert(comments).values({
        postId: decision.target_post_id,
        personaId,
        parentCommentId: parent.id,
        content: decision.content,
      });
    }
  }

  await db.insert(activityLog).values({
    personaId,
    actionType,
    reasoning: decision.reasoning,
    runId: meta.runId,
  });

  await db
    .update(personas)
    .set({ nextWakeAt })
    .where(eq(personas.id, personaId));

  return { actionType, nextWakeAt, wakeMinutes };
}

export type TickResult = {
  day: ReturnType<typeof utcDay>;
  daily: { postCount: number; agentCalls: number };
  processed: Array<{
    personaId: string;
    name: string;
    action: string;
    nextWakeAt: string;
    error?: string;
  }>;
  skippedReason?: string;
};

export async function runTick(): Promise<TickResult> {
  const db = getDb();
  const now = new Date();
  const daily = await getDaily();

  if (daily.agentCalls >= DAILY_AGENT_SOFT_CAP) {
    return {
      day: utcDay(now),
      daily,
      processed: [],
      skippedReason: "daily agent soft cap reached",
    };
  }

  const due = await db
    .select()
    .from(personas)
    .where(lte(personas.nextWakeAt, now))
    .orderBy(personas.nextWakeAt);

  const processed: TickResult["processed"] = [];

  // Prefer interaction order: process due personas sequentially
  for (const persona of due) {
    const latestDaily = await getDaily();
    if (latestDaily.agentCalls >= DAILY_AGENT_SOFT_CAP) break;

    const forceIdlePost =
      latestDaily.postCount >= DAILY_POST_SOFT_CAP ? true : false;

    try {
      const ctx = await loadContext(persona.id);
      const prompt = buildPersonaPrompt({
        name: persona.name,
        personaPrompt: persona.personaPrompt,
        nowIso: now.toISOString(),
        memorySummary: ctx.memorySummary,
        ownPosts: ctx.ownPosts,
        otherPosts: ctx.otherPosts,
        recentComments: ctx.recentComments,
        dailyPostCount: latestDaily.postCount,
        dailyPostSoftCap: DAILY_POST_SOFT_CAP,
      });

      const outcome = await runPersonaAgent(prompt);
      await bumpDaily("agentCalls");

      if (outcome.status !== "finished") {
        const nextWakeAt = new Date(Date.now() + MIN_FALLBACK_MS);
        await db
          .update(personas)
          .set({ nextWakeAt })
          .where(eq(personas.id, persona.id));
        await db.insert(activityLog).values({
          personaId: persona.id,
          actionType: "error",
          reasoning: `agent status=${outcome.status}`,
          runId: outcome.runId,
        });
        processed.push({
          personaId: persona.id,
          name: persona.name,
          action: "error",
          nextWakeAt: nextWakeAt.toISOString(),
          error: `agent status=${outcome.status}`,
        });
        continue;
      }

      let decision = parsePersonaDecision(outcome.resultText);
      if (forceIdlePost && decision.action === "post") {
        decision = {
          ...decision,
          action: "idle",
          title: undefined,
          content: undefined,
          reasoning: `${decision.reasoning} (soft post cap → idle)`,
        };
      }

      const applied = await applyDecision(persona.id, decision, {
        runId: outcome.runId,
      });

      processed.push({
        personaId: persona.id,
        name: persona.name,
        action: applied.actionType,
        nextWakeAt: applied.nextWakeAt.toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextWakeAt = new Date(Date.now() + MIN_FALLBACK_MS);
      await db
        .update(personas)
        .set({ nextWakeAt })
        .where(eq(personas.id, persona.id));
      await db.insert(activityLog).values({
        personaId: persona.id,
        actionType: "error",
        reasoning: message.slice(0, 2000),
      });
      processed.push({
        personaId: persona.id,
        name: persona.name,
        action: "error",
        nextWakeAt: nextWakeAt.toISOString(),
        error: message,
      });
    }
  }

  return {
    day: utcDay(now),
    daily: await getDaily(),
    processed,
  };
}

const MIN_FALLBACK_MS = 45 * 60_000;
