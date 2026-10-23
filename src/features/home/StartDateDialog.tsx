import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { TextField } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import { getContent } from '../../data/store';
import { updateProfile } from '../../data/actions';
import { parseIsoDate, todayIso } from '../../lib/dates';

export function validateStartDate(value: string): string | null {
  if (!value) return 'Kies de datum die voor jullie het begin van “ons” is.';
  const date = parseIsoDate(value);
  if (!date) return 'Dat lijkt geen echte datum.';
  if (value > todayIso()) return 'Die datum ligt in de toekomst — ons verhaal is al begonnen!';
  if (date.getUTCFullYear() < 1950) return 'Die datum lijkt wel heel lang geleden.';
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
    toast('Opgeslagen. Elke dag telt nu ♡');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Wanneer begonnen we?"
      eyebrow="our date"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="start-date-form" className="btn btn--primary">
            Onze datum opslaan
          </button>
        </>
      }
    >
      <form id="start-date-form" className="form" onSubmit={save} noValidate>
        <p style={{ color: 'var(--ink-soft)' }}>
          De eerste date, de dag dat het officieel werd — welke dag voor ons ook als het begin
          voelt. Aanpassen kan altijd: met ✎ bij de teller op Home, of bij Instellingen.
        </p>
        <TextField
          label="Onze startdatum"
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
