import { useSyncExternalStore } from 'react';
import { getContent, updateContent } from '../../data/store';
import { getMe, nameOf } from '../../data/people';
import type { ChatMessage, GameId, Person, Whereabouts } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { notifyOther } from '../../lib/push';
import { liveConnected, onLiveMessage, sendLiveMessage } from '../../sync/live';
import { normalizeContent } from '../../data/normalize';

/*
 * Our chat in the arcade, and where each of us is. A message is saved like
 * everything else (so nothing is lost) and also sent over the live line, so
 * it's there in a moment. Where we are travels only over the live line, as a
 * little "I'm here" every few seconds; the last place is also saved, for a
 * "was here a few minutes ago".
 */

const other = (p: Person): Person => (p === 'you' ? 'partner' : 'you');

/* ------------------------------------------------------- the other one, live */

interface Live {
  place: string | null;
  /** When we last heard from them (ms). */
  seen: number;
  typingUntil: number;
}

let live: Live = { place: null, seen: 0, typingUntil: 0 };
const listeners = new Set<() => void>();
const changed = (next: Partial<Live>) => {
  live = { ...live, ...next };
  listeners.forEach((l) => l());
};

/** They count as here for a while after their last "I'm here". */
export const ONLINE_FOR = 45_000;

export function useLive(): Live {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => live,
  );
}

/* ------------------------------------------------------------- messages */

const addMessage = (m: ChatMessage) =>
  updateContent((c) =>
    c.chat.messages.some((x) => x.id === m.id)
      ? c
      : { ...c, chat: { ...c.chat, messages: [...c.chat.messages, m].slice(-800) } },
  );

export function sendChat(text: string, invite?: GameId) {
  const clean = text.trim().slice(0, 1000);
  if (!clean) return;
  const me = getMe();
  const message: ChatMessage = {
    id: createId('chat'),
    from: me,
    text: clean,
    at: nowIso(),
    ...(invite ? { invite } : {}),
  };
  addMessage(message);
  markRead(message.at);
  const push = () =>
    notifyOther(
      'news',
      {
        title: `💬 ${nameOf(me, getContent().profile)}`,
        body: clean.slice(0, 140),
        url: invite ? `#/games?g=${invite}` : '#/games?chat=1',
        tag: 'chat',
      },
      3_000,
    );
  // Not in the app (or no live line): a notification right away. In the app:
  // their phone says "got it" when the message is on screen; if that doesn't
  // come (closed in the background, screen off), a notification after all.
  sendLiveMessage({ type: 'chat', message });
  if (!liveConnected() || Date.now() - live.seen > ONLINE_FOR) {
    push();
    return;
  }
  awaiting.set(
    message.id,
    window.setTimeout(() => {
      awaiting.delete(message.id);
      push();
    }, ACK_WAIT),
  );
}

/** Messages sent that their phone hasn't said "got it" to yet. */
const awaiting = new Map<string, number>();
/** How long to wait for "got it" before a notification goes out anyway. */
export const ACK_WAIT = 5000;

export function markRead(upTo = nowIso()) {
  const me = getMe();
  const had = getContent().chat.read[me];
  if (had && had >= upTo) return;
  saveRead(me, upTo);
  // only worth telling when there's something of theirs to have read
  if (getContent().chat.messages.some((m) => m.from !== me && (!had || m.at > had)))
    sendLiveMessage({ type: 'read', who: me, at: upTo });
}

const saveRead = (who: Person, at: string) =>
  updateContent((c) => ({ ...c, chat: { ...c.chat, read: { ...c.chat.read, [who]: at } } }));

export function unreadFor(me: Person, messages: ChatMessage[], read: string | undefined): number {
  return messages.filter((m) => m.from !== me && (!read || m.at > read)).length;
}

let lastTyping = 0;
export function typing() {
  if (Date.now() - lastTyping < 2500) return;
  lastTyping = Date.now();
  sendLiveMessage({ type: 'typing', who: getMe() });
}

/* -------------------------------------------------------- where we are */

let myPlace = 'elsewhere';
let saveTimer: number | undefined;

const inArcade = (place: string) => place === 'hall' || place.startsWith('game:');

/**
 * Our place right now: told live at once. Saved only around the arcade (going
 * in, playing, leaving), so walking through the app doesn't sync each page.
 */
export function setPlace(place: string) {
  if (place === myPlace) return;
  const was = myPlace;
  myPlace = place;
  sendHere();
  if (!inArcade(place) && !inArcade(was)) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const me = getMe();
    const where: Whereabouts = { place, at: nowIso() };
    updateContent((c) => ({
      ...c,
      chat: { ...c.chat, places: { ...c.chat.places, [me]: where } },
    }));
  }, 8000);
}

/** "I'm here". A hello (just opened, or back) asks the other one to answer at once. */
export function sendHere(hello = false) {
  if (document.visibilityState !== 'visible') return;
  sendLiveMessage({
    type: 'here',
    who: getMe(),
    place: myPlace,
    ...(hello ? { hello: true } : {}),
  });
}

let installed = false;

/** Listening for the other one, and telling them we're here. */
export function installChat(onMessage: (m: ChatMessage) => void) {
  if (installed) return () => {};
  installed = true;
  const offs = [
    onLiveMessage('chat', (msg) => {
      const parsed = normalizeContent({
        version: 1,
        profile: {},
        chat: { messages: [msg.message] },
      }).chat.messages[0];
      if (!parsed || parsed.from === getMe()) return;
      addMessage(parsed);
      changed({ seen: Date.now(), typingUntil: 0 });
      // on screen: tell them it arrived (else their phone sends a notification)
      if (document.visibilityState === 'visible') sendLiveMessage({ type: 'got', id: parsed.id });
      onMessage(parsed);
    }),
    onLiveMessage('got', (msg) => {
      const id = typeof msg.id === 'string' ? msg.id : '';
      const t = awaiting.get(id);
      if (t !== undefined) window.clearTimeout(t);
      awaiting.delete(id);
      changed({ seen: Date.now() });
    }),
    onLiveMessage('typing', (msg) => {
      if (msg.who !== other(getMe())) return;
      changed({ seen: Date.now(), typingUntil: Date.now() + 4000 });
    }),
    onLiveMessage('here', (msg) => {
      if (msg.who !== other(getMe())) return;
      const fresh = live.seen === 0 || Date.now() - live.seen > ONLINE_FOR;
      changed({
        seen: Date.now(),
        place: typeof msg.place === 'string' ? msg.place.slice(0, 40) : null,
      });
      // They just came in: say we're here too, so both know at once.
      if (fresh || msg.hello === true) sendHere();
    }),
    onLiveMessage('read', (msg) => {
      const them = other(getMe());
      if (msg.who !== them || typeof msg.at !== 'string' || Number.isNaN(Date.parse(msg.at)))
        return;
      const had = getContent().chat.read[them];
      if (!had || msg.at > had) saveRead(them, msg.at);
    }),
    onLiveMessage('bye', (msg) => {
      if (msg.who !== other(getMe())) return;
      changed({ seen: 0, place: null, typingUntil: 0 });
    }),
  ];
  const beat = window.setInterval(() => sendHere(), 15_000);
  const onVisible = () => {
    if (document.visibilityState === 'visible') sendHere(true);
    else sendLiveMessage({ type: 'bye', who: getMe() });
  };
  document.addEventListener('visibilitychange', onVisible);
  window.setTimeout(() => sendHere(true), 1500);
  return () => {
    installed = false;
    offs.forEach((off) => off());
    window.clearInterval(beat);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
