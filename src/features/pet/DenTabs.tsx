import { Check, Heart, House, Lock } from 'lucide-react';
import { updatePrefs, useContent, usePrefs } from '../../data/store';
import { nameOf } from '../../data/people';
import type { PetDecor, PetOutfit, PetTrick } from '../../data/types';
import { plural } from '../../lib/dates';
import { Bunny } from './Bunny';
import { MEDALS, type Streak } from './streak';
import { sendCocoHome } from './home';
import { CareDiary as CareDiaryList, TrainTray, bondNames } from './DenPanels';
import {
  BOND_LEVELS,
  DECOR,
  DECOR_ORDER,
  OUTFITS,
  carrotsOf,
  mannersLevel,
  outfitUnlocked,
  roundOf,
  type bondLevel,
} from './care';

/** The tabs under Coco's room. */

export type DenTab = 'care' | 'tricks' | 'wardrobe' | 'diary' | 'about';

export const DEN_TABS: { id: DenTab; label: string; emoji: string }[] = [
  { id: 'care', label: 'Verzorgen', emoji: '🥕' },
  { id: 'tricks', label: 'Trucjes', emoji: '🎓' },
  { id: 'wardrobe', label: 'Kledingkast', emoji: '🎀' },
  { id: 'diary', label: 'Dagboek', emoji: '📖' },
  { id: 'about', label: 'Over Coco', emoji: '🐰' },
];

/** What each bond level brings. */
const UNLOCKS: Record<number, string> = {
  1: 'Strikje',
  2: 'Bloemenkroontje · ze ploft bij je neer',
  3: 'Sjaaltje',
  4: 'Feesthoedje',
};

