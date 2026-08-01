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

        const SORT_ORDER = ["likes", "newest"];
        sortToggle.addEventListener("click", (e) => {
            const btn = e.target.closest(".sort-btn");
            if (!btn || btn.classList.contains("active")) return;
            sortToggle.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const direction = SORT_ORDER.indexOf(btn.dataset.sort) > SORT_ORDER.indexOf(currentSort) ? 1 : -1;
            currentSort = btn.dataset.sort;
            slideSwap(list, direction, loadComments);
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

        const CLIP_LIKED_KEY = "c4d-liked-clip-comments";

        function getYouTubeEmbedUrl(url) {
            const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
            return match ? `https://www.youtube.com/embed/${match[1]}` : null;
        }

        function renderFrame(clip) {
            if (!clip) {
                return '<p class="clip-placeholder-text">Video will appear here</p>';
            }
            const embedUrl = getYouTubeEmbedUrl(clip.url);
            return embedUrl
                ? `<iframe src="${embedUrl}" title="${escapeHtml(clip.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
                : `<a class="btn-primary clip-watch-btn" href="${escapeHtml(clip.url)}" target="_blank" rel="noopener noreferrer">Watch Clip</a>`;
        }

        function renderClipComments(comments) {
            const list = container.querySelector("#clip-comments-list");
            if (!list) return;
            if (comments.length === 0) {
                list.innerHTML = '<p class="comments-empty">No comments yet — be the first to share your thoughts.</p>';
                return;
            }
            const liked = getLikedSet(CLIP_LIKED_KEY);
            list.innerHTML = comments.map(c => `
                <div class="comment-card" data-id="${c.id}">
                    <div class="comment-card-header">
                        <span class="comment-name">${escapeHtml(c.name)}</span>
                        <span class="comment-time">${timeAgo(c.created_at)}</span>
                    </div>
                    <p class="comment-text">${escapeHtml(c.comment)}</p>
                    <button type="button" class="like-btn ${liked.has(c.id) ? "liked" : ""}" data-id="${c.id}">
                        <i class="fa-solid fa-heart"></i> <span class="like-count">${c.likes_count}</span>
                    </button>
                </div>
            `).join("");
        }

        async function loadClipComments(clipId) {
            const list = container.querySelector("#clip-comments-list");
            if (list) list.innerHTML = '<p class="comments-empty">Loading comments…</p>';
            const { data, error } = await supabase
                .from("community_clip_comments")
                .select("id, name, comment, likes_count, created_at")
                .eq("clip_id", clipId)
                .order("created_at", { ascending: false });

            if (error) {
                if (list) list.innerHTML = '<p class="comments-empty">Couldn\'t load comments right now.</p>';
                return;
            }
            renderClipComments(data);
        }

        function wireClipCommentSection(clipId) {
            const form = container.querySelector("#clip-comment-form");
            const list = container.querySelector("#clip-comments-list");
            const statusEl = container.querySelector("#clip-comment-form-status");
            if (!form || !list) return;
            let submitting = false;

            list.addEventListener("click", async (e) => {
                const btn = e.target.closest(".like-btn");
                if (!btn) return;
                btn.disabled = true;
                const commentId = btn.dataset.id;
                const { data, error } = await supabase.rpc("toggle_clip_comment_like", {
                    p_comment_id: commentId,
                    p_visitor_id: getVisitorId(),
                });
                btn.disabled = false;
                if (error || !data || !data[0]) return;

                const { likes_count, liked } = data[0];
                btn.classList.toggle("liked", liked);
                btn.querySelector(".like-count").textContent = likes_count;

                const likedSet = getLikedSet(CLIP_LIKED_KEY);
                if (liked) likedSet.add(commentId); else likedSet.delete(commentId);
                saveLikedSet(CLIP_LIKED_KEY, likedSet);
            });

            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                if (submitting) return;

                // Honeypot -- real users never fill this in.
                if (form.querySelector(".clip-comment-hp").value.trim() !== "") {
                    form.reset();
                    return;
                }

                const name = form.querySelector("#clip-comment-name").value.trim();
                const comment = form.querySelector("#clip-comment-text").value.trim();
                if (!name || !comment) return;

                submitting = true;
                const submitBtn = form.querySelector(".btn-submit");
                submitBtn.disabled = true;
                statusEl.textContent = "Posting…";

                const { error } = await supabase.from("community_clip_comments").insert({
                    clip_id: clipId,
                    name: name.slice(0, 40),
                    comment: comment.slice(0, 500),
                });

                submitting = false;
                submitBtn.disabled = false;

                if (error) {
                    statusEl.textContent = "Something went wrong — try again.";
                    return;
                }

                statusEl.textContent = "Posted!";
                form.reset();
                setTimeout(() => { statusEl.textContent = ""; }, 2500);

                loadClipComments(clipId);
            });

            loadClipComments(clipId);
        }

        async function loadClip() {
            container.innerHTML = '<p class="comments-empty">Loading clip…</p>';
            const { data, error } = await supabase
                .from("community_clips")
                .select("id, title, url, streamer_name, created_at")
                .order("created_at", { ascending: false })
                .limit(1);

            const clip = (!error && data && data.length > 0) ? data[0] : null;

            container.innerHTML = `
                <div class="clip-header">
                    <h3 class="clip-title">${clip ? escapeHtml(clip.title) : "No clip posted yet"}</h3>
                    ${clip && clip.streamer_name ? `<p class="clip-streamer">Featuring ${escapeHtml(clip.streamer_name)}</p>` : ""}
                </div>

                <div class="clip-frame">
                    ${renderFrame(clip)}
                </div>

                ${clip ? `
                    <div class="comments-section clip-comments-section">
                        <form id="clip-comment-form" class="comment-form">
                            <div class="form-group">
                                <label for="clip-comment-name">Name</label>
                                <input type="text" id="clip-comment-name" maxlength="40" placeholder="e.g., StreamerNameTV" required>
                            </div>
                            <div class="form-group">
                                <label for="clip-comment-text">Comment</label>
                                <textarea id="clip-comment-text" rows="3" maxlength="500" placeholder="What did you think of this clip?" required></textarea>
                            </div>
                            <!-- Honeypot: hidden from real users, bots tend to fill every field -->
                            <div class="form-group hp-field" aria-hidden="true">
                                <label for="clip-comment-website">Website</label>
                                <input type="text" id="clip-comment-website" class="clip-comment-hp" tabindex="-1" autocomplete="off">
                            </div>
                            <button type="submit" class="btn-submit">Post Comment</button>
                            <p id="clip-comment-form-status" class="comment-form-status"></p>
                        </form>

                        <div class="comments-header">
                            <h3>Comments</h3>
                        </div>

                        <div id="clip-comments-list" class="comments-list">
                            <p class="comments-empty">Loading comments…</p>
                        </div>
                    </div>
                ` : ""}
            `;

            if (clip) wireClipCommentSection(clip.id);
        }

        loadClip();
    })();
});
