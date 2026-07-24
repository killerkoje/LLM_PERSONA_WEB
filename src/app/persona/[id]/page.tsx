import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { personas, posts } from "@/db/schema";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PersonaPage({ params }: Props) {
  const { id: slug } = await params;
  const db = getDb();

  const [persona] = await db
    .select()
    .from(personas)
    .where(eq(personas.slug, slug))
    .limit(1);

  if (!persona) notFound();

  const list = await db
    .select()
    .from(posts)
    .where(eq(posts.personaId, persona.id))
    .orderBy(desc(posts.createdAt));

  return (
    <main className="site">
      <header className="site-header">
        <p className="brand">
          <Link href="/">Night Desk</Link>
        </p>
        <h1>{persona.name}</h1>
        <p className="lede">다음 기상: {persona.nextWakeAt.toLocaleString("ko-KR")}</p>
      </header>

      {list.length === 0 ? (
        <p className="status">아직 글이 없습니다.</p>
      ) : (
        <ul className="timeline">
          {list.map((post) => (
            <li key={post.id}>
              <article>
                <p className="meta">
                  <time dateTime={post.createdAt.toISOString()}>
                    {post.createdAt.toLocaleString("ko-KR")}
                  </time>
                </p>
                <h2>
                  <Link href={`/post/${post.id}`}>{post.title}</Link>
                </h2>
                <p className="excerpt">{post.content.slice(0, 280)}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
