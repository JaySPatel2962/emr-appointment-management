import type { Page } from '@playwright/test';

// What a page says and hears over Socket.IO, read off the wire. Socket.IO starts on HTTP long
// polling and then upgrades to a WebSocket, so both transports are read.

export interface SocketEvent {
  event: string;
  data: unknown;
}

export interface SocketTraffic {
  sent: SocketEvent[];
  received: SocketEvent[];
}

// An Engine.IO message (4) carrying a Socket.IO event (2), with an optional acknowledgement id:
// 42["appointment:created",{...}] or 421["scheduler:join",{...}].
const EVENT_PACKET = /^42\d*(\[.*\])$/s;

// Engine.IO separates the packets of one polling payload with a record separator.
const PACKET_SEPARATOR = '\x1e';

const SOCKET_PATH = '/socket.io/';

const parsePackets = (payload: string): SocketEvent[] =>
  payload.split(PACKET_SEPARATOR).flatMap((packet) => {
    const json = EVENT_PACKET.exec(packet)?.[1];
    if (json === undefined) {
      return [];
    }
    const [event, data] = JSON.parse(json) as unknown[];
    return typeof event === 'string' ? [{ event, data }] : [];
  });

/** Records the page's Socket.IO events from now on. Call it before the page connects. */
export const recordSocketTraffic = (page: Page): SocketTraffic => {
  const traffic: SocketTraffic = { sent: [], received: [] };
  const record = (list: SocketEvent[], payload: string | Buffer | null): void => {
    if (typeof payload === 'string') {
      list.push(...parsePackets(payload));
    }
  };

  page.on('websocket', (socket) => {
    if (!socket.url().includes(SOCKET_PATH)) {
      return;
    }
    socket.on('framesent', ({ payload }) => {
      record(traffic.sent, payload);
    });
    socket.on('framereceived', ({ payload }) => {
      record(traffic.received, payload);
    });
  });
  page.on('request', (request) => {
    if (request.url().includes(SOCKET_PATH) && request.method() === 'POST') {
      record(traffic.sent, request.postData());
    }
  });
  page.on('response', (response) => {
    if (response.url().includes(SOCKET_PATH) && response.request().method() === 'GET') {
      response.text().then(
        (body) => {
          record(traffic.received, body);
        },
        () => undefined,
      );
    }
  });
  return traffic;
};

/** The events named `event` in `list`. */
export const eventsNamed = (list: readonly SocketEvent[], event: string): SocketEvent[] =>
  list.filter((item) => item.event === event);
