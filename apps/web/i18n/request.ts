import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, organization } from "@agentos/core";
import { auth } from "@/lib/auth";

const SUPPORTED_LOCALES = ["en", "zh-TW"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

async function resolveSessionLocale(): Promise<SupportedLocale | undefined> {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });
    if (!session) return undefined;
    if (isSupportedLocale(session.user.locale)) return session.user.locale;

    const orgId = session.session.activeOrganizationId;
    if (!orgId) return undefined;
    const [org] = await db.select({ locale: organization.locale }).from(organization).where(eq(organization.id, orgId));
    return isSupportedLocale(org?.locale) ? org.locale : undefined;
  } catch {
    // No session (e.g. before sign-in) — fall through to cookie/default.
    return undefined;
  }
}

export default getRequestConfig(async () => {
  const sessionLocale = await resolveSessionLocale();
  const store = await cookies();
  const cookieLocale = store.get("NEXT_LOCALE")?.value;
  const locale = sessionLocale ?? (isSupportedLocale(cookieLocale) ? cookieLocale : "en");

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
