/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { displayName, fmtDate, type Caption, type Image, type Profile, type Vote } from "@/lib/data";
import {
    addCaption,
    deleteCaption,
    deleteImage,
    generateCaptions,
    replaceImageFile,
    updateCaption,
    updateImage,
} from "../actions";
import SubmitButton from "../SubmitButton";

export const dynamic = "force-dynamic";

export default async function MediaDetail({ params }: PageProps<"/media/[id]">) {
    const { id } = await params;
    const { supabase } = await requireAdmin();

    const { data: image } = await supabase.from("images").select("*").eq("id", id).maybeSingle<Image>();
    if (!image) notFound();

    const { data: caps } = await supabase
        .from("captions")
        .select("*")
        .eq("image_id", id)
        .order("created_at", { ascending: true });
    const captions = (caps ?? []) as Caption[];
    const { data: vs } = captions.length
        ? await supabase.from("caption_votes").select("*").in("caption_id", captions.map((c) => c.id))
        : { data: [] };
    const votes = (vs ?? []) as Vote[];
    const { data: owner } = await supabase.from("profiles").select("*").eq("id", image.user_id).maybeSingle<Profile>();

    const tally = (cid: string) => {
        const mine = votes.filter((v) => v.caption_id === cid);
        const up = mine.filter((v) => v.vote > 0).length;
        return { up, down: mine.length - up };
    };
    const aiOn = !!process.env.GEMINI_API_KEY;

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <Link href="/media" className="text-sm text-zinc-400 hover:text-white">← All media</Link>

            <div className="grid gap-6 lg:grid-cols-5">
                <div className="space-y-4 lg:col-span-2">
                    <img src={image.image_url} alt="" className="w-full rounded-2xl border border-zinc-800 object-cover" />
                    <div className="card space-y-1 p-4 text-sm">
                        <p><span className="text-zinc-500">Uploaded by</span> {displayName(owner ?? undefined, image.user_id)}</p>
                        <p><span className="text-zinc-500">Created</span> {fmtDate(image.created_at)}</p>
                        <p className="break-all font-mono text-xs text-zinc-500">{image.storage_path}</p>
                    </div>
                    <form action={replaceImageFile} className="card space-y-2 p-4">
                        <input type="hidden" name="id" value={image.id} />
                        <p className="text-sm font-semibold">Replace image file</p>
                        <input type="file" name="image" accept="image/*" required className="input" />
                        <SubmitButton className="btn btn-ghost" pending="Uploading…">Replace</SubmitButton>
                    </form>
                    <form action={deleteImage} className="card border-red-500/30 p-4">
                        <input type="hidden" name="id" value={image.id} />
                        <p className="mb-2 text-sm text-zinc-400">Deletes the photo, its file, all {captions.length} captions and their votes.</p>
                        <SubmitButton className="btn btn-danger" pending="Deleting…" confirm="Delete this media and everything attached to it?">
                            Delete media
                        </SubmitButton>
                    </form>
                </div>

                <div className="space-y-6 lg:col-span-3">
                    <form action={updateImage} className="card space-y-3 p-5">
                        <input type="hidden" name="id" value={image.id} />
                        <h2 className="font-semibold">AI description</h2>
                        <textarea name="description" defaultValue={image.description ?? ""} rows={5} className="input" />
                        <SubmitButton pending="Saving…">Save description</SubmitButton>
                    </form>

                    <section className="card space-y-4 p-5">
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold">Captions ({captions.length})</h2>
                            {aiOn && (
                                <form action={generateCaptions}>
                                    <input type="hidden" name="image_id" value={image.id} />
                                    <SubmitButton className="btn btn-ghost" pending="Gemini is writing…">✨ Generate 5 more</SubmitButton>
                                </form>
                            )}
                        </div>

                        <ul className="space-y-3">
                            {captions.map((c) => {
                                const t = tally(c.id);
                                return (
                                    <li key={c.id} className="rounded-xl border border-zinc-800 p-3">
                                        <form action={updateCaption} className="flex flex-col gap-2 sm:flex-row">
                                            <input type="hidden" name="id" value={c.id} />
                                            <input type="hidden" name="image_id" value={image.id} />
                                            <input name="content" defaultValue={c.content} maxLength={300} className="input flex-1" />
                                            <SubmitButton className="btn btn-ghost" pending="…">Save</SubmitButton>
                                        </form>
                                        <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                                            <span>
                                                <span className="text-emerald-400">{t.up}▲</span> <span className="text-rose-400">{t.down}▼</span> · {fmtDate(c.created_at)}
                                            </span>
                                            <form action={deleteCaption}>
                                                <input type="hidden" name="id" value={c.id} />
                                                <input type="hidden" name="image_id" value={image.id} />
                                                <SubmitButton className="text-rose-400 hover:text-rose-300" pending="…" confirm="Delete this caption and its votes?">
                                                    Delete
                                                </SubmitButton>
                                            </form>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        <form action={addCaption} className="flex gap-2 border-t border-zinc-800 pt-4">
                            <input type="hidden" name="image_id" value={image.id} />
                            <input name="content" placeholder="Add a caption…" maxLength={300} required className="input flex-1" />
                            <SubmitButton pending="…">Add</SubmitButton>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
}
