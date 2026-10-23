import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Heart,
  Map as MapIcon,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { getContent, updateContent, useContent } from '../../data/store';
import type { MuseumStop, StopTheme } from '../../data/types';
import { Dialog } from '../../components/ui/Dialog';
import { confirm, toast } from '../../components/ui/feedback';
import { MediaView } from '../../components/media/MediaView';
import { SiteFooter } from '../../components/common/SiteFooter';
import { navigate, useRoute } from '../../lib/router';
import { nowIso } from '../../lib/id';
import { HuntStar } from '../hunt/HuntStar';
import { StopScene } from './scenes';
import { StopForm } from './StopForm';
import { TrainRide } from './TrainRide';
import { STOP_THEMES } from './themes';
import { useAmbience, type Ambience } from '../../lib/audio/ambience';
import './museum.css';

/** The sound of some stops, quietly in the background. */
const AMBIENCE: Partial<Record<StopTheme, Ambience>> = {
  spa: 'spa',
  platform: 'night-platform',
  pumpkin: 'halloween',
  roadtrip: 'road',
  cinema: 'cinema',
  amsterdam: 'canal',
  birds: 'birds',
  christmas: 'winter',
  themepark: 'park',
  hotel: 'hotel',
};

/**
 * The Love Line: the museum of us, hidden deep in our universe. Every stop is
 * a place that's ours; between stops we ride an NS train, waving at the window.
 */
export function MuseumPage() {
  const stops = useContent((c) => c.museum.stops);
  const route = useRoute();
  const current = stops.find((s) => s.id === route.params.get('stop')) ?? null;
  const [ride, setRide] = useState<{ to: MuseumStop | null; kicker: string } | null>(null);
  const [form, setForm] = useState<{ open: boolean; stop: MuseumStop | null; upcoming?: boolean }>({
    open: false,
    stop: null,
  });

  // Whoever finds the way in has found it for both of us.
  useEffect(() => {
    if (!getContent().museum.foundAt) {
      updateContent((c) => ({ ...c, museum: { ...c.museum, foundAt: nowIso() } }));
    }
  }, []);

  // The stop's mood colours the whole screen while we're there.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.stop = current ? current.theme : 'line';
    return () => {
      delete root.dataset.stop;
    };
  }, [current]);

  // While the train rides, the train is the sound; then the stop's own.
  useAmbience(ride ? null : current ? (AMBIENCE[current.theme] ?? null) : 'line');

  const travel = (to: MuseumStop | null, kicker = 'Volgende station') => setRide({ to, kicker });

  const arrive = () => {
    const to = ride?.to ?? null;
    setRide(null);
    navigate('/museum', to ? { stop: to.id } : undefined);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="page museum">
      {current ? (
        <StopView
          key={current.id}
          stop={current}
          stops={stops}
          onTravel={travel}
          onEdit={() => setForm({ open: true, stop: current })}
        />
      ) : (
        <LineMap
          stops={stops}
          onTravel={travel}
          onAdd={(upcoming) => setForm({ open: true, stop: null, upcoming })}
        />
      )}
      {ride && (
        <TrainRide
          title={ride.to ? ride.to.name : 'Lijnkaart'}
          kicker={ride.kicker}
          onDone={arrive}
        />
      )}
      <StopForm
        open={form.open}
        stop={form.stop}
        upcoming={form.upcoming}
        onClose={() => setForm({ open: false, stop: null })}
      />
      <SiteFooter />
    </div>
  );
}

/* --------------------------------------------------------------- line map */

