import { useEffect, useState } from 'react';
import {
  Baby,
  BookOpen,
  Check,
  Film,
  Gift,
  Heart,
  House,
  Music,
  Pencil,
  Plane,
  Plus,
  Star,
  Trash2,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { useContent } from '../../data/store';
import { updateLists } from '../../data/actions';
import { getAuthor, nameOf, useMe } from '../../data/people';
import type { ListIcon, ListItem, OurList, Person } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { useRoute, replaceParams } from '../../lib/router';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState, PageHeader, TextField } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { ByTag } from '../../components/common/ByTag';
import { SiteFooter } from '../../components/common/SiteFooter';
import './lists.css';

export const LIST_ICONS: Record<ListIcon, { icon: LucideIcon; label: string }> = {
  baby: { icon: Baby, label: 'Baby' },
  heart: { icon: Heart, label: 'Heart' },
  star: { icon: Star, label: 'Star' },
  film: { icon: Film, label: 'Films' },
  plane: { icon: Plane, label: 'Travel' },
  utensils: { icon: UtensilsCrossed, label: 'Food' },
  gift: { icon: Gift, label: 'Gifts' },
  music: { icon: Music, label: 'Music' },
  book: { icon: BookOpen, label: 'Books' },
  home: { icon: House, label: 'Home' },
};

export function ListsPage() {
  const lists = useContent((c) => c.lists);
  const route = useRoute();
  const [form, setForm] = useState<{ open: boolean; list: OurList | null }>({
    open: false,
    list: null,
  });
  const selectedId = route.params.get('list');
  const selected = lists.find((l) => l.id === selectedId) ?? lists[0];

  return (
    <div className="page lists-page">
      <PageHeader
        eyebrow="little lists of us"
        title={
          <>
            Our <em>Lists</em>
          </>
        }
        lede="Baby names we love, films to watch, places to eat — make a list, add to it together and heart the ones you love. When we both heart something, it gets a little crown."
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setForm({ open: true, list: null })}
          >
            <Plus aria-hidden="true" /> New list
          </button>
        }
      />

      {lists.length === 0 ? (
        <EmptyState
          title="No lists yet"
          text="Start one: names we love, restaurants to try, films for movie night."
          action={
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setForm({ open: true, list: null })}
            >
              <Plus aria-hidden="true" /> Make our first list
            </button>
          }
        />
      ) : (
        <>
          <div className="chip-row lists-tabs" role="group" aria-label="Our lists">
            {lists.map((l) => {
              const Icon = LIST_ICONS[l.icon].icon;
              return (
                <button
                  key={l.id}
                  type="button"
                  className="chip"
                  aria-pressed={selected?.id === l.id}
                  onClick={() => replaceParams({ list: l.id })}
                >
                  <Icon aria-hidden="true" /> {l.title}
                  <span className="chip__count">{l.items.length}</span>
                </button>
              );
            })}
          </div>
          {selected && (
            <ListView
              key={selected.id}
              list={selected}
              onEdit={() => setForm({ open: true, list: selected })}
            />
          )}
        </>
      )}

      <ListForm
        open={form.open}
        list={form.list}
        onClose={() => setForm({ open: false, list: null })}
      />
      <SiteFooter />
    </div>
  );
}

const patchList = (id: string, recipe: (l: OurList) => OurList) =>
  updateLists((lists) => lists.map((l) => (l.id === id ? recipe(l) : l)));

