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
      title: 'Alles wat ze zeiden wissen?',
      message: 'Dit wist het gesprek voor ons allebei.',
      confirmLabel: 'Wissen',
      tone: 'danger',
    });
    if (ok) updateUs((us) => ({ ...us, chat: [] }));
  };

  return (
    <section className="us-chat" aria-labelledby="us-chat-title">
      <div className="us-section-head">
        <h2 id="us-chat-title" className="section-title" style={{ margin: 0 }}>
          Wat ze zeiden
        </h2>
        {chat.length > 0 && (
          <button type="button" className="btn btn--quiet btn--small" onClick={clear}>
            <Trash2 aria-hidden="true" /> Wissen
          </button>
        )}
      </div>
      {chat.length === 0 ? (
        <p className="muted">Nog niets. Tik hierboven op een van ons en het gesprek begint hier.</p>
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
              {all ? 'Minder tonen' : `Alle ${chat.length} teruglezen`}
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
        Kledingkast <span className="hand">from our real outfits</span>
      </h2>
      <Segmented
        legend="Aankleden"
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
          legend="Haar"
          value={mini.look.hair === 'wavy' ? 'wavy' : 'straight'}
          onChange={(hair) => updateMini(who, { look: { ...mini.look, hair } })}
          options={[
            { value: 'straight', label: 'Steil' },
            { value: 'wavy', label: 'Golvend' },
          ]}
        />
      ) : (
        <Segmented
          legend="Haar"
          value={mini.look.hair === 'curls' ? 'curls' : 'slick-back'}
          onChange={(hair) => updateMini(who, { look: { ...mini.look, hair } })}
          options={[
            { value: 'slick-back', label: 'Slick back' },
            { value: 'curls', label: 'Curly top' },
          ]}
        />
      )}
      <p className="field__label us-wardrobe__label">Accessoires</p>
      <div className="us-accessories" role="group" aria-label="Accessoires">
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
    toast(`Mini ${name} heeft iets nieuws geleerd`);
  };

  return (
    <div className="us-teach">
      <form className="us-teach__form" onSubmit={teach}>
        <TextField
          label={`Leer mini ${name} iets zeggen`}
          value={text}
          onChange={setText}
          maxLength={120}
          placeholder="Iets wat we altijd zeggen"
        />
        <button type="submit" className="btn btn--soft btn--small" disabled={!text.trim()}>
          <Plus aria-hidden="true" /> Leren
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
                aria-label={`“${l}” vergeten`}
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
      setError('Die verjaardag klopt niet helemaal.');
      return;
    }
    if (!Number.isFinite(cm) || cm < 120 || cm > 230) {
      setError('Lengte in centimeters, tussen 120 en 230.');
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
            aria-label={`Gegevens van ${name} bewerken`}
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </button>
        )}
      </div>
      {editing ? (
        <form className="form" onSubmit={save} noValidate>
          <TextField
            label="Volledige naam"
            optional
            value={fullName}
            onChange={setFullName}
            maxLength={80}
          />
          <TextField
            label="Verjaardag"
            optional
            type="date"
            value={birthday}
            onChange={setBirthday}
          />
          <TextField
            label="Lengte (cm)"
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
              Annuleren
            </button>
            <button type="submit" className="btn btn--primary btn--small">
              Opslaan
            </button>
          </div>
        </form>
      ) : (
        <dl className="us-card__facts">
          <div>
            <dt>Volledige naam</dt>
            <dd className={mini.fullName ? '' : 'is-empty'}>
              {mini.fullName || 'tik ✎ om in te vullen'}
            </dd>
          </div>
          <div>
            <dt>Verjaardag</dt>
            <dd className={mini.birthday ? '' : 'is-empty'}>
              {mini.birthday ? formatDate(mini.birthday) : 'tik ✎ om in te vullen'}
            </dd>
          </div>
          {age !== null && (
            <div>
              <dt>Leeftijd</dt>
              <dd>{age}</dd>
            </div>
          )}
          <div>
            <dt>Lengte</dt>
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
      ? 'We zeggen het allebei'
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
        Hoe we elkaar noemen <span className="hand">meest gebruikt eerst</span>
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
                aria-label={`${p.name} omhoog`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`${p.name} omlaag`}
                disabled={i === names.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`${p.name} weghalen`}
                onClick={() => set(names.filter((n) => n.id !== p.id))}
              >
                <Trash2 />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <form className="us-pets__add" onSubmit={add}>
        <TextField label="Nog een naam" value={text} onChange={setText} maxLength={40} />
        <SelectField
          label="Wie zegt het"
          value={from}
          onChange={setFrom}
          options={(['both', 'you', 'partner'] as const).map((f) => ({
            value: f,
            label: label(f),
          }))}
        />
        <button type="submit" className="btn btn--soft btn--small" disabled={!text.trim()}>
          <Plus aria-hidden="true" /> Toevoegen
        </button>
      </form>
    </section>
  );
}
