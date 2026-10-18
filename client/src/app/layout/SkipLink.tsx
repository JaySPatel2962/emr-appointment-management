export interface SkipLinkProps {
  targetId: string;
}

/** The first stop for keyboard users: jumps past the navigation to the page's content. */
export const SkipLink = ({ targetId }: SkipLinkProps) => (
  <a
    href={`#${targetId}`}
    className="sr-only rounded-lg bg-carbon px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
  >
    Skip to main content
  </a>
);
