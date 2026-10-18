import type { Session, User } from '@/types/models';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

/** Why the last session in this tab ended, so the login screen can say so. */
export type SessionEndReason = 'expired' | 'signed-out';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** Null until a session has ended in this tab. */
  endReason: SessionEndReason | null;
}

// A token this close to expiring is treated as expired, so it can't lapse mid-request.
const EXPIRY_MARGIN_MS = 30_000;
const SIGNED_OUT_MESSAGE = 'signed-out';

// The access token lives only in this module's memory: never in localStorage, sessionStorage
// or a readable cookie. A reload gets a new one from the httpOnly refresh cookie.
let accessToken: string | null = null;
let expiresAt = 0;
let state: AuthState = { status: 'checking', user: null, endReason: null };
const listeners = new Set<() => void>();

// Tells the app's other tabs about a logout, so none of them keeps working with a live token.
const channel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('emr-auth')
    : null;

const setState = (next: AuthState): void => {
  state = next;
  listeners.forEach((listener) => {
    listener();
  });
};

const end = (endReason: SessionEndReason | null): void => {
  accessToken = null;
  expiresAt = 0;
  setState({ status: 'anonymous', user: null, endReason });
};

channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.data === SIGNED_OUT_MESSAGE && state.status === 'authenticated') {
    end('signed-out');
  }
});

/** The tab's session, as a tiny external store that React reads with useSyncExternalStore. */
export const authSession = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getState: (): AuthState => state,

  getAccessToken: (): string | null => accessToken,

  /** True while there is an access token that won't expire in the next 30 seconds. */
  hasFreshAccessToken: (now: number = Date.now()): boolean =>
    accessToken !== null && expiresAt - EXPIRY_MARGIN_MS > now,

  /** A login or refresh succeeded. */
  start: (session: Session, now: number = Date.now()): void => {
    accessToken = session.accessToken;
    expiresAt = now + session.expiresIn * 1000;
    setState({ status: 'authenticated', user: session.user, endReason: null });
  },

  /** The refresh cookie was refused. Ending a session that had started says it expired. */
  expire: (): void => {
    end(state.status === 'authenticated' ? 'expired' : state.endReason);
  },

  /** The user logged out here: end this tab's session and every other tab's. */
  signOut: (): void => {
    end('signed-out');
    channel?.postMessage(SIGNED_OUT_MESSAGE);
  },
};
