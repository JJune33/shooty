# JIVESHOOTER V4 GLOW SYNC

This build deliberately uses unique asset filenames so GitHub Pages/browser cache cannot silently reuse V2/V3 JavaScript.

Files loaded by index.html:
- style-v4-20260811.css
- game-v4-20260811.js

Visible runtime marker: `V4-GLOW-SYNC-20260811`

Gameplay changes:
- 10 enemies total, 2 rows of 5
- original strong colored shader glow retained
- no enemy icon drawing when WebGL is active
- synchronized formation sweep and grouped entry
- one diver per attack in early waves, maximum two later
- sparse enemy bullets
- optimized 9-tap feedback blur for performance
