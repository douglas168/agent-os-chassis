import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { AppShell } from "@/components/shell/app-shell";
import en from "@/messages/en.json";

vi.mock("next/navigation", () => ({
  usePathname: () => "/approvals",
  useRouter: () => ({ refresh: () => {} }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(() => cleanup());

describe("AppShell", () => {
  it("pins the shell to the viewport and allows the content column to shrink", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AppShell>
          <div data-testid="shell-content">Content</div>
        </AppShell>
      </NextIntlClientProvider>,
    );

    const main = screen.getByTestId("shell-content").closest("main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveClass("flex-1", "overflow-y-auto");

    const column = main?.parentElement;
    expect(column).toHaveClass("min-h-0");

    const shell = column?.parentElement;
    expect(shell).toHaveClass("h-screen");
    expect(shell).not.toHaveClass("min-h-screen");
  });
});
