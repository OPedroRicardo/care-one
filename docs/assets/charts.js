/* ============================================================
   CARE ONE — Charts & data viz (SVG, no deps)
   ============================================================ */
(function () {
  "use strict";

  function cv(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* ---------- HERO ECG ---------- */
  function ecgPath() {
    // Repeating heartbeat baseline across 1200 wide, mid 100
    const seg = (x) =>
      `L${x + 0} 100 L${x + 28} 100 L${x + 34} 86 L${x + 40} 100 ` +
      `L${x + 56} 100 L${x + 62} 100 L${x + 68} 38 L${x + 74} 150 ` +
      `L${x + 80} 72 L${x + 86} 100 L${x + 104} 100 L${x + 112} 108 L${x + 120} 100`;
    let d = "M0 100 ";
    for (let x = 0; x < 1200; x += 150) d += seg(x) + " ";
    return d;
  }
  function renderECG() {
    const svg = document.getElementById("ecg");
    if (!svg) return;
    svg.innerHTML = "";
    const c = cv("--vital");
    const base = el("path", { d: ecgPath(), fill: "none", stroke: c, "stroke-width": 1.4, opacity: 0.22 });
    const glow = el("path", { d: ecgPath(), fill: "none", stroke: c, "stroke-width": 2.2,
      "stroke-linecap": "round", "stroke-dasharray": "120 880", "stroke-dashoffset": "0",
      filter: "drop-shadow(0 0 6px " + c + ")" });
    glow.style.animation = "ecg-dash 3.4s linear infinite";
    svg.appendChild(base);
    svg.appendChild(glow);
  }

  /* ---------- RADIAL GAUGES ---------- */
  function renderGauges() {
    const cards = document.querySelectorAll("#gauges .gauge-card");
    cards.forEach((card) => {
      const svg = card.querySelector(".gauge-svg");
      if (!svg) return;
      svg.innerHTML = "";
      const pct = +card.dataset.pct || 0;
      const cx = 84, cy = 84, r = 66, sw = 11;
      const circ = 2 * Math.PI * r;
      // color by score severity
      let col = cv("--vital");
      if (pct >= 70) col = cv("--high");
      else if (pct >= 50) col = cv("--med");
      else col = cv("--low");

      const track = el("circle", { cx, cy, r, fill: "none", stroke: cv("--line-soft"),
        "stroke-width": sw });
      // tick marks
      const g = el("g", {});
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * 2 * Math.PI - Math.PI / 2;
        const x1 = cx + Math.cos(a) * (r + 9), y1 = cy + Math.sin(a) * (r + 9);
        const x2 = cx + Math.cos(a) * (r + 13), y2 = cy + Math.sin(a) * (r + 13);
        g.appendChild(el("line", { x1, y1, x2, y2, stroke: cv("--line"),
          "stroke-width": i % 5 === 0 ? 1.4 : 0.7, opacity: 0.5 }));
      }
      const arc = el("circle", { cx, cy, r, fill: "none", stroke: col,
        "stroke-width": sw, "stroke-linecap": "round",
        "stroke-dasharray": circ, "stroke-dashoffset": circ,
        transform: `rotate(-90 ${cx} ${cy})` });
      arc.style.transition = "stroke-dashoffset 1.3s cubic-bezier(0.16,1,0.3,1)";
      arc.style.filter = "drop-shadow(0 0 5px " + col + "66)";

      svg.appendChild(track);
      svg.appendChild(g);
      svg.appendChild(arc);
      const gn = card.querySelector(".gn");
      if (gn) gn.style.color = col;

      card._animate = () => { arc.setAttribute("stroke-dashoffset", circ * (1 - pct / 100)); };
    });
  }

  /* ---------- PARETO ---------- */
  function renderPareto() {
    const svg = document.getElementById("paretoChart");
    if (!svg) return;
    svg.innerHTML = "";
    const W = 460, H = 280, padL = 38, padR = 30, padT = 18, padB = 38;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    // 5 buckets of portfolio (each 20%), cost share per bucket (sorted desc)
    const buckets = [48, 32, 11, 6, 3]; // % of total cost
    const labels = ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"];
    const maxBar = 50;
    const bw = plotW / buckets.length;

    // gridlines
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH * i) / 4;
      svg.appendChild(el("line", { x1: padL, y1: y, x2: W - padR, y2: y,
        stroke: cv("--line-soft"), "stroke-width": 1 }));
      svg.appendChild(addText(padL - 8, y + 3, (100 - i * 25) + "%", "end", cv("--ink-ghost"), 9));
    }

    // bars
    const high = cv("--high"), med = cv("--med"), low = cv("--low"), vital = cv("--vital");
    buckets.forEach((v, i) => {
      const h = (v / maxBar) * plotH;
      const x = padL + i * bw + bw * 0.2;
      const y = padT + plotH - h;
      const col = i === 0 ? high : i === 1 ? med : low;
      const bar = el("rect", { x, y: padT + plotH, width: bw * 0.6, height: 0, rx: 4, fill: col, opacity: 0.85 });
      svg.appendChild(bar);
      svg.appendChild(addText(x + bw * 0.3, padT + plotH + 22, labels[i], "middle", cv("--ink-faint"), 9));
      svg._bars = svg._bars || [];
      svg._bars.push({ bar, y, h });
    });

    // cumulative line
    let cum = 0;
    const pts = buckets.map((v, i) => {
      cum += v;
      const x = padL + i * bw + bw / 2;
      const y = padT + plotH - (cum / 100) * plotH;
      return [x, y, cum];
    });
    const lineD = "M" + pts.map((p) => p[0] + " " + p[1]).join(" L");
    const path = el("path", { d: lineD, fill: "none", stroke: vital, "stroke-width": 2.4,
      "stroke-linecap": "round", "stroke-dasharray": 1000, "stroke-dashoffset": 1000 });
    path.style.transition = "stroke-dashoffset 1.6s ease 0.3s";
    svg.appendChild(path);
    pts.forEach((p) => {
      const dot = el("circle", { cx: p[0], cy: p[1], r: 0, fill: cv("--bg-deep"), stroke: vital, "stroke-width": 2 });
      dot.style.transition = "r 0.4s ease 0.8s";
      svg.appendChild(dot);
      svg._dots = svg._dots || [];
      svg._dots.push(dot);
    });
    // 80% marker callout on bucket 2
    svg.appendChild(addText(pts[1][0] + 6, pts[1][1] - 10, "80%", "start", vital, 11, 600));
    svg.appendChild(addText(pts[1][0] + 6, pts[1][1] + 4, "do custo", "start", cv("--ink-faint"), 8.5));

    svg._animate = () => {
      (svg._bars || []).forEach((b, i) => {
        setTimeout(() => { b.bar.setAttribute("y", b.y); b.bar.setAttribute("height", b.h); }, i * 90);
        b.bar.style.transition = "y 0.7s cubic-bezier(0.16,1,0.3,1), height 0.7s cubic-bezier(0.16,1,0.3,1)";
      });
      path.setAttribute("stroke-dashoffset", 0);
      (svg._dots || []).forEach((d) => d.setAttribute("r", 4));
    };
  }

  /* ---------- DONUT ---------- */
  function renderDonut() {
    const svg = document.getElementById("donutChart");
    if (!svg) return;
    svg.innerHTML = "";
    const cx = 90, cy = 90, r = 62, sw = 22;
    const data = [
      { v: 18, c: cv("--high") },
      { v: 31, c: cv("--med") },
      { v: 51, c: cv("--low") },
    ];
    const circ = 2 * Math.PI * r;
    const GAP = 3; // small visual gap between segments (in deg)
    svg.appendChild(el("circle", { cx, cy, r, fill: "none", stroke: cv("--bg-inset"), "stroke-width": sw }));
    const segs = [];
    let accPct = 0;
    data.forEach((d) => {
      const startDeg = (accPct / 100) * 360 - 90 + GAP / 2;
      const len = Math.max(0, ((d.v / 100) * circ) - (GAP / 360) * circ);
      const seg = el("circle", { cx, cy, r, fill: "none", stroke: d.c, "stroke-width": sw,
        "stroke-dasharray": "0 " + circ, transform: `rotate(${startDeg} ${cx} ${cy})`,
        "stroke-linecap": "round" });
      seg.style.transition = "stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)";
      svg.appendChild(seg);
      segs.push({ seg, len });
      accPct += d.v;
    });
    // center label
    svg.appendChild(addText(cx, cy - 2, "80+", "middle", cv("--ink"), 26, 600, "Space Grotesk"));
    svg.appendChild(addText(cx, cy + 16, "pacientes", "middle", cv("--ink-faint"), 9.5, 400, "IBM Plex Mono"));

    svg._animate = () => {
      segs.forEach((s, i) => {
        setTimeout(() => {
          s.seg.setAttribute("stroke-dasharray", s.len + " " + (circ - s.len));
        }, i * 130);
      });
    };
  }

  function addText(x, y, str, anchor, fill, size, weight, family) {
    const t = el("text", { x, y, "text-anchor": anchor || "start", fill: fill || cv("--ink"),
      "font-size": size || 10, "font-weight": weight || 400 });
    t.setAttribute("font-family", family || "IBM Plex Mono, monospace");
    t.textContent = str;
    return t;
  }

  /* ---------- expose ---------- */
  window.CareCharts = {
    renderAll() { renderECG(); renderGauges(); renderPareto(); renderDonut(); },
    rerenderTheme() { renderECG(); renderGauges(); renderPareto(); renderDonut();
      // re-run animations since elements are fresh
      window.CareCharts._replayVisible();
    },
    _replayVisible() {
      ["#gauges .gauge-card", "#paretoChart", "#donutChart"].forEach((sel) => {
        document.querySelectorAll(sel).forEach((n) => {
          const target = n._animate ? n : null;
          if (target && isInView(target)) requestAnimationFrame(() => target._animate());
        });
      });
    },
  };

  function isInView(node) {
    const r = (node.getBoundingClientRect ? node : node.parentElement).getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }

  window.__careRenderCharts = function () { window.CareCharts.renderAll(); };
})();
