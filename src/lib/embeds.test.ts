import { describe, expect, it } from 'vitest';
import { spotifyCollection } from './embeds';

describe('spotifyCollection', () => {
  it('reads playlist share links, with tracking bits and intl paths', () => {
    expect(
      spotifyCollection('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123'),
    ).toEqual({
      kind: 'playlist',
      id: '37i9dQZF1DXcBWIGoYBM5M',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
      embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M',
    });
    expect(
      spotifyCollection('https://open.spotify.com/intl-nl/playlist/37i9dQZF1DXcBWIGoYBM5M')?.id,
    ).toBe('37i9dQZF1DXcBWIGoYBM5M');
  });

  it('accepts albums and spotify: URIs', () => {
    expect(spotifyCollection('spotify:album:4aawyAB9vmqN3uQ7FjRGTy')?.kind).toBe('album');
    expect(spotifyCollection(' https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy ')?.url).toBe(
      'https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy',
    );
  });

  it('refuses anything else', () => {
    expect(spotifyCollection('https://open.spotify.com/track/4aawyAB9vmqN3uQ7FjRGTy')).toBeNull();
    expect(spotifyCollection('https://evil.example/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBeNull();
    expect(spotifyCollection('https://spotify.link/abcdef')).toBeNull();
    expect(spotifyCollection('not a link')).toBeNull();
  });
});

describe('saved playlists', () => {
  it('keeps only real Spotify playlists, stored as clean links', async () => {
    const { normalizeContent } = await import('../data/normalize');
    const { createDefaultContent } = await import('../data/defaults');
    const raw = {
      ...createDefaultContent(),
      playlists: [
        {
          id: 'p1',
          title: 'Us',
          url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x',
        },
        { id: 'p2', title: 'Nope', url: 'https://example.com/whatever' },
      ],
    };
    const c = normalizeContent(raw);
    expect(c.playlists.map((p) => p.url)).toEqual([
      'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    ]);
  });
});
