import { useState } from 'react';
import { Mic, MicVocal, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useContent } from '../../data/store';
import { nameOf, useMe } from '../../data/people';
import type { KaraokeSong, KaraokeTake, Person } from '../../data/types';
import { confirm, toast } from '../../components/ui/feedback';
import { formatTimestamp } from '../../lib/dates';
import { canSing, clapTest, deviceDelay, openMic, saveDeviceDelay } from './audio';
import { SongEditor } from './SongEditor';
import { Listen, Review, Stage, type Recorded } from './Stage';
import { removeSong, removeTake } from './karaokeData';
import './karaoke.css';

/*
 * The karaoke room. Sing solo, together at one phone (both of you at once), or
 * a duet the way Smule does it: one sings their lines, the other hears that
 * voice and sings theirs, and the two become the official recording.
 */

type View =
  | { name: 'room' }
  | { name: 'edit'; song?: KaraokeSong }
  | {
      name: 'sing';
      song: KaraokeSong;
      mode: KaraokeTake['mode'];
      roles?: { a: Person; b: Person };
      take?: KaraokeTake;
    }
  | {
      name: 'review';
      song: KaraokeSong;
      mode: KaraokeTake['mode'];
      roles?: { a: Person; b: Person };
      take?: KaraokeTake;
      fresh?: Recorded;
    };

