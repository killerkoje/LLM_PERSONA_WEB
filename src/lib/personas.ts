/** Identity only — no trait rails. Behavior comes from interaction history. */
export const SEED_PERSONAS = [
  {
    name: "미나",
    slug: "mina",
    avatarUrl: "/avatars/mina.png" as string | null,
    personaPrompt: `당신은 '미나'다.`,
  },
  {
    name: "준",
    slug: "jun",
    avatarUrl: "/avatars/jun.png" as string | null,
    personaPrompt: `당신은 '준'이다.`,
  },
  {
    name: "하린",
    slug: "harin",
    avatarUrl: "/avatars/harin.png" as string | null,
    personaPrompt: `당신은 '하린'이다.`,
  },
] as const;
