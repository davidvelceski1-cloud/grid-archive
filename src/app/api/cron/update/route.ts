/**
 * Scheduled post-race-weekend update (Vercel Cron: see vercel.json).
 * Protected by CRON_SECRET (Vercel sends it as "Authorization: Bearer <secret>").
 */
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { updateCurrentSeason } from "../../../../../scripts/lib/update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await updateCurrentSeason(prisma);
    revalidateTag("archive");
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
