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
        link.href = "css/site.css?v=20261118b";
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
    global.WCPPAnalytics = {
        track: function (eventName, params) {
            if (!eventName) return;
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

    global.resolveSharedPlantPhoto = async function (sciName, commonName, explicitUrl, fallbackSvg) {
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
        const rawStatus = String(r.Availability_Status || r.Status || "").trim();
        const readyWin = String(r.Ready_Window || r.Season_Notes || "In Season").trim();
        const isPreOrder = /pre-?order/i.test(rawStatus) ||
            /pre-?order/i.test(readyWin) ||
            (Number.isFinite(qtyNum) && qtyNum <= 0);
        return {
            Plant_ID: r.Plant_ID || r.Item_ID || r.ID || `LP-ROW-${idx + 1}`,
            Plant_Name: r.Plant_Name || r.Name || r.Common_Name || "Live Plant",
            Latin_Name: r.Latin_Name || r.Scientific_Name || "",
            Category: r.Category || (/(tomato|pepper|basil|kale|garlic|rosemary|strawberry.*everbearing)/i.test(r.Plant_Name || "") ? "Vegetable & Herb Start" : "Native Plant"),
            Pot_Size_Format: r.Pot_Size_Format || r.Format || r.Pot_Size || "4-inch Pot",
            Price_CAD: String(r.Price_CAD || r.Price || "0.00").replace(/[^0-9.]/g, "") || "0.00",
            Available_Qty: String(r.Available_Qty ?? r.Qty ?? r.Quantity ?? "0"),
            Availability_Status: isPreOrder ? "Pre-Order" : "In Stock",
            Ready_Window: readyWin,
            Notes: r.Notes || r.Description || "",
            Image_URL: r.Image_URL || r.Photo_URL || r.Image || "",
            _isPreOrder: isPreOrder,
            _qtyNum: Number.isFinite(qtyNum) ? qtyNum : 0
        };
    }

    async function loadSharedInventory(force = false) {
        if (_invLoaded && !force) return _invCatalog;
        if (_invPromise && !force) return _invPromise;

        _invPromise = (async () => {
            if (global.WCPPAdmin && global.WCPPAdmin.ready) {
                await global.WCPPAdmin.ready.catch(() => {});
            }
            let base = [];
            try {
                const res = await fetch("data/orders_inventory.json?v=20261118a");
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) base = data;
                }
            } catch (_) {}

            let invCsv = (localStorage.getItem("wcpp_inventory_sheet_csv") || "").trim();
            if (!invCsv) {
                try {
                    const cfgRes = await fetch("data/orders_config.json?v=20261118a");
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
                            const mergedMap = new Map();
                            base.forEach((item, idx) => {
                                const k = String(item.Plant_ID || item.Item_ID || item.ID || `BASE-${idx}`).trim();
                                mergedMap.set(k, item);
                            });
                            parsed.forEach((item, idx) => {
                                const k = String(item.Plant_ID || item.Item_ID || item.ID || `SHEET-${idx}`).trim();
                                const prev = mergedMap.get(k);
                                mergedMap.set(k, prev ? Object.assign({}, prev, item) : item);
                            });
                            base = Array.from(mergedMap.values());
                        }
                    }
                } catch (_) {}
            }

            if (global.WCPPAdmin && typeof global.WCPPAdmin.applyOverrides === "function") {
                base = global.WCPPAdmin.applyOverrides("orders_catalog", base, "Plant_ID");
            }
            _invCatalog = base.map(normalizeInvRecord);
            _invLoaded = true;
            global.dispatchEvent(new CustomEvent("wcpp:inventory-ready", { detail: { catalog: _invCatalog } }));
            return _invCatalog;
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
        const inStock = matches.filter(m => !m._isPreOrder);
        const preOrder = matches.filter(m => m._isPreOrder);
        let statusType = "custom-preorder";
        if (inStock.length && preOrder.length) statusType = "both";
        else if (inStock.length) statusType = "in-stock";
        else if (preOrder.length) statusType = "pre-order";

        const allPrices = matches.map(m => parseFloat(m.Price_CAD)).filter(n => Number.isFinite(n) && n > 0);
        const lowestPrice = allPrices.length ? Math.min(...allPrices) : null;
        const primaryItem = inStock[0] || preOrder[0] || null;
        return { matches, inStock, preOrder, lowestPrice, primaryItem, statusType };
    }

    function buildOrderHref(queryObj, item, forcePreorder) {
        const name = (queryObj && (queryObj.commonName || queryObj.name || queryObj.latinName)) || (item ? item.Plant_Name : "");
        if (item) {
            const modeParam = (forcePreorder || item._isPreOrder) ? "&mode=preorder" : "";
            return `orders.html?plant=${encodeURIComponent(name)}&add=${encodeURIComponent(item.Plant_ID)}${modeParam}`;
        }
        return `orders.html?preorder=${encodeURIComponent(name)}`;
    }

    function renderInventoryBadge(queryObj, opts = {}) {
        const summary = getInventorySummary(queryObj);
        const name = (queryObj && (queryObj.commonName || queryObj.name || queryObj.latinName)) || "";
        const compactCls = opts.compact ? " compact" : "";

        if (summary.statusType === "in-stock") {
            const p = summary.inStock[0];
            const href = buildOrderHref(queryObj, p, false);
            const priceTxt = Number(p.Price_CAD) > 0 ? ` ($${Number(p.Price_CAD).toFixed(2)})` : "";
            return `<a href="${href}" class="wcpp-inv-badge in-stock${compactCls}" title="In stock at Surrey Royal Heights (${p._qtyNum} available) — click to order">🌱 In Stock${opts.compact ? "" : priceTxt}</a>`;
        }
        if (summary.statusType === "pre-order") {
            const p = summary.preOrder[0];
            const href = buildOrderHref(queryObj, p, true);
            const priceTxt = Number(p.Price_CAD) > 0 ? ` ($${Number(p.Price_CAD).toFixed(2)})` : "";
            return `<a href="${href}" class="wcpp-inv-badge pre-order${compactCls}" title="${escHtml(p.Ready_Window)} — click to reserve pre-order">📅 ${opts.compact ? "Pre-Order" : `Pre-Order${priceTxt}`}</a>`;
        }
        if (summary.statusType === "both") {
            const pIn = summary.inStock[0];
            const pPre = summary.preOrder[0];
            const inHref = buildOrderHref(queryObj, pIn, false);
            const preHref = buildOrderHref(queryObj, pPre, true);
            return `<span class="wcpp-inv-badge-group">` +
                `<a href="${inHref}" class="wcpp-inv-badge in-stock${compactCls}" title="${pIn._qtyNum} in stock — ${escHtml(pIn.Plant_Name)}">🌱 In Stock${opts.compact ? "" : ` ($${Number(pIn.Price_CAD).toFixed(2)})`}</a>` +
                `<a href="${preHref}" class="wcpp-inv-badge pre-order${compactCls}" title="${escHtml(pPre.Ready_Window)} — ${escHtml(pPre.Plant_Name)}">📅 Pre-Order</a>` +
                `</span>`;
        }
        if (opts.showPreorderFallback && name) {
            const href = buildOrderHref(queryObj, null, true);
            return `<a href="${href}" class="wcpp-inv-badge request${compactCls}" title="Request a seasonal pre-order for ${escHtml(name)}">📅 Pre-Order / Request</a>`;
        }
        return "";
    }

    function renderInventoryCardBox(queryObj) {
        const summary = getInventorySummary(queryObj);
        const name = (queryObj && (queryObj.commonName || queryObj.name || queryObj.latinName)) || "this plant";
        if (!summary.matches.length) {
            const reqHref = buildOrderHref(queryObj, null, true);
            return `<div class="wcpp-inv-card-box">
                <div style="font-weight:800; color:var(--wcpp-secondary);">📅 Seasonal Pre-Order Available by Request</div>
                <div class="wcpp-inv-item-meta">Not currently potted in the ready shelf, but you can request <strong>${escHtml(name)}</strong> as a seasonal pre-order start or custom plug batch.</div>
                <a href="${reqHref}" class="wcpp-inv-action-btn request">📅 Pre-Order / Request ${escHtml(name)} →</a>
            </div>`;
        }
        const rowsHtml = summary.matches.map(item => {
            const isPre = item._isPreOrder;
            const href = buildOrderHref(queryObj, item, isPre);
            const statusPill = isPre
                ? `<span class="wcpp-inv-badge pre-order compact">📅 Pre-Order</span>`
                : `<span class="wcpp-inv-badge in-stock compact">✓ ${item._qtyNum} In Stock</span>`;
            const btnCls = isPre ? "pre-order" : "in-stock";
            const btnTxt = isPre ? `📅 Pre-Order ($${Number(item.Price_CAD).toFixed(2)}) →` : `🌱 Order In-Stock ($${Number(item.Price_CAD).toFixed(2)}) →`;
            return `<div class="wcpp-inv-item-row">
                <div class="wcpp-inv-item-head">
                    <strong>${escHtml(item.Plant_Name)}</strong>
                    ${statusPill}
                </div>
                <div class="wcpp-inv-item-meta">${escHtml(item.Pot_Size_Format)} &bull; ${escHtml(item.Ready_Window)}</div>
                <a href="${href}" class="wcpp-inv-action-btn ${btnCls}">${btnTxt}</a>
            </div>`;
        }).join("");
        return `<div class="wcpp-inv-card-box">${rowsHtml}</div>`;
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
        buildOrderHref
    };

    // Start preloading inventory early on all pages
    loadSharedInventory();

    global.addEventListener("wcpp:curator-changed", () => {
        loadSharedInventory(true);
    });

    // =========================================================================
    // 3B. SHARED ARTICLES & SUBJECT-MATTER MATCHER (WCPPArticles)
    // =========================================================================
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
        let rowUrl = row.URL || row.Link || row.url || row.link || row.Website || row["Article Link"] || "";
        if (!rowUrl) {
            rowUrl = Object.values(row).find(v => typeof v === "string" && v.trim().startsWith("http")) || "";
        }
        rowUrl = String(rowUrl || "").trim();
        if (!rowUrl) return null;
        let rowImg = row["Image URL"] || row.Image || row.image || row.Photo || row.Thumbnail || row.Picture || "";
        const feedKey = row._feedKey || (feedMeta ? feedMeta.key : "ecosystem");
        const catLabel = row.Category || (feedMeta ? feedMeta.label : (ARTICLE_FEEDS[feedKey] ? ARTICLE_FEEDS[feedKey].label : "Library Resource"));
        const out = Object.assign({}, row, {
            Title: String(row.Title || row.Name || row.title || row.name || row.Topic || row.Article || "Untitled Resource").trim(),
            URL: rowUrl,
            Description: String(row.Description || row.description || row.Summary || row.summary || row.Notes || row.About || "").trim(),
            Tags: String(row.Tags || row.tags || row.Category || row.category || row.Keywords || "").trim(),
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
        return merged.map(item => normalizeArticleRow(item, ARTICLE_FEEDS[item._feedKey], item._isFallback)).filter(Boolean);
    }

    async function loadSharedArticles(force = false) {
        if (_articlesLoaded && !force) return _articlesCatalog;
        if (_articlesPromise && !force) return _articlesPromise;

        _articlesPromise = (async () => {
            if (global.WCPPAdmin && global.WCPPAdmin.ready) {
                await global.WCPPAdmin.ready.catch(() => {});
            }

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

            if (!usedSessionCache) {
                const feedDefs = Object.values(ARTICLE_FEEDS);
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
                settled.forEach(res => {
                    if (res.status === "fulfilled" && Array.isArray(res.value)) {
                        feedRows = feedRows.concat(res.value);
                    }
                });
                if (feedRows.length) {
                    try {
                        sessionStorage.setItem(ARTICLES_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: feedRows }));
                    } catch (_) {}
                }
            }

            const fallbackNorm = FALLBACK_ARTICLES.map(a => normalizeArticleRow(a, ARTICLE_FEEDS[a._feedKey], true)).filter(Boolean);
            _articlesRawBase = dedupeArticles([...feedRows, ...fallbackNorm]);
            _articlesCatalog = applyArticlesCuratorOverrides(_articlesRawBase);
            _articlesLoaded = true;
            global.dispatchEvent(new CustomEvent("wcpp:articles-ready", { detail: { articles: _articlesCatalog } }));
            return _articlesCatalog;
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
        loadAll: loadSharedArticles,
        reload: () => loadSharedArticles(true),
        getAll: () => _articlesCatalog.slice(),
        isLoaded: () => _articlesLoaded,
        findRelated: findRelatedArticles,
        renderSectionHTML: renderRelatedArticlesHTML,
        buildArticlesHref
    };

    // Preload articles quietly across pages
    loadSharedArticles();

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
        const next = list.filter(s => !(s.id === idOrQuery || itemsMatchPlan(s, idOrQuery)));
        if (next.length !== list.length) {
            writeGardenPlanRaw(next, "removed", idOrQuery);
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
    // 4. GLOBAL QUICK-SEARCH MODAL (Ctrl+K / Cmd+K / /)
    // =========================================================================
    const QUICK_TOOLS_INDEX = [
        { title: "Live Plant Orders & Pre-Orders", sub: "Browse in-stock native plants, vegetable starts, and seasonal pre-orders", url: "orders.html" },
        { title: "BC Native Plant Card Explorer (5-Tab)", sub: "Search 114 botanical & Coast Salish attributes across 212 / 4,590 species", url: "plant-planner.html" },
        { title: "West Coast Native Plant Matrix Comparator", sub: "Compare up to 4 BC native plants side-by-side", url: "nativeplants.html" },
        { title: "Garden Bed Plant Planner", sub: "Vegetables, herbs & companion compatibility (Tomato, Basil, Carrot, Kale...)", url: "garden.html" },
        { title: "South Coastal BC Planting Calendar", sub: "Monthly sowing, indoor starts, transplanting & frost dates by city", url: "calendar.html" },
        { title: "Horticulture & Climate Calculators", sub: "DLI, VPD, growing degree-days, fertilizer & irrigation calculators", url: "calculators.html" },
        { title: "Biologicals & Pest Control Guides", sub: "Beneficial insects, PGPR microbes, mites, aphids & biocontrol curves", url: "bios.html" },
        { title: "Botanical Latin Decoder", sub: "Translate scientific plant prefixes, suffixes & epithets", url: "latin.html" },
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
        bd.innerHTML = `
            <div class="wcpp-modal wcpp-search-modal" role="dialog" aria-modal="true" aria-label="Quick Search">
                <div class="wcpp-modal-header">
                    <h2>🔍 Quick Search Plants, Live Orders &amp; Tools</h2>
                    <button type="button" class="wcpp-modal-close" aria-label="Close">✕</button>
                </div>
                <div class="wcpp-modal-body">
                    <div class="wcpp-search-bar-row">
                        <input type="search" id="wcppGlobalSearchInput" class="wcpp-input" placeholder="Search Tomato, Garry Oak, Salal, pre-order, DLI, aphid..." autofocus />
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

        function renderResults() {
            const q = (inp.value || "").trim().toLowerCase();
            const groups = [];

            // 1. Live Plant Inventory & Pre-Orders
            const invAll = _invCatalog;
            const invMatches = q
                ? invAll.filter(i => `${i.Plant_Name} ${i.Latin_Name} ${i.Category} ${i.Availability_Status} ${i.Pot_Size_Format} ${i.Notes}`.toLowerCase().includes(q))
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

            // 2. Garden Crops
            const cropMatches = q
                ? POPULAR_GARDEN_CROPS.filter(c => `${c.name} ${c.latin}`.toLowerCase().includes(q))
                : POPULAR_GARDEN_CROPS.slice(0, 4);
            if (cropMatches.length) {
                groups.push(`<div class="wcpp-search-group">
                    <h4>🍅 Garden Bed Crops &amp; Calendar</h4>
                    <div class="wcpp-search-list">${cropMatches.slice(0, 5).map(c => {
                        const badge = renderInventoryBadge({ commonName: c.name, latinName: c.latin }, { compact: true, showPreorderFallback: true });
                        return `<div class="wcpp-search-item">
                            <div>
                                <div class="wcpp-search-item-title">${escHtml(c.name)}</div>
                                <div class="wcpp-search-item-sub"><em>${escHtml(c.latin)}</em></div>
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

            // 3. BC Native Plants (if index loaded)
            if (q && Array.isArray(_nativeIndexCache) && _nativeIndexCache.length) {
                const natMatches = _nativeIndexCache.filter(p =>
                    `${p.Common_Name_Primary || ""} ${p.Latin_Name || ""} ${p.Hulquminum_Primary || ""} ${p.SENCOTEN_Primary || ""}`.toLowerCase().includes(q)
                ).slice(0, 5);
                if (natMatches.length) {
                    groups.push(`<div class="wcpp-search-group">
                        <h4>🌿 BC Native Plants (${natMatches.length})</h4>
                        <div class="wcpp-search-list">${natMatches.map(p => {
                            const badge = renderInventoryBadge({ commonName: p.Common_Name_Primary, latinName: p.Latin_Name, slug: p.URL_Slug }, { compact: true });
                            return `<div class="wcpp-search-item">
                                <div>
                                    <div class="wcpp-search-item-title">${escHtml(p.Common_Name_Primary || p.Latin_Name)}</div>
                                    <div class="wcpp-search-item-sub"><em>${escHtml(p.Latin_Name)}</em></div>
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

            // 4. Articles & Research
            const artSource = _articlesCatalog.length
                ? _articlesCatalog
                : FALLBACK_ARTICLES.map(a => normalizeArticleRow(a, ARTICLE_FEEDS[a._feedKey], true)).filter(Boolean);
            const artMatches = q
                ? findRelatedArticles({ commonName: q, rawText: q }, 4).filter(m => m.score > 0 || m.article._searchBlob.includes(q))
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

            // 5. Site Tools & Calculators
            const toolMatches = q
                ? QUICK_TOOLS_INDEX.filter(t => `${t.title} ${t.sub}`.toLowerCase().includes(q))
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
                    No direct matches for "<strong>${escHtml(q)}</strong>".
                    <div style="margin-top:10px;">
                        <a href="orders.html?preorder=${encodeURIComponent(q)}" class="wcpp-inv-badge pre-order">📅 Pre-Order / Request "${escHtml(q)}" →</a>
                    </div>
                </div>`;
                return;
            }
            resultsEl.innerHTML = groups.join("");
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
        ensureNativeSearchIndex().then(() => {
            if (document.getElementById("wcppGlobalSearchModal")) renderResults();
        });
        loadSharedArticles().then(() => {
            if (document.getElementById("wcppGlobalSearchModal")) renderResults();
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
            mLink.href = "manifest.json?v=20261118a";
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
            navigator.serviceWorker.register("sw.js").catch(() => {});
        });
    }
})(window);
