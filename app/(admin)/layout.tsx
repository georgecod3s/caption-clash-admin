import { requireAdmin } from "@/lib/admin";
import NavLinks from "./NavLinks";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
    const { user, profile } = await requireAdmin();
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email;

    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            <aside className="border-b border-zinc-800 bg-zinc-950 p-4 md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
                <div className="mb-6 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 text-sm font-black text-black">
                        CC
                    </div>
                    <div>
                        <p className="text-sm font-bold leading-tight">Caption Clash</p>
                        <p className="text-xs text-zinc-500">Admin console</p>
                    </div>
                </div>
                <NavLinks />
                <div className="mt-6 border-t border-zinc-800 pt-4 md:absolute md:right-4 md:bottom-4 md:left-4">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="mb-2 text-xs text-amber-400">superadmin</p>
                    <form action="/auth/signout" method="post">
                        <button className="text-xs text-zinc-500 hover:text-white">Sign out →</button>
                    </form>
                </div>
            </aside>
            <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
        </div>
    );
}
