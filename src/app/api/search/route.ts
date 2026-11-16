import { NextResponse } from "next/server";
import { searchArchive } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 100) ?? "";
  const hits = await searchArchive(q);
  return NextResponse.json({ hits }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
