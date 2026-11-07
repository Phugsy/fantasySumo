# Owner UAT and reported regressions

Automated verification and owner acceptance are separate evidence. A passing
asset/API smoke check does not prove that a feature works on every screen, and
an emulated mobile browser does not exercise an iPhone's software keyboard.

## Review loop for browser changes

1. Turn each report into an observable acceptance case before implementation.
   Add a regression at the failing screen/API boundary, including ordinary and
   owner/admin accounts where permissions differ.
2. Run `make check`, relevant browser E2E, a visual pass and dedicated review.
3. Open a ready PR. Wait for its migration-gated preview to finish, then provide
   the exact preview URL and commit, the fixture/account/role to use, and a
   short numbered test card. State any scenario that is not available there.
   For owner UAT use https://fantasy-sumo-uat-phuggo.vercel.app, with the
   repository `UAT_BRANCH` variable selecting the PR branch. Its exact origin
   must be trusted by the Preview Neon Auth branch. Verify real sign-in on that
   address before calling the preview ready; see [fixed UAT setup](DEPLOYMENT.md#fixed-address-for-owner-uat).
4. Use test accounts and isolated data. The reusable environment is described in
   [Shared Demo Playtests](PLAYTEST.md); the external setup remains tracked in
   #91. Ordinary previews must not be treated as disposable until their database
   and auth targets have been verified. Do not reset production for UAT.
5. The owner tests the actual workflow on desktop and Chrome on iOS, including
   opening/dismissing the keyboard. Record the URL/commit, browser/device and
   pass/fail per case. An artwork review alone is not game-loop acceptance.
6. Fix failures and repeat the affected cases on the new preview commit. Release
   this feedback batch only after explicit owner acceptance, through the normal
   Production workflow. Recheck the live API/UI at that exact release SHA.

The mobile input fix observes the visual viewport rather than assuming that
opening a keyboard resizes the page's layout viewport. See the
[VisualViewport API](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).
Physical-device UAT is still required for that scenario.

## 7 November feedback acceptance card

| Report                 | Required observable result                                                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portrait switch        | Hidden / Photos / Ink illustrations immediately changes picks, My Stable and expanded leaderboard rikishi; reload preserves it and credits match.                                                                                                         |
| Empty joker choices    | Only the current Japan day's window is selectable. Published owned bouts populate choices; missing schedules and no eligible owned bouts have distinct explanations. Manual import and independent scheduled retry recover missing cards.                 |
| Close picks            | Lock picks without starting scoring. Team saves fail while locked.                                                                                                                                                                                        |
| Undo start             | Before any stored result or day progress, return active → locked while retaining picks, rules and joker allocations. Reject after progress/results and serialize with imports. Reopening picks remains a separate deliberate action.                      |
| Owner scoring override | A separate owner permission can explicitly change the official mode and rescore the whole basho, including existing results, joker bonuses, history and cumulative standings. Ordinary admins remain locked; record actor, reason, old/new mode and time. |
| Select arrows          | Arrow has a readable inset in all app select controls, both themes and narrow screens, with native accessibility retained.                                                                                                                                |
| iOS keyboard           | Focus and type in Team name with the real keyboard open; the field remains visible and header behaviour returns after blur.                                                                                                                               |
| Team owners            | Public owner display name appears under team names on tournament and all-time boards; account IDs and email addresses are not exposed. Unknown historical owners are labelled honestly.                                                                   |

Current baseline observations: production has November schedule days 1 and 2;
the observed lifecycle is active at day 0. UI reports must distinguish the
current Japan date, stored schedule publication and verified scoring progress.
