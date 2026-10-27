"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { describeImage, writeCaptions } from "@/lib/gemini";

const BUCKET = "caption-images";

function str(fd: FormData, k: string) {
    return String(fd.get(k) ?? "").trim();
}

// CREATE: upload a photo, optionally let Gemini describe it and write captions
export async function createMedia(formData: FormData) {
    const { supabase, user } = await requireAdmin();
    const file = formData.get("image") as File | null;
    if (!file || file.size === 0) throw new Error("Choose an image");
    if (!file.type.startsWith("image/")) throw new Error("File must be an image");

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/admin-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: file.type });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

    let description = str(formData, "description") || null;
    let captions = str(formData, "captions")
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => c.slice(0, 300));

    if (formData.get("use_ai") === "on" && process.env.GEMINI_API_KEY) {
        description = await describeImage(bytes.toString("base64"), file.type);
        captions = [...captions, ...(await writeCaptions(description))];
    }

    const { data: image, error } = await supabase
        .from("images")
        .insert({ user_id: user.id, storage_path: path, image_url: pub.publicUrl, description })
        .select("id")
        .single();
    if (error) throw new Error(error.message);

    if (captions.length) {
        const { error: cErr } = await supabase
            .from("captions")
            .insert(captions.map((content) => ({ image_id: image.id, user_id: user.id, content })));
        if (cErr) throw new Error(cErr.message);
    }

    revalidatePath("/media");
    redirect(`/media/${image.id}`);
}

// UPDATE image description
export async function updateImage(formData: FormData) {
    const { supabase } = await requireAdmin();
    const id = str(formData, "id");
    const { error } = await supabase.from("images").update({ description: str(formData, "description") || null }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/media/${id}`);
    revalidatePath("/media");
}

// UPDATE: replace the image file itself
export async function replaceImageFile(formData: FormData) {
    const { supabase, user } = await requireAdmin();
    const id = str(formData, "id");
    const file = formData.get("image") as File | null;
    if (!file || file.size === 0) throw new Error("Choose an image");

    const { data: old } = await supabase.from("images").select("storage_path").eq("id", id).single();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/admin-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error } = await supabase.from("images").update({ storage_path: path, image_url: pub.publicUrl }).eq("id", id);
    if (error) throw new Error(error.message);
    if (old?.storage_path) await supabase.storage.from(BUCKET).remove([old.storage_path]);

    revalidatePath(`/media/${id}`);
    revalidatePath("/media");
}

// DELETE image (captions + votes cascade) and its file
export async function deleteImage(formData: FormData) {
    const { supabase } = await requireAdmin();
    const id = str(formData, "id");
    const { data: img } = await supabase.from("images").select("storage_path").eq("id", id).single();
    const { error } = await supabase.from("images").delete().eq("id", id);
    if (error) throw new Error(error.message);
    if (img?.storage_path) await supabase.storage.from(BUCKET).remove([img.storage_path]);
    revalidatePath("/media");
    redirect("/media");
}

// CREATE caption (manual)
export async function addCaption(formData: FormData) {
    const { supabase, user } = await requireAdmin();
    const imageId = str(formData, "image_id");
    const content = str(formData, "content").slice(0, 300);
    if (!content) return;
    const { error } = await supabase.from("captions").insert({ image_id: imageId, user_id: user.id, content });
    if (error) throw new Error(error.message);
    revalidatePath(`/media/${imageId}`);
}

// CREATE captions with Gemini from the stored description
export async function generateCaptions(formData: FormData) {
    const { supabase, user } = await requireAdmin();
    const imageId = str(formData, "image_id");
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set on this deployment");

    const { data: img, error: e1 } = await supabase.from("images").select("*").eq("id", imageId).single();
    if (e1) throw new Error(e1.message);

    let description: string = img.description;
    if (!description) {
        const res = await fetch(img.image_url);
        const mime = res.headers.get("content-type") || "image/jpeg";
        description = await describeImage(Buffer.from(await res.arrayBuffer()).toString("base64"), mime);
        await supabase.from("images").update({ description }).eq("id", imageId);
    }
    const captions = await writeCaptions(description);
    const { error } = await supabase
        .from("captions")
        .insert(captions.map((content) => ({ image_id: imageId, user_id: user.id, content })));
    if (error) throw new Error(error.message);
    revalidatePath(`/media/${imageId}`);
}

// UPDATE caption
export async function updateCaption(formData: FormData) {
    const { supabase } = await requireAdmin();
    const id = str(formData, "id");
    const content = str(formData, "content").slice(0, 300);
    if (!content) throw new Error("Caption can't be empty");
    const { error } = await supabase.from("captions").update({ content }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/media/${str(formData, "image_id")}`);
}

// DELETE caption
export async function deleteCaption(formData: FormData) {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("captions").delete().eq("id", str(formData, "id"));
    if (error) throw new Error(error.message);
    revalidatePath(`/media/${str(formData, "image_id")}`);
}
