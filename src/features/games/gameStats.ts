import { updateContent } from '../../data/store';
import type { AppContent, GameId, GameResult, Person, Player, ScoreGame } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { monthName, tournament } from './tickets';

export const GAME_NAMES: Record<GameId, string> = {
  uno: 'UNO',
  c4: '4 op een rij',
  hangman: 'galgje',
  bowling: 'bowlen',
  skeeball: 'skeeball',
  darts: 'darten',
  zeeslag: 'zeeslag',
  memory: 'memory',
  hockey: 'airhockey',
  bingo: 'bingo',
  kwartet: 'Go Fish',
};

/** Writes down how a game ended (once per id, so a match counts once). */
export function recordResult(
  game: GameId,
  players: Player[],
  winner: Player | 'draw',
  id: string = createId('result'),
) {
  updateContent((c) => {
    if (c.games.results.some((r) => r.id === id)) return c;
    const result: GameResult = { id, game, players, winner, at: nowIso() };
    return { ...c, games: { ...c.games, results: [...c.games.results, result].slice(-2000) } };
  });
}

/** Wins of `a` and of `b` in games they played against each other. */
export function headToHead(
  results: GameResult[],
  game: GameId | 'all',
  a: Player,
  b: Player,
): { a: number; b: number; draws: number } {
  const between = results.filter(
    (r) => (game === 'all' || r.game === game) && r.players.includes(a) && r.players.includes(b),
  );
  return {
    a: between.filter((r) => r.winner === a).length,
    b: between.filter((r) => r.winner === b).length,
    draws: between.filter((r) => r.winner === 'draw').length,
  };
}

const bestScore = (c: AppContent, game: ScoreGame, who: Person) => {
  const mine = c.games.scores.filter((s) => s.game === game && s.who === who).map((s) => s.score);
  return mine.length ? Math.max(...mine) : null;
};

export const cocoBest = (c: AppContent, game: ScoreGame) => {
  const hers = c.games.scores
    .filter((s) => s.game === game && s.who === 'coco')
    .map((s) => s.score);
  return hers.length ? Math.max(...hers) : null;
};

type Rng = () => number;
const pick = <T>(list: T[], rng: Rng) => list[Math.floor(rng() * list.length) % list.length];

