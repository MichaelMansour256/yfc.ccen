import type { Metadata } from "next";
import "../globals.css";
import { siteConfig, themeCssVars } from "@/config";

export const metadata: Metadata = { title: `Admin — ${siteConfig.shortName}` };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>
        {/* Live theme values from src/config/theme.ts */}
        <style dangerouslySetInnerHTML={{ __html: themeCssVars() }} />
        {children}
      </body>
    </html>
  );
}
