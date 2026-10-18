import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

import { env } from '@/config/env';
import { authSession } from '@/services/auth-session';
import { refreshAccessToken } from '@/services/http';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;
let users = 0;

/** A token for the handshake: the current one, or a refreshed one if it's about to expire. */
const handshakeToken = async (): Promise<string | null> => {
  if (authSession.hasFreshAccessToken()) {
    return authSession.getAccessToken();
  }
  try {
    return await refreshAccessToken();
  } catch {
    return null;
  }
};

const createSocket = (): AppSocket => {
  const instance: AppSocket = io(env.socketUrl, {
    autoConnect: false,
    // Called before every connection attempt, so a reconnect never reuses an expired token.
    auth: (send) => {
      void handshakeToken().then((token) => {
        send({ token });
      });
    },
  });

  // The server closes the socket when its access token expires, and socket.io doesn't retry a
  // server-side disconnect on its own. Reconnecting fetches a fresh token through `auth` above.
  instance.on('disconnect', (reason) => {
    if (reason === 'io server disconnect' && users > 0 && authSession.getAccessToken()) {
      instance.connect();
    }
  });
  return instance;
};

/** One more screen needs live updates: connect if this is the first. */
export const acquireSocket = (): AppSocket => {
  socket ??= createSocket();
  users += 1;
  if (!socket.active) {
    socket.connect();
  }
  return socket;
};

/** A screen no longer needs live updates: disconnect once nothing does. */
export const releaseSocket = (): void => {
  users = Math.max(0, users - 1);
  if (users === 0) {
    socket?.disconnect();
  }
};

/** Drops the connection and the user it was opened for. */
export const closeSocket = (): void => {
  users = 0;
  socket?.disconnect();
  socket = null;
};

// When the session ends (logout, an expired refresh cookie, a logout in another tab), the live
// connection goes with it. Subscribing here keeps socket.io out of the first download: only the
// screens that use live updates import this module.
authSession.subscribe(() => {
  if (authSession.getState().status === 'anonymous') {
    closeSocket();
  }
});
