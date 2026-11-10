/*
 * Lingo: guess a five-letter word in five tries. The first letter is given;
 * after each try a letter in the right place turns red (a square), a letter
 * that's in the word but elsewhere gets a yellow circle. A round is five
 * words; the sooner you guess, the more points.
 */

export const WORD_LENGTH = 5;
export const TRIES = 5;
export const ROUND_WORDS = 5;

/** Words to guess: everyday Dutch, and a few of ours. No "ij" (that's one letter in Lingo). */
export const WORDS = `
aarde actie adres agent akker appel avond baard bakje bakken balen balie banen bange
basis beeld beker beren bezem  bijna bloem blond bloes boete bomen boord boten
bouwt brand brood bruin buren buurt cadet chips cirkel clown dader dagen daken dalen
dansen datum deken delen dieet dient dikke diner dingen dokter dolfijn draad drama
dreef droog druif duiken duwen eerst egels eigen eitje enkel feest fiets films fluit
foto's  fruit gaven geest geluk geven gezin glans glazen  goede gouden graag
grond groot gulle haast halen hallo handen haren hart hemel heren hobby honden hoofd
hoorn horen hotel huren hutje  jagen jarig jassen  jonge jurken kaars kaart
kamer kanon kapot karton kaars kasten katje keuken kiezen kikker  klant kleur
klimt klink klok knoop koken komen koord kopje korst koude kraan krant kreeft kroon
kruis kusje kussen laden lachen lager lampen landen lange later leden leeuw lente
lepel leren leuke lezen licht liefs liter lokaal lopen lucht maand maart magie malen
mango markt meeuw  menen meter middag modder molen  motor muren muziek
nacht naald  nemen netjes nieuw noten  oever olijf  oogst ophef oogje
paard pakje panda papier parel pasta pauze peren piano pizza plank plant plein ploeg
poesje poten praat prins proef proost pruik puber raden radio regen reizen ridder
rijst rente roman rondje rozen ruzie saaie samen schaal schat scherp schip schoen
sjaal slaap slang sloep smaak snoep sokken spaak spelen spoor stoel storm straat
strand stuur suiker taart tafel tante tegel thuis tijger toast toren trein trouw
tulpen tuinen uiten uitje vaker varen veren vezel video vinger visje vlag vloer
vogel volle vrede vriend vroeg wafel water weide wenst wereld werken wiegje wolken
woord wortel zeilen zebra zegel zeven zilver zoete zomer  zwaan zwart
alarm alles angst arena armen baden baken balk bloed bocht  boven brief broek
bonen busje dames dansje degen denken dorst draak dweil emmer etage fabel 
gamba gebak gedoe geel gilde gitaar glimp gordel graan grens haard haken hamer
hapje haver hevig hoest honing horde jacht japon kabel kajak kalf kapel kerel 
klomp knie koala kogel kokos koper krab kroeg kuil lades lamp leger lelie linde
lokje luier mager melig  mooie motto mouw neus nicht nooit ochtend  
omhoog oranje paars pagina pater pinda pluim pomp poort pracht pret raket ramen
recht ronde ruiter sauna  sigaar  slaan sneeuw snor spijt spons stad steen
stralen stoep stoom tabak takje tekst tenen thema tijd titel toets tomaat touw tranen
 uilen  vacht vaten verf vijver vlees vlucht vorst vracht wagen wanten
wazig weken welke wesp wiel wilde winst wolf wonen worst zadel zalm zeep zicht zoals
zonde zucht
`
  .split(/\s+/)
  .filter((w, i, all) => /^[a-z]{5}$/.test(w) && !w.includes('ij') && all.indexOf(w) === i);

export type Mark = 'right' | 'near' | 'miss';

/** How a guess scores against the word (letters counted, like the real game). */
export function judge(guess: string, word: string): Mark[] {
  const g = guess.toLowerCase().split('');
  const w = word.toLowerCase().split('');
  const marks: Mark[] = g.map((ch, i) => (ch === w[i] ? 'right' : 'miss'));
  const left = new Map<string, number>();
  w.forEach((ch, i) => {
    if (marks[i] !== 'right') left.set(ch, (left.get(ch) ?? 0) + 1);
  });
  g.forEach((ch, i) => {
    if (marks[i] === 'right') return;
    const n = left.get(ch) ?? 0;
    if (n > 0) {
      marks[i] = 'near';
      left.set(ch, n - 1);
    }
  });
  return marks;
}

/** A tiny seeded random, so both of us get the same words in a duel. */
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The five words of a round. */
export function roundWords(seed: string): string[] {
  const rng = seeded(seed);
  const pool = [...WORDS];
  const out: string[] = [];
  while (out.length < ROUND_WORDS && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

/** Points for a word: more for fewer tries, a little for speed. Not guessed: 0. */
export function wordPoints(tries: number | null, seconds: number): number {
  if (tries === null) return 0;
  const base = 100 - (tries - 1) * 20;
  const speed = Math.max(0, 20 - Math.floor(seconds / 3));
  return base + speed;
}

/** What's known about each letter so far, for the keyboard. */
export function letterHints(guesses: string[], word: string): Map<string, Mark> {
  const rank: Record<Mark, number> = { miss: 0, near: 1, right: 2 };
  const out = new Map<string, Mark>();
  for (const g of guesses) {
    judge(g, word).forEach((m, i) => {
      const ch = g[i];
      const was = out.get(ch);
      if (!was || rank[m] > rank[was]) out.set(ch, m);
    });
  }
  return out;
}

/** Coco plays a round too: quick guesses, sometimes lucky, sometimes not at all. */
export function cocoLingo(rng: () => number = Math.random): number {
  let total = 0;
  for (let i = 0; i < ROUND_WORDS; i++) {
    const roll = rng();
    const tries = roll < 0.12 ? null : roll < 0.3 ? 5 : roll < 0.55 ? 4 : roll < 0.85 ? 3 : 2;
    total += wordPoints(tries, 8 + rng() * 40);
  }
  return total;
}
