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
        title: 'Open it early?',
        message: `This one is meant for ${formatDate(capsule.openOn)}. Waiting is half the fun — but it’s your universe.`,
        confirmLabel: 'Peek anyway',
        cancelLabel: 'I’ll wait',
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
      title: 'Delete this time capsule?',
      message: `“${capsule.title}” will be gone for good.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const position = getContent().capsules.findIndex((c) => c.id === capsule.id);
    removeItem('capsules', capsule.id);
    setReading(null);
    toast('Time capsule deleted', {
      action: { label: 'Undo', run: () => restoreItem('capsules', capsule, position) },
    });
  };

  const todayDate = parseIsoDate(today)!;

  return (
    <section className="capsules" aria-labelledby="capsules-title">
      <div className="capsules__head">
        <div>
          <p className="hand capsules__eyebrow">to us, later</p>
          <h2 id="capsules-title" className="capsules__title">
            Time capsules
          </h2>
          <p className="capsules__lede">
            Write something together today and seal it until a day in the future.
          </p>
        </div>
        <button type="button" className="btn btn--soft" onClick={() => setFormOpen(true)}>
          <Plus aria-hidden="true" /> Seal a capsule
        </button>
      </div>

      {capsules.length === 0 ? (
        <div className="capsule capsule--empty">
          <Hourglass aria-hidden="true" />
          <p>
            No capsules yet. A letter to open on our first anniversary would be a lovely first one.
          </p>
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
                        ? `Opened ${formatTimestamp(capsule.openedAt)}`
                        : ready
                          ? 'Ready to open ♡'
                          : `Opens ${formatDate(capsule.openOn)} · ${plural(left, 'day')} to go`}
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
        eyebrow={current ? `sealed for ${formatDate(current.openOn)}` : ''}
        size="md"
        footer={
          current && (
            <>
              <button type="button" className="btn btn--quiet" onClick={() => remove(current)}>
                <Trash2 aria-hidden="true" /> Delete
              </button>
              <span className="spacer" />
              <button type="button" className="btn btn--primary" onClick={() => setReading(null)}>
                Close
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
            <p className="field__hint">Written {formatTimestamp(current.createdAt)}</p>
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
    if (!title.trim()) problems.title = 'Give it a name, like “For our first anniversary”.';
    if (!body.trim()) problems.body = 'Write something to your future selves.';
    if (!isValidIsoDate(openOn)) problems.openOn = 'Choose the day it unseals.';
    else if (openOn <= today) problems.openOn = 'Pick a day in the future.';
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
    toast(`Sealed until ${formatDate(openOn)}`);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Seal a time capsule"
      eyebrow="to us, later"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="capsule-form" className="btn btn--primary">
            Seal it
          </button>
        </>
      }
    >
      <form id="capsule-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Name"
          value={title}
          onChange={setTitle}
          error={errors.title}
          maxLength={100}
          placeholder="For our first anniversary"
        />
        <TextArea
          label="The letter"
          variant="letter"
          value={body}
          onChange={setBody}
          error={errors.body}
          rows={8}
          placeholder="Dear future us…"
        />
        <div className="form-row form-row--2">
          <TextField label="From" value={from} onChange={setFrom} maxLength={120} />
          <TextField
            label="Opens on"
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