/** One thing to brag about between the two of us (the one who leads says it). */
export function gameBrag(
  c: AppContent,
  rng: Rng,
): { leader: Person; text: string; reply: string } | null {
  const options: { leader: Person; text: string; reply: string }[] = [];
  const crown = (p: Person) => (p === 'partner' ? 'queen' : 'king');
  const replies = [
    'Dat was geluk. Revanche vanavond.',
    'Ik laat je gewoon winnen, {pet} 😌',
    'Wacht maar. Ik ben aan het trainen.',
    'Oké oké… nog één potje?',
    'Pff. Volgende keer ben jij de sjaak.',
  ];
  for (const game of [
    'uno',
    'c4',
    'hangman',
    'zeeslag',
    'darts',
    'memory',
    'hockey',
    'bingo',
    'kwartet',
    'skeeball',
    'bowling',
  ] as GameId[]) {
    const h = headToHead(c.games.results, game, 'you', 'partner');
    if (h.a + h.b === 0) continue;
    if (h.a === h.b) {
      options.push({
        leader: rng() < 0.5 ? 'you' : 'partner',
        text: `${h.a}–${h.b} bij ${GAME_NAMES[game]}… dit wordt een finale, {pet}.`,
        reply: 'Bring it on.',
      });
      continue;
    }
    const leader: Person = h.a > h.b ? 'you' : 'partner';
    const wins = Math.max(h.a, h.b);
    const losses = Math.min(h.a, h.b);
    const texts: Record<GameId, string[]> = {
      uno: [
        `Ik ben de UNO-${crown(leader)} 👑 Ik heb je al ${wins} keer verslagen, {pet}.`,
        `UNO: ${wins}–${losses} voor mij. Gewoon even zeggen, {pet} 😌`,
      ],
      c4: [
        `4 op een rij: ${wins}–${losses} voor mij 😎`,
        `Ik zie jouw vier al van ver aankomen, {pet}. ${wins} keer gewonnen!`,
      ],
      hangman: [
        `Jouw woorden raad ik toch wel, {pet} 🎈 Al ${wins} keer!`,
        `Galgje-kampioen hier. ${wins}–${losses}.`,
      ],
      zeeslag: [
        `Admiraal ${wins}–${losses}, {pet} ⚓ Jouw vloot ligt op de bodem.`,
        `Zeeslag: ${wins} keer jouw schepen gezonken. Sorry niet sorry 🚢`,
      ],
      darts: [
        `Darten: ${wins}–${losses} voor mij 🎯 Ik gooi gewoon raak.`,
        `Ik ben de dart-${crown(leader)}, {pet}. ${wins} keer gewonnen!`,
      ],
      memory: [
        `Memory: ${wins}–${losses} voor mij 🧠 Ik onthoud gewoon alles van ons.`,
        `Ik vind onze foto’s sneller dan jij, {pet}. ${wins} keer gewonnen!`,
      ],
      hockey: [
        `Airhockey: ${wins}–${losses}. Mijn schot is niet te stoppen 🏒`,
        `${wins} keer gescoord tegen jou… ik bedoel gewonnen. Allebei eigenlijk 😏`,
      ],
      bingo: [
        `BINGO! ${wins} keer voor mij, {pet} 🎱`,
        `Bingo: ${wins}–${losses}. Ik heb gewoon de geluksballen.`,
      ],
      kwartet: [
        `Go Fish: ${wins}–${losses} voor mij 🐟 Ik vis ze er allemaal uit.`,
        `Heb jij misschien een koning? Nee? Go Fish! Ik won al ${wins} keer 🦈`,
      ],
      bowling: [
        `Bowlingduel: ${wins}–${losses} voor mij 🎳`,
        `${wins} duels gewonnen op de baan, {pet}. Strike!`,
      ],
      skeeball: [
        `Skeeball-duel: ${wins}–${losses} voor mij 🎟️`,
        `Ik won al ${wins} skeeball-duels, {pet}. Mik maar beter 😌`,
      ],
    };
    options.push({ leader, text: pick(texts[game], rng), reply: pick(replies, rng) });
  }
  for (const game of ['bowling', 'skeeball', 'darts'] as const) {
    const a = bestScore(c, game, 'you');
    const b = bestScore(c, game, 'partner');
    if (a === null || b === null || a === b) continue;
    const leader: Person = a > b ? 'you' : 'partner';
    const mine = Math.max(a, b);
    const theirs = Math.min(a, b);
    options.push({
      leader,
      text:
        game === 'bowling'
          ? `Mijn bowlingrecord: ${mine}. Het jouwe: ${theirs}. Just saying 🎳`
          : game === 'darts'
            ? `${mine} punten met darten, {pet}. Probeer dat maar eens te kloppen 🎯`
            : `${mine} punten bij skeeball, {pet}. Kom maar op 🎟️`,
      reply: pick(replies, rng),
    });
  }
  // Last month's champion doesn't let anyone forget it.
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 7);
  const champ = tournament(c.games.results).find((m) => m.month === prev && m.champion);
  if (champ?.champion) {
    options.push({
      leader: champ.champion,
      text: `Ik was kampioen van ${monthName(prev)} 🏆 ${Math.max(champ.you, champ.partner)}–${Math.min(champ.you, champ.partner)}, {pet}.`,
      reply: pick(replies, rng),
    });
  }
  if (!options.length) return null;
  const choice = pick(options, rng);
  return { ...choice, reply: choice.reply };
}

/** What Coco says about her games against `me`. */
export function cocoGameTalk(c: AppContent, me: Person, name: string, rng: Rng): string | null {
  const lines: string[] = [];
  for (const game of [
    'uno',
    'c4',
    'hangman',
    'zeeslag',
    'darts',
    'memory',
    'hockey',
    'bingo',
    'kwartet',
  ] as GameId[]) {
    const h = headToHead(c.games.results, game, me, 'coco');
    if (h.a + h.b === 0) continue;
    const g = GAME_NAMES[game];
    if (h.b > h.a) lines.push(`Ik heb je al ${h.b} keer verslagen met ${g} 🐰👑`);
    else if (h.a > h.b) lines.push(`Jij won al ${h.a} keer van mij met ${g}… ik oefen stiekem 🥕`);
    else lines.push(`${h.a}–${h.b} met ${g}, ${name}. Revanche?`);
  }
  for (const game of ['bowling', 'skeeball', 'darts'] as const) {
    const mine = cocoBest(c, game);
    if (mine !== null) lines.push(`Mijn ${game}record is ${mine}. Met mijn pootjes!`);
  }
  if (!lines.length) return rng() < 0.5 ? 'Spelen we straks een potje in de Arcade Hall?' : null;
  return pick(lines, rng);
}
