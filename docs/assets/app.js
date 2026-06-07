/* ============================================================
   CARE ONE — App interactions
   ============================================================ */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- Charts init ---------- */
  function initCharts() { if (window.CareCharts) window.CareCharts.renderAll(); }

  /* ---------- Reveal on scroll + chart animations ---------- */
  function initReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    $$("[data-reveal]").forEach((n, i) => {
      n.style.animationDelay = (i % 4) * 60 + "ms";
      io.observe(n);
    });

    // animate charts when their container enters view
    const chartIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const t = e.target;
        if (t._animate) t._animate();
        // gauge cards live as children of #gauges
        chartIO.unobserve(t);
      });
    }, { threshold: 0.3 });
    $$("#gauges .gauge-card, #paretoChart, #donutChart").forEach((n) => chartIO.observe(n));
  }

  /* ---------- Scrollspy + progress ---------- */
  function initScrollspy() {
    const sections = $$(".section");
    const navItems = $$(".nav-item");
    const map = {};
    navItems.forEach((it) => {
      const id = it.getAttribute("href").slice(1);
      map[id] = it;
    });
    const fill = $("#progFill");

    function onScroll() {
      const sc = window.scrollY;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (fill) fill.style.width = Math.min(100, (sc / docH) * 100) + "%";

      let current = null;
      sections.forEach((s) => {
        const top = s.offsetTop - 140;
        if (sc >= top) current = s.id;
      });
      navItems.forEach((it) => it.classList.remove("active"));
      if (current && map[current]) map[current].classList.add("active");
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Audience filter ---------- */
  function initAudience() {
    const pills = $$(".aud-pill");
    const sections = $$(".section");
    const navItems = $$(".nav-item");

    pills.forEach((p) => {
      p.addEventListener("click", () => {
        const aud = p.dataset.aud;
        pills.forEach((x) => x.setAttribute("aria-pressed", x === p ? "true" : "false"));

        sections.forEach((s) => {
          const tags = (s.dataset.aud || "").split(/\s+/);
          const match = aud === "all" || tags.includes(aud);
          s.classList.toggle("dimmed", !match);
        });
        navItems.forEach((it) => {
          const id = it.getAttribute("href").slice(1);
          const sec = document.getElementById(id);
          if (!sec) return;
          const tags = (sec.dataset.aud || "").split(/\s+/);
          const match = aud === "all" || tags.includes(aud);
          it.classList.toggle("dimmed", !match);
        });
      });
    });
  }

  /* ---------- Theme switch ---------- */
  function initTheme() {
    const btns = $$(".theme-btn");
    const saved = localStorage.getItem("careone-theme");
    if (saved) applyTheme(saved);

    btns.forEach((b) => {
      b.addEventListener("click", () => applyTheme(b.dataset.theme));
    });
    function applyTheme(t) {
      document.documentElement.setAttribute("data-theme", t);
      btns.forEach((x) => x.setAttribute("aria-pressed", x.dataset.theme === t ? "true" : "false"));
      localStorage.setItem("careone-theme", t);
      // recolor charts to new palette
      if (window.CareCharts) requestAnimationFrame(() => window.CareCharts.rerenderTheme());
    }
    // sync pressed state on load
    const cur = document.documentElement.getAttribute("data-theme");
    btns.forEach((x) => x.setAttribute("aria-pressed", x.dataset.theme === cur ? "true" : "false"));
  }

  /* ---------- API accordion ---------- */
  function initApi() {
    $$("#apiList .api-row").forEach((row) => {
      const head = $(".api-head", row);
      head.addEventListener("click", () => row.classList.toggle("open"));
    });
  }

  /* ---------- ROI calculator ---------- */
  function initRoi() {
    const ben = $("#benRange"), ev = $("#evRange");
    if (!ben || !ev) return;
    const benVal = $("#benVal"), evVal = $("#evVal");
    const roEvents = $("#roEvents"), roSaving = $("#roSaving"), roPerBen = $("#roPerBen");
    const COST = 10153; // R$ avg internação
    const REDUCTION = 0.15; // 15% literatura

    const fmtInt = (n) => Math.round(n).toLocaleString("pt-BR");
    function fmtMoney(n) {
      if (n >= 1e6) return "R$ " + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".", ",") + "M";
      if (n >= 1e3) return "R$ " + Math.round(n / 1e3) + "k";
      return "R$ " + Math.round(n);
    }
    function update() {
      const b = +ben.value, e = +ev.value;
      benVal.textContent = fmtInt(b);
      evVal.textContent = e;
      const events = (b / 1000) * e;
      const saving = events * COST * REDUCTION;
      const perBen = saving / b;
      roEvents.textContent = fmtInt(events);
      roSaving.textContent = fmtMoney(saving);
      roPerBen.textContent = "R$ " + perBen.toFixed(0).replace(".", ",");
    }
    ben.addEventListener("input", update);
    ev.addEventListener("input", update);
    update();
  }

  /* ---------- Architecture layer highlight ---------- */
  function initArch() {
    $$("#archDiagram .arch-layer").forEach((l) => {
      l.addEventListener("mouseenter", () => l.classList.add("on"));
      l.addEventListener("mouseleave", () => l.classList.remove("on"));
    });
  }

  /* ---------- Mobile menu ---------- */
  function initMenu() {
    const btn = $("#menuBtn"), sb = $("#sidebar");
    if (!btn || !sb) return;
    btn.addEventListener("click", (e) => { e.stopPropagation(); sb.classList.toggle("open"); });
    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 1080 && sb.classList.contains("open") &&
          !sb.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        sb.classList.remove("open");
      }
    });
    $$(".nav-item, .brand-mark").forEach((n) =>
      n.addEventListener("click", () => { if (window.innerWidth <= 1080) sb.classList.remove("open"); })
    );
  }

  /* ---------- boot ---------- */
  function boot() {
    initCharts();
    initReveal();
    initScrollspy();
    initAudience();
    initTheme();
    initApi();
    initRoi();
    initArch();
    initMenu();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
