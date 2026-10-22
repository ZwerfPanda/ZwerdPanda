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
    if (reasonList.length === 0) problems.reasons = 'Keep at least one reason in the jar.';
    if (reasonList.length > 80) problems.reasons = 'The jar holds up to 80 reasons.';
    if (starList.length < 3) problems.stars = 'The sky needs at least 3 stars.';
    if (starList.length > 12) problems.stars = 'Up to 12 stars fit in the sky.';
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
    toast('Surprises updated ♡');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit the surprises"
      eyebrow="behind the curtain"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="surprise-form" className="btn btn--primary">
            Save surprises
          </button>
        </>
      }
    >
      <form id="surprise-form" className="form" onSubmit={save} noValidate>
        <TextArea
          label="Reasons in the jar"
          value={reasons}
          onChange={setReasons}
          error={errors.reasons}
          rows={9}
          hint={`One per line (${lines(reasons).length} now). They also bloom in the flower, float off the home-page planet and drop out of the arcade’s claw machine.`}
        />
        <TextArea
          label="Stars in the night sky"
          value={stars}
          onChange={setStars}
          error={errors.stars}
          rows={6}
          hint="One short memory per line, 3–12 stars. Together they draw a heart."
        />
        <TextArea label="Message in the gift box" value={gift} onChange={setGift} rows={3} />
        <TextArea
          label="Note on the back of the polaroid"
          value={secret}
          onChange={setSecret}
          rows={3}
        />
        <TextArea
          label="Note for whoever finds a hidden heart"
          value={hidden}
          onChange={setHidden}
          rows={3}
        />
      </form>
    </Dialog>
  );
}
