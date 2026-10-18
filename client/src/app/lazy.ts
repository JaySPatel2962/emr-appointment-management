import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

/**
 * React.lazy for modules with named exports, since the codebase has no default exports.
 * Each page becomes its own chunk, loaded the first time someone opens it.
 */
export const lazyNamed = <M extends Record<K, ComponentType>, K extends keyof M & string>(
  load: () => Promise<M>,
  name: K,
): LazyExoticComponent<M[K]> =>
  lazy(async () => {
    const module = await load();
    return { default: module[name] };
  });
