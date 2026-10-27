import { createClient } from "@/utils/supabase/server";
import LoginButton from "./LoginButton";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
    const { error } = await searchParams;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const denied = error === "not_admin" && user;

    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400 text-xl font-black text-black">
                    CC
                </div>
                <h1 className="text-2xl font-bold">Caption Clash Admin</h1>
                <p className="mt-2 text-sm text-zinc-400">Restricted area. Superadmins only.</p>

                {denied ? (
                    <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-left text-sm text-red-200">
                        <p className="font-semibold">Access denied</p>
                        <p className="mt-1">
                            {user.email} is signed in but is not a superadmin
                            (<code>profiles.is_superadmin</code> is false).
                        </p>
                        <form action="/auth/signout" method="post" className="mt-3">
                            <button className="rounded-lg bg-red-500/20 px-3 py-1.5 font-medium hover:bg-red-500/30">
                                Sign out and try another account
                            </button>
                        </form>
                    </div>
                ) : (
                    <LoginButton />
                )}
            </div>
        </main>
    );
}
