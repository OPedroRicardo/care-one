/* =============================================
  HERO ECG ANIMATION — single glowing line
  anchored near the bottom of the hero section
  (feito com IA, tem alguns bugs, mas fica bonito)
============================================= */
(function() {
  try {
    const canvas = document.getElementById('ecg-canvas');
    const ctx = canvas.getContext('2d');
    const hero = document.querySelector('.hero');

    function resize() {
      canvas.width  = hero.offsetWidth;
      canvas.height = hero.offsetHeight;
    }
    // window.addEventListener('resize', resize);
    resize();

    // ECG pulse shape: returns y-offset in [-1, 1] for t in [0,1]
    function ecgPulse(t) {
      if (t < 0.10) return 0;
      if (t < 0.13) return (t-0.10)/0.03 * 0.10;
      if (t < 0.16) return 0.10-(t-0.13)/0.03 * 0.10;
      if (t < 0.26) return 0;
      if (t < 0.28) return -(t-0.26)/0.02 * 0.18;
      if (t < 0.31) return -0.18+(t-0.28)/0.03 * 1.18;
      if (t < 0.345) return 1.0-(t-0.31)/0.035 * 1.22;
      if (t < 0.37) return -0.22+(t-0.345)/0.025 * 0.22;
      if (t < 0.46) return 0;
      if (t < 0.52) return (t-0.46)/0.06 * 0.28;
      if (t < 0.60) return 0.28-(t-0.52)/0.08 * 0.28;
      return 0;
    }

    const CYCLE  = 420;   // px per heartbeat
    const SPEED  = 0.7;   // px per frame
    const AMP    = 70;    // amplitude in px
    const TRAIL  = 900;   // max trail length in px

    // ring buffer: array of {x, y}
    const pts = [];
    let headX = 0;

    function frame() {
      const W = canvas.width;
      const H = canvas.height;
      const baseY = H * 0.25; // ECG sits at 72% height of hero

      ctx.clearRect(0, 0, W, H);

      // — subtle bottom fade vignette so ECG blends into next section —
      const fade = ctx.createLinearGradient(0, H * 0.55, 0, H);
      fade.addColorStop(0, 'rgba(4,8,15,0)');
      fade.addColorStop(1, 'rgba(4,8,15,0.92)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, W, H);

      // advance head
      headX += SPEED;
      if (headX > W + TRAIL) headX = -10;

      const cyclePos = ((headX % CYCLE) + CYCLE) % CYCLE / CYCLE;
      const headY = baseY - ecgPulse(cyclePos) * AMP;
      pts.push({ x: headX, y: headY });

      // prune old points beyond trail length
      while (pts.length > 1 && headX - pts[0].x > TRAIL) pts.shift();

      if (pts.length < 2) { requestAnimationFrame(frame); return; }

      // — dashed baseline —
      ctx.save();
      ctx.strokeStyle = 'rgba(0,212,255,0.07)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 24]);
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      ctx.lineTo(W, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // — draw trail segments with fade-in —
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i-1], p1 = pts[i];
        const prog = (i / pts.length); // 0→old, 1→new

        // fade alpha: invisible at tail, full at head
        const alpha = Math.pow(prog, 1.6) * 0.9;

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = `rgba(0,212,255,${alpha})`;
        ctx.lineWidth = prog * 2 + 0.3;
        ctx.shadowBlur = prog > 0.85 ? 22 : (prog > 0.5 ? 10 : 0);
        ctx.shadowColor = 'rgba(0,212,255,0.6)';
        ctx.stroke();
      }

      // — glowing head dot —
      const last = pts[pts.length - 1];
      const grad = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 14);
      grad.addColorStop(0, 'rgba(0,212,255,0.9)');
      grad.addColorStop(0.3, 'rgba(0,212,255,0.4)');
      grad.addColorStop(1, 'rgba(0,212,255,0)');
      ctx.beginPath();
      ctx.arc(last.x, last.y, 14, 0, Math.PI*2);
      ctx.fillStyle = grad;
      ctx.shadowBlur = 0;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(last.x, last.y, 2.8, 0, Math.PI*2);
      ctx.fillStyle = '#00D4FF';
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#00D4FF';
      ctx.fill();

      ctx.restore();
      requestAnimationFrame(frame);
    }

    frame();
  } catch (e) {
    console.error(e)
  }
})();

// Animações
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 60);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
reveals.forEach(el => observer.observe(el));

// Navbar
const sections = document.querySelectorAll('section[id], div[id]');
const navLinks = document.querySelectorAll('nav a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 200) current = s.id;
  });
  navLinks.forEach(a => {
    a.style.color = a.getAttribute('href') === `#${current}` ? 'var(--accent)' : '';
  });
});