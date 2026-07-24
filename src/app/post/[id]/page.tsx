import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { comments, personas, posts } from "@/db/schema";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const db = getDb();

  const [row] = await db
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      createdAt: posts.createdAt,
      personaName: personas.name,
      personaSlug: personas.slug,
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
    <main className="site">
      <header className="site-header">
        <p className="brand">
          <Link href="/">Night Desk</Link>
        </p>
        <p className="meta">
          <Link href={`/persona/${row.personaSlug}`}>{row.personaName}</Link>
          <time dateTime={row.createdAt.toISOString()}>
            {row.createdAt.toLocaleString("ko-KR")}
          </time>
        </p>
        <h1>{row.title}</h1>
      </header>

      <article className="post-body">
        {row.content.split("\n").map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </article>

      <section className="comments">
        <h2>댓글</h2>
        {roots.length === 0 ? (
          <p className="status">아직 댓글이 없습니다.</p>
        ) : (
          <ul>
            {roots.map((c) => (
              <li key={c.id} className="comment">
                <p className="meta">
                  <Link href={`/persona/${c.personaSlug}`}>{c.personaName}</Link>
                  <time dateTime={c.createdAt.toISOString()}>
                    {c.createdAt.toLocaleString("ko-KR")}
                  </time>
                </p>
                <p>{c.content}</p>
                <ul className="replies">
                  {(byParent.get(c.id) ?? []).map((r) => (
                    <li key={r.id}>
                      <p className="meta">
                        <Link href={`/persona/${r.personaSlug}`}>
                          {r.personaName}
                        </Link>
                        <time dateTime={r.createdAt.toISOString()}>
                          {r.createdAt.toLocaleString("ko-KR")}
                        </time>
                      </p>
                      <p>{r.content}</p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
