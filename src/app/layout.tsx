import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/app-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "HireFast",
  description: "Find candidates by describing who you need.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fafaf9" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