function LineMap({
  stops,
  onTravel,
  onAdd,
}: {
  stops: MuseumStop[];
  onTravel: (to: MuseumStop | null, kicker?: string) => void;
  onAdd: (upcoming: boolean) => void;
}) {
  const been = stops.filter((s) => !s.upcoming);
  const ahead = stops.filter((s) => s.upcoming);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const clock = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  const via = been
    .slice(1, 5)
    .map((s) => s.name)
    .join(', ');

  return (
    <>
      <header className="museum-board">
        <HuntStar id="museum" className="museum-board__star" />
        <div className="museum-board__top">
          <span>Vertrek</span>
          <span className="museum-board__clock">{clock}</span>
        </div>
        <p className="museum-board__eyebrow">het museum van ons</p>
        <h1 className="museum-board__title">The Love Line</h1>
        <div className="museum-board__row">
          <span className="museum-board__track">♡</span>
          <span>
            <strong>Intercity naar Altijd</strong>
            {via && <small>via {via}</small>}
          </span>
        </div>
      </header>

      <p className="museum-intro">
        Je hebt het diepste plekje van ons universe gevonden. Elke halte op deze lijn is een plek
        die van ons is — stap in, rij mee, en kijk uit het raam.
      </p>
      {been[0] && (
        <button
          type="button"
          className="btn btn--primary museum-board__go"
          onClick={() => onTravel(been[0], 'Instappen a.u.b.')}
        >
          🚆 Instappen bij halte 1
        </button>
      )}

      <section aria-labelledby="line-title">
        <h2 id="line-title" className="museum-section-title">
          Lijnkaart <span className="hand">{been.length} haltes</span>
        </h2>
        <ol className="museum-line">
          {been.map((s, i) => (
            <LineStop key={s.id} stop={s} n={i + 1} onGo={() => onTravel(s)} />
          ))}
        </ol>
        <button type="button" className="btn btn--soft museum-add" onClick={() => onAdd(false)}>
          <Plus aria-hidden="true" /> Halte toevoegen
        </button>
      </section>

      <section aria-labelledby="ahead-title">
        <h2 id="ahead-title" className="museum-section-title">
          Volgende haltes <span className="hand">binnenkort</span>
        </h2>
        <ol className="museum-line museum-line--ahead">
          {ahead.map((s) => (
            <LineStop key={s.id} stop={s} n={null} onGo={() => onTravel(s, 'Binnenkort')} />
          ))}
        </ol>
        <button type="button" className="btn btn--soft museum-add" onClick={() => onAdd(true)}>
          <Plus aria-hidden="true" /> Volgende halte plannen
        </button>
      </section>
    </>
  );
}

