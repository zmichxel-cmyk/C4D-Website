// Fire embers -- ported from the real Controller Skin Studio app's fire
// effect (BodyEffectOverlay.tsx: spawnEmber + the fire canvas's
// update/draw loop), with shadowBlur left off (no glow), flicker removed
// (constant brightness instead of the sine-wave pulse), a fast
// horizontal-biased "streak" kind, and angle ranges capped so every ember
// moves upward from spawn (and only ever accelerates further upward,
// never down).
//
// Scoped to a real in-flow element on every page (never position:fixed),
// so it scrolls with the page exactly like normal content instead of
// staying pinned to the viewport, and always bleeds UPWARD into the hero
// above it -- the same trick community.html uses: this element sits later
// in the DOM than the hero, both are effectively at z-index:0, and equal
// z-index ties resolve by DOM order, so this element (and its overflowing
// children) always wins and paints over the hero rather than disappearing
// behind it.
//
// Pages with a main.section-container (About, Bundles, Contact, FAQ,
// Legal, Software, Community) scope to that. Pages with only a hero and
// no main (Showroom, index) scope to the hero's own next sibling instead
// (the section right after it) -- same bleed-upward trick, just anchored
// to a different "comes right after the hero" element. If a scoped element
// isn't already positioned, it's nudged to position:relative (layout-
// neutral) so the embers' absolute positioning anchors to it instead of
// escaping to the page root -- and if it doesn't already have an explicit
// z-index, it's also given z-index:0, WITHOUT which position:relative
// alone still doesn't establish a stacking context, so the embers'
// negative z-index (see .rd-embers) would escape all the way up to the
// page root and get compared directly against the hero (or anything
// else) instead of staying contained locally, same as main.section-
// container already does for the Community page.
document.addEventListener("DOMContentLoaded", () => {
    const hero = document.querySelector(".rd-hero, .rd-featured-hero");
    const scopeEl = document.querySelector("main.section-container") ||
        (hero && hero.nextElementSibling) || hero;
    if (!scopeEl) return;

    const scopeCs = getComputedStyle(scopeEl);
    if (scopeCs.position === "static") scopeEl.style.position = "relative";
    if (scopeCs.zIndex === "auto") scopeEl.style.zIndex = "0";

    const container = document.createElement("div");
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    container.className = "rd-embers";
    scopeEl.prepend(container);

    let w = 0, h = 0;

    const ctx = canvas.getContext("2d");
    function resize() {
        w = container.clientWidth;
        h = container.clientHeight;
        canvas.width = w;
        canvas.height = h;
    }
    resize();
    window.addEventListener("resize", resize);

    const HUES = [8, 28, 42]; // red / orange / amber, matching the site's ember palette
    const SAT = 90;
    const EMBER_SPEED = 6;
    const ss = 6 / Math.max(EMBER_SPEED, 0.5);

    function spawnEmber() {
        const hue = HUES[Math.floor(Math.random() * HUES.length)] + (Math.random() - 0.5) * 10;
        const roll = Math.random();
        let kind, r, spd, maxLife;
        if (roll < 0.25) {
            kind = "tiny"; r = 0.6 + Math.random() * 1.0;
            spd = 0.3 + Math.random() * 1.2;
            maxLife = 60 + Math.random() * 80;
        } else if (roll < 0.55) {
            kind = "medium"; r = 1.3 + Math.random() * 1.6;
            spd = 0.2 + Math.random() * 0.9;
            maxLife = 100 + Math.random() * 140;
        } else if (roll < 0.8) {
            kind = "large"; r = 2.2 + Math.random() * 2.4;
            spd = 0.1 + Math.random() * 0.4;
            maxLife = 140 + Math.random() * 180;
        } else {
            // streak -- fast, mostly sideways, thin trail instead of a dot.
            kind = "streak"; r = 0.5 + Math.random() * 0.8;
            spd = 4 + Math.random() * 5;
            maxLife = 25 + Math.random() * 35;
        }
        // Capped at just under a full 180deg (never touching/crossing
        // horizontal) so every ember's initial vy is upward -- plus the
        // constant upward acceleration in the tick loop only ever makes vy
        // MORE negative over time, so none of them can drift downward
        // later either. Streaks get a much wider spread (near-horizontal
        // allowed) so they visibly dart left/right; the dot kinds stay
        // closer to a mostly-upward cone.
        const spread = kind === "streak" ? Math.PI * 0.94 : Math.PI * 0.9;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
        return {
            x: Math.random() * w, y: h * (0.6 + Math.random() * 0.4),
            vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
            r, life: 0, maxLife, hue, kind,
        };
    }

    const embers = [];
    const target = 80;
    while (embers.length < target) {
        const em = spawnEmber();
        em.life = Math.random() * em.maxLife;
        embers.push(em);
    }

    function tick() {
        resize();
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < embers.length; i++) {
            const em = embers[i];
            const px = em.x, py = em.y;
            em.x += em.vx * ss;
            em.y += em.vy * ss;
            em.vy -= 0.012 * ss;
            // Streaks get a much stronger horizontal jitter so they visibly
            // zigzag instead of darting off in one dead-straight line; the
            // dot kinds keep their original gentle wobble.
            const jitter = em.kind === "streak" ? 0.35 : 0.05;
            em.vx += (Math.random() - 0.5) * jitter * ss;
            em.life += ss;
            if (em.life >= em.maxLife || em.y < -h * 0.6) { embers[i] = spawnEmber(); continue; }

            const lf = em.life / em.maxLife;
            const fade = lf < 0.1 ? lf / 0.1 : lf > 0.72 ? 1 - (lf - 0.72) / 0.28 : 1;
            const bottomBand = h * 0.4;
            const vertFadeLinear = Math.max(0, Math.min(1, (h - em.y) / bottomBand));
            const vertFade = vertFadeLinear * vertFadeLinear;
            const a = fade * vertFade;
            if (a <= 0.01) continue;

            if (em.kind === "tiny") {
                ctx.beginPath();
                ctx.arc(em.x, em.y, em.r, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${em.hue},${SAT}%,88%,${a * 0.75})`;
                ctx.fill();
            } else if (em.kind === "medium") {
                ctx.beginPath();
                ctx.arc(em.x, em.y, em.r * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${em.hue},${SAT}%,78%,${a * 0.7})`;
                ctx.fill();
            } else if (em.kind === "large") {
                ctx.beginPath();
                ctx.arc(em.x, em.y, em.r * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${em.hue},${SAT}%,90%,${Math.min(1, a)})`;
                ctx.fill();
            } else {
                ctx.strokeStyle = `hsla(${em.hue},${SAT}%,85%,${a * 0.8})`;
                ctx.lineWidth = em.r;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(em.x, em.y);
                ctx.stroke();
            }
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
});
