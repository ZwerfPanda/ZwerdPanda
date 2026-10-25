import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getAuthor, sweetName, useMe } from '../../data/people';
import { useContent } from '../../data/store';
import { upsertItem } from '../../data/actions';
import { Dialog } from '../../components/ui/Dialog';
import { TextArea } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import { createId, nowIso } from '../../lib/id';
import { todayIso } from '../../lib/dates';
import { playSfx } from '../../lib/audio/sfx';
import { useReducedMotion } from '../../hooks/useMotion';
import { FLOWER_KINDS, OCCASIONS, VASES, meaningOf } from './flowers';
import { BouquetArt, FlowerHead } from './FlowerArt';

const MAX_STEMS = 9;
const PAPERS = [
  { name: 'Kraft', paper: '#e8c9a0', ribbon: '#e6889b' },
  { name: 'Roze', paper: '#ffd6e2', ribbon: '#c4577a' },
  { name: 'Wit', paper: '#fbf6f0', ribbon: '#d9a441' },
  { name: 'Lila', paper: '#e4dafa', ribbon: '#8a6bb0' },
];

/**
 * Bind a bouquet yourself: take stems from the buckets, wrap them, write the
 * card. It goes on the shelf like a real one — for the days we're apart.
 */
export function BouquetBuilder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const petNames = useContent((c) => c.us.petNames);
  const reduce = useReducedMotion();
  const [stems, setStems] = useState<string[]>([]);
  const [paper, setPaper] = useState(0);
  const [occasion, setOccasion] = useState<string>('Zomaar');
  const [card, setCard] = useState('');
  const [bound, setBound] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStems([]);
    setPaper(0);
    setOccasion('Zomaar');
    setCard('');
    setBound(false);
  }, [open]);

  const other = sweetName(me === 'you' ? 'partner' : 'you', me, petNames, profile);
  const kinds = [...new Set(stems)];

  const take = (name: string) => {
    if (stems.length >= MAX_STEMS) {
      toast('Je handen zijn vol — 9 stelen is een mooi boeket 💐');
      return;
    }
    playSfx('pop', true);
    setStems((s) => [...s, name]);
  };

  const give = () => {
    if (!stems.length) return;
    setBound(true);
    playSfx('paper', true);
    window.setTimeout(
      () => {
        upsertItem(
          'flowers',
          {
            id: createId('bouquet'),
            date: todayIso(),
            occasion,
            flowers: stems,
            card: card.trim() || undefined,
            note: 'zelf gebonden in het winkeltje',
            vase: (paper + stems.length) % VASES.length,
            favorite: false,
            by: getAuthor(),
            createdAt: nowIso(),
          },
          'start',
        );
        playSfx('chime', true);
        toast(`Gebonden en op de plank gezet voor ${other} 💐`);
        onClose();
      },
      reduce ? 0 : 900,
    );
  };

  const p = PAPERS[paper];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Een boeket binden"
      eyebrow="aan de werkbank"
      size="lg"
      className="builder-dialog"
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setStems([])}
            disabled={!stems.length}
          >
            Opnieuw
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={give}
            disabled={!stems.length || bound}
          >
            🎀 Inpakken & geven
          </button>
        </>
      }
    >
      <div className="builder">
        <div className="builder__preview">
          <motion.div
            key={bound ? 'bound' : 'open'}
            animate={
              bound && !reduce
                ? { scale: [1, 1.08, 0.9], rotate: [0, -4, 0], y: [0, -10, 30], opacity: [1, 1, 0] }
                : {}
            }
            transition={{ duration: 0.9 }}
          >
            <BouquetArt flowers={stems} paper={p.paper} ribbon={p.ribbon} />
          </motion.div>
          <p className="builder__count">
            {stems.length
              ? `${stems.length} ${stems.length === 1 ? 'steel' : 'stelen'}`
              : 'Pak bloemen uit de emmers'}
          </p>
        </div>
        <div className="builder__side">
          <p className="builder__label">De emmers</p>
          <div className="builder__buckets">
            {FLOWER_KINDS.filter((f) => f.name !== 'Gemengd').map((f) => (
              <button
                key={f.name}
                type="button"
                className="builder__bucket"
                onClick={() => take(f.name)}
              >
                <svg viewBox="-14 -14 28 28" aria-hidden="true">
                  <FlowerHead kind={f.name} />
                </svg>
                <span>{f.name}</span>
              </button>
            ))}
          </div>
          {kinds.length > 0 && (
            <ul className="builder__meanings">
              {kinds.map((k) => (
                <li key={k}>
                  <strong>{k}</strong>: {meaningOf(k)}
                </li>
              ))}
            </ul>
          )}
          <p className="builder__label">Het papier</p>
          <div className="chip-row">
            {PAPERS.map((x, i) => (
              <button
                key={x.name}
                type="button"
                className="chip"
                aria-pressed={paper === i}
                onClick={() => setPaper(i)}
              >
                <span
                  className="builder__swatch"
                  style={{ background: x.paper }}
                  aria-hidden="true"
                />{' '}
                {x.name}
              </button>
            ))}
          </div>
          <p className="builder__label">Waarom?</p>
          <div className="chip-row">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                type="button"
                className="chip"
                aria-pressed={occasion === o}
                onClick={() => setOccasion(o)}
              >
                {o}
              </button>
            ))}
          </div>
          <TextArea
            label="Het kaartje"
            optional
            value={card}
            onChange={setCard}
            rows={2}
            maxLength={500}
          />
        </div>
      </div>
    </Dialog>
  );
}
