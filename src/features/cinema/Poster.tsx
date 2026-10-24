import { useContent } from '../../data/store';
import type { Film, FilmGenre } from '../../data/types';
import { MediaView } from '../../components/media/MediaView';
import { Moment, UsProvider } from '../museum/scenes/kit';
import type { MomentKind } from '../us/lines';
import { GENRES } from './cinema';

/** Without a photo, mini us star on the poster, in a moment that fits the genre. */
const POSE: Record<FilmGenre, MomentKind> = {
  romcom: 'kiss',
  avontuur: 'highfive',
  komedie: 'wave',
  drama: 'hug',
  griezel: 'hug',
  docu: 'selfie',
  musical: 'twirl',
  sprookje: 'heart',
};

/**
 * A film poster in its genre's style: the photo (or a still from the film, or
 * mini us), the title in lights, a tagline and who stars in it.
 */
export function Poster({
  film,
  stars,
  size = 'sm',
}: {
  film: Film;
  /** Our average, shown as a little row of stars. */
  stars?: number | null;
  size?: 'sm' | 'lg';
}) {
  const us = useContent((c) => c.us);
  const profile = useContent((c) => c.profile);
  const g = GENRES[film.genre];
  return (
    <div
      className={`poster poster--${size} poster--${g.font}`}
      style={
        {
          '--poster-from': g.from,
          '--poster-to': g.to,
          '--poster-ink': g.ink,
          '--poster-accent': g.accent,
        } as React.CSSProperties
      }
    >
      <span className="poster__genre">
        {g.emoji} {g.label}
      </span>
      <div className="poster__art">
        {film.poster ? (
          <MediaView source={film.poster} alt="" className="poster__photo" />
        ) : (
          <svg viewBox="-170 -370 340 390" aria-hidden="true" className="poster__minis">
            <UsProvider us={us}>
              <Moment kind={POSE[film.genre]} />
            </UsProvider>
          </svg>
        )}
        <span className="poster__glow" aria-hidden="true" />
      </div>
      <div className="poster__text">
        <p className="poster__starring">
          {profile.partnerName} &amp; {profile.yourName}
        </p>
        <p className="poster__title">{film.title}</p>
        <p className="poster__tagline">{film.tagline || g.tagline}</p>
        {stars != null && (
          <p className="poster__stars" aria-label={`${stars.toFixed(1)} van 5 sterren`}>
            {'★'.repeat(Math.round(stars))}
            <span aria-hidden="true">{'★'.repeat(5 - Math.round(stars))}</span>
          </p>
        )}
        <p className="poster__credits" aria-hidden="true">
          EEN FILM VAN ONS TWEE · ALLEEN IN ONZE BIOS · ♡
        </p>
      </div>
    </div>
  );
}
