import { onlineManager, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/services/api-error';
import { createQueryClient } from '@/services/query-client';

const offlineError = new ApiError('No response from the server', { status: 0 });

// Found in manual QA: offline, queries were paused rather than failed, so screens showed a
// skeleton forever (or old rows under a new filter), and a booking waited to send itself later.
describe('createQueryClient offline', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('fails a query made offline instead of pausing it', async () => {
    onlineManager.setOnline(false);
    const queryClient = createQueryClient();

    await expect(
      queryClient.query({
        queryKey: ['offline-test'],
        queryFn: () => Promise.reject(offlineError),
        retry: false,
      }),
    ).rejects.toBe(offlineError);
  });

  it('loads a failed query again when the connection comes back', async () => {
    onlineManager.setOnline(false);
    const queryClient = createQueryClient();
    queryClient.mount();
    const queryFn = vi.fn().mockRejectedValueOnce(offlineError).mockResolvedValue('slots');
    const observer = new QueryObserver(queryClient, {
      queryKey: ['reconnect-test'],
      queryFn,
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => {
      expect(observer.getCurrentResult().status).toBe('error');
    });

    onlineManager.setOnline(true);

    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toBe('slots');
    });
    unsubscribe();
    queryClient.unmount();
  });

  it('fails a mutation made offline instead of queueing it', async () => {
    onlineManager.setOnline(false);
    const queryClient = createQueryClient();
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(offlineError),
    });

    await expect(mutation.execute(undefined)).rejects.toBe(offlineError);
  });
});
