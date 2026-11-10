import { lazy, Suspense, useState } from 'react';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import { href, navigate, useRoute } from '../../lib/router';
import { playSfx } from '../../lib/audio/sfx';
import { useAmbience } from '../../lib/audio/ambience';
import { PageLoading } from '../../app/PageLoading';
import type { Player, ScoreGame } from '../../data/types';
import { headToHead } from './gameStats';
import { monthName, ticketBalance, tournament } from './tickets';
import './arcade.css';
import { MedalCabinet, WeekChallenge } from './Medals';
import { PresenceBanner, PresenceDot } from '../chat/ArcadeChat';
import { GoldenBanner, GoldenCoins, useCountUp, useGoldenNow } from './GoldenDay';

const ConnectFour = lazy(() => import('./ConnectFour').then((m) => ({ default: m.ConnectFour })));
const Uno = lazy(() => import('./Uno').then((m) => ({ default: m.Uno })));
const Hangman = lazy(() => import('./Hangman').then((m) => ({ default: m.Hangman })));
const Bowling = lazy(() => import('./Bowling').then((m) => ({ default: m.Bowling })));
const Skeeball = lazy(() => import('./Skeeball').then((m) => ({ default: m.Skeeball })));
const Darts = lazy(() => import('./Darts').then((m) => ({ default: m.Darts })));
const Zeeslag = lazy(() => import('./Zeeslag').then((m) => ({ default: m.Zeeslag })));
const Claw = lazy(() => import('./Claw').then((m) => ({ default: m.Claw })));
const Memory = lazy(() => import('./Memory').then((m) => ({ default: m.Memory })));
const Bingo = lazy(() => import('./Bingo').then((m) => ({ default: m.Bingo })));
const Kwartet = lazy(() => import('./Kwartet').then((m) => ({ default: m.Kwartet })));
const Hockey = lazy(() => import('./Hockey').then((m) => ({ default: m.Hockey })));
const HopRace = lazy(() => import('./HopRace').then((m) => ({ default: m.HopRace })));
const BubbleTeaBar = lazy(() =>
  import('./BubbleTeaBar').then((m) => ({ default: m.BubbleTeaBar })),
);
const Prizes = lazy(() => import('./Prizes').then((m) => ({ default: m.Prizes })));
const TicTacToe = lazy(() => import('./TicTacToe').then((m) => ({ default: m.TicTacToe })));
const DotsBoxes = lazy(() => import('./DotsBoxes').then((m) => ({ default: m.DotsBoxes })));
const Lingo = lazy(() => import('./Lingo').then((m) => ({ default: m.Lingo })));
const Hoops = lazy(() => import('./Hoops').then((m) => ({ default: m.Hoops })));
const BeerPong = lazy(() => import('./BeerPong').then((m) => ({ default: m.BeerPong })));
const Golf = lazy(() => import('./Golf').then((m) => ({ default: m.Golf })));
const DrawGuess = lazy(() => import('./DrawGuess').then((m) => ({ default: m.DrawGuess })));
const Ludo = lazy(() => import('./Ludo').then((m) => ({ default: m.Ludo })));

