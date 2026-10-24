import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarPlus, Pencil, Plus, Ticket, Trash2 } from 'lucide-react';
import { getContent, useContent } from '../../data/store';
import { getAuthor, nameOf, sweetName, useMe } from '../../data/people';
import { updateCinema, upsertItem } from '../../data/actions';
import type { Film, FilmNight } from '../../data/types';
import { Dialog } from '../../components/ui/Dialog';
import { TextField } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { SiteFooter } from '../../components/common/SiteFooter';
import { useReducedMotion } from '../../hooks/useMotion';
import { createId, nowIso } from '../../lib/id';
import { formatDate, todayIso } from '../../lib/dates';
import { playSfx } from '../../lib/audio/sfx';
import { Mini, UsProvider } from '../museum/scenes/kit';
import { Popcorn } from '../museum/scenes/props';
import {
  GENRES,
  SNACKS,
  averageStars,
  cinemaStats,
  filmsByNewest,
  goldenPopcorn,
  nightsFor,
  pickSeat,
  ratingsFor,
  snackById,
} from './cinema';
import { CinemaFacade } from './CinemaArt';
import { FilmForm } from './FilmForm';
import { Poster } from './Poster';
import { Screening } from './Screening';
import './cinema.css';

/**
 * Our own cinema. The films are videos of ourselves; each gets a poster, and
 * a film night comes with snacks, a ticket and a big screen with a curtain.
 */
