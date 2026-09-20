import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Syncopate } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const display = Syncopate({
  variable: "--font-display",
  weight: ["400", "700"],
  subsets: ["latin"],
});

/** The admin runs on Inter: a workhorse UI face built for dense, legible data. */
const ui = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Colección Reyes-Veray",
  description: "Private Collection Archives & Viewing Rooms.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${display.variable} ${ui.variable}`}>
      <body className="antialiased min-h-screen selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
        {children}
      </body>
    </html>
  );
}
