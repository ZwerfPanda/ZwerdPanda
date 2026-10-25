import { Heart, Salad, Sparkles, SprayCan, Volleyball, Wheat } from 'lucide-react';
import type { Mood, Needs } from './care';

/** What's on top of and right under her room: who she is, how she feels, her needs. */

export const MOOD_FACE: Record<Mood | 'asleep', { emoji: string; label: string }> = {
  happy: { emoji: '😊', label: 'Blij' },
  content: { emoji: '😌', label: 'Tevreden' },
  hungry: { emoji: '🥺', label: 'Hongerig' },
  lonely: { emoji: '🥺', label: 'Mist je' },
  bored: { emoji: '😐', label: 'Verveelt zich' },
  scruffy: { emoji: '🙃', label: 'Pluizig' },
  messy: { emoji: '😣', label: 'Vies hokje' },
  sad: { emoji: '😢', label: 'Verdrietig' },
  asleep: { emoji: '😴', label: 'Doet een dutje' },
};

export function DenBadge({
  mood,
  age,
  carrots,
}: {
  mood: Mood | 'asleep';
  age?: string;
  carrots: number;
}) {
  const face = MOOD_FACE[mood];
  return (
    <div className="den-hud">
      <p className="den-hud__who">
        <span className="den-hud__face" aria-hidden="true">
          {face.emoji}
        </span>
        <span>
          <strong>Coco</strong>
          <small>
            {face.label}
            {age ? ` · ${age}` : ''}
          </small>
        </span>
      </p>
      <p className="den-hud__carrots" title="Worteltjes om haar hokje mee in te richten">
        <span aria-hidden="true">🥕</span> {carrots}
        <span className="visually-hidden"> worteltjes</span>
      </p>
    </div>
  );
}

const RINGS: { key: keyof Needs; label: string; short: string; icon: React.ReactNode }[] = [
  { key: 'hay', label: 'Hooi & water', short: 'Hooi', icon: <Wheat aria-hidden="true" /> },
  { key: 'tummy', label: 'Buikje', short: 'Buikje', icon: <Salad aria-hidden="true" /> },
  { key: 'love', label: 'Knuffels', short: 'Knuffels', icon: <Heart aria-hidden="true" /> },
  { key: 'play', label: 'Spelen', short: 'Spelen', icon: <Volleyball aria-hidden="true" /> },
  { key: 'fur', label: 'Vacht', short: 'Vacht', icon: <Sparkles aria-hidden="true" /> },
  { key: 'clean', label: 'Schoon hokje', short: 'Hokje', icon: <SprayCan aria-hidden="true" /> },
];

const R = 17;
const CIRC = 2 * Math.PI * R;

/** Her six needs as little rings: full and green when she's well looked after. */
export function NeedRings({ needs }: { needs: Needs }) {
  return (
    <ul className="den-rings" aria-label="Wat Coco nodig heeft">
      {RINGS.map((r) => {
        const value = needs[r.key];
        const tone = value < 25 ? 'is-low' : value > 70 ? 'is-good' : 'is-mid';
        return (
          <li key={r.key} className={`den-ring ${tone}`}>
            <span
              className="den-ring__dial"
              role="meter"
              aria-label={r.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
            >
              <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle className="den-ring__track" cx="22" cy="22" r={R} />
                <circle
                  className="den-ring__fill"
                  cx="22"
                  cy="22"
                  r={R}
                  strokeDasharray={`${(Math.max(2, value) / 100) * CIRC} ${CIRC}`}
                />
              </svg>
              {r.icon}
            </span>
            <span className="den-ring__label" aria-hidden="true">
              {r.short}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