export function CinemaPage() {
  const cinema = useContent((c) => c.cinema);
  const [form, setForm] = useState<{ open: boolean; film: Film | null }>({
    open: false,
    film: null,
  });
  const [detail, setDetail] = useState<string | null>(null);
  const [kassa, setKassa] = useState<Film | null>(null);
  const [showing, setShowing] = useState<{ film: Film; night: FilmNight | null } | null>(null);
  const [allStubs, setAllStubs] = useState(false);

  const films = useMemo(() => filmsByNewest(cinema.films), [cinema.films]);
  const stats = useMemo(() => cinemaStats(cinema), [cinema]);
  const golden = useMemo(() => goldenPopcorn(cinema), [cinema]);
  const filmOf = (id: string) => cinema.films.find((f) => f.id === id);
  const stubs = [...cinema.nights].reverse().filter((n) => filmOf(n.film));
  const reviews = [...cinema.ratings]
    .filter((r) => r.review && filmOf(r.film))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
  const current = detail ? (filmOf(detail) ?? null) : null;

  return (
    <div className="page cinema">
      <Front title={films[0]?.title} genres={films.slice(0, 2).map((f) => f.genre)} />

      <p className="cinema__stats">
        {stats.films === 0
          ? 'De zaal is nog leeg.. tijd voor onze eerste film'
          : `${stats.films} ${stats.films === 1 ? 'film' : 'films'} · ${stats.nights} ${stats.nights === 1 ? 'filmavond' : 'filmavonden'}${stats.snack ? ` · meestal ${stats.snack.emoji} ${stats.snack.label.toLowerCase()}` : ''}`}
      </p>
      <div className="cinema__bar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setForm({ open: true, film: null })}
        >
          <Plus aria-hidden="true" /> Film toevoegen
        </button>
      </div>

      <section className="cinema__section" aria-labelledby="cin-now">
        <h2 id="cin-now" className="cinema__h">
          🎞️ Nu te zien
        </h2>
        {films.length === 0 ? (
          <div className="cinema__empty">
            <p>
              Upload een filmpje van ons — een dansje, een date, een vlog, gewoon wij — en hij
              draait hier op het grote doek, met poster, kaartje en popcorn.
            </p>
            <button
              type="button"
              className="btn btn--soft"
              onClick={() => setForm({ open: true, film: null })}
            >
              🎬 Onze eerste film toevoegen
            </button>
          </div>
        ) : (
          <ul className="cinema__posters">
            {films.map((film) => (
              <li key={film.id}>
                <button
                  type="button"
                  className="cinema__poster-btn"
                  onClick={() => setDetail(film.id)}
                >
                  <span className="visually-hidden">
                    {film.title} ({GENRES[film.genre].label})
                  </span>
                  <span className="cinema__poster-art" aria-hidden="true">
                    <Poster film={film} stars={averageStars(cinema.ratings, film.id)} />
                  </span>
                  {golden?.id === film.id && (
                    <span className="cinema__award" aria-hidden="true">
                      🏆
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {golden && (
        <section className="cinema__section cin-golden" aria-labelledby="cin-golden">
          <h2 id="cin-golden" className="cinema__h">
            🏆 De Gouden Popcorn
          </h2>
          <button type="button" className="cin-golden__card" onClick={() => setDetail(golden.id)}>
            <span className="cin-golden__trophy" aria-hidden="true">
              🍿
            </span>
            <span>
              <span className="cin-golden__title">{golden.title}</span>
              <span className="cin-golden__why">
                onze best beoordeelde film ·{' '}
                {(averageStars(cinema.ratings, golden.id) ?? 0).toFixed(1)} ★
              </span>
            </span>
          </button>
        </section>
      )}

      {stubs.length > 0 && (
        <section className="cinema__section" aria-labelledby="cin-stubs">
          <h2 id="cin-stubs" className="cinema__h">
            🎟️ Onze kaartjes
          </h2>
          <ul className="cin-stubs">
            {(allStubs ? stubs : stubs.slice(0, 8)).map((n, i) => (
              <li
                key={n.id}
                className="cin-stub"
                style={{ '--tilt': `${((i * 7) % 5) - 2}deg` } as React.CSSProperties}
              >
                <span className="cin-stub__film">{filmOf(n.film)?.title}</span>
                <span className="cin-stub__when">{formatDate(n.at.slice(0, 10))}</span>
                <span className="cin-stub__seat">
                  Zaal {n.zaal} · {n.seat}
                </span>
                {n.snacks.length > 0 && (
                  <span
                    className="cin-stub__snacks"
                    aria-label={n.snacks.map((s) => snackById(s)?.label).join(', ')}
                  >
                    {n.snacks.map((s) => snackById(s)?.emoji).join(' ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {stubs.length > 8 && (
            <button type="button" className="btn btn--ghost" onClick={() => setAllStubs((a) => !a)}>
              {allStubs ? 'Minder kaartjes' : `Alle ${stubs.length} kaartjes`}
            </button>
          )}
        </section>
      )}

      {reviews.length > 0 && <Reviews reviews={reviews} filmOf={filmOf} />}

      <SiteFooter />

      <FilmDetail
        film={current}
        onClose={() => setDetail(null)}
        onTicket={(f) => {
          setDetail(null);
          setKassa(f);
        }}
        onEdit={(f) => {
          setDetail(null);
          setForm({ open: true, film: f });
        }}
      />
      <FilmForm
        open={form.open}
        film={form.film}
        onClose={() => setForm({ open: false, film: null })}
      />
      <Kassa
        film={kassa}
        onClose={() => setKassa(null)}
        onEnter={(film, night) => {
          setKassa(null);
          setShowing({ film, night });
        }}
      />
      {showing && (
        <Screening film={showing.film} night={showing.night} onClose={() => setShowing(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- the front */

function Front({ title, genres }: { title?: string; genres: string[] }) {
  const us = useContent((c) => c.us);
  const reduce = useReducedMotion();
  return (
    <header className="cinema-front">
      <h1 className="visually-hidden">Onze bioscoop</h1>
      <svg className="cinema-front__svg" viewBox="-240 -380 480 400" aria-hidden="true">
        <CinemaFacade title={title} genres={genres} />
        <UsProvider us={us}>
          <Mini who="partner" x={-62} face="grin" tilt={6} hands={{ right: { x: 30, y: -150 } }} />
          <Mini who="you" x={66} pose="wave" face="happy" tilt={-6} />
        </UsProvider>
        <Popcorn x={-26} y={-128} s={0.9} />
      </svg>
      <motion.p
        className="cinema-front__sign hand"
        animate={reduce ? undefined : { rotate: [-2, 2, -2] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        alleen voor ons twee ♡
      </motion.p>
    </header>
  );
}

/* ------------------------------------------------------------ the details */

function FilmDetail({
  film,
  onClose,
  onTicket,
  onEdit,
}: {
  film: Film | null;
  onClose: () => void;
  onTicket: (f: Film) => void;
  onEdit: (f: Film) => void;
}) {
  const cinema = useContent((c) => c.cinema);
  const profile = useContent((c) => c.profile);
  const petNames = useContent((c) => c.us.petNames);
  const me = useMe();
  const [plan, setPlan] = useState({ open: false, date: todayIso(), time: '20:00' });
  if (!film) return null;
  const f = film;
  const ratings = ratingsFor(cinema.ratings, f.id);
  const watched = nightsFor(cinema.nights, f.id).length;
  const label = (who: 'you' | 'partner') =>
    who === me ? 'Jij' : sweetName(who, me, petNames, profile);

  const remove = async () => {
    const ok = await confirm({
      title: `“${f.title}” uit de bios halen?`,
      message: 'De film, de sterren en de kaartjes ervan verdwijnen bij jullie allebei.',
      confirmLabel: 'Weghalen',
      tone: 'danger',
    });
    if (!ok) return;
    const before = getContent().cinema;
    updateCinema((c) => ({
      films: c.films.filter((x) => x.id !== f.id),
      ratings: c.ratings.filter((r) => r.film !== f.id),
      nights: c.nights.filter((n) => n.film !== f.id),
    }));
    onClose();
    toast('Film weggehaald', {
      action: {
        label: 'Ongedaan maken',
        run: () =>
          updateCinema((c) => ({
            films: [f, ...c.films.filter((x) => x.id !== f.id)],
            ratings: [...c.ratings, ...before.ratings.filter((r) => r.film === f.id)],
            nights: [...c.nights, ...before.nights.filter((n) => n.film === f.id)],
          })),
      },
    });
  };

  const planNight = () => {
    upsertItem('agenda', {
      id: createId('agenda'),
      title: `Filmavond: ${f.title}`.slice(0, 120),
      date: plan.date,
      time: plan.time || undefined,
      icon: 'star',
      yearly: false,
      by: getAuthor(),
      createdAt: nowIso(),
    });
    setPlan((p) => ({ ...p, open: false }));
    toast('Filmavond staat in onze agenda 📅');
  };

  return (
    <Dialog open onClose={onClose} title={f.title} eyebrow="nu te zien" size="lg">
      <div className="film-detail">
        <div className="film-detail__poster">
          <Poster film={f} stars={averageStars(cinema.ratings, f.id)} size="lg" />
        </div>
        <div className="film-detail__info">
          <p className="film-detail__meta">
            {GENRES[f.genre].emoji} {GENRES[f.genre].label}
            {f.date ? ` · gefilmd op ${formatDate(f.date)}` : ''}
            {watched ? ` · ${watched}× gekeken` : ''}
          </p>
          <button
            type="button"
            className="btn btn--primary film-detail__ticket"
            onClick={() => onTicket(f)}
          >
            <Ticket aria-hidden="true" /> Kaartje kopen
          </button>
          <div className="film-detail__ratings">
            {(['partner', 'you'] as const).map((who) => {
              const r = ratings[who];
              return (
                <p key={who} className="film-detail__rating">
                  <strong>{label(who)}</strong>{' '}
                  {r ? (
                    <>
                      <span className="film-detail__stars" aria-label={`${r.stars} van 5 sterren`}>
                        {'★'.repeat(r.stars)}
                        <span aria-hidden="true">{'★'.repeat(5 - r.stars)}</span>
                      </span>
                      {r.review && <span className="film-detail__review">“{r.review}”</span>}
                    </>
                  ) : (
                    <span className="film-detail__none">nog geen sterren</span>
                  )}
                </p>
              );
            })}
          </div>
          {plan.open ? (
            <div className="film-detail__plan">
              <TextField
                label="Welke dag?"
                type="date"
                value={plan.date}
                onChange={(date) => setPlan((p) => ({ ...p, date }))}
              />
              <TextField
                label="Hoe laat?"
                type="time"
                value={plan.time}
                onChange={(time) => setPlan((p) => ({ ...p, time }))}
              />
              <button
                type="button"
                className="btn btn--soft"
                onClick={planNight}
                disabled={!plan.date}
              >
                In de agenda
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setPlan((p) => ({ ...p, open: true }))}
            >
              <CalendarPlus aria-hidden="true" /> Plan een filmavond
            </button>
          )}
          <div className="film-detail__tools">
            <button type="button" className="btn btn--ghost" onClick={() => onEdit(f)}>
              <Pencil aria-hidden="true" /> Bewerken
            </button>
            <button type="button" className="btn btn--ghost btn--danger" onClick={remove}>
              <Trash2 aria-hidden="true" /> Weghalen
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/* --------------------------------------------------- the box office + snacks */

function Kassa({
  film,
  onClose,
  onEnter,
}: {
  film: Film | null;
  onClose: () => void;
  onEnter: (film: Film, night: FilmNight) => void;
}) {
  const [snacks, setSnacks] = useState<string[]>([]);
  const [ticket, setTicket] = useState<FilmNight | null>(null);
  const reduce = useReducedMotion();
  const profile = useContent((c) => c.profile);
  if (!film) return null;
  const f = film;

  const close = () => {
    setSnacks([]);
    setTicket(null);
    onClose();
  };

  const toggle = (id: string) => {
    playSfx('munch', true);
    setSnacks((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(0, 4)));
  };

  const print = () => {
    playSfx('paper', true);
    setTicket({
      id: createId('night'),
      film: f.id,
      ...pickSeat(),
      snacks,
      by: getAuthor(),
      at: nowIso(),
    });
  };

  const enter = () => {
    if (!ticket) return;
    updateCinema((c) => ({ ...c, nights: [...c.nights, ticket] }));
    playSfx('seal', true);
    const night = ticket;
    setSnacks([]);
    setTicket(null);
    onEnter(f, night);
  };

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <Dialog
      open
      onClose={close}
      title={ticket ? 'Je kaartje' : 'De snackbar'}
      eyebrow={`kassa · ${f.title}`}
      size="md"
      footer={
        ticket ? (
          <button type="button" className="btn btn--primary" onClick={enter}>
            🚪 Naar de zaal
          </button>
        ) : (
          <>
            <button type="button" className="btn btn--ghost" onClick={print}>
              Zonder snacks
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={print}
              disabled={!snacks.length}
            >
              Kaartje printen
            </button>
          </>
        )
      }
    >
      {!ticket ? (
        <>
          <p className="kassa__hi">
            Wat nemen we mee naar binnen? (max. 4, we moeten het ook nog dragen)
          </p>
          <div className="kassa__snacks" role="group" aria-label="Snacks">
            {SNACKS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="kassa__snack"
                aria-pressed={snacks.includes(s.id)}
                onClick={() => toggle(s.id)}
              >
                <span className="kassa__emoji" aria-hidden="true">
                  {s.emoji}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <motion.div
          className="cin-ticket"
          initial={reduce ? false : { y: -40, opacity: 0, rotate: -3 }}
          animate={{ y: 0, opacity: 1, rotate: -1.5 }}
          transition={{ type: 'spring', stiffness: 140, damping: 14 }}
        >
          <div className="cin-ticket__main">
            <p className="cin-ticket__brand">ONZE BIOS ♡</p>
            <p className="cin-ticket__film">{f.title}</p>
            <dl className="cin-ticket__facts">
              <div>
                <dt>zaal</dt>
                <dd>{ticket.zaal}</dd>
              </div>
              <div>
                <dt>tijd</dt>
                <dd>{time}</dd>
              </div>
              <div>
                <dt>datum</dt>
                <dd>{formatDate(todayIso())}</dd>
              </div>
            </dl>
            <p className="cin-ticket__seat">{ticket.seat}</p>
            <p className="cin-ticket__for">
              toegang voor 2 · {nameOf('partner', profile)} &amp; {nameOf('you', profile)}
            </p>
            {ticket.snacks.length > 0 && (
              <p className="cin-ticket__snacks">
                {ticket.snacks.map((s) => snackById(s)?.emoji).join(' ')} al betaald, met liefde
              </p>
            )}
          </div>
          <div className="cin-ticket__stub" aria-hidden="true">
            <span className="cin-ticket__barcode" />
            <span className="cin-ticket__admit">ADMIT 2</span>
          </div>
        </motion.div>
      )}
    </Dialog>
  );
}

/* ---------------------------------------------------------------- reviews */

function Reviews({
  reviews,
  filmOf,
}: {
  reviews: { id: string; film: string; who: 'you' | 'partner'; stars: number; review?: string }[];
  filmOf: (id: string) => Film | undefined;
}) {
  const profile = useContent((c) => c.profile);
  const petNames = useContent((c) => c.us.petNames);
  const me = useMe();
  return (
    <section className="cinema__section" aria-labelledby="cin-reviews">
      <h2 id="cin-reviews" className="cinema__h">
        📝 Recensies
      </h2>
      <ul className="cin-reviews">
        {reviews.map((r) => (
          <li key={r.id} className="cin-review">
            <p className="cin-review__text">“{r.review}”</p>
            <p className="cin-review__by">
              <span aria-label={`${r.stars} van 5 sterren`}>{'★'.repeat(r.stars)}</span> —{' '}
              {r.who === me ? 'jij' : sweetName(r.who, me, petNames, profile)}, over{' '}
              <em>{filmOf(r.film)?.title}</em>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
