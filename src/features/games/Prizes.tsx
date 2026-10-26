import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useContent } from '../../data/store';
import { getAuthor, otherPerson, sweetName, useMe } from '../../data/people';
import type { Coupon } from '../../data/types';
import { patchItem, removeItem, upsertItem } from '../../data/actions';
import { celebrateFrom, confirm, toast } from '../../components/ui/feedback';
import { createId, nowIso } from '../../lib/id';
import { formatTimestamp } from '../../lib/dates';
import { playSfx } from '../../lib/audio/sfx';
import { GameShell, ScoreBoard, WhoAreYou } from './GameShell';
import { ticketBalance, ticketsEarned } from './tickets';
import { timesWord, useGoldenFactor } from './GoldenDay';
import { useIsOwner } from '../texts/TextEditor';
import { href } from '../../lib/router';

/** Ideas to tap — what goes on a coupon is entirely up to whoever makes it. */
const SUGGESTIONS: { emoji: string; title: string }[] = [
  { emoji: '🧋', title: '1× bubble tea op mijn kosten' },
  { emoji: '🍝', title: 'Ik kook vanavond' },
  { emoji: '🎬', title: 'Jij kiest de film' },
  { emoji: '💆', title: '15 minuten massage' },
  { emoji: '🥞', title: 'Ontbijt op bed' },
  { emoji: '🎤', title: 'Karaoke-avond, jij kiest de liedjes' },
  { emoji: '💐', title: 'Een bosje bloemen' },
  { emoji: '🎟️', title: 'Een date naar keuze' },
];

const EMOJIS = ['🎟️', '🧋', '🍵', '💐', '🍝', '🎬', '💆', '🥞', '🎤', '🛍️', '🍫', '💋'];

/** The prize counter: coupons we make for each other, won with arcade tickets. */
export function Prizes() {
  return (
    <GameShell id="prizes" title="Prijzenkast">
      <WhoAreYou>
        <Counter />
      </WhoAreYou>
    </GameShell>
  );
}

