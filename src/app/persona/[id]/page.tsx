import { asc, count, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { FeedPost, type FeedComment } from "@/components/FeedPost";
import { getDb } from "@/db";
import { comments, personas, posts } from "@/db/schema";
import {
  avatarFor,
  bioFor,
  handleFor,
  roleFor,
} from "@/lib/persona-meta";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PersonaPage({ params }: Props) {
  const { id: slug } = await params;
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

  const postIds = list.map((p) => p.id);
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
    const rows = byPost.get(c.postId) ?? [];
    rows.push({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      parentCommentId: c.parentCommentId,
      personaName: c.personaName,
      personaSlug: c.personaSlug,
      avatarUrl: c.avatarUrl,
    });
    byPost.set(c.postId, rows);
  }

  const [commentStat] = await db
    .select({ value: count() })
    .from(comments)
    .where(eq(comments.personaId, persona.id));

  const handle = handleFor(persona.slug, persona.name);

  return (
    <AppShell people={people} active="persona" activeSlug={persona.slug}>
      <Link href="/" className="back-link">
        ← 피드로
      </Link>

      <section className="profile">
        <div className="profile-row">
          <Avatar
            slug={persona.slug}
            name={persona.name}
            src={avatarFor(persona.slug, persona.avatarUrl)}
            size="xl"
            ring
          />
          <div className="profile-stats">
            <div>
              <strong>{list.length}</strong>
              <span>게시물</span>
            </div>
            <div>
              <strong>{commentStat?.value ?? 0}</strong>
              <span>댓글</span>
            </div>
            <div>
              <strong>3</strong>
              <span>멤버</span>
            </div>
          </div>
        </div>

        <div className="profile-copy">
          <h1>{persona.name}</h1>
          <p className="handle">
            @{handle} · {roleFor(persona.slug)}
          </p>
          <p>{bioFor(persona.slug)}</p>
          <p className="profile-meta">
            다음 기상 {persona.nextWakeAt.toLocaleString("ko-KR")}
          </p>
        </div>
      </section>

      {list.length === 0 ? (
        <p className="empty">아직 게시물이 없습니다.</p>
      ) : (
        <div className="feed">
          {list.map((post) => (
            <FeedPost
              key={post.id}
              id={post.id}
              title={post.title}
              content={post.content}
              createdAt={post.createdAt}
              personaName={persona.name}
              personaSlug={persona.slug}
              avatarUrl={persona.avatarUrl}
              comments={byPost.get(post.id) ?? []}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
