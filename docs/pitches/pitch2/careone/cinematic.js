/* ============================================================
   CARE ONE — cinematic engine
   ============================================================ */
(function () {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- ECG path generator ---------- */
  // Builds a tileable ECG polyline. mode: 'normal' | 'story'
  function ecgPath(w, h, opts = {}) {
    const mid = h * 0.5;
    const beat = opts.beat || 150;           // px per beat
    const amp  = opts.amp || h * 0.42;        // spike height
    let x = 0;
    let d = `M0 ${mid}`;
    const seg = (dx, dy) => { x += dx; d += ` L${x.toFixed(1)} ${(mid - dy).toFixed(1)}`; };

    const normalBeat = (a = amp) => {
      seg(beat * 0.30, 0);                    // baseline
      seg(beat * 0.05, a * 0.12);             // P
      seg(beat * 0.05, 0);
      seg(beat * 0.04, -a * 0.18);            // Q
      seg(beat * 0.04, a);                    // R spike up
      seg(beat * 0.04, -a * 0.28);            // S
      seg(beat * 0.06, 0);
      seg(beat * 0.10, a * 0.22);             // T
      seg(beat * 0.10, 0);
      seg(beat * 0.12, 0);
    };
    const erraticBeat = () => {
      const a = amp * (0.4 + Math.random() * 0.8);
      seg(beat * (0.1 + Math.random() * 0.2), 0);
      seg(beat * 0.04, a * (Math.random() - 0.3));
      seg(beat * 0.04, a * (Math.random() > 0.5 ? 1 : -0.6));
      seg(beat * 0.05, -a * Math.random());
      seg(beat * (0.1 + Math.random() * 0.15), 0);
    };

    const n = Math.ceil(w / beat) + 1;
    if (opts.mode === "story") {
      // healthy -> erratic -> flat
      const third = Math.floor(n / 3);
      for (let i = 0; i < third; i++) normalBeat();
      for (let i = 0; i < third; i++) erraticBeat();
      d += ` L${w} ${mid}`;                   // flatline to the end
    } else {
      for (let i = 0; i < n; i++) normalBeat();
    }
    return d;
  }

  function pathLength(d) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.position = "absolute"; svg.style.opacity = "0";
    svg.appendChild(p); document.body.appendChild(svg);
    const len = p.getTotalLength(); svg.remove(); return len;
  }

  /* ---------- Hero particle constellation ---------- */
  function buildParticleField(sel) {
    const cv = $(sel);
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let w, h, dpr, nodes, raf;
    const N = 46;
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function seed() {
      nodes = Array.from({ length: N }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.8
      }));
    }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            const o = (1 - dist / 130) * 0.32;
            ctx.strokeStyle = `rgba(94, 224, 212, ${o})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(120, 230, 218, 0.85)"; ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    resize(); seed();
    if (!reduce) frame(); else { ctx.clearRect(0,0,w,h); }
    window.addEventListener("resize", () => { cancelAnimationFrame(raf); resize(); seed(); if (!reduce) frame(); });
  }

  /* ---------- floating dust ---------- */
  function buildDust() {
    $$(".dust[data-dust]").forEach((host) => {
      const n = parseInt(host.dataset.dust, 10) || 12;
      let html = "";
      for (let i = 0; i < n; i++) {
        const dur = 9 + Math.random() * 10;
        const delay = -Math.random() * dur;
        const left = Math.random() * 100;
        const size = 2 + Math.random() * 2.5;
        html += `<i style="left:${left.toFixed(1)}%;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;animation-duration:${dur.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s"></i>`;
      }
      host.innerHTML = html;
    });
  }

  /* ---------- dot matrix ---------- */
  function buildMatrix() {
    $$(".matrix[data-matrix]").forEach((host) => {
      const total = parseInt(host.dataset.total, 10) || 100;
      let html = "";
      for (let i = 0; i < total; i++) html += `<span class="d"></span>`;
      host.innerHTML = html;
    });
  }
  function buildBars() { /* heights applied on scene activate */ }
  function fillMatrix(host) {
    const on = parseInt(host.dataset.on, 10) || 0;
    const dots = $$(".d", host);
    // shuffle index order for organic fill
    const order = dots.map((_, i) => i).sort(() => Math.random() - 0.5);
    order.slice(0, on).forEach((idx, k) => {
      setTimeout(() => dots[idx].classList.add("on"), reduce ? 0 : k * 22);
    });
  }

  /* ---------- Monitor ECG (story morph on scroll) ---------- */
  function buildMonitorEcg() {
    const svg = $("#monitorSvg");
    if (!svg) return;
    const w = 1000, h = 190;
    const d = ecgPath(w, h, { mode: "story", beat: 95, amp: h * 0.4 });
    const len = pathLength(d);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = `<path d="${d}"></path>`;
    svg.style.setProperty("--len", Math.ceil(len));
    svg.querySelector("path").style.setProperty("--len", Math.ceil(len));
  }

  /* ---------- sparklines in vital cards ---------- */
  function buildSparks() {
    $$(".spark").forEach((s) => {
      const w = 54, h = 22, pts = 16;
      let d = `M0 ${h / 2}`;
      for (let i = 1; i <= pts; i++) {
        const x = (i / pts) * w;
        const y = h / 2 + (Math.sin(i * 1.3) * 0.5 + (Math.random() - 0.5) * 0.4) * h * 0.4;
        d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      s.innerHTML = `<path d="${d}"></path>`;
    });
  }

  /* ---------- count-up ---------- */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.dec || "0", 10);
    const dur = 1500;
    const isMoney = el.dataset.money === "1";
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      let v = target * e;
      let out;
      if (isMoney) {
        out = v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      } else {
        out = v.toFixed(dec);
        if (dec === 0) out = Math.round(v).toString();
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = isMoney
        ? target.toLocaleString("pt-BR")
        : (dec ? target.toFixed(dec) : target.toString());
    }
    requestAnimationFrame(tick);
  }

  /* ---------- live telemetry jitter ---------- */
  function liveTelemetry() {
    const fields = $$("[data-live]");
    if (!fields.length) return;
    setInterval(() => {
      fields.forEach((f) => {
        const base = parseFloat(f.dataset.base);
        const j = parseFloat(f.dataset.jitter || "1");
        const dec = parseInt(f.dataset.dec || "0", 10);
        const v = base + (Math.random() - 0.5) * 2 * j;
        f.textContent = dec ? v.toFixed(dec) : Math.round(v);
      });
    }, 1200);
  }

  /* ---------- scene observer ---------- */
  const scenes = $$(".scene");
  function setSceneNo(i) {
    const el = $("#sceneNo");
    if (el) el.innerHTML = `<b>${String(i + 1).padStart(2, "0")}</b> / ${String(scenes.length).padStart(2, "0")}`;
  }
  function activate(sc) {
    if (sc.dataset.act) return;
    sc.dataset.act = "1";
    sc.classList.add("in");
    setSceneNo(scenes.indexOf(sc));
    $$("[data-count]", sc).forEach((c) => {
      if (!c.dataset.done) {
        c.dataset.done = "1";
        if (reduce) c.textContent = c.dataset.money === "1" ? parseFloat(c.dataset.count).toLocaleString("pt-BR") : c.dataset.count;
        else animateCount(c);
      }
    });
    if (sc.dataset.flat !== undefined) setTimeout(() => sc.classList.add("flat"), reduce ? 0 : 3200);
    // dot matrix fill
    $$(".matrix[data-matrix]", sc).forEach((m) => { if (!m.dataset.done) { m.dataset.done = "1"; fillMatrix(m); } });
    // grow bars (pixel heights for reliable flex resolution)
    $$(".barchart", sc).forEach((chart) => {
      const grow = () => {
        const full = chart.clientHeight || 210;
        $$(".bar[data-h]", chart).forEach((b) => { b.style.height = full * (parseFloat(b.dataset.h) / 100) + "px"; });
      };
      reduce ? grow() : setTimeout(grow, 180);
    });
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) activate(e.target); });
  }, { threshold: 0.4 });
  scenes.forEach((s) => io.observe(s));
  // robust scroll fallback (handles programmatic jumps + arrow-key nav)
  function revealInView() {
    const vh = window.innerHeight;
    scenes.forEach((s) => {
      const r = s.getBoundingClientRect();
      if (r.top < vh * 0.7 && r.bottom > vh * 0.3) activate(s);
    });
  }

  /* ---------- progress rail ---------- */
  const fill = $("#railFill");
  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? (window.scrollY / max) * 100 : 0;
    if (fill) fill.style.width = p + "%";
    revealInView();
    try { localStorage.setItem("careone-scroll", String(window.scrollY)); } catch (e) {}
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- keyboard nav (presenter) ---------- */
  function currentSceneIndex() {
    const mid = window.scrollY + window.innerHeight * 0.5;
    let best = 0, bestD = Infinity;
    scenes.forEach((s, i) => {
      const c = s.offsetTop + s.offsetHeight * 0.5;
      const d = Math.abs(c - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }
  function go(dir) {
    const i = currentSceneIndex();
    const t = Math.max(0, Math.min(scenes.length - 1, i + dir));
    scenes[t].scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
  window.addEventListener("keydown", (e) => {
    if (["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
    else if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    else if (e.key === "Home") { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else if (e.key === "End") { e.preventDefault(); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }
  });

  /* ---------- restore scroll ---------- */
  function restore() {
    try {
      const y = parseFloat(localStorage.getItem("careone-scroll"));
      if (y && y > 10) window.scrollTo(0, y);
    } catch (e) {}
  }

  /* ---------- size & reveal live iframes ---------- */
  function sizeFrames() {
    document.querySelectorAll('iframe[data-frame]').forEach((f) => {
      const kind = f.dataset.frame;
      const host = f.parentElement;            // .screen or .viewport
      const w = host.clientWidth;
      const h = host.clientHeight;
      const logicalW = kind === 'kiosk' ? 1280 : 1500;
      const logicalH = kind === 'kiosk' ? 960 : 900;
      const scale = w / logicalW;
      if (w > 0) {
        f.style.width = `${logicalW}px`;
        f.style.height = h > 0 ? `${Math.round(h / scale)}px` : `${logicalH}px`;
        f.style.transform = `scale(${(scale).toFixed(4)})`;
        f.style.transformOrigin = 'top left';
      }
    });
  }
  function initFrames() {
    document.querySelectorAll('iframe[data-frame]').forEach((f) => {
      f.addEventListener('load', () => {
        const ph = f.parentElement.querySelector('.ph');
        if (ph) { ph.style.transition = 'opacity .6s'; ph.style.opacity = '0'; }
      });
    });
    sizeFrames();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(sizeFrames);
      document.querySelectorAll('.kiosk .screen, .browser .viewport').forEach((el) => ro.observe(el));
    }
    window.addEventListener('resize', sizeFrames);
  }

  /* ---------- custom cursor ---------- */
  function buildCursor() {
    const el = document.createElement('div');
    el.id = 'cursor-orb';
    el.style.cssText = `
      position: fixed; top: 0; left: 0; z-index: 9999;
      width: 10px; height: 10px; border-radius: 50%;
      background: oklch(0.72 0.13 195);
      box-shadow: 0 0 8px 3px oklch(0.72 0.13 195 / 0.7), 0 0 20px 6px oklch(0.72 0.13 195 / 0.3);
      pointer-events: none;
      transform: translate(-50%, -50%);
      transition: transform 0.08s ease, opacity 0.3s;
      will-change: left, top;
    `;
    document.body.appendChild(el);
    document.body.style.cursor = 'none';

    let tx = -20, ty = -20, cx = -20, cy = -20, raf;
    document.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });
    document.addEventListener('mouseleave', () => { el.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { el.style.opacity = '1'; });

    // hide orb when cursor enters an iframe (parent loses mousemove events)
    function bindIframeEdges() {
      document.querySelectorAll('iframe').forEach((f) => {
        f.addEventListener('mouseenter', () => {
          el.style.opacity = '0';
          document.body.style.cursor = '';
        });
        f.addEventListener('mouseleave', () => {
          el.style.opacity = '1';
          document.body.style.cursor = 'none';
        });
      });
    }
    bindIframeEdges();

    function loop() {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      el.style.left = cx.toFixed(2) + 'px';
      el.style.top  = cy.toFixed(2) + 'px';
      raf = requestAnimationFrame(loop);
    }
    loop();
  }

  /* ---------- init ---------- */
  function init() {
    buildCursor();
    buildParticleField("#heroField");
    buildMonitorEcg();
    buildDust();
    buildMatrix();
    buildBars();
    buildSparks();
    liveTelemetry();
    initFrames();
    setSceneNo(0);
    onScroll();
    restore();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
