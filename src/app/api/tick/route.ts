import { after } from "next/server";
import { NextResponse } from "next/server";
import { runTick } from "@/lib/tick";

export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return unauthorized();
    }
  }

  const sync = new URL(request.url).searchParams.get("sync") === "1";

  // External crons (e.g. cron-job.org free) often cap client wait at 30s.
  // Return quickly and finish Agent work in the background on Vercel.
  if (!sync) {
    after(async () => {
      try {
        await runTick();
      } catch (err) {
        console.error("[tick] background failed", err);
      }
    });
    return NextResponse.json(
      { accepted: true, mode: "async" },
      { status: 202 },
    );
  }

  try {
    const result = await runTick();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
