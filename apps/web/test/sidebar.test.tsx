import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
  default: ({ href, children, className, "aria-current": ariaCurrent, "aria-label": ariaLabel }: {
    href: string; children: ReactNode; className?: string;
    "aria-current"?: AriaAttributes["aria-current"];
    "aria-label"?: AriaAttributes["aria-label"];
  }) => (
    <a href={href} className={className} aria-current={ariaCurrent} aria-label={ariaLabel}>{children}</a>
  ),
}));

// Vitest globals are disabled in this repository, so RTL cannot register its
// automatic cleanup hook. Keep each render isolated explicitly.
afterEach(() => cleanup());

describe("Sidebar", () => {
  it("renders all four nav groups and a link for every one of the 12 routes", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Sidebar isAdmin />
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
        <Sidebar isAdmin />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("link", { name: /Approvals/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /LLM Provider/i })).not.toHaveAttribute("aria-current");
  });

  it("shows non-zero counters on approvals, jobs, and inbox links", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Sidebar counts={{ approvals: 3, jobs: 0, inbox: 5 }} />
      </NextIntlClientProvider>,
    );

    const approvalsLink = screen.getByRole("link", { name: "Approvals (3)" });
    const jobsLink = screen.getByRole("link", { name: "Jobs" });
    const inboxLink = screen.getByRole("link", { name: "Inbox (5)" });
    expect(within(approvalsLink).getByText("3")).toBeInTheDocument();
    expect(within(jobsLink).queryByText("0")).not.toBeInTheDocument();
    expect(within(inboxLink).getByText("5")).toBeInTheDocument();

    expect(screen.getByRole("complementary")).toHaveClass("w-16", "xl:w-[245px]");
  });

  it("hides the Manage nav group when isAdmin is false", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Sidebar isAdmin={false} />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organization" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "LLM Provider" })).not.toBeInTheDocument();
  });

  it("shows the Manage nav group when isAdmin is true", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Sidebar isAdmin />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Organization" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "LLM Provider" })).toBeInTheDocument();
  });

  it("nav link labels are hidden below xl via a class, not a lost accessible name (finding 10)", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Sidebar counts={{ approvals: 3, jobs: 0, inbox: 5 }} />
      </NextIntlClientProvider>,
    );

    const approvalsLink = screen.getByRole("link", { name: "Approvals (3)" });
    expect(approvalsLink).toHaveAttribute("aria-label", "Approvals (3)");
    expect(approvalsLink.querySelector("span.hidden.xl\\:inline")).toHaveTextContent("Approvals");

    const pill = screen.getByText("3");
    expect(pill.className).not.toMatch(/\bhidden\b/);
  });
});
