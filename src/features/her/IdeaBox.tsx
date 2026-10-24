import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { useContent } from '../../data/store';
import { sweetName, useMe } from '../../data/people';
import { href } from '../../lib/router';
import type { IdeaNote } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { playSfx } from '../../lib/audio/sfx';
import { toast } from '../../components/ui/feedback';
import { useHer, updateHerSpace } from './herStore';
import { Vase } from '../flowers/Vase';

const STATUS: Record<IdeaNote['status'], string> = {
  new: 'nieuw',
  seen: 'gezien 👀',
  built: 'staat erin ✨',
};

const setIdeas = (recipe: (ideas: IdeaNote[]) => IdeaNote[]) =>
  updateHerSpace((h) => ({ ...h, ideas: recipe(h.ideas) }));

/** Her wishes for our app. He sees them and passes them on; they get built. */
export function IdeaBox({ visitor }: { visitor: boolean }) {
  const ideas = useHer((h) => h.ideas);
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const petNames = useContent((c) => c.us.petNames);
  const yourName = sweetName('you', me, petNames, profile);
  const partnerName = sweetName('partner', me, petNames, profile);
  const [text, setText] = useState('');
  const sorted = [...ideas].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setIdeas((list) => [
      ...list,
      { id: createId('idea'), text: text.trim(), status: 'new', createdAt: nowIso() },
    ]);
    setText('');
    playSfx('paper', true);
    toast(`In de ideeënbus — ${yourName} ziet hem 💡`);
  };

  return (
    <section className="her-card her-ideas" aria-labelledby="her-ideas-title">
      <h2 id="her-ideas-title" className="her-card__title">
        <Lightbulb aria-hidden="true" /> Ideeënbus
      </h2>
      <p className="her-card__hint">
        {visitor
          ? `Wensen van ${partnerName} voor ons universe. Geef ze door — dan worden ze gebouwd.`
          : `Wat wil je nog in ons universe? ${yourName} ziet je ideeën en laat ze erin bouwen.`}
      </p>
      {!visitor && (
        <form className="her-ideas__form" onSubmit={add}>
          <label className="visually-hidden" htmlFor="idea-text">
            Jouw idee
          </label>
          <textarea
            id="idea-text"
            rows={2}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="bv. Een spelletje waarbij…"
          />
          <button type="submit" className="btn btn--primary btn--small" disabled={!text.trim()}>
            In de ideeënbus
          </button>
        </form>
      )}
      {sorted.length > 0 ? (
        <ul className="her-ideas__list">
          {sorted.map((idea) => (
            <li key={idea.id} className={`her-idea her-idea--${idea.status}`}>
              <p>{idea.text}</p>
              {visitor ? (
                <div className="her-idea__actions" role="group" aria-label="Status">
                  {(['seen', 'built'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="chip"
                      aria-pressed={idea.status === s}
                      onClick={() =>
                        setIdeas((list) =>
                          list.map((x) =>
                            x.id === idea.id ? { ...x, status: x.status === s ? 'new' : s } : x,
                          ),
                        )
                      }
                    >
                      {STATUS[s]}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="tag">{STATUS[idea.status]}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        visitor && <p className="her-music__hint">Nog geen ideeën in de bus.</p>
      )}
    </section>
  );
}

/** A peek at her flower shop from her corner. */
export function FlowerShopCard() {
  const flowers = useContent((c) => c.flowers);
  const latest = [...flowers].sort((a, b) =>
    (a.date ?? a.createdAt) < (b.date ?? b.createdAt) ? 1 : -1,
  )[0];
  return (
    <a className="her-card her-flowers" href={href('/flowers')}>
      <span className="her-flowers__vase" aria-hidden="true">
        <span className="her-flowers__bloom">💐</span>
        <Vase index={latest?.vase ?? 1} />
      </span>
      <span>
        <span className="her-card__title">Mijn bloemenwinkeltje</span>
        <span className="her-card__hint">
          {flowers.length
            ? `${flowers.length} ${flowers.length === 1 ? 'boeket' : 'boeketten'} op de plank`
            : 'Zet je boeketten op de plank'}
        </span>
      </span>
    </a>
  );
}
