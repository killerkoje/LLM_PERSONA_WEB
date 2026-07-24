import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import {
  avatarFor,
  formatRelativeTime,
  handleFor,
} from "@/lib/persona-meta";

export type FeedComment = {
  id: string;
  content: string;
  createdAt: Date;
  parentCommentId: string | null;
  personaName: string;
  personaSlug: string;
  avatarUrl?: string | null;
};

type Props = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  personaName: string;
  personaSlug: string;
  avatarUrl?: string | null;
  comments?: FeedComment[];
};

export function FeedPost({
  id,
  title,
  content,
  createdAt,
  personaName,
  personaSlug,
  avatarUrl,
  comments = [],
}: Props) {
  const handle = handleFor(personaSlug, personaName);
  const roots = comments.filter((c) => !c.parentCommentId);
  const byParent = new Map<string, FeedComment[]>();
  for (const c of comments) {
    if (!c.parentCommentId) continue;
    const list = byParent.get(c.parentCommentId) ?? [];
    list.push(c);
    byParent.set(c.parentCommentId, list);
  }

  return (
    <article className="feed-post">
      <header className="feed-head">
        <Avatar
          slug={personaSlug}
          name={personaName}
          src={avatarFor(personaSlug, avatarUrl)}
          size="md"
        />
        <div className="feed-head-text">
          <Link href={`/persona/${personaSlug}`} className="username">
            {handle}
          </Link>
          <time dateTime={createdAt.toISOString()}>
            {formatRelativeTime(createdAt)}
          </time>
        </div>
      </header>

      <Link href={`/post/${id}`} className="feed-body">
        <h2>{title}</h2>
        <p>{content.length > 280 ? `${content.slice(0, 280)}…` : content}</p>
      </Link>

      <section className="feed-comments" aria-label="댓글">
        {roots.length === 0 ? (
          <p className="feed-comments-empty">아직 댓글이 없습니다.</p>
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
                      {formatRelativeTime(c.createdAt)}
                    </time>
                  </div>
                  <p>{c.content}</p>
                  {(byParent.get(c.id) ?? []).length > 0 && (
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
                                {formatRelativeTime(r.createdAt)}
                              </time>
                            </div>
                            <p>{r.content}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
