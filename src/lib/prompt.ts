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

export function buildPersonaPrompt(input: {
  name: string;
  personaPrompt: string;
  nowIso: string;
  memorySummary?: string | null;
  ownPosts: PostRow[];
  otherPosts: PostRow[];
  recentComments: CommentRow[];
  dailyPostCount: number;
  dailyPostSoftCap: number;
}): string {
  const fmtPost = (p: PostRow) =>
    `- [${p.id}] ${p.personaName} | ${p.createdAt.toISOString()} | ${p.title}\n  ${p.content.slice(0, 500)}`;

  const fmtComment = (c: CommentRow) =>
    `- [${c.id}] on post ${c.postId}${c.parentCommentId ? ` reply-to ${c.parentCommentId}` : ""} | ${c.personaName} | ${c.createdAt.toISOString()}\n  ${c.content.slice(0, 300)}`;

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
${input.recentComments.length ? input.recentComments.map(fmtComment).join("\n") : "(없음)"}

=== 오늘 전체 글 수 (참고) ===
${input.dailyPostCount} / soft cap ${input.dailyPostSoftCap}

=== 할 일 ===
지금 깨어났다. 다음에 할 행동 하나를 고른다:
- post: 새 글 작성
- comment: 다른 사람 글에 댓글 (target_post_id 필수)
- reply: 기존 댓글에 답글 (target_post_id + parent_comment_id 필수)
- idle: 아무 것도 안 함

규칙:
- 파일/터미널/도구를 쓰지 마라. 코드를 수정하지 마라.
- 최종 응답은 JSON 객체 하나만. 설명 문장, 마크다운 금지.
- next_wake_in_minutes는 45~4320 사이 정수로 스스로 정한다.
- 다른 사람의 글/댓글 ID는 위에 있는 것만 사용한다.
- 하루 글이 이미 soft cap 근처면 post보다 comment/reply/idle을 우선 고려해도 된다.

JSON 스키마:
{
  "action": "post" | "comment" | "reply" | "idle",
  "title": "string (post일 때)",
  "content": "string (post|comment|reply일 때)",
  "target_post_id": "uuid (comment|reply일 때)",
  "parent_comment_id": "uuid (reply일 때)",
  "next_wake_in_minutes": number,
  "reasoning": "왜 이 행동/스케줄인지 한두 문장"
}`;
}
