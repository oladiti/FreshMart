import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement IntersectionObserver, which framer-motion's
// `whileInView` uses. Report every observed element as immediately visible so
// viewport-driven animations resolve during tests instead of throwing.
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = new Set();
  }

  observe(target) {
    this.targets.add(target);
    this.callback(
      [{ target, isIntersecting: true, intersectionRatio: 1 }],
      this
    );
  }

  unobserve(target) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
  }

  takeRecords() {
    return [];
  }
}

if (!('IntersectionObserver' in globalThis)) {
  globalThis.IntersectionObserver = MockIntersectionObserver;
}

afterEach(() => {
  cleanup();
});
