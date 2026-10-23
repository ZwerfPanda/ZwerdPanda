import { useState } from 'react';
import { motion } from 'framer-motion';
import { Ticket } from 'lucide-react';
import { useContent } from '../../data/store';
import type { MuseumStop } from '../../data/types';
import { formatDate, todayIso } from '../../lib/dates';
import { hashUnit } from '../../lib/id';
import { useReducedMotion } from '../../hooks/useMotion';
import { Dialog } from '../../components/ui/Dialog';
import { STOP_THEMES } from './themes';

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000);

/** A little barcode, the same for the same stop every time. */
function Barcode({ seed }: { seed: string }) {
  const bars = Array.from({ length: 34 }, (_, i) => 1 + Math.floor(hashUnit(`${seed}-${i}`) * 3));
  let x = 0;
  return (
    <svg className="ticket__barcode" viewBox="0 0 120 26" aria-hidden="true">
      {bars.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y="0" width={w} height="26" /> : null;
        x += w + 0.6;
        return rect;
      })}
    </svg>
  );
}

/** An NS-style ticket for one stop on our line: a souvenir to keep. */
export function StopTicket({
  stop,
  from,
  stamp = false,
}: {
  stop: MuseumStop;
  from: MuseumStop | null;
  stamp?: boolean;
}) {
  const reduce = useReducedMotion();
  const you = useContent((c) => c.profile.yourName);
  const partner = useContent((c) => c.profile.partnerName);
  const theme = STOP_THEMES[stop.theme];
  const when = stop.date ? formatDate(stop.date, 'short') : (stop.when ?? '—');
  return (
    <div className={`ticket ${stop.upcoming ? 'ticket--ahead' : ''}`}>
      <div className="ticket__head">
        <span className="ticket__ns">NS</span>
        <span>Love Line · {stop.upcoming ? 'reservering' : 'enkele reis'}</span>
        <span className="ticket__class">1♡</span>
      </div>
      <div className="ticket__route">
        <div>
          <small>van</small>
          <strong>{from?.name ?? 'Een livestream'}</strong>
        </div>
        <span className="ticket__arrow" aria-hidden="true">
          →
        </span>
        <div>
          <small>naar</small>
          <strong>
            {theme.emoji} {stop.name}
          </strong>
        </div>
      </div>
      <dl className="ticket__meta">
        <div>
          <dt>datum</dt>
          <dd>{when}</dd>
        </div>
        <div>
          <dt>reizigers</dt>
          <dd>
            {you} &amp; {partner}
          </dd>
        </div>
        <div>
          <dt>retour</dt>
          <dd>nooit nodig</dd>
        </div>
      </dl>
      <Barcode seed={stop.id} />
      {!stop.upcoming && (
        <motion.span
          className="ticket__stamp"
          aria-hidden="true"
          initial={stamp && !reduce ? { scale: 2.4, opacity: 0, rotate: -40 } : false}
          animate={{ scale: 1, opacity: 1, rotate: -14 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 14 }}
        >
          gestempeld ♡
        </motion.span>
      )}
    </div>
  );
}

/** All our tickets together, in a little wallet. */
export function TicketWallet({ stops }: { stops: MuseumStop[] }) {
  const [open, setOpen] = useState(false);
  const been = stops.filter((s) => !s.upcoming);
  if (!been.length) return null;
  return (
    <>
      <button type="button" className="btn btn--soft museum-wallet" onClick={() => setOpen(true)}>
        <Ticket aria-hidden="true" /> Kaartjesmapje · {been.length}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Ons kaartjesmapje"
        eyebrow="the love line"
        size="md"
      >
        <ul className="ticket-wallet">
          {been.map((s, i) => (
            <li key={s.id}>
              <StopTicket stop={s} from={been[i - 1] ?? null} />
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

/**
 * The next stop we've planned, counting down: a little train rolls along the
 * track as the day comes closer.
 */
export function NextStopCountdown({
  stops,
  onGo,
}: {
  stops: MuseumStop[];
  onGo: (stop: MuseumStop) => void;
}) {
  const today = todayIso();
  const next = stops
    .filter((s) => s.upcoming && s.date && s.date >= today)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];
  if (!next?.date) return null;
  const left = dayDiff(today, next.date);
  // From the last stop we've been to (or when we planned it) to the day itself.
  const lastBeen = stops
    .filter((s) => !s.upcoming && s.date && s.date <= today)
    .map((s) => s.date!)
    .sort()
    .at(-1);
  const startedAt = lastBeen ?? next.createdAt.slice(0, 10);
  const total = Math.max(1, dayDiff(startedAt, next.date));
  const progress = Math.min(1, Math.max(0.04, 1 - left / total));
  const theme = STOP_THEMES[next.theme];
  return (
    <button type="button" className="next-stop" onClick={() => onGo(next)}>
      <span className="next-stop__eyebrow">volgende halte</span>
      <strong className="next-stop__name">
        {theme.emoji} {next.name}
      </strong>
      <span className="next-stop__left">
        {left === 0 ? 'Vandaag! 🎉' : left === 1 ? 'nog 1 nachtje' : `nog ${left} dagen`}
      </span>
      <span className="next-stop__track" aria-hidden="true">
        <span className="next-stop__rail" />
        <span className="next-stop__train" style={{ left: `${progress * 100}%` }}>
          🚆
        </span>
        <span className="next-stop__flag">{theme.emoji}</span>
      </span>
      <span className="visually-hidden">{Math.round(progress * 100)}% van de reis</span>
    </button>
  );
}
