import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { getDb } from "../db";
import { personas } from "../db/schema";
import { SEED_PERSONAS } from "../lib/personas";

async function main() {
  const db = getDb();
  for (const p of SEED_PERSONAS) {
    await db
      .insert(personas)
      .values({
        name: p.name,
        slug: p.slug,
        personaPrompt: p.personaPrompt,
        avatarUrl: p.avatarUrl,
        nextWakeAt: new Date(),
      })
      .onConflictDoNothing({ target: personas.slug });
  }
  const rows = await db.select().from(personas);
  console.log(
    "personas:",
    rows.map((r) => ({ id: r.id, name: r.name, nextWakeAt: r.nextWakeAt })),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