function Counter() {
  const content = useContent((c) => c);
  const golden = useGoldenFactor();
  const owner = useIsOwner();
  const me = useMe();
  const them = otherPerson(me);
  const theirName = sweetName(them, me, content.us.petNames, content.profile);
  const mine = ticketBalance(content, me);
  const theirs = ticketBalance(content, them);
  const coupons = content.coupons;
  const forMe = coupons.filter((c) => c.from === them);
  const onShelf = forMe.filter((c) => !c.wonAt);
  const won = forMe.filter((c) => c.wonAt).sort((a, b) => (a.wonAt! < b.wonAt! ? 1 : -1));
  const made = coupons.filter((c) => c.from === me);

  const win = (c: Coupon, el: HTMLElement) => {
    if (mine < c.price) return;
    patchItem('coupons', c.id, { wonAt: nowIso() });
    playSfx('success', true);
    celebrateFrom(el);
    toast(`Gewonnen: ${c.title} ${c.emoji}`);
  };

  return (
    <>
      <ScoreBoard
        label="tickets"
        entries={[
          { name: 'JIJ', value: mine, me: true },
          { name: theirName.toUpperCase(), value: theirs },
        ]}
      />
      <p className="game-hint">
        Je verdient tickets door potjes tegen elkaar te spelen, elk op je eigen telefoon (📱↔📱
        Samen) — winnen geeft meer. Potjes tegen Coco of op één telefoon tellen niet mee. Op Gouden
        Woensdag tellen alle tickets {timesWord(golden)} ✨ Totaal verdiend:{' '}
        {ticketsEarned(content, me)} 🎟️
        {owner && (
          <>
            {' '}
            <a href={href('/settings')}>Ticketwaarden aanpassen →</a>
          </>
        )}
      </p>

      <section className="prize-section" aria-labelledby="prize-shelf">
        <h2 id="prize-shelf" className="prize-section__title">
          In de kast · van {theirName}
        </h2>
        {onShelf.length === 0 ? (
          <p className="game-hint">
            {theirName} heeft nog geen bonnen in de kast gezet. Vraag maar lief 😇
          </p>
        ) : (
          <ul className="prize-grid">
            {onShelf.map((c) => {
              const short = c.price - mine;
              return (
                <li key={c.id} className="prize">
                  <span className="prize__emoji" aria-hidden="true">
                    {c.emoji}
                  </span>
                  <strong className="prize__title">{c.title}</strong>
                  <span className="prize__price">🎟️ {c.price}</span>
                  <button
                    type="button"
                    className="neon-btn neon-btn--small"
                    disabled={short > 0}
                    onClick={(e) => win(c, e.currentTarget)}
                  >
                    {short > 0 ? `Nog ${short} tickets` : 'Winnen!'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {won.length > 0 && (
        <section className="prize-section" aria-labelledby="prize-won">
          <h2 id="prize-won" className="prize-section__title">
            Mijn prijzen
          </h2>
          <ul className="prize-list">
            {won.map((c) => (
              <li key={c.id} className={`prize-ticket ${c.usedAt ? 'is-used' : ''}`}>
                <span aria-hidden="true">{c.emoji}</span>
                <span>
                  <strong>{c.title}</strong>
                  <small>
                    {c.usedAt
                      ? `Ingewisseld ${formatTimestamp(c.usedAt)}`
                      : `Gewonnen ${formatTimestamp(c.wonAt!)}`}
                  </small>
                </span>
                {!c.usedAt && (
                  <button
                    type="button"
                    className="neon-btn neon-btn--small"
                    onClick={() => {
                      patchItem('coupons', c.id, { usedAt: nowIso() });
                      playSfx('chime', true);
                      toast(`${theirName} ziet dat je je bon wilt inwisselen 💌`);
                    }}
                  >
                    Inwisselen
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="prize-section" aria-labelledby="prize-made">
        <h2 id="prize-made" className="prize-section__title">
          Bonnen die ik maak voor {theirName}
        </h2>
        <NewCoupon />
        {made.length > 0 && (
          <ul className="prize-list">
            {made.map((c) => (
              <li key={c.id} className={`prize-ticket ${c.usedAt ? 'is-used' : ''}`}>
                <span aria-hidden="true">{c.emoji}</span>
                <span>
                  <strong>{c.title}</strong>
                  <small>
                    {c.usedAt
                      ? `${theirName} wisselde hem in ${formatTimestamp(c.usedAt)} — tijd om hem waar te maken 💌`
                      : c.wonAt
                        ? `${theirName} won hem ${formatTimestamp(c.wonAt)}`
                        : `In de kast · 🎟️ ${c.price}`}
                  </small>
                </span>
                {!c.wonAt && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`“${c.title}” uit de kast halen`}
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Deze bon uit de kast halen?',
                        message: c.title,
                        confirmLabel: 'Weghalen',
                        tone: 'danger',
                      });
                      if (ok) removeItem('coupons', c.id);
                    }}
                  >
                    <Trash2 />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function NewCoupon() {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎟️');
  const [price, setPrice] = useState(60);
  const [open, setOpen] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const from = getAuthor();
    if (!title.trim() || !from) return;
    upsertItem('coupons', {
      id: createId('coupon'),
      title: title.trim(),
      emoji,
      price,
      from,
      createdAt: nowIso(),
    });
    playSfx('coin', true);
    toast('In de prijzenkast gezet 🎟️');
    setTitle('');
    setOpen(false);
  };

  if (!open)
    return (
      <button type="button" className="neon-btn" onClick={() => setOpen(true)}>
        + Nieuwe bon maken
      </button>
    );

  return (
    <AnimatePresence>
      <motion.form
        className="game-panel prize-form"
        onSubmit={save}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="prize-form__suggest" role="group" aria-label="Ideetjes">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              type="button"
              className="chip"
              onClick={() => {
                setTitle(s.title);
                setEmoji(s.emoji);
              }}
            >
              {s.emoji} {s.title}
            </button>
          ))}
        </div>
        <label>
          Wat staat er op de bon?
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Iets liefs dat je echt gaat doen"
          />
        </label>
        <div className="prize-form__emoji" role="radiogroup" aria-label="Plaatje">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={emoji === e}
              aria-label={e}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
        <label>
          Prijs: 🎟️ {price.toLocaleString('nl-NL')} tickets
          <input
            type="range"
            min={10}
            max={10000}
            step={10}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </label>
        <div className="prize-form__price">
          <div className="prize-form__quick" role="group" aria-label="Snel kiezen">
            {[50, 100, 500, 1000, 5000, 10000].map((v) => (
              <button
                key={v}
                type="button"
                className="chip"
                aria-pressed={price === v}
                onClick={() => setPrice(v)}
              >
                {v.toLocaleString('nl-NL')}
              </button>
            ))}
          </div>
          <label className="prize-form__exact">
            Precies
            <input
              type="number"
              min={1}
              max={10000}
              step={1}
              value={price}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                setPrice(Math.max(1, Math.min(10000, Number.isFinite(n) ? n : 1)));
              }}
            />
          </label>
        </div>
        <div className="game-actions">
          <button type="button" className="neon-btn neon-btn--small" onClick={() => setOpen(false)}>
            Annuleren
          </button>
          <button type="submit" className="neon-btn" disabled={!title.trim()}>
            In de kast zetten
          </button>
        </div>
      </motion.form>
    </AnimatePresence>
  );
}
