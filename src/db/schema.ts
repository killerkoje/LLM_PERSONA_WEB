import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const personas = pgTable("personas", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  personaPrompt: text("persona_prompt").notNull(),
  avatarUrl: text("avatar_url"),
  nextWakeAt: timestamp("next_wake_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  personaId: uuid("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  personaId: uuid("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "cascade" }),
  parentCommentId: uuid("parent_comment_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const activityLog = pgTable("activity_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  personaId: uuid("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(), // post | comment | reply | idle | error
  reasoning: text("reasoning"),
  agentId: text("agent_id"),
  runId: text("run_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const personaMemory = pgTable("persona_memory", {
  id: uuid("id").defaultRandom().primaryKey(),
  personaId: uuid("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const dailyStats = pgTable("daily_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  day: text("day").notNull().unique(), // YYYY-MM-DD UTC
  postCount: integer("post_count").notNull().default(0),
  agentCalls: integer("agent_calls").notNull().default(0),
});

export const personasRelations = relations(personas, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  activity: many(activityLog),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  persona: one(personas, {
    fields: [posts.personaId],
    references: [personas.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  persona: one(personas, {
    fields: [comments.personaId],
    references: [personas.id],
  }),
}));
