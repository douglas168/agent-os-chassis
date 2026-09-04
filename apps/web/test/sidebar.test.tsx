import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AriaAttributes, ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { NAV } from "@/components/shell/nav";
import en from "@/messages/en.json";

vi.mock("next/navigation", () => ({
  usePathname: () => "/approvals",
}));

// next/link's App Router internals expect a live router context that a
// bare RTL render doesn't provide — render it as a plain anchor instead.
vi.mock("next/link", () => ({
  default: ({ href, children, className, "aria-current": ariaCurrent }: {
    href: string; children: ReactNode; className?: string;
    "aria-current"?: AriaAttributes["aria-current"];
  }) => (
    <a href={href} className={className} aria-current={ariaCurrent}>{children}</a>
  ),
}));

// Vitest globals are disabled in this repository, so RTL cannot register its
// automatic cleanup hook. Keep each render isolated explicitly.
afterEach(() => cleanup());

describe("Sidebar", () => {
  it("renders all four nav groups and a link for every one of the 12 routes", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Sidebar />
      </NextIntlClientProvider>,
    );

    for (const group of ["Work", "Intelligence", "Build", "Manage"]) {
      expect(screen.getByText(group, { selector: "div" })).toBeInTheDocument();
    }
    // Assert every nav href, not a sample of two — a broken link anywhere
    // in the 12-route table fails this test.
    for (const item of NAV) {
      const links = screen.getAllByRole("link").filter((el) => el.getAttribute("href") === item.href);
      expect(links).toHaveLength(1);
    }
  });

  it("marks the active route's link with aria-current=page", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Sidebar />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("link", { name: /Approvals/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /LLM Provider/i })).not.toHaveAttribute("aria-current");
  });
});
