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

/** Both our dates: the day we met, and the day we became a couple. */
export function StartDateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [met, setMet] = useState('');
  const [together, setTogether] = useState('');
  const [errors, setErrors] = useState<{ met?: string | null; together?: string | null }>({});

  useEffect(() => {
    if (open) {
      setMet(getContent().profile.startDate ?? '');
      setTogether(getContent().profile.togetherDate ?? '');
      setErrors({});
    }
  }, [open]);

  const check = (v: string) => (v ? validateStartDate(v) : null);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problems = { met: check(met), together: check(together) };
    if (!met && !together) problems.together = validateStartDate('');
    if (!problems.met && !problems.together && met && together && together < met)
      problems.together = 'Samen kwam na het leren kennen — klopt deze datum?';
    setErrors(problems);
    if (problems.met || problems.together) return;
    updateProfile({ startDate: met || null, togetherDate: together || null });
    toast('Opgeslagen. Elke dag telt nu ♡');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Onze datums"
      eyebrow="our dates"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="start-date-form" className="btn btn--primary">
            Opslaan
          </button>
        </>
      }
    >
      <form id="start-date-form" className="form" onSubmit={save} noValidate>
        <p style={{ color: 'var(--ink-soft)' }}>
          Twee dagen die bij ons horen: de dag dat we elkaar leerden kennen, en de dag dat we een
          relatie kregen. Het hart op Home telt vanaf welke je kiest. Aanpassen kan altijd: met ✎
          bij de teller, of bij Instellingen.
        </p>
        <TextField
          label="De dag dat we elkaar leerden kennen"
          type="date"
          optional
          value={met}
          max={todayIso()}
          onChange={(v) => {
            setMet(v);
            if (errors.met) setErrors((e) => ({ ...e, met: check(v) }));
          }}
          error={errors.met}
        />
        <TextField
          label="De dag dat we een relatie kregen"
          type="date"
          optional
          value={together}
          max={todayIso()}
          onChange={(v) => {
            setTogether(v);
            if (errors.together) setErrors((e) => ({ ...e, together: check(v) }));
          }}
          error={errors.together}
        />
      </form>
    </Dialog>
  );
}
