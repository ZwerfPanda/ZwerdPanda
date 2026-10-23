import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { useMusic, SOUNDTRACK_PLAY_EVENT } from './MusicProvider';
import './spotify.css';

/**
 * Spotify that keeps playing while we move around the site.
 *
 * The official Spotify player lives in a dock that belongs to the app, not
 * to a page, so it isn't torn down when we navigate. With Spotify's iFrame
 * API (loaded only once something is played) the mini player can show
 * whether it's playing and pause or resume it. If that script can't load,
 * the plain embedded player still works; the bar then just opens it.
 */

export interface SpotifyItem {
  title: string;
  /** spotify:playlist:… / spotify:album:… / spotify:track:… */
  uri: string;
  url: string;
}

interface SpotifyApi {
  current: SpotifyItem | null;
  /** null until Spotify tells us (or when it can't). */
  paused: boolean | null;
  expanded: boolean;
  /** Spotify's controls are available (not just the plain player). */
  controllable: boolean;
  open: (item: SpotifyItem) => void;
  togglePlay: () => void;
  setExpanded: (expanded: boolean) => void;
  close: () => void;
}

const SpotifyContext = createContext<SpotifyApi | null>(null);

export function useSpotify(): SpotifyApi {
  const api = useContext(SpotifyContext);
  if (!api) throw new Error('useSpotify must be used inside <SpotifyProvider>');
  return api;
}

/* ------------------------------------------------- Spotify's iFrame API */

interface Controller {
  loadUri: (uri: string) => void;
  togglePlay: () => void;
  pause: () => void;
  destroy: () => void;
  addListener: (event: string, cb: (e: { data: { isPaused?: boolean } }) => void) => void;
}

interface IFrameApi {
  createController: (
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: Controller) => void,
  ) => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameApi) => void;
  }
}

const SCRIPT = 'https://open.spotify.com/embed/iframe-api/v1';
let apiPromise: Promise<IFrameApi> | null = null;

function loadIframeApi(): Promise<IFrameApi> {
  apiPromise ??= new Promise<IFrameApi>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), 8000);
    window.onSpotifyIframeApiReady = (api) => {
      window.clearTimeout(timer);
      resolve(api);
    };
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('blocked'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    apiPromise = null; // try again next time
    throw error;
  });
  return apiPromise;
}

/** spotify:… URI → the embed address for the plain player. */
export function embedUrlFor(uri: string): string {
  const [, kind, id] = uri.split(':');
  return `https://open.spotify.com/embed/${kind}/${id}`;
}

/* -------------------------------------------------------------- provider */

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const music = useMusic();
  const [current, setCurrent] = useState<SpotifyItem | null>(null);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<'loading' | 'api' | 'plain'>('loading');
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<Controller | null>(null);
  const musicRef = useRef(music);
  musicRef.current = music;

  const open = useCallback((item: SpotifyItem) => {
    musicRef.current.pause(); // never two songs at once
    setCurrent(item);
    setExpanded(true);
  }, []);

  const close = useCallback(() => {
    controllerRef.current?.destroy();
    controllerRef.current = null;
    setCurrent(null);
    setPaused(null);
    setExpanded(false);
    setMode('loading');
  }, []);

  const togglePlay = useCallback(() => {
    if (controllerRef.current) controllerRef.current.togglePlay();
    else setExpanded(true); // plain player: open it so it can be played there
  }, []);

  // Load (or switch) what's playing.
  useEffect(() => {
    if (!current) return;
    if (controllerRef.current) {
      controllerRef.current.loadUri(current.uri);
      return;
    }
    let cancelled = false;
    setMode('loading');
    loadIframeApi()
      .then((api) => {
        if (cancelled || !hostRef.current) return;
        const target = document.createElement('div');
        hostRef.current.replaceChildren(target);
        api.createController(
          target,
          { uri: current.uri, width: '100%', height: 352 },
          (controller) => {
            if (cancelled) {
              controller.destroy();
              return;
            }
            controllerRef.current = controller;
            controller.addListener('playback_update', (e) => {
              const isPaused = e.data.isPaused ?? true;
              setPaused(isPaused);
              if (!isPaused) musicRef.current.pause();
            });
            setMode('api');
          },
        );
      })
      .catch(() => {
        if (!cancelled) setMode('plain');
      });
    return () => {
      cancelled = true;
    };
    // Only the item matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.uri]);

  // When our own soundtrack starts, Spotify pauses.
  useEffect(() => {
    const onSoundtrack = () => controllerRef.current?.pause();
    window.addEventListener(SOUNDTRACK_PLAY_EVENT, onSoundtrack);
    return () => window.removeEventListener(SOUNDTRACK_PLAY_EVENT, onSoundtrack);
  }, []);

  const api = useMemo<SpotifyApi>(
    () => ({
      current,
      paused,
      expanded,
      controllable: mode === 'api',
      open,
      togglePlay,
      setExpanded,
      close,
    }),
    [current, paused, expanded, mode, open, togglePlay, close],
  );

  return (
    <SpotifyContext.Provider value={api}>
      {children}
      {current &&
        createPortal(
          <div
            className={`spotify-dock ${expanded ? 'is-open' : ''}`}
            role="region"
            aria-label={`${current.title} — Spotify-speler`}
            aria-hidden={!expanded}
            inert={!expanded}
          >
            <div className="spotify-dock__head">
              <span className="spotify-dock__title">{current.title}</span>
              <a
                className="spotify-dock__btn"
                href={current.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in Spotify"
              >
                <ExternalLink />
              </a>
              <button
                type="button"
                className="spotify-dock__btn"
                onClick={() => setExpanded(false)}
                aria-label="Spotify-speler verbergen (hij speelt door)"
              >
                <ChevronDown />
              </button>
            </div>
            {/* Spotify's controller puts its player in here and we never remount it. */}
            <div ref={hostRef} className="spotify-dock__player">
              {mode === 'plain' && (
                <iframe
                  title={`${current.title} — Spotify-speler`}
                  src={embedUrlFor(current.uri)}
                  height={352}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              )}
            </div>
          </div>,
          document.body,
        )}
    </SpotifyContext.Provider>
  );
}
