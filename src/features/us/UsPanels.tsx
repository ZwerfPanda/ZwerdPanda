import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useContent } from '../../data/store';
import { updateMini, updateUs } from '../../data/actions';
import { nameOf } from '../../data/people';
import type { Person, PetName } from '../../data/types';
import { createId } from '../../lib/id';
import { formatDate, isValidIsoDate, timeAgo } from '../../lib/dates';
import { useToday } from '../../hooks/useToday';
import { Segmented, SelectField, TextField } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { Figure, heightUnits } from './Figure';
import { HER_ACCESSORIES, HER_OUTFITS, HIS_ACCESSORIES, HIS_OUTFITS } from './wardrobe';
import { ageOn } from './lines';

/* ------------------------------------------------------------- chat log */

export function ChatLog() {
  const chat = useContent((c) => c.us.chat);
  const profile = useContent((c) => c.profile);
  const [all, setAll] = useState(false);
  const shown = all ? chat : chat.slice(0, 6);

  const clear = async () => {
    const ok = await confirm({
      title: 'Clear what they said?',
      message: 'This clears the chat log for both of us.',
      confirmLabel: 'Clear',
      tone: 'danger',
    });
    if (ok) updateUs((us) => ({ ...us, chat: [] }));
  };

  return (
    <section className="us-chat" aria-labelledby="us-chat-title">
      <div className="us-section-head">
        <h2 id="us-chat-title" className="section-title" style={{ margin: 0 }}>
          What they said
        </h2>
        {chat.length > 0 && (
          <button type="button" className="btn btn--quiet btn--small" onClick={clear}>
            <Trash2 aria-hidden="true" /> Clear
          </button>
        )}
      </div>
      {chat.length === 0 ? (
        <p className="muted">
          Nothing yet. Tap one of us up there and the conversation starts here.
        </p>
      ) : (
        <>
          <ol className="us-chat__list">
            {[...shown].reverse().map((line) => (
              <li key={line.id} className={`us-chat__line us-chat__line--${line.who}`}>
                <span className="us-chat__who">{nameOf(line.who, profile)}</span>
                <span className="us-chat__text">{line.text}</span>
                <time className="us-chat__time" dateTime={line.at}>
                  {timeAgo(line.at)}
                </time>
              </li>
            ))}
          </ol>
          {chat.length > 6 && (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setAll((a) => !a)}
            >
              {all ? 'Show less' : `Read back all ${chat.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- wardrobe */

export function Wardrobe() {
  const us = useContent((c) => c.us);
  const profile = useContent((c) => c.profile);
  const [who, setWho] = useState<Person>('partner');
  const mini = us[who];
  const outfits = who === 'you' ? HIS_OUTFITS : HER_OUTFITS;
  const accessories = who === 'you' ? HIS_ACCESSORIES : HER_ACCESSORIES;
  const tall = heightUnits(mini.heightCm);

  const toggle = (id: string) => {
    const has = mini.look.accessories.includes(id);
    updateMini(who, {
      look: {
        ...mini.look,
        accessories: has
          ? mini.look.accessories.filter((a) => a !== id)
          : [...mini.look.accessories, id],
      },
    });
  };

  return (
    <section className="us-wardrobe" aria-labelledby="us-wardrobe-title">
      <h2 id="us-wardrobe-title" className="section-title">
        Wardrobe <span className="hand">from our real outfits</span>
      </h2>
      <Segmented
        legend="Dress up"
        value={who}
        onChange={setWho}
        options={[
          { value: 'partner', label: nameOf('partner', profile) },
          { value: 'you', label: nameOf('you', profile) },
        ]}
      />
      <ul className="us-outfits" aria-label="Outfits">
        {outfits.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              className="us-outfit"
              aria-pressed={mini.look.outfit === o.id}
              onClick={() => updateMini(who, { look: { ...mini.look, outfit: o.id } })}
            >
              <svg viewBox={`-58 ${-tall - 8} 116 ${tall + 16}`} aria-hidden="true">
                <Figure
                  who={who}
                  heightCm={mini.heightCm}
                  look={{ ...mini.look, outfit: o.id, accessories: [] }}
                />
              </svg>
              <span>{o.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {who === 'partner' ? (
        <Segmented
          legend="Hair"
          value={mini.look.hair === 'wavy' ? 'wavy' : 'straight'}
          onChange={(hair) => updateMini(who, { look: { ...mini.look, hair } })}
          options={[
            { value: 'straight', label: 'Straight' },
            { value: 'wavy', label: 'Wavy' },
          ]}
        />
      ) : (
        <Segmented
          legend="Hair"
          value={mini.look.hair === 'curls' ? 'curls' : 'slick-back'}
          onChange={(hair) => updateMini(who, { look: { ...mini.look, hair } })}
          options={[
            { value: 'slick-back', label: 'Slick back' },
            { value: 'curls', label: 'Curly top' },
          ]}
        />
      )}
      <p className="field__label us-wardrobe__label">Accessories</p>
      <div className="us-accessories" role="group" aria-label="Accessories">
        {accessories.map((a) => (
          <button
            key={a.id}
            type="button"
            className="chip"
            aria-pressed={mini.look.accessories.includes(a.id)}
            onClick={() => toggle(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <TeachLine who={who} name={nameOf(who, profile)} lines={mini.lines} />
    </section>
  );
}

function TeachLine({ who, name, lines }: { who: Person; name: string; lines: string[] }) {
  const [text, setText] = useState('');

  const teach = (event: React.FormEvent) => {
    event.preventDefault();
    const line = text.trim();
    if (!line) return;
    updateMini(who, { lines: [...lines.filter((l) => l !== line), line].slice(-30) });
    setText('');
    toast(`Mini ${name} learned a new line`);
  };

  return (
    <div className="us-teach">
      <form className="us-teach__form" onSubmit={teach}>
        <TextField
          label={`Teach mini ${name} something to say`}
          value={text}
          onChange={setText}
          maxLength={120}
          placeholder="Something we always say"
        />
        <button type="submit" className="btn btn--soft btn--small" disabled={!text.trim()}>
          <Plus aria-hidden="true" /> Teach
        </button>
      </form>
      {lines.length > 0 && (
        <ul className="us-teach__lines">
          {lines.map((l) => (
            <li key={l}>
              “{l}”
              <button
                type="button"
                className="icon-btn"
                aria-label={`Forget “${l}”`}
                onClick={() => updateMini(who, { lines: lines.filter((x) => x !== l) })}
              >
                <X />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- about us */

export function AboutUs() {
  return (
    <section className="us-about" aria-labelledby="us-about-title">
      <h2 id="us-about-title" className="section-title">
        About us
      </h2>
      <div className="us-about__cards">
        <AboutCard who="partner" />
        <AboutCard who="you" />
      </div>
    </section>
  );
}

function AboutCard({ who }: { who: Person }) {
  const mini = useContent((c) => c.us[who]);
  const profile = useContent((c) => c.profile);
  const today = useToday();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [height, setHeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const name = nameOf(who, profile);
  const age = ageOn(mini.birthday, today);

  useEffect(() => {
    if (editing) {
      setFullName(mini.fullName);
      setBirthday(mini.birthday);
      setHeight(String(mini.heightCm));
      setError(null);
    }
  }, [editing, mini]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const cm = Math.round(Number(height));
    if (birthday && !isValidIsoDate(birthday)) {
      setError('That birthday doesn’t look right.');
      return;
    }
    if (!Number.isFinite(cm) || cm < 120 || cm > 230) {
      setError('Height in centimetres, between 120 and 230.');
      return;
    }
    updateMini(who, { fullName: fullName.trim(), birthday, heightCm: cm });
    setEditing(false);
  };

  return (
    <article className={`us-card us-card--${who}`}>
      <div className="us-card__head">
        <h3 className="us-card__name">{name}</h3>
        {!editing && (
          <button
            type="button"
            className="icon-btn"
            aria-label={`Edit ${name}’s details`}
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </button>
        )}
      </div>
      {editing ? (
        <form className="form" onSubmit={save} noValidate>
          <TextField
            label="Full name"
            optional
            value={fullName}
            onChange={setFullName}
            maxLength={80}
          />
          <TextField
            label="Birthday"
            optional
            type="date"
            value={birthday}
            onChange={setBirthday}
          />
          <TextField
            label="Height (cm)"
            type="number"
            inputMode="numeric"
            min={120}
            max={230}
            value={height}
            onChange={setHeight}
            error={error}
          />
          <div className="settings-actions">
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn--primary btn--small">
              Save
            </button>
          </div>
        </form>
      ) : (
        <dl className="us-card__facts">
          <div>
            <dt>Full name</dt>
            <dd className={mini.fullName ? '' : 'is-empty'}>
              {mini.fullName || 'tap ✎ to fill in'}
            </dd>
          </div>
          <div>
            <dt>Birthday</dt>
            <dd className={mini.birthday ? '' : 'is-empty'}>
              {mini.birthday ? formatDate(mini.birthday) : 'tap ✎ to fill in'}
            </dd>
          </div>
          {age !== null && (
            <div>
              <dt>Age</dt>
              <dd>{age}</dd>
            </div>
          )}
          <div>
            <dt>Height</dt>
            <dd>{mini.heightCm} cm</dd>
          </div>
        </dl>
      )}
    </article>
  );
}

/* ------------------------------------------------------------- pet names */

export function PetNames() {
  const names = useContent((c) => c.us.petNames);
  const profile = useContent((c) => c.profile);
  const [text, setText] = useState('');
  const [from, setFrom] = useState<PetName['from']>('both');
  const label = (f: PetName['from']) =>
    f === 'both'
      ? 'We both say it'
      : `${nameOf(f, profile)} → ${nameOf(f === 'you' ? 'partner' : 'you', profile)}`;

  const set = (next: PetName[]) => updateUs((us) => ({ ...us, petNames: next }));
  const move = (i: number, delta: -1 | 1) => {
    const next = [...names];
    const [item] = next.splice(i, 1);
    next.splice(i + delta, 0, item);
    set(next);
  };

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const name = text.trim();
    if (!name) return;
    set([...names, { id: createId('pet'), name, from }]);
    setText('');
  };

  return (
    <section className="us-pets" aria-labelledby="us-pets-title">
      <h2 id="us-pets-title" className="section-title">
        What we call each other <span className="hand">most used first</span>
      </h2>
      <ol className="us-pets__list">
        {names.map((p, i) => (
          <li key={p.id} className="us-pet">
            <span className="us-pet__name">{p.name}</span>
            <span className="us-pet__from">{label(p.from)}</span>
            <span className="us-pet__tools">
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move ${p.name} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move ${p.name} down`}
                disabled={i === names.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${p.name}`}
                onClick={() => set(names.filter((n) => n.id !== p.id))}
              >
                <Trash2 />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <form className="us-pets__add" onSubmit={add}>
        <TextField label="Another name" value={text} onChange={setText} maxLength={40} />
        <SelectField
          label="Who says it"
          value={from}
          onChange={setFrom}
          options={(['both', 'you', 'partner'] as const).map((f) => ({
            value: f,
            label: label(f),
          }))}
        />
        <button type="submit" className="btn btn--soft btn--small" disabled={!text.trim()}>
          <Plus aria-hidden="true" /> Add
        </button>
      </form>
    </section>
  );
}
