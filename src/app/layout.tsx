import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "flowEdge - AI 港股交易大师",
  description:
    "5 legendary investors debate HK stocks in real-time. Buffett, Soros, Dalio, Lynch, Livermore render verdict with risk controls.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="bg-[#F0F0F0] text-[#0A0A0A] antialiased">{children}</body>
    </html>
  );
}
