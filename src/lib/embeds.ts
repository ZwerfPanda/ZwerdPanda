/**
 * Recognises links to music platforms. Spotify and YouTube offer official
 * embeddable players; everything else is shown as a plain external link.
 */

export type Platform = 'spotify' | 'youtube' | 'apple' | 'soundcloud' | 'deezer' | 'other';

export interface LinkInfo {
  platform: Platform;
  label: string;
  embedUrl?: string;
  embedHeight?: number;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * A Spotify playlist or album from whatever was pasted: a share link
 * (open.spotify.com/…, with or without /intl-xx and ?si=…) or a spotify: URI.
 */
export function spotifyCollection(
  value: string,
): { kind: 'playlist' | 'album'; id: string; url: string; embedUrl: string } | null {
  const text = value.trim();
  const uri = /^spotify:(playlist|album):([A-Za-z0-9]{10,40})$/.exec(text);
  let kind: string | undefined;
  let idPart: string | undefined;
  if (uri) {
    [, kind, idPart] = uri;
  } else if (isHttpUrl(text)) {
    const url = new URL(text);
    if (url.hostname !== 'open.spotify.com') return null;
    const match = /^\/(?:intl-[a-z-]+\/)?(playlist|album)\/([A-Za-z0-9]{10,40})\/?$/.exec(
      url.pathname,
    );
    if (!match) return null;
    [, kind, idPart] = match;
  }
  if ((kind !== 'playlist' && kind !== 'album') || !idPart) return null;
  return {
    kind,
    id: idPart,
    url: `https://open.spotify.com/${kind}/${idPart}`,
    embedUrl: `https://open.spotify.com/embed/${kind}/${idPart}`,
  };
}

export function describeLink(value: string | undefined): LinkInfo | null {
  if (!value || !isHttpUrl(value)) return null;
  const url = new URL(value);
  const host = url.hostname.replace(/^www\./, '');

  if (host === 'open.spotify.com') {
    const match = url.pathname.match(
      /^\/(?:intl-[a-z]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)/,
    );
    return {
      platform: 'spotify',
      label: 'Open in Spotify',
      embedUrl: match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}` : undefined,
      embedHeight: match?.[1] === 'track' ? 152 : 352,
    };
  }

  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtu.be'
  ) {
    const videoId = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
    const safeId = videoId && /^[A-Za-z0-9_-]{6,20}$/.test(videoId) ? videoId : null;
    return {
      platform: 'youtube',
      label: 'Open op YouTube',
      embedUrl: safeId ? `https://www.youtube-nocookie.com/embed/${safeId}` : undefined,
      embedHeight: 200,
    };
  }

  if (host === 'music.apple.com') return { platform: 'apple', label: 'Open in Apple Music' };
  if (host === 'soundcloud.com') return { platform: 'soundcloud', label: 'Open op SoundCloud' };
  if (host === 'deezer.com') return { platform: 'deezer', label: 'Open op Deezer' };
  return { platform: 'other', label: `Open op ${host}` };
}
