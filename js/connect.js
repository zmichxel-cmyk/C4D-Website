// Connect tab -- mini forum: posts (with category), flat replies, likes.
// Backed by Supabase -- see js/supabase-client.js for the client.

document.addEventListener("DOMContentLoaded", () => {
    const supabase = window.supabaseClient;

    const form = document.getElementById("post-form");
    const feed = document.getElementById("post-feed");
    const statusEl = document.getElementById("post-form-status");
    const categoryFilter = document.getElementById("category-filter");
    const pagination = document.getElementById("posts-pagination");
    const prevPageBtn = document.getElementById("posts-prev-page");
    const nextPageBtn = document.getElementById("posts-next-page");
    const pageIndicator = document.getElementById("posts-page-indicator");
    wireRevealButton(document.getElementById("posts-reveal-btn"), document.getElementById("posts-reveal-wrap"), "Posts");

    if (!form || !feed) return;

    if (!supabase) {
        feed.innerHTML = '<p class="comments-empty">Connect isn\'t connected yet.</p>';
        form.querySelector(".btn-submit").disabled = true;
        return;
    }

    const CATEGORY_LABELS = { lfg: "Looking For Group", game_chat: "Game Chat", general: "General" };
    const LIKED_KEY = "c4d-liked-posts";
    const PAGE_SIZE = 4;

    let currentCategory = "all";
    let submittingPost = false;
    let currentPage = 1;
    const expandedPosts = new Set();

    function categoryBadge(category) {
        return `<span class="category-badge category-${category}">${CATEGORY_LABELS[category] || category}</span>`;
    }

    async function loadReplies(postId) {
        const repliesEl = feed.querySelector(`.reply-list[data-post-id="${postId}"]`);
        if (!repliesEl) return;
        repliesEl.innerHTML = '<p class="comments-empty">Loading replies…</p>';

        const { data, error } = await supabase
            .from("community_post_replies")
            .select("id, name, body, created_at")
            .eq("post_id", postId)
            .order("created_at", { ascending: true });

        if (error) {
            repliesEl.innerHTML = '<p class="comments-empty">Couldn\'t load replies.</p>';
            return;
        }
        repliesEl.innerHTML = data.length === 0
            ? '<p class="comments-empty">No replies yet.</p>'
            : data.map(r => `
                <div class="reply-item">
                    <div class="comment-card-header">
                        <span class="comment-name">${escapeHtml(r.name)}</span>
                        <span class="comment-time">${timeAgo(r.created_at)}</span>
                    </div>
                    <p class="comment-text">${escapeHtml(r.body)}</p>
                </div>
            `).join("");
    }

    function postCardHtml(p, liked) {
        return `
            <div class="post-card" data-id="${p.id}">
                <div class="comment-card-header">
                    <span class="comment-name">${escapeHtml(p.name)}</span>
                    <span class="comment-time">${timeAgo(p.created_at)}</span>
                </div>
                ${categoryBadge(p.category)}
                <h4 class="post-title">${escapeHtml(p.title)}</h4>
                <p class="comment-text">${escapeHtml(p.body)}</p>
                <div class="post-actions">
                    <button type="button" class="like-btn ${liked.has(p.id) ? "liked" : ""}" data-id="${p.id}">
                        <i class="fa-solid fa-heart"></i> <span class="like-count">${p.likes_count}</span>
                    </button>
                    <button type="button" class="reply-toggle-btn" data-id="${p.id}">
                        <i class="fa-solid fa-comments"></i> Replies
                    </button>
                </div>
                <div class="post-thread" data-id="${p.id}" style="display:none">
                    <div class="reply-list" data-post-id="${p.id}"></div>
                    <form class="reply-form" data-post-id="${p.id}">
                        <input type="text" class="reply-name" maxlength="40" placeholder="Your name" required>
                        <textarea class="reply-body" maxlength="500" rows="2" placeholder="Write a reply…" required></textarea>
                        <input type="text" class="reply-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
                        <button type="submit" class="btn-submit reply-submit-btn">Reply</button>
                    </form>
                </div>
            </div>
        `;
    }

    function renderPosts(posts) {
        if (posts.length === 0) {
            feed.innerHTML = currentPage === 1
                ? '<p class="comments-empty">No posts yet — be the first to say something.</p>'
                : '<p class="comments-empty">No more posts.</p>';
            return;
        }
        const liked = getLikedSet(LIKED_KEY);
        feed.innerHTML = posts.map(p => postCardHtml(p, liked)).join("");

        // Re-expand any threads the user already had open before this re-render.
        expandedPosts.forEach(postId => {
            const thread = feed.querySelector(`.post-thread[data-id="${postId}"]`);
            if (thread) {
                thread.style.display = "block";
                loadReplies(postId);
            }
        });
    }

    // reset=true starts over at page 1 (new category, new post); otherwise
    // reloads whatever currentPage already is (Prev/Next click).
    async function loadPosts(reset = true) {
        if (reset) currentPage = 1;
        const offset = (currentPage - 1) * PAGE_SIZE;

        let query = supabase
            .from("community_posts")
            .select("id, name, category, title, body, likes_count, created_at")
            .order("created_at", { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);

        if (currentCategory !== "all") query = query.eq("category", currentCategory);

        const { data, error } = await query;
        if (error) {
            feed.innerHTML = '<p class="comments-empty">Couldn\'t load posts right now.</p>';
            return;
        }
        renderPosts(data);
        pagination.style.display = currentPage > 1 || data.length === PAGE_SIZE ? "flex" : "none";
        pageIndicator.textContent = `Page ${currentPage}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = data.length < PAGE_SIZE;
    }

    prevPageBtn.addEventListener("click", () => {
        if (currentPage === 1) return;
        currentPage -= 1;
        slideSwap(feed, -1, () => loadPosts(false));
    });
    nextPageBtn.addEventListener("click", () => {
        currentPage += 1;
        slideSwap(feed, 1, () => loadPosts(false));
    });

    // --- Category filter ---
    const CATEGORY_ORDER = ["all", "lfg", "game_chat", "general"];
    categoryFilter.addEventListener("click", (e) => {
        const btn = e.target.closest(".category-btn");
        if (!btn || btn.classList.contains("active")) return;
        categoryFilter.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const direction = CATEGORY_ORDER.indexOf(btn.dataset.category) > CATEGORY_ORDER.indexOf(currentCategory) ? 1 : -1;
        currentCategory = btn.dataset.category;
        slideSwap(feed, direction, loadPosts);
    });

    // --- Feed interactions: like, expand/collapse thread, reply submit ---
    feed.addEventListener("click", async (e) => {
        const likeBtn = e.target.closest(".like-btn");
        if (likeBtn) {
            likeBtn.disabled = true;
            const postId = likeBtn.dataset.id;
            const { data, error } = await supabase.rpc("toggle_post_like", {
                p_post_id: postId,
                p_visitor_id: getVisitorId(),
            });
            likeBtn.disabled = false;
            if (error || !data || !data[0]) return;

            const { likes_count, liked } = data[0];
            likeBtn.classList.toggle("liked", liked);
            likeBtn.querySelector(".like-count").textContent = likes_count;

            const likedSet = getLikedSet(LIKED_KEY);
            if (liked) likedSet.add(postId); else likedSet.delete(postId);
            saveLikedSet(LIKED_KEY, likedSet);
            return;
        }

        const replyToggleBtn = e.target.closest(".reply-toggle-btn");
        if (replyToggleBtn) {
            const postId = replyToggleBtn.dataset.id;
            const thread = feed.querySelector(`.post-thread[data-id="${postId}"]`);
            const isOpen = thread.style.display !== "none";
            thread.style.display = isOpen ? "none" : "block";
            if (isOpen) {
                expandedPosts.delete(postId);
            } else {
                expandedPosts.add(postId);
                loadReplies(postId);
            }
        }
    });

    feed.addEventListener("submit", async (e) => {
        const replyForm = e.target.closest(".reply-form");
        if (!replyForm) return;
        e.preventDefault();

        // Honeypot -- real users never fill this in.
        if (replyForm.querySelector(".reply-hp").value.trim() !== "") {
            replyForm.reset();
            return;
        }

        const postId = replyForm.dataset.postId;
        const name = replyForm.querySelector(".reply-name").value.trim();
        const body = replyForm.querySelector(".reply-body").value.trim();
        if (!name || !body) return;

        const submitBtn = replyForm.querySelector(".reply-submit-btn");
        submitBtn.disabled = true;

        const { error } = await supabase.from("community_post_replies").insert({
            post_id: postId,
            name: name.slice(0, 40),
            body: body.slice(0, 500),
        });

        submitBtn.disabled = false;
        if (error) return;

        replyForm.reset();
        loadReplies(postId);
    });

    // --- New post form ---
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submittingPost) return;

        // Honeypot -- real users never fill this in.
        if (form.querySelector("#post-website").value.trim() !== "") {
            statusEl.textContent = "";
            form.reset();
            return;
        }

        const name = form.querySelector("#post-name").value.trim();
        const category = form.querySelector("#post-category").value;
        const title = form.querySelector("#post-title").value.trim();
        const body = form.querySelector("#post-body").value.trim();

        if (!name || !category || !title || !body) return;

        submittingPost = true;
        const submitBtn = form.querySelector(".btn-submit");
        submitBtn.disabled = true;
        statusEl.textContent = "Posting…";

        const { error } = await supabase.from("community_posts").insert({
            name: name.slice(0, 40),
            category,
            title: title.slice(0, 100),
            body: body.slice(0, 1000),
        });

        submittingPost = false;
        submitBtn.disabled = false;

        if (error) {
            statusEl.textContent = "Something went wrong — try again.";
            return;
        }

        statusEl.textContent = "Posted!";
        form.reset();
        setTimeout(() => { statusEl.textContent = ""; }, 2500);

        loadPosts();
    });

    loadPosts();
});
