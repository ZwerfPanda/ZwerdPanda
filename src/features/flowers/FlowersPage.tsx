import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Heart, Pencil, Plus, Trash2 } from 'lucide-react';
import { getContent, useContent } from '../../data/store';
import { getAuthor, nameOf, sweetName, useMe } from '../../data/people';
import type { Bouquet, MediaSource } from '../../data/types';
import { patchItem, removeItem, restoreItem, upsertItem } from '../../data/actions';
import { Dialog } from '../../components/ui/Dialog';
import { TextArea, TextField } from '../../components/ui/Fields';
import { MediaPicker } from '../../components/media/MediaPicker';
import { MediaView } from '../../components/media/MediaView';
import { celebrateFrom, confirm, toast } from '../../components/ui/feedback';
import { SiteFooter } from '../../components/common/SiteFooter';
import { useReducedMotion } from '../../hooks/useMotion';
import { createId, nowIso } from '../../lib/id';
import { formatDate } from '../../lib/dates';
import { playSfx } from '../../lib/audio/sfx';
import { FLOWER_KINDS, OCCASIONS, VASES, byDate, byYear, emojiFor, shopStats } from './flowers';
import { Vase } from './Vase';
import './flowers.css';

type View = 'shop' | 'book' | 'favorites';

/**
 * Her flower shop: every bouquet he gave her stands in a vase on the shelves,
 * with the photo she took, the day, the occasion and the little card.
 */
export function FlowersPage() {
  const flowers = useContent((c) => c.flowers);
  const profile = useContent((c) => c.profile);
  const petNames = useContent((c) => c.us.petNames);
  const me = useMe();
  const hers = me === 'partner';
  const [view, setView] = useState<View>('shop');
  const [open, setOpen] = useState<Bouquet | null>(null);
  const [form, setForm] = useState<{ open: boolean; bouquet: Bouquet | null; focusCard?: boolean }>(
    { open: false, bouquet: null },
  );
  const stats = shopStats(flowers);
  const sorted = byDate(flowers);
  const shown = view === 'favorites' ? sorted.filter((b) => b.favorite) : sorted;
  const current = open ? (flowers.find((b) => b.id === open.id) ?? null) : null;

  return (
    <div className="page flowers">
      <header className="shop-front">
        <div className="shop-front__awning" aria-hidden="true" />
        <div className="shop-front__body">
          <p className="shop-front__eyebrow hand">
            {hers ? 'van jou, voor altijd' : 'al jouw bloemen voor haar'}
          </p>
          <h1 className="shop-front__name">
            {profile.partnerName}’s <em>Bloemenwinkeltje</em>
          </h1>
          <motion.span
            className="shop-front__open"
            aria-hidden="true"
            animate={{ rotate: [-4, 4, -4] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            OPEN ♡
          </motion.span>
          <p className="shop-front__stats">
            {stats.count === 0
              ? `Nog geen boeketten op de plank`
              : `${stats.count} ${stats.count === 1 ? 'boeket' : 'boeketten'} van ${sweetName('you', me, petNames, profile)}${stats.since ? ` · sinds ${formatDate(stats.since)}` : ''}${stats.topFlower ? ` · meestal ${stats.topFlower.toLowerCase()} ${emojiFor(stats.topFlower)}` : ''}`}
          </p>
        </div>
      </header>

      <div className="flowers__bar">
        <div className="chip-row" role="tablist" aria-label="Hoe bekijken we ze?">
          {(
            [
              ['shop', '🏪 Winkeltje'],
              ['book', '📖 Bloemenboek'],
              ['favorites', '⭐ Favorieten'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="chip"
              aria-selected={view === id}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setForm({ open: true, bouquet: null })}
        >
          <Plus aria-hidden="true" /> Boeket toevoegen
        </button>
      </div>

      {flowers.length === 0 ? (
        <EmptyShop
          hers={hers}
          yourName={profile.yourName}
          partnerName={profile.partnerName}
          onAdd={() => setForm({ open: true, bouquet: null })}
        />
      ) : view === 'book' ? (
        <Herbarium flowers={flowers} onOpen={setOpen} />
      ) : shown.length === 0 ? (
        <p className="notice notice--plain">
          Nog geen favorieten. Tik op een boeket en geef het een hartje.
        </p>
      ) : (
        <Shelves flowers={shown} onOpen={setOpen} />
      )}

      <BouquetCard
        bouquet={current}
        onClose={() => setOpen(null)}
        onEdit={(b, focusCard) => {
          setOpen(null);
          setForm({ open: true, bouquet: b, focusCard });
        }}
      />
      <BouquetForm
        open={form.open}
        bouquet={form.bouquet}
        focusCard={form.focusCard}
        onClose={() => setForm({ open: false, bouquet: null })}
      />
      <SiteFooter />
    </div>
  );
}

function EmptyShop({
  hers,
  yourName,
  partnerName,
  onAdd,
}: {
  hers: boolean;
  yourName: string;
  partnerName: string;
  onAdd: () => void;
}) {
  return (
    <div className="shop-empty">
      <ul className="shelves" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="shelf-slot shelf-slot--empty">
            <Vase index={i * 2} />
          </li>
        ))}
      </ul>
      <p>
        {hers
          ? `Hier komen al je boeketten van ${yourName}. Maak een foto van je bloemen en zet ze op de plank 💐`
          : `Hier komen alle boeketten die je ${partnerName} gaf. Zij kan er foto’s van toevoegen — jij ook.`}
      </p>
      <button type="button" className="btn btn--primary" onClick={onAdd}>
        <Plus aria-hidden="true" /> Eerste boeket op de plank
      </button>
    </div>
  );
}

/** The shop shelves: a vase per bouquet, three to a plank. */
function Shelves({ flowers, onOpen }: { flowers: Bouquet[]; onOpen: (b: Bouquet) => void }) {
  const reduce = useReducedMotion();
  return (
    <ul className="shelves">
      {flowers.map((b, i) => (
        <motion.li
          key={b.id}
          className="shelf-slot"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 9) * 0.05 }}
        >
          <button
            type="button"
            className="bouquet"
            style={{ '--sway-delay': `${(i % 5) * -0.7}s` } as React.CSSProperties}
            onClick={() => {
              playSfx('chime', true);
              onOpen(b);
            }}
            aria-label={`Boeket${b.occasion ? ` voor ${b.occasion.toLowerCase()}` : ''}${b.date ? `, ${formatDate(b.date)}` : ''}`}
          >
            <BouquetHead bouquet={b} />
            <Vase index={b.vase} />
            {b.favorite && (
              <span className="bouquet__fav" aria-hidden="true">
                ★
              </span>
            )}
            <span className="bouquet__tag">
              {b.date ? formatDate(b.date, 'short') : (b.occasion ?? 'Boeket')}
            </span>
          </button>
        </motion.li>
      ))}
    </ul>
  );
}

