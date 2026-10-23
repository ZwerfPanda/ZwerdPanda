import { useEffect, useRef } from 'react';
import { useContent } from '../../data/store';
import { useToday } from '../../hooks/useToday';
import { celebrateFrom } from '../../components/ui/feedback';
import { playSfx } from '../../lib/audio/sfx';
import { CocoFigure } from '../../components/art/SampleArt';

/** Days until Coco's next birthday (0 on the day), and how old she turns. */
export function cocoBirthday(
  birthday: string,
  today: string,
): { days: number; age: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const year = Number(today.slice(0, 4));
  let next = `${year}${birthday.slice(4)}`;
  if (next < today) next = `${year + 1}${birthday.slice(4)}`;
  const days = Math.round(
    (Date.parse(`${next}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000,
  );
  const age = Number(next.slice(0, 4)) - Number(birthday.slice(0, 4));
  return age > 0 ? { days, age } : null;
}

/** A party on Coco's birthday, and a countdown the week before. */
export function CocoBirthday() {
  const birthday = useContent((c) => c.pet.birthday);
  const today = useToday();
  const ref = useRef<HTMLElement>(null);
  const info = cocoBirthday(birthday, today);
  const party = info?.days === 0;

  useEffect(() => {
    if (!party || !ref.current) return;
    const t = window.setTimeout(() => {
      celebrateFrom(ref.current);
      playSfx('success', true);
    }, 600);
    return () => window.clearTimeout(t);
  }, [party]);

  if (!info || info.days > 7) return null;
  return (
    <section ref={ref} className={`coco-bday ${party ? 'is-party' : ''}`} aria-live="polite">
      <svg viewBox="-80 -110 160 150" className="coco-bday__art" aria-hidden="true">
        <CocoFigure x={0} y={0} scale={0.75} blink />
        {/* party hat */}
        <g transform="translate(0 30)">
          <path d="M-14-58L0-100 14-58Z" fill="#e0457b" stroke="#2b1a24" strokeWidth="2.5" />
          <circle cx="0" cy="-102" r="6" fill="#ffd75e" />
          <circle cx="-3" cy="-76" r="3" fill="#fff" />
          <circle cx="5" cy="-66" r="3" fill="#fff" />
        </g>
      </svg>
      <div>
        <p className="coco-bday__eyebrow">{party ? 'hiep hiep hoera' : 'bijna feest'}</p>
        <h2 className="coco-bday__title">
          {party
            ? `Coco wordt vandaag ${info.age}! 🎂`
            : `Nog ${info.days === 1 ? '1 nachtje' : `${info.days} dagen`} tot Coco ${info.age} wordt 🎈`}
        </h2>
        {party && (
          <p className="coco-bday__text">
            Extra knuffels, een feestmaaltje en héél veel foto’s vandaag. 🐰💕
          </p>
        )}
      </div>
    </section>
  );
}
