import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Caption Clash Admin",
    description: "Superadmin console for Caption Clash",
    robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="en" className="h-full antialiased">
            <body className="min-h-full">{children}</body>
        </html>
    );
}
