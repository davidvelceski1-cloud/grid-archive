import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/text";
import { Markdown } from "@/components/Markdown";
import { regenerateArticleAction, saveArticleAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditArticle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; regenerated?: string; error?: string }> }) {
  const article = await prisma.article.findUnique({ where: { id: Number((await params).id) } });
  if (!article) notFound();
  const sp = await searchParams;
  return (
    <div className="shell pb-20 pt-10">
      <Link href="/admin?tab=articles" className="eyebrow hover:text-white">← Articles</Link>
      <h1 className="mt-3 text-display-md">{article.title}</h1>
      <p className="mt-2 text-sm text-mist">
        {article.entityType} · {article.aiGenerated ? `AI-assisted (${article.model ?? "model unknown"})` : "Template"} · last edited {formatDate(article.lastEdited)} by {article.editedBy ?? "—"}
      </p>
      {sp.saved && <p className="mt-4 border-l-2 border-signal pl-3">Saved. Human edits are never overwritten by the ingestion scripts.</p>}
      {sp.regenerated && <p className="mt-4 border-l-2 border-signal pl-3">Regenerated with AI.</p>}
      {sp.error === "no-key" && <p className="mt-4 border-l-2 border-signal pl-3">ANTHROPIC_API_KEY is not set on the server.</p>}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <form action={saveArticleAction} className="space-y-3">
          <input type="hidden" name="id" value={article.id} />
          <label className="block text-sm">Title<input name="title" defaultValue={article.title} className="mt-1 w-full border border-rule bg-carbon px-3 py-2" /></label>
          <label className="block text-sm">Body (Markdown, chapters start with “## ”)
            <textarea name="body" defaultValue={article.body} rows={28} className="mt-1 w-full border border-rule bg-carbon px-3 py-2 font-mono text-sm" />
          </label>
          <div className="flex gap-3">
            <button className="btn">Save</button>
          </div>
        </form>
        <div>
          <form action={regenerateArticleAction} className="mb-4">
            <input type="hidden" name="id" value={article.id} />
            <button className="btn-ghost">Regenerate with AI (replaces text)</button>
          </form>
          <div className="light max-h-[80vh] overflow-auto p-6">
            <Markdown source={article.body} className="prose-archive" />
          </div>
        </div>
      </div>
    </div>
  );
}
