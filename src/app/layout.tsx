import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AuthSessionProvider from "@/components/providers/AuthSessionProvider";
import { getPublicAssetUrl } from "@/config/cdn";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({ 
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Compose and Learn Piano | KeyCraft",
  description: "KeyCraft is a piano roll editor that makes music composition simple, intuitive, and enjoyable.",
  icons: {
    icon: getPublicAssetUrl("/images/logo.png"),
    shortcut: getPublicAssetUrl("/images/logo.png"),
    apple: getPublicAssetUrl("/images/logo.png"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthSessionProvider>
        <Header />
        {children}
        <Footer />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
