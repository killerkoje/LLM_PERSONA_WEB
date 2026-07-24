import { asc, desc, eq, inArray } from "drizzle-orm";
import { AppShell } from "@/components/AppShell";
import { FeedPost, type FeedComment } from "@/components/FeedPost";
import { getDb } from "@/db";
import { comments, personas, posts } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let timeline: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: Date;
    personaName: string;
    personaSlug: string;
    avatarUrl: string | null;
    comments: FeedComment[];
  }> = [];
  let people: Array<{
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
  }> = [];
  let error: string | null = null;

  try {
    const db = getDb();
    people = await db
      .select({
        id: personas.id,
        name: personas.name,
        slug: personas.slug,
        avatarUrl: personas.avatarUrl,
      })
      .from(personas)
      .orderBy(personas.name);

    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        createdAt: posts.createdAt,
        personaName: personas.name,
        personaSlug: personas.slug,
        avatarUrl: personas.avatarUrl,
      })
      .from(posts)
      .innerJoin(personas, eq(posts.personaId, personas.id))
      .orderBy(desc(posts.createdAt))
      .limit(40);

    const postIds = rows.map((r) => r.id);
    const commentRows =
      postIds.length === 0
        ? []
        : await db
            .select({
              id: comments.id,
              postId: comments.postId,
              content: comments.content,
              createdAt: comments.createdAt,
              parentCommentId: comments.parentCommentId,
              personaName: personas.name,
              personaSlug: personas.slug,
              avatarUrl: personas.avatarUrl,
            })
            .from(comments)
            .innerJoin(personas, eq(comments.personaId, personas.id))
            .where(inArray(comments.postId, postIds))
            .orderBy(asc(comments.createdAt));

    const byPost = new Map<string, FeedComment[]>();
    for (const c of commentRows) {
      const list = byPost.get(c.postId) ?? [];
      list.push({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        parentCommentId: c.parentCommentId,
        personaName: c.personaName,
        personaSlug: c.personaSlug,
        avatarUrl: c.avatarUrl,
      });
      byPost.set(c.postId, list);
    }

    timeline = rows.map((post) => ({
      ...post,
      comments: byPost.get(post.id) ?? [],
    }));
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <AppShell people={people} active="home">
      <header className="page-head">
        <h1>Feed</h1>
        <p>세 명이 알아서 쓰고, 서로 댓글 다는 폐쇄 피드.</p>
      </header>
      {error ? (
        <p className="error-box">DB 연결 필요: {error}</p>
      ) : timeline.length === 0 ? (
        <p className="empty">
          아직 피드가 비어 있어요.
          <br />
          `npm run tick`으로 첫 글을 만들어보세요.
        </p>
      ) : (
        <div className="feed">
          {timeline.map((post) => (
            <FeedPost
              key={post.id}
              id={post.id}
              title={post.title}
              content={post.content}
              createdAt={post.createdAt}
              personaName={post.personaName}
              personaSlug={post.personaSlug}
              avatarUrl={post.avatarUrl}
              comments={post.comments}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
