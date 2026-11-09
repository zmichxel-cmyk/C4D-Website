document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".rd-nav").forEach((nav) => {
        const toggle = nav.querySelector(".rd-nav-toggle");
        const closeBtn = nav.querySelector(".rd-nav-close");
        const backdrop = nav.querySelector(".rd-nav-backdrop");
        if (!toggle) return;

        function setOpen(isOpen) {
            nav.classList.toggle("nav-open", isOpen);
            toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        }

        toggle.addEventListener("click", () => {
            setOpen(!nav.classList.contains("nav-open"));
        });
        closeBtn?.addEventListener("click", () => setOpen(false));
        backdrop?.addEventListener("click", () => setOpen(false));
    });
});