const GAMES = [
  {
    id: 'pong',
    emoji: '🍻',
    title: 'Beer pong',
    blurb: 'Gooi in de bekers — twee ballen per beurt',
    tint: '#f9d0e0',
    kind: 'pong',
  },
  {
    id: 'golf',
    emoji: '⛳',
    title: 'Minigolf',
    blurb: 'Zes holes met een windmolen — duel om tickets',
    tint: '#e0ebd4',
    kind: 'golf',
  },
  {
    id: 'draw',
    emoji: '🎨',
    title: 'Tekenen & raden',
    blurb: 'Teken een woord, de ander raadt',
    tint: '#ffd8a8',
    kind: 'draw',
  },
  {
    id: 'ludo',
    emoji: '🎲',
    title: 'Mens erger je niet',
    blurb: 'Geel tegen roze — en erger je niet!',
    tint: '#fff2b8',
    kind: 'ludo',
  },
  {
    id: 'hoops',
    emoji: '🏀',
    title: 'Basketbal',
    blurb: '45 seconden, zoveel mogelijk punten — duel om tickets',
    tint: '#ffd8a8',
    kind: 'hoops',
  },
  {
    id: 'lingo',
    emoji: '🟥',
    title: 'Lingo',
    blurb: 'Vijf woorden, vijf letters — duel om tickets',
    tint: '#c9e4f5',
    kind: 'lingo',
  },
  {
    id: 'dots',
    emoji: '✏️',
    title: 'Kamertje verhuren',
    blurb: 'Lijntjes trekken: roze tegen geel',
    tint: '#fff2b8',
    kind: 'dots',
  },
  {
    id: 'ttt',
    emoji: '❌',
    title: 'Boter kaas en eieren',
    blurb: 'Drie op een rij — ook in de verdwijnvariant',
    tint: '#f9d0e0',
    kind: 'ttt',
  },
  {
    id: 'uno',
    emoji: '🃏',
    title: 'UNO',
    blurb: 'Samen, of tegen Coco',
    tint: '#ffd8a8',
    kind: 'uno',
  },
  {
    id: 'c4',
    emoji: '🔴',
    title: '4 op een rij',
    blurb: 'Wie heeft er eerst vier?',
    tint: '#c9e4f5',
    kind: 'c4',
  },
  {
    id: 'hangman',
    emoji: '🎈',
    title: 'Galgje',
    blurb: 'Red Coco’s ballonnen',
    tint: '#e4ddf5',
    kind: 'hangman',
  },
  {
    id: 'bowling',
    emoji: '🎳',
    title: 'Bowlen',
    blurb: 'Veeg voor een strike — duel om tickets',
    tint: '#f9d0e0',
    kind: 'bowling',
  },
  {
    id: 'skeeball',
    emoji: '🎯',
    title: 'Skeeball',
    blurb: 'Mik op de 100 — duel om tickets',
    tint: '#e0ebd4',
    kind: 'skeeball',
  },
  {
    id: 'hop',
    emoji: '🐰',
    title: 'Coco’s Hoprace',
    blurb: 'Hop over bloempotten, eet wortels — duel om tickets',
    tint: '#e0ebd4',
    kind: 'hop',
  },
  {
    id: 'boba',
    emoji: '🧋',
    title: 'Bubble Tea Bar',
    blurb: 'Maak de bestellingen op tijd — duel om tickets',
    tint: '#f9d0e0',
    kind: 'boba',
  },
  {
    id: 'bingo',
    emoji: '🎱',
    title: 'Bingo',
    blurb: 'Trek een bal, stempel, roep BINGO!',
    tint: '#ffd8a8',
    kind: 'bingo',
  },
  {
    id: 'kwartet',
    emoji: '🐟',
    title: 'Go Fish!',
    blurb: 'Vraag om koningen of azen — en vis!',
    tint: '#c9e4f5',
    kind: 'kwartet',
  },
  {
    id: 'zeeslag',
    emoji: '🥞',
    title: 'Pannenkoekenslag',
    blurb: 'Zeeslag op de gracht: gooi pannenkoeken naar elkaars boten',
    tint: '#c9e4f5',
    kind: 'zeeslag',
  },
  { id: 'darts', emoji: '🎯', title: 'Darten', blurb: 'Drie pijlen, vijf rondes', tint: '#f9d0e0' },
  {
    id: 'claw',
    emoji: '🧸',
    title: 'Grijpmachine',
    blurb: 'Herinneringen & date-ideetjes',
    tint: '#ffd8a8',
  },
  { id: 'memory', emoji: '🧠', title: 'Memory', blurb: 'Met onze eigen foto’s', tint: '#e4ddf5' },
  {
    id: 'hockey',
    emoji: '🏒',
    title: 'Airhockey',
    blurb: 'Elk aan een kant van je telefoon',
    tint: '#c9e4f5',
  },
  {
    id: 'prizes',
    emoji: '🎁',
    title: 'Prijzenkast',
    blurb: 'Win bonnen met je tickets',
    tint: '#ffd8a8',
  },
] as const;

/** Our arcade: a few games for the two of us. */
export function GamesPage() {
  const { params } = useRoute();
  const game = params.get('g');
  if (game) {
    const Game =
      game === 'uno'
        ? Uno
        : game === 'c4'
          ? ConnectFour
          : game === 'hangman'
            ? Hangman
            : game === 'bowling'
              ? Bowling
              : game === 'skeeball'
                ? Skeeball
                : game === 'hop'
                  ? HopRace
                  : game === 'boba'
                    ? BubbleTeaBar
                    : game === 'darts'
                      ? Darts
                      : game === 'zeeslag'
                        ? Zeeslag
                        : game === 'claw'
                          ? Claw
                          : game === 'memory'
                            ? Memory
                            : game === 'hockey'
                              ? Hockey
                              : game === 'bingo'
                                ? Bingo
                                : game === 'kwartet'
                                  ? Kwartet
                                  : game === 'prizes'
                                    ? Prizes
                                    : game === 'ttt'
                                      ? TicTacToe
                                      : game === 'dots'
                                        ? DotsBoxes
                                        : game === 'lingo'
                                          ? Lingo
                                          : game === 'hoops'
                                            ? Hoops
                                            : game === 'pong'
                                              ? BeerPong
                                              : game === 'golf'
                                                ? Golf
                                                : game === 'draw'
                                                  ? DrawGuess
                                                  : game === 'ludo'
                                                    ? Ludo
                                                    : null;
    if (Game)
      return (
        <Suspense fallback={<PageLoading />}>
          <Game />
        </Suspense>
      );
  }
  return <Arcade />;
}

