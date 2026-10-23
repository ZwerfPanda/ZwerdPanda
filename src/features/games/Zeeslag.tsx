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

/** Which piece of a hull a cell is, so ships look like ships. */
function hullOf(ships: Ship[], cell: number): string | null {
  const ship = ships.find((s) => s.cells.includes(cell));
  if (!ship) return null;
  const across = ship.cells.length > 1 && ship.cells[1] - ship.cells[0] === 1;
  const k = ship.cells.indexOf(cell);
  const part = k === 0 ? 'start' : k === ship.cells.length - 1 ? 'end' : 'mid';
  return `hull hull--${across ? 'h' : 'v'} hull--${part}`;
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
      <div className="sea__grid" role="group" aria-label={label}>
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const shot = shots.includes(i);
          const hit = shot && ships.some((s) => s.cells.includes(i));
          const hull = hullOf(visible, i);
          const isSunkCell = sunk.some((s) => s.cells.includes(i));
          const cls = [
            'sea__cell',
            hull,
            shot ? (hit ? 'is-hit' : 'is-miss') : '',
            isSunkCell ? 'is-sunk' : '',
            i === last ? 'is-new' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const state = shot ? (isSunkCell ? 'gezonken' : hit ? 'raak' : 'mis') : 'water';
          return onFire && !shot ? (
            <button
              key={i}
              type="button"
              className={cls}
              aria-label={`${cellName(i)}: vuur`}
              data-sfx="none"
              onClick={() => onFire(i)}
            />
          ) : (
            <span key={i} className={cls} role="img" aria-label={`${cellName(i)}: ${state}`} />
          );
        })}
        {radar && <span className="sea__radar" aria-hidden="true" />}
      </div>
    </div>
  );
}

const shotLine = (result: ShotResult, ship: Ship | undefined, who: string) =>
  result === 'miss'
    ? `${who === 'Jij' ? 'Mis' : `${who} schiet mis`} 💦`
    : result === 'hit'
      ? `${who === 'Jij' ? 'Raak!' : `${who} raakt je schip!`} 💥`
      : `${who === 'Jij' ? 'Gezonken' : `${who} liet zinken`}: ${SHIP_NAMES[ship?.cells.length ?? 2]}! 🚢`;

const boom = (result: ShotResult) =>
  playSfx(result === 'miss' ? 'whoosh' : result === 'sunk' ? 'star' : 'pop', true);

/** You against Coco, on this phone. */
function VsCoco() {
  const me = useMe();
  const [mine, setMine] = useState(() => randomFleet());
  const [hers, setHers] = useState(() => randomFleet());
  const [myShots, setMyShots] = useState<number[]>([]);
  const [herShots, setHerShots] = useState<number[]>([]);
  const [turn, setTurn] = useState<'me' | 'coco'>('me');
  const [line, setLine] = useState('Kies een vakje in Coco’s zee om te vuren.');
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
    setLine('Kies een vakje in Coco’s zee om te vuren.');
  };

  return (
    <>
      <TurnBanner
        mine={turn === 'me'}
        name="Coco 🐰🔭"
        note={line}
        done={
          won
            ? 'Coco’s hele vloot ligt op de bodem. Jij wint! ⚓🎉'
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
        label="Coco’s zee"
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
              ? 'Hun hele vloot gezonken — jij wint! ⚓🎉'
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
        label={`Zee van ${theirName}`}
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
  const results = useContent((c) => c.games.results);
  const profile = useContent((c) => c.profile);
  const me: Person = useMe();
  const h = headToHead(results, 'zeeslag', 'you', 'partner');
  const coco = headToHead(results, 'zeeslag', me, 'coco');
  return (
    <GameShell
      id="zeeslag"
      title="Zeeslag"
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
