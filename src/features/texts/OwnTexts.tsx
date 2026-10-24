import { useState } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import { useContent } from '../../data/store';
import { resetTextEdit } from '../../data/actions';
import { sweetName } from '../../data/people';
import { navigate } from '../../lib/router';
import { toast } from '../../components/ui/feedback';
import { setEditMode } from './TextEditor';

/** In Instellingen, for him only: switch the editor on and see what he changed. */
export function OwnTexts() {
  const texts = useContent((c) => c.texts);
  const profile = useContent((c) => c.profile);
  const petNames = useContent((c) => c.us.petNames);
  const [all, setAll] = useState(false);
  const her = sweetName('partner', 'you', petNames, profile);
  const newest = [...texts].sort((a, b) => b.at.localeCompare(a.at));
  const shown = all ? newest : newest.slice(0, 6);

  return (
    <div className="own-texts" data-no-retext>
      <p>
        Pas elke tekst op de site aan in je eigen woorden: titels, knoppen, zinnetjes. Zet de
        bewerkmodus aan en tik op een tekst. {her} ziet jouw versie, maar kan zelf niets aan deze
        teksten veranderen.
      </p>
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => {
          setEditMode('edit');
          navigate('/');
          toast('Tik op een tekst om hem aan te passen ✏️');
        }}
      >
        <Pencil aria-hidden="true" /> Teksten aanpassen
      </button>
      {newest.length > 0 && (
        <>
          <p className="own-texts__count">
            {newest.length} {newest.length === 1 ? 'tekst' : 'teksten'} in jouw woorden
          </p>
          <ul className="own-texts__list">
            {shown.map((t) => (
              <li key={t.id} className="own-texts__item">
                <span className="own-texts__from">{t.from}</span>
                <span className="own-texts__to">{t.to}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`“${t.from}” terugzetten`}
                  onClick={() => {
                    resetTextEdit(t.id);
                    toast('Weer de originele tekst');
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {newest.length > 6 && (
            <button type="button" className="btn btn--ghost" onClick={() => setAll((a) => !a)}>
              {all ? 'Minder' : `Alle ${newest.length} bekijken`}
            </button>
          )}
        </>
      )}
      <p className="own-texts__note">
        Alleen jij ziet dit, omdat je met het account bent ingelogd dat ons universum heeft gemaakt.
        De server houdt het ook echt op slot (vanaf de nieuwste versie van{' '}
        <code>supabase/schema.sql</code>).
      </p>
    </div>
  );
}
