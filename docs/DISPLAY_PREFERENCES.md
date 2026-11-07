# Display preferences

The header's **Display** menu stores preferences in this browser under
`fantasy-sumo-display-v1`. Defaults are rank order, photos hidden, and the system
colour theme. Storage failures leave the controls usable for the current visit;
invalid saved values fall back independently. Changes synchronize between tabs.

Rank, current score, and name order apply to the rikishi selection list and My
Stable. Rank uses imported banzuke order; score sorts descending; ties use name
and canonical ID. Sorting copies the list and never changes selected picks or
official leaderboard position. The read-only list score uses the basho's saved
scoring mode and the existing contiguous, verified result-day boundary, matching
the official stable score. Display preferences never change scoring policy.

System follows operating-system theme changes. Explicit light and dark choices
override it. A small initializer applies the saved theme before React paints;
shared semantic tokens cover panels, inputs, messages, disabled and focus states,
and charts. Existing component CSS consumes the same stable theme variables.

## Optional photos

**Portrait style** selects **Hidden**, **Photos** or **Ink illustrations** in
one control, independently of the colour theme. Selecting artwork makes it
visible immediately. The choice applies to the picks list, My Stable and
expanded leaderboard rikishi, and is saved between visits.
Existing saved preferences keep their photo visibility and default to Photos.
The original storage key remains valid; an absent or unsupported style defaults
to Photos.

Ink illustrations cover all 42 November 2026 Makuuchi rikishi and are labelled
as AI-generated. The local WebP assets use verified JSA or Sumo API aliases;
missing or failed artwork shows **No illustration**. See
[artwork and generation details](RIKISHI_ILLUSTRATIONS.md) for the reference
identities, prompt and maintenance process.

Photos are off by default. When enabled, the API looks up a curated portrait
by the rikishi's established Sumo API ID. A change of shikona keeps that link.
The November 2026 Makuuchi roster has 33 portraits for 42 rikishi. Rikishi without
a verified photo show **No photo**, as do failed image loads.

The web build serves the thumbnails from `/rikishi-photos/`. Each filename
includes the provider ID and a hash of the thumbnail bytes. The app loads them
on demand from its own origin. Each image fits in a fixed frame with its
original thumbnail aspect ratio. **Photo credits** below each list links to the
Wikimedia Commons file and its licence and names the credited author.

To add a portrait, verify the file depicts the wrestler tied to the provider
ID and check its reuse licence on Commons. Store the resized Commons JPEG
in `apps/web/public/rikishi-photos/` and register its path, file page, author,
and licence in `apps/api/src/rikishi-photos.ts`.

The demo uses a local synthetic SVG, a deliberately unavailable image, and
unmapped rows. Component and browser tests exercise successful images and both
fallbacks without external requests. Browser coverage also checks persisted
preferences, system-theme changes, selection preservation, and leaderboard order
on desktop Chromium, mobile Chromium, and mobile WebKit.
