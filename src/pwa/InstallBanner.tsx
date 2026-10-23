import { useState } from 'react';
import { X } from 'lucide-react';
import { useInstall } from './install';
import { openInstallSheet } from './InstallSheet';
import './install.css';

const DISMISSED_KEY = 'olu:install-banner-dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** A gentle invitation on the home page to install the app (until it's installed or dismissed). */
export function InstallBanner() {
  const info = useInstall();
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (info.installed || dismissed || !info.secure) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Fine: it will simply show again next time.
    }
  };

  return (
    <aside className="install-banner" aria-label="Installeer de app">
      <img src="./icons/icon-192.png" alt="" width={48} height={48} />
      <div className="install-banner__text">
        <p className="install-banner__title">Neem ons universe overal mee</p>
        <p className="install-banner__sub">Zet het als app op je telefoon of computer.</p>
        <button type="button" className="install-banner__go" onClick={openInstallSheet}>
          Installeren
        </button>
      </div>
      <button
        type="button"
        className="icon-btn install-banner__close"
        onClick={dismiss}
        aria-label="Verbergen"
      >
        <X />
      </button>
    </aside>
  );
}
