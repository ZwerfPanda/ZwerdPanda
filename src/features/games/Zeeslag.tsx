import { useEffect, useRef, useState } from 'react';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { startMatch, updateMatch, useMatch } from './gameData';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';
import {
  SHIP_NAMES,
  SIZE,
  allSunk,
  cocoShot,
  isSunk,
  normalizeSea,
  randomFleet,
  shotResult,
  type Ship,
  type ShotResult,
} from './zeeslag';

const LETTERS = 'ABCDEFGH';
const cellName = (i: number) => `${LETTERS[i % SIZE]}${Math.floor(i / SIZE) + 1}`;

/** A pancake boat, drawn across `n` cells (horizontal), in cell units. */
function PancakeBoat({ n, sunk }: { n: number; sunk: boolean }) {
  const w = n;
  const pancakes = Math.max(1, n - 1);
  return (
    <g className={sunk ? 'boat is-sunk' : 'boat'}>
      {/* the hull, its bow to the right */}
      <path
        d={`M0.12 0.5 L${w - 0.38} 0.5 Q${w - 0.06} 0.52 ${w - 0.05} 0.36 L${w - 0.18} 0.86 Q${w - 0.3} 0.94 ${w - 0.5} 0.94 L0.32 0.94 Q0.14 0.92 0.12 0.74 Z`}
        fill="#fff6e8"
        stroke="#3b2430"
        strokeWidth="0.05"
      />
      <path d={`M0.14 0.74 L${w - 0.12} 0.7`} stroke="#d8323c" strokeWidth="0.09" />
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={0.5 + i} cy={0.62} r={0.055} fill="#2b5aa6" />
      ))}
      {/* the cabin with its little windows */}
      <rect x={0.3} y={0.26} width={w - 0.95} height={0.26} rx={0.05} fill="#7a3f1d" />
      {Array.from({ length: Math.max(1, n - 1) }, (_, i) => (
        <rect
          key={i}
          x={0.42 + i * ((w - 1.15) / Math.max(1, n - 1))}
          y={0.31}
          width={0.16}
          height={0.12}
          rx={0.03}
          fill="#ffd75e"
        />
      ))}
      {/* a stack of pancakes on the roof, with a drip of syrup */}
      {Array.from({ length: pancakes }, (_, i) => (
        <g
          key={i}
          transform={`translate(${0.55 + i * ((w - 1.1) / Math.max(1, pancakes - 1 || 1))} 0.2)`}
        >
          {[0, 1, 2].map((k) => (
            <ellipse
              key={k}
              cx={0}
              cy={-k * 0.06}
              rx={0.2}
              ry={0.055}
              fill="#e6a35a"
              stroke="#a8662f"
              strokeWidth="0.02"
            />
          ))}
          <path
            d="M-0.1 -0.14 q0.1 -0.06 0.2 0 l-0.02 0.08 q-0.08 0.04 -0.16 0 z"
            fill="#b8641c"
            opacity="0.9"
          />
          <rect x={-0.04} y={-0.22} width={0.08} height={0.05} fill="#fff7d6" />
        </g>
      ))}
      {/* the Amsterdam flag at the stern */}
      <path d="M0.22 0.5 V0.02" stroke="#3b2430" strokeWidth="0.04" />
      <rect x={0.24} y={0.02} width={0.34} height={0.22} fill="#d8323c" />
      <rect x={0.24} y={0.093} width={0.34} height={0.074} fill="#1b1413" />
      <text x={0.41} y={0.155} fontSize="0.07" fill="#fff" textAnchor="middle" fontWeight="900">
        XXX
      </text>
    </g>
  );
}

/** The boats we can see, laid over the water in cell units. */
function Boats({ ships, shots }: { ships: Ship[]; shots: number[] }) {
  return (
    <svg className="sea__boats" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      {ships.map((ship) => {
        const first = ship.cells[0];
        const x = first % SIZE;
        const y = Math.floor(first / SIZE);
        const across = ship.cells.length === 1 || ship.cells[1] - ship.cells[0] === 1;
        const n = ship.cells.length;
        const t = across ? `translate(${x} ${y})` : `translate(${x + 1} ${y}) rotate(90)`;
        return (
          <g key={first} transform={t}>
            <PancakeBoat n={n} sunk={isSunk(ship, shots)} />
          </g>
        );
      })}
    </svg>
  );
}

