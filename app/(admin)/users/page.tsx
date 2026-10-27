/* eslint-disable @next/next/no-img-element */
import { requireAdmin } from "@/lib/admin";
import { displayName, fetchAll, fetchAllProfiles, fmtDate, type Caption, type Image, type Vote } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
    const { q } = await searchParams;
    const query = (typeof q === "string" ? q : "").trim().toLowerCase();
    const { supabase } = await requireAdmin();

    const [profiles, images, captions, votes] = await Promise.all([
        fetchAllProfiles(supabase),
        fetchAll<Image>(supabase, "images", "id, user_id, created_at"),
        fetchAll<Caption>(supabase, "captions", "id, user_id, created_at"),
        fetchAll<Vote>(supabase, "caption_votes", "id, user_id, vote, created_at"),
    ]);

    const count = <T extends { user_id: string }>(rows: T[]) => {
        const m = new Map<string, number>();
        rows.forEach((r) => m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1));
        return m;
    };
    const imgN = count(images);
    const capN = count(captions);
    const voteN = count(votes);
    const upN = count(votes.filter((v) => v.vote > 0));

    const rows = profiles
        .filter((p) => !query || JSON.stringify(p).toLowerCase().includes(query))
        .sort((a, b) => Number(!!b.is_superadmin) - Number(!!a.is_superadmin) || (voteN.get(b.id) ?? 0) - (voteN.get(a.id) ?? 0));

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Users</h1>
                    <p className="text-sm text-zinc-400">{profiles.length} profiles · read-only</p>
                </div>
                <form className="flex gap-2">
                    <input name="q" defaultValue={query} placeholder="Search name, id…" className="input w-64" />
                    <button className="btn btn-ghost">Search</button>
                </form>
            </header>

            <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                        <tr>
                            <th className="p-3">User</th>
                            <th className="p-3">Role</th>
                            <th className="p-3 text-right">Photos</th>
                            <th className="p-3 text-right">Captions</th>
                            <th className="p-3 text-right">Votes</th>
                            <th className="p-3">Laugh rate</th>
                            <th className="p-3">Joined</th>
                            <th className="p-3">ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((p) => {
                            const v = voteN.get(p.id) ?? 0;
                            const rate = v ? (upN.get(p.id) ?? 0) / v : 0;
                            return (
                                <tr key={p.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            {p.avatar_url ? (
                                                <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                                            ) : (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold">
                                                    {displayName(p).slice(0, 1).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-medium">{displayName(p)}</span>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        {p.is_superadmin ? (
                                            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-300">superadmin</span>
                                        ) : (
                                            <span className="text-xs text-zinc-500">user</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right tabular-nums">{imgN.get(p.id) ?? 0}</td>
                                    <td className="p-3 text-right tabular-nums">{capN.get(p.id) ?? 0}</td>
                                    <td className="p-3 text-right tabular-nums">{v}</td>
                                    <td className="p-3">
                                        {v ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-16 rounded-full bg-zinc-800">
                                                    <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${rate * 100}%` }} />
                                                </div>
                                                <span className="text-xs text-zinc-400">{Math.round(rate * 100)}%</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-zinc-600">—</span>
                                        )}
                                    </td>
                                    <td className="p-3 whitespace-nowrap text-zinc-400">{fmtDate(p.created_at as string | null)}</td>
                                    <td className="p-3 font-mono text-xs text-zinc-500">{p.id.slice(0, 8)}…</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {!rows.length && <p className="p-6 text-center text-sm text-zinc-500">No users match.</p>}
            </div>
        </div>
    );
}
