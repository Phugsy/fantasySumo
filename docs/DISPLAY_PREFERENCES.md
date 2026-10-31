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

Photos are off by default. When enabled, a small curated catalog maps established
Sumo API source identities to canonical rikishi IDs; mutable names are never used
to match images. Initial coverage is Onosato (provider ID 8850) and Hoshoryu (19).
Other rikishi show a bounded **No photo** placeholder, as do failed image loads.
Images are decorative, lazy loaded, and displayed uncropped in fixed-size frames.
Photo credits below each list link to the file, author, and licence:

- [Onosato, Nigtkn](https://commons.wikimedia.org/wiki/File:Oonosato.jpg),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- [Hoshoryu, TSUBAME98](https://commons.wikimedia.org/wiki/File:Hoshoryu_Tomokatsu20220115.jpg),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Source pages and provider identities were checked on 31 October 2026. Images load
directly from Wikimedia only when enabled; availability depends on that service
and client network restrictions. Thumbnail checks from the development runner
returned HTTP 403, so external delivery is not asserted by the deterministic
suite. There is no new API provider, image subscription, or paid service.

The demo uses a local synthetic SVG, a deliberately unavailable image, and
unmapped rows. Component and browser tests exercise successful images and both
fallbacks without external requests. Browser coverage also checks persisted
preferences, system-theme changes, selection preservation, and leaderboard order
on desktop Chromium, mobile Chromium, and mobile WebKit.