/** Canal houses along the quay, and a bridge — the top of the big canal. */
function Quay() {
  const houses = [
    '#b04a3c',
    '#3f6a8a',
    '#c99b5a',
    '#5f7d4f',
    '#8a4f7d',
    '#c26b3c',
    '#4f5d8a',
    '#a83a52',
  ];
  return (
    <svg
      className="sea__quay"
      viewBox="0 0 320 70"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <rect width="320" height="70" fill="#f6d9c8" />
      {houses.map((c, i) => {
        const x = i * 40;
        const h = 44 + ((i * 13) % 14);
        return (
          <g key={i}>
            <path
              d={`M${x + 2} 70 V${70 - h} l9 -8 h4 l3 -6 h4 l3 6 h4 l9 8 V70 Z`}
              fill={c}
              stroke="#3b2430"
              strokeWidth="1.2"
            />
            {[0, 1].map((row) =>
              [0, 1, 2].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={x + 8 + col * 9}
                  y={70 - h + 8 + row * 14}
                  width="5"
                  height="8"
                  rx="1"
                  fill="#fff4c8"
                />
              )),
            )}
          </g>
        );
      })}
      {/* a bridge with a bike */}
      <path d="M120 70 Q160 40 200 70" fill="none" stroke="#3b2430" strokeWidth="6" />
      <path d="M118 66 H202" stroke="#7a3f1d" strokeWidth="3" />
      <g transform="translate(150 54)">
        <circle r="4" fill="none" stroke="#1b1413" strokeWidth="1.2" />
        <circle cx="12" r="4" fill="none" stroke="#1b1413" strokeWidth="1.2" />
        <path d="M0 0 L5 -6 H11 L12 0 M5 -6 L6 -9" stroke="#d8323c" strokeWidth="1.2" fill="none" />
      </g>
    </svg>
  );
}

function Sea({
  ships,
  shots,
  showShips,
  onFire,
  label,
  small = false,
  radar = false,
}: {
  ships: Ship[];
  shots: number[];
  /** Our own fleet is visible; theirs only once sunk. */
  showShips: boolean;
  onFire?: (cell: number) => void;
  label: string;
  small?: boolean;
  radar?: boolean;
}) {
  const last = shots[shots.length - 1];
  const sunk = ships.filter((s) => isSunk(s, shots));
  const visible = showShips ? ships : sunk;
  return (
    <div className={`sea ${small ? 'sea--small' : ''} ${radar ? 'has-radar' : ''}`}>
      <span className="sea__label">{label}</span>
      {!small && <Quay />}
      <div className="sea__grid" role="group" aria-label={label}>
        <Boats ships={visible} shots={shots} />
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const shot = shots.includes(i);
          const hit = shot && ships.some((s) => s.cells.includes(i));
          const isSunkCell = sunk.some((s) => s.cells.includes(i));
          const isNew = i === last;
          const cls = [
            'sea__cell',
            shot ? (hit ? 'is-hit' : 'is-miss') : '',
            isSunkCell ? 'is-sunk' : '',
            isNew ? 'is-new' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const state = shot ? (isSunkCell ? 'gezonken' : hit ? 'raak' : 'mis') : 'water';
          const inner = (
            <>
              {shot && (
                <span className="sea__mark" aria-hidden="true">
                  🥞
                </span>
              )}
              {isNew && (
                <span className="sea__fly" aria-hidden="true">
                  🥞
                </span>
              )}
            </>
          );
          return onFire && !shot ? (
            <button
              key={i}
              type="button"
              className={cls}
              aria-label={`${cellName(i)}: gooi een pannenkoek`}
              data-sfx="none"
              onClick={() => onFire(i)}
            />
          ) : (
            <span
              key={`${i}-${shot ? 's' : 'w'}`}
              className={cls}
              role="img"
              aria-label={`${cellName(i)}: ${state}`}
            >
              {inner}
            </span>
          );
        })}
        {radar && <span className="sea__radar" aria-hidden="true" />}
      </div>
    </div>
  );
}

const shotLine = (result: ShotResult, ship: Ship | undefined, who: string) =>
  result === 'miss'
    ? `${who === 'Jij' ? 'Plons, in de gracht' : `${who} gooit in de gracht`} 💦`
    : result === 'hit'
      ? `${who === 'Jij' ? 'Splat! Raak' : `${who} raakt je boot!`} 🥞`
      : `${who === 'Jij' ? 'Gezonken' : `${who} liet zinken`}: ${SHIP_NAMES[ship?.cells.length ?? 2]}! ⚓`;

/** The pancake flies, then lands: a splash, a splat, or a boat going down. */
const boom = (result: ShotResult) => {
  playSfx('flip', true);
  window.setTimeout(() => {
    playSfx(result === 'miss' ? 'splash' : 'splat', true);
    if (result === 'sunk') window.setTimeout(() => playSfx('horn', true), 250);
  }, 480);
};

