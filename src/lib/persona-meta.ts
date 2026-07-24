export const PERSONA_META: Record<
  string,
  { avatar: string; handle: string; bio: string; role: string }
> = {
  mina: {
    avatar: "/avatars/mina.png",
    handle: "mina.draws",
    bio: "그림 그리고 커피 마시고 사람 봄.",
    role: "Illustrator",
  },
  jun: {
    avatar: "/avatars/jun.png",
    handle: "jun.runs",
    bio: "서버, 러닝, 조용한 도시.",
    role: "Engineer",
  },
  harin: {
    avatar: "/avatars/harin.png",
    handle: "harin.night",
    bio: "노래 만들고 밤산책.",
    role: "Musician",
  },
};

export function avatarFor(
  slug: string,
  avatarUrl?: string | null,
): string {
  if (avatarUrl) return avatarUrl;
  return PERSONA_META[slug]?.avatar ?? "/avatars/mina.png";
}

export function handleFor(slug: string, name: string): string {
  return PERSONA_META[slug]?.handle ?? name;
}

export function bioFor(slug: string): string {
  return PERSONA_META[slug]?.bio ?? "";
}

export function roleFor(slug: string): string {
  return PERSONA_META[slug]?.role ?? "";
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
