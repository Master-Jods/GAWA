import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth/AuthContext";
import "../index.css";

export const metadata: Metadata = {
  title: "GAWA - Empowering Future Careers",
  description:
    "Connects Filipino students and emerging talent with paid, skill-based projects while helping businesses find talent, manage work, and build professional portfolios.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.png",
    apple: "/logo-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
