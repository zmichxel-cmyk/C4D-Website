document.addEventListener("DOMContentLoaded", () => {
    // Mark whichever nav link matches the current page as active (red
    // underline, see .rd-nav-links a.active in redesign-preview.css) --
    // compares each link's own filename against the page's, so it works
    // identically on every page without hardcoding an "active" class per
    // page in the HTML.
    const currentPage = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".rd-nav-links > li > a").forEach((link) => {
        const linkPage = link.getAttribute("href").split("/").pop();
        link.classList.toggle("active", linkPage === currentPage);
    });

    document.querySelectorAll(".rd-nav").forEach((nav) => {
        const toggle = nav.querySelector(".rd-nav-toggle");
        const closeBtn = nav.querySelector(".rd-nav-close");
        const backdrop = nav.querySelector(".rd-nav-backdrop");
        if (!toggle) return;

        let closeTimer = null;

        function setOpen(isOpen) {
            clearTimeout(closeTimer);
            if (isOpen) {
                nav.classList.remove("nav-closing");
                nav.classList.add("nav-open");
            } else {
                // Keep the header's backdrop-filter suppressed (via
                // nav-closing, same as nav-open does) for the drawer's
                // whole 0.3s slide-out. backdrop-filter on the header --
                // even applied the instant nav-open is removed -- makes
                // the header the containing block for the drawer's
                // position:fixed box, clipping it to the header's own
                // short height instead of the full viewport right as it
                // starts closing. A CSS transition can't avoid this (just
                // listing backdrop-filter in `transition` is enough to
                // trigger it), so the delay has to happen in JS instead.
                nav.classList.remove("nav-open");
                nav.classList.add("nav-closing");
                closeTimer = setTimeout(() => nav.classList.remove("nav-closing"), 320);
            }
            toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        }

        toggle.addEventListener("click", () => {
            setOpen(!nav.classList.contains("nav-open"));
        });
        closeBtn?.addEventListener("click", () => setOpen(false));
        backdrop?.addEventListener("click", () => setOpen(false));
    });
});
