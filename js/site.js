/* =========================================================================
   West Coast Plant Project (plantproject.ca)
   Shared Layout, Theme, Header Utilities & Dataset Helper Script
   ========================================================================= */
(function (global) {
    "use strict";

    // =========================================================================
    // 0. HIGH-SPEED PARTIAL CACHE, JSON DEDUPLICATOR, LAZY IFRAMES & PREFETCHER
    //    Speeds up navigation & rendering with ZERO data deleted or hidden
    // =========================================================================
    const scheduleWhenIdle = (fn, timeoutMs = 900) => {
        if (typeof global.requestIdleCallback === "function") {
            global.requestIdleCallback(fn, { timeout: timeoutMs });
        } else {
            setTimeout(fn, 180);
        }
    };

    const PARTIAL_SS_KEY = "wcpp_partials_ss_v2";
    const PARTIAL_TTL_MS = 10 * 60 * 1000;
    let _partialMemMap = null;
    const _jsonInFlightMap = new Map();
    const _jsonMemMap = new Map();

    function getPartialCacheMap() {
        if (_partialMemMap) return _partialMemMap;
        try {
            const parsed = JSON.parse(sessionStorage.getItem(PARTIAL_SS_KEY) || "{}");
            _partialMemMap = (parsed && typeof parsed === "object") ? parsed : {};
        } catch (_) {
            _partialMemMap = {};
        }
        return _partialMemMap;
    }

    function savePartialCacheEntry(name, html) {
        if (!name || !html) return;
        const map = getPartialCacheMap();
        map[name] = { ts: Date.now(), html };
        try {
            sessionStorage.setItem(PARTIAL_SS_KEY, JSON.stringify(map));
        } catch (_) {}
    }

    // Defer heavy cross-origin Maps/Spotify iframe network loads until scrolled near (keeps widgets 100% intact & unmoved)
    function transformSidebarHtmlForLazyEmbeds(rawHtml) {
        if (!rawHtml || typeof rawHtml !== "string") return rawHtml;
        return rawHtml.replace(
            /<iframe\b([^>]*?)\bsrc=(["'])(https:\/\/(?:open\.spotify\.com|www\.google\.com\/maps)\/[^"']+)\2([^>]*)>/gi,
            "<iframe$1src=\"about:blank\" data-wcpp-lazy-src=$2$3$2$4>"
        );
    }

    function hydrateLazyIframes(root) {
        const scope = root || document;
        const frames = Array.from(scope.querySelectorAll("iframe[data-wcpp-lazy-src]")).filter(f => !f._wcppLazyObserved);
        if (!frames.length) return;
        const loadFrame = (ifr) => {
            const realSrc = ifr.getAttribute("data-wcpp-lazy-src");
            if (!realSrc) return;
            ifr.removeAttribute("data-wcpp-lazy-src");
            ifr.src = realSrc;
        };
        if ("IntersectionObserver" in global) {
            const sbRoot = document.getElementById("sidebar-container") || null;
            const io = new IntersectionObserver((entries, obs) => {
                entries.forEach(en => {
                    if (en.isIntersecting) {
                        loadFrame(en.target);
                        obs.unobserve(en.target);
                    }
                });
            }, { root: null, rootMargin: "380px 0px" });
            const ioSb = sbRoot ? new IntersectionObserver((entries, obs) => {
                entries.forEach(en => {
                    if (en.isIntersecting) {
                        loadFrame(en.target);
                        obs.unobserve(en.target);
                    }
                });
            }, { root: sbRoot, rootMargin: "380px 0px" }) : null;
            frames.forEach(f => {
                f._wcppLazyObserved = true;
                io.observe(f);
                if (ioSb && sbRoot.contains(f)) ioSb.observe(f);
            });
        } else {
            frames.forEach(f => { f._wcppLazyObserved = true; });
            scheduleWhenIdle(() => frames.forEach(loadFrame), 1500);
        }
    }

    if (typeof global.fetch === "function" && !global._wcppFastFetchInstalled) {
        global._wcppFastFetchInstalled = true;
        const _origFetch = global.fetch.bind(global);
        global.fetch = function (input, init) {
            try {
                const method = (init && init.method ? String(init.method) : (input && input.method ? String(input.method) : "GET")).toUpperCase();
                const cacheOpt = init && init.cache ? String(init.cache) : "";
                const rawUrl = typeof input === "string" ? input : (input && input.url ? input.url : "");
                if (method === "GET" && rawUrl && cacheOpt !== "no-store" && cacheOpt !== "reload") {
                    const resolved = new URL(rawUrl, global.location ? global.location.href : "https://www.plantproject.ca/");
                    if (!global.location || resolved.origin === global.location.origin) {
                        // A. Instant sessionStorage Fast-Path for header.html, sidebar.html, footer.html
                        const partialMatch = resolved.pathname.match(/\/(header|sidebar|footer)\.html$/i);
                        if (partialMatch) {
                            const key = partialMatch[1].toLowerCase();
                            const entry = getPartialCacheMap()[key];
                            if (entry && entry.html) {
                                if (Date.now() - (entry.ts || 0) > PARTIAL_TTL_MS) {
                                    scheduleWhenIdle(() => {
                                        _origFetch(input, init).then(r => r.ok ? r.text() : "").then(txt => {
                                            if (txt) savePartialCacheEntry(key, key === "sidebar" ? transformSidebarHtmlForLazyEmbeds(txt) : txt);
                                        }).catch(() => {});
                                    });
                                }
                                setTimeout(() => hydrateLazyIframes(), 40);
                                return Promise.resolve(new Response(entry.html, {
                                    status: 200,
                                    headers: { "Content-Type": "text/html; charset=utf-8" }
                                }));
                            }
                            return _origFetch(input, init).then(async (res) => {
                                if (!res || !res.ok) return res;
                                const rawTxt = await res.text();
                                const finalTxt = key === "sidebar" ? transformSidebarHtmlForLazyEmbeds(rawTxt) : rawTxt;
                                savePartialCacheEntry(key, finalTxt);
                                setTimeout(() => hydrateLazyIframes(), 40);
                                return new Response(finalTxt, {
                                    status: 200,
                                    headers: { "Content-Type": "text/html; charset=utf-8" }
                                });
                            });
                        }

                        // B. Deduplicate concurrent & repeated same-page JSON fetches (kills bios_base.json 60ms spin-loop & duplicate plants_212/latin fetches)
                        if (/\.json$/i.test(resolved.pathname) && !/plants_master_4590\.json/i.test(resolved.pathname)) {
                            const jsonKey = resolved.pathname;
                            const memHit = _jsonMemMap.get(jsonKey);
                            if (memHit && (Date.now() - memHit.ts) < 60000) {
                                return Promise.resolve(new Response(memHit.bodyText, {
                                    status: 200,
                                    headers: { "Content-Type": "application/json; charset=utf-8" }
                                }));
                            }
                            if (_jsonInFlightMap.has(jsonKey)) {
                                return _jsonInFlightMap.get(jsonKey).then(bodyText =>
                                    new Response(bodyText, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } })
                                );
                            }
                            const p = _origFetch(input, init).then(async (res) => {
                                if (!res || !res.ok) throw new Error("HTTP " + (res ? res.status : 0));
                                const bodyText = await res.text();
                                _jsonMemMap.set(jsonKey, { ts: Date.now(), bodyText });
                                return bodyText;
                            }).finally(() => {
                                _jsonInFlightMap.delete(jsonKey);
                            });
                            _jsonInFlightMap.set(jsonKey, p);
                            return p.then(bodyText =>
                                new Response(bodyText, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } })
                            ).catch(() => _origFetch(input, init));
                        }
                    }
                }
            } catch (_) {}
            return _origFetch(input, init);
        };
    }

    // Smart Hover / Touch Link Prefetcher + Async Image Decoding
    function initNavigationPrefetcherAndAsyncImages() {
        const conn = navigator && navigator.connection;
        const canPrefetch = !(conn && (conn.saveData || /2g/i.test(conn.effectiveType || "")));
        if (canPrefetch && !global._wcppPrefetchBound) {
            global._wcppPrefetchBound = true;
            const prefetched = new Set();
            let hoverTimer = null;

            const triggerPrefetch = (a) => {
                if (!a || prefetched.size >= 10) return;
                const rawHref = a.getAttribute("href") || "";
                if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("javascript:")) return;
                try {
                    const url = new URL(rawHref, global.location.href);
                    if (url.origin !== global.location.origin) return;
                    if (!/\.html$/i.test(url.pathname) && url.pathname !== "/") return;
                    if (url.pathname === global.location.pathname) return;
                    const cleanUrl = url.origin + url.pathname;
                    if (prefetched.has(cleanUrl)) return;
                    prefetched.add(cleanUrl);
                    const link = document.createElement("link");
                    link.rel = "prefetch";
                    link.href = cleanUrl;
                    link.as = "document";
                    document.head.appendChild(link);
                } catch (_) {}
            };

            document.addEventListener("pointerover", (e) => {
                const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
                if (!a) return;
                clearTimeout(hoverTimer);
                hoverTimer = setTimeout(() => triggerPrefetch(a), 65);
            }, { passive: true });

            document.addEventListener("pointerout", (e) => {
                if (e.target && e.target.closest && e.target.closest("a[href]")) {
                    clearTimeout(hoverTimer);
                }
            }, { passive: true });

            document.addEventListener("touchstart", (e) => {
                const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
                if (a) triggerPrefetch(a);
            }, { passive: true });
        }

        // Mark below-the-fold card/table images with async decoding so scrolling stays jank-free
        scheduleWhenIdle(() => {
            document.querySelectorAll("#cardsGrid img, #resourceList img, #liveCatalogGrid img, #catalogGrid img, .plant-thumb").forEach(img => {
                if (!img.getAttribute("decoding")) img.setAttribute("decoding", "async");
            });
            hydrateLazyIframes();
        }, 600);
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initNavigationPrefetcherAndAsyncImages);
    } else {
        initNavigationPrefetcherAndAsyncImages();
    }

    // Ensure shared CSS is loaded
    if (!document.querySelector('link[href*="css/site.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "css/site.css?v=20261118d";
        document.head.appendChild(link);
    }

    // Ensure WCPPAdmin is loaded if somehow missing
    if (!global.WCPPAdmin && !document.querySelector('script[src*="js/admin.js"]')) {
        const sc = document.createElement("script");
        sc.src = "js/admin.js?v=20261118a";
        document.head.appendChild(sc);
    }

    // Safe Google Analytics 4 / Google Tag event helper (never sends PII)
    const _analyticsTimers = {};
    const _analyticsLast = {};
    const OPT_OUT_KEY = "wcpp_analytics_optout";
    function isAnalyticsOptedOut() {
        try {
            return localStorage.getItem(OPT_OUT_KEY) === "1" || global["ga-disable-G-SNE9BSGBZK"] === true;
        } catch (_) {
            return global["ga-disable-G-SNE9BSGBZK"] === true;
        }
    }
    if (isAnalyticsOptedOut()) {
        global["ga-disable-G-SNE9BSGBZK"] = true;
    }

    global.WCPPAnalytics = {
        isOptedOut: isAnalyticsOptedOut,
        setOptOut: function (flag) {
            const optOut = Boolean(flag);
            global["ga-disable-G-SNE9BSGBZK"] = optOut;
            try {
                if (optOut) localStorage.setItem(OPT_OUT_KEY, "1");
                else localStorage.removeItem(OPT_OUT_KEY);
            } catch (_) {}
            return optOut;
        },
        openPrivacyModal: function () {
            const existing = document.getElementById("wcppPrivacyModalBackdrop");
            if (existing) existing.remove();
            const backdrop = document.createElement("div");
            backdrop.id = "wcppPrivacyModalBackdrop";
            backdrop.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.55);backdrop-filter:blur(4px);z-index:3100;display:flex;align-items:center;justify-content:center;padding:16px;";
            const opted = isAnalyticsOptedOut();
            backdrop.innerHTML = `
                <div role="dialog" aria-modal="true" aria-labelledby="wcppPrivacyTitle" style="background:var(--card-bg,#fff);color:var(--text-color,#0f172a);border:1px solid var(--border-color,#e2e8f0);border-radius:16px;max-width:520px;width:100%;padding:24px;box-shadow:0 20px 40px rgba(15,23,42,0.25);font-family:inherit;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
                        <h3 id="wcppPrivacyTitle" style="margin:0;font-size:1.12rem;font-weight:800;color:var(--primary-color,#166534);">Privacy &amp; Non-PII Analytics</h3>
                        <button type="button" id="wcppPrivacyCloseBtn" aria-label="Close" style="background:var(--tag-bg,#f1f5f9);border:1px solid var(--border-color,#e2e8f0);color:var(--text-color,#0f172a);border-radius:8px;width:32px;height:32px;font-weight:800;cursor:pointer;">✕</button>
                    </div>
                    <p style="font-size:0.88rem;line-height:1.55;margin:0 0 10px 0;color:var(--text-muted,#475569);">
                        West Coast Plant Project uses Google Analytics 4 (<code>G-SNE9BSGBZK</code>, with Google Signals) to understand which native plants, filters, calculators, and seed library tools visitors use.
                    </p>
                    <p style="font-size:0.88rem;line-height:1.55;margin:0 0 14px 0;color:var(--text-muted,#475569);">
                        Personal checkout/contact inputs (names, emails, phone numbers, and notes) are automatically redacted (<code>[REDACTED_PII]</code>) before any analytics event is sent. Under Canadian privacy frameworks (BC PIPA / PIPEDA), you can opt out of analytics on this browser at any time below.
                    </p>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid var(--border-color,#e2e8f0);">
                        <span id="wcppPrivacyStatus" style="font-size:0.84rem;font-weight:800;color:${opted ? "#b91c1c" : "var(--primary-color,#166534)"};">
                            Status: ${opted ? "Analytics Opted Out" : "Analytics Active (Non-PII)"}
                        </span>
                        <button type="button" id="wcppPrivacyToggleBtn" style="padding:9px 16px;border-radius:999px;border:none;background:${opted ? "var(--primary-color,#166534)" : "#475569"};color:#fff;font-weight:800;font-size:0.84rem;cursor:pointer;">
                            ${opted ? "Re-enable Analytics" : "Opt Out on This Browser"}
                        </button>
                    </div>
                </div>`;
            document.body.appendChild(backdrop);
            backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
            backdrop.querySelector("#wcppPrivacyCloseBtn").onclick = () => backdrop.remove();
            backdrop.querySelector("#wcppPrivacyToggleBtn").onclick = () => {
                const next = !isAnalyticsOptedOut();
                global.WCPPAnalytics.setOptOut(next);
                backdrop.remove();
                global.WCPPAnalytics.openPrivacyModal();
            };
        },
        track: function (eventName, params) {
            if (!eventName || isAnalyticsOptedOut()) return;
            try {
                const payload = (params && typeof params === "object") ? Object.assign({}, params) : {};
                if (typeof global.gtag === "function") {
                    global.gtag("event", eventName, payload);
                } else {
                    global.dataLayer = global.dataLayer || [];
                    (function () { global.dataLayer.push(arguments); })("event", eventName, payload);
                }
            } catch (_) {}
        },
        trackDebounced: function (key, eventName, params, delayMs) {
            const k = String(key || eventName || "default");
            clearTimeout(_analyticsTimers[k]);
            if (!params || (typeof params.search_term === "string" && params.search_term.trim().length < 2)) {
                return;
            }
            const sig = eventName + "|" + JSON.stringify(params);
            _analyticsTimers[k] = setTimeout(() => {
                if (_analyticsLast[k] === sig) return;
                _analyticsLast[k] = sig;
                global.WCPPAnalytics.track(eventName, params);
            }, typeof delayMs === "number" ? delayMs : 700);
        }
    };

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
        if (global.WCPPAnalytics) {
            global.WCPPAnalytics.track("theme_change", {
                theme_mode: isDark ? "dark" : "light",
                content_type: "ui_theme"
            });
        }
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
            if (global.WCPPGardenPlan && typeof global.WCPPGardenPlan.syncDOM === "function") {
                global.WCPPGardenPlan.syncDOM();
            }
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
        const sidebarHost = document.getElementById("sidebar-container");
        if (sidebarHost) {
            hydrateLazyIframes(sidebarHost);
            const sbObs = new MutationObserver(() => hydrateLazyIframes(sidebarHost));
            sbObs.observe(sidebarHost, { childList: true });
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

    // =========================================================================
    // SHARED HTML ESCAPER
    // =========================================================================
    function escHtml(str) {
        if (global.WCPPAdmin && typeof global.WCPPAdmin.escapeHTML === "function") {
            return global.WCPPAdmin.escapeHTML(str);
        }
        return String(str == null ? "" : str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // =========================================================================
    // 1. SHARED PERSISTENT PLANT PHOTO CACHE (Wikipedia + iNaturalist)
    // =========================================================================
    const PHOTO_CACHE_KEY = "wcpp_photo_cache_v1";
    let _photoCacheMem = null;

    function getPhotoCacheMap() {
        if (_photoCacheMem) return _photoCacheMem;
        try {
            const parsed = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || "{}");
            _photoCacheMem = parsed && typeof parsed === "object" ? parsed : {};
        } catch (_) {
            _photoCacheMem = {};
        }
        return _photoCacheMem;
    }

    function savePhotoCacheEntry(key, val) {
        if (!key || !val || !val.url) return;
        const map = getPhotoCacheMap();
        const keys = Object.keys(map);
        if (keys.length >= 300) {
            delete map[keys[0]];
        }
        map[key] = val;
        try {
            localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(map));
        } catch (_) {}
    }

    global.WCPPPhotoCache = {
        get: (key) => getPhotoCacheMap()[key] || null,
        set: savePhotoCacheEntry
    };

    function generateBotanicalSVG(sciName, commonName) {
        const cleanSci = String(sciName || "Native Species").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const cleanCom = String(commonName || "West Coast Flora").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let hash = 0;
        for (let i = 0; i < cleanSci.length; i++) hash = cleanSci.charCodeAt(i) + ((hash << 5) - hash);
        const palettes = [
            ["#14532d", "#166534", "#dcfce7", "#86efac"],
            ["#064e3b", "#047857", "#d1fae5", "#6ee7b7"],
            ["#1e3a2f", "#2d5a43", "#e2f2ea", "#99c9ab"],
            ["#365314", "#4d7c0f", "#ecfccb", "#bef264"]
        ];
        const pal = palettes[Math.abs(hash) % palettes.length];

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="100%" height="100%">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${pal[0]}"/>
                    <stop offset="100%" stop-color="${pal[1]}"/>
                </linearGradient>
            </defs>
            <rect width="400" height="250" fill="url(#bg)"/>
            <circle cx="330" cy="45" r="95" fill="${pal[3]}" opacity="0.1"/>
            <circle cx="60" cy="210" r="80" fill="${pal[3]}" opacity="0.08"/>
            <g transform="translate(275, 25)" stroke="${pal[3]}" stroke-width="2" fill="none" opacity="0.32">
                <path d="M20,190 Q45,100 85,20" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M32,155 Q10,135 15,115 Q40,125 32,155 Z" fill="${pal[3]}" fill-opacity="0.25"/>
                <path d="M42,130 Q70,120 75,98 Q48,105 42,130 Z" fill="${pal[3]}" fill-opacity="0.25"/>
                <path d="M52,102 Q28,82 34,62 Q58,75 52,102 Z" fill="${pal[3]}" fill-opacity="0.25"/>
                <path d="M64,75 Q88,65 92,45 Q68,52 64,75 Z" fill="${pal[3]}" fill-opacity="0.25"/>
                <path d="M74,48 Q55,32 62,16 Q80,28 74,48 Z" fill="${pal[3]}" fill-opacity="0.25"/>
            </g>
            <rect x="22" y="22" width="150" height="24" rx="12" fill="rgba(255,255,255,0.14)"/>
            <text x="34" y="38" fill="${pal[2]}" font-family="Nunito Sans, sans-serif" font-size="10.5" font-weight="800" letter-spacing="1.2">HERBARIUM ARCHIVE</text>
            <text x="24" y="168" fill="#ffffff" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="22">${cleanSci.slice(0, 28)}</text>
            <text x="24" y="196" fill="${pal[2]}" font-family="Nunito Sans, sans-serif" font-weight="700" font-size="14.5" opacity="0.92">${cleanCom.slice(0, 34)}</text>
            <line x1="24" y1="214" x2="110" y2="214" stroke="${pal[3]}" stroke-width="2" opacity="0.5"/>
        </svg>`;
        return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    }
    global.generateBotanicalCardSVG = generateBotanicalSVG;

    global.resolveSharedPlantPhoto = async function (sciName, commonName, explicitUrl, fallbackSvg) {
        if (!fallbackSvg && typeof global.generateBotanicalCardSVG === "function") {
            fallbackSvg = global.generateBotanicalCardSVG(sciName, commonName);
        }
        const cleanSheetUrl = String(explicitUrl || "").trim();
        if (/^https?:\/\//i.test(cleanSheetUrl) && !cleanSheetUrl.includes("unsplash.com") && !cleanSheetUrl.includes("placeholder")) {
            return { url: cleanSheetUrl, source: "Nursery Photo" };
        }
        const cleanLatin = String(sciName || "").split("(")[0].trim().split(/\s+/).slice(0, 2).join(" ").replace(/[^a-zA-Z\s-]/g, "").trim();
        const cleanCommon = String(commonName || "")
            .replace(/\([^)]*\)/g, "")
            .replace(/—.*$/, "")
            .replace(/\b\d+\s*-?\s*(gal(lon)?|inch|in|cm|qt|pot|plug|bulb)\b/gi, "")
            .replace(/\s+/g, " ")
            .trim();
        const cacheKey = cleanLatin || cleanCommon;
        const cached = cacheKey ? getPhotoCacheMap()[cacheKey] : null;
        if (cached && cached.url) return cached;

        const queries = [cleanLatin, cleanCommon].filter(Boolean);
        for (const q of queries) {
            try {
                const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.thumbnail && data.thumbnail.source) {
                        const result = { url: data.thumbnail.source, source: "Wikimedia Commons" };
                        if (cacheKey) savePhotoCacheEntry(cacheKey, result);
                        return result;
                    }
                }
            } catch (_) {}
        }

        const inatQuery = cleanLatin || cleanCommon;
        if (inatQuery) {
            try {
                const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(inatQuery)}&per_page=1`);
                if (res.ok) {
                    const data = await res.json();
                    const photo = data.results && data.results[0] && data.results[0].default_photo;
                    if (photo && (photo.medium_url || photo.square_url)) {
                        const result = { url: photo.medium_url || photo.square_url, source: "iNaturalist" };
                        if (cacheKey) savePhotoCacheEntry(cacheKey, result);
                        return result;
                    }
                }
            } catch (_) {}
        }

        return { url: fallbackSvg || "", source: "Botanical Card" };
    };

    // =========================================================================
    // 2. SHARED MUNICIPALITY / FROST REGION & LIVE WEATHER SYNC (WCPPClimate)
    // =========================================================================
    const LS_CITY_KEY = "wcpp_selected_city";
    const WEATHER_CACHE_KEY = "wcpp_live_weather_v1";
    const WEATHER_TTL_MS = 15 * 60 * 1000;
    const CITY_FROST_DATA = {
        "Surrey": { lastSpring: "Apr 6", firstFall: "Nov 16", fallDOY: 320, days: 225, lat: 49.1678, lon: -122.8274 },
        "Burnaby": { lastSpring: "Mar 28", firstFall: "Nov 16", fallDOY: 320, days: 234, lat: 49.2488, lon: -122.9805 },
        "Tri-Cities": { lastSpring: "Apr 6", firstFall: "Nov 16", fallDOY: 320, days: 225, lat: 49.2838, lon: -122.7932 },
        "Vancouver": { lastSpring: "Mar 28", firstFall: "Nov 6", fallDOY: 310, days: 224, lat: 49.2827, lon: -123.1207 },
        "Richmond": { lastSpring: "Mar 28", firstFall: "Nov 16", fallDOY: 320, days: 234, lat: 49.1666, lon: -123.1336 },
        "Delta": { lastSpring: "Apr 6", firstFall: "Nov 6", fallDOY: 310, days: 215, lat: 49.0847, lon: -123.0586 },
        "North Shore": { lastSpring: "Apr 11", firstFall: "Nov 10", fallDOY: 314, days: 214, lat: 49.3200, lon: -123.0724 },
        "Fraser Valley": { lastSpring: "Apr 6", firstFall: "Nov 11", fallDOY: 315, days: 220, lat: 49.0504, lon: -122.3045 },
        "Victoria": { lastSpring: "Mar 6", firstFall: "Nov 16", fallDOY: 320, days: 256, lat: 48.4284, lon: -123.3656 },
        "Sunshine Coast": { lastSpring: "Mar 28", firstFall: "Nov 26", fallDOY: 330, days: 244, lat: 49.4742, lon: -123.7548 },
        "Gulf Islands": { lastSpring: "Apr 6", firstFall: "Nov 16", fallDOY: 320, days: 225, lat: 48.8543, lon: -123.5048 },
        "Nanaimo": { lastSpring: "Apr 6", firstFall: "Nov 6", fallDOY: 310, days: 215, lat: 49.1659, lon: -123.9401 },
        "Squamish": { lastSpring: "Apr 16", firstFall: "Oct 26", fallDOY: 299, days: 194, lat: 49.7016, lon: -123.1558 }
    };

    const _lastWeatherMap = {};
    const _weatherInFlight = {};

    function describeWeatherCode(code, isDay) {
        const day = isDay === undefined ? 1 : isDay;
        if (code === 0) return { icon: day === 1 ? "☀️" : "🌙", desc: "Clear skies" };
        if (code === 1 || code === 2) return { icon: day === 1 ? "⛅" : "☁️", desc: "Partly cloudy" };
        if (code === 3) return { icon: "☁️", desc: "Overcast" };
        if (code >= 45 && code <= 48) return { icon: "🌫️", desc: "Foggy" };
        if (code >= 51 && code <= 67) return { icon: "🌧️", desc: "Rain & Drizzle" };
        if (code >= 71 && code <= 77) return { icon: "❄️", desc: "Snow" };
        if (code >= 80 && code <= 82) return { icon: "🌦️", desc: "Rain showers" };
        if (code >= 95) return { icon: "⛈️", desc: "Thunderstorm" };
        return { icon: day === 1 ? "🌤️" : "🌙", desc: day === 1 ? "Partly Cloudy" : "Clear night" };
    }

    function computeVpdKpa(tempC, rhPct) {
        const t = Number(tempC);
        const rh = Math.max(0, Math.min(100, Number(rhPct)));
        if (!Number.isFinite(t) || !Number.isFinite(rh)) return null;
        const es = 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
        const vpd = es * (1 - rh / 100);
        return +Math.max(0, vpd).toFixed(2);
    }

    function readSessionWeatherCache() {
        try {
            const parsed = JSON.parse(sessionStorage.getItem(WEATHER_CACHE_KEY) || "{}");
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function writeSessionWeatherCache(city, obj) {
        try {
            const map = readSessionWeatherCache();
            map[city] = obj;
            sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(map));
        } catch (_) {}
    }

    function buildSeasonalFallbackWeather(info) {
        const monthTemps = [4.5, 6.0, 8.5, 11.5, 15.0, 18.0, 21.0, 21.0, 17.0, 11.5, 7.0, 4.5];
        const m = new Date().getMonth();
        const temp = monthTemps[m] != null ? monthTemps[m] : 11.0;
        const rh = m >= 5 && m <= 8 ? 64 : 78;
        return {
            city: info.name,
            lat: info.lat,
            lon: info.lon,
            temp,
            rh,
            precip: 0,
            code: m >= 5 && m <= 8 ? 1 : 2,
            isDay: 1,
            icon: m >= 5 && m <= 8 ? "⛅" : "🌤️",
            desc: "Coastal seasonal baseline",
            vpdKpa: computeVpdKpa(temp, rh),
            dailyMax: +(temp + 3.5).toFixed(1),
            dailyMin: +(temp - 3.5).toFixed(1),
            lastSpring: info.lastSpring,
            firstFall: info.firstFall,
            days: info.days,
            fetchedAt: Date.now(),
            isFallback: true
        };
    }

    global.WCPPClimate = {
        CITY_FROST_DATA,
        describeWeatherCode,
        computeVpdKpa,
        getCity: function () {
            const saved = localStorage.getItem(LS_CITY_KEY) || "Surrey";
            return CITY_FROST_DATA[saved] ? saved : "Surrey";
        },
        getInfo: function (city) {
            const c = city && CITY_FROST_DATA[city] ? city : this.getCity();
            return Object.assign({ name: c }, CITY_FROST_DATA[c]);
        },
        setCity: function (city) {
            if (!CITY_FROST_DATA[city]) return;
            const prev = localStorage.getItem(LS_CITY_KEY);
            localStorage.setItem(LS_CITY_KEY, city);
            global.dispatchEvent(new CustomEvent("wcpp:city-changed", {
                detail: Object.assign({ city }, CITY_FROST_DATA[city])
            }));
            if (prev !== city && global.WCPPAnalytics) {
                global.WCPPAnalytics.track("select_content", {
                    content_type: "frost_region",
                    item_id: city
                });
            }
        },
        getLastWeather: function (city) {
            const c = city && CITY_FROST_DATA[city] ? city : this.getCity();
            if (_lastWeatherMap[c]) return _lastWeatherMap[c];
            const cached = readSessionWeatherCache()[c];
            if (cached && typeof cached.temp === "number") {
                _lastWeatherMap[c] = cached;
                return cached;
            }
            return null;
        },
        fetchLiveWeather: async function (cityOpt, force = false) {
            const info = this.getInfo(cityOpt);
            const now = Date.now();
            if (!force) {
                const mem = _lastWeatherMap[info.name];
                if (mem && !mem.isFallback && (now - mem.fetchedAt) < WEATHER_TTL_MS) {
                    return mem;
                }
                const sess = readSessionWeatherCache()[info.name];
                if (sess && !sess.isFallback && (now - sess.fetchedAt) < WEATHER_TTL_MS) {
                    _lastWeatherMap[info.name] = sess;
                    return sess;
                }
            }
            if (_weatherInFlight[info.name] && !force) {
                return _weatherInFlight[info.name];
            }
            _weatherInFlight[info.name] = (async () => {
                try {
                    const url = `https://api.open-meteo.com/v1/forecast?latitude=${info.lat}&longitude=${info.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error("HTTP " + res.status);
                    const data = await res.json();
                    const cur = (data && data.current) || {};
                    const daily = (data && data.daily) || {};
                    const temp = typeof cur.temperature_2m === "number" ? cur.temperature_2m : buildSeasonalFallbackWeather(info).temp;
                    const rh = typeof cur.relative_humidity_2m === "number" ? cur.relative_humidity_2m : 72;
                    const precip = typeof cur.precipitation === "number" ? cur.precipitation : 0;
                    const code = typeof cur.weather_code === "number" ? cur.weather_code : 1;
                    const isDay = typeof cur.is_day === "number" ? cur.is_day : 1;
                    const meta = describeWeatherCode(code, isDay);
                    const dailyMax = daily.temperature_2m_max && typeof daily.temperature_2m_max[0] === "number" ? daily.temperature_2m_max[0] : +(temp + 3).toFixed(1);
                    const dailyMin = daily.temperature_2m_min && typeof daily.temperature_2m_min[0] === "number" ? daily.temperature_2m_min[0] : +(temp - 3).toFixed(1);
                    const obj = {
                        city: info.name,
                        lat: info.lat,
                        lon: info.lon,
                        temp,
                        rh,
                        precip,
                        code,
                        isDay,
                        icon: meta.icon,
                        desc: meta.desc,
                        vpdKpa: computeVpdKpa(temp, rh),
                        dailyMax,
                        dailyMin,
                        lastSpring: info.lastSpring,
                        firstFall: info.firstFall,
                        days: info.days,
                        fetchedAt: Date.now(),
                        isFallback: false
                    };
                    _lastWeatherMap[info.name] = obj;
                    writeSessionWeatherCache(info.name, obj);
                    global.dispatchEvent(new CustomEvent("wcpp:weather-ready", { detail: obj }));
                    return obj;
                } catch (_) {
                    const fb = _lastWeatherMap[info.name] || buildSeasonalFallbackWeather(info);
                    _lastWeatherMap[info.name] = fb;
                    global.dispatchEvent(new CustomEvent("wcpp:weather-ready", { detail: fb }));
                    return fb;
                } finally {
                    delete _weatherInFlight[info.name];
                }
            })();
            return _weatherInFlight[info.name];
        }
    };

    // =========================================================================
    // 3. SHARED LIVE INVENTORY & PRE-ORDER MATCHER (WCPPInventory)
    // =========================================================================
    let _invCatalog = [];
    let _invLoaded = false;
    let _invPromise = null;

    const INV_NAME_ALIASES = {
        "tomatoes": "tomato",
        "tomato": "tomato",
        "sweet pepper": "sweet bell pepper",
        "peppers": "sweet bell pepper",
        "pepper": "sweet bell pepper",
        "sweet & hot pepper": "sweet bell pepper",
        "hot pepper": "sweet bell pepper",
        "chili pepper": "sweet bell pepper",
        "basil": "genovese sweet basil",
        "sweet basil": "genovese sweet basil",
        "kale": "lacinato kale",
        "kale & collards": "lacinato kale",
        "kale & collard": "lacinato kale",
        "brassica": "lacinato kale",
        "strawberry": "strawberry",
        "strawberries": "strawberry",
        "coastal wild strawberry": "coastal wild strawberry",
        "coastal strawberry": "coastal wild strawberry",
        "garlic": "hardneck seed garlic",
        "rosemary": "hardy upright rosemary",
        "sword fern": "western sword fern",
        "western sword fern": "western sword fern",
        "saskatoon": "saskatoon serviceberry",
        "saskatoon serviceberry": "saskatoon serviceberry",
        "common yarrow": "common yarrow",
        "yarrow": "common yarrow",
        "garry oak": "garry oak"
    };

    function normInvName(str) {
        return String(str || "")
            .toLowerCase()
            .replace(/—.*$/, "")
            .replace(/\([^)]*\)/g, " ")
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function expandInvTokens(raw) {
        const base = normInvName(raw);
        if (!base) return [];
        const out = new Set([base]);
        if (INV_NAME_ALIASES[base]) out.add(INV_NAME_ALIASES[base]);
        if (base.endsWith("es") && base.length > 4) out.add(base.slice(0, -2));
        if (base.endsWith("s") && base.length > 3) out.add(base.slice(0, -1));
        if (base.includes("tomato")) out.add("tomato");
        if (base.includes("pepper")) out.add("sweet bell pepper");
        if (base.includes("basil")) out.add("genovese sweet basil");
        if (base.includes("kale")) out.add("lacinato kale");
        if (base.includes("garlic")) out.add("hardneck seed garlic");
        if (base.includes("rosemary")) out.add("hardy upright rosemary");
        if (base.includes("sword fern")) out.add("western sword fern");
        if (base.includes("saskatoon")) out.add("saskatoon serviceberry");
        if (base.includes("yarrow")) out.add("common yarrow");
        if (base.includes("garry oak")) out.add("garry oak");
        return Array.from(out);
    }

    function parseSimpleCsvObjects(csvTxt) {
        const rows = [];
        let row = [], cell = "", inQ = false;
        for (let i = 0; i < csvTxt.length; i++) {
            const ch = csvTxt[i], nx = csvTxt[i + 1];
            if (inQ) {
                if (ch === '"' && nx === '"') { cell += '"'; i++; }
                else if (ch === '"') inQ = false;
                else cell += ch;
            } else if (ch === '"') inQ = true;
            else if (ch === ',') { row.push(cell); cell = ""; }
            else if ((ch === '\r' || ch === '\n')) {
                if (ch === '\r' && nx === '\n') i++;
                row.push(cell);
                if (row.some(v => v.trim() !== "")) rows.push(row);
                row = []; cell = "";
            } else cell += ch;
        }
        if (cell.length || row.length) {
            row.push(cell);
            if (row.some(v => v.trim() !== "")) rows.push(row);
        }
        if (rows.length < 2) return [];
        const hdr = rows[0].map(h => h.trim());
        return rows.slice(1).map(r => {
            const o = {};
            hdr.forEach((h, idx) => { if (h) o[h] = (r[idx] || "").trim(); });
            return o;
        });
    }

    function normalizeInvRecord(r, idx) {
        const qtyNum = parseInt(r.Available_Qty ?? r.Qty ?? r.Quantity ?? "0", 10);
        const validQty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
        const rawStatus = String(r.Availability_Status || r.Status || "").trim();
        const readyWin = String(r.Ready_Window || r.Season_Notes || "In Season").trim();
        const allowPreRaw = String(r.Allow_PreOrder ?? "").trim().toLowerCase();
        const isStatusPre = /pre-?order/i.test(rawStatus);
        const allowPreOrder = /^(yes|true|1|on)$/i.test(allowPreRaw)
            ? true
            : (/^(no|false|0|off)$/i.test(allowPreRaw) ? false : isStatusPre);
        const isPreOrder = allowPreOrder;
        const isOutOfStock = !isPreOrder && (validQty <= 0 || /sold\s*out|out\s*of\s*stock|unavailable/i.test(rawStatus));
        return {
            Plant_ID: r.Plant_ID || r.Item_ID || r.ID || `LP-ROW-${idx + 1}`,
            Plant_Name: r.Plant_Name || r.Name || r.Common_Name || "Live Plant",
            Latin_Name: r.Latin_Name || r.Scientific_Name || "",
            Category: r.Category || (/(tomato|pepper|basil|kale|garlic|rosemary|strawberry.*everbearing)/i.test(r.Plant_Name || "") ? "Vegetable & Herb Start" : "Native Plant"),
            Pot_Size_Format: r.Pot_Size_Format || r.Format || r.Pot_Size || "4-inch Pot",
            Price_CAD: String(r.Price_CAD || r.Price || "0.00").replace(/[^0-9.]/g, "") || "0.00",
            Available_Qty: String(validQty),
            Availability_Status: isPreOrder ? "Pre-Order" : (isOutOfStock ? "Out of Stock" : "In Stock"),
            Allow_PreOrder: allowPreOrder ? "Yes" : "No",
            PreOrder_Button_Color: String(r.PreOrder_Button_Color || "").trim(),
            Ready_Window: readyWin,
            Host_Bees_Insects: String(r.Host_Bees_Insects || "").trim(),
            Notes: r.Notes || r.Description || "",
            Image_URL: r.Image_URL || r.Photo_URL || r.Image || "",
            _isPreOrder: isPreOrder,
            _allowPreOrder: allowPreOrder,
            _isOutOfStock: isOutOfStock,
            _qtyNum: validQty
        };
    }

    const INV_SHEET_CACHE_KEY = "wcpp_inv_sheet_cache_v1";
    const INV_SHEET_TTL_MS = 5 * 60 * 1000;

    async function loadSharedInventory(force = false) {
        if (_invLoaded && !force) return _invCatalog;
        if (_invPromise && !force) return _invPromise;

        _invPromise = (async () => {
            if (global.WCPPAdmin && global.WCPPAdmin.ready) {
                await global.WCPPAdmin.ready.catch(() => {});
            }
            let base = [];
            try {
                const res = await fetch("data/orders_inventory.json?v=20261121i");
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) base = data;
                }
            } catch (_) {}

            const publishInventory = (rows) => {
                let list = rows.slice();
                if (global.WCPPAdmin && typeof global.WCPPAdmin.applyOverrides === "function") {
                    list = global.WCPPAdmin.applyOverrides("orders_catalog", list, "Plant_ID");
                }
                _invCatalog = list.map(normalizeInvRecord);
                _invLoaded = true;
                global.dispatchEvent(new CustomEvent("wcpp:inventory-ready", { detail: { catalog: _invCatalog } }));
                return _invCatalog;
            };

            const mergeSheetRows = (baseRows, parsedRows) => {
                const mergedMap = new Map();
                baseRows.forEach((item, idx) => {
                    const k = String(item.Plant_ID || item.Item_ID || item.ID || `BASE-${idx}`).trim();
                    mergedMap.set(k, item);
                });
                parsedRows.forEach((item, idx) => {
                    const k = String(item.Plant_ID || item.Item_ID || item.ID || `SHEET-${idx}`).trim();
                    const prev = mergedMap.get(k);
                    const nonBlank = {};
                    Object.keys(item).forEach(key => {
                        if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== "") {
                            nonBlank[key] = item[key];
                        }
                    });
                    mergedMap.set(k, prev ? Object.assign({}, prev, nonBlank) : item);
                });
                return Array.from(mergedMap.values());
            };

            // Check sessionStorage sheet cache first (avoids re-downloading Google Sheet CSV on every page click)
            let cachedSheetRows = null;
            if (!force) {
                try {
                    const rawCache = JSON.parse(sessionStorage.getItem(INV_SHEET_CACHE_KEY) || "null");
                    if (rawCache && Array.isArray(rawCache.rows) && (Date.now() - (rawCache.ts || 0)) < INV_SHEET_TTL_MS) {
                        cachedSheetRows = rawCache.rows;
                    }
                } catch (_) {}
            }

            if (cachedSheetRows && cachedSheetRows.length) {
                return publishInventory(mergeSheetRows(base, cachedSheetRows));
            }

            // Phase 1: Publish local base inventory immediately so UI never blocks on Google Sheets
            let prevInvSig = "";
            if (base.length) {
                publishInventory(base);
                prevInvSig = _invCatalog.map(x => `${x.Plant_ID}|${x.Available_Qty}|${x.Availability_Status}|${x.Price_CAD}`).join("\n");
            }

            // Phase 2: Sync live Google Sheet CSV & update if fresh rows/quantities exist
            const syncLiveInventorySheet = async () => {
                let invCsv = (localStorage.getItem("wcpp_inventory_sheet_csv") || "").trim();
                if (!invCsv) {
                    try {
                        const cfgRes = await fetch("data/orders_config.json?v=20261121i");
                        if (cfgRes.ok) {
                            const cfg = await cfgRes.json();
                            if (cfg && cfg.inventorySheetCsv) invCsv = String(cfg.inventorySheetCsv).trim();
                        }
                    } catch (_) {}
                }
                if (invCsv) {
                    try {
                        const sep = invCsv.includes("?") ? "&" : "?";
                        const csvRes = await fetch(`${invCsv}${sep}_ts=${Date.now()}`);
                        if (csvRes.ok) {
                            const parsed = parseSimpleCsvObjects(await csvRes.text());
                            if (parsed.length) {
                                try {
                                    sessionStorage.setItem(INV_SHEET_CACHE_KEY, JSON.stringify({ ts: Date.now(), rows: parsed }));
                                } catch (_) {}
                                const mergedList = mergeSheetRows(base, parsed);
                                const tempNorm = mergedList.map(normalizeInvRecord);
                                const nextInvSig = tempNorm.map(x => `${x.Plant_ID}|${x.Available_Qty}|${x.Availability_Status}|${x.Price_CAD}`).join("\n");
                                if (!base.length || nextInvSig !== prevInvSig || force) {
                                    return publishInventory(mergedList);
                                }
                                return _invCatalog;
                            }
                        }
                    } catch (_) {}
                }
                if (!base.length) return publishInventory(base);
                return _invCatalog;
            };

            if (!force && base.length) {
                syncLiveInventorySheet().catch(() => {});
                return _invCatalog;
            }
            return await syncLiveInventorySheet();
        })();

        return _invPromise;
    }

    function matchInventoryItems(queryObj) {
        if (!_invCatalog.length || !queryObj) return [];
        const qId = String(queryObj.plantId || "").trim();
        const qLatin = normInvName(queryObj.latinName || "").split(" ").slice(0, 2).join(" ");
        const qNames = expandInvTokens(queryObj.commonName || queryObj.name || "");
        const qSlug = String(queryObj.slug || "").toLowerCase();

        return _invCatalog.filter(item => {
            if (qId && item.Plant_ID === qId) return true;
            const iLatin = normInvName(item.Latin_Name).split(" ").slice(0, 2).join(" ");
            if (qLatin && iLatin && qLatin === iLatin) {
                // Distinguish Fragaria chiloensis vs Fragaria x ananassa strictly by Latin
                return true;
            }
            const iNames = expandInvTokens(item.Plant_Name);
            for (const qn of qNames) {
                if (!qn || qn.length < 3) continue;
                for (const iname of iNames) {
                    if (qn === iname) return true;
                    if (qn.length >= 5 && iname.length >= 5 && (iname.startsWith(qn + " ") || qn.startsWith(iname + " "))) {
                        return true;
                    }
                }
            }
            if (qSlug && iLatin && qSlug.includes(iLatin.replace(/\s+/g, "-"))) return true;
            return false;
        });
    }

    function getInventorySummary(queryObj) {
        const matches = matchInventoryItems(queryObj);
        const inStock = matches.filter(m => !m._isPreOrder && !m._isOutOfStock && m._qtyNum > 0);
        const preOrder = matches.filter(m => m._isPreOrder);
        const outOfStock = matches.filter(m => !m._isPreOrder && (m._isOutOfStock || m._qtyNum <= 0));
        let statusType = "none";
        if (inStock.length) statusType = "in-stock";
        else if (preOrder.length) statusType = "pre-order";
        else if (outOfStock.length) statusType = "out-of-stock";

        const allPrices = matches.map(m => parseFloat(m.Price_CAD)).filter(n => Number.isFinite(n) && n > 0);
        const lowestPrice = allPrices.length ? Math.min(...allPrices) : null;
        const primaryItem = inStock[0] || preOrder[0] || null;
        return { matches, inStock, preOrder, outOfStock, lowestPrice, primaryItem, statusType };
    }

    function buildOrderHref(queryObj, item, forcePreorder) {
        const name = (queryObj && (queryObj.commonName || queryObj.name || queryObj.latinName)) || (item ? item.Plant_Name : "");
        if (item) {
            const modeParam = (forcePreorder || item._isPreOrder) ? "&mode=preorder" : "";
            return `orders.html?plant=${encodeURIComponent(name)}&add=${encodeURIComponent(item.Plant_ID)}${modeParam}`;
        }
        return `orders.html?preorder=${encodeURIComponent(name)}`;
    }

    function getCurrentPageKey() {
        const file = ((global.location && global.location.pathname) ? global.location.pathname.split("/").pop() : "").toLowerCase();
        if (file.includes("nativeplants")) return "nativeplants";
        if (file.includes("plant-planner")) return "plant-planner";
        if (file.includes("garden")) return "garden";
        if (file.includes("calendar")) return "calendar";
        if (file.includes("bios")) return "bios";
        if (file.includes("orders")) return "orders";
        return "sidebar";
    }

    function getPreOrderThemeClass(opts = {}) {
        const key = String(opts.pageTheme || getCurrentPageKey()).toLowerCase();
        return `theme-${key}`;
    }

    function buildPreOrderPayloadAttr(queryObj, item) {
        const name = (item && item.Plant_Name) || (queryObj && (queryObj.commonName || queryObj.name || queryObj.latinName)) || "Live Plant";
        const payload = {
            plantId: (item && item.Plant_ID) || (queryObj && queryObj.plantId) || "",
            plantName: name,
            latinName: (item && item.Latin_Name) || (queryObj && queryObj.latinName) || "",
            potSize: (item && item.Pot_Size_Format) || "",
            priceCad: (item && item.Price_CAD) || "",
            readyWindow: (item && item.Ready_Window) || "Seasonal Pre-Order"
        };
        return escHtml(JSON.stringify(payload));
    }

    function renderPreOrderButton(queryObj, item, opts = {}) {
        const themeCls = getPreOrderThemeClass(opts);
        const compactCls = opts.compact ? " compact" : "";
        const extraCls = opts.className ? ` ${opts.className}` : "";
        const customColor = item && item.PreOrder_Button_Color ? item.PreOrder_Button_Color.trim() : "";
        const customStyle = customColor ? ` style="background:${escHtml(customColor)};border-color:${escHtml(customColor)};color:#ffffff;"` : "";
        const name = (item && item.Plant_Name) || (queryObj && (queryObj.commonName || queryObj.name || queryObj.latinName)) || "Plant";
        const label = opts.label || (opts.compact ? "📅 Pre-Order" : (item && Number(item.Price_CAD) > 0 ? `📅 Pre-Order ($${Number(item.Price_CAD).toFixed(2)})` : `📅 Pre-Order ${name}`));
        return `<button type="button" class="wcpp-preorder-btn ${themeCls}${compactCls}${extraCls}"${customStyle} data-preorder-payload="${buildPreOrderPayloadAttr(queryObj, item)}" title="Register for Pre-Order: ${escHtml(name)}">${label}</button>`;
    }

    function renderInventoryBadge(queryObj, opts = {}) {
        const summary = getInventorySummary(queryObj);
        const compactCls = opts.compact ? " compact" : "";

        if (summary.statusType === "in-stock") {
            const p = summary.inStock[0];
            const href = buildOrderHref(queryObj, p, false);
            const priceTxt = Number(p.Price_CAD) > 0 ? ` ($${Number(p.Price_CAD).toFixed(2)})` : "";
            return `<a href="${href}" class="wcpp-inv-badge in-stock${compactCls}" title="In stock at Surrey Royal Heights (${p._qtyNum} available) — click to order">🌱 In Stock${opts.compact ? "" : priceTxt}</a>`;
        }
        if (summary.statusType === "pre-order") {
            const p = summary.preOrder[0];
            const priceTxt = Number(p.Price_CAD) > 0 ? ` ($${Number(p.Price_CAD).toFixed(2)})` : "";
            return renderPreOrderButton(queryObj, p, {
                compact: Boolean(opts.compact),
                pageTheme: opts.pageTheme,
                label: opts.compact ? "📅 Pre-Order" : `📅 Pre-Order${priceTxt}`
            });
        }
        return "";
    }

    function renderInventoryCardBox(queryObj, opts = {}) {
        const summary = getInventorySummary(queryObj);
        if (!summary.matches.length) {
            return "";
        }
        const sortedMatches = summary.matches.slice().sort((a, b) => {
            const aTier = a._isPreOrder ? 2 : (a._qtyNum > 0 && !a._isOutOfStock ? 1 : 3);
            const bTier = b._isPreOrder ? 2 : (b._qtyNum > 0 && !b._isOutOfStock ? 1 : 3);
            return aTier - bTier;
        });
        const rowsHtml = sortedMatches.map(item => {
            const isPre = item._isPreOrder;
            const isOut = !isPre && (item._isOutOfStock || item._qtyNum <= 0);
            const href = buildOrderHref(queryObj, item, isPre);
            const statusPill = isPre
                ? `<span class="wcpp-inv-badge request compact">${item._qtyNum > 0 ? `${item._qtyNum} slots open` : "Seasonal reserve"}</span>`
                : (isOut
                    ? `<span class="wcpp-inv-badge compact" style="background:rgba(100,116,139,0.14);color:var(--text-muted,#64748b);border:1px solid var(--border-color,#cbd5e1);">0 Available</span>`
                    : `<span class="wcpp-inv-badge in-stock compact">✓ ${item._qtyNum} In Stock</span>`);
            const cleanReadyWindow = isPre
                ? (String(item.Ready_Window || "Seasonal Pickup").replace(/pre-?order\s*/ig, "").replace(/^\((.*)\)$/, "$1").trim() || "Seasonal Pickup")
                : (isOut ? "Currently out of stock (0 available)" : `Ready for pickup in Surrey (${item._qtyNum} available)`);
            const primaryAction = isPre
                ? renderPreOrderButton(queryObj, item, { pageTheme: opts.pageTheme, label: `📅 Pre-Order ($${Number(item.Price_CAD).toFixed(2)}) →` })
                : (isOut
                    ? `<span class="wcpp-inv-action-btn" style="opacity:0.55;cursor:not-allowed;background:var(--border-color,#e2e8f0);color:var(--text-muted,#64748b);pointer-events:none;">0 Available</span>`
                    : `<a href="${href}" class="wcpp-inv-action-btn in-stock">🌱 Order In-Stock ($${Number(item.Price_CAD).toFixed(2)}) →</a>`);
            return `<div class="wcpp-inv-item-row">
                <div class="wcpp-inv-item-head">
                    <strong>${escHtml(item.Plant_Name)}</strong>
                    ${statusPill}
                </div>
                <div class="wcpp-inv-item-meta">${escHtml(item.Pot_Size_Format)} &bull; ${escHtml(cleanReadyWindow)}</div>
                <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">${primaryAction}</div>
            </div>`;
        }).join("");
        return `<div class="wcpp-inv-card-box">${rowsHtml}</div>`;
    }

    async function openPreOrderModal(plantInfo) {
        await loadSharedInventory();
        const existing = document.getElementById("wcppPreOrderModal");
        if (existing) existing.remove();

        const initialName = (plantInfo && (plantInfo.plantName || plantInfo.commonName || plantInfo.name || plantInfo.latinName)) || "";
        const initialId = (plantInfo && plantInfo.plantId) || "";
        const initialQty = Math.max(1, parseInt((plantInfo && (plantInfo.qty || plantInfo.quantity)) || "1", 10) || 1);
        const sourcePage = ((global.location && global.location.pathname) ? global.location.pathname.split("/").pop() : "") || "index.html";

        // Load previous customer profile from localStorage for convenience
        let savedUser = {};
        try { savedUser = JSON.parse(localStorage.getItem("wcpp_preorder_user_v1") || "{}"); } catch (_) {}

        const preEnabledCatalog = _invCatalog.filter(item => item._isPreOrder);
        const optPool = preEnabledCatalog.length ? preEnabledCatalog : _invCatalog;
        const catalogOptions = optPool.map(item =>
            `<option value="${escHtml(item.Plant_Name)}" data-id="${escHtml(item.Plant_ID)}">${escHtml(item.Plant_Name)} (${escHtml(item.Pot_Size_Format)} • $${Number(item.Price_CAD).toFixed(2)})</option>`
        ).join("");

        const stagedPlants = initialName ? [{ plantId: initialId, plantName: initialName, qty: initialQty }] : [];

        const bd = document.createElement("div");
        bd.id = "wcppPreOrderModal";
        bd.className = "wcpp-modal-backdrop";
        bd.innerHTML = `
            <div class="wcpp-modal" role="dialog" aria-modal="true" aria-label="Register for Plant Pre-Order">
                <div class="wcpp-modal-header">
                    <h2>📅 Register for Live Plant Pre-Order</h2>
                    <button type="button" class="wcpp-modal-close" aria-label="Close">✕</button>
                </div>
                <form id="wcppPreOrderForm" style="display:flex; flex-direction:column; min-height:0; overflow:hidden;">
                    <div class="wcpp-modal-body">
                        <p class="wcpp-help-text" style="margin:0;">
                            Reserve upcoming nursery stock ahead of release. We will group all your pre-orders under your profile and email you as soon as quantities are ready to order via Interac e-Transfer.
                        </p>
                        <div class="wcpp-preorder-grid">
                            <div class="wcpp-field-group">
                                <label for="poFirstName">First Name *</label>
                                <input type="text" id="poFirstName" class="wcpp-input" required value="${escHtml(savedUser.firstName || "")}" placeholder="e.g. Jordan" />
                            </div>
                            <div class="wcpp-field-group">
                                <label for="poLastName">Last Name *</label>
                                <input type="text" id="poLastName" class="wcpp-input" required value="${escHtml(savedUser.lastName || "")}" placeholder="e.g. Lee" />
                            </div>
                        </div>
                        <div class="wcpp-preorder-grid">
                            <div class="wcpp-field-group">
                                <label for="poCity">City *</label>
                                <input type="text" id="poCity" list="wcppCitySuggestions" class="wcpp-input" required value="${escHtml(savedUser.city || "Surrey")}" placeholder="e.g. Surrey, Burnaby, Vancouver" />
                                <datalist id="wcppCitySuggestions">
                                    <option value="Surrey"></option><option value="Vancouver"></option><option value="Burnaby"></option>
                                    <option value="Coquitlam / Tri-Cities"></option><option value="Richmond"></option><option value="Delta"></option>
                                    <option value="Langley"></option><option value="New Westminster"></option><option value="North Vancouver"></option>
                                    <option value="Abbotsford"></option><option value="Victoria"></option>
                                </datalist>
                            </div>
                            <div class="wcpp-field-group">
                                <label for="poEmail">Email *</label>
                                <input type="email" id="poEmail" class="wcpp-input" required value="${escHtml(savedUser.email || "")}" placeholder="e.g. jordan@example.com" />
                            </div>
                        </div>
                        <div style="padding:12px; border-radius:12px; background:var(--wcpp-bg); border:1px solid var(--wcpp-border); display:flex; flex-direction:column; gap:10px;">
                            <div style="font-size:0.82rem; font-weight:800; color:var(--wcpp-primary);">Plant(s) &amp; Quantity Needed</div>
                            <div id="poStagedList" style="display:flex; flex-direction:column; gap:6px;"></div>
                            <div style="display:grid; grid-template-columns: 1fr 90px auto; gap:8px; align-items:end;">
                                <div class="wcpp-field-group">
                                    <label for="poAddPlantInput">Add / Select Plant</label>
                                    <input type="text" id="poAddPlantInput" list="wcppPreOrderCatalogOpts" class="wcpp-input" placeholder="Type or pick any plant..." value="${stagedPlants.length ? "" : escHtml(initialName)}" />
                                    <datalist id="wcppPreOrderCatalogOpts">${catalogOptions}</datalist>
                                </div>
                                <div class="wcpp-field-group">
                                    <label for="poAddQtyInput">Quantity *</label>
                                    <input type="number" id="poAddQtyInput" class="wcpp-input" min="1" value="1" />
                                </div>
                                <button type="button" id="poAddLineBtn" class="wcpp-pill-btn">+ Add</button>
                            </div>
                        </div>
                        <div class="wcpp-field-group">
                            <label for="poNotes">Notes / Preferred Pickup Window (Optional)</label>
                            <input type="text" id="poNotes" class="wcpp-input" placeholder="e.g. Spring planting, weekend pickup..." />
                        </div>
                        <div id="poFeedbackBox" style="display:none; padding:12px; border-radius:10px; background:#dcfce7; color:#14532d; border:1px solid #86efac; font-size:0.86rem; font-weight:700;"></div>
                    </div>
                    <div class="wcpp-modal-footer" style="justify-content:space-between;">
                        <a href="orders.html" class="wcpp-pill-btn">View Live Orders Page →</a>
                        <div style="display:flex; gap:8px;">
                            <button type="button" class="wcpp-pill-btn" id="poCancelBtn">Close</button>
                            <button type="submit" class="wcpp-pill-btn primary" id="poSubmitBtn">✓ Register Pre-Order</button>
                        </div>
                    </div>
                </form>
            </div>
        `;

        const stagedListEl = bd.querySelector("#poStagedList");
        function renderStaged() {
            if (!stagedPlants.length) {
                stagedListEl.innerHTML = `<div class="wcpp-help-text">Enter a plant name and quantity below to register.</div>`;
                return;
            }
            stagedListEl.innerHTML = stagedPlants.map((sp, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:7px 10px; border-radius:8px; background:var(--wcpp-card); border:1px solid var(--wcpp-border);">
                    <div style="font-size:0.86rem; font-weight:800; color:var(--wcpp-text);">${escHtml(sp.plantName)}</div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <label style="font-size:0.74rem; color:var(--wcpp-muted); font-weight:700;">Qty:</label>
                        <input type="number" min="1" value="${sp.qty}" data-po-qty="${idx}" class="wcpp-input" style="width:68px; padding:4px 8px; text-align:center;" />
                        <button type="button" data-po-rm="${idx}" class="wcpp-plan-remove-btn" aria-label="Remove">✕</button>
                    </div>
                </div>
            `).join("");
            stagedListEl.querySelectorAll("[data-po-qty]").forEach(inp => {
                inp.onchange = () => {
                    const i = parseInt(inp.getAttribute("data-po-qty"), 10);
                    stagedPlants[i].qty = Math.max(1, parseInt(inp.value, 10) || 1);
                };
            });
            stagedListEl.querySelectorAll("[data-po-rm]").forEach(btn => {
                btn.onclick = () => {
                    stagedPlants.splice(parseInt(btn.getAttribute("data-po-rm"), 10), 1);
                    renderStaged();
                };
            });
        }
        renderStaged();

        bd.querySelector("#poAddLineBtn").onclick = () => {
            const pInp = bd.querySelector("#poAddPlantInput");
            const qInp = bd.querySelector("#poAddQtyInput");
            const pName = (pInp.value || "").trim();
            if (!pName) return;
            const qty = Math.max(1, parseInt(qInp.value, 10) || 1);
            const matchedInv = _invCatalog.find(x => x.Plant_Name.toLowerCase() === pName.toLowerCase());
            const existingLine = stagedPlants.find(s => s.plantName.toLowerCase() === pName.toLowerCase());
            if (existingLine) existingLine.qty += qty;
            else stagedPlants.push({ plantId: matchedInv ? matchedInv.Plant_ID : "", plantName: pName, qty });
            pInp.value = "";
            qInp.value = "1";
            renderStaged();
        };

        const closeModal = () => {
            bd.remove();
            document.removeEventListener("keydown", onEsc);
        };
        const onEsc = (e) => { if (e.key === "Escape") closeModal(); };
        document.addEventListener("keydown", onEsc);
        bd.querySelector(".wcpp-modal-close").onclick = closeModal;
        bd.querySelector("#poCancelBtn").onclick = closeModal;
        bd.addEventListener("click", (e) => { if (e.target === bd) closeModal(); });

        bd.querySelector("#wcppPreOrderForm").onsubmit = async (ev) => {
            ev.preventDefault();
            const pendingName = (bd.querySelector("#poAddPlantInput").value || "").trim();
            if (pendingName) {
                bd.querySelector("#poAddLineBtn").click();
            }
            if (!stagedPlants.length) {
                alert("Please specify at least one plant and quantity needed.");
                return;
            }
            const firstName = bd.querySelector("#poFirstName").value.trim();
            const lastName = bd.querySelector("#poLastName").value.trim();
            const city = bd.querySelector("#poCity").value.trim();
            const email = bd.querySelector("#poEmail").value.trim();
            const notes = bd.querySelector("#poNotes").value.trim();
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
            const batchId = `PRE-${String(Date.now()).slice(-5)}`;

            try {
                localStorage.setItem("wcpp_preorder_user_v1", JSON.stringify({ firstName, lastName, city, email }));
            } catch (_) {}

            const submitBtn = bd.querySelector("#poSubmitBtn");
            submitBtn.disabled = true;
            submitBtn.textContent = "⏳ Registering...";

            try {
                if (global.WCPPAdmin && global.WCPPAdmin.ready) await global.WCPPAdmin.ready;
                const createdRecords = stagedPlants.map((sp, i) => ({
                    PreOrder_ID: stagedPlants.length > 1 ? `${batchId}-${i + 1}` : batchId,
                    Date_Registered: dateStr,
                    First_Name: firstName,
                    Last_Name: lastName,
                    City: city,
                    Email: email,
                    Plant_ID: sp.plantId || "",
                    Plant_Name: sp.plantName,
                    Qty_Needed: String(sp.qty),
                    Source_Page: sourcePage,
                    Notes: notes,
                    Status: "Registered — Waiting"
                }));

                if (global.WCPPAdmin && typeof global.WCPPAdmin.addRecord === "function") {
                    for (const rec of createdRecords) {
                        await global.WCPPAdmin.addRecord("preorders_log", rec);
                    }
                }

                // Best-effort sync to Google Apps Script webhook if configured
                let webhookUrl = (localStorage.getItem("wcpp_orders_webhook_url") || "").trim();
                if (!webhookUrl) {
                    try {
                        const cfgRes = await fetch("data/orders_config.json?v=20261120a");
                        if (cfgRes.ok) {
                            const cfg = await cfgRes.json();
                            if (cfg && cfg.webhookUrl) webhookUrl = String(cfg.webhookUrl).trim();
                        }
                    } catch (_) {}
                }
                if (webhookUrl) {
                    fetch(webhookUrl, {
                        method: "POST",
                        mode: "no-cors",
                        headers: { "Content-Type": "text/plain;charset=utf-8" },
                        body: JSON.stringify({
                            action: "append_preorders",
                            preorders: createdRecords
                        })
                    }).catch(() => {});
                }

                if (global.WCPPAnalytics) {
                    global.WCPPAnalytics.track("generate_lead", {
                        currency: "CAD",
                        value: 0,
                        lead_source: `preorder_${sourcePage}`,
                        items: stagedPlants.map(sp => ({
                            item_id: sp.plantId || sp.plantName,
                            item_name: sp.plantName,
                            item_category: "Pre-Order Registration",
                            quantity: sp.qty
                        }))
                    });
                }

                const fb = bd.querySelector("#poFeedbackBox");
                fb.style.display = "block";
                fb.innerHTML = `✓ Pre-order registered for <strong>${escHtml(firstName)} ${escHtml(lastName)}</strong> (${escHtml(city)})! We've logged ${createdRecords.length} plant${createdRecords.length === 1 ? "" : "s"} and will email <strong>${escHtml(email)}</strong> when ready.`;
                if (global.WCPPAdmin && typeof global.WCPPAdmin.toast === "function") {
                    global.WCPPAdmin.toast("✓ Pre-order registered!");
                }
                submitBtn.textContent = "✓ Registered!";
            } finally {
                submitBtn.disabled = false;
            }
        };

        document.body.appendChild(bd);
    }

    if (!global._wcppPreOrderBtnBound) {
        global._wcppPreOrderBtnBound = true;
        document.addEventListener("click", (e) => {
            const btn = e.target && e.target.closest ? e.target.closest(".wcpp-preorder-btn[data-preorder-payload]") : null;
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            try {
                const payload = JSON.parse(btn.getAttribute("data-preorder-payload") || "{}");
                openPreOrderModal(payload);
            } catch (_) {
                openPreOrderModal({});
            }
        });
    }

    global.WCPPInventory = {
        load: loadSharedInventory,
        reload: () => loadSharedInventory(true),
        getAll: () => _invCatalog.slice(),
        isLoaded: () => _invLoaded,
        match: matchInventoryItems,
        getSummary: getInventorySummary,
        renderBadge: renderInventoryBadge,
        renderCardBox: renderInventoryCardBox,
        renderPreOrderButton,
        openPreOrderModal,
        buildOrderHref
    };

    // Preload inventory immediately on orders.html, or during idle time on other pages so first paint stays fast
    if (/orders\.html/i.test((global.location && global.location.pathname) || "")) {
        loadSharedInventory();
    } else {
        scheduleWhenIdle(() => loadSharedInventory(), 1200);
    }

    global.addEventListener("wcpp:curator-changed", () => {
        loadSharedInventory(true);
    });

    // =========================================================================
    // 3B. SHARED ARTICLES & SUBJECT-MATTER MATCHER (WCPPArticles)
    // =========================================================================
    const LS_CUSTOM_ARTICLE_CATS = "wcpp_custom_article_categories_v1";
    const ARTICLE_FEEDS = {
        ecosystem: {
            key: "ecosystem",
            label: "Ecosystem Information",
            shortLabel: "Ecosystems",
            url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQiCqSoLqeDHvqbsXBVFaIpHzE9g2CUejM0ggHYpyx--KEnv3ztjW1Bp9xBj_wYj1h_LW4N6O2e92Kn/pub?output=csv"
        },
        first_nations: {
            key: "first_nations",
            label: "First Nations",
            shortLabel: "First Nations",
            url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQJmDrDjXU3hiJJ5wqYXtj6BTfMwNnwNRkjWWxbKAInFiTfr4QpbLUc3YsPfJq5yy9CvWE1VQTodceZ/pub?output=csv"
        },
        plant_science: {
            key: "plant_science",
            label: "Plant Science & News",
            shortLabel: "Plant Science",
            url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQxRxBg9GlSlQdLohbOcq91IgCy8J7jXGkB4zCgdxorqR9VLnmg-lEvQJzj0Idz4R5zx2O2eKZE9PYC/pub?output=csv"
        },
        bees_insects: {
            key: "bees_insects",
            label: "Bees & Other Insects",
            shortLabel: "Bees & Insects",
            url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3LzWlU8kCuQQD4cAkiCOfuOk3siCKCob4goIF4CmIee5fI6gcDjn70Zdojhab3fpj4O_K0LQQOqIi/pub?output=csv"
        }
    };

    function slugifyCategoryKey(label) {
        return String(label || "custom")
            .toLowerCase()
            .replace(/&/g, " ")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "") || "custom";
    }

    function getCustomArticleCategories() {
        try {
            const raw = localStorage.getItem(LS_CUSTOM_ARTICLE_CATS);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.filter(c => c && (c.label || typeof c === "string")) : [];
        } catch (_) {
            return [];
        }
    }

    function getMergedFeedConfig() {
        const merged = Object.assign({}, ARTICLE_FEEDS);
        getCustomArticleCategories().forEach(c => {
            const label = typeof c === "string" ? c.trim() : String(c.label || "").trim();
            if (!label) return;
            const key = (typeof c === "object" && c.key) ? c.key : slugifyCategoryKey(label);
            if (!merged[key]) {
                merged[key] = {
                    key,
                    label,
                    shortLabel: label.length > 22 ? label.slice(0, 20) + "…" : label,
                    url: (typeof c === "object" && c.url) ? c.url : "",
                    isCustom: true
                };
            }
        });
        // Also discover any custom Category values present on saved articles
        (_articlesCatalog || []).forEach(art => {
            const label = String(art && art.Category || "").trim();
            if (!label) return;
            const exists = Object.values(merged).some(f => f.label.toLowerCase() === label.toLowerCase());
            if (!exists) {
                const key = slugifyCategoryKey(label);
                merged[key] = {
                    key,
                    label,
                    shortLabel: label.length > 22 ? label.slice(0, 20) + "…" : label,
                    url: "",
                    isCustom: true
                };
            }
        });
        return merged;
    }

    function getArticleCategories() {
        const cfg = getMergedFeedConfig();
        return Object.values(cfg).map(f => f.label);
    }

    function addCustomArticleCategory(label, csvUrl = "") {
        const clean = String(label || "").trim();
        if (!clean) return null;
        const cfg = getMergedFeedConfig();
        const existing = Object.values(cfg).find(f => f.label.toLowerCase() === clean.toLowerCase());
        if (existing) return existing;

        const key = slugifyCategoryKey(clean);
        const list = getCustomArticleCategories();
        const entry = {
            key,
            label: clean,
            shortLabel: clean.length > 22 ? clean.slice(0, 20) + "…" : clean,
            url: String(csvUrl || "").trim(),
            isCustom: true
        };
        list.push(entry);
        try {
            localStorage.setItem(LS_CUSTOM_ARTICLE_CATS, JSON.stringify(list));
        } catch (_) {}
        ARTICLE_FEEDS[key] = entry;
        global.dispatchEvent(new CustomEvent("wcpp:article-categories-changed", { detail: { category: entry, categories: getArticleCategories() } }));
        return entry;
    }

    let _hashtagBankCache = null;
    let _hashtagBankPromise = null;
    async function loadArticleHashtagBank() {
        if (_hashtagBankCache) return _hashtagBankCache;
        if (_hashtagBankPromise) return _hashtagBankPromise;
        _hashtagBankPromise = (async () => {
            try {
                const res = await fetch("data/article_hashtags.json");
                if (res.ok) {
                    const data = await res.json();
                    if (data && typeof data === "object") {
                        _hashtagBankCache = data;
                        return _hashtagBankCache;
                    }
                }
            } catch (_) {}
            _hashtagBankCache = {};
            return _hashtagBankCache;
        })();
        return _hashtagBankPromise;
    }

    async function autoGenerateHashtags(textOrObj, explicitCategory) {
        const bank = await loadArticleHashtagBank();
        const isObj = textOrObj && typeof textOrObj === "object";
        const title = isObj ? String(textOrObj.Title || textOrObj.title || "") : "";
        const desc = isObj ? String(textOrObj.Description || textOrObj.description || "") : String(textOrObj || "");
        const cat = String(explicitCategory || (isObj ? textOrObj.Category : "") || "").trim();
        const blob = `${title} ${desc} ${cat}`.toLowerCase();

        // Collect candidate tags from matching category bank first, then other banks
        const catTags = Array.isArray(bank[cat]) ? bank[cat] : [];
        const allBanks = catTags.length
            ? [...catTags, ...Object.entries(bank).filter(([k]) => k !== cat).flatMap(([, v]) => Array.isArray(v) ? v : [])]
            : Object.values(bank).flatMap(v => Array.isArray(v) ? v : []);

        const matched = [];
        const seen = new Set();
        const pushTag = (raw) => {
            const clean = String(raw || "").trim().replace(/^#+/, "");
            if (!clean || clean.length < 2) return;
            const norm = clean.toLowerCase();
            if (seen.has(norm)) return;
            seen.add(norm);
            matched.push(`#${clean.replace(/\s+/g, "-")}`);
        };

        // Always include normalized category tag
        if (cat) pushTag(cat.replace(/&/g, "and").replace(/[^a-zA-Z0-9\s-]/g, "").trim());

        // Match spreadsheet bank phrases appearing in article text
        for (let i = 0; i < allBanks.length && matched.length < 9; i++) {
            const tag = String(allBanks[i] || "").trim();
            const normTag = tag.toLowerCase();
            if (!tag || normTag.length < 3) continue;
            if (blob.includes(normTag)) {
                pushTag(tag);
            }
        }

        // Fallback keyword extraction from Title & Description
        const stopWords = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "over", "under", "about", "using", "their", "study", "article", "guide", "research", "news", "plant", "plants"]);
        const tokens = blob.replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(w => w.length >= 4 && !stopWords.has(w));
        for (let i = 0; i < tokens.length && matched.length < 10; i++) {
            pushTag(tokens[i]);
        }
        return matched.slice(0, 10).join(" ");
    }

    const FALLBACK_ARTICLES = [
        {
            Title: "Meet the Plants: Coast Salish Food Systems & BC Native Flora",
            URL: "https://galianoconservancy.ca/food-systems/meet-the-plants/",
            Description: "Galiano Conservancy field guide to Indigenous Coast Salish food plants, traditional harvesting stewardship, cama meadows, native berries, and cultural ecosystems across the Salish Sea.",
            Tags: "first nations, coast salish, ethnobotany, traditional food, camas, salal, oregon-grape, rose, currant, garry oak, bc native plants",
            Category: "First Nations",
            _feedKey: "first_nations",
            _isFallback: true
        },
        {
            Title: "Good Garden Practices: Designing Resilient Native Plant Communities",
            URL: "https://ecologicaldesignlab.ca/site/uploads/2024/12/04_good-garden-practices.pdf",
            Description: "Practical ecological gardening guide covering soil structure, mycorrhizal networks, moisture zoning, mulching, meadow stewardship, canopy layering, and pollinator habitat in the Pacific Northwest.",
            Tags: "ecosystem, soil, mycorrhizae, drought, moisture, meadow, canopy, habitat, restoration, native garden, rain garden",
            Category: "Ecosystem Information",
            _feedKey: "ecosystem",
            _isFallback: true
        },
        {
            Title: "Deer-Resistant & Wildlife-Friendly Native Plants in Canadian Gardens",
            URL: "https://cwf-fcf.org/en/news/articles/deer-resistant-plants_resource.html",
            Description: "Canadian Wildlife Federation guide to selecting deer-resistant native shrubs, perennials, nectar sources for bees, bumblebees, hummingbirds, and butterfly/moth larval host plants.",
            Tags: "pollinators, bees, bumblebee, butterfly, moth, hummingbird, deer resistant, wildlife, native plants, insects",
            Category: "Bees & Other Insects",
            _feedKey: "bees_insects",
            _isFallback: true
        },
        {
            Title: "E-Flora BC: Electronic Atlas of the Flora of British Columbia",
            URL: "https://linnet.geog.ubc.ca/Biodiversity/eflora/",
            Description: "UBC Biodiversity Research Centre atlas detailing BC biogeoclimatic zones, vascular plant distribution, wetland indicators, alpine/coastal ecology, and taxonomic descriptions.",
            Tags: "ecosystem, bc flora, biogeoclimatic, wetland, riparian, forest, taxonomy, native plants, habitat",
            Category: "Ecosystem Information",
            _feedKey: "ecosystem",
            _isFallback: true
        },
        {
            Title: "Native Plant Network: Seed Stratification, Dormancy & Nursery Propagation Protocols",
            URL: "https://www.nativeplantnetwork.org",
            Description: "Peer-contributed nursery propagation protocols covering cold-moist seed stratification, scarification, germination timing, mycorrhizal inoculation, and container plug growing across Pacific Northwest species.",
            Tags: "propagation, seeds, stratification, dormancy, nursery, native plants, plant science, soil, germination",
            Category: "Plant Science & News",
            _feedKey: "plant_science",
            _isFallback: true
        },
        {
            Title: "Plants For A Future (PFAF): Edible, Medicinal & Forest-Garden Companion Guilds",
            URL: "https://pfaf.org",
            Description: "Botanical database exploring edible perennials, medicinal uses, nitrogen-fixing guilds, soil pH preferences, agroforestry companions, and low-input permaculture plantings.",
            Tags: "plant science, edible, medicinal, companion, nitrogen, forest garden, polyculture, soil ph, perennial",
            Category: "Plant Science & News",
            _feedKey: "plant_science",
            _isFallback: true
        },
        {
            Title: "Calscape Pacific Habitat Guides: Lepidoptera Caterpillar Hosts & Native Bee Webs",
            URL: "https://calscape.org",
            Description: "West Coast native plant-insect ecology profiling specialist butterflies, moth larval host genera, native solitary bees, drought-tolerant coastal scrub, and oak woodlands.",
            Tags: "bees, butterfly, moth, lepidoptera, host plant, oak, meadow, pollinator, insects, drought",
            Category: "Bees & Other Insects",
            _feedKey: "bees_insects",
            _isFallback: true
        },
        {
            Title: "USDA PLANTS Database: Conservation Guides, Erosion Control & Wetland Ecology",
            URL: "https://plants.sc.egov.usda.gov",
            Description: "Plant fact sheets covering root formation, erosion control, riparian stabilization, fire ecology, salinity tolerance, nitrogen fixation, and wetland indicator regions.",
            Tags: "ecosystem, wetland, erosion, fire ecology, salinity, nitrogen, root, conservation, riparian",
            Category: "Ecosystem Information",
            _feedKey: "ecosystem",
            _isFallback: true
        },
        {
            Title: "Tomato Seed Germination, Sanitization & Seedling Vigor Research (Solanum lycopersicum)",
            URL: "https://www.semanticscholar.org/paper/41d3fe0191c60b9f6bdd3113d27863264b3d4b42",
            Description: "Agricultural seed science paper examining germination vigor, pathogen sanitization, and controlled-environment transplant readiness for tomatoes and Solanaceae garden crops.",
            Tags: "tomato, solanum, solanaceae, germination, seedling, agriculture, vegetable, garden, plant science, pepper",
            Category: "Plant Science & News",
            _feedKey: "plant_science",
            _isFallback: true
        },
        {
            Title: "Cucurbit & Cucumber Seed Treatment & Emergence Science (Cucumis sativus)",
            URL: "https://www.semanticscholar.org/paper/277f7bc9dd82f7a8629a2450d8a6ed0d05d81b1c",
            Description: "Plant science study on cucurbit seed germination, disease suppression, and vigorous early stand establishment for cucumbers, squash, pumpkins, and melons.",
            Tags: "cucumber, cucumis, cucurbitaceae, squash, pumpkin, melon, germination, agriculture, vegetable, plant science",
            Category: "Plant Science & News",
            _feedKey: "plant_science",
            _isFallback: true
        },
        {
            Title: "Legume & Bean Seed Vigor and Root Symbiosis Study (Phaseolus vulgaris)",
            URL: "https://www.semanticscholar.org/paper/7ba44c9ef539e3dc169d0fe632d9679fa32fdc25",
            Description: "Agronomic study evaluating kidney bean germination, nitrogen-fixing rhizobia crop rotation benefits, and companion intercropping performance in vegetable beds.",
            Tags: "bean, phaseolus, fabaceae, pea, legume, nitrogen, companion, agriculture, vegetable, plant science",
            Category: "Plant Science & News",
            _feedKey: "plant_science",
            _isFallback: true
        },
        {
            Title: "Brassicaceae & Radish Germination, Fungal Suppression & Crop Health Study",
            URL: "https://pubmed.ncbi.nlm.nih.gov/11299341/",
            Description: "Peer-reviewed seed health research covering radish and Brassicaceae crop emergence (kale, broccoli, cabbage, collards, arugula), fungal pathogen management, and garden bed rotation.",
            Tags: "radish, kale, broccoli, cabbage, collards, brassica, brassicaceae, fungus, disease, agriculture, plant science",
            Category: "Plant Science & News",
            _feedKey: "plant_science",
            _isFallback: true
        }
    ];

    const ARTICLES_CACHE_KEY = "wcpp_articles_cache_v1";
    const ARTICLES_CACHE_TTL_MS = 15 * 60 * 1000;
    let _articlesRawBase = [];
    let _articlesCatalog = [];
    let _articlesLoaded = false;
    let _articlesPromise = null;

    function normalizeArticleRow(row, feedMeta, isFallback) {
        let rowUrl = row.URL || row.Link || row.url || row.link || row.Website || row["Article Link"] || row["Hyperlink"] || "";
        if (!rowUrl) {
            rowUrl = Object.values(row).find(v => typeof v === "string" && v.trim().startsWith("http")) || "";
        }
        rowUrl = String(rowUrl || "").trim();
        if (!rowUrl) return null;
        let rowImg = row["Image URL"] || row["Image Link"] || row.Image || row.image || row.Photo || row.Thumbnail || row.Picture || "";
        const mergedCfg = getMergedFeedConfig();
        let feedKey = row._feedKey || (feedMeta ? feedMeta.key : "");
        if (!feedKey && row.Category) {
            const catLow = String(row.Category).trim().toLowerCase();
            const foundMeta = Object.values(mergedCfg).find(f => f.label.toLowerCase() === catLow || f.key.toLowerCase() === catLow);
            feedKey = foundMeta ? foundMeta.key : slugifyCategoryKey(row.Category);
        }
        if (!feedKey) feedKey = "ecosystem";
        const catLabel = String(row.Category || (feedMeta ? feedMeta.label : (mergedCfg[feedKey] ? mergedCfg[feedKey].label : "Library Resource"))).trim();
        const out = Object.assign({}, row, {
            Title: String(row.Title || row.Name || row["Name of Article"] || row.title || row.name || row.Topic || row.Article || "Untitled Resource").trim(),
            URL: rowUrl,
            Description: String(row.Description || row["Brief Description"] || row.description || row.Summary || row.summary || row.Notes || row.About || "").trim(),
            Tags: String(row.Tags || row.Hashtags || row.tags || row.Keywords || "").trim(),
            "Image URL": String(rowImg || "").trim(),
            Category: catLabel,
            _feedKey: feedKey,
            _isFallback: Boolean(isFallback || row._isFallback)
        });
        out._searchBlob = `${out.Title} ${out.Description} ${out.Tags} ${out.Category}`.toLowerCase();
        return out;
    }

    function dedupeArticles(list) {
        const map = new Map();
        list.forEach(item => {
            if (!item || !item.URL) return;
            const normUrl = item.URL.trim().replace(/\/+$/, "").toLowerCase();
            const existing = map.get(normUrl);
            if (!existing || (existing._isFallback && !item._isFallback)) {
                map.set(normUrl, item);
            }
        });
        return Array.from(map.values());
    }

    function applyArticlesCuratorOverrides(baseList) {
        let merged = baseList.slice();
        if (global.WCPPAdmin && typeof global.WCPPAdmin.applyOverrides === "function") {
            merged = global.WCPPAdmin.applyOverrides("articles_custom", merged, "URL");
        }
        const mergedCfg = getMergedFeedConfig();
        return merged.map(item => normalizeArticleRow(item, mergedCfg[item._feedKey], item._isFallback)).filter(Boolean);
    }

    async function loadSharedArticles(force = false) {
        if (_articlesLoaded && !force) return _articlesCatalog;
        if (_articlesPromise && !force) return _articlesPromise;

        _articlesPromise = (async () => {
            if (global.WCPPAdmin && global.WCPPAdmin.ready) {
                await global.WCPPAdmin.ready.catch(() => {});
            }

            const fallbackNorm = FALLBACK_ARTICLES.map(a => normalizeArticleRow(a, ARTICLE_FEEDS[a._feedKey], true)).filter(Boolean);

            // Always preload local articles_base.json so Studio & Articles work cleanly offline/immediately
            let localJsonRows = [];
            try {
                const localRes = await fetch("data/articles_base.json");
                if (localRes.ok) {
                    const localRaw = await localRes.json();
                    const arr = global.unpackDatasetJson(localRaw);
                    localJsonRows = arr.map(r => normalizeArticleRow(r, null, false)).filter(Boolean);
                }
            } catch (_) {}

            let feedRows = [];
            let usedSessionCache = false;
            if (!force) {
                try {
                    const cachedRaw = sessionStorage.getItem(ARTICLES_CACHE_KEY);
                    if (cachedRaw) {
                        const parsedCache = JSON.parse(cachedRaw);
                        if (parsedCache && Array.isArray(parsedCache.items) && (Date.now() - (parsedCache.ts || 0) < ARTICLES_CACHE_TTL_MS)) {
                            feedRows = parsedCache.items;
                            usedSessionCache = true;
                        }
                    }
                } catch (_) {}
            }

            if (usedSessionCache) {
                _articlesRawBase = dedupeArticles([...feedRows, ...localJsonRows, ...fallbackNorm]);
                _articlesCatalog = applyArticlesCuratorOverrides(_articlesRawBase);
                _articlesLoaded = true;
                global.dispatchEvent(new CustomEvent("wcpp:articles-ready", { detail: { articles: _articlesCatalog } }));
                return _articlesCatalog;
            }

            // Phase 1: Render local articles_base.json immediately without waiting on 4 external Google Sheets CSVs
            let prevArtSig = "";
            if (localJsonRows.length) {
                _articlesRawBase = dedupeArticles([...localJsonRows, ...fallbackNorm]);
                _articlesCatalog = applyArticlesCuratorOverrides(_articlesRawBase);
                _articlesLoaded = true;
                prevArtSig = _articlesCatalog.map(a => `${a.URL}|${a.Title}|${a.Tags}`).join("\n");
                global.dispatchEvent(new CustomEvent("wcpp:articles-ready", { detail: { articles: _articlesCatalog } }));
            }

            // Phase 2: Sync live Google Sheets CSV feeds in background & seamlessly merge any new/updated rows
            const syncLiveArticleFeeds = async () => {
                const feedDefs = Object.values(getMergedFeedConfig()).filter(f => f.url);
                const settled = await Promise.allSettled(feedDefs.map(async (f) => {
                    const res = await fetch(f.url);
                    if (!res.ok) return [];
                    const txt = await res.text();
                    if (!txt || txt.trim().startsWith("<!DOCTYPE")) return [];
                    const parsed = parseSimpleCsvObjects(txt);
                    return parsed
                        .map(r => normalizeArticleRow(r, f, false))
                        .filter(Boolean)
                        .reverse();
                }));
                let liveFeedRows = [];
                settled.forEach(res => {
                    if (res.status === "fulfilled" && Array.isArray(res.value)) {
                        liveFeedRows = liveFeedRows.concat(res.value);
                    }
                });
                if (liveFeedRows.length) {
                    try {
                        sessionStorage.setItem(ARTICLES_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: liveFeedRows }));
                    } catch (_) {}
                }

                _articlesRawBase = dedupeArticles([...liveFeedRows, ...localJsonRows, ...fallbackNorm]);
                _articlesCatalog = applyArticlesCuratorOverrides(_articlesRawBase);
                _articlesLoaded = true;
                const nextArtSig = _articlesCatalog.map(a => `${a.URL}|${a.Title}|${a.Tags}`).join("\n");
                if (!localJsonRows.length || nextArtSig !== prevArtSig || force) {
                    global.dispatchEvent(new CustomEvent("wcpp:articles-ready", { detail: { articles: _articlesCatalog } }));
                }
                return _articlesCatalog;
            };

            if (!force && localJsonRows.length) {
                syncLiveArticleFeeds().catch(() => {});
                return _articlesCatalog;
            }
            return await syncLiveArticleFeeds();
        })();

        return _articlesPromise;
    }

    function escapeRegExp(s) {
        return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function hasWordMatch(haystack, term) {
        const clean = String(term || "").trim().toLowerCase();
        if (!clean || clean.length < 3) return false;
        const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(clean)}(?:$|[^a-z0-9])`, "i");
        return re.test(haystack);
    }

    function mergeSubjectInputs(subjectOrArray) {
        const arr = Array.isArray(subjectOrArray) ? subjectOrArray.filter(Boolean) : [subjectOrArray].filter(Boolean);
        const primary = arr[0] || {};
        return {
            commonNames: arr.map(s => s.commonName || s.name || "").filter(Boolean),
            latinNames: arr.map(s => s.latinName || "").filter(Boolean),
            families: arr.map(s => s.family || "").filter(Boolean),
            tags: arr.map(s => s.tags || "").filter(Boolean).join(" "),
            habitat: arr.map(s => s.habitat || "").filter(Boolean).join(" "),
            pollinators: arr.map(s => s.pollinators || "").filter(Boolean).join(" "),
            ethnoNotes: arr.map(s => s.ethnoNotes || "").filter(Boolean).join(" "),
            pests: arr.map(s => s.pests || "").filter(Boolean).join(" "),
            companions: arr.map(s => s.companions || "").filter(Boolean).join(" "),
            soilNotes: arr.map(s => s.soilNotes || "").filter(Boolean).join(" "),
            rawText: arr.map(s => s.rawText || "").filter(Boolean).join(" "),
            category: primary.category || "",
            preferredCategory: primary.preferredCategory || "",
            primaryLabel: primary.commonName || primary.name || primary.latinName || ""
        };
    }

    function findRelatedArticles(subjectOrArray, maxCount = 3) {
        if (!_articlesLoaded && !_articlesCatalog.length) {
            _articlesCatalog = applyArticlesCuratorOverrides(
                FALLBACK_ARTICLES.map(a => normalizeArticleRow(a, ARTICLE_FEEDS[a._feedKey], true)).filter(Boolean)
            );
        }
        const ctx = mergeSubjectInputs(subjectOrArray);
        const fullSubjectBlob = `${ctx.commonNames.join(" ")} ${ctx.latinNames.join(" ")} ${ctx.families.join(" ")} ${ctx.tags} ${ctx.habitat} ${ctx.pollinators} ${ctx.ethnoNotes} ${ctx.pests} ${ctx.companions} ${ctx.soilNotes} ${ctx.rawText}`.toLowerCase();

        const hasEthno = Boolean(ctx.ethnoNotes.trim()) || /(coast salish|hul.?qumi|halq.?emeylem|sencoten|ethnobot|first nations|indigenous|traditional)/i.test(fullSubjectBlob);
        const hasPollinator = /(bee|bumble|mason|pollinator|butterfly|moth|lepidoptera|hummingbird|hoverfly|syrphid|wasp|nectar|floral|host)/i.test(ctx.pollinators + " " + ctx.tags);
        const hasIpm = Boolean(ctx.pests.trim() || ctx.companions.trim()) || /(aphid|mite|thrip|whitefl|beetle|nematode|companion|repel|intercrop|trap crop|fungus|blight)/i.test(fullSubjectBlob);

        const ecoKeywords = [
            ["mycorrhiz", "Mycorrhizae & Root Fungi"],
            ["nitrogen", "Nitrogen Fixation"],
            ["wetland", "Wetland Ecology"],
            ["riparian", "Riparian Habitat"],
            ["garry oak", "Garry Oak Meadow"],
            ["camas", "Camas Meadow Ecology"],
            ["meadow", "Meadow Restoration"],
            ["drought", "Drought & Waterwise"],
            ["erosion", "Slope & Erosion Control"],
            ["salinity", "Coastal Salinity"],
            ["fire", "Fire Ecology"],
            ["canopy", "Forest Canopy & Shade"],
            ["forest", "Forest Understory"],
            ["stratification", "Seed Stratification"],
            ["propagation", "Propagation & Seeds"],
            ["germination", "Seed Germination"],
            ["soil", "Soil Health"],
            ["edible", "Edible Plants"],
            ["medicinal", "Medicinal Plants"],
            ["deer", "Deer Resistance"],
            ["vegetable", "Vegetable Crops"],
            ["agriculture", "Crop Agronomy"]
        ];

        const taxonTokens = [];
        ctx.commonNames.forEach(cn => {
            const clean = String(cn || "").replace(/\([^)]*\)/g, "").replace(/—.*$/, "").trim();
            if (clean) taxonTokens.push({ token: clean, label: clean, weight: 14 });
            clean.split(/[\s/-]+/).forEach(part => {
                const p = part.replace(/[^a-z0-9]/gi, "").toLowerCase();
                if (p.length >= 4 && !["common", "western", "pacific", "coastal", "wild", "northern", "large", "small", "early", "sweet", "giant", "dwarf", "alpine"].includes(p)) {
                    taxonTokens.push({ token: p, label: clean, weight: 9 });
                }
            });
        });
        ctx.latinNames.forEach(ln => {
            const cleanLat = String(ln || "").split("(")[0].trim();
            const parts = cleanLat.split(/\s+/);
            if (parts.length >= 2) {
                taxonTokens.push({ token: `${parts[0]} ${parts[1]}`, label: `${parts[0]} ${parts[1]}`, weight: 14 });
            }
            if (parts[0] && parts[0].length >= 4) {
                taxonTokens.push({ token: parts[0], label: parts[0], weight: 9 });
            }
        });
        ctx.families.forEach(fam => {
            const f = String(fam || "").trim();
            if (f.length >= 5) taxonTokens.push({ token: f, label: f, weight: 7 });
        });

        const scored = _articlesCatalog.map(article => {
            let score = 0;
            const reasons = new Set();
            const aBlob = article._searchBlob || `${article.Title} ${article.Description} ${article.Tags} ${article.Category}`.toLowerCase();

            // 1. Direct plant / taxon / family match
            for (const t of taxonTokens) {
                if (hasWordMatch(aBlob, t.token)) {
                    score += t.weight;
                    reasons.add(`Matched: ${t.label}`);
                    break;
                }
            }

            // 2. Coast Salish & Ethnobotany match
            if (hasEthno && (article._feedKey === "first_nations" || /(first nations|indigenous|coast salish|ethnobot|traditional food|camas|salish)/i.test(aBlob))) {
                score += 6;
                reasons.add("🪶 Coast Salish & Ethnobotany");
            }

            // 3. Pollinators, bees & Lepidoptera match
            if (hasPollinator && (article._feedKey === "bees_insects" || /(bee|bumble|mason|pollinator|butterfly|moth|lepidoptera|insect|hummingbird)/i.test(aBlob))) {
                score += 5;
                reasons.add("🐝 Pollinators & Insects");
            }

            // 4. Companions, Pest Management & Biocontrol
            if (hasIpm && /(pest|ipm|biocontrol|beneficial|companion|intercrop|aphid|mite|disease|fungus|agriculture|vegetable|seedling)/i.test(aBlob)) {
                score += 5;
                reasons.add("🐞 Companion & Pest Science");
            }

            // 5. Habitat, Soil, Propagation & Ecological Traits
            let ecoHits = 0;
            ecoKeywords.forEach(([kw, lbl]) => {
                if (hasWordMatch(fullSubjectBlob, kw) && hasWordMatch(aBlob, kw)) {
                    score += (ecoHits === 0 ? 4 : 2);
                    ecoHits++;
                    if (reasons.size < 3) reasons.add(`🌿 ${lbl}`);
                }
            });

            // 6. Category / Preferred Feed / Live Sheet priority
            if (score > 0 && ctx.preferredCategory && article._feedKey === ctx.preferredCategory) {
                score += 3;
            }
            if (score > 0 && ctx.category === "garden" && article._feedKey === "plant_science") {
                score += 2;
            }
            if (score > 0 && !article._isFallback) {
                score += 2; // Live Article Section feeds take priority over built-in references
            }

            return {
                article,
                score,
                reasons: Array.from(reasons).slice(0, 3)
            };
        });

        scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.article._isFallback !== b.article._isFallback) return a.article._isFallback ? 1 : -1;
            if (ctx.preferredCategory) {
                const aPref = a.article._feedKey === ctx.preferredCategory ? 1 : 0;
                const bPref = b.article._feedKey === ctx.preferredCategory ? 1 : 0;
                if (bPref !== aPref) return bPref - aPref;
            }
            return (a.article.Title || "").localeCompare(b.article.Title || "");
        });

        const matched = scored.filter(x => x.score > 0);
        if (matched.length >= maxCount) return matched.slice(0, maxCount);

        const padPool = scored.filter(x => x.score === 0).slice(0, Math.max(0, maxCount - matched.length));
        return matched.concat(padPool);
    }

    function buildArticlesHref(query, feedKey) {
        const params = new URLSearchParams();
        if (feedKey && ARTICLE_FEEDS[feedKey]) params.set("feed", feedKey);
        else params.set("feed", "all");
        if (query) params.set("q", String(query).trim());
        return `articles.html?${params.toString()}`;
    }

    function renderRelatedArticlesHTML(subjectOrArray, opts = {}) {
        const maxCount = opts.maxCount || 3;
        const compact = Boolean(opts.compact);
        const strip = Boolean(opts.strip);
        const results = findRelatedArticles(subjectOrArray, maxCount);
        const ctx = mergeSubjectInputs(subjectOrArray);
        const querySeed = ctx.primaryLabel || ctx.families[0] || "";
        const shortSeed = String(querySeed || "").split(/[,;/]/)[0].replace(/\([^)]*\)/g, "").trim();
        const moreHref = buildArticlesHref(shortSeed || querySeed, ctx.preferredCategory);

        if (!results.length) {
            return `<div class="wcpp-related-articles-box">
                <div class="wcpp-rel-empty">No matching articles loaded yet. <a href="${escHtml(moreHref)}" class="wcpp-rel-more-link">Browse Articles Section →</a></div>
            </div>`;
        }

        const matchedCount = results.filter(r => r.score > 0).length;
        const heading = opts.title || (matchedCount > 0 ? "📰 Related Articles &amp; Research" : "📚 From the Article Section");
        const moreLabel = (shortSeed && shortSeed.length <= 24)
            ? `Browse Articles for ${escHtml(shortSeed)} →`
            : "Browse All Related Articles →";

        const cardsHtml = results.map(({ article, score, reasons }) => {
            const feedMeta = ARTICLE_FEEDS[article._feedKey];
            const catShort = feedMeta ? feedMeta.shortLabel : (article.Category || "Articles");
            let domain = "";
            try { domain = new URL(article.URL).hostname.replace(/^www\./i, ""); } catch (_) {}
            const reasonBadges = reasons.length
                ? reasons.map(r => `<span class="wcpp-rel-match-pill">${escHtml(r)}</span>`).join("")
                : `<span class="wcpp-rel-match-pill fallback">${article._isFallback ? "📚 Library Reference" : "📰 Article Section"}</span>`;
            const sourcePill = !article._isFallback ? `<span class="wcpp-rel-live-pill">Articles Feed</span>` : "";
            const desc = article.Description
                ? `<p class="wcpp-rel-article-desc">${escHtml(compact && article.Description.length > 130 ? article.Description.slice(0, 127) + "..." : article.Description)}</p>`
                : "";

            return `<div class="wcpp-rel-article-item${compact ? " compact" : ""}" data-score="${score}">
                <div class="wcpp-rel-badges">
                    <span class="wcpp-rel-cat-pill">${escHtml(catShort)}</span>
                    ${sourcePill}
                    ${reasonBadges}
                </div>
                <a href="${escHtml(article.URL)}" target="_blank" rel="noopener noreferrer" class="wcpp-rel-article-title">${escHtml(article.Title)} ↗</a>
                ${desc}
                ${domain ? `<div class="wcpp-rel-domain">${escHtml(domain)}</div>` : ""}
            </div>`;
        }).join("");

        return `<div class="${strip ? "wcpp-related-strip" : "wcpp-related-articles-box"}${compact ? " compact" : ""}">
            <div class="wcpp-rel-header">
                <strong class="wcpp-rel-heading">${heading}</strong>
                <a href="${escHtml(moreHref)}" class="wcpp-rel-more-link">${moreLabel}</a>
            </div>
            <div class="wcpp-rel-list">${cardsHtml}</div>
        </div>`;
    }

    global.WCPPArticles = {
        FEED_CONFIG: ARTICLE_FEEDS,
        getFeedConfig: getMergedFeedConfig,
        getCategories: getArticleCategories,
        addCategory: addCustomArticleCategory,
        getHashtagBank: loadArticleHashtagBank,
        autoGenerateHashtags,
        loadAll: loadSharedArticles,
        reload: () => loadSharedArticles(true),
        getAll: () => _articlesCatalog.slice(),
        isLoaded: () => _articlesLoaded,
        findRelated: findRelatedArticles,
        renderSectionHTML: renderRelatedArticlesHTML,
        buildArticlesHref
    };

    // Preload articles immediately on articles.html, or during idle time on other pages
    if (/articles\.html/i.test((global.location && global.location.pathname) || "")) {
        loadSharedArticles();
    } else {
        scheduleWhenIdle(() => loadSharedArticles(), 1500);
    }

    global.addEventListener("wcpp:curator-changed", (e) => {
        if (!e.detail || !e.detail.datasetKey || e.detail.datasetKey === "articles_custom") {
            _articlesCatalog = applyArticlesCuratorOverrides(_articlesRawBase);
            global.dispatchEvent(new CustomEvent("wcpp:articles-ready", { detail: { articles: _articlesCatalog } }));
        }
    });

    // =========================================================================
    // 3C. SHARED "MY GARDEN PLAN" SAVED PLANTS MANAGER (WCPPGardenPlan)
    // =========================================================================
    const LS_GARDEN_PLAN_KEY = "wcpp_my_garden_plan_v1";
    const PLAN_ALIASES = {
        "tomatoes": "tomato",
        "carrots": "carrot",
        "sweet pepper": "pepper",
        "sweet bell pepper": "pepper",
        "bell pepper": "pepper",
        "sweet & hot pepper": "pepper",
        "hot pepper": "pepper",
        "strawberries": "strawberry",
        "albion everbearing strawberry": "strawberry",
        "coastal wild strawberry": "coastal wild strawberry",
        "genovese sweet basil": "basil",
        "sweet basil": "basil",
        "lacinato kale": "kale",
        "lacinato dinosaur kale": "kale",
        "kale & collard": "kale",
        "kale & collards": "kale",
        "hardneck seed garlic": "garlic",
        "hardy upright rosemary": "rosemary",
        "sweet alyssum": "alyssum",
        "sweet allysum": "alyssum",
        "french marigold": "marigold",
        "french marigolds": "marigold",
        "common yarrow": "yarrow",
        "common yarrow coastal": "yarrow",
        "great camas": "camas",
        "common camas": "camas",
        "bush green bean": "bean",
        "pole green bean": "bean",
        "green bean": "bean",
        "swiss chard": "chard"
    };

    function normPlanKey(str) {
        let s = String(str || "")
            .toLowerCase()
            .replace(/—.*$/, "")
            .replace(/\([^)]*\)/g, " ")
            .replace(/[^a-z0-9\s-]/g, " ")
            .replace(/-/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        if (!s) return "";
        if (PLAN_ALIASES[s]) return PLAN_ALIASES[s];
        if (s.endsWith("ies") && s.length > 5) s = s.slice(0, -3) + "y";
        else if (s.endsWith("es") && s.length > 5 && /(tomatoes|potatoes)$/i.test(s)) s = s.slice(0, -2);
        else if (s.endsWith("s") && s.length > 4 && !s.endsWith("ss")) s = s.slice(0, -1);
        return PLAN_ALIASES[s] || s;
    }

    function expandPlanMatchTokens(queryOrItem) {
        const tokens = new Set();
        const add = (val) => {
            const k = normPlanKey(val);
            if (k && k.length >= 3) {
                tokens.add(k);
                k.split(/\s+/).forEach(w => {
                    if (w.length >= 4 && !["common", "sweet", "green", "pacific", "western", "coastal", "wild", "garden", "native", "plant", "upright", "hardy"].includes(w)) {
                        tokens.add(w);
                    }
                });
            }
        };
        if (typeof queryOrItem === "string") {
            add(queryOrItem);
        } else if (queryOrItem && typeof queryOrItem === "object") {
            add(queryOrItem.commonName || queryOrItem.name || queryOrItem.Plant_Name);
            if (queryOrItem.latinName) {
                const lat2 = normPlanKey(queryOrItem.latinName).split(" ").slice(0, 2).join(" ");
                if (lat2) tokens.add(lat2);
            }
        }
        return Array.from(tokens);
    }

    function readGardenPlanRaw() {
        try {
            const parsed = JSON.parse(localStorage.getItem(LS_GARDEN_PLAN_KEY) || "[]");
            return Array.isArray(parsed) ? parsed.filter(x => x && (x.commonName || x.latinName)) : [];
        } catch (_) {
            return [];
        }
    }

    function writeGardenPlanRaw(list, actionType = "updated", item = null) {
        try {
            localStorage.setItem(LS_GARDEN_PLAN_KEY, JSON.stringify(list));
        } catch (_) {}
        syncGardenPlanDOM();
        global.dispatchEvent(new CustomEvent("wcpp:garden-plan-changed", {
            detail: { items: list.slice(), count: list.length, action: actionType, item }
        }));
    }

    function normalizePlanItem(raw) {
        if (!raw) return null;
        if (typeof raw === "string") raw = { commonName: raw };
        const commonName = String(raw.commonName || raw.name || raw.Plant_Name || "").trim();
        const latinName = String(raw.latinName || raw.Latin_Name || "").trim();
        const slug = String(raw.slug || raw.URL_Slug || "").trim();
        const category = raw.category === "native" ? "native" : "garden";
        const keyBase = normPlanKey(commonName || latinName) || slug.toLowerCase();
        if (!keyBase) return null;
        return {
            id: String(raw.id || `${category}:${keyBase}`),
            commonName: commonName || latinName,
            latinName,
            category,
            slug,
            _normKey: keyBase,
            addedAt: raw.addedAt || Date.now()
        };
    }

    function itemsMatchPlan(saved, targetObj) {
        if (!saved || !targetObj) return false;
        const tId = typeof targetObj === "object" ? String(targetObj.id || "").trim() : "";
        const tSlug = typeof targetObj === "object" ? String(targetObj.slug || targetObj.URL_Slug || "").trim().toLowerCase() : "";
        if (tId && saved.id === tId) return true;
        if (tSlug && saved.slug && saved.slug.toLowerCase() === tSlug) return true;

        const savedLatin = normPlanKey(saved.latinName).split(" ").slice(0, 2).join(" ");
        const targetLatin = typeof targetObj === "object" && targetObj.latinName
            ? normPlanKey(targetObj.latinName).split(" ").slice(0, 2).join(" ")
            : "";
        if (savedLatin && targetLatin && savedLatin === targetLatin) return true;

        const savedNorm = saved._normKey || normPlanKey(saved.commonName);
        const targetNorm = typeof targetObj === "string"
            ? normPlanKey(targetObj)
            : normPlanKey(targetObj.commonName || targetObj.name || targetObj.Plant_Name || "");
        if (savedNorm && targetNorm && savedNorm === targetNorm) return true;

        const sToks = expandPlanMatchTokens(saved);
        const tToks = expandPlanMatchTokens(targetObj);
        for (const st of sToks) {
            if (st.length < 4) continue;
            for (const tt of tToks) {
                if (tt.length < 4) continue;
                if (st === tt) return true;
                if (st.includes(" ") && tt.includes(" ") && (st.includes(tt) || tt.includes(st))) return true;
            }
        }
        return false;
    }

    function hasInGardenPlan(queryObjOrStr) {
        const list = readGardenPlanRaw();
        if (!list.length || !queryObjOrStr) return false;
        return list.some(saved => itemsMatchPlan(saved, queryObjOrStr));
    }

    function addToGardenPlan(raw) {
        const item = normalizePlanItem(raw);
        if (!item) return { added: false, items: readGardenPlanRaw() };
        const list = readGardenPlanRaw();
        const existingIdx = list.findIndex(s => itemsMatchPlan(s, item));
        if (existingIdx >= 0) {
            const merged = Object.assign({}, list[existingIdx], {
                latinName: list[existingIdx].latinName || item.latinName,
                slug: list[existingIdx].slug || item.slug
            });
            list[existingIdx] = merged;
            writeGardenPlanRaw(list, "updated", merged);
            return { added: false, item: merged, items: list };
        }
        list.push(item);
        writeGardenPlanRaw(list, "added", item);
        if (global.WCPPAnalytics) {
            global.WCPPAnalytics.track("add_to_wishlist", {
                currency: "CAD",
                items: [{
                    item_id: item.slug || item.id,
                    item_name: item.commonName,
                    item_category: item.category === "native" ? "Native Plant" : "Garden Crop"
                }]
            });
        }
        return { added: true, item, items: list };
    }

    function removeFromGardenPlan(idOrQuery) {
        const list = readGardenPlanRaw();
        const removed = list.filter(s => (s.id === idOrQuery || itemsMatchPlan(s, idOrQuery)));
        const next = list.filter(s => !(s.id === idOrQuery || itemsMatchPlan(s, idOrQuery)));
        if (next.length !== list.length) {
            writeGardenPlanRaw(next, "removed", idOrQuery);
            if (global.WCPPAnalytics && removed.length) {
                global.WCPPAnalytics.track("remove_from_wishlist", {
                    currency: "CAD",
                    items: removed.map(it => ({
                        item_id: it.slug || it.id,
                        item_name: it.commonName || it.latinName || it.id
                    }))
                });
            }
            return true;
        }
        return false;
    }

    function toggleInGardenPlan(raw) {
        const item = normalizePlanItem(raw);
        if (!item) return { saved: false, items: readGardenPlanRaw() };
        if (hasInGardenPlan(item)) {
            removeFromGardenPlan(item);
            return { saved: false, item, items: readGardenPlanRaw() };
        }
        addToGardenPlan(item);
        return { saved: true, item, items: readGardenPlanRaw() };
    }

    function clearGardenPlan() {
        writeGardenPlanRaw([], "cleared", null);
    }

    function loadStarterGardenGuild() {
        const starters = [
            { commonName: "Tomato", latinName: "Solanum lycopersicum", category: "garden" },
            { commonName: "Basil", latinName: "Ocimum basilicum", category: "garden" },
            { commonName: "Common Camas", latinName: "Camassia quamash", category: "native" },
            { commonName: "Common Yarrow", latinName: "Achillea millefolium", category: "native" }
        ];
        starters.forEach(s => addToGardenPlan(s));
    }

    function formatSaveButtonInner(saved, compact) {
        if (compact) return saved ? "★ Saved" : "☆ Save";
        return saved ? "★ Saved in My Garden" : "⭐ Save to My Garden";
    }

    function renderGardenSaveButton(raw, opts = {}) {
        const item = normalizePlanItem(raw);
        if (!item) return "";
        const compact = opts.compact === undefined ? false : Boolean(opts.compact);
        const saved = hasInGardenPlan(item);
        const payload = {
            commonName: item.commonName,
            latinName: item.latinName,
            category: item.category,
            slug: item.slug
        };
        const title = saved
            ? `Remove ${item.commonName} from My Garden Plan`
            : `Save ${item.commonName} to My Garden Plan`;
        return `<button type="button" class="wcpp-save-garden-btn${saved ? " saved" : ""}${compact ? " compact" : ""}" data-garden-save="${escHtml(JSON.stringify(payload))}" data-compact="${compact ? "1" : "0"}" title="${escHtml(title)}">${formatSaveButtonInner(saved, compact)}</button>`;
    }

    function syncGardenPlanDOM() {
        const list = readGardenPlanRaw();
        const cnt = list.length;
        document.querySelectorAll(".wcpp-garden-count").forEach(el => {
            el.textContent = String(cnt);
            el.setAttribute("data-zero", cnt === 0 ? "1" : "0");
        });
        document.querySelectorAll(".wcpp-save-garden-btn[data-garden-save]").forEach(btn => {
            try {
                const payload = JSON.parse(btn.getAttribute("data-garden-save") || "{}");
                const isSaved = list.some(s => itemsMatchPlan(s, payload));
                const compact = btn.getAttribute("data-compact") === "1";
                btn.classList.toggle("saved", isSaved);
                btn.textContent = formatSaveButtonInner(isSaved, compact);
                btn.setAttribute("title", isSaved ? `Remove ${payload.commonName || "plant"} from My Garden Plan` : `Save ${payload.commonName || "plant"} to My Garden Plan`);
            } catch (_) {}
        });
    }

    function notifyGardenPlanToast(msg) {
        if (typeof global.showToast === "function") {
            try { global.showToast(msg); return; } catch (_) {}
        }
        if (global.WCPPAdmin && typeof global.WCPPAdmin.toast === "function") {
            global.WCPPAdmin.toast(msg);
        }
    }

    function openGardenPlanModal() {
        const existing = document.getElementById("wcppGardenPlanModal");
        if (existing) existing.remove();

        const bd = document.createElement("div");
        bd.id = "wcppGardenPlanModal";
        bd.className = "wcpp-modal-backdrop";

        function renderModalBody() {
            const list = readGardenPlanRaw();
            const countSpan = bd.querySelector("#wcppPlanModalCount");
            if (countSpan) countSpan.textContent = String(list.length);

            const bodyEl = bd.querySelector("#wcppGardenPlanBody");
            if (!bodyEl) return;

            if (!list.length) {
                bodyEl.innerHTML = `
                    <div style="text-align:center; padding:22px 14px; background:var(--wcpp-bg); border:1px dashed var(--wcpp-border); border-radius:14px;">
                        <div style="font-size:1.5rem; margin-bottom:6px;">🌱</div>
                        <div style="font-weight:800; font-size:1rem; color:var(--wcpp-primary); margin-bottom:6px;">Your Garden Plan is empty</div>
                        <p class="wcpp-help-text" style="margin:0 0 14px 0;">
                            Tap <strong>☆ Save</strong> on any crop or BC native plant across the planners to build a custom shortlist synced with your Planting Calendar, Pest Watchlist, and Live Orders.
                        </p>
                        <button type="button" class="wcpp-pill-btn primary" id="wcppLoadStarterPlanBtn">✨ Load Coastal Starter Guild (Tomato, Basil, Camas, Yarrow)</button>
                    </div>
                `;
                const loadBtn = bodyEl.querySelector("#wcppLoadStarterPlanBtn");
                if (loadBtn) loadBtn.onclick = () => { loadStarterGardenGuild(); renderModalBody(); notifyGardenPlanToast("Loaded 4 starter plants into My Garden Plan!"); };
                return;
            }

            const rowsHtml = list.map(item => {
                const catBadge = item.category === "native"
                    ? `<span class="wcpp-plan-cat native">🌿 BC Native</span>`
                    : `<span class="wcpp-plan-cat garden">🍅 Garden</span>`;
                const sheetHref = item.category === "native"
                    ? `nativeplants.html?p1=${encodeURIComponent(item.slug || item.commonName)}`
                    : `garden.html?p1=${encodeURIComponent(item.commonName)}`;
                const invBadge = _invLoaded
                    ? renderInventoryBadge({ commonName: item.commonName, latinName: item.latinName, slug: item.slug }, { compact: true, showPreorderFallback: true })
                    : "";
                return `<div class="wcpp-garden-plan-row">
                    <div class="wcpp-garden-plan-info">
                        <div class="wcpp-garden-plan-title-row">
                            <a href="${escHtml(sheetHref)}" class="wcpp-garden-plan-name">${escHtml(item.commonName)}</a>
                            ${catBadge}
                            ${invBadge}
                        </div>
                        ${item.latinName ? `<div class="wcpp-garden-plan-latin"><em>${escHtml(item.latinName)}</em></div>` : ""}
                    </div>
                    <div class="wcpp-garden-plan-actions">
                        <a href="calendar.html?mygarden=1&q=${encodeURIComponent(item.commonName)}" class="wcpp-inv-badge request" title="Check planting dates">Calendar</a>
                        <a href="bios.html?plant=${encodeURIComponent(item.commonName)}" class="wcpp-inv-badge request" title="Check pests &amp; beneficials">Bios</a>
                        <button type="button" class="wcpp-plan-remove-btn" data-plan-rm="${escHtml(item.id)}" aria-label="Remove ${escHtml(item.commonName)}" title="Remove">✕</button>
                    </div>
                </div>`;
            }).join("");

            bodyEl.innerHTML = `<div class="wcpp-garden-plan-list">${rowsHtml}</div>`;
            bodyEl.querySelectorAll("[data-plan-rm]").forEach(btn => {
                btn.onclick = () => {
                    removeFromGardenPlan(btn.getAttribute("data-plan-rm"));
                    renderModalBody();
                };
            });
        }

        bd.innerHTML = `
            <div class="wcpp-modal" role="dialog" aria-modal="true" aria-label="My Garden Plan">
                <div class="wcpp-modal-header">
                    <h2>⭐ My Garden Plan (<span id="wcppPlanModalCount">0</span>)</h2>
                    <button type="button" class="wcpp-modal-close" aria-label="Close">✕</button>
                </div>
                <div class="wcpp-modal-body">
                    <div class="wcpp-help-text">Your saved plants travel with you across the entire site — filter your Planting Calendar, Pest &amp; Beneficial Watchlist, or 1-click Live Plant Order cart below.</div>
                    <div id="wcppGardenPlanBody"></div>
                </div>
                <div class="wcpp-modal-footer" style="justify-content:space-between; gap:8px;">
                    <button type="button" class="wcpp-pill-btn danger" id="wcppPlanClearBtn">Clear List</button>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        <a href="calendar.html?mygarden=1" class="wcpp-pill-btn">🗓️ My Calendar</a>
                        <a href="bios.html?mygarden=1" class="wcpp-pill-btn">🐛 Pest Watchlist</a>
                        <a href="orders.html?mygarden=1" class="wcpp-pill-btn primary">🌱 Order Saved Plants →</a>
                    </div>
                </div>
            </div>
        `;

        const closePlanModal = () => {
            bd.remove();
            document.removeEventListener("keydown", onEscPlan);
            global.removeEventListener("wcpp:inventory-ready", onInvSync);
        };
        const onEscPlan = (ev) => { if (ev.key === "Escape") closePlanModal(); };
        const onInvSync = () => renderModalBody();

        document.addEventListener("keydown", onEscPlan);
        global.addEventListener("wcpp:inventory-ready", onInvSync);
        bd.querySelector(".wcpp-modal-close").onclick = closePlanModal;
        bd.addEventListener("click", (ev) => { if (ev.target === bd) closePlanModal(); });
        bd.querySelector("#wcppPlanClearBtn").onclick = () => {
            if (!readGardenPlanRaw().length) return;
            clearGardenPlan();
            renderModalBody();
            notifyGardenPlanToast("Cleared My Garden Plan");
        };

        document.body.appendChild(bd);
        loadSharedInventory().then(renderModalBody);
        renderModalBody();
    }

    if (!global._wcppGardenPlanBound) {
        global._wcppGardenPlanBound = true;
        document.addEventListener("click", (e) => {
            const btn = e.target && e.target.closest ? e.target.closest(".wcpp-save-garden-btn[data-garden-save]") : null;
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            try {
                const payload = JSON.parse(btn.getAttribute("data-garden-save") || "{}");
                const res = toggleInGardenPlan(payload);
                const label = payload.commonName || payload.latinName || "Plant";
                notifyGardenPlanToast(res.saved ? `★ Saved ${label} to My Garden Plan` : `Removed ${label} from My Garden Plan`);
            } catch (_) {}
        });
        document.addEventListener("DOMContentLoaded", syncGardenPlanDOM);
    }

    global.WCPPGardenPlan = {
        getAll: readGardenPlanRaw,
        count: () => readGardenPlanRaw().length,
        has: hasInGardenPlan,
        add: addToGardenPlan,
        remove: removeFromGardenPlan,
        toggle: toggleInGardenPlan,
        clear: clearGardenPlan,
        loadStarterGuild: loadStarterGardenGuild,
        renderButton: renderGardenSaveButton,
        syncDOM: syncGardenPlanDOM,
        openModal: openGardenPlanModal,
        normKey: normPlanKey
    };

    // =========================================================================
    // 3D. SEASONAL PLANTING BLOG MANAGER (WCPPBlog)
    // =========================================================================
    let _blogRawBase = [];
    let _blogPosts = [];
    let _blogLoaded = false;
    let _blogPromise = null;

    function getBlogFallbackSvg(title, season) {
        const t = String(title || "West Coast Planting Guide").replace(/[<>&"']/g, "").slice(0, 42);
        const s = String(season || "South Coastal BC").replace(/[<>&"']/g, "").slice(0, 28);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#14532d"/><stop offset="100%" stop-color="#0f766e"/></linearGradient></defs><rect width="480" height="240" fill="url(#bg)"/><circle cx="400" cy="60" r="90" fill="rgba(255,255,255,0.08)"/><circle cx="70" cy="210" r="110" fill="rgba(167,243,208,0.09)"/><text x="24" y="96" font-family="sans-serif" font-size="15" font-weight="700" fill="#a7f3d0">${s}</text><text x="24" y="132" font-family="sans-serif" font-size="20" font-weight="800" fill="#ffffff">${t}</text></svg>`;
        return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
    }

    function pickSeasonalBlogThumb(monthOrSeason) {
        const m = String(monthOrSeason || "").toLowerCase();
        if (/dec|jan|feb|winter/.test(m)) return "assets/blog/december-red-osier.jpg";
        if (/mar|apr|may|spring/.test(m)) return "assets/blog/spring-pollinator-guilds.jpg";
        if (/jun|jul|aug|summer/.test(m)) return "assets/blog/summer-woolly-sunflower.jpg";
        if (/sep|oct|camas/.test(m)) return "assets/blog/coast-salish-camas.jpg";
        return "assets/blog/november-nootka-rose.jpg";
    }

    function normalizeBlogPost(row, idx) {
        if (!row) return null;
        const rawSeason = String(row.Month_Season || row.Season || "South Coastal BC").trim();
        const cleanSeason = rawSeason.split(/\s*[•—–]\s*|\s*\(/)[0].replace(/\s+Ecology$/i, "").trim() || rawSeason;
        return Object.assign({}, row, {
            Blog_ID: String(row.Blog_ID || row.id || `blog-${idx + 1}`).trim(),
            Title: String(row.Title || "Seasonal Coastal BC Planting Note").trim(),
            Month_Season: cleanSeason,
            Category: String(row.Category || "Seasonal Planting Guide").trim(),
            Published_Date: String(row.Published_Date || new Date().toISOString().slice(0, 10)).trim(),
            Summary: String(row.Summary || "").trim(),
            Content_Body: String(row.Content_Body || row.Summary || "").trim(),
            Featured_Plants: String(row.Featured_Plants || "").trim(),
            Tags: String(row.Tags || "").trim(),
            Image_URL: String(row.Image_URL || "").trim(),
            Author: String(row.Author || "West Coast Plant Project").trim()
        });
    }

    function orderBlogPostsForSeason(list) {
        const monthName = new Date().toLocaleString("en-CA", { month: "long" }).toLowerCase();
        return list.slice().sort((a, b) => {
            const aMatch = `${a.Month_Season} ${a.Title}`.toLowerCase().includes(monthName) ? 1 : 0;
            const bMatch = `${b.Month_Season} ${b.Title}`.toLowerCase().includes(monthName) ? 1 : 0;
            if (aMatch !== bMatch) return bMatch - aMatch;
            return String(b.Published_Date || "").localeCompare(String(a.Published_Date || ""));
        });
    }

    function applyBlogOverrides(base) {
        let merged = base.slice();
        if (global.WCPPAdmin && typeof global.WCPPAdmin.applyOverrides === "function") {
            merged = global.WCPPAdmin.applyOverrides("blog_posts", merged, "Blog_ID");
        }
        return orderBlogPostsForSeason(merged.map((r, i) => normalizeBlogPost(r, i)).filter(Boolean));
    }

    const BLOG_SS_KEY = "wcpp_blog_cache_v1";
    const BLOG_TTL_MS = 15 * 60 * 1000;

    async function loadSharedBlogPosts(force = false) {
        if (_blogLoaded && !force) return _blogPosts;
        if (_blogPromise && !force) return _blogPromise;
        _blogPromise = (async () => {
            if (global.WCPPAdmin && global.WCPPAdmin.ready) {
                await global.WCPPAdmin.ready.catch(() => {});
            }
            let usedCache = false;
            if (!force) {
                try {
                    const cached = JSON.parse(sessionStorage.getItem(BLOG_SS_KEY) || "null");
                    if (cached && Array.isArray(cached.rows) && (Date.now() - (cached.ts || 0)) < BLOG_TTL_MS) {
                        _blogRawBase = cached.rows;
                        usedCache = true;
                    }
                } catch (_) {}
            }
            if (!usedCache) {
                try {
                    const fetchOpts = force ? { cache: "no-store" } : {};
                    const res = await fetch(`data/blog_posts.json?v=${force ? Date.now() : "20261121i"}`, fetchOpts);
                    if (res.ok) {
                        const data = await res.json();
                        _blogRawBase = Array.isArray(data) ? data : (data.rows ? global.unpackDatasetJson(data) : []);
                        if (_blogRawBase.length) {
                            try {
                                sessionStorage.setItem(BLOG_SS_KEY, JSON.stringify({ ts: Date.now(), rows: _blogRawBase }));
                            } catch (_) {}
                        }
                    }
                } catch (_) {}
            }
            _blogPosts = applyBlogOverrides(_blogRawBase);
            _blogLoaded = true;
            global.dispatchEvent(new CustomEvent("wcpp:blog-ready", { detail: { posts: _blogPosts } }));
            return _blogPosts;
        })();
        return _blogPromise;
    }

    function openBlogPostModal(postOrId, allPostsList) {
        const list = Array.isArray(allPostsList) && allPostsList.length ? allPostsList : _blogPosts;
        let currentIdx = typeof postOrId === "number"
            ? postOrId
            : list.findIndex(p => (typeof postOrId === "string" ? p.Blog_ID === postOrId : p.Blog_ID === (postOrId && postOrId.Blog_ID)));
        if (currentIdx < 0) currentIdx = 0;
        const post = list[currentIdx] || (typeof postOrId === "object" ? postOrId : null);
        if (!post) return;

        const existing = document.getElementById("wcppBlogPostModal");
        if (existing) existing.remove();

        const bd = document.createElement("div");
        bd.id = "wcppBlogPostModal";
        bd.className = "wcpp-modal-backdrop";

        function renderModalContent(idx) {
            const p = list[idx] || post;
            const featuredPills = String(p.Featured_Plants || "")
                .split(",")
                .map(s => s.trim())
                .filter(Boolean)
                .map(name => `<a class="wcpp-blog-pill" style="text-decoration:none;" href="orders.html?q=${encodeURIComponent(name)}">🌱 ${escHtml(name)}</a>`)
                .join(" ");
            const bodyParas = String(p.Content_Body || p.Summary || "")
                .split(/\n{2,}/)
                .map(para => `<p>${escHtml(para).replace(/\n/g, "<br>")}</p>`)
                .join("");

            bd.innerHTML = `
                <div class="wcpp-modal" style="max-width:680px;" role="dialog" aria-modal="true" aria-label="${escHtml(p.Title)}">
                    <div class="wcpp-modal-header">
                        <h2>📝 ${escHtml(p.Title)}</h2>
                        <button type="button" class="wcpp-modal-close" aria-label="Close">✕</button>
                    </div>
                    <div class="wcpp-modal-body">
                        <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
                            ${String(p.Month_Season || "").split(/\s*•\s*/).filter(Boolean).map(seg => `<span class="wcpp-blog-pill">${escHtml(seg)}</span>`).join("")}
                            <span class="wcpp-blog-pill" style="background:rgba(15,118,110,0.1);color:var(--wcpp-secondary,#0f766e);border-color:rgba(15,118,110,0.25);">${escHtml(p.Category)}</span>
                            <span class="wcpp-help-text" style="margin-left:auto;">${escHtml(p.Published_Date)} — ${escHtml(p.Author)}</span>
                        </div>
                        ${p.Image_URL ? `<img src="${escHtml(p.Image_URL)}" alt="${escHtml(p.Title)}" data-blog-title="${escHtml(p.Title)}" data-blog-season="${escHtml(p.Month_Season)}" onerror="if(window.WCPPBlog&&window.WCPPBlog.getFallbackSvg){this.onerror=null;this.src=window.WCPPBlog.getFallbackSvg(this.dataset.blogTitle,this.dataset.blogSeason)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;border:1px solid var(--border-color,#cbd5e1);" loading="lazy">` : ""}
                        <div style="padding:10px 12px;border-radius:10px;background:rgba(22,101,52,0.06);border:1px solid rgba(22,101,52,0.18);font-size:0.86rem;font-weight:700;color:var(--text-color,#1e293b);">
                            ${escHtml(p.Summary)}
                        </div>
                        <div class="wcpp-blog-article-body">${bodyParas}</div>
                        ${featuredPills ? `<div style="margin-top:8px;"><div style="font-size:0.76rem;font-weight:800;color:var(--text-muted,#64748b);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;">Featured Plants (Check Availability / Pre-Order)</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${featuredPills}</div></div>` : ""}
                        ${p.Tags ? `<div class="wcpp-help-text" style="margin-top:6px;">${escHtml(p.Tags)}</div>` : ""}
                    </div>
                    <div class="wcpp-modal-footer" style="justify-content:space-between;flex-wrap:wrap;gap:8px;">
                        <div style="display:flex;gap:8px;align-items:center;">
                            <button type="button" class="wcpp-pill-btn" id="wcppBlogPrevModal" ${list.length <= 1 ? "disabled" : ""}>← Prev Post</button>
                            <span class="wcpp-help-text" style="font-weight:800;">${idx + 1} / ${Math.max(1, list.length)}</span>
                            <button type="button" class="wcpp-pill-btn" id="wcppBlogNextModal" ${list.length <= 1 ? "disabled" : ""}>Next Post →</button>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <a href="calendar.html" class="wcpp-pill-btn primary" style="text-decoration:none;">📅 Full Planting Calendar</a>
                            <button type="button" class="wcpp-pill-btn" id="wcppBlogCloseBtn">Close</button>
                        </div>
                    </div>
                </div>
            `;
            bd.querySelector(".wcpp-modal-close").onclick = closeBlogModal;
            bd.querySelector("#wcppBlogCloseBtn").onclick = closeBlogModal;
            const prevBtn = bd.querySelector("#wcppBlogPrevModal");
            const nextBtn = bd.querySelector("#wcppBlogNextModal");
            if (prevBtn) prevBtn.onclick = () => { currentIdx = (currentIdx - 1 + list.length) % list.length; renderModalContent(currentIdx); };
            if (nextBtn) nextBtn.onclick = () => { currentIdx = (currentIdx + 1) % list.length; renderModalContent(currentIdx); };
        }

        const onEsc = (e) => { if (e.key === "Escape") closeBlogModal(); };
        function closeBlogModal() {
            bd.remove();
            document.removeEventListener("keydown", onEsc);
        }
        document.addEventListener("keydown", onEsc);
        bd.addEventListener("click", (e) => { if (e.target === bd) closeBlogModal(); });
        document.body.appendChild(bd);
        renderModalContent(currentIdx);
    }

    async function generateSeasonalDraft(targetMonthName, preferredThumbUrl) {
        const month = String(targetMonthName || new Date().toLocaleString("en-CA", { month: "long" })).trim();
        const mLow = month.toLowerCase();
        await loadSharedInventory();

        let calItems = [];
        try {
            const cRes = await fetch("data/calendar_base.json");
            if (cRes.ok) calItems = global.unpackDatasetJson(await cRes.json());
        } catch (_) {}

        let native212 = [];
        try {
            const pRes = await fetch("data/plants_212.json");
            if (pRes.ok) native212 = global.unpackDatasetJson(await pRes.json());
        } catch (_) {}

        const calMatches = calItems.filter(item => {
            const blob = `${item.sowOut || ""} ${item.sowIn || ""} ${item.transplant || ""} ${item.harvest || ""} ${item.notes || ""} ${item.season || ""}`.toLowerCase();
            return blob.includes(mLow.slice(0, 3)) || blob.includes(mLow);
        });
        const nativeCalMatches = calMatches.filter(c => /native/i.test(c.type || c.id || ""));
        const gardenCalMatches = calMatches.filter(c => !/native/i.test(c.type || c.id || ""));

        const inStockNow = _invCatalog.filter(i => /in stock/i.test(i.Availability_Status)).slice(0, 6);
        const preOrderNow = _invCatalog.filter(i => i.Allow_PreOrder === "Yes").slice(0, 6);
        const nativeSpot = native212.filter(n => (n.Blooming_Period || "").toLowerCase().includes(mLow.slice(0, 3)) || (n.Seed_Collection_Period || "").toLowerCase().includes(mLow.slice(0, 3))).slice(0, 5);

        const nativeList = (nativeCalMatches.length ? nativeCalMatches.map(x => `${x.crop}${x.latin ? ` (${x.latin})` : ""}`) : nativeSpot.map(n => `${n.Common_Name} (${n.Latin_Name})`)).slice(0, 6);
        const vegList = gardenCalMatches.slice(0, 6).map(x => `${x.crop} (${x.sowOut || x.sowIn || x.transplant || x.harvest || "Check timing"})`);

        const today = new Date().toISOString().slice(0, 10);
        const slug = `blog-${mLow}-${Date.now().toString(36)}`;

        const lines = [
            `Auto-generated South Coastal BC (Surrey • Zone 8a) field dispatch for ${month}, synthesized from our live Planting Calendar, BC Native Flora dataset, and Nursery Inventory.`,
            ""
        ];
        if (nativeList.length) {
            lines.push(`1. BC Native Plants Active in ${month}: ${nativeList.join("; ")}.`);
            lines.push("");
        }
        if (vegList.length) {
            lines.push(`2. Garden Bed Crops & Timing for ${month}: ${vegList.join("; ")}.`);
            lines.push("");
        }
        if (inStockNow.length || preOrderNow.length) {
            lines.push(`3. Nursery Availability & Pre-Orders: ${inStockNow.length ? `In stock right now: ${inStockNow.map(i => `${i.Plant_Name} (${i.Available_Qty} avail)`).join(", ")}. ` : ""}${preOrderNow.length ? `Open for Pre-Order: ${preOrderNow.map(i => i.Plant_Name).join(", ")}.` : ""}`);
        }

        const featured = [...new Set([
            ...nativeCalMatches.slice(0, 4).map(x => x.crop),
            ...gardenCalMatches.slice(0, 3).map(x => x.crop),
            ...inStockNow.slice(0, 3).map(i => i.Plant_Name)
        ])].slice(0, 8).join(", ");

        const resolvedImage = preferredThumbUrl === "NONE"
            ? ""
            : (preferredThumbUrl && preferredThumbUrl !== "AUTO" ? String(preferredThumbUrl).trim() : pickSeasonalBlogThumb(month));

        return {
            Blog_ID: slug,
            Title: `What to Plant & Prioritize in ${month} (South Coastal BC Data Brief)`,
            Month_Season: `${month} • South Coastal BC`,
            Category: "Seasonal Planting Guide",
            Published_Date: today,
            Summary: `${month} planting picks in Surrey & Zone 8a: ${nativeList.slice(0, 3).join(", ") || "BC native habitat shrubs"}, coastal veggie bed timing, and current nursery pre-orders.`,
            Content_Body: lines.join("\n"),
            Featured_Plants: featured,
            Tags: `#${mLow}, #south-coastal-bc, #zone-8a, #native-plants, #seasonal-planting`,
            Image_URL: resolvedImage,
            Author: "West Coast Plant Project Data Studio"
        };
    }

    global.WCPPBlog = {
        loadAll: loadSharedBlogPosts,
        reload: () => loadSharedBlogPosts(true),
        getAll: () => _blogPosts.slice(),
        openPostModal: openBlogPostModal,
        generateSeasonalDraft,
        getFallbackSvg: getBlogFallbackSvg
    };

    scheduleWhenIdle(() => loadSharedBlogPosts(), 900);

    global.addEventListener("wcpp:curator-changed", (e) => {
        if (!e.detail || !e.detail.datasetKey || e.detail.datasetKey === "blog_posts") {
            _blogPosts = applyBlogOverrides(_blogRawBase);
            global.dispatchEvent(new CustomEvent("wcpp:blog-ready", { detail: { posts: _blogPosts } }));
        }
    });

    // =========================================================================
    // 4. GLOBAL QUICK-SEARCH MODAL (Ctrl+K / Cmd+K / /)
    // =========================================================================
    const QUICK_TOOLS_INDEX = [
        { title: "Live Plant Orders & Pre-Orders", sub: "Browse in-stock native plants, vegetable starts, and seasonal pre-orders", url: "orders.html" },
        { title: "BC Plant Visual Field Guide", sub: "Browse BC native & regional flora by light, moisture, bloom season, wildlife & Coast Salish names", url: "plant-planner.html" },
        { title: "West Coast Native Plant Matrix Comparator", sub: "Compare up to 4 BC native plants side-by-side", url: "nativeplants.html" },
        { title: "Garden Bed Plant Planner", sub: "Vegetables, herbs & companion compatibility (Tomato, Basil, Carrot, Kale...)", url: "garden.html" },
        { title: "South Coastal BC Planting Calendar", sub: "Monthly sowing, indoor starts, transplanting & frost dates by city", url: "calendar.html" },
        { title: "Horticulture & Climate Calculators", sub: "DLI, VPD, growing degree-days, fertilizer & irrigation calculators", url: "calculators.html" },
        { title: "Biologicals & Pest Control Guides", sub: "Beneficial insects, PGPR microbes, mites, aphids & biocontrol curves", url: "bios.html" },
        { title: "Botanical Latin Decoder", sub: "Translate scientific plant prefixes, suffixes & epithets", url: "latin.html" },
        { title: "Recent Site Updates Log", sub: "Chronological changelog of plant data additions, tools & bug fixes", url: "updates.html" },
        { title: "Curator Data Studio", sub: "Bulk edit plant datasets, sync Google Sheets & publish to GitHub", url: "admin.html" }
    ];

    const POPULAR_GARDEN_CROPS = [
        { name: "Tomato", latin: "Solanum lycopersicum" },
        { name: "Sweet pepper", latin: "Capsicum annuum" },
        { name: "Basil", latin: "Ocimum basilicum" },
        { name: "Kale", latin: "Brassica oleracea" },
        { name: "Strawberry", latin: "Fragaria x ananassa" },
        { name: "Garlic", latin: "Allium sativum" },
        { name: "Rosemary", latin: "Salvia rosmarinus" },
        { name: "Carrots", latin: "Daucus carota" },
        { name: "Lettuce", latin: "Lactuca sativa" },
        { name: "Broccoli", latin: "Brassica oleracea" },
        { name: "Cucumber", latin: "Cucumis sativus" },
        { name: "Bush Green Bean", latin: "Phaseolus vulgaris" }
    ];

    let _nativeIndexCache = null;
    async function ensureNativeSearchIndex() {
        if (_nativeIndexCache) return _nativeIndexCache;
        try {
            const res = await fetch("data/plants_212.json");
            if (res.ok) {
                const raw = await res.json();
                _nativeIndexCache = global.unpackDatasetJson(raw);
            }
        } catch (_) {}
        return _nativeIndexCache || [];
    }

    let _biosIndexCache = null;
    async function ensureBiosSearchIndex() {
        if (_biosIndexCache) return _biosIndexCache;
        try {
            const res = await fetch("data/bios_base.json");
            if (res.ok) {
                const raw = await res.json();
                _biosIndexCache = global.unpackDatasetJson(raw);
            }
        } catch (_) {}
        return _biosIndexCache || [];
    }

    let _gardenIndexCache = null;
    async function ensureGardenSearchIndex() {
        if (_gardenIndexCache) return _gardenIndexCache;
        try {
            const res = await fetch("data/garden_crops.json");
            if (res.ok) {
                const raw = await res.json();
                const all = global.unpackDatasetJson(raw);
                const seen = new Set();
                _gardenIndexCache = all.filter(r => {
                    const key = String(r["Common Name"] || r["Latin Name"] || "").trim().toLowerCase();
                    if (!key || seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            }
        } catch (_) {}
        return _gardenIndexCache || [];
    }

    let _latinIndexCache = null;
    async function ensureLatinSearchIndex() {
        if (_latinIndexCache) return _latinIndexCache;
        try {
            const res = await fetch("data/latin_base.json");
            if (res.ok) {
                const raw = await res.json();
                _latinIndexCache = global.unpackDatasetJson(raw);
            }
        } catch (_) {}
        return _latinIndexCache || [];
    }

    function buildSearchTerms(rawQuery) {
        const q = String(rawQuery || "").trim().toLowerCase();
        if (!q) return [];
        const terms = new Set([q]);
        if (q.endsWith("ies") && q.length > 4) terms.add(q.slice(0, -3) + "y");
        else if (q.endsWith("es") && q.length > 4) terms.add(q.slice(0, -2));
        else if (q.endsWith("s") && q.length > 3) terms.add(q.slice(0, -1));
        if (q === "critter" || q === "critters" || q === "bug" || q === "bugs") {
            ["bee", "insect", "moth", "butterfly", "aphid", "mite", "pollinator"].forEach(t => terms.add(t));
        }
        return Array.from(terms).filter(Boolean);
    }

    function haystackMatchesTerms(haystack, terms) {
        if (!haystack || !terms.length) return false;
        const low = String(haystack).toLowerCase();
        return terms.some(t => low.includes(t));
    }

    function extractCritterSnippet(text, terms) {
        const str = String(text || "").trim();
        if (!str) return "";
        const low = str.toLowerCase();
        for (const t of terms) {
            const idx = low.indexOf(t);
            if (idx >= 0) {
                const start = Math.max(0, idx - 26);
                const end = Math.min(str.length, idx + 84);
                return `${start > 0 ? "..." : ""}${str.slice(start, end)}${end < str.length ? "..." : ""}`;
            }
        }
        return str.length > 96 ? str.slice(0, 93) + "..." : str;
    }

    global.openGlobalSearchModal = async function () {
        if (document.getElementById("wcppGlobalSearchModal")) {
            const existingInp = document.getElementById("wcppGlobalSearchInput");
            if (existingInp) existingInp.focus();
            return;
        }
        await loadSharedInventory();

        const bd = document.createElement("div");
        bd.id = "wcppGlobalSearchModal";
        bd.className = "wcpp-modal-backdrop";
        const quickSuggestions = [
            { label: "🐝 Native Bees (Bombus / Osmia)", q: "bee" },
            { label: "🦋 Host Lepidoptera (Epinotia)", q: "Epinotia" },
            { label: "🐞 Aphid Biocontrols", q: "aphid" },
            { label: "🌱 Garry Oak", q: "Garry Oak" },
            { label: "🧄 Hardneck Garlic", q: "Garlic" }
        ];
        bd.innerHTML = `
            <div class="wcpp-modal wcpp-search-modal" role="dialog" aria-modal="true" aria-label="Quick Search">
                <div class="wcpp-modal-header">
                    <h2>🔍 Quick Search Plants, Critters, Crops &amp; Tools</h2>
                    <button type="button" class="wcpp-modal-close" aria-label="Close">✕</button>
                </div>
                <div class="wcpp-modal-body">
                    <div class="wcpp-search-bar-row">
                        <input type="search" id="wcppGlobalSearchInput" class="wcpp-input" placeholder="Search plants, bees & critters (Bombus, Osmia, Epinotia, aphid), crops, Latin, or tools..." autofocus />
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;" aria-label="Quick filter suggestions">
                        ${quickSuggestions.map(s => `<button type="button" class="wcpp-inv-badge request" data-quick-q="${escHtml(s.q)}" style="cursor:pointer;">${escHtml(s.label)}</button>`).join("")}
                    </div>
                    <div id="wcppGlobalSearchResults" class="wcpp-search-results"></div>
                </div>
                <div class="wcpp-modal-footer" style="justify-content:space-between;">
                    <span class="wcpp-help-text">Shortcuts: <kbd class="wcpp-kbd">/</kbd> or <kbd class="wcpp-kbd">Ctrl+K</kbd> to open &bull; <kbd class="wcpp-kbd">Esc</kbd> to close</span>
                    <button type="button" class="wcpp-pill-btn" id="wcppSearchCloseBtn">Close</button>
                </div>
            </div>
        `;
        const closeSearch = () => {
            bd.remove();
            document.removeEventListener("keydown", onEsc);
        };
        const onEsc = (e) => {
            if (e.key === "Escape") closeSearch();
        };
        document.addEventListener("keydown", onEsc);
        bd.querySelector(".wcpp-modal-close").onclick = closeSearch;
        bd.querySelector("#wcppSearchCloseBtn").onclick = closeSearch;
        bd.addEventListener("click", (e) => { if (e.target === bd) closeSearch(); });
        document.body.appendChild(bd);

        const inp = bd.querySelector("#wcppGlobalSearchInput");
        const resultsEl = bd.querySelector("#wcppGlobalSearchResults");
        bd.querySelectorAll("[data-quick-q]").forEach(btn => {
            btn.onclick = () => {
                inp.value = btn.getAttribute("data-quick-q") || "";
                renderResults();
                inp.focus();
            };
        });

        function renderResults() {
            const rawQ = (inp.value || "").trim();
            const q = rawQ.toLowerCase();
            const qTerms = buildSearchTerms(rawQ);
            const groups = [];

            // 1. Live Plant Inventory & Pre-Orders
            const invAll = _invCatalog;
            const invMatches = q
                ? invAll.filter(i => haystackMatchesTerms(`${i.Plant_Name} ${i.Latin_Name} ${i.Category} ${i.Availability_Status} ${i.Pot_Size_Format} ${i.Host_Bees_Insects} ${i.Notes}`, qTerms))
                : invAll.slice(0, 6);
            if (invMatches.length) {
                groups.push(`<div class="wcpp-search-group">
                    <h4>🌱 Live Plant Orders &amp; Pre-Orders (${invMatches.length})</h4>
                    <div class="wcpp-search-list">${invMatches.slice(0, 6).map(i => {
                        const badgeCls = i._isPreOrder ? "pre-order" : "in-stock";
                        const badgeTxt = i._isPreOrder ? `📅 Pre-Order ($${Number(i.Price_CAD).toFixed(2)})` : `✓ In Stock ($${Number(i.Price_CAD).toFixed(2)})`;
                        const href = buildOrderHref({ commonName: i.Plant_Name }, i, i._isPreOrder);
                        const sheetHref = i.Category === "Vegetable & Herb Start"
                            ? `garden.html?p1=${encodeURIComponent(i.Plant_Name.split("—")[0].trim())}`
                            : `nativeplants.html?p1=${encodeURIComponent(i.Plant_Name)}`;
                        return `<div class="wcpp-search-item">
                            <div>
                                <div class="wcpp-search-item-title">${escHtml(i.Plant_Name)}</div>
                                <div class="wcpp-search-item-sub">${escHtml(i.Pot_Size_Format)} &bull; ${escHtml(i.Ready_Window)}</div>
                            </div>
                            <div class="wcpp-search-item-actions">
                                <a href="${sheetHref}" class="wcpp-inv-badge request">Sheet ↗</a>
                                <a href="${href}" class="wcpp-inv-badge ${badgeCls}">${badgeTxt} →</a>
                            </div>
                        </div>`;
                    }).join("")}</div>
                </div>`);
            }

            // 2. Bees, Insects, Pests & Biological Controls (Critters + Bio Matrix + Plant Host Data)
            if (q) {
                const critterCards = [];
                if (Array.isArray(_biosIndexCache) && _biosIndexCache.length) {
                    _biosIndexCache.filter(b =>
                        haystackMatchesTerms(`${b.metabolite || ""} ${b.scientificName || ""} ${b.category || ""} ${b.targets || ""} ${b.effects || ""} ${b.crops || ""} ${b.tradeNames || ""} ${b.hostPlantsBeeSheet || ""}`, qTerms)
                    ).slice(0, 4).forEach(b => {
                        const title = b.metabolite || b.scientificName || "Biological / Critter Entry";
                        const sub = `${b.category || "Biocontrol"}${b.targets ? " • Targets/Notes: " + extractCritterSnippet(b.targets, qTerms) : ""}`;
                        critterCards.push(`<div class="wcpp-search-item">
                            <div>
                                <div class="wcpp-search-item-title">🐞 ${escHtml(title)}</div>
                                <div class="wcpp-search-item-sub">${escHtml(sub)}</div>
                            </div>
                            <div class="wcpp-search-item-actions">
                                <a href="bios.html?q=${encodeURIComponent(title)}" class="wcpp-inv-badge request">Biocontrol Guide →</a>
                            </div>
                        </div>`);
                    });
                }
                if (Array.isArray(_nativeIndexCache) && _nativeIndexCache.length) {
                    _nativeIndexCache.filter(p =>
                        haystackMatchesTerms(`${p.Common_Bee_Visitors || ""} ${p.Host_Bees_Insects_Damage || ""} ${p.Pollinators || ""} ${p.Lepidoptera_Host_Genera || ""} ${p.Host_Butterflies_Common || ""} ${p.Host_Butterflies_Scientific || ""} ${p.Host_Moths_Common || ""} ${p.Host_Moths_Scientific || ""} ${p.Warnings_Toxicity_Pests || ""}`, qTerms)
                    ).slice(0, 4).forEach(p => {
                        const combined = `${p.Common_Bee_Visitors || ""} | ${p.Host_Bees_Insects_Damage || ""} | ${p.Pollinators || ""} | ${p.Lepidoptera_Host_Genera || ""}`;
                        const snippet = extractCritterSnippet(combined, qTerms);
                        const pName = p.Common_Name_Primary || p.Latin_Name;
                        critterCards.push(`<div class="wcpp-search-item">
                            <div>
                                <div class="wcpp-search-item-title">🐝 Host Plant: ${escHtml(pName)}</div>
                                <div class="wcpp-search-item-sub">${escHtml(snippet)}</div>
                            </div>
                            <div class="wcpp-search-item-actions">
                                <a href="plant-planner.html?q=${encodeURIComponent(pName)}" class="wcpp-inv-badge request">Cards</a>
                                <a href="nativeplants.html?p1=${encodeURIComponent(p.URL_Slug || pName)}" class="wcpp-inv-badge request">Matrix →</a>
                            </div>
                        </div>`);
                    });
                }
                if (Array.isArray(_gardenIndexCache) && _gardenIndexCache.length) {
                    _gardenIndexCache.filter(c =>
                        haystackMatchesTerms(`${c["Host Bees & Insects (Genus species & Damage)"] || ""} ${c["Pollinators Attracted"] || ""} ${c["Natural Predators Attracted"] || ""} ${c["Pest Deterred"] || ""} ${c["Pest Repelled"] || ""} ${c["Pest Attracted / Trapped"] || ""}`, qTerms)
                    ).slice(0, 3).forEach(c => {
                        const cName = c["Common Name"] || c["Latin Name"];
                        const combined = c["Host Bees & Insects (Genus species & Damage)"] || c["Pollinators Attracted"] || c["Natural Predators Attracted"] || c["Pest Attracted / Trapped"] || "";
                        const snippet = extractCritterSnippet(combined, qTerms);
                        critterCards.push(`<div class="wcpp-search-item">
                            <div>
                                <div class="wcpp-search-item-title">🪲 Crop Interaction: ${escHtml(cName)}</div>
                                <div class="wcpp-search-item-sub">${escHtml(snippet)}</div>
                            </div>
                            <div class="wcpp-search-item-actions">
                                <a href="garden.html?p1=${encodeURIComponent(cName)}" class="wcpp-inv-badge request">Garden Sheet →</a>
                            </div>
                        </div>`);
                    });
                }
                if (critterCards.length) {
                    groups.push(`<div class="wcpp-search-group">
                        <h4>🐝 Bees, Insects, Pests &amp; Biological Controls (${critterCards.length})</h4>
                        <div class="wcpp-search-list">${critterCards.slice(0, 8).join("")}</div>
                    </div>`);
                }
            }

            // 3. Garden Bed Crops (all 185 crops when loaded, fallback to POPULAR_GARDEN_CROPS)
            const gardenPool = Array.isArray(_gardenIndexCache) && _gardenIndexCache.length
                ? _gardenIndexCache.map(c => ({
                    name: c["Common Name"] || c["Latin Name"],
                    latin: c["Latin Name"] || "",
                    family: c["Family"] || "",
                    blob: `${c["Common Name"] || ""} ${c["Latin Name"] || ""} ${c["Family"] || ""} ${c["Characteristics / Uses"] || ""} ${c["Companion Plants"] || ""} ${c["Pollinators Attracted"] || ""} ${c["Host Bees & Insects (Genus species & Damage)"] || ""}`
                }))
                : POPULAR_GARDEN_CROPS.map(c => ({ name: c.name, latin: c.latin, family: "", blob: `${c.name} ${c.latin}` }));
            const cropMatches = q
                ? gardenPool.filter(c => haystackMatchesTerms(c.blob, qTerms))
                : gardenPool.slice(0, 4);
            if (cropMatches.length) {
                groups.push(`<div class="wcpp-search-group">
                    <h4>🍅 Garden Bed Crops &amp; Calendar (${cropMatches.length})</h4>
                    <div class="wcpp-search-list">${cropMatches.slice(0, 5).map(c => {
                        const badge = renderInventoryBadge({ commonName: c.name, latinName: c.latin }, { compact: true });
                        return `<div class="wcpp-search-item">
                            <div>
                                <div class="wcpp-search-item-title">${escHtml(c.name)}</div>
                                <div class="wcpp-search-item-sub"><em>${escHtml(c.latin)}</em>${c.family ? ` &bull; ${escHtml(c.family)}` : ""}</div>
                            </div>
                            <div class="wcpp-search-item-actions">
                                ${badge}
                                <a href="calendar.html?q=${encodeURIComponent(c.name)}" class="wcpp-inv-badge request">Calendar</a>
                                <a href="garden.html?p1=${encodeURIComponent(c.name)}" class="wcpp-inv-badge request">Garden Sheet →</a>
                            </div>
                        </div>`;
                    }).join("")}</div>
                </div>`);
            }

            // 4. BC Native Plants (if index loaded)
            if (q && Array.isArray(_nativeIndexCache) && _nativeIndexCache.length) {
                const natMatches = _nativeIndexCache.filter(p =>
                    haystackMatchesTerms(`${p.Common_Name_Primary || ""} ${p.Latin_Name || ""} ${p.Plant_Family || ""} ${p.Hulquminum_Primary || ""} ${p.SENCOTEN_Primary || ""} ${p.Common_Bee_Visitors || ""} ${p.Host_Bees_Insects_Damage || ""} ${p.Lepidoptera_Host_Genera || ""}`, qTerms)
                ).slice(0, 5);
                if (natMatches.length) {
                    groups.push(`<div class="wcpp-search-group">
                        <h4>🌿 BC Native Plants (${natMatches.length})</h4>
                        <div class="wcpp-search-list">${natMatches.map(p => {
                            const badge = renderInventoryBadge({ commonName: p.Common_Name_Primary, latinName: p.Latin_Name, slug: p.URL_Slug }, { compact: true });
                            return `<div class="wcpp-search-item">
                                <div>
                                    <div class="wcpp-search-item-title">${escHtml(p.Common_Name_Primary || p.Latin_Name)}</div>
                                    <div class="wcpp-search-item-sub"><em>${escHtml(p.Latin_Name)}</em>${p.Plant_Family ? ` &bull; ${escHtml(p.Plant_Family)}` : ""}</div>
                                </div>
                                <div class="wcpp-search-item-actions">
                                    ${badge}
                                    <a href="plant-planner.html?q=${encodeURIComponent(p.Common_Name_Primary || p.Latin_Name)}" class="wcpp-inv-badge request">Cards</a>
                                    <a href="nativeplants.html?p1=${encodeURIComponent(p.URL_Slug || p.Common_Name_Primary)}" class="wcpp-inv-badge request">Matrix →</a>
                                </div>
                            </div>`;
                        }).join("")}</div>
                    </div>`);
                }
            }

            // 5. Botanical Latin Lexicon
            if (q && Array.isArray(_latinIndexCache) && _latinIndexCache.length) {
                const latMatches = _latinIndexCache.filter(l =>
                    haystackMatchesTerms(`${l.word || ""} ${l.meaning || ""} ${l.category || ""} ${l.notes || ""}`, qTerms)
                ).slice(0, 4);
                if (latMatches.length) {
                    groups.push(`<div class="wcpp-search-group">
                        <h4>📖 Botanical Latin Lexicon (${latMatches.length})</h4>
                        <div class="wcpp-search-list">${latMatches.map(l => `
                            <a href="latin.html?q=${encodeURIComponent(l.word || q)}" class="wcpp-search-item">
                                <div>
                                    <div class="wcpp-search-item-title"><em>${escHtml(l.word)}</em></div>
                                    <div class="wcpp-search-item-sub">${escHtml(l.meaning || l.notes || "")}</div>
                                </div>
                                <span class="wcpp-inv-badge request">Decode →</span>
                            </a>
                        `).join("")}</div>
                    </div>`);
                }
            }

            // 6. Seasonal Planting Blog Posts
            const blogPool = Array.isArray(_blogPosts) && _blogPosts.length ? _blogPosts : [];
            const blogMatches = q
                ? blogPool.filter(p => haystackMatchesTerms(`${p.Title} ${p.Summary} ${p.Month_Season} ${p.Category} ${p.Featured_Plants} ${p.Tags}`, qTerms))
                : blogPool.slice(0, 2);
            if (blogMatches.length) {
                groups.push(`<div class="wcpp-search-group">
                    <h4>📝 Seasonal Planting Blog (${blogMatches.length})</h4>
                    <div class="wcpp-search-list">${blogMatches.slice(0, 4).map(p => `
                        <button type="button" class="wcpp-search-item" data-open-blog-id="${escHtml(p.Blog_ID)}" style="width:100%;text-align:left;cursor:pointer;font-family:inherit;">
                            <div>
                                <div class="wcpp-search-item-title">${escHtml(p.Title)}</div>
                                <div class="wcpp-search-item-sub">${escHtml(p.Month_Season)} &bull; ${escHtml(p.Category)}</div>
                            </div>
                            <span class="wcpp-inv-badge request">Read Guide →</span>
                        </button>
                    `).join("")}</div>
                </div>`);
            }

            // 7. Articles & Research
            const artSource = _articlesCatalog.length
                ? _articlesCatalog
                : FALLBACK_ARTICLES.map(a => normalizeArticleRow(a, ARTICLE_FEEDS[a._feedKey], true)).filter(Boolean);
            const artMatches = q
                ? findRelatedArticles({ commonName: rawQ, rawText: rawQ }, 4).filter(m => m.score > 0 || haystackMatchesTerms(m.article._searchBlob, qTerms))
                : artSource.slice(0, 3).map(a => ({ article: a, score: 0, reasons: [] }));
            if (artMatches.length) {
                groups.push(`<div class="wcpp-search-group">
                    <h4>📰 Articles &amp; Library Research (${artMatches.length})</h4>
                    <div class="wcpp-search-list">${artMatches.map(({ article, reasons }) => {
                        const feedMeta = ARTICLE_FEEDS[article._feedKey];
                        const catTxt = feedMeta ? feedMeta.shortLabel : (article.Category || "Article");
                        const reasonTxt = reasons.length ? ` • ${reasons[0]}` : "";
                        return `<a href="${escHtml(article.URL)}" target="_blank" rel="noopener noreferrer" class="wcpp-search-item">
                            <div>
                                <div class="wcpp-search-item-title">${escHtml(article.Title)}</div>
                                <div class="wcpp-search-item-sub">${escHtml(catTxt)}${escHtml(reasonTxt)}</div>
                            </div>
                            <span class="wcpp-inv-badge request">Read ↗</span>
                        </a>`;
                    }).join("")}</div>
                </div>`);
            }

            // 8. Site Tools & Calculators
            const toolMatches = q
                ? QUICK_TOOLS_INDEX.filter(t => haystackMatchesTerms(`${t.title} ${t.sub}`, qTerms))
                : QUICK_TOOLS_INDEX.slice(0, 4);
            if (toolMatches.length) {
                groups.push(`<div class="wcpp-search-group">
                    <h4>🧰 Site Pages &amp; Tools</h4>
                    <div class="wcpp-search-list">${toolMatches.slice(0, 5).map(t => `
                        <a href="${t.url}" class="wcpp-search-item">
                            <div>
                                <div class="wcpp-search-item-title">${escHtml(t.title)}</div>
                                <div class="wcpp-search-item-sub">${escHtml(t.sub)}</div>
                            </div>
                            <span class="wcpp-inv-badge request">Open →</span>
                        </a>
                    `).join("")}</div>
                </div>`);
            }

            if (!groups.length) {
                resultsEl.innerHTML = `<div style="padding:18px; text-align:center; color:var(--wcpp-muted);">
                    No direct matches for "<strong>${escHtml(rawQ)}</strong>".
                    <div style="margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                        <a href="orders.html?q=${encodeURIComponent(rawQ)}" class="wcpp-inv-badge request">Search Live Orders →</a>
                        <a href="bios.html?q=${encodeURIComponent(rawQ)}" class="wcpp-inv-badge request">Search Bio &amp; Pest Guides →</a>
                    </div>
                </div>`;
                return;
            }
            resultsEl.innerHTML = groups.join("");
            resultsEl.querySelectorAll("[data-open-blog-id]").forEach(btn => {
                btn.onclick = () => {
                    const bid = btn.getAttribute("data-open-blog-id");
                    closeSearch();
                    if (global.WCPPBlog && typeof global.WCPPBlog.openPostModal === "function") {
                        global.WCPPBlog.openPostModal(bid);
                    }
                };
            });
        }

        renderResults();
        inp.addEventListener("input", () => {
            renderResults();
            if (global.WCPPAnalytics) {
                global.WCPPAnalytics.trackDebounced("quick_search_modal", "search", {
                    search_term: (inp.value || "").trim().slice(0, 100),
                    search_source: "quick_search_modal"
                }, 650);
            }
        });
        [
            ensureNativeSearchIndex(),
            ensureBiosSearchIndex(),
            ensureGardenSearchIndex(),
            ensureLatinSearchIndex(),
            loadSharedArticles(),
            loadSharedBlogPosts()
        ].forEach(p => {
            Promise.resolve(p).then(() => {
                if (document.getElementById("wcppGlobalSearchModal")) renderResults();
            }).catch(() => {});
        });
        setTimeout(() => inp.focus(), 30);
    };

    if (!global._wcppSearchKeyBound) {
        global._wcppSearchKeyBound = true;
        document.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                global.openGlobalSearchModal();
                return;
            }
            const tag = (e.target && e.target.tagName ? e.target.tagName : "").toUpperCase();
            if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag) && !(e.target && e.target.isContentEditable)) {
                e.preventDefault();
                global.openGlobalSearchModal();
            }
        });
    }

    // =========================================================================
    // 5. PWA MANIFEST LINK, INSTALL PROMPT & SERVICE WORKER REGISTRATION
    // =========================================================================
    if (document.head) {
        if (!document.querySelector('link[rel="icon"]')) {
            const icoLink = document.createElement("link");
            icoLink.rel = "icon";
            icoLink.href = "favicon.ico";
            icoLink.setAttribute("sizes", "any");
            document.head.appendChild(icoLink);
        }
        if (!document.querySelector('link[rel="manifest"]')) {
            const mLink = document.createElement("link");
            mLink.rel = "manifest";
            mLink.href = "manifest.json?v=20261121i";
            document.head.appendChild(mLink);
        }
        if (!document.querySelector('link[rel="apple-touch-icon"]')) {
            const appleLink = document.createElement("link");
            appleLink.rel = "apple-touch-icon";
            appleLink.href = "icon-192.png";
            document.head.appendChild(appleLink);
        }
    }

    let _deferredInstallPrompt = null;
    global.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        _deferredInstallPrompt = e;
    });

    function openInstallGuideModal() {
        if (document.getElementById("wcppInstallAppModal")) return;
        const isStandalone = (global.matchMedia && global.matchMedia("(display-mode: standalone)").matches) || Boolean(global.navigator && global.navigator.standalone);
        const bd = document.createElement("div");
        bd.id = "wcppInstallAppModal";
        bd.className = "wcpp-modal-backdrop";
        bd.innerHTML = `
            <div class="wcpp-modal" role="dialog" aria-modal="true" aria-label="Install Plant Project App">
                <div class="wcpp-modal-header">
                    <h2>📲 Install West Coast Plant Project App</h2>
                    <button type="button" class="wcpp-modal-close" aria-label="Close">✕</button>
                </div>
                <div class="wcpp-modal-body" style="display:flex; flex-direction:column; gap:12px; font-size:0.9rem; line-height:1.5;">
                    ${isStandalone
                        ? `<div style="padding:12px 14px; border-radius:10px; background:var(--wcpp-btn-soft-bg); border:1px solid var(--wcpp-btn-soft-border); font-weight:800; color:var(--wcpp-primary);">✓ You are already using the installed app!</div>`
                        : `<p style="margin:0; color:var(--wcpp-muted);">Add <strong>PlantProject</strong> to your home screen for full-screen access, fast launching, and offline plant/inventory sheets:</p>`}
                    <div style="padding:11px 13px; border-radius:10px; background:var(--wcpp-bg); border:1px solid var(--wcpp-border);">
                        <strong>🤖 Android (Chrome / Edge):</strong><br>
                        Tap the <strong>⋮</strong> (3-dot menu) in the top-right corner of Chrome &rarr; tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.
                    </div>
                    <div style="padding:11px 13px; border-radius:10px; background:var(--wcpp-bg); border:1px solid var(--wcpp-border);">
                        <strong>🍎 iPhone / iPad (Safari):</strong><br>
                        Tap the <strong>Share (↑)</strong> icon at the bottom of Safari &rarr; scroll down and tap <strong>Add to Home Screen</strong>.
                    </div>
                    <div style="padding:11px 13px; border-radius:10px; background:var(--wcpp-bg); border:1px solid var(--wcpp-border);">
                        <strong>💻 Desktop (Chrome / Edge):</strong><br>
                        Click the <strong>Install (⊕)</strong> icon on the right side of the browser address bar.
                    </div>
                </div>
                <div class="wcpp-modal-footer">
                    <button type="button" class="wcpp-pill-btn primary" id="wcppInstallCloseBtn">Got it</button>
                </div>
            </div>
        `;
        const closeInstall = () => {
            bd.remove();
            document.removeEventListener("keydown", onEscInstall);
        };
        const onEscInstall = (ev) => {
            if (ev.key === "Escape") closeInstall();
        };
        document.addEventListener("keydown", onEscInstall);
        bd.querySelector(".wcpp-modal-close").onclick = closeInstall;
        bd.querySelector("#wcppInstallCloseBtn").onclick = closeInstall;
        bd.addEventListener("click", (ev) => { if (ev.target === bd) closeInstall(); });
        document.body.appendChild(bd);
    }

    global.triggerWCPPInstall = async function () {
        if (_deferredInstallPrompt) {
            try {
                _deferredInstallPrompt.prompt();
                const choice = await _deferredInstallPrompt.userChoice;
                if (global.WCPPAnalytics) {
                    global.WCPPAnalytics.track("pwa_install_prompt", {
                        outcome: (choice && choice.outcome) || "unknown"
                    });
                }
                _deferredInstallPrompt = null;
                return;
            } catch (_) {}
        }
        if (global.WCPPAnalytics) {
            global.WCPPAnalytics.track("pwa_install_prompt", {
                outcome: "guide_modal"
            });
        }
        openInstallGuideModal();
    };

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator && (global.location.protocol === "https:" || global.location.hostname === "localhost" || global.location.hostname === "127.0.0.1")) {
        global.addEventListener("load", () => {
            navigator.serviceWorker.register("sw.js?v=20261121i").then(reg => {
                try { reg.update(); } catch (_) {}
            }).catch(() => {});
        });
    }

    // =========================================================================
    // 6. GLOBAL EXTENDED NON-PII TELEMETRY (Outbound/Contact, Calculators, Print, Web Vitals)
    // =========================================================================
    if (!global.__wcppExtendedTelemetryInstalled) {
        global.__wcppExtendedTelemetryInstalled = true;
        const pagePath = (global.location && global.location.pathname) || "/";

        document.addEventListener("click", (ev) => {
            try {
                const a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
                if (!a || !global.WCPPAnalytics) return;
                const href = (a.getAttribute("href") || "").trim();
                const linkText = (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 80);
                if (/^(tel:|mailto:)/i.test(href)) {
                    const scheme = href.split(":")[0].toLowerCase();
                    global.WCPPAnalytics.track("contact_click", {
                        content_type: scheme,
                        element_url: href.slice(0, 120),
                        element_text: linkText,
                        action: "clicked"
                    });
                    return;
                }
                if (/^https?:\/\//i.test(href)) {
                    const u = new URL(href);
                    if (u.hostname !== global.location.hostname) {
                        global.WCPPAnalytics.track("outbound_click", {
                            content_type: "external_link",
                            element_url: href.slice(0, 160),
                            element_text: linkText,
                            dataset: u.hostname
                        });
                    }
                }
            } catch (_) {}
        }, true);

        // Calculator interaction tracking on calculators.html
        if (/calculators\.html$/i.test(pagePath)) {
            const onCalcEvent = (ev) => {
                try {
                    const el = ev.target;
                    if (!el || !global.WCPPAnalytics) return;
                    const card = el.closest ? el.closest(".calc-card, .card, section") : null;
                    const heading = card && card.querySelector ? card.querySelector("h2, h3") : null;
                    const calcName = (heading && heading.textContent ? heading.textContent : (el.id || el.name || "calculator")).trim().slice(0, 80);
                    global.WCPPAnalytics.trackDebounced("calc_" + calcName, "calculator_use", {
                        content_type: "horticulture_calculator",
                        element_id: (el.id || el.name || "").slice(0, 60),
                        section_name: calcName,
                        action: ev.type
                    }, 700);
                } catch (_) {}
            };
            document.addEventListener("change", onCalcEvent, true);
            document.addEventListener("input", onCalcEvent, true);
        }

        global.addEventListener("beforeprint", () => {
            if (global.WCPPAnalytics) {
                global.WCPPAnalytics.track("print_action", {
                    content_type: "page_print",
                    page_path: pagePath
                });
            }
        });

        global.addEventListener("offline", () => {
            if (global.WCPPAnalytics) global.WCPPAnalytics.track("online_status_change", { action: "offline" });
        });
        global.addEventListener("online", () => {
            if (global.WCPPAnalytics) global.WCPPAnalytics.track("online_status_change", { action: "online" });
        });

        // Core Web Vitals & Display Mode telemetry (sent once per page view on hide)
        let _lcpMs = 0;
        let _clsSum = 0;
        let _vitalsSent = false;
        if (typeof PerformanceObserver === "function") {
            try {
                new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    if (entries.length) _lcpMs = Math.round(entries[entries.length - 1].startTime || 0);
                }).observe({ type: "largest-contentful-paint", buffered: true });
            } catch (_) {}
            try {
                new PerformanceObserver((list) => {
                    list.getEntries().forEach((e) => {
                        if (!e.hadRecentInput) _clsSum += (e.value || 0);
                    });
                }).observe({ type: "layout-shift", buffered: true });
            } catch (_) {}
        }
        const flushVitals = () => {
            if (_vitalsSent || !global.WCPPAnalytics) return;
            _vitalsSent = true;
            try {
                const nav = (performance && performance.getEntriesByType) ? performance.getEntriesByType("navigation")[0] : null;
                const ttfb = nav ? Math.round(nav.responseStart || 0) : 0;
                const isStandalone = (global.matchMedia && global.matchMedia("(display-mode: standalone)").matches) || global.navigator.standalone === true;
                global.WCPPAnalytics.track("web_vitals_summary", {
                    lcp_ms: _lcpMs,
                    cls_thousandths: Math.round(_clsSum * 1000),
                    ttfb_ms: ttfb,
                    pwa_display_mode: isStandalone ? "standalone" : "browser",
                    theme_mode: (document.body && document.body.classList.contains("dark-mode")) ? "dark" : "light"
                });
            } catch (_) {}
        };
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") flushVitals();
        });
        global.addEventListener("pagehide", flushVitals);
    }


    /* =====================================================================
       Zero-Empty-Space AdSense Slot Engine + IAB Viewability Telemetry
       Configured via WCPP_AD_SLOTS; stays 0px collapsed unless filled.
       ===================================================================== */
    const AD_FREE_PAGES = /(^|\/)((orders|seed-library|privacy|support|admin|404)\.html)$/i;
    const WCPPAds = {
        PUB: "ca-pub-5064411102602053",
        // Numeric AdSense unit IDs populated once created in AdSense -> Ads -> By ad unit
        SLOTS: {
            inContent: "1928379395",
            multiplex: "8605468388"
        },
        init: function () {
            try {
                if (AD_FREE_PAGES.test(location.pathname || "")) return;
                // Auto-place a below-content multiplex slot on species profiles & articles
                const main = document.querySelector("main.main-content");
                if (main && !main.querySelector('.wcpp-ad-slot[data-ad-kind="multiplex"]')) {
                    if (/\/(species-[^/]+|articles|plant-planner|nativeplants|garden|calendar|calculators|latin|bios|this-week)\.html$/i.test(location.pathname || "")) {
                        const autoWrap = document.createElement("div");
                        autoWrap.className = "wcpp-ad-slot";
                        autoWrap.setAttribute("data-ad-kind", "multiplex");
                        autoWrap.setAttribute("data-ad-pos", "auto_below_content");
                        autoWrap.setAttribute("aria-label", "Advertisement");
                        main.appendChild(autoWrap);
                    }
                }
                const nodes = Array.from(document.querySelectorAll(".wcpp-ad-slot"));
                nodes.forEach((wrap) => {
                    if (wrap.dataset.wcppInit) return;
                    const kind = wrap.getAttribute("data-ad-kind") || "inContent";
                    const pos = wrap.getAttribute("data-ad-pos") || kind;
                    const slotId = wrap.getAttribute("data-ad-slot") || this.SLOTS[kind] || "";
                    if (!slotId) return; // Stays 0px hidden when no explicit slot ID is configured
                    wrap.dataset.wcppInit = "1";
                    const ins = document.createElement("ins");
                    ins.className = "adsbygoogle";
                    ins.style.display = "block";
                    ins.setAttribute("data-ad-client", this.PUB);
                    ins.setAttribute("data-ad-slot", slotId);
                    if (kind === "multiplex") {
                        ins.setAttribute("data-ad-format", "autorelaxed");
                    } else {
                        ins.setAttribute("data-ad-format", "auto");
                        ins.setAttribute("data-full-width-responsive", "true");
                    }
                    wrap.appendChild(ins);
                    let reported = false;
                    const syncStatus = () => {
                        const st = ins.getAttribute("data-ad-status");
                        if (st === "unfilled") {
                            wrap.classList.remove("is-filled");
                            wrap.classList.add("is-unfilled");
                            if (!reported && global.WCPPAnalytics) {
                                reported = true;
                                global.WCPPAnalytics.track("ad_slot_status", { content_type: pos, outcome: "unfilled" });
                            }
                        } else if (st === "filled") {
                            wrap.classList.remove("is-unfilled");
                            wrap.classList.add("is-filled");
                            if (!reported && global.WCPPAnalytics) {
                                reported = true;
                                global.WCPPAnalytics.track("ad_slot_status", { content_type: pos, outcome: "filled" });
                            }
                            WCPPAds.observeViewability(wrap, pos);
                        }
                    };
                    const mo = new MutationObserver(syncStatus);
                    mo.observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });
                    // Collapse cleanly if AdSense script is blocked or doesn't fill within 6s
                    setTimeout(() => {
                        if (!ins.getAttribute("data-ad-status") && ins.offsetHeight < 20) {
                            wrap.classList.remove("is-filled");
                            wrap.classList.add("is-unfilled");
                        }
                    }, 6000);
                    try { (global.adsbygoogle = global.adsbygoogle || []).push({}); } catch (_) {}
                });
            } catch (_) {}
        },
        observeViewability: function (el, pos) {
            if (!("IntersectionObserver" in global) || el.dataset.wcppViewTracked) return;
            el.dataset.wcppViewTracked = "1";
            let timer = null;
            const io = new IntersectionObserver((entries) => {
                entries.forEach((en) => {
                    if (en.isIntersecting && en.intersectionRatio >= 0.5) {
                        if (!timer) {
                            timer = setTimeout(() => {
                                if (global.WCPPAnalytics) global.WCPPAnalytics.track("ad_slot_viewable", { content_type: pos });
                                io.disconnect();
                            }, 1000);
                        }
                    } else if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                });
            }, { threshold: [0.5] });
            io.observe(el);
        }
    };
    global.WCPPAds = WCPPAds;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => WCPPAds.init());
    else WCPPAds.init();


    // =========================================================================
    // 6. SPECIES PAGE HERO PHOTO & FLORA INDEX HOVER PREVIEWS
    // =========================================================================
    function initSpeciesHeroPhoto() {
        const hero = document.querySelector(".sp-hero");
        if (!hero) return;

        let photoWrap = hero.querySelector(".sp-hero-photo-wrap") || document.querySelector(".sp-hero-photo-wrap");
        const latinEl = hero.querySelector(".sp-latin em") || hero.querySelector(".sp-latin");
        const titleEl = hero.querySelector("h1");
        const sciName = (latinEl ? latinEl.textContent : "").trim();
        const commonName = (titleEl ? titleEl.textContent : "").trim();
        if (!sciName && !commonName) return;

        const fallbackSvg = typeof global.generateBotanicalCardSVG === "function" ? global.generateBotanicalCardSVG(sciName, commonName) : "";

        if (!photoWrap) {
            hero.classList.add("sp-hero-with-photo");
            if (!hero.querySelector(".sp-hero-text")) {
                const textWrap = document.createElement("div");
                textWrap.className = "sp-hero-text";
                while (hero.firstChild) {
                    textWrap.appendChild(hero.firstChild);
                }
                hero.appendChild(textWrap);
            }
            photoWrap = document.createElement("div");
            photoWrap.className = "sp-hero-photo-wrap";
            photoWrap.innerHTML = `
                <img id="sp-hero-photo" class="sp-hero-photo" src="${fallbackSvg}" alt="${String(sciName || commonName).replace(/"/g, "&quot;")}">
                <span id="sp-hero-badge" class="sp-photo-badge">Locating photo...</span>
            `;
            hero.appendChild(photoWrap);
        } else {
            hero.classList.add("sp-hero-with-photo");
        }

        const imgEl = photoWrap.querySelector("img");
        const badgeEl = photoWrap.querySelector(".sp-photo-badge");

        if (imgEl) {
            imgEl.onerror = function () {
                this.onerror = null;
                if (fallbackSvg) this.src = fallbackSvg;
                if (badgeEl) badgeEl.textContent = "Botanical Card";
            };
        }

        if (typeof global.resolveSharedPlantPhoto === "function") {
            global.resolveSharedPlantPhoto(sciName, commonName, "", fallbackSvg).then(res => {
                if (res && res.url && imgEl) {
                    imgEl.src = res.url;
                    if (badgeEl) badgeEl.textContent = res.source || "Wikimedia Commons";
                }
            }).catch(() => {
                if (badgeEl) badgeEl.textContent = "Botanical Card";
            });
        }
    }

    function initFloraIndexHoverPopup() {
        const floraLists = document.querySelectorAll(".flora-list, #floraCoreList");
        if (!floraLists.length && !location.pathname.includes("flora-index")) return;

        let popup = document.getElementById("floraHoverCard");
        if (!popup) {
            popup = document.createElement("div");
            popup.id = "floraHoverCard";
            popup.className = "flora-hover-card";
            popup.setAttribute("aria-hidden", "true");
            popup.innerHTML = `
                <div class="flora-hover-img-wrap">
                    <img id="floraHoverImg" src="" alt="Plant Preview">
                    <span id="floraHoverBadge" class="flora-hover-badge">Wikimedia Commons</span>
                </div>
                <div class="flora-hover-body">
                    <div id="floraHoverCommon" class="flora-hover-common"></div>
                    <div id="floraHoverLatin" class="flora-hover-latin"></div>
                </div>
            `;
            document.body.appendChild(popup);
        }

        const imgEl = popup.querySelector("#floraHoverImg");
        const badgeEl = popup.querySelector("#floraHoverBadge");
        const commonEl = popup.querySelector("#floraHoverCommon");
        const latinEl = popup.querySelector("#floraHoverLatin");

        let activeTarget = null;
        let hoverTimer = null;
        let currentRequestId = 0;

        function extractNamesFromAnchor(a) {
            const em = a.querySelector("em");
            let latin = em ? em.textContent.trim() : "";
            let text = a.textContent.trim();
            text = text.replace(/^\d+\.\s*/, "");
            let common = text;
            if (latin) {
                common = text.replace(new RegExp("\\s*\\(?\\s*" + latin.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "\\s*\\)?", "i"), "").trim();
            } else if (text.includes("(") && text.includes(")")) {
                const match = text.match(/^(.*?)\s*\((.*?)\)$/);
                if (match) {
                    common = match[1].trim();
                    latin = match[2].trim();
                }
            }
            return { common, latin };
        }

        function positionPopup(e) {
            if (!popup.classList.contains("active")) return;
            const cardWidth = 270;
            const cardHeight = 220;
            const pad = 16;
            let left = e.clientX + 18;
            let top = e.clientY - (cardHeight / 2);

            if (left + cardWidth > window.innerWidth - pad) {
                left = e.clientX - cardWidth - 18;
            }
            if (left < pad) left = pad;

            if (top + cardHeight > window.innerHeight - pad) {
                top = window.innerHeight - cardHeight - pad;
            }
            if (top < pad) top = pad;

            popup.style.left = left + "px";
            popup.style.top = top + "px";
        }

        document.addEventListener("pointermove", (e) => {
            if (popup.classList.contains("active")) {
                positionPopup(e);
            }
        });

        document.addEventListener("pointerover", (e) => {
            const a = e.target.closest("#floraCoreList li a, .flora-list li a, .alpha-list li a, a[href^='species-']");
            if (!a) return;
            if (activeTarget === a) return;

            activeTarget = a;
            clearTimeout(hoverTimer);

            const { common, latin } = extractNamesFromAnchor(a);
            if (!common && !latin) return;

            const fallbackSvg = typeof global.generateBotanicalCardSVG === "function" ? global.generateBotanicalCardSVG(latin, common) : "";
            currentRequestId++;
            const thisReq = currentRequestId;

            commonEl.textContent = common || latin;
            latinEl.textContent = latin ? latin : "";
            imgEl.src = fallbackSvg;
            badgeEl.textContent = "Locating photo...";

            imgEl.onerror = function () {
                this.onerror = null;
                if (fallbackSvg) this.src = fallbackSvg;
                badgeEl.textContent = "Botanical Card";
            };

            popup.classList.add("active");
            popup.setAttribute("aria-hidden", "false");
            positionPopup(e);

            if (typeof global.resolveSharedPlantPhoto === "function") {
                global.resolveSharedPlantPhoto(latin, common, "", fallbackSvg).then(res => {
                    if (thisReq !== currentRequestId) return;
                    if (res && res.url) {
                        imgEl.src = res.url;
                        badgeEl.textContent = res.source || "Wikimedia Commons";
                    }
                }).catch(() => {
                    if (thisReq === currentRequestId) badgeEl.textContent = "Botanical Card";
                });
            }
        });

        document.addEventListener("pointerout", (e) => {
            const a = e.target.closest("#floraCoreList li a, .flora-list li a, .alpha-list li a, a[href^='species-']");
            if (!a) return;
            if (activeTarget !== a) return;

            hoverTimer = setTimeout(() => {
                popup.classList.remove("active");
                popup.setAttribute("aria-hidden", "true");
                activeTarget = null;
            }, 60);
        });
    }

    // =========================================================================
    // 7 & 8. BOTANICAL SVG ICON SYSTEM, EDITORIAL UI, PHENOLOGY & SITE POLISH
    // =========================================================================
    const WCPP_SVG = {
        sun: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
        water: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
        ruler: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/></svg>`,
        flower: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/><path d="M12 7.5V9M7.5 12H9M16.5 12H15M12 16.5V15"/></svg>`,
        leaf: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
        shield: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
        book: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
        calendar: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
        feather: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>`,
        tree: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/><path d="M12 22v-3"/></svg>`,
        sprout: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>`,
        butterfly: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12"/><path d="M12 8C9 4 4 4 4 9c0 3 3 4 8 3"/><path d="M12 8c3-4 8-4 8 1 0 3-3 4-8 3"/><path d="M12 12c-4 1-6 3-5 6 1 2 4 1 5-3"/><path d="M12 12c4 1 6 3 5 6-1 2-4 1-5-3"/></svg>`,
        scroll: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`,
        sparkles: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
        library: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>`,
        search: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        chart: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
        pot: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10h10l-1.5 10h-7Z"/><path d="M5 10h14"/><path d="M12 10V4"/><path d="M12 6c-2-2-4-2-5 0 1 2 3 2 5 0Z"/><path d="M12 6c2-2 4-2 5 0-1 2-3 2-5 0Z"/></svg>`,
        star: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
        dice: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8.5" cy="15.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/></svg>`,
        moon: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
        share: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
        heart: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
        lock: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
        gift: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`,
        bug: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z"/><path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>`,
        calc: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="16" x2="12" y2="16"/></svg>`,
        therm: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>`,
        pin: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
        mail: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
        alert: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        refresh: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,
        tag: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`,
        cloudSun: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41"/><path d="M15.95 10A4 4 0 0 0 8.5 8.5"/><path d="M17.5 19H7a4 4 0 0 1-.5-7.97 5 5 0 0 1 9.58-1.03A3.5 3.5 0 0 1 17.5 19Z"/></svg>`,
        snowflake: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/></svg>`,
        waves: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`,
        mountain: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`,
        globe: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        grid: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
        list: `<svg class="wcpp-ico" viewBox="0 0 24 24" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`
    };

    function resolveBloomColorHex(rawColor) {
        const c = String(rawColor || "").toLowerCase();
        if (c.includes("yellow") || c.includes("gold")) return "#facc15";
        if (c.includes("pink") || c.includes("rose") || c.includes("magenta")) return "#f472b6";
        if (c.includes("purple") || c.includes("violet") || c.includes("lavender") || c.includes("lilac")) return "#c084fc";
        if (c.includes("blue")) return "#60a5fa";
        if (c.includes("red") || c.includes("scarlet") || c.includes("crimson")) return "#f87171";
        if (c.includes("orange") || c.includes("copper")) return "#fb923c";
        if (c.includes("white") || c.includes("cream")) return "#f8fafc";
        if (c.includes("green") || c.includes("brown") || c.includes("inconspicuous")) return "#4ade80";
        return "#86efac";
    }

    function parseBloomMonthIndices(rawMonths) {
        const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const text = String(rawMonths || "").toLowerCase();
        const active = new Set();
        if (!text || text === "n/a" || text === "none") return active;

        const rangeRegex = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(?:–|-|to)\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/g;
        let m;
        while ((m = rangeRegex.exec(text)) !== null) {
            const s = MONTHS.indexOf(m[1]);
            const e = MONTHS.indexOf(m[2]);
            if (s !== -1 && e !== -1) {
                if (s <= e) {
                    for (let i = s; i <= e; i++) active.add(i);
                } else {
                    for (let i = s; i < 12; i++) active.add(i);
                    for (let i = 0; i <= e; i++) active.add(i);
                }
            }
        }

        MONTHS.forEach((mon, idx) => {
            if (new RegExp("\\b" + mon, "i").test(text)) active.add(idx);
        });
        return active;
    }

    function upgradePageEmojisToSVG(root) {
        const scope = root || document;
        const emojiMap = [
            { regex: /^\s*🌿\s*/, svg: WCPP_SVG.leaf },
            { regex: /^\s*🦋\s*/, svg: WCPP_SVG.butterfly },
            { regex: /^\s*🔎\s*/, svg: WCPP_SVG.search },
            { regex: /^\s*🔍\s*/, svg: WCPP_SVG.search },
            { regex: /^\s*📊\s*/, svg: WCPP_SVG.chart },
            { regex: /^\s*🪴\s*/, svg: WCPP_SVG.pot },
            { regex: /^\s*🌱\s*/, svg: WCPP_SVG.sprout },
            { regex: /^\s*📅\s*/, svg: WCPP_SVG.calendar },
            { regex: /^\s*🗓️?\s*/, svg: WCPP_SVG.calendar },
            { regex: /^\s*🎲\s*/, svg: WCPP_SVG.dice },
            { regex: /^\s*📲\s*/, svg: WCPP_SVG.sparkles },
            { regex: /^\s*✨\s*/, svg: WCPP_SVG.sparkles },
            { regex: /^\s*⭐\s*/, svg: WCPP_SVG.star },
            { regex: /^\s*🌙\s*/, svg: WCPP_SVG.moon },
            { regex: /^\s*☀️?\s*/, svg: WCPP_SVG.sun },
            { regex: /^\s*📖\s*/, svg: WCPP_SVG.book },
            { regex: /^\s*🐞\s*/, svg: WCPP_SVG.bug },
            { regex: /^\s*🐝\s*/, svg: WCPP_SVG.butterfly },
            { regex: /^\s*🌲\s*/, svg: WCPP_SVG.tree },
            { regex: /^\s*🌸\s*/, svg: WCPP_SVG.flower },
            { regex: /^\s*💧\s*/, svg: WCPP_SVG.water },
            { regex: /^\s*🔒\s*/, svg: WCPP_SVG.lock },
            { regex: /^\s*📋\s*/, svg: WCPP_SVG.scroll },
            { regex: /^\s*📝\s*/, svg: WCPP_SVG.scroll },
            { regex: /^\s*🧮\s*/, svg: WCPP_SVG.calc },
            { regex: /^\s*🔬\s*/, svg: WCPP_SVG.sparkles },
            { regex: /^\s*🌡️?\s*/, svg: WCPP_SVG.therm },
            { regex: /^\s*📍\s*/, svg: WCPP_SVG.pin },
            { regex: /^\s*✉️?\s*/, svg: WCPP_SVG.mail },
            { regex: /^\s*⚠️?\s*/, svg: WCPP_SVG.alert },
            { regex: /^\s*🛡️?\s*/, svg: WCPP_SVG.shield },
            { regex: /^\s*🔄\s*/, svg: WCPP_SVG.refresh },
            { regex: /^\s*🏷️?\s*/, svg: WCPP_SVG.tag },
            { regex: /^\s*🍅\s*/, svg: WCPP_SVG.sprout },
            { regex: /^\s*🥕\s*/, svg: WCPP_SVG.sprout },
            { regex: /^\s*🥗\s*/, svg: WCPP_SVG.leaf },
            { regex: /^\s*🏠\s*/, svg: WCPP_SVG.sprout },
            { regex: /^\s*🚀\s*/, svg: WCPP_SVG.sparkles },
            { regex: /^\s*💡\s*/, svg: WCPP_SVG.sun },
            { regex: /^\s*⚡\s*/, svg: WCPP_SVG.sparkles },
            { regex: /^\s*🪶\s*/, svg: WCPP_SVG.feather },
            { regex: /^\s*🐛\s*/, svg: WCPP_SVG.bug },
            { regex: /^\s*🔗\s*/, svg: WCPP_SVG.share },
            { regex: /^\s*🌦️?\s*/, svg: WCPP_SVG.cloudSun },
            { regex: /^\s*⛅\s*/, svg: WCPP_SVG.cloudSun },
            { regex: /^\s*☁️?\s*/, svg: WCPP_SVG.cloudSun },
            { regex: /^\s*🏜️?\s*/, svg: WCPP_SVG.sun },
            { regex: /^\s*🍓\s*/, svg: WCPP_SVG.sprout },
            { regex: /^\s*🦌\s*/, svg: WCPP_SVG.shield },
            { regex: /^\s*❄️?\s*/, svg: WCPP_SVG.snowflake },
            { regex: /^\s*🌊\s*/, svg: WCPP_SVG.waves },
            { regex: /^\s*⛰️?\s*/, svg: WCPP_SVG.mountain },
            { regex: /^\s*📰\s*/, svg: WCPP_SVG.book },
            { regex: /^\s*📚\s*/, svg: WCPP_SVG.book },
            { regex: /^\s*📈\s*/, svg: WCPP_SVG.chart },
            { regex: /^\s*⚙️?\s*/, svg: WCPP_SVG.sparkles },
            { regex: /^\s*🛠️?\s*/, svg: WCPP_SVG.sparkles }
        ];

        // Upgrade standalone emoji spans in header & floating theme toggle (zero emojis in navs/chrome!)
        const gardenStarSpan = document.querySelector("#headerGardenPlanBtn > span[aria-hidden='true']");
        if (gardenStarSpan && !gardenStarSpan.querySelector("svg") && /⭐|★|☆/.test(gardenStarSpan.textContent || "")) {
            gardenStarSpan.innerHTML = WCPP_SVG.star;
        }
        const curatorLockSpan = document.querySelector("#headerCuratorBtn > span[aria-hidden='true']");
        if (curatorLockSpan && !curatorLockSpan.querySelector("svg") && /🔒|🔓/.test(curatorLockSpan.textContent || "")) {
            curatorLockSpan.innerHTML = WCPP_SVG.lock;
        }
        const floatingThemeBtn = document.getElementById("themeToggleBtn");
        if (floatingThemeBtn) {
            const isDark = document.body.classList.contains("dark-mode");
            const expectedKey = isDark ? "sun" : "moon";
            if (floatingThemeBtn.dataset.wcppThemeIcon !== expectedKey || !floatingThemeBtn.querySelector("svg")) {
                floatingThemeBtn.dataset.wcppThemeIcon = expectedKey;
                floatingThemeBtn.innerHTML = isDark ? WCPP_SVG.sun : WCPP_SVG.moon;
            }
        }

        const targets = scope.querySelectorAll(
            ".sp-badge, .sp-btn, .tool-link-card strong, #surpriseBtn, .surprise-btn, .hero-card button, .calc-hero button, " +
            "#mobileInstallBtn, #mobileGardenPlanBtn, #mobileSearchBtn, #mobileThemeBtn, #mobileCiteBtn, " +
            ".wcpp-modal-header h2, .wcpp-search-group h4, .wcpp-search-item-title, .wcpp-inv-badge, .wcpp-pill-btn, .wcpp-save-garden-btn, " +
            ".origin-badge, .facet-pill span, .btn-hero, .curator-quick-btn, .bloom-section h2, " +
            ".pill-filter, .chip, .calcNav a, .view-tabs button, .view-btn, .updates-hero h1, .panel-head h2, " +
            ".bloom-title span, .sim-summary-title, .sim-badge, #calcLiveWeatherStatus, .action-buttons .btn, .latin-pill-badge, .curator-toolbar-label, " +
            ".cal-hero-top > div > div, .city-selector-box label, #calLiveWeatherBanner span, #calLiveWeatherBanner a, " +
            ".now-dashboard h2, .now-columns h3, .now-card h3, .support-card button, .etransfer-box button, .updates-table td span, .updates-table a, .host-pill, #ghBlogCardTopLeft, " +
            ".gh-blog-modal h2, .gh-blog-modal h3, .gh-blog-modal a, .gh-blog-modal button, .plant-action-pill, .modal-content a, .modal-content button"
        );
        targets.forEach(el => {
            if (el.querySelector("svg.wcpp-ico")) return;
            const firstNode = el.firstChild;
            if (!firstNode || firstNode.nodeType !== Node.TEXT_NODE) return;
            const txt = firstNode.nodeValue || "";
            // Replace colored emoji arrows/down-arrows with clean monochrome unicode arrows
            if (/[↗⬇]️/.test(txt)) {
                firstNode.nodeValue = txt.replace(/↗️/g, "↗").replace(/⬇️/g, "↓");
            }
            const cleanedTxt = firstNode.nodeValue || "";
            for (let i = 0; i < emojiMap.length; i++) {
                if (emojiMap[i].regex.test(cleanedTxt)) {
                    firstNode.nodeValue = " " + cleanedTxt.replace(emojiMap[i].regex, "");
                    const span = document.createElement("span");
                    span.innerHTML = emojiMap[i].svg;
                    el.insertBefore(span.firstElementChild, firstNode);
                    break;
                }
            }
        });
        // Strip colored arrow variation selector (↗️ / ⬇️) on trailing text nodes inside chips/buttons/pills
        scope.querySelectorAll(".chip, .btn, .plant-action-pill, #downloadBtn").forEach(el => {
            el.childNodes.forEach(n => {
                if (n.nodeType === Node.TEXT_NODE && /[↗⬇]️/.test(n.nodeValue || "")) {
                    n.nodeValue = n.nodeValue.replace(/↗️/g, "↗").replace(/⬇️/g, "↓");
                }
            });
        });

        const dirSearch = document.getElementById("dirSearchInput");
        if (dirSearch && dirSearch.placeholder && dirSearch.placeholder.includes("🔍")) {
            dirSearch.placeholder = dirSearch.placeholder.replace(/^🔍\s*/, "");
        }
    }

    function upgradeSpeciesSemicolonListsToPills() {
        const pillHeadingKeywords = [
            "habitat types",
            "biogeoclimatic zones",
            "bc regional range",
            "garden uses",
            "key features",
            "pollinators",
            "host butterflies",
            "lepidoptera host genera"
        ];
        document.querySelectorAll(".sp-card h3").forEach(h3 => {
            const title = (h3.textContent || "").trim().toLowerCase();
            if (!pillHeadingKeywords.includes(title)) return;
            const p = h3.nextElementSibling;
            if (!p || p.tagName !== "P" || p.dataset.pillsUpgraded) return;
            const raw = (p.textContent || "").trim();
            if (!raw || !raw.includes(";")) return;
            const items = raw.split(";").map(s => s.trim()).filter(Boolean);
            if (items.length < 2) return;

            p.dataset.pillsUpgraded = "1";
            const wrap = document.createElement("div");
            wrap.className = "sp-auto-pills";
            wrap.innerHTML = items.map(item =>
                `<span class="sp-auto-pill">${item.replace(/</g, "&lt;")}</span>`
            ).join("");
            p.replaceWith(wrap);
        });
    }

    function initSpeciesVisualEnhancements() {
        const hero = document.querySelector(".sp-hero");
        if (!hero) return;

        // 1. Parse Quick Growing Facts table
        const factsMap = {};
        const quickFactsCard = document.getElementById("quick-facts");
        if (quickFactsCard) {
            quickFactsCard.querySelectorAll("tr").forEach(tr => {
                const th = tr.querySelector("th");
                const td = tr.querySelector("td");
                if (th && td) {
                    factsMap[th.textContent.trim().toLowerCase()] = td.textContent.trim();
                }
            });
        }

        const lightVal = factsMap["light"] || "";
        const moistureVal = factsMap["moisture"] || "";
        const sizeVal = factsMap["mature size"] || "";
        const flowerColorVal = factsMap["flower colour"] || factsMap["flower color"] || "";
        const bloomMonthsVal = factsMap["bloom months"] || "";
        const foliageVal = factsMap["foliage"] || "";
        const droughtVal = factsMap["drought tolerance"] || "";

        // Set Bloom-Color Accent on Hero
        const bloomHex = resolveBloomColorHex(flowerColorVal);
        hero.style.setProperty("--sp-bloom-accent", bloomHex);

        // 2. Clean up jargon in .sp-actions buttons & inject Quick-Glance Ecological Chips Ribbon
        const actionsEl = document.querySelector(".sp-actions");
        if (actionsEl) {
            actionsEl.querySelectorAll("a.sp-btn").forEach(a => {
                Array.from(a.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        if (/Open 5-Tab Explorer Profile/i.test(node.nodeValue)) {
                            node.nodeValue = node.nodeValue.replace(/Open 5-Tab Explorer Profile/i, "Open in Visual Field Guide");
                        } else if (/Compare in Native Plant Matrix/i.test(node.nodeValue)) {
                            node.nodeValue = node.nodeValue.replace(/Compare in Native Plant Matrix/i, "Compare Side-by-Side");
                        }
                    }
                });
            });
        }
        if (actionsEl && !actionsEl.querySelector(".sp-share-btn")) {
            const shareBtn = document.createElement("button");
            shareBtn.type = "button";
            shareBtn.className = "sp-btn sp-share-btn";
            shareBtn.style.cursor = "pointer";
            shareBtn.innerHTML = `${WCPP_SVG.share}<span>Share Profile</span>`;
            shareBtn.addEventListener("click", () => {
                const shareUrl = window.location.href;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        shareBtn.innerHTML = `${WCPP_SVG.sparkles}<span>Link Copied!</span>`;
                        setTimeout(() => { shareBtn.innerHTML = `${WCPP_SVG.share}<span>Share Profile</span>`; }, 1800);
                    }).catch(() => {});
                }
            });
            actionsEl.appendChild(shareBtn);
        }
        if (actionsEl && !document.querySelector(".sp-glance-ribbon")) {
            const chips = [];
            if (lightVal) chips.push({ icon: WCPP_SVG.sun, label: "Sun Exposure", val: lightVal.replace(/;/g, " · ") });
            if (moistureVal) chips.push({ icon: WCPP_SVG.water, label: "Soil Moisture", val: moistureVal.replace(/;/g, " · ") });
            if (sizeVal) chips.push({ icon: WCPP_SVG.ruler, label: "Mature Size", val: sizeVal });
            if (flowerColorVal) {
                chips.push({
                    icon: WCPP_SVG.flower,
                    label: "Bloom / Spore",
                    val: `<span class="sp-bloom-swatch" style="background:${bloomHex}"></span><span>${flowerColorVal.replace(/;/g, " / ")}</span>`,
                    isHtml: true
                });
            }
            if (foliageVal) chips.push({ icon: WCPP_SVG.leaf, label: "Foliage", val: foliageVal });
            else if (droughtVal) chips.push({ icon: WCPP_SVG.shield, label: "Drought Tolerance", val: droughtVal });

            if (chips.length > 0) {
                const ribbon = document.createElement("div");
                ribbon.className = "sp-glance-ribbon";
                ribbon.setAttribute("aria-label", "Quick Ecological Summary");
                ribbon.innerHTML = chips.map(c => `
                    <div class="sp-glance-chip">
                        <span class="sp-glance-icon" aria-hidden="true">${c.icon}</span>
                        <div class="sp-glance-meta">
                            <div class="sp-glance-label">${c.label}</div>
                            <div class="sp-glance-val">${c.isHtml ? c.val : c.val.replace(/</g, "&lt;")}</div>
                        </div>
                    </div>
                `).join("");
                actionsEl.insertAdjacentElement("afterend", ribbon);
            }
        }

        // 3. Inject Sticky "Jump To" Sub-Navigation Bar (using clean SVG icons)
        const sectionDefs = [
            { id: "overview", icon: WCPP_SVG.book, label: "Overview" },
            { id: "quick-facts", icon: WCPP_SVG.calendar, label: "Bloom & Facts" },
            { id: "coast-salish", icon: WCPP_SVG.feather, label: "Coast Salish" },
            { id: "habitat", icon: WCPP_SVG.tree, label: "Habitat & Range" },
            { id: "garden", icon: WCPP_SVG.sprout, label: "Garden Design" },
            { id: "wildlife", icon: WCPP_SVG.butterfly, label: "Wildlife & Bees" },
            { id: "ethnobotany", icon: WCPP_SVG.scroll, label: "Ethnobotany" },
            { id: "you-might-like", icon: WCPP_SVG.sparkles, label: "Similar Plants" },
            { id: "references", icon: WCPP_SVG.library, label: "References" }
        ].filter(s => document.getElementById(s.id));

        if (sectionDefs.length >= 3 && !document.querySelector(".sp-jump-nav")) {
            const jumpNav = document.createElement("nav");
            jumpNav.className = "sp-jump-nav";
            jumpNav.setAttribute("aria-label", "Jump to profile section");
            jumpNav.innerHTML = sectionDefs.map((s, idx) =>
                `<a class="sp-jump-link${idx === 0 ? " active" : ""}" href="#${s.id}" data-jump-target="${s.id}">${s.icon}<span>${s.label}</span></a>`
            ).join("");

            const insertAnchor = document.querySelector(".sp-glance-ribbon") || actionsEl || hero;
            insertAnchor.insertAdjacentElement("afterend", jumpNav);

            jumpNav.addEventListener("click", (e) => {
                const link = e.target.closest(".sp-jump-link");
                if (!link) return;
                const targetId = link.getAttribute("data-jump-target");
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    e.preventDefault();
                    if (targetEl.classList.contains("is-collapsed")) {
                        targetEl.classList.remove("is-collapsed");
                        const btn = targetEl.querySelector(".sp-collapse-btn");
                        if (btn) btn.textContent = "Collapse ▴";
                    }
                    const offset = window.innerWidth >= 1080 ? 166 : 132;
                    const y = targetEl.getBoundingClientRect().top + window.scrollY - offset;
                    window.scrollTo({ top: y, behavior: "smooth" });
                }
            });

            if ("IntersectionObserver" in global) {
                const linksById = {};
                jumpNav.querySelectorAll(".sp-jump-link").forEach(a => {
                    linksById[a.getAttribute("data-jump-target")] = a;
                });
                const spy = new IntersectionObserver((entries) => {
                    entries.forEach(en => {
                        if (en.isIntersecting && linksById[en.target.id]) {
                            jumpNav.querySelectorAll(".sp-jump-link").forEach(a => a.classList.remove("active"));
                            linksById[en.target.id].classList.add("active");
                        }
                    });
                }, { rootMargin: "-18% 0px -70% 0px", threshold: 0 });
                sectionDefs.forEach(s => {
                    const el = document.getElementById(s.id);
                    if (el) spy.observe(el);
                });
            }
        }

        // 4. Inject 12-Month Visual Seasonal Bloom & Foliage Timeline Bar inside #quick-facts
        if (quickFactsCard && !quickFactsCard.querySelector(".sp-phenology-wrap")) {
            const bloomSet = parseBloomMonthIndices(bloomMonthsVal);
            const isEvergreen = /evergreen/i.test(foliageVal);
            const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const currentMonthIdx = new Date().getMonth();

            if (bloomSet.size > 0 || isEvergreen) {
                const pheno = document.createElement("div");
                pheno.className = "sp-phenology-wrap";
                const cellsHtml = monthLabels.map((m, idx) => {
                    const isBloom = bloomSet.has(idx);
                    const isNow = idx === currentMonthIdx;
                    const classes = [
                        "sp-pheno-month",
                        isBloom ? "is-bloom" : "",
                        isEvergreen ? "is-foliage" : "",
                        isNow ? "is-now" : ""
                    ].filter(Boolean).join(" ");
                    const icon = isBloom ? WCPP_SVG.flower : (isEvergreen ? WCPP_SVG.tree : "·");
                    return `<div class="${classes}" title="${m}${isBloom ? " – Active Bloom / Spore Period" : ""}${isNow ? " (Current Month)" : ""}"><span>${m}</span><span class="sp-pheno-dot">${icon}</span></div>`;
                }).join("");

                pheno.innerHTML = `
                    <div class="sp-pheno-header">
                        <span>${WCPP_SVG.calendar} Annual BC Seasonal Calendar ${bloomMonthsVal ? `(${bloomMonthsVal.replace(/;/g, ", ")})` : ""}</span>
                        <div class="sp-pheno-legend">
                            ${bloomSet.size > 0 ? `<span>${WCPP_SVG.flower} Bloom Period</span>` : ""}
                            ${isEvergreen ? `<span>${WCPP_SVG.tree} Evergreen Foliage</span>` : ""}
                            <span><span style="display:inline-block;width:9px;height:9px;border:2px solid #eab308;border-radius:2px;vertical-align:middle;margin-right:3px;"></span>Current Month (${monthLabels[currentMonthIdx]})</span>
                        </div>
                    </div>
                    <div class="sp-pheno-grid">${cellsHtml}</div>
                `;
                const h2 = quickFactsCard.querySelector("h2");
                if (h2) h2.insertAdjacentElement("afterend", pheno);
                else quickFactsCard.prepend(pheno);
            }
        }

        // 5. Convert semicolon attribute paragraphs into clean botanical pills
        upgradeSpeciesSemicolonListsToPills();

        // 6. Collapsible Deep-Dive Sections
        const collapsibleConfigs = [
            { id: "references", defaultCollapsed: true, labelCollapsed: "Show Citations ▾", labelExpanded: "Collapse ▴" },
            { id: "propagation", defaultCollapsed: false, labelCollapsed: "Expand ▾", labelExpanded: "Collapse ▴" },
            { id: "ethnobotany", defaultCollapsed: false, labelCollapsed: "Expand ▾", labelExpanded: "Collapse ▴" }
        ];
        collapsibleConfigs.forEach(cfg => {
            const card = document.getElementById(cfg.id);
            if (!card) return;
            const h2 = card.querySelector("h2");
            if (!h2 || h2.querySelector(".sp-collapse-btn")) return;

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sp-collapse-btn";
            if (cfg.defaultCollapsed) {
                card.classList.add("is-collapsed");
                btn.textContent = cfg.labelCollapsed;
            } else {
                btn.textContent = cfg.labelExpanded;
            }
            btn.addEventListener("click", () => {
                const collapsed = card.classList.toggle("is-collapsed");
                btn.textContent = collapsed ? cfg.labelCollapsed : cfg.labelExpanded;
            });
            h2.appendChild(btn);
        });

        // 7. Hydrate "You Might Also Like" (.sp-sim) Cards with Botanical Thumbnails
        const simCards = Array.from(document.querySelectorAll(".sp-sim-grid a.sp-sim"));
        if (simCards.length > 0) {
            const hydrateSimCard = (card) => {
                if (card.dataset.thumbHydrated) return;
                card.dataset.thumbHydrated = "1";
                const strong = card.querySelector("strong");
                const em = card.querySelector("em");
                const common = strong ? strong.textContent.trim() : "";
                const latin = em ? em.textContent.trim() : "";
                if (!common && !latin) return;

                const fallbackSvg = typeof global.generateBotanicalCardSVG === "function"
                    ? global.generateBotanicalCardSVG(latin, common)
                    : "";

                card.classList.add("sp-sim-media");
                const infoWrap = document.createElement("div");
                infoWrap.className = "sp-sim-info";
                while (card.firstChild) {
                    infoWrap.appendChild(card.firstChild);
                }

                const thumb = document.createElement("img");
                thumb.className = "sp-sim-thumb";
                thumb.alt = common || latin;
                thumb.loading = "lazy";
                thumb.src = fallbackSvg;
                thumb.onerror = function () {
                    this.onerror = null;
                    if (fallbackSvg) this.src = fallbackSvg;
                };

                card.appendChild(thumb);
                card.appendChild(infoWrap);

                if (typeof global.resolveSharedPlantPhoto === "function") {
                    global.resolveSharedPlantPhoto(latin, common, "", fallbackSvg).then(res => {
                        if (res && res.url) thumb.src = res.url;
                    }).catch(() => {});
                }
            };

            if ("IntersectionObserver" in global) {
                const simObserver = new IntersectionObserver((entries, obs) => {
                    entries.forEach(en => {
                        if (en.isIntersecting) {
                            hydrateSimCard(en.target);
                            obs.unobserve(en.target);
                        }
                    });
                }, { rootMargin: "240px 0px" });
                simCards.forEach(c => simObserver.observe(c));
            } else {
                simCards.forEach(hydrateSimCard);
            }
        }
    }

    function initFloraIndexQuickFilters() {
        const filterInput = document.getElementById("floraIndexFilter");
        const coreList = document.getElementById("floraCoreList");
        const filterBar = document.querySelector(".flora-filter-bar");
        if (!filterInput || !coreList || !filterBar) return;

        // 0. Unify & clarify directory copy (accurate native/introduced counts without artificial "212 Core Native" claim)
        const floraHeroP = document.querySelector(".flora-hero p");
        if (floraHeroP && /Core 212/i.test(floraHeroP.textContent || "")) {
            floraHeroP.textContent = "A unified British Columbia flora directory covering over 3,000 native species alongside introduced regional plants — starting with featured in-depth garden profiles followed by the complete A–Z index.";
        }
        const coreHeading = coreList.previousElementSibling;
        if (coreHeading && coreHeading.tagName === "H2" && /212/i.test(coreHeading.textContent || "")) {
            coreHeading.textContent = "Featured In-Depth Species Profiles";
        }

        // 1. Inject 3-Pillar Guided Journey Banner above filterBar
        if (!document.querySelector(".wcpp-journey-bar")) {
            const journey = document.createElement("div");
            journey.className = "wcpp-journey-bar";
            journey.innerHTML = `
                <div class="wcpp-journey-card">
                    <div>
                        <div class="wcpp-journey-title">${WCPP_SVG.sprout} 1. Discover &amp; Match</div>
                        <div class="wcpp-journey-links">
                            <a href="plant-quiz.html">Yard Match Quiz</a>
                            <a href="plant-planner.html">Visual Field Guide</a>
                        </div>
                    </div>
                </div>
                <div class="wcpp-journey-card">
                    <div>
                        <div class="wcpp-journey-title">${WCPP_SVG.calendar} 2. Plan &amp; Seasonal Care</div>
                        <div class="wcpp-journey-links">
                            <a href="this-week.html">This Week in BC</a>
                            <a href="calendar.html">Planting Calendar</a>
                            <a href="calculators.html">Calculators</a>
                        </div>
                    </div>
                </div>
                <div class="wcpp-journey-card">
                    <div>
                        <div class="wcpp-journey-title">${WCPP_SVG.pot} 3. Local Nursery &amp; Compare</div>
                        <div class="wcpp-journey-links">
                            <a href="orders.html">Live Nursery Stock</a>
                            <a href="nativeplants.html">Compare Plants</a>
                        </div>
                    </div>
                </div>
            `;
            filterBar.insertAdjacentElement("beforebegin", journey);
        }

        // 2. Inject Quick-Filter Category Pills with SVG icons
        if (document.querySelector(".flora-quick-pills")) return;

        const pillsWrap = document.createElement("div");
        pillsWrap.className = "flora-quick-pills";
        pillsWrap.setAttribute("aria-label", "Quick Category Filters");

        const categories = [
            { icon: WCPP_SVG.leaf, label: "All BC Flora", query: "" },
            { icon: WCPP_SVG.star, label: "Native Only", query: "Native" },
            { icon: WCPP_SVG.flower, label: "Rosaceae (Rose & Berry)", query: "Rosaceae" },
            { icon: WCPP_SVG.sun, label: "Asteraceae (Asters)", query: "Asteraceae" },
            { icon: WCPP_SVG.sprout, label: "Grasses & Sedges (Poaceae)", query: "Poaceae" },
            { icon: WCPP_SVG.flower, label: "Ericaceae (Heather & Salal)", query: "Ericaceae" },
            { icon: WCPP_SVG.tree, label: "Conifers (Pinaceae)", query: "Pinaceae" },
            { icon: WCPP_SVG.leaf, label: "Fabaceae (Lupines & Peas)", query: "Fabaceae" }
        ];

        pillsWrap.innerHTML = categories.map((cat, idx) =>
            `<button type="button" class="flora-pill-btn${idx === 0 ? " active" : ""}" data-filter-q="${cat.query}">${cat.icon}<span>${cat.label}</span></button>`
        ).join("");

        filterBar.insertAdjacentElement("afterend", pillsWrap);

        pillsWrap.addEventListener("click", (e) => {
            const btn = e.target.closest(".flora-pill-btn");
            if (!btn) return;
            pillsWrap.querySelectorAll(".flora-pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const q = btn.getAttribute("data-filter-q") || "";
            filterInput.value = q;
            filterInput.dispatchEvent(new Event("input", { bubbles: true }));
        });
    }

    function initHomepageAestheticEnhancements() {
        // 1. Add Quick-Action Botanical Buttons + Accurate Highlights Strip inside Homepage Hero Card
        const heroCard = document.querySelector(".hero-card");
        if (heroCard && !heroCard.querySelector(".hero-quick-ctas")) {
            const btnRow = heroCard.querySelector("div[style*='display:flex']");
            if (btnRow) {
                btnRow.className = "hero-quick-ctas";
                const linksHtml = `
                    <a class="hero-cta-pill" href="flora-index.html">${WCPP_SVG.leaf}<span>Explore BC Flora Directory</span></a>
                    <a class="hero-cta-pill" href="plant-quiz.html">${WCPP_SVG.sprout}<span>Find Plants for Your Yard</span></a>
                    <a class="hero-cta-pill ghost" href="orders.html">${WCPP_SVG.pot}<span>Local Nursery Plugs ($5)</span></a>
                `;
                btnRow.insertAdjacentHTML("afterbegin", linksHtml);
            }
        }
        if (heroCard && !heroCard.querySelector(".hero-stats-strip")) {
            const statsStrip = document.createElement("div");
            statsStrip.className = "hero-stats-strip";
            statsStrip.setAttribute("aria-label", "Project Highlights");
            statsStrip.innerHTML = `
                <div class="hero-stat-item"><span class="hero-stat-num">3,000+</span><span class="hero-stat-lbl">Native BC Flora Species</span></div>
                <div class="hero-stat-item"><span class="hero-stat-num">4,500+</span><span class="hero-stat-lbl">Total BC Flora Records</span></div>
                <div class="hero-stat-item"><span class="hero-stat-num">Coast Salish</span><span class="hero-stat-lbl">Plant Names &amp; Lore</span></div>
                <div class="hero-stat-item"><span class="hero-stat-num">Surrey, BC</span><span class="hero-stat-lbl">Free Seed Library &amp; Open Data</span></div>
            `;
            heroCard.appendChild(statsStrip);
        }

        // 1B. Transform Community Rules & Etiquette bullet list into 2x2 Icon-Card Grid
        document.querySelectorAll("details.info-accordion").forEach(acc => {
            const sum = acc.querySelector("summary");
            if (!sum || !/Community Rules/i.test(sum.textContent || "")) return;
            const ul = acc.querySelector("ul");
            if (!ul || acc.querySelector(".wcpp-rules-grid")) return;
            const items = Array.from(ul.querySelectorAll("li"));
            if (!items.length) return;
            const ruleIcons = [WCPP_SVG.heart, WCPP_SVG.sparkles, WCPP_SVG.lock, WCPP_SVG.gift];
            const grid = document.createElement("div");
            grid.className = "wcpp-rules-grid";
            grid.innerHTML = items.map((li, idx) => `
                <div class="wcpp-rule-card">
                    <span class="wcpp-rule-ico" aria-hidden="true">${ruleIcons[idx] || WCPP_SVG.leaf}</span>
                    <span>${li.textContent.trim().replace(/</g, "&lt;")}</span>
                </div>
            `).join("");
            ul.replaceWith(grid);
        });

        // 2. Add Warm, Plain-Language Category Badges & Clean Descriptions to the 12 Planning Tool Cards
        const toolMetaByHref = {
            "nativeplants.html": {
                cat: "Compare Plants",
                accent: "#166534",
                desc: "Compare Pacific Northwest plants side by side for sun, soil, wildlife value, and Coast Salish names."
            },
            "plant-planner.html": {
                cat: "Visual Field Guide",
                accent: "#166534",
                desc: "Browse visual plant cards by light, moisture, bloom season, canopy layer, and pollinator support."
            },
            "garden.html": { cat: "Veggie & Bed Planner", accent: "#0f766e" },
            "plant-quiz.html": { cat: "Yard Match Quiz", accent: "#15803d" },
            "this-week.html": { cat: "This Week in BC", accent: "#ca8a04" },
            "calendar.html": { cat: "Planting Calendar", accent: "#ca8a04" },
            "calculators.html": { cat: "Garden Calculators", accent: "#0f766e" },
            "bios.html": { cat: "Beneficial Insects", accent: "#0d9488" },
            "latin.html": { cat: "Botanical Latin", accent: "#166534" },
            "orders.html": { cat: "Local Nursery Pickup", accent: "#059669" },
            "updates.html": { cat: "What's New", accent: "#475569" },
            "support.html": { cat: "Community & Library", accent: "#059669" }
        };
        document.querySelectorAll(".tools-grid .tool-link-card").forEach(card => {
            const href = (card.getAttribute("href") || "").split("?")[0];
            const meta = toolMetaByHref[href];
            if (meta) {
                card.style.setProperty("--tool-accent", meta.accent);
                if (meta.desc) {
                    const descSpan = Array.from(card.children).find(el => el.tagName === "SPAN" && !el.classList.contains("tool-cat-badge"));
                    if (descSpan) descSpan.textContent = meta.desc;
                }
                if (!card.querySelector(".tool-cat-badge")) {
                    const badge = document.createElement("span");
                    badge.className = "tool-cat-badge";
                    badge.textContent = meta.cat;
                    card.prepend(badge);
                }
            }
        });

        // 2B. Upgrade Botanical Latin Converter Banner (.latin-banner) into Interactive 2-Column Specimen Split
        const latinBanner = document.querySelector(".latin-banner");
        if (latinBanner && !latinBanner.classList.contains("wcpp-latin-split")) {
            const h2 = latinBanner.querySelector("h2");
            const p = latinBanner.querySelector("p");
            const cta = latinBanner.querySelector("a");
            if (h2 && p && cta) {
                latinBanner.classList.add("wcpp-latin-split");
                const copyWrap = document.createElement("div");
                copyWrap.className = "wcpp-latin-copy";
                copyWrap.appendChild(h2);
                copyWrap.appendChild(p);
                copyWrap.appendChild(cta);

                const chipsWrap = document.createElement("div");
                chipsWrap.className = "wcpp-latin-chips";
                const examples = [
                    { latin: "chiloensis", meaning: "Pacific / coastal origin" },
                    { latin: "menziesii", meaning: "Honours Archibald Menzies" },
                    { latin: "macrophyllum", meaning: "Large-leaved (Bigleaf)" },
                    { latin: "sanguineum", meaning: "Blood-red blossoms" }
                ];
                chipsWrap.innerHTML = examples.map(ex =>
                    `<a class="wcpp-latin-chip" href="latin.html?q=${encodeURIComponent(ex.latin)}"><em>${ex.latin}</em><span>${ex.meaning} →</span></a>`
                ).join("");

                latinBanner.innerHTML = "";
                latinBanner.appendChild(copyWrap);
                latinBanner.appendChild(chipsWrap);
            }
        }

        // 3. Add One-Click Category Feed Pills above Homepage Resource Directory (#dirFeedSelect)
        const dirSelect = document.getElementById("dirFeedSelect");
        const dirControls = document.querySelector(".dir-controls");
        if (dirSelect && dirControls && !document.querySelector(".dir-feed-pills")) {
            const pills = document.createElement("div");
            pills.className = "dir-feed-pills";
            pills.setAttribute("aria-label", "Resource Category Tabs");
            const opts = Array.from(dirSelect.options);
            const icons = [WCPP_SVG.tree, WCPP_SVG.feather, WCPP_SVG.book, WCPP_SVG.butterfly];
            pills.innerHTML = opts.map((opt, idx) =>
                `<button type="button" class="dir-feed-pill${idx === dirSelect.selectedIndex ? " active" : ""}" data-feed-idx="${idx}">${icons[idx] || WCPP_SVG.leaf}<span>${opt.textContent}</span></button>`
            ).join("");
            dirControls.insertAdjacentElement("beforebegin", pills);

            pills.addEventListener("click", (e) => {
                const btn = e.target.closest(".dir-feed-pill");
                if (!btn) return;
                const idx = parseInt(btn.getAttribute("data-feed-idx"), 10);
                pills.querySelectorAll(".dir-feed-pill").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                if (dirSelect.selectedIndex !== idx) {
                    dirSelect.selectedIndex = idx;
                    dirSelect.dispatchEvent(new Event("change", { bubbles: true }));
                }
            });

            dirSelect.addEventListener("change", () => {
                pills.querySelectorAll(".dir-feed-pill").forEach((b, i) => {
                    b.classList.toggle("active", i === dirSelect.selectedIndex);
                });
            });
            dirControls.classList.add("has-feed-pills");
        }

        // 4. Upgrade Regional Guide Hub Cards with Custom Vector SVG Icon Badges
        const guideContainer = document.querySelector(".wcpp-guide-hubs");
        if (guideContainer) {
            const guideIcons = {
                "guide-shade-plants.html": WCPP_SVG.leaf,
                "guide-deer-resistant.html": WCPP_SVG.shield,
                "guide-rain-garden.html": WCPP_SVG.water,
                "guide-pollinators.html": WCPP_SVG.butterfly,
                "guide-drought-tolerant.html": WCPP_SVG.sun,
                "guide-edible-natives.html": WCPP_SVG.sprout
            };
            guideContainer.querySelectorAll("a[href^='guide-']").forEach(a => {
                if (a.dataset.guideUpgraded) return;
                a.dataset.guideUpgraded = "1";
                const href = (a.getAttribute("href") || "").split("?")[0];
                const ico = guideIcons[href] || WCPP_SVG.leaf;
                const inner = document.createElement("div");
                inner.className = "wcpp-guide-card-inner";
                const icoWrap = document.createElement("span");
                icoWrap.className = "wcpp-guide-ico";
                icoWrap.innerHTML = ico;
                const textWrap = document.createElement("div");
                textWrap.style.flex = "1";
                textWrap.style.minWidth = "0";
                while (a.firstChild) {
                    textWrap.appendChild(a.firstChild);
                }
                inner.appendChild(icoWrap);
                inner.appendChild(textWrap);
                a.appendChild(inner);
            });
        }

        // 5. Homepage Mini-Quiz Botanical Photo Reveal on Answer (#mqFeedback)
        const mqFb = document.getElementById("mqFeedback");
        if (mqFb && !mqFb.dataset.photoObserverBound && "MutationObserver" in global) {
            mqFb.dataset.photoObserverBound = "1";
            const decorateQuizFeedback = () => {
                if (mqFb.querySelector(".mq-fb-thumb-wrap")) return;
                const profileLink = mqFb.querySelector("a[href^='species-']");
                const pEl = mqFb.querySelector("p");
                if (!profileLink || !pEl) return;
                const href = profileLink.getAttribute("href") || "";
                const slug = href.replace(/^species-/, "").replace(/\.html.*$/, "");
                const sciGuess = slug.split("-").slice(0, 2).join(" ");
                const commonGuess = (profileLink.textContent || "").replace(/^Meet the\s+/i, "").trim();
                const fallbackSvg = typeof global.generateBotanicalCardSVG === "function"
                    ? global.generateBotanicalCardSVG(sciGuess, commonGuess)
                    : "";

                const mediaWrap = document.createElement("div");
                mediaWrap.className = "mq-fb-media";
                const thumbWrap = document.createElement("div");
                thumbWrap.className = "mq-fb-thumb-wrap";
                thumbWrap.innerHTML = `
                    <img src="${fallbackSvg}" alt="${commonGuess.replace(/"/g, "&quot;")}">
                    <span class="mq-fb-thumb-badge">Wikimedia Commons</span>
                `;
                pEl.parentNode.insertBefore(mediaWrap, pEl);
                mediaWrap.appendChild(thumbWrap);
                mediaWrap.appendChild(pEl);

                const imgEl = thumbWrap.querySelector("img");
                const badgeEl = thumbWrap.querySelector(".mq-fb-thumb-badge");
                if (typeof global.resolveSharedPlantPhoto === "function") {
                    global.resolveSharedPlantPhoto(sciGuess, commonGuess, "", fallbackSvg).then(res => {
                        if (res && res.url && imgEl) {
                            imgEl.src = res.url;
                            if (badgeEl) badgeEl.textContent = res.source || "Wikimedia Commons";
                        }
                    }).catch(() => {});
                }
            };
            const fbMo = new MutationObserver(decorateQuizFeedback);
            fbMo.observe(mqFb, { childList: true });
        }

        // 6. Homepage Directory Cards: Replace Repeated Generic Unsplash Stock Image with Bespoke Herbarium Archive Cards
        const dirList = document.getElementById("dirResourceList");
        if (dirList && !dirList.dataset.herbariumBound && "MutationObserver" in global) {
            dirList.dataset.herbariumBound = "1";
            const upgradeDirCards = () => {
                dirList.querySelectorAll(".dir-card").forEach(card => {
                    if (card.dataset.cardUpgraded) return;
                    card.dataset.cardUpgraded = "1";
                    const img = card.querySelector(".dir-img-container img");
                    const badge = card.querySelector(".dir-domain-badge");
                    const h3 = card.querySelector("h3");
                    if (!img) return;
                    const domain = badge ? badge.textContent.trim() : "Botanical Archive";
                    const title = h3 ? h3.textContent.trim() : "West Coast Resource";
                    if (typeof global.generateBotanicalCardSVG === "function") {
                        const bespokeSvg = global.generateBotanicalCardSVG(title.slice(0, 26), domain);
                        if ((img.getAttribute("src") || "").includes("photo-1416879598555")) {
                            img.src = bespokeSvg;
                        }
                        img.onerror = function () {
                            this.onerror = null;
                            this.src = bespokeSvg;
                        };
                    }
                });
            };
            upgradeDirCards();
            const dirMo = new MutationObserver(upgradeDirCards);
            dirMo.observe(dirList, { childList: true });
        }
    }

    const WCPP_WEATHER_SVGS = {
        sun: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
        moon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
        partly: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/></svg>`,
        cloud: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
        rain: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6M8 14v6M12 16v6"/></svg>`,
        snow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/></svg>`,
        storm: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>`
    };

    function upgradeWeatherIconToSVG() {
        const wEl = document.getElementById("weather-icon");
        if (!wEl || wEl.querySelector("svg")) return;
        const txt = (wEl.textContent || "").trim();
        const desc = ((document.getElementById("weather-desc") || {}).textContent || "").toLowerCase();
        let svg = WCPP_WEATHER_SVGS.partly;
        if (txt.includes("☀") || desc.includes("clear skies")) svg = WCPP_WEATHER_SVGS.sun;
        else if (txt.includes("🌙") || desc.includes("night")) svg = WCPP_WEATHER_SVGS.moon;
        else if (txt.includes("🌧") || txt.includes("🌦") || desc.includes("rain") || desc.includes("drizzle")) svg = WCPP_WEATHER_SVGS.rain;
        else if (txt.includes("❄") || desc.includes("snow")) svg = WCPP_WEATHER_SVGS.snow;
        else if (txt.includes("⛈") || desc.includes("thunder")) svg = WCPP_WEATHER_SVGS.storm;
        else if (txt.includes("☁") || txt.includes("🌫") || desc.includes("overcast") || desc.includes("fog")) svg = WCPP_WEATHER_SVGS.cloud;
        wEl.innerHTML = svg;
    }

    function initReadingProgressBar() {
        const isLongPage = document.querySelector(".sp-hero, #floraCoreList, .hero-card, .page-title-row, .orders-hero, .cal-hero, .calc-hero, .page-header-card, .updates-hero, .support-hero, .latin-hero");
        if (!isLongPage || document.querySelector(".wcpp-read-progress")) return;
        const bar = document.createElement("div");
        bar.className = "wcpp-read-progress";
        bar.setAttribute("aria-hidden", "true");
        document.body.appendChild(bar);
        let ticking = false;
        const update = () => {
            ticking = false;
            const docEl = document.documentElement;
            const max = Math.max(1, docEl.scrollHeight - window.innerHeight);
            const pct = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
            bar.style.width = pct.toFixed(1) + "%";
        };
        window.addEventListener("scroll", () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        }, { passive: true });
        update();
    }

    // =========================================================================
    // 11. PWA BACK/FORWARD NAV, PLANT PLANNER UX, MODAL PHOTO & COMPARE TABLE
    // =========================================================================
    function initAppHistoryNav() {
        const isStandaloneApp = Boolean(
            (global.matchMedia && (
                global.matchMedia("(display-mode: standalone)").matches ||
                global.matchMedia("(display-mode: window-controls-overlay)").matches ||
                global.matchMedia("(display-mode: minimal-ui)").matches
            )) || (global.navigator && global.navigator.standalone === true)
        );
        if (!isStandaloneApp) return;

        const inner = document.querySelector(".gh-header-inner");
        if (!inner || inner.querySelector(".wcpp-history-nav")) return;
        const brand = inner.querySelector(".gh-brand");
        if (!brand) return;

        const cluster = document.createElement("div");
        cluster.className = "wcpp-brand-cluster";

        const nav = document.createElement("div");
        nav.className = "wcpp-history-nav";
        nav.setAttribute("role", "group");
        nav.setAttribute("aria-label", "Page history navigation");
        nav.innerHTML = `
            <button type="button" class="wcpp-hist-btn" data-hist="back" aria-label="Go Back" title="Go Back (Alt+Left)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button type="button" class="wcpp-hist-btn" data-hist="forward" aria-label="Go Forward" title="Go Forward (Alt+Right)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
        `;

        nav.addEventListener("click", (e) => {
            const btn = e.target.closest(".wcpp-hist-btn");
            if (!btn) return;
            if (btn.getAttribute("data-hist") === "back") window.history.back();
            else window.history.forward();
        });

        brand.parentNode.insertBefore(cluster, brand);
        cluster.appendChild(nav);
        cluster.appendChild(brand);
    }

    function sortNavAndFooterAlphabetically() {
        const cleanSortKey = (el) => {
            const labelEl = el.querySelector("span:first-child") || el;
            return (labelEl.textContent || el.textContent || "")
                .replace(/^[\s•\-→↗\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]+/gu, "")
                .trim();
        };

        const sortLinksInContainer = (container, selector) => {
            if (!container) return;
            const links = Array.from(container.querySelectorAll(selector)).filter(a => !a.classList.contains("back-to-top"));
            if (links.length < 2) return;
            const sorted = links.slice().sort((a, b) =>
                cleanSortKey(a).localeCompare(cleanSortKey(b), "en", { sensitivity: "base" })
            );
            const alreadySorted = sorted.every((el, idx) => el === links[idx]);
            if (!alreadySorted) {
                sorted.forEach(el => container.appendChild(el));
            }
        };

        // 1. Desktop Navigation Dropdowns under each category (alphabetical + zero emojis: crisp editorial arrows only)
        document.querySelectorAll("#desktop-nav .dd-menu").forEach(menu => {
            sortLinksInContainer(menu, ":scope > a");
            menu.querySelectorAll("a > span:last-child").forEach(sp => {
                const t = (sp.textContent || "").trim();
                const isExternal = (sp.parentElement && /^(mailto:|https?:)/i.test(sp.parentElement.getAttribute("href") || ""));
                if (t !== "→" && t !== "↗") {
                    sp.textContent = isExternal ? "↗" : "→";
                }
            });
        });

        // 2. Mobile Navigation Drawer panels under each category
        document.querySelectorAll("#mobile-drawer .m-panel").forEach(panel => {
            sortLinksInContainer(panel, ":scope > a");
        });

        // 3. Footer Columns under each category heading (Plants & Tools, Project & Research, etc.)
        document.querySelectorAll(".footer-links .footer-col").forEach(col => {
            sortLinksInContainer(col, ":scope > a");
        });
    }

    function removeOpinionatedCoreIndexBlocks() {
        // Remove the opinionated/inaccurate "Complete 212 Core BC Native Plants Index" AND bulk copy-paste "Complete 1,372 Botanical Latin Roots & Epithets Glossary"
        document.querySelectorAll("h1, h2, h3, summary").forEach(heading => {
            const txt = (heading.textContent || "").trim();
            if (/Complete\s+1,372|Botanical Latin Roots\s*&\s*Epithets Glossary/i.test(txt)) {
                const container = heading.closest("details, section") || heading.parentElement;
                if (container && container.tagName !== "MAIN" && container.tagName !== "BODY") {
                    container.remove();
                }
                return;
            }
            if (/Complete\s+212\s+Core|Most Common to Less Common/i.test(txt)) {
                const container = heading.closest("section, details, .bloom-section, .sp-card") || heading.parentElement;
                if (container && container.tagName !== "MAIN" && container.tagName !== "BODY") {
                    container.style.display = "none";
                    container.setAttribute("aria-hidden", "true");
                }
            }
        });
        document.querySelectorAll("p").forEach(p => {
            const txt = (p.textContent || "").trim();
            if (/ordered from locally stocked & common regional flora to less common species/i.test(txt)) {
                const container = p.closest("section, details, .bloom-section") || p.parentElement;
                if (container && container.tagName !== "MAIN" && container.tagName !== "BODY") {
                    container.style.display = "none";
                    container.setAttribute("aria-hidden", "true");
                }
            }
        });
    }

    function initPlantPlannerEnhancements() {
        const isPlanner = Boolean(document.querySelector(".planner-hero") || document.getElementById("cardsGrid"));
        if (!isPlanner) return;

        document.body.classList.add("wcpp-unified-catalog");

        // 1. Add prominent vector search icon to search input wrapper
        const searchWrap = document.querySelector(".search-field-wrap");
        if (searchWrap) searchWrap.classList.add("has-search-ico");

        // 2. De-dweebify hero subtitle & make Side-by-Side Comparison CTA inviting & prominent
        const heroSub = document.querySelector(".planner-hero p");
        if (heroSub && /114 botanical/i.test(heroSub.textContent || "")) {
            heroSub.textContent = "Explore British Columbia's native plants, growing conditions, pollinators, and Coast Salish plant knowledge.";
        }

        const cleanMatrixHeroLink = () => {
            const link = document.getElementById("cardToMatrixLink");
            if (!link) return;
            const raw = (link.textContent || "").trim();
            const selMatch = raw.match(/\((\d+)\s+selected\)/i);
            const desiredText = selMatch
                ? `Compare ${selMatch[1]} Selected Plants →`
                : "Compare Plants Side-by-Side →";
            if (!link.dataset.lastClean || raw !== link.dataset.lastClean) {
                link.dataset.lastClean = desiredText;
                link.innerHTML = `${WCPP_SVG.chart}<span>${desiredText}</span>`;
            }
        };
        cleanMatrixHeroLink();

        // 3. Simplify to 1 Dropdown Option for BC Native Plants + 1 Dropdown Option for All BC Flora
        const originFacet = document.getElementById("facet-origin-bc");
        if (originFacet) {
            const originBlock = originFacet.closest(".facet-block");
            if (originBlock) originBlock.classList.add("facet-block-origin-hidden");
        }

        const dsSelect = document.getElementById("datasetSelect");
        if (dsSelect && !dsSelect.dataset.wcppUnified) {
            dsSelect.dataset.wcppUnified = "1";
            Array.from(dsSelect.options).forEach(opt => {
                if (opt.value === "core212") opt.textContent = "BC Native Plants";
                else if (opt.value === "master4590") opt.textContent = "All BC Flora (Native & Introduced)";
            });

            dsSelect.addEventListener("change", () => {
                const targetOrigin = dsSelect.value === "core212" ? "native" : "all";
                setTimeout(() => {
                    const radio = document.querySelector(`#facet-origin-bc input[data-origin-bc="${targetOrigin}"]`);
                    if (radio && !radio.checked) {
                        radio.checked = true;
                        radio.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                }, 350);
            });
        }

        const enforceNativeDefaultForNativeCatalog = () => {
            if (!dsSelect || dsSelect.value !== "core212") return;
            const urlOrigin = new URLSearchParams(window.location.search).get("origin");
            if (urlOrigin === "introduced") return;
            const nativeRadio = document.querySelector('#facet-origin-bc input[data-origin-bc="native"]');
            if (nativeRadio && !nativeRadio.checked) {
                nativeRadio.checked = true;
                nativeRadio.dispatchEvent(new Event("change", { bubbles: true }));
            }
        };

        // Hide redundant "Origin: BC Native Only" filter chip when BC Native Plants catalog is selected
        const cleanActiveChips = () => {
            const bar = document.getElementById("activeFilterChips");
            if (!bar || !dsSelect) return;
            bar.querySelectorAll(".chip, button").forEach(chip => {
                if (dsSelect.value === "core212" && /Origin:\s*BC Native/i.test(chip.textContent || "")) {
                    chip.style.display = "none";
                }
            });
        };

        // 4. Clean up noisy "Showing 210 of 212 species (204 BC Native • 6 Introduced / Non-Native)" counter
        const cleanResultCount = () => {
            const countEl = document.getElementById("resultCount");
            if (!countEl) return;
            const raw = (countEl.textContent || "").trim();
            if (!raw || raw.startsWith("Loading")) return;
            const m = raw.match(/Showing\s+([\d,]+)\s+of\s+([\d,]+)\s+species/i);
            if (!m) return;
            const shownNum = m[1];
            const totalNum = m[2];
            const isNativeCatalog = dsSelect && dsSelect.value === "core212";
            const shownInt = parseInt(shownNum.replace(/,/g, ""), 10);
            const totalInt = parseInt(totalNum.replace(/,/g, ""), 10);
            const isFiltered = isNativeCatalog ? (shownInt < 200) : (shownInt < totalInt);
            const cleanText = isNativeCatalog
                ? (isFiltered ? `Showing ${shownNum} matching BC Native Plants` : `Showing ${shownNum} BC Native Plants`)
                : (isFiltered ? `Showing ${shownNum} matching BC Flora Species` : `Showing ${shownNum} BC Flora Species`);
            if (countEl.textContent !== cleanText) {
                countEl.textContent = cleanText;
            }
        };

        // 5. De-dweebify card buttons ("Details & 5 Tabs" -> "Full Plant Guide")
        const cleanCardButtons = () => {
            document.querySelectorAll("#cardsGrid .open-modal-btn").forEach(btn => {
                if (/Details\s*&\s*5\s*Tabs/i.test(btn.textContent || "")) {
                    btn.textContent = "Full Plant Guide";
                }
            });
        };

        // 6. Complete Responsive Upgrade + Live Wikimedia Commons Photo in #plantDetailModal
        let lastModalPlantKey = "";
        const upgradePlantDetailModal = () => {
            const modal = document.getElementById("plantDetailModal");
            if (!modal || modal.hidden) return;
            const header = modal.querySelector(".modal-header");
            const commonEl = document.getElementById("modalCommonName");
            const latinEl = document.getElementById("modalLatinAuth");
            if (!header || !commonEl) return;

            const common = (commonEl.textContent || "").trim();
            const latinEm = latinEl ? (latinEl.querySelector("em") || latinEl) : null;
            const latin = (latinEm ? latinEm.textContent : "").trim();
            const plantKey = `${common}|${latin}`;

            // Clean up "Compare in 4-Slot Matrix →" and add Full Species Page link inside modal footer
            const extActions = document.getElementById("modalExternalActions");
            if (extActions) {
                extActions.querySelectorAll("a").forEach(a => {
                    if (/Compare in 4-Slot Matrix/i.test(a.textContent || "")) {
                        a.textContent = "Compare Side-by-Side →";
                    }
                });
                const compareLink = extActions.querySelector("a[href*='nativeplants.html?p1=']");
                if (compareLink && !extActions.querySelector(".wcpp-modal-species-link")) {
                    const p1Match = (compareLink.getAttribute("href") || "").match(/p1=([^&]+)/);
                    if (p1Match && (!dsSelect || dsSelect.value === "core212")) {
                        const slug = decodeURIComponent(p1Match[1]);
                        const spLink = document.createElement("a");
                        spLink.className = "btn btn-secondary wcpp-modal-species-link";
                        spLink.href = `species-${slug}.html`;
                        spLink.textContent = "Full Species Page →";
                        compareLink.insertAdjacentElement("afterend", spLink);
                    }
                }
            }

            if (plantKey === lastModalPlantKey && header.querySelector(".wcpp-modal-photo-wrap")) return;
            lastModalPlantKey = plantKey;

            const dialog = modal.querySelector(".modal-dialog");
            if (dialog) dialog.scrollTop = 0;

            // Label the two pill rows inside Overview tab (Garden Uses vs Key Ecological Traits)
            const overviewTab = document.getElementById("tab-overview");
            if (overviewTab) {
                overviewTab.querySelectorAll(".meta-pills-row").forEach(row => {
                    const prev = row.previousElementSibling;
                    if (prev && prev.classList.contains("wcpp-modal-pill-label")) return;
                    const isTraits = Boolean(row.querySelector(".meta-tag.accent"));
                    const lbl = document.createElement("div");
                    lbl.className = "wcpp-modal-pill-label";
                    lbl.textContent = isTraits ? "Key Ecological Traits" : "Garden Uses & Placement";
                    row.insertAdjacentElement("beforebegin", lbl);
                });
            }

            let photoWrap = header.querySelector(".wcpp-modal-photo-wrap");
            if (!photoWrap) {
                photoWrap = document.createElement("div");
                photoWrap.className = "wcpp-modal-photo-wrap";
                photoWrap.innerHTML = `<img src="" alt=""><span class="wcpp-modal-photo-badge">Wikimedia Commons</span>`;
                header.prepend(photoWrap);
            }

            const imgEl = photoWrap.querySelector("img");
            const badgeEl = photoWrap.querySelector(".wcpp-modal-photo-badge");
            const fallbackSvg = typeof global.generateBotanicalCardSVG === "function"
                ? global.generateBotanicalCardSVG(latin, common)
                : "";
            imgEl.alt = common || latin;
            imgEl.src = fallbackSvg;
            badgeEl.textContent = "Locating photo...";
            imgEl.onerror = function () {
                this.onerror = null;
                if (fallbackSvg) this.src = fallbackSvg;
                badgeEl.textContent = "Botanical Card";
            };

            if (typeof global.resolveSharedPlantPhoto === "function") {
                global.resolveSharedPlantPhoto(latin, common, "", fallbackSvg).then(res => {
                    if (lastModalPlantKey !== plantKey) return;
                    if (res && res.url) {
                        imgEl.src = res.url;
                        badgeEl.textContent = res.source || "Wikimedia Commons";
                    } else {
                        badgeEl.textContent = "Botanical Card";
                    }
                }).catch(() => {
                    if (lastModalPlantKey === plantKey) badgeEl.textContent = "Botanical Card";
                });
            }
        };

        // 7. Complete Redesign of Compare Table (.comparison-matrix)
        const upgradeComparisonTable = () => {
            const wrap = document.getElementById("comparisonTableWrap");
            if (!wrap || wrap.hidden) return;

            wrap.querySelectorAll("a.btn-primary").forEach(a => {
                if (/Compare Selected in 114-Col Matrix/i.test(a.textContent || "")) {
                    a.textContent = "Compare Selected Plants →";
                }
            });

            const rows = wrap.querySelectorAll(".comparison-matrix tbody tr");
            rows.forEach(tr => {
                if (tr.dataset.tblUpgraded) return;
                tr.dataset.tblUpgraded = "1";
                const tds = tr.querySelectorAll("td");
                if (tds.length < 7) return;

                // Col 1: Species thumbnail + name wrapper
                const td0 = tds[0];
                const btn = td0.querySelector(".open-modal-btn");
                if (btn && !td0.querySelector(".wcpp-tbl-thumb")) {
                    const common = (btn.querySelector("strong") || {}).textContent || "";
                    const latin = (btn.querySelector("em") || {}).textContent || "";
                    const fallbackSvg = typeof global.generateBotanicalCardSVG === "function"
                        ? global.generateBotanicalCardSVG(latin, common)
                        : "";
                    const speciesRow = document.createElement("div");
                    speciesRow.className = "wcpp-tbl-species";
                    const thumb = document.createElement("img");
                    thumb.className = "wcpp-tbl-thumb";
                    thumb.alt = common || latin;
                    thumb.loading = "lazy";
                    thumb.src = fallbackSvg;
                    thumb.onerror = function () { this.onerror = null; if (fallbackSvg) this.src = fallbackSvg; };

                    const metaDiv = document.createElement("div");
                    metaDiv.style.minWidth = "0";
                    while (td0.firstChild) metaDiv.appendChild(td0.firstChild);
                    speciesRow.appendChild(thumb);
                    speciesRow.appendChild(metaDiv);
                    td0.appendChild(speciesRow);

                    if (typeof global.resolveSharedPlantPhoto === "function") {
                        global.resolveSharedPlantPhoto(latin, common, "", fallbackSvg).then(res => {
                            if (res && res.url) thumb.src = res.url;
                        }).catch(() => {});
                    }
                }

                // Col 5: Clamp verbose insect/pollinator text cleanly to 3 lines
                const td4 = tds[4];
                if (td4 && !td4.querySelector(".wcpp-tbl-clamp")) {
                    const clampDiv = document.createElement("div");
                    clampDiv.className = "wcpp-tbl-clamp";
                    clampDiv.title = td4.textContent.trim();
                    clampDiv.innerHTML = td4.innerHTML;
                    td4.innerHTML = "";
                    td4.appendChild(clampDiv);
                }

                // Col 6: Format Bloom Months as compact emerald pills
                const td5 = tds[5];
                const rawBloom = (td5.textContent || "").trim();
                if (rawBloom && rawBloom !== "—") {
                    const months = rawBloom.split(/[•,;]+/).map(s => s.trim()).filter(Boolean);
                    if (months.length) {
                        td5.innerHTML = `<div class="wcpp-tbl-bloom-pills">${months.map(m => `<span class="wcpp-tbl-bloom-pill">${m.replace(/</g, "&lt;")}</span>`).join("")}</div>`;
                    }
                }

                // Col 7: Style Lep. Hosts count as crisp pill badge
                const td6 = tds[6];
                const rawHosts = (td6.textContent || "").trim();
                if (/^\d+$/.test(rawHosts)) {
                    td6.style.textAlign = "center";
                    td6.innerHTML = `<span class="wcpp-tbl-host-pill">${rawHosts}</span>`;
                }
            });
        };

        // Run initial pass + surgical zero-thrash observers on planner containers
        const runPlannerSync = () => {
            enforceNativeDefaultForNativeCatalog();
            cleanMatrixHeroLink();
            cleanResultCount();
            cleanActiveChips();
            cleanCardButtons();
            upgradePlantDetailModal();
            upgradeComparisonTable();
            upgradePageEmojisToSVG(document.querySelector(".planner-hero") || document);
            upgradePageEmojisToSVG(document.querySelector(".toolbar-card") || document);
        };

        runPlannerSync();
        setTimeout(runPlannerSync, 450);
        setTimeout(runPlannerSync, 1400);

        if ("MutationObserver" in global) {
            const modalEl = document.getElementById("plantDetailModal");
            if (modalEl && !modalEl.dataset.wcppModalMo) {
                modalEl.dataset.wcppModalMo = "1";
                new MutationObserver(() => {
                    setTimeout(() => {
                        upgradePlantDetailModal();
                        upgradePageEmojisToSVG(modalEl);
                    }, 15);
                }).observe(modalEl, { attributes: true, attributeFilter: ["hidden"] });
                const modalTitleEl = document.getElementById("modalCommonName");
                if (modalTitleEl) {
                    new MutationObserver(() => {
                        setTimeout(() => {
                            upgradePlantDetailModal();
                            upgradePageEmojisToSVG(modalEl);
                        }, 15);
                    }).observe(modalTitleEl, { childList: true });
                }
            }

            const cardsGrid = document.getElementById("cardsGrid");
            if (cardsGrid && !cardsGrid.dataset.wcppCardsMo) {
                cardsGrid.dataset.wcppCardsMo = "1";
                new MutationObserver(() => {
                    cleanCardButtons();
                    cleanResultCount();
                    cleanActiveChips();
                    cleanMatrixHeroLink();
                    upgradePageEmojisToSVG(cardsGrid);
                }).observe(cardsGrid, { childList: true });
            }

            const tableWrap = document.getElementById("comparisonTableWrap");
            if (tableWrap && !tableWrap.dataset.wcppTblMo) {
                tableWrap.dataset.wcppTblMo = "1";
                new MutationObserver(() => {
                    upgradeComparisonTable();
                    cleanResultCount();
                    cleanMatrixHeroLink();
                    upgradePageEmojisToSVG(tableWrap);
                }).observe(tableWrap, { childList: true });
            }

            const resultCountEl = document.getElementById("resultCount");
            if (resultCountEl && !resultCountEl.dataset.wcppCntMo) {
                resultCountEl.dataset.wcppCntMo = "1";
                new MutationObserver(cleanResultCount).observe(resultCountEl, { childList: true });
            }

            const originBoxEl = document.getElementById("facet-origin-bc");
            if (originBoxEl && !originBoxEl.dataset.wcppOrigMo) {
                originBoxEl.dataset.wcppOrigMo = "1";
                new MutationObserver(() => {
                    setTimeout(enforceNativeDefaultForNativeCatalog, 40);
                }).observe(originBoxEl, { childList: true });
            }
        }
    }

    // =========================================================================
    // 12. SITE-WIDE SECONDARY PAGES POLISH (NATIVEPLANTS, GARDEN, ORDERS,
    //     CALENDAR, CALCULATORS, BIOS, ARTICLES, SUPPORT & UPDATES)
    // =========================================================================
    function initSecondaryPagesEnhancements() {
        // 1. nativeplants.html: Full overhaul — hide partial species count badge, add editorial subtitle, remove 114-column jargon & upgrade icons
        const cardExpLink = document.getElementById("nativeToCardExplorerLink");
        const isNativePlanner = Boolean(cardExpLink || document.getElementById("bloomCalendarCard"));
        if (isNativePlanner) {
            document.body.classList.add("wcpp-native-planner");
            if (cardExpLink && /5-Tab|Card Explorer/i.test(cardExpLink.textContent || "")) {
                cardExpLink.innerHTML = `${WCPP_SVG.leaf}<span>Visual Field Guide →</span>`;
            }

            // Inject clean editorial subtitle under h1 inside .page-title-row hero
            const titleRow = document.querySelector(".page-title-row");
            const titleH1 = titleRow ? titleRow.querySelector("h1") : null;
            if (titleRow && titleH1 && !titleRow.querySelector(".wcpp-np-hero-sub")) {
                const sub = document.createElement("p");
                sub.className = "wcpp-np-hero-sub";
                sub.textContent = "Compare Pacific Northwest native plants side by side across sun, soil, bloom overlap, pollinators, and Coast Salish names.";
                titleH1.insertAdjacentElement("afterend", sub);
            }

            // Completely hide & clear arbitrary partial species count badge ("206 / 212 Native Species")
            const npCountBadge = document.getElementById("plant-count-badge");
            if (npCountBadge) {
                const suppressBadge = () => {
                    npCountBadge.style.display = "none";
                    npCountBadge.setAttribute("aria-hidden", "true");
                    if (npCountBadge.textContent) npCountBadge.textContent = "";
                };
                suppressBadge();
                if ("MutationObserver" in global && !npCountBadge.dataset.wcppCntMo) {
                    npCountBadge.dataset.wcppCntMo = "1";
                    new MutationObserver(suppressBadge).observe(npCountBadge, { childList: true });
                }
            }

            // Clean "114 attributes" / "114-Col" / "114-column" jargon
            const rowSearch = document.getElementById("rowSearchInput");
            if (rowSearch && /114/i.test(rowSearch.placeholder || "")) {
                rowSearch.placeholder = "Filter traits & details (e.g., 'salish', 'soil', 'butterfly', 'seed')...";
            }
            const curLabel = document.querySelector("#nativeCuratorStrip .curator-toolbar-label");
            if (curLabel && /114-Col/i.test(curLabel.textContent || "")) {
                curLabel.innerHTML = `${WCPP_SVG.sparkles}<span>Curator Tools</span>`;
            }
            const compatEl = document.getElementById("compatibility");
            if (compatEl && /114-column/i.test(compatEl.textContent || "")) {
                compatEl.textContent = compatEl.textContent.replace(/114-column\s+/i, "");
            }

            // Observe Bloom Calendar summary so month slider updates keep crisp SVG icons
            const simBox = document.getElementById("simSummaryBox");
            if (simBox && !simBox.dataset.wcppSimMo && "MutationObserver" in global) {
                simBox.dataset.wcppSimMo = "1";
                upgradePageEmojisToSVG(simBox);
                new MutationObserver(() => upgradePageEmojisToSVG(simBox)).observe(simBox, { childList: true, subtree: true });
            }
        }
        if (!document.getElementById("cardsGrid")) {
            const npDatasetSel = document.getElementById("datasetSelect");
            if (npDatasetSel) {
                Array.from(npDatasetSel.options).forEach(opt => {
                    if (opt.value === "core212") opt.textContent = "BC Native Plants";
                    else if (opt.value === "master4590") opt.textContent = "All BC Flora (Native & Introduced)";
                });
            }
        }

        // 2. bios.html: Promote top plain .card heading into signature Pacific Northwest Forest Hero
        const biosH1 = document.querySelector("main .card h1");
        if (biosH1 && /Antagonists|PGPR|Pest Control/i.test(biosH1.textContent || "")) {
            const topCard = biosH1.closest(".card");
            if (topCard) topCard.classList.add("wcpp-bios-hero");
        }

        // 3. articles.html: Complete Editorial Do-Over — clean green hero, elevated filter panel, collapsible topics & journal cards
        const artHeader = document.querySelector(".page-header-card");
        const artFeedSel = document.getElementById("feedSelect");
        const artGrid = document.getElementById("resourceList");
        const artSearchContainer = artHeader ? artHeader.querySelector(".search-container") : null;
        const artTagsContainer = document.getElementById("tagsContainer");

        if (artHeader && artFeedSel && artGrid && !document.querySelector(".wcpp-art-controls")) {
            const controlsPanel = document.createElement("section");
            controlsPanel.className = "wcpp-art-controls";
            controlsPanel.setAttribute("aria-label", "Filter and Search Resources");

            // 3A. Clean Category Pill Tabs (concise labels + crisp vector icons)
            const pills = document.createElement("div");
            pills.className = "dir-feed-pills";
            pills.setAttribute("aria-label", "Article Category Tabs");

            const iconForKey = (key, label) => {
                const k = (key || label || "").toLowerCase();
                if (k === "all" || k.includes("all categories")) return WCPP_SVG.sparkles;
                if (k.includes("ecosystem")) return WCPP_SVG.tree;
                if (k.includes("first_nations") || k.includes("first nations")) return WCPP_SVG.feather;
                if (k.includes("plant_science") || k.includes("plant science")) return WCPP_SVG.book;
                if (k.includes("bees") || k.includes("insect")) return WCPP_SVG.butterfly;
                return WCPP_SVG.leaf;
            };
            const conciseLabel = (key, raw) => {
                if (key === "all" || /^All Categories/i.test(raw)) return "All Resources";
                if (key === "ecosystem") return "Ecosystems";
                if (key === "first_nations") return "First Nations";
                if (key === "plant_science") return "Plant Science";
                if (key === "bees_insects") return "Bees & Insects";
                return raw;
            };

            const renderFeedPills = () => {
                const opts = Array.from(artFeedSel.options);
                pills.innerHTML = opts.map((opt, idx) => {
                    const key = opt.getAttribute("data-feed-key") || "";
                    const lbl = conciseLabel(key, (opt.textContent || "").trim());
                    return `<button type="button" class="dir-feed-pill${idx === artFeedSel.selectedIndex ? " active" : ""}" data-feed-idx="${idx}">${iconForKey(key, lbl)}<span>${lbl.replace(/</g, "&lt;")}</span></button>`;
                }).join("");
            };
            renderFeedPills();

            pills.addEventListener("click", (e) => {
                const btn = e.target.closest(".dir-feed-pill");
                if (!btn) return;
                const idx = parseInt(btn.getAttribute("data-feed-idx"), 10);
                pills.querySelectorAll(".dir-feed-pill").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                if (artFeedSel.selectedIndex !== idx) {
                    artFeedSel.selectedIndex = idx;
                    artFeedSel.dispatchEvent(new Event("change", { bubbles: true }));
                }
            });
            global.addEventListener("wcpp:article-categories-changed", () => setTimeout(renderFeedPills, 60));
            global.addEventListener("wcpp:articles-ready", () => setTimeout(renderFeedPills, 60));

            controlsPanel.appendChild(pills);

            // 3B. Move .search-container OUT of green hero into white herbarium card + add Cards/List switcher
            if (artSearchContainer) {
                artFeedSel.style.display = "none";
                const viewToggle = document.createElement("div");
                viewToggle.className = "wcpp-art-view-toggle";
                viewToggle.setAttribute("role", "group");
                viewToggle.setAttribute("aria-label", "Layout View");
                viewToggle.innerHTML = `
                    <button type="button" class="wcpp-art-view-btn active" data-art-view="grid">${WCPP_SVG.grid}<span>Cards</span></button>
                    <button type="button" class="wcpp-art-view-btn" data-art-view="list">${WCPP_SVG.list}<span>List</span></button>
                `;
                viewToggle.addEventListener("click", (e) => {
                    const btn = e.target.closest(".wcpp-art-view-btn");
                    if (!btn) return;
                    const mode = btn.getAttribute("data-art-view");
                    viewToggle.querySelectorAll(".wcpp-art-view-btn").forEach(b => b.classList.toggle("active", b === btn));
                    artGrid.classList.toggle("wcpp-art-list-view", mode === "list");
                });
                artSearchContainer.appendChild(viewToggle);
                controlsPanel.appendChild(artSearchContainer);
            }

            // 3C. Smart Popular Topics Bar + Collapsible Searchable All-Topics Drawer (fixes 786 white bubbles on green)
            let popularSlots = null;
            let topicsToggleBtn = null;
            let topicsDrawer = null;
            let topicFilterInput = null;
            if (artTagsContainer) {
                const topicsWrap = document.createElement("div");
                topicsWrap.className = "wcpp-art-topics-wrap";

                const topicsBar = document.createElement("div");
                topicsBar.className = "wcpp-art-topics-bar";
                topicsBar.innerHTML = `<span class="wcpp-art-topics-label">Popular Topics</span>`;

                popularSlots = document.createElement("span");
                popularSlots.style.display = "contents";
                topicsBar.appendChild(popularSlots);

                topicsToggleBtn = document.createElement("button");
                topicsToggleBtn.type = "button";
                topicsToggleBtn.className = "wcpp-art-topics-toggle";
                topicsToggleBtn.setAttribute("aria-expanded", "false");
                topicsToggleBtn.textContent = "Browse All Topics ▾";
                topicsBar.appendChild(topicsToggleBtn);

                topicsDrawer = document.createElement("div");
                topicsDrawer.className = "wcpp-art-topics-drawer";

                topicFilterInput = document.createElement("input");
                topicFilterInput.type = "search";
                topicFilterInput.className = "wcpp-art-topic-filter-input";
                topicFilterInput.placeholder = "Filter topic tags by keyword...";
                topicFilterInput.setAttribute("aria-label", "Filter topic tags");
                topicFilterInput.addEventListener("input", () => {
                    const q = (topicFilterInput.value || "").trim().toLowerCase();
                    artTagsContainer.querySelectorAll(".filter-tag").forEach(btn => {
                        const match = !q || (btn.textContent || "").toLowerCase().includes(q);
                        btn.style.display = match ? "" : "none";
                    });
                });

                topicsToggleBtn.addEventListener("click", () => {
                    const isOpen = topicsDrawer.classList.toggle("open");
                    topicsToggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
                    const cnt = artTagsContainer.querySelectorAll(".filter-tag").length;
                    topicsToggleBtn.textContent = isOpen
                        ? `Hide Topics ▴`
                        : (cnt ? `Browse All Topics (${cnt}) ▾` : `Browse All Topics ▾`);
                    if (isOpen && topicFilterInput) topicFilterInput.focus();
                });

                topicsDrawer.appendChild(topicFilterInput);
                topicsDrawer.appendChild(artTagsContainer);
                topicsWrap.appendChild(topicsBar);
                topicsWrap.appendChild(topicsDrawer);
                controlsPanel.appendChild(topicsWrap);
            }

            artHeader.insertAdjacentElement("afterend", controlsPanel);
            upgradePageEmojisToSVG(controlsPanel);

            // Sync Popular Topics bar from active articles & #tagsContainer
            const syncPopularTopics = () => {
                if (!popularSlots || !artTagsContainer) return;
                const allTagBtns = Array.from(artTagsContainer.querySelectorAll(".filter-tag"));
                if (topicsToggleBtn && !topicsDrawer.classList.contains("open")) {
                    topicsToggleBtn.textContent = allTagBtns.length
                        ? `Browse All Topics (${allTagBtns.length}) ▾`
                        : "Browse All Topics ▾";
                }

                // Count tag frequency from visible cards to surface genuinely popular topics
                const freq = new Map();
                artGrid.querySelectorAll(".card .card-tag:not(.wcpp-art-cat-pill)").forEach(t => {
                    const name = (t.textContent || "").trim().replace(/^#/, "").toLowerCase();
                    if (name && !/^\+\d+$/.test(name)) {
                        freq.set(name, (freq.get(name) || 0) + 1);
                    }
                });

                const activeNames = new Set();
                allTagBtns.forEach(b => {
                    if (b.classList.contains("active")) {
                        activeNames.add((b.textContent || "").trim().replace(/^#/, "").toLowerCase());
                    }
                });

                const ranked = Array.from(freq.entries())
                    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                    .map(e => e[0]);

                const picks = [];
                activeNames.forEach(n => { if (!picks.includes(n)) picks.push(n); });
                for (let i = 0; i < ranked.length && picks.length < 8; i++) {
                    if (!picks.includes(ranked[i])) picks.push(ranked[i]);
                }

                popularSlots.innerHTML = "";
                picks.forEach(tagName => {
                    const chip = document.createElement("button");
                    chip.type = "button";
                    chip.className = "wcpp-art-top-chip" + (activeNames.has(tagName) ? " active" : "");
                    chip.textContent = `#${tagName}`;
                    chip.addEventListener("click", () => {
                        const targetBtn = allTagBtns.find(b => (b.textContent || "").trim().replace(/^#/, "").toLowerCase() === tagName);
                        if (targetBtn) targetBtn.click();
                    });
                    popularSlots.appendChild(chip);
                });

                const origClear = document.getElementById("clearFiltersBtn");
                if (origClear && !origClear.classList.contains("hidden")) {
                    const clearChip = document.createElement("button");
                    clearChip.type = "button";
                    clearChip.className = "tag-btn clear-btn";
                    clearChip.style.padding = "4px 11px";
                    clearChip.style.fontSize = "0.76rem";
                    clearChip.textContent = "Clear All ✕";
                    clearChip.addEventListener("click", () => origClear.click());
                    popularSlots.appendChild(clearChip);
                }
            };

            // 3D. Upgrade all .card cards in #resourceList (preserve genuine images, switch Unsplash fallback/broken to clean Editorial Card)
            const upgradeArtCards = () => {
                artGrid.querySelectorAll(".card").forEach(card => {
                    if (card.dataset.cardUpgraded) return;
                    card.dataset.cardUpgraded = "1";

                    const content = card.querySelector(".card-content");
                    const img = card.querySelector(".img-container img");
                    const domEl = card.querySelector(".domain-badge");
                    const domain = domEl ? domEl.textContent.trim() : "Resource";

                    // Identify category badge & clamp excess tags cleanly to first 4
                    const tagsWrap = card.querySelector(".card-tags");
                    let catSlug = "ecosystem";
                    if (tagsWrap) {
                        const tags = Array.from(tagsWrap.querySelectorAll(".card-tag"));
                        let regularCount = 0;
                        let hiddenCount = 0;
                        tags.forEach(t => {
                            const txt = (t.textContent || "").trim();
                            if (!txt.startsWith("#")) {
                                t.classList.add("wcpp-art-cat-pill");
                                t.removeAttribute("style");
                                const low = txt.toLowerCase();
                                if (low.includes("first nations")) catSlug = "first_nations";
                                else if (low.includes("plant science")) catSlug = "plant_science";
                                else if (low.includes("bee") || low.includes("insect")) catSlug = "bees_insects";
                            } else {
                                regularCount += 1;
                                if (regularCount > 4) {
                                    t.classList.add("wcpp-tag-overflow-hidden");
                                    hiddenCount += 1;
                                }
                            }
                        });
                        if (hiddenCount > 0) {
                            const moreBtn = document.createElement("span");
                            moreBtn.className = "card-tag";
                            moreBtn.textContent = `+${hiddenCount}`;
                            moreBtn.title = "Show all topics";
                            moreBtn.addEventListener("click", (e) => {
                                e.stopPropagation();
                                tagsWrap.querySelectorAll(".wcpp-tag-overflow-hidden").forEach(el => el.classList.remove("wcpp-tag-overflow-hidden"));
                                moreBtn.remove();
                            });
                            tagsWrap.appendChild(moreBtn);
                        }
                    }
                    card.setAttribute("data-art-cat", catSlug);

                    const promoteToEditorial = () => {
                        if (card.classList.contains("wcpp-art-editorial")) return;
                        card.classList.add("wcpp-art-editorial");
                        if (content && !content.querySelector(".wcpp-art-eyebrow")) {
                            const eyebrow = document.createElement("div");
                            eyebrow.className = "wcpp-art-eyebrow";
                            eyebrow.innerHTML = `<span class="wcpp-art-domain-pill">${WCPP_SVG.globe}<span>${domain.replace(/</g, "&lt;")}</span></span>`;
                            content.prepend(eyebrow);
                        }
                    };

                    if (!img || (img.getAttribute("src") || "").includes("photo-1416879598555")) {
                        promoteToEditorial();
                    } else {
                        img.removeAttribute("onerror");
                        img.addEventListener("error", promoteToEditorial, { once: true });
                    }
                });
                syncPopularTopics();
            };

            upgradeArtCards();
            if ("MutationObserver" in global) {
                new MutationObserver(upgradeArtCards).observe(artGrid, { childList: true });
                if (artTagsContainer) {
                    new MutationObserver(() => setTimeout(syncPopularTopics, 30)).observe(artTagsContainer, { childList: true });
                }
            }
        }

        // 4. Clean leading magnifying-glass emoji from all search input placeholders across pages (incl. #calcSearch)
        document.querySelectorAll("input[placeholder]").forEach(inp => {
            if (inp.placeholder && /^\s*🔍\s*/.test(inp.placeholder)) {
                inp.placeholder = inp.placeholder.replace(/^\s*🔍\s*/, "");
            }
        });

        // 5. Clean leftover "114-column" / "114-Col" / "5-Tab" copy on secondary pages (calendar, bios, support)
        document.querySelectorAll("a, button").forEach(el => {
            if (el.children.length > 1) return;
            const txt = el.textContent || "";
            if (/114-Col\w* Matrix/i.test(txt)) {
                el.textContent = txt.replace(/114-Col\w* Matrix/i, "Compare Plants");
            } else if (/5-Tab Explorer/i.test(txt)) {
                el.textContent = txt.replace(/5-Tab Explorer/i, "Visual Field Guide");
            }
        });

        // 6. Site-wide AI Image Purge: Strip ALL AI-generated images (images/og-*, orders.html hero, seed-library.html hero & tool banners)
        document.querySelectorAll("img[src*='images/og-'], .orders-hero img, .orders-hero figure, .sl-hero img, .sl-hero figure, .hero-card img[src*='images/'], .cal-hero img[src*='images/'], .calc-hero img[src*='images/'], .planner-hero img[src*='images/'], .support-hero img[src*='images/']").forEach(el => {
            const parent = el.parentElement;
            el.remove();
            if (parent && parent !== document.body && parent.tagName === "DIV" && !parent.children.length && !(parent.textContent || "").trim()) {
                parent.remove();
            }
        });

        const ordersCatalog = document.getElementById("liveCatalogGrid") || document.getElementById("catalogGrid");
        if (ordersCatalog && !ordersCatalog.dataset.wcppOrdMo && "MutationObserver" in global) {
            ordersCatalog.dataset.wcppOrdMo = "1";
            upgradePageEmojisToSVG(ordersCatalog);
            new MutationObserver(() => upgradePageEmojisToSVG(ordersCatalog)).observe(ordersCatalog, { childList: true });
        }

        // Observe dynamic calendar & updates sections so rendered badges/headings get clean vector SVG icons
        ["nowColumns", "calLiveWeatherBanner", "updatesTableBody"].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.dataset.wcppEcoMo && "MutationObserver" in global) {
                el.dataset.wcppEcoMo = "1";
                upgradePageEmojisToSVG(el);
                new MutationObserver(() => upgradePageEmojisToSVG(el)).observe(el, { childList: true });
            }
        });

        // Observe TomSelect dropdowns on nativeplants.html / garden.html so host-pill butterfly icons render as clean SVGs
        document.querySelectorAll(".ts-dropdown-content").forEach(dd => {
            if (!dd.dataset.wcppTsMo && "MutationObserver" in global) {
                dd.dataset.wcppTsMo = "1";
                new MutationObserver(() => upgradePageEmojisToSVG(dd)).observe(dd, { childList: true });
            }
        });
    }

    // =========================================================================
    // 13. INTERACTIVE BOTANICAL LATIN STUDIO (latin.html)
    //     Honest Dynamic Counts, Paste-Any-Plant Auto-Decoder, Live BC Plant
    //     Cross-Links, Thematic 6-Card Sampler & Customizable Flashcard Quiz
    // =========================================================================
    function initBotanicalLatinStudio() {
        const widget = document.getElementById("botanical-decoder-widget");
        if (!widget || widget.dataset.wcppStudioReady) return;
        widget.dataset.wcppStudioReady = "1";

        const latinBody = widget.querySelector(".latin-body");
        const heroInner = widget.querySelector(".latin-hero-inner");
        const searchGrid = widget.querySelector(".latin-search-grid");
        const toolbar = widget.querySelector(".latin-toolbar");
        const resultContainer = document.getElementById("result-container");
        const emptyState = document.getElementById("empty-state");
        const favSection = document.getElementById("favorites-section");
        const search1 = document.getElementById("search1");
        const search2 = document.getElementById("search2");
        const dropdown1 = document.getElementById("dropdown1");
        const dropdown2 = document.getElementById("dropdown2");
        if (!latinBody || !searchGrid) return;

        const esc = (s) => String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

        let latinEntries = []; // [{ word, meaning, norm, isPrefix, isSuffix }]
        let entryByNorm = new Map();
        let bcPlants = []; // [{ common, latin, slug }]

        // 1. Honest Live Stats Row in Hero (counts ONLY written, non-empty definitions)
        let statsRow = null;
        if (heroInner && !heroInner.querySelector(".wcpp-latin-stats-row")) {
            statsRow = document.createElement("div");
            statsRow.className = "wcpp-latin-stats-row";
            heroInner.appendChild(statsRow);
        }

        const renderHonestStats = () => {
            if (!statsRow || !latinEntries.length) return;
            const total = latinEntries.length;
            const prefixes = latinEntries.filter(e => e.isPrefix).length;
            const suffixes = latinEntries.filter(e => e.isSuffix).length;
            const stems = total - prefixes - suffixes;
            statsRow.innerHTML = `
                <span class="wcpp-latin-stat-pill">${WCPP_SVG.book}<strong>${total.toLocaleString()}</strong> Written Definitions</span>
                <span class="wcpp-latin-stat-pill"><strong>${prefixes.toLocaleString()}</strong> Prefixes</span>
                <span class="wcpp-latin-stat-pill"><strong>${suffixes.toLocaleString()}</strong> Suffixes</span>
                <span class="wcpp-latin-stat-pill"><strong>${stems.toLocaleString()}</strong> Roots &amp; Epithets</span>
            `;
            const badge = document.getElementById("term-count-badge");
            if (badge) {
                badge.textContent = `${total.toLocaleString()} verified definitions`;
            }
        };

        // 2. Build 3-Tab Studio Shell inside .latin-body (preserving ALL native controls & listeners!)
        const tabsBar = document.createElement("div");
        tabsBar.className = "wcpp-latin-tabs";
        tabsBar.setAttribute("role", "tablist");
        tabsBar.innerHTML = `
            <button type="button" class="wcpp-latin-tab active" role="tab" aria-selected="true" data-studio-tab="decode">${WCPP_SVG.search}<span>Decode &amp; Combine</span></button>
            <button type="button" class="wcpp-latin-tab" role="tab" aria-selected="false" data-studio-tab="themes">${WCPP_SVG.leaf}<span>Explore Themes</span></button>
            <button type="button" class="wcpp-latin-tab" role="tab" aria-selected="false" data-studio-tab="quiz">${WCPP_SVG.sparkles}<span>Flashcard Quiz</span></button>
        `;

        const decodePanel = document.createElement("div");
        decodePanel.className = "wcpp-latin-panel active";
        decodePanel.dataset.studioPanel = "decode";

        const themesPanel = document.createElement("div");
        themesPanel.className = "wcpp-latin-panel";
        themesPanel.dataset.studioPanel = "themes";

        const quizPanel = document.createElement("div");
        quizPanel.className = "wcpp-latin-panel";
        quizPanel.dataset.studioPanel = "quiz";

        // Insert tabsBar right after #latinQueryBanner (or top of .latin-body)
        const queryBanner = document.getElementById("latinQueryBanner");
        if (queryBanner) queryBanner.insertAdjacentElement("afterend", tabsBar);
        else latinBody.prepend(tabsBar);

        tabsBar.insertAdjacentElement("afterend", decodePanel);
        decodePanel.insertAdjacentElement("afterend", themesPanel);
        themesPanel.insertAdjacentElement("afterend", quizPanel);

        // 3. Smart Full-Name Auto-Decoder Card (top of Decode panel)
        const autoCard = document.createElement("div");
        autoCard.className = "wcpp-latin-auto-card";
        autoCard.innerHTML = `
            <div class="wcpp-latin-auto-head">
                <div class="wcpp-latin-auto-title">${WCPP_SVG.sparkles}<span>Full Scientific Name Auto-Decoder</span></div>
                <span class="wcpp-latin-auto-sub">Splits binomials &amp; compound words automatically</span>
            </div>
            <div class="wcpp-latin-auto-row">
                <input type="text" id="wcppAutoLatinInput" class="wcpp-latin-auto-input" placeholder="Paste any plant name (e.g. Acer macrophyllum, Ribes sanguineum, Pseudotsuga menziesii)..." autocomplete="off">
                <button type="button" id="wcppAutoDecodeBtn" class="wcpp-latin-btn-primary">${WCPP_SVG.search}<span>Decode Name</span></button>
                <button type="button" id="wcppAutoRandomBtn" class="wcpp-latin-btn-soft" title="Decode a random BC native species">${WCPP_SVG.dice}<span>Random BC Plant</span></button>
            </div>
            <div class="wcpp-latin-specimens-wrap" id="wcppLatinSpecimenChips">
                <span class="wcpp-latin-spec-label">Try a BC Native:</span>
                <button type="button" class="wcpp-latin-spec-chip" data-name="Acer macrophyllum"><em>Acer macrophyllum</em> <span>Bigleaf Maple</span></button>
                <button type="button" class="wcpp-latin-spec-chip" data-name="Achillea millefolium"><em>Achillea millefolium</em> <span>Common Yarrow</span></button>
                <button type="button" class="wcpp-latin-spec-chip" data-name="Ribes sanguineum"><em>Ribes sanguineum</em> <span>Red Currant</span></button>
                <button type="button" class="wcpp-latin-spec-chip" data-name="Pseudotsuga menziesii"><em>Pseudotsuga menziesii</em> <span>Douglas-fir</span></button>
                <button type="button" class="wcpp-latin-spec-chip" data-name="Rosa nutkana"><em>Rosa nutkana</em> <span>Nootka Rose</span></button>
                <button type="button" class="wcpp-latin-spec-chip" data-name="Polystichum munitum"><em>Polystichum munitum</em> <span>Sword Fern</span></button>
            </div>
            <div id="wcppAutoBreakdownBox" class="wcpp-latin-breakdown hidden"></div>
        `;
        decodePanel.appendChild(autoCard);

        // Move native combiner controls inside decodePanel (preserves every event listener!)
        [searchGrid, toolbar, resultContainer, emptyState].forEach(el => {
            if (el) decodePanel.appendChild(el);
        });

        // Add "Surprise Root" button next to Swap Terms
        if (toolbar && !toolbar.querySelector("#wcppSurpriseRootBtn")) {
            const surpBtn = document.createElement("button");
            surpBtn.type = "button";
            surpBtn.id = "wcppSurpriseRootBtn";
            surpBtn.className = "latin-btn-secondary";
            surpBtn.innerHTML = `${WCPP_SVG.dice}<span>Surprise Root</span>`;
            toolbar.appendChild(surpBtn);
            surpBtn.addEventListener("click", () => {
                if (!latinEntries.length) return;
                const pick = latinEntries[Math.floor(Math.random() * latinEntries.length)];
                selectNativeTerm(pick.word, 1);
            });
        }

        // 4. Live "BC Native Plants Sharing This Root" Shelf (inside decodePanel)
        const plantShelf = document.createElement("div");
        plantShelf.id = "wcppLatinPlantsShelf";
        plantShelf.className = "wcpp-latin-plants-shelf hidden";
        decodePanel.appendChild(plantShelf);

        // Move Saved Favorites below tabs so it stays accessible
        if (favSection) {
            quizPanel.insertAdjacentElement("afterend", favSection);
            const favHeader = favSection.querySelector(".latin-fav-header");
            if (favHeader && !favHeader.querySelector("#wcppFavStudyToggle")) {
                const studyBtn = document.createElement("button");
                studyBtn.type = "button";
                studyBtn.id = "wcppFavStudyToggle";
                studyBtn.className = "wcpp-latin-btn-soft";
                studyBtn.style.padding = "5px 12px";
                studyBtn.style.fontSize = "0.76rem";
                studyBtn.innerHTML = `${WCPP_SVG.book}<span>Study Mode: Off</span>`;
                studyBtn.addEventListener("click", () => {
                    const on = favSection.classList.toggle("wcpp-fav-study-mode");
                    studyBtn.innerHTML = `${WCPP_SVG.book}<span>Study Mode: ${on ? "On (Hover/Tap to Reveal)" : "Off"}</span>`;
                });
                favHeader.appendChild(studyBtn);
            }
        }

        // Helper: Select a key cleanly inside latin.html's existing search1 / search2 combiner
        const selectNativeTerm = (wordKey, slotNum) => {
            const inp = slotNum === 2 ? search2 : search1;
            const dd = slotNum === 2 ? dropdown2 : dropdown1;
            if (!inp || !dd) return;
            inp.value = wordKey;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            setTimeout(() => {
                const items = Array.from(dd.querySelectorAll("li[data-key]"));
                const exact = items.find(li => (li.getAttribute("data-key") || "").toLowerCase() === wordKey.toLowerCase()) || items[0];
                if (exact) exact.click();
                updateMatchingPlantsShelf([wordKey]);
            }, 30);
        };

        const switchStudioTab = (tabName) => {
            tabsBar.querySelectorAll(".wcpp-latin-tab").forEach(btn => {
                const isAct = btn.getAttribute("data-studio-tab") === tabName;
                btn.classList.toggle("active", isAct);
                btn.setAttribute("aria-selected", isAct ? "true" : "false");
            });
            [decodePanel, themesPanel, quizPanel].forEach(p => {
                p.classList.toggle("active", p.dataset.studioPanel === tabName);
            });
            if (tabName === "themes" && !themesPanel.dataset.rendered) {
                renderThemesPanel();
            }
            if (tabName === "quiz" && !quizPanel.dataset.rendered) {
                renderQuizPanel();
            }
        };

        tabsBar.addEventListener("click", (e) => {
            const btn = e.target.closest(".wcpp-latin-tab");
            if (!btn) return;
            switchStudioTab(btn.getAttribute("data-studio-tab"));
        });

        // 5. Morphological Lookup & Compound Splitter Engine
        const normWord = (w) => String(w || "").toLowerCase().replace(/[^a-z]/g, "");

        const lookupTokenFlexible = (rawTok) => {
            const clean = normWord(rawTok);
            if (!clean || clean.length < 2) return null;

            // Pass 1: Direct exact match in verified lexicon
            if (entryByNorm.has(clean)) return { type: "exact", parts: [entryByNorm.get(clean)] };

            // Pass 2: Strict botanical gender / inflectional ending normalization (never strip compound stems)
            const endingSwaps = [
                ["um", ["us", "a", "is", "e"]],
                ["us", ["um", "a", "is", "e"]],
                ["a", ["us", "um", "is", "e", "ae"]],
                ["is", ["e", "us", "a", "um"]],
                ["e", ["is", "us", "a", "um"]],
                ["ii", ["i", "ia", "ius"]],
                ["i", ["ii", "us", "a", "um"]],
                ["ae", ["a", "us", "um"]],
                ["ense", ["ensis"]],
                ["ensis", ["ense"]]
            ];
            for (let i = 0; i < endingSwaps.length; i++) {
                const [fromEnd, toList] = endingSwaps[i];
                if (clean.endsWith(fromEnd) && clean.length - fromEnd.length >= 3) {
                    const stem = clean.slice(0, -fromEnd.length);
                    for (let j = 0; j < toList.length; j++) {
                        const cand = stem + toList[j];
                        if (entryByNorm.has(cand) && !entryByNorm.get(cand).isSuffix) {
                            return { type: "declension", parts: [entryByNorm.get(cand)] };
                        }
                    }
                }
            }

            // Pass 3: Strictly valid compound word splitter (left is NOT a suffix, right is NOT a prefix, zero false guesses)
            if (clean.length >= 6) {
                for (let cut = clean.length - 3; cut >= 3; cut--) {
                    const leftRaw = clean.slice(0, cut);
                    const rightRaw = clean.slice(cut);

                    const leftCandidates = [leftRaw];
                    if ((leftRaw.endsWith("o") || leftRaw.endsWith("i")) && leftRaw.length >= 4) {
                        const base = leftRaw.slice(0, -1);
                        leftCandidates.push(base, base + "us", base + "a", base + "um", base + "is");
                    } else {
                        leftCandidates.push(leftRaw + "o", leftRaw + "i");
                    }

                    let leftEntry = null;
                    for (let l = 0; l < leftCandidates.length; l++) {
                        const cand = entryByNorm.get(leftCandidates[l]);
                        if (cand && !cand.isSuffix) {
                            leftEntry = cand;
                            break;
                        }
                    }
                    if (!leftEntry) continue;

                    const rightCandidates = [rightRaw];
                    if (rightRaw.endsWith("um")) rightCandidates.push(rightRaw.slice(0, -2) + "us", rightRaw.slice(0, -2) + "a");
                    else if (rightRaw.endsWith("a")) rightCandidates.push(rightRaw.slice(0, -1) + "us", rightRaw.slice(0, -1) + "um");
                    else if (rightRaw.endsWith("us")) rightCandidates.push(rightRaw.slice(0, -2) + "a", rightRaw.slice(0, -2) + "um");
                    else if (rightRaw.endsWith("is")) rightCandidates.push(rightRaw.slice(0, -2) + "e", rightRaw.slice(0, -2) + "us", rightRaw.slice(0, -2) + "a");
                    else if (rightRaw.endsWith("e")) rightCandidates.push(rightRaw.slice(0, -1) + "is");

                    let rightEntry = null;
                    for (let r = 0; r < rightCandidates.length; r++) {
                        const cand = entryByNorm.get(rightCandidates[r]);
                        if (cand && !cand.isPrefix) {
                            rightEntry = cand;
                            break;
                        }
                    }
                    if (rightEntry) {
                        // Guard against false geographic/resemblance splits (e.g. chiloensis != -chilus + -ensis)
                        if ((rightEntry.word === "-ensis" || rightEntry.word === "-oides") && !entryByNorm.has(leftRaw)) {
                            continue;
                        }
                        return { type: "compound", parts: [leftEntry, rightEntry] };
                    }
                }
            }

            return null;
        };

        const autoInput = document.getElementById("wcppAutoLatinInput");
        const autoBtn = document.getElementById("wcppAutoDecodeBtn");
        const autoRandBtn = document.getElementById("wcppAutoRandomBtn");
        const breakdownBox = document.getElementById("wcppAutoBreakdownBox");

        const runAutoDecode = (rawInput) => {
            const text = String(rawInput || "").trim();
            if (!text || !breakdownBox) return;
            if (autoInput) autoInput.value = text;

            const skipTokens = new Set(["ssp", "subsp", "var", "f", "x", "sp", "spp", "cv"]);
            const tokens = text.replace(/[(),.;]/g, " ").split(/\s+/).filter(t => t && !skipTokens.has(t.toLowerCase()));
            if (!tokens.length) return;

            const decodedTokens = tokens.map(tok => ({
                token: tok,
                match: lookupTokenFlexible(tok)
            }));

            // Check if exact species exists in our BC Native Plant Guide
            const cleanFull = text.toLowerCase().replace(/\s+/g, " ").trim();
            const exactPlant = bcPlants.find(p => p.latin && cleanFull.includes(p.latin.toLowerCase().split(" ").slice(0, 2).join(" ")));

            const partsHtml = decodedTokens.map((dt, idx) => {
                const roleLabel = idx === 0 && decodedTokens.length > 1 ? "Genus" : (idx === 1 ? "Specific Epithet" : "Botanical Term");
                if (dt.match && dt.match.parts.length) {
                    const pills = dt.match.parts.map(p =>
                        `<button type="button" class="wcpp-latin-morph-pill" data-pick-root="${esc(p.word)}" title="Load into combiner">${esc(p.word)}</button>`
                    ).join(`<span style="color:var(--wcpp-muted);font-weight:800;align-self:center;">+</span>`);
                    const combinedMeaning = dt.match.parts.map(p => p.meaning).join(" + ");
                    return `
                        <div class="wcpp-latin-part-card">
                            <span class="wcpp-latin-part-token">${roleLabel}: ${esc(dt.token)}</span>
                            <div class="wcpp-latin-part-morphemes">${pills}</div>
                            <div class="wcpp-latin-part-meaning">${esc(combinedMeaning)}</div>
                        </div>
                    `;
                }
                return `
                    <div class="wcpp-latin-part-card">
                        <span class="wcpp-latin-part-token">${roleLabel}: ${esc(dt.token)}</span>
                        <div class="wcpp-latin-part-meaning" style="color:var(--wcpp-muted);font-style:italic;">Not yet in root lexicon — try searching a related stem below.</div>
                    </div>
                `;
            }).join("");

            const plantLinkHtml = exactPlant && exactPlant.slug
                ? `<a href="species-${encodeURIComponent(exactPlant.slug)}.html" class="wcpp-latin-btn-soft" style="text-decoration:none;padding:5px 11px;font-size:0.76rem;">${WCPP_SVG.leaf}<span>${esc(exactPlant.common)} Profile →</span></a>`
                : "";

            const etymNoteHtml = exactPlant && exactPlant.etymology
                ? `<div style="margin-top:11px;padding:10px 13px;border-radius:11px;background:rgba(22,101,52,0.06);border-left:3px solid var(--primary-color,#166534);font-size:0.83rem;line-height:1.5;color:var(--wcpp-text,#1e293b);"><strong>Etymology Note (${esc(exactPlant.common)}):</strong> ${esc(exactPlant.etymology)}</div>`
                : "";

            breakdownBox.innerHTML = `
                <div class="wcpp-latin-bd-header">
                    <span class="wcpp-latin-bd-name">${esc(text)}</span>
                    <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;">
                        ${plantLinkHtml}
                        <button type="button" class="wcpp-latin-btn-soft" id="wcppCopyAutoBreakdown" style="padding:5px 11px;font-size:0.76rem;">Copy Breakdown</button>
                    </div>
                </div>
                <div class="wcpp-latin-bd-parts">${partsHtml}</div>
                ${etymNoteHtml}
            `;
            breakdownBox.classList.remove("hidden");

            breakdownBox.querySelectorAll("[data-pick-root]").forEach(btn => {
                btn.addEventListener("click", () => {
                    selectNativeTerm(btn.getAttribute("data-pick-root"), 1);
                });
            });

            const copyBtn = document.getElementById("wcppCopyAutoBreakdown");
            if (copyBtn) {
                copyBtn.addEventListener("click", () => {
                    const summary = decodedTokens.map(dt => {
                        if (dt.match && dt.match.parts.length) {
                            return `${dt.token} (${dt.match.parts.map(p => `${p.word}: ${p.meaning}`).join(" + ")})`;
                        }
                        return dt.token;
                    }).join(" | ");
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(`${text} — ${summary}`).then(() => {
                            copyBtn.textContent = "✓ Copied!";
                            setTimeout(() => { copyBtn.textContent = "Copy Breakdown"; }, 1800);
                        }).catch(() => {});
                    }
                });
            }

            // Also gather matched stems to power the "BC Native Plants Sharing This Root" shelf
            const matchedRoots = [];
            decodedTokens.forEach(dt => {
                if (dt.match && dt.match.parts) dt.match.parts.forEach(p => matchedRoots.push(p.word));
                else matchedRoots.push(dt.token);
            });
            updateMatchingPlantsShelf(matchedRoots);
        };

        if (autoBtn && autoInput) {
            autoBtn.addEventListener("click", () => runAutoDecode(autoInput.value));
            autoInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    runAutoDecode(autoInput.value);
                }
            });
        }

        if (autoRandBtn) {
            autoRandBtn.addEventListener("click", () => {
                if (bcPlants.length) {
                    const p = bcPlants[Math.floor(Math.random() * bcPlants.length)];
                    runAutoDecode(p.latin);
                } else {
                    const samples = ["Acer macrophyllum", "Ribes sanguineum", "Pseudotsuga menziesii", "Rosa nutkana", "Fragaria chiloensis", "Gaultheria shallon", "Polystichum munitum", "Thuja plicata"];
                    runAutoDecode(samples[Math.floor(Math.random() * samples.length)]);
                }
            });
        }

        const specWrap = document.getElementById("wcppLatinSpecimenChips");
        if (specWrap) {
            specWrap.addEventListener("click", (e) => {
                const chip = e.target.closest(".wcpp-latin-spec-chip");
                if (!chip) return;
                runAutoDecode(chip.getAttribute("data-name"));
            });
        }

        // 6. Live "BC Native Plants Sharing This Root" Shelf (with real Wikimedia Commons thumbnails!)
        const updateMatchingPlantsShelf = (rootList) => {
            if (!bcPlants.length || !rootList || !rootList.length) {
                plantShelf.classList.add("hidden");
                return;
            }
            const cleanRoots = rootList
                .map(r => normWord(r))
                .filter(r => r.length >= 4);
            if (!cleanRoots.length) {
                plantShelf.classList.add("hidden");
                return;
            }

            const matched = [];
            const seen = new Set();
            for (let i = 0; i < bcPlants.length; i++) {
                const p = bcPlants[i];
                const latNorm = (p.latin || "").toLowerCase();
                const hit = cleanRoots.some(r => {
                    const stem = r.length > 5 && /(us|um|is|ae|ii)$/.test(r) ? r.slice(0, -2) : (r.length > 4 && /[aei]$/.test(r) ? r.slice(0, -1) : r);
                    return stem.length >= 4 && latNorm.includes(stem);
                });
                if (hit && !seen.has(p.slug)) {
                    seen.add(p.slug);
                    matched.push(p);
                }
            }

            if (!matched.length) {
                plantShelf.classList.add("hidden");
                return;
            }

            const shown = matched.slice(0, 8);
            const labelRoots = rootList.slice(0, 2).map(r => esc(r)).join(" / ");
            plantShelf.innerHTML = `
                <div class="wcpp-latin-shelf-head">
                    <h3>BC Native Plants Using “${labelRoots}”</h3>
                    <span style="font-size:0.78rem;font-weight:800;color:var(--wcpp-muted);">${matched.length} matching ${matched.length === 1 ? "species" : "species"} in our guide</span>
                </div>
                <div class="wcpp-latin-shelf-grid">
                    ${shown.map(p => {
                        const fallbackSvg = typeof global.generateBotanicalCardSVG === "function"
                            ? global.generateBotanicalCardSVG(p.latin, p.common)
                            : "";
                        return `
                            <a href="species-${encodeURIComponent(p.slug)}.html" class="wcpp-latin-plant-link" data-shelf-latin="${esc(p.latin)}" data-shelf-common="${esc(p.common)}">
                                <img class="wcpp-latin-plant-thumb" src="${esc(fallbackSvg)}" alt="${esc(p.common)}" loading="lazy">
                                <div class="wcpp-latin-plant-meta">
                                    <div class="wcpp-latin-plant-common">${esc(p.common)}</div>
                                    <div class="wcpp-latin-plant-latin">${esc(p.latin)}</div>
                                </div>
                            </a>
                        `;
                    }).join("")}
                </div>
            `;
            plantShelf.classList.remove("hidden");

            // Hydrate real Wikimedia Commons thumbnails cleanly
            if (typeof global.resolveSharedPlantPhoto === "function") {
                plantShelf.querySelectorAll(".wcpp-latin-plant-link").forEach(a => {
                    const img = a.querySelector("img");
                    const lat = a.getAttribute("data-shelf-latin");
                    const com = a.getAttribute("data-shelf-common");
                    const fallback = img ? img.src : "";
                    global.resolveSharedPlantPhoto(lat, com, "", fallback).then(res => {
                        if (res && res.url && img) img.src = res.url;
                    }).catch(() => {});
                });
            }
        };

        // Sync shelf whenever existing Term 1 / Term 2 combiner changes
        const syncShelfFromCombiner = () => {
            const t1El = document.getElementById("display-term1");
            const t2El = document.getElementById("display-term2");
            const active = [];
            if (t1El && !t1El.classList.contains("hidden") && t1El.textContent.trim()) active.push(t1El.textContent.trim());
            if (t2El && !t2El.classList.contains("hidden") && t2El.textContent.trim()) active.push(t2El.textContent.trim());
            if (active.length) updateMatchingPlantsShelf(active);
        };

        if ("MutationObserver" in global) {
            ["display-term1", "display-term2"].forEach(id => {
                const el = document.getElementById(id);
                if (el) new MutationObserver(syncShelfFromCombiner).observe(el, { childList: true, attributes: true, attributeFilter: ["class"] });
            });

            // Honest 120-item dropdown cap notice
            [dropdown1, dropdown2].forEach(dd => {
                if (!dd) return;
                new MutationObserver(() => {
                    if (dd.querySelector(".wcpp-dd-cap-note")) return;
                    const count = dd.querySelectorAll("li[data-key]").length;
                    if (count >= 120 && latinEntries.length > 120) {
                        const note = document.createElement("li");
                        note.className = "wcpp-dd-cap-note";
                        note.textContent = `Showing top 120 matches — keep typing to search all ${latinEntries.length.toLocaleString()} written definitions`;
                        dd.appendChild(note);
                    }
                }).observe(dd, { childList: true });
            });
        }

        // 7. STUDIO TAB 2: Interactive Thematic Sampler (6 cards at a time — never a bulk dump!)
        const THEME_DEFS = [
            { id: "colours", label: "Colours", icon: WCPP_SVG.flower, rx: /\b(white|red|crimson|yellow|gold|blue|purple|violet|black|dark|green|pink|rose|scarlet|orange|silver|grey|gray|bronze|copper)\b/i },
            { id: "leaves", label: "Leaf & Form", icon: WCPP_SVG.leaf, rx: /\b(leaf|leaved|leaves|large|small|dwarf|tall|slender|broad|narrow|heart|lance|lobed|winged|creeping|climbing|branch)\b/i },
            { id: "geography", label: "BC & Habitat", icon: WCPP_SVG.mountain, rx: /\b(pacific|western|eastern|northern|canada|oregon|nootka|sitka|alpine|mountain|coastal|sea|marsh|swamp|water|forest|wood|meadow|rock|sand|shade|sun)\b/i },
            { id: "people", label: "Botanists", icon: WCPP_SVG.feather, rx: /\b(named (for|after)|botanist|naturalist|explorer|collector|entomologist)\b/i },
            { id: "texture", label: "Texture & Scent", icon: WCPP_SVG.sparkles, rx: /\b(hairy|woolly|smooth|hairless|spiny|thorny|prickly|sticky|glandular|wrinkled|fragrant|scented|aromatic|peppery|sweet|bitter|rough|velvet)\b/i },
            { id: "edible", label: "Edible & Useful", icon: WCPP_SVG.sprout, rx: /\b(edible|medicinal|cultivated|fruit|berry|berries|seed|root|nut|honey|nectar|food|kitchen|herb)\b/i }
        ];
        let activeThemeId = "colours";

        const renderThemesPanel = () => {
            themesPanel.dataset.rendered = "1";
            themesPanel.innerHTML = `
                <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;">
                    <div style="font-size:0.86rem;font-weight:700;color:var(--wcpp-muted);">Pick a theme to sample 6 defined roots at a time — click any card to decode it &amp; see matching BC plants.</div>
                    <button type="button" id="wcppShuffleThemeBtn" class="wcpp-latin-btn-soft" style="padding:6px 12px;font-size:0.78rem;">${WCPP_SVG.refresh}<span>Show 6 More</span></button>
                </div>
                <div class="wcpp-latin-theme-pills" id="wcppThemePills">
                    ${THEME_DEFS.map(t => `<button type="button" class="wcpp-latin-theme-pill${t.id === activeThemeId ? " active" : ""}" data-theme-id="${t.id}">${t.icon}<span>${t.label}</span></button>`).join("")}
                </div>
                <div class="wcpp-latin-theme-grid" id="wcppThemeCardsGrid"></div>
            `;

            const populateThemeCards = () => {
                const grid = document.getElementById("wcppThemeCardsGrid");
                if (!grid) return;
                const def = THEME_DEFS.find(t => t.id === activeThemeId) || THEME_DEFS[0];
                const pool = latinEntries.filter(e => def.rx.test(e.meaning) || def.rx.test(e.word));
                if (!pool.length) {
                    grid.innerHTML = `<p style="color:var(--wcpp-muted);">Loading lexicon sampler...</p>`;
                    return;
                }
                // Shuffle and take 6 distinct cards
                const shuffled = pool.slice().sort(() => Math.random() - 0.5).slice(0, 6);
                grid.innerHTML = shuffled.map(e => `
                    <button type="button" class="wcpp-latin-theme-card" data-theme-word="${esc(e.word)}">
                        <div class="wcpp-latin-tc-word">${esc(e.word)}</div>
                        <div class="wcpp-latin-tc-def">${esc(e.meaning)}</div>
                        <div class="wcpp-latin-tc-cta">Decode &amp; match BC plants →</div>
                    </button>
                `).join("");
            };

            populateThemeCards();
            const pillsEl = document.getElementById("wcppThemePills");
            if (pillsEl) {
                pillsEl.addEventListener("click", (e) => {
                    const btn = e.target.closest(".wcpp-latin-theme-pill");
                    if (!btn) return;
                    activeThemeId = btn.getAttribute("data-theme-id");
                    pillsEl.querySelectorAll(".wcpp-latin-theme-pill").forEach(b => b.classList.toggle("active", b === btn));
                    populateThemeCards();
                });
            }
            const shufBtn = document.getElementById("wcppShuffleThemeBtn");
            if (shufBtn) shufBtn.addEventListener("click", populateThemeCards);

            const cardsGrid = document.getElementById("wcppThemeCardsGrid");
            if (cardsGrid) {
                cardsGrid.addEventListener("click", (e) => {
                    const card = e.target.closest(".wcpp-latin-theme-card");
                    if (!card) return;
                    const w = card.getAttribute("data-theme-word");
                    switchStudioTab("decode");
                    selectNativeTerm(w, 1);
                });
            }
        };

        // 8. STUDIO TAB 3: Customizable Botanical Latin Field Quiz & Flashcard Trainer
        let quizPrefs = { deck: "bc_native", mode: "mc", showHint: true, bestStreak: 0 };
        try {
            const saved = JSON.parse(localStorage.getItem("wcppLatinQuizPrefs") || "null");
            if (saved && typeof saved === "object") quizPrefs = { ...quizPrefs, ...saved };
        } catch (_) {}
        let quizScore = 0;
        let quizTotal = 0;
        let quizStreak = 0;
        let currentQuizItem = null;

        const saveQuizPrefs = () => {
            try { localStorage.setItem("wcppLatinQuizPrefs", JSON.stringify(quizPrefs)); } catch (_) {}
        };

        const getQuizPool = () => {
            if (!latinEntries.length) return [];
            if (quizPrefs.deck === "prefixes") return latinEntries.filter(e => e.isPrefix);
            if (quizPrefs.deck === "suffixes") return latinEntries.filter(e => e.isSuffix);
            if (quizPrefs.deck === "saved") {
                try {
                    const favs = JSON.parse(localStorage.getItem("botanicalFavorites") || "[]");
                    const savedTerms = [];
                    favs.forEach(f => {
                        if (f.term1 && f.term1.key && f.term1.meaning) savedTerms.push({ word: f.term1.key, meaning: f.term1.meaning, norm: normWord(f.term1.key) });
                        if (f.term2 && f.term2.key && f.term2.meaning) savedTerms.push({ word: f.term2.key, meaning: f.term2.meaning, norm: normWord(f.term2.key) });
                    });
                    if (savedTerms.length >= 2) return savedTerms;
                } catch (_) {}
                return latinEntries;
            }
            if (quizPrefs.deck === "bc_native" && bcPlants.length) {
                const bcLatinBlob = bcPlants.map(p => (p.latin || "").toLowerCase()).join(" ");
                const matched = latinEntries.filter(e => e.norm.length >= 4 && bcLatinBlob.includes(e.norm));
                if (matched.length >= 12) return matched;
            }
            return latinEntries;
        };

        const findHintPlantForEntry = (entry) => {
            if (!bcPlants.length || !entry || entry.norm.length < 4) return null;
            return bcPlants.find(p => (p.latin || "").toLowerCase().includes(entry.norm)) || null;
        };

        const renderQuizPanel = () => {
            quizPanel.dataset.rendered = "1";
            quizPanel.innerHTML = `
                <div class="wcpp-latin-quiz-bar">
                    <div class="wcpp-latin-quiz-settings">
                        <select id="wcppQuizDeckSel" aria-label="Quiz Deck">
                            <option value="bc_native"${quizPrefs.deck === "bc_native" ? " selected" : ""}>Deck: BC Native Plant Roots</option>
                            <option value="all"${quizPrefs.deck === "all" ? " selected" : ""}>Deck: All Defined Terms</option>
                            <option value="prefixes"${quizPrefs.deck === "prefixes" ? " selected" : ""}>Deck: Prefixes Only</option>
                            <option value="suffixes"${quizPrefs.deck === "suffixes" ? " selected" : ""}>Deck: Suffixes Only</option>
                            <option value="saved"${quizPrefs.deck === "saved" ? " selected" : ""}>Deck: My Saved Names</option>
                        </select>
                        <select id="wcppQuizModeSel" aria-label="Quiz Mode">
                            <option value="mc"${quizPrefs.mode === "mc" ? " selected" : ""}>Mode: Multiple Choice</option>
                            <option value="flashcard"${quizPrefs.mode === "flashcard" ? " selected" : ""}>Mode: Flip Flashcard</option>
                        </select>
                        <label style="display:inline-flex;align-items:center;gap:6px;margin:0;font-size:0.8rem;font-weight:700;cursor:pointer;">
                            <input type="checkbox" id="wcppQuizHintChk"${quizPrefs.showHint ? " checked" : ""}>
                            <span>BC Plant Clue</span>
                        </label>
                    </div>
                    <div class="wcpp-latin-quiz-score" id="wcppQuizScoreWrap"></div>
                </div>
                <div class="wcpp-latin-quiz-stage" id="wcppQuizStage"></div>
            `;

            const updateScoreBar = () => {
                const wrap = document.getElementById("wcppQuizScoreWrap");
                if (!wrap) return;
                wrap.innerHTML = `
                    <span class="wcpp-latin-score-pill">Score: ${quizScore}/${quizTotal}</span>
                    <span class="wcpp-latin-score-pill">Streak: ${quizStreak}</span>
                    <span class="wcpp-latin-score-pill">Best: ${quizPrefs.bestStreak}</span>
                `;
            };

            const loadNextQuestion = () => {
                updateScoreBar();
                const stage = document.getElementById("wcppQuizStage");
                if (!stage) return;
                const pool = getQuizPool();
                if (pool.length < 4) {
                    stage.innerHTML = `<p style="margin:0;">Loading live lexicon...</p>`;
                    return;
                }
                const target = pool[Math.floor(Math.random() * pool.length)];
                currentQuizItem = target;
                const hintPlant = quizPrefs.showHint ? findHintPlantForEntry(target) : null;
                const hintHtml = hintPlant
                    ? `<div class="wcpp-latin-quiz-hint">Field Clue: Found in <strong>${esc(hintPlant.common)}</strong> (<em>${esc(hintPlant.latin)}</em>)</div>`
                    : `<div class="wcpp-latin-quiz-hint">${target.isPrefix ? "Botanical Prefix" : (target.isSuffix ? "Botanical Suffix" : "Botanical Latin Root / Epithet")}</div>`;

                if (quizPrefs.mode === "flashcard") {
                    stage.innerHTML = `
                        <div class="wcpp-latin-quiz-prompt-label">Botanical Flashcard</div>
                        <div class="wcpp-latin-quiz-word">${esc(target.word)}</div>
                        ${hintHtml}
                        <div id="wcppFlashAns" class="wcpp-latin-flash-answer hidden">${esc(target.meaning)}</div>
                        <div class="wcpp-latin-quiz-actions">
                            <button type="button" id="wcppFlashRevealBtn" class="wcpp-latin-btn-soft">Reveal Definition</button>
                            <button type="button" id="wcppFlashKnewBtn" class="wcpp-latin-btn-primary hidden">✓ I Knew It</button>
                            <button type="button" id="wcppFlashNextBtn" class="wcpp-latin-btn-soft hidden">Next Card →</button>
                            <button type="button" id="wcppFlashInspectBtn" class="wcpp-latin-btn-soft hidden">See BC Plants →</button>
                        </div>
                    `;
                    const ans = document.getElementById("wcppFlashAns");
                    const revBtn = document.getElementById("wcppFlashRevealBtn");
                    const knewBtn = document.getElementById("wcppFlashKnewBtn");
                    const nextBtn = document.getElementById("wcppFlashNextBtn");
                    const inspBtn = document.getElementById("wcppFlashInspectBtn");
                    revBtn.addEventListener("click", () => {
                        ans.classList.remove("hidden");
                        revBtn.classList.add("hidden");
                        knewBtn.classList.remove("hidden");
                        nextBtn.classList.remove("hidden");
                        inspBtn.classList.remove("hidden");
                    });
                    knewBtn.addEventListener("click", () => {
                        quizTotal += 1;
                        quizScore += 1;
                        quizStreak += 1;
                        if (quizStreak > quizPrefs.bestStreak) { quizPrefs.bestStreak = quizStreak; saveQuizPrefs(); }
                        loadNextQuestion();
                    });
                    nextBtn.addEventListener("click", () => {
                        quizTotal += 1;
                        quizStreak = 0;
                        loadNextQuestion();
                    });
                    inspBtn.addEventListener("click", () => {
                        switchStudioTab("decode");
                        selectNativeTerm(target.word, 1);
                    });
                    return;
                }

                // Multiple Choice (4 unique meanings)
                const distractors = [];
                const usedMeanings = new Set([target.meaning.toLowerCase()]);
                let guard = 0;
                while (distractors.length < 3 && guard < 80) {
                    guard += 1;
                    const cand = latinEntries[Math.floor(Math.random() * latinEntries.length)];
                    if (cand && cand.meaning && !usedMeanings.has(cand.meaning.toLowerCase())) {
                        usedMeanings.add(cand.meaning.toLowerCase());
                        distractors.push(cand);
                    }
                }
                const choices = [target, ...distractors].sort(() => Math.random() - 0.5);

                stage.innerHTML = `
                    <div class="wcpp-latin-quiz-prompt-label">What does this botanical Latin term mean?</div>
                    <div class="wcpp-latin-quiz-word">${esc(target.word)}</div>
                    ${hintHtml}
                    <div class="wcpp-latin-quiz-options">
                        ${choices.map((c, idx) => `<button type="button" class="wcpp-latin-quiz-opt" data-opt-correct="${c === target ? "1" : "0"}">${idx + 1}. ${esc(c.meaning)}</button>`).join("")}
                    </div>
                    <div id="wcppQuizFeedback" style="min-height:22px;font-size:0.9rem;font-weight:800;margin-bottom:8px;"></div>
                    <div class="wcpp-latin-quiz-actions">
                        <button type="button" id="wcppQuizNextBtn" class="wcpp-latin-btn-soft">Skip / Next →</button>
                        <button type="button" id="wcppQuizInspectBtn" class="wcpp-latin-btn-soft hidden">Decode &amp; See BC Plants →</button>
                    </div>
                `;

                const fb = document.getElementById("wcppQuizFeedback");
                const nextBtn = document.getElementById("wcppQuizNextBtn");
                const inspBtn = document.getElementById("wcppQuizInspectBtn");
                let answered = false;

                stage.querySelectorAll(".wcpp-latin-quiz-opt").forEach(btn => {
                    btn.addEventListener("click", () => {
                        if (answered) return;
                        answered = true;
                        quizTotal += 1;
                        const ok = btn.getAttribute("data-opt-correct") === "1";
                        stage.querySelectorAll(".wcpp-latin-quiz-opt").forEach(b => {
                            b.disabled = true;
                            if (b.getAttribute("data-opt-correct") === "1") b.classList.add("is-correct");
                        });
                        if (ok) {
                            quizScore += 1;
                            quizStreak += 1;
                            if (quizStreak > quizPrefs.bestStreak) { quizPrefs.bestStreak = quizStreak; saveQuizPrefs(); }
                            fb.textContent = "Spot on! Great botanical eye.";
                        } else {
                            btn.classList.add("is-wrong");
                            quizStreak = 0;
                            fb.textContent = `Answer: ${target.word} = "${target.meaning}"`;
                        }
                        updateScoreBar();
                        nextBtn.textContent = "Next Question →";
                        inspBtn.classList.remove("hidden");
                    });
                });

                nextBtn.addEventListener("click", loadNextQuestion);
                inspBtn.addEventListener("click", () => {
                    switchStudioTab("decode");
                    selectNativeTerm(target.word, 1);
                });
            };

            document.getElementById("wcppQuizDeckSel").addEventListener("change", (e) => {
                quizPrefs.deck = e.target.value;
                saveQuizPrefs();
                loadNextQuestion();
            });
            document.getElementById("wcppQuizModeSel").addEventListener("change", (e) => {
                quizPrefs.mode = e.target.value;
                saveQuizPrefs();
                loadNextQuestion();
            });
            document.getElementById("wcppQuizHintChk").addEventListener("change", (e) => {
                quizPrefs.showHint = e.target.checked;
                saveQuizPrefs();
                loadNextQuestion();
            });

            loadNextQuestion();
        };

        // 9. Load Live Latin Base + Curator Overrides + BC Native Plants Data
        const hydrateStudioData = async () => {
            try {
                const res = await fetch("data/latin_base.json");
                if (res.ok) {
                    const rows = await res.json();
                    let merged = Array.isArray(rows) ? rows : [];
                    if (global.WCPPAdmin && typeof global.WCPPAdmin.applyOverrides === "function") {
                        merged = global.WCPPAdmin.applyOverrides("latin_terms", merged, "word");
                    }
                    const map = new Map();
                    merged.forEach(r => {
                        const word = String(r && r.word ? r.word : "").trim();
                        const meaning = String(r && r.meaning ? r.meaning : "").trim();
                        if (word && meaning) {
                            map.set(word.toLowerCase(), {
                                word,
                                meaning,
                                norm: normWord(word),
                                isPrefix: word.endsWith("-"),
                                isSuffix: word.startsWith("-")
                            });
                        }
                    });
                    latinEntries = Array.from(map.values()).sort((a, b) => a.word.localeCompare(b.word));
                    entryByNorm = new Map();
                    latinEntries.forEach(e => {
                        if (e.norm && !entryByNorm.has(e.norm)) entryByNorm.set(e.norm, e);
                    });
                    renderHonestStats();
                    if (themesPanel.dataset.rendered) renderThemesPanel();
                    if (quizPanel.dataset.rendered && !currentQuizItem) renderQuizPanel();
                }
            } catch (_) {}

            try {
                const pRes = await fetch("data/plants_212.json");
                if (pRes.ok) {
                    const pRows = await pRes.json();
                    if (Array.isArray(pRows)) {
                        bcPlants = pRows
                            .filter(p => p && p.Latin_Name && p.Common_Name_Primary && !/introduced|non-native|exotic/i.test(String(p.Origin_BC || "")))
                            .map(p => ({
                                common: String(p.Common_Name_Primary).trim(),
                                latin: String(p.Latin_Name).trim(),
                                slug: String(p.URL_Slug || p.Latin_Name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                                etymology: String(p.Name_Etymology || "").trim()
                            }));
                        syncShelfFromCombiner();
                    }
                }
            } catch (_) {}

            // Auto-decode ?q= URL parameter into the breakdown card too if present
            const qParam = new URLSearchParams(window.location.search).get("q");
            if (qParam && qParam.trim()) {
                runAutoDecode(qParam.trim());
            }
        };

        hydrateStudioData();
        global.addEventListener("wcpp:curator-changed", (e) => {
            if (!e.detail || !e.detail.datasetKey || e.detail.datasetKey === "latin_terms") {
                hydrateStudioData();
            }
        });
    }

    function initFloraAndSpeciesEnhancements() {
        initAppHistoryNav();
        sortNavAndFooterAlphabetically();
        removeOpinionatedCoreIndexBlocks();
        upgradePageEmojisToSVG();
        upgradeWeatherIconToSVG();
        initReadingProgressBar();
        initSpeciesHeroPhoto();
        initSpeciesVisualEnhancements();
        initFloraIndexHoverPopup();
        initFloraIndexQuickFilters();
        initHomepageAestheticEnhancements();
        initPlantPlannerEnhancements();
        initSecondaryPagesEnhancements();
        initBotanicalLatinStudio();

        setTimeout(() => {
            initAppHistoryNav();
            sortNavAndFooterAlphabetically();
            removeOpinionatedCoreIndexBlocks();
            upgradePageEmojisToSVG();
            upgradeWeatherIconToSVG();
        }, 700);

        global.addEventListener("wcpp:weather-ready", () => {
            setTimeout(upgradeWeatherIconToSVG, 30);
        });

        if ("MutationObserver" in global) {
            const hdr = document.getElementById("header-container");
            if (hdr && !hdr.dataset.wcppHdrMo) {
                hdr.dataset.wcppHdrMo = "1";
                new MutationObserver(() => {
                    initAppHistoryNav();
                    sortNavAndFooterAlphabetically();
                    upgradePageEmojisToSVG(hdr);
                }).observe(hdr, { childList: true });
            }
            const ftr = document.getElementById("footer-container");
            if (ftr && !ftr.dataset.wcppFtrMo) {
                ftr.dataset.wcppFtrMo = "1";
                new MutationObserver(() => {
                    sortNavAndFooterAlphabetically();
                    upgradePageEmojisToSVG(ftr);
                }).observe(ftr, { childList: true });
            }
            const sb = document.getElementById("sidebar-container");
            if (sb && !sb.dataset.wcppSbMo) {
                sb.dataset.wcppSbMo = "1";
                const bindBlogSpot = () => {
                    const blogSpot = document.getElementById("gh-sidebar-blog-spot");
                    if (blogSpot && !blogSpot.dataset.wcppBlogMo) {
                        blogSpot.dataset.wcppBlogMo = "1";
                        upgradePageEmojisToSVG(blogSpot);
                        new MutationObserver(() => upgradePageEmojisToSVG(blogSpot)).observe(blogSpot, { childList: true });
                    }
                    const wxIcon = document.getElementById("gh-weather-icon") || sb.querySelector(".gh-weather-icon");
                    if (wxIcon && !wxIcon.dataset.wcppWxMo) {
                        wxIcon.dataset.wcppWxMo = "1";
                        upgradeWeatherIconToSVG();
                        new MutationObserver(() => upgradeWeatherIconToSVG()).observe(wxIcon, { childList: true, characterData: true, subtree: true });
                    }
                };
                bindBlogSpot();
                new MutationObserver(() => {
                    upgradeWeatherIconToSVG();
                    upgradePageEmojisToSVG(sb);
                    bindBlogSpot();
                }).observe(sb, { childList: true });
            }
            if (!document.body.dataset.wcppThemeMo) {
                document.body.dataset.wcppThemeMo = "1";
                new MutationObserver(() => upgradePageEmojisToSVG(document.body)).observe(document.body, { attributes: true, attributeFilter: ["class"] });
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initFloraAndSpeciesEnhancements);
    } else {
        initFloraAndSpeciesEnhancements();
    }
})(window);