/** The flowers on top of a vase: her photo in a soft bouquet shape, or little flowers. */
function BouquetHead({ bouquet }: { bouquet: Bouquet }) {
  return (
    <span className="bouquet__head">
      <svg className="bouquet__leaves" viewBox="0 0 100 100" aria-hidden="true">
        <g fill="#6fa868">
          <ellipse cx="16" cy="66" rx="17" ry="7" transform="rotate(-32 16 66)" />
          <ellipse cx="84" cy="66" rx="17" ry="7" transform="rotate(32 84 66)" />
          <ellipse cx="10" cy="44" rx="14" ry="6" transform="rotate(-62 10 44)" fill="#5f9b5a" />
          <ellipse cx="90" cy="44" rx="14" ry="6" transform="rotate(62 90 44)" fill="#5f9b5a" />
          <ellipse cx="30" cy="86" rx="14" ry="6" transform="rotate(-12 30 86)" fill="#7bb373" />
          <ellipse cx="70" cy="86" rx="14" ry="6" transform="rotate(12 70 86)" fill="#7bb373" />
        </g>
        <g fill="#fff">
          {[
            [8, 30],
            [92, 30],
            [4, 56],
            [96, 56],
            [20, 18],
            [80, 18],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" />
          ))}
        </g>
      </svg>
      {bouquet.media ? (
        <span className="bouquet__photo">
          <MediaView source={bouquet.media} alt="" />
        </span>
      ) : (
        <span className="bouquet__emoji" aria-hidden="true">
          {(bouquet.flowers.length ? bouquet.flowers : ['Gemengd'])
            .slice(0, 3)
            .flatMap((f) => [emojiFor(f), emojiFor(f)])
            .slice(0, 5)
            .map((e, i) => (
              <span key={i}>{e}</span>
            ))}
        </span>
      )}
    </span>
  );
}

