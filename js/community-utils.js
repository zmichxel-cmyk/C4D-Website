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

// --- Tab switching (Suggestions / Connect / Clip of the Week) ---
document.addEventListener("DOMContentLoaded", () => {
    const tabBar = document.getElementById("community-tabs");
    if (!tabBar) return;

    tabBar.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab-btn");
        if (!btn || btn.classList.contains("active")) return;

        tabBar.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const target = btn.dataset.tab;
        document.querySelectorAll(".tab-panel").forEach(panel => {
            panel.classList.toggle("active", panel.dataset.tab === target);
        });
    });
});
