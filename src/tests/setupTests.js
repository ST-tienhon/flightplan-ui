import "@testing-library/jest-dom/vitest";

// App.jsx uses ResizeObserver for responsive globe sizing.
// jsdom doesn't implement it, so we stub it.
class ResizeObserverMock {
    observe() { }
    unobserve() { }
    disconnect() { }
}

globalThis.ResizeObserver = ResizeObserverMock;