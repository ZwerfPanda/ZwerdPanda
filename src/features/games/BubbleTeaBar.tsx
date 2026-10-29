import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { Bunny } from '../pet/Bunny';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import { DUEL_LABELS, DuelPanel, useDuelRound } from './DuelPanel';
import { TicketStrip } from './TicketStrip';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { duelScores, planDuel } from './duel';
import {
  ORDER_WORDS,
  SHIFT_SECONDS,
  TEAS,
  TOPPINGS,
  binDrink,
  cocoShift,
  isReady,
  newShift,
  orderText,
  serve,
  setDrink,
  tick,
  type BarEvent,
  type BarState,
  type Customer,
  type Drink,
  type Level,
} from './boba';
import './boba.css';

/*
 * The Bubble Tea Bar: a shift behind the counter. Make the drink (tea,
 * topping, sugar, ice), then tap the customer it's for.
 */

const teaColor = (d: Drink) => TEAS.find((t) => t.id === d.tea)?.color;

const MISSING: Record<'tea' | 'topping' | 'sugar' | 'ice', string> = {
  tea: 'thee',
  topping: 'topping',
  sugar: 'suiker',
  ice: 'ijs',
};

/** The cup on the counter, filling up as you make it. */
function Cup({ drink, big = false }: { drink: Drink; big?: boolean }) {
  const reduce = useReducedMotion();
  const color = teaColor(drink);
  const ice = drink.ice === 'veel' ? 4 : drink.ice === 'weinig' ? 1 : 0;
  const drop = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { y: -60, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          transition: { type: 'spring' as const, damping: 12, delay },
        };
  return (
    <svg viewBox="0 0 120 160" className={`boba-cup ${big ? 'is-big' : ''}`} aria-hidden="true">
      <defs>
        <clipPath id={big ? 'boba-cup-big' : 'boba-cup-small'}>
          <path d="M24 40h72l-9 110H33z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${big ? 'boba-cup-big' : 'boba-cup-small'})`}>
        <rect x="0" y="36" width="120" height="124" fill="#fff8f0" opacity="0.35" />
        {color && (
          <motion.rect
            key={drink.tea}
            x="0"
            width="120"
            height="120"
            fill={color}
            initial={reduce ? false : { y: 160 }}
            animate={{ y: 52 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        )}
        {drink.sugar && (
          <motion.path
            key={drink.sugar}
            d="M30 70q30 14 60 0q-30 30 -60 18"
            fill="#fff"
            opacity={drink.sugar === 'veel' ? 0.55 : 0.25}
            {...drop(0)}
          />
        )}
        {drink.topping === 'tapioca' &&
          Array.from({ length: 14 }, (_, i) => (
            <motion.circle
              key={`t${i}`}
              cx={38 + ((i * 13) % 46)}
              cy={140 - Math.floor(i / 5) * 9}
              r="5"
              fill="#3a2418"
              {...drop((i % 5) * 0.04)}
            />
          ))}
        {drink.topping === 'popping' &&
          Array.from({ length: 12 }, (_, i) => (
            <motion.circle
              key={`p${i}`}
              cx={38 + ((i * 17) % 46)}
              cy={140 - Math.floor(i / 5) * 10}
              r="5.5"
              fill={['#ffb3c7', '#ffd75e', '#ff8cc0'][i % 3]}
              stroke="#fff"
              strokeWidth="1.2"
              {...drop((i % 5) * 0.04)}
            />
          ))}
        {drink.topping === 'lychee' &&
          Array.from({ length: 8 }, (_, i) => (
            <motion.rect
              key={`l${i}`}
              x={36 + ((i * 15) % 44)}
              y={128 - Math.floor(i / 4) * 12}
              width="9"
              height="9"
              rx="2"
              fill="#f3f7ea"
              opacity="0.85"
              transform={`rotate(${i * 23} ${40 + ((i * 15) % 44)} ${132 - Math.floor(i / 4) * 12})`}
              {...drop((i % 4) * 0.05)}
            />
          ))}
        {Array.from({ length: ice }, (_, i) => (
          <motion.rect
            key={`i${i}`}
            x={34 + i * 13}
            y={56 + (i % 2) * 7}
            width="15"
            height="14"
            rx="3"
            fill="#eaf8ff"
            stroke="#b8dff2"
            opacity="0.92"
            {...drop(i * 0.05)}
          />
        ))}
      </g>
      <path
        d="M24 40h72l-9 110H33z"
        fill="none"
        stroke="#3a2a3a"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <ellipse
        cx="60"
        cy="40"
        rx="37"
        ry="7"
        fill="#fffcf6"
        fillOpacity="0.6"
        stroke="#3a2a3a"
        strokeWidth="3"
      />
      {isReady(drink) && (
        <path d="M68 6l-7 128" stroke="#ff86bb" strokeWidth="9" strokeLinecap="round" />
      )}
    </svg>
  );
}

const CocoFace = memo(function CocoFace() {
  return (
    <svg viewBox="-95 -120 190 215" className="boba-guest__coco" aria-hidden="true">
      <Bunny pose="sit" shadow={false} />
    </svg>
  );
});

function Guest({
  c,
  now,
  vipName,
  ready,
  onServe,
  flash,
}: {
  c: Customer;
  now: number;
  vipName: string;
  ready: boolean;
  onServe: () => void;
  flash?: string;
}) {
  const left = Math.max(0, 1 - (now - c.arrived) / c.patience);
  const who = c.vip ? vipName : c.who === 'coco' ? 'Coco' : 'Klant';
  return (
    <motion.li
      layout
      className={`boba-guest ${c.vip ? 'is-vip' : ''} ${left < 0.3 ? 'is-cross' : ''}`}
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 30, opacity: 0 }}
    >
      <button
        type="button"
        className="boba-guest__btn"
        onClick={onServe}
        data-order={orderText(c.order)}
      >
        {!c.vip && <span className="visually-hidden">{who}: </span>}
        <span className="boba-guest__face" aria-hidden="true">
          {c.vip ? '💖' : c.who === 'coco' ? <CocoFace /> : c.who}
          <span className="boba-guest__mood">{left < 0.3 ? '😤' : left < 0.6 ? '🙂' : '😊'}</span>
        </span>
        {c.vip && (
          <span className="boba-guest__vip">
            {vipName} <span aria-hidden="true">👑</span>
          </span>
        )}
        <span className="boba-ticket">
          <span className="boba-ticket__tea">
            <i
              style={{ background: TEAS.find((t) => t.id === c.order.tea)!.color }}
              aria-hidden="true"
            />
            {ORDER_WORDS.tea(c.order.tea)}
          </span>
          <span>{ORDER_WORDS.topping(c.order.topping)}</span>
          <span>
            <span aria-hidden="true">🍬</span> {c.order.sugar}
            <span className="visually-hidden"> suiker,</span> · <span aria-hidden="true">🧊</span>{' '}
            {c.order.ice}
            <span className="visually-hidden"> ijs</span>
          </span>
        </span>
        <span className="boba-guest__patience" aria-hidden="true">
          <span style={{ transform: `scaleX(${left})` }} />
        </span>
        {ready && (
          <span className="boba-guest__give">
            Geef <span aria-hidden="true">▶</span>
          </span>
        )}
      </button>
      <AnimatePresence>
        {flash && (
          <motion.span
            className="boba-guest__flash"
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: -24, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {flash}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function Choice<T extends string>({
  label,
  options,
  value,
  onPick,
  disabled,
}: {
  label: string;
  options: { id: T; label: string; color?: string }[];
  value?: T;
  onPick: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="boba-row" role="group" aria-label={label}>
      <span className="boba-row__label">{label}</span>
      <div className="boba-row__opts">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`boba-opt ${value === o.id ? 'is-on' : ''}`}
            aria-pressed={value === o.id}
            disabled={disabled}
            onClick={() => onPick(o.id)}
          >
            {o.color && <i style={{ background: o.color }} aria-hidden="true" />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const LEVELS: { id: Level; label: string }[] = [
  { id: 'weinig', label: 'Weinig' },
  { id: 'veel', label: 'Veel' },
];

export function BubbleTeaBar() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const matches = useContent((c) => c.games.matches);
  const best = useBest('boba');
  const [mode, setMode] = useState<PlayMode>('remote');
  const duel = useDuelRound('boba', mode);
  const [bar, setBar] = useState<BarState>(newShift);
  const [phase, setPhase] = useState<'ready' | 'open' | 'done'>('ready');
  const [line, setLine] = useState(
    'Klaar voor je dienst? Maak de bestellingen en geef ze aan de juiste klant.',
  );
  const [flashes, setFlashes] = useState<Record<number, string>>({});
  const [tickets, setTickets] = useState<number | null>(null);
  const [cocoScore, setCocoScore] = useState<number | null>(null);
  const [handOver, setHandOver] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const barRef = useRef(bar);
  barRef.current = bar;
  const vipName = nameOf('partner', profile);

  const plan = mode === 'remote' && getAuthor() ? planDuel(matches, 'boba', me) : null;
  const target =
    mode === 'local' && duel.first !== null
      ? duel.first
      : plan?.type === 'answer'
        ? (duelScores(matches.find((m) => m.id === plan.id))[them] ?? null)
        : null;

  const flash = (id: number, text: string) => {
    setFlashes((f) => ({ ...f, [id]: text }));
    window.setTimeout(
      () =>
        setFlashes((f) => {
          const { [id]: _, ...rest } = f;
          return rest;
        }),
      1100,
    );
  };

  const react = (events: BarEvent[], before: BarState) => {
    for (const e of events) {
      if (e.type === 'arrive') {
        playSfx(e.vip ? 'sparkle' : 'chime', true);
        if (e.vip)
          setLine(
            me === 'partner'
              ? '💖 Een VIP… jijzelf! Je eigen bestelling, dubbele punten.'
              : `💖 ${vipName} komt binnen! Je weet wat ze wil… (dubbele punten)`,
          );
      } else if (e.type === 'leave') {
        const c = before.customers.find((x) => x.id === e.id);
        playSfx('whoosh', true);
        setLine(`${c?.vip ? vipName : 'Een klant'} heeft te lang gewacht en is weg 😤`);
      } else if (e.type === 'served') {
        playSfx('success', true);
        window.setTimeout(() => playSfx('coin', true), 160);
        flash(e.id, `+${e.points}${e.tip >= 7 ? ' ⚡' : ''}`);
        setLine(
          e.vip
            ? `Precies zoals ${vipName} hem wil ♡ +${e.points}`
            : e.combo >= 3
              ? `${e.combo} goed op rij! 🔥 +${e.points}`
              : `Lekker! +${e.points}${e.tip >= 7 ? ' (snel!)' : ''}`,
        );
      } else if (e.type === 'wrong') {
        playSfx('error', true);
        flash(e.id, '✗');
        setLine(`Oeps — de ${e.missing.map((m) => MISSING[m]).join(' en de ')} klopte niet`);
      } else if (e.type === 'end') {
        finish();
      }
    }
  };

  // The clock: customers come in and run out of patience.
  useEffect(() => {
    if (phase !== 'open') return;
    let last = performance.now();
    const t = window.setInterval(() => {
      const now = performance.now();
      const before = barRef.current;
      const out = tick(before, (now - last) / 1000);
      last = now;
      barRef.current = out.state;
      setBar(out.state);
      react(out.events, before);
    }, 100);
    return () => window.clearInterval(t);
  }, [phase]);

  const finish = () => {
    setPhase('done');
    const total = barRef.current.score;
    const how = `Dienst voorbij: ${barRef.current.served} drankjes`;
    if (mode !== 'coco') {
      const end = duel.finish(total);
      setLine(`${how} · ${end.text}`);
      setTickets(end.tickets);
      setHandOver(Boolean(end.handOver));
      if (end.tickets) celebrateFrom(stage.current);
      return;
    }
    if (getAuthor()) addScore('boba', total);
    const coco = cocoShift();
    setCocoScore(coco);
    addScore('boba', coco, 'coco');
    const winner = total > coco ? me : total < coco ? 'coco' : 'draw';
    recordResult('boba', [me, 'coco'], winner);
    playSfx(winner === me ? 'success' : 'coin', true);
    setLine(
      `${how} · ${
        winner === me
          ? `Jij wint! ${total} tegen ${coco} 🎉`
          : winner === 'coco'
            ? `Coco wint met ${coco} tegen ${total} 🐰🧋`
            : `Gelijk! ${total}–${coco}`
      }`,
    );
  };

  const pick = (part: Partial<Drink>) => {
    if (phase !== 'open') return;
    playSfx(part.topping ? 'drop' : part.ice ? 'clunk' : 'pop', true);
    setBar((b) => setDrink(b, part));
  };

  const give = (id: number) => {
    const b = barRef.current;
    if (phase !== 'open') return;
    if (!isReady(b.drink)) {
      const missing = (['tea', 'topping', 'sugar', 'ice'] as const).filter((k) => !b.drink[k]);
      setLine(`Nog niet klaar: kies nog ${missing.map((m) => MISSING[m]).join(', ')}`);
      playSfx('tap', true);
      return;
    }
    const out = serve(b, id);
    barRef.current = out.state;
    setBar(out.state);
    if (out.event) react([out.event], b);
  };

  const restart = (keepDuel = false) => {
    if (!keepDuel) duel.reset();
    const fresh = newShift();
    barRef.current = fresh;
    setBar(fresh);
    setTickets(null);
    setCocoScore(null);
    setHandOver(false);
    setFlashes({});
    setPhase('ready');
    setLine(
      keepDuel
        ? `Nu ${nameOf(duel.player, profile)} achter de bar!`
        : 'Klaar voor je dienst? Maak de bestellingen en geef ze aan de juiste klant.',
    );
  };

  const left = Math.ceil(SHIFT_SECONDS - bar.t);
  const ready = isReady(bar.drink);
  const open = phase === 'open';

  return (
    <GameShell
      id="boba"
      title="Bubble Tea Bar"
      mode={mode}
      onMode={(m) => {
        setMode(m);
        restart();
      }}
      modes={['remote', 'local', 'coco']}
      labels={DUEL_LABELS}
      score={
        <ScoreBoard
          label="records"
          entries={[
            { name: profile.yourName.toUpperCase(), value: best.you ?? '---', me: me === 'you' },
            {
              name: profile.partnerName.toUpperCase(),
              value: best.partner ?? '---',
              me: me === 'partner',
            },
            { name: 'COCO', value: best.coco ?? '---' },
          ]}
        />
      }
    >
      <DuelPanel kind="boba" mode={mode} first={duel.first} result={duel.result} />
      <div className="skee-status">
        <span className="skee-digits" aria-label={`Score ${bar.score}`}>
          {String(bar.score).padStart(3, '0')}
        </span>
        <span className="boba-clock" aria-label={`${left} seconden over`}>
          <span className="boba-clock__bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${left / SHIFT_SECONDS})` }} />
          </span>
          ⏱ {left}s{bar.combo >= 2 ? ` · 🔥 ${bar.combo}` : ''}
        </span>
        {cocoScore !== null && (
          <span className="skee-digits skee-digits--coco" aria-label={`Coco ${cocoScore}`}>
            🐰 {String(cocoScore).padStart(3, '0')}
          </span>
        )}
      </div>
      {target !== null && phase !== 'done' && (
        <p className={`hop-target ${bar.score > target ? 'is-passed' : ''}`}>
          {bar.score > target ? '✨ ' : '🎯 '}Te verslaan: <strong>{target}</strong> van{' '}
          {nameOf(mode === 'local' ? me : them, profile)}
        </p>
      )}
      <p className="game-turn is-mine" aria-live="polite">
        {line}
      </p>

      <div className="boba" ref={stage}>
        <div className="boba__sign" aria-hidden="true">
          🧋 Bubble Tea Bar <span>open</span>
        </div>
        <ul className="boba__counter" aria-label="Klanten aan de toonbank">
          <AnimatePresence>
            {bar.customers.map((c) => (
              <Guest
                key={c.id}
                c={c}
                now={bar.t}
                vipName={vipName}
                ready={ready}
                onServe={() => give(c.id)}
                flash={flashes[c.id]}
              />
            ))}
          </AnimatePresence>
          {open && bar.customers.length === 0 && <li className="boba__empty">Even rustig…</li>}
        </ul>
        {Object.entries(flashes)
          .filter(([id]) => !bar.customers.some((c) => c.id === Number(id)))
          .map(([id, text]) => (
            <span key={id} className="boba__served">
              {text}
            </span>
          ))}
        <div className="boba__work">
          <Cup drink={bar.drink} big />
          <div className="boba__made" aria-live="polite">
            {bar.drink.tea ? ORDER_WORDS.tea(bar.drink.tea) : 'Lege beker'}
            {bar.drink.topping && ` · ${ORDER_WORDS.topping(bar.drink.topping)}`}
            {bar.drink.sugar && ` · ${bar.drink.sugar} suiker`}
            {bar.drink.ice && ` · ${bar.drink.ice} ijs`}
            {ready && <strong> — tik op de klant!</strong>}
          </div>
        </div>
        <div className="boba__controls">
          <Choice
            label="Thee"
            options={TEAS}
            value={bar.drink.tea}
            onPick={(tea) => pick({ tea })}
            disabled={!open}
          />
          <Choice
            label="Topping"
            options={TOPPINGS}
            value={bar.drink.topping}
            onPick={(topping) => pick({ topping })}
            disabled={!open}
          />
          <Choice
            label="Suiker"
            options={LEVELS}
            value={bar.drink.sugar}
            onPick={(sugar) => pick({ sugar })}
            disabled={!open}
          />
          <Choice
            label="IJs"
            options={LEVELS}
            value={bar.drink.ice}
            onPick={(ice) => pick({ ice })}
            disabled={!open}
          />
          <button
            type="button"
            className="boba-bin"
            disabled={!open || !Object.keys(bar.drink).length}
            onClick={() => {
              playSfx('splat', true);
              setBar((b) => binDrink(b));
            }}
          >
            <Trash2 aria-hidden="true" /> Weggooien
          </button>
        </div>
        {phase === 'ready' && (
          <div className="boba__start">
            <button
              type="button"
              className="neon-btn"
              onClick={() => {
                setPhase('open');
                playSfx('open', true);
                stage.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                setLine(
                  'De bar is open! Kies de thee, topping, suiker en ijs, en tik dan op de klant.',
                );
              }}
            >
              Open de bar ▶
            </button>
          </div>
        )}
        <TicketStrip tickets={tickets} />
      </div>

      <p className="game-hint">
        Goed en snel geeft fooi, drie goed op rij geeft extra. Komt {vipName} langs, dan weet je
        het: jasmijn, tapioca, veel suiker, weinig ijs — dubbele punten.
      </p>
      {phase === 'done' &&
        (handOver ? (
          <button type="button" className="neon-btn" onClick={() => restart(true)}>
            Nu {nameOf(duel.player, profile)} ▶
          </button>
        ) : (
          <button type="button" className="neon-btn" onClick={() => restart()}>
            Nog een dienst 🧋
          </button>
        ))}
    </GameShell>
  );
}
