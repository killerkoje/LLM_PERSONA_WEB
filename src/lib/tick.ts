import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activityLog,
  comments,
  dailyStats,
  personaMemory,
  personas,
  posts,
} from "@/db/schema";
import { isBillingHaltError, isBillingHaltText } from "@/lib/billing";
import {
  DAILY_AGENT_SOFT_CAP,
  DAILY_POST_SOFT_CAP,
  RECENT_CONTEXT_LIMIT,
  TICK_ACTIVE_HOUR_END,
  TICK_ACTIVE_HOUR_START,
  TICK_TZ,
  TICK_WAKE_MINUTES,
} from "@/lib/constants";
import { runPersonaAgent } from "@/lib/cursor-agent";
import {
  parseInteractDecision,
  parsePostDecision,
} from "@/lib/decision";
import { buildInteractPrompt, buildPostPrompt } from "@/lib/prompt";

const BILLING_HALT_ACTION = "billing_halt";

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Hour 0–23 in Asia/Seoul */
function seoulHour(d = new Date()): number {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TICK_TZ,
      hour: "numeric",
      hourCycle: "h23",
    }).format(d),
  );
  return hour;
}

export function isWithinActiveHours(d = new Date()): boolean {
  const hour = seoulHour(d);
  return hour >= TICK_ACTIVE_HOUR_START && hour <= TICK_ACTIVE_HOUR_END;
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

async function setWake(personaId: string) {
  const db = getDb();
  const nextWakeAt = new Date(Date.now() + TICK_WAKE_MINUTES * 60_000);
  await db
    .update(personas)
    .set({ nextWakeAt })
    .where(eq(personas.id, personaId));
  return nextWakeAt;
}

function utcDayStart(d = new Date()): Date {
  return new Date(`${utcDay(d)}T00:00:00.000Z`);
}

async function isBillingHaltedToday(): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.actionType, BILLING_HALT_ACTION),
        gte(activityLog.createdAt, utcDayStart()),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function savePersonaMemory(personaId: string, summary: string) {
  const trimmed = summary.trim();
  if (!trimmed) return;
  const db = getDb();
  await db.insert(personaMemory).values({
    personaId,
    summary: trimmed.slice(0, 2000),
  });
}

