/* eslint-disable @next/next/no-img-element */
import { requireAdmin } from "@/lib/admin";
import { displayName, loadEverything } from "@/lib/data";
import { computeStats, type CaptionStat } from "@/lib/stats";

export const dynamic = "force-dynamic";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

function Kpi({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
    return (
        <div className={`card p-4 ${accent ? "border-amber-400/50 bg-amber-400/10" : ""}`}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${accent ? "text-amber-300" : ""}`}>{value}</p>
            {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
        </div>
    );
}

function Section({ title, kicker, children, className = "" }: { title: string; kicker?: string; children: React.ReactNode; className?: string }) {
    return (
        <section className={`card p-5 ${className}`}>
            {kicker && <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">{kicker}</p>}
            <h2 className="mb-4 text-lg font-semibold">{title}</h2>
            {children}
        </section>
    );
}

function CaptionRow({ c, rank, metric }: { c: CaptionStat; rank: number; metric: React.ReactNode }) {
    return (
        <li className="flex items-center gap-3">
            <span className="w-5 text-sm font-bold text-zinc-500">{rank}</span>
            {c.image ? (
                <img src={c.image.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            ) : (
                <div className="h-12 w-12 shrink-0 rounded-lg bg-zinc-800" />
            )}
            <p className="min-w-0 flex-1 text-sm leading-snug">“{c.content}”</p>
            <div className="shrink-0 text-right text-xs">{metric}</div>
        </li>
    );
}

export default async function Dashboard() {
    const { supabase } = await requireAdmin();
    const data = await loadEverything(supabase);
    const s = computeStats(data);
    const t = s.totals;

    const maxDay = Math.max(1, ...s.days.map((d) => d.votes + d.captions + d.images));
    const maxHeat = Math.max(1, ...s.heat.flat());
    const maxBucket = Math.max(0.01, ...s.buckets.map((b) => b.upRate));
    const maxWord = Math.max(1, ...s.funnyWords.map((w) => Math.abs(w.avg)));

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <header>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-sm text-zinc-400">What the crowd thinks is funny — live from Supabase.</p>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <Kpi label="Users" value={t.users} sub={`${t.superadmins} superadmin${t.superadmins === 1 ? "" : "s"}`} />
                <Kpi label="Photos" value={t.images} sub={`from ${t.uploaders} uploader${t.uploaders === 1 ? "" : "s"}`} />
                <Kpi label="AI captions" value={t.captions} sub={`${t.capsPerImage.toFixed(1)} per photo`} />
                <Kpi label="Votes cast" value={t.votes} sub={`by ${t.activeVoters} voter${t.activeVoters === 1 ? "" : "s"}`} />
                <Kpi label="Laugh rate" value={pct(t.upRate)} sub={`${t.upvotes} 👍 · ${t.downvotes} 👎`} accent />
                <Kpi label="Ghost captions" value={pct(t.ghostRate)} sub="never voted on" />
            </div>

            {/* Up/down split bar */}
            <div className="card p-4">
                <div className="mb-2 flex justify-between text-xs text-zinc-400">
                    <span>Upvotes {t.upvotes}</span>
                    <span>The AI&apos;s comedy report card</span>
                    <span>Downvotes {t.downvotes}</span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">
                    <div className="bg-emerald-400" style={{ width: pct(t.upRate) }} />
                    <div className="flex-1 bg-rose-500/80" />
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* 30-day pulse */}
                <Section title="30-day pulse" kicker="Activity" className="lg:col-span-2">
                    <div className="flex h-40 items-end gap-[3px]">
                        {s.days.map((d, i) => {
                            const total = d.votes + d.captions + d.images;
                            return (
                                <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                                    <div
                                        className="bar-grow flex flex-col overflow-hidden rounded-t"
                                        style={{ height: `${(total / maxDay) * 100}%`, animationDelay: `${i * 15}ms` }}
                                    >
                                        <div className="bg-sky-400" style={{ flex: d.images }} />
                                        <div className="bg-violet-400" style={{ flex: d.captions }} />
                                        <div className="bg-amber-400" style={{ flex: d.votes }} />
                                    </div>
                                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-800 px-2 py-1 text-xs group-hover:block">
                                        <b>{d.label}</b> · {d.images} photos · {d.captions} captions · {d.votes} votes
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-zinc-500">
                        <span>{s.days[0].label}</span>
                        <span className="flex gap-3">
                            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-400" />photos</span>
                            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-400" />captions</span>
                            <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />votes</span>
                        </span>
                        <span>Today</span>
                    </div>
                </Section>

                {/* Best photo */}
                <Section title="Most meme-able photo" kicker="MVP">
                    {s.bestImage?.image ? (
                        <div>
                            <img src={s.bestImage.image.image_url} alt="" className="aspect-video w-full rounded-xl object-cover" />
                            <p className="mt-3 line-clamp-3 text-sm text-zinc-400">{s.bestImage.image.description}</p>
                            <p className="mt-2 text-sm">
                                Its captions earned a combined <b className="text-amber-300">{s.bestImage.score > 0 ? "+" : ""}{s.bestImage.score}</b> net votes.
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-zinc-500">No photos yet.</p>
                    )}
                </Section>
            </div>

            {/* Heatmap */}
            <Section title="When does the crowd vote?" kicker="Rhythm · Eastern time">
                <div className="overflow-x-auto">
                    <div className="min-w-[640px]">
                        {s.heat.map((row, di) => (
                            <div key={di} className="flex items-center gap-[3px] py-[1.5px]">
                                <span className="w-10 text-xs text-zinc-500">{s.dows[di]}</span>
                                {row.map((n, h) => (
                                    <div
                                        key={h}
                                        title={`${s.dows[di]} ${hourLabel(h)}: ${n} vote${n === 1 ? "" : "s"}`}
                                        className="h-5 flex-1 rounded-sm"
                                        style={{
                                            background: n ? `rgba(251,191,36,${0.15 + 0.85 * (n / maxHeat)})` : "#1f1f23",
                                        }}
                                    />
                                ))}
                            </div>
                        ))}
                        <div className="flex gap-[3px] pl-10 text-[10px] text-zinc-500">
                            {Array.from({ length: 24 }, (_, h) => (
                                <span key={h} className="flex-1 text-center">{h % 3 === 0 ? hourLabel(h) : ""}</span>
                            ))}
                        </div>
                    </div>
                </div>
                {s.peak.n > 0 && (
                    <p className="mt-3 text-sm text-zinc-400">
                        Peak comedy hour: <b className="text-white">{s.dows[s.peak.dow]} at {hourLabel(s.peak.hour)}</b> with {s.peak.n} votes.
                    </p>
                )}
            </Section>

            <div className="grid gap-6 lg:grid-cols-3">
                <Section title="Hall of Fame" kicker="Top rated">
                    <ol className="space-y-3">
                        {s.hallOfFame.map((c, i) => (
                            <CaptionRow key={c.id} c={c} rank={i + 1} metric={<b className="text-emerald-400">+{c.score}</b>} />
                        ))}
                        {!s.hallOfFame.length && <p className="text-sm text-zinc-500">No votes yet.</p>}
                    </ol>
                </Section>
                <Section title="Most divisive" kicker="Love it or hate it">
                    <ol className="space-y-3">
                        {s.divisive.map((c, i) => (
                            <CaptionRow
                                key={c.id}
                                c={c}
                                rank={i + 1}
                                metric={
                                    <span>
                                        <span className="text-emerald-400">{c.up}▲</span> <span className="text-rose-400">{c.down}▼</span>
                                    </span>
                                }
                            />
                        ))}
                        {!s.divisive.length && <p className="text-sm text-zinc-500">Nothing split the room yet.</p>}
                    </ol>
                </Section>
                <Section title="Hall of Shame" kicker="Bombed">
                    <ol className="space-y-3">
                        {s.hallOfShame.map((c, i) => (
                            <CaptionRow key={c.id} c={c} rank={i + 1} metric={<b className="text-rose-400">{c.score}</b>} />
                        ))}
                        {!s.hallOfShame.length && <p className="text-sm text-zinc-500">No votes yet.</p>}
                    </ol>
                </Section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Is brevity the soul of wit?" kicker="Caption length vs. laugh rate">
                    <div className="space-y-3">
                        {s.buckets.map((b) => (
                            <div key={b.label}>
                                <div className="mb-1 flex justify-between text-xs">
                                    <span>{b.label} chars</span>
                                    <span className="text-zinc-400">
                                        {b.votes ? pct(b.upRate) : "—"} · {b.count} captions
                                    </span>
                                </div>
                                <div className="h-3 rounded-full bg-zinc-800">
                                    <div className="h-3 rounded-full bg-gradient-to-r from-violet-500 to-amber-400" style={{ width: `${(b.upRate / maxBucket) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    {(() => {
                        const best = [...s.buckets].filter((b) => b.votes).sort((a, b) => b.upRate - a.upRate)[0];
                        return best ? (
                            <p className="mt-4 text-sm text-zinc-400">
                                Verdict: <b className="text-white">{best.label.split(" ")[0].toLowerCase()}</b> captions get the most laughs.
                            </p>
                        ) : null;
                    })()}
                </Section>

                <Section title="Funniest words" kicker="Avg. net score of captions containing the word">
                    <div className="flex flex-wrap gap-2">
                        {s.funnyWords.map((w) => {
                            const pos = w.avg >= 0;
                            const size = 0.8 + (Math.abs(w.avg) / maxWord) * 0.9;
                            return (
                                <span
                                    key={w.word}
                                    title={`${w.n} captions · avg ${w.avg.toFixed(2)}`}
                                    className={`rounded-lg px-2 py-1 font-semibold ${pos ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}
                                    style={{ fontSize: `${size}rem` }}
                                >
                                    {w.word}
                                </span>
                            );
                        })}
                        {!s.funnyWords.length && <p className="text-sm text-zinc-500">Need more votes.</p>}
                    </div>
                </Section>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Section title="Top critics" kicker="Most votes cast">
                    <ul className="space-y-2">
                        {s.topVoters.map((v) => (
                            <li key={v.id} className="flex items-center gap-3 text-sm">
                                <span className="min-w-0 flex-1 truncate">{displayName(v.profile, v.id)}</span>
                                <div className="flex h-2 w-24 overflow-hidden rounded-full bg-zinc-800">
                                    <div className="bg-emerald-400" style={{ width: pct(v.upRate) }} />
                                    <div className="flex-1 bg-rose-500/80" />
                                </div>
                                <span className="w-8 text-right tabular-nums text-zinc-400">{v.total}</span>
                            </li>
                        ))}
                    </ul>
                </Section>
                <Section title="Critic personalities" kicker="Who's tough, who's easy">
                    <div className="space-y-4 text-sm">
                        {s.harshest && (
                            <div className="rounded-xl bg-rose-500/10 p-3">
                                <p className="text-xs uppercase tracking-wider text-rose-300">Harshest critic</p>
                                <p className="font-semibold">{displayName(s.harshest.profile, s.harshest.id)}</p>
                                <p className="text-zinc-400">Laughs at only {pct(s.harshest.upRate)} of captions ({s.harshest.total} votes)</p>
                            </div>
                        )}
                        {s.easiest && (
                            <div className="rounded-xl bg-emerald-400/10 p-3">
                                <p className="text-xs uppercase tracking-wider text-emerald-300">Easiest laugh</p>
                                <p className="font-semibold">{displayName(s.easiest.profile, s.easiest.id)}</p>
                                <p className="text-zinc-400">Upvotes {pct(s.easiest.upRate)} of captions ({s.easiest.total} votes)</p>
                            </div>
                        )}
                        {!s.harshest && <p className="text-zinc-500">No voters yet.</p>}
                    </div>
                </Section>
                <Section title="Best photo uploaders" kicker="Net score of their photos' captions">
                    <ul className="space-y-2">
                        {s.comedians.map((c, i) => (
                            <li key={c.id} className="flex items-center gap-3 text-sm">
                                <span className="w-4 font-bold text-zinc-500">{i + 1}</span>
                                <span className="min-w-0 flex-1 truncate">{displayName(c.profile, c.id)}</span>
                                <span className="text-xs text-zinc-500">{c.images} photos</span>
                                <span className={`w-10 text-right font-semibold tabular-nums ${c.score >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {c.score > 0 ? "+" : ""}{c.score}
                                </span>
                            </li>
                        ))}
                        {!s.comedians.length && <p className="text-sm text-zinc-500">No uploads yet.</p>}
                    </ul>
                </Section>
            </div>
        </div>
    );
}