/** The herbarium: pressed-flower pages, a year at a time. */
function Herbarium({ flowers, onOpen }: { flowers: Bouquet[]; onOpen: (b: Bouquet) => void }) {
  return (
    <div className="herbarium">
      {byYear(flowers).map(({ year, items }) => (
        <section key={year} aria-labelledby={`year-${year}`}>
          <h2 id={`year-${year}`} className="herbarium__year">
            {year} <span>{items.length} 💐</span>
          </h2>
          <ul className="herbarium__pages">
            {items.map((b, i) => (
              <li
                key={b.id}
                style={{ '--tilt': `${[-2, 1.5, -1, 2][i % 4]}deg` } as React.CSSProperties}
              >
                <button type="button" className="pressed" onClick={() => onOpen(b)}>
                  <span className="pressed__tape" aria-hidden="true" />
                  <span className="pressed__photo">
                    {b.media ? (
                      <MediaView source={b.media} alt="" />
                    ) : (
                      <span className="pressed__emoji" aria-hidden="true">
                        {b.flowers.map(emojiFor).join('') || '💐'}
                      </span>
                    )}
                  </span>
                  <span className="pressed__label">
                    <strong>{b.occasion ?? 'Zomaar'}</strong>
                    <small>
                      {b.date ? formatDate(b.date) : 'zonder datum'}
                      {b.flowers.length ? ` · ${b.flowers.join(', ').toLowerCase()}` : ''}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BouquetCard({
  bouquet,
  onClose,
  onEdit,
}: {
  bouquet: Bouquet | null;
  onClose: () => void;
  onEdit: (b: Bouquet, focusCard?: boolean) => void;
}) {
  const profile = useContent((c) => c.profile);
  const petNames = useContent((c) => c.us.petNames);
  const me = useMe();
  const [watered, setWatered] = useState(0);
  if (!bouquet) return null;
  const b = bouquet;

  const remove = async () => {
    const ok = await confirm({
      title: 'Dit boeket van de plank halen?',
      message: 'De foto en het kaartje verdwijnen uit het winkeltje.',
      confirmLabel: 'Weghalen',
      tone: 'danger',
    });
    if (!ok) return;
    const position = getContent().flowers.findIndex((x) => x.id === b.id);
    removeItem('flowers', b.id);
    onClose();
    toast('Boeket weggehaald', {
      action: { label: 'Ongedaan maken', run: () => restoreItem('flowers', b, position) },
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={b.occasion ? `Boeket · ${b.occasion}` : 'Een boeket'}
      eyebrow={b.date ? formatDate(b.date) : 'uit het winkeltje'}
      size="md"
      className="bouquet-dialog"
      footer={
        <>
          <button type="button" className="icon-btn" aria-label="Boeket weghalen" onClick={remove}>
            <Trash2 />
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => onEdit(b)}>
            <Pencil aria-hidden="true" /> Bewerken
          </button>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Terug naar de plank
          </button>
        </>
      }
    >
      <div className="bouquet-view">
        {b.media && (
          <div className="bouquet-view__photo">
            <MediaView source={b.media} alt="Foto van het boeket" mode="full" fit="contain" />
          </div>
        )}
        <div className="bouquet-view__row">
          {b.flowers.length > 0 && (
            <p className="bouquet-view__flowers">
              {b.flowers.map((f) => (
                <span key={f} className="tag">
                  {emojiFor(f)} {f}
                </span>
              ))}
            </p>
          )}
          <button
            type="button"
            className={`icon-btn bouquet-view__fav ${b.favorite ? 'is-on' : ''}`}
            aria-pressed={b.favorite}
            aria-label={b.favorite ? 'Geen favoriet meer' : 'Favoriet maken'}
            onClick={() => patchItem('flowers', b.id, { favorite: !b.favorite })}
          >
            <Heart />
          </button>
        </div>
        {b.note && (
          <p className="bouquet-view__note">
            <small>Over dit boeket{b.by ? ` · ${nameOf(b.by, profile)}` : ''}</small>
            {b.note}
          </p>
        )}
        {b.card ? (
          <div className="flower-card" aria-label="Het kaartje">
            <span className="flower-card__string" aria-hidden="true" />
            <p>{b.card}</p>
            <small>— {sweetName('you', me, petNames, profile)}</small>
          </div>
        ) : (
          me === 'you' && (
            <button type="button" className="btn btn--soft" onClick={() => onEdit(b, true)}>
              ✍️ Schrijf het kaartje erbij
            </button>
          )
        )}
        <button
          type="button"
          className="btn btn--ghost btn--small bouquet-view__water"
          onClick={(e) => {
            setWatered((n) => n + 1);
            playSfx('sparkle', true);
            celebrateFrom(e.currentTarget);
          }}
        >
          <Droplets aria-hidden="true" />{' '}
          {watered === 0
            ? 'Water geven'
            : watered < 3
              ? 'Ze staan er weer fris bij ✨'
              : 'Deze bloemen blijven voor altijd mooi 💐'}
        </button>
      </div>
    </Dialog>
  );
}

function BouquetForm({
  open,
  bouquet,
  focusCard,
  onClose,
}: {
  open: boolean;
  bouquet: Bouquet | null;
  focusCard?: boolean;
  onClose: () => void;
}) {
  const [media, setMedia] = useState<MediaSource[]>([]);
  const [date, setDate] = useState('');
  const [occasion, setOccasion] = useState('');
  const [flowers, setFlowers] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [vase, setVase] = useState(0);
  const [note, setNote] = useState('');
  const [card, setCard] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMedia(bouquet?.media ? [bouquet.media] : []);
    setDate(bouquet?.date ?? '');
    setOccasion(bouquet?.occasion ?? '');
    setFlowers(bouquet?.flowers ?? []);
    setOther('');
    setVase(bouquet?.vase ?? Math.floor(Math.random() * VASES.length));
    setNote(bouquet?.note ?? '');
    setCard(bouquet?.card ?? '');
    setError(null);
    // Only when the form opens (or opens for another bouquet).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bouquet?.id]);

  const toggle = (f: string) =>
    setFlowers((list) => (list.includes(f) ? list.filter((x) => x !== f) : [...list, f]));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const all = [...flowers, ...other.split(',').map((x) => x.trim())].filter(Boolean);
    if (!media.length && !all.length) {
      setError('Voeg een foto toe of kies welke bloemen het waren.');
      return;
    }
    upsertItem(
      'flowers',
      {
        id: bouquet?.id ?? createId('bouquet'),
        media: media[0],
        date: date || undefined,
        occasion: occasion.trim() || undefined,
        flowers: [...new Set(all)].slice(0, 12),
        note: note.trim() || undefined,
        card: card.trim() || undefined,
        vase,
        favorite: bouquet?.favorite ?? false,
        by: bouquet?.by ?? getAuthor(),
        createdAt: bouquet?.createdAt ?? nowIso(),
      },
      'start',
    );
    playSfx('success', true);
    toast(bouquet ? 'Boeket bijgewerkt' : 'Op de plank gezet 💐');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={bouquet ? 'Boeket bewerken' : 'Een boeket op de plank'}
      eyebrow="bloemenwinkeltje"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="bouquet-form" className="btn btn--primary">
            {bouquet ? 'Opslaan' : 'Op de plank zetten'}
          </button>
        </>
      }
    >
      <form id="bouquet-form" className="form" onSubmit={save} noValidate>
        <MediaPicker
          label="Foto van het boeket"
          value={media}
          onChange={setMedia}
          multiple={false}
          hint="De foto komt in het vaasje op de plank."
        />
        <TextField
          label="Wanneer kreeg je ze?"
          optional
          type="date"
          value={date}
          onChange={setDate}
        />
        <fieldset className="flower-form__group">
          <legend>Gelegenheid</legend>
          <div className="chip-row">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                type="button"
                className="chip"
                aria-pressed={occasion === o}
                onClick={() => setOccasion(occasion === o ? '' : o)}
              >
                {o}
              </button>
            ))}
          </div>
          <TextField
            label="Of iets anders"
            optional
            value={OCCASIONS.includes(occasion as never) ? '' : occasion}
            onChange={setOccasion}
            maxLength={80}
          />
        </fieldset>
        <fieldset className="flower-form__group">
          <legend>Welke bloemen?</legend>
          <div className="chip-row">
            {FLOWER_KINDS.map((f) => (
              <button
                key={f.name}
                type="button"
                className="chip"
                aria-pressed={flowers.includes(f.name)}
                onClick={() => toggle(f.name)}
              >
                {f.emoji} {f.name}
              </button>
            ))}
          </div>
          <TextField
            label="Andere bloemen"
            optional
            value={other}
            onChange={setOther}
            placeholder="bv. Anjers, Ranonkels"
            hint="Meerdere? Scheid ze met een komma."
          />
        </fieldset>
        <fieldset className="flower-form__group">
          <legend>Welk vaasje op de plank?</legend>
          <div className="vase-pick" role="radiogroup" aria-label="Vaasje">
            {VASES.map((v, i) => (
              <button
                key={v.name}
                type="button"
                role="radio"
                aria-checked={vase === i}
                aria-label={v.name}
                className="vase-pick__btn"
                onClick={() => setVase(i)}
              >
                <Vase index={i} />
              </button>
            ))}
          </div>
        </fieldset>
        <TextArea
          label="Over dit boeket"
          optional
          value={note}
          onChange={setNote}
          rows={2}
          placeholder="Waarom ze zo mooi waren, wat je voelde…"
        />
        <TextArea
          label="Het kaartje"
          optional
          value={card}
          onChange={setCard}
          rows={2}
          autoFocus={focusCard}
          hint="Wat er op het kaartje stond (of wat hij erbij had willen schrijven)."
        />
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
