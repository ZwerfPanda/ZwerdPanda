import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, Lightbulb, Maximize, Pause, Play, X } from 'lucide-react';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, sweetName, useMe } from '../../data/people';
import { updateCinema } from '../../data/actions';
import type { Film, FilmNight } from '../../data/types';
import { mediaProblem, retryMissingMedia, useMediaUrl } from '../../lib/media';
import { lockScroll, trapTab } from '../../components/ui/scrollLock';
import { useMusic } from '../../components/music/MusicProvider';
import { useReducedMotion } from '../../hooks/useMotion';
import { playSfx } from '../../lib/audio/sfx';
import { toast } from '../../components/ui/feedback';
import { GENRES, creditsFor, formatDuration, ratingId, ratingsFor, snackById } from './cinema';
import { SeatRow } from './CinemaArt';

type Phase = 'doors' | 'leader' | 'film' | 'credits' | 'rate';

/**
 * The screening room: we find our seats with the lights on and the curtain
 * closed, the lights dim and the curtain opens on a 3-2-1 countdown, then our
 * film plays on the big screen with us in the front row. Afterwards the
 * credits roll and we each give it our stars.
 */
export function Screening({
  film,
  night,
  onClose,
}: {
  film: Film;
  night: FilmNight | null;
  onClose: () => void;
}) {
  const profile = useContent((c) => c.profile);
  const petNames = useContent((c) => c.us.petNames);
  const ratings = useContent((c) => c.cinema.ratings);
  const me = useMe();
  const reduce = useReducedMotion();
  const music = useMusic();
  const media = useMediaUrl(film.video.type === 'local' ? film.video.mediaId : undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>('doors');
  const [count, setCount] = useState(3);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [time, setTime] = useState({ at: 0, of: 0 });
  const [lightsUp, setLightsUp] = useState(false);
  const [close, setClose] = useState(false);
  const g = GENRES[film.genre];
  const snacks = (night?.snacks ?? []).map((s) => snackById(s)?.emoji ?? '').filter(Boolean);
  const names = { you: nameOf('you', profile), partner: nameOf('partner', profile) };

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // A room of its own: no scrolling behind it, focus stays inside, Esc leaves.
  useEffect(() => {
    const unlock = lockScroll();
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (!rootRef.current) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else trapTab(e, rootRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlock();
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, []);

  // The 3-2-1 leader before the film.
  useEffect(() => {
    if (phase !== 'leader') return;
    if (count <= 0) {
      setPhase('film');
      return;
    }
    const id = window.setTimeout(() => {
      playSfx('tap', true);
      setCount((c) => c - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [phase, count]);

  // The film starts as soon as the leader ends.
  useEffect(() => {
    if (phase !== 'film') return;
    const v = videoRef.current;
    if (!v) return;
    v.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    );
  }, [phase]);

  const start = () => {
    if (music.playing) music.pause();
    playSfx('whoosh', true);
    // Start and stop the film inside this tap, so phones let it play with
    // sound once the countdown is over.
    const v = videoRef.current;
    if (v) {
      const p = v.play();
      v.pause();
      p?.catch(() => undefined);
    }
    if (reduce) setPhase('film');
    else {
      setCount(3);
      setPhase('leader');
    }
  };

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused)
      v.play().then(
        () => setBlocked(false),
        () => setBlocked(true),
      );
    else v.pause();
  };

  const seek = (to: number) => {
    const v = videoRef.current;
    if (v && Number.isFinite(to)) v.currentTime = to;
  };

  const fullscreen = () => {
    const v = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  };

  const cuddle = () => {
    playSfx('heart', true);
    setClose(true);
    window.setTimeout(() => setClose(false), 2600);
  };

  const ended = () => {
    setPlaying(false);
    playSfx('chime', true);
    setPhase(reduce ? 'rate' : 'credits');
  };

  // Lights: up before and after, down for the film (unless we turn them up).
  const dark = (phase === 'leader' || phase === 'film') && !lightsUp;
  const curtainOpen = phase === 'leader' || phase === 'film' || phase === 'credits';
  const credits = creditsFor(film, names, night?.snacks ?? []);

  return createPortal(
    <div
      ref={rootRef}
      className={`cin-room${dark ? ' is-dark' : ''}${playing ? ' is-playing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Zaal ${night?.zaal ?? 1}: ${film.title}`}
      style={{ '--film-accent': g.from } as React.CSSProperties}
    >
      <div className="cin-room__ceiling" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 90}%` }} />
        ))}
      </div>
      <div className="cin-room__lamps" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="cin-room__bar">
        <p>
          <span className="cin-room__zaal">Zaal {night?.zaal ?? 1}</span>
          {night?.seat && <span className="cin-room__seat">{night.seat}</span>}
        </p>
        <button
          ref={closeRef}
          type="button"
          className="cin-room__close"
          onClick={onClose}
          aria-label="De zaal uit"
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="cin-stage">
        <div className="cin-valance" aria-hidden="true" />
        <div className="cin-screen">
          <div className="cin-screen__inner">
            {media.status === 'ready' ? (
              <video
                ref={videoRef}
                className={`cin-screen__video${phase === 'film' ? ' is-on' : ''}`}
                src={media.url}
                playsInline
                preload="auto"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={ended}
                onTimeUpdate={(e) =>
                  setTime({ at: e.currentTarget.currentTime, of: e.currentTarget.duration || 0 })
                }
                onLoadedMetadata={(e) => setTime({ at: 0, of: e.currentTarget.duration || 0 })}
                aria-label={film.title}
              />
            ) : (
              <div className="cin-slide">
                <p>
                  {media.status === 'loading'
                    ? 'De film wordt opgehaald… bij een grote film kan dat even duren.'
                    : 'Deze film staat nog niet op deze telefoon — hij komt vanzelf binnen.'}
                </p>
                {media.status === 'missing' && film.video.type === 'local' && (
                  <>
                    {mediaProblem(film.video.mediaId) && (
                      <p className="cin-slide__line">
                        Ophalen lukte niet: {mediaProblem(film.video.mediaId)}
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn btn--soft btn--small"
                      onClick={retryMissingMedia}
                    >
                      Opnieuw proberen
                    </button>
                  </>
                )}
              </div>
            )}
            {phase === 'doors' && (
              <div className="cin-slide cin-slide--curtain">
                <p className="cin-slide__eyebrow">welkom in zaal {night?.zaal ?? 1}</p>
                <p className="cin-slide__title">{film.title}</p>
                <p className="cin-slide__line">📵 zet je telefoon even op stil.. behalve deze 😉</p>
                <p className="cin-slide__line">
                  🍿 pak je snacks erbij en kruip lekker tegen me aan
                </p>
              </div>
            )}
            {phase === 'leader' && (
              <div className="cin-leader" aria-live="polite">
                <span className="cin-leader__sweep" key={count} aria-hidden="true" />
                <span className="cin-leader__n">{count > 0 ? count : ''}</span>
              </div>
            )}
            {phase === 'film' && blocked && (
              <button type="button" className="cin-slide cin-slide--btn" onClick={toggle}>
                <Play aria-hidden="true" /> Tik om de film te starten
              </button>
            )}
            {phase === 'film' && !playing && !blocked && time.at > 0.2 && (
              <div className="cin-slide cin-slide--pause" aria-hidden="true">
                <p className="cin-slide__title">pauze ☕</p>
                <p className="cin-slide__line">even naar de wc? ik wacht op je ♡</p>
              </div>
            )}
            {phase === 'credits' && (
              <div className="cin-credits" onAnimationEnd={() => setPhase('rate')}>
                <p className="cin-credits__end">THE END ♡</p>
                <p className="cin-credits__title">{film.title}</p>
                {credits.map((c) => (
                  <p key={c.role} className="cin-credits__line">
                    <span>{c.role}</span>
                    {c.who}
                  </p>
                ))}
                <p className="cin-credits__end cin-credits__end--small">
                  wordt vervolgd.. elke dag ♡
                </p>
              </div>
            )}
          </div>
          <div className={`cin-curtain cin-curtain--l${curtainOpen ? ' is-open' : ''}`} />
          <div className={`cin-curtain cin-curtain--r${curtainOpen ? ' is-open' : ''}`} />
        </div>
        <div className="cin-beam" aria-hidden="true" />
      </div>

      <SeatRow snacks={snacks} close={close} />

      <div className="cin-room__controls">
        {phase === 'doors' && (
          <button
            type="button"
            className="btn btn--primary cin-go"
            onClick={start}
            disabled={media.status !== 'ready'}
          >
            🎬 Lichten uit, film aan
          </button>
        )}
        {(phase === 'film' || phase === 'leader') && (
          <>
            <button
              type="button"
              className="cin-ctl"
              onClick={toggle}
              disabled={phase !== 'film'}
              aria-label={playing ? 'Pauze' : 'Verder kijken'}
            >
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <input
              className="cin-progress"
              type="range"
              min={0}
              max={time.of || 0}
              step={0.1}
              value={time.at}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Waar we zijn in de film"
              aria-valuetext={`${formatDuration(time.at)} van ${formatDuration(time.of)}`}
            />
            <span className="cin-time" aria-hidden="true">
              {formatDuration(time.at)} / {formatDuration(time.of)}
            </span>
            <button
              type="button"
              className="cin-ctl"
              onClick={() => setLightsUp((l) => !l)}
              aria-pressed={lightsUp}
              aria-label="Lichten aan"
            >
              <Lightbulb aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cin-ctl"
              onClick={cuddle}
              aria-label="Tegen elkaar aan kruipen"
            >
              <Heart aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cin-ctl"
              onClick={fullscreen}
              aria-label="Volledig scherm"
            >
              <Maximize aria-hidden="true" />
            </button>
          </>
        )}
        {phase === 'credits' && (
          <button
            type="button"
            className="btn btn--ghost cin-skip"
            onClick={() => setPhase('rate')}
          >
            Aftiteling overslaan
          </button>
        )}
      </div>

      {phase === 'rate' && (
        <RateCard
          film={film}
          me={me}
          other={ratingsFor(ratings, film.id)[otherPerson(me)]}
          otherName={sweetName(otherPerson(me), me, petNames, profile)}
          mine={ratingsFor(ratings, film.id)[me]}
          onDone={onClose}
          onAgain={() => {
            seek(0);
            setPhase('doors');
          }}
        />
      )}
    </div>,
    document.body,
  );
}

function RateCard({
  film,
  me,
  mine,
  other,
  otherName,
  onDone,
  onAgain,
}: {
  film: Film;
  me: 'you' | 'partner';
  mine?: { stars: number; review?: string };
  other?: { stars: number; review?: string };
  otherName: string;
  onDone: () => void;
  onAgain: () => void;
}) {
  const [stars, setStars] = useState(mine?.stars ?? 0);
  const [review, setReview] = useState(mine?.review ?? '');

  const save = () => {
    if (!stars) return;
    const id = ratingId(film.id, me);
    updateCinema((c) => ({
      ...c,
      ratings: [
        ...c.ratings.filter((r) => r.id !== id),
        {
          id,
          film: film.id,
          who: me,
          stars,
          review: review.trim() || undefined,
          at: new Date().toISOString(),
        },
      ],
    }));
    playSfx('star', true);
    toast(stars === 5 ? 'Vijf sterren! ⭐ Een echte klassieker' : 'Je recensie staat erin 🍿');
    onDone();
  };

  return (
    <div className="cin-rate" role="group" aria-labelledby="cin-rate-title">
      <h2 id="cin-rate-title" className="cin-rate__title">
        Hoeveel sterren geef jij {film.title}?
      </h2>
      <div className="cin-rate__stars" role="radiogroup" aria-label="Sterren">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} ${n === 1 ? 'ster' : 'sterren'}`}
            className={`cin-star${n <= stars ? ' is-on' : ''}`}
            onClick={() => {
              setStars(n);
              playSfx('pop', true);
            }}
          >
            ★
          </button>
        ))}
      </div>
      <label className="cin-rate__review">
        <span>Jouw recensie (mag ook gewoon “mooiste film ooit”)</span>
        <textarea
          rows={2}
          maxLength={600}
          value={review}
          onChange={(e) => setReview(e.target.value)}
        />
      </label>
      {other && (
        <p className="cin-rate__other">
          {otherName} gaf hem {'★'.repeat(other.stars)}
          {other.review ? ` — “${other.review}”` : ''}
        </p>
      )}
      <div className="cin-rate__actions">
        <button type="button" className="btn btn--ghost" onClick={onAgain}>
          Nog een keer
        </button>
        <button type="button" className="btn btn--ghost" onClick={onDone}>
          Later
        </button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={!stars}>
          Opslaan
        </button>
      </div>
    </div>
  );
}
