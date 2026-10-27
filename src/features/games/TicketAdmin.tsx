import { useEffect, useMemo, useState } from 'react';
import { useContent } from '../../data/store';
import type { Person } from '../../data/types';
import { TextField } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { ticketBalance } from './tickets';
import {
  ADJUST_MAX,
  DEFAULT_RULES,
  LIMITS,
  adjustTickets,
  rulesAt,
  saveRules,
  ticketSettings,
  type TicketRules,
} from './ticketRules';

/*
 * His control panel for the arcade: what a game is worth, and tickets added or
 * taken away by hand. Only shown to him, and only his saves of it count — the
 * server keeps it as it was for anyone else.
 */

type Values = Omit<TicketRules, 'at'>;
type Key = keyof Values;

const FIELDS: { key: Key; label: string; hint?: string }[] = [
  { key: 'win', label: 'Winnen' },
  { key: 'draw', label: 'Gelijkspel' },
  { key: 'played', label: 'Verliezen', hint: 'wat je krijgt voor meedoen' },
  {
    key: 'long',
    label: 'Extra bij lange spellen',
    hint: 'Go Fish, Pannenkoekenslag, UNO, bowlen, bingo',
  },
  { key: 'quiz', label: 'Wie kent wie', hint: 'per antwoord' },
  { key: 'golden', label: 'Gouden Woensdag ×', hint: 'keer 1 tot 5' },
  { key: 'weekly', label: 'Weekuitdaging', hint: 'bonus voor allebei' },
];

const strip = ({ at: _at, ...v }: TicketRules): Values => v;

export function TicketAdmin() {
  const texts = useContent((c) => c.texts);
  const settings = useMemo(() => ticketSettings({ texts }), [texts]);
  const profile = useContent((c) => c.profile);
  const content = useContent((c) => c);
  const now = strip(rulesAt(settings, Date.now()));
  const [draft, setDraft] = useState<Record<Key, string>>(() => toDraft(now));
  const nowKey = JSON.stringify(now);

  useEffect(() => setDraft(toDraft(now)), [nowKey]);

  const parsed = {} as Values;
  const errors: Partial<Record<Key, string>> = {};
  for (const { key } of FIELDS) {
    const n = Number(draft[key]);
    const [lo, hi] = LIMITS[key];
    if (draft[key].trim() === '' || !Number.isInteger(n) || n < lo || n > hi)
      errors[key] = `Een heel getal van ${lo} tot ${hi}`;
    else parsed[key] = n;
  }
  const valid = Object.keys(errors).length === 0;
  const dirty = valid && JSON.stringify(parsed) !== nowKey;
  const isDefault = nowKey === JSON.stringify(strip(DEFAULT_RULES));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !dirty) return;
    saveRules(parsed);
    toast('Nieuwe ticketwaarden — ze tellen vanaf nu 🎟️');
  };

  const example = valid ? parsed.win + parsed.long : null;

  return (
    <div className="ticket-admin">
      <p className="settings-text">
        Alleen jij ziet dit en alleen jij kunt het veranderen. Nieuwe waarden tellen vanaf het
        moment dat je ze opslaat: tickets die al gewonnen zijn, blijven wat ze waren.
      </p>
      <form className="form" onSubmit={save} noValidate>
        <div className="ticket-admin__grid">
          {FIELDS.map(({ key, label, hint }) => (
            <TextField
              key={key}
              label={label}
              hint={hint}
              type="number"
              inputMode="numeric"
              min={LIMITS[key][0]}
              max={LIMITS[key][1]}
              value={draft[key]}
              onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
              error={errors[key]}
            />
          ))}
        </div>
        {example !== null && (
          <p className="settings-text ticket-admin__example">
            Zo is een gewonnen potje UNO <b>{example} 🎟️</b> waard, en op Gouden Woensdag{' '}
            <b>{example * parsed.golden} 🎟️</b>.
          </p>
        )}
        <div className="settings-actions">
          <button type="submit" className="btn btn--primary" disabled={!dirty}>
            Waarden opslaan
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={isDefault}
            onClick={async () => {
              const ok = await confirm({
                title: 'Terug naar de standaard?',
                message:
                  'Winnen 10, gelijk 6, verliezen 4, lange spellen +4, Wie kent wie 2, woensdag ×2, weekuitdaging 20.',
                confirmLabel: 'Ja, standaard',
              });
              if (!ok) return;
              saveRules(strip(DEFAULT_RULES));
              toast('Standaardwaarden terug');
            }}
          >
            Standaard
          </button>
        </div>
      </form>

      <h3 className="ticket-admin__sub">Tickets erbij of eraf</h3>
      <div className="ticket-admin__people">
        {(['you', 'partner'] as const).map((who) => (
          <Adjuster
            key={who}
            who={who}
            name={who === 'you' ? profile.yourName : profile.partnerName}
            balance={ticketBalance(content, who)}
            adjusted={settings.adjust[who]}
          />
        ))}
      </div>
    </div>
  );
}

function toDraft(v: Values): Record<Key, string> {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, String(v[key])])) as Record<Key, string>;
}

function Adjuster({
  who,
  name,
  balance,
  adjusted,
}: {
  who: Person;
  name: string;
  balance: number;
  adjusted: number;
}) {
  const [amount, setAmount] = useState('');
  const n = Number(amount);
  const ok = amount.trim() !== '' && Number.isInteger(n) && n > 0 && n <= ADJUST_MAX;
  const apply = (sign: 1 | -1) => {
    if (!ok) return;
    adjustTickets(who, sign * n);
    setAmount('');
    toast(`${sign > 0 ? '+' : '−'}${n} 🎟️ voor ${name}`);
  };
  return (
    <div className="ticket-admin__person">
      <p className="ticket-admin__balance">
        <strong>{name}</strong>
        <span>
          🎟️ {balance.toLocaleString('nl-NL')}
          {adjusted !== 0 && (
            <small>
              {' '}
              ({adjusted > 0 ? '+' : ''}
              {adjusted.toLocaleString('nl-NL')} met de hand)
            </small>
          )}
        </span>
      </p>
      <TextField
        label={`Aantal voor ${name}`}
        type="number"
        inputMode="numeric"
        min={1}
        max={ADJUST_MAX}
        value={amount}
        onChange={setAmount}
      />
      <div className="settings-actions">
        <button type="button" className="btn btn--primary" disabled={!ok} onClick={() => apply(1)}>
          Erbij
        </button>
        <button type="button" className="btn btn--ghost" disabled={!ok} onClick={() => apply(-1)}>
          Eraf
        </button>
      </div>
    </div>
  );
}