export function KaraokePage() {
  const songs = useContent((c) => c.karaoke.songs);
  const takes = useContent((c) => c.karaoke.takes);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const them: Person = me === 'you' ? 'partner' : 'you';
  const [view, setView] = useState<View>({ name: 'room' });
  const [listening, setListening] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<KaraokeSong | null>(null);
  const songOf = (id: string) => songs.find((s) => s.id === id);

  if (view.name === 'edit')
    return (
      <div className="page kar-page">
        <h1 className="visually-hidden">Karaoke Kamer</h1>
        <SongEditor song={view.song} onDone={() => setView({ name: 'room' })} />
      </div>
    );
  if (view.name === 'sing')
    return (
      <div className="page kar-page kar-page--stage">
        <h1 className="visually-hidden">Karaoke Kamer: zingen</h1>
        <Stage
          song={view.song}
          mode={view.mode}
          me={me}
          roles={view.roles}
          take={view.take}
          profile={profile}
          onCancel={() => setView({ name: 'room' })}
          onRecorded={(fresh) => setView({ ...view, name: 'review', fresh })}
        />
      </div>
    );
  if (view.name === 'review')
    return (
      <div className="page kar-page kar-page--stage">
        <h1 className="visually-hidden">Karaoke Kamer: terugluisteren</h1>
        <Review
          song={view.song}
          mode={view.mode}
          me={me}
          roles={view.roles}
          take={view.take}
          fresh={view.fresh}
          profile={profile}
          onAgain={() => setView({ ...view, name: 'sing' })}
          onDone={() => setView({ name: 'room' })}
        />
      </div>
    );

  const open = takes.filter((t) => t.mode === 'duet' && !t.doneAt && songOf(t.song));
  const mineToSing = open.filter((t) => t.roles && t.voices.every((v) => v.who !== me));
  const waiting = open.filter((t) => t.voices.some((v) => v.who === me));
  const official = takes
    .filter((t) => t.doneAt && t.mix && songOf(t.song))
    .sort((a, b) => (a.doneAt! < b.doneAt! ? 1 : -1));
  const singers = (t: KaraokeTake) =>
    t.mode === 'together'
      ? `${nameOf('you', profile)} & ${nameOf('partner', profile)}, samen`
      : t.mode === 'duet'
        ? `Duet: ${nameOf('you', profile)} & ${nameOf('partner', profile)}`
        : `Solo: ${nameOf(t.voices[0]?.who === 'partner' ? 'partner' : 'you', profile)}`;

  const start = (
    song: KaraokeSong,
    mode: KaraokeTake['mode'],
    roles?: { a: Person; b: Person },
  ) => {
    if (!canSing())
      return toast('Deze browser kan niet opnemen. Probeer Safari of Chrome.', { tone: 'error' });
    setChoosing(null);
    setView({ name: 'sing', song, mode, roles });
  };

  return (
    <div className="page kar-page">
      <header className="kar-hero">
        <span className="kar-hero__lights" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.21}s` }} />
          ))}
        </span>
        <span className="kar-hero__beam kar-hero__beam--l" aria-hidden="true" />
        <span className="kar-hero__beam kar-hero__beam--r" aria-hidden="true" />
        <p className="kar-hero__eyebrow">tonight on stage</p>
        <h1 className="kar-hero__title">
          <MicVocal aria-hidden="true" /> Karaoke Kamer
        </h1>
        <p className="kar-hero__sub">
          Solo, samen op één telefoon, of een duet om de beurt — en elke opname bewaren we.
        </p>
      </header>

      {mineToSing.length > 0 && (
        <section className="kar-section">
          <h2>🎤 Wacht op jou</h2>
          <ul className="kar-list">
            {mineToSing.map((t) => {
              const song = songOf(t.song)!;
              return (
                <li key={t.id} className="kar-item kar-item--hot">
                  <span className="kar-item__text">
                    <strong>{song.title}</strong>
                    <small>
                      {nameOf(them, profile)} zong in · {formatTimestamp(t.createdAt)}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="kar-mini"
                    onClick={() =>
                      setView({ name: 'sing', song, mode: 'duet', roles: t.roles, take: t })
                    }
                  >
                    <Mic aria-hidden="true" /> Zing mee
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {waiting.length > 0 && (
        <section className="kar-section">
          <h2>⏳ Bij {nameOf(them, profile)}</h2>
          <ul className="kar-list">
            {waiting.map((t) => (
              <li key={t.id} className="kar-item">
                <span className="kar-item__text">
                  <strong>{songOf(t.song)!.title}</strong>
                  <small>Jij zong in · wacht tot {nameOf(them, profile)} meezingt</small>
                </span>
                <button
                  type="button"
                  className="kar-icon"
                  aria-label="Weggooien"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: 'Dit duet weggooien?',
                        message: 'Jouw opname gaat ook weg.',
                        tone: 'danger',
                        confirmLabel: 'Weggooien',
                      })
                    )
                      removeTake(t.id);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="kar-section">
        <div className="kar-section__head">
          <h2>🎶 Onze nummers</h2>
          <button type="button" className="kar-mini" onClick={() => setView({ name: 'edit' })}>
            <Plus aria-hidden="true" /> Nummer
          </button>
        </div>
        {songs.length === 0 ? (
          <p className="kar-empty">
            Nog geen nummers. Voeg een karaokeversie toe (muziek zonder zang) en plak de tekst
            erbij.
          </p>
        ) : (
          <ul className="kar-list">
            {songs.map((song) => {
              const duet =
                song.lines.some((l) => l.part === 'a') && song.lines.some((l) => l.part === 'b');
              return (
                <li key={song.id} className="kar-item kar-item--song">
                  <span className="kar-item__text">
                    <strong>{song.title}</strong>
                    <small>
                      {song.artist ? `${song.artist} · ` : ''}
                      {song.lines.length} regels
                    </small>
                  </span>
                  <span className="kar-item__actions">
                    <button type="button" className="kar-mini" onClick={() => start(song, 'solo')}>
                      Solo
                    </button>
                    <button
                      type="button"
                      className="kar-mini"
                      onClick={() => start(song, 'together')}
                    >
                      <Users aria-hidden="true" /> Samen hier
                    </button>
                    <button
                      type="button"
                      className="kar-mini"
                      disabled={!duet}
                      title={
                        duet ? undefined : 'Geef regels Stem 1 en Stem 2 om een duet te zingen'
                      }
                      onClick={() => setChoosing(song)}
                    >
                      Duet
                    </button>
                    <button
                      type="button"
                      className="kar-icon"
                      aria-label={`${song.title} aanpassen`}
                      onClick={() => setView({ name: 'edit', song })}
                    >
                      <Pencil aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="kar-icon"
                      aria-label={`${song.title} weggooien`}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `“${song.title}” weggooien?`,
                            message: 'Ook de opnames van dit nummer gaan weg.',
                            tone: 'danger',
                            confirmLabel: 'Weggooien',
                          })
                        )
                          removeSong(song.id);
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </span>
                  {choosing?.id === song.id && (
                    <div className="kar-choose">
                      <p>Welke stem zing jij? {nameOf(them, profile)} zingt daarna de andere.</p>
                      <div className="kar-row">
                        <button
                          type="button"
                          className="kar-mini kar-part--a"
                          onClick={() => start(song, 'duet', { a: me, b: them })}
                        >
                          Ik zing Stem 1
                        </button>
                        <button
                          type="button"
                          className="kar-mini kar-part--b"
                          onClick={() => start(song, 'duet', { a: them, b: me })}
                        >
                          Ik zing Stem 2
                        </button>
                        <button
                          type="button"
                          className="kar-mini kar-mini--ghost"
                          onClick={() => setChoosing(null)}
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="kar-section">
        <h2>💿 Officiële opnames</h2>
        {official.length === 0 ? (
          <p className="kar-empty">Hier komt elke opname die jullie opslaan als officieel.</p>
        ) : (
          <ul className="kar-list">
            {official.map((t) => {
              const song = songOf(t.song)!;
              const open = listening === t.id;
              return (
                <li key={t.id} className={`kar-item kar-item--record ${open ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="kar-record"
                    aria-expanded={open}
                    onClick={() => setListening(open ? null : t.id)}
                  >
                    <span className="kar-record__disc" aria-hidden="true" />
                    <span className="kar-item__text">
                      <strong>{song.title}</strong>
                      <small>
                        {singers(t)} · {formatTimestamp(t.doneAt!)}
                      </small>
                    </span>
                  </button>
                  {open && (
                    <>
                      <Listen song={song} take={t} me={me} profile={profile} />
                      <div className="kar-row">
                        <button
                          type="button"
                          className="kar-mini kar-mini--ghost"
                          onClick={() =>
                            setView({ name: 'review', song, mode: t.mode, roles: t.roles, take: t })
                          }
                        >
                          Mix aanpassen
                        </button>
                        <button
                          type="button"
                          className="kar-mini kar-mini--ghost"
                          onClick={async () => {
                            if (
                              await confirm({
                                title: 'Deze opname weggooien?',
                                message: 'Dat kan niet ongedaan worden.',
                                tone: 'danger',
                                confirmLabel: 'Weggooien',
                              })
                            )
                              removeTake(t.id);
                          }}
                        >
                          Weggooien
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ClapTest />
    </div>
  );
}

/** Measures how late this phone hears and records, so voices land on the beat. */
function ClapTest() {
  const [busy, setBusy] = useState(false);
  const [delay, setDelay] = useState(deviceDelay);
  return (
    <section className="kar-section kar-section--small">
      <h2>👏 Klap-test</h2>
      <p className="kar-hint kar-hint--light">
        Elke telefoon (en zeker een bluetooth-koptelefoon) is een beetje laat. Zet je koptelefoon
        op, tik op Start en klap precies mee op de 8 tikken. Nu: {delay} ms.
      </p>
      <button
        type="button"
        className="kar-mini"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          let mic: MediaStream | null = null;
          try {
            mic = await openMic({ speaker: false });
            const ms = await clapTest(mic);
            if (ms === null)
              toast('We hoorden de klappen niet goed. Klap wat harder en probeer het nog eens.', {
                tone: 'error',
              });
            else {
              const rounded = Math.round(Math.max(0, Math.min(600, ms)));
              saveDeviceDelay(rounded);
              setDelay(rounded);
              toast(`Gemeten: ${rounded} ms ✨`);
            }
          } catch (error) {
            toast((error as Error).message, { tone: 'error' });
          } finally {
            mic?.getTracks().forEach((t) => t.stop());
            setBusy(false);
          }
        }}
      >
        {busy ? 'Klap mee…' : 'Start'}
      </button>
    </section>
  );
}
