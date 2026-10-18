import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom doesn't implement <dialog>'s methods yet. These do what components rely on: showModal()
// opens the dialog and close() closes it and fires "close". (Focus trapping is the browser's job,
// checked in the end-to-end tests.)
if (!('showModal' in HTMLDialogElement.prototype)) {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
}

// Vitest runs without globals, so Testing Library can't unmount rendered trees by itself.
afterEach(() => {
  cleanup();
});
