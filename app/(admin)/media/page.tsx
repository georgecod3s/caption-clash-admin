/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { displayName, fetchAll, fetchAllProfiles, fmtDate, type Caption, type Image, type Vote } from "@/lib/data";
import { createMedia } from "./actions";
import SubmitButton from "./SubmitButton";

export const dynamic = "force-dynamic";

export default async function MediaPage({ searchParams }: PageProps<"/media">) {
    const { q, sort } = await searchParams;
    const query = (typeof q === "string" ? q : "").trim().toLowerCase();
    const { supabase } = await requireAdmin();
    const [profiles, images, captions, votes] = await Promise.all([
        fetchAllProfiles(supabase),
        fetchAll<Image>(supabase, "images"),
        fetchAll<Caption>(supabase, "captions", "id, image_id, content, created_at"),
        fetchAll<Vote>(supabase, "caption_votes", "id, caption_id, vote, created_at"),
    ]);
    const prof = new Map(profiles.map((p) => [p.id, p]));
    const capImage = new Map(captions.map((c) => [c.id, c.image_id]));
    const capCount = new Map<string, number>();
    captions.forEach((c) => capCount.set(c.image_id, (capCount.get(c.image_id) ?? 0) + 1));
    const score = new Map<string, number>();
    votes.forEach((v) => {
        const im = capImage.get(v.caption_id);
        if (im) score.set(im, (score.get(im) ?? 0) + v.vote);
    });
    const capText = new Map<string, string>();
    captions.forEach((c) => capText.set(c.image_id, (capText.get(c.image_id) ?? "") + " " + c.content.toLowerCase()));

    const list = images
        .filter((i) => !query || (i.description ?? "").toLowerCase().includes(query) || (capText.get(i.id) ?? "").includes(query))
        .sort((a, b) =>
            sort === "score"
                ? (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0)
                : b.created_at.localeCompare(a.created_at),
        );
    const aiOn = !!process.env.GEMINI_API_KEY;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">AI media</h1>
                    <p className="text-sm text-zinc-400">{images.length} photos · {captions.length} AI captions · full create / read / update / delete</p>
                </div>
                <form className="flex gap-2">
                    <input name="q" defaultValue={query} placeholder="Search descriptions & captions" className="input w-64" />
                    <select name="sort" defaultValue={typeof sort === "string" ? sort : "new"} className="input w-auto">
                        <option value="new">Newest</option>
                        <option value="score">Top score</option>
                    </select>
                    <button className="btn btn-ghost">Go</button>
                </form>
            </header>

            <details className="card p-5" open={images.length === 0}>
                <summary className="cursor-pointer font-semibold text-amber-300">＋ Create new media</summary>
                <form action={createMedia} className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                        <label className="block text-sm">
                            Image file
                            <input type="file" name="image" accept="image/*" required className="input mt-1" />
                        </label>
                        <label className={`flex items-center gap-2 text-sm ${aiOn ? "" : "opacity-50"}`}>
                            <input type="checkbox" name="use_ai" disabled={!aiOn} defaultChecked={aiOn} />
                            Generate description + 5 captions with Gemini {aiOn ? "" : "(set GEMINI_API_KEY to enable)"}
                        </label>
                    </div>
                    <div className="space-y-3">
                        <label className="block text-sm">
                            Description (optional — AI overwrites if enabled)
                            <textarea name="description" rows={2} className="input mt-1" />
                        </label>
                        <label className="block text-sm">
                            Extra captions (one per line, optional)
                            <textarea name="captions" rows={3} className="input mt-1" />
                        </label>
                    </div>
                    <div className="md:col-span-2">
                        <SubmitButton pending="Uploading & generating…">Create</SubmitButton>
                    </div>
                </form>
            </details>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((i) => {
                    const sc = score.get(i.id) ?? 0;
                    return (
                        <Link key={i.id} href={`/media/${i.id}`} className="card group overflow-hidden transition hover:border-amber-400/60">
                            <img src={i.image_url} alt="" className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]" />
                            <div className="space-y-2 p-3">
                                <p className="line-clamp-2 text-sm text-zinc-300">{i.description || <i className="text-zinc-500">No description</i>}</p>
                                <div className="flex items-center justify-between text-xs text-zinc-500">
                                    <span>{capCount.get(i.id) ?? 0} captions</span>
                                    <span className={sc > 0 ? "text-emerald-400" : sc < 0 ? "text-rose-400" : ""}>
                                        {sc > 0 ? "+" : ""}{sc} net
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs text-zinc-500">
                                    <span className="truncate">{displayName(prof.get(i.user_id), i.user_id)}</span>
                                    <span>{fmtDate(i.created_at)}</span>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
            {!list.length && <p className="text-center text-sm text-zinc-500">No media found.</p>}
        </div>
    );
}
