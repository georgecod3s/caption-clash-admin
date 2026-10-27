import type { Caption, Image, Profile, Vote } from "./data";

const TZ = "America/New_York";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });
const dowFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STOP = new Set(
    "the a an and or but of to in on at for with is it its it's this that when you your my me i im i'm be are was were just like so not no do does did have has had he she they we them their our us as by from about what who how if then than too very can will would out up all one get got his her him there here been into over more some only also yet".split(
        " ",
    ),
);

export type CaptionStat = Caption & { up: number; down: number; score: number; total: number; image?: Image };

export function computeStats(data: { profiles: Profile[]; images: Image[]; captions: Caption[]; votes: Vote[] }) {
    const { profiles, images, captions, votes } = data;
    const imageById = new Map(images.map((i) => [i.id, i]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    // --- per caption scores
    const tally = new Map<string, { up: number; down: number }>();
    for (const v of votes) {
        const t = tally.get(v.caption_id) ?? { up: 0, down: 0 };
        if (v.vote > 0) t.up++;
        else t.down++;
        tally.set(v.caption_id, t);
    }
    const cs: CaptionStat[] = captions.map((c) => {
        const t = tally.get(c.id) ?? { up: 0, down: 0 };
        return { ...c, ...t, score: t.up - t.down, total: t.up + t.down, image: imageById.get(c.image_id) };
    });

    const upvotes = votes.filter((v) => v.vote > 0).length;
    const downvotes = votes.length - upvotes;
    const voted = cs.filter((c) => c.total > 0);

    const hallOfFame = [...voted].sort((a, b) => b.score - a.score || b.up - a.up).slice(0, 3);
    const hallOfShame = [...voted].sort((a, b) => a.score - b.score || b.down - a.down).slice(0, 3);
    const divisive = voted
        .filter((c) => c.up > 0 && c.down > 0)
        .map((c) => ({ ...c, heat: (Math.min(c.up, c.down) / Math.max(c.up, c.down)) * c.total }))
        .sort((a, b) => b.heat - a.heat)
        .slice(0, 3);

    // --- 30-day pulse
    const days: { day: string; label: string; votes: number; captions: number; images: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        days.push({
            day: dayFmt.format(d),
            label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ }),
            votes: 0,
            captions: 0,
            images: 0,
        });
    }
    const dayIdx = new Map(days.map((d, i) => [d.day, i]));
    const bump = (iso: string, key: "votes" | "captions" | "images") => {
        const i = dayIdx.get(dayFmt.format(new Date(iso)));
        if (i !== undefined) days[i][key]++;
    };
    votes.forEach((v) => bump(v.created_at, "votes"));
    captions.forEach((c) => bump(c.created_at, "captions"));
    images.forEach((im) => bump(im.created_at, "images"));

    // --- heatmap: weekday x hour (ET) of votes
    const heat: number[][] = DOWS.map(() => Array(24).fill(0));
    for (const v of votes) {
        const d = new Date(v.created_at);
        const dow = DOWS.indexOf(dowFmt.format(d));
        const hr = Number(hourFmt.format(d)) % 24;
        if (dow >= 0) heat[dow][hr]++;
    }
    let peak = { dow: 0, hour: 0, n: 0 };
    heat.forEach((row, di) => row.forEach((n, h) => n > peak.n && (peak = { dow: di, hour: h, n })));

    // --- brevity vs wit
    const buckets = [
        { label: "Short (<40)", min: 0, max: 40 },
        { label: "Medium (40–70)", min: 40, max: 70 },
        { label: "Long (70–100)", min: 70, max: 100 },
        { label: "Essay (100+)", min: 100, max: Infinity },
    ].map((b) => {
        const inB = cs.filter((c) => c.content.length >= b.min && c.content.length < b.max);
        const up = inB.reduce((s, c) => s + c.up, 0);
        const tot = inB.reduce((s, c) => s + c.total, 0);
        return { ...b, count: inB.length, upRate: tot ? up / tot : 0, votes: tot };
    });

    // --- critics
    const byVoter = new Map<string, { up: number; down: number }>();
    for (const v of votes) {
        const t = byVoter.get(v.user_id) ?? { up: 0, down: 0 };
        if (v.vote > 0) t.up++;
        else t.down++;
        byVoter.set(v.user_id, t);
    }
    const voters = [...byVoter.entries()].map(([id, t]) => ({
        id,
        profile: profileById.get(id),
        ...t,
        total: t.up + t.down,
        upRate: t.up / (t.up + t.down),
    }));
    const topVoters = [...voters].sort((a, b) => b.total - a.total).slice(0, 5);
    const qualified = voters.filter((v) => v.total >= 5);
    const pool = qualified.length ? qualified : voters;
    const harshest = [...pool].sort((a, b) => a.upRate - b.upRate)[0];
    const easiest = [...pool].sort((a, b) => b.upRate - a.upRate)[0];

    // --- comedians: whose uploaded photos produce the best-rated captions
    const byUploader = new Map<string, { score: number; images: number; captions: number }>();
    for (const im of images) {
        const t = byUploader.get(im.user_id) ?? { score: 0, images: 0, captions: 0 };
        t.images++;
        byUploader.set(im.user_id, t);
    }
    for (const c of cs) {
        const owner = c.image?.user_id;
        if (!owner) continue;
        const t = byUploader.get(owner) ?? { score: 0, images: 0, captions: 0 };
        t.score += c.score;
        t.captions++;
        byUploader.set(owner, t);
    }
    const comedians = [...byUploader.entries()]
        .map(([id, t]) => ({ id, profile: profileById.get(id), ...t }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    // --- funniest words: avg caption score by word (min 3 captions)
    const words = new Map<string, { n: number; score: number }>();
    for (const c of voted) {
        const seen = new Set(
            c.content
                .toLowerCase()
                .replace(/[^a-z'\s]/g, " ")
                .split(/\s+/)
                .filter((w) => w.length > 2 && !STOP.has(w)),
        );
        for (const w of seen) {
            const t = words.get(w) ?? { n: 0, score: 0 };
            t.n++;
            t.score += c.score;
            words.set(w, t);
        }
    }
    let minN = 3;
    let wordList = [...words.entries()].filter(([, t]) => t.n >= minN);
    if (wordList.length < 8) {
        minN = 2;
        wordList = [...words.entries()].filter(([, t]) => t.n >= minN);
    }
    if (wordList.length < 8) wordList = [...words.entries()];
    const funnyWords = wordList
        .map(([w, t]) => ({ word: w, n: t.n, avg: t.score / t.n }))
        .sort((a, b) => b.avg - a.avg || b.n - a.n)
        .slice(0, 14);

    // --- best photo: the image whose captions have the highest total score
    const imgScore = new Map<string, number>();
    cs.forEach((c) => imgScore.set(c.image_id, (imgScore.get(c.image_id) ?? 0) + c.score));
    const bestImageId = [...imgScore.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
        totals: {
            users: profiles.length,
            superadmins: profiles.filter((p) => p.is_superadmin).length,
            images: images.length,
            captions: captions.length,
            votes: votes.length,
            upvotes,
            downvotes,
            upRate: votes.length ? upvotes / votes.length : 0,
            capsPerImage: images.length ? captions.length / images.length : 0,
            ghostRate: captions.length ? (captions.length - voted.length) / captions.length : 0,
            activeVoters: byVoter.size,
            uploaders: new Set(images.map((i) => i.user_id)).size,
        },
        hallOfFame,
        hallOfShame,
        divisive,
        days,
        heat,
        dows: DOWS,
        peak,
        buckets,
        topVoters,
        harshest,
        easiest,
        comedians,
        funnyWords,
        bestImage: bestImageId ? { image: imageById.get(bestImageId), score: imgScore.get(bestImageId)! } : null,
    };
}
