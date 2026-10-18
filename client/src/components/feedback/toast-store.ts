// Toasts live in a tiny external store rather than a React context: any hook, mutation callback
// or event handler can call `toast.success(...)`, and only the <Toaster> re-renders.

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

const DURATION_MS: Readonly<Record<ToastTone, number>> = {
  success: 5000,
  info: 6000,
  error: 8000,
};
const MAX_VISIBLE = 4;

let toasts: readonly Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach((listener) => {
    listener();
  });
};

const dismiss = (id: number): void => {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
};

const show = (tone: ToastTone, message: string): number => {
  const id = nextId;
  nextId += 1;
  toasts = [...toasts, { id, tone, message }].slice(-MAX_VISIBLE);
  emit();
  window.setTimeout(() => {
    dismiss(id);
  }, DURATION_MS[tone]);
  return id;
};

export const toast = {
  success: (message: string): number => show('success', message),
  error: (message: string): number => show('error', message),
  info: (message: string): number => show('info', message),
  dismiss,
};

export const toastStore = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): readonly Toast[] => toasts,
};
