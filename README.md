# Maths Quest for Everyone

A private, offline-capable maths practice app for learners from 1st to 6th Class, aligned to the Irish Primary Mathematics Curriculum.

## Included

- On-device learner profiles with nine illustrated avatar choices
- Class-specific starting plans for 1st–6th Class
- Per-profile topic plans plus focused Learn and Practise topic selection
- Progressive tips for every generated question
- Question-scoped grid-paper scratchpad with progressive help, pencil and eraser tools
- Individual Beat Quest times-tables practice with class-aware defaults
- Personal Quest World with three destinations, animated round journeys and nine collectible decorations
- Number Trail and Share the Treasure mini-games with class-based number ranges, visual feedback and optional tips
- Parent-gated learner, progress and play controls
- Automatic account saving and completed-quest history
- Optional parent accounts for saving across devices (requires Supabase setup)
- Installable PWA and offline app shell

Guest play needs no account and keeps progress on the device. Optional parent
accounts can privately save profiles, preferences, photos and completed results
using Supabase. Google sign-in is configured; Apple is deferred. Signed-in
verification remains required before releasing the draft integration. See
[setup instructions](supabase/SETUP.md).

There is no advertising or multiplayer ranking. Cookie-free analytics count
anonymous activity events; learner information is not sent to analytics.

Run the checks with `node --test tests/*.test.cjs`.
# Cloud Crossing

The learner home groups activities into Play games (Quest World, Cloud Crossing, Beat Quest) and Practise maths (Learn, Practise, Challenge). Quest World opens its destination choices, collection and mini-games in a separate panel.

Cloud Crossing opens with a closer bridge view. Drag with a mouse or one finger to rotate and tilt, pinch with two fingers or scroll to zoom, or use the on-screen rotate/zoom/reset buttons. Movement is bounded, and dragging or pinching never removes a bridge piece.

Quest World includes a touch-friendly Three.js bridge-building prototype. Three crossings use addition (1st–2nd), equal groups (3rd–4th), or quarter-unit fractions (5th–6th). Completing all three earns a world decoration and saves a completed result. Closing early does not award progress.

The scene is generated locally from geometric clay-style models and a procedural surface texture. Three.js 0.180.0 is bundled under `vendor/` with its MIT licence; no third-party asset requests are needed. The service worker caches the scene for offline use. Motion is reduced when requested by the device, audio follows the app setting, and resources are released when the scene closes. Devices without WebGL receive a message and can continue using the other games.

Check bridge rules with `deno test --allow-read tests/island.test.mjs`. Physical iPad performance and child play-testing remain necessary before expanding this prototype into a larger world.
