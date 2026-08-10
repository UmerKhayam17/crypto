import "@testing-library/jest-dom/vitest";

// Polyfill matchMedia for jsdom and allow tests to resize the viewport.
function makeMatchMedia(width: number) {
  return (query: string): MediaQueryList => {
    const max = /max-width:\s*(\d+)/.exec(query);
    const min = /min-width:\s*(\d+)/.exec(query);
    let matches = true;
    if (max) matches = matches && width <= Number(max[1]);
    if (min) matches = matches && width >= Number(min[1]);
    return {
      matches, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  };
}

export function setViewport(width: number, height = 800) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: height });
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: makeMatchMedia(width) });
  window.dispatchEvent(new Event("resize"));
}

// Default desktop
setViewport(1280, 800);

// ResizeObserver shim
(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = class {
  observe() {} unobserve() {} disconnect() {}
} as unknown as typeof ResizeObserver;