/** You against Coco, on this phone. */
function VsCoco() {
  const me = useMe();
  const [mine, setMine] = useState(() => randomFleet());
  const [hers, setHers] = useState(() => randomFleet());
  const [myShots, setMyShots] = useState<number[]>([]);
  const [herShots, setHerShots] = useState<number[]>([]);
  const [turn, setTurn] = useState<'me' | 'coco'>('me');
  const [line, setLine] = useState(
    'Tik op een vakje in Coco’s gracht om een pannenkoek te gooien 🥞',
  );
  const recorded = useRef(false);
  const won = allSunk(hers, myShots);
  const lost = allSunk(mine, herShots);
  const started = myShots.length > 0;

  useEffect(() => {
    if ((won || lost) && !recorded.current) {
      recorded.current = true;
      recordResult('zeeslag', [me, 'coco'], won ? me : 'coco');
      playSfx(won ? 'success' : 'boing', true);
      if (won) celebrateFrom(document.querySelector('.sea'));
    }
    if (turn !== 'coco' || won || lost) return;
    const t = window.setTimeout(() => {
      const cell = cocoShot(mine, herShots);
      const result = shotResult(mine, herShots, cell);
      setHerShots((s) => [...s, cell]);
      boom(result);
      setLine(
        shotLine(
          result,
          mine.find((s) => s.cells.includes(cell)),
          'Coco',
        ),
      );
      setTurn('me');
    }, 1000);
    return () => window.clearTimeout(t);
  }, [turn, won, lost, mine, herShots, me]);

  const fire = (cell: number) => {
    if (turn !== 'me' || won || lost) return;
    const result = shotResult(hers, myShots, cell);
    setMyShots((s) => [...s, cell]);
    boom(result);
    setLine(
      shotLine(
        result,
        hers.find((s) => s.cells.includes(cell)),
        'Jij',
      ),
    );
    setTurn('coco');
  };

  const restart = () => {
    setMine(randomFleet());
    setHers(randomFleet());
    setMyShots([]);
    setHerShots([]);
    setTurn('me');
    recorded.current = false;
    setLine('Tik op een vakje in Coco’s gracht om een pannenkoek te gooien 🥞');
  };

  return (
    <>
      <TurnBanner
        mine={turn === 'me'}
        name="Coco 🐰🔭"
        note={line}
        done={
          won
            ? 'Al Coco’s pannenkoekenboten liggen op de bodem. Jij wint! ⚓🥞🎉'
            : lost
              ? 'Coco heeft al je schepen gevonden… 🐰👑'
              : undefined
        }
      />
      {turn === 'coco' && !won && !lost && (
        <p className="game-hint" aria-live="polite">
          {line}
        </p>
      )}
      <Sea
        ships={hers}
        shots={myShots}
        showShips={won || lost}
        onFire={turn === 'me' && !won && !lost ? fire : undefined}
        label="Coco’s gracht"
        radar={turn === 'me' && !won && !lost}
      />
      <Sea ships={mine} shots={herShots} showShips label="Jouw vloot" small />
      <div className="game-actions">
        {!started && (
          <button
            type="button"
            className="neon-btn neon-btn--small"
            onClick={() => setMine(randomFleet())}
          >
            🔀 Schud mijn vloot
          </button>
        )}
        <button type="button" className="neon-btn" onClick={restart}>
          {won || lost ? 'Nog een potje' : 'Nieuw potje'}
        </button>
      </div>
    </>
  );
}

/** Place your fleet: shuffle until you like it. */
function Harbour({ onReady, cta }: { onReady: (fleet: Ship[]) => void; cta: string }) {
  const [fleet, setFleet] = useState(() => randomFleet());
  return (
    <div className="game-panel">
      <p>Zo ligt jouw vloot. Schud tot je tevreden bent — de ander ziet hem niet.</p>
      <Sea ships={fleet} shots={[]} showShips label="Jouw vloot" small />
      <div className="game-actions">
        <button
          type="button"
          className="neon-btn neon-btn--small"
          onClick={() => {
            playSfx('whoosh', true);
            setFleet(randomFleet());
          }}
        >
          🔀 Schudden
        </button>
        <button type="button" className="neon-btn" onClick={() => onReady(fleet)}>
          {cta}
        </button>
      </div>
    </div>
  );
}

