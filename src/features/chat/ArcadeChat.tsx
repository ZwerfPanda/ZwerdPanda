import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import { getContent, useContent } from '../../data/store';
import { nameOf, useMe } from '../../data/people';
import type { ChatMessage, GameId, Person } from '../../data/types';
import { href, navigate, useRoute, type RoutePath } from '../../lib/router';
import { sectionFor } from '../../app/sections';
import { toast } from '../../components/ui/feedback';
import { playSfx } from '../../lib/audio/sfx';
import { useReducedMotion } from '../../hooks/useMotion';
import { formatDate, todayIso } from '../../lib/dates';
import { GAME_NAMES } from '../games/gameStats';
import {
  ONLINE_FOR,
  installChat,
  markRead,
  sendChat,
  setPlace,
  typing,
  unreadFor,
  useLive,
} from './chatData';
import './chat.css';

/*
 * The arcade's chat, and where the other one is: a chat button wherever you
 * are in the arcade, a banner in the hall ("playing Go Fish — join"),
 * a little light on the cabinet they're at, and "here too" in a game.
 */

const DOING: Record<string, string> = {
  uno: 'speelt UNO 🃏',
  c4: 'speelt 4 op een rij 🔴',
  hangman: 'speelt galgje 🪢',
  bowling: 'is aan het bowlen 🎳',
  skeeball: 'speelt skeeball 🎯',
  darts: 'is aan het darten 🎯',
  zeeslag: 'speelt Pannenkoekenslag 🥞',
  memory: 'speelt memory 🧠',
  hockey: 'speelt airhockey 🏒',
  bingo: 'speelt bingo 🎱',
  kwartet: 'speelt Go Fish 🐟',
  grab: 'staat bij de grijpmachine 🕹️',
  prizes: 'kijkt bij de prijzenkast 🎟️',
  quiz: 'speelt Wie kent wie 🎤',
};

/** Where we are, as a short code. */
export function placeOf(path: RoutePath, game: string | null): string {
  if (path === '/games') return game ? `game:${game}` : 'hall';
  if (path === '/quiz') return 'game:quiz';
  return `page:${path}`;
}

/** "speelt Go Fish 🐟", "is in de Arcade Hall", "is in Onze brieven". */
export function placeLabel(place: string): string {
  if (place === 'hall') return 'is in de Arcade Hall 🕹️';
  if (place.startsWith('game:')) return DOING[place.slice(5)] ?? 'is in de arcade 🎮';
  if (place.startsWith('page:')) {
    const s = sectionFor(place.slice(5) as RoutePath);
    return s.path === '/' ? 'is in de app' : `is in ${s.label}`;
  }
  return 'is in de app';
}

const isGame = (g: string | null): g is GameId => !!g && g in GAME_NAMES;
const linkTo = (g: string) => (g === 'quiz' ? href('/quiz') : href('/games', { g }));

const gameOf = (place: string | null) => (place?.startsWith('game:') ? place.slice(5) : null);

/** Where the other one is: now (live), or last (saved). */
export function usePartner() {
  const me = useMe();
  const them: Person = me === 'you' ? 'partner' : 'you';
  const live = useLive();
  const saved = useContent((c) => c.chat.places[them]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(t);
  }, []);
  const online = live.seen > 0 && now - live.seen < ONLINE_FOR;
  const place = online ? live.place : (saved?.place ?? null);
  const ago = online ? 0 : saved ? now - Date.parse(saved.at) : Infinity;
  return { them, online, place, ago, typing: live.typingUntil > now };
}

