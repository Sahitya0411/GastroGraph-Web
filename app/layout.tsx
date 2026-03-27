import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "GastroGraph",
    template: "%s",
  },
  icons: {
    icon: "/GastroGraph2.png",
    shortcut: "/GastroGraph2.png",
    apple: "/GastroGraph2.png",
  },
  description:
    "Discover intelligent ingredient substitutes powered by Graph Neural Networks and chemical flavor science.",
  keywords: ["ingredient substitutes", "food science", "GNN", "knowledge graph", "culinary AI"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