function LineStop({ stop, n, onGo }: { stop: MuseumStop; n: number | null; onGo: () => void }) {
  const theme = STOP_THEMES[stop.theme];
  return (
    <li className="museum-line__stop">
      <button type="button" className="museum-line__btn" onClick={onGo}>
        <span className="museum-line__dot" aria-hidden="true">
          {n ?? '✦'}
        </span>
        <span className="museum-line__text">
          <span className="museum-line__name">{stop.name}</span>
          <span className="museum-line__place">
            {[stop.place, stop.when].filter(Boolean).join(' · ')}
          </span>
        </span>
        {stop.media[0] && (
          <span className="museum-line__thumb" aria-hidden="true">
            <MediaView source={stop.media[0]} alt="" />
          </span>
        )}
        <span className="museum-line__emoji" aria-hidden="true">
          {theme.emoji}
        </span>
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ stop */

function StopView({
  stop,
  stops,
  onTravel,
  onEdit,
}: {
  stop: MuseumStop;
  stops: MuseumStop[];
  onTravel: (to: MuseumStop | null, kicker?: string) => void;
  onEdit: () => void;
}) {
  const theme = STOP_THEMES[stop.theme];
  const index = stops.findIndex((s) => s.id === stop.id);
  const been = useMemo(() => stops.filter((s) => !s.upcoming), [stops]);
  const number = stop.upcoming ? null : been.findIndex((s) => s.id === stop.id) + 1;
  const prev = stops[index - 1] ?? null;
  const next = stops[index + 1] ?? null;
  const [photo, setPhoto] = useState<number | null>(null);

  const move = (by: -1 | 1) => {
    updateContent((c) => {
      const list = c.museum.stops.slice();
      const i = list.findIndex((s) => s.id === stop.id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= list.length) return c;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...c, museum: { ...c.museum, stops: list } };
    });
  };

  const remove = async () => {
    const ok = await confirm({
      title: `“${stop.name}” van de lijn halen?`,
      message: 'De halte, het verhaal en de foto’s verdwijnen uit het museum.',
      confirmLabel: 'Weghalen',
      tone: 'danger',
    });
    if (!ok) return;
    updateContent((c) => ({
      ...c,
      museum: { ...c.museum, stops: c.museum.stops.filter((s) => s.id !== stop.id) },
    }));
    toast('Halte weggehaald');
    navigate('/museum');
  };

  return (
    <article className={`museum-stop museum-stop--${stop.theme}`} aria-labelledby="stop-title">
      <div className="museum-stop__bar">
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => onTravel(null, 'Terug naar')}
        >
          <MapIcon aria-hidden="true" /> Lijnkaart
        </button>
        <span className="museum-stop__count">
          {number ? `halte ${number} van ${been.length}` : 'binnenkort ✦'}
        </span>
      </div>

      <p className="museum-deco" aria-hidden="true">
        {theme.deco}
      </p>

      <header className="museum-sign">
        {number && (
          <span className="museum-sign__n" aria-hidden="true">
            {number}
          </span>
        )}
        <div>
          <h1 id="stop-title" className="museum-sign__name">
            {stop.name}
          </h1>
          {(stop.place || stop.when) && (
            <p className="museum-sign__place">
              {[stop.place, stop.when].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </header>

      <div className={`museum-scene ${stop.upcoming ? 'is-ahead' : ''}`}>
        <StopScene theme={stop.theme} label={`Mini us bij ${stop.name}`} />
        {stop.upcoming && <span className="museum-scene__soon">binnenkort ✦</span>}
      </div>

      {stop.story && (
        <section className="museum-placard" aria-label="Het verhaal">
          <p>{stop.story}</p>
        </section>
      )}

      {stop.details.length > 0 && (
        <section className="museum-card" aria-labelledby="stop-details">
          <h2 id="stop-details" className="museum-card__title">
            {stop.upcoming ? 'Het plan' : 'Wat we hier deden'}
          </h2>
          <ul className="museum-details">
            {stop.details.map((d, i) => (
              <li key={i}>
                <span aria-hidden="true">{theme.emoji}</span> {d}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="museum-card museum-favorite" aria-labelledby="stop-fav">
        <h2 id="stop-fav" className="museum-card__title">
          <Heart aria-hidden="true" /> Onze favoriete herinnering
        </h2>
        {stop.favorite ? (
          <blockquote>{stop.favorite}</blockquote>
        ) : (
          <button type="button" className="btn btn--soft btn--small" onClick={onEdit}>
            <Pencil aria-hidden="true" /> Schrijf hem op
          </button>
        )}
      </section>

      <section className="museum-card" aria-labelledby="stop-photos">
        <h2 id="stop-photos" className="museum-card__title">
          <Camera aria-hidden="true" /> Foto’s
        </h2>
        {stop.media.length > 0 ? (
          <ul className="museum-photos">
            {stop.media.map((m, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`Foto ${i + 1} groot bekijken`}
                >
                  <MediaView source={m} alt={`${stop.name}, foto ${i + 1}`} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="museum-muted">Nog geen foto’s van deze halte.</p>
        )}
        <button type="button" className="btn btn--soft btn--small" onClick={onEdit}>
          <Plus aria-hidden="true" /> Foto’s toevoegen
        </button>
      </section>

      <nav className="museum-nav" aria-label="Naar een andere halte">
        {prev ? (
          <button
            type="button"
            className="museum-nav__btn"
            onClick={() => onTravel(prev, 'Volgende station')}
          >
            <ArrowLeft aria-hidden="true" />
            <span>
              <small>vorige halte</small>
              {prev.name}
            </span>
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button
            type="button"
            className="museum-nav__btn museum-nav__btn--next"
            onClick={() => onTravel(next, next.upcoming ? 'Binnenkort' : 'Volgende station')}
          >
            <span>
              <small>volgende halte</small>
              {next.name}
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="museum-nav__btn museum-nav__btn--next"
            onClick={() => onTravel(null, 'Eindstation')}
          >
            <span>
              <small>eindstation</small>
              Terug naar de lijnkaart
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
        )}
      </nav>

      <div className="museum-tools">
        <button type="button" className="btn btn--ghost btn--small" onClick={onEdit}>
          <Pencil aria-hidden="true" /> Bewerken
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => move(-1)}
          disabled={index === 0}
        >
          <ArrowUp aria-hidden="true" /> Eerder
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => move(1)}
          disabled={index === stops.length - 1}
        >
          <ArrowDown aria-hidden="true" /> Later
        </button>
        <button type="button" className="btn btn--quiet btn--small" onClick={() => void remove()}>
          <Trash2 aria-hidden="true" /> Weghalen
        </button>
      </div>

      <Dialog
        open={photo !== null}
        onClose={() => setPhoto(null)}
        title={stop.name}
        eyebrow={photo !== null ? `foto ${photo + 1} van ${stop.media.length}` : ''}
        size="lg"
      >
        {photo !== null && stop.media[photo] && (
          <div className="museum-photo-full">
            <MediaView
              source={stop.media[photo]}
              alt={`${stop.name}, foto ${photo + 1}`}
              mode="full"
              fit="contain"
            />
          </div>
        )}
      </Dialog>
    </article>
  );
}
