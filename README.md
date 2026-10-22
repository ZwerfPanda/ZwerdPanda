# Our Little Universe ♡

A private, interactive little world for **Valencio & Shenaya** — a scrapbook,
a storybook, a map of our places, letters for the right moments, and a sky
full of one-days.

![Home, Our Little World, an Open-when letter, Our Story and the scrapbook on an iPhone-sized screen](docs/preview-phone.jpg)

Built with React 19, TypeScript and Vite. Mobile-first (made for iPhone),
works offline once visited, and can be added to the Home Screen like an app.

---

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

**On your iPhone:** keep the phone on the same Wi-Fi as your computer. The dev
server prints a `Network:` address (something like `http://192.168.1.20:5173`)
— open that in Safari.

### Production build

```bash
npm run build     # type-checks, then builds into dist/
npm run preview   # serves dist/ at http://localhost:4173
```

`dist/` is a plain static site (all paths are relative), so it can be hosted
anywhere: Netlify (drag & drop the folder), Cloudflare Pages, Vercel or GitHub
Pages. Note that a hosted link is reachable by anyone who has it — see
[Privacy](#privacy--where-things-are-stored). Search engines are asked not to
index it (`noindex`).

### Add it to the Home Screen (iPhone)

Open the hosted site in Safari → **Share** → **Add to Home Screen**. It then
opens full-screen with its own icon, and keeps working offline (the app shell
and every page are cached by a service worker after the first visit).

### Checks

```bash
npm test          # unit tests (relationship-duration maths)
npm run typecheck # TypeScript
```

---

## What's inside

| Section | What it does |
| --- | --- |
| **Opening scene** | Two stars — Valencio and Shenaya — drift together and become a little planet. Skippable; shown once per visit by default (Settings → Opening scene). |
| **Home** | Twilight hero with a planet you can tap for a little reason, the *together for* counter (years · months · days, or total days, plus the next anniversary), a note, and a scrapbook-style map of everything. |
| **Our Story** | A journey line: train tracks for the train-and-metro era, a road from the chapter where the car arrived, starlight for chapters not yet written. Chapters open like storybook pages (swipe or arrow keys), with photos, clips, a song and a writing prompt. Add, edit, reorder, favourite, delete (with undo). |
| **Memories** | Polaroid scrapbook with albums, favourites and search. Lightbox with swipe, keyboard and slideshow (optionally with our soundtrack). Pick several photos at once — they're resized and stored on the device. |
| **Our Little World** | The signature feature: an illustrated landscape where a path climbs from *the Station* (where it started) to *our home, one day*. Nine places — Matcha Corner, Arcade, Karaoke Booth, Memory Tree, Coco's House, Garden, Moon Post — each with its own little interaction. Day/dusk/night follow the clock (or tap to change). |
| **Open when…** | Envelopes with an opening animation. Letters can be on the shelf or kept as drafts, opened with a tap, by holding the wax seal, or not before a chosen date. |
| **Our Future** | Dream board (each kind of dream is a different keepsake), statuses with a small celebration when something's done, a pressure-free *One day…* sky, and time capsules sealed until a date. |
| **Little Surprises** | A jar of reasons, a gift box, a flower that blooms with today's reason, a photo with a secret on the back, a night sky whose stars draw a heart — and hidden hearts scattered around the site. All editable. |
| **Music Corner** | Record player for our soundtrack (an original music-box lullaby made for this site, or our own uploaded song). Songs with why they matter; Spotify/YouTube links play in an official embedded player on request, other links open externally. Nothing autoplays. |
| **Coco's Corner** | Coco's portrait (illustration until a photo is set), an editable *Official bunny ID*, Coco's photos and funny moments. |
| **Settings** | Names, start date, every word on the home page, colour theme (Blush, Lavender dusk, Matcha, Midnight), animation level, intro, lighting, soundtrack, backups, sample-content removal. |

### Sample content

Everything that ships with the site is a clearly labelled placeholder
(“Sample”, “Starter”), built only from details we gave — no invented dates,
conversations or promises. Chapters contain writing prompts instead.
**Settings → Our data & backups → Remove samples** clears them in one go; anything
you've edited is kept.

---

## Privacy & where things are stored

- **Everything stays on the device.** Words live in `localStorage`; photos,
  clips and the uploaded song live in IndexedDB. Nothing is uploaded.
- **Per device, per browser.** What's added on one phone doesn't appear on
  another yet. To move content: Settings → **Export with photos**, then
  **Restore a backup** on the other device.
- **No fake security.** There's deliberately no password screen: without a
  server it would only *look* secure. Anyone with the link and the phone can
  open the site.
- **Keep backups.** Safari can clear storage for websites that haven't been
  opened in a while. Sites added to the Home Screen are treated as apps and
  are much safer — but an occasional export is still the best insurance.

---

## Project structure

```
src/
  app/           App shell: routing, top bar, tab bar, menu, mini player
  data/          Types, starter content, store, actions, import/export, validation
  lib/           Dates (tested), hash router, IndexedDB media, music box synth, embeds
  components/    UI primitives (dialog, fields, toasts, confirm), media, art, music
  features/      One folder per section: home, intro, story, memories, world,
                 letters, future, surprises, music, coco, settings
  styles/        Design tokens, base styles, shared UI styles
public/          Manifest, icons, service worker
```

The visual language lives in `src/styles/tokens.css` (palette, type, depth)
and the illustrations in `src/components/art` and `src/features/world/PlaceArt.tsx`.

---

## Next: real shared access (planned, not built yet)

So both of us see the same universe on our own phones:

1. **Backend** — e.g. Supabase: email magic-link sign-in limited to our two
   addresses, Postgres tables mirroring `src/data/types.ts`, and a *private*
   Storage bucket for photos, all protected by row-level security.
2. **Swap the storage layer** — the app only talks to `ContentAdapter` in
   `src/data/store.ts` and the media functions in `src/lib/media.ts`; those
   are the two places a shared backend plugs in.
3. **Move existing content** — export a backup with photos and import it into
   the shared space once.

No API keys or secrets belong in this frontend code.

---

## Credits

Fonts: Fraunces, DM Sans and Caveat (SIL Open Font License), self-hosted via
Fontsource. Icons: Lucide (ISC). Illustrations and the music-box tune were
made for this project.

Made with love by Valencio.