export function CareTab({
  bond,
  wellbeing,
  streak,
  hint,
}: {
  bond: ReturnType<typeof bondLevel>;
  wellbeing: number;
  streak: Streak;
  hint: boolean;
}) {
  const pet = useContent((c) => c.pet);
  const profile = useContent((c) => c.profile);
  const { companion } = usePrefs();
  const round = roundOf(pet);
  const doneCount = round.filter((r) => r.done).length;
  const nextLevel = BOND_LEVELS[bond.index + 1];
  return (
    <div className="den-panel">
      <section className="den-card den-card--round" aria-labelledby="den-round">
        <h3 id="den-round" className="den-card__title">
          Rondje van vandaag
          <span className="den-card__count">
            {doneCount}/{round.length}
          </span>
        </h3>
        <ul className="den-round">
          {round.map((r) => (
            <li key={r.key} className={r.done ? 'is-done' : undefined}>
              <span className="den-round__tick" aria-hidden="true">
                {r.done && <Check />}
              </span>
              <span>{r.label}</span>
              <span className="den-round__by">
                {r.done ? (r.by ? nameOf(r.by, profile) : 'gedaan') : 'nog doen'}
              </span>
            </li>
          ))}
        </ul>
        {doneCount === round.length && (
          <p className="den-card__note">Alles gedaan vandaag — wat heeft Coco het goed bij jullie ♡</p>
        )}
      </section>

      <section className="den-card" aria-labelledby="den-bond">
        <h3 id="den-bond" className="den-card__title">
          <Heart aria-hidden="true" /> Jullie band: {bond.name}
        </h3>
        <span
          className="den__bond-bar"
          role="meter"
          aria-label="Band met Coco"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(bond.progress * 100)}
        >
          <span style={{ width: `${Math.round(bond.progress * 100)}%` }} />
        </span>
        <p className="den-card__note">
          {nextLevel
            ? `Nog ${plural(Math.max(0, nextLevel.min - pet.bond), 'hartje', 'hartjes')} tot ${nextLevel.name}.`
            : 'Ze is helemaal family. Meer liefde kan niet.'}{' '}
          Hoe gaat het met haar: {wellbeing}%.
        </p>
        <ol className="den-levels">
          {BOND_LEVELS.map((l, i) => (
            <li key={l.name} className={i <= bond.index ? 'is-reached' : undefined}>
              <span className="den-levels__name">{l.name}</span>
              {UNLOCKS[i] && <span className="den-levels__gift">{UNLOCKS[i]}</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="den-card" aria-labelledby="den-streak">
        <h3 id="den-streak" className="den-card__title">
          {streak.current > 0
            ? `🔥 ${plural(streak.current, 'dag', 'dagen')} op rij verzorgd`
            : '🔥 Begin vandaag een verzorg-reeks'}
        </h3>
        <p className="den-card__note">
          {streak.current > 0 && !streak.caredToday
            ? 'Zorg vandaag voor haar, dan loopt de reeks door.'
            : streak.next
              ? `Nog ${plural(streak.next.days - streak.current, 'dag', 'dagen')} tot ${streak.next.emoji} ${streak.next.name}.`
              : 'Alle medailles verdiend 👑'}
          {streak.best > streak.current && ` Langste reeks: ${streak.best} dagen.`}
        </p>
        <ul className="den__medals" aria-label="Medailles">
          {MEDALS.map((m) => {
            const earned = streak.best >= m.days;
            return (
              <li
                key={m.days}
                className={earned ? 'is-earned' : undefined}
                title={`${m.name} · ${m.days} dagen op rij`}
              >
                <span aria-hidden="true">{m.emoji}</span>
                <span className="visually-hidden">
                  {m.name}, {m.days} dagen: {earned ? 'verdiend' : 'nog niet'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {hint && (
        <p className="den__hint">
          Tip: tik op de vloer en ze hupt erheen · tik op haar hooirek om bij te vullen · tik
          keuteltjes weg · sleep haar eten naar haar toe · zwiep haar balletje
        </p>
      )}

      {companion ? (
        <div className="den__along">
          <p>
            <Heart aria-hidden="true" /> Coco hupt op elke pagina met je mee.
          </p>
          <button
            type="button"
            className="btn btn--quiet btn--small"
            onClick={() => sendCocoHome('/coco')}
          >
            <House aria-hidden="true" /> Laat haar thuis
          </button>
        </div>
      ) : (
        <div className="den__along">
          <p>
            <House aria-hidden="true" /> Coco is thuis in haar hokje — dat staat ergens verstopt in
            ons universe en piept aan de rand van een van de pagina’s. Vind het om haar weer mee te
            nemen.
          </p>
          <button
            type="button"
            className="link-btn"
            onClick={() => updatePrefs({ companion: true, cocoHome: undefined })}
          >
            Of roep haar gewoon terug
          </button>
        </div>
      )}
    </div>
  );
}

export function TricksTab({
  busy,
  reduce,
  onStart,
  onShow,
}: {
  busy: boolean;
  reduce: boolean;
  onStart: (trick: PetTrick) => void;
  onShow: (trick: PetTrick) => void;
}) {
  const pet = useContent((c) => c.pet);
  return (
    <div className="den-panel">
      <section className="den-card" aria-labelledby="den-tricks">
        <h3 id="den-tricks" className="den-card__title">
          Trucjes leren
        </h3>
        <p className="den-card__note">
          Kies een trucje, en druk op “Klik &amp; beloon” precies als het streepje in het roze vak
          staat. Hoe beter je timing, hoe sneller ze het leert.
        </p>
        <TrainTray
          tricks={pet.tricks}
          active={null}
          busy={busy}
          reduce={reduce}
          onStart={onStart}
          onRep={() => {}}
          onShow={onShow}
          onStop={() => {}}
        />
      </section>
      <section className="den-card" aria-labelledby="den-manners">
        <h3 id="den-manners" className="den-card__title">
          🎓 Opvoeding: {mannersLevel(pet.manners)}
        </h3>
        <span
          className="den__bond-bar"
          role="meter"
          aria-label="Hoe goed opgevoed Coco is"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pet.manners}
        >
          <span style={{ width: `${pet.manners}%` }} />
        </span>
        <p className="den-card__note">
          Soms haalt ze kattenkwaad uit — dan zie je het in haar kamer. Een lieve, slimme reactie
          leert haar het meest.
        </p>
      </section>
    </div>
  );
}

export function WardrobeTab({
  isBirthday,
  busy,
  onDress,
  onBuy,
  seasonLine,
}: {
  isBirthday: boolean;
  busy: boolean;
  onDress: (outfit: PetOutfit) => void;
  onBuy: (item: PetDecor) => void;
  seasonLine?: React.ReactNode;
}) {
  const pet = useContent((c) => c.pet);
  const carrots = carrotsOf(pet);
  return (
    <div className="den-panel">
      <section className="den-card" aria-labelledby="den-outfits">
        <h3 id="den-outfits" className="den-card__title">
          Aankleden
        </h3>
        {seasonLine}
        <div className="den-options den-options--outfits">
          {(Object.keys(OUTFITS) as PetOutfit[]).map((o) => {
            const unlocked = outfitUnlocked(o, pet.bond, isBirthday);
            return (
              <button
                key={o}
                type="button"
                className={`den-option${pet.outfit === o ? ' is-active' : ''}`}
                aria-pressed={pet.outfit === o}
                disabled={!unlocked || busy}
                onClick={() => onDress(o)}
              >
                <svg viewBox="-60 -95 120 100" aria-hidden="true" className="den-option__art">
                  <Bunny pose="sit" outfit={o} shadow={false} />
                </svg>
                <span>{OUTFITS[o].label}</span>
                {!unlocked && (
                  <span className="den-option__lock">
                    <Lock aria-hidden="true" />
                    {o === 'party'
                      ? 'verjaardag of Family'
                      : `band: ${bondNames[OUTFITS[o].level]}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="den-card den-shop" aria-labelledby="den-shop">
        <h3 id="den-shop" className="den-card__title">
          Haar kamer inrichten
          <span className="den-card__count">🥕 {carrots}</span>
        </h3>
        <p className="den-card__note">
          Elk hartje dat jullie verdienen met zorgen is ook een worteltje. Wat je koopt komt meteen
          in haar kamer te staan — op allebei jullie telefoons.
        </p>
        <ul className="den-shop__list">
          {DECOR_ORDER.map((id) => {
            const item = DECOR[id];
            const owned = pet.decor.includes(id);
            const short = item.price - carrots;
            return (
              <li key={id} className={owned ? 'is-owned' : undefined}>
                <span className="den-shop__emoji" aria-hidden="true">
                  {item.emoji}
                </span>
                <span className="den-shop__name">{item.label}</span>
                {owned ? (
                  <span className="tag">in haar kamer ✓</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn--soft btn--small"
                    disabled={short > 0 || busy}
                    onClick={() => onBuy(id)}
                    aria-label={`${item.label} kopen voor ${item.price} worteltjes`}
                  >
                    🥕 {item.price}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export function DiaryTab() {
  const log = useContent((c) => c.pet.log);
  const profile = useContent((c) => c.profile);
  const mine = log.filter((e) => e.by === 'you').length;
  const hers = log.filter((e) => e.by === 'partner').length;
  return (
    <div className="den-panel">
      <section className="den-card" aria-labelledby="den-diary">
        <h3 id="den-diary" className="den-card__title">
          Zorgdagboek
        </h3>
        {log.length > 0 && (
          <p className="den-card__note">
            Van de laatste {log.length}: {nameOf('you', profile)} {mine}× ·{' '}
            {nameOf('partner', profile)} {hers}×. Samen zorgen ♡
          </p>
        )}
        <CareDiaryList limit={30} />
      </section>
    </div>
  );
}
