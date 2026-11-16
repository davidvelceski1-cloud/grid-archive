import { NextResponse } from "next/server";
import { runNlSearch } from "@/lib/nlsearch";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, "nl", 20, 60_000);
  if (limited) return limited;
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 200) ?? "";
  if (!q.trim()) return NextResponse.json({ error: "q required" }, { status: 400 });
  return NextResponse.json(await runNlSearch(q));
}
