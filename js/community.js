// Suggestions tab (comments/ratings/likes) + Clip of the Week tab.
// Both backed by Supabase -- see js/supabase-client.js for the client.

document.addEventListener("DOMContentLoaded", () => {
    const supabase = window.supabaseClient;

    // --- Suggestions tab ---
    (function initSuggestions() {
        const form = document.getElementById("comment-form");
        const list = document.getElementById("comments-list");
        const statusEl = document.getElementById("comment-form-status");
        const starPicker = document.getElementById("star-picker");
        const sortToggle = document.getElementById("sort-toggle");

        if (!form || !list) return;

        if (!supabase) {
            list.innerHTML = '<p class="comments-empty">Comments aren\'t connected yet.</p>';
            form.querySelector(".btn-submit").disabled = true;
            return;
        }

        let currentSort = "likes"; // "likes" | "newest"
        let submitting = false;
        const LIKED_KEY = "c4d-liked-comments";

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
            const liked = getLikedSet(LIKED_KEY);
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

        sortToggle.addEventListener("click", (e) => {
            const btn = e.target.closest(".sort-btn");
            if (!btn || btn.classList.contains("active")) return;
            sortToggle.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentSort = btn.dataset.sort;
            loadComments();
        });

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

            const likedSet = getLikedSet(LIKED_KEY);
            if (liked) likedSet.add(commentId); else likedSet.delete(commentId);
            saveLikedSet(LIKED_KEY, likedSet);
        });

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
    })();

    // --- Clip of the Week tab ---
    (function initClipOfWeek() {
        const container = document.getElementById("clip-of-week");
        if (!container) return;

        if (!supabase) {
            container.innerHTML = '<p class="comments-empty">Clips aren\'t connected yet.</p>';
            return;
        }

        function getYouTubeEmbedUrl(url) {
            const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
            return match ? `https://www.youtube.com/embed/${match[1]}` : null;
        }

        async function loadClip() {
            container.innerHTML = '<p class="comments-empty">Loading clip…</p>';
            const { data, error } = await supabase
                .from("community_clips")
                .select("title, url, created_at")
                .order("created_at", { ascending: false })
                .limit(1);

            if (error || !data || data.length === 0) {
                container.innerHTML = '<p class="comments-empty">No clip posted yet — check back soon.</p>';
                return;
            }

            const clip = data[0];
            const embedUrl = getYouTubeEmbedUrl(clip.url);

            container.innerHTML = `
                <div class="clip-card">
                    <h3 class="clip-title">${escapeHtml(clip.title)}</h3>
                    ${embedUrl
                        ? `<div class="clip-embed"><iframe src="${embedUrl}" title="${escapeHtml(clip.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
                        : `<a class="btn-primary clip-watch-btn" href="${escapeHtml(clip.url)}" target="_blank" rel="noopener noreferrer">Watch Clip</a>`
                    }
                </div>
            `;
        }

        loadClip();
    })();
});