function ListView({ list, onEdit }: { list: OurList; onEdit: () => void }) {
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const [text, setText] = useState('');
  const [bothOnly, setBothOnly] = useState(false);
  const Icon = LIST_ICONS[list.icon].icon;

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (list.items.some((i) => i.text.toLowerCase() === value.toLowerCase())) {
      toast('That one’s already on the list');
      return;
    }
    const item: ListItem = {
      id: createId('item'),
      text: value,
      hearts: [],
      done: false,
      by: getAuthor(),
      createdAt: nowIso(),
    };
    patchList(list.id, (l) => ({ ...l, items: [...l.items, item] }));
    setText('');
  };

  const patchItem = (id: string, recipe: (i: ListItem) => ListItem) =>
    patchList(list.id, (l) => ({ ...l, items: l.items.map((i) => (i.id === id ? recipe(i) : i)) }));

  const heart = (item: ListItem) =>
    patchItem(item.id, (i) => ({
      ...i,
      hearts: i.hearts.includes(me) ? i.hearts.filter((p) => p !== me) : [...i.hearts, me],
    }));

  const removeItem = (item: ListItem) => {
    const index = list.items.findIndex((i) => i.id === item.id);
    patchList(list.id, (l) => ({ ...l, items: l.items.filter((i) => i.id !== item.id) }));
    toast('Removed', {
      action: {
        label: 'Undo',
        run: () =>
          patchList(list.id, (l) => {
            const items = [...l.items];
            items.splice(index, 0, item);
            return { ...l, items };
          }),
      },
    });
  };

  const both = (i: ListItem) => i.hearts.includes('you') && i.hearts.includes('partner');
  const sorted = [...list.items].sort(
    (a, b) => Number(a.done) - Number(b.done) || Number(both(b)) - Number(both(a)),
  );
  const shown = bothOnly ? sorted.filter(both) : sorted;
  const loved = list.items.filter(both).length;

  return (
    <section className="our-list" aria-labelledby="our-list-title">
      <div className="our-list__head">
        <span className="our-list__icon" aria-hidden="true">
          <Icon />
        </span>
        <h2 id="our-list-title" className="our-list__title">
          {list.title}
        </h2>
        <ByTag by={list.by} />
        <button
          type="button"
          className="icon-btn"
          aria-label={`Edit “${list.title}”`}
          onClick={onEdit}
        >
          <Pencil />
        </button>
      </div>

      <form className="our-list__add" onSubmit={add}>
        <TextField label="Add to this list" value={text} onChange={setText} maxLength={120} />
        <button type="submit" className="btn btn--primary btn--small" disabled={!text.trim()}>
          <Plus aria-hidden="true" /> Add
        </button>
      </form>

      {list.items.length > 0 && (
        <div className="our-list__filter">
          <button
            type="button"
            className="chip"
            aria-pressed={bothOnly}
            onClick={() => setBothOnly((b) => !b)}
          >
            <Heart aria-hidden="true" /> We both love
            <span className="chip__count">{loved}</span>
          </button>
          <span className="muted our-list__hint">You’re hearting as {nameOf(me, profile)}</span>
        </div>
      )}

      {list.items.length === 0 ? (
        <p className="muted">Nothing on this list yet — add the first one above.</p>
      ) : shown.length === 0 ? (
        <p className="muted">Nothing we both hearted yet.</p>
      ) : (
        <ul className="our-list__items">
          {shown.map((item) => (
            <li
              key={item.id}
              className={`list-item${item.done ? ' is-done' : ''}${both(item) ? ' is-both' : ''}`}
            >
              <button
                type="button"
                className="list-item__check"
                aria-pressed={item.done}
                aria-label={
                  item.done ? `Mark “${item.text}” as not done` : `Mark “${item.text}” as done`
                }
                onClick={() => patchItem(item.id, (i) => ({ ...i, done: !i.done }))}
              >
                {item.done && <Check aria-hidden="true" />}
              </button>
              <span className="list-item__text">
                {both(item) && (
                  <span className="list-item__crown" aria-hidden="true">
                    ♛
                  </span>
                )}
                {item.text}
                <ByTag by={item.by} />
              </span>
              <span className="list-item__hearts" aria-label={heartsLabel(item.hearts, profile)}>
                {(['partner', 'you'] as Person[]).map((p) => (
                  <span
                    key={p}
                    className={`list-item__dot list-item__dot--${p}${item.hearts.includes(p) ? ' is-on' : ''}`}
                  />
                ))}
              </span>
              <button
                type="button"
                className="icon-btn fav-btn"
                aria-pressed={item.hearts.includes(me)}
                aria-label={
                  item.hearts.includes(me) ? `Unheart “${item.text}”` : `Heart “${item.text}”`
                }
                onClick={() => heart(item)}
              >
                <Heart />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove “${item.text}”`}
                onClick={() => removeItem(item)}
              >
                <Trash2 />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function heartsLabel(hearts: Person[], profile: { yourName: string; partnerName: string }) {
  if (hearts.length === 2) return 'We both love this';
  if (hearts.length === 1) return `${nameOf(hearts[0], profile)} loves this`;
  return 'No hearts yet';
}

function ListForm({
  open,
  list,
  onClose,
}: {
  open: boolean;
  list: OurList | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<ListIcon>('heart');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(list?.title ?? '');
      setIcon(list?.icon ?? 'heart');
      setError(null);
    }
  }, [open, list]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('Give the list a name.');
      return;
    }
    if (list) {
      patchList(list.id, (l) => ({ ...l, title: title.trim(), icon }));
    } else {
      const created: OurList = {
        id: createId('list'),
        title: title.trim(),
        icon,
        items: [],
        by: getAuthor(),
        createdAt: nowIso(),
      };
      updateLists((lists) => [...lists, created]);
      replaceParams({ list: created.id });
    }
    onClose();
  };

  const remove = async () => {
    if (!list) return;
    const ok = await confirm({
      title: `Delete “${list.title}”?`,
      message: list.items.length
        ? `The ${list.items.length} things on it go too.`
        : 'It’s empty anyway.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    updateLists((lists) => lists.filter((l) => l.id !== list.id));
    replaceParams({ list: null });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={list ? 'Edit list' : 'A new list'}
      eyebrow="our lists"
      size="sm"
      footer={
        <>
          {list && (
            <button type="button" className="btn btn--quiet" onClick={remove}>
              <Trash2 aria-hidden="true" /> Delete
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="list-form" className="btn btn--primary">
            Save
          </button>
        </>
      }
    >
      <form id="list-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Name"
          value={title}
          onChange={setTitle}
          maxLength={60}
          placeholder="Restaurants to try"
          error={error}
        />
        <fieldset className="field list-icons">
          <legend className="field__label">Icon</legend>
          <div className="list-icons__grid">
            {(Object.keys(LIST_ICONS) as ListIcon[]).map((key) => {
              const { icon: I, label } = LIST_ICONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  className="list-icons__btn"
                  aria-pressed={icon === key}
                  aria-label={label}
                  onClick={() => setIcon(key)}
                >
                  <I aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
