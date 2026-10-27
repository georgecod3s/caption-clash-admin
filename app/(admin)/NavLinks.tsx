"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
    { href: "/", label: "Dashboard", icon: "◆" },
    { href: "/users", label: "Users", icon: "◉" },
    { href: "/media", label: "AI Media", icon: "▣" },
    { href: "/votes", label: "Votes", icon: "▲" },
];

export default function NavLinks() {
    const path = usePathname();
    return (
        <nav className="flex gap-1 md:flex-col">
            {LINKS.map((l) => {
                const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
                return (
                    <Link
                        key={l.href}
                        href={l.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                            active ? "bg-amber-400 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        }`}
                    >
                        <span className="w-4 text-center">{l.icon}</span>
                        {l.label}
                    </Link>
                );
            })}
        </nav>
    );
}
