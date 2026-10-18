import { Menu, X } from 'lucide-react';
import { useState } from 'react';

import { SideNav } from '@/app/layout/SideNav';
import { BrandMark } from '@/components/layout/BrandMark';
import { Dialog } from '@/components/ui/Dialog';

const MENU_ID = 'mobile-menu';
const MENU_TITLE_ID = 'mobile-menu-title';

/** Below the large breakpoint: a top bar whose menu button opens the navigation as a drawer. */
export const MobileNav = () => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper px-4 py-2.5 lg:hidden">
        <BrandMark />
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls={MENU_ID}
          onClick={() => setOpen(true)}
          className="grid size-11 place-items-center rounded-lg text-ink hover:bg-ink/5"
        >
          <Menu aria-hidden="true" size={22} />
        </button>
      </header>

      <Dialog open={open} onClose={close} labelledBy={MENU_TITLE_ID} placement="side" id={MENU_ID}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 id={MENU_TITLE_ID} className="sr-only">
              Menu
            </h2>
            <BrandMark />
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              className="grid size-11 place-items-center rounded-lg text-ink-muted hover:bg-ink/5 hover:text-ink"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>
          <SideNav onNavigate={close} showBrand={false} />
        </div>
      </Dialog>
    </>
  );
};
