// Small helpers shared by community.js and connect.js.

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function timeAgo(isoString) {
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    const units = [
        ["year", 31536000], ["month", 2592000], ["day", 86400],
        ["hour", 3600], ["minute", 60],
    ];
    for (const [label, secs] of units) {
        const value = Math.floor(seconds / secs);
        if (value >= 1) return `${value} ${label}${value > 1 ? "s" : ""} ago`;
    }
    return "just now";
}

// Stable per-browser id so the same visitor can't like the same
// comment/post twice.
function getVisitorId() {
    let id = localStorage.getItem("c4d-visitor-id");
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("c4d-visitor-id", id);
    }
    return id;
}

function getLikedSet(storageKey) {
    try {
        return new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    } catch {
        return new Set();
    }
}
function saveLikedSet(storageKey, set) {
    localStorage.setItem(storageKey, JSON.stringify([...set]));
}

// Measures what `container`'s natural (unclamped) height would be, without
// ever touching the live element's own height -- doing that on the live
// element forces a real synchronous layout pass that can momentarily shrink
// the actual page and trip the browser's own scroll-clamping before we get
// a chance to lock the height back, which is what caused the scroll jump.
function measureNaturalHeight(container) {
    const clone = container.cloneNode(true);
    clone.classList.remove("slide-anim");
    clone.style.cssText = `position:absolute; visibility:hidden; left:-9999px; top:0; height:auto; width:${container.offsetWidth}px;`;
    document.body.appendChild(clone);
    const height = clone.scrollHeight;
    document.body.removeChild(clone);
    return height;
}

// Fades + slides `container`'s content out, runs `renderFn` (may be async
// -- swap innerHTML, toggle classes, refetch data, whatever), then slides
// the new content in from the opposite side. `direction` is 1 (content
// moving right-to-left, i.e. advancing forward) or -1 (moving backward).
// Used for the top-level tabs, the sort toggle, and the category filter so
// they all share one consistent "slide" feel instead of an instant swap.
function slideSwap(container, direction, renderFn) {
    return new Promise((resolve) => {
        // Preserve scroll position across the whole swap as a safety net --
        // belt-and-suspenders alongside the height lock below, in case
        // anything else (focus loss when content is replaced, etc.) nudges it.
        const scrollY = window.scrollY;

        // Lock the container to its current height first -- otherwise, when the
        // new content is shorter/taller (e.g. filtering to a category with
        // fewer posts), the page's total height snaps instantly and drags the
        // scroll position with it, which reads as a jarring jump.
        const oldHeight = container.offsetHeight;
        container.style.height = `${oldHeight}px`;
        container.style.overflow = "hidden";

        container.classList.add("slide-anim");
        container.style.transform = `translateX(${-direction * 40}px)`;
        container.style.opacity = "0";

        setTimeout(async () => {
            await renderFn();
            if (window.scrollY !== scrollY) window.scrollTo(0, scrollY);

            container.style.transition = "none";
            container.style.transform = `translateX(${direction * 40}px)`;
            container.style.opacity = "0";
            void container.offsetWidth; // force reflow so the next transition actually animates
            container.style.transition = "";

            const newHeight = measureNaturalHeight(container);

            // A plain timeout (rather than requestAnimationFrame) reliably fires
            // even when the tab/pane isn't actively compositing frames.
            setTimeout(() => {
                container.style.transform = "translateX(0)";
                container.style.opacity = "1";
                container.style.height = `${newHeight}px`;
                if (window.scrollY !== scrollY) window.scrollTo(0, scrollY);
            }, 20);

            // Release the fixed height once the animation settles so later,
            // unrelated content changes (async replies loading in, etc.)
            // aren't constrained by a stale height.
            setTimeout(() => {
                container.style.height = "";
                container.style.overflow = "";
            }, 20 + 260);

            resolve();
        }, 200);
    });
}

// --- Tab switching (Suggestions / Connect / Clip of the Week) ---
document.addEventListener("DOMContentLoaded", () => {
    const tabBar = document.getElementById("community-tabs");
    const tabPanels = document.getElementById("tab-panels");
    if (!tabBar || !tabPanels) return;

    const TAB_ORDER = ["suggestions", "connect", "clip"];
    let currentTab = "suggestions";

    tabBar.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab-btn");
        if (!btn || btn.classList.contains("active")) return;

        const target = btn.dataset.tab;
        const direction = TAB_ORDER.indexOf(target) > TAB_ORDER.indexOf(currentTab) ? 1 : -1;

        tabBar.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        slideSwap(tabPanels, direction, () => {
            document.querySelectorAll(".tab-panel").forEach(panel => {
                panel.classList.toggle("active", panel.dataset.tab === target);
            });
        });

        currentTab = target;
    });
});
