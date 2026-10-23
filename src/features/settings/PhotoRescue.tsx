import { useState } from 'react';
import { Check, ImageUp, SearchCheck } from 'lucide-react';
import { getContent, updateContent } from '../../data/store';
import { KEEP_UNUSED_DAYS, unusedLocalMedia } from '../../data/actions';
import { getAuthor } from '../../data/people';
import type { MediaSource } from '../../data/types';
import { Dialog } from '../../components/ui/Dialog';
import { SelectField } from '../../components/ui/Fields';
import { MediaView } from '../../components/media/MediaView';
import { toast } from '../../components/ui/feedback';
import { getMedia } from '../../lib/media';
import { createId, nowIso } from '../../lib/id';
import { getSyncEngine } from '../../sync/sync';

const AS_MEMORIES = '__memories';

/**
 * Photos that are still stored (on this phone or in our cloud) but that
 * nothing uses any more — after a mix-up, or a form that lost them. They are
 * kept for a month, and here they can be put back where they belong.
 */
export function PhotoRescue() {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<MediaSource[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string>(AS_MEMORIES);

  const search = async () => {
    setSearching(true);
    try {
      const ids = new Set(await unusedLocalMedia().catch(() => [] as string[]));
      const cloud = await getSyncEngine()
        ?.listUnusedMedia()
        .catch(() => [] as string[]);
      cloud?.forEach((id) => ids.add(id));
      const sources: MediaSource[] = [];
      for (const mediaId of ids) {
        const local = await getMedia(mediaId).catch(() => undefined);
        // Sounds (like our own opening song) aren't photos; leave them be.
        if (local && !/^(image|video)\//.test(local.blob.type)) continue;
        sources.push({
          type: 'local',
          mediaId,
          kind: local?.blob.type.startsWith('video/') ? 'video' : 'image',
        });
      }
      setFound(sources);
      setPicked(new Set(sources.map((s) => (s.type === 'local' ? s.mediaId : ''))));
      setOpen(true);
    } finally {
      setSearching(false);
    }
  };

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const restore = () => {
    const chosen = found.filter((s) => s.type === 'local' && picked.has(s.mediaId));
    if (!chosen.length) return;
    if (target === AS_MEMORIES) {
      const by = getAuthor();
      updateContent((c) => ({
        ...c,
        memories: [
          ...chosen.map((media) => ({
            id: createId('memory'),
            caption: 'Teruggevonden foto',
            albumIds: [],
            media,
            favorite: false,
            by,
            createdAt: nowIso(),
          })),
          ...c.memories,
        ],
      }));
    } else {
      updateContent((c) => ({
        ...c,
        museum: {
          ...c.museum,
          stops: c.museum.stops.map((s) =>
            s.id === target ? { ...s, media: [...s.media, ...chosen].slice(0, 500) } : s,
          ),
        },
      }));
    }
    const where =
      target === AS_MEMORIES
        ? 'Herinneringen'
        : (getContent().museum.stops.find((s) => s.id === target)?.name ?? 'de halte');
    toast(`${chosen.length} foto${chosen.length === 1 ? '' : '’s'} teruggezet bij ${where} ♡`);
    setFound((f) => f.filter((s) => !chosen.includes(s)));
    setPicked(new Set());
  };

  const stops = getContent().museum.stops;

  return (
    <div className="settings-danger">
      <div>
        <h3>Foto’s terugzoeken</h3>
        <p className="settings-text">
          Een foto kwijt? Foto’s die nergens meer bij staan, bewaren we nog {KEEP_UNUSED_DAYS} dagen
          — hier vind je ze terug en zet je ze weer op hun plek.
        </p>
      </div>
      <button type="button" className="btn btn--ghost" onClick={search} disabled={searching}>
        <SearchCheck aria-hidden="true" /> {searching ? 'Zoeken…' : 'Zoek losse foto’s'}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={found.length ? `${found.length} losse foto’s gevonden` : 'Niets kwijt ♡'}
        eyebrow="foto’s terugzoeken"
        size="md"
        footer={
          found.length ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={restore}
              disabled={picked.size === 0}
            >
              <ImageUp aria-hidden="true" /> {picked.size} terugzetten
            </button>
          ) : undefined
        }
      >
        {found.length === 0 ? (
          <p className="settings-text">
            Alle foto’s die we hebben, staan ergens in ons universe. Er is niets los geraakt.
          </p>
        ) : (
          <div className="rescue">
            <p className="settings-text">
              Tik op een foto om hem wel of niet mee te nemen, en kies waar ze weer heen moeten.
            </p>
            <ul className="rescue__grid">
              {found.map((s) =>
                s.type === 'local' ? (
                  <li key={s.mediaId}>
                    <button
                      type="button"
                      className="rescue__photo"
                      aria-pressed={picked.has(s.mediaId)}
                      aria-label="Foto meenemen"
                      onClick={() => toggle(s.mediaId)}
                    >
                      <MediaView source={s} alt="" />
                      <span className="rescue__check" aria-hidden="true">
                        <Check />
                      </span>
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
            <SelectField
              label="Terugzetten bij"
              value={target}
              onChange={setTarget}
              options={[
                { value: AS_MEMORIES, label: 'Herinneringen (elk als nieuw moment)' },
                ...stops.map((s) => ({ value: s.id, label: `Love Line · ${s.name}` })),
              ]}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
