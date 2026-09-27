(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const LINE_WIDTH = 14;                // thick black grid lines
  const MIN_BOX_SIZE = 300;              // minimum size to consider splitting
  const PALETTE = ['#E12B2B','#FFCD00','#184FA3','#FFFFFF']; // red, yellow, blue, white
  const ANIMATION_TIME = 420;           // ms to draw each splitting line
  const STEP_DELAY = 380;               // ms between splits

  let rectangles = [];
  let lines = []; // finished split lines
  let currentLine = null; // animating line
  let paused = false;

  function fitDpi() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    console.log(`Set canvas size to ${canvas.width}x${canvas.height} (dpr=${dpr})`);
  }

  function clear() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
  }

  function render(progress) {
    // redraw everything; progress optionally controls drawing of an animating line
    clear();

    // fill background white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // draw filled rectangles
    for (const r of rectangles) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.fillStyle = r.color || '#ffffff';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }

    // draw finished lines
    ctx.fillStyle = '#111111';
    for (const L of lines) {
      ctx.fillRect(L.x, L.y, L.w, L.h);
    }

    // draw currently animating line partially
    if (currentLine) {
      ctx.fillStyle = '#111111';
      const L = currentLine;
      if (L.orientation === 'vertical') {
        // animate height coverage from top to bottom
        const fullH = L.h;
        const cover = Math.max(2, Math.round(fullH * Math.min(1, progress || 0)));
        ctx.fillRect(L.x, L.y, L.w, cover);
      } else {
        const fullW = L.w;
        const cover = Math.max(2, Math.round(fullW * Math.min(1, progress || 0)));
        ctx.fillRect(L.x, L.y, cover, L.h);
      }
    }

    // draw thin outlining strokes for visual crispness
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = '#111111';
    for (const r of rectangles) {
      ctx.strokeRect(Math.round(r.x)+0.5, Math.round(r.y)+0.5, Math.round(r.w), Math.round(r.h));
    }
  }

  function randomBetween(a,b) { return a + Math.random()*(b-a); }

  // Choose a rectangle eligible for splitting in the requested orientation
  function chooseRectToSplit(orientation) {
    const candidates = rectangles.filter(r => {
      if (orientation === 'vertical') return r.w > (MIN_BOX_SIZE + LINE_WIDTH*2);
      return r.h > (MIN_BOX_SIZE + LINE_WIDTH*2);
    });
    console.log(`candidates for ${orientation} split: ${candidates.length}`);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random()*candidates.length)];
  }

  function splitRectangle(rect, orientation) {
    // pick split coordinate inside rect with safe margins
    if (orientation === 'vertical') {
      const minX = rect.x + Math.max(LINE_WIDTH*2, rect.w*0.2);
      const maxX = rect.x + Math.min(rect.w - LINE_WIDTH*2, rect.w*0.8);
      const splitX = randomBetween(minX, maxX);
      const left = { x: rect.x, y: rect.y, w: splitX - rect.x, h: rect.h, color: rect.color };
      const right = { x: splitX, y: rect.y, w: rect.x + rect.w - splitX, h: rect.h, color: rect.color };

      const line = {
        orientation: 'vertical',
        x: splitX - (LINE_WIDTH/2),
        y: rect.y,
        w: LINE_WIDTH,
        h: rect.h
      };
      return { left, right, line };
    } else {
      const minY = rect.y + Math.max(LINE_WIDTH*2, rect.h*0.2);
      const maxY = rect.y + Math.min(rect.h - LINE_WIDTH*2, rect.h*0.8);
      const splitY = randomBetween(minY, maxY);
      const top = { x: rect.x, y: rect.y, w: rect.w, h: splitY - rect.y, color: rect.color };
      const bottom = { x: rect.x, y: splitY, w: rect.w, h: rect.y + rect.h - splitY, color: rect.color };

      const line = {
        orientation: 'horizontal',
        x: rect.x,
        y: splitY - (LINE_WIDTH/2),
        w: rect.w,
        h: LINE_WIDTH
      };
      return { top, bottom, line };
    }
  }

  // Execute one split step; orientation is forced to be orthogonal to last
  async function doSplit(orientation) {
    const target = chooseRectToSplit(orientation);
    if (!target) return false;

    const { left, right, line, top, bottom } = (orientation === 'vertical') ?
      (splitRectangle(target, 'vertical')) : splitRectangle(target, 'horizontal');

    // prepare animating line
    currentLine = line;

    // animate the line drawing
    await animateCurrentLine(ANIMATION_TIME);

    // finish the split: remove target rect and add new rects
    const idx = rectangles.indexOf(target);
    if (idx !== -1) rectangles.splice(idx, 1);

    if (orientation === 'vertical') {
      rectangles.push(left, right);
    } else {
      rectangles.push(top, bottom);
    }

    // commit the line as finished
    lines.push(line);
    currentLine = null;

    // pick one side and color it (avoid white sometimes)
    const newRects = orientation === 'vertical' ? [left, right] : [top, bottom];
    const chosen = newRects[Math.floor(Math.random()*newRects.length)];
    const existingColor = target && target.color ? target.color : null;
    // consider only primary (non-white) colors, and exclude the existing color so the new color differs
    const primaryColors = PALETTE;
    const candidates = primaryColors.filter(c => c !== existingColor);
    if (candidates.length === 0) {
        // fallback: pick a primary color different from existingColor by rotating the palette
        const idx = Math.max(0, primaryColors.indexOf(existingColor));
        const alt = primaryColors[(idx + 1) % primaryColors.length] || primaryColors[0];
    chosen.color = alt;
    } else {
        chosen.color = candidates[Math.floor(Math.random()*candidates.length)];
    }

    // make sure the other side stays either its previous color or white
    return true;
  }

  function animateCurrentLine(duration) {
    return new Promise(resolve => {
      const start = performance.now();
      function step(now) {
        if (!currentLine) return resolve();
        const t = Math.min(1, (now-start)/duration);
        render(t);
        if (t < 1 && !paused) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  // main incremental loop: ensure each new split is orthogonal to the previous one
  let firstOrientation = Math.random() < 0.5 ? 'vertical' : 'horizontal';
  let lastOrientation = null;
  async function runSteps() {
    while (true) {
      if (paused) { await new Promise(res => setTimeout(res, 150)); continue; }
      // choose the orientation that is orthogonal to the last line drawn;
      // for the very first step use `firstOrientation`.
      const orientation = lastOrientation ? (lastOrientation === 'vertical' ? 'horizontal' : 'vertical') : firstOrientation;
      const ok = await doSplit(orientation);
      render(1);
      if (!ok) break; // no more splits possible in the required orthogonal orientation
      lastOrientation = orientation;
      // small delay before next split
      await new Promise(res => setTimeout(res, STEP_DELAY));
    }
  }

  function startDemo() {
    // reset state
    rectangles = [{ x: 0, y: 0, w: canvas.width / (window.devicePixelRatio || 1), h: canvas.height / (window.devicePixelRatio || 1), color: '#ffffff' }];
    lines = [];
    currentLine = null;
    // reset orientation tracking: pick a random first orientation and clear the last
    firstOrientation = Math.random() < 0.5 ? 'vertical' : 'horizontal';
    lastOrientation = null;

    render(0);
    // run splits asynchronously
    runSteps();
  }

  // Controls
  document.getElementById('restart').addEventListener('click', () => {
    paused = false;
    startDemo();
  });
  const pauseBtn = document.getElementById('pause');
  pauseBtn.addEventListener('click', () => {
    paused = !paused; pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  });

  function resizeAndStart() {
    // give canvas a comfortable CSS size
    const cssW = Math.min(window.innerWidth * 0.92, 1100);
    const cssH = Math.min(window.innerHeight * 0.84, 700);
    canvas.style.width = Math.round(cssW) + 'px';
    canvas.style.height = Math.round(cssH) + 'px';
    fitDpi();
    startDemo();
  }

  window.addEventListener('resize', () => {
    fitDpi(); render(1);
  });

  // initial start
  resizeAndStart();

})();
