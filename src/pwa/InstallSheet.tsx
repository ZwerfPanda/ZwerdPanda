import { useEffect, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  EllipsisVertical,
  MonitorDown,
  Share,
  SquarePlus,
} from 'lucide-react';
import { Dialog } from '../components/ui/Dialog';
import { toast } from '../components/ui/feedback';
import { useContent } from '../data/store';
import { promptInstall, useInstall, type InstallInfo } from './install';
import './install.css';

let setOpenGlobal: ((open: boolean) => void) | null = null;

/** Opens the "install the app" sheet from anywhere. */
export function openInstallSheet() {
  setOpenGlobal?.(true);
}

export function InstallSheetHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpenGlobal = setOpen;
    return () => {
      setOpenGlobal = null;
    };
  }, []);
  return <InstallSheet open={open} onClose={() => setOpen(false)} />;
}

function Step({ n, icon, children }: { n: number; icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="install-step">
      <span className="install-step__n" aria-hidden="true">
        {n}
      </span>
      <span className="install-step__text">{children}</span>
      {icon && (
        <span className="install-step__icon" aria-hidden="true">
          {icon}
        </span>
      )}
    </li>
  );
}

function Steps({ info }: { info: InstallInfo }) {
  if (info.platform === 'ios') {
    return info.iosSafari ? (
      <ol className="install-steps">
        <Step n={1} icon={<Share />}>
          Tap the <strong>Share</strong> button at the bottom of Safari (on iPad: top right).
        </Step>
        <Step n={2} icon={<SquarePlus />}>
          Scroll down and tap <strong>Add to Home Screen</strong>.
        </Step>
        <Step n={3}>
          Tap <strong>Add</strong>. Our universe now has its own icon and opens full-screen, like
          any app.
        </Step>
      </ol>
    ) : (
      <ol className="install-steps">
        <Step n={1} icon={<Share />}>
          Tap the <strong>Share</strong> button next to the address bar.
        </Step>
        <Step n={2} icon={<SquarePlus />}>
          Tap <strong>Add to Home Screen</strong>. Don’t see it? Open this page in{' '}
          <strong>Safari</strong> and do the same there.
        </Step>
      </ol>
    );
  }
  if (info.platform === 'android') {
    return (
      <ol className="install-steps">
        <Step n={1} icon={<EllipsisVertical />}>
          Tap the <strong>⋮ menu</strong> in the top corner of Chrome.
        </Step>
        <Step n={2} icon={<Download />}>
          Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
        </Step>
      </ol>
    );
  }
  if (info.macSafari) {
    return (
      <ol className="install-steps">
        <Step n={1}>
          In the menu bar choose <strong>File → Add to Dock</strong> (Safari 17 or newer).
        </Step>
      </ol>
    );
  }
  if (info.firefox) {
    return (
      <p className="install-note">
        Firefox doesn’t install websites as apps. Open this page in <strong>Chrome</strong>,{' '}
        <strong>Edge</strong> or <strong>Safari</strong> to install it — or simply bookmark it.
      </p>
    );
  }
  return (
    <ol className="install-steps">
      <Step n={1} icon={<MonitorDown />}>
        Click the <strong>install icon</strong> at the right end of the address bar (or open the
        browser menu).
      </Step>
      <Step n={2}>
        Choose <strong>Install Our Little Universe</strong>. It opens in its own window and gets an
        icon on your computer.
      </Step>
    </ol>
  );
}

export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const info = useInstall();
  const title = useContent((c) => c.profile.siteTitle);
  const link =
    typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: 'Our little universe ♡', url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast('Link copied — send it to the other phone');
    } catch {
      // Sharing was cancelled; nothing to do.
    }
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      toast('Installed ♡ — find it with your other apps');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Get the app" eyebrow="on every device" size="sm">
      <div className="install">
        <div className="install__hero" aria-hidden="true">
          <img src="./icons/icon-192.png" alt="" width={84} height={84} className="install__icon" />
        </div>

        {info.installed ? (
          <p className="install-done">
            <CheckCircle2 aria-hidden="true" /> You’re using the installed app on this device.
          </p>
        ) : !info.secure ? (
          <p className="install-note">
            Installing works once the site is online with a secure (https) address — see the setup
            guide. Until then it works fine in the browser.
          </p>
        ) : (
          <>
            <p className="install-lede">
              Put {title} on your home screen. It opens full-screen, works offline, and feels just
              like an app — on iPhone, Android, and computers. No app store needed.
            </p>
            {info.canPrompt ? (
              <button type="button" className="btn btn--primary btn--block" onClick={install}>
                <Download aria-hidden="true" /> Install the app
              </button>
            ) : (
              <Steps info={info} />
            )}
          </>
        )}

        <div className="install-share">
          <p>Installing it on the other phone? Send this link and open it there.</p>
          <button type="button" className="btn btn--ghost btn--small" onClick={shareLink}>
            {typeof navigator !== 'undefined' && 'share' in navigator ? (
              <Share aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            Send the link
          </button>
        </div>
      </div>
    </Dialog>
  );
}
