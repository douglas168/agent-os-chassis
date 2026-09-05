import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle";
import en from "@/messages/en.json";

const { renderedIcons, setTheme } = vi.hoisted(() => ({
  renderedIcons: [] as string[],
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme }),
}));

vi.mock("lucide-react", () => ({
  Moon: ({ className }: { className?: string }) => {
    renderedIcons.push("moon");
    return <svg data-testid="moon-icon" className={className} />;
  },
  Sun: ({ className }: { className?: string }) => {
    renderedIcons.push("sun");
    return <svg data-testid="sun-icon" className={className} />;
  },
}));

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
  renderedIcons.length = 0;
  setTheme.mockClear();
});

function renderToggle() {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <ThemeToggle />
    </NextIntlClientProvider>
  );
}

describe("ThemeToggle hydration", () => {
  it("keeps the initial icon stable and switches after mounting", async () => {
    document.documentElement.classList.add("dark");

    render(renderToggle());
    expect(renderedIcons[0]).toBe("moon");
    expect(await screen.findByTestId("sun-icon")).toBeInTheDocument();
  });
});