function Arcade() {
  const matches = useContent((c) => c.games.matches);
  const scores = useContent((c) => c.games.scores);
  const results = useContent((c) => c.games);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const [inserting, setInserting] = useState<string | null>(null);
  const content = useContent((c) => c);
  const myTickets = useCountUp(ticketBalance(content, me));
  useAmbience('arcade');
  const { golden } = useGoldenNow();

  // What scrolls along the LED ticker: records and wins (Coco's too).
  const best = (game: ScoreGame, who: Player) => {
    const all = scores.filter((s) => s.game === game && s.who === who).map((s) => s.score);
    return all.length ? Math.max(...all) : '---';
  };
  const you = profile.yourName.toUpperCase();
  const partner = profile.partnerName.toUpperCase();
  const us = headToHead(results, 'all', 'you', 'partner');
  const cocoMe = headToHead(results, 'all', me, 'coco');
  const ticker = [
    `★ GEWONNEN  ${you} ${us.a}  ·  ${partner} ${us.b}`,
    `★ HIGHSCORE BOWLEN  ${you} ${best('bowling', 'you')}  ·  ${partner} ${best('bowling', 'partner')}  ·  COCO ${best('bowling', 'coco')}`,
    `★ HIGHSCORE DARTEN  ${you} ${best('darts', 'you')}  ·  ${partner} ${best('darts', 'partner')}  ·  COCO ${best('darts', 'coco')}`,
    `★ HIGHSCORE SKEEBALL  ${you} ${best('skeeball', 'you')}  ·  ${partner} ${best('skeeball', 'partner')}  ·  COCO ${best('skeeball', 'coco')}`,
    `★ HOPRACE  ${you} ${best('hop', 'you')}  ·  ${partner} ${best('hop', 'partner')}  ·  COCO ${best('hop', 'coco')}`,
    `★ BUBBLE TEA BAR  ${you} ${best('boba', 'you')}  ·  ${partner} ${best('boba', 'partner')}  ·  COCO ${best('boba', 'coco')}`,
    `★ JIJ TEGEN COCO  ${cocoMe.a}–${cocoMe.b}`,
    '★ 1 MUNTJE = 1 KUSJE ♥',
  ].join('          ');

  const insert = (id: string, to: () => void) => {
    if (inserting) return;
    setInserting(id);
    playSfx('coin', true);
    window.setTimeout(() => playSfx('chime', true), 380);
    window.setTimeout(() => {
      setInserting(null);
      to();
    }, 900);
  };

  return (
    <div className={`page arcade-zone arcade-hall${golden ? ' is-golden' : ''}`}>
      <GoldenCoins />
      <div className="hall__lights" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.37}s` }} />
        ))}
      </div>
      <header className="hall__sign">
        <p className="hall__welcome">welkom in de</p>
        <h1 className="hall__title" aria-label="Arcade Hall">
          <span className="hall__word" aria-hidden="true">
            {'ARCADE'.split('').map((l, i) => (
              <span key={i} className={i === 3 ? 'flicker' : ''}>
                {l}
              </span>
            ))}
          </span>{' '}
          <span className="hall__word hall__word--b" aria-hidden="true">
            {'HALL'.split('').map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </span>
        </h1>
        <p className="hall__sub">
          van {profile.yourName} &amp; {profile.partnerName} · open 24/7 · toegang gratis ♥
        </p>
      </header>

      <PresenceBanner />

      <div className="hall__ticker" aria-label="Records">
        <div className="hall__ticker-track">
          <span>{ticker}</span>
          <span aria-hidden="true">{ticker}</span>
        </div>
      </div>

      <GoldenBanner />

      <p className="hall__tickets">
        🎟️ Jouw tickets: <strong>{myTickets}</strong>
        <a href={href('/games', { g: 'prizes' })}>naar de prijzenkast →</a>
      </p>

      <WeekChallenge />
      <Trophies />

      <ul className="hall__floor">
        {GAMES.map((g) => {
          const live =
            'kind' in g
              ? matches
                  .filter((m) => m.kind === g.kind && !m.winner)
                  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
              : undefined;
          const yourTurn = live?.turn === me;
          return (
            <li key={g.id}>
              <Cabinet
                id={g.id}
                title={g.title}
                blurb={g.blurb}
                led={
                  live
                    ? yourTurn
                      ? 'JOUW BEURT'
                      : live.turn === otherPerson(me)
                        ? 'BEZIG'
                        : ''
                    : ''
                }
                hot={yourTurn}
                inserting={inserting === g.id}
                onPlay={() => insert(g.id, () => navigate('/games', { g: g.id }))}
              />
            </li>
          );
        })}
        <li>
          <Cabinet
            id="quiz"
            title="Wie kent wie?"
            blurb="De gameshow, gepresenteerd door Coco"
            led=""
            inserting={inserting === 'quiz'}
            onPlay={() => insert('quiz', () => navigate('/quiz'))}
          />
        </li>
      </ul>
      <p className="hall__hint">
        Tik op een kast om een muntje in te gooien. Samen spelen kan elk op je eigen telefoon — de
        zetten gaan via de sync.
      </p>
      <MedalCabinet />
    </div>
  );
}

/** Champion of the month: who won the most games against the other. */
function Trophies() {
  const results = useContent((c) => c.games);
  const profile = useContent((c) => c.profile);
  const months = tournament(results);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const now = months.find((m) => m.month === thisMonth) ?? {
    month: thisMonth,
    you: 0,
    partner: 0,
    champion: null,
  };
  const past = months.filter((m) => m.month !== thisMonth && m.champion);
  const name = (p: 'you' | 'partner') => nameOf(p, profile);
  return (
    <section className="trophies" aria-labelledby="trophies-title">
      <h2 id="trophies-title" className="trophies__title">
        🏆 Kampioen van {monthName(thisMonth)}
      </h2>
      <div className="trophies__now">
        <span className={now.champion === 'you' ? 'is-lead' : ''}>
          <small>{profile.yourName.toUpperCase()}</small>
          <strong>{now.you}</strong>
        </span>
        <em>tegen</em>
        <span className={now.champion === 'partner' ? 'is-lead' : ''}>
          <small>{profile.partnerName.toUpperCase()}</small>
          <strong>{now.partner}</strong>
        </span>
      </div>
      <p className="trophies__hint">
        {now.champion
          ? `${name(now.champion)} staat voor deze maand. Wie de meeste potjes van de ander wint, krijgt de beker.`
          : 'Nog gelijk deze maand — elk gewonnen potje tegen elkaar telt.'}
      </p>
      {past.length > 0 && (
        <ul className="trophies__shelf" aria-label="Eerdere kampioenen">
          {past.slice(0, 12).map((m) => (
            <li key={m.month} className={`trophy trophy--${m.champion}`}>
              <span aria-hidden="true">🏆</span>
              <strong>{name(m.champion!)}</strong>
              <small>
                {monthName(m.month)} {m.month.slice(0, 4)} · {m.you}–{m.partner}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const MARQUEE: Record<string, string> = {
  uno: 'linear-gradient(90deg,#ff3b5c,#ffb020,#2bd67b,#2f7bff)',
  c4: 'linear-gradient(90deg,#2f6fd6,#ff4f8b)',
  hangman: 'linear-gradient(90deg,#b07bff,#ff8cc0)',
  bowling: 'linear-gradient(90deg,#ff5fa2,#ffd75e)',
  skeeball: 'linear-gradient(90deg,#2bd6c1,#7bff8a)',
  hop: 'linear-gradient(90deg,#7ab868,#ffd75e,#ff8cc0)',
  boba: 'linear-gradient(90deg,#c3a6e6,#ff8cc0,#e9d98a)',
  zeeslag: 'linear-gradient(90deg,#1f6fd6,#2bd6c1)',
  darts: 'linear-gradient(90deg,#d8323c,#2fa64f)',
  claw: 'linear-gradient(90deg,#ff8cc0,#b07bff,#7fc8ff)',
  memory: 'linear-gradient(90deg,#b07bff,#5ff3ff)',
  hockey: 'linear-gradient(90deg,#4f8bff,#ff5fa2)',
  prizes: 'linear-gradient(90deg,#ffd75e,#ff8cc0)',
  quiz: 'linear-gradient(90deg,#ffd75e,#ff9a5c)',
  hoops: 'linear-gradient(90deg,#ff8a1a,#ff5fa2,#b03cff)',
  lingo: 'linear-gradient(90deg,#1240a8,#ffd400,#e32636)',
  dots: 'linear-gradient(90deg,#ffc93c,#ff4f9a)',
  ttt: 'linear-gradient(90deg,#7fbf6a,#ef8fa8)',
  pong: 'linear-gradient(90deg,#e5263d,#ffd75e,#ff8cc0)',
  golf: 'linear-gradient(90deg,#3cc46a,#fffaf0,#ff8cc0)',
  draw: 'linear-gradient(90deg,#ff4f9a,#ffc61a,#2f7bff,#3fae5a)',
  ludo: 'linear-gradient(90deg,#ffc61a,#e8c48e,#ff5fa2)',
};

/** One arcade machine: marquee, a little screen that plays, buttons and a coin slot. */
function Cabinet({
  id,
  title,
  blurb,
  led,
  hot = false,
  inserting,
  onPlay,
}: {
  id: string;
  title: string;
  blurb: string;
  led: string;
  hot?: boolean;
  inserting: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      className={`cab cab--${id} ${hot ? 'is-hot' : ''} ${inserting ? 'is-starting' : ''}`}
      onClick={onPlay}
      data-sfx="none"
    >
      <span className="cab__marquee" style={{ background: MARQUEE[id] }}>
        {title}
      </span>
      <PresenceDot game={id} />
      <span className="cab__screen" aria-hidden="true">
        <Preview id={id} />
        {inserting && <span className="cab__start">PLAYER 1 START</span>}
        <span className="cab__scan" />
      </span>
      <span className="cab__panel" aria-hidden="true">
        <span className="cab__stick" />
        <span className="cab__btn cab__btn--a" />
        <span className="cab__btn cab__btn--b" />
      </span>
      <span className="cab__blurb">{blurb}</span>
      {led && <span className="visually-hidden"> ({led.toLowerCase()})</span>}
      <span className="cab__slot" aria-hidden="true">
        <span className="cab__coin" />
        <span className={`cab__led ${led ? 'is-on' : ''}`}>{led || 'INSERT ♥'}</span>
      </span>
    </button>
  );
}

/** The little game that plays on each machine's screen. */
function Preview({ id }: { id: string }) {
  switch (id) {
    case 'uno':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--uno">
          {['#ff3b5c', '#ffb020', '#2bd67b', '#2f7bff'].map((c, i) => (
            <g key={c} className="pv-card" style={{ animationDelay: `${i * 0.5}s` }}>
              <rect
                x="48"
                y="18"
                width="24"
                height="36"
                rx="4"
                fill={c}
                stroke="#fff"
                strokeWidth="2"
              />
              <ellipse cx="60" cy="36" rx="8" ry="12" fill="#fff" transform="rotate(-20 60 36)" />
            </g>
          ))}
        </svg>
      );
    case 'c4':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--c4">
          <rect x="22" y="14" width="76" height="60" rx="6" fill="#1f3f8f" />
          {Array.from({ length: 4 }, (_, r) =>
            Array.from({ length: 5 }, (_, c) => (
              <circle key={`${r}${c}`} cx={32 + c * 14} cy={24 + r * 14} r="5" fill="#0b1433" />
            )),
          )}
          {[0, 1, 2, 3].map((i) => (
            <circle
              key={i}
              className="pv-disc"
              cx={32 + i * 14}
              cy={66 - i * 14}
              r="5"
              fill={i % 2 ? '#3d6fd8' : '#ff4f8b'}
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          ))}
        </svg>
      );
    case 'hangman':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--balloons">
          {['#ff5fa2', '#ffd75e', '#7fc8ff', '#b07bff'].map((c, i) => (
            <g key={c} className="pv-balloon" style={{ animationDelay: `${i * 0.3}s` }}>
              <line x1={44 + i * 11} y1={30} x2="60" y2="58" stroke="#ffffff88" strokeWidth="0.8" />
              <ellipse cx={44 + i * 11} cy={22 - (i % 2) * 5} rx="6" ry="8" fill={c} />
            </g>
          ))}
          <circle cx="60" cy="62" r="8" fill="#3a2a3a" />
          <ellipse cx="56" cy="52" rx="2" ry="6" fill="#3a2a3a" />
          <ellipse cx="64" cy="52" rx="2" ry="6" fill="#3a2a3a" />
        </svg>
      );
    case 'bowling':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--bowl">
          <path d="M44 6h32l14 74H30z" fill="#e9c48f" />
          {[
            [60, 12],
            [56, 16],
            [64, 16],
            [52, 20],
            [60, 20],
            [68, 20],
          ].map(([x, y], i) => (
            <circle
              key={i}
              className="pv-pin"
              cx={x}
              cy={y}
              r="2.6"
              fill="#fff"
              stroke="#d8323c"
              strokeWidth="0.8"
            />
          ))}
          <circle className="pv-ball" cx="60" cy="70" r="6" fill="#6a2c5c" />
        </svg>
      );
    case 'skeeball':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--skee">
          <path d="M34 80L46 34h28l12 46z" fill="#c98a4b" />
          <rect x="40" y="6" width="40" height="28" rx="4" fill="#ffe0ec" />
          {[22, 16, 10].map((r, i) => (
            <ellipse
              key={r}
              cx="60"
              cy="22"
              rx={r / 1.6}
              ry={r / 2.6}
              fill="none"
              stroke={['#e0457b', '#b0325f', '#7d68b5'][i]}
              strokeWidth="2"
            />
          ))}
          <circle className="pv-skee" cx="60" cy="72" r="5" fill="#ffd3e1" />
        </svg>
      );
    case 'hop':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--hop">
          <rect width="120" height="80" fill="#ffe6c9" />
          <rect y="62" width="120" height="18" fill="#7ab868" />
          <g className="pv-pot">
            <path d="M86 50h14l-2 12h-10z" fill="#d9774f" stroke="#3a2a3a" strokeWidth="1.5" />
            <path d="M89 44q4 -8 8 0q-4 4 -8 0z" fill="#ff7aa8" />
          </g>
          <g className="pv-carrot">
            <path d="M58 26l6 -2l-2 10z" fill="#f08a2e" />
            <path d="M59 25l-2 -5M61 24l1 -5" stroke="#7cb565" strokeWidth="1.6" />
          </g>
          <g className="pv-hopper">
            <ellipse cx="34" cy="54" rx="11" ry="8" fill="#26222b" />
            <circle cx="43" cy="47" r="6.5" fill="#26222b" />
            <ellipse cx="41" cy="38" rx="2.2" ry="6" fill="#26222b" transform="rotate(-15 41 38)" />
            <ellipse cx="45" cy="38" rx="2.2" ry="6" fill="#26222b" transform="rotate(10 45 38)" />
            <circle cx="45.5" cy="46" r="1.3" fill="#fff" />
            <ellipse cx="30" cy="61" rx="4" ry="2" fill="#f7f3ee" />
            <ellipse cx="41" cy="61" rx="3" ry="2" fill="#f7f3ee" />
          </g>
        </svg>
      );
    case 'pong':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--pong">
          <path d="M20 74L44 20h32l24 54z" fill="#f5efe6" />
          {[
            [52, 26],
            [60, 26],
            [68, 26],
            [56, 33],
            [64, 33],
            [60, 40],
          ].map(([x, y], i) => (
            <g key={i}>
              <path d={`M${x - 4} ${y}l1 7h6l1 -7z`} fill="#e5263d" />
              <ellipse cx={x} cy={y} rx="4" ry="1.4" fill="#fff" />
            </g>
          ))}
          <circle className="pv-pong" cx="60" cy="70" r="3.5" fill="#fff" />
        </svg>
      );
    case 'golf':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--golf">
          <rect x="0" y="0" width="120" height="80" fill="#4f9a3c" />
          <rect
            x="28"
            y="6"
            width="64"
            height="70"
            rx="8"
            fill="#3cc46a"
            stroke="#8a5a2b"
            strokeWidth="3"
          />
          <circle cx="60" cy="20" r="4" fill="#123018" />
          <path d="M60 20V6l9 3 -9 3" stroke="#fff" strokeWidth="1" fill="#ff5fa2" />
          <g className="pv-mill">
            <path
              d="M60 40l-12 -3M60 40l3 -12M60 40l12 3M60 40l-3 12"
              stroke="#fffaf0"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
          <circle className="pv-putt" cx="60" cy="66" r="3" fill="#fff" />
        </svg>
      );
    case 'draw':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--draw">
          <path d="M40 76l14 -66M80 76l-14 -66" stroke="#8a5a2b" strokeWidth="3" />
          <rect
            x="32"
            y="8"
            width="56"
            height="46"
            rx="2"
            fill="#fffdf8"
            stroke="#b98352"
            strokeWidth="2"
          />
          <path
            className="pv-sketch"
            d="M44 40q8 -22 16 -6t16 -6"
            fill="none"
            stroke="#ff4f9a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="50" cy="22" r="4" fill="#ffc61a" />
        </svg>
      );
    case 'ludo':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--ludo">
          <rect
            x="22"
            y="4"
            width="76"
            height="72"
            rx="8"
            fill="#e8c48e"
            stroke="#9b6a3a"
            strokeWidth="2"
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle
              key={i}
              cx={36 + i * 12}
              cy="40"
              r="4"
              fill={i === 0 ? '#ffc61a' : i === 4 ? '#ff5fa2' : '#fffaf0'}
              stroke="#9b6a3a"
            />
          ))}
          <g className="pv-die">
            <rect x="52" y="12" width="16" height="16" rx="3" fill="#fff" />
            <circle cx="56" cy="16" r="1.6" fill="#3b2a1f" />
            <circle cx="60" cy="20" r="1.6" fill="#3b2a1f" />
            <circle cx="64" cy="24" r="1.6" fill="#3b2a1f" />
          </g>
          <circle className="pv-hop" cx="36" cy="54" r="5" fill="#ffc61a" stroke="#b58500" />
        </svg>
      );
    case 'hoops':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--hoops">
          <rect
            x="34"
            y="6"
            width="52"
            height="30"
            rx="3"
            fill="#e6f5ff"
            stroke="#5ff3ff"
            strokeWidth="2"
          />
          <rect x="50" y="16" width="20" height="14" fill="none" stroke="#ff4f6d" strokeWidth="2" />
          <ellipse
            cx="60"
            cy="36"
            rx="13"
            ry="3.5"
            fill="none"
            stroke="#ff7a1a"
            strokeWidth="2.5"
          />
          <path
            d="M48 37l4 12h16l4-12M52 37l3 12M60 37v12M68 37l-3 12"
            stroke="#fff"
            strokeWidth="1"
            fill="none"
          />
          <g className="pv-shot">
            <circle cx="60" cy="66" r="9" fill="#e0601c" />
            <path d="M51 66h18M60 57v18" stroke="#5a2408" strokeWidth="1.2" />
          </g>
        </svg>
      );
    case 'lingo':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--lingo">
          <rect x="0" y="0" width="120" height="80" fill="#0a2366" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3, 4].map((c) => {
              const right = (r === 1 && (c === 0 || c === 3)) || r === 2;
              const near = r === 1 && c === 2;
              return (
                <g
                  key={`${r}${c}`}
                  className={r === 2 ? 'pv-flip' : ''}
                  style={{ animationDelay: `${c * 0.15}s` }}
                >
                  <rect
                    x={18 + c * 17}
                    y={10 + r * 21}
                    width="15"
                    height="18"
                    rx="2"
                    fill={right ? '#e32636' : '#2f6fe0'}
                  />
                  {near && <circle cx={25.5 + c * 17} cy={19 + r * 21} r="6.5" fill="#ffd400" />}
                </g>
              );
            }),
          )}
        </svg>
      );
    case 'dots':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--dots">
          <rect x="16" y="6" width="88" height="68" rx="4" fill="#fdfcf6" />
          <rect x="34" y="18" width="18" height="18" fill="#ffe58a" />
          <rect x="52" y="36" width="18" height="18" fill="#ffc2dc" />
          <path
            d="M34 18h18v18h-18zM52 36h18v18h-18z"
            stroke="#3b3350"
            strokeWidth="0"
            fill="none"
          />
          <path d="M34 18h18M34 18v18M52 18v18M34 36h18" stroke="#f5b800" strokeWidth="2.5" />
          <path d="M52 54h18M70 36v18M52 36h18" stroke="#ff4f9a" strokeWidth="2.5" />
          <path className="pv-line" d="M70 18v18" stroke="#ff4f9a" strokeWidth="2.5" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <circle key={`${r}${c}`} cx={34 + c * 18} cy={18 + r * 18} r="2" fill="#3b3350" />
            )),
          )}
        </svg>
      );
    case 'ttt':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--ttt">
          <rect x="30" y="4" width="60" height="72" rx="6" fill="#ef8fa8" />
          <rect x="34" y="10" width="52" height="60" rx="4" fill="#fff8ef" />
          <path
            d="M51 14v52M69 14v52M38 30h44M38 50h44"
            stroke="#9b6a74"
            strokeWidth="2"
            opacity="0.6"
          />
          <path d="M40 17l7 9M47 17l-7 9" stroke="#ffc93c" strokeWidth="3" strokeLinecap="round" />
          <circle cx="60" cy="40" r="5" fill="none" stroke="#ff6fae" strokeWidth="3" />
          <g className="pv-x">
            <path
              d="M73 54l7 9M80 54l-7 9"
              stroke="#ffc93c"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        </svg>
      );
    case 'boba':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--boba">
          <rect x="22" y="58" width="76" height="18" rx="3" fill="#ffd1e4" />
          <g className="pv-cup">
            <path d="M46 20h28l-4 40h-20z" fill="#e9d98a" stroke="#fff" strokeWidth="2" />
            {[0, 1, 2, 3, 4].map((i) => (
              <circle
                key={i}
                className="pv-pearl"
                cx={52 + i * 4}
                cy={54 - (i % 2) * 3}
                r="2.4"
                fill="#3a2418"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
            <path d="M64 6l-3 40" stroke="#ff86bb" strokeWidth="4" strokeLinecap="round" />
          </g>
          <text x="96" y="30" fontSize="14" className="pv-q">
            ♥
          </text>
        </svg>
      );
    case 'zeeslag':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--sea">
          <rect x="0" y="0" width="120" height="80" fill="#0b2a55" />
          {Array.from({ length: 6 }, (_, i) => (
            <path
              key={i}
              className="pv-wave"
              d={`M${-20 + (i % 2) * 10} ${16 + i * 11}q10 -5 20 0t20 0t20 0t20 0t20 0t20 0t20 0`}
              stroke="#2bd6c1"
              strokeOpacity="0.35"
              fill="none"
              style={{ animationDelay: `${i * -0.4}s` }}
            />
          ))}
          <g className="pv-ship">
            <path d="M34 50h44l-6 9H40z" fill="#c9c3d6" />
            <rect x="48" y="42" width="16" height="8" rx="2" fill="#e8e4f0" />
            <rect x="54" y="34" width="3" height="8" fill="#e8e4f0" />
          </g>
          <circle className="pv-blip" cx="88" cy="26" r="3" fill="#ff5fa2" />
          <circle className="pv-ping" cx="88" cy="26" r="3" fill="none" stroke="#ff5fa2" />
        </svg>
      );
    case 'darts':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--darts">
          {[30, 24, 18, 12, 6].map((r, i) => (
            <circle
              key={r}
              cx="60"
              cy="40"
              r={r}
              fill={['#1d1a1f', '#d8323c', '#f3e6c8', '#2fa64f', '#d8323c'][i]}
            />
          ))}
          <g className="pv-dart">
            <path d="M60 40l22 -18" stroke="#c9c3b5" strokeWidth="2" />
            <path d="M82 22l6 -2 -3 6z" fill="#5ff3ff" />
          </g>
        </svg>
      );
    case 'memory':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--memory">
          {[0, 1, 2, 3].map((i) => (
            <g key={i} className="pv-flip" style={{ animationDelay: `${i * 0.45}s` }}>
              <rect
                x={18 + i * 22}
                y="22"
                width="18"
                height="26"
                rx="3"
                fill={i % 2 ? '#b07bff' : '#5ff3ff'}
                stroke="#fff"
                strokeWidth="1.5"
              />
              <text x={27 + i * 22} y="40" textAnchor="middle" fontSize="10" fill="#fff">
                {['♥', '🐰', '♥', '🐰'][i]}
              </text>
            </g>
          ))}
        </svg>
      );
    case 'bingo':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--bingo">
          <circle cx="40" cy="40" r="24" fill="#2a1240" stroke="#ffd75e" strokeWidth="3" />
          {['#ff5fa2', '#b07bff', '#5ff3ff', '#ffd75e', '#7ee08a'].map((c, i) => (
            <circle
              key={c}
              className="pv-bingo"
              cx={30 + (i % 3) * 10}
              cy={34 + Math.floor(i / 3) * 10}
              r="4.5"
              fill={c}
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
          <circle cx="88" cy="40" r="15" fill="#fff" stroke="#ff5fa2" strokeWidth="4" />
          <text x="88" y="45" textAnchor="middle" fontSize="13" fontWeight="900" fill="#2a1240">
            42
          </text>
        </svg>
      );
    case 'kwartet':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--kwartet">
          <ellipse cx="60" cy="62" rx="44" ry="12" fill="#1677a8" />
          {['🐠', '🐙', '🦀', '🐬'].map((f, i) => (
            <g key={f} className="pv-card" style={{ animationDelay: `${i * 0.5}s` }}>
              <rect
                x="47"
                y="14"
                width="26"
                height="38"
                rx="4"
                fill="#fff"
                stroke="#5ff3ff"
                strokeWidth="2"
              />
              <text x="60" y="39" textAnchor="middle" fontSize="16">
                {f}
              </text>
            </g>
          ))}
        </svg>
      );
    case 'hockey':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--hockey">
          <rect
            x="30"
            y="6"
            width="60"
            height="68"
            rx="8"
            fill="#132a5c"
            stroke="#5ff3ff"
            strokeOpacity="0.6"
          />
          <line x1="30" y1="40" x2="90" y2="40" stroke="#5ff3ff" strokeOpacity="0.5" />
          <circle cx="60" cy="16" r="6" fill="#ff5fa2" />
          <circle cx="60" cy="64" r="6" fill="#4f8bff" />
          <circle className="pv-puck" cx="60" cy="40" r="3.5" fill="#fff" />
        </svg>
      );
    case 'prizes':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--prizes">
          <rect x="24" y="10" width="72" height="60" rx="6" fill="#2a1840" stroke="#ffd75e" />
          <line x1="24" y1="40" x2="96" y2="40" stroke="#ffd75e" strokeOpacity="0.6" />
          <text x="42" y="34" fontSize="16" textAnchor="middle">
            🧋
          </text>
          <text x="78" y="34" fontSize="16" textAnchor="middle">
            💐
          </text>
          <text x="60" y="64" fontSize="16" textAnchor="middle" className="pv-q">
            🎟️
          </text>
        </svg>
      );
    case 'claw':
      return (
        <svg viewBox="0 0 120 80" className="pv pv--claw">
          <rect x="18" y="4" width="84" height="3" fill="#b07bff" />
          <g className="pv-claw">
            <rect x="58.5" y="6" width="3" height="22" fill="#c9c3d6" />
            <path d="M52 28h16l-3 9M52 28l3 9" stroke="#c9c3d6" strokeWidth="2.5" fill="none" />
          </g>
          {[
            [30, '#ff8cc0'],
            [46, '#ffd75e'],
            [62, '#7fc8ff'],
            [78, '#b07bff'],
            [92, '#5dff9a'],
          ].map(([x, c], i) => (
            <circle
              key={i}
              cx={x as number}
              cy={66 - (i % 2) * 6}
              r="8"
              fill={c as string}
              stroke="#fff"
              strokeOpacity="0.6"
            />
          ))}
          <text x="62" y="64" fontSize="8" textAnchor="middle">
            ♥
          </text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 80" className="pv pv--quiz">
          <text x="60" y="52" textAnchor="middle" fontSize="40" fill="#ffd75e" className="pv-q">
            ?
          </text>
          <text x="34" y="40" textAnchor="middle" fontSize="18" fill="#ff8cc0">
            ♥
          </text>
          <text x="86" y="40" textAnchor="middle" fontSize="18" fill="#7fc8ff">
            ♥
          </text>
        </svg>
      );
  }
}
