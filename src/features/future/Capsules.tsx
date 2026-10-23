import { useEffect, useState } from 'react';
import { Hourglass, Lock, MailOpen, Plus, Trash2 } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { TextArea, TextField } from '../../components/ui/Fields';
import { celebrate, confirm, toast } from '../../components/ui/feedback';
import { getContent, updateContent, useContent } from '../../data/store';
import { patchItem, removeItem, restoreItem } from '../../data/actions';
import type { TimeCapsule } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import {
  daysUntil,
  formatDate,
  formatTimestamp,
  isValidIsoDate,
  parseIsoDate,
  plural,
} from '../../lib/dates';
import { useToday } from '../../hooks/useToday';
import { getAuthor } from '../../data/people';

/** Letters to our future selves, sealed until the day we choose. */
export function Capsules() {
  const capsules = useContent((c) => c.capsules);
  const today = useToday();
  const [formOpen, setFormOpen] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const current = capsules.find((c) => c.id === reading) ?? null;

  const open = async (capsule: TimeCapsule) => {
    const early = capsule.openOn > today;
    if (early) {
      const ok = await confirm({
        title: 'Nu al openen?',
        message: `Deze is bedoeld voor ${formatDate(capsule.openOn)}. Wachten is de helft van de lol — maar het is jullie universe.`,
        confirmLabel: 'Toch even gluren',
        cancelLabel: 'Ik wacht wel',
      });
      if (!ok) return;
    }
    if (!capsule.openedAt) {
      patchItem('capsules', capsule.id, { openedAt: nowIso() });
      if (!early) celebrate();
    }
    setReading(capsule.id);
  };

  const remove = async (capsule: TimeCapsule) => {
    const ok = await confirm({
      title: 'Deze tijdcapsule verwijderen?',
      message: `“${capsule.title}” is dan voorgoed weg.`,
      confirmLabel: 'Verwijderen',
      tone: 'danger',
    });
    if (!ok) return;
    const position = getContent().capsules.findIndex((c) => c.id === capsule.id);
    removeItem('capsules', capsule.id);
    setReading(null);
    toast('Tijdcapsule verwijderd', {
      action: { label: 'Ongedaan maken', run: () => restoreItem('capsules', capsule, position) },
    });
  };

  const todayDate = parseIsoDate(today)!;

  return (
    <section className="capsules" aria-labelledby="capsules-title">
      <div className="capsules__head">
        <div>
          <p className="hand capsules__eyebrow">to us, later</p>
          <h2 id="capsules-title" className="capsules__title">
            Tijdcapsules
          </h2>
          <p className="capsules__lede">
            Schrijf vandaag samen iets en verzegel het tot een dag in de toekomst.
          </p>
        </div>
        <button type="button" className="btn btn--soft" onClick={() => setFormOpen(true)}>
          <Plus aria-hidden="true" /> Capsule verzegelen
        </button>
      </div>

      {capsules.length === 0 ? (
        <div className="capsule capsule--empty">
          <Hourglass aria-hidden="true" />
          <p>Nog geen capsules. Een brief voor ons eerste jubileum zou een mooie eerste zijn.</p>
        </div>
      ) : (
        <ul className="capsules__list">
          {capsules.map((capsule) => {
            const ready = capsule.openOn <= today;
            const left = daysUntil(parseIsoDate(capsule.openOn)!, todayDate);
            return (
              <li key={capsule.id}>
                <button
                  type="button"
                  className={`capsule ${ready ? 'is-ready' : ''}`}
                  onClick={() => open(capsule)}
                >
                  <span className="capsule__icon" aria-hidden="true">
                    {capsule.openedAt ? <MailOpen /> : ready ? <MailOpen /> : <Lock />}
                  </span>
                  <span className="capsule__text">
                    <span className="capsule__title">{capsule.title}</span>
                    <span className="capsule__meta">
                      {capsule.openedAt
                        ? `Geopend ${formatTimestamp(capsule.openedAt)}`
                        : ready
                          ? 'Klaar om te openen ♡'
                          : `Opent ${formatDate(capsule.openOn)} · nog ${plural(left, 'dag', 'dagen')}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <CapsuleForm open={formOpen} onClose={() => setFormOpen(false)} />
      <Dialog
        open={current !== null}
        onClose={() => setReading(null)}
        title={current?.title ?? ''}
        eyebrow={current ? `verzegeld voor ${formatDate(current.openOn)}` : ''}
        size="md"
        footer={
          current && (
            <>
              <button type="button" className="btn btn--quiet" onClick={() => remove(current)}>
                <Trash2 aria-hidden="true" /> Verwijderen
              </button>
              <span className="spacer" />
              <button type="button" className="btn btn--primary" onClick={() => setReading(null)}>
                Sluiten
              </button>
            </>
          )
        }
      >
        {current && (
          <div className="capsule-letter">
            {current.body.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {current.from && <p className="capsule-letter__from">— {current.from}</p>}
            <p className="field__hint">Geschreven {formatTimestamp(current.createdAt)}</p>
          </div>
        )}
      </Dialog>
    </section>
  );
}

function CapsuleForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useContent((c) => c.profile);
  const today = useToday();
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState('');
  const [body, setBody] = useState('');
  const [openOn, setOpenOn] = useState('');
  const [errors, setErrors] = useState<{ title?: string; body?: string; openOn?: string }>({});

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setBody('');
    setOpenOn('');
    setFrom(`${profile.yourName} & ${profile.partnerName}`);
    setErrors({});
  }, [open, profile.yourName, profile.partnerName]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problems: typeof errors = {};
    if (!title.trim()) problems.title = 'Geef hem een naam, zoals “Voor ons eerste jubileum”.';
    if (!body.trim()) problems.body = 'Schrijf iets aan jullie toekomstige zelf.';
    if (!isValidIsoDate(openOn)) problems.openOn = 'Kies de dag waarop hij opengaat.';
    else if (openOn <= today) problems.openOn = 'Kies een dag in de toekomst.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const capsule: TimeCapsule = {
      id: createId('capsule'),
      title: title.trim(),
      from: from.trim(),
      body: body.trim(),
      openOn,
      by: getAuthor(),
      createdAt: nowIso(),
    };
    updateContent((c) => ({
      ...c,
      capsules: [...c.capsules, capsule].sort((a, b) => a.openOn.localeCompare(b.openOn)),
    }));
    toast(`Verzegeld tot ${formatDate(openOn)}`);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tijdcapsule verzegelen"
      eyebrow="to us, later"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="capsule-form" className="btn btn--primary">
            Verzegelen
          </button>
        </>
      }
    >
      <form id="capsule-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Naam"
          value={title}
          onChange={setTitle}
          error={errors.title}
          maxLength={100}
          placeholder="Voor ons eerste jubileum"
        />
        <TextArea
          label="De brief"
          variant="letter"
          value={body}
          onChange={setBody}
          error={errors.body}
          rows={8}
          placeholder="Lieve toekomstige wij…"
        />
        <div className="form-row form-row--2">
          <TextField label="Van" value={from} onChange={setFrom} maxLength={120} />
          <TextField
            label="Opent op"
            type="date"
            min={today}
            value={openOn}
            onChange={setOpenOn}
            error={errors.openOn}
          />
        </div>
      </form>
    </Dialog>
  );
}
