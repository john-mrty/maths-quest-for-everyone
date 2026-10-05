# Maths Quest for Everyone

A private, offline-capable maths practice app for learners from 1st to 6th Class, aligned to the Irish Primary Mathematics Curriculum.

## Included

- On-device learner profiles with nine illustrated avatar choices
- Class-specific starting plans for 1st–6th Class
- Practise, Explore and Later topic selection
- Progressive tips for every generated question
- Question-scoped grid-paper scratchpad with progressive help, pencil and eraser tools
- Individual Beat Quest times-tables practice
- Parent-gated learner, progress and play controls
- Local progress export and import, plus completed-quest history
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
