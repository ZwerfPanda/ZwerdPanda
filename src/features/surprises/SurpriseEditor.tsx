import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { TextArea } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import { getContent } from '../../data/store';
import { updateSurprises } from '../../data/actions';
import { createId } from '../../lib/id';

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** One place to rewrite every surprise in our own words. */
export function SurpriseEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [reasons, setReasons] = useState('');
  const [stars, setStars] = useState('');
  const [gift, setGift] = useState('');
  const [secret, setSecret] = useState('');
  const [hidden, setHidden] = useState('');
  const [errors, setErrors] = useState<{ reasons?: string; stars?: string }>({});

  useEffect(() => {
    if (!open) return;
    const s = getContent().surprises;
    setReasons(s.reasons.join('\n'));
    setStars(s.stars.map((x) => x.text).join('\n'));
    setGift(s.giftMessage);
    setSecret(s.secretNote);
    setHidden(s.hiddenHeartNote);
    setErrors({});
  }, [open]);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const reasonList = lines(reasons);
    const starList = lines(stars);
    const problems: typeof errors = {};
    if (reasonList.length === 0) problems.reasons = 'Houd minstens één reden in de pot.';
    if (reasonList.length > 80) problems.reasons = 'Er passen maximaal 80 redenen in de pot.';
    if (starList.length < 3) problems.stars = 'De lucht heeft minstens 3 sterren nodig.';
    if (starList.length > 12) problems.stars = 'Er passen maximaal 12 sterren in de lucht.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const current = getContent().surprises.stars;
    updateSurprises({
      reasons: reasonList,
      stars: starList.map((text, i) => ({ id: current[i]?.id ?? createId('star'), text })),
      giftMessage: gift.trim(),
      secretNote: secret.trim(),
      hiddenHeartNote: hidden.trim(),
    });
    toast('Surprises bijgewerkt ♡');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Surprises bewerken"
      eyebrow="behind the curtain"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="surprise-form" className="btn btn--primary">
            Opslaan
          </button>
        </>
      }
    >
      <form id="surprise-form" className="form" onSubmit={save} noValidate>
        <TextArea
          label="Redenen in de pot"
          value={reasons}
          onChange={setReasons}
          error={errors.reasons}
          rows={9}
          hint={`Eén per regel (nu ${lines(reasons).length}). Ze bloeien ook in de bloem, zweven van de planeet op Home en vallen uit de grijpmachine in de arcade.`}
        />
        <TextArea
          label="Sterren aan de nachthemel"
          value={stars}
          onChange={setStars}
          error={errors.stars}
          rows={6}
          hint="Eén korte herinnering per regel, 3–12 sterren. Samen tekenen ze een hartje."
        />
        <TextArea label="Bericht in het cadeaudoosje" value={gift} onChange={setGift} rows={3} />
        <TextArea
          label="Briefje op de achterkant van de polaroid"
          value={secret}
          onChange={setSecret}
          rows={3}
        />
        <TextArea
          label="Briefje voor wie een verstopt hartje vindt"
          value={hidden}
          onChange={setHidden}
          rows={3}
        />
      </form>
    </Dialog>
  );
}
