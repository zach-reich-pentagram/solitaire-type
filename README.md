# Solitaire Type

A typographic take on the Windows Solitaire winning animation. Type anywhere on the
page: each letter lands in the top row and riffles down the canvas, bouncing off the
floor and stamping a trail behind it until it runs off screen.

Zero dependencies, zero build step — three static files.

## Use it

Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Controls

**Canvas**
- **Aspect ratio** — `16:9`, `4/3`, a bare number like `1.777`, or `fill` for the whole window.
- **Background / Text / Outline** — colour picker or hex field for each. All three apply
  retroactively: recolouring text or outlines repaints everything already on screen, and
  changing the background never erases the drawing. Outline defaults to **Match background**
  (the classic look, where the edge reads as a gap); untick it to pick any colour, e.g. a
  keyline in a third colour.

**Type**
- **Typeface** — a list of system faces, plus anything you upload.
- **Upload custom typeface** — TTF / OTF / WOFF / WOFF2, loaded straight into the page.
  Nothing is uploaded anywhere; the font never leaves your browser.
- **Weight**, **Letter size**, **Force uppercase**.

**Physics**
- **Speed** — playback rate. It scales time uniformly, so trajectories keep their shape;
  only how fast they play changes.
- **Horizontal reach** — how far sideways a letter travels on its way down, as a fraction of
  the canvas width. `0` drops letters straight down in columns, `0.5` crosses half the canvas
  during the fall, `1` reaches the far edge just as it lands, and above that it exits the side
  before touching the floor. Reach is measured against the fall, so it holds at any speed.
- **Gravity** — how hard letters are pulled down.
- **Bounce** — energy kept on each floor hit (1 = never settles).
- **Riffle density** — how many stamps per letter-length of travel; low is a loose trail, high is a solid ribbon.
- **Edge outline** — width of the outline drawn around each stamp. This is what keeps overlapping
  letters legible; set it to 0 for solid merged shapes.
- **Launch spread** — how much the reach varies letter to letter (`0` makes every trail identical).
- **Initial drop** — how much downward push a letter starts with.
- **Random launch direction** — off, letters fan away from the nearest edge; on, they pick a side at random.

**Actions** — Clear canvas, auto‑type demo, save a PNG, reset settings to defaults.

**Keyboard**

| Key | Action |
| --- | --- |
| any letter/number/symbol | drop it into the top row |
| <kbd>Space</kbd> | advance the top-row cursor without drawing |
| <kbd>Enter</kbd> | send the cursor back to the left edge |
| <kbd>Esc</kbd> | clear the canvas |
| <kbd>Tab</kbd> | show/hide the control panel |

Letters fill the top row left to right. Once the row is full, they start appearing at
random positions along the top instead.

Settings persist in `localStorage`. Uploaded fonts do not — re-upload them after a reload.

## Deploy

Static site, nothing to build.

```bash
npx vercel --prod
```

Or connect the repo in the Vercel dashboard: framework preset **Other**, no build
command, output directory `./`. Then add your domain under Project → Settings → Domains.
