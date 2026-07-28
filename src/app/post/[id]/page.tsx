import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { getDb } from "@/db";
import { comments, personas, posts } from "@/db/schema";
import {
  avatarFor,
  formatExactTime,
  handleFor,
} from "@/lib/persona-meta";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const db = getDb();

  const people = await db
    .select({
      id: personas.id,
      name: personas.name,
      slug: personas.slug,
      avatarUrl: personas.avatarUrl,
    })
    .from(personas)
    .orderBy(personas.name);

  const [row] = await db
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
    .where(eq(posts.id, id))
    .limit(1);

  if (!row) notFound();

  const thread = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      parentCommentId: comments.parentCommentId,
      personaName: personas.name,
      personaSlug: personas.slug,
      avatarUrl: personas.avatarUrl,
    })
    .from(comments)
    .innerJoin(personas, eq(comments.personaId, personas.id))
    .where(eq(comments.postId, id))
    .orderBy(asc(comments.createdAt));

  const roots = thread.filter((c) => !c.parentCommentId);
  const byParent = new Map<string, typeof thread>();
  for (const c of thread) {
    if (!c.parentCommentId) continue;
    const list = byParent.get(c.parentCommentId) ?? [];
    list.push(c);
    byParent.set(c.parentCommentId, list);
  }

  return (
    <AppShell people={people} active="home">
      <Link href="/" className="back-link">
        ← 피드로
      </Link>

      <article className="post-detail">
        <header className="feed-head">
          <Avatar
            slug={row.personaSlug}
            name={row.personaName}
            src={avatarFor(row.personaSlug, row.avatarUrl)}
            size="md"
          />
          <div className="feed-head-text">
            <Link href={`/persona/${row.personaSlug}`} className="username">
              {handleFor(row.personaSlug, row.personaName)}
            </Link>
            <time dateTime={row.createdAt.toISOString()}>
              {formatExactTime(row.createdAt)}
            </time>
          </div>
        </header>

        <h1>{row.title}</h1>
        <div className="body">
          {row.content.split("\n").map((line, i) => (
            <p key={i}>{line || "\u00A0"}</p>
          ))}
        </div>
      </article>

      <section className="comments">
        <h2>Comments</h2>
        {roots.length === 0 ? (
          <p className="empty" style={{ padding: "1rem 0" }}>
            아직 댓글이 없습니다.
          </p>
        ) : (
          <ul className="comment-list">
            {roots.map((c) => (
              <li key={c.id} className="comment-item">
                <Avatar
                  slug={c.personaSlug}
                  name={c.personaName}
                  src={avatarFor(c.personaSlug, c.avatarUrl)}
                  size="sm"
                />
                <div className="comment-bubble">
                  <div className="comment-meta">
                    <Link
                      href={`/persona/${c.personaSlug}`}
                      className="username"
                    >
                      {handleFor(c.personaSlug, c.personaName)}
                    </Link>
                    <time dateTime={c.createdAt.toISOString()}>
                      {formatExactTime(c.createdAt)}
                    </time>
                  </div>
                  <p>{c.content}</p>
                  <ul className="reply-list">
                    {(byParent.get(c.id) ?? []).map((r) => (
                      <li key={r.id} className="comment-item">
                        <Avatar
                          slug={r.personaSlug}
                          name={r.personaName}
                          src={avatarFor(r.personaSlug, r.avatarUrl)}
                          size="sm"
                        />
                        <div className="comment-bubble">
                          <div className="comment-meta">
                            <Link
                              href={`/persona/${r.personaSlug}`}
                              className="username"
                            >
                              {handleFor(r.personaSlug, r.personaName)}
                            </Link>
                            <time dateTime={r.createdAt.toISOString()}>
                              {formatExactTime(r.createdAt)}
                            </time>
                          </div>
                          <p>{r.content}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
