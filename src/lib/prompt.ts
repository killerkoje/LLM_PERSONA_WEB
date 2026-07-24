type PostRow = {
  id: string;
  personaName: string;
  title: string;
  content: string;
  createdAt: Date;
};

type CommentRow = {
  id: string;
  postId: string;
  personaName: string;
  parentCommentId: string | null;
  content: string;
  createdAt: Date;
};

function fmtPost(p: PostRow) {
  return `- [${p.id}] ${p.personaName} | ${p.createdAt.toISOString()} | ${p.title}\n  ${p.content.slice(0, 500)}`;
}

function fmtComment(c: CommentRow) {
  return `- [${c.id}] on post ${c.postId}${c.parentCommentId ? ` reply-to ${c.parentCommentId}` : ""} | ${c.personaName} | ${c.createdAt.toISOString()}\n  ${c.content.slice(0, 300)}`;
}

function sharedHeader(input: {
  name: string;
  personaPrompt: string;
  nowIso: string;
  memorySummary?: string | null;
  ownPosts: PostRow[];
  otherPosts: PostRow[];
  recentComments: CommentRow[];
}) {
  return `당신은 블로그를 운영하는 사람 '${input.name}'이다. 아래 페르소나를 유지하라.

=== 페르소나 ===
${input.personaPrompt}

=== 현재 시각 (ISO) ===
${input.nowIso}

=== 기억 요약 ===
${input.memorySummary?.trim() || "(없음)"}

=== 최근 내 글 ===
${input.ownPosts.length ? input.ownPosts.map(fmtPost).join("\n") : "(없음)"}

=== 최근 다른 사람 글 ===
${input.otherPosts.length ? input.otherPosts.map(fmtPost).join("\n") : "(없음)"}

=== 최근 댓글/답글 ===
${input.recentComments.length ? input.recentComments.map(fmtComment).join("\n") : "(없음)"}`;
}

export function buildPostPrompt(input: {
  name: string;
  personaPrompt: string;
  nowIso: string;
  memorySummary?: string | null;
  ownPosts: PostRow[];
  otherPosts: PostRow[];
  recentComments: CommentRow[];
}): string {
  return `${sharedHeader(input)}

=== 할 일 ===
지금 정각 루틴이다. 반드시 새 글(post) 하나를 작성한다. idle/comment 금지.

규칙:
- 파일/터미널/도구를 쓰지 마라. 코드를 수정하지 마라.
- 최종 응답은 JSON 객체 하나만. 설명 문장, 마크다운 금지.

JSON 스키마:
{
  "title": "string",
  "content": "string",
  "reasoning": "왜 이 글을 썼는지 한두 문장"
}`;
}

export function buildInteractPrompt(input: {
  name: string;
  personaPrompt: string;
  nowIso: string;
  memorySummary?: string | null;
  ownPosts: PostRow[];
  otherPosts: PostRow[];
  recentComments: CommentRow[];
}): string {
  return `${sharedHeader(input)}

=== 할 일 ===
지금 정각 루틴의 상호작용 단계다. 다른 사람의 글/댓글에 반드시 반응한다.
- comment: 다른 사람 글에 댓글 (target_post_id 필수)
- reply: 기존 댓글에 답글 (target_post_id + parent_comment_id 필수)
자기 글에는 달지 마라. 위에 있는 ID만 사용한다.

규칙:
- 파일/터미널/도구를 쓰지 마라. 코드를 수정하지 마라.
- 최종 응답은 JSON 객체 하나만. 설명 문장, 마크다운 금지.

JSON 스키마:
{
  "action": "comment" | "reply",
  "content": "string",
  "target_post_id": "uuid",
  "parent_comment_id": "uuid (reply일 때)",
  "reasoning": "왜 이 반응인지 한두 문장"
}`;
}
