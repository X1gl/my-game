import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "まわして四角｜対戦パズル試作",
  description: "4枚をくるっと回して、自分の色の四角を作ろう。共有盤面で遊ぶ90秒の対戦パズル。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
