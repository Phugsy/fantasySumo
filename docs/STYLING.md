# Styling

Use vanilla-extract for new styles and convert an existing component when its
styling needs meaningful work. Vite extracts `.css.ts` files into static CSS;
the same plugin runs in Vitest. No runtime styling library, Sprinkles, Recipes,
or additional design system is needed.

The workspace override keeps Vitest's transitive Vite dependency at the existing
`7.3.3` version, matching the web app. The styling plugin's internal compiler
uses its own declared Vite version. Update the Vitest pin deliberately with the
web toolchain when a separate upgrade is intended.

## Files and ownership

- Keep a component's styles next to it, normally `Component.css.ts`, and import
  its exported classes with `import * as styles from "./Component.css"`.
- Use `style()` for scoped classes and `className={styles.root}` in React.
  `components/PageHeader.css.ts` is the small working example.
- `styles/theme.css.ts` owns the shared color, radius, focus, and shadow tokens.
  Import `vars` and use, for example, `color: vars.indigo`. Add a token only for
  a real shared value. Keep unique one-off layout values next to the component.
- Keep `styles/global.css.ts` limited to reset, base typography, document/body,
  reduced-motion defaults, and app-shell layout. Add component rules to their
  own module rather than growing a catch-all global file.

Responsive rules belong in the same style's `@media` object. Keep existing
breakpoints unless the feature calls for a layout change. Use scoped
global descendant rules only for semantic descendants owned by that
component. Keep focus-visible and disabled states readable and preserve reduced
motion. Inline styles are for values that actually depend on runtime data, such
as chart geometry, rather than static visual declarations.

## Existing CSS and shared presentation

The app's component CSS was already colocated before this integration. Preserve
those files until a relevant change makes conversion useful; do not rewrite
unrelated components just to change syntax. New component styling uses `.css.ts`.
The global theme contract deliberately retains names such as `--indigo` and
`--focus`, so existing CSS and typed modules use identical values during this
incremental migration.

`components/SharedPresentation.css.ts` preserves the pre-existing shared panel,
message, eyebrow, and public-CTA selectors formerly in `styles.css`. It is an
explicit compatibility boundary for their current consumers and cascade, not
a place to add new global component classes. Move a shared rule into an owned
scoped module when its consumers are deliberately migrated. The entry point
loads document/shell globals followed by shared presentation after the app,
preserving the existing cascade. Page-header classes are already scoped.

Keep the current visual design, interactions, and semantic markup when converting
styles. Do not introduce themes, new palettes, layout redesigns, or abstraction
packages as incidental cleanup. The explicitly requested display preferences in
issue #73 add system/light/dark themes through shared semantic tokens; see
`DISPLAY_PREFERENCES.md`. Use foreground/background token pairs so all themes
retain readable controls, messages, charts, and focus states.

## Flow spacing and mobile controls

`styles/flow.css.ts` supplies `stack`: a vertical flow with the shared
`sectionGap` (20px). Use it for consecutive page panels and section blocks;
the container owns the gap and resets child margins, so optional content does
not make blocks touch or double their margins. `gutter` (24px) is available
for shared horizontal insets. Component-specific dense lists keep their own gaps.
The current-basho/player panels and My Stable use this flow.

At 640px and below the header keeps primary navigation visible and puts display
and account controls behind the **Site settings** burger. Escape returns focus
to its toggle. Desktop retains its inline controls. With portraits enabled,
shared rank badges overlay the portrait on mobile, using compact rank text and
retaining the full accessible rank and tooltip. Without portraits ranks stay inline.
Admin action feedback uses persistent, dismissible viewport toasts with the
existing status/alert roles, including while the action controls are offscreen.

## Validation

Run `make check` for TypeScript, lint, format, component tests, and production
CSS extraction. Run the relevant browser E2E suite for game-loop or broad style
changes. For responsive/layout or cascade changes, compare desktop and mobile
screenshots with agent-browser when available, including focus states and long
content. Visual inspection supplements E2E rather than replacing it.

References: [Vite integration](https://vanilla-extract.style/documentation/integrations/vite/),
[scoped styling](https://vanilla-extract.style/documentation/styling/), and
[stable global theme contracts](https://vanilla-extract.style/documentation/global-api/create-global-theme-contract/).
