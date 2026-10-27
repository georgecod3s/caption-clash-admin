/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { displayName, fetchAll, fetchAllProfiles, fmtDate, type Caption, type Image, type Vote } from "@/lib/data";

export const dynamic = "force-dynamic";
const PAGE = 50;

export default async function VotesPage({ searchParams }: PageProps<"/votes">) {
    const sp = await searchParams;
    const type = sp.type === "up" || sp.type === "down" ? sp.type : "all";
    const view = sp.view === "captions" ? "captions" : "log";
    const page = Math.max(1, Number(sp.page) || 1);
    const { supabase } = await requireAdmin();

    const [profiles, images, captions, votes] = await Promise.all([
        fetchAllProfiles(supabase),
        fetchAll<Image>(supabase, "images", "id, image_url, created_at"),
        fetchAll<Caption>(supabase, "captions", "id, image_id, content, created_at"),
        fetchAll<Vote>(supabase, "caption_votes"),
    ]);
    const prof = new Map(profiles.map((p) => [p.id, p]));
    const img = new Map(images.map((i) => [i.id, i]));
    const cap = new Map(captions.map((c) => [c.id, c]));

    const up = votes.filter((v) => v.vote > 0).length;
    const filtered = votes
        .filter((v) => (type === "up" ? v.vote > 0 : type === "down" ? v.vote < 0 : true))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
    const slice = filtered.slice((page - 1) * PAGE, page * PAGE);

    // per-caption ratings
    const ratings = new Map<string, { up: number; down: number }>();
    votes.forEach((v) => {
        const r = ratings.get(v.caption_id) ?? { up: 0, down: 0 };
        if (v.vote > 0) r.up++;
        else r.down++;
        ratings.set(v.caption_id, r);
    });
    const ratingRows = [...ratings.entries()]
        .map(([id, r]) => ({ id, ...r, score: r.up - r.down, caption: cap.get(id) }))
        .sort((a, b) => b.score - a.score || b.up - a.up);

    const link = (o: Record<string, string | number>) => {
        const p = new URLSearchParams({ view, type, page: String(page), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) });
        return `/votes?${p}`;
    };
    const tab = (active: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-zinc-100 text-black" : "text-zinc-400 hover:bg-zinc-800"}`;

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <header>
                <h1 className="text-3xl font-bold">Votes & ratings</h1>
                <p className="text-sm text-zinc-400">
                    {votes.length} votes · <span className="text-emerald-400">{up} up</span> · <span className="text-rose-400">{votes.length - up} down</span> · read-only
                </p>
            </header>

            <div className="flex flex-wrap gap-2">
                <Link href={link({ view: "log", page: 1 })} className={tab(view === "log")}>Vote log</Link>
                <Link href={link({ view: "captions", page: 1 })} className={tab(view === "captions")}>Ratings by caption</Link>
                {view === "log" && (
                    <span className="ml-auto flex gap-1">
                        {(["all", "up", "down"] as const).map((t) => (
                            <Link key={t} href={link({ type: t, page: 1 })} className={tab(type === t)}>
                                {t === "all" ? "All" : t === "up" ? "▲ Up" : "▼ Down"}
                            </Link>
                        ))}
                    </span>
                )}
            </div>

            {view === "log" ? (
                <>
                    <div className="card overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                                <tr>
                                    <th className="p-3">Vote</th>
                                    <th className="p-3">Caption</th>
                                    <th className="p-3">Voter</th>
                                    <th className="p-3">When</th>
                                </tr>
                            </thead>
                            <tbody>
                                {slice.map((v) => {
                                    const c = cap.get(v.caption_id);
                                    const i = c ? img.get(c.image_id) : undefined;
                                    return (
                                        <tr key={v.id} className="border-b border-zinc-800/60">
                                            <td className="p-3">
                                                <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${v.vote > 0 ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                                                    {v.vote > 0 ? "▲ +1" : "▼ −1"}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-3">
                                                    {i && <img src={i.image_url} alt="" className="h-9 w-9 rounded-md object-cover" />}
                                                    {c ? (
                                                        <Link href={`/media/${c.image_id}`} className="hover:underline">“{c.content}”</Link>
                                                    ) : (
                                                        <span className="text-zinc-500">deleted caption</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 whitespace-nowrap">{displayName(prof.get(v.user_id), v.user_id)}</td>
                                            <td className="p-3 whitespace-nowrap text-zinc-400">{fmtDate(v.created_at)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {!slice.length && <p className="p-6 text-center text-sm text-zinc-500">No votes.</p>}
                    </div>
                    <div className="flex items-center justify-between text-sm text-zinc-400">
                        <span>Page {page} of {pages}</span>
                        <span className="flex gap-2">
                            {page > 1 && <Link className="btn btn-ghost" href={link({ page: page - 1 })}>← Prev</Link>}
                            {page < pages && <Link className="btn btn-ghost" href={link({ page: page + 1 })}>Next →</Link>}
                        </span>
                    </div>
                </>
            ) : (
                <div className="card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                            <tr>
                                <th className="p-3">Caption</th>
                                <th className="p-3 text-right">▲</th>
                                <th className="p-3 text-right">▼</th>
                                <th className="p-3 text-right">Score</th>
                                <th className="p-3">Approval</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ratingRows.map((r) => (
                                <tr key={r.id} className="border-b border-zinc-800/60">
                                    <td className="p-3">{r.caption ? `“${r.caption.content}”` : <span className="text-zinc-500">deleted</span>}</td>
                                    <td className="p-3 text-right tabular-nums text-emerald-400">{r.up}</td>
                                    <td className="p-3 text-right tabular-nums text-rose-400">{r.down}</td>
                                    <td className="p-3 text-right font-bold tabular-nums">{r.score > 0 ? "+" : ""}{r.score}</td>
                                    <td className="p-3">
                                        <div className="flex h-2 w-28 overflow-hidden rounded-full bg-zinc-800">
                                            <div className="bg-emerald-400" style={{ width: `${(r.up / (r.up + r.down)) * 100}%` }} />
                                            <div className="flex-1 bg-rose-500/80" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
