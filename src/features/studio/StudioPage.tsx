import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gift, Heart, Pause, Pencil, Play, Plus, Reply, Sparkles, Trash2 } from 'lucide-react';
import { updatePrefs, useContent, usePrefs } from '../../data/store';
import { nameOf, useMe } from '../../data/people';
import type { KaraokeLine, OurRecord, Person, Profile } from '../../data/types';
import { confirm, celebrate, toast } from '../../components/ui/feedback';
import { formatDate, todayIso } from '../../lib/dates';
import { getMediaUrl, useMediaUrl } from '../../lib/media';
import { playSfx } from '../../lib/audio/sfx';
import { useMusic } from '../../components/music/MusicProvider';
import { useReducedMotion } from '../../hooks/useMotion';
import { isTimed, momentAt, parseLyrics } from './lyrics';
import { RecordForm } from './RecordForm';
import {
  SLEEVES,
  countPlay,
  daysUntilOpen,
  listenOf,
  newForMe,
  removeRecord,
  setNote,
  toggleHeart,
  wrapped,
} from './studioData';
import './studio.css';

/*
 * De Muziekkamer: the songs we made for each other, as records on a shelf.
 * Pick one and it goes on the turntable; the liner notes tell the story,
 * the words follow along, and a new song from the other comes gift-wrapped.
 */

const minutes = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
type Filter = 'all' | 'mine' | 'forme' | 'hearts';

/* ------------------------------------------------------------- sleeve */

function Sleeve({
  record,
  size = 'md',
  wrappedFor,
}: {
  record: OurRecord;
  size?: 'md' | 'big';
  wrappedFor?: number;
}) {
  const s = SLEEVES[record.sleeve] ?? SLEEVES[0];
  const cover = useMediaUrl(record.cover?.type === 'local' ? record.cover.mediaId : undefined);
  if (wrappedFor !== undefined)
    return (
      <span className={`mk-sleeve mk-sleeve--${size} mk-sleeve--wrapped`} aria-hidden="true">
        <span className="mk-sleeve__ribbon" />
        <span className="mk-sleeve__bow">🎀</span>
        <span className="mk-sleeve__tag">
          {wrappedFor === 1 ? 'morgen open' : `nog ${wrappedFor} dagen`}
        </span>
      </span>
    );
  return (
    <span
      className={`mk-sleeve mk-sleeve--${size}`}
      style={{ background: s.bg, color: s.ink }}
      aria-hidden="true"
    >
      {cover.status === 'ready' ? (
        <img src={cover.url} alt="" />
      ) : (
        <>
          <span className="mk-sleeve__motif">{s.motif}</span>
          <span className="mk-sleeve__title">{record.title}</span>
        </>
      )}
      <span className="mk-sleeve__disc" />
    </span>
  );
}

/* ---------------------------------------------------------- turntable */

