import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import type { ChatMessage } from '../../data/types';
import { carryForward, mergeChat, mergeContent } from '../../sync/merge';
import { unreadFor } from './chatData';
import { placeLabel, placeOf } from './ArcadeChat';

const msg = (id: string, from: 'you' | 'partner', at: string, text = id): ChatMessage => ({
  id,
  from,
  text,
  at: `2026-10-29T${at}:00.000Z`,
});
const chat = (messages: ChatMessage[], extra = {}) => ({
  messages,
  read: {},
  places: {},
  ...extra,
});

describe('mergeChat', () => {
  it('keeps messages from both phones, in time order', () => {
    const base = chat([msg('a', 'you', '10:00')]);
    const local = chat([...base.messages, msg('c', 'you', '10:05')]);
    const remote = chat([...base.messages, msg('b', 'partner', '10:02')]);
    expect(mergeChat(local, remote, base).messages.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('joins without a base (first sync) and drops doubles', () => {
    const local = chat([msg('a', 'you', '10:00'), msg('b', 'partner', '10:01')]);
    const remote = chat([msg('b', 'partner', '10:01'), msg('c', 'partner', '10:03')]);
    expect(mergeChat(local, remote).messages.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the latest "read up to" and the latest place per person', () => {
    const base = chat([]);
    const local = chat([], {
      read: { you: '2026-10-29T10:05:00.000Z' },
      places: { you: { place: 'hall', at: '2026-10-29T10:05:00.000Z' } },
    });
    const remote = chat([], {
      read: { you: '2026-10-29T10:01:00.000Z', partner: '2026-10-29T10:04:00.000Z' },
      places: {
        you: { place: 'game:uno', at: '2026-10-29T10:01:00.000Z' },
        partner: { place: 'game:kwartet', at: '2026-10-29T10:04:00.000Z' },
      },
    });
    const out = mergeChat(local, remote, base);
    expect(out.read).toEqual({
      you: '2026-10-29T10:05:00.000Z',
      partner: '2026-10-29T10:04:00.000Z',
    });
    expect(out.places.you?.place).toBe('hall');
    expect(out.places.partner?.place).toBe('game:kwartet');
  });

  it('is part of the whole merge', () => {
    const base = createDefaultContent();
    const local = { ...base, chat: chat([msg('a', 'you', '10:00')]) };
    const remote = { ...base, chat: chat([msg('b', 'partner', '10:01')]) };
    expect(mergeContent(base, local, remote).chat.messages).toHaveLength(2);
  });

  it('an older app that never knew the chat keeps ours', () => {
    const ours = { ...createDefaultContent(), chat: chat([msg('a', 'you', '10:00')]) };
    const shared = createDefaultContent();
    expect(carryForward(shared, ours, 10).chat.messages).toHaveLength(1);
  });
});

describe('normalize chat', () => {
  it('drops broken messages, trims text and keeps a valid invite', () => {
    const c = normalizeContent({
      version: 1,
      profile: {},
      chat: {
        messages: [
          { id: 'x', from: 'you', text: '  hoi  ', at: '2026-10-29T10:00:00.000Z', invite: 'uno' },
          { id: 'y', from: 'nobody', text: 'hoi', at: '2026-10-29T10:00:00.000Z' },
          { id: 'z', from: 'partner', text: '   ', at: '2026-10-29T10:00:00.000Z' },
          {
            id: 'w',
            from: 'partner',
            text: 'x'.repeat(2000),
            at: '2026-10-29T10:01:00.000Z',
            invite: 'nope',
          },
        ],
        read: { you: 'not a date', partner: '2026-10-29T10:00:00.000Z' },
        places: { you: { place: 'hall', at: '2026-10-29T10:00:00.000Z' }, partner: 'junk' },
      },
    }).chat;
    expect(c.messages.map((m) => m.id)).toEqual(['x', 'w']);
    expect(c.messages[0]).toMatchObject({ text: 'hoi', invite: 'uno' });
    expect(c.messages[1].text).toHaveLength(1000);
    expect(c.messages[1].invite).toBeUndefined();
    expect(c.places.partner).toBeUndefined();
    expect(c.places.you?.place).toBe('hall');
  });

  it('starts empty for older backups', () => {
    expect(normalizeContent({ version: 1, profile: {} }).chat).toEqual({
      messages: [],
      read: {},
      places: {},
    });
  });
});

describe('unread and places', () => {
  it('counts only their messages after what I read', () => {
    const list = [
      msg('a', 'partner', '10:00'),
      msg('b', 'you', '10:01'),
      msg('c', 'partner', '10:02'),
    ];
    expect(unreadFor('you', list, undefined)).toBe(2);
    expect(unreadFor('you', list, '2026-10-29T10:00:00.000Z')).toBe(1);
    expect(unreadFor('partner', list, undefined)).toBe(1);
  });

  it('names where someone is', () => {
    expect(placeOf('/games', null)).toBe('hall');
    expect(placeOf('/games', 'kwartet')).toBe('game:kwartet');
    expect(placeOf('/quiz', null)).toBe('game:quiz');
    expect(placeLabel('game:kwartet')).toBe('speelt Go Fish 🐟');
    expect(placeLabel('hall')).toContain('Arcade Hall');
    expect(placeLabel('game:onbekend')).toContain('arcade');
  });
});
