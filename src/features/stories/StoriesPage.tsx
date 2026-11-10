import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useContent } from '../../data/store';
import { nameOf, useMe } from '../../data/people';
import type { Person, Story, StoryHighlight } from '../../data/types';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState, PageHeader, TextField } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { SiteFooter } from '../../components/common/SiteFooter';
import { formatDate } from '../../lib/dates';
import { navigate, useRoute } from '../../lib/router';
import { StoryAvatar } from './StoryAvatar';
import { StoryCanvas } from './StoryCanvas';
import { StoryComposer } from './StoryComposer';
import { StoryViewer } from './StoryViewer';
import {
  deleteHighlight,
  freshStories,
  hasSeen,
  isFresh,
  saveHighlight,
  startAt,
  storiesByDay,
  storyWords,
  timeAgo,
} from './stories';
import './stories.css';

type Watching = { queue: Story[]; start: number; title?: string } | null;

/** How many days of the archive show before "meer". */
const DAYS_SHOWN = 14;

export function StoriesPage() {
  const me = useMe();
  const other: Person = me === 'you' ? 'partner' : 'you';
  const route = useRoute();
  const content = useContent((c) => c);
  const { items, highlights } = content.stories;
  const profile = content.profile;
  const [making, setMaking] = useState(false);
  const [watching, setWatching] = useState<Watching>(null);
  const [filter, setFilter] = useState<'all' | Person>('all');
  const [days, setDays] = useState(DAYS_SHOWN);
  const [editing, setEditing] = useState<StoryHighlight | 'new' | null>(null);
  const now = Date.now();

  const mineFresh = freshStories(items, me, now);
  const theirsFresh = freshStories(items, other, now);
  const theirsNew = theirsFresh.filter((s) => !hasSeen(content, s, me)).length;

  // From a notification or the chat: straight to that story.
  const asked = route.params.get('s');
  useEffect(() => {
    if (!asked) return;
    const story = items.find((s) => s.id === asked);
    if (!story) return;
    const queue = isFresh(story, now)
      ? freshStories(items, story.by, now)
      : (storiesByDay(items.filter((s) => s.by === story.by)).find((d) =>
          d.stories.some((s) => s.id === asked),
        )?.stories ?? [story]);
    setWatching({
      queue,
      start: Math.max(
        0,
        queue.findIndex((s) => s.id === asked),
      ),
    });
    navigate('/stories');
  }, [asked, items.length]);

  const watch = (who: Person) => {
    const list = who === me ? mineFresh : theirsFresh;
    if (!list.length) return;
    setWatching({ queue: list, start: startAt(content, list, me) });
  };

  const archive = useMemo(
    () => storiesByDay(filter === 'all' ? items : items.filter((s) => s.by === filter)),
    [items, filter],
  );

  return (
    <div className="page stories-page">
      <PageHeader
        eyebrow="our stories"
        title={
          <>
            Onze <em>Stories</em>
          </>
        }
        lede="Zoals op Instagram, TikTok en WhatsApp — maar dan alleen voor ons twee. Een story staat 24 uur bovenaan en blijft daarna voor altijd in ons archief."
      />

      <section className="story-rings" aria-label="Stories van vandaag">
        <div className="story-ring-wrap">
          <button
            type="button"
            className={`story-ring${mineFresh.length ? ' is-seen-own' : ' is-empty'}`}
            onClick={() => (mineFresh.length ? watch(me) : setMaking(true))}
            aria-label={
              mineFresh.length
                ? `Jouw story bekijken (${mineFresh.length})`
                : 'Jouw story: maak er een'
            }
          >
            <StoryAvatar who={me} size={74} />
          </button>
          <button
            type="button"
            className="story-ring__add"
            onClick={() => setMaking(true)}
            aria-label="Nieuwe story"
          >
            <Plus aria-hidden="true" />
          </button>
          <span className="story-ring__name">Jouw story</span>
        </div>
        <div className="story-ring-wrap">
          <button
            type="button"
            className={`story-ring${theirsNew ? ' is-new' : theirsFresh.length ? ' is-seen' : ' is-empty'}`}
            onClick={() => watch(other)}
            disabled={!theirsFresh.length}
            aria-label={
              theirsFresh.length
                ? `Story van ${nameOf(other, profile)} bekijken${theirsNew ? ` (${theirsNew} nieuw)` : ''}`
                : `${nameOf(other, profile)} heeft vandaag nog geen story`
            }
          >
            <StoryAvatar who={other} size={74} />
          </button>
          <span className="story-ring__name">{nameOf(other, profile)}</span>
          <span className="story-ring__when">
            {theirsFresh.length
              ? theirsNew
                ? `${theirsNew} nieuw`
                : timeAgo(theirsFresh[theirsFresh.length - 1].createdAt, now)
              : 'nog niks'}
          </span>
        </div>
        <button
          type="button"
          className="btn btn--primary story-rings__new"
          onClick={() => setMaking(true)}
        >
          <Plus aria-hidden="true" /> Nieuwe story
        </button>
      </section>

      <section className="story-section" aria-labelledby="story-hl">
        <h2 id="story-hl" className="story-section__h">
          Highlights
        </h2>
        <div className="story-highlights">
          <button
            type="button"
            className="story-highlight story-highlight--new"
            onClick={() => setEditing('new')}
            disabled={!items.length}
          >
            <span className="story-highlight__cover">
              <Plus aria-hidden="true" />
            </span>
            <span className="story-highlight__name">Nieuw</span>
          </button>
          {highlights.map((h) => {
            const list = h.stories
              .map((id) => items.find((s) => s.id === id))
              .filter((s): s is Story => Boolean(s));
            return (
              <div key={h.id} className="story-highlight">
                <button
                  type="button"
                  className="story-highlight__cover"
                  onClick={() =>
                    list.length && setWatching({ queue: list, start: 0, title: h.title })
                  }
                  aria-label={`Highlight ${h.title} (${list.length})`}
                >
                  {list[0] ? (
                    <span className="story-highlight__thumb">
                      <StoryCanvas story={list[0]} mode="still" />
                    </span>
                  ) : null}
                  <span className="story-highlight__emoji" aria-hidden="true">
                    {h.emoji}
                  </span>
                </button>
                <span className="story-highlight__name">{h.title}</span>
                <button
                  type="button"
                  className="story-highlight__edit"
                  onClick={() => setEditing(h)}
                  aria-label={`Highlight ${h.title} aanpassen`}
                >
                  <Pencil aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
        {!highlights.length && (
          <p className="story-section__hint">
            Bewaar jullie mooiste stories samen, zoals “Op reis ✈️” of “Coco 🐰”.
          </p>
        )}
      </section>

      <section className="story-section" aria-labelledby="story-archive">
        <div className="story-section__row">
          <h2 id="story-archive" className="story-section__h">
            Ons archief
          </h2>
          <div className="story-filter" role="radiogroup" aria-label="Wiens stories">
            {(['all', 'you', 'partner'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                className={filter === f ? 'is-on' : ''}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Alles' : nameOf(f, profile)}
              </button>
            ))}
          </div>
        </div>
        {archive.length === 0 ? (
          <EmptyState
            art={<span className="story-empty-art">📸</span>}
            title="Nog geen stories"
            text="Deel je eerste: een foto van je ontbijt, een filmpje van Coco, of gewoon ‘ik mis je’."
            action={
              <button type="button" className="btn btn--primary" onClick={() => setMaking(true)}>
                <Plus aria-hidden="true" /> Eerste story maken
              </button>
            }
          />
        ) : (
          <>
            {archive.slice(0, days).map((d) => (
              <div key={d.day} className="story-day">
                <h3 className="story-day__h">{formatDate(d.day)}</h3>
                <ul className="story-grid">
                  {d.stories.map((s, n) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="story-thumb"
                        onClick={() => setWatching({ queue: d.stories, start: n })}
                        aria-label={`${nameOf(s.by, profile)}, ${new Date(s.createdAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}: ${storyWords(s)}`}
                      >
                        <StoryCanvas story={s} mode="still" />
                        <span className="story-thumb__by" aria-hidden="true">
                          <StoryAvatar who={s.by} size={22} />
                        </span>
                        {s.media?.kind === 'video' && (
                          <span className="story-thumb__clip" aria-hidden="true">
                            ▶
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {archive.length > days && (
              <button
                type="button"
                className="btn btn--ghost story-more"
                onClick={() => setDays((n) => n + DAYS_SHOWN)}
              >
                Oudere stories laten zien
              </button>
            )}
          </>
        )}
      </section>

      <SiteFooter />

      {making && <StoryComposer onClose={() => setMaking(false)} />}
      {watching && (
        <StoryViewer
          queue={watching.queue}
          start={watching.start}
          title={watching.title}
          onClose={() => setWatching(null)}
        />
      )}
      <HighlightDialog
        open={editing !== null}
        highlight={editing === 'new' ? null : editing}
        stories={items}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

const HL_EMOJIS = ['💞', '✈️', '🐰', '🍓', '🌙', '🎀', '🍿', '🏖️', '🎂', '⭐', '🍵', '🎶'];

function HighlightDialog({
  open,
  highlight,
  stories,
  onClose,
}: {
  open: boolean;
  highlight: StoryHighlight | null;
  stories: Story[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('💞');
  const [picked, setPicked] = useState<string[]>([]);
  const [problem, setProblem] = useState('');
  useEffect(() => {
    if (!open) return;
    setTitle(highlight?.title ?? '');
    setEmoji(highlight?.emoji ?? '💞');
    setPicked(highlight?.stories ?? []);
    setProblem('');
  }, [open, highlight?.id]);
  const newestFirst = useMemo(() => [...stories].reverse(), [stories]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setProblem('Geef je highlight een naam.');
    // In the order they were posted.
    const order = stories.map((s) => s.id).filter((id) => picked.includes(id));
    saveHighlight({ id: highlight?.id, title: title.trim().slice(0, 40), emoji, stories: order });
    toast(highlight ? 'Highlight bijgewerkt' : `Highlight “${title.trim()}” gemaakt ✨`);
    onClose();
  };

  const remove = async () => {
    if (!highlight) return;
    const ok = await confirm({
      title: 'Highlight weghalen?',
      message: 'De stories zelf blijven gewoon in het archief.',
      confirmLabel: 'Weghalen',
      tone: 'danger',
    });
    if (ok) {
      deleteHighlight(highlight.id);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="highlights"
      title={highlight ? 'Highlight aanpassen' : 'Nieuwe highlight'}
      footer={
        <>
          {highlight && (
            <button
              type="button"
              className="btn btn--ghost story-dialog__delete"
              onClick={() => void remove()}
            >
              Weghalen
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="story-hl-form" className="btn btn--primary">
            Opslaan
          </button>
        </>
      }
    >
      <form id="story-hl-form" className="story-hl-form" onSubmit={save} noValidate>
        <TextField
          label="Naam"
          value={title}
          maxLength={40}
          onChange={setTitle}
          placeholder="Op reis, Coco, Dates…"
          error={problem || undefined}
        />
        <div className="story-hl-form__emojis" role="radiogroup" aria-label="Icoontje">
          {HL_EMOJIS.map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={emoji === x}
              className={emoji === x ? 'is-on' : ''}
              onClick={() => setEmoji(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <p className="story-hl-form__label">Kies de stories ({picked.length})</p>
        <ul className="story-grid story-grid--pick">
          {newestFirst.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`story-thumb${picked.includes(s.id) ? ' is-picked' : ''}`}
                aria-pressed={picked.includes(s.id)}
                aria-label={`${formatDate(s.createdAt.slice(0, 10), 'short')}: ${storyWords(s)}`}
                onClick={() => toggle(s.id)}
              >
                <StoryCanvas story={s} mode="still" />
                <span className="story-thumb__tick" aria-hidden="true">
                  {picked.includes(s.id) ? '✓' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </form>
    </Dialog>
  );
}
