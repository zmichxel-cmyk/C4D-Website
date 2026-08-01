// Community comments/ratings/likes -- backed by Supabase.
// Fill these in from your Supabase project's Settings -> API page.
const SUPABASE_URL = "https://ypzazhjyrvhbjcjgowbl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwemF6aGp5cnZoYmpjamdvd2JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1NDIyMDgsImV4cCI6MjEwMTExODIwOH0.WnYy1FuC7XS-wc4M_4-Two4H0qmasMzUk-9Q016xrGo";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("comment-form");
    const list = document.getElementById("comments-list");
    const statusEl = document.getElementById("comment-form-status");
    const starPicker = document.getElementById("star-picker");
    const sortToggle = document.getElementById("sort-toggle");

    if (!form || !list) return;

    if (SUPABASE_URL === "YOUR_SUPABASE_PROJECT_URL") {
        list.innerHTML = '<p class="comments-empty">Comments aren\'t connected yet.</p>';
        form.querySelector(".btn-submit").disabled = true;
        return;
    }

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let currentSort = "likes"; // "likes" | "newest"
    let submitting = false;

    // Stable per-browser id so the same visitor can't like a comment twice.
    function getVisitorId() {
        let id = localStorage.getItem("c4d-visitor-id");
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem("c4d-visitor-id", id);
        }
        return id;
    }

    function getLikedSet() {
        try {
            return new Set(JSON.parse(localStorage.getItem("c4d-liked-comments") || "[]"));
        } catch {
            return new Set();
        }
    }
    function saveLikedSet(set) {
        localStorage.setItem("c4d-liked-comments", JSON.stringify([...set]));
    }

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

    function renderStars(rating) {
        if (!rating) return "";
        let html = '<div class="star-display">';
        for (let i = 1; i <= 5; i++) {
            html += `<span class="star ${i <= rating ? "filled" : ""}">&#9733;</span>`;
        }
        return html + "</div>";
    }

    function renderComments(comments) {
        if (comments.length === 0) {
            list.innerHTML = '<p class="comments-empty">No comments yet — be the first to share your thoughts.</p>';
            return;
        }
        const liked = getLikedSet();
        list.innerHTML = comments.map(c => `
            <div class="comment-card" data-id="${c.id}">
                <div class="comment-card-header">
                    <span class="comment-name">${escapeHtml(c.name)}</span>
                    <span class="comment-time">${timeAgo(c.created_at)}</span>
                </div>
                ${renderStars(c.rating)}
                <p class="comment-text">${escapeHtml(c.comment)}</p>
                <button type="button" class="like-btn ${liked.has(c.id) ? "liked" : ""}" data-id="${c.id}">
                    <i class="fa-solid fa-heart"></i> <span class="like-count">${c.likes_count}</span>
                </button>
            </div>
        `).join("");
    }

    async function loadComments() {
        list.innerHTML = '<p class="comments-empty">Loading comments…</p>';
        const { data, error } = await supabase
            .from("community_comments")
            .select("id, name, comment, rating, likes_count, created_at")
            .order(currentSort === "likes" ? "likes_count" : "created_at", { ascending: false });

        if (error) {
            list.innerHTML = '<p class="comments-empty">Couldn\'t load comments right now.</p>';
            return;
        }
        renderComments(data);
    }

    // --- Star picker ---
    starPicker.addEventListener("click", (e) => {
        const btn = e.target.closest(".star-btn");
        if (!btn) return;
        const value = Number(btn.dataset.value);
        starPicker.dataset.rating = starPicker.dataset.rating === String(value) ? "0" : String(value);
        const active = Number(starPicker.dataset.rating);
        starPicker.querySelectorAll(".star-btn").forEach(b => {
            b.classList.toggle("selected", Number(b.dataset.value) <= active);
        });
    });

    // --- Sort toggle ---
    sortToggle.addEventListener("click", (e) => {
        const btn = e.target.closest(".sort-btn");
        if (!btn || btn.classList.contains("active")) return;
        sortToggle.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentSort = btn.dataset.sort;
        loadComments();
    });

    // --- Like button (event delegation) ---
    list.addEventListener("click", async (e) => {
        const btn = e.target.closest(".like-btn");
        if (!btn) return;
        btn.disabled = true;
        const commentId = btn.dataset.id;
        const { data, error } = await supabase.rpc("toggle_like", {
            p_comment_id: commentId,
            p_visitor_id: getVisitorId(),
        });
        btn.disabled = false;
        if (error || !data || !data[0]) return;

        const { likes_count, liked } = data[0];
        btn.classList.toggle("liked", liked);
        btn.querySelector(".like-count").textContent = likes_count;

        const likedSet = getLikedSet();
        if (liked) likedSet.add(commentId); else likedSet.delete(commentId);
        saveLikedSet(likedSet);
    });

    // --- Submit form ---
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;

        // Honeypot -- real users never fill this in.
        if (form.querySelector("#comment-website").value.trim() !== "") {
            statusEl.textContent = "";
            form.reset();
            return;
        }

        const name = form.querySelector("#comment-name").value.trim();
        const comment = form.querySelector("#comment-text").value.trim();
        const rating = Number(starPicker.dataset.rating) || null;

        if (!name || !comment) return;

        submitting = true;
        const submitBtn = form.querySelector(".btn-submit");
        submitBtn.disabled = true;
        statusEl.textContent = "Posting…";

        const { error } = await supabase.from("community_comments").insert({
            name: name.slice(0, 40),
            comment: comment.slice(0, 500),
            rating,
        });

        submitting = false;
        submitBtn.disabled = false;

        if (error) {
            statusEl.textContent = "Something went wrong — try again.";
            return;
        }

        statusEl.textContent = "Posted!";
        form.reset();
        starPicker.dataset.rating = "0";
        starPicker.querySelectorAll(".star-btn").forEach(b => b.classList.remove("selected"));
        setTimeout(() => { statusEl.textContent = ""; }, 2500);

        loadComments();
    });

    loadComments();
});
