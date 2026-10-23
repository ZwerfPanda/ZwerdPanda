import { useEffect, useMemo, useRef, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { useContent } from '../../data/store';
import type { AppContent, Person } from '../../data/types';
import { useMe } from '../../data/people';
import { sealedFor } from '../letters/opened';
import { href, navigate, type RoutePath } from '../../lib/router';
import { Dialog } from '../../components/ui/Dialog';
import './search.css';

interface Hit {
  key: string;
  kind: string;
  icon: string;
  title: string;
  snippet: string;
  to: RoutePath;
  query?: Record<string, string>;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** A short piece of text around the first match. */
function around(text: string, q: string): string {
  const i = fold(text).indexOf(q);
  if (i < 0) return text.length > 90 ? `${text.slice(0, 90)}…` : text;
  const start = Math.max(0, i - 36);
  return `${start ? '…' : ''}${text.slice(start, i + q.length + 54)}${i + q.length + 54 < text.length ? '…' : ''}`;
}

/** Everything in our universe that can be found, as plain text. */
type Findable = Omit<Hit, 'snippet' | 'key'> & { text: string };

function everything(c: AppContent, me: Person): Findable[] {
  const items: Findable[] = [];
  const add = (
    kind: string,
    icon: string,
    title: string,
    text: string[],
    to: RoutePath,
    query?: Record<string, string>,
  ) =>
    items.push({
      kind,
      icon,
      title,
      text: [title, ...text].filter(Boolean).join(' · '),
      to,
      query,
    });

  // A sealed letter can be found by its "open when", never by what's inside.
  c.letters
    .filter((l) => l.status === 'shared')
    .forEach((l) =>
      add(
        'Brief',
        '💌',
        `Open when ${l.occasion}`,
        sealedFor(l, me, c.profile) ? [] : [l.body, l.signature],
        '/letters',
      ),
    );
  c.memories.forEach((m) =>
    add(
      'Herinnering',
      '📸',
      m.caption,
      [m.note ?? '', m.location ?? '', m.date ?? ''],
      '/memories',
    ),
  );
  c.milestones.forEach((m) =>
    add('Hoofdstuk', '📖', m.title, [m.story, m.dateLabel ?? ''], '/story'),
  );
  if (c.museum.foundAt) {
    c.museum.stops.forEach((s) =>
      add(
        'Halte',
        '🚆',
        s.name,
        [s.place ?? '', s.when ?? '', s.story, s.favorite ?? '', ...s.details],
        '/museum',
        { stop: s.id },
      ),
    );
  }
  c.dreams.forEach((d) => add('Droom', '🔭', d.title, [d.description ?? ''], '/future'));
  c.songs.forEach((s) =>
    add('Liedje', '🎵', s.title, [s.artist, s.why ?? '', s.memory ?? ''], '/music'),
  );
  c.lists.forEach((l) =>
    l.items.forEach((i) => add(l.title, '📝', i.text, [i.note ?? ''], '/lists')),
  );
  c.coco.notes.forEach((n) => add('Coco', '🐰', n.text, [], '/coco'));
  c.her.notes.forEach((n) => add('Love note', '💗', n.text || 'Ingesproken briefje', [], '/her'));
  c.her.bucket.forEach((b) => add('Bucket list', '✨', b.title, [b.note ?? ''], '/her'));
  c.her.goals.forEach((g) => add('Goal', '🎯', g.title, [g.why ?? ''], '/her'));
  c.surprises.reasons.forEach((r, i) => add('Reden', '💛', r, [], '/surprises', { r: String(i) }));
  return items;
}

/** Search through letters, memories, stops, songs, lists… all at once. */
export function SearchButton() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const content = useContent((c) => c);
  const me = useMe();
  const input = useRef<HTMLInputElement>(null);
  const all = useMemo(() => (open ? everything(content, me) : []), [open, content, me]);

  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 50);
    else setQ('');
  }, [open]);

  const query = fold(q.trim());
  const hits: Hit[] =
    query.length < 2
      ? []
      : all
          .filter((item) => fold(item.text).includes(query))
          .slice(0, 40)
          .map((item, i) => ({
            ...item,
            key: `${item.kind}-${i}`,
            snippet: around(item.text, query),
          }));

  return (
    <>
      <button type="button" className="icon-btn" aria-label="Zoeken" onClick={() => setOpen(true)}>
        <SearchIcon />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Zoeken in ons universe"
        eyebrow="ergens naar op zoek?"
        size="md"
      >
        <div className="search">
          <label className="search__field">
            <SearchIcon aria-hidden="true" />
            <span className="visually-hidden">Zoek</span>
            <input
              ref={input}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="kus, Walibi, december…"
              enterKeyHint="search"
            />
          </label>
          {query.length >= 2 && (
            <p className="search__count" aria-live="polite">
              {hits.length === 0
                ? 'Niets gevonden — probeer een ander woord.'
                : `${hits.length}${hits.length === 40 ? '+' : ''} gevonden`}
            </p>
          )}
          <ul className="search__hits">
            {hits.map((h) => (
              <li key={h.key}>
                <a
                  className="search__hit"
                  href={href(h.to, h.query)}
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    navigate(h.to, h.query);
                  }}
                >
                  <span className="search__icon" aria-hidden="true">
                    {h.icon}
                  </span>
                  <span>
                    <small>{h.kind}</small>
                    <strong>{h.title}</strong>
                    <span className="search__snippet">{h.snippet}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Dialog>
    </>
  );
}
