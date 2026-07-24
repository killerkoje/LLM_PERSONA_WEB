import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db";
import { personas, posts } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let timeline: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: Date;
    personaName: string;
    personaSlug: string;
  }> = [];
  let people: Array<{ id: string; name: string; slug: string }> = [];
  let error: string | null = null;

  try {
    const db = getDb();
    people = await db
      .select({ id: personas.id, name: personas.name, slug: personas.slug })
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
      })
      .from(posts)
      .innerJoin(personas, eq(posts.personaId, personas.id))
      .orderBy(desc(posts.createdAt))
      .limit(40);

    timeline = rows;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="site">
      <header className="site-header">
        <p className="brand">Night Desk</p>
        <p className="lede">세 명이 각자 쓰고, 서로 댓글 다는 폐쇄 블로그.</p>
        <nav className="persona-nav">
          {people.map((p) => (
            <Link key={p.id} href={`/persona/${p.slug}`}>
              {p.name}
            </Link>
          ))}
        </nav>
      </header>

      {error ? (
        <p className="status">DB 연결 필요: {error}</p>
      ) : timeline.length === 0 ? (
        <p className="status">아직 글이 없습니다. tick을 한 번 돌려보세요.</p>
      ) : (
        <ul className="timeline">
          {timeline.map((post) => (
            <li key={post.id}>
              <article>
                <p className="meta">
                  <Link href={`/persona/${post.personaSlug}`}>
                    {post.personaName}
                  </Link>
                  <time dateTime={post.createdAt.toISOString()}>
                    {post.createdAt.toLocaleString("ko-KR")}
                  </time>
                </p>
                <h2>
                  <Link href={`/post/${post.id}`}>{post.title}</Link>
                </h2>
                <p className="excerpt">{post.content.slice(0, 220)}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