/** Each on our own phone: the shots travel through the sync. */
function RemoteGame() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const match = useMatch('zeeslag');
  const sea = normalizeSea(match?.state);
  const myShips = sea.ships[me];
  const theirShips = sea.ships[them];
  const heard = useRef('');
  const theirName = nameOf(them, profile);

  // A sound when their shot arrives.
  useEffect(() => {
    const shots = sea.shots[them];
    const key = `${match?.id}-${shots.length}`;
    if (!match || !myShips || !shots.length || heard.current === key) return;
    if (heard.current) boom(shotResult(myShips, shots.slice(0, -1), shots[shots.length - 1]));
    heard.current = key;
  }, [match, myShips, sea.shots, them]);

  const start = (fleet: Ship[]) =>
    startMatch('zeeslag', { ships: { [me]: fleet }, shots: { you: [], partner: [] } }, them, me);

  if (!match || (match.winner && !myShips)) {
    return <Harbour onReady={start} cta="Start zeeslag" />;
  }
  if (!myShips) {
    return (
      <>
        <p className="game-turn is-mine">{theirName} daagt je uit voor zeeslag! ⚓</p>
        <Harbour
          cta="Vloot klaar — vuur!"
          onReady={(fleet) =>
            updateMatch(match.id, (m) => {
              const s = normalizeSea(m.state);
              return { ...m, state: { ...s, ships: { ...s.ships, [me]: fleet } }, turn: me };
            })
          }
        />
      </>
    );
  }

  const myShots = sea.shots[me];
  const mine = Boolean(theirShips && !match.winner && match.turn === me);
  const lastTheirs = sea.shots[them][sea.shots[them].length - 1];

  const fire = (cell: number) => {
    if (!theirShips || !mine) return;
    const result = shotResult(theirShips, myShots, cell);
    boom(result);
    const nextShots = [...myShots, cell];
    const win = allSunk(theirShips, nextShots);
    if (win) {
      playSfx('success', true);
      celebrateFrom(document.querySelector('.sea'));
    }
    updateMatch(match.id, (m) => {
      const s = normalizeSea(m.state);
      return {
        ...m,
        state: { ...s, shots: { ...s.shots, [me]: [...s.shots[me], cell] } },
        turn: them,
        winner: win ? me : undefined,
      };
    });
  };

  return (
    <>
      <TurnBanner
        mine={mine}
        name={theirName}
        note={
          lastTheirs !== undefined
            ? shotLine(
                shotResult(myShips, sea.shots[them].slice(0, -1), lastTheirs),
                myShips.find((s) => s.cells.includes(lastTheirs)),
                theirName,
              ) + ' Jouw beurt ✨'
            : undefined
        }
        done={
          match.winner
            ? match.winner === me
              ? 'Al hun pannenkoekenboten gezonken — jij wint! ⚓🥞🎉'
              : `${theirName} heeft al je schepen gevonden 💕`
            : !theirShips
              ? `Wachten tot ${theirName} de vloot neerlegt…`
              : undefined
        }
      />
      <Sea
        ships={theirShips ?? []}
        shots={myShots}
        showShips={Boolean(match.winner)}
        onFire={mine ? fire : undefined}
        label={`Gracht van ${theirName}`}
        radar={mine}
      />
      <Sea ships={myShips} shots={sea.shots[them]} showShips label="Jouw vloot" small />
      {match.winner && (
        <button type="button" className="neon-btn" onClick={() => start(randomFleet())}>
          Nog een potje
        </button>
      )}
    </>
  );
}

export function Zeeslag() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const results = useContent((c) => c.games);
  const profile = useContent((c) => c.profile);
  const me: Person = useMe();
  const h = headToHead(results, 'zeeslag', 'you', 'partner');
  const coco = headToHead(results, 'zeeslag', me, 'coco');
  return (
    <GameShell
      id="zeeslag"
      title="Pannenkoekenslag"
      mode={mode}
      onMode={setMode}
      score={
        mode === 'coco' ? (
          <ScoreBoard
            label="jij tegen coco"
            entries={[
              { name: 'JIJ', value: coco.a, me: true },
              { name: 'COCO', value: coco.b },
            ]}
          />
        ) : (
          <ScoreBoard
            label="gewonnen"
            entries={[
              { name: profile.yourName.toUpperCase(), value: h.a, me: me === 'you' },
              { name: profile.partnerName.toUpperCase(), value: h.b, me: me === 'partner' },
            ]}
          />
        )
      }
    >
      {mode === 'remote' ? (
        <WhoAreYou>
          <RemoteGame />
        </WhoAreYou>
      ) : (
        <VsCoco />
      )}
    </GameShell>
  );
}
