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
  title: "KeyCraft | Piano Roll Editor - Create Music and Learn Piano",
  description: "KeyCraft is a complete piano platform with AI transcription, a comprehensive music editor, and a song library. Everything you need to create music and learn piano!",
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
