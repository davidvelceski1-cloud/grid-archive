"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateAiArticle, saveArticle } from "@/lib/articles";
import { aiEnabled } from "@/lib/ai/claude";

function pathFor(type: string, entityId: string, slug?: string) {
  if (type === "SEASON") return `/seasons/${entityId}`;
  if (type === "DRIVER") return `/drivers/${slug}`;
  if (type === "TEAM") return `/teams/${slug}`;
  if (type === "CIRCUIT") return `/circuits/${slug}`;
  return "/";
}

async function slugOf(type: string, id: string) {
  if (type === "DRIVER") return (await prisma.driver.findUnique({ where: { id }, select: { slug: true } }))?.slug;
  if (type === "TEAM") return (await prisma.team.findUnique({ where: { id }, select: { slug: true } }))?.slug;
  if (type === "CIRCUIT") return (await prisma.circuit.findUnique({ where: { id }, select: { slug: true } }))?.slug;
  return undefined;
}

export async function saveArticleAction(form: FormData) {
  const id = Number(form.get("id"));
  const body = String(form.get("body") ?? "").slice(0, 100_000);
  const title = String(form.get("title") ?? "").slice(0, 200);
  const a = await prisma.article.update({ where: { id }, data: { body, title, editedBy: "admin", lastEdited: new Date() } });
  revalidatePath(pathFor(a.entityType, a.entityId, await slugOf(a.entityType, a.entityId)));
  redirect(`/admin/articles/${id}?saved=1`);
}

export async function regenerateArticleAction(form: FormData) {
  const id = Number(form.get("id"));
  const a = await prisma.article.findUniqueOrThrow({ where: { id } });
  if (!aiEnabled()) redirect(`/admin/articles/${id}?error=no-key`);
  const fresh = await generateAiArticle(prisma, a.entityType as EntityType, a.entityId);
  if (fresh) await saveArticle(prisma, a.entityType as EntityType, a.entityId, fresh);
  revalidatePath(pathFor(a.entityType, a.entityId, await slugOf(a.entityType, a.entityId)));
  redirect(`/admin/articles/${id}?regenerated=1`);
}

export async function saveTeamAction(form: FormData) {
  const id = String(form.get("id"));
  const num = (k: string) => (form.get(k) ? Number(form.get(k)) : null);
  const str = (k: string) => (String(form.get(k) ?? "").trim() || null);
  const t = await prisma.team.update({
    where: { id },
    data: { founded: num("founded"), base: str("base"), founder: str("founder"), color: str("color") ?? "#5A5F66", whyDisappeared: str("whyDisappeared") },
  });
  revalidatePath(`/teams/${t.slug}`);
  redirect(`/admin?tab=teams&saved=${t.slug}`);
}

export async function saveSeasonAction(form: FormData) {
  const year = Number(form.get("year"));
  const headline = String(form.get("headline") ?? "").trim();
  await prisma.season.update({ where: { year }, data: { headline: headline || null, headlineAuto: !headline } });
  revalidatePath(`/seasons/${year}`);
  redirect(`/admin?tab=seasons&saved=${year}`);
}
