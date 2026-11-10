import { useEffect, useRef, useState } from 'react';
import { Eraser, Send, Trash2, Undo2 } from 'lucide-react';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { startMatch, updateMatch, useMatch } from './gameData';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';
import {
  CANVAS,
  COLORS,
  MAX_POINTS,
  ROUNDS,
  SIZES,
  TRIES,
  actor,
  choose,
  finishDrawing,
  guess,
  hint,
  newDraw,
  nextRound,
  normalizeDraw,
  pack,
  pointCount,
  unpack,
  winnerOf,
  type DrawState,
  type Side,
  type Stroke,
} from './drawGuess';
import './drawGuess.css';

const LEVEL = ['', 'makkelijk', 'middel', 'moeilijk'];
const COLOR_NAMES = ['zwart', 'roze', 'geel', 'blauw', 'groen', 'rood', 'bruin', 'gum'];

function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], upTo = Infinity) {
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(0, 0, CANVAS, CANVAS);
  let left = upTo;
  for (const s of strokes) {
    if (left <= 0) break;
    const pts = unpack(s.p).slice(0, Math.max(1, left));
    left -= pts.length;
    ctx.strokeStyle = COLORS[s.c];
    ctx.fillStyle = COLORS[s.c];
    ctx.lineWidth = SIZES[s.w];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, SIZES[s.w] / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
}

function useCanvas(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = CANVAS * dpr;
    el.height = CANVAS * dpr;
    el.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);
}

