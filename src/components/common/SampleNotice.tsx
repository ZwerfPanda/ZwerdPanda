import { Sparkles } from 'lucide-react';
import { useContent } from '../../data/store';
import { removeSamplesOf, type SampleKind } from '../../data/actions';
import { confirm, toast } from '../ui/feedback';
import { plural } from '../../lib/dates';
import './common.css';

const WHAT: Record<SampleKind, [one: string, many: string, how: string]> = {
  milestones: ['voorbeeldhoofdstuk', 'voorbeeldhoofdstukken', 'Open een hoofdstuk en tik op ✎'],
  memories: ['voorbeeldfoto', 'voorbeeldfoto’s', 'Open een foto en tik op ✎'],
  letters: ['voorbeeldbrief', 'voorbeeldbrieven', 'Open een brief en tik onderaan op ✎'],
  dreams: ['voorbeelddroom', 'voorbeelddromen', 'Tik op ✎ bij een droom'],
};

/**
 * Shown while a page still has starter items: they can be rewritten one by
 * one (editing makes them ours) or cleared in one go.
 */
export function SampleNotice({ kind }: { kind: SampleKind }) {
  const count = useContent(
    (c) => (c[kind] as { isSample?: boolean }[]).filter((i) => i.isSample).length,
  );
  if (!count) return null;
  const [one, many, how] = WHAT[kind];
  const clear = async () => {
    const ok = await confirm({
      title: `${plural(count, one, many)} weghalen?`,
      message:
        'Alleen de voorbeelden verdwijnen. Wat je zelf hebt geschreven of aangepast blijft staan.',
      confirmLabel: 'Weghalen',
      tone: 'danger',
    });
    if (!ok) return;
    removeSamplesOf(kind);
    toast('Voorbeelden weggehaald — it’s all ours now');
  };
  return (
    <aside className="sample-notice">
      <Sparkles aria-hidden="true" />
      <p>
        Er {count === 1 ? 'staat' : 'staan'} nog {plural(count, one, many)}. {how} om er je eigen
        woorden van te maken, of
      </p>
      <button type="button" className="btn btn--ghost btn--small" onClick={clear}>
        haal ze allemaal weg
      </button>
    </aside>
  );
}
