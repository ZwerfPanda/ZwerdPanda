import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { TextField } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import { getContent } from '../../data/store';
import { updateProfile } from '../../data/actions';
import { parseIsoDate, todayIso } from '../../lib/dates';

export function validateStartDate(value: string): string | null {
  if (!value) return 'Pick the date you consider the start of “us”.';
  const date = parseIsoDate(value);
  if (!date) return 'That doesn’t look like a real date.';
  if (value > todayIso()) return 'That date is in the future — our story has already started!';
  if (date.getUTCFullYear() < 1950) return 'That date seems a little too long ago.';
  return null;
}

export function StartDateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(getContent().profile.startDate ?? '');
      setError(null);
    }
  }, [open]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateStartDate(value);
    setError(problem);
    if (problem) return;
    updateProfile({ startDate: value });
    toast('Saved. Every day counts now ♡');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="When did we begin?"
      eyebrow="our date"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="start-date-form" className="btn btn--primary">
            Save our date
          </button>
        </>
      }
    >
      <form id="start-date-form" className="form" onSubmit={save} noValidate>
        <p style={{ color: 'var(--ink-soft)' }}>
          The first date, the day we made it official — whichever day feels like the beginning to us. You can change it
          any time in Settings.
        </p>
        <TextField
          label="Our start date"
          type="date"
          value={value}
          max={todayIso()}
          onChange={(v) => {
            setValue(v);
            if (error) setError(validateStartDate(v));
          }}
          error={error}
          required
        />
      </form>
    </Dialog>
  );
}