/** Drawing: palette, brush sizes, undo, wipe — and then send it. */
function Easel({ word, onDone }: { word: string; onDone: (strokes: Stroke[]) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(0);
  const [size, setSize] = useState(1);
  const live = useRef<{ x: number; y: number }[] | null>(null);
  useCanvas(canvas);
  const used = pointCount(strokes);
  const full = used >= MAX_POINTS;

  const redraw = (list: Stroke[], extra?: Stroke) => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) paintStrokes(ctx, extra ? [...list, extra] : list);
  };
  useEffect(() => redraw(strokes), [strokes]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(CANVAS, ((e.clientX - r.left) / r.width) * CANVAS)),
      y: Math.max(0, Math.min(CANVAS, ((e.clientY - r.top) / r.height) * CANVAS)),
    };
  };
  const current = () => ({ c: color, w: size, p: pack(live.current ?? []) });

  return (
    <div className="dg-easel">
      <p className="dg-word">
        Teken: <strong>{word}</strong>
      </p>
      <div className="dg-canvas-wrap">
        <canvas
          ref={canvas}
          className="dg-canvas is-drawing"
          aria-label={`Tekenvel: teken ${word}`}
          role="img"
          onPointerDown={(e) => {
            if (full) return;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            live.current = [pos(e)];
            redraw(strokes, current());
          }}
          onPointerMove={(e) => {
            if (!live.current) return;
            const p = pos(e);
            const last = live.current[live.current.length - 1];
            if (Math.hypot(p.x - last.x, p.y - last.y) < 2.5) return;
            if (used + live.current.length >= MAX_POINTS) return;
            live.current.push(p);
            redraw(strokes, current());
          }}
          onPointerUp={() => {
            if (!live.current) return;
            const s = current();
            live.current = null;
            setStrokes((list) => [...list, s]);
          }}
          onPointerCancel={() => {
            live.current = null;
            redraw(strokes);
          }}
        />
      </div>
      <div className="dg-palette" role="radiogroup" aria-label="Kleur">
        {COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === i}
            aria-label={COLOR_NAMES[i]}
            className={`dg-paint${color === i ? ' is-on' : ''}${i === COLORS.length - 1 ? ' is-eraser' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(i)}
          >
            {i === COLORS.length - 1 && <Eraser aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="dg-tools">
        <div className="dg-sizes" role="radiogroup" aria-label="Kwast">
          {SIZES.map((w, i) => (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={size === i}
              aria-label={['Dun', 'Midden', 'Dik'][i]}
              className={size === i ? 'is-on' : ''}
              onClick={() => setSize(i)}
            >
              <span style={{ width: w + 4, height: w + 4 }} />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="dg-tool"
          onClick={() => setStrokes((l) => l.slice(0, -1))}
          disabled={!strokes.length}
          aria-label="Ongedaan maken"
        >
          <Undo2 aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dg-tool"
          onClick={() => setStrokes([])}
          disabled={!strokes.length}
          aria-label="Alles wissen"
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>
      {full && <p className="dg-note">Je vel is vol — stuur hem maar op!</p>}
      <button
        type="button"
        className="dg-send"
        disabled={!strokes.length}
        onClick={() => {
          playSfx('whoosh', true);
          onDone(strokes);
        }}
      >
        <Send aria-hidden="true" /> Klaar — laat raden!
      </button>
    </div>
  );
}

/** The drawing appears stroke by stroke, like it was made. */
function Replay({ strokes, label }: { strokes: Stroke[]; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const [again, setAgain] = useState(0);
  useCanvas(canvas);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const total = pointCount(strokes);
    if (reduce || total === 0) {
      paintStrokes(ctx, strokes);
      return;
    }
    const ms = Math.min(6000, Math.max(1800, total * 6));
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      paintStrokes(ctx, strokes, Math.ceil(total * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [strokes, again]);
  return (
    <div className="dg-canvas-wrap">
      <canvas ref={canvas} className="dg-canvas" role="img" aria-label={label} />
      <button type="button" className="dg-replay" onClick={() => setAgain((n) => n + 1)}>
        ↻ Nog eens
      </button>
    </div>
  );
}

function GuessBox({ state, onGuess }: { state: DrawState; onGuess: (text: string) => void }) {
  const [text, setText] = useState('');
  const wrong = state.guesses.length;
  return (
    <form
      className="dg-guess"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onGuess(text);
        setText('');
      }}
    >
      {wrong > 0 && (
        <p className="dg-hint">
          Fout: {state.guesses.map((g) => `“${g}”`).join(', ')}
          <br />
          Hint: <span className="dg-hint__letters">{hint(state.word, wrong)}</span>
        </p>
      )}
      <div className="dg-guess__row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Wat is het?"
          aria-label="Jouw gok"
          maxLength={40}
          autoComplete="off"
          enterKeyHint="send"
        />
        <button type="submit" className="dg-send dg-send--small" disabled={!text.trim()}>
          Raad
        </button>
      </div>
      <p className="dg-tries">
        Nog {TRIES - wrong} {TRIES - wrong === 1 ? 'poging' : 'pogingen'} · {TRIES - wrong} punt
        {TRIES - wrong === 1 ? '' : 'en'} als je hem nu raadt
      </p>
    </form>
  );
}

function Points({ state, names }: { state: DrawState; names: Record<Side, string> }) {
  return (
    <div className="dg-points">
      <span className="dg-points__side is-yellow">
        <small>{names.you}</small>
        <strong>{state.points.you}</strong>
      </span>
      <span className="dg-round">
        Ronde {state.round}/{ROUNDS}
      </span>
      <span className="dg-points__side is-pink">
        <small>{names.partner}</small>
        <strong>{state.points.partner}</strong>
      </span>
    </div>
  );
}

/** What the screen shows for one step of the game, from `me`'s side. */
function Stage({
  state,
  me,
  names,
  onChange,
  local,
}: {
  state: DrawState;
  me: Side | null;
  names: Record<Side, string>;
  onChange: (next: DrawState, extra?: { right?: boolean }) => void;
  /** One phone: show a "hand it over" screen before secrets. */
  local: boolean;
}) {
  const [shownFor, setShownFor] = useState<string>('');
  const who = actor(state);
  const key = `${state.round}-${state.status}`;
  const itsMe = me === null || me === who;
  const guesser = state.drawer === 'you' ? 'partner' : 'you';

  // On one phone, the secret parts wait until the right one says it's them.
  const needsHandOver =
    local && (state.status === 'choose' || state.status === 'guess') && shownFor !== key;
  if (needsHandOver)
    return (
      <div className="dg-handover">
        <p>
          {state.status === 'choose' ? '🎨' : '🔍'} Geef de telefoon aan{' '}
          <strong>{names[who]}</strong>
          {state.status === 'choose' ? ' — die gaat tekenen. Niet spieken!' : ' — die mag raden.'}
        </p>
        <button type="button" className="dg-send" onClick={() => setShownFor(key)}>
          Ik ben {names[who]} ▶
        </button>
      </div>
    );

  if (state.status === 'choose')
    return itsMe ? (
      <div className="dg-choose">
        <p>Kies wat je gaat tekenen:</p>
        <div className="dg-options">
          {state.options.map((w, i) => (
            <button
              key={w}
              type="button"
              className={`dg-option is-l${i + 1}`}
              onClick={() => onChange(choose(state, w))}
            >
              <strong>{w}</strong>
              <small>
                {LEVEL[i + 1]} · {i + 1} pt
              </small>
            </button>
          ))}
        </div>
      </div>
    ) : (
      <p className="dg-wait">🎨 {names[state.drawer]} kiest een woord…</p>
    );

  if (state.status === 'draw')
    return itsMe ? (
      <Easel word={state.word} onDone={(strokes) => onChange(finishDrawing(state, strokes))} />
    ) : (
      <p className="dg-wait">🖌️ {names[state.drawer]} is aan het tekenen…</p>
    );

  if (state.status === 'guess')
    return (
      <div className="dg-guessing">
        <Replay strokes={state.strokes} label={`Tekening van ${names[state.drawer]}`} />
        {itsMe ? (
          <GuessBox
            state={state}
            onGuess={(text) => {
              const out = guess(state, text);
              playSfx(out.right ? 'success' : out.over ? 'boing' : 'error', true);
              onChange(out.state, { right: out.right });
            }}
          />
        ) : (
          <p className="dg-wait">
            🔍 {names[guesser]} raadt…{' '}
            {state.guesses.length
              ? `(gokte: ${state.guesses.map((g) => `“${g}”`).join(', ')})`
              : ''}
          </p>
        )}
      </div>
    );

  if (state.status === 'reveal' && state.result)
    return (
      <div className="dg-reveal">
        <Replay strokes={state.strokes} label={`De tekening: ${state.result.word}`} />
        <p className={`dg-result${state.result.guessed ? ' is-right' : ''}`}>
          {state.result.guessed
            ? `✅ ${names[state.result.by]} raadde “${state.result.word}” in ${state.result.tries === 1 ? 'één keer' : `${state.result.tries} keer`}!`
            : `😅 Het was “${state.result.word}”`}
        </p>
        {itsMe ? (
          <button type="button" className="dg-send" onClick={() => onChange(nextRound(state, []))}>
            {state.round >= ROUNDS
              ? 'Naar de uitslag 🏆'
              : `Volgende ronde — ${names[who]} tekent ▶`}
          </button>
        ) : (
          <p className="dg-wait">Wachten tot {names[who]} verder gaat…</p>
        )}
      </div>
    );

  return null;
}

function LocalGame() {
  const profile = useContent((c) => c.profile);
  const names: Record<Side, string> = { you: profile.yourName, partner: profile.partnerName };
  const [state, setState] = useState<DrawState>(() => newDraw('you'));
  const w = winnerOf(state);
  useEffect(() => {
    if (!w) return;
    recordResult('draw', ['you', 'partner'], w);
    playSfx('success', true);
    celebrateFrom(document.querySelector('.dg-points'));
  }, [w]);
  return (
    <>
      <Points state={state} names={names} />
      {w ? (
        <p className="game-turn game-turn--done">
          {w === 'draw'
            ? `Gelijkspel! ${state.points.you}–${state.points.partner} 🎨`
            : `${names[w]} wint ${state.points[w]}–${state.points[w === 'you' ? 'partner' : 'you']}! 🎨🏆`}
        </p>
      ) : (
        <Stage state={state} me={null} names={names} onChange={setState} local />
      )}
      <button
        type="button"
        className="neon-btn"
        onClick={() => setState(newDraw(Math.random() < 0.5 ? 'you' : 'partner'))}
      >
        Nieuw spel
      </button>
    </>
  );
}

function RemoteGame() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const names: Record<Side, string> = { you: profile.yourName, partner: profile.partnerName };
  const match = useMatch('draw');
  const state = normalizeDraw(match?.state);

  const start = () => startMatch('draw', { ...newDraw(me) }, me, me);
  if (!match)
    return (
      <div className="game-panel">
        <p>
          Start een spel van {ROUNDS} rondes — jij tekent als eerste, {nameOf(them, profile)} raadt.
        </p>
        <button type="button" className="neon-btn" onClick={start}>
          Nieuw spel
        </button>
      </div>
    );

  const w = winnerOf(state);
  return (
    <>
      <Points state={state} names={names} />
      {match.winner || w ? (
        <p className="game-turn game-turn--done">
          {match.winner === 'draw' || w === 'draw'
            ? `Gelijkspel! ${state.points.you}–${state.points.partner} 🎨`
            : (match.winner ?? w) === me
              ? `Jij wint ${state.points[me]}–${state.points[them]}! 🎨🏆`
              : `${nameOf((match.winner ?? w) as Person, profile)} wint ${state.points[them]}–${state.points[me]} 💕`}
        </p>
      ) : (
        <>
          <TurnBanner
            mine={match.turn === me}
            name={nameOf(them, profile)}
            note={match.turn === me ? 'Jij bent 🎨' : undefined}
          />
          <Stage
            state={state}
            me={me}
            names={names}
            local={false}
            onChange={(next) => {
              const done = winnerOf(next);
              if (done && done === me) celebrateFrom(document.querySelector('.dg-points'));
              updateMatch(match.id, (m) => ({
                ...m,
                state: { ...next },
                turn: done ? undefined : actor(next),
                winner: done ?? undefined,
              }));
            }}
          />
        </>
      )}
      {(match.winner || w) && (
        <button type="button" className="neon-btn" onClick={start}>
          Nog een spel
        </button>
      )}
    </>
  );
}

export function DrawGuess() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const results = useContent((c) => c.games);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const h = headToHead(results, 'draw', 'you', 'partner');
  return (
    <GameShell
      id="draw"
      title="Tekenen & raden"
      mode={mode}
      onMode={setMode}
      modes={['remote', 'local']}
      score={
        <ScoreBoard
          label="gewonnen"
          entries={[
            { name: profile.yourName.toUpperCase(), value: h.a, me: me === 'you' },
            { name: profile.partnerName.toUpperCase(), value: h.b, me: me === 'partner' },
          ]}
        />
      }
    >
      {mode === 'remote' ? (
        <WhoAreYou>
          <RemoteGame />
        </WhoAreYou>
      ) : (
        <LocalGame key={mode} />
      )}
    </GameShell>
  );
}
