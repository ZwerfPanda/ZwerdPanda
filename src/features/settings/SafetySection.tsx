import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, History, RotateCcw, Undo2 } from 'lucide-react';
import { getContent, replaceContent, updateContent } from '../../data/store';
import {
  addMissing,
  describeCount,
  listRestorePoints,
  readRestorePoint,
  takeRestorePoint,
  useRestorePointsVersion,
  whatsMissing,
  type RestorePointInfo,
} from '../../data/restorePoints';
import { normalizeContent } from '../../data/normalize';
import type { AppContent } from '../../data/types';
import { Dialog } from '../../components/ui/Dialog';
import { confirm, toast } from '../../components/ui/feedback';
import { href } from '../../lib/router';
import { isSharing } from '../../sync/sync';
import { PhotoRescue } from './PhotoRescue';

export const LAST_BACKUP_KEY = 'olu:last-backup:v1';

const when = (iso: string) =>
  new Date(iso).toLocaleString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
}

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`safety__item ${ok ? 'is-ok' : 'is-warn'}`}>
      {ok ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
      <span>{children}</span>
    </li>
  );
}

/**
 * How safe everything is, honestly, and the ways back if something went
 * wrong: automatic restore points and finding lost photos.
 */
export function SafetySection() {
  const version = useRestorePointsVersion();
  const [points, setPoints] = useState<RestorePointInfo[]>([]);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [open, setOpen] = useState<RestorePointInfo | null>(null);
  const [old, setOld] = useState<AppContent | null>(null);
  const [all, setAll] = useState(false);
  const sharing = isSharing();
  let lastBackup: string | null = null;
  try {
    lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    // Not stored.
  }
  const backupAge = daysSince(lastBackup);

  useEffect(() => {
    listRestorePoints()
      .then(setPoints)
      .catch(() => setPoints([]));
  }, [version]);

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  const protect = async () => {
    const granted = await navigator.storage?.persist?.().catch(() => false);
    setPersisted(Boolean(granted));
    toast(
      granted
        ? 'Opslag beschermd ♡'
        : 'Je browser wil dit nog niet — zet de app op je beginscherm, dan lukt het wel.',
    );
  };

  const view = async (p: RestorePointInfo) => {
    setOpen(p);
    setOld(await readRestorePoint(p.id));
  };

  const missing = old ? whatsMissing(getContent(), old) : {};
  const missingText = Object.entries(missing)
    .map(([k, n]) => describeCount(k, n))
    .join(', ');

  const bringBack = () => {
    if (!old) return;
    void takeRestorePoint('Vlak voor terughalen', getContent());
    updateContent((c) => normalizeContent(addMissing(c, old)));
    toast(`Teruggehaald: ${missingText} ♡`);
    setOpen(null);
  };

  const goBack = async () => {
    if (!old || !open) return;
    const ok = await confirm({
      title: `Alles terugzetten naar ${when(open.at)}?`,
      message: `Alles wordt weer zoals het toen was${sharing ? ', ook op de andere telefoon' : ''}. Wat daarna is veranderd, gaat niet verloren: daar wordt eerst een herstelpunt van gemaakt.`,
      confirmLabel: 'Terugzetten',
      tone: 'danger',
    });
    if (!ok) return;
    replaceContent(old);
    toast('Teruggezet ♡');
    setOpen(null);
  };

  const shown = all ? points : points.slice(0, 6);

  return (
    <div className="safety">
      <ul className="safety__status">
        <Status ok={points.length > 0}>
          <strong>Herstelpunten</strong> —{' '}
          {points.length
            ? `${points.length} automatische kopieën op deze telefoon, de laatste ${when(points[0].at)}.`
            : 'nog geen; de eerste komt vanzelf.'}
        </Status>
        <Status ok={sharing}>
          <strong>Kopie in de cloud</strong> —{' '}
          {sharing ? (
            'alles staat ook in jullie privé-opslag online en op de andere telefoon.'
          ) : (
            <>
              alles staat nu alleen op deze telefoon.{' '}
              <a href={href('/settings', { section: 'together' })}>Zet “Samen” aan</a> voor een
              tweede kopie.
            </>
          )}
        </Status>
        <Status ok={persisted === true}>
          <strong>Beschermde opslag</strong> —{' '}
          {persisted
            ? 'je telefoon ruimt deze opslag niet zomaar op.'
            : 'je telefoon kan de opslag van websites opruimen als je ze lang niet opent. Zet de app op je beginscherm en tik op beschermen.'}
          {!persisted && (
            <button type="button" className="btn btn--ghost btn--small" onClick={protect}>
              Beschermen
            </button>
          )}
        </Status>
        <Status ok={backupAge !== null && backupAge <= 30}>
          <strong>Backupbestand</strong> —{' '}
          {backupAge === null
            ? 'nog nooit gemaakt. Een backup met foto’s hieronder is je extra zekerheid.'
            : backupAge === 0
              ? 'vandaag gemaakt.'
              : `${backupAge} dagen geleden gemaakt.`}
        </Status>
      </ul>

      <h3 className="safety__title">
        <History aria-hidden="true" /> Herstelpunten
      </h3>
      <p className="settings-text">
        Deze telefoon bewaart zelf kopieën van al onze woorden en foto’s: elk uur als er iets
        verandert, elke dag één (drie maanden lang), en altijd vlak voordat iets wordt weggehaald.
      </p>
      {points.length > 0 && (
        <ul className="safety__points">
          {shown.map((p) => (
            <li key={p.id}>
              <button type="button" className="safety__point" onClick={() => view(p)}>
                <strong>{when(p.at)}</strong>
                <span>{p.reason}</span>
                <small>{p.summary}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {points.length > 6 && (
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => setAll((a) => !a)}
        >
          {all ? 'Minder tonen' : `Alle ${points.length} tonen`}
        </button>
      )}

      <PhotoRescue />

      <Dialog
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open ? when(open.at) : ''}
        eyebrow="herstelpunt"
        size="sm"
        footer={
          old ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={goBack}>
                <RotateCcw aria-hidden="true" /> Helemaal terugzetten
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={bringBack}
                disabled={!missingText}
              >
                <Undo2 aria-hidden="true" /> Haal terug wat ontbreekt
              </button>
            </>
          ) : undefined
        }
      >
        {open && (
          <div className="safety__detail">
            <p className="settings-text">{open.reason}</p>
            <p className="settings-text">Toen: {open.summary}.</p>
            {!old ? (
              <p className="settings-text">Openen…</p>
            ) : missingText ? (
              <p className="notice">
                <span>
                  Hier staat iets in dat nu ontbreekt: <strong>{missingText}</strong>. “Haal terug
                  wat ontbreekt” zet alleen dat terug — alles wat er nu is, blijft gewoon staan.
                </span>
              </p>
            ) : (
              <p className="notice notice--plain">
                <span>Alles uit dit herstelpunt staat er nu ook nog. Er ontbreekt niets.</span>
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
