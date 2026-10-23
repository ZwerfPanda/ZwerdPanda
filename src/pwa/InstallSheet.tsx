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
          Tik op de <strong>Deel</strong>-knop onderaan in Safari (op iPad: rechtsboven).
        </Step>
        <Step n={2} icon={<SquarePlus />}>
          Scroll naar beneden en tik op <strong>Zet op beginscherm</strong>.
        </Step>
        <Step n={3}>
          Tik op <strong>Voeg toe</strong>. Ons universe heeft nu een eigen icoontje en opent
          schermvullend, net als elke app.
        </Step>
      </ol>
    ) : (
      <ol className="install-steps">
        <Step n={1} icon={<Share />}>
          Tik op de <strong>Deel</strong>-knop naast de adresbalk.
        </Step>
        <Step n={2} icon={<SquarePlus />}>
          Tik op <strong>Zet op beginscherm</strong>. Zie je het niet? Open deze pagina in{' '}
          <strong>Safari</strong> en doe daar hetzelfde.
        </Step>
      </ol>
    );
  }
  if (info.platform === 'android') {
    return (
      <ol className="install-steps">
        <Step n={1} icon={<EllipsisVertical />}>
          Tik op het <strong>⋮-menu</strong> in de bovenhoek van Chrome.
        </Step>
        <Step n={2} icon={<Download />}>
          Tik op <strong>App installeren</strong> (of <strong>Toevoegen aan startscherm</strong>).
        </Step>
      </ol>
    );
  }
  if (info.macSafari) {
    return (
      <ol className="install-steps">
        <Step n={1}>
          Kies in de menubalk <strong>Archief → Voeg toe aan Dock</strong> (Safari 17 of nieuwer).
        </Step>
      </ol>
    );
  }
  if (info.firefox) {
    return (
      <p className="install-note">
        Firefox installeert geen websites als app. Open deze pagina in <strong>Chrome</strong>,{' '}
        <strong>Edge</strong> of <strong>Safari</strong> om hem te installeren — of zet gewoon een
        bladwijzer.
      </p>
    );
  }
  return (
    <ol className="install-steps">
      <Step n={1} icon={<MonitorDown />}>
        Klik op het <strong>installatie-icoontje</strong> rechts in de adresbalk (of open het
        browsermenu).
      </Step>
      <Step n={2}>
        Kies <strong>Our Little Universe installeren</strong>. Hij opent in een eigen venster en
        krijgt een icoontje op je computer.
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
      toast('Link gekopieerd — stuur hem naar de andere telefoon');
    } catch {
      // Sharing was cancelled; nothing to do.
    }
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      toast('Geïnstalleerd ♡ — je vindt hem tussen je andere apps');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Get the app" eyebrow="op elk apparaat" size="sm">
      <div className="install">
        <div className="install__hero" aria-hidden="true">
          <img src="./icons/icon-192.png" alt="" width={84} height={84} className="install__icon" />
        </div>

        {info.installed ? (
          <p className="install-done">
            <CheckCircle2 aria-hidden="true" /> Je gebruikt de geïnstalleerde app op dit apparaat.
          </p>
        ) : !info.secure ? (
          <p className="install-note">
            Installeren werkt zodra de site online staat met een veilig (https) adres — zie de
            handleiding. Tot die tijd werkt alles prima in de browser.
          </p>
        ) : (
          <>
            <p className="install-lede">
              Zet {title} op je beginscherm. Hij opent schermvullend, werkt offline en voelt precies
              als een app — op iPhone, Android en computers. Geen app store nodig.
            </p>
            {info.canPrompt ? (
              <button type="button" className="btn btn--primary btn--block" onClick={install}>
                <Download aria-hidden="true" /> Installeer de app
              </button>
            ) : (
              <Steps info={info} />
            )}
          </>
        )}

        <div className="install-share">
          <p>Op de andere telefoon installeren? Stuur deze link en open hem daar.</p>
          <button type="button" className="btn btn--ghost btn--small" onClick={shareLink}>
            {typeof navigator !== 'undefined' && 'share' in navigator ? (
              <Share aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            Stuur de link
          </button>
        </div>
      </div>
    </Dialog>
  );
}
