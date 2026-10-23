import { useState } from 'react';
import { CircleCheck, CircleAlert, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import { getSyncEngine, sameEmail } from '../../sync/sync';
import { contentCounts, fingerprint } from '../../sync/fingerprint';
import type { SyncState } from '../../sync/types';
import { timeAgo } from '../../lib/dates';

interface Row {
  ok: boolean;
  text: string;
  hint?: string;
}

/**
 * One place that answers "does she see what I see?": who this phone is, that
 * we're both in, that this phone matches the server, that every photo is
 * online, and how the other phone reported in after its last sync.
 */
export function SyncCheck({ sync }: { sync: SyncState }) {
  const content = useContent((c) => c);
  const me = useMe();
  const them = otherPerson(me);
  const myName = nameOf(me, content.profile);
  const theirName = nameOf(them, content.profile);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);

  const run = async () => {
    const engine = getSyncEngine();
    if (!engine) return;
    setBusy(true);
    const out: Row[] = [];
    try {
      const owner = Boolean(
        sync.account && sync.owner && sameEmail(sync.account.email, sync.owner),
      );
      out.push({
        ok: (me === 'you') === owner,
        text: `Op deze telefoon ben jij ${myName}.`,
        hint:
          (me === 'you') === owner
            ? undefined
            : 'Dit klopt niet met het account — log uit en weer in.',
      });
      out.push(
        sync.members.length >= 2
          ? { ok: true, text: `Jullie zitten er allebei in (${sync.members.length} leden).` }
          : {
              ok: false,
              text: sync.invites.length
                ? `${theirName} is uitgenodigd maar heeft nog geen account gemaakt.`
                : `${theirName} is nog niet uitgenodigd.`,
              hint: `${theirName} maakt een account met precies het uitgenodigde e-mailadres (${sync.invites[0] ?? '…'}).`,
            },
      );
      await engine.syncNow();
      const check = await engine.verify();
      out.push(
        check && check.local === check.server
          ? { ok: true, text: 'Deze telefoon is precies gelijk aan de server.' }
          : {
              ok: false,
              text: 'Deze telefoon loopt nog niet gelijk met de server.',
              hint: 'Even wachten of op “Nu syncen” tikken, en de check opnieuw doen.',
            },
      );
      const media = await engine.mediaStatus();
      out.push(
        media.missing === 0
          ? {
              ok: true,
              text: `Alle ${media.total} foto’s en geluidjes staan online.`,
            }
          : {
              ok: false,
              text: `${media.missing} van ${media.total} foto’s staan nog niet online.`,
              hint: media.here
                ? `${media.here} daarvan staan op deze telefoon en worden nu geüpload — laat de app even open.`
                : 'Ze staan op de andere telefoon: open daar de app even, dan uploaden ze.',
            },
      );
      try {
        await engine.cloudHistory();
        out.push({ ok: true, text: 'De server is helemaal bijgewerkt.' });
      } catch {
        out.push({
          ok: false,
          text: 'De server mist een onderdeel (back-ups in de cloud).',
          hint: 'Plak supabase/schema.sql nog een keer in de SQL editor van Supabase en klik Run. Syncen werkt wel.',
        });
      }
    } catch {
      out.push({
        ok: false,
        text: 'De server was even niet bereikbaar.',
        hint: 'Check je internet en probeer het zo opnieuw.',
      });
    }
    setRows(out);
    setBusy(false);
  };

  const theirs = content.syncReports[them];
  const sameBuild = theirs?.build === __BUILD__;
  const code = fingerprint(content);
  const counts = contentCounts(content);

  return (
    <section className="sync-check" aria-labelledby="sync-check-title">
      <h3 id="sync-check-title">
        <ShieldCheck aria-hidden="true" /> Samen-check
      </h3>
      <p className="field__hint">
        Zien jullie echt hetzelfde? Doe deze check op allebei de telefoons.
      </p>

      <div className="sync-check__print">
        <span>Vingerafdruk van jullie universe</span>
        <strong aria-label={`Vingerafdruk ${code.split('').join(' ')}`}>{code}</strong>
        <small>
          Staat op de telefoon van {theirName} dezelfde code (na syncen)? Dan zien jullie precies
          hetzelfde: elke brief, foto, hoofdstuk en score.
        </small>
      </div>

      <ul className="sync-check__rows">
        <li className={theirs?.ok && sameBuild ? 'is-ok' : 'is-warn'}>
          {theirs?.ok && sameBuild ? (
            <CircleCheck aria-hidden="true" />
          ) : (
            <CircleAlert aria-hidden="true" />
          )}
          <span>
            {theirs
              ? `Telefoon van ${theirName}: gesynct ${timeAgo(theirs.at)}, ${theirs.ok ? 'gelijk aan de server' : 'liep toen nog niet gelijk'}${sameBuild ? ', zelfde app-versie.' : '.'}`
              : `Nog geen sync gemeld van de telefoon van ${theirName}.`}
            {theirs && !sameBuild && (
              <small>
                Daar draait een andere app-versie ({theirs.build || 'onbekend'} vs. {__BUILD__}).
                Laat {theirName} de app helemaal sluiten en opnieuw openen.
              </small>
            )}
          </span>
        </li>
        {rows?.map((r) => (
          <li key={r.text} className={r.ok ? 'is-ok' : 'is-warn'}>
            {r.ok ? <CircleCheck aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
            <span>
              {r.text}
              {r.hint && <small>{r.hint}</small>}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn btn--primary btn--small"
        onClick={() => void run()}
        disabled={busy}
      >
        {busy ? (
          <LoaderCircle className="spin" aria-hidden="true" />
        ) : (
          <ShieldCheck aria-hidden="true" />
        )}
        {rows ? 'Opnieuw controleren' : 'Controleer alles'}
      </button>

      <details className="sync-check__counts">
        <summary>Wat zit er in jullie universe?</summary>
        <ul>
          {Object.entries(counts).map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </li>
          ))}
        </ul>
        <p className="field__hint">
          Wat {nameOf('partner', content.profile)} in haar hoekje “alleen voor mij” zet, staat
          alleen op haar telefoon — dat telt hier bewust niet mee.
        </p>
      </details>
    </section>
  );
}
