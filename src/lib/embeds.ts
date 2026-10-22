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
      label: 'Open on YouTube',
      embedUrl: safeId ? `https://www.youtube-nocookie.com/embed/${safeId}` : undefined,
      embedHeight: 200,
    };
  }

  if (host === 'music.apple.com') return { platform: 'apple', label: 'Open in Apple Music' };
  if (host === 'soundcloud.com') return { platform: 'soundcloud', label: 'Open on SoundCloud' };
  if (host === 'deezer.com') return { platform: 'deezer', label: 'Open on Deezer' };
  return { platform: 'other', label: `Open on ${host}` };
}
