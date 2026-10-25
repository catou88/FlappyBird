// Flappy Bat — a Halloween Flappy Bird.
// All game math uses a fixed 360x640 world; the canvas is scaled to fit.
(() => {
  "use strict";

  const W = 360;
  const H = 640;
  const GROUND = 84; // height of the graveyard strip at the bottom

  const CONFIG = {
    gravity: 1500,      // px/s^2
    flap: -430,         // px/s, upward kick per flap
    maxFall: 620,
    pillarWidth: 66,
    gap: 168,           // vertical opening between pillars
    spacing: 210,       // horizontal distance between pillar pairs
    speed: 150,         // starting scroll speed
    maxSpeed: 230,
    speedPerPoint: 3,   // speed-up per point scored
    batRadius: 15,
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const ui = {
    hud: $("hud"), score: $("score"),
    start: $("startScreen"), over: $("overScreen"), pause: $("pauseScreen"),
    startBtn: $("startBtn"), retryBtn: $("retryBtn"),
    pauseBtn: $("pauseBtn"), resumeBtn: $("resumeBtn"),
    bestStart: $("bestStart"), bestOver: $("bestOver"),
    finalScore: $("finalScore"), newBest: $("newBest"),
  };

  // ---------- best score (localStorage may be blocked) ----------
  const BEST_KEY = "flappy-bat-best";
  function loadBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* ignore */ }
  }

  // ---------- canvas sizing ----------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  window.addEventListener("resize", resize);

  // ---------- scenery (generated once) ----------
  const rand = mulberry32(31);
  const stars = Array.from({ length: 60 }, () => ({
    x: rand() * W, y: rand() * (H * 0.55), r: rand() * 1.3 + 0.3, t: rand() * 6,
  }));
  const fog = Array.from({ length: 5 }, (_, i) => ({
    x: rand() * W, y: H - GROUND - 30 - rand() * 60, w: 160 + rand() * 120, s: 8 + i * 4,
  }));

  // ---------- state ----------
  const state = {
    mode: "ready", // ready | playing | dying | over | paused
    bat: null,
    pillars: [],
    score: 0,
    best: loadBest(),
    speed: CONFIG.speed,
    scroll: 0,      // total world scroll, for parallax
    time: 0,
    shake: 0,
    particles: [],
  };

  function reset() {
    state.bat = { x: 92, y: H * 0.42, vy: 0, wing: 0, angle: 0 };
    state.pillars = [];
    state.score = 0;
    state.speed = CONFIG.speed;
    state.particles = [];
    state.shake = 0;
    ui.score.textContent = "0";
  }

  function spawnPillar(x) {
    const minTop = 70;
    const maxTop = H - GROUND - CONFIG.gap - 70;
    const top = minTop + Math.random() * (maxTop - minTop);
    state.pillars.push({ x, top, passed: false });
  }

  // ---------- flow ----------
  function startGame() {
    reset();
    state.mode = "playing";
    spawnPillar(W + 60);
    show(ui.start, false); show(ui.over, false); show(ui.pause, false);
    show(ui.hud, true); show(ui.pauseBtn, true);
    flap();
  }

  function flap() {
    if (state.mode !== "playing") return;
    state.bat.vy = CONFIG.flap;
    state.bat.wing = 1;
    sound.flap();
    for (let i = 0; i < 4; i++) {
      state.particles.push({
        x: state.bat.x - 10, y: state.bat.y + 6,
        vx: -40 - Math.random() * 60, vy: 20 + Math.random() * 60,
        life: 0.5, max: 0.5, color: "rgba(155,229,100,", r: 2 + Math.random() * 2,
      });
    }
  }

  function die() {
    if (state.mode !== "playing") return;
    state.mode = "dying";
    state.shake = 0.35;
    sound.hit();
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 180;
      state.particles.push({
        x: state.bat.x, y: state.bat.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.8, max: 0.8, color: "rgba(255,122,26,", r: 2 + Math.random() * 3,
      });
    }
    show(ui.pauseBtn, false);
  }

  function gameOver() {
    state.mode = "over";
    const isNew = state.score > state.best;
    if (isNew) { state.best = state.score; saveBest(state.best); }
    ui.finalScore.textContent = state.score;
    ui.bestOver.textContent = state.best;
    ui.bestStart.textContent = state.best;
    show(ui.newBest, isNew && state.score > 0);
    show(ui.hud, false);
    show(ui.over, true);
    ui.retryBtn.focus({ preventScroll: true });
  }

  function togglePause() {
    if (state.mode === "playing") {
      state.mode = "paused";
      show(ui.pause, true);
      ui.resumeBtn.focus({ preventScroll: true });
    } else if (state.mode === "paused") {
      state.mode = "playing";
      show(ui.pause, false);
      last = performance.now();
    }
  }

  function show(el, on) { el.hidden = !on; }

  // ---------- input ----------
  function primaryAction() {
    if (state.mode === "ready") startGame();
    else if (state.mode === "playing") flap();
    else if (state.mode === "over") startGame();
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      if (e.repeat) return;
      if (state.mode === "paused") togglePause();
      else primaryAction();
    } else if (e.code === "KeyP" || e.code === "Escape") {
      togglePause();
    }
  });
  canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); primaryAction(); });
  // Clicking the overlay background (not its buttons) also flaps / restarts.
  for (const scr of [ui.start, ui.over]) {
    scr.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      primaryAction();
    });
  }
  ui.startBtn.addEventListener("click", startGame);
  ui.retryBtn.addEventListener("click", startGame);
  ui.pauseBtn.addEventListener("click", togglePause);
  ui.resumeBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.mode === "playing") togglePause();
  });

  // ---------- update ----------
  function update(dt) {
    state.time += dt;
    const bat = state.bat;
    const moving = state.mode === "ready" || state.mode === "playing";

    if (moving) state.scroll += state.speed * dt;
    for (const f of fog) {
      f.x -= f.s * dt;
      if (f.x + f.w < 0) f.x = W + Math.random() * 40;
    }

    if (state.mode === "ready") {
      bat.y = H * 0.42 + Math.sin(state.time * 3) * 10;
      bat.wing = (bat.wing + dt * 4) % 1;
      bat.angle = 0;
    }

    if (state.mode === "playing" || state.mode === "dying") {
      bat.vy = Math.min(bat.vy + CONFIG.gravity * dt, CONFIG.maxFall);
      bat.y += bat.vy * dt;
      bat.wing = Math.max(0, bat.wing - dt * 3.5);
      const target = Math.max(-0.45, Math.min(1.2, bat.vy / 520));
      bat.angle += (target - bat.angle) * Math.min(1, dt * 10);

      if (bat.y < CONFIG.batRadius) { bat.y = CONFIG.batRadius; bat.vy = 0; }
      const floor = H - GROUND - CONFIG.batRadius;
      if (bat.y >= floor) {
        bat.y = floor;
        if (state.mode === "playing") die();
        if (state.mode === "dying" && state.shake <= 0) gameOver();
      }
    }

    if (state.mode === "playing") {
      for (const p of state.pillars) p.x -= state.speed * dt;
      if (state.pillars.length && state.pillars[0].x < -CONFIG.pillarWidth - 20) state.pillars.shift();
      const lastP = state.pillars[state.pillars.length - 1];
      if (!lastP || lastP.x < W - CONFIG.spacing) spawnPillar((lastP ? lastP.x : W) + CONFIG.spacing);

      for (const p of state.pillars) {
        if (!p.passed && p.x + CONFIG.pillarWidth < bat.x) {
          p.passed = true;
          state.score++;
          ui.score.textContent = state.score;
          state.speed = Math.min(CONFIG.maxSpeed, CONFIG.speed + state.score * CONFIG.speedPerPoint);
          sound.score();
        }
        if (hitsPillar(bat, p)) { die(); break; }
      }
    }

    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    if (state.mode === "dying" && state.shake <= 0 && bat.y >= H - GROUND - CONFIG.batRadius) gameOver();

    for (const pt of state.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 400 * dt; pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
  }

  // Circle vs. the two pillar rectangles (a little forgiving on purpose).
  function hitsPillar(bat, p) {
    const r = CONFIG.batRadius - 3;
    const rects = [
      { x: p.x, y: -100, w: CONFIG.pillarWidth, h: p.top + 100 },
      { x: p.x, y: p.top + CONFIG.gap, w: CONFIG.pillarWidth, h: H },
    ];
    return rects.some((rc) => {
      const cx = Math.max(rc.x, Math.min(bat.x, rc.x + rc.w));
      const cy = Math.max(rc.y, Math.min(bat.y, rc.y + rc.h));
      return (bat.x - cx) ** 2 + (bat.y - cy) ** 2 < r * r;
    });
  }

  // ---------- draw ----------
  function draw() {
    ctx.save();
    if (state.shake > 0) {
      const k = state.shake * 22;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    drawSky();
    drawHills();
    for (const p of state.pillars) drawPillar(p);
    drawFog();
    drawGround();
    drawParticles();
    drawBat(state.bat);
    ctx.restore();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#120720");
    g.addColorStop(0.55, "#3a1352");
    g.addColorStop(0.85, "#a8401c");
    g.addColorStop(1, "#ff8a2a");
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(state.time * 2 + s.t);
      ctx.fillStyle = `rgba(243,234,210,${0.3 + tw * 0.6})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }

    // Moon with a soft glow
    const mx = 262, my = 118;
    const glow = ctx.createRadialGradient(mx, my, 30, mx, my, 120);
    glow.addColorStop(0, "rgba(255,236,180,.35)");
    glow.addColorStop(1, "rgba(255,236,180,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(mx - 120, my - 120, 240, 240);
    ctx.fillStyle = "#fbecc0";
    ctx.beginPath(); ctx.arc(mx, my, 44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(200,170,120,.35)";
    for (const [dx, dy, r] of [[-14, -8, 9], [12, 10, 6], [6, -18, 4], [-6, 16, 5]]) {
      ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Two parallax layers of hills with bare trees.
  function drawHills() {
    layer(0.15, H - GROUND - 120, 46, "#2a0f3d", 0.004, 1);
    layer(0.35, H - GROUND - 60, 34, "#1c0a2a", 0.007, 2);

    function layer(par, base, amp, color, freq, seed) {
      const off = state.scroll * par;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) {
        const wx = x + off;
        const y = base - Math.sin(wx * freq + seed) * amp - Math.sin(wx * freq * 2.7 + seed * 3) * amp * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.fill();

      // dead trees every ~170 world px
      const step = 170 + seed * 40;
      const first = Math.floor(off / step) * step;
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      for (let wx = first; wx < off + W + step; wx += step) {
        const x = wx - off + ((seed * 53) % 60);
        const y = base - Math.sin((x + off) * freq + seed) * amp - Math.sin((x + off) * freq * 2.7 + seed * 3) * amp * 0.35;
        drawTree(x, y + 4, 34 + seed * 8);
      }
    }
  }

  function drawTree(x, y, h) {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - h);
    ctx.moveTo(x, y - h * 0.55); ctx.lineTo(x - h * 0.35, y - h * 0.85);
    ctx.moveTo(x, y - h * 0.7); ctx.lineTo(x + h * 0.3, y - h * 1.0);
    ctx.moveTo(x, y - h); ctx.lineTo(x - h * 0.15, y - h * 1.2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.25, y - h * 0.78); ctx.lineTo(x - h * 0.35, y - h * 0.65);
    ctx.moveTo(x + h * 0.2, y - h * 0.9); ctx.lineTo(x + h * 0.35, y - h * 0.86);
    ctx.stroke();
  }

  // Stone pillar with a carved jack-o'-lantern at the gap end.
  function drawPillar(p) {
    const w = CONFIG.pillarWidth;
    const gapBottom = p.top + CONFIG.gap;
    stone(p.x, -10, w, p.top - 22);
    stone(p.x, gapBottom + 22, w, H - GROUND - gapBottom - 22);
    pumpkin(p.x + w / 2, p.top - 18, true);
    pumpkin(p.x + w / 2, gapBottom + 18, false);
  }

  function stone(x, y, w, h) {
    if (h <= 0) return;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "#3d3350");
    g.addColorStop(0.45, "#5a4d70");
    g.addColorStop(1, "#2a2238");
    ctx.fillStyle = g;
    ctx.fillRect(x + 4, y, w - 8, h);
    ctx.strokeStyle = "#120a1c";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 4, y, w - 8, h);
    // brick lines
    ctx.strokeStyle = "rgba(18,10,28,.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let row = 0;
    for (let yy = y + 26; yy < y + h; yy += 26, row++) {
      ctx.moveTo(x + 4, yy); ctx.lineTo(x + w - 4, yy);
      const bx = x + (row % 2 ? w * 0.35 : w * 0.65);
      ctx.moveTo(bx, yy); ctx.lineTo(bx, Math.min(yy + 26, y + h));
    }
    ctx.stroke();
    // a bit of moss
    ctx.fillStyle = "rgba(155,229,100,.25)";
    ctx.fillRect(x + 6, y + h * 0.3, 6, Math.min(30, h * 0.2));
  }

  function pumpkin(cx, cy, upsideDown) {
    const rx = CONFIG.pillarWidth / 2 + 4, ry = 22;
    ctx.save();
    ctx.translate(cx, cy);
    if (upsideDown) ctx.scale(1, -1);
    // glow
    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 60);
    glow.addColorStop(0, "rgba(255,160,40,.35)");
    glow.addColorStop(1, "rgba(255,160,40,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-60, -60, 120, 120);
    // stem (points away from the gap)
    ctx.fillStyle = "#3f6b2a";
    ctx.fillRect(-4, ry - 4, 8, 12);
    // body: three overlapping lobes
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#120a1c";
    for (const [dx, sx, col] of [[-12, 0.55, "#e0661a"], [12, 0.55, "#e0661a"], [0, 0.62, "#ff7a1a"]]) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(dx, 0, rx * sx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // carved face (always drawn upright)
    if (upsideDown) ctx.scale(1, -1);
    const flicker = 0.75 + Math.sin(state.time * 12 + cx) * 0.12 + Math.random() * 0.08;
    ctx.fillStyle = `rgba(255,230,120,${flicker})`;
    tri(-12, -4, 7); tri(12, -4, 7);
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    for (let i = 0; i <= 4; i++) ctx.lineTo(-14 + i * 7, i % 2 ? 13 : 7);
    ctx.lineTo(14, 6);
    ctx.quadraticCurveTo(0, 16, -14, 6);
    ctx.fill();
    ctx.restore();

    function tri(x, y, s) {
      ctx.beginPath(); ctx.moveTo(x - s / 2, y + s / 2); ctx.lineTo(x + s / 2, y + s / 2); ctx.lineTo(x, y - s / 2); ctx.fill();
    }
  }

  function drawFog() {
    for (const f of fog) {
      const g = ctx.createRadialGradient(f.x + f.w / 2, f.y, 5, f.x + f.w / 2, f.y, f.w / 2);
      g.addColorStop(0, "rgba(220,200,255,.14)");
      g.addColorStop(1, "rgba(220,200,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(f.x + f.w / 2, f.y, f.w / 2, 26, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawGround() {
    const y = H - GROUND;
    ctx.fillStyle = "#170b24";
    ctx.fillRect(-20, y, W + 40, GROUND + 20);
    ctx.fillStyle = "#24113a";
    ctx.fillRect(-20, y, W + 40, 10);

    const off = state.scroll;
    // grass tufts
    ctx.fillStyle = "#2f5a2a";
    const gStep = 14;
    for (let wx = Math.floor(off / gStep) * gStep; wx < off + W + gStep; wx += gStep) {
      const x = wx - off;
      ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + 4, y - 7); ctx.lineTo(x + 8, y + 2); ctx.fill();
    }
    // tombstones
    const tStep = 96;
    for (let wx = Math.floor(off / tStep) * tStep; wx < off + W + tStep; wx += tStep) {
      const x = wx - off + 20;
      const kind = Math.abs(Math.floor(wx / tStep)) % 3;
      tomb(x, y + 34, kind);
    }
  }

  function tomb(x, y, kind) {
    ctx.fillStyle = "#4a4060";
    ctx.strokeStyle = "#120a1c";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (kind === 0) {
      ctx.moveTo(x, y + 26); ctx.lineTo(x, y); ctx.arc(x + 13, y, 13, Math.PI, 0); ctx.lineTo(x + 26, y + 26);
    } else if (kind === 1) {
      ctx.rect(x + 9, y - 14, 8, 40); ctx.rect(x, y - 4, 26, 8);
    } else {
      ctx.moveTo(x + 2, y + 26); ctx.lineTo(x + 2, y - 2); ctx.lineTo(x + 24, y - 6); ctx.lineTo(x + 24, y + 26);
    }
    ctx.fill(); ctx.stroke();
    if (kind !== 1) {
      ctx.fillStyle = "rgba(18,10,28,.6)";
      ctx.font = "800 8px Rubik, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("RIP", x + 13, y + 10);
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.fillStyle = p.color + (p.life / p.max).toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBat(b) {
    if (!b) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    if (state.mode === "dying" || state.mode === "over") ctx.scale(1, -1);

    // wings: flap from up (wing=1) to down (wing=0)
    const lift = state.mode === "ready" ? Math.sin(b.wing * Math.PI * 2) : b.wing * 2 - 1;
    ctx.fillStyle = "#2b1838";
    ctx.strokeStyle = "#0b0612";
    ctx.lineWidth = 2.5;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(-lift * 0.6);
      ctx.beginPath();
      ctx.moveTo(4, -2);
      ctx.quadraticCurveTo(16, -18, 32, -10);
      ctx.quadraticCurveTo(28, -2, 30, 4);
      ctx.quadraticCurveTo(24, 0, 20, 6);
      ctx.quadraticCurveTo(14, 2, 10, 8);
      ctx.quadraticCurveTo(8, 4, 4, 6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // body
    ctx.fillStyle = "#3a2150";
    ctx.beginPath(); ctx.ellipse(0, 2, 13, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // ears
    ctx.beginPath();
    ctx.moveTo(-9, -7); ctx.lineTo(-7, -19); ctx.lineTo(-2, -10);
    ctx.moveTo(9, -7); ctx.lineTo(7, -19); ctx.lineTo(2, -10);
    ctx.fill(); ctx.stroke();
    // belly
    ctx.fillStyle = "#5b3a72";
    ctx.beginPath(); ctx.ellipse(0, 7, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    // eyes
    const dead = state.mode === "dying" || state.mode === "over";
    if (dead) {
      ctx.strokeStyle = "#ffb04a"; ctx.lineWidth = 2;
      for (const ex of [-5, 5]) {
        ctx.beginPath();
        ctx.moveTo(ex - 3, -3); ctx.lineTo(ex + 3, 3); ctx.moveTo(ex + 3, -3); ctx.lineTo(ex - 3, 3);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "#ffb04a";
      ctx.shadowColor = "#ff7a1a"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(-5, -1, 3.4, 0, Math.PI * 2); ctx.arc(5, -1, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#120a1c";
      ctx.beginPath(); ctx.arc(-4, -1, 1.4, 0, Math.PI * 2); ctx.arc(6, -1, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    // fangs
    ctx.fillStyle = "#f3ead2";
    ctx.beginPath();
    ctx.moveTo(-3, 5); ctx.lineTo(-1.5, 9); ctx.lineTo(0, 5);
    ctx.moveTo(0, 5); ctx.lineTo(1.5, 9); ctx.lineTo(3, 5);
    ctx.fill();
    ctx.restore();
  }

  // ---------- tiny synth sounds (no audio files) ----------
  const sound = (() => {
    let ac = null;
    function tone(freq, dur, type, vol, slide) {
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, ac.currentTime);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, ac.currentTime + dur);
        g.gain.setValueAtTime(vol, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
        o.connect(g).connect(ac.destination);
        o.start(); o.stop(ac.currentTime + dur);
      } catch { /* audio unavailable */ }
    }
    return {
      flap: () => tone(520, 0.08, "triangle", 0.06, 780),
      score: () => { tone(660, 0.09, "square", 0.04); setTimeout(() => tone(990, 0.12, "square", 0.04), 70); },
      hit: () => tone(220, 0.4, "sawtooth", 0.08, 60),
    };
  })();

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (state.mode !== "paused") update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- boot ----------
  ui.bestStart.textContent = state.best;
  reset();
  resize();
  requestAnimationFrame(frame);

  // Small hook for testing from the console.
  window.__flappyBat = { state, CONFIG };
})();
