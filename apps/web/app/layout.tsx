import type { ReactNode } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { Nunito } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import {
  db,
  isOrgAdmin,
  organization,
  createActionsRepo,
  createFollowUpsRepo,
  createMessagesRepo,
} from "@agentos/core";
import { AppShell } from "@/components/shell/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { resolveOrgContext } from "@/lib/context";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

async function loadShellData() {
  try {
    const ctx = await resolveOrgContext(await headers(), { persist: false });
    const [[org], pending, due, unmatched] = await Promise.all([
      db.select({ name: organization.name }).from(organization).where(eq(organization.id, ctx.orgId)),
      createActionsRepo(db).listPending(ctx),
      createFollowUpsRepo(db).countDueForOrg(ctx),
      createMessagesRepo(db).countUnmatched(ctx),
    ]);
    return {
      orgName: org?.name,
      counts: { approvals: pending.length, jobs: due, inbox: unmatched },
      isAdmin: isOrgAdmin(ctx.role),
    };
  } catch (err) {
    console.error("loadShellData failed:", err);
    return { orgName: undefined, counts: undefined, isAdmin: false };
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const { orgName, counts, isAdmin } = await loadShellData();

  return (
    <html lang={locale} className={nunito.variable} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <AppShell orgName={orgName} counts={counts} isAdmin={isAdmin}>{children}</AppShell>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
