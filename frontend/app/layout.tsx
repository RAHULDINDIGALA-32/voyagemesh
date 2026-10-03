import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoyageMesh",
  description:
    "A mesh of specialist agents. One voyage on paper. Intelligent travel planning with LangGraph, MCP, guardrails, and human review.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full bg-paper text-ink font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
