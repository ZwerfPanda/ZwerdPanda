import { lazy, Suspense, useState } from 'react';
import { useContent } from '../../data/store';
import { otherPerson, useMe } from '../../data/people';
import { navigate, useRoute } from '../../lib/router';
import { playSfx } from '../../lib/audio/sfx';
import { useAmbience } from '../../lib/audio/ambience';
import { PageLoading } from '../../app/PageLoading';
import type { Player } from '../../data/types';
import { headToHead } from './gameStats';
import './arcade.css';

const ConnectFour = lazy(() => import('./ConnectFour').then((m) => ({ default: m.ConnectFour })));
const Uno = lazy(() => import('./Uno').then((m) => ({ default: m.Uno })));
const Hangman = lazy(() => import('./Hangman').then((m) => ({ default: m.Hangman })));
const Bowling = lazy(() => import('./Bowling').then((m) => ({ default: m.Bowling })));
const Skeeball = lazy(() => import('./Skeeball').then((m) => ({ default: m.Skeeball })));

const GAMES = [
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
  { id: 'bowling', emoji: '🎳', title: 'Bowlen', blurb: 'Veeg voor een strike', tint: '#f9d0e0' },
  { id: 'skeeball', emoji: '🎯', title: 'Skeeball', blurb: 'Mik op de 100', tint: '#e0ebd4' },
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
  const results = useContent((c) => c.games.results);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const [inserting, setInserting] = useState<string | null>(null);
  useAmbience('arcade');

  // What scrolls along the LED ticker: records and wins (Coco's too).
  const best = (game: 'bowling' | 'skeeball', who: Player) => {
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
    `★ HIGHSCORE SKEEBALL  ${you} ${best('skeeball', 'you')}  ·  ${partner} ${best('skeeball', 'partner')}  ·  COCO ${best('skeeball', 'coco')}`,
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
    <div className="page arcade-zone arcade-hall">
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

      <div className="hall__ticker" aria-label="Records">
        <div className="hall__ticker-track">
          <span>{ticker}</span>
          <span aria-hidden="true">{ticker}</span>
        </div>
      </div>

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
            blurb="Hoe goed ken je de ander?"
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
    </div>
  );
}

const MARQUEE: Record<string, string> = {
  uno: 'linear-gradient(90deg,#ff3b5c,#ffb020,#2bd67b,#2f7bff)',
  c4: 'linear-gradient(90deg,#2f6fd6,#ff4f8b)',
  hangman: 'linear-gradient(90deg,#b07bff,#ff8cc0)',
  bowling: 'linear-gradient(90deg,#ff5fa2,#ffd75e)',
  skeeball: 'linear-gradient(90deg,#2bd6c1,#7bff8a)',
  quiz: 'linear-gradient(90deg,#ffd75e,#ff9a5c)',
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
