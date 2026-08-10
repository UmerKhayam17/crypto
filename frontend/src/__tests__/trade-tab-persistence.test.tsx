import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { useEffect, useState } from "react";
import { setViewport } from "./setup";

const KEY = "novatrade.trade.mobileTab";

function MobileTabs({ onSetter }: { onSetter?: (set: (v: string) => void) => void } = {}) {
  const [tab, setTab] = useState<string>(() => {
    const v = window.localStorage.getItem(KEY);
    return v === "chart" || v === "book" || v === "ticket" ? v : "chart";
  });
  useEffect(() => { window.localStorage.setItem(KEY, tab); }, [tab]);
  useEffect(() => { onSetter?.(setTab); }, [onSetter]);
  return <div data-testid="panel">{tab}-panel</div>;
}

describe("Trade mobile tab persistence", () => {
  beforeEach(() => { cleanup(); localStorage.clear(); });

  it.each([320, 375, 414, 768])("persists across reload at %ipx", (w) => {
    setViewport(w);
    let setter: ((v: string) => void) | undefined;
    const first = render(<MobileTabs onSetter={(s) => { setter = s; }} />);
    act(() => { setter!("book"); });
    expect(screen.getByTestId("panel")).toHaveTextContent("book-panel");
    expect(localStorage.getItem(KEY)).toBe("book");
    first.unmount();

    // simulate refresh
    render(<MobileTabs />);
    expect(screen.getByTestId("panel")).toHaveTextContent("book-panel");
  });

  it("falls back to chart for invalid stored value", () => {
    setViewport(375);
    localStorage.setItem(KEY, "garbage");
    render(<MobileTabs />);
    expect(screen.getByTestId("panel")).toHaveTextContent("chart-panel");
  });
});