const agoText = (ms: number) => {
  const m = Math.round(ms / 60_000);
  if (m < 1) return 'net';
  if (m < 60) return `${m} min geleden`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} uur geleden` : null;
};

/* ------------------------------------------------- presence in the hall */

export function PresenceBanner() {
  const profile = useContent((c) => c.profile);
  const { them, online, place, ago } = usePartner();
  const name = nameOf(them, profile);
  if (!place) return null;
  const game = gameOf(place);
  if (!online) {
    const when = agoText(ago);
    if (!when || ago > 2 * 3_600_000) return null;
    const inArcade = place === 'hall' || !!game;
    return (
      <p className="presence presence--away">
        <span className="presence__dot" aria-hidden="true" /> {name} was {when}{' '}
        {inArcade ? 'nog in de arcade' : 'online'}
      </p>
    );
  }
  return (
    <div className="presence presence--live" role="status">
      <span className="presence__dot is-live" aria-hidden="true" />
      <span className="presence__text">
        <strong>{name}</strong> {placeLabel(place)}
      </span>
      {game && (
        <a className="presence__go" href={linkTo(game)}>
          Ga erheen
        </a>
      )}
    </div>
  );
}

/** On a cabinet: the other one is playing this right now. */
export function PresenceDot({ game }: { game: string }) {
  const profile = useContent((c) => c.profile);
  const { them, online, place } = usePartner();
  if (!online || place !== `game:${game}`) return null;
  return (
    <span className="presence-tag">
      <span className="presence__dot is-live" aria-hidden="true" />
      {nameOf(them, profile)}
    </span>
  );
}

/** In a game: the other one is here too (or elsewhere in the arcade). */
export function PresencePill({ game }: { game: string }) {
  const profile = useContent((c) => c.profile);
  const { them, online, place } = usePartner();
  if (!online || !place) return null;
  const name = nameOf(them, profile);
  const same = place === `game:${game}`;
  return (
    <p className={`presence-pill ${same ? 'is-same' : ''}`} role="status">
      <span className="presence__dot is-live" aria-hidden="true" />
      {same ? `${name} is ook hier 👀` : `${name} ${placeLabel(place)}`}
    </p>
  );
}

/* ------------------------------------------------------------- the chat */

const QUICK = ['GG 😂', 'Jouw beurt 👀', 'Nog eentje? 🎮', '❤️', '😘'];

function Bubble({ m, mine, name }: { m: ChatMessage; mine: boolean; name: string }) {
  const time = new Date(m.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  return (
    <li className={`bubble ${mine ? 'is-mine' : 'is-theirs'} ${m.invite ? 'is-invite' : ''}`}>
      <span className="bubble__text">{m.text}</span>
      {m.invite && !mine && (
        <a className="bubble__join" href={linkTo(m.invite)}>
          Doe mee 🎮
        </a>
      )}
      <span className="bubble__time">
        {mine ? '' : `${name} · `}
        {time}
      </span>
    </li>
  );
}

function ChatSheet({ onClose, game }: { onClose: () => void; game: string | null }) {
  const messages = useContent((c) => c.chat.messages);
  const read = useContent((c) => c.chat.read);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const { them, online, place, typing: isTyping } = usePartner();
  const [text, setText] = useState('');
  const list = useRef<HTMLOListElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const name = nameOf(them, profile);
  const theirRead = read[them];
  const lastMine = [...messages].reverse().find((m) => m.from === me);

  useEffect(() => {
    markRead();
    list.current?.scrollTo({
      top: list.current.scrollHeight,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [messages.length, isTyping]);
  useEffect(() => {
    sheet.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const send = (value: string, invite?: GameId) => {
    if (!value.trim()) return;
    sendChat(value, invite);
    setText('');
    playSfx('pop', true);
  };
  const playable = isGame(game) ? game : null;

  // Day separators: "vandaag", or the date.
  const groups = useMemo(() => {
    const out: { day: string; items: ChatMessage[] }[] = [];
    for (const m of messages.slice(-150)) {
      const day = todayIso(new Date(m.at));
      if (out.at(-1)?.day !== day) out.push({ day, items: [] });
      out.at(-1)!.items.push(m);
    }
    return out;
  }, [messages]);

  return (
    <motion.div
      ref={sheet}
      tabIndex={-1}
      className="chat-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`Chat met ${name}`}
      initial={reduce ? { opacity: 0 } : { y: '100%' }}
      animate={reduce ? { opacity: 1 } : { y: 0 }}
      exit={reduce ? { opacity: 0 } : { y: '100%' }}
      transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 260, damping: 30 }}
    >
      <div className="chat-sheet__head">
        <span className={`presence__dot ${online ? 'is-live' : ''}`} aria-hidden="true" />
        <span className="chat-sheet__who">
          <strong>{name}</strong>
          <small>
            {isTyping
              ? 'typt…'
              : online && place
                ? placeLabel(place)
                : online
                  ? 'online'
                  : 'niet online'}
          </small>
        </span>
        <button type="button" className="chat-sheet__close" onClick={onClose} aria-label="Sluiten">
          <X aria-hidden="true" />
        </button>
      </div>
      <ol className="chat-sheet__list" ref={list}>
        {messages.length === 0 && (
          <li className="chat-sheet__empty">Stuur {name} een berichtje, of een uitdaging 🎮</li>
        )}
        {groups.map((g) => (
          <li key={g.day} className="chat-day">
            <span className="chat-day__label">
              {g.day === todayIso() ? 'vandaag' : formatDate(g.day, 'long')}
            </span>
            <ol>
              {g.items.map((m) => (
                <Bubble key={m.id} m={m} mine={m.from === me} name={name} />
              ))}
            </ol>
          </li>
        ))}
        {lastMine && theirRead && theirRead >= lastMine.at && (
          <li className="chat-seen">gelezen ✓✓</li>
        )}
        {isTyping && (
          <li className="bubble is-theirs is-typing" aria-label={`${name} typt`}>
            <span />
            <span />
            <span />
          </li>
        )}
      </ol>
      <div className="chat-sheet__quick">
        {playable && (
          <button
            type="button"
            className="chat-quick chat-quick--invite"
            onClick={() => send(`Kom je ${GAME_NAMES[playable]} met me spelen? 🎮`, playable)}
          >
            Daag uit voor {GAME_NAMES[playable]}
          </button>
        )}
        {QUICK.map((q) => (
          <button key={q} type="button" className="chat-quick" onClick={() => send(q)}>
            {q}
          </button>
        ))}
      </div>
      <form
        className="chat-sheet__form"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
          input.current?.focus();
        }}
      >
        <input
          ref={input}
          className="input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            typing();
          }}
          placeholder={`Bericht aan ${name}`}
          aria-label={`Bericht aan ${name}`}
          maxLength={1000}
          enterKeyHint="send"
        />
        <button type="submit" className="chat-send" disabled={!text.trim()} aria-label="Verstuur">
          <Send aria-hidden="true" />
        </button>
      </form>
    </motion.div>
  );
}

const OPEN_CHAT = 'olu:open-chat';

/** In a game the chat sits in the top bar, out of the way of the cards. */
export function ChatBarButton() {
  const me = useMe();
  const messages = useContent((c) => c.chat.messages);
  const read = useContent((c) => c.chat.read[me]);
  const unread = unreadFor(me, messages, read);
  return (
    <button
      type="button"
      className={`game__refresh chat-bar-btn ${unread ? 'has-unread' : ''}`}
      onClick={() => window.dispatchEvent(new Event(OPEN_CHAT))}
      aria-label={unread ? `Chat, ${unread} nieuw` : 'Chat'}
    >
      <MessageCircle aria-hidden="true" />
      {unread > 0 && <span className="chat-fab__badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
  );
}

/**
 * Wherever you are: tells the other phone where you are, hears their messages
 * (a toast when the chat is closed), and in the arcade shows the chat button.
 */
export function ChatHost() {
  const route = useRoute();
  const me = useMe();
  const messages = useContent((c) => c.chat.messages);
  const read = useContent((c) => c.chat.read[me]);
  const game = route.params.get('g');
  const inArcade = route.path === '/games' || route.path === '/quiz';
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => setPlace(placeOf(route.path, game)), [route.path, game]);
  useEffect(
    () =>
      installChat((m) => {
        if (openRef.current) return;
        playSfx('chime', true);
        toast(`💬 ${nameOf(m.from, getContent().profile)}: ${m.text.slice(0, 80)}`);
      }),
    [],
  );
  const openChat = () => {
    opener.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  };
  useEffect(() => {
    window.addEventListener(OPEN_CHAT, openChat);
    return () => window.removeEventListener(OPEN_CHAT, openChat);
  }, []);
  useEffect(() => {
    if (route.params.get('chat') === '1') setOpen(true);
  }, [route.params]);
  useEffect(() => {
    if (!inArcade) setOpen(false);
  }, [inArcade]);
  const close = () => {
    setOpen(false);
    opener.current?.focus({ preventScroll: true });
    if (route.params.get('chat')) navigate('/games');
  };

  const unread = unreadFor(me, messages, read);
  if (!inArcade) return null;
  const inGame = route.path === '/quiz' || !!game;
  return (
    <>
      {!inGame && (
        <button
          type="button"
          className={`chat-fab ${unread ? 'has-unread' : ''}`}
          onClick={() => openChat()}
          aria-label={unread ? `Chat, ${unread} nieuw` : 'Chat'}
        >
          <MessageCircle aria-hidden="true" />
          {unread > 0 && <span className="chat-fab__badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
      )}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="chat-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />
            <ChatSheet key="sheet" game={route.path === '/quiz' ? 'quiz' : game} onClose={close} />
          </>
        )}
      </AnimatePresence>
    </>
  );
}
