/* =========================================================================
   West Coast Plant Project (plantproject.ca)
   Shared Layout, Theme, Header Utilities & Dataset Helper Script
   ========================================================================= */
(function (global) {
    "use strict";

    // Ensure shared CSS is loaded
    if (!document.querySelector('link[href*="css/site.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "css/site.css?v=20261116b";
        document.head.appendChild(link);
    }

    // Ensure WCPPAdmin is loaded if somehow missing
    if (!global.WCPPAdmin && !document.querySelector('script[src*="js/admin.js"]')) {
        const sc = document.createElement("script");
        sc.src = "js/admin.js?v=20261116b";
        document.head.appendChild(sc);
    }

    // Shared JSON unpacker: handles both array-of-objects and compact {columns, rows}
    global.unpackDatasetJson = function (data) {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.columns) && Array.isArray(data.rows)) {
            const cols = data.columns;
            return data.rows.map(r => {
                const obj = {};
                for (let i = 0; i < cols.length; i++) obj[cols[i]] = r[i] || "";
                return obj;
            });
        }
        return [];
    };

    const SUN_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    const MOON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    function applyThemeFromStorage() {
        const isDark = localStorage.getItem("theme") === "dark";
        if (document.body) document.body.classList.toggle("dark-mode", isDark);
        syncThemeIcons(isDark);
    }

    function syncThemeIcons(isDark) {
        const mode = isDark ? "dark" : "light";
        const legacyBtn = document.getElementById("themeToggleBtn");
        if (legacyBtn && legacyBtn.dataset.themeState !== mode) {
            legacyBtn.dataset.themeState = mode;
            legacyBtn.innerHTML = isDark ? "☀️" : "🌙";
        }

        const headerBtn = document.getElementById("headerThemeToggleBtn");
        if (headerBtn) {
            if (headerBtn.dataset.themeState !== mode) {
                headerBtn.dataset.themeState = mode;
                headerBtn.innerHTML = isDark ? SUN_SVG : MOON_SVG;
                headerBtn.setAttribute("title", isDark ? "Switch to Light Mode" : "Switch to Dark Mode");
                headerBtn.setAttribute("aria-label", isDark ? "Switch to Light Mode" : "Switch to Dark Mode");
            }
            if (document.body && !document.body.classList.contains("has-docked-theme-btn")) {
                document.body.classList.add("has-docked-theme-btn");
            }
        }

        const mobileBtn = document.getElementById("mobileThemeBtn");
        if (mobileBtn && mobileBtn.dataset.themeState !== mode) {
            mobileBtn.dataset.themeState = mode;
            mobileBtn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
        }
    }

    global.toggleSiteTheme = function () {
        if (!document.body) return;
        document.body.classList.toggle("dark-mode");
        const isDark = document.body.classList.contains("dark-mode");
        localStorage.setItem("theme", isDark ? "dark" : "light");
        syncThemeIcons(isDark);
    };

    // Standard Drawer Helpers (safe to override or share across all pages)
    global.openDrawer = function () {
        const d = document.getElementById("mobile-drawer");
        const bd = document.getElementById("mobile-drawer-backdrop");
        if (d) { d.classList.add("active"); document.body.style.overflow = "hidden"; }
        if (bd) bd.classList.add("active");
    };
    global.closeDrawer = function () {
        const d = document.getElementById("mobile-drawer");
        const bd = document.getElementById("mobile-drawer-backdrop");
        if (d) { d.classList.remove("active"); document.body.style.overflow = "auto"; }
        if (bd) bd.classList.remove("active");
    };
    function handleMpanelToggle(id, btnEl) {
        const el = document.getElementById(id);
        if (!el) return;
        const isOpen = el.classList.toggle("show");
        const trigger = btnEl || document.querySelector(`.m-accordion-trigger[data-panel="${id}"], .m-accordion-trigger[aria-controls="${id}"]`);
        if (trigger) {
            trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
            trigger.classList.toggle("collapsed", !isOpen);
        }
    }
    global.toggleMpanel = handleMpanelToggle;

    function markActiveNavLinks() {
        let currentFile = (global.location && global.location.pathname ? global.location.pathname.split("/").pop() : "") || "index.html";
        if (!currentFile || currentFile === "/") currentFile = "index.html";
        document.querySelectorAll("#desktop-nav a[href], #mobile-drawer a[href]").forEach(a => {
            const href = a.getAttribute("href") || "";
            if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("http")) return;
            const linkFile = href.split("/").pop().split("?")[0].split("#")[0];
            if (linkFile === currentFile && !a.classList.contains("cta-button")) {
                a.classList.add("active");
            } else {
                a.classList.remove("active");
            }
        });
    }

    function bindHeaderUtilities(forceSync = false) {
        let anyNewlyBound = false;
        const mobileToggle = document.getElementById("mobile-toggle");
        if (mobileToggle && !mobileToggle._bound) {
            mobileToggle._bound = true;
            anyNewlyBound = true;
            mobileToggle.onclick = () => {
                if (typeof global.openDrawer === "function") global.openDrawer();
                const bd = document.getElementById("mobile-drawer-backdrop");
                if (bd) bd.classList.add("active");
            };
        }
        const mobileClose = document.querySelector("#mobile-drawer .m-close-btn");
        if (mobileClose && !mobileClose._bound) {
            mobileClose._bound = true;
            anyNewlyBound = true;
            mobileClose.onclick = () => {
                if (typeof global.closeDrawer === "function") global.closeDrawer();
                const bd = document.getElementById("mobile-drawer-backdrop");
                if (bd) bd.classList.remove("active");
            };
        }
        const mobileBd = document.getElementById("mobile-drawer-backdrop");
        if (mobileBd && !mobileBd._bound) {
            mobileBd._bound = true;
            anyNewlyBound = true;
            mobileBd.onclick = () => {
                if (typeof global.closeDrawer === "function") global.closeDrawer();
                mobileBd.classList.remove("active");
            };
        }
        document.querySelectorAll("#mobile-drawer .m-accordion-trigger[data-panel]").forEach(btn => {
            if (btn._bound) return;
            btn._bound = true;
            anyNewlyBound = true;
            btn.onclick = (e) => {
                if (e) e.preventDefault();
                handleMpanelToggle(btn.getAttribute("data-panel"), btn);
            };
        });
        document.querySelectorAll("#desktop-nav .desktop-dd").forEach(dd => {
            if (dd._ddBound) return;
            dd._ddBound = true;
            anyNewlyBound = true;
            dd.addEventListener("click", (e) => {
                if (e.target.closest(".dd-menu a")) {
                    dd.classList.remove("open");
                    dd.setAttribute("aria-expanded", "false");
                    return;
                }
                e.stopPropagation();
                const willOpen = !dd.classList.contains("open");
                document.querySelectorAll("#desktop-nav .desktop-dd.open").forEach(other => {
                    other.classList.remove("open");
                    other.setAttribute("aria-expanded", "false");
                });
                dd.classList.toggle("open", willOpen);
                dd.setAttribute("aria-expanded", willOpen ? "true" : "false");
            });
            dd.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    if (e.target.closest(".dd-menu a")) return;
                    e.preventDefault();
                    const willOpen = !dd.classList.contains("open");
                    document.querySelectorAll("#desktop-nav .desktop-dd.open").forEach(other => {
                        other.classList.remove("open");
                        other.setAttribute("aria-expanded", "false");
                    });
                    dd.classList.toggle("open", willOpen);
                    dd.setAttribute("aria-expanded", willOpen ? "true" : "false");
                } else if (e.key === "Escape") {
                    dd.classList.remove("open");
                    dd.setAttribute("aria-expanded", "false");
                }
            });
        });
        if (!global._wcppDocDdBound) {
            global._wcppDocDdBound = true;
            document.addEventListener("click", (e) => {
                if (!e.target.closest("#desktop-nav .desktop-dd")) {
                    document.querySelectorAll("#desktop-nav .desktop-dd.open").forEach(dd => {
                        dd.classList.remove("open");
                        dd.setAttribute("aria-expanded", "false");
                    });
                }
            });
        }
        const headerBtn = document.getElementById("headerThemeToggleBtn");
        if (headerBtn && !headerBtn._bound) {
            headerBtn._bound = true;
            anyNewlyBound = true;
            headerBtn.onclick = global.toggleSiteTheme;
        }
        const mobileTheme = document.getElementById("mobileThemeBtn");
        if (mobileTheme && !mobileTheme._bound) {
            mobileTheme._bound = true;
            anyNewlyBound = true;
            mobileTheme.onclick = () => { global.toggleSiteTheme(); };
        }
        const curBtn = document.getElementById("headerCuratorBtn");
        if (curBtn && !curBtn._bound) {
            curBtn._bound = true;
            anyNewlyBound = true;
            curBtn.onclick = () => { if (global.WCPPAdmin) global.WCPPAdmin.openLoginModal(); };
        }
        const mobCurBtn = document.getElementById("mobileCuratorBtn");
        if (mobCurBtn && !mobCurBtn._bound) {
            mobCurBtn._bound = true;
            anyNewlyBound = true;
            mobCurBtn.onclick = (e) => {
                if (e) e.preventDefault();
                global.closeDrawer();
                if (global.WCPPAdmin) global.WCPPAdmin.openLoginModal();
            };
        }
        const ddCurBtn = document.getElementById("desktopDdCuratorBtn");
        if (ddCurBtn && !ddCurBtn._bound) {
            ddCurBtn._bound = true;
            anyNewlyBound = true;
            ddCurBtn.onclick = (e) => {
                if (e) e.preventDefault();
                document.querySelectorAll("#desktop-nav .desktop-dd.open").forEach(dd => {
                    dd.classList.remove("open");
                    dd.setAttribute("aria-expanded", "false");
                });
                if (global.WCPPAdmin) global.WCPPAdmin.openLoginModal();
            };
        }
        const citeBtn = document.getElementById("headerCiteBtn");
        if (citeBtn && !citeBtn._bound) {
            citeBtn._bound = true;
            anyNewlyBound = true;
            citeBtn.onclick = () => { if (global.WCPPAdmin) global.WCPPAdmin.openCitationModal(); };
        }
        const mobCiteBtn = document.getElementById("mobileCiteBtn");
        if (mobCiteBtn && !mobCiteBtn._bound) {
            mobCiteBtn._bound = true;
            anyNewlyBound = true;
            mobCiteBtn.onclick = () => { global.closeDrawer(); if (global.WCPPAdmin) global.WCPPAdmin.openCitationModal(); };
        }

        if (anyNewlyBound || forceSync) {
            markActiveNavLinks();
            const isDark = document.body && document.body.classList.contains("dark-mode");
            syncThemeIcons(isDark);
            if (global.WCPPAdmin) global.WCPPAdmin.syncUIState();
        }
    }

    function initObservers() {
        applyThemeFromStorage();
        bindHeaderUtilities(true);

        const headerHost = document.getElementById("header-container");
        if (headerHost) {
            const obs = new MutationObserver(() => bindHeaderUtilities(false));
            obs.observe(headerHost, { childList: true });
        }
        const footerHost = document.getElementById("footer-container");
        if (footerHost) {
            const fObs = new MutationObserver(() => {
                const fCite = document.getElementById("footerCiteBtn");
                if (fCite && !fCite._bound) {
                    fCite._bound = true;
                    fCite.onclick = () => { if (global.WCPPAdmin) global.WCPPAdmin.openCitationModal(); };
                }
                const fCur = document.getElementById("footerCuratorBtn");
                if (fCur && !fCur._bound) {
                    fCur._bound = true;
                    fCur.onclick = () => { if (global.WCPPAdmin) global.WCPPAdmin.openLoginModal(); };
                }
            });
            fObs.observe(footerHost, { childList: true });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initObservers);
    } else {
        initObservers();
    }
    global.addEventListener("wcpp:admin-ready", () => bindHeaderUtilities(true));
})(window);