function Turntable({
  record,
  playing,
  progress,
}: {
  record?: OurRecord;
  playing: boolean;
  progress: number;
}) {
  const s = SLEEVES[record?.sleeve ?? 0] ?? SLEEVES[0];
  const cover = useMediaUrl(record?.cover?.type === 'local' ? record.cover.mediaId : undefined);
  // The arm rests aside, swings in when playing, and creeps inward with the song.
  const arm = !record || !playing ? -4 : 10 + progress * 16;
  return (
    <div className="deck" aria-hidden="true">
      <div className="deck__plinth">
        <div className="deck__platter">
          <AnimatePresence mode="wait">
            {record && (
              <motion.div
                key={record.id}
                className={`deck__record ${playing ? 'is-spinning' : ''}`}
                initial={{ x: 220, opacity: 0, rotate: -40 }}
                animate={{ x: 0, opacity: 1, rotate: 0 }}
                exit={{ x: -220, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 120, damping: 16 }}
              >
                <span className="deck__label" style={{ background: s.bg, color: s.ink }}>
                  {cover.status === 'ready' ? (
                    <img src={cover.url} alt="" />
                  ) : (
                    <span>{s.motif}</span>
                  )}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <span className="deck__spindle" />
        </div>
        <div className="deck__arm" style={{ transform: `rotate(${arm}deg)` }}>
          <span className="deck__arm-base" />
          <span className="deck__arm-rod" />
          <span className="deck__arm-head" />
        </div>
        <span className={`deck__light ${playing ? 'is-on' : ''}`} />
        <span className="deck__knob" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- words */

function LinerLyrics({ lyrics, time, length }: { lyrics: string; time: number; length: number }) {
  const lines = useMemo(() => parseLyrics(lyrics), [lyrics]);
  if (!isTimed(lines))
    return (
      <div className="liner__lyrics liner__lyrics--plain">
        {lines.map((l, i) => (
          <p key={i}>{l.text}</p>
        ))}
      </div>
    );
  const timed = lines as KaraokeLine[];
  const m = momentAt(timed, time, length);
  if (m.kind === 'end') return <p className="liner__lyrics liner__lyrics--end">♪</p>;
  const focus = timed[m.focus];
  const next = timed[m.focus + 1];
  return (
    <div className="liner__lyrics">
      <p key={m.focus} className="liner__line">
        {m.kind === 'singing'
          ? m.words.map((w, k) => (
              <span key={k} className={time >= w.start ? 'is-sung' : ''}>
                {w.text}{' '}
              </span>
            ))
          : focus.text}
      </p>
      {next && <p className="liner__next">{next.text}</p>}
    </div>
  );
}

/* -------------------------------------------------------------- gift */

function Unwrap({
  record,
  profile,
  onOpen,
  onLater,
}: {
  record: OurRecord;
  profile: Profile;
  onOpen: () => void;
  onLater: () => void;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    // Have the song ready, so it can start on the tap.
    void getMediaUrl(record.audio.mediaId);
  }, [record.audio.mediaId]);
  return (
    <motion.div
      className="unwrap"
      role="dialog"
      aria-modal="true"
      aria-label="Een nieuw liedje voor je"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <p className="unwrap__eyebrow">van {nameOf(record.by, profile)}, voor jou</p>
      <div className="unwrap__stage">
        {!open ? (
          <motion.button
            type="button"
            className="unwrap__box"
            aria-label="Pak het uit"
            initial={reduce ? false : { scale: 0.6, rotate: -8 }}
            animate={reduce ? {} : { scale: [1, 1.04, 1], rotate: [0, -3, 3, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.6 }}
            onClick={() => {
              setOpen(true);
              playSfx('unlock', true);
              window.setTimeout(() => celebrate(), 250);
            }}
          >
            <span className="unwrap__lid" />
            <span className="unwrap__body" />
            <span className="unwrap__ribbon-v" />
            <span className="unwrap__bow">🎀</span>
          </motion.button>
        ) : (
          <motion.div
            className="unwrap__record"
            initial={reduce ? false : { y: 80, scale: 0.4, rotate: -90 }}
            animate={{ y: 0, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 110, damping: 12 }}
          >
            <Sleeve record={record} size="big" />
          </motion.div>
        )}
      </div>
      {open ? (
        <>
          <h2 className="unwrap__title">{record.title}</h2>
          <div className="unwrap__actions">
            <button type="button" className="studio-btn studio-btn--big" onClick={onOpen}>
              <Play aria-hidden="true" /> Zet hem op
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="unwrap__title">Er ligt een liedje voor je klaar</h2>
          <p className="unwrap__hint">Tik op het cadeautje</p>
          <button type="button" className="unwrap__later" onClick={onLater}>
            Later
          </button>
        </>
      )}
    </motion.div>
  );
}

/* --------------------------------------------------------------- room */

export function StudioPage() {
  const records = useContent((c) => c.studio.records);
  const listens = useContent((c) => c.studio.listens);
  const takes = useContent((c) => c.karaoke.takes);
  const songs = useContent((c) => c.karaoke.songs);
  const profile = useContent((c) => c.profile);
  const prefs = usePrefs();
  const me = useMe();
  const them: Person = me === 'you' ? 'partner' : 'you';
  const music = useMusic();
  const today = todayIso();
  const [view, setView] = useState<
    { name: 'room' } | { name: 'form'; record?: OurRecord; replyTo?: OurRecord }
  >({
    name: 'room',
  });
  const [current, setCurrent] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [gift, setGift] = useState<OurRecord | null>(null);
  const [laterIds, setLaterIds] = useState<string[]>([]);
  const audio = useRef<HTMLAudioElement>(null);
  const counted = useRef<string | null>(null);
  const reduce = useReducedMotion();

  const record = records.find((r) => r.id === current) ?? undefined;
  const src = useMediaUrl(record?.audio.mediaId);
  const fresh = newForMe({ studio: { records, listens } }, me, today).filter(
    (r) => !laterIds.includes(r.id),
  );

  // The first time here with something new: the gift waits.
  useEffect(() => {
    if (!gift && fresh.length && view.name === 'room') setGift(fresh[0]);
  }, [fresh.length, view.name]);

  // Smooth words: follow the song closely while it plays.
  useEffect(() => {
    if (!playing || reduce) return;
    let raf = 0;
    const tick = () => {
      setTime(audio.current?.currentTime ?? 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduce]);

  // The lock screen shows our song (and its buttons work).
  useEffect(() => {
    if (!record || !('mediaSession' in navigator)) return;
    const s = navigator.mediaSession;
    let alive = true;
    void (async () => {
      const art = record.cover?.type === 'local' ? await getMediaUrl(record.cover.mediaId) : null;
      if (!alive) return;
      s.metadata = new MediaMetadata({
        title: record.title,
        artist: `${nameOf(record.by, profile)} ♡`,
        album: 'De Muziekkamer',
        artwork: art
          ? [{ src: art, sizes: '512x512', type: 'image/jpeg' }]
          : [{ src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
    })();
    s.setActionHandler('play', () => void audio.current?.play());
    s.setActionHandler('pause', () => audio.current?.pause());
    s.setActionHandler('seekto', (d) => {
      if (audio.current && d.seekTime !== undefined) audio.current.currentTime = d.seekTime;
    });
    return () => {
      alive = false;
    };
  }, [record?.id]);

  useEffect(() => () => audio.current?.pause(), []);

  // The record's song on the player (never taken away while the next one loads).
  useEffect(() => {
    const el = audio.current;
    if (el && src.status === 'ready' && el.getAttribute('src') !== src.url) el.src = src.url;
  }, [src]);

  const select = (r: OurRecord) => {
    if (wrapped(r, today) && r.by !== me) {
      const days = daysUntilOpen(r, today);
      toast(
        `Dit cadeautje mag open op ${formatDate(r.opensOn, 'long')} ✨ (nog ${days} ${days === 1 ? 'dag' : 'dagen'})`,
      );
      playSfx('tap', true);
      return;
    }
    if (r.id === current) return toggle();
    audio.current?.pause();
    setCurrent(r.id);
    setTime(0);
    counted.current = null;
    playSfx('pop', true);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  const toggle = () => {
    const el = audio.current;
    if (!el || src.status !== 'ready') return;
    if (el.paused) {
      music.pause();
      void el.play().catch(() => toast('Afspelen lukte niet. Tik nog eens.', { tone: 'error' }));
    } else el.pause();
  };

  const onTime = () => {
    const el = audio.current;
    if (!el || !record) return;
    if (reduce || !playing) setTime(el.currentTime);
    // Counted once it's really been heard.
    if (counted.current !== record.id && el.currentTime > Math.min(20, (el.duration || 40) * 0.5)) {
      counted.current = record.id;
      countPlay(record.id, me);
    }
  };

  const length = record?.audio.seconds || audio.current?.duration || 1;
  const mine = listens.find((l) => l.id === `${record?.id}:${me}`);
  const theirs = listens.find((l) => l.id === `${record?.id}:${them}`);
  const isForMe = record && record.by !== me;
  const answeredBy = record ? records.filter((r) => r.replyTo === record.id) : [];
  const answers = record?.replyTo ? records.find((r) => r.id === record.replyTo) : undefined;
  const officialTakes = takes.filter((t) => t.doneAt && t.mix);

  const shown = records
    .filter((r) =>
      filter === 'mine'
        ? r.by === me
        : filter === 'forme'
          ? r.by !== me
          : filter === 'hearts'
            ? listens.some((l) => l.record === r.id && l.heart)
            : true,
    )
    .sort((a, b) => ((a.madeOn ?? a.createdAt) < (b.madeOn ?? b.createdAt) ? 1 : -1));

  if (view.name === 'form')
    return (
      <div className="page studio-page">
        <h1 className="visually-hidden">De Muziekkamer</h1>
        <RecordForm
          me={me}
          record={view.record}
          replyTo={view.replyTo}
          onDone={(saved) => {
            setView({ name: 'room' });
            if (saved) setCurrent(saved.id);
          }}
        />
      </div>
    );

  return (
    <div className="page studio-page">
      <span className="studio-lamp" aria-hidden="true" />
      <span className="studio-lights" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${(i * 0.37) % 2}s` }} />
        ))}
      </span>

      <audio
        ref={audio}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          counted.current = null;
        }}
        onTimeUpdate={onTime}
      />

      <header className="studio-head">
        <p className="studio-head__eyebrow">liedjes van ons, voor ons</p>
        <h1 className="studio-head__title">De Muziekkamer</h1>
      </header>

      {fresh.length > 0 && !gift && (
        <button type="button" className="studio-gift" onClick={() => setGift(fresh[0])}>
          <Gift aria-hidden="true" />
          <span>
            Er ligt een nieuw liedje voor je klaar
            <small>van {nameOf(fresh[0].by, profile)}</small>
          </span>
        </button>
      )}

      <section className="studio-player" aria-label="Draaitafel">
        <Turntable record={record} playing={playing} progress={Math.min(1, time / length)} />
        {record ? (
          <div className="studio-now">
            <p className="studio-now__for">
              van {nameOf(record.by, profile)} ·{' '}
              {record.for === 'both'
                ? 'voor ons'
                : `voor ${record.for === me ? 'jou' : nameOf(record.for, profile)}`}
            </p>
            <h2 className="studio-now__title">{record.title}</h2>
            <div className="studio-controls">
              <button
                type="button"
                className="studio-play"
                onClick={toggle}
                disabled={src.status !== 'ready'}
                aria-label={playing ? 'Pauze' : 'Afspelen'}
              >
                {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              </button>
            </div>
            <div className="studio-seek">
              <span>{minutes(time)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.round(length))}
                step={0.5}
                value={Math.min(time, length)}
                aria-label="Waar in het liedje"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (audio.current) audio.current.currentTime = v;
                  setTime(v);
                }}
              />
              <span>{minutes(length)}</span>
            </div>
            {src.status === 'missing' && (
              <p className="studio-hint">Dit liedje staat (nog) niet op deze telefoon.</p>
            )}
          </div>
        ) : (
          <div className="studio-now studio-now--empty">
            <p>
              {records.length
                ? 'Kies een plaat van de plank'
                : 'Zet jullie eerste liedje op de plank: een liedje dat je voor de ander maakte, of samen.'}
            </p>
          </div>
        )}
      </section>

      {record && (
        <article className="liner">
          <header className="liner__head">
            <span className="liner__kicker">liner notes</span>
            {record.madeOn && (
              <span className="liner__date">{formatDate(record.madeOn, 'long')}</span>
            )}
          </header>
          {answers && (
            <button type="button" className="liner__link" onClick={() => select(answers)}>
              <Reply aria-hidden="true" /> antwoord op “{answers.title}”
            </button>
          )}
          {record.story && <p className="liner__story">{record.story}</p>}
          {record.lyrics && <LinerLyrics lyrics={record.lyrics} time={time} length={length} />}
          <footer className="liner__foot">
            {isForMe ? (
              <button
                type="button"
                className={`liner__heart ${mine?.heart ? 'is-on' : ''}`}
                aria-pressed={!!mine?.heart}
                onClick={() => {
                  toggleHeart(record.id, me);
                  if (!mine?.heart) playSfx('sparkle', true);
                }}
              >
                <Heart aria-hidden="true" fill={mine?.heart ? 'currentColor' : 'none'} />
                {mine?.heart ? 'Je favoriet' : 'Hartje'}
              </button>
            ) : (
              theirs?.heart && (
                <span className="liner__heart is-on">
                  <Heart aria-hidden="true" fill="currentColor" /> {nameOf(them, profile)} vindt hem
                  prachtig
                </span>
              )
            )}
            {theirs?.plays ? (
              <span className="liner__plays">
                {nameOf(them, profile)} luisterde {theirs.plays}×
              </span>
            ) : record.by === me ? (
              <span className="liner__plays">
                {nameOf(them, profile)} heeft hem nog niet gehoord
              </span>
            ) : null}
          </footer>
          {theirs?.note && (
            <blockquote className="liner__note">
              “{theirs.note}” <cite>— {nameOf(them, profile)}</cite>
            </blockquote>
          )}
          {isForMe && (
            <NoteBox
              key={record.id}
              value={mine?.note ?? ''}
              onSave={(v) => setNote(record.id, me, v)}
            />
          )}
          {answeredBy.length > 0 && (
            <div className="liner__answers">
              {answeredBy.map((a) => (
                <button key={a.id} type="button" className="liner__link" onClick={() => select(a)}>
                  <Reply aria-hidden="true" /> antwoordliedje: “{a.title}”
                </button>
              ))}
            </div>
          )}
          <div className="liner__actions">
            <button
              type="button"
              className="studio-chip"
              onClick={() => setView({ name: 'form', replyTo: record })}
            >
              <Reply aria-hidden="true" /> Antwoordliedje maken
            </button>
            <button
              type="button"
              className="studio-chip"
              aria-pressed={prefs.customSoundtrackId === record.audio.mediaId}
              onClick={() => {
                updatePrefs({
                  soundtrack: 'custom',
                  customSoundtrackId: record.audio.mediaId,
                  customSoundtrackName: record.title,
                });
                toast('Dit liedje speelt nu bij “Start ons verhaal” 🎶');
              }}
            >
              <Sparkles aria-hidden="true" />
              {prefs.customSoundtrackId === record.audio.mediaId
                ? 'Ons openingsliedje ✓'
                : 'Als openingsliedje'}
            </button>
            {record.by === me && (
              <>
                <button
                  type="button"
                  className="studio-chip"
                  onClick={() => setView({ name: 'form', record })}
                >
                  <Pencil aria-hidden="true" /> Aanpassen
                </button>
                <button
                  type="button"
                  className="studio-chip"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `“${record.title}” weghalen?`,
                        message: 'Het liedje gaat van de plank, bij jullie allebei.',
                        tone: 'danger',
                        confirmLabel: 'Weghalen',
                      })
                    ) {
                      audio.current?.pause();
                      setCurrent(null);
                      removeRecord(record.id);
                    }
                  }}
                >
                  <Trash2 aria-hidden="true" /> Weghalen
                </button>
              </>
            )}
          </div>
        </article>
      )}

      <section className="mk-shelf" aria-labelledby="shelf-title">
        <div className="mk-shelf__head">
          <h2 id="shelf-title">De plank</h2>
          <button type="button" className="studio-btn" onClick={() => setView({ name: 'form' })}>
            <Plus aria-hidden="true" /> Nieuw liedje
          </button>
        </div>
        {records.length > 0 && (
          <div className="studio-filters" role="group" aria-label="Laat zien">
            {(
              [
                ['all', 'Alles'],
                ['forme', `Van ${nameOf(them, profile)}`],
                ['mine', 'Van mij'],
                ['hearts', '♡ Favorieten'],
              ] as [Filter, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {shown.length === 0 ? (
          <p className="mk-shelf__empty">
            {records.length
              ? 'Hier staat (nog) niks.'
              : 'Nog leeg. Tik op “Nieuw liedje” en kies een liedje van je telefoon.'}
          </p>
        ) : (
          <ul className="mk-shelf__grid">
            {shown.map((r) => {
              const isWrapped = wrapped(r, today) && r.by !== me;
              const unheard =
                r.by !== me &&
                !isWrapped &&
                !listenOf({ studio: { records, listens } }, r.id, me)?.plays;
              const fav = listens.some((l) => l.record === r.id && l.heart);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`mk-shelf__item ${r.id === current ? 'is-current' : ''}`}
                    onClick={() => select(r)}
                  >
                    <Sleeve
                      record={r}
                      wrappedFor={isWrapped ? daysUntilOpen(r, today) : undefined}
                    />
                    {unheard && <span className="mk-shelf__new">nieuw</span>}
                    {fav && !isWrapped && <span className="mk-shelf__fav">♥</span>}
                    <span className="mk-shelf__caption">
                      <strong>{isWrapped ? 'Een cadeautje 🎁' : r.title}</strong>
                      <small>
                        van {r.by === me ? 'jou' : nameOf(r.by, profile)}
                        {r.by === me && wrapped(r, today)
                          ? ` · ingepakt tot ${formatDate(r.opensOn, 'short')}`
                          : ''}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {officialTakes.length > 0 && (
        <section className="mk-shelf mk-shelf--old">
          <h2>Uit de karaoke</h2>
          <ul className="old-takes">
            {officialTakes.map((t) => (
              <OldTake
                key={t.id}
                title={songs.find((s) => s.id === t.song)?.title ?? 'Karaoke'}
                mediaId={t.mix!.mediaId}
              />
            ))}
          </ul>
        </section>
      )}

      <AnimatePresence>
        {gift && (
          <Unwrap
            key={gift.id}
            record={gift}
            profile={profile}
            onLater={() => {
              setLaterIds((ids) => [...ids, gift.id]);
              setGift(null);
            }}
            onOpen={() => {
              const r = gift;
              setGift(null);
              setLaterIds((ids) => [...ids, r.id]);
              setCurrent(r.id);
              setTime(0);
              counted.current = null;
              music.pause();
              // Start on this tap: the song was fetched while unwrapping.
              void getMediaUrl(r.audio.mediaId).then((url) => {
                const el = audio.current;
                if (el && url) {
                  if (el.getAttribute('src') !== url) el.src = url;
                  void el.play().catch(() => undefined);
                }
              });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NoteBox({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(value);
  return (
    <form
      className="liner__write"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(text);
        setSaved(text);
        toast('Je reactie staat bij het liedje ♡');
      }}
    >
      <label>
        <span>Een berichtje terug</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={1000}
        />
      </label>
      {text.trim() !== saved.trim() && (
        <button type="submit" className="studio-chip">
          Bewaar
        </button>
      )}
    </form>
  );
}

function OldTake({ title, mediaId }: { title: string; mediaId: string }) {
  const src = useMediaUrl(mediaId);
  return (
    <li>
      <span>🎤 {title}</span>
      {src.status === 'ready' && <audio src={src.url} controls preload="none" />}
    </li>
  );
}
