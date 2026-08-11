# JIVESHOOTER Galaga-style build

This version keeps the visual language of the original JIVESHOOTER bookmarklet and replaces the random enemy flow with formation-based arcade logic.

## Files

- `index.html`
- `style.css`
- `game.js`

## Existing JIVESHOOTER graphics used

The page loads the same externally hosted player ship, JIVESHOOTER logo and level overlay used by the bookmarklet:

- `https://i.postimg.cc/T2sMCYPC/spaceship.png`
- `https://i.postimg.cc/7h9pMnYV/JIVESHOOTER.png`
- `https://i.postimg.cc/Bb0wrNCk/new.png`

## Gameplay

- Enemy squadrons enter in curved formations.
- The formation sweeps left and right.
- Enemies periodically dive out of formation and attack the player.
- Diving enemies fire aimed shots.
- Formation enemies also fire.
- The player can have two shots active at once.
- Boss enemies take two hits.
- Clear all enemies to start the next wave.
- Difficulty rises per wave.
- Five lives.

## Controls

- Left / Right or A / D: move
- Space: fire
- P: pause
- R: restart
- Mouse / touch: move and fire

## GitHub Pages

1. Put all three main files in the root of a GitHub repository.
2. Open repository Settings.
3. Open Pages.
4. Set deployment to the branch containing these files and choose `/root`.
5. Open the Pages URL after GitHub publishes it.

No build step or package manager is required.

## Note

The formation gameplay is a fresh implementation based on the behavior requested. It does not require any code or image assets from the referenced Galaga5 repository.

## V2 gameplay and performance changes

- Enemies are around half the previous visual size.
- Enemies now remain crisp separate neon craft instead of being represented only by WebGL glow.
- Bloom radius and white core intensity are reduced strongly.
- WebGL blur drops from 64 texture reads per pixel to 9 taps.
- Glow buffer resolution is reduced from 36% to 24% of display resolution.
- Enemy formation moves as one synchronized block.
- Entry is grouped in four ship squads and happens much faster.
- Dive attacks alternate left and right and launch 2 to 4 enemies as synchronized squads.
- Dive and return curves are faster.
- Star count and active glow point count are reduced for smoother animation.
