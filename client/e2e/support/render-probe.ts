import type { Page } from '@playwright/test';

import { expect } from './fixtures';

// Counts what React renders in the production build, through the hook React DevTools uses: React
// calls it after every commit, in production too. A component that rendered in a commit carries
// React's PerformedWork flag; a subtree React skipped keeps its old child fibers, so the walk
// stops there. Each render is also traced to the page element it drew into (a table row, say),
// which shows exactly which parts of the page a change re-rendered.

export interface RenderStats {
  /** Times React applied changes to the page. */
  commits: number;
  /** Components that rendered, mounts included. */
  components: number;
  /** The tracked elements (see resetRenderStats) that a rendered component drew into. */
  scopes: string[];
}

interface Fiber {
  tag: number;
  flags: number;
  child: Fiber | null;
  sibling: Fiber | null;
  alternate: Fiber | null;
  stateNode: unknown;
}

interface RenderProbe {
  commits: number;
  components: number;
  scopeSelector: string | null;
  scopes: Set<Element>;
}

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
    __renderProbe?: RenderProbe;
  }
}

/** Installs the counter. Call it before the page loads, so React finds the hook at startup. */
export const installRenderProbe = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    // React's work tags and flag (ReactWorkTags.js, ReactFiberFlags.js).
    const FUNCTION_COMPONENT = 0;
    const CLASS_COMPONENT = 1;
    const HOST_COMPONENT = 5;
    const FORWARD_REF = 11;
    const MEMO_COMPONENT = 14;
    const SIMPLE_MEMO_COMPONENT = 15;
    const PERFORMED_WORK = 1;
    const COMPONENT_TAGS = new Set([
      FUNCTION_COMPONENT,
      CLASS_COMPONENT,
      FORWARD_REF,
      MEMO_COMPONENT,
      SIMPLE_MEMO_COMPONENT,
    ]);

    const probe: RenderProbe = {
      commits: 0,
      components: 0,
      scopeSelector: null,
      scopes: new Set(),
    };

    /** The first element a component renders. */
    const hostElement = (fiber: Fiber): Element | null => {
      for (let child = fiber.child; child !== null; child = child.sibling) {
        if (child.tag === HOST_COMPONENT && child.stateNode instanceof Element) {
          return child.stateNode;
        }
        const nested = hostElement(child);
        if (nested !== null) {
          return nested;
        }
      }
      return null;
    };

    const record = (fiber: Fiber): void => {
      probe.components += 1;
      if (probe.scopeSelector !== null) {
        const scope = hostElement(fiber)?.closest(probe.scopeSelector);
        if (scope) {
          probe.scopes.add(scope);
        }
      }
    };

    const visit = (fiber: Fiber, mounted: boolean): void => {
      if (COMPONENT_TAGS.has(fiber.tag) && (mounted || (fiber.flags & PERFORMED_WORK) !== 0)) {
        record(fiber);
      }
      // A subtree React skipped still points at the children of an earlier commit.
      if (!mounted && fiber.alternate !== null && fiber.child === fiber.alternate.child) {
        return;
      }
      for (let child = fiber.child; child !== null; child = child.sibling) {
        visit(child, mounted || child.alternate === null);
      }
    };

    const renderers = new Map<number, unknown>();
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers,
      supportsFiber: true,
      inject: (renderer: unknown): number => {
        const id = renderers.size + 1;
        renderers.set(id, renderer);
        return id;
      },
      onCommitFiberRoot: (_rendererId: number, root: { current: Fiber }): void => {
        probe.commits += 1;
        visit(root.current, root.current.alternate === null);
      },
      onCommitFiberUnmount: (): void => undefined,
      onPostCommitFiberRoot: (): void => undefined,
      checkDCE: (): void => undefined,
    };
    window.__renderProbe = probe;
  });
};

/**
 * Starts counting afresh. Renders are traced to the elements matching `scopeSelector`: pass the
 * rows of a table, say, to learn which rows a change re-rendered.
 */
export const resetRenderStats = (page: Page, scopeSelector: string | null = null): Promise<void> =>
  page.evaluate((selector) => {
    const probe = window.__renderProbe;
    if (!probe) {
      throw new Error('The render probe is not installed');
    }
    probe.commits = 0;
    probe.components = 0;
    probe.scopeSelector = selector;
    probe.scopes = new Set();
  }, scopeSelector);

export const readRenderStats = (page: Page): Promise<RenderStats> =>
  page.evaluate(() => {
    const probe = window.__renderProbe;
    if (!probe) {
      throw new Error('The render probe is not installed');
    }
    return {
      commits: probe.commits,
      components: probe.components,
      scopes: [...probe.scopes].map((element) => element.textContent.replace(/\s+/g, ' ').trim()),
    };
  });

/** Waits until React has committed nothing for `quietMs`. */
export const waitForRenderIdle = async (page: Page, quietMs = 500): Promise<void> => {
  let previous = -1;
  await expect
    .poll(
      async () => {
        const { commits } = await readRenderStats(page);
        const settled = commits === previous;
        previous = commits;
        return settled;
      },
      { intervals: [quietMs] },
    )
    .toBe(true);
};