async function recordBillingHalt(personaId: string, detail: string) {
  const db = getDb();
  await db.insert(activityLog).values({
    personaId,
    actionType: BILLING_HALT_ACTION,
    reasoning: detail.slice(0, 2000),
  });
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
  const processed: TickResult["processed"] = [];

  if (!isWithinActiveHours(now)) {
    return {
      day: utcDay(now),
      daily,
      processed,
      skippedReason: `outside active hours (${TICK_TZ} ${String(TICK_ACTIVE_HOUR_START).padStart(2, "0")}:00–${String(TICK_ACTIVE_HOUR_END).padStart(2, "0")}:00)`,
    };
  }

  if (await isBillingHaltedToday()) {
    return {
      day: utcDay(now),
      daily,
      processed,
      skippedReason: "billing halt active (usage/quota)",
    };
  }

  if (daily.agentCalls >= DAILY_AGENT_SOFT_CAP) {
    return {
      day: utcDay(now),
      daily,
      processed,
      skippedReason: "daily agent soft cap reached",
    };
  }

  if (daily.postCount >= DAILY_POST_SOFT_CAP) {
    return {
      day: utcDay(now),
      daily,
      processed,
      skippedReason: "daily post soft cap reached",
    };
  }

  const all = await db.select().from(personas).orderBy(personas.name);

  const haltBilling = async (personaId: string, detail: string) => {
    await recordBillingHalt(personaId, detail);
    processed.push({
      personaId,
      name: all.find((p) => p.id === personaId)?.name ?? "?",
      action: BILLING_HALT_ACTION,
      nextWakeAt: (await setWake(personaId)).toISOString(),
      error: detail,
    });
    return {
      day: utcDay(now),
      daily: await getDaily(),
      processed,
      skippedReason: "billing halt triggered (usage/quota)",
    } satisfies TickResult;
  };

  // Phase 1: every persona writes one post
  for (const persona of all) {
    const latestDaily = await getDaily();
    if (
      latestDaily.agentCalls >= DAILY_AGENT_SOFT_CAP ||
      latestDaily.postCount >= DAILY_POST_SOFT_CAP
    ) {
      break;
    }

    try {
      const ctx = await loadContext(persona.id);
      const prompt = buildPostPrompt({
        name: persona.name,
        personaPrompt: persona.personaPrompt,
        nowIso: now.toISOString(),
        memorySummary: ctx.memorySummary,
        ownPosts: ctx.ownPosts,
        otherPosts: ctx.otherPosts,
        recentComments: ctx.recentComments,
      });

      const outcome = await runPersonaAgent(prompt);
      await bumpDaily("agentCalls");

      if (outcome.status !== "finished") {
        const detail = `post agent status=${outcome.status} ${outcome.resultText}`.trim();
        if (isBillingHaltText(detail)) {
          return haltBilling(persona.id, detail);
        }
        const nextWakeAt = await setWake(persona.id);
        await db.insert(activityLog).values({
          personaId: persona.id,
          actionType: "error",
          reasoning: `post agent status=${outcome.status}`,
          runId: outcome.runId,
        });
        processed.push({
          personaId: persona.id,
          name: persona.name,
          action: "error",
          nextWakeAt: nextWakeAt.toISOString(),
          error: `post agent status=${outcome.status}`,
        });
        continue;
      }

      const decision = parsePostDecision(outcome.resultText);
      await db.insert(posts).values({
        personaId: persona.id,
        title: decision.title,
        content: decision.content,
      });
      await bumpDaily("postCount");
      await db.insert(activityLog).values({
        personaId: persona.id,
        actionType: "post",
        reasoning: decision.reasoning,
        runId: outcome.runId,
      });
      await savePersonaMemory(persona.id, decision.memory_note);
      const nextWakeAt = await setWake(persona.id);
      processed.push({
        personaId: persona.id,
        name: persona.name,
        action: "post",
        nextWakeAt: nextWakeAt.toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isBillingHaltError(err) || isBillingHaltText(message)) {
        await db.insert(activityLog).values({
          personaId: persona.id,
          actionType: "error",
          reasoning: `post: ${message}`.slice(0, 2000),
        });
        return haltBilling(persona.id, message);
      }
      const nextWakeAt = await setWake(persona.id);
      await db.insert(activityLog).values({
        personaId: persona.id,
        actionType: "error",
        reasoning: `post: ${message}`.slice(0, 2000),
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

  // Phase 2: every persona comments/replies on someone else
  for (const persona of all) {
    const latestDaily = await getDaily();
    if (latestDaily.agentCalls >= DAILY_AGENT_SOFT_CAP) break;

    try {
      const ctx = await loadContext(persona.id);
      if (ctx.otherPosts.length === 0) {
        processed.push({
          personaId: persona.id,
          name: persona.name,
          action: "idle",
          nextWakeAt: (await setWake(persona.id)).toISOString(),
          error: "no other posts to interact with",
        });
        continue;
      }

      const prompt = buildInteractPrompt({
        name: persona.name,
        personaPrompt: persona.personaPrompt,
        nowIso: now.toISOString(),
        memorySummary: ctx.memorySummary,
        ownPosts: ctx.ownPosts,
        otherPosts: ctx.otherPosts,
        recentComments: ctx.recentComments,
      });

      const outcome = await runPersonaAgent(prompt);
      await bumpDaily("agentCalls");

      if (outcome.status !== "finished") {
        const detail = `interact agent status=${outcome.status} ${outcome.resultText}`.trim();
        if (isBillingHaltText(detail)) {
          return haltBilling(persona.id, detail);
        }
        const nextWakeAt = await setWake(persona.id);
        await db.insert(activityLog).values({
          personaId: persona.id,
          actionType: "error",
          reasoning: `interact agent status=${outcome.status}`,
          runId: outcome.runId,
        });
        processed.push({
          personaId: persona.id,
          name: persona.name,
          action: "error",
          nextWakeAt: nextWakeAt.toISOString(),
          error: `interact agent status=${outcome.status}`,
        });
        continue;
      }

      const decision = parseInteractDecision(outcome.resultText);
      let actionType: "comment" | "reply" | "idle" = decision.action;

      if (decision.action === "comment") {
        const [post] = await db
          .select()
          .from(posts)
          .where(
            and(
              eq(posts.id, decision.target_post_id),
              ne(posts.personaId, persona.id),
            ),
          )
          .limit(1);
        if (!post) {
          actionType = "idle";
        } else {
          await db.insert(comments).values({
            postId: post.id,
            personaId: persona.id,
            content: decision.content,
            parentCommentId: null,
          });
        }
      } else if (decision.parent_comment_id) {
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
        const [post] = await db
          .select()
          .from(posts)
          .where(eq(posts.id, decision.target_post_id))
          .limit(1);
        if (!parent || !post || post.personaId === persona.id) {
          actionType = "idle";
        } else {
          await db.insert(comments).values({
            postId: decision.target_post_id,
            personaId: persona.id,
            parentCommentId: parent.id,
            content: decision.content,
          });
        }
      } else {
        actionType = "idle";
      }

      await db.insert(activityLog).values({
        personaId: persona.id,
        actionType,
        reasoning: decision.reasoning,
        runId: outcome.runId,
      });
      await savePersonaMemory(persona.id, decision.memory_note);
      const nextWakeAt = await setWake(persona.id);
      processed.push({
        personaId: persona.id,
        name: persona.name,
        action: actionType,
        nextWakeAt: nextWakeAt.toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isBillingHaltError(err) || isBillingHaltText(message)) {
        await db.insert(activityLog).values({
          personaId: persona.id,
          actionType: "error",
          reasoning: `interact: ${message}`.slice(0, 2000),
        });
        return haltBilling(persona.id, message);
      }
      const nextWakeAt = await setWake(persona.id);
      await db.insert(activityLog).values({
        personaId: persona.id,
        actionType: "error",
        reasoning: `interact: ${message}`.slice(0, 2000),
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
