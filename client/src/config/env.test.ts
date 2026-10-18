import { describe, expect, it } from 'vitest';

import { parseClientEnv } from '@/config/env';

const PAGE_ORIGIN = 'http://localhost:5173';

const DEFAULTS = {
  apiUrl: 'http://localhost:5000/api/v1',
  socketUrl: 'http://localhost:5000',
  clinicTimezone: 'Asia/Kolkata',
};

describe('parseClientEnv', () => {
  it('defaults to the local API, Socket.IO on its origin, and the Kolkata clinic clock', () => {
    expect(parseClientEnv({}, PAGE_ORIGIN)).toEqual(DEFAULTS);
  });

  it('treats empty variables as unset', () => {
    expect(
      parseClientEnv(
        { VITE_API_URL: '', VITE_SOCKET_URL: '', VITE_CLINIC_TIMEZONE: '' },
        PAGE_ORIGIN,
      ),
    ).toEqual(DEFAULTS);
  });

  it('drops trailing slashes', () => {
    expect(
      parseClientEnv(
        {
          VITE_API_URL: 'https://api.clinic.example/api/v1/',
          VITE_SOCKET_URL: 'https://live.clinic.example/',
        },
        PAGE_ORIGIN,
      ),
    ).toMatchObject({
      apiUrl: 'https://api.clinic.example/api/v1',
      socketUrl: 'https://live.clinic.example',
    });
  });

  it("takes Socket.IO's origin from the API URL when VITE_SOCKET_URL is unset", () => {
    expect(
      parseClientEnv({ VITE_API_URL: 'https://api.clinic.example/api/v1' }, PAGE_ORIGIN).socketUrl,
    ).toBe('https://api.clinic.example');
  });

  it('accepts an API path served from the page origin', () => {
    expect(parseClientEnv({ VITE_API_URL: '/api/v1' }, 'https://clinic.example')).toMatchObject({
      apiUrl: '/api/v1',
      socketUrl: 'https://clinic.example',
    });
  });

  it('accepts another clinic timezone', () => {
    expect(parseClientEnv({ VITE_CLINIC_TIMEZONE: 'Asia/Dubai' }, PAGE_ORIGIN).clinicTimezone).toBe(
      'Asia/Dubai',
    );
  });

  it('names an invalid variable without repeating its value', () => {
    const parse = () => parseClientEnv({ VITE_API_URL: 'ftp://files.internal' }, PAGE_ORIGIN);

    expect(parse).toThrow(/VITE_API_URL must be an http\(s\) URL or a path/);
    expect(parse).not.toThrow(/files\.internal/);
  });

  it('rejects a Socket.IO URL that is not http(s)', () => {
    expect(() => parseClientEnv({ VITE_SOCKET_URL: 'ws://localhost:5000' }, PAGE_ORIGIN)).toThrow(
      /VITE_SOCKET_URL must be an http\(s\) URL/,
    );
  });

  it('rejects an unknown timezone', () => {
    expect(() => parseClientEnv({ VITE_CLINIC_TIMEZONE: 'Mars/Olympus' }, PAGE_ORIGIN)).toThrow(
      /VITE_CLINIC_TIMEZONE must be an IANA timezone/,
    );
  });
});
