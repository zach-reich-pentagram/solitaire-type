/* Solitaire Type — a typographic take on the Windows Solitaire win animation.
   Letters land in the top row and riffle down the screen, stamping a trail. */

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const stage = $('stage');
  const frame = $('frame');
  const view = $('canvas');
  const vctx = view.getContext('2d');
  const hint = $('hint');

  /* Ink layer: a transparent bitmap holding every stamp ever laid down.
     The visible canvas is just background fill + this layer, so changing
     the background never destroys the drawing. */
  const ink = document.createElement('canvas');
  const ictx = ink.getContext('2d');

  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const DEFAULTS = {
    ratio: '4:3',
    bg: '#008000',
    fg: '#ffffff',
    font: 'Arial Black',
    weight: '900',
    size: 140,
    uppercase: true,
    speed: 7,
    gravity: 0.6,
    bounce: 0.72,
    density: 5,
    outline: 5,
    spread: 0.45,
    drop: 0.3,
    bothWays: false
  };

  const S = Object.assign({}, DEFAULTS, loadSettings());

  const BUILTIN_FONTS = [
    'Arial Black',
    'Impact',
    'Helvetica Neue',
    'Arial',
    'Verdana',
    'Trebuchet MS',
    'Tahoma',
    'Georgia',
    'Times New Roman',
    'Palatino Linotype',
    'Courier New',
    'Consolas',
    'system-ui'
  ];

  const customFonts = [];

  /* ---------------- canvas sizing ---------------- */

  // width and height in CSS pixels — the coordinate space all physics uses
  let W = 0, H = 0;

  function parseRatio(raw) {
    const v = String(raw || '').trim().toLowerCase();
    if (!v || v === 'fill' || v === 'full' || v === 'auto') return null;
    const pair = v.match(/^(\d*\.?\d+)\s*[:\/x\s]\s*(\d*\.?\d+)$/);
    if (pair) {
      const a = parseFloat(pair[1]), b = parseFloat(pair[2]);
      if (a > 0 && b > 0) return a / b;
    }
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function layout() {
    const pad = 0; // stage already has padding
    const avail = stage.getBoundingClientRect();
    const maxW = Math.max(80, avail.width - 48 - pad);
    const maxH = Math.max(80, avail.height - 48 - pad);

    const ratio = parseRatio(S.ratio);
    let w, h;
    if (ratio === null) {
      w = maxW; h = maxH;
    } else if (maxW / maxH > ratio) {
      h = maxH; w = h * ratio;
    } else {
      w = maxW; h = w / ratio;
    }

    w = Math.round(w); h = Math.round(h);
    if (w === W && h === H) return;

    // keep whatever is already drawn, rescaled into the new box
    const prev = document.createElement('canvas');
    let hadInk = false;
    if (ink.width && ink.height) {
      prev.width = ink.width; prev.height = ink.height;
      prev.getContext('2d').drawImage(ink, 0, 0);
      hadInk = true;
    }

    // Rescale existing art uniformly and centre it, so changing the aspect
    // ratio reframes the drawing instead of distorting the letterforms.
    const k = W && H ? Math.min(w / W, h / H) : 1;
    const offX = W ? (w - W * k) / 2 : 0;
    const offY = H ? (h - H * k) / 2 : 0;

    W = w; H = h;
    frame.style.width = w + 'px';
    frame.style.height = h + 'px';

    for (const c of [view, ink]) {
      c.width = Math.round(w * DPR);
      c.height = Math.round(h * DPR);
    }
    view.style.width = w + 'px';
    view.style.height = h + 'px';

    vctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ictx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ictx.textBaseline = 'top';

    if (hadInk) {
      ictx.save();
      ictx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ictx.drawImage(prev, offX, offY, (prev.width / DPR) * k, (prev.height / DPR) * k);
      ictx.restore();
      ictx.textBaseline = 'top';
    }

    // keep live particles in step with the reframed canvas
    for (const p of particles) {
      p.x = p.x * k + offX;
      p.y = p.y * k + offY;
      p.size *= k;
      p.w *= k;
    }
    cursorX = cursorX * k + offX;

    render();
  }

  /* ---------------- typography ---------------- */

  function fontString(size) {
    const fam = S.font.includes(' ') || /[^\w-]/.test(S.font) ? `"${S.font}"` : S.font;
    return `${S.weight} ${size}px ${fam}, "Arial Black", Arial, sans-serif`;
  }

  function measure(ch, size) {
    ictx.font = fontString(size);
    return ictx.measureText(ch).width;
  }

  // Cap-height-ish fraction of the em box, used for floor collision so the
  // glyph visually rests on the bottom edge rather than its invisible descender.
  const GLYPH_H = 0.76;

  /* ---------------- particles ---------------- */

  const particles = [];
  const MAX_PARTICLES = 90;
  const MAX_STAMPS = 2600;

  let cursorX = 0;
  let rowFull = false;

  function topPad() { return Math.max(4, S.size * 0.05); }

  function spawn(chRaw) {
    if (!W || !H) return;
    const ch = S.uppercase ? chRaw.toUpperCase() : chRaw;
    const size = S.size;
    const w = measure(ch, size) || size * 0.5;
    const pad = topPad();

    let x;
    if (!rowFull && cursorX + w <= W - pad) {
      x = cursorX;
      cursorX += w;
      if (cursorX + w > W - pad) rowFull = true;
    } else {
      rowFull = true;
      x = pad + Math.random() * Math.max(1, W - w - pad * 2);
    }

    const scale = H / 720;                    // keep motion consistent across canvas sizes
    const dir = S.bothWays
      ? (Math.random() < 0.5 ? -1 : 1)
      : (x > W * 0.62 ? -1 : 1);
    const jitter = 1 + (Math.random() * 2 - 1) * S.spread;

    particles.push({
      ch,
      size,
      w,
      x,
      y: pad,
      vx: S.speed * scale * dir * Math.max(0.15, jitter),
      vy: S.speed * scale * S.drop * (0.6 + Math.random() * 0.8),
      travel: 0,
      stamps: 1
    });

    stamp(particles[particles.length - 1]);   // the letter appears the instant it's typed

    if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);

    hint.classList.add('gone');
  }

  function advanceCursor(w) {
    if (rowFull) return;
    cursorX += w;
    if (cursorX > W - topPad()) rowFull = true;
  }

  const SUBSTEPS = 8; // physics resolution, independent of how often we stamp

  function step(dt) {
    if (!particles.length) return false;

    const scale = H / 720;
    const g = S.gravity * scale;
    const inv = dt / SUBSTEPS;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const floor = H - p.size * GLYPH_H;
      // Distance between stamps, so the trail spacing depends on density
      // rather than on how fast the letter happens to be travelling.
      const gap = Math.max(1.5, p.size * 1.5 / S.density);

      for (let s = 0; s < SUBSTEPS; s++) {
        p.vy += g * inv;
        const dx = p.vx * inv;
        const dy = p.vy * inv;
        p.x += dx;
        p.y += dy;

        if (p.y >= floor && p.vy > 0) {
          p.y = floor;
          p.vy = -p.vy * S.bounce;
          // stop micro-bouncing: let it skate along the floor instead
          if (Math.abs(p.vy) < 0.4 * scale) p.vy = 0;
        }

        p.travel += Math.hypot(dx, dy);
        if (p.travel >= gap) {
          p.travel = 0;
          stamp(p);
          if (++p.stamps > MAX_STAMPS) break;
        }
      }

      if (
        p.stamps > MAX_STAMPS ||
        p.x > W + p.w * 0.6 ||
        p.x < -p.w * 1.6 ||
        p.y > H + p.size * 2
      ) {
        particles.splice(i, 1);
      }
    }

    return true;
  }

  /* Each stamp first erases a halo along its own outline, then fills. On a
     transparent ink layer that reads as a background-coloured edge, which is
     what keeps overlapping stamps legible instead of merging into one blob —
     the same trick the original animation gets for free from card borders.
     Erasing (rather than stroking in the background colour) keeps the ink
     layer a pure alpha mask, so the text colour stays changeable. */
  function stamp(p) {
    ictx.font = fontString(p.size);

    const lw = S.outline * (p.size / 160);
    if (lw > 0.15) {
      ictx.globalCompositeOperation = 'destination-out';
      ictx.lineWidth = lw * 2;
      ictx.lineJoin = 'round';
      ictx.strokeStyle = '#000';
      ictx.strokeText(p.ch, p.x, p.y);
      ictx.globalCompositeOperation = 'source-over';
    }

    ictx.fillStyle = S.fg;
    ictx.fillText(p.ch, p.x, p.y);
  }

  /* ---------------- render loop ---------------- */

  function render() {
    vctx.fillStyle = S.bg;
    vctx.fillRect(0, 0, W, H);
    vctx.drawImage(ink, 0, 0, W, H);
  }

  let last = performance.now();

  function tick(now) {
    const dt = Math.min(3, Math.max(0.15, (now - last) / 16.667));
    last = now;
    if (step(dt)) render();
    requestAnimationFrame(tick);
  }

  /* ---------------- ink recolour / clear ---------------- */

  // Repaint every existing stamp in the new text colour, preserving its alpha.
  function recolourInk(color) {
    ictx.save();
    ictx.setTransform(1, 0, 0, 1, 0, 0);
    ictx.globalCompositeOperation = 'source-in';
    ictx.fillStyle = color;
    ictx.fillRect(0, 0, ink.width, ink.height);
    ictx.restore();
    render();
  }

  function clearCanvas() {
    particles.length = 0;
    ictx.save();
    ictx.setTransform(1, 0, 0, 1, 0, 0);
    ictx.clearRect(0, 0, ink.width, ink.height);
    ictx.restore();
    cursorX = 0;
    rowFull = false;
    hint.classList.remove('gone');
    render();
  }

  /* ---------------- settings persistence ---------------- */

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem('solitaire-type') || '{}');
    } catch {
      return {};
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem('solitaire-type', JSON.stringify(S));
    } catch { /* private mode, ignore */ }
  }

  /* ---------------- controls ---------------- */

  const ui = {
    ratio: $('ratio'),
    ratioPreset: $('ratioPreset'),
    bg: $('bg'), bgHex: $('bgHex'),
    fg: $('fg'), fgHex: $('fgHex'),
    fontSelect: $('fontSelect'),
    fontFile: $('fontFile'),
    weight: $('weight'),
    size: $('size'),
    uppercase: $('uppercase'),
    speed: $('speed'),
    gravity: $('gravity'),
    bounce: $('bounce'),
    density: $('density'),
    spread: $('spread'),
    drop: $('drop'),
    outline: $('outline'),
    bothWays: $('bothWays')
  };

  function out(el) {
    const o = el.parentElement.querySelector('output');
    if (!o) return;
    const dp = parseFloat(el.step) < 1 ? 2 : 0;
    o.textContent = parseFloat(el.value).toFixed(el.id === 'speed' ? 1 : dp);
  }

  function buildFontList() {
    ui.fontSelect.innerHTML = '';
    const add = (name, label) => {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = label || name;
      ui.fontSelect.appendChild(o);
    };
    for (const f of BUILTIN_FONTS) add(f);
    if (customFonts.length) {
      const grp = document.createElement('optgroup');
      grp.label = 'Uploaded';
      ui.fontSelect.appendChild(grp);
      for (const f of customFonts) {
        const o = document.createElement('option');
        o.value = f;
        o.textContent = f;
        grp.appendChild(o);
      }
    }
    ui.fontSelect.value = S.font;
    if (!ui.fontSelect.value) {
      add(S.font);
      ui.fontSelect.value = S.font;
    }
  }

  function isHex(v) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()); }

  function syncUI() {
    ui.ratio.value = S.ratio;
    ui.bg.value = S.bg; ui.bgHex.value = S.bg;
    ui.fg.value = S.fg; ui.fgHex.value = S.fg;
    ui.weight.value = S.weight;
    ui.uppercase.checked = S.uppercase;
    ui.bothWays.checked = S.bothWays;
    for (const key of ['size', 'speed', 'gravity', 'bounce', 'density', 'spread', 'drop', 'outline']) {
      ui[key].value = S[key];
      out(ui[key]);
    }
    buildFontList();
  }

  function bindRange(key) {
    ui[key].addEventListener('input', () => {
      S[key] = parseFloat(ui[key].value);
      out(ui[key]);
      saveSettings();
    });
  }

  ['size', 'speed', 'gravity', 'bounce', 'density', 'spread', 'drop', 'outline'].forEach(bindRange);

  ui.ratio.addEventListener('change', () => {
    S.ratio = ui.ratio.value.trim() || 'fill';
    ui.ratio.value = S.ratio;
    saveSettings();
    layout();
  });

  ui.ratioPreset.addEventListener('change', () => {
    if (!ui.ratioPreset.value) return;
    S.ratio = ui.ratioPreset.value;
    ui.ratio.value = S.ratio;
    ui.ratioPreset.value = '';
    saveSettings();
    layout();
  });

  ui.bg.addEventListener('input', () => {
    S.bg = ui.bg.value;
    ui.bgHex.value = S.bg;
    saveSettings();
    render();
  });

  ui.bgHex.addEventListener('change', () => {
    if (!isHex(ui.bgHex.value)) { ui.bgHex.value = S.bg; return; }
    S.bg = ui.bgHex.value.trim().toLowerCase();
    ui.bg.value = S.bg;
    saveSettings();
    render();
  });

  ui.fg.addEventListener('input', () => {
    S.fg = ui.fg.value;
    ui.fgHex.value = S.fg;
    saveSettings();
    recolourInk(S.fg);
  });

  ui.fgHex.addEventListener('change', () => {
    if (!isHex(ui.fgHex.value)) { ui.fgHex.value = S.fg; return; }
    S.fg = ui.fgHex.value.trim().toLowerCase();
    ui.fg.value = S.fg;
    saveSettings();
    recolourInk(S.fg);
  });

  ui.fontSelect.addEventListener('change', () => {
    S.font = ui.fontSelect.value;
    saveSettings();
  });

  ui.weight.addEventListener('change', () => {
    S.weight = ui.weight.value;
    saveSettings();
  });

  ui.uppercase.addEventListener('change', () => {
    S.uppercase = ui.uppercase.checked;
    saveSettings();
  });

  ui.bothWays.addEventListener('change', () => {
    S.bothWays = ui.bothWays.checked;
    saveSettings();
  });

  ui.fontFile.addEventListener('change', async () => {
    const files = Array.from(ui.fontFile.files || []);
    for (const file of files) {
      const family = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Custom';
      try {
        const face = new FontFace(family, await file.arrayBuffer());
        await face.load();
        document.fonts.add(face);
        if (!customFonts.includes(family)) customFonts.push(family);
        S.font = family;
        S.weight = '400';        // uploaded faces rarely ship a synthetic black
        ui.weight.value = '400';
        buildFontList();
        saveSettings();
      } catch (err) {
        alert(`Could not load "${file.name}" — it may not be a valid font file.`);
      }
    }
    ui.fontFile.value = '';
  });

  /* ---------------- actions ---------------- */

  $('clear').addEventListener('click', clearCanvas);

  $('reset').addEventListener('click', () => {
    Object.assign(S, DEFAULTS);
    saveSettings();
    syncUI();
    layout();
    render();
  });

  $('save').addEventListener('click', () => {
    const out = document.createElement('canvas');
    out.width = ink.width;
    out.height = ink.height;
    const c = out.getContext('2d');
    c.fillStyle = S.bg;
    c.fillRect(0, 0, out.width, out.height);
    c.drawImage(ink, 0, 0);
    const a = document.createElement('a');
    a.download = 'solitaire-type.png';
    a.href = out.toDataURL('image/png');
    a.click();
  });

  const demoBtn = $('demo');
  const DEMO_TEXT = 'YEAH SOLITAIRE FOREVER ';
  let demoTimer = null;
  let demoIndex = 0;

  demoBtn.addEventListener('click', () => {
    if (demoTimer) {
      clearInterval(demoTimer);
      demoTimer = null;
      demoBtn.classList.remove('on');
      return;
    }
    demoBtn.classList.add('on');
    demoTimer = setInterval(() => {
      const ch = DEMO_TEXT[demoIndex++ % DEMO_TEXT.length];
      if (ch === ' ') advanceCursor(measure(' ', S.size) || S.size * 0.3);
      else spawn(ch);
    }, 190);
  });

  /* ---------------- panel ---------------- */

  const toggle = $('panelToggle');

  function setPanel(open) {
    document.body.classList.toggle('panel-hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
    requestAnimationFrame(() => setTimeout(layout, 240));
  }

  toggle.addEventListener('click', () => {
    setPanel(document.body.classList.contains('panel-hidden'));
  });

  /* ---------------- keyboard ---------------- */

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'Tab' && !isTypingTarget(e.target)) {
      e.preventDefault();
      setPanel(document.body.classList.contains('panel-hidden'));
      return;
    }

    if (isTypingTarget(e.target)) return;

    if (e.key === 'Escape') { clearCanvas(); return; }

    if (e.key === 'Enter') {
      e.preventDefault();
      cursorX = 0;
      rowFull = false;
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      advanceCursor(measure(' ', S.size) || S.size * 0.3);
      return;
    }

    // any single printable character
    if (e.key.length === 1) {
      e.preventDefault();
      spawn(e.key);
    }
  });

  // touch devices have no keyboard here — tapping the canvas drops a letter
  view.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    spawn(letters[Math.floor(Math.random() * letters.length)]);
  });

  /* ---------------- boot ---------------- */

  syncUI();
  new ResizeObserver(layout).observe(stage);
  layout();

  document.fonts.ready.then(render);
  requestAnimationFrame((t) => { last = t; tick(t); });
})();
