/* =========================================================================
   West Coast Plant Project (plantproject.ca)
   Garden Bed Designer UI — V5 Studio (Sun, Moon & Stars Pack)
   - On-demand shell adoption (#wcppGardenModeTabs, #wcppBedSimRoot, #wcppSendGuildToSimBtn)
   - Lazy 2-stage Studio Modals split (js/bed-simulator-studio-modals.js)
   - Optional Full-Screen Studio Mode (F shortcut, Esc modal-first priority)
   - Multi-Plan Library + Auto-Save + Shareable #plan= Hash + BC Starter Blueprints
   - Live Weather Frost/Heat Action Banner, .ics Calendar Export & WCPP Stock Filter
   - Sun, Shade & Cast-Shadow Simulator + Hydrozone Watering Cadence & Audit
   - Auto-Rotate Next Season + Prior-Season Ghost Labels + Functional Interplanting
   ========================================================================= */
(function (global) {
    "use strict";

    const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const TRAY_CELL_OPTIONS = [50, 72, 98, 128, 200, 288, 32, 18];
    const VALID_SUBTABS = new Set(["crop-map", "farm-layout", "insights", "nursery", "ecology", "journal"]);
    const STUDIO_MODALS_VER = "20261127a";
    const STUDIO_MODALS_SRC = "js/bed-simulator-studio-modals.js?v=" + STUDIO_MODALS_VER;
    const V6_MOD_SRC = "js/bed-simulator-v6.js?v=" + STUDIO_MODALS_VER;
    let _v6ModPromise = null;
    const MEDIA_INGREDIENT_COLORS = {
        "coco-coir": "#92400e",
        "peat-moss": "#78350f",
        "perlite": "#94a3b8",
        "vermiculite": "#d97706",
        "pumice": "#64748b",
        "compost": "#3f6212",
        "worm-castings": "#14532d",
        "pine-bark": "#b45309",
        "potting-soil": "#4d7c0f",
        "garden-loam": "#854d0e",
        "coarse-sand": "#ca8a04",
        "biochar": "#334155",
        "leaf-mold": "#15803d"
    };

    let _initialized = false;
    let _mode = "compare";
    let _subTab = "crop-map";
    let _timelineZoom = "full"; // "full" (Jan–Dec) | "growing" (Mar–Nov)
    let _swipeHintDismissed = false;
    let _cropMapSearch = "";
    let _cropMapFilter = "all"; // "all" | "natives" | "pollinators" | "conflicts" | "family:<F>" | "cat:<C>"
    let _selectedPlantingId = null;

    let _catalog = null;
    let _catalogPromise = null;
    let _state = null;
    let _optimizerPreview = null;
    let _selectedBlockId = null;
    let _selectedStructureId = null;
    let _selectedNurseryWeek = null;
    let _ecologyBlockId = "";
    let _selectedBloomMonth = null;
    let _stratTargetKey = "";

    let _taskTypeFilter = "all";
    let _taskStatusFilter = "all";
    let _taskMonthFilter = "all";
    let _weatherPreviewMode = "live"; // "live" | "cold" | "heat"
    let _weatherFetchRequested = false;
    let _stockFilterMode = "all"; // "all" | "wcpp"

    let _farmLayers = {
        blockNames: true,
        bedNumbers: true,
        tunnels: true,
        sunPath: true
    };
    let _sunOrientationDeg = 180;
    let _shadowShow = true;
    let _shadowMonth = 6;
    let _shadowDay = 21;
    let _shadowHour = 15;
    let _farmAxisUnit = ""; // "" (auto from _state.units) | "ft" | "m" | "cm"
    let _gpsLat = null;
    let _gpsLon = null;
    let _gpsLabel = "";
    let _gpsLoading = false;
    let _farmSnapEnabled = true;
    let _farmDragState = null;
    let _suppressFarmBlockClick = false;
    let _docFarmPointerBound = false;
    let _defenseFilter = "all"; // "all" | "unprotected" | "protected"
    let _selectedDefensePest = "";
    let _dragState = null;
    let _compatObserver = null;

    let _modalMode = null; // "planting" | "conflict" | "rotation" | "plans" | "shape" | "container" | "playground" | "blueprints" | "loading"
    let _plantingDraft = null;
    let _cropDropdownOpen = false;
    let _cropSearchText = "";
    let _conflictPayload = null;
    let _rotationModalState = null;
    let _renamingPlanId = null;
    let _studioModalsPromise = null;
    let _studioModalsPrefetched = false;
    let _studioModalReqId = 0;
    let _studioLoadingLabel = "Loading Studio Module...";

    let _isFullscreen = false;
    let _savedScrollX = 0;
    let _savedScrollY = 0;
    let _lastSavedAt = Date.now();
    let _sharedPlanBanner = null;
    let _previousLocalStateBackup = null;

    let _modalPhotoReqId = 0;
    const _modalPhotoCache = new Map();

    function cleanupPlaygroundPrintSheet() {
        if (document.body) {
            document.body.classList.remove("wcpp-bs-print-sheet-active");
        }
        const existing = document.getElementById("wcppBsPrintSheet");
        if (existing) existing.remove();
    }

    function core() {
        return global.WCPPBedSimCore;
    }

    function getStudioModals() {
        return global.WCPPBedSimStudioModals || null;
    }

    function isStudioModalMode(mode) {
        return mode === "shape" || mode === "container" || mode === "playground" || mode === "blueprints";
    }

    function getV6Module() {
        return global.WCPPBedSimulatorV6 || null;
    }

    function ensureV6ModuleLoaded() {
        if (global.WCPPBedSimulatorV6) {
            return Promise.resolve(global.WCPPBedSimulatorV6);
        }
        if (_v6ModPromise) return _v6ModPromise;
        _v6ModPromise = new Promise(function (resolve, reject) {
            const existing = document.querySelector('script[src*="js/bed-simulator-v6.js"]');
            if (existing) {
                if (global.WCPPBedSimulatorV6) { resolve(global.WCPPBedSimulatorV6); return; }
                existing.addEventListener("load", function () {
                    if (global.WCPPBedSimulatorV6) resolve(global.WCPPBedSimulatorV6);
                    else { _v6ModPromise = null; reject(new Error("V6 module failed to register.")); }
                }, { once: true });
                existing.addEventListener("error", function () {
                    _v6ModPromise = null;
                    reject(new Error("Failed to load " + V6_MOD_SRC));
                }, { once: true });
                return;
            }
            const sc = document.createElement("script");
            sc.src = V6_MOD_SRC;
            sc.async = false;
            sc.onload = function () {
                if (global.WCPPBedSimulatorV6) resolve(global.WCPPBedSimulatorV6);
                else { _v6ModPromise = null; reject(new Error("V6 module failed to register.")); }
            };
            sc.onerror = function () {
                _v6ModPromise = null;
                reject(new Error("Failed to load " + V6_MOD_SRC));
            };
            document.head.appendChild(sc);
        });
        return _v6ModPromise;
    }

    function getV6Ctx() {
        return {
            core: core,
            getState: function () { return _state; },
            getCatalog: function () { return _catalog; },
            getSubTab: function () { return _subTab; },
            renderSimulator: renderSimulator,
            showToast: showToast,
            svgIcon: svgIcon
        };
    }

    function ensureStudioModalsLoaded() {
        if (global.WCPPBedSimStudioModals) {
            return Promise.resolve(global.WCPPBedSimStudioModals);
        }
        if (_studioModalsPromise) {
            return _studioModalsPromise;
        }
        _studioModalsPromise = new Promise(function (resolve, reject) {
            const existing = document.querySelector('script[src*="js/bed-simulator-studio-modals.js"]');
            if (existing) {
                if (global.WCPPBedSimStudioModals) {
                    resolve(global.WCPPBedSimStudioModals);
                    return;
                }
                existing.addEventListener("load", function () {
                    if (global.WCPPBedSimStudioModals) {
                        resolve(global.WCPPBedSimStudioModals);
                    } else {
                        _studioModalsPromise = null;
                        reject(new Error("Studio modals module failed to register."));
                    }
                }, { once: true });
                existing.addEventListener("error", function () {
                    _studioModalsPromise = null;
                    reject(new Error("Failed to load " + STUDIO_MODALS_SRC));
                }, { once: true });
                return;
            }
            const sc = document.createElement("script");
            sc.src = STUDIO_MODALS_SRC;
            sc.async = false;
            sc.onload = function () {
                if (global.WCPPBedSimStudioModals) {
                    resolve(global.WCPPBedSimStudioModals);
                } else {
                    _studioModalsPromise = null;
                    reject(new Error("Studio modals module failed to register."));
                }
            };
            sc.onerror = function () {
                _studioModalsPromise = null;
                reject(new Error("Failed to load " + STUDIO_MODALS_SRC));
            };
            (document.head || document.body || document.documentElement).appendChild(sc);
        });
        return _studioModalsPromise;
    }

    function prefetchStudioModals() {
        if (_studioModalsPrefetched || global.WCPPBedSimStudioModals) return;
        _studioModalsPrefetched = true;
        ensureStudioModalsLoaded().catch(function () {
            _studioModalsPrefetched = false;
        });
    }

    function escHtml(val) {
        return String(val === null || val === undefined ? "" : val)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function stripEmojis(text) {
        return String(text || "")
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{2712}\u{2714}-\u{27BF}]/gu, "")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    function showToast(msg) {
        const el = document.getElementById("toast");
        if (!el) return;
        el.textContent = msg;
        el.classList.add("show");
        clearTimeout(el._wcppBsTid);
        el._wcppBsTid = setTimeout(function () {
            el.classList.remove("show");
        }, 2600);
    }

    function svgIcon(name, size) {
        const s = size || 15;
        const icons = {
            compare: '<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/>',
            grid: '<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>',
            farm: '<polygon points="3 7 9 4 15 7 21 4 21 17 15 20 9 17 3 20"/><line x1="9" y1="4" x2="9" y2="17"/><line x1="15" y1="7" x2="15" y2="20"/>',
            chart: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3" height="7" rx="0.8"/><rect x="11" y="7" width="3" height="11" rx="0.8"/><rect x="16" y="4" width="3" height="14" rx="0.8"/>',
            nursery: '<path d="M12 21V11"/><path d="M12 11C12 6.5 15.5 4 20 4c0 4.5-2.5 8-8 7Z"/><path d="M12 13C12 9 9 6.5 4 6.5c0 4 2.5 7 8 6.5Z"/>',
            ecology: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
            plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
            undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
            redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
            print: '<polyline points="6 9 6 3 18 3 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
            download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
            upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
            sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>',
            check: '<polyline points="20 6 9 17 4 12"/>',
            alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
            history: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
            spark: '<polygon points="12 2 14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5 12 2"/>',
            fullscreen: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
            minimize: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
            folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
            link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
            shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
            flower: '<circle cx="12" cy="12" r="3"/><path d="M12 2a3 3 0 0 1 0 6 3 3 0 0 1 0-6z"/><path d="M12 16a3 3 0 0 1 0 6 3 3 0 0 1 0-6z"/><path d="M2 12a3 3 0 0 1 6 0 3 3 0 0 1-6 0z"/><path d="M16 12a3 3 0 0 1 6 0 3 3 0 0 1-6 0z"/>',
            layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
            search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
            clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
            copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
            shape: '<polygon points="4 6 14 4 20 11 16 20 5 18"/><circle cx="4" cy="6" r="1.4"/><circle cx="14" cy="4" r="1.4"/><circle cx="20" cy="11" r="1.4"/>',
            pot: '<path d="M5 8h14l-1.5 11a1.5 1.5 0 0 1-1.5 1.3H8A1.5 1.5 0 0 1 6.5 19L5 8Z"/><rect x="4" y="5" width="16" height="3" rx="1"/>',
            mix: '<line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2"/>',
            playground: '<circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="2"/>',
            trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
            move: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
            calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
            droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
            thermometer: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
            shade: '<path d="M12 3L4 9v12h16V9l-8-6z"/><path d="M9 21V12h6v9"/>',
            rotate: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
            blueprint: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'
        };
        return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || "") + "</svg>";
    }

    function getFallbackPlantSvgUrl(sciName, commonName) {
        if (typeof global.generateBotanicalCardSVG === "function") {
            return global.generateBotanicalCardSVG(sciName, commonName);
        }
        const label = escHtml(commonName || sciName || "Plant");
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180"><rect width="240" height="180" fill="#166534"/><path d="M120 140 V65 M120 95 C95 85 88 60 112 52 C125 65 125 82 120 95 Z M120 82 C145 72 152 47 128 39 C115 52 115 69 120 82 Z" fill="none" stroke="#bbf7d0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><text x="120" y="162" text-anchor="middle" fill="#dcfce7" font-family="sans-serif" font-size="13" font-weight="700">' + label.slice(0, 26) + "</text></svg>";
        return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    }

    function getActiveCompareGuild() {
        const ids = ["dropdown1", "dropdown2", "dropdown3", "dropdown4"];
        const out = [];
        ids.forEach(function (id) {
            const el = document.getElementById(id);
            if (!el) return;
            let val = "";
            if (el.tomselect && typeof el.tomselect.getValue === "function") {
                val = el.tomselect.getValue();
            } else if (typeof global.tsInstances !== "undefined" && global.tsInstances[id] && typeof global.tsInstances[id].getValue === "function") {
                val = global.tsInstances[id].getValue();
            } else {
                val = el.value || "";
            }
            if (val && String(val).trim()) out.push(String(val).trim());
        });
        return out;
    }

    function getTodayIso() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + d;
    }

    function formatClockHHMM(ts) {
        const dt = ts ? new Date(ts) : new Date();
        if (Number.isNaN(dt.getTime())) return "now";
        return String(dt.getHours()).padStart(2, "0") + ":" + String(dt.getMinutes()).padStart(2, "0");
    }

    function daysInMonthOfYear(year, moIdx) {
        if (moIdx === 1 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) return 29;
        return DAYS_IN_MONTH[moIdx] || 30;
    }

    function dateToWindowFracRaw(iso, year, startMoIdx, endMoIdx) {
        if (!iso || typeof iso !== "string") return 0;
        const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return 0;
        const yr = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const dy = Number(m[3]);
        const daysInMo = daysInMonthOfYear(yr, mo);
        const contMo = (yr - year) * 12 + mo + (dy - 1) / daysInMo;
        const totalMonths = endMoIdx - startMoIdx + 1;
        return ((contMo - startMoIdx) / totalMonths) * 100;
    }

    function dateToWindowPct(iso, year, startMoIdx, endMoIdx) {
        const raw = dateToWindowFracRaw(iso, year, startMoIdx, endMoIdx);
        return Math.max(0, Math.min(100, +raw.toFixed(3)));
    }

    function getActiveTimelineWindow() {
        if (_timelineZoom === "growing") {
            return { startMoIdx: 2, endMoIdx: 10, count: 9 };
        }
        return { startMoIdx: 0, endMoIdx: 11, count: 12 };
    }

    function formatShortDate(iso) {
        if (!iso || typeof iso !== "string") return "";
        const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return iso;
        const moIdx = Number(m[2]) - 1;
        return (MONTHS[moIdx] || m[2]) + " " + Number(m[3]);
    }

    function syncPrefsCookie(patch) {
        const c = core();
        if (!c || typeof c.writePrefsCookie !== "function") return;
        c.writePrefsCookie(patch);
    }

    function applySavedPrefs() {
        const c = core();
        if (!c || typeof c.readPrefsCookie !== "function") return;
        const prefs = c.readPrefsCookie() || {};
        if (prefs.subTab && VALID_SUBTABS.has(prefs.subTab)) {
            _subTab = prefs.subTab;
        }
        if (prefs.timelineZoom === "growing" || prefs.timelineZoom === "full") {
            _timelineZoom = prefs.timelineZoom;
        }
        if (typeof prefs.swipeHintDismissed === "boolean") {
            _swipeHintDismissed = prefs.swipeHintDismissed;
        }
        if (typeof prefs.cropMapFilter === "string" && prefs.cropMapFilter) {
            _cropMapFilter = prefs.cropMapFilter;
        }
    }

    function syncSavedTabDot() {
        const simTab = document.querySelector('#wcppGardenModeTabs .wcpp-garden-mode-tab[data-mode="simulator"]');
        if (!simTab) return;
        const c = core();
        const plans = c && typeof c.listSavedPlans === "function" ? c.listSavedPlans() : [];
        const hasPlans = plans.length > 0;
        const existingDot = simTab.querySelector(".wcpp-bs-saved-dot");
        if (hasPlans && !existingDot) {
            const dot = document.createElement("span");
            dot.className = "wcpp-bs-saved-dot";
            dot.title = "Saved bed plans available";
            dot.innerHTML = '<span class="wcpp-bs-saved-dot-circle" aria-hidden="true"></span>Saved';
            simTab.appendChild(dot);
        } else if (!hasPlans && existingDot) {
            existingDot.remove();
        }
    }

    function rehydrateSeason(season, cropMap, climateAdjusted) {
        const c = core();
        if (!c || !season || !Array.isArray(season.plantings)) return;
        const blocksById = new Map((season.blocks || []).map(function (b) { return [b.id, b]; }));
        const tunnels = season.tunnels || [];
        season.plantings.forEach(function (p) {
            const crop = cropMap ? c.resolveCrop(cropMap, p.cropName) : null;
            const block = p.blockId ? blocksById.get(p.blockId) : null;
            const dates = c.computePlantingDates(p, crop, block, tunnels, climateAdjusted !== false);
            p.startDate = dates.startDate;
            p.endDate = dates.endDate;
            p.harvestStartDate = dates.harvestStartDate;
            p.harvestEndDate = dates.harvestEndDate;
            p.seedingDate = dates.seedingDate;
            p.transplantDate = dates.transplantDate;
            p.pottingUpDate = dates.pottingUpDate;
            p.effectiveDtm = dates.effectiveDtm;
        });
    }

    function rehydrateAllSeasons() {
        if (!_state || !_catalog) return;
        Object.keys(_state.seasons || {}).forEach(function (yr) {
            rehydrateSeason(_state.seasons[yr], _catalog.cropMap, _state.climateAdjusted);
        });
    }

    function saveCurrentStateSafely() {
        const c = core();
        if (!c || !_state) return;
        if (_sharedPlanBanner && _sharedPlanBanner.active) {
            // Non-destructive protection: promote shared preview to its own new plan copy before saving edits
            const copyName = (_state.planName || "Shared Bed Plan") + " (Copy)";
            c.saveNamedPlan(_state, copyName);
            _sharedPlanBanner = null;
            _previousLocalStateBackup = null;
            syncUrlForMode("simulator", { clearHash: true });
        } else {
            c.saveState(_state);
        }
        _lastSavedAt = Date.now();
        syncSavedTabDot();
    }

    function commitStateChange(mutatorFn, options) {
        const c = core();
        if (!c || !_state) return;
        const opts = options || {};
        if (!opts.skipUndo) c.pushUndo(_state);
        mutatorFn(_state);
        if (opts.rehydrate !== false) rehydrateAllSeasons();
        saveCurrentStateSafely();
        _optimizerPreview = null;
        renderSimulator();
    }

    async function ensureReady() {
        const c = core();
        if (!c) throw new Error("WCPPBedSimCore not loaded");
        if (_catalog && _state) return { catalog: _catalog, state: _state };
        if (!_catalogPromise) {
            _catalogPromise = c.loadCatalog().then(function (cat) {
                _catalog = cat;
                applySavedPrefs();
                _state = c.loadState(cat.starterPresets, cat);
                rehydrateAllSeasons();
                const meta = typeof c.getActivePlanMeta === "function" ? c.getActivePlanMeta() : null;
                if (meta && meta.updatedAt) _lastSavedAt = meta.updatedAt;
                if (_state.farmDefaults && Number.isFinite(Number(_state.farmDefaults.sunOrientationDeg))) {
                    _sunOrientationDeg = Number(_state.farmDefaults.sunOrientationDeg);
                }
                const activeSeason = c.getActiveSeason(_state);
                if (activeSeason && activeSeason.blocks && activeSeason.blocks.length) {
                    _selectedBlockId = activeSeason.blocks[0].id;
                    _stratTargetKey = activeSeason.blocks[0].id + ":1";
                }
                syncSavedTabDot();
                return { catalog: _catalog, state: _state };
            });
        }
        return _catalogPromise;
    }

    function getHostElements() {
        return [
            document.querySelector(".controls-container"),
            document.getElementById("compatibility"),
            document.getElementById("tableToolbar"),
            document.getElementById("results-wrapper"),
            document.getElementById("gardenRelatedArticlesBottom")
        ].filter(Boolean);
    }

    function ensureShellDom() {
        const titleRow = document.querySelector(".page-title-row");
        let tabs = document.getElementById("wcppGardenModeTabs");
        if (titleRow && !tabs) {
            tabs = document.createElement("div");
            tabs.id = "wcppGardenModeTabs";
            tabs.className = "wcpp-garden-mode-tabs";
            tabs.setAttribute("role", "tablist");
            tabs.setAttribute("aria-label", "Garden Planner Mode Switcher");
            tabs.innerHTML =
                '<button type="button" class="wcpp-garden-mode-tab is-active" data-mode="compare" role="tab" aria-selected="true">' +
                    svgIcon("compare", 16) +
                    "<span>Compare Crops</span>" +
                "</button>" +
                '<button type="button" class="wcpp-garden-mode-tab" data-mode="simulator" role="tab" aria-selected="false">' +
                    svgIcon("grid", 16) +
                    "<span>Garden Bed Designer</span>" +
                    '<span class="wcpp-garden-mode-badge">V5</span>' +
                "</button>";
            titleRow.insertAdjacentElement("afterend", tabs);
        }
        if (tabs) {
            tabs.dataset.wcppBsOwner = "ui";
            if (!tabs.dataset.wcppBsUiBound) {
                tabs.dataset.wcppBsUiBound = "1";
                tabs.addEventListener("click", function (e) {
                    const btn = e.target.closest(".wcpp-garden-mode-tab");
                    if (!btn) return;
                    switchMode(btn.getAttribute("data-mode"));
                });
            }
        }

        const mainContent = document.querySelector("main.main-content") || document.querySelector(".main-content");
        let root = document.getElementById("wcppBedSimRoot");
        if (mainContent && !root) {
            root = document.createElement("section");
            root.id = "wcppBedSimRoot";
            root.className = "wcpp-bs-root";
            root.hidden = true;
            root.setAttribute("aria-label", "Garden Bed Designer");
            const relBottom = document.getElementById("gardenRelatedArticlesBottom");
            if (relBottom && relBottom.parentElement === mainContent) {
                relBottom.insertAdjacentElement("afterend", root);
            } else {
                mainContent.appendChild(root);
            }
        }
        if (root && !root.dataset.wcppBsUiBound) {
            root.dataset.wcppBsUiBound = "1";
            bindRootEvents(root);
        }

        if (!document.getElementById("wcppBsModalBackdrop")) {
            const backdrop = document.createElement("div");
            backdrop.id = "wcppBsModalBackdrop";
            backdrop.className = "wcpp-bs-modal-backdrop";
            backdrop.hidden = true;
            backdrop.setAttribute("role", "dialog");
            backdrop.setAttribute("aria-modal", "true");
            document.body.appendChild(backdrop);
            bindModalEvents(backdrop);
        }
    }

    function injectSendGuildButton() {
        const compat = document.getElementById("compatibility");
        if (!compat) return;
        const selected = getActiveCompareGuild();
        let btn = document.getElementById("wcppSendGuildToSimBtn");
        if (!selected.length) {
            if (btn) btn.remove();
            return;
        }
        if (!btn) {
            let targetHost = compat.querySelector(".compat-top-bar > div");
            if (!targetHost) targetHost = compat.querySelector(".compat-empty > div");
            if (!targetHost) targetHost = compat.querySelector(".compat-empty") || compat;
            btn = document.createElement("button");
            btn.type = "button";
            btn.id = "wcppSendGuildToSimBtn";
            btn.className = "wcpp-bs-send-guild-btn";
            btn.innerHTML = svgIcon("grid", 14) + "<span>Send Guild to Bed Designer \u2192</span>";
            targetHost.appendChild(btn);
        }
        btn.dataset.wcppBsOwner = "ui";
        if (!btn.dataset.wcppBsUiBound) {
            btn.dataset.wcppBsUiBound = "1";
            btn.addEventListener("click", function () {
                importGuild(getActiveCompareGuild());
            });
        }
    }

    function initCompatObserver() {
        const compat = document.getElementById("compatibility");
        if (!compat) return;
        injectSendGuildButton();
        if (_compatObserver) _compatObserver.disconnect();
        _compatObserver = new MutationObserver(function () {
            injectSendGuildButton();
        });
        _compatObserver.observe(compat, { childList: true });
    }

    function syncUrlForMode(mode, opts) {
        try {
            const url = new URL(global.location.href);
            if (mode === "simulator") {
                if (!(opts && opts.clearHash && /^#plan=/i.test(url.hash))) {
                    url.searchParams.set("view", "designer");
                }
                if (opts && opts.clearHash) {
                    url.hash = "";
                    url.searchParams.set("view", "designer");
                }
            } else {
                url.searchParams.delete("view");
                if (url.hash === "#simulator" || url.hash === "#designer" || /^#plan=/i.test(url.hash)) {
                    url.hash = "";
                }
            }
            global.history.replaceState({}, "", url.pathname + url.search + url.hash);
        } catch (_) {}
    }

    async function loadSharedPlanFromHash(hashStr) {
        _mode = "simulator";
        ensureShellDom();
        updateModeTabsVisual("simulator");
        const simRoot = document.getElementById("wcppBedSimRoot");
        if (simRoot && (!_catalog || !_state)) {
            simRoot.innerHTML =
                '<div class="wcpp-bs-loading-card" role="status" aria-live="polite">' +
                    '<div class="wcpp-bs-spinner" aria-hidden="true"></div>' +
                    "<div><strong>Decoding Shared Garden Bed Plan...</strong></div>" +
                "</div>";
        }
        try {
            await ensureReady();
            const c = core();
            const decoded = c.decodePlanFromHash(hashStr, _catalog);
            if (!decoded) {
                _sharedPlanBanner = null;
                showToast("Shared plan link could not be decoded; showing your saved plan.");
                renderSimulator();
                return;
            }
            _previousLocalStateBackup = c.cloneState(_state);
            _state = decoded;
            _sharedPlanBanner = {
                active: true,
                planName: decoded.planName || "Shared Bed Plan",
                hash: hashStr
            };
            rehydrateAllSeasons();
            _optimizerPreview = null;
            _selectedPlantingId = null;
            const activeSeason = c.getActiveSeason(_state);
            if (activeSeason && activeSeason.blocks && activeSeason.blocks.length) {
                _selectedBlockId = activeSeason.blocks[0].id;
                _stratTargetKey = activeSeason.blocks[0].id + ":1";
            }
            renderSimulator();
            showToast("Shared bed plan loaded in non-destructive preview.");
        } catch (err) {
            if (simRoot) {
                simRoot.innerHTML = '<div class="wcpp-bs-card"><p>Unable to load shared plan: ' + escHtml(err && err.message || err) + "</p></div>";
            }
        }
    }

    function updateModeTabsVisual(target) {
        const tabs = document.querySelectorAll("#wcppGardenModeTabs .wcpp-garden-mode-tab");
        tabs.forEach(function (t) {
            const active = t.getAttribute("data-mode") === target;
            t.classList.toggle("is-active", active);
            t.setAttribute("aria-selected", active ? "true" : "false");
        });
        const hostEls = getHostElements();
        const simRoot = document.getElementById("wcppBedSimRoot");
        if (target === "simulator") {
            hostEls.forEach(function (el) { el.classList.add("wcpp-bs-host-hidden"); });
            if (simRoot) {
                simRoot.hidden = false;
                simRoot.classList.add("is-active");
            }
        } else {
            hostEls.forEach(function (el) { el.classList.remove("wcpp-bs-host-hidden"); });
            if (simRoot) {
                simRoot.hidden = true;
                simRoot.classList.remove("is-active");
            }
        }
    }

    function switchMode(mode, opts) {
        if (opts && opts.planHash && mode === "simulator") {
            return loadSharedPlanFromHash(opts.planHash);
        }
        const target = mode === "simulator" ? "simulator" : "compare";
        if (target === "compare" && _isFullscreen) {
            toggleFullscreen(false);
        }
        _mode = target;
        ensureShellDom();
        updateModeTabsVisual(target);

        const simRoot = document.getElementById("wcppBedSimRoot");
        if (target === "simulator") {
            if (simRoot && (!_catalog || !_state)) {
                simRoot.innerHTML =
                    '<div class="wcpp-bs-loading-card" role="status" aria-live="polite">' +
                        '<div class="wcpp-bs-spinner" aria-hidden="true"></div>' +
                        "<div><strong>Loading Garden Bed Designer...</strong>" +
                        '<div style="font-size:0.84rem;opacity:0.82;margin-top:2px;">Preparing crop catalog, climate curves, and bed designer.</div></div>' +
                    "</div>";
            }
            ensureReady().then(function () {
                if (_mode === "simulator") renderSimulator();
            }).catch(function (err) {
                if (simRoot) {
                    simRoot.innerHTML = '<div class="wcpp-bs-card"><p>Unable to initialize Garden Bed Designer: ' + escHtml(err && err.message || err) + "</p></div>";
                }
            });
        }

        if (!opts || !opts.skipUrlSync) {
            syncUrlForMode(target);
        }
    }

    function toggleFullscreen(forceState) {
        const next = typeof forceState === "boolean" ? forceState : !_isFullscreen;
        if (next === _isFullscreen) return _isFullscreen;

        if (next) {
            if (_mode !== "simulator") {
                switchMode("simulator");
            }
            _savedScrollX = global.scrollX || global.pageXOffset || 0;
            _savedScrollY = global.scrollY || global.pageYOffset || 0;
            _isFullscreen = true;
            document.body.classList.add("wcpp-bs-fullscreen");
            const root = document.getElementById("wcppBedSimRoot");
            if (root) root.scrollTop = 0;
        } else {
            _isFullscreen = false;
            document.body.classList.remove("wcpp-bs-fullscreen");
            if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
                try {
                    document.exitFullscreen().catch(function () {});
                } catch (_) {}
            }
            const sx = _savedScrollX || 0;
            const sy = _savedScrollY || 0;
            try {
                global.scrollTo(sx, sy);
                if (typeof global.requestAnimationFrame === "function") {
                    global.requestAnimationFrame(function () { global.scrollTo(sx, sy); });
                }
            } catch (_) {}
        }

        if (_mode === "simulator" && _catalog && _state) {
            renderSimulator();
        }
        return _isFullscreen;
    }

    function toggleNativeFullscreen() {
        const root = document.getElementById("wcppBedSimRoot");
        if (!root) return;
        if (document.fullscreenElement) {
            if (typeof document.exitFullscreen === "function") {
                document.exitFullscreen().catch(function () {});
            }
            return;
        }
        if (!_isFullscreen) toggleFullscreen(true);
        if (typeof root.requestFullscreen === "function") {
            root.requestFullscreen().catch(function () {
                showToast("Studio expanded to full viewport.");
            });
        }
    }

    async function importGuild(crops) {
        const list = Array.isArray(crops) && crops.length ? crops : getActiveCompareGuild();
        if (!list.length) {
            showToast("Select at least one crop in Compare Crops first.");
            return;
        }
        await ensureReady();
        const c = core();
        const season = c.getActiveSeason(_state);
        if (!season) return;

        c.pushUndo(_state);
        const frost = c.getFrostWindow(season.year);
        let importedCount = 0;

        list.forEach(function (rawName, idx) {
            const crop = c.resolveCrop(_catalog.cropMap, rawName);
            const canonical = crop ? crop.name : String(rawName).trim();
            if (!canonical) return;
            const isTender = crop && crop.frostTolerance === "tender";
            const startIso = isTender ? c.addDaysIso(frost.lastSpringIso, 14) : (season.year + "-04-15");
            const isComp = idx > 0 && Boolean(crop && crop.interplantable);
            const p = {
                id: "guild_" + Date.now() + "_" + idx + "_" + Math.floor(Math.random() * 1000),
                cropName: canonical,
                label: canonical,
                blockId: null,
                bedStart: null,
                bedCount: idx === 0 ? 1.0 : 0.5,
                startDate: startIso,
                lockHarvestDate: false,
                interplanted: isComp,
                interplantMode: isComp ? "border" : "sole",
                interplantSharePct: 50,
                borderSides: 2,
                method: (crop && crop.method) || "Direct Seed",
                notes: "Imported from Compare Crops guild"
            };
            season.plantings.push(p);
            importedCount += 1;
        });

        rehydrateSeason(season, _catalog.cropMap, _state.climateAdjusted);
        saveCurrentStateSafely();
        _subTab = "crop-map";
        syncPrefsCookie({ subTab: _subTab });
        switchMode("simulator");
        showToast("Imported " + importedCount + " guild crop(s) into Planting Bench.");
    }

    function importFromMyGardenPlan() {
        if (!global.WCPPGardenPlan || typeof global.WCPPGardenPlan.getAll !== "function") {
            showToast("My Garden Plan is unavailable on this page.");
            return;
        }
        const saved = global.WCPPGardenPlan.getAll() || [];
        if (!saved.length) {
            showToast("Your saved My Garden Plan list is empty.");
            return;
        }
        const names = saved.map(function (item) {
            return item.commonName || item.latinName || "";
        }).filter(Boolean);
        importGuild(names);
    }

    function copyTextToClipboard(text, okMsg) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(text).then(function () {
                showToast(okMsg);
            }).catch(function () {
                fallbackCopyText(text, okMsg);
            });
            return;
        }
        fallbackCopyText(text, okMsg);
    }

    function fallbackCopyText(text, okMsg) {
        try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
            showToast(okMsg);
        } catch (_) {
            showToast("Share link ready in URL bar.");
        }
    }

    function buildShareableUrlForState(stateObj) {
        const c = core();
        const hash = c.encodePlanToHash(stateObj);
        if (!hash) return "";
        try {
            const url = new URL(global.location.href);
            url.searchParams.delete("view");
            url.hash = hash;
            return url.toString();
        } catch (_) {
            return hash;
        }
    }

    function getEffectiveMode(p) {
        if (!p || typeof p !== "object") return "sole";
        const m = p.interplantMode;
        if (m === "sole" || m === "lanes" || m === "border" || m === "understory" || m === "relay") {
            return m;
        }
        return p.interplanted ? "border" : "sole";
    }

    function getInterplantModeLabel(p, isShort) {
        const mode = getEffectiveMode(p);
        if (mode === "lanes") {
            const pct = Math.max(15, Math.min(85, Math.round(Number((p && p.interplantSharePct) || 50))));
            return (isShort ? "Lanes " : "Alternating Lanes ") + pct + "%";
        }
        if (mode === "border") return isShort ? "Border" : "Border Strip";
        if (mode === "understory") return "Understory";
        if (mode === "relay") return "Relay";
        return isShort ? "Full" : "Full Bed";
    }

    function getPlantingBarColor(p, crop, block, tunnels) {
        const c = core();
        const opts = (_state && _state.displayOptions) || {};
        if (opts.colorByFamily) {
            return c.getFamilyColor((crop && crop.family) || "Other");
        }
        const mode = getEffectiveMode(p);
        if (mode === "border") return "#d97706";
        if (mode === "understory") return "#0d9488";
        if (mode === "relay") return "#4f46e5";
        if (block && block.type === "greenhouse") {
            return "#0f766e";
        }
        if (block && tunnels && p.bedStart) {
            const bStart = Number(p.bedStart);
            const bEnd = bStart + Math.max(1, Math.ceil(Number(p.bedCount || 1))) - 1;
            const underTunnel = tunnels.some(function (t) {
                return t.blockId === block.id && Math.max(bStart, t.startBed) <= Math.min(bEnd, t.endBed);
            });
            if (underTunnel) return "#0369a1";
        }
        return c.getCategoryColor((crop && crop.category) || "Vegetable");
    }

    function isContainerBlock(block) {
        const c = core();
        return Boolean(block && c && typeof c.isContainerBlockType === "function" && c.isContainerBlockType(block.type));
    }

    function getBlockTypeLabel(block) {
        if (!block) return "Field Block";
        if (block.shapeType === "custom" && block.customShape) return "Custom Shape";
        if (block.type === "pot") return "Pot / Grow Bag";
        if (block.type === "basket") return "Hanging Basket";
        if (block.type === "bench") return "Growing Bench";
        if (block.type === "greenhouse") return "Greenhouse";
        return "Field Block";
    }

    function getContainerCardClass(block) {
        if (!block) return "";
        if (block.type === "pot") return " is-container-pot";
        if (block.type === "basket") return " is-container-basket";
        if (block.type === "bench") return " is-container-bench";
        return "";
    }

    function getBlockPlacedPlantCount(season, blockId, bedNumberOpt) {
        const list = (season && Array.isArray(season.placedPlants)) ? season.placedPlants : [];
        let count = 0;
        for (let i = 0; i < list.length; i++) {
            const pp = list[i];
            if (!pp || pp.blockId !== blockId) continue;
            if (bedNumberOpt !== undefined && bedNumberOpt !== null && Number(pp.bedNumber || 1) !== Number(bedNumberOpt)) continue;
            count += 1;
        }
        return count;
    }

    function formatContainerSummaryBadge(block, units) {
        const c = core();
        if (!isContainerBlock(block)) return "";
        const geom = c.computeContainerGeometry(block.containerSpec || block, block.type);
        const typeLbl = block.type === "basket" ? "Hanging Basket" : (block.type === "bench" ? "Bench" : "Pot");
        const isImp = units === "imperial";
        const volStr = Math.round(geom.volumeLiters) + " L";
        if (geom.shapeKind === "circle") {
            const diamStr = isImp ? (Math.round(geom.diameterCm / 2.54) + '"') : (Math.round(geom.diameterCm) + " cm");
            return typeLbl + " \u00b7 " + diamStr + " \u00b7 " + volStr;
        }
        if (block.type === "bench") {
            const dimStr = isImp
                ? (c.mToFt(geom.lengthCm / 100) + "\u00d7" + c.mToFt(geom.widthCm / 100) + " ft")
                : (Math.round(geom.lengthCm) + "\u00d7" + Math.round(geom.widthCm) + " cm");
            return typeLbl + " \u00b7 " + dimStr + " \u00b7 " + volStr;
        }
        const dimStr = isImp
            ? (c.cmToIn(geom.lengthCm) + "\u00d7" + c.cmToIn(geom.widthCm) + '"')
            : (Math.round(geom.lengthCm) + "\u00d7" + Math.round(geom.widthCm) + " cm");
        return typeLbl + " \u00b7 " + dimStr + " \u00b7 " + volStr;
    }

    function formatGrowingMediaChip(block) {
        const c = core();
        if (!block || typeof c.normalizeGrowingMedia !== "function") return "";
        const media = c.normalizeGrowingMedia(block.growingMedia, block.type || "field");
        if (!media) return "";
        if (media.presetId && media.presetId !== "custom") {
            return "Media: " + (media.name || media.presetId);
        }
        const byId = new Map((c.GROWING_MEDIA_INGREDIENTS || []).map(function (ing) { return [ing.id, ing.label]; }));
        const top = (media.ingredients || []).slice().sort(function (a, b) { return b.pct - a.pct; }).slice(0, 2);
        if (!top.length) return "Media: " + (media.name || "Custom Mix");
        return "Media: " + top.map(function (it) {
            return (byId.get(it.id) || it.id) + " " + Math.round(it.pct) + "%";
        }).join(" + ");
    }

    function formatBedSizeSummary(block, units) {
        const c = core();
        if (isContainerBlock(block)) {
            const geom = c.computeContainerGeometry(block.containerSpec || block, block.type);
            const isImp = units === "imperial";
            const areaDisp = isImp ? (geom.surfaceAreaFt2 + " ft\u00b2") : (geom.surfaceAreaM2 + " m\u00b2");
            const volDisp = geom.volumeLiters + " L (" + geom.volumeGallons + " gal)";
            const depthDisp = isImp ? (c.cmToIn(geom.depthCm) + '" H') : (Math.round(geom.depthCm) + " cm H");
            if (geom.shapeKind === "circle") {
                const diamDisp = isImp ? (c.cmToIn(geom.diameterCm) + '" \u00d8') : (Math.round(geom.diameterCm) + " cm \u00d8");
                return diamDisp + " \u00d7 " + depthDisp + " \u00b7 " + volDisp + " \u00b7 " + areaDisp;
            }
            const lDisp = block.type === "bench"
                ? (isImp ? (c.mToFt(geom.lengthCm / 100) + " ft") : (Math.round(geom.lengthCm) + " cm"))
                : (isImp ? (c.cmToIn(geom.lengthCm) + '"') : (Math.round(geom.lengthCm) + " cm"));
            const wDisp = block.type === "bench"
                ? (isImp ? (c.mToFt(geom.widthCm / 100) + " ft") : (Math.round(geom.widthCm) + " cm"))
                : (isImp ? (c.cmToIn(geom.widthCm) + '"') : (Math.round(geom.widthCm) + " cm"));
            return lDisp + " \u00d7 " + wDisp + " \u00d7 " + depthDisp + " \u00b7 " + volDisp;
        }
        if (block && block.shapeType === "custom" && block.customShape) {
            const geom = typeof c.computeCustomShapeGeometry === "function" ? c.computeCustomShapeGeometry(block.customShape) : null;
            const areaM2 = geom ? geom.areaM2 : Number(block.areaM2 || 0);
            const areaStr = units === "imperial"
                ? ((geom ? geom.areaFt2 : +(areaM2 * 10.7639).toFixed(2)) + " ft\u00b2")
                : (areaM2 + " m\u00b2");
            const lenM = geom ? geom.widthCm / 100 : Number(block.bedLengthM || 1);
            const widCm = geom ? geom.heightCm : Number(block.bedWidthCm || 75);
            const l = units === "imperial" ? (c.mToFt(lenM) + " ft") : (Number(lenM).toFixed(1).replace(/\.0$/, "") + " m");
            const w = units === "imperial" ? (c.cmToIn(widCm) + " in") : (Math.round(widCm) + " cm");
            return "Custom \u00b7 " + areaStr + " (" + l + " \u00d7 " + w + ")";
        }
        const w = units === "imperial" ? (c.cmToIn(block.bedWidthCm) + " in") : (Math.round(block.bedWidthCm) + " cm");
        const l = units === "imperial" ? (c.mToFt(block.bedLengthM) + " ft") : (Number(block.bedLengthM).toFixed(1).replace(/\.0$/, "") + " m");
        return block.bedCount + " bed" + (block.bedCount === 1 ? "" : "s") + " \u00b7 " + l + " \u00d7 " + w;
    }

    function doesPlantingMatchFilter(p, crop, rels) {
        const q = _cropMapSearch.trim().toLowerCase();
        if (q) {
            const hay = [
                p.label,
                p.cropName,
                p.notes,
                crop && crop.latin,
                crop && crop.family,
                crop && crop.category
            ].filter(Boolean).join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
        }
        if (_cropMapFilter === "all") return true;
        if (_cropMapFilter === "natives") return Boolean(crop && (crop.isNativeBC || crop.category === "BC Native"));
        if (_cropMapFilter === "pollinators") {
            return Boolean(crop && (
                (Array.isArray(crop.bloomMonths) && crop.bloomMonths.length > 0) ||
                crop["Pollinators Attracted"] ||
                crop.Pollinators ||
                crop.Common_Bee_Visitors ||
                crop.category === "Flower" ||
                crop.category === "Herb"
            ));
        }
        if (_cropMapFilter === "conflicts") {
            return Boolean(rels && rels.conflictCount > 0);
        }
        if (_cropMapFilter.indexOf("family:") === 0) {
            const fam = _cropMapFilter.slice(7);
            return ((crop && crop.family) || "Other") === fam;
        }
        if (_cropMapFilter.indexOf("cat:") === 0) {
            const cat = _cropMapFilter.slice(4);
            return ((crop && crop.category) || "Vegetable") === cat;
        }
        return true;
    }

    function isFilterActive() {
        return Boolean(_cropMapSearch.trim() || _cropMapFilter !== "all");
    }

    function renderStudioBar(plansCount) {
        const activeName = (_state && _state.planName) || "Garden Plan";
        const autoLabel = (_sharedPlanBanner && _sharedPlanBanner.active)
            ? "Shared Preview"
            : ("Saved " + formatClockHHMM(_lastSavedAt));
        const hasNativeFs = typeof document.documentElement.requestFullscreen === "function";
        const isNativeFs = Boolean(document.fullscreenElement);

        return '<div class="wcpp-bs-studio-bar">' +
            '<div class="wcpp-bs-toolbar-group">' +
                '<button type="button" class="wcpp-bs-plan-pill" data-action="open-plans-modal" title="Manage saved plans">' +
                    svgIcon("folder", 14) +
                    "<span>" + escHtml(activeName) + "</span>" +
                "</button>" +
                '<span class="wcpp-bs-autosave-pill" id="wcppBsAutosavePill">' +
                    svgIcon("clock", 12) +
                    "<span>" + escHtml(autoLabel) + "</span>" +
                "</span>" +
                (!_catalog.enriched ? '<span class="wcpp-bs-badge">Enriching 389+ species...</span>' : '<span class="wcpp-bs-badge wcpp-bs-status-ok">' + _catalog.crops.length + " species ready</span>") +
            "</div>" +
            '<div class="wcpp-bs-toolbar-group">' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm wcpp-bs-btn-primary" data-action="open-blueprints" title="Browse curated Coastal BC starter garden blueprints">' +
                    svgIcon("blueprint", 13) +
                    "<span>Blueprints</span>" +
                "</button>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="open-plans-modal">' +
                    svgIcon("folder", 13) +
                    "<span>Plans (" + plansCount + ")</span>" +
                "</button>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="copy-share-link" title="Copy #plan= shareable URL">' +
                    svgIcon("link", 13) +
                    "<span>Share Link</span>" +
                "</button>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm' + (_isFullscreen ? " wcpp-bs-btn-primary" : "") + '" data-action="toggle-fullscreen" title="Toggle Full-Screen Studio (F)">' +
                    svgIcon(_isFullscreen ? "minimize" : "fullscreen", 13) +
                    "<span>" + (_isFullscreen ? "Exit Full Screen" : "Full Screen") + "</span>" +
                "</button>" +
                (hasNativeFs ? (
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="toggle-native-fullscreen" title="Browser Fullscreen">' +
                        svgIcon(isNativeFs ? "minimize" : "fullscreen", 13) +
                        "<span>" + (isNativeFs ? "Exit Native" : "Expand") + "</span>" +
                    "</button>"
                ) : "") +
            "</div>" +
        "</div>";
    }

    function renderSharedPlanBanner() {
        if (!_sharedPlanBanner || !_sharedPlanBanner.active) return "";
        return '<div class="wcpp-bs-shared-banner" role="status">' +
            '<div>' +
                svgIcon("link", 15) +
                " <strong>Shared Bed Plan Loaded:</strong> " + escHtml(_sharedPlanBanner.planName) +
                ' <span style="opacity:0.85;">(Preview only — your saved local plans are untouched)</span>' +
            "</div>" +
            '<div class="wcpp-bs-shared-banner-actions">' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="save-shared-copy">Save Copy</button>' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="dismiss-shared-plan">Dismiss</button>' +
            "</div>" +
        "</div>";
    }

    function renderKpiStrip(season, score, nursery) {
        const c = core();
        const plantings = (season && season.plantings) || [];
        const assigned = plantings.filter(function (p) { return p.blockId && p.bedStart; }).length;
        const blocksById = new Map(((season && season.blocks) || []).map(function (b) { return [b.id, b]; }));
        let totalCad = 0;
        plantings.forEach(function (p) {
            const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
            const block = p.blockId ? blocksById.get(p.blockId) : null;
            const m = c.computePlantingMetrics(p, crop, block, _state.units);
            totalCad += Number(m.estValueCad || 0);
        });
        const benchDisp = _state.units === "imperial"
            ? Math.round(nursery.capacityM2 * 10.7639) + " ft\u00b2"
            : nursery.capacityM2 + " m\u00b2";

        return '<div class="wcpp-bs-kpi-strip">' +
            '<div class="wcpp-bs-kpi-card">' +
                '<div class="wcpp-bs-kpi-label">Scheduled Plantings</div>' +
                '<div class="wcpp-bs-kpi-val">' + assigned + " / " + plantings.length + "</div>" +
                '<div class="wcpp-bs-kpi-sub">' + (plantings.length - assigned) + " on Planting Bench</div>" +
            "</div>" +
            '<div class="wcpp-bs-kpi-card">' +
                '<div class="wcpp-bs-kpi-label">Garden Bed Health</div>' +
                '<div class="wcpp-bs-kpi-val">' + score.overall + "%</div>" +
                '<div class="wcpp-bs-kpi-sub">Rotations ' + score.rotations + "% \u00b7 Structure " + score.structure + "%</div>" +
            "</div>" +
            '<div class="wcpp-bs-kpi-card">' +
                '<div class="wcpp-bs-kpi-label">Est. Season Revenue</div>' +
                '<div class="wcpp-bs-kpi-val">$' + Math.round(totalCad).toLocaleString("en-CA") + "</div>" +
                '<div class="wcpp-bs-kpi-sub">CAD Farmgate Baseline</div>' +
            "</div>" +
            '<div class="wcpp-bs-kpi-card">' +
                '<div class="wcpp-bs-kpi-label">Peak Nursery Bench</div>' +
                '<div class="wcpp-bs-kpi-val">' + nursery.peakUtilizationPct + "%</div>" +
                '<div class="wcpp-bs-kpi-sub">Week ' + nursery.peakWeek + " (" + nursery.totalTrays + " trays / " + benchDisp + ")</div>" +
            "</div>" +
        "</div>";
    }

    function renderToolbar(season) {
        const c = core();
        const presets = (_catalog && _catalog.starterPresets) || [];
        const years = Object.keys(_state.seasons || {}).map(Number).sort(function (a, b) { return a - b; });
        const climateInfo = c.getClimateInfo();
        const climateOn = _state.climateAdjusted !== false;
        const opts = _state.displayOptions || {};
        const undoOk = c.canUndo(_state);
        const redoOk = c.canRedo(_state);

        let presetOptions = presets.map(function (pr) {
            return '<option value="' + escHtml(pr.id) + '"' + (_state.activePresetId === pr.id ? " selected" : "") + ">" + escHtml(pr.name || pr.id) + "</option>";
        }).join("");
        if (!presets.some(function (pr) { return pr.id === _state.activePresetId; })) {
            presetOptions += '<option value="' + escHtml(_state.activePresetId) + '" selected>Custom Farm</option>';
        }

        const yearOptions = years.map(function (y) {
            return '<option value="' + y + '"' + (Number(_state.activeSeason) === y ? " selected" : "") + ">Season " + y + "</option>";
        }).join("");
        const nextRotateYear = (years.length ? Math.max.apply(null, years) : Number(_state.activeSeason || 2026)) + 1;

        return '<div class="wcpp-bs-toolbar">' +
            '<div class="wcpp-bs-toolbar-row">' +
                '<div class="wcpp-bs-toolbar-group">' +
                    '<select class="wcpp-bs-select" data-action="preset-change" aria-label="Farm Preset">' + presetOptions + "</select>" +
                    '<select class="wcpp-bs-select" data-action="season-change" aria-label="Season Year">' + yearOptions + "</select>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="duplicate-season" title="Duplicate active season forward one year">' + svgIcon("plus", 13) + "<span>Duplicate Season</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="auto-rotate-season" title="Create Season ' + nextRotateYear + ' and auto-rotate non-perennial crops to minimize family rotation conflicts">' + svgIcon("rotate", 13) + "<span>Auto-Rotate to " + nextRotateYear + "</span></button>" +
                    '<div class="wcpp-bs-segmented" role="group" aria-label="Measurement Units">' +
                        '<button type="button" class="wcpp-bs-seg-btn' + (_state.units !== "imperial" ? " is-active" : "") + '" data-action="set-units" data-units="metric">Metric</button>' +
                        '<button type="button" class="wcpp-bs-seg-btn' + (_state.units === "imperial" ? " is-active" : "") + '" data-action="set-units" data-units="imperial">Imperial</button>' +
                    "</div>" +
                    '<button type="button" class="wcpp-bs-chip-toggle' + (climateOn ? " is-on" : "") + '" data-action="toggle-climate" title="Adjust DTM week-by-week from South Coastal BC monthly temps">' +
                        svgIcon("sun", 13) +
                        "<span>Climate DTM: " + (climateOn ? "ON" : "OFF") + "</span>" +
                    "</button>" +
                    '<span class="wcpp-bs-climate-pill" title="Active municipality frost window">' +
                        escHtml(climateInfo.name) + " \u00b7 " + escHtml(climateInfo.lastSpring) + " \u2013 " + escHtml(climateInfo.firstFall) +
                    "</span>" +
                "</div>" +
                '<div class="wcpp-bs-toolbar-group">' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="undo"' + (undoOk ? "" : " disabled") + ' title="Undo (Ctrl+Z)">' + svgIcon("undo", 13) + "<span>Undo</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="redo"' + (redoOk ? "" : " disabled") + ' title="Redo (Ctrl+Y)">' + svgIcon("redo", 13) + "<span>Redo</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="add-planting">' + svgIcon("plus", 14) + "<span>Add Planting</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="open-playground" title="Open interactive Plant Playground for the active bed or container">' + svgIcon("playground", 14) + "<span>Plant Playground</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="open-shape-designer" title="Open architectural graph-paper custom bed shape designer">' + svgIcon("shape", 14) + "<span>Draw Bed Shape</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="import-garden" title="Import crops saved in My Garden Plan">' + svgIcon("nursery", 13) + "<span>Import My Garden</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="print">' + svgIcon("print", 13) + "<span>Print</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="export-csv">' + svgIcon("download", 13) + "<span>CSV</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="export-json">' + svgIcon("download", 13) + "<span>JSON</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="import-json">' + svgIcon("upload", 13) + "<span>Import JSON</span></button>" +
                    '<input type="file" id="wcppBsImportJsonInput" accept="application/json,.json" hidden>' +
                "</div>" +
            "</div>" +
            (_subTab === "crop-map" ? renderDisplaySwitchesRow(opts) : "") +
        "</div>";
    }

    function renderDisplaySwitchesRow(opts) {
        const c = core();
        const switches = [
            { key: "highlightActive", label: "Highlight Active" },
            { key: "highlightInterplanted", label: "Highlight Interplanted" },
            { key: "colorByFamily", label: "Color by Botanical Family" },
            { key: "showFrostToday", label: "Frost & Today Lines" },
            { key: "showTunnels", label: "Tunnels & Hatched Beds" }
        ];
        const swHtml = switches.map(function (sw) {
            const on = Boolean(opts[sw.key]);
            return '<button type="button" class="wcpp-bs-switch' + (on ? " is-on" : "") + '" data-action="toggle-display" data-key="' + sw.key + '" aria-pressed="' + (on ? "true" : "false") + '">' +
                escHtml(sw.label) +
            "</button>";
        }).join("");

        let familyLegendHtml = "";
        if (opts.colorByFamily && _catalog && _state) {
            const season = c.getActiveSeason(_state);
            const seenFams = new Set();
            ((season && season.plantings) || []).forEach(function (p) {
                const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
                if (crop && crop.family) seenFams.add(crop.family);
            });
            if (seenFams.size) {
                familyLegendHtml = Array.from(seenFams).slice(0, 8).map(function (fam) {
                    return '<span class="wcpp-bs-legend-item"><span class="wcpp-bs-swatch" style="background:' + escHtml(c.getFamilyColor(fam)) + ';"></span>' + escHtml(fam) + "</span>";
                }).join("");
            }
        }

        return '<div class="wcpp-bs-switches-bar">' +
            '<div class="wcpp-bs-toolbar-group">' + swHtml + "</div>" +
            '<div class="wcpp-bs-legend">' +
                familyLegendHtml +
                '<span class="wcpp-bs-legend-item"><span class="wcpp-bs-swatch" style="background:#0369a1; border-style:dashed;"></span>Tunnel</span>' +
                '<span class="wcpp-bs-legend-item"><span class="wcpp-bs-swatch" style="background:repeating-linear-gradient(45deg,#f8fafc,#f8fafc 3px,#cbd5e1 3px,#cbd5e1 5px);"></span>Hatched Neighbor</span>' +
                '<span class="wcpp-bs-legend-item"><span class="wcpp-bs-swatch" style="background:#d97706; border-style:dashed;"></span>Interplanted</span>' +
                '<span class="wcpp-bs-legend-item"><span class="wcpp-bs-swatch" style="background:#dc2626; height:3px;"></span>Today</span>' +
            "</div>" +
        "</div>";
    }

    function renderCropMapFilterStrip(season) {
        const c = core();
        const plantings = (season && season.plantings) || [];
        const famCounts = new Map();
        const catCounts = new Map();

        plantings.forEach(function (p) {
            const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
            const fam = (crop && crop.family) || "";
            const cat = (crop && crop.category) || "";
            if (fam && fam !== "Other") famCounts.set(fam, (famCounts.get(fam) || 0) + 1);
            if (cat) catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
        });

        const topFams = Array.from(famCounts.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3);
        const topCats = Array.from(catCounts.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 2);

        const basePills = [
            { id: "all", label: "All" },
            { id: "natives", label: "Natives" },
            { id: "pollinators", label: "Pollinators" },
            { id: "conflicts", label: "Alerts/Conflicts" }
        ];
        topFams.forEach(function (entry) {
            basePills.push({ id: "family:" + entry[0], label: entry[0] });
        });
        topCats.forEach(function (entry) {
            basePills.push({ id: "cat:" + entry[0], label: entry[0] });
        });

        const pillsHtml = basePills.map(function (fp) {
            const active = _cropMapFilter === fp.id;
            return '<button type="button" class="wcpp-bs-filter-pill' + (active ? " is-active" : "") + '" data-action="cropmap-filter" data-filter="' + escHtml(fp.id) + '" aria-pressed="' + (active ? "true" : "false") + '">' +
                escHtml(fp.label) +
            "</button>";
        }).join("");

        return '<div class="wcpp-bs-filter-strip">' +
            '<input type="search" id="wcppCropMapSearch" class="wcpp-bs-input wcpp-bs-filter-search" data-action="cropmap-search" value="' + escHtml(_cropMapSearch) + '" placeholder="Search crop, family, notes..." aria-label="Filter plantings on season timeline">' +
            '<div class="wcpp-bs-filter-pills">' + pillsHtml + "</div>" +
            '<div class="wcpp-bs-zoom-segmented" role="group" aria-label="Timeline Window">' +
                '<button type="button" class="wcpp-bs-seg-btn' + (_timelineZoom !== "growing" ? " is-active" : "") + '" data-action="set-timeline-zoom" data-zoom="full">Jan\u2013Dec</button>' +
                '<button type="button" class="wcpp-bs-seg-btn' + (_timelineZoom === "growing" ? " is-active" : "") + '" data-action="set-timeline-zoom" data-zoom="growing">Mar\u2013Nov</button>' +
            "</div>" +
        "</div>";
    }

    function renderSelectedNudgeBarHtml(season) {
        if (!season || !_selectedPlantingId) return "";
        const p = (season.plantings || []).find(function (x) { return x.id === _selectedPlantingId; });
        if (!p) return "";
        const c = core();
        const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
        const block = p.blockId ? (season.blocks || []).find(function (b) { return b.id === p.blockId; }) : null;
        const d = c.computePlantingDates(p, crop, block, season.tunnels || [], _state.climateAdjusted !== false);
        const locLabel = block && p.bedStart ? (block.name + " Bed " + p.bedStart) : "Planting Bench (Unplaced)";

        return '<div class="wcpp-bs-nudge-bar" role="region" aria-label="Selected planting quick date-nudge controls">' +
            '<div>' +
                "<strong>" + escHtml(p.label || p.cropName) + "</strong> " +
                '<span class="wcpp-bs-badge">' + escHtml(locLabel) + "</span> " +
                '<span style="font-size:0.78rem; opacity:0.85;">' + escHtml(formatShortDate(d.startDate)) + " \u2192 " + escHtml(formatShortDate(d.harvestEndDate)) + " (" + d.effectiveDtm + "d)</span>" +
            "</div>" +
            '<div class="wcpp-bs-toolbar-group">' +
                '<button type="button" class="wcpp-bs-nudge-btn" data-action="nudge-planting" data-planting-id="' + escHtml(p.id) + '" data-delta-start="-7" data-delta-dur="0" title="Shift start 7 days earlier">-7d</button>' +
                '<button type="button" class="wcpp-bs-nudge-btn" data-action="nudge-planting" data-planting-id="' + escHtml(p.id) + '" data-delta-start="7" data-delta-dur="0" title="Shift start 7 days later">+7d</button>' +
                '<button type="button" class="wcpp-bs-nudge-btn" data-action="nudge-planting" data-planting-id="' + escHtml(p.id) + '" data-delta-start="0" data-delta-dur="-7" title="Shorten DTM duration by 7 days">-7d dur</button>' +
                '<button type="button" class="wcpp-bs-nudge-btn" data-action="nudge-planting" data-planting-id="' + escHtml(p.id) + '" data-delta-start="0" data-delta-dur="7" title="Extend DTM duration by 7 days">+7d dur</button>' +
                '<button type="button" class="wcpp-bs-nudge-btn" data-action="quick-succession" data-planting-id="' + escHtml(p.id) + '" title="Add next +14d succession">+ Succession</button>' +
                '<button type="button" class="wcpp-bs-nudge-btn" data-action="edit-planting" data-planting-id="' + escHtml(p.id) + '">Inspect</button>' +
            "</div>" +
        "</div>";
    }

    function renderSwipeHintBanner() {
        if (_swipeHintDismissed) return "";
        return '<div class="wcpp-bs-swipe-hint" role="note">' +
            "<span>Swipe timeline \u2194 horizontally to inspect all beds</span>" +
            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="dismiss-swipe-hint" aria-label="Dismiss swipe hint">\u00d7</button>' +
        "</div>";
    }

    function renderUnassignedTray(season) {
        const c = core();
        const filtering = isFilterActive();
        const allUnassigned = (season.plantings || []).filter(function (p) {
            return !p.blockId || !p.bedStart;
        });
        const visibleUnassigned = allUnassigned.filter(function (p) {
            if (!filtering) return true;
            const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
            const rels = c.checkCompanionRelationships(p, season, _catalog.cropMap);
            return doesPlantingMatchFilter(p, crop, rels);
        });

        const cardsHtml = visibleUnassigned.length
            ? visibleUnassigned.map(function (p) {
                const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
                const fam = (crop && crop.family) || "Other";
                const m = c.computePlantingMetrics(p, crop, null, _state.units);
                const d = c.computePlantingDates(p, crop, null, season.tunnels || [], _state.climateAdjusted !== false);
                const borderCol = getPlantingBarColor(p, crop, null, null);

                const mode = getEffectiveMode(p);
                const modeLabel = mode !== "sole" ? getInterplantModeLabel(p, true) : "";

                return '<div class="wcpp-bs-unassigned-card" draggable="true" data-planting-id="' + escHtml(p.id) + '" style="border-left-color:' + escHtml(borderCol) + ';">' +
                    '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">' +
                        '<strong style="font-size:0.86rem;">' + escHtml(p.label || (crop ? crop.name : p.cropName)) + "</strong>" +
                        '<span class="wcpp-bs-badge">' + escHtml(m.bedCount) + " bed</span>" +
                    "</div>" +
                    '<div style="font-size:0.74rem; color:var(--bs-muted); margin:3px 0 6px;">' +
                        escHtml(fam) + " \u00b7 " + escHtml(formatShortDate(d.startDate)) + " \u2192 " + escHtml(formatShortDate(d.harvestEndDate)) +
                        (modeLabel ? ' \u00b7 <strong style="color:var(--bs-interplant);">' + escHtml(modeLabel) + "</strong>" : "") +
                    "</div>" +
                    '<div style="display:flex; gap:5px; flex-wrap:wrap;">' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-xs" data-action="quick-assign" data-planting-id="' + escHtml(p.id) + '">Quick Assign</button>' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="edit-planting" data-planting-id="' + escHtml(p.id) + '">Edit</button>' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-action="delete-planting" data-planting-id="' + escHtml(p.id) + '" title="Delete planting">\u00d7</button>' +
                    "</div>" +
                "</div>";
            }).join("")
            : '<p style="margin:4px 0; font-size:0.82rem; color:var(--bs-muted);">' +
                (allUnassigned.length ? "No unplaced plantings match the current filter." : "All plantings are placed in beds. Drag any bed bar here to unplace, or click + Add Planting.") +
              "</p>";

        return '<aside class="wcpp-bs-tray" data-drop-tray="true">' +
            '<div class="wcpp-bs-tray-header">' +
                '<strong style="font-size:0.92rem;">Planting Bench (Unplaced) (' + visibleUnassigned.length + (filtering && visibleUnassigned.length !== allUnassigned.length ? "/" + allUnassigned.length : "") + ")</strong>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="add-planting">' + svgIcon("plus", 12) + "<span>New</span></button>" +
            "</div>" +
            '<div class="wcpp-bs-tray-list">' + cardsHtml + "</div>" +
        "</aside>";
    }

    function computeBedLanes(placedBars) {
        const sorted = placedBars.slice().sort(function (a, b) {
            if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
            const aPri = (a.mode === "sole" || a.mode === "lanes") ? 0 : 1;
            const bPri = (b.mode === "sole" || b.mode === "lanes") ? 0 : 1;
            if (aPri !== bPri) return aPri - bPri;
            return b.bedCount - a.bedCount;
        });
        const laneInfo = new Map();
        const byBed = new Map();

        sorted.forEach(function (item) {
            const p = item.p;
            const mode = item.mode || getEffectiveMode(p);
            if (item.bedCount > 1) {
                laneInfo.set(p.id, { offsetFrac: 0, widthFrac: item.spanBeds });
                return;
            }
            const bedNum = Number(p.bedStart);
            if (!byBed.has(bedNum)) byBed.set(bedNum, []);
            byBed.get(bedNum).push(Object.assign({}, item, { mode: mode }));
        });

        byBed.forEach(function (bedItems) {
            const primaryItems = bedItems.filter(function (it) {
                return it.mode === "sole" || it.mode === "lanes";
            });
            const overlayItems = bedItems.filter(function (it) {
                return it.mode !== "sole" && it.mode !== "lanes";
            });

            function overlapsInDate(a, b) {
                return !(a.endDate <= b.startDate || b.endDate <= a.startDate);
            }

            // Pack primary bars ("sole" & "lanes") across [0 .. bandScale]
            const placedPrimary = [];
            primaryItems.forEach(function (it) {
                const hasConcurrentOverlay = overlayItems.some(function (ov) {
                    return overlapsInDate(it, ov);
                });
                const bandScale = hasConcurrentOverlay ? 0.54 : 1.0;
                const shareFrac = it.mode === "lanes"
                    ? Math.max(0.15, Math.min(0.85, Number(it.p.interplantSharePct || 50) / 100)) * Math.min(1, it.bedCount)
                    : Math.min(1, it.bedCount);

                if (it.mode === "sole" && it.bedCount >= 1) {
                    laneInfo.set(it.p.id, { offsetFrac: 0, widthFrac: bandScale });
                    placedPrimary.push({ offset: 0, frac: bandScale, startDate: it.startDate, endDate: it.endDate });
                    return;
                }

                const widthFrac = +(shareFrac * bandScale).toFixed(4);
                const candidates = [0];
                placedPrimary.forEach(function (peer) {
                    if (overlapsInDate(it, peer)) {
                        candidates.push(+(peer.offset + peer.frac).toFixed(4));
                    }
                });
                candidates.sort(function (u, v) { return u - v; });

                let chosenOffset = 0;
                let found = false;
                for (let ci = 0; ci < candidates.length; ci++) {
                    const cand = candidates[ci];
                    if (cand + widthFrac > bandScale + 0.02) continue;
                    const clashes = placedPrimary.some(function (peer) {
                        return overlapsInDate(it, peer) && !(cand + widthFrac <= peer.offset + 0.005 || peer.offset + peer.frac <= cand + 0.005);
                    });
                    if (!clashes) {
                        chosenOffset = cand;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    chosenOffset = Math.max(0, +(bandScale - widthFrac).toFixed(4));
                }
                placedPrimary.push({ offset: chosenOffset, frac: widthFrac, startDate: it.startDate, endDate: it.endDate });
                laneInfo.set(it.p.id, { offsetFrac: chosenOffset, widthFrac: widthFrac });
            });

            // Pack overlay interplanting bars ("border", "understory", "relay") into non-overlapping lanes
            const placedOverlays = [];
            overlayItems.forEach(function (it) {
                const hasConcurrentPrimary = primaryItems.some(function (pr) {
                    return overlapsInDate(it, pr);
                });
                const ovStart = hasConcurrentPrimary ? 0.54 : 0.0;
                const peerSlots = new Set();
                placedOverlays.forEach(function (peer) {
                    if (overlapsInDate(it, peer)) peerSlots.add(peer.slot);
                });
                let slot = 0;
                while (peerSlots.has(slot)) slot += 1;
                placedOverlays.push({ item: it, slot: slot, ovStart: ovStart, startDate: it.startDate, endDate: it.endDate });
            });

            placedOverlays.forEach(function (entry) {
                let maxSlot = entry.slot;
                let minOvStart = entry.ovStart;
                placedOverlays.forEach(function (other) {
                    if (overlapsInDate(entry, other)) {
                        if (other.slot > maxSlot) maxSlot = other.slot;
                        if (other.ovStart > minOvStart) minOvStart = other.ovStart;
                    }
                });
                const slotCount = Math.max(1, maxSlot + 1);
                const avail = Math.max(0.24, 1.0 - minOvStart);
                const slotW = +(avail / slotCount).toFixed(4);
                const offsetFrac = +(minOvStart + entry.slot * slotW).toFixed(4);
                laneInfo.set(entry.item.p.id, { offsetFrac: offsetFrac, widthFrac: slotW });
            });
        });

        return laneInfo;
    }

    function renderBarNudgesHtml(pId) {
        return '<div class="wcpp-bs-bar-nudges">' +
            '<button type="button" class="wcpp-bs-nudge-btn" data-action="nudge-planting" data-planting-id="' + escHtml(pId) + '" data-delta-start="-7" data-delta-dur="0" title="Start 7 days earlier">-7d</button>' +
            '<button type="button" class="wcpp-bs-nudge-btn" data-action="nudge-planting" data-planting-id="' + escHtml(pId) + '" data-delta-start="7" data-delta-dur="0" title="Start 7 days later">+7d</button>' +
            '<button type="button" class="wcpp-bs-nudge-btn" data-action="nudge-planting" data-planting-id="' + escHtml(pId) + '" data-delta-start="0" data-delta-dur="-7" title="Shorten 7 days">-7d dur</button>' +
            '<button type="button" class="wcpp-bs-nudge-btn" data-action="nudge-planting" data-planting-id="' + escHtml(pId) + '" data-delta-start="0" data-delta-dur="7" title="Extend 7 days">+7d dur</button>' +
            '<button type="button" class="wcpp-bs-nudge-btn" data-action="quick-succession" data-planting-id="' + escHtml(pId) + '" title="Create +14d succession">+ Succ</button>' +
        "</div>";
    }

    function renderBlockCard(block, season) {
        const c = core();
        const opts = _state.displayOptions || {};
        const win = getActiveTimelineWindow();
        const filtering = isFilterActive();
        const tunnels = (season.tunnels || []).filter(function (t) { return t.blockId === block.id; });
        const disabledBeds = opts.showTunnels !== false ? c.getDisabledNeighborBeds(block, season.tunnels || []) : new Set();
        const tunnelBedSet = new Set();
        if (opts.showTunnels !== false) {
            tunnels.forEach(function (t) {
                const s = Math.min(t.startBed, t.endBed);
                const e = Math.max(t.startBed, t.endBed);
                for (let b = s; b <= e; b++) tunnelBedSet.add(b);
            });
        }

        const blockPlantings = (season.plantings || []).filter(function (p) {
            return p.blockId === block.id && p.bedStart;
        });

        const totalBeds = Math.max(1, Number(block.bedCount || 1));
        const isCustomBlock = block.shapeType === "custom" && Boolean(block.customShape);
        const isCont = isContainerBlock(block);
        const contClass = getContainerCardClass(block);
        const contBadge = isCont ? formatContainerSummaryBadge(block, _state.units) : "";
        const mediaChip = formatGrowingMediaChip(block);
        const placedCount = getBlockPlacedPlantCount(season, block.id);
        const headersHtml = [];
        const colsHtml = [];

        for (let b = 1; b <= totalBeds; b++) {
            const isTun = tunnelBedSet.has(b);
            const isHatch = disabledBeds.has(b);
            const colTitle = isCustomBlock
                ? "Custom Bed"
                : (block.type === "pot" ? "Pot" : (block.type === "basket" ? "Basket" : (block.type === "bench" ? "Bench" : ("Bed " + b))));
            const prevLabel = typeof c.getPreviousSeasonBedLabel === "function"
                ? c.getPreviousSeasonBedLabel(_state, block.id, b, season.year)
                : "";
            headersHtml.push(
                '<div class="wcpp-bs-bed-header' + (isTun ? " is-tunnel" : "") + (isHatch ? " is-hatched" : "") + '">' +
                    "<span>" + colTitle + "</span>" +
                    (isHatch ? '<span style="font-size:0.65rem;">(Hatched)</span>' : "") +
                    (prevLabel ? '<span class="wcpp-bs-ghost-prev-pill" title="Prior season: ' + escHtml(prevLabel) + '">Last Yr: ' + escHtml(prevLabel) + "</span>" : "") +
                "</div>"
            );
            let monthCells = "";
            for (let m = win.startMoIdx; m <= win.endMoIdx; m++) {
                monthCells += '<div class="wcpp-bs-month-cell" data-drop-block="' + escHtml(block.id) + '" data-drop-bed="' + b + '" data-drop-month="' + (m + 1) + '"></div>';
            }
            colsHtml.push(
                '<div class="wcpp-bs-bed-col' + (isTun ? " is-tunnel" : "") + (isHatch ? " is-hatched" : "") + '"' +
                (win.count !== 12 ? ' style="grid-template-rows:repeat(' + win.count + ', var(--wcpp-bs-month-h, 44px));"' : "") +
                ">" + monthCells + "</div>"
            );
        }

        let overlaysHtml = "";
        if (opts.showFrostToday !== false) {
            const frost = c.getFrostWindow(season.year);
            const springPct = dateToWindowPct(frost.lastSpringIso, season.year, win.startMoIdx, win.endMoIdx);
            const fallPct = dateToWindowPct(frost.firstFallIso, season.year, win.startMoIdx, win.endMoIdx);
            if (springPct > 0) {
                overlaysHtml += '<div class="wcpp-bs-frost-band is-spring" style="top:0%;height:' + springPct + '%;" title="Spring Frost Zone (until ' + escHtml(frost.lastSpring) + ')"></div>';
            }
            if (fallPct < 100) {
                overlaysHtml += '<div class="wcpp-bs-frost-band is-fall" style="top:' + fallPct + '%;height:' + (100 - fallPct) + '%;" title="Fall Frost Zone (from ' + escHtml(frost.firstFall) + ')"></div>';
            }
            const todayIso = getTodayIso();
            const todayYear = Number(todayIso.slice(0, 4));
            const mappedToday = season.year + todayIso.slice(4);
            const rawTodayPct = dateToWindowFracRaw(todayYear === season.year ? todayIso : mappedToday, season.year, win.startMoIdx, win.endMoIdx);
            if (rawTodayPct >= 0 && rawTodayPct <= 100) {
                overlaysHtml += '<div class="wcpp-bs-today-line" style="top:' + rawTodayPct.toFixed(3) + '%;"><span class="wcpp-bs-today-label">Today (' + escHtml(formatShortDate(todayIso)) + ")</span></div>";
            }
        }

        if (opts.showTunnels !== false) {
            disabledBeds.forEach(function (b) {
                const leftPct = ((b - 1) / totalBeds) * 100;
                const widthPct = (1 / totalBeds) * 100;
                const patId = "wcppHatch_" + block.id.replace(/[^a-zA-Z0-9_-]/g, "") + "_" + b;
                overlaysHtml += '<div class="wcpp-bs-hatched-overlay" style="left:' + leftPct + "%;width:" + widthPct + '%;top:0;bottom:0;" title="Disabled neighbor bed adjacent to movable tunnel">' +
                    '<svg width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true" style="display:block;">' +
                        '<defs><pattern id="' + patId + '" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">' +
                            '<line x1="0" y1="0" x2="0" y2="8" stroke="rgba(148,163,184,0.38)" stroke-width="2"/>' +
                        "</pattern></defs>" +
                        '<rect width="100%" height="100%" fill="url(#' + patId + ')"/>' +
                    "</svg>" +
                "</div>";
            });

            tunnels.forEach(function (t) {
                const s = Math.max(1, Math.min(totalBeds, Math.min(t.startBed, t.endBed)));
                const e = Math.max(s, Math.min(totalBeds, Math.max(t.startBed, t.endBed)));
                const leftPct = ((s - 1) / totalBeds) * 100;
                const widthPct = ((e - s + 1) / totalBeds) * 100;
                overlaysHtml += '<div class="wcpp-bs-tunnel-overlay" style="left:' + leftPct + "%;width:" + widthPct + '%;top:2px;bottom:2px;">' +
                    '<span class="wcpp-bs-tunnel-label">' + escHtml(t.name) + " (" + escHtml(t.type) + ")</span>" +
                "</div>";
            });
        }

        const enriched = blockPlantings.map(function (p) {
            const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
            const dates = c.computePlantingDates(p, crop, block, season.tunnels || [], _state.climateAdjusted !== false);
            const bedCount = isCustomBlock ? 1 : Math.max(0.1, Number(p.bedCount || 1));
            const spanBeds = isCustomBlock ? 1 : Math.min(totalBeds - Number(p.bedStart) + 1, Math.max(1, Math.ceil(bedCount)));
            return {
                p: p,
                crop: crop,
                dates: dates,
                mode: getEffectiveMode(p),
                startDate: dates.startDate,
                endDate: dates.endDate,
                bedCount: bedCount,
                spanBeds: spanBeds
            };
        });
        const lanes = computeBedLanes(enriched);
        const todayIso = getTodayIso();
        let hiddenOffWindow = 0;

        const barsHtml = enriched.map(function (item) {
            const p = item.p;
            const crop = item.crop;
            const d = item.dates;
            const mode = item.mode;
            const rawStart = dateToWindowFracRaw(d.startDate, season.year, win.startMoIdx, win.endMoIdx);
            const rawEnd = dateToWindowFracRaw(d.endDate, season.year, win.startMoIdx, win.endMoIdx);
            if (rawEnd <= 0 || rawStart >= 100) {
                hiddenOffWindow += 1;
                return "";
            }

            const lane = lanes.get(p.id) || { offsetFrac: 0, widthFrac: 1 };
            const topPct = Math.max(0, Math.min(96.5, +rawStart.toFixed(3)));
            const bottomPct = Math.min(100, Math.max(topPct + 4, +rawEnd.toFixed(3)));
            const heightPct = Math.max(3.5, Math.min(100 - topPct, bottomPct - topPct));
            const bedStartIdx = isCustomBlock ? 1 : Number(p.bedStart);
            const leftPct = (((bedStartIdx - 1) + lane.offsetFrac) / totalBeds) * 100;
            const widthPct = (lane.widthFrac / totalBeds) * 100;
            const color = getPlantingBarColor(p, crop, block, season.tunnels || []);
            const rels = c.checkCompanionRelationships(p, season, _catalog.cropMap);

            const isActiveNow = d.startDate <= todayIso && d.endDate >= todayIso;
            const matchesFilter = doesPlantingMatchFilter(p, crop, rels);
            const isSelected = _selectedPlantingId === p.id;

            let highlightClass = "";
            if (filtering) {
                highlightClass = matchesFilter ? " is-highlighted" : " is-dimmed";
            } else if (opts.highlightActive) {
                highlightClass = isActiveNow ? " is-highlighted" : " is-dimmed";
            } else if (opts.highlightInterplanted) {
                highlightClass = (mode !== "sole" || p.interplanted) ? " is-highlighted" : " is-dimmed";
            }

            const classes = [
                "wcpp-bs-bar",
                "is-interplant-mode-" + mode,
                (mode !== "sole" || p.interplanted) ? "is-interplanted" : "",
                (item.bedCount < 1 || lane.widthFrac < 0.7) ? "is-fractional" : "",
                item.bedCount > 1 ? "is-multi-bed" : "",
                rels.conflictCount > 0 ? "has-conflict" : (rels.companionCount > 0 ? "has-companion" : ""),
                isSelected ? "is-selected" : "",
                highlightClass.trim()
            ].filter(Boolean).join(" ");

            const badges = [];
            if (mode !== "sole") {
                badges.push('<span class="wcpp-bs-bar-mode-pill">' + escHtml(getInterplantModeLabel(p, true)) + "</span>");
            }
            if (rels.companionCount > 0) {
                const compTitle = rels.companions.map(function (x) { return x.cropName + " (" + x.relation + ")"; }).join(", ");
                badges.push('<span class="wcpp-bs-badge-companion" title="Companions: ' + escHtml(compTitle) + '">\u2713 ' + rels.companionCount + "</span>");
            }
            if (rels.conflictCount > 0) {
                const confTitle = rels.conflicts.map(function (x) { return x.cropName + ": " + x.reason; }).join("; ");
                badges.push('<span class="wcpp-bs-badge-conflict" title="Conflicts: ' + escHtml(confTitle) + '">' + svgIcon("alert", 10) + " " + rels.conflictCount + "</span>");
            }
            if (d.startDate < season.year + "-01-01") {
                badges.push('<span class="wcpp-bs-badge-companion">Overwinter</span>');
            }

            const titleText = (p.label || (crop ? crop.name : p.cropName)) + (item.bedCount !== 1 ? " (" + item.bedCount + ")" : "");
            const metaText = formatShortDate(d.startDate) + "\u2013" + formatShortDate(d.harvestEndDate) + " \u00b7 " + d.effectiveDtm + "d";
            const padPx = lane.widthFrac < 0.55 ? 2 : 3;

            return '<div class="' + classes + '" tabindex="0" draggable="true" data-planting-id="' + escHtml(p.id) + '" ' +
                'style="top:' + topPct + "%;height:" + heightPct + "%;left:calc(" + leftPct + "% + " + padPx + "px);width:calc(" + widthPct + "% - " + (padPx * 2) + "px);--bar-color:" + escHtml(color) + ';" ' +
                'title="' + escHtml(titleText + (mode !== "sole" ? " [" + getInterplantModeLabel(p, false) + "]" : "") + " | " + metaText + " | Click to inspect or focus to nudge dates") + '">' +
                (mode === "border" ? '<span class="wcpp-bs-bar-stripe"></span>' : "") +
                '<div class="wcpp-bs-bar-title">' + escHtml(titleText) + "</div>" +
                '<div class="wcpp-bs-bar-meta">' + escHtml(metaText) + "</div>" +
                (badges.length ? '<div class="wcpp-bs-bar-badges">' + badges.join("") + "</div>" : "") +
                (isSelected ? renderBarNudgesHtml(p.id) : "") +
            "</div>";
        }).join("");

        const monthLabelsHtml = MONTHS.slice(win.startMoIdx, win.endMoIdx + 1).map(function (m) {
            return '<div class="wcpp-bs-month-label">' + m + "</div>";
        }).join("");

        return '<article class="wcpp-bs-block-card' + (block.type === "greenhouse" ? " is-greenhouse" : "") + contClass + (block.isFallow ? " is-fallow" : "") + '" data-block-id="' + escHtml(block.id) + '">' +
            '<div class="wcpp-bs-block-header">' +
                '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    '<h3 style="margin:0; font-size:1.02rem; font-weight:800;">' + escHtml(block.name) + "</h3>" +
                    (contBadge
                        ? '<span class="wcpp-bs-container-badge">' + escHtml(contBadge) + "</span>"
                        : '<span class="wcpp-bs-badge">' + escHtml(getBlockTypeLabel(block)) + "</span>") +
                    '<span class="wcpp-bs-badge">' + escHtml(formatBedSizeSummary(block, _state.units)) + "</span>" +
                    (mediaChip ? '<span class="wcpp-bs-media-chip">' + escHtml(mediaChip) + "</span>" : "") +
                    (block.isFallow ? '<span class="wcpp-bs-badge wcpp-bs-status-warn">Fallow / Cover Crop</span>' : "") +
                    (hiddenOffWindow > 0 ? '<span class="wcpp-bs-badge">' + hiddenOffWindow + " off-window</span>" : "") +
                    tunnels.map(function (t) {
                        return '<span class="wcpp-bs-badge">' + escHtml(t.name) + " (Beds " + t.startBed + "\u2013" + t.endBed + ")</span>";
                    }).join("") +
                "</div>" +
                '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="open-playground" data-block-id="' + escHtml(block.id) + '" data-bed-number="1">' + svgIcon("playground", 13) + "<span>Plant Playground (" + placedCount + ")</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="edit-container-media" data-block-id="' + escHtml(block.id) + '">' + svgIcon("mix", 13) + "<span>Edit Media</span></button>" +
                    (isCustomBlock ? '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="edit-block-shape" data-block-id="' + escHtml(block.id) + '">Edit Shape</button>' : "") +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="block-rotation" data-block-id="' + escHtml(block.id) + '">' + svgIcon("history", 13) + "<span>Block Info &amp; Rotation History</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="add-planting" data-block-id="' + escHtml(block.id) + '">' + svgIcon("plus", 13) + "<span>Add Here</span></button>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-grid-scroll" data-scroll-block="' + escHtml(block.id) + '">' +
                '<div class="wcpp-bs-matrix" style="--bed-count:' + totalBeds + ';">' +
                    '<div class="wcpp-bs-matrix-header">' +
                        '<div class="wcpp-bs-corner-cell">' + season.year + "</div>" +
                        '<div class="wcpp-bs-bed-headers">' + headersHtml.join("") + "</div>" +
                    "</div>" +
                    '<div class="wcpp-bs-matrix-body">' +
                        '<div class="wcpp-bs-month-axis"' + (win.count !== 12 ? ' style="grid-template-rows:repeat(' + win.count + ', var(--wcpp-bs-month-h, 44px));"' : "") + ">" + monthLabelsHtml + "</div>" +
                        '<div class="wcpp-bs-beds-stage"' + (win.count !== 12 ? ' style="height:calc(' + win.count + ' * var(--wcpp-bs-month-h, 44px));"' : "") + ">" + colsHtml.join("") + overlaysHtml + barsHtml + "</div>" +
                    "</div>" +
                "</div>" +
            "</div>" +
        "</article>";
    }

    function renderCropMapBodyHtml(season) {
        const blocks = (season && season.blocks) || [];
        const blocksHtml = blocks.length
            ? blocks.map(function (b) { return renderBlockCard(b, season); }).join("")
            : '<div class="wcpp-bs-card"><p>No field blocks or greenhouses in this season. Add one in <strong>Garden Layout &amp; Shapes</strong>.</p></div>';

        return '<div class="wcpp-bs-cropmap-layout">' +
            renderUnassignedTray(season) +
            '<div class="wcpp-bs-blocks-stack">' +
                renderSwipeHintBanner() +
                '<div id="wcppBsNudgeBarHost">' + renderSelectedNudgeBarHtml(season) + "</div>" +
                blocksHtml +
            "</div>" +
        "</div>";
    }

    function renderCropMapTab(season) {
        const plantings = (season && season.plantings) || [];
        if (_selectedPlantingId && !plantings.some(function (p) { return p.id === _selectedPlantingId; })) {
            _selectedPlantingId = null;
        }
        if (!_selectedPlantingId && plantings.length) {
            const firstAssigned = plantings.find(function (p) { return p.blockId && p.bedStart; });
            _selectedPlantingId = (firstAssigned || plantings[0]).id;
        }
        return renderCropMapFilterStrip(season) +
            '<div id="wcppBsCropMapBodyHost">' + renderCropMapBodyHtml(season) + "</div>";
    }

    function refreshCropMapBodyOnly() {
        const host = document.getElementById("wcppBsCropMapBodyHost");
        if (!host || !_state || !_catalog) return;
        const season = core().getActiveSeason(_state);
        if (!season) return;
        const scrollState = captureScrollOffsets();
        host.innerHTML = renderCropMapBodyHtml(season);
        restoreScrollOffsets(scrollState);
    }

    function formatHour12(hr) {
        const h = Math.round(Number(hr) || 12);
        if (h === 0 || h === 24) return "12 AM";
        if (h === 12) return "12 PM";
        return h > 12 ? ((h - 12) + " PM") : (h + " AM");
    }

    function getStructureTypeLabel(kind) {
        if (kind === "house") return "House Wall";
        if (kind === "shed") return "Garden Shed";
        if (kind === "hedge") return "Cedar Hedge";
        if (kind === "tree") return "Tree";
        return "Fence";
    }

    function getBlockHydrozoneSummary(block, season) {
        const c = core();
        const fallback = {
            rep: {
                dominantTier: "moderate",
                hasMismatch: false,
                summerCadenceLabel: "Every 4 days",
                summerDaysBetweenWatering: 4,
                dryOutFactor: 1,
                notes: []
            },
            anyMismatch: false,
            mismatchCount: 0
        };
        if (!block || !c || typeof c.analyzeBedHydrozones !== "function") return fallback;
        const count = Math.max(1, Number(block.bedCount || 1));
        const list = [];
        for (let bn = 1; bn <= count; bn++) {
            list.push(c.analyzeBedHydrozones(block, bn, season, _catalog));
        }
        const mismatched = list.filter(function (hz) { return hz && hz.hasMismatch; });
        const sortedByFastest = list.slice().sort(function (a, b) {
            return (a.summerDaysBetweenWatering || 4) - (b.summerDaysBetweenWatering || 4);
        });
        return {
            rep: mismatched[0] || sortedByFastest[0] || fallback.rep,
            anyMismatch: mismatched.length > 0,
            mismatchCount: mismatched.length
        };
    }

    function renderSunWarningsHtml(season) {
        const c = core();
        const structures = (season && Array.isArray(season.structures)) ? season.structures : [];
        if (!structures.length || typeof c.analyzeMapShadeImpact !== "function") {
            return '<div class="wcpp-bs-sun-warnings" id="wcppBsSunWarnings" hidden></div>';
        }
        const impact = c.analyzeMapShadeImpact(season, _shadowMonth, _catalog, 49.19);
        const warnings = (impact && Array.isArray(impact.warnings)) ? impact.warnings : [];
        if (!warnings.length) {
            return '<div class="wcpp-bs-sun-warnings" id="wcppBsSunWarnings" hidden></div>';
        }
        return '<div class="wcpp-bs-sun-warnings" id="wcppBsSunWarnings" role="status">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
                '<strong style="display:inline-flex;align-items:center;gap:6px;">' + svgIcon("alert", 13) + '<span>Shade Impact Alert (&lt; 6 hrs Direct Sun in ' + escHtml(impact.monthLabel) + ')</span></strong>' +
                '<span class="wcpp-bs-badge">' + impact.daylightHours + " hrs max daylight</span>" +
            "</div>" +
            warnings.map(function (w) {
                return '<div class="wcpp-bs-sun-warning-item"><span>' + escHtml(w) + "</span></div>";
            }).join("") +
        "</div>";
    }

    function renderFarmSvg(season) {
        const c = core();
        const blocks = (season && season.blocks) || [];
        const tunnels = (season && season.tunnels) || [];
        const rawStructures = (season && Array.isArray(season.structures)) ? season.structures : [];
        const structures = rawStructures.map(function (s, idx) {
            return typeof c.normalizeShadeStructure === "function" ? c.normalizeShadeStructure(s, idx) : s;
        });
        const W = 820;
        const H = 500;
        const pad = 54;

        if (_selectedStructureId && !structures.some(function (s) { return s.id === _selectedStructureId; })) {
            _selectedStructureId = null;
        }
        if (_selectedBlockId && !blocks.some(function (b) { return b.id === _selectedBlockId; })) {
            _selectedBlockId = null;
        }
        if (!_selectedBlockId && !_selectedStructureId && blocks.length) {
            _selectedBlockId = blocks[0].id;
        }

        const layouts = blocks.map(function (b, idx) {
            const isCustom = b.shapeType === "custom" && Boolean(b.customShape);
            const isCont = isContainerBlock(b);
            const cGeom = isCont ? c.computeContainerGeometry(b.containerSpec || b, b.type) : null;
            const geom = isCustom && typeof c.computeCustomShapeGeometry === "function"
                ? c.computeCustomShapeGeometry(b.customShape)
                : null;
            const beds = (isCustom || isCont) ? 1 : Math.max(1, Number(b.bedCount || 4));
            const bwM = isCont && cGeom
                ? (cGeom.shapeKind === "circle" ? Math.max(0.2, cGeom.diameterCm / 100) : Math.max(0.2, cGeom.widthCm / 100))
                : (isCustom
                    ? (geom ? Math.max(0.5, geom.heightCm / 100) : Math.max(0.5, Number(b.bedWidthCm || 120) / 100))
                    : Number(b.bedWidthCm || 75) / 100);
            const pwM = isCont ? 0.15 : (Number(b.pathWidthCm || 30) / 100);
            const lenM = isCont && cGeom
                ? (cGeom.shapeKind === "circle" ? Math.max(0.2, cGeom.diameterCm / 100) : Math.max(0.2, cGeom.widthCm / 100))
                : (isCustom
                    ? (geom ? Math.max(0.5, geom.heightCm / 100) : Math.max(0.5, Number(b.bedWidthCm || 120) / 100))
                    : Math.max(1, Number(b.bedLengthM || 30)));
            const widthM = isCont && cGeom
                ? (cGeom.shapeKind === "circle" ? Math.max(0.2, cGeom.diameterCm / 100) : Math.max(0.2, cGeom.lengthCm / 100))
                : (isCustom
                    ? (geom ? Math.max(0.5, geom.widthCm / 100) : Math.max(0.5, Number(b.bedLengthM || 2.4)))
                    : (beds * bwM + Math.max(0, beds - 1) * pwM));
            const hasX = b.x !== null && b.x !== undefined && Number.isFinite(Number(b.x));
            const hasY = b.y !== null && b.y !== undefined && Number.isFinite(Number(b.y));
            const xM = hasX ? Number(b.x) / 14 : (idx % 2) * 26;
            const yM = hasY ? Number(b.y) / 14 : Math.floor(idx / 2) * 38;
            return { b: b, isCustom: isCustom, isCont: isCont, cGeom: cGeom, geom: geom, beds: beds, bwM: bwM, pwM: pwM, lenM: lenM, widthM: widthM, xM: xM, yM: yM };
        });

        const structLayouts = structures.map(function (s) {
            return {
                s: s,
                xM: Number(s.x || 0) / 14,
                yM: Number(s.y || 0) / 14,
                widthM: Number(s.widthM || 3),
                lengthM: Number(s.lengthM || 1)
            };
        });

        let minX = 0, minY = 0, maxX = 30, maxY = 30;
        if (layouts.length || structLayouts.length) {
            minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
            layouts.forEach(function (l) {
                const r = Math.max(l.widthM, l.lenM) * 0.7;
                const cx = l.xM + l.widthM / 2;
                const cy = l.yM + l.lenM / 2;
                minX = Math.min(minX, cx - r);
                minY = Math.min(minY, cy - r);
                maxX = Math.max(maxX, cx + r);
                maxY = Math.max(maxY, cy + r);
            });
            structLayouts.forEach(function (sl) {
                const r = Math.max(sl.widthM, sl.lengthM) * 0.65;
                const cx = sl.xM + sl.widthM / 2;
                const cy = sl.yM + sl.lengthM / 2;
                minX = Math.min(minX, cx - r);
                minY = Math.min(minY, cy - r);
                maxX = Math.max(maxX, cx + r);
                maxY = Math.max(maxY, cy + r);
            });
        }
        const onlyContainers = layouts.length > 0 && layouts.every(function (l) { return l.isCont; });
        const minSpan = onlyContainers ? 6 : 12;
        const spanX = Math.max(minSpan, maxX - minX);
        const spanY = Math.max(minSpan, maxY - minY);
        const pxPerM = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
        const offsetX = (W - spanX * pxPerM) / 2 - minX * pxPerM;
        const offsetY = (H - spanY * pxPerM) / 2 - minY * pxPerM;

        let gridLines = "";
        for (let gx = 60; gx < W; gx += 60) {
            gridLines += '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '" stroke="#e5e7eb" stroke-width="1"/>';
        }
        for (let gy = 60; gy < H; gy += 60) {
            gridLines += '<line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '" stroke="#e5e7eb" stroke-width="1"/>';
        }

        const allPlacedPlants = (season && Array.isArray(season.placedPlants)) ? season.placedPlants : [];

        const blocksSvg = layouts.map(function (l) {
            const b = l.b;
            const isRoundCont = Boolean(l.isCont && l.cGeom && l.cGeom.shapeKind === "circle");
            const pxW = isRoundCont
                ? Math.max(30, l.widthM * pxPerM)
                : Math.max(l.isCont ? 32 : 24, l.widthM * pxPerM);
            const pxH = isRoundCont
                ? pxW
                : Math.max(24, l.lenM * pxPerM);
            const x0 = offsetX + l.xM * pxPerM;
            const y0 = offsetY + l.yM * pxPerM;
            const cx = x0 + pxW / 2;
            const cy = y0 + pxH / 2;
            const angle = ((Number(b.angleDeg || 0) % 360) + 360) % 360;
            const isSelected = _selectedBlockId === b.id;
            const isGh = b.type === "greenhouse";
            const disabled = c.getDisabledNeighborBeds(b, tunnels);
            const blockTunnels = tunnels.filter(function (t) { return t.blockId === b.id; });
            const blockPlaced = allPlacedPlants.filter(function (pp) { return pp && pp.blockId === b.id; });
            const pBounds = (blockPlaced.length && typeof c.getPlaygroundBounds === "function") ? c.getPlaygroundBounds(b) : null;

            let bodySvg = "";
            if (l.isCont && l.cGeom) {
                const r = pxW / 2;
                const soilR = r * 0.80;
                if (b.type === "pot") {
                    if (isRoundCont) {
                        bodySvg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="#fffbeb" stroke="' + (isSelected ? "#166534" : "#9a3412") + '" stroke-width="' + (isSelected ? 2.8 : 2.2) + '"/>';
                        bodySvg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + soilR.toFixed(1) + '" fill="#ecfdf5" stroke="#15803d" stroke-width="1"/>';
                    } else {
                        bodySvg += '<rect x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + pxW.toFixed(1) + '" height="' + pxH.toFixed(1) + '" rx="5" fill="#fffbeb" stroke="' + (isSelected ? "#166534" : "#9a3412") + '" stroke-width="' + (isSelected ? 2.6 : 2.1) + '"/>';
                        bodySvg += '<rect x="' + (x0 + 3).toFixed(1) + '" y="' + (y0 + 3).toFixed(1) + '" width="' + Math.max(8, pxW - 6).toFixed(1) + '" height="' + Math.max(8, pxH - 6).toFixed(1) + '" rx="3" fill="#ecfdf5" stroke="#15803d" stroke-width="0.9"/>';
                    }
                } else if (b.type === "basket") {
                    if (isRoundCont) {
                        bodySvg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="#ecfdf5" stroke="' + (isSelected ? "#166534" : "#9a3412") + '" stroke-width="' + (isSelected ? 2.8 : 2.2) + '"/>';
                        bodySvg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + soilR.toFixed(1) + '" fill="#f0fdf4" stroke="#0f766e" stroke-width="1"/>';
                        [-90, 30, 150].forEach(function (deg) {
                            const rad = (deg * Math.PI) / 180;
                            const ax = cx + Math.cos(rad) * r;
                            const ay = cy + Math.sin(rad) * r;
                            bodySvg += '<line x1="' + ax.toFixed(1) + '" y1="' + ay.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + cy.toFixed(1) + '" stroke="#0f766e" stroke-width="1.3" stroke-dasharray="2.5 2"/>';
                            bodySvg += '<circle cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="2" fill="#0f766e"/>';
                        });
                        bodySvg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="2.6" fill="#ffffff" stroke="#0f766e" stroke-width="1.4"/>';
                    } else {
                        bodySvg += '<rect x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + pxW.toFixed(1) + '" height="' + pxH.toFixed(1) + '" rx="5" fill="#ecfdf5" stroke="' + (isSelected ? "#166534" : "#9a3412") + '" stroke-width="' + (isSelected ? 2.6 : 2.1) + '"/>';
                        bodySvg += '<line x1="' + x0.toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + cy.toFixed(1) + '" stroke="#0f766e" stroke-width="1.2" stroke-dasharray="2.5 2"/>';
                        bodySvg += '<line x1="' + (x0 + pxW).toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + cy.toFixed(1) + '" stroke="#0f766e" stroke-width="1.2" stroke-dasharray="2.5 2"/>';
                        bodySvg += '<line x1="' + cx.toFixed(1) + '" y1="' + (y0 + pxH).toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + cy.toFixed(1) + '" stroke="#0f766e" stroke-width="1.2" stroke-dasharray="2.5 2"/>';
                        bodySvg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="2.6" fill="#ffffff" stroke="#0f766e" stroke-width="1.4"/>';
                    }
                } else {
                    // Growing bench with slatted surface
                    bodySvg += '<rect x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + pxW.toFixed(1) + '" height="' + pxH.toFixed(1) + '" rx="4" fill="#fffbeb" stroke="' + (isSelected ? "#166534" : "#92400e") + '" stroke-width="' + (isSelected ? 2.6 : 2.0) + '"/>';
                    const slatCount = Math.max(3, Math.min(7, Math.floor(pxH / 8)));
                    for (let si = 1; si < slatCount; si++) {
                        const sy = y0 + (pxH * si) / slatCount;
                        bodySvg += '<line x1="' + (x0 + 2).toFixed(1) + '" y1="' + sy.toFixed(1) + '" x2="' + (x0 + pxW - 2).toFixed(1) + '" y2="' + sy.toFixed(1) + '" stroke="#92400e" stroke-opacity="0.35" stroke-width="1"/>';
                    }
                    bodySvg += '<rect x="' + (x0 + 3).toFixed(1) + '" y="' + (y0 + 3).toFixed(1) + '" width="' + Math.max(8, pxW - 6).toFixed(1) + '" height="' + Math.max(8, pxH - 6).toFixed(1) + '" rx="2" fill="#ecfdf5" fill-opacity="0.72" stroke="#15803d" stroke-width="0.9"/>';
                }
                if (blockPlaced.length && pBounds) {
                    blockPlaced.slice(0, 80).forEach(function (pp) {
                        const cropObj = _catalog && _catalog.cropMap ? c.resolveCrop(_catalog.cropMap, pp.cropName) : null;
                        const dotCol = c.getCategoryColor((cropObj && cropObj.category) || "Vegetable");
                        let dx = cx;
                        let dy = cy;
                        if (isRoundCont) {
                            const radMax = Math.max(1, pBounds.radiusCm);
                            dx = cx + ((pp.xCm - pBounds.cx) / radMax) * soilR;
                            dy = cy + ((pp.yCm - pBounds.cy) / radMax) * soilR;
                        } else {
                            dx = x0 + 3 + (pp.xCm / Math.max(1, pBounds.widthCm)) * Math.max(4, pxW - 6);
                            dy = y0 + 3 + (pp.yCm / Math.max(1, pBounds.heightCm)) * Math.max(4, pxH - 6);
                        }
                        const dotR = Math.max(1.8, Math.min(4.2, (Number(pp.radiusCm) || 8) * (pxW / Math.max(20, pBounds.widthCm)) * 0.45));
                        bodySvg += '<circle cx="' + dx.toFixed(1) + '" cy="' + dy.toFixed(1) + '" r="' + dotR.toFixed(1) + '" fill="' + escHtml(dotCol) + '" stroke="#ffffff" stroke-width="0.7"/>';
                    });
                }
            } else if (l.isCustom && l.geom) {
                const scalePxPerCm = pxPerM / 100;
                const areaDisp = _state.units === "imperial"
                    ? (l.geom.areaFt2 + " ft\u00b2")
                    : (l.geom.areaM2 + " m\u00b2");
                const fillCol = isGh ? "#ecfeff" : (b.isFallow ? "#fef3c7" : "#ecfdf5");
                const strokeCol = isSelected ? "#166534" : (isGh ? "#0f766e" : "#15803d");
                bodySvg = '<g transform="translate(' + x0.toFixed(1) + "," + y0.toFixed(1) + ") scale(" + scalePxPerCm.toFixed(6) + ')">' +
                    '<path d="' + escHtml(l.geom.pathD) + '" fill="' + fillCol + '" stroke="' + strokeCol + '" stroke-width="' + (isSelected ? 2.6 : 1.8) + '" vector-effect="non-scaling-stroke"' + (b.isFallow ? ' stroke-dasharray="6 4"' : "") + "/>" +
                    "</g>";
                if (blockPlaced.length && pBounds) {
                    blockPlaced.slice(0, 80).forEach(function (pp) {
                        const cropObj = _catalog && _catalog.cropMap ? c.resolveCrop(_catalog.cropMap, pp.cropName) : null;
                        const dotCol = c.getCategoryColor((cropObj && cropObj.category) || "Vegetable");
                        const dx = x0 + pp.xCm * scalePxPerCm;
                        const dy = y0 + pp.yCm * scalePxPerCm;
                        bodySvg += '<circle cx="' + dx.toFixed(1) + '" cy="' + dy.toFixed(1) + '" r="2.3" fill="' + escHtml(dotCol) + '" stroke="#ffffff" stroke-width="0.6"/>';
                    });
                }
                if (pxW >= 32 && pxH >= 24) {
                    const ax = x0 + l.geom.cx * scalePxPerCm;
                    const ay = y0 + l.geom.cy * scalePxPerCm;
                    bodySvg += '<text x="' + ax.toFixed(1) + '" y="' + (ay + 3).toFixed(1) + '" text-anchor="middle" font-size="9.5" font-weight="800" fill="#166534">' + escHtml(areaDisp) + "</text>";
                }
            } else {
                bodySvg = '<rect x="' + x0 + '" y="' + y0 + '" width="' + pxW + '" height="' + pxH + '" rx="6" ' +
                    'fill="' + (isGh ? "#ecfeff" : (b.isFallow ? "#fef3c7" : "#f0fdf4")) + '" ' +
                    'stroke="' + (isSelected ? "#166534" : (isGh ? "#0f766e" : "#94a3b8")) + '" ' +
                    'stroke-width="' + (isSelected ? 2.5 : 1.5) + '"' + (b.isFallow ? ' stroke-dasharray="6 4"' : "") + "/>";

                const v6Mod = getV6Module();
                const tlVis = (v6Mod && typeof v6Mod.getBlockTimeLapseVisual === "function")
                    ? v6Mod.getBlockTimeLapseVisual(b, season, _catalog, c)
                    : null;
                const bedWpx = l.bwM * pxPerM;
                const pathWpx = l.pwM * pxPerM;
                for (let k = 1; k <= l.beds; k++) {
                    const bx = x0 + (k - 1) * (bedWpx + pathWpx);
                    const isHatched = disabled.has(k);
                    const bedFill = isHatched ? "url(#wcppFarmHatch)" : (tlVis ? tlVis.fill : (isGh ? "#bae6fd" : "#bbf7d0"));
                    const bedStroke = tlVis ? tlVis.stroke : (isGh ? "#0284c7" : "#15803d");
                    bodySvg += '<rect x="' + bx.toFixed(1) + '" y="' + (y0 + 3).toFixed(1) + '" width="' + Math.max(3, bedWpx).toFixed(1) + '" height="' + Math.max(8, pxH - 6).toFixed(1) + '" rx="2" ' +
                        'fill="' + bedFill + '" ' +
                        'stroke="' + bedStroke + '" stroke-width="0.9"/>';
                    if (_farmLayers.bedNumbers && bedWpx >= 10) {
                        bodySvg += '<text x="' + (bx + bedWpx / 2).toFixed(1) + '" y="' + (y0 + pxH / 2 + 3).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#111827">' + k + "</text>";
                    }
                }

                if (blockPlaced.length && pBounds) {
                    const dotScale = tlVis ? Math.max(0.4, tlVis.scale) : 1;
                    blockPlaced.slice(0, 90).forEach(function (pp) {
                        const k = Math.max(1, Math.min(l.beds, Number(pp.bedNumber || 1)));
                        const bx = x0 + (k - 1) * (bedWpx + pathWpx);
                        const cropObj = _catalog && _catalog.cropMap ? c.resolveCrop(_catalog.cropMap, pp.cropName) : null;
                        const dotCol = c.getCategoryColor((cropObj && cropObj.category) || "Vegetable");
                        const dx = bx + (pp.yCm / Math.max(1, pBounds.heightCm)) * Math.max(3, bedWpx);
                        const dy = (y0 + 3) + (pp.xCm / Math.max(1, pBounds.widthCm)) * Math.max(8, pxH - 6);
                        bodySvg += '<circle cx="' + dx.toFixed(1) + '" cy="' + dy.toFixed(1) + '" r="' + (2.1 * dotScale).toFixed(1) + '" fill="' + escHtml(dotCol) + '" stroke="#ffffff" stroke-width="0.5"/>';
                    });
                }

                if (_farmLayers.tunnels) {
                    blockTunnels.forEach(function (t) {
                        const s = Math.max(1, Math.min(l.beds, t.startBed));
                        const e = Math.max(s, Math.min(l.beds, t.endBed));
                        const tx = x0 + (s - 1) * (bedWpx + pathWpx) - 2;
                        const tw = (e - s + 1) * bedWpx + (e - s) * pathWpx + 4;
                        bodySvg += '<rect x="' + tx.toFixed(1) + '" y="' + (y0 + 1).toFixed(1) + '" width="' + tw.toFixed(1) + '" height="' + Math.max(12, pxH - 2).toFixed(1) + '" rx="4" ' +
                            'fill="rgba(3,105,161,0.14)" stroke="#0369a1" stroke-width="1.8" stroke-dasharray="5 3"/>';
                    });
                }
            }

            const labelSvg = _farmLayers.blockNames
                ? '<text data-farm-block-label="true" x="' + cx.toFixed(1) + '" y="' + (y0 - 7).toFixed(1) + '" text-anchor="middle" font-size="11.5" font-weight="800" fill="#111827">' +
                    escHtml(b.name) + " (" + angle + "\u00b0)</text>"
                : "";

            const stemY0 = _farmLayers.blockNames ? (y0 - 20) : y0;
            const knobY = stemY0 - 18;
            const rotateHandleSvg = isSelected
                ? '<g class="wcpp-bs-farm-rotate-handle" data-farm-rotate-block="' + escHtml(b.id) + '">' +
                    '<line x1="' + cx.toFixed(1) + '" y1="' + stemY0.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + knobY.toFixed(1) + '" stroke="#166534" stroke-width="1.6" stroke-dasharray="3 3"/>' +
                    '<circle cx="' + cx.toFixed(1) + '" cy="' + knobY.toFixed(1) + '" r="14" fill="transparent"/>' +
                    '<circle cx="' + cx.toFixed(1) + '" cy="' + knobY.toFixed(1) + '" r="6.5" fill="#ffffff" stroke="#166534" stroke-width="2"/>' +
                  "</g>"
                : "";

            const contCls = getContainerCardClass(b);
            return '<g class="wcpp-bs-farm-block is-draggable' + (l.isCustom ? " is-custom-shape" : "") + contCls + (isSelected ? " is-selected" : "") + '" ' +
                'data-action="select-farm-block" ' +
                'data-farm-drag-block="' + escHtml(b.id) + '" ' +
                'data-block-id="' + escHtml(b.id) + '" ' +
                'data-orig-x-m="' + l.xM.toFixed(4) + '" ' +
                'data-orig-y-m="' + l.yM.toFixed(4) + '" ' +
                'data-cx="' + cx.toFixed(2) + '" ' +
                'data-cy="' + cy.toFixed(2) + '" ' +
                'data-angle="' + angle + '" ' +
                'transform="rotate(' + angle + " " + cx.toFixed(1) + " " + cy.toFixed(1) + ')">' +
                bodySvg +
                labelSvg +
                rotateHandleSvg +
            "</g>";
        }).join("");

        const shadowPolys = (_shadowShow && structures.length && typeof c.computeCastShadowPolygons === "function")
            ? c.computeCastShadowPolygons(structures, blocks, _shadowMonth, _shadowHour, 49.19)
            : [];

        const castShadowsSvg = shadowPolys.map(function (sp) {
            if (!sp || !Array.isArray(sp.pointsM) || sp.pointsM.length < 3) return "";
            const ptsStr = sp.pointsM.map(function (pt) {
                return (offsetX + pt.x * pxPerM).toFixed(1) + "," + (offsetY + pt.y * pxPerM).toFixed(1);
            }).join(" ");
            return '<polygon class="wcpp-bs-shadow-poly" data-shadow-source="' + escHtml(sp.sourceId) + '" ' +
                'points="' + ptsStr + '" ' +
                'fill="rgba(15, 23, 42, 0.22)" stroke="rgba(51, 65, 85, 0.32)" stroke-width="1" ' +
                'aria-label="' + escHtml(sp.sourceName + " cast shadow (" + sp.shadowLengthM + " m)") + '"/>';
        }).join("");

        const isImp = _state && _state.units === "imperial";
        const structuresSvg = structLayouts.map(function (sl) {
            const s = sl.s;
            const sPxW = Math.max(s.kind === "fence" ? 20 : 18, sl.widthM * pxPerM);
            const sPxH = Math.max(s.kind === "fence" ? 8 : 16, sl.lengthM * pxPerM);
            const sx0 = offsetX + sl.xM * pxPerM;
            const sy0 = offsetY + sl.yM * pxPerM;
            const scx = sx0 + sPxW / 2;
            const scy = sy0 + sPxH / 2;
            const sAngle = ((Number(s.angleDeg || 0) % 360) + 360) % 360;
            const isSelS = _selectedStructureId === s.id;
            const hDisp = isImp ? (c.mToFt(s.heightM) + " ft") : (Number(s.heightM).toFixed(1).replace(/\.0$/, "") + " m");

            let sBody = "";
            if (s.kind === "tree") {
                const rx = sPxW / 2;
                const ry = sPxH / 2;
                sBody = '<ellipse cx="' + scx.toFixed(1) + '" cy="' + scy.toFixed(1) + '" rx="' + rx.toFixed(1) + '" ry="' + ry.toFixed(1) + '" ' +
                    'fill="rgba(21,128,61,0.34)" stroke="' + (isSelS ? "#b45309" : "#14532d") + '" stroke-width="' + (isSelS ? 2.6 : 1.8) + '"/>' +
                    '<ellipse cx="' + scx.toFixed(1) + '" cy="' + scy.toFixed(1) + '" rx="' + Math.max(4, rx * 0.62).toFixed(1) + '" ry="' + Math.max(4, ry * 0.62).toFixed(1) + '" ' +
                    'fill="rgba(22,101,52,0.22)" stroke="#15803d" stroke-width="1" stroke-dasharray="3 2"/>' +
                    '<circle cx="' + scx.toFixed(1) + '" cy="' + scy.toFixed(1) + '" r="3.5" fill="#78350f"/>';
            } else if (s.kind === "hedge") {
                sBody = '<rect x="' + sx0.toFixed(1) + '" y="' + sy0.toFixed(1) + '" width="' + sPxW.toFixed(1) + '" height="' + sPxH.toFixed(1) + '" rx="6" ' +
                    'fill="rgba(20,83,45,0.68)" stroke="' + (isSelS ? "#b45309" : "#14532d") + '" stroke-width="' + (isSelS ? 2.6 : 1.8) + '"/>';
            } else if (s.kind === "house") {
                sBody = '<rect x="' + sx0.toFixed(1) + '" y="' + sy0.toFixed(1) + '" width="' + sPxW.toFixed(1) + '" height="' + sPxH.toFixed(1) + '" rx="3" ' +
                    'fill="#475569" fill-opacity="0.82" stroke="' + (isSelS ? "#b45309" : "#1e293b") + '" stroke-width="' + (isSelS ? 2.6 : 1.8) + '"/>' +
                    '<line x1="' + sx0.toFixed(1) + '" y1="' + scy.toFixed(1) + '" x2="' + (sx0 + sPxW).toFixed(1) + '" y2="' + scy.toFixed(1) + '" stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="4 3"/>';
            } else if (s.kind === "shed") {
                sBody = '<rect x="' + sx0.toFixed(1) + '" y="' + sy0.toFixed(1) + '" width="' + sPxW.toFixed(1) + '" height="' + sPxH.toFixed(1) + '" rx="3" ' +
                    'fill="#78350f" fill-opacity="0.78" stroke="' + (isSelS ? "#d97706" : "#451a03") + '" stroke-width="' + (isSelS ? 2.6 : 1.8) + '"/>' +
                    '<line x1="' + sx0.toFixed(1) + '" y1="' + scy.toFixed(1) + '" x2="' + (sx0 + sPxW).toFixed(1) + '" y2="' + scy.toFixed(1) + '" stroke="#fde68a" stroke-width="1.1"/>';
            } else {
                sBody = '<rect x="' + sx0.toFixed(1) + '" y="' + sy0.toFixed(1) + '" width="' + sPxW.toFixed(1) + '" height="' + sPxH.toFixed(1) + '" rx="2" ' +
                    'fill="#92400e" stroke="' + (isSelS ? "#d97706" : "#451a03") + '" stroke-width="' + (isSelS ? 2.4 : 1.5) + '"/>';
            }

            const sLabelSvg = _farmLayers.blockNames
                ? '<text data-farm-structure-label="true" x="' + scx.toFixed(1) + '" y="' + (sy0 - 6).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="800" fill="#111827">' +
                    escHtml(s.name) + " (" + escHtml(hDisp) + ", " + sAngle + "\u00b0)</text>"
                : "";

            const sStemY0 = _farmLayers.blockNames ? (sy0 - 18) : sy0;
            const sKnobY = sStemY0 - 16;
            const sRotateSvg = isSelS
                ? '<g class="wcpp-bs-structure-rotate-handle" data-farm-rotate-structure="' + escHtml(s.id) + '">' +
                    '<line x1="' + scx.toFixed(1) + '" y1="' + sStemY0.toFixed(1) + '" x2="' + scx.toFixed(1) + '" y2="' + sKnobY.toFixed(1) + '" stroke="#b45309" stroke-width="1.6" stroke-dasharray="3 3"/>' +
                    '<circle cx="' + scx.toFixed(1) + '" cy="' + sKnobY.toFixed(1) + '" r="14" fill="transparent"/>' +
                    '<circle cx="' + scx.toFixed(1) + '" cy="' + sKnobY.toFixed(1) + '" r="6.5" fill="#ffffff" stroke="#b45309" stroke-width="2"/>' +
                  "</g>"
                : "";

            return '<g class="wcpp-bs-farm-structure is-draggable' + (isSelS ? " is-selected" : "") + '" ' +
                'data-action="select-farm-structure" ' +
                'data-farm-drag-structure="' + escHtml(s.id) + '" ' +
                'data-structure-id="' + escHtml(s.id) + '" ' +
                'data-orig-x-m="' + sl.xM.toFixed(4) + '" ' +
                'data-orig-y-m="' + sl.yM.toFixed(4) + '" ' +
                'data-cx="' + scx.toFixed(2) + '" ' +
                'data-cy="' + scy.toFixed(2) + '" ' +
                'data-angle="' + sAngle + '" ' +
                'transform="rotate(' + sAngle + " " + scx.toFixed(1) + " " + scy.toFixed(1) + ')">' +
                sBody +
                sLabelSvg +
                sRotateSvg +
            "</g>";
        }).join("");

        let sunPathSvg = "";
        if (_farmLayers.sunPath) {
            const rad = ((_sunOrientationDeg - 90) * Math.PI) / 180;
            const sunCx = W / 2 + Math.cos(rad) * 195;
            const sunCy = H / 2 + Math.sin(rad) * 165;
            const eastRad = rad - Math.PI / 2.3;
            const westRad = rad + Math.PI / 2.3;
            const ex = W / 2 + Math.cos(eastRad) * 215;
            const ey = H / 2 + Math.sin(eastRad) * 175;
            const wx = W / 2 + Math.cos(westRad) * 215;
            const wy = H / 2 + Math.sin(westRad) * 175;

            sunPathSvg = '<g aria-label="Coastal BC Sun Path Overlay">' +
                '<path d="M ' + ex.toFixed(1) + " " + ey.toFixed(1) + " Q " + sunCx.toFixed(1) + " " + sunCy.toFixed(1) + " " + wx.toFixed(1) + " " + wy.toFixed(1) + '" ' +
                    'fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="6 4"/>' +
                '<circle cx="' + sunCx.toFixed(1) + '" cy="' + sunCy.toFixed(1) + '" r="9" fill="#f59e0b" stroke="#b45309" stroke-width="1.5"/>' +
                '<text x="' + sunCx.toFixed(1) + '" y="' + (sunCy + 22).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="800" fill="#b45309">Solar Peak ' + _sunOrientationDeg + "\u00b0</text>" +
            "</g>";
        }

        const scaleM = _state.units === "imperial" ? 9.144 : 10;
        const scaleLabel = _state.units === "imperial" ? "30 ft scale" : "10 m scale";
        const scalePx = Math.max(30, Math.min(180, scaleM * pxPerM));
        const activeAxisUnit = _farmAxisUnit || (_state.units === "imperial" ? "ft" : "m");
        const activeLat = _gpsLat !== null ? _gpsLat : 49.2;
        const locFooterLabel = _gpsLabel || ("South Coastal BC (" + activeLat.toFixed(1) + "\u00b0N)");

        // X and Y axis rulers along top and left edges
        let axisRulersSvg = "";
        if (typeof c.formatAxisMeasurement === "function" && pxPerM > 0) {
            const xTicks = [];
            const yTicks = [];
            const rawStepM = activeAxisUnit === "ft" ? (Math.max(1, Math.round(spanX / 6 / 0.3048)) * 0.3048) : Math.max(0.5, Math.round((spanX / 6) * 2) / 2);
            const stepM = Math.max(0.5, rawStepM);
            const startXM = Math.ceil(minX / stepM) * stepM;
            for (let xm = startXM; xm <= maxX + 0.01; xm += stepM) {
                const px = offsetX + xm * pxPerM;
                if (px >= 34 && px <= W - 78) {
                    const lbl = c.formatAxisMeasurement(Math.max(0, (xm - minX) * 100), activeAxisUnit);
                    xTicks.push(
                        '<line x1="' + px.toFixed(1) + '" y1="0" x2="' + px.toFixed(1) + '" y2="10" stroke="#64748b" stroke-width="1"/>' +
                        '<text x="' + px.toFixed(1) + '" y="20" text-anchor="middle" font-size="9" font-weight="700" fill="#475569">' + escHtml(lbl) + "</text>"
                    );
                }
            }
            const startYM = Math.ceil(minY / stepM) * stepM;
            for (let ym = startYM; ym <= maxY + 0.01; ym += stepM) {
                const py = offsetY + ym * pxPerM;
                if (py >= 28 && py <= H - 42) {
                    const lbl = c.formatAxisMeasurement(Math.max(0, (ym - minY) * 100), activeAxisUnit);
                    yTicks.push(
                        '<line x1="0" y1="' + py.toFixed(1) + '" x2="10" y2="' + py.toFixed(1) + '" stroke="#64748b" stroke-width="1"/>' +
                        '<text x="13" y="' + (py + 3).toFixed(1) + '" text-anchor="start" font-size="9" font-weight="700" fill="#475569">' + escHtml(lbl) + "</text>"
                    );
                }
            }
            axisRulersSvg = '<g class="wcpp-bs-farm-axis-rulers" aria-label="Garden Map Axis Rulers (' + escHtml(activeAxisUnit) + ')">' +
                '<rect x="0" y="0" width="' + W + '" height="24" fill="rgba(248,250,252,0.88)"/>' +
                '<rect x="0" y="24" width="44" height="' + (H - 24) + '" fill="rgba(248,250,252,0.82)"/>' +
                '<line x1="0" y1="24" x2="' + W + '" y2="24" stroke="#cbd5e1" stroke-width="1"/>' +
                '<line x1="44" y1="24" x2="44" y2="' + H + '" stroke="#cbd5e1" stroke-width="1"/>' +
                '<text x="6" y="16" font-size="8.5" font-weight="800" fill="#166534">' + escHtml(activeAxisUnit.toUpperCase()) + "</text>" +
                xTicks.join("") + yTicks.join("") +
            "</g>";
        }

        return '<svg id="wcppBsFarmMapSvg" class="wcpp-bs-farm-svg is-interactive" viewBox="0 0 ' + W + " " + H + '" ' +
            'data-px-per-m="' + pxPerM.toFixed(4) + '" ' +
            'data-offset-x="' + offsetX.toFixed(4) + '" ' +
            'data-offset-y="' + offsetY.toFixed(4) + '" ' +
            'role="img" aria-label="Interactive scaled physical garden map with blocks, greenhouses, custom shapes, shade structures, cast shadows, movable tunnels, compass rose, and solar orientation">' +
            "<defs>" +
                '<pattern id="wcppFarmHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">' +
                    '<line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" stroke-width="2"/>' +
                "</pattern>" +
            "</defs>" +
            '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
            gridLines +
            blocksSvg +
            castShadowsSvg +
            structuresSvg +
            sunPathSvg +
            axisRulersSvg +
            '<g transform="translate(' + (W - 56) + ', 52)">' +
                '<circle cx="0" cy="0" r="24" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>' +
                '<polygon points="0,-18 5,-3 0,-7 -5,-3" fill="#166534"/>' +
                '<polygon points="0,18 5,3 0,7 -5,3" fill="#94a3b8"/>' +
                '<text x="0" y="-27" text-anchor="middle" font-size="10" font-weight="800" fill="#111827">N</text>' +
                '<text x="0" y="34" text-anchor="middle" font-size="9" font-weight="700" fill="#4b5563">S</text>' +
                '<text x="-31" y="3" text-anchor="middle" font-size="9" font-weight="700" fill="#4b5563">W</text>' +
                '<text x="31" y="3" text-anchor="middle" font-size="9" font-weight="700" fill="#4b5563">E</text>' +
            "</g>" +
            '<g transform="translate(52, ' + (H - 26) + ')">' +
                '<line x1="0" y1="0" x2="' + scalePx.toFixed(1) + '" y2="0" stroke="#111827" stroke-width="2.5"/>' +
                '<line x1="0" y1="-5" x2="0" y2="5" stroke="#111827" stroke-width="2"/>' +
                '<line x1="' + scalePx.toFixed(1) + '" y1="-5" x2="' + scalePx.toFixed(1) + '" y2="5" stroke="#111827" stroke-width="2"/>' +
                '<text x="0" y="-8" font-size="10.5" font-weight="700" fill="#4b5563">' + scaleLabel + " \u00b7 " + escHtml(locFooterLabel) + "</text>" +
            "</g>" +
        "</svg>";
    }

    function renderFarmMapWrapInnerHtml(season) {
        return '<div class="wcpp-bs-farm-drag-hud" id="wcppBsFarmDragHud" hidden></div>' + renderFarmSvg(season);
    }

    function renderFarmLayoutTab(season) {
        const c = core();
        const fd = _state.farmDefaults || {};
        const blocks = (season && season.blocks) || [];
        const tunnels = (season && season.tunnels) || [];
        const structures = (season && Array.isArray(season.structures)) ? season.structures : [];
        const isImp = _state.units === "imperial";

        const widthVal = isImp ? c.cmToIn(fd.bedWidthCm || 75) : Math.round(fd.bedWidthCm || 75);
        const pathVal = isImp ? c.cmToIn(fd.pathWidthCm || 30) : Math.round(fd.pathWidthCm || 30);
        const lenVal = isImp ? c.mToFt(fd.bedLengthM || 30) : Number(fd.bedLengthM || 30).toFixed(1).replace(/\.0$/, "");
        const benchVal = isImp ? Math.round((fd.benchAreaM2 || 40) * 10.7639) : Math.round(fd.benchAreaM2 || 40);

        const presetsHtml = c.STANDARD_BED_PRESETS.map(function (pr) {
            return '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="apply-std-bed" data-std-id="' + escHtml(pr.id) + '">' + escHtml(pr.name) + "</button>";
        }).join("");

        const layerSwitches = [
            { key: "blockNames", label: "Block Names" },
            { key: "bedNumbers", label: "Bed Numbers" },
            { key: "tunnels", label: "Tunnels" },
            { key: "sunPath", label: "Sun Path" }
        ].map(function (sw) {
            const on = Boolean(_farmLayers[sw.key]);
            return '<button type="button" class="wcpp-bs-switch' + (on ? " is-on" : "") + '" data-action="toggle-farm-layer" data-layer="' + sw.key + '">' + escHtml(sw.label) + "</button>";
        }).join("");

        const blocksListHtml = blocks.map(function (b) {
            const isSel = _selectedBlockId === b.id;
            const isCustom = b.shapeType === "custom" && Boolean(b.customShape);
            const isCont = isContainerBlock(b);
            const contClass = getContainerCardClass(b);
            const contBadge = isCont ? formatContainerSummaryBadge(b, _state.units) : "";
            const mediaChip = formatGrowingMediaChip(b);
            const placedCount = getBlockPlacedPlantCount(season, b.id);
            const lenInp = isImp ? c.mToFt(b.bedLengthM) : b.bedLengthM;
            const widInp = isImp ? c.cmToIn(b.bedWidthCm) : b.bedWidthCm;
            const customGeom = isCustom && typeof c.computeCustomShapeGeometry === "function"
                ? c.computeCustomShapeGeometry(b.customShape)
                : null;
            const customAreaDisp = isCustom
                ? (isImp
                    ? ((customGeom ? customGeom.areaFt2 : +((b.areaM2 || 0) * 10.7639).toFixed(2)) + " ft\u00b2")
                    : ((customGeom ? customGeom.areaM2 : (b.areaM2 || 0)) + " m\u00b2"))
                : "";
            const hzInfo = getBlockHydrozoneSummary(b, season);
            const hz = hzInfo.rep;
            const hzCls = hzInfo.anyMismatch ? "is-mismatch" : (hz.dominantTier === "low" ? "is-low" : (hz.dominantTier === "high" ? "is-high" : ""));
            const hzBadgeText = hzInfo.anyMismatch
                ? ("Hydrozone Mismatch \u00b7 Summer: " + hz.summerCadenceLabel)
                : ("Summer Watering: " + hz.summerCadenceLabel + " (" + hz.dominantTier + ")");

            return '<div class="wcpp-bs-entity-card' + contClass + '" style="' + (isSel ? "border-color:var(--bs-primary);" : "") + '">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">' +
                        "<strong>" + escHtml(b.name) + " (" + escHtml(getBlockTypeLabel(b)) + ")</strong>" +
                        (contBadge ? '<span class="wcpp-bs-container-badge">' + escHtml(contBadge) + "</span>" : "") +
                        (isCustom ? '<span class="wcpp-bs-badge wcpp-bs-status-ok">' + escHtml(customAreaDisp) + "</span>" : "") +
                        (mediaChip ? '<span class="wcpp-bs-media-chip">' + escHtml(mediaChip) + "</span>" : "") +
                        '<span class="wcpp-bs-hydrozone-badge ' + hzCls + '" title="' + escHtml((hz.notes || []).join(" ")) + '">' + svgIcon("droplet", 11) + "<span>" + escHtml(hzBadgeText) + "</span></span>" +
                    "</div>" +
                    '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-xs" data-action="open-playground" data-block-id="' + escHtml(b.id) + '" data-bed-number="1">' + svgIcon("playground", 12) + "<span>Plant Playground (" + placedCount + ")</span></button>" +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="edit-container-media" data-block-id="' + escHtml(b.id) + '">' + svgIcon("mix", 12) + "<span>Edit Media</span></button>" +
                        (isCustom ? '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="edit-block-shape" data-block-id="' + escHtml(b.id) + '">Edit Shape</button>' : "") +
                        '<button type="button" class="wcpp-bs-chip-toggle' + (b.isFallow ? " is-on" : "") + '" data-action="toggle-fallow" data-block-id="' + escHtml(b.id) + '">' + (b.isFallow ? "Fallow: ON" : "Fallow: OFF") + "</button>" +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-action="delete-block" data-block-id="' + escHtml(b.id) + '">Remove</button>' +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-form-grid">' +
                    '<div class="wcpp-bs-field"><label>Name</label><input class="wcpp-bs-input" type="text" value="' + escHtml(b.name) + '" data-block-edit="name" data-block-id="' + escHtml(b.id) + '"></div>' +
                    ((isCustom || isCont)
                        ? ('<div class="wcpp-bs-field"><label>' + (isCont ? "Container Size &amp; Volume" : "Dimensions") + '</label><div style="padding:7px 9px; border:1px solid var(--bs-border-soft); border-radius:8px; font-size:0.8rem; background:var(--bs-surface);">' + escHtml(formatBedSizeSummary(b, _state.units)) + "</div></div>")
                        : (
                            '<div class="wcpp-bs-field"><label>Beds</label><input class="wcpp-bs-input" type="number" min="1" max="24" value="' + b.bedCount + '" data-block-edit="bedCount" data-block-id="' + escHtml(b.id) + '"></div>' +
                            '<div class="wcpp-bs-field"><label>Length (' + (isImp ? "ft" : "m") + ')</label><input class="wcpp-bs-input" type="number" step="0.5" min="1" value="' + lenInp + '" data-block-edit="bedLength" data-block-id="' + escHtml(b.id) + '"></div>' +
                            '<div class="wcpp-bs-field"><label>Width (' + (isImp ? "in" : "cm") + ')</label><input class="wcpp-bs-input" type="number" min="12" value="' + widInp + '" data-block-edit="bedWidth" data-block-id="' + escHtml(b.id) + '"></div>'
                        )) +
                    '<div class="wcpp-bs-field"><label>Angle (0\u2013360\u00b0)</label><input class="wcpp-bs-input" type="number" min="0" max="360" value="' + (b.angleDeg || 0) + '" data-block-edit="angleDeg" data-block-id="' + escHtml(b.id) + '"></div>' +
                "</div>" +
            "</div>";
        }).join("");

        const structurePresetBtns = [
            { id: "fence", label: "+ Fence 1.8m" },
            { id: "shed", label: "+ Shed 2.6m" },
            { id: "hedge", label: "+ Hedge 3.0m" },
            { id: "tree", label: "+ Tree 5.5m" },
            { id: "house", label: "+ House Wall 6.0m" }
        ].map(function (sp) {
            return '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="add-structure" data-preset-id="' + sp.id + '">' + escHtml(sp.label) + "</button>";
        }).join("");

        const structuresListHtml = structures.length ? structures.map(function (rawS, idx) {
            const s = typeof c.normalizeShadeStructure === "function" ? c.normalizeShadeStructure(rawS, idx) : rawS;
            const isSelS = _selectedStructureId === s.id;
            const wVal = isImp ? c.mToFt(s.widthM) : s.widthM;
            const lVal = isImp ? c.mToFt(s.lengthM) : s.lengthM;
            const hVal = isImp ? c.mToFt(s.heightM) : s.heightM;
            const hBadge = isImp
                ? (c.mToFt(s.heightM) + " ft tall")
                : (Number(s.heightM).toFixed(1).replace(/\.0$/, "") + " m tall");
            const unitLabel = isImp ? "ft" : "m";
            return '<div class="wcpp-bs-entity-card" style="' + (isSelS ? "border-color:var(--bs-interplant);" : "") + '">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">' +
                        "<strong>" + escHtml(s.name) + "</strong>" +
                        '<span class="wcpp-bs-badge">' + escHtml(getStructureTypeLabel(s.kind)) + " \u00b7 " + escHtml(hBadge) + "</span>" +
                    "</div>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-action="delete-structure" data-structure-id="' + escHtml(s.id) + '">Remove</button>' +
                "</div>" +
                '<div class="wcpp-bs-form-grid">' +
                    '<div class="wcpp-bs-field"><label>Name</label><input class="wcpp-bs-input" type="text" value="' + escHtml(s.name) + '" data-structure-edit="name" data-structure-id="' + escHtml(s.id) + '"></div>' +
                    '<div class="wcpp-bs-field"><label>Width (' + unitLabel + ')</label><input class="wcpp-bs-input" type="number" step="0.2" min="0.2" value="' + wVal + '" data-structure-edit="width" data-structure-id="' + escHtml(s.id) + '"></div>' +
                    '<div class="wcpp-bs-field"><label>Length (' + unitLabel + ')</label><input class="wcpp-bs-input" type="number" step="0.2" min="0.2" value="' + lVal + '" data-structure-edit="length" data-structure-id="' + escHtml(s.id) + '"></div>' +
                    '<div class="wcpp-bs-field"><label>Height (' + unitLabel + ')</label><input class="wcpp-bs-input" type="number" step="0.2" min="0.2" value="' + hVal + '" data-structure-edit="height" data-structure-id="' + escHtml(s.id) + '"></div>' +
                    '<div class="wcpp-bs-field"><label>Angle (0\u2013360\u00b0)</label><input class="wcpp-bs-input" type="number" min="0" max="360" value="' + (s.angleDeg || 0) + '" data-structure-edit="angleDeg" data-structure-id="' + escHtml(s.id) + '"></div>' +
                "</div>" +
            "</div>";
        }).join("") : '<p style="margin:0; font-size:0.83rem; color:var(--bs-muted);">No shade structures yet. Add a fence, shed, hedge, tree, or house wall to simulate cast shadows and direct-sun hours.</p>';

        const savedShapes = typeof c.listCustomShapes === "function" ? c.listCustomShapes() : [];
        const savedShapesHtml = savedShapes.length ? savedShapes.map(function (sh) {
            const geom = typeof c.computeCustomShapeGeometry === "function" ? c.computeCustomShapeGeometry(sh) : null;
            const pad = geom ? Math.max(12, Math.round(Math.max(geom.widthCm, geom.heightCm) * 0.1)) : 12;
            const vbW = geom ? (geom.widthCm + pad * 2) : 260;
            const vbH = geom ? (geom.heightCm + pad * 2) : 140;
            const areaDisp = geom
                ? (isImp ? (geom.areaFt2 + " ft\u00b2") : (geom.areaM2 + " m\u00b2"))
                : "";
            const boundsDisp = geom
                ? (isImp
                    ? (c.mToFt(geom.widthCm / 100) + " ft \u00d7 " + c.cmToIn(geom.heightCm) + " in")
                    : (Math.round(geom.widthCm) + " \u00d7 " + Math.round(geom.heightCm) + " cm"))
                : "";
            return '<div class="wcpp-bs-saved-shape-card">' +
                '<div class="wcpp-bs-shape-thumb">' +
                    (geom
                        ? ('<svg viewBox="' + (-pad) + " " + (-pad) + " " + vbW + " " + vbH + '" aria-hidden="true">' +
                            '<path d="' + escHtml(geom.pathD) + '" fill="#ecfdf5" stroke="#166534" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
                           "</svg>")
                        : "") +
                "</div>" +
                '<div style="display:flex; justify-content:space-between; align-items:baseline; gap:6px;">' +
                    '<strong style="font-size:0.86rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escHtml(sh.name) + "</strong>" +
                    '<span class="wcpp-bs-badge">' + escHtml(areaDisp) + "</span>" +
                "</div>" +
                '<div style="font-size:0.75rem; color:var(--bs-muted);">' + escHtml(boundsDisp) + "</div>" +
                '<div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:auto;">' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-xs" data-action="add-saved-shape-to-garden" data-shape-id="' + escHtml(sh.id) + '">Add to Garden</button>' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="edit-saved-shape" data-shape-id="' + escHtml(sh.id) + '">Edit</button>' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="download-saved-shape" data-shape-id="' + escHtml(sh.id) + '">Download .json</button>' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-action="delete-saved-shape" data-shape-id="' + escHtml(sh.id) + '">Delete</button>' +
                "</div>" +
            "</div>";
        }).join("") : '<p style="margin:0; font-size:0.83rem; color:var(--bs-muted);">No saved custom bed shapes yet. Click <strong>+ Draw Custom Shape</strong> to draft a keyhole, crescent, kidney, L-shape, or freeform bed.</p>';

        const blockOptions = blocks.map(function (b) {
            return '<option value="' + escHtml(b.id) + '">' + escHtml(b.name) + " (" + b.bedCount + " beds)</option>";
        }).join("");

        const tunnelsListHtml = tunnels.length ? tunnels.map(function (t) {
            const blk = blocks.find(function (b) { return b.id === t.blockId; });
            return '<div class="wcpp-bs-entity-card">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    "<div><strong>" + escHtml(t.name) + '</strong> <span class="wcpp-bs-badge">' + escHtml(t.type) + '</span> <span style="font-size:0.78rem; color:var(--bs-muted);">' + escHtml(blk ? blk.name : t.blockId) + " \u00b7 Beds " + t.startBed + "\u2013" + t.endBed + "</span></div>" +
                    '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
                        '<button type="button" class="wcpp-bs-chip-toggle' + (t.disableNeighbors ? " is-on" : "") + '" data-action="toggle-tunnel-neighbors" data-tunnel-id="' + escHtml(t.id) + '">Disable Neighbors: ' + (t.disableNeighbors ? "ON" : "OFF") + "</button>" +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-action="delete-tunnel" data-tunnel-id="' + escHtml(t.id) + '">Remove</button>' +
                    "</div>" +
                "</div>" +
            "</div>";
        }).join("") : '<p style="margin:0; font-size:0.83rem; color:var(--bs-muted);">No movable tunnels in this season.</p>';

        const solarPos = typeof c.computeSolarPosition === "function"
            ? c.computeSolarPosition(_shadowMonth, _shadowHour, 49.19)
            : { altitudeDeg: 45, azimuthDeg: 180, isDaylight: true };
        const shadowMonthOpts = [3, 4, 5, 6, 7, 8, 9, 10].map(function (mo) {
            return '<option value="' + mo + '"' + (_shadowMonth === mo ? " selected" : "") + ">" + MONTHS[mo - 1] + "</option>";
        }).join("");
        const seasonPresetsHtml = [
            { mo: 4, label: "Spring" },
            { mo: 6, label: "Summer" },
            { mo: 9, label: "Fall" }
        ].map(function (sp) {
            const active = _shadowMonth === sp.mo;
            return '<button type="button" class="wcpp-bs-seg-btn' + (active ? " is-active" : "") + '" data-action="set-shadow-month" data-month="' + sp.mo + '">' + sp.label + "</button>";
        }).join("");

        return '<div class="wcpp-bs-split-layout">' +
            '<div style="display:flex; flex-direction:column; gap:16px;">' +
                '<div class="wcpp-bs-card">' +
                    '<div class="wcpp-bs-card-header"><h3>Standard Bed Defaults</h3></div>' +
                    '<div class="wcpp-bs-preset-pills">' + presetsHtml + "</div>" +
                    '<div class="wcpp-bs-form-grid">' +
                        '<div class="wcpp-bs-field"><label>Bed Width (' + (isImp ? "in" : "cm") + ')</label><input class="wcpp-bs-input" type="number" min="12" value="' + widthVal + '" data-std-input="bedWidth"></div>' +
                        '<div class="wcpp-bs-field"><label>Path Width (' + (isImp ? "in" : "cm") + ')</label><input class="wcpp-bs-input" type="number" min="6" value="' + pathVal + '" data-std-input="pathWidth"></div>' +
                        '<div class="wcpp-bs-field"><label>Bed Length (' + (isImp ? "ft" : "m") + ')</label><input class="wcpp-bs-input" type="number" step="0.5" min="1" value="' + lenVal + '" data-std-input="bedLength"></div>' +
                        '<div class="wcpp-bs-field"><label>Nursery Bench (' + (isImp ? "ft\u00b2" : "m\u00b2") + ')</label><input class="wcpp-bs-input" type="number" min="1" value="' + benchVal + '" data-std-input="benchArea"></div>' +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-card">' +
                    '<div class="wcpp-bs-card-header">' +
                        "<h3>Field Blocks, Greenhouses &amp; Containers</h3>" +
                        '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-xs" data-action="open-container-modal" data-block-type="pot">' + svgIcon("pot", 12) + "<span>+ Add Pot / Basket / Bench</span></button>" +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="open-shape-designer">+ Draw Custom Shape</button>' +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="upload-farm-shape">' + svgIcon("upload", 12) + "<span>Upload Shape (.json)</span></button>" +
                            '<input type="file" id="wcppBsFarmShapeUploadInput" accept=".json,.wcpp-shape.json,application/json" hidden>' +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="add-block" data-block-type="field">+ Field Block</button>' +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="add-block" data-block-type="greenhouse">+ Greenhouse</button>' +
                        "</div>" +
                    "</div>" +
                    '<div class="wcpp-bs-entity-list">' + blocksListHtml + "</div>" +
                "</div>" +
                '<div class="wcpp-bs-card">' +
                    '<div class="wcpp-bs-card-header">' +
                        "<h3>Shade Structures &amp; Obstacles (" + structures.length + ")</h3>" +
                        '<div style="display:flex; gap:5px; flex-wrap:wrap;">' + structurePresetBtns + "</div>" +
                    "</div>" +
                    '<div class="wcpp-bs-entity-list">' + structuresListHtml + "</div>" +
                "</div>" +
                '<div class="wcpp-bs-card">' +
                    '<div class="wcpp-bs-card-header">' +
                        "<h3>My Custom Shapes (" + savedShapes.length + ")</h3>" +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="open-shape-designer">' + svgIcon("plus", 12) + "<span>New Shape</span></button>" +
                    "</div>" +
                    '<div class="wcpp-bs-saved-shapes-grid">' + savedShapesHtml + "</div>" +
                "</div>" +
                '<div class="wcpp-bs-card">' +
                    '<div class="wcpp-bs-card-header"><h3>Movable Tunnels</h3></div>' +
                    '<div class="wcpp-bs-entity-list" style="margin-bottom:12px;">' + tunnelsListHtml + "</div>" +
                    (blocks.length ? (
                        '<div class="wcpp-bs-form-grid" style="padding-top:10px; border-top:1px solid var(--bs-border-soft);">' +
                            '<div class="wcpp-bs-field"><label>Tunnel Name</label><input class="wcpp-bs-input" id="wcppNewTunnelName" type="text" value="Caterpillar Tunnel ' + (tunnels.length + 1) + '"></div>' +
                            '<div class="wcpp-bs-field"><label>Type</label><select class="wcpp-bs-select" id="wcppNewTunnelType"><option value="Caterpillar">Caterpillar</option><option value="Mini">Mini Hoop</option><option value="High">High Tunnel</option></select></div>' +
                            '<div class="wcpp-bs-field"><label>Block</label><select class="wcpp-bs-select" id="wcppNewTunnelBlock">' + blockOptions + "</select></div>" +
                            '<div class="wcpp-bs-field"><label>Start Bed</label><input class="wcpp-bs-input" id="wcppNewTunnelStart" type="number" min="1" value="1"></div>' +
                            '<div class="wcpp-bs-field"><label>End Bed</label><input class="wcpp-bs-input" id="wcppNewTunnelEnd" type="number" min="1" value="2"></div>' +
                            '<div class="wcpp-bs-field" style="grid-column:1 / -1;"><label>Reserve Side Beds for Tunnel Legs</label><label style="display:flex;align-items:center;gap:6px;min-height:36px;font-weight:700;"><input type="checkbox" id="wcppNewTunnelDisable" checked> Reserve Side Beds for Tunnel Legs</label><div style="font-size:0.75rem;color:var(--bs-muted);margin-top:2px;">Keeps the beds on either side of the tunnel unplanted so hoops and anchors have room.</div></div>' +
                        "</div>" +
                        '<div style="margin-top:10px;"><button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="add-tunnel">' + svgIcon("plus", 13) + "<span>Add Movable Tunnel</span></button></div>"
                    ) : "") +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<h3>Physical Garden Map (To Scale)</h3>" +
                    '<div class="wcpp-bs-toolbar-group">' +
                        '<div class="wcpp-bs-segmented" role="group" aria-label="Map Ruler Units">' +
                            ["ft", "m", "cm"].map(function (u) {
                                const activeU = _farmAxisUnit || (isImp ? "ft" : "m");
                                return '<button type="button" class="wcpp-bs-seg-btn' + (activeU === u ? " is-active" : "") + '" data-action="set-farm-axis-unit" data-unit="' + u + '">' + u + "</button>";
                            }).join("") +
                        "</div>" +
                        '<button type="button" class="wcpp-bs-chip-toggle' + (_farmSnapEnabled ? " is-on" : "") + '" data-action="toggle-farm-snap" aria-pressed="' + (_farmSnapEnabled ? "true" : "false") + '" title="Snap dragged beds to 0.5 m / 1 ft grid or move freely">' +
                            escHtml(_farmSnapEnabled ? ("Snap Grid: " + (isImp ? "1 ft" : "0.5 m")) : "Snap Grid: Free") +
                        "</button>" +
                        layerSwitches +
                    "</div>" +
                "</div>" +
                '<p class="wcpp-bs-farm-hint">Drag any bed, greenhouse, container, custom shape, or shade structure on the grid to reposition \u00b7 Drag the top handle to rotate</p>' +
                '<div class="wcpp-bs-shadow-scrubber" role="region" aria-label="Sun and Cast Shadow Scrubber">' +
                    '<button type="button" class="wcpp-bs-switch' + (_shadowShow ? " is-on" : "") + '" data-action="toggle-shadow-overlay" aria-pressed="' + (_shadowShow ? "true" : "false") + '">Show Shadows</button>' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs' + (_gpsLat !== null ? " wcpp-bs-btn-primary" : "") + '" data-action="use-my-gps"' + (_gpsLoading ? " disabled" : "") + '>' + escHtml(_gpsLoading ? "Locating\u2026" : (_gpsLat !== null ? "GPS Active" : "Use My GPS")) + "</button>" +
                    '<div class="wcpp-bs-segmented" role="group" aria-label="Shadow Season Preset">' + seasonPresetsHtml + "</div>" +
                    '<select class="wcpp-bs-select" id="wcppShadowMonthSelect" data-action="shadow-month" aria-label="Shadow Month (Mar-Oct)">' + shadowMonthOpts + "</select>" +
                    '<label for="wcppShadowHourSlider" style="font-weight:800;">Time:</label>' +
                    '<input id="wcppShadowHourSlider" type="range" min="7" max="20" step="1" value="' + _shadowHour + '" data-action="shadow-hour-slider" aria-label="Shadow Time of Day (7 AM to 8 PM)">' +
                    '<span class="wcpp-bs-shadow-readout" id="wcppBsShadowReadout">' + escHtml((function () {
                        const lat = _gpsLat !== null ? _gpsLat : 49.2;
                        const sp = typeof c.computeSolarPosition === "function"
                            ? c.computeSolarPosition(_shadowMonth, _shadowHour, lat, _shadowDay, _gpsLon)
                            : solarPos;
                        const peak = typeof c.computeSunPeakSummary === "function"
                            ? c.computeSunPeakSummary(_shadowMonth, _shadowDay, lat, _gpsLon, _gpsLabel)
                            : null;
                        const base = MONTHS[_shadowMonth - 1] + " " + _shadowDay + " \u00b7 " + formatHour12(_shadowHour) + " \u00b7 Alt " + Math.round(sp.altitudeDeg) + "\u00b0 \u00b7 Az " + Math.round(sp.azimuthDeg) + "\u00b0";
                        return peak && peak.peakAltitudeDeg ? (base + " \u00b7 Peak " + Math.round(peak.peakAltitudeDeg) + "\u00b0" + (peak.peakTimeLabel ? " @ " + peak.peakTimeLabel : "")) : base;
                    })()) + "</span>" +
                "</div>" +
                '<div class="wcpp-bs-slider-row" style="margin-bottom:12px;">' +
                    '<label for="wcppSunSlider" style="font-size:0.82rem; font-weight:800;">Sun Orientation Angle:</label>' +
                    '<input id="wcppSunSlider" type="range" min="0" max="360" value="' + _sunOrientationDeg + '" data-action="sun-slider">' +
                    '<span class="wcpp-bs-badge">' + _sunOrientationDeg + "\u00b0</span>" +
                "</div>" +
                (getV6Module() && typeof getV6Module().renderFarmTimeLapseBar === "function" ? getV6Module().renderFarmTimeLapseBar(getV6Ctx(), season) : "") +
                '<div class="wcpp-bs-farm-svg-wrap">' + renderFarmMapWrapInnerHtml(season) + "</div>" +
                renderSunWarningsHtml(season) +
            "</div>" +
        "</div>";
    }

    function renderOptimizerChartSvg(baseline, optimized) {
        const W = 700;
        const H = 310;
        const dims = [
            { key: "rotations", label: "Crop Family Rotations" },
            { key: "fertility", label: "Fertility Balance" },
            { key: "standardization", label: "Planting Standardization" },
            { key: "structure", label: "Structure Compliance" }
        ];
        const barX = 210;
        const maxBarW = 340;
        const rowY = [48, 104, 160, 216];

        let rowsSvg = "";
        dims.forEach(function (dim, idx) {
            const y = rowY[idx];
            const bScore = Math.max(0, Math.min(100, Number(baseline[dim.key] || 0)));
            const oScore = optimized ? Math.max(0, Math.min(100, Number(optimized[dim.key] || 0))) : bScore;
            const delta = oScore - bScore;
            const bW = +((bScore / 100) * maxBarW).toFixed(1);
            const oW = +((oScore / 100) * maxBarW).toFixed(1);
            const labelText = optimized
                ? bScore + "% \u2192 " + oScore + "% (" + (delta >= 0 ? "+" : "") + delta + "%)"
                : bScore + "%";
            const labelX = barX + Math.max(bW, oW) + 8;

            rowsSvg += '<text x="196" y="' + (y + 22) + '" text-anchor="end" font-size="13.5" font-weight="600" fill="#111827">' + escHtml(dim.label) + "</text>" +
                '<rect x="' + barX + '" y="' + y + '" width="' + bW + '" height="14" rx="2" fill="#9CA3AF"/>' +
                '<rect x="' + barX + '" y="' + (y + 18) + '" width="' + oW + '" height="16" rx="2" fill="' + (optimized ? "#15803D" : "#0369A1") + '"/>' +
                '<text x="' + Math.min(568, labelX) + '" y="' + (y + 30) + '" font-size="12.5" font-weight="700" fill="' + (optimized ? "#14532D" : "#4B5563") + '">' + escHtml(labelText) + "</text>";
        });

        return '<svg class="wcpp-bs-optimizer-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="4-dimension baseline versus tuned bed plan comparison chart">' +
            '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#FFFFFF"/>' +
            '<line x1="210" y1="36" x2="210" y2="256" stroke="#D1D5DB" stroke-width="1"/>' +
            '<line x1="295" y1="36" x2="295" y2="256" stroke="#E5E7EB" stroke-width="1"/>' +
            '<line x1="380" y1="36" x2="380" y2="256" stroke="#E5E7EB" stroke-width="1"/>' +
            '<line x1="465" y1="36" x2="465" y2="256" stroke="#E5E7EB" stroke-width="1"/>' +
            '<line x1="550" y1="36" x2="550" y2="256" stroke="#E5E7EB" stroke-width="1"/>' +
            '<text x="210" y="276" text-anchor="middle" font-size="12" fill="#4B5563">0%</text>' +
            '<text x="295" y="276" text-anchor="middle" font-size="12" fill="#4B5563">25%</text>' +
            '<text x="380" y="276" text-anchor="middle" font-size="12" fill="#4B5563">50%</text>' +
            '<text x="465" y="276" text-anchor="middle" font-size="12" fill="#4B5563">75%</text>' +
            '<text x="550" y="276" text-anchor="middle" font-size="12" fill="#4B5563">100%</text>' +
            '<rect x="210" y="10" width="14" height="10" rx="2" fill="#9CA3AF"/>' +
            '<text x="230" y="19" font-size="12.5" fill="#4B5563">Baseline score</text>' +
            '<rect x="345" y="10" width="14" height="10" rx="2" fill="' + (optimized ? "#15803D" : "#0369A1") + '"/>' +
            '<text x="365" y="19" font-size="12.5" fill="#14532D">' + (optimized ? "After optimization" : "Current active score") + "</text>" +
            rowsSvg +
        "</svg>";
    }

    function renderHydrozoneAuditCardHtml(season) {
        const c = core();
        const blocks = (season && season.blocks) || [];
        if (typeof c.analyzeBedHydrozones !== "function") return "";
        const entries = [];
        blocks.forEach(function (b) {
            const cnt = Math.max(1, Number(b.bedCount || 1));
            const isCont = isContainerBlock(b);
            for (let bn = 1; bn <= cnt; bn++) {
                const hz = c.analyzeBedHydrozones(b, bn, season, _catalog);
                const totalCrops = (hz.cropsByTier.low.length + hz.cropsByTier.moderate.length + hz.cropsByTier.high.length);
                if (totalCrops > 0 || isCont) {
                    entries.push({
                        block: b,
                        bedNumber: bn,
                        isCont: isCont,
                        totalCrops: totalCrops,
                        hz: hz
                    });
                }
            }
        });
        entries.sort(function (a, b) {
            if (a.hz.hasMismatch !== b.hz.hasMismatch) return a.hz.hasMismatch ? -1 : 1;
            return (a.hz.summerDaysBetweenWatering || 4) - (b.hz.summerDaysBetweenWatering || 4);
        });
        const mismatchCount = entries.filter(function (e) { return e.hz.hasMismatch; }).length;

        const rowsHtml = entries.length ? entries.map(function (entry) {
            const b = entry.block;
            const hz = entry.hz;
            const locName = entry.isCont || Number(b.bedCount || 1) === 1
                ? b.name
                : (b.name + " \u00b7 Bed " + entry.bedNumber);
            const hzCls = hz.hasMismatch ? "is-mismatch" : (hz.dominantTier === "low" ? "is-low" : (hz.dominantTier === "high" ? "is-high" : ""));
            const detailParts = [];
            if (hz.hasMismatch && hz.mismatchSummary) {
                detailParts.push(hz.mismatchSummary);
            } else if (hz.notes && hz.notes.length) {
                detailParts.push(hz.notes[0]);
            }
            if (hz.cropsByTier.low.length) detailParts.push("Low thirst: " + hz.cropsByTier.low.join(", "));
            if (hz.cropsByTier.high.length) detailParts.push("High thirst: " + hz.cropsByTier.high.join(", "));

            return '<div class="wcpp-bs-hydrozone-audit-row' + (hz.hasMismatch ? " is-mismatch" : "") + '">' +
                '<div style="flex:1 1 260px; min-width:0;">' +
                    '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">' +
                        "<strong>" + escHtml(locName) + "</strong>" +
                        '<span class="wcpp-bs-hydrozone-badge ' + hzCls + '">' + svgIcon("droplet", 11) + "<span>" + escHtml(hz.summerCadenceLabel) + " \u00b7 " + hz.dryOutFactor + "x dry factor</span></span>" +
                        (hz.hasMismatch ? '<span class="wcpp-bs-badge wcpp-bs-status-warn">Low vs High Mismatch</span>' : "") +
                    "</div>" +
                    '<div style="font-size:0.79rem; opacity:0.9;">' + escHtml(detailParts.join(" \u00b7 ")) + "</div>" +
                "</div>" +
                '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="open-playground" data-block-id="' + escHtml(b.id) + '" data-bed-number="' + entry.bedNumber + '">Inspect Playground</button>' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="edit-container-media" data-block-id="' + escHtml(b.id) + '">Edit Media</button>' +
                "</div>" +
            "</div>";
        }).join("") : '<p style="margin:0; font-size:0.83rem; color:var(--bs-muted);">Add crops or containers to inspect summer hydrozone watering cadences.</p>';

        return '<div class="wcpp-bs-chart-card" id="wcppBsHydrozoneAuditCard" style="grid-column: 1 / -1;">' +
            '<div class="wcpp-bs-card-header">' +
                "<h3>Hydrozone &amp; Watering Audit</h3>" +
                '<span class="wcpp-bs-badge ' + (mismatchCount > 0 ? "wcpp-bs-status-warn" : "wcpp-bs-status-ok") + '">' +
                    (mismatchCount > 0 ? (mismatchCount + " Hydrozone Mismatch" + (mismatchCount === 1 ? "" : "es")) : "All Hydrozones Aligned") +
                "</span>" +
            "</div>" +
            '<div class="wcpp-bs-hydrozone-audit">' + rowsHtml + "</div>" +
        "</div>";
    }

    function renderInsightsTab(season, baseline) {
        const opt = _optimizerPreview;
        const activeScore = opt ? opt.optimized : baseline;
        const diags = activeScore.diagnostics || [];

        const diagHtml = diags.map(function (d) {
            const sevClass = d.severity === "error" ? "is-error" : (d.severity === "warn" ? "is-warn" : (d.severity === "ok" ? "is-ok" : "is-info"));
            return '<button type="button" class="wcpp-bs-diag-item ' + sevClass + '" data-action="inspect-diag" ' +
                'data-block-id="' + escHtml(d.blockId || "") + '" data-bed-start="' + escHtml(d.bedStart || "") + '" data-planting-id="' + escHtml(d.plantingId || "") + '">' +
                '<div style="text-align:left;">' +
                    '<strong style="display:block; font-size:0.86rem;">' + escHtml(d.title) + "</strong>" +
                    '<span style="font-size:0.79rem; color:var(--bs-muted);">' + escHtml(d.message) + "</span>" +
                "</div>" +
                '<span class="wcpp-bs-badge">' + escHtml(d.dimension || "check") + " \u2192</span>" +
            "</button>";
        }).join("");

        const previewBanner = opt
            ? '<div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-radius:10px; background:var(--bs-primary-soft); border:1px solid var(--bs-primary-border); margin-bottom:12px;">' +
                '<span style="font-size:0.84rem; font-weight:800; color:var(--bs-primary);">Tested ' + opt.iterationsTested + " scenarios in " + opt.elapsedMs + " ms \u2014 Overall " + opt.baseline.overall + "% \u2192 " + opt.optimized.overall + "% (" + opt.changes.length + " bed placement changes)</span>" +
                '<div style="display:flex; gap:8px;">' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="apply-optimized">Apply Optimized Plan</button>' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="discard-optimized">Discard</button>' +
                "</div>" +
            "</div>"
            : "";

        return '<div class="wcpp-bs-insights-layout">' +
            '<div class="wcpp-bs-chart-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<h3>Bed Health &amp; Companion Tune-Up</h3>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="run-optimizer">' + svgIcon("spark", 14) + "<span>Auto-Tune Bed Plan</span></button>" +
                "</div>" +
                previewBanner +
                renderOptimizerChartSvg(baseline, opt ? opt.optimized : null) +
            "</div>" +
            '<div class="wcpp-bs-chart-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<h3>Agronomic Diagnostics (" + diags.length + ")</h3>" +
                    '<span class="wcpp-bs-badge">Click item to inspect on Season Timeline</span>' +
                "</div>" +
                '<div class="wcpp-bs-diagnostics-list">' + (diagHtml || '<p style="color:var(--bs-muted);">No diagnostics recorded.</p>') + "</div>" +
            "</div>" +
            renderHydrozoneAuditCardHtml(season) +
            (getV6Module() && typeof getV6Module().renderSoilPhLabCard === "function" ? getV6Module().renderSoilPhLabCard(getV6Ctx(), season) : "") +
        "</div>";
    }

    function renderNurseryChartSvg(nursery) {
        const W = 820;
        const H = 280;
        const leftPad = 52;
        const rightPad = 24;
        const topPad = 28;
        const bottomPad = 42;
        const chartW = W - leftPad - rightPad;
        const chartH = H - topPad - bottomPad;
        const weeks = nursery.weeks || [];
        const maxPct = Math.max(120, Math.ceil((nursery.peakUtilizationPct || 100) / 20) * 20);

        const yForPct = function (pct) {
            return topPad + chartH - (Math.min(maxPct, Math.max(0, pct)) / maxPct) * chartH;
        };
        const y85 = yForPct(85);
        const y100 = yForPct(100);
        const slotW = chartW / 52;
        const barW = Math.max(6, slotW - 3);

        const barsSvg = weeks.map(function (wk, idx) {
            const pct = wk.utilizationPct || 0;
            const y = yForPct(pct);
            const h = Math.max(2, topPad + chartH - y);
            const x = leftPad + idx * slotW + 1.5;
            const fill = pct >= 100 ? "#dc2626" : (pct >= 85 ? "#d97706" : "#15803d");
            const isSel = _selectedNurseryWeek === wk.week;
            return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" ' +
                'fill="' + fill + '" stroke="' + (isSel ? "#111827" : "none") + '" stroke-width="' + (isSel ? 1.8 : 0) + '" ' +
                'data-action="select-nursery-week" data-week="' + wk.week + '" style="cursor:pointer;">' +
                "<title>Week " + wk.week + " (" + wk.startDate + "): " + wk.utilizationPct + "% (" + wk.benchUsedM2 + " / " + wk.capacityM2 + " m\u00b2, " + wk.trays + " trays)</title>" +
            "</rect>";
        }).join("");

        const monthTicks = MONTHS.map(function (m, idx) {
            const x = leftPad + ((idx + 0.5) / 12) * chartW;
            return '<text x="' + x.toFixed(1) + '" y="' + (H - 16) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#4b5563">' + m + "</text>";
        }).join("");

        return '<svg class="wcpp-bs-nursery-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="52-week nursery bench utilization bar chart with 85% and 100% thresholds">' +
            '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
            '<rect x="' + leftPad + '" y="' + y100.toFixed(1) + '" width="' + chartW + '" height="' + (y85 - y100).toFixed(1) + '" fill="rgba(217,119,6,0.09)"/>' +
            '<rect x="' + leftPad + '" y="' + topPad + '" width="' + chartW + '" height="' + (y100 - topPad).toFixed(1) + '" fill="rgba(220,38,38,0.07)"/>' +
            '<line x1="' + leftPad + '" y1="' + (topPad + chartH) + '" x2="' + (W - rightPad) + '" y2="' + (topPad + chartH) + '" stroke="#cbd5e1" stroke-width="1"/>' +
            '<line x1="' + leftPad + '" y1="' + y85.toFixed(1) + '" x2="' + (W - rightPad) + '" y2="' + y85.toFixed(1) + '" stroke="#d97706" stroke-width="1.5" stroke-dasharray="5 3"/>' +
            '<text x="' + (leftPad - 6) + '" y="' + (y85 + 4).toFixed(1) + '" text-anchor="end" font-size="10.5" font-weight="700" fill="#d97706">85%</text>' +
            '<line x1="' + leftPad + '" y1="' + y100.toFixed(1) + '" x2="' + (W - rightPad) + '" y2="' + y100.toFixed(1) + '" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="5 3"/>' +
            '<text x="' + (leftPad - 6) + '" y="' + (y100 + 4).toFixed(1) + '" text-anchor="end" font-size="10.5" font-weight="700" fill="#dc2626">100%</text>' +
            '<text x="' + (leftPad - 6) + '" y="' + (topPad + chartH + 4) + '" text-anchor="end" font-size="10.5" fill="#4b5563">0%</text>' +
            barsSvg +
            monthTicks +
        "</svg>";
    }

    function renderGrowingMediaShoppingCardHtml() {
        const c = core();
        const emptySummary = {
            totalVolumeLiters: 0,
            totalVolumeGallons: 0,
            totalCubicFeet: 0,
            containerCount: 0,
            bedCount: 0,
            ingredients: [],
            blocks: []
        };
        const mediaSummary = (c && typeof c.computeGrowingMediaSummary === "function")
            ? c.computeGrowingMediaSummary(_state)
            : emptySummary;
        const ingredients = Array.isArray(mediaSummary.ingredients) ? mediaSummary.ingredients : [];
        const hasIngredients = ingredients.length > 0;

        const scopeCountText = (mediaSummary.containerCount || 0) + " Container" + (mediaSummary.containerCount === 1 ? "" : "s") +
            (mediaSummary.bedCount ? (" \u00b7 " + mediaSummary.bedCount + " Bed" + (mediaSummary.bedCount === 1 ? "" : "s") + " w/ Media") : "");

        const pillsHtml =
            '<div class="wcpp-bs-media-summary-pills">' +
                '<span class="wcpp-bs-badge wcpp-bs-media-pill">Total: <strong>' + escHtml(String(mediaSummary.totalVolumeLiters || 0)) + " L</strong></span>" +
                '<span class="wcpp-bs-badge wcpp-bs-media-pill"><strong>' + escHtml(String(mediaSummary.totalVolumeGallons || 0)) + "</strong> US gal</span>" +
                '<span class="wcpp-bs-badge wcpp-bs-media-pill"><strong>' + escHtml(String(mediaSummary.totalCubicFeet || 0)) + "</strong> ft\u00b3</span>" +
                '<span class="wcpp-bs-badge wcpp-bs-media-pill">' + escHtml(scopeCountText) + "</span>" +
            "</div>";

        let bodyHtml = "";
        if (!hasIngredients) {
            bodyHtml =
                '<div class="wcpp-bs-media-empty">' +
                    "<span>Add a pot, hanging basket, growing bench, or assign a custom media mix to a bed to calculate your bulk soil &amp; growing media shopping list.</span>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="open-container-modal" data-block-type="pot">' + svgIcon("pot", 13) + "<span>+ Add Pot / Basket / Bench</span></button>" +
                "</div>";
        } else {
            const rowsHtml = ingredients.map(function (ing) {
                const col = MEDIA_INGREDIENT_COLORS[ing.id] || "#64748b";
                const usedIn = (ing.sources || []).map(function (src) {
                    return escHtml(src.blockName) + " (" + src.liters + " L)";
                }).join(", ");
                return "<tr>" +
                    '<td><span class="wcpp-bs-media-dot" style="background:' + escHtml(col) + ';"></span><strong>' + escHtml(ing.label) + '</strong> <span class="wcpp-bs-badge">' + ing.pctOfTotal + "%</span></td>" +
                    "<td><strong>" + ing.liters + " L</strong></td>" +
                    "<td>" + ing.gallons + " gal / " + ing.quarts + " qt</td>" +
                    "<td>" + ing.cubicFeet + " ft\u00b3</td>" +
                    "<td>" + (usedIn || "\u2014") + "</td>" +
                "</tr>";
            }).join("");

            bodyHtml =
                '<div class="wcpp-bs-table-scroll">' +
                    '<table class="wcpp-bs-table">' +
                        "<thead><tr><th>Ingredient</th><th>Total Liters</th><th>US Gal / qt</th><th>Cubic Feet</th><th>Used In</th></tr></thead>" +
                        "<tbody>" + rowsHtml + "</tbody>" +
                    "</table>" +
                "</div>";
        }

        return '<div class="wcpp-bs-media-shopping-card" id="wcppBsMediaShoppingCard">' +
            '<div class="wcpp-bs-card-header">' +
                "<h3>Soil &amp; Growing Media Shopping List</h3>" +
                '<div class="wcpp-bs-toolbar-group">' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="export-media-csv"' + (hasIngredients ? "" : " disabled") + ">" + svgIcon("download", 13) + "<span>Download Media CSV</span></button>" +
                "</div>" +
            "</div>" +
            pillsHtml +
            bodyHtml +
        "</div>";
    }

    function renderWeatherActionBannerHtml() {
        const c = core();
        if (typeof c.evaluateLiveWeatherAlerts !== "function") return "";
        if (_weatherPreviewMode === "live" && global.WCPPClimate && typeof global.WCPPClimate.getLastWeather === "function") {
            const cachedWx = global.WCPPClimate.getLastWeather();
            if (!cachedWx && !_weatherFetchRequested && typeof global.WCPPClimate.fetchLiveWeather === "function") {
                _weatherFetchRequested = true;
                global.WCPPClimate.fetchLiveWeather().catch(function () {});
            }
        }
        const climateInfo = c.getClimateInfo();
        let weatherOpt;
        if (_weatherPreviewMode === "cold") {
            weatherOpt = { temp: 3, low: 1, high: 7, rh: 88, precip: 4, city: climateInfo.name, zone: climateInfo.zone };
        } else if (_weatherPreviewMode === "heat") {
            weatherOpt = { temp: 26, low: 16, high: 30, rh: 42, precip: 0, city: climateInfo.name, zone: climateInfo.zone };
        }
        const report = c.evaluateLiveWeatherAlerts(_state, _catalog, weatherOpt);
        if (!report) return "";

        const frostCls = report.frostRisk === "alert" ? " is-frost-alert" : (report.frostRisk === "watch" ? " is-frost-watch" : "");
        const heatCls = report.heatRisk !== "none" ? " is-heat-alert" : "";
        const dueCount = (report.dueThisWeekTasks || []).length;

        const modePills = [
            { id: "live", label: "Live" },
            { id: "cold", label: "Cold Snap (1\u00b0C)" },
            { id: "heat", label: "Heat Wave (30\u00b0C)" }
        ].map(function (pm) {
            const active = _weatherPreviewMode === pm.id;
            return '<button type="button" class="wcpp-bs-seg-btn' + (active ? " is-active" : "") + '" data-action="set-weather-mode" data-weather-mode="' + pm.id + '" aria-pressed="' + (active ? "true" : "false") + '">' + escHtml(pm.label) + "</button>";
        }).join("");

        const alertsHtml = (report.alerts || []).length ? (
            '<div class="wcpp-bs-weather-alerts">' +
                report.alerts.slice(0, 12).map(function (al) {
                    const catCls = al.category === "frost" ? " is-frost" : " is-heat";
                    const sevLbl = al.severity === "alert" ? "Alert" : "Watch";
                    return '<div class="wcpp-bs-weather-alert-item' + catCls + '">' +
                        '<div><strong>' + escHtml(al.cropName) + '</strong> (' + escHtml(al.blockName) + ') \u2014 ' + escHtml(al.reason) + "</div>" +
                        '<span class="wcpp-bs-badge ' + (al.severity === "alert" ? "wcpp-bs-status-conflict" : "wcpp-bs-status-warn") + '">' + escHtml(sevLbl) + "</span>" +
                    "</div>";
                }).join("") +
            "</div>"
        ) : "";

        return '<div class="wcpp-bs-weather-banner' + frostCls + heatCls + '" id="wcppBsWeatherBanner" role="region" aria-label="Live Weather and Frost/Heat Action Banner">' +
            '<div class="wcpp-bs-weather-banner-head">' +
                '<div class="wcpp-bs-weather-metrics">' +
                    '<strong style="display:inline-flex;align-items:center;gap:6px;">' + svgIcon("thermometer", 15) + '<span>' + escHtml(report.city) + " (" + escHtml(report.zone) + ") Weather Alerts</span></strong>" +
                    '<span class="wcpp-bs-badge">Now: ' + report.tempC + "\u00b0C</span>" +
                    '<span class="wcpp-bs-badge">Low: ' + report.lowC + "\u00b0C</span>" +
                    '<span class="wcpp-bs-badge">High: ' + report.highC + "\u00b0C</span>" +
                    '<span class="wcpp-bs-badge' + (dueCount > 0 ? " wcpp-bs-status-warn" : "") + '">' + dueCount + " Due This Week</span>" +
                "</div>" +
                '<div class="wcpp-bs-weather-mode-pills" role="group" aria-label="Weather Preview Mode">' + modePills + "</div>" +
            "</div>" +
            '<div style="font-size:0.81rem; color:var(--bs-text-2);">' + escHtml(report.summaryText) + "</div>" +
            alertsHtml +
        "</div>";
    }

    function isCropInWcppStock(row) {
        if (!global.WCPPInventory || typeof global.WCPPInventory.match !== "function") return false;
        const matches = global.WCPPInventory.match({ commonName: row.cropName, latinName: row.latin });
        return Array.isArray(matches) && matches.some(function (m) {
            return Boolean(m && (m._isPreOrder || (!m._isOutOfStock && Number(m._qtyNum || 0) > 0)));
        });
    }

    function renderNurseryTasksTab(season, nursery) {
        const c = core();
        const tasks = c.generateFieldTasks(_state, _catalog.cropMap);
        const allOrders = c.computeSeedOrderSummary(_state, _catalog.cropMap);
        const invLoaded = global.WCPPInventory && typeof global.WCPPInventory.isLoaded === "function" && global.WCPPInventory.isLoaded();
        if (global.WCPPInventory && !invLoaded && typeof global.WCPPInventory.load === "function") {
            global.WCPPInventory.load();
        }
        const orders = (_stockFilterMode === "wcpp" && invLoaded)
            ? allOrders.filter(isCropInWcppStock)
            : allOrders;

        const selWeekObj = _selectedNurseryWeek ? (nursery.weeks || []).find(function (w) { return w.week === _selectedNurseryWeek; }) : null;
        const weekNote = selWeekObj
            ? '<div style="margin-top:10px; padding:10px 12px; border-radius:10px; background:var(--bs-bg); border:1px solid var(--bs-border-soft); font-size:0.83rem;">' +
                "<strong>Week " + selWeekObj.week + " (" + selWeekObj.startDate + " \u2013 " + selWeekObj.endDate + "):</strong> " +
                selWeekObj.benchUsedM2 + " / " + selWeekObj.capacityM2 + " m\u00b2 (" + selWeekObj.utilizationPct + "%), " + selWeekObj.trays + " trays" +
                (selWeekObj.breakdown && selWeekObj.breakdown.length
                    ? " \u2014 " + selWeekObj.breakdown.map(function (b) { return escHtml(b.cropName) + " (" + b.stage + ": " + b.benchM2 + " m\u00b2)"; }).join(", ")
                    : " \u2014 No active nursery bench load.") +
            "</div>"
            : "";

        const filteredTasks = tasks.filter(function (t) {
            if (_taskTypeFilter !== "all" && t.type !== _taskTypeFilter) return false;
            if (_taskStatusFilter === "open" && t.completed) return false;
            if (_taskStatusFilter === "done" && !t.completed) return false;
            if (_taskMonthFilter !== "all") {
                const mo = t.date ? String(Number(t.date.slice(5, 7))) : "";
                if (mo !== _taskMonthFilter) return false;
            }
            return true;
        });

        const taskHtml = filteredTasks.length
            ? filteredTasks.map(function (t) {
                return '<label class="wcpp-bs-task-item' + (t.completed ? " is-done" : "") + '">' +
                    '<div style="display:flex; align-items:flex-start; gap:10px;">' +
                        '<input type="checkbox"' + (t.completed ? " checked" : "") + ' data-action="toggle-task" data-task-id="' + escHtml(t.id) + '" style="margin-top:3px;">' +
                        "<div>" +
                            "<strong>" + escHtml(t.typeLabel) + ": " + escHtml(t.cropName) + "</strong>" +
                            '<div style="font-size:0.77rem; color:var(--bs-muted);">' + escHtml(t.locationLabel) + " \u00b7 " + escHtml(t.details) + "</div>" +
                        "</div>" +
                    "</div>" +
                    '<span class="wcpp-bs-badge">' + escHtml(t.date) + " (W" + t.week + ")</span>" +
                "</label>";
            }).join("")
            : '<p style="margin:6px 0; color:var(--bs-muted); font-size:0.84rem;">No field tasks match the current filters.</p>';

        const isImp = _state.units === "imperial";
        const ordersRows = orders.map(function (row) {
            const lenStr = c.formatLength(row.totalBedLengthM, _state.units);
            const stockBadge = invLoaded
                ? stripEmojis(global.WCPPInventory.renderBadge({ commonName: row.cropName, latinName: row.latin }, { compact: true, showPreorderFallback: true, pageTheme: "garden" }))
                : '<span class="wcpp-bs-badge">Inventory syncing...</span>';
            const sg = row.sowingGuide;
            const sowingStr = sg
                ? (isImp ? (sg.summaryImperial || sg.summaryMetric) : (sg.summaryMetric || sg.summaryImperial))
                : (row.method || "\u2014");
            return "<tr>" +
                "<td><strong>" + escHtml(row.cropName) + '</strong><div style="font-size:0.74rem; color:var(--bs-muted);">' + escHtml(row.family) + " \u00b7 " + escHtml(row.method) + "</div></td>" +
                "<td>" + escHtml(lenStr) + " (" + row.plantingsCount + ")</td>" +
                "<td>" + row.totalPlants.toLocaleString("en-CA") + "</td>" +
                "<td>" + row.totalSeedsNeeded.toLocaleString("en-CA") + " (" + row.totalSeedGrams + " g)</td>" +
                "<td>" + (row.totalTrays || "\u2014") + "</td>" +
                "<td>" + escHtml(sowingStr) + "</td>" +
                "<td>" + stockBadge + "</td>" +
                "<td>" + row.totalEstYield + " " + escHtml(row.yieldUnit) + " ($" + row.totalValueCad.toFixed(0) + ")</td>" +
            "</tr>";
        }).join("");

        const monthOpts = '<option value="all">All Months</option>' + MONTHS.map(function (m, i) {
            return '<option value="' + (i + 1) + '"' + (_taskMonthFilter === String(i + 1) ? " selected" : "") + ">" + m + "</option>";
        }).join("");

        return '<div class="wcpp-bs-nursery-layout">' +
            renderWeatherActionBannerHtml() +
            '<div class="wcpp-bs-chart-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<h3>52-Week Nursery Bench Utilization</h3>" +
                    '<span class="wcpp-bs-badge">Peak Week ' + nursery.peakWeek + ": " + nursery.peakUtilizationPct + "% (Amber 85% / Red 100%)</span>" +
                "</div>" +
                renderNurseryChartSvg(nursery) +
                weekNote +
            "</div>" +
            '<div class="wcpp-bs-tasks-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<h3>Field Tasks Checklist (" + filteredTasks.length + " / " + tasks.length + ")</h3>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="export-tasks-ics">' + svgIcon("calendar", 13) + "<span>Export .ics Calendar</span></button>" +
                "</div>" +
                '<div class="wcpp-bs-task-filters">' +
                    '<select class="wcpp-bs-select" data-action="filter-task-type">' +
                        '<option value="all"' + (_taskTypeFilter === "all" ? " selected" : "") + ">All Task Types</option>" +
                        '<option value="seed_indoors"' + (_taskTypeFilter === "seed_indoors" ? " selected" : "") + ">Seed Indoors</option>" +
                        '<option value="pot_up"' + (_taskTypeFilter === "pot_up" ? " selected" : "") + ">Pot Up</option>" +
                        '<option value="direct_seed"' + (_taskTypeFilter === "direct_seed" ? " selected" : "") + ">Direct Seed</option>" +
                        '<option value="transplant"' + (_taskTypeFilter === "transplant" ? " selected" : "") + ">Transplant</option>" +
                        '<option value="harvest"' + (_taskTypeFilter === "harvest" ? " selected" : "") + ">Harvest</option>" +
                    "</select>" +
                    '<select class="wcpp-bs-select" data-action="filter-task-status">' +
                        '<option value="all"' + (_taskStatusFilter === "all" ? " selected" : "") + ">All Status</option>" +
                        '<option value="open"' + (_taskStatusFilter === "open" ? " selected" : "") + ">Open</option>" +
                        '<option value="done"' + (_taskStatusFilter === "done" ? " selected" : "") + ">Completed</option>" +
                    "</select>" +
                    '<select class="wcpp-bs-select" data-action="filter-task-month">' + monthOpts + "</select>" +
                "</div>" +
                '<div class="wcpp-bs-task-list">' + taskHtml + "</div>" +
            "</div>" +
            '<div class="wcpp-bs-orders-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<h3>Seed &amp; Transplant Order Summary (" + orders.length + (orders.length !== allOrders.length ? (" / " + allOrders.length) : "") + ")</h3>" +
                    '<div class="wcpp-bs-stock-filter-group">' +
                        '<div class="wcpp-bs-segmented" role="group" aria-label="WCPP Stock Filter">' +
                            '<button type="button" class="wcpp-bs-seg-btn' + (_stockFilterMode !== "wcpp" ? " is-active" : "") + '" data-action="set-stock-filter" data-stock-filter="all">All Crops</button>' +
                            '<button type="button" class="wcpp-bs-seg-btn' + (_stockFilterMode === "wcpp" ? " is-active" : "") + '" data-action="set-stock-filter" data-stock-filter="wcpp">In Stock / Pre-Order at WCPP</button>' +
                        "</div>" +
                        '<span class="wcpp-bs-badge">Live WCPP Inventory &amp; Sowing Guide</span>' +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-table-scroll">' +
                    '<table class="wcpp-bs-table">' +
                        "<thead><tr><th>Crop</th><th>Bed Length</th><th>Plants (Margin)</th><th>Seeds Needed</th><th>Trays</th><th>Sowing &amp; Start Guide</th><th>WCPP Stock</th><th>Est. Yield &amp; Value</th></tr></thead>" +
                        "<tbody>" + (ordersRows || '<tr><td colspan="8">' + (_stockFilterMode === "wcpp" ? "No crops in this plan match current In Stock or Pre-Order WCPP inventory." : "No plantings yet.") + "</td></tr>") + "</tbody>" +
                    "</table>" +
                "</div>" +
            "</div>" +
            renderGrowingMediaShoppingCardHtml() +
            (getV6Module() && typeof getV6Module().renderSowingGuideCard === "function" ? getV6Module().renderSowingGuideCard(getV6Ctx(), season) : "") +
        "</div>";
    }

    // =========================================================================
    // 5TH SUB-TAB: ECOLOGY & PESTS
    // =========================================================================
    function renderBloomContinuitySvg(bloomContinuity) {
        const W = 820;
        const H = 246;
        const leftPad = 48;
        const rightPad = 24;
        const topPad = 54;
        const bottomPad = 42;
        const chartW = W - leftPad - rightPad;
        const chartH = H - topPad - bottomPad;
        const months = (bloomContinuity && bloomContinuity.months) || [];
        const maxCount = Math.max(4, months.reduce(function (mx, m) { return Math.max(mx, m.count || 0); }, 0));
        const slotW = chartW / 12;
        const barW = Math.max(24, slotW - 14);

        const activeBandX = leftPad + 2 * slotW;
        const activeBandW = 8 * slotW;

        const barsSvg = months.map(function (m, idx) {
            const x = leftPad + idx * slotW + (slotW - barW) / 2;
            const count = Number(m.count || 0);
            const h = count > 0 ? Math.max(12, Math.round((count / maxCount) * chartH)) : 14;
            const y = topPad + chartH - h;
            const isSel = _selectedBloomMonth === m.month;
            let fill = "#cbd5e1";
            let stroke = "none";
            let dash = "";
            if (m.isGap) {
                fill = "rgba(217, 119, 6, 0.20)";
                stroke = "#d97706";
                dash = ' stroke-dasharray="4 3"';
            } else if (count > 0) {
                fill = m.activePollinatorSeason ? "#15803d" : "#0f766e";
            }
            if (isSel) {
                stroke = "#111827";
                dash = "";
            }
            const labelVal = m.isGap ? "Gap" : String(count);
            const labelFill = m.isGap ? "#b45309" : (count > 0 ? "#166534" : "#4b5563");

            return '<g data-action="select-bloom-month" data-month="' + m.month + '" style="cursor:pointer;">' +
                '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4" ' +
                    'fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (isSel || m.isGap ? 1.8 : 0) + '"' + dash + ">" +
                    "<title>" + escHtml(m.label) + ": " + count + " blooming crop(s)" + (m.crops && m.crops.length ? " (" + m.crops.join(", ") + ")" : "") + "</title>" +
                "</rect>" +
                '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="800" fill="' + labelFill + '">' + escHtml(labelVal) + "</text>" +
                '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle" font-size="11.5" font-weight="700" fill="' + (m.activePollinatorSeason ? "#111827" : "#4b5563") + '">' + escHtml(m.label) + "</text>" +
            "</g>";
        }).join("");

        return '<svg class="wcpp-bs-bloom-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="12-month pollinator bloom continuity bar chart showing Zone 8a active months and gap months">' +
            '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
            '<rect x="' + activeBandX.toFixed(1) + '" y="' + topPad + '" width="' + activeBandW.toFixed(1) + '" height="' + chartH + '" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>' +
            '<text x="' + (activeBandX + activeBandW / 2).toFixed(1) + '" y="18" text-anchor="middle" font-size="11" font-weight="800" fill="#166534">Zone 8a Active Pollinator Window (Mar\u2013Oct)</text>' +
            '<line x1="' + leftPad + '" y1="' + (topPad + chartH) + '" x2="' + (W - rightPad) + '" y2="' + (topPad + chartH) + '" stroke="#cbd5e1" stroke-width="1.2"/>' +
            barsSvg +
        "</svg>";
    }

    function renderStratificationSvg(strat) {
        const W = 820;
        const H = 330;
        const groundY = 196;
        const items = (strat && strat.items) || [];

        let plantsSvg = "";
        if (!items.length) {
            plantsSvg = '<text x="' + (W / 2) + '" y="140" text-anchor="middle" font-size="13" font-weight="700" fill="#4b5563">No active plantings assigned to this bed yet.</text>';
        } else {
            const leftPad = 148;
            const usableW = W - leftPad - 34;
            const slotW = usableW / Math.max(1, items.length);
            const maxCanopyH = 145;
            const maxRootH = 104;

            items.forEach(function (it, idx) {
                const cx = leftPad + idx * slotW + slotW / 2;
                const hScale = Math.min(1, Math.max(0.14, (it.heightCm || 45) / 180));
                const canopyH = Math.round(hScale * maxCanopyH);
                const canopyRy = Math.max(12, Math.min(44, canopyH * 0.48));
                const canopyRx = Math.max(16, Math.min(slotW * 0.4, 46));
                const canopyCy = Math.max(36, groundY - canopyH + canopyRy * 0.45);

                const rScale = Math.min(1, Math.max(0.2, (it.estimatedRootCm || 30) / 85));
                const rootDepthPx = Math.round(rScale * maxRootH);
                const rootW = it.rootStratum === "deep" ? 10 : (it.rootStratum === "medium" ? 18 : 26);

                plantsSvg += '<g>' +
                    '<line x1="' + cx.toFixed(1) + '" y1="' + groundY + '" x2="' + cx.toFixed(1) + '" y2="' + canopyCy.toFixed(1) + '" stroke="' + escHtml(it.color) + '" stroke-width="2.5"/>' +
                    '<ellipse cx="' + cx.toFixed(1) + '" cy="' + canopyCy.toFixed(1) + '" rx="' + canopyRx.toFixed(1) + '" ry="' + canopyRy.toFixed(1) + '" fill="' + escHtml(it.color) + '" fill-opacity="0.22" stroke="' + escHtml(it.color) + '" stroke-width="1.8"/>' +
                    '<path d="M ' + (cx - rootW * 0.45).toFixed(1) + " " + groundY + " Q " + cx.toFixed(1) + " " + (groundY + rootDepthPx + 8) + " " + (cx + rootW * 0.45).toFixed(1) + " " + groundY + ' Z" fill="#b45309" fill-opacity="0.24" stroke="#b45309" stroke-width="1.4"/>' +
                    '<text x="' + cx.toFixed(1) + '" y="' + Math.max(22, canopyCy - canopyRy - 6).toFixed(1) + '" text-anchor="middle" font-size="10.5" font-weight="800" fill="#111827">' + escHtml(String(it.cropName || "").slice(0, 16)) + "</text>" +
                    '<text x="' + cx.toFixed(1) + '" y="' + (groundY + rootDepthPx + 18).toFixed(1) + '" text-anchor="middle" font-size="9.5" font-weight="700" fill="#4b5563">' + Math.round(it.estimatedRootCm || 30) + "cm \u00b7 " + escHtml(it.mycorrhizaeType || "AM") + "</text>" +
                "</g>";
            });
        }

        return '<svg class="wcpp-bs-strat-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Canopy and root stratification diagram">' +
            '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
            '<rect x="0" y="' + groundY + '" width="' + W + '" height="' + (H - groundY) + '" fill="#f8fafc"/>' +
            '<line x1="128" y1="68" x2="' + (W - 20) + '" y2="68" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4"/>' +
            '<line x1="128" y1="130" x2="' + (W - 20) + '" y2="130" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 4"/>' +
            '<line x1="128" y1="' + groundY + '" x2="' + (W - 20) + '" y2="' + groundY + '" stroke="#166534" stroke-width="2.4"/>' +
            '<line x1="128" y1="252" x2="' + (W - 20) + '" y2="252" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 4"/>' +
            '<text x="16" y="42" font-size="10.5" font-weight="800" fill="#166534">Tall Canopy (&gt;140cm)</text>' +
            '<text x="16" y="102" font-size="10.5" font-weight="700" fill="#4b5563">Mid / Low (22\u2013140cm)</text>' +
            '<text x="16" y="182" font-size="10.5" font-weight="700" fill="#4b5563">Groundcover (&lt;22cm)</text>' +
            '<text x="16" y="226" font-size="10.5" font-weight="700" fill="#b45309">Shallow Roots (0\u201322cm)</text>' +
            '<text x="16" y="290" font-size="10.5" font-weight="800" fill="#b45309">Deep Taproot (&gt;45cm)</text>' +
            plantsSvg +
        "</svg>";
    }

    function buildArticleSubjectFromCrop(crop, prof) {
        return {
            commonName: crop.name,
            latinName: crop.latin || "",
            family: crop.family || "",
            category: "garden",
            companions: Array.isArray(crop.companions) ? crop.companions.join(" ") : "",
            pests: (prof && prof.pestsAttracted ? prof.pestsAttracted.join(" ") : "") + " " + (prof && prof.naturalPredators ? prof.naturalPredators.join(" ") : ""),
            pollinators: (prof && prof.pollinators ? prof.pollinators.join(" ") : "") + " " + (prof && prof.beeVisitors ? prof.beeVisitors.join(" ") : ""),
            ethnoNotes: prof && prof.coastSalish && prof.coastSalish.hasAny ? [prof.coastSalish.hulquminum, prof.coastSalish.halqemeylem, prof.coastSalish.sencoten].filter(Boolean).join(" ") : "",
            tags: [crop.family, crop.category, crop.isNativeBC ? "BC Native Coast Salish" : ""].filter(Boolean).join(" ")
        };
    }

    function renderEcologyResearchStrip(season) {
        if (!global.WCPPArticles || typeof global.WCPPArticles.renderSectionHTML !== "function") {
            return '<div class="wcpp-bs-research-strip">' +
                '<div class="wcpp-bs-card-header"><h3>Cross-Site Research &amp; Growing Guides</h3><a href="articles.html" class="wcpp-bs-latin-link">Browse Articles \u2192</a></div>' +
                '<p style="margin:0; font-size:0.84rem; color:var(--bs-muted);">Explore peer-reviewed Pacific Northwest articles and Coast Salish ethnobotany guides in the <a href="articles.html" class="wcpp-bs-latin-link">Articles Library \u2192</a>.</p>' +
            "</div>";
        }
        if (typeof global.WCPPArticles.isLoaded === "function" && !global.WCPPArticles.isLoaded() && typeof global.WCPPArticles.loadAll === "function") {
            global.WCPPArticles.loadAll();
        }
        const c = core();
        const seen = new Set();
        const subjects = [];
        ((season && season.plantings) || []).forEach(function (p) {
            const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
            if (!crop || seen.has(crop.name)) return;
            seen.add(crop.name);
            const prof = c.getCropEcologyProfile(crop, _catalog);
            subjects.push(buildArticleSubjectFromCrop(crop, prof));
        });
        const html = global.WCPPArticles.renderSectionHTML(subjects.length ? subjects : [{ commonName: "Pollinator Habitat", tags: "pollinator biocontrol coast salish" }], {
            maxCount: 3,
            strip: true,
            title: "Cross-Site Research & Growing Guides"
        });
        return '<div class="wcpp-bs-research-strip">' + stripEmojis(html) + "</div>";
    }

    function renderEcologyTab(season) {
        const c = core();
        if (!_catalog.enriched && typeof c.whenEnriched === "function") {
            c.whenEnriched(_catalog).catch(function () {});
        }
        const blocks = (season && season.blocks) || [];
        if (_ecologyBlockId && !blocks.some(function (b) { return b.id === _ecologyBlockId; })) {
            _ecologyBlockId = "";
        }

        const eco = c.analyzeBedEcology(_state, _catalog, _ecologyBlockId || null);
        const bc = eco.bloomContinuity;
        const pd = eco.pestDefense;
        const div = eco.diversity;

        const blockOptions = '<option value="">All Active Blocks</option>' + blocks.map(function (b) {
            return '<option value="' + escHtml(b.id) + '"' + (_ecologyBlockId === b.id ? " selected" : "") + ">" + escHtml(b.name) + "</option>";
        }).join("");

        // Resolve stratification bed target
        const bedChoices = [];
        blocks.forEach(function (b) {
            const cnt = Math.max(1, Number(b.bedCount || 1));
            const isCont = isContainerBlock(b);
            for (let k = 1; k <= cnt; k++) {
                const subLbl = isCont ? getBlockTypeLabel(b) : ("Bed " + k);
                bedChoices.push({ key: b.id + ":" + k, block: b, bedNum: k, label: b.name + " \u2014 " + subLbl });
            }
        });
        let activeChoice = bedChoices.find(function (ch) { return ch.key === _stratTargetKey; }) || null;
        if (!activeChoice && _ecologyBlockId) {
            activeChoice = bedChoices.find(function (ch) { return ch.block.id === _ecologyBlockId; }) || null;
        }
        if (!activeChoice) activeChoice = bedChoices[0] || null;
        if (activeChoice) _stratTargetKey = activeChoice.key;

        const stratOptsHtml = bedChoices.map(function (ch) {
            return '<option value="' + escHtml(ch.key) + '"' + (activeChoice && activeChoice.key === ch.key ? " selected" : "") + ">" + escHtml(ch.label) + "</option>";
        }).join("");
        const strat = activeChoice
            ? c.getBedStratificationProfile(activeChoice.block, activeChoice.bedNum, season, _catalog)
            : c.getBedStratificationProfile({ id: "none", name: "No Blocks" }, 1, season, _catalog);

        // Selected bloom month breakdown
        const selMonthObj = _selectedBloomMonth ? bc.months.find(function (m) { return m.month === _selectedBloomMonth; }) : null;
        const bloomDetailHtml = selMonthObj
            ? '<div style="margin-top:10px; padding:10px 12px; border-radius:10px; background:var(--bs-bg); border:1px solid var(--bs-border-soft); font-size:0.83rem;">' +
                "<strong>" + escHtml(selMonthObj.label) + " Bloom Status:</strong> " +
                (selMonthObj.count > 0
                    ? selMonthObj.count + " blooming crop(s) \u2014 " + escHtml(selMonthObj.crops.join(", "))
                    : (selMonthObj.isGap ? "Zone 8a Pollinator Gap Month (add a companion below to support native bees)." : "Winter dormancy period.")) +
              "</div>"
            : "";

        // Gap-month companion pills
        let gapHtml = "";
        if (bc.gapMonths.length > 0) {
            const recBtns = (bc.recommendedCompanions || []).map(function (rec) {
                return '<button type="button" class="wcpp-bs-gap-pill" data-action="add-bloom-companion" data-crop="' + escHtml(rec.cropName) + '" title="' + escHtml(rec.reason) + '">' +
                    svgIcon("plus", 12) +
                    "<span>Add " + escHtml(rec.cropName) + " (" + escHtml(rec.coversLabels.join(", ")) + ")</span>" +
                "</button>";
            }).join("");
            gapHtml = '<div class="wcpp-bs-gap-months">' +
                '<span class="wcpp-bs-badge wcpp-bs-status-warn">Gap months: ' + escHtml(bc.gapMonthLabels.join(", ")) + "</span>" +
                (recBtns || '<span style="font-size:0.8rem; color:var(--bs-muted);">Add flowering companions or BC natives to bridge pollinator gaps.</span>') +
            "</div>";
        } else {
            gapHtml = '<div class="wcpp-bs-gap-months"><span class="wcpp-bs-badge wcpp-bs-status-ok">\u2713 Continuous Mar\u2013Oct pollinator bloom coverage (0 gap months)</span></div>';
        }

        // Living Pest & Biocontrol Defense Web
        const allPests = pd.pests || [];
        const cov = pd.coverage || {
            totalThreats: allPests.length,
            protectedCount: allPests.filter(function (p) { return p.isProtected; }).length,
            unprotectedCount: allPests.filter(function (p) { return !p.isProtected; }).length,
            coveragePct: allPests.length
                ? Math.round((allPests.filter(function (p) { return p.isProtected; }).length / allPests.length) * 100)
                : 100
        };
        const selectedPestObj = _selectedDefensePest
            ? (allPests.find(function (p) { return p.id === _selectedDefensePest; }) || null)
            : null;
        if (_selectedDefensePest && !selectedPestObj) {
            _selectedDefensePest = "";
        }

        const visiblePests = allPests.filter(function (pest) {
            if (_defenseFilter === "unprotected") return !pest.isProtected;
            if (_defenseFilter === "protected") return Boolean(pest.isProtected);
            return true;
        });

        const shieldFiltersHtml = [
            { id: "all", label: "All Threats (" + cov.totalThreats + ")" },
            { id: "unprotected", label: "Unprotected (" + cov.unprotectedCount + ")" },
            { id: "protected", label: "Protected (" + cov.protectedCount + ")" }
        ].map(function (f) {
            const active = _defenseFilter === f.id;
            return '<button type="button" class="wcpp-bs-filter-pill' + (active ? " is-active" : "") + '" data-action="set-defense-filter" data-defense-filter="' + f.id + '" aria-pressed="' + (active ? "true" : "false") + '">' +
                escHtml(f.label) +
            "</button>";
        }).join("");

        const activeThreatChipHtml = selectedPestObj
            ? '<button type="button" class="wcpp-bs-defense-active-chip" data-action="clear-defense-pest" title="Clear threat filter and show all defenders">' +
                "Filtering counters for: <strong>" + escHtml(selectedPestObj.name) + "</strong> \u00b7 Show All \u00d7" +
              "</button>"
            : "";

        const defenseShieldHtml = '<div class="wcpp-bs-defense-shield">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    svgIcon("shield", 16) +
                    "<strong>" + cov.protectedCount + " of " + cov.totalThreats + " Active Threats Countered \u00b7 " + cov.coveragePct + "% Protected</strong>" +
                "</div>" +
                activeThreatChipHtml +
            "</div>" +
            '<div class="wcpp-bs-shield-bar" role="progressbar" aria-valuenow="' + cov.coveragePct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Garden pest defense coverage">' +
                '<div class="wcpp-bs-shield-fill" style="width:' + cov.coveragePct + '%;"></div>' +
            "</div>" +
            '<div class="wcpp-bs-defense-filters" role="group" aria-label="Filter active pest threats">' +
                shieldFiltersHtml +
            "</div>" +
        "</div>";

        const pestCards = visiblePests.map(function (pest) {
            const isSel = Boolean(selectedPestObj && selectedPestObj.id === pest.id);
            const predCnt = (pest.counteredByPredators || []).length;
            const repCnt = (pest.counteredByRepellents || []).length;
            const biosCnt = (pest.counteredByBios || []).length;
            const activeCounterCnt = predCnt + repCnt;
            const counterParts = [];
            if (predCnt > 0) counterParts.push(predCnt + " predator" + (predCnt === 1 ? "" : "s"));
            if (repCnt > 0) counterParts.push(repCnt + " repellent" + (repCnt === 1 ? "" : "s"));
            const counterSummary = activeCounterCnt > 0
                ? (activeCounterCnt + " active counter" + (activeCounterCnt === 1 ? "" : "s") + " (" + counterParts.join(", ") + ")")
                : "0 active counters in bed";

            const cropChips = (pest.crops || []).map(function (cName) {
                return '<span class="wcpp-bs-badge">' + escHtml(cName) + "</span>";
            }).join("");

            const bioLinks = (pest.bioEntries || []).slice(0, 4).map(function (be) {
                return '<a class="wcpp-bs-bio-pill" href="bios.html?entry=' + encodeURIComponent(be.id) + '" target="_blank" rel="noopener">' + escHtml(be.name) + " \u2197</a>";
            }).join("");

            const hostCropsAttr = escHtml((pest.crops || []).join("|"));
            const defenderBtns = (pest.recommendedDefenders || []).slice(0, 3).map(function (rec) {
                const modeLabel = rec.defaultMode === "understory" ? "Understory" : "Border";
                return '<button type="button" class="wcpp-bs-defender-add-btn" data-action="add-defense-companion" ' +
                    'data-crop="' + escHtml(rec.cropName) + '" ' +
                    'data-mode="' + escHtml(rec.defaultMode || "border") + '" ' +
                    'data-share-pct="' + Number(rec.defaultSharePct || 25) + '" ' +
                    'data-host-crops="' + hostCropsAttr + '" ' +
                    'data-pest-name="' + escHtml(pest.name) + '" ' +
                    'title="' + escHtml(rec.reason || ("Plant " + rec.cropName + " as " + modeLabel)) + '">' +
                    "+ Plant " + escHtml(rec.cropName) + " (" + modeLabel + ")" +
                "</button>";
            }).join("");

            return '<div class="wcpp-bs-defense-card is-clickable' + (isSel ? " is-selected" : "") + '" ' +
                'data-action="select-defense-pest" data-pest-id="' + escHtml(pest.id) + '" ' +
                'tabindex="0" role="button" aria-pressed="' + (isSel ? "true" : "false") + '">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    "<strong>" + escHtml(pest.name) + "</strong>" +
                    '<span class="wcpp-bs-defense-status ' + (pest.isProtected ? "is-protected" : "is-unprotected") + '">' +
                        (pest.isProtected ? "Protected" : "Unprotected") +
                    "</span>" +
                "</div>" +
                '<div style="display:flex; flex-wrap:wrap; gap:5px; align-items:center;">' +
                    '<span style="font-size:0.74rem; color:var(--bs-muted); font-weight:700;">Crops:</span>' +
                    cropChips +
                "</div>" +
                '<div style="font-size:0.78rem; color:var(--bs-muted);">' +
                    escHtml(counterSummary) + (biosCnt > 0 ? (" \u00b7 " + biosCnt + " biocontrol profile" + (biosCnt === 1 ? "" : "s")) : "") +
                "</div>" +
                (bioLinks ? '<div class="wcpp-bs-bio-links">' + bioLinks + "</div>" : "") +
                (defenderBtns ? '<div style="display:flex; flex-wrap:wrap; gap:6px;">' + defenderBtns + "</div>" : "") +
            "</div>";
        }).join("");

        const diseaseSummary = (pd.diseases || []).length
            ? '<div class="wcpp-bs-defense-card"><strong>Disease Watch (' + pd.diseases.length + ')</strong><div style="font-size:0.79rem; color:var(--bs-muted);">' +
                pd.diseases.slice(0, 6).map(function (dis) { return escHtml(dis.name) + " (" + escHtml(dis.crops.slice(0, 3).join(", ")) + ")"; }).join(" \u00b7 ") +
              "</div></div>"
            : "";

        const getCounterMatchClass = function (targetsPests) {
            if (!selectedPestObj) return "";
            const list = Array.isArray(targetsPests) ? targetsPests : [];
            return list.indexOf(selectedPestObj.id) !== -1 ? " is-counter-match" : " is-dimmed";
        };

        const predsList = pd.predators || [];
        const predatorCards = predsList.map(function (pred) {
            const bioLinks = (pred.bioEntries || []).slice(0, 4).map(function (be) {
                return '<a class="wcpp-bs-bio-pill" href="bios.html?entry=' + encodeURIComponent(be.id) + '" target="_blank" rel="noopener">' + escHtml(be.name) + " \u2197</a>";
            }).join("");
            const supCrops = (pred.supportedByCrops && pred.supportedByCrops.length) ? pred.supportedByCrops : (pred.crops || []);
            return '<div class="wcpp-bs-defense-card' + getCounterMatchClass(pred.targetsPests) + '">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    "<strong>" + escHtml(pred.name) + "</strong>" +
                    '<span class="wcpp-bs-defense-role-badge">' + escHtml(pred.roleLabel || "Beneficial Insect") + "</span>" +
                "</div>" +
                '<div style="font-size:0.78rem; color:var(--bs-muted);">Supported by: ' + escHtml(supCrops.join(", ")) + "</div>" +
                (pred.targetsPestNames && pred.targetsPestNames.length
                    ? '<div style="font-size:0.76rem; color:var(--bs-primary); font-weight:700;">Counters: ' + escHtml(pred.targetsPestNames.join(", ")) + "</div>"
                    : "") +
                (bioLinks ? '<div class="wcpp-bs-bio-links">' + bioLinks + "</div>" : "") +
            "</div>";
        }).join("");

        const repelItems = (pd.biocontrols || []).filter(function (b) {
            return b.action === "repel" || b.action === "biopesticide";
        });
        const repelCards = repelItems.map(function (bio) {
            const bioLinks = (bio.bioEntries || []).slice(0, 3).map(function (be) {
                return '<a class="wcpp-bs-bio-pill" href="bios.html?entry=' + encodeURIComponent(be.id) + '" target="_blank" rel="noopener">' + escHtml(be.name) + " \u2197</a>";
            }).join("");
            return '<div class="wcpp-bs-defense-card' + getCounterMatchClass(bio.targetsPests) + '">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    "<strong>" + escHtml(bio.name) + "</strong>" +
                    '<span class="wcpp-bs-defense-role-badge">' + escHtml(bio.roleLabel || "Repellent Companion") + "</span>" +
                "</div>" +
                '<div style="font-size:0.78rem; color:var(--bs-muted);">Source: ' + escHtml(bio.sourceCrop) + (bio.targets && bio.targets.length ? " \u00b7 Targets: " + escHtml(bio.targets.slice(0, 4).join(", ")) : "") + "</div>" +
                (bio.targetsPestNames && bio.targetsPestNames.length
                    ? '<div style="font-size:0.76rem; color:var(--bs-primary); font-weight:700;">Counters: ' + escHtml(bio.targetsPestNames.join(", ")) + "</div>"
                    : "") +
                (bioLinks ? '<div class="wcpp-bs-bio-links">' + bioLinks + "</div>" : "") +
            "</div>";
        }).join("");

        const allyItems = (pd.biocontrols || []).filter(function (b) { return b.action === "bios"; }).map(function (b) {
            return {
                id: b.id,
                name: b.name,
                roleLabel: b.roleLabel || "Microbial Ally",
                sourceText: "Associated with: " + b.sourceCrop,
                targetsText: (b.targets && b.targets.length) ? b.targets.slice(0, 4).join(", ") : "",
                targetsPests: b.targetsPests || [],
                bioEntries: b.bioEntries || []
            };
        });
        const seenAllyBioIds = new Set();
        allyItems.forEach(function (it) {
            (it.bioEntries || []).forEach(function (be) { seenAllyBioIds.add(be.id); });
        });
        if (selectedPestObj && Array.isArray(selectedPestObj.counteredByBios)) {
            selectedPestObj.counteredByBios.forEach(function (cb) {
                if (seenAllyBioIds.has(cb.id)) return;
                seenAllyBioIds.add(cb.id);
                allyItems.push({
                    id: "bios-" + cb.id,
                    name: cb.name,
                    roleLabel: cb.roleLabel || "Beneficial Insect",
                    sourceText: "Targeted biocontrol for " + selectedPestObj.name,
                    targetsText: cb.targets || "",
                    targetsPests: [selectedPestObj.id],
                    bioEntries: [{ id: cb.id, name: cb.name }]
                });
            });
        }
        const allyCards = allyItems.map(function (ally) {
            const bioLinks = (ally.bioEntries || []).slice(0, 3).map(function (be) {
                return '<a class="wcpp-bs-bio-pill" href="bios.html?entry=' + encodeURIComponent(be.id) + '" target="_blank" rel="noopener">' + escHtml(be.name) + " \u2197</a>";
            }).join("");
            return '<div class="wcpp-bs-defense-card' + getCounterMatchClass(ally.targetsPests) + '">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    "<strong>" + escHtml(ally.name) + "</strong>" +
                    '<span class="wcpp-bs-defense-role-badge">' + escHtml(ally.roleLabel || "Microbial Ally") + "</span>" +
                "</div>" +
                '<div style="font-size:0.78rem; color:var(--bs-muted);">' + escHtml(ally.sourceText) + (ally.targetsText ? (" \u00b7 Targets: " + escHtml(ally.targetsText)) : "") + "</div>" +
                (bioLinks ? '<div class="wcpp-bs-bio-links">' + bioLinks + "</div>" : "") +
            "</div>";
        }).join("");

        const rightColumnGroupsHtml = [
            predsList.length ? '<div class="wcpp-bs-defense-group-title">Beneficial Predators (' + predsList.length + ")</div>" + predatorCards : "",
            repelItems.length ? '<div class="wcpp-bs-defense-group-title">Repellent Companions (' + repelItems.length + ")</div>" + repelCards : "",
            allyItems.length ? '<div class="wcpp-bs-defense-group-title">Biocontrol &amp; Microbial Allies (' + allyItems.length + ")</div>" + allyCards : ""
        ].filter(Boolean).join("");

        // Coast Salish Heritage & Lepidoptera Cards
        const salishCards = (div.coastSalishPlants || []).map(function (sp) {
            const names = [];
            if (sp.hulquminum) names.push('<span class="wcpp-bs-salish-badge">Hul\'q\'umi\'num\': ' + escHtml(sp.hulquminum) + "</span>");
            if (sp.halqemeylem) names.push('<span class="wcpp-bs-salish-badge">Halq\'em\u00e9ylem: ' + escHtml(sp.halqemeylem) + "</span>");
            if (sp.sencoten) names.push('<span class="wcpp-bs-salish-badge">SEN\u0106O\u0166EN: ' + escHtml(sp.sencoten) + "</span>");
            return '<div class="wcpp-bs-heritage-card">' +
                '<div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; flex-wrap:wrap;">' +
                    "<strong>" + escHtml(sp.cropName) + "</strong>" +
                    (sp.latin ? '<em style="font-size:0.78rem; color:var(--bs-muted);">' + escHtml(sp.latin) + "</em>" : "") +
                "</div>" +
                '<div style="display:flex; flex-wrap:wrap; gap:5px;">' + names.join("") + "</div>" +
                '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
                    (sp.latin ? '<a class="wcpp-bs-latin-link" href="latin.html?q=' + encodeURIComponent(sp.latin) + '" target="_blank" rel="noopener">Decode Latin \u2197</a>' : "") +
                    (sp.urlSlug ? '<a class="wcpp-bs-latin-link" href="species-' + encodeURIComponent(sp.urlSlug) + '.html" target="_blank" rel="noopener">Species Profile \u2197</a>' : "") +
                "</div>" +
            "</div>";
        }).join("");

        const lepCards = (div.lepidopteraHosts || []).map(function (lh) {
            const tags = [];
            (lh.butterflies || []).slice(0, 4).forEach(function (b) { tags.push('<span class="wcpp-bs-lep-badge">' + escHtml(b) + "</span>"); });
            (lh.moths || []).slice(0, 3).forEach(function (m) { tags.push('<span class="wcpp-bs-lep-badge">' + escHtml(m) + "</span>"); });
            const firstGenus = String(lh.hostGenera || lh.latin || "").split(/[,\s;]+/).filter(Boolean)[0] || "";
            return '<div class="wcpp-bs-heritage-card">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">' +
                    "<strong>" + escHtml(lh.cropName) + "</strong>" +
                    '<span class="wcpp-bs-lep-badge">' + (lh.totalHostCount || tags.length) + " Lepidoptera spp.</span>" +
                "</div>" +
                (tags.length ? '<div style="display:flex; flex-wrap:wrap; gap:5px;">' + tags.join("") + "</div>" : "") +
                (firstGenus ? '<a class="wcpp-bs-latin-link" href="latin.html?q=' + encodeURIComponent(firstGenus) + '" target="_blank" rel="noopener">Decode Taxon (' + escHtml(firstGenus) + ") \u2197</a>" : "") +
            "</div>";
        }).join("");

        const myco = eco.soilGuilds && eco.soilGuilds.mycorrhizalBreakdown ? eco.soilGuilds.mycorrhizalBreakdown : {};

        return '<div class="wcpp-bs-ecology-layout">' +
            '<div class="wcpp-bs-card">' +
                '<div class="wcpp-bs-card-header">' +
                    '<div><h3>Pollinator &amp; Pest Studio</h3><span style="font-size:0.8rem; color:var(--bs-muted);">Scope: ' + escHtml(eco.scope.blockName) + " \u00b7 Season " + eco.scope.seasonYear + "</span></div>" +
                    '<div class="wcpp-bs-toolbar-group">' +
                        '<select class="wcpp-bs-select" data-action="ecology-scope-change" aria-label="Ecology Scope Block">' + blockOptions + "</select>" +
                        '<span class="wcpp-bs-badge wcpp-bs-status-ok">Ecology Score: ' + eco.ecologyScore + "%</span>" +
                        '<span class="wcpp-bs-badge">Pollinator Window: ' + bc.activePollinatorMonthsCount + "/8 mo</span>" +
                        '<span class="wcpp-bs-badge">BC Natives: ' + div.nativeCount + " (" + div.nativeSharePct + "%)</span>" +
                        '<span class="wcpp-bs-badge">Coast Salish: ' + div.coastSalishCount + "</span>" +
                        '<span class="wcpp-bs-badge">Lepidoptera Hosts: ' + div.totalLepidopteraHostsSupported + "</span>" +
                    "</div>" +
                "</div>" +
                (!_catalog.enriched ? '<p style="margin:0; font-size:0.83rem; color:var(--bs-muted);">Loading full 389+ species ecology, Coast Salish &amp; bios_base.json records...</p>' : "") +
            "</div>" +
            '<div class="wcpp-bs-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<h3>12-Month Pollinator Bloom Continuity (Zone 8a)</h3>" +
                    '<span class="wcpp-bs-badge">Continuity: ' + bc.score + "% (Click month to inspect)</span>" +
                "</div>" +
                '<div class="wcpp-bs-bloom-svg-wrap">' + renderBloomContinuitySvg(bc) + "</div>" +
                bloomDetailHtml +
                gapHtml +
            "</div>" +
            '<div class="wcpp-bs-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<h3>Garden Defense Studio</h3>" +
                    '<span class="wcpp-bs-badge">' + cov.totalThreats + " Threats \u00b7 " + predsList.length + " Predators \u00b7 " + (repelItems.length + allyItems.length) + " Allies</span>" +
                "</div>" +
                defenseShieldHtml +
                '<div class="wcpp-bs-defense-grid">' +
                    '<div class="wcpp-bs-defense-col">' +
                        '<strong style="font-size:0.88rem; color:var(--bs-danger-text);">Active Pest Pressures (' + visiblePests.length + ")</strong>" +
                        (pestCards || '<p style="margin:0; font-size:0.82rem; color:var(--bs-muted);">' + (allPests.length ? "No pest pressures match this filter." : "No major pests flagged for scoped plantings.") + "</p>") +
                        diseaseSummary +
                    "</div>" +
                    '<div class="wcpp-bs-defense-col">' +
                        '<strong style="font-size:0.88rem; color:var(--bs-primary);">Active Defenders, Repellents &amp; Biocontrol Allies</strong>' +
                        (rightColumnGroupsHtml || '<p style="margin:0; font-size:0.82rem; color:var(--bs-muted);">Use + Plant buttons on any threat to add repellent companions or predator-attracting herbs.</p>') +
                    "</div>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-card">' +
                '<div class="wcpp-bs-strat-header">' +
                    "<div><h3 style=\"margin:0;font-size:1.02rem;font-weight:800;\">Canopy &amp; Root Stratification</h3><span style=\"font-size:0.78rem; color:var(--bs-muted);\">Mycorrhizae: AM " + (myco.AM || 0) + " \u00b7 EM " + (myco.EM || 0) + " \u00b7 Ericoid " + (myco.Ericoid || 0) + " \u00b7 Non-myc " + (myco.nonMycorrhizal || 0) + "</span></div>" +
                    (bedChoices.length ? '<select class="wcpp-bs-select" data-action="strat-bed-change" aria-label="Select Bed for Stratification">' + stratOptsHtml + "</select>" : "") +
                "</div>" +
                '<div class="wcpp-bs-strat-svg-wrap">' + renderStratificationSvg(strat) + "</div>" +
                (strat.notes && strat.notes.length ? '<div style="margin-top:10px; display:flex; flex-direction:column; gap:4px; font-size:0.81rem; color:var(--bs-muted);">' + strat.notes.map(function (n) { return "<div>\u2022 " + escHtml(n) + "</div>"; }).join("") + "</div>" : "") +
            "</div>" +
            '<div class="wcpp-bs-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<h3>Coast Salish Heritage &amp; Lepidoptera Larval Hosts</h3>" +
                    '<span class="wcpp-bs-badge">' + div.coastSalishCount + " Coast Salish \u00b7 " + div.lepidopteraHostSpeciesCount + " Host Plants</span>" +
                "</div>" +
                '<div class="wcpp-bs-heritage-grid">' +
                    (salishCards || '<div class="wcpp-bs-heritage-card"><strong>Coast Salish Native Flora</strong><span style="font-size:0.8rem; color:var(--bs-muted);">Add BC native perennials or ethnobotanical beds (e.g. Common Camas, Yarrow, Nodding Onion) to display Hul\'q\'umi\'num\', Halq\'em\u00e9ylem &amp; SEN\u0106O\u0166EN names.</span></div>') +
                    (lepCards || '<div class="wcpp-bs-heritage-card"><strong>Lepidoptera Larval Hosts</strong><span style="font-size:0.8rem; color:var(--bs-muted);">No Lepidoptera host species recorded on current beds.</span></div>') +
                "</div>" +
            "</div>" +
            (getV6Module() && typeof getV6Module().renderHabitatScorecardCard === "function" ? getV6Module().renderHabitatScorecardCard(getV6Ctx(), season) : "") +
            (getV6Module() && typeof getV6Module().renderCropTroubleshooterCard === "function" ? getV6Module().renderCropTroubleshooterCard(getV6Ctx(), season) : "") +
            renderEcologyResearchStrip(season) +
        "</div>";
    }

    function captureScrollOffsets() {
        const root = document.getElementById("wcppBedSimRoot");
        const blockScrolls = {};
        if (root) {
            root.querySelectorAll(".wcpp-bs-grid-scroll[data-scroll-block]").forEach(function (el) {
                blockScrolls[el.getAttribute("data-scroll-block")] = el.scrollLeft;
            });
        }
        return {
            rootScrollTop: root ? root.scrollTop : 0,
            winX: global.scrollX || 0,
            winY: global.scrollY || 0,
            blockScrolls: blockScrolls
        };
    }

    function restoreScrollOffsets(scrollState) {
        if (!scrollState) return;
        const root = document.getElementById("wcppBedSimRoot");
        if (root) {
            root.querySelectorAll(".wcpp-bs-grid-scroll[data-scroll-block]").forEach(function (el) {
                const key = el.getAttribute("data-scroll-block");
                if (scrollState.blockScrolls[key]) {
                    el.scrollLeft = scrollState.blockScrolls[key];
                }
            });
            root.scrollTop = scrollState.rootScrollTop || 0;
        }
        if (!_isFullscreen) {
            try { global.scrollTo(scrollState.winX || 0, scrollState.winY || 0); } catch (_) {}
        }
    }

    function captureFocusDescriptor(root) {
        const ae = document.activeElement;
        if (!ae || !root || !root.contains(ae)) return null;
        return {
            id: ae.id || "",
            action: ae.getAttribute("data-action") || "",
            plantingId: ae.getAttribute("data-planting-id") || "",
            blockEdit: ae.getAttribute("data-block-edit") || "",
            blockId: ae.getAttribute("data-block-id") || "",
            stdInput: ae.getAttribute("data-std-input") || "",
            selStart: typeof ae.selectionStart === "number" ? ae.selectionStart : null,
            selEnd: typeof ae.selectionEnd === "number" ? ae.selectionEnd : null
        };
    }

    function restoreFocusDescriptor(root, desc) {
        if (!desc || !root) return;
        let target = null;
        if (desc.id) target = document.getElementById(desc.id);
        if (!target && desc.blockEdit && desc.blockId) {
            target = root.querySelector('[data-block-edit="' + desc.blockEdit + '"][data-block-id="' + desc.blockId + '"]');
        }
        if (!target && desc.stdInput) {
            target = root.querySelector('[data-std-input="' + desc.stdInput + '"]');
        }
        if (!target && desc.plantingId && !desc.action) {
            target = root.querySelector('.wcpp-bs-bar[data-planting-id="' + desc.plantingId + '"]');
        }
        if (!target && desc.action && desc.plantingId) {
            target = root.querySelector('[data-action="' + desc.action + '"][data-planting-id="' + desc.plantingId + '"]');
        }
        if (target && typeof target.focus === "function") {
            try {
                target.focus({ preventScroll: true });
                if (desc.selStart !== null && typeof target.setSelectionRange === "function") {
                    target.setSelectionRange(desc.selStart, desc.selEnd);
                }
            } catch (_) {}
        }
    }

    function renderSimulator() {
        const root = document.getElementById("wcppBedSimRoot");
        if (!root || !_catalog || !_state || _mode !== "simulator") return;
        const c = core();
        const season = c.getActiveSeason(_state);
        if (!season) return;

        const scrollState = captureScrollOffsets();
        const focusDesc = captureFocusDescriptor(root);

        const score = c.scoreCropMap(_state, _catalog.cropMap);
        const nursery = c.computeWeeklyNurseryLoad(_state, _catalog.cropMap);
        const tasks = c.generateFieldTasks(_state, _catalog.cropMap);
        const openTasks = tasks.filter(function (t) { return !t.completed; }).length;
        const plans = typeof c.listSavedPlans === "function" ? c.listSavedPlans() : [];
        const ecoScoreVal = typeof c.analyzeBedEcology === "function"
            ? c.analyzeBedEcology(_state, _catalog, _ecologyBlockId || null).ecologyScore + "%"
            : "V2";

        const v6Mod = getV6Module();
        if (_subTab !== "crop-map" && !v6Mod) {
            ensureV6ModuleLoaded().then(function () {
                if (_mode === "simulator") renderSimulator();
            }).catch(function () {});
        }

        const subTabs = [
            { id: "crop-map", label: "Season Timeline", icon: "grid", count: (season.plantings || []).length },
            { id: "farm-layout", label: "Garden Layout & Shapes", icon: "farm", count: (season.blocks || []).length },
            { id: "insights", label: "Bed Health & Tune-Up", icon: "chart", count: score.overall + "%" },
            { id: "nursery", label: "Seed Starts & Tasks", icon: "nursery", count: openTasks },
            { id: "ecology", label: "Pollinators & Pests", icon: "ecology", count: _catalog.enriched ? ecoScoreVal : "..." },
            { id: "journal", label: "Journal & Seed Library", icon: "folder", count: v6Mod && typeof v6Mod.getJournalEntries === "function" ? v6Mod.getJournalEntries().length : 0 }
        ];

        const subNavHtml = '<div class="wcpp-bs-subnav" role="tablist">' + subTabs.map(function (st) {
            const active = _subTab === st.id;
            return '<button type="button" class="wcpp-bs-subtab' + (active ? " is-active" : "") + '" data-subtab="' + st.id + '" role="tab" aria-selected="' + (active ? "true" : "false") + '">' +
                svgIcon(st.icon, 15) +
                "<span>" + escHtml(st.label) + "</span>" +
                '<span class="wcpp-bs-pill-count">' + escHtml(st.count) + "</span>" +
            "</button>";
        }).join("") + "</div>";

        let tabBody = "";
        if (_subTab === "crop-map") tabBody = renderCropMapTab(season);
        else if (_subTab === "farm-layout") tabBody = renderFarmLayoutTab(season);
        else if (_subTab === "insights") tabBody = renderInsightsTab(season, score);
        else if (_subTab === "nursery") tabBody = renderNurseryTasksTab(season, nursery);
        else if (_subTab === "journal") {
            tabBody = v6Mod && typeof v6Mod.renderJournalAndSeedsTab === "function"
                ? v6Mod.renderJournalAndSeedsTab(getV6Ctx(), season)
                : '<div class="wcpp-bs-card"><p style="margin:0; font-size:0.84rem; color:var(--bs-muted);">Loading Garden Journal &amp; Royal Heights Seed Library...</p></div>';
        } else tabBody = renderEcologyTab(season);

        root.innerHTML =
            renderStudioBar(plans.length) +
            renderSharedPlanBanner() +
            subNavHtml +
            renderKpiStrip(season, score, nursery) +
            renderToolbar(season) +
            tabBody;

        restoreScrollOffsets(scrollState);
        restoreFocusDescriptor(root, focusDesc);
    }

    function getModeCohortColor(mode, laneIdx) {
        if (mode === "border") return "#d97706";
        if (mode === "understory") return "#0d9488";
        if (mode === "relay") return "#4f46e5";
        if (mode === "lanes") {
            const pal = ["#15803d", "#0369a1", "#7c3aed", "#0f766e"];
            return pal[Math.abs(laneIdx || 0) % pal.length];
        }
        return "#15803d";
    }

    function buildDraftPreviewContext(draft, crop, block) {
        const c = core();
        const season = _state ? c.getActiveSeason(_state) : null;
        const bedNum = draft && draft.bedStart ? Number(draft.bedStart) : (block && block.shapeType === "custom" ? 1 : null);
        const mode = getEffectiveMode(draft);
        const simPlanting = Object.assign({}, draft, {
            blockId: (block && block.id) || draft.blockId || null,
            bedStart: bedNum,
            interplantMode: mode,
            interplanted: mode !== "sole",
            interplantSharePct: Math.max(15, Math.min(85, Math.round(Number(draft.interplantSharePct || 50)))),
            borderSides: Number(draft.borderSides) === 1 ? 1 : 2,
            pottingUp: draft.potUpEnabled ? { cells: draft.potCells, weeks: draft.potWeeks } : null
        });
        const tunnels = (season && season.tunnels) || [];
        const dates = c.computePlantingDates(simPlanting, crop, block, tunnels, _state ? (_state.climateAdjusted !== false) : true);
        const metrics = c.computePlantingMetrics(simPlanting, crop, block, _state ? _state.units : "metric");

        let cohorts = [];
        let analysis = null;
        let elig = null;
        let simSeason = season;

        if (season && block && bedNum) {
            const clonedPlantings = (season.plantings || []).map(function (p) { return Object.assign({}, p); });
            const draftWithDates = Object.assign({}, simPlanting, dates);
            const idx = clonedPlantings.findIndex(function (p) { return p.id === draftWithDates.id; });
            if (idx >= 0) clonedPlantings[idx] = draftWithDates;
            else clonedPlantings.push(draftWithDates);

            simSeason = Object.assign({}, season, { plantings: clonedPlantings });
            if (typeof c.analyzeBedInterplanting === "function") {
                analysis = c.analyzeBedInterplanting(block, bedNum, simSeason, _catalog);
            }
            elig = c.checkDropEligibility(simPlanting, block.id, bedNum, season, _catalog.cropMap, draft.isEdit ? draft.id : undefined);

            const allOnBed = (analysis && analysis.plantings) ? analysis.plantings : [];
            const dStart = dates.startDate || simPlanting.startDate;
            const dEnd = dates.endDate || dates.harvestEndDate || simPlanting.startDate;
            let laneCounter = 0;
            cohorts = allOnBed.filter(function (entry) {
                if (entry.id === simPlanting.id) return true;
                return !(entry.endDate <= dStart || dEnd <= entry.startDate);
            }).map(function (entry) {
                const orig = clonedPlantings.find(function (x) { return x.id === entry.id; }) || simPlanting;
                const pCrop = c.resolveCrop(_catalog.cropMap, entry.cropName) || crop;
                const eMode = entry.interplantMode || getEffectiveMode(orig);
                const lIdx = eMode === "lanes" ? laneCounter++ : 0;
                return {
                    id: entry.id,
                    isDraft: entry.id === simPlanting.id,
                    cropName: entry.cropName,
                    label: entry.label || entry.cropName,
                    interplantMode: eMode,
                    interplantSharePct: entry.interplantSharePct || orig.interplantSharePct || 50,
                    borderSides: entry.borderSides || orig.borderSides || 2,
                    rowsPerBed: Number(orig.rowsPerBed || (pCrop && pCrop.rowsPerBed) || 2),
                    inRowCm: Number(orig.inRowCm || (pCrop && pCrop.inRowCm) || 25),
                    betweenRowCm: Number(orig.betweenRowCm || (pCrop && pCrop.betweenRowCm) || 25),
                    laneIdx: lIdx,
                    color: getModeCohortColor(eMode, lIdx)
                };
            });
        }

        if (!cohorts.length) {
            cohorts = [{
                id: simPlanting.id,
                isDraft: true,
                cropName: simPlanting.cropName,
                label: simPlanting.label || (crop ? crop.name : simPlanting.cropName),
                interplantMode: mode,
                interplantSharePct: simPlanting.interplantSharePct,
                borderSides: simPlanting.borderSides,
                rowsPerBed: Number(simPlanting.rowsPerBed || (crop && crop.rowsPerBed) || 2),
                inRowCm: Number(simPlanting.inRowCm || (crop && crop.inRowCm) || 25),
                betweenRowCm: Number(simPlanting.betweenRowCm || (crop && crop.betweenRowCm) || 25),
                laneIdx: 0,
                color: getModeCohortColor(mode, 0)
            }];
        }

        return {
            simPlanting: simPlanting,
            simSeason: simSeason,
            dates: dates,
            metrics: metrics,
            analysis: analysis,
            elig: elig,
            cohorts: cohorts
        };
    }

    function renderSharedBedLegendHtml(cohorts) {
        if (!Array.isArray(cohorts) || !cohorts.length) return "";
        return '<div class="wcpp-bs-shared-legend">' +
            cohorts.map(function (ch) {
                const modeLbl = getInterplantModeLabel({
                    interplantMode: ch.interplantMode,
                    interplantSharePct: ch.interplantSharePct
                }, true);
                const borderInfo = ch.interplantMode === "border" ? (" \u00b7 " + ch.borderSides + "e") : "";
                return '<span class="wcpp-bs-shared-legend-item">' +
                    '<span class="wcpp-bs-shared-legend-swatch" style="background:' + escHtml(ch.color) + ';"></span>' +
                    "<span>" + escHtml(ch.label) + (ch.isDraft ? " (editing)" : "") + " \u00b7 " + escHtml(modeLbl + borderInfo) + "</span>" +
                "</span>";
            }).join("") +
        "</div>";
    }

    function renderCrossSectionSvg(draft, crop, block, ctxOpt) {
        const c = core();
        const ctx = ctxOpt || buildDraftPreviewContext(draft, crop, block);
        const cohorts = ctx.cohorts || [];
        const W = 540;
        const H = 225;
        const isImp = _state.units === "imperial";

        // Custom curved bed top-down rendering using generateCustomShapePlantPoints
        if (block && block.shapeType === "custom" && block.customShape && typeof c.computeCustomShapeGeometry === "function") {
            const geom = c.computeCustomShapeGeometry(block.customShape);
            if (geom) {
                const padTop = 34;
                const padBot = 28;
                const padSide = 44;
                const availW = W - padSide * 2;
                const availH = H - padTop - padBot;
                const scale = Math.min(availW / Math.max(10, geom.widthCm), availH / Math.max(10, geom.heightCm));
                const ox = (W - geom.widthCm * scale) / 2;
                const oy = padTop + (availH - geom.heightCm * scale) / 2;

                const orderRank = { sole: 0, lanes: 1, understory: 2, relay: 3, border: 4 };
                const ordered = cohorts.slice().sort(function (a, b) {
                    return (orderRank[a.interplantMode] ?? 1) - (orderRank[b.interplantMode] ?? 1);
                });

                let dotsSvg = "";
                let laneStartRun = 0;
                ordered.forEach(function (ch) {
                    const shareFrac = Math.max(0.15, Math.min(0.85, Number(ch.interplantSharePct || 50) / 100));
                    const ptsRes = typeof c.generateCustomShapePlantPoints === "function"
                        ? c.generateCustomShapePlantPoints(block.customShape, ch.inRowCm, ch.betweenRowCm, ch.interplantMode, {
                            sharePct: shareFrac,
                            laneIndex: ch.laneIdx,
                            laneStartPct: ch.interplantMode === "lanes" ? laneStartRun : undefined
                        })
                        : { points: [] };
                    if (ch.interplantMode === "lanes") {
                        laneStartRun = Math.min(0.85, laneStartRun + shareFrac);
                    }
                    const dotRcm = (ch.isDraft ? 4.4 : 3.6) / Math.max(0.1, scale);
                    (ptsRes.points || []).forEach(function (pt) {
                        dotsSvg += '<circle cx="' + pt.x.toFixed(1) + '" cy="' + pt.y.toFixed(1) + '" r="' + dotRcm.toFixed(2) + '" ' +
                            'fill="' + escHtml(ch.color) + '" stroke="' + (ch.isDraft ? "#ffffff" : "rgba(255,255,255,0.85)") + '" stroke-width="1.1" vector-effect="non-scaling-stroke"/>';
                    });
                });

                const areaDisp = isImp ? (geom.areaFt2 + " ft\u00b2") : (geom.areaM2 + " m\u00b2");
                const dimsDisp = isImp
                    ? (c.mToFt(geom.widthCm / 100) + " ft \u00d7 " + c.cmToIn(geom.heightCm) + " in")
                    : (Math.round(geom.widthCm) + " \u00d7 " + Math.round(geom.heightCm) + " cm");

                return '<svg class="wcpp-bs-cross-section-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Top-down custom shaped bed planting preview">' +
                    '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
                    '<g transform="translate(' + ox.toFixed(1) + "," + oy.toFixed(1) + ") scale(" + scale.toFixed(5) + ')">' +
                        '<path d="' + escHtml(geom.pathD) + '" fill="#ecfdf5" stroke="#166534" stroke-width="1.8" vector-effect="non-scaling-stroke"/>' +
                        dotsSvg +
                    "</g>" +
                    '<text x="' + (W / 2) + '" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="#111827">' + escHtml((block.name || "Custom Bed") + " \u00b7 " + cohorts.length + " Crop" + (cohorts.length > 1 ? "s" : "") + " (" + areaDisp + ")") + "</text>" +
                    '<text x="' + (W / 2) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11.5" font-weight="600" fill="#4b5563">' + escHtml("Custom Footprint: " + dimsDisp + " \u00b7 Perimeter " + (isImp ? (geom.perimeterFt + " ft") : (geom.perimeterM + " m"))) + "</text>" +
                "</svg>";
            }
        }

        // Rectangular bed multi-crop top-down preview (2.4 m / 8 ft sample window)
        const bedWidthCm = Math.max(20, Number((block && block.bedWidthCm) || (_state.farmDefaults && _state.farmDefaults.bedWidthCm) || 75));
        const pathWidthCm = Math.max(10, Number((block && block.pathWidthCm) || (_state.farmDefaults && _state.farmDefaults.pathWidthCm) || 30));
        const sampleLenCm = 240;
        const bedTop = 44;
        const bedLeft = 48;
        const bedPxW = W - 96;
        const bedPxH = Math.max(76, Math.min(124, Math.round((bedWidthCm / 125) * 116)));
        const pathPx = Math.max(12, Math.min(26, Math.round((pathWidthCm / bedWidthCm) * bedPxH)));
        const pxPerCmX = bedPxW / sampleLenCm;

        let interiorSvg = "";
        let laneCursorFrac = 0;

        const primaryCohorts = cohorts.filter(function (ch) { return ch.interplantMode === "sole" || ch.interplantMode === "lanes"; });
        const overlayCohorts = cohorts.filter(function (ch) { return ch.interplantMode !== "sole" && ch.interplantMode !== "lanes"; });

        primaryCohorts.forEach(function (ch, idx) {
            const shareFrac = ch.interplantMode === "lanes"
                ? Math.max(0.15, Math.min(0.85, Number(ch.interplantSharePct || 50) / 100))
                : 1.0;
            const startF = ch.interplantMode === "lanes" ? Math.min(0.85, laneCursorFrac) : 0;
            const endF = ch.interplantMode === "lanes" ? Math.min(1.0, startF + shareFrac) : 1.0;
            if (ch.interplantMode === "lanes") {
                laneCursorFrac = endF;
                if (idx > 0 && startF > 0 && startF < 1) {
                    const divY = bedTop + startF * bedPxH;
                    interiorSvg += '<line x1="' + bedLeft + '" y1="' + divY.toFixed(1) + '" x2="' + (bedLeft + bedPxW) + '" y2="' + divY.toFixed(1) + '" stroke="#0369a1" stroke-width="1.3" stroke-dasharray="5 3"/>';
                }
            }

            const bandTop = bedTop + startF * bedPxH + 7;
            const bandH = Math.max(14, (endF - startF) * bedPxH - 14);
            const effRows = ch.interplantMode === "lanes"
                ? Math.max(1, Math.round(ch.rowsPerBed * shareFrac))
                : Math.max(1, Math.min(12, ch.rowsPerBed));
            const stepY = effRows > 1 ? bandH / (effRows - 1) : 0;
            const firstY = effRows > 1 ? bandTop : (bandTop + bandH / 2);
            const stepX = Math.max(10, ch.inRowCm * pxPerCmX);
            const dotR = Math.max(3.4, Math.min(8.5, stepX * 0.27));

            for (let r = 0; r < effRows; r++) {
                const ry = firstY + r * stepY;
                interiorSvg += '<line x1="' + (bedLeft + 8) + '" y1="' + ry.toFixed(1) + '" x2="' + (bedLeft + bedPxW - 8) + '" y2="' + ry.toFixed(1) + '" stroke="' + escHtml(ch.color) + '" stroke-width="1" stroke-dasharray="4 3" opacity="0.48"/>';
                for (let cx = bedLeft + 18; cx <= bedLeft + bedPxW - 14; cx += stepX) {
                    interiorSvg += '<circle cx="' + cx.toFixed(1) + '" cy="' + ry.toFixed(1) + '" r="' + dotR.toFixed(1) + '" fill="' + escHtml(ch.color) + '" stroke="#ffffff" stroke-width="1"/>';
                }
            }
        });

        overlayCohorts.forEach(function (ch) {
            const stepX = Math.max(10, ch.inRowCm * pxPerCmX);
            const dotR = Math.max(3.0, Math.min(6.5, stepX * 0.24));
            if (ch.interplantMode === "border") {
                const edgeYs = ch.borderSides === 1 ? [bedTop + 8] : [bedTop + 8, bedTop + bedPxH - 8];
                edgeYs.forEach(function (ry) {
                    interiorSvg += '<line x1="' + (bedLeft + 8) + '" y1="' + ry.toFixed(1) + '" x2="' + (bedLeft + bedPxW - 8) + '" y2="' + ry.toFixed(1) + '" stroke="' + escHtml(ch.color) + '" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>';
                    for (let cx = bedLeft + 16; cx <= bedLeft + bedPxW - 14; cx += stepX) {
                        interiorSvg += '<circle cx="' + cx.toFixed(1) + '" cy="' + ry.toFixed(1) + '" r="' + dotR.toFixed(1) + '" fill="' + escHtml(ch.color) + '" stroke="#ffffff" stroke-width="1"/>';
                    }
                });
            } else if (ch.interplantMode === "understory") {
                const rowsU = Math.max(1, Math.min(6, ch.rowsPerBed));
                const spanH = bedPxH - 28;
                const stepY = rowsU > 1 ? spanH / (rowsU - 1) : 0;
                const firstY = rowsU > 1 ? (bedTop + 14) : (bedTop + bedPxH / 2 + 6);
                for (let r = 0; r < rowsU; r++) {
                    const ry = firstY + r * stepY;
                    for (let cx = bedLeft + 18 + stepX * 0.5; cx <= bedLeft + bedPxW - 12; cx += stepX) {
                        interiorSvg += '<circle cx="' + cx.toFixed(1) + '" cy="' + ry.toFixed(1) + '" r="' + dotR.toFixed(1) + '" fill="' + escHtml(ch.color) + '" stroke="#ffffff" stroke-width="1" opacity="0.92"/>';
                    }
                }
            } else if (ch.interplantMode === "relay") {
                const alleyRows = Math.max(1, Math.min(6, Math.max(1, ch.rowsPerBed - 1)));
                for (let r = 0; r < alleyRows; r++) {
                    const frac = (r + 1) / (alleyRows + 1);
                    const ry = bedTop + frac * bedPxH;
                    interiorSvg += '<line x1="' + (bedLeft + 10) + '" y1="' + ry.toFixed(1) + '" x2="' + (bedLeft + bedPxW - 10) + '" y2="' + ry.toFixed(1) + '" stroke="' + escHtml(ch.color) + '" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>';
                    for (let cx = bedLeft + 20; cx <= bedLeft + bedPxW - 14; cx += stepX) {
                        interiorSvg += '<circle cx="' + cx.toFixed(1) + '" cy="' + ry.toFixed(1) + '" r="' + dotR.toFixed(1) + '" fill="' + escHtml(ch.color) + '" stroke="#ffffff" stroke-width="1"/>';
                    }
                }
            }
        });

        const rows = Math.max(1, Math.min(12, Math.round(Number(draft.rowsPerBed || (crop && crop.rowsPerBed) || 2))));
        const inRowCm = Math.max(2, Number(draft.inRowCm || (crop && crop.inRowCm) || 25));
        const betweenRowCm = Math.max(3, Number(draft.betweenRowCm || (crop && crop.betweenRowCm) || Math.round(bedWidthCm / (rows + 0.5))));
        const bedWidLabel = isImp ? (c.cmToIn(bedWidthCm) + " in bed") : (Math.round(bedWidthCm) + " cm bed");
        const inRowLabel = "In-row: " + c.formatSpacing(inRowCm, _state.units);
        const betRowLabel = rows > 1 ? ("Between rows: " + c.formatSpacing(betweenRowCm, _state.units)) : "Single center row";
        const headerTitle = cohorts.length > 1
            ? ("Shared Bed (" + cohorts.length + " overlapping crops \u00b7 " + bedWidLabel + ")")
            : ((crop ? crop.name : draft.cropName) + " \u00b7 " + rows + " Row" + (rows > 1 ? "s" : "") + " (" + bedWidLabel + ")");

        return '<svg class="wcpp-bs-cross-section-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Top-down shared bed cross-section showing interplanted crops and spacing">' +
            '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
            '<rect x="' + bedLeft + '" y="' + (bedTop - pathPx) + '" width="' + bedPxW + '" height="' + pathPx + '" fill="#f8fafc" stroke="#e2e8f0"/>' +
            '<rect x="' + bedLeft + '" y="' + (bedTop + bedPxH) + '" width="' + bedPxW + '" height="' + pathPx + '" fill="#f8fafc" stroke="#e2e8f0"/>' +
            '<rect x="' + bedLeft + '" y="' + bedTop + '" width="' + bedPxW + '" height="' + bedPxH + '" rx="5" fill="#ecfdf5" stroke="#166534" stroke-width="1.6"/>' +
            interiorSvg +
            '<text x="' + (bedLeft + bedPxW / 2) + '" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="#111827">' + escHtml(headerTitle) + "</text>" +
            '<text x="' + (bedLeft + bedPxW / 2) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="11.5" font-weight="600" fill="#4b5563">' + escHtml(inRowLabel + " \u00b7 " + betRowLabel + " \u00b7 2.4 m / 8 ft sample window") + "</text>" +
        "</svg>";
    }

    function openPlantingModal(opts) {
        ensureReady().then(function () {
            const c = core();
            if (!_catalog.enriched && typeof c.whenEnriched === "function") {
                c.whenEnriched(_catalog).catch(function () {});
            }
            if (global.WCPPInventory && typeof global.WCPPInventory.isLoaded === "function" && !global.WCPPInventory.isLoaded() && typeof global.WCPPInventory.load === "function") {
                global.WCPPInventory.load();
            }
            const season = c.getActiveSeason(_state);
            const options = opts || {};
            let existing = null;
            if (options.plantingId && season) {
                existing = (season.plantings || []).find(function (p) { return p.id === options.plantingId; }) || null;
            }
            const defaultCropName = (existing && existing.cropName) || options.cropName || "Carrot";
            const crop = c.resolveCrop(_catalog.cropMap, defaultCropName) || _catalog.crops[0];
            const defBlockId = existing ? existing.blockId : (options.blockId || null);
            const defBlock = defBlockId && season ? (season.blocks || []).find(function (b) { return b.id === defBlockId; }) : null;
            let defBed = existing ? existing.bedStart : (options.bedStart || null);
            if (!defBed && defBlock && defBlock.shapeType === "custom") {
                defBed = 1;
            }
            const startDefault = (season ? season.year : 2026) + "-04-15";

            const initMode = existing
                ? getEffectiveMode(existing)
                : (options.interplantMode || (options.interplanted ? "border" : "sole"));
            const initShare = existing && existing.interplantSharePct
                ? Number(existing.interplantSharePct)
                : Number(options.interplantSharePct || 50);

            _plantingDraft = {
                isEdit: Boolean(existing),
                id: existing ? existing.id : ("pl_" + Date.now() + "_" + Math.floor(Math.random() * 1000)),
                cropName: crop ? crop.name : defaultCropName,
                label: existing ? (existing.label || (crop ? crop.name : defaultCropName)) : (crop ? crop.name : defaultCropName),
                blockId: defBlockId || "",
                bedStart: defBed || "",
                bedCount: existing ? Number(existing.bedCount || 1) : Number(options.bedCount || 1),
                method: (existing && existing.method) || (crop && crop.method) || "Direct Seed",
                interplantMode: initMode,
                interplanted: initMode !== "sole",
                interplantSharePct: Math.max(15, Math.min(85, Math.round(initShare))),
                borderSides: (existing && Number(existing.borderSides) === 1) ? 1 : Number(options.borderSides || 2),
                interplantHostId: (existing && existing.interplantHostId) || options.interplantHostId || null,
                laneIndex: (existing && existing.laneIndex !== undefined) ? existing.laneIndex : undefined,
                startDate: (existing && existing.startDate) || options.startDate || startDefault,
                lockHarvestDate: existing ? Boolean(existing.lockHarvestDate) : false,
                targetHarvestDate: (existing && (existing.targetHarvestDate || existing.harvestStartDate)) || c.addDaysIso(startDefault, (crop && crop.dtmDays) || 60),
                rowsPerBed: Number((existing && existing.rowsPerBed) || (crop && crop.rowsPerBed) || 2),
                inRowCm: Number((existing && existing.inRowCm) || (crop && crop.inRowCm) || 25),
                betweenRowCm: Number((existing && existing.betweenRowCm) || (crop && crop.betweenRowCm) || 25),
                dtmDaysOverride: Number((existing && (existing.dtmDaysOverride || existing.dtmDays)) || (crop && crop.dtmDays) || 60),
                harvestWindowOverride: existing && existing.harvestWindowOverride ? Number(existing.harvestWindowOverride) : undefined,
                nurseryWeeksOverride: Number((existing && (existing.nurseryWeeksOverride !== undefined ? existing.nurseryWeeksOverride : existing.nurseryWeeks)) ?? (crop && crop.nurseryWeeks) ?? 4),
                trayCells: Number((existing && existing.trayCells) || (crop && crop.trayCells) || 72),
                seedsPerCell: Number((existing && existing.seedsPerCell) || (crop && crop.seedsPerCell) || 1),
                safetyMarginPct: Number((existing && existing.safetyMarginPct) ?? 10),
                potUpEnabled: Boolean(existing ? existing.pottingUp : (crop && crop.pottingUp)),
                potCells: Number((existing && existing.pottingUp && existing.pottingUp.cells) || (crop && crop.pottingUp && crop.pottingUp.cells) || 18),
                potWeeks: Number((existing && existing.pottingUp && existing.pottingUp.weeks) || (crop && crop.pottingUp && crop.pottingUp.weeks) || 3),
                notes: (existing && existing.notes) || "",
                successionCount: 1,
                successionIntervalDays: 14
            };
            _cropSearchText = _plantingDraft.cropName;
            _cropDropdownOpen = false;
            _modalMode = "planting";
            renderModal();
        });
    }

    function openConflictModal(payload) {
        _conflictPayload = payload;
        _modalMode = "conflict";
        renderModal();
    }

    function openRotationHistoryModal(blockId) {
        _rotationModalState = { blockId: blockId };
        _modalMode = "rotation";
        renderModal();
    }

    function openPlansModal() {
        _renamingPlanId = null;
        _modalMode = "plans";
        renderModal();
    }

    // [V5 Lazy Split: Shape Designer, Container/Media & Plant Playground moved to js/bed-simulator-studio-modals.js]
    function activatePlanState(newState, opts) {
        if (!newState) return;
        const options = opts || {};
        _state = newState;
        rehydrateAllSeasons();
        _sharedPlanBanner = null;
        _previousLocalStateBackup = null;
        _optimizerPreview = null;
        _selectedPlantingId = null;
        _selectedStructureId = null;
        _lastSavedAt = Date.now();
        const c = core();
        const activeSeason = c ? c.getActiveSeason(_state) : null;
        if (activeSeason && activeSeason.blocks && activeSeason.blocks.length) {
            _selectedBlockId = activeSeason.blocks[0].id;
            _stratTargetKey = activeSeason.blocks[0].id + ":1";
        } else {
            _selectedBlockId = null;
        }
        syncSavedTabDot();
        if (options.clearHash !== false) {
            syncUrlForMode("simulator", { clearHash: true });
        }
        if (!options.keepModal) {
            closeModal();
        }
        renderSimulator();
    }

    function getStudioModalCtx() {
        return {
            core: core,
            getCore: core,
            getState: function () { return _state; },
            setState: function (nextState) { _state = nextState; },
            getCatalog: function () { return _catalog; },
            getModalMode: function () { return _modalMode; },
            setModalMode: function (mode) { _modalMode = mode; },
            getSelectedBlockId: function () { return _selectedBlockId; },
            setSelectedBlockId: function (id) { _selectedBlockId = id; },
            getMode: function () { return _mode; },
            switchMode: switchMode,
            getSubTab: function () { return _subTab; },
            setSubTab: function (subTab) {
                _subTab = subTab;
                syncPrefsCookie({ subTab: _subTab });
            },
            commitStateChange: commitStateChange,
            rehydrateAllSeasons: rehydrateAllSeasons,
            saveCurrentStateSafely: saveCurrentStateSafely,
            syncSavedTabDot: syncSavedTabDot,
            activatePlanState: activatePlanState,
            clearSharedPlanBanner: function () {
                _sharedPlanBanner = null;
                _previousLocalStateBackup = null;
                syncUrlForMode("simulator", { clearHash: true });
            },
            setLastSavedAt: function (ts) { _lastSavedAt = ts; },
            renderSimulator: renderSimulator,
            renderModal: renderModal,
            closeModal: closeModal,
            showToast: showToast,
            escHtml: escHtml,
            stripEmojis: stripEmojis,
            svgIcon: svgIcon,
            getTodayIso: getTodayIso,
            MEDIA_INGREDIENT_COLORS: MEDIA_INGREDIENT_COLORS,
            isContainerBlock: isContainerBlock,
            getBlockTypeLabel: getBlockTypeLabel,
            formatContainerSummaryBadge: formatContainerSummaryBadge,
            formatBedSizeSummary: formatBedSizeSummary,
            formatAxisMeasurement: function (cmValue, axisUnit) {
                const c = core();
                return c && typeof c.formatAxisMeasurement === "function" ? c.formatAxisMeasurement(cmValue, axisUnit) : (Math.round(cmValue) + " cm");
            },
            getDefaultPlaygroundGridCm: function (block) {
                const c = core();
                return c && typeof c.getDefaultPlaygroundGridCm === "function" ? c.getDefaultPlaygroundGridCm(block) : 30.48;
            },
            clientToSvgCoords: clientToSvgCoords,
            openShapeDesigner: openShapeDesigner,
            openContainerModal: openContainerModal,
            openBedPlayground: openBedPlayground,
            openBlueprintsGallery: openBlueprintsGallery,
            ensureV6ModuleLoaded: ensureV6ModuleLoaded,
            getV6Ctx: getV6Ctx
        };
    }

    function openLazyStudioModal(loadingTitle, openFn) {
        const reqId = ++_studioModalReqId;
        const existingMods = getStudioModals();
        if (_catalog && _state && existingMods) {
            ensureShellDom();
            openFn(existingMods, getStudioModalCtx());
            return Promise.resolve();
        }
        ensureShellDom();
        _studioLoadingLabel = loadingTitle || "Loading Studio Module...";
        _modalMode = "loading";
        renderModal();
        return Promise.all([ensureReady(), ensureStudioModalsLoaded()]).then(function (res) {
            if (_studioModalReqId !== reqId) return;
            ensureShellDom();
            const mods = res[1] || getStudioModals();
            if (!mods) throw new Error("Studio modals module unavailable.");
            openFn(mods, getStudioModalCtx());
        }).catch(function (err) {
            if (_studioModalReqId === reqId && _modalMode === "loading") {
                closeModal();
            }
            showToast("Unable to load studio modal: " + ((err && err.message) || "Network error"));
        });
    }

    function openShapeDesigner(opts) {
        return openLazyStudioModal("Loading Custom Bed Shape Designer...", function (mods, ctx) {
            const opener = mods.openShapeDesigner || mods.setupShapeDesigner;
            if (typeof opener === "function") opener(ctx, opts);
        });
    }

    function openContainerModal(opts) {
        return openLazyStudioModal("Loading Container & Growing Media Builder...", function (mods, ctx) {
            const opener = mods.openContainerModal || mods.setupContainerModal;
            if (typeof opener === "function") opener(ctx, opts);
        });
    }

    function openBedPlayground(blockId, bedNumber) {
        return openLazyStudioModal("Loading Interactive Plant Playground...", function (mods, ctx) {
            const opener = mods.openBedPlayground || mods.setupPlayground;
            if (typeof opener === "function") opener(ctx, blockId, bedNumber);
        });
    }

    function openBlueprintsGallery(opts) {
        return openLazyStudioModal("Loading BC Starter Blueprints Gallery...", function (mods, ctx) {
            const opener = mods.openBlueprintsGallery || mods.setupBlueprintsGallery;
            if (typeof opener === "function") opener(ctx, opts);
        });
    }

    function renderLoadingModalHtml() {
        return '<div class="wcpp-bs-modal is-compact wcpp-bs-loading-modal">' +
            '<div class="wcpp-bs-modal-header">' +
                "<h2>" + escHtml(_studioLoadingLabel || "Loading Studio Module...") + "</h2>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7 Close</button>' +
            "</div>" +
            '<div class="wcpp-bs-modal-body" style="display:flex;align-items:center;gap:14px;padding:24px 20px;">' +
                '<div class="wcpp-bs-spinner" aria-hidden="true"></div>' +
                '<div><strong>Fetching interactive studio module...</strong>' +
                '<div style="font-size:0.82rem;color:var(--bs-muted);margin-top:3px;">Preparing architectural canvas, container presets &amp; BC starter blueprints.</div></div>' +
            "</div>" +
        "</div>";
    }

    function closeModal() {
        _studioModalReqId += 1;
        cleanupPlaygroundPrintSheet();
        const mods = getStudioModals();
        if (mods) {
            if (typeof mods.cleanupPrintSheet === "function") mods.cleanupPrintSheet();
            if (typeof mods.resetState === "function") mods.resetState();
        }
        _modalMode = null;
        _conflictPayload = null;
        _rotationModalState = null;
        _renamingPlanId = null;
        _cropDropdownOpen = false;
        const bd = document.getElementById("wcppBsModalBackdrop");
        if (bd) {
            bd.hidden = true;
            bd.classList.remove("is-open");
            bd.innerHTML = "";
        }
    }

    function renderModalHeroHtml(crop, prof) {
        const sci = (crop && crop.latin) || "";
        const com = (crop && crop.name) || (_plantingDraft && _plantingDraft.cropName) || "Crop";
        const cacheKey = sci + "|" + com;
        const cached = _modalPhotoCache.get(cacheKey);
        const imgUrl = (cached && cached.url) || getFallbackPlantSvgUrl(sci, com);
        const sourceTxt = (cached && cached.source) || "Botanical Card";

        const salishPills = [];
        if (prof && prof.coastSalish && prof.coastSalish.hasAny) {
            if (prof.coastSalish.hulquminum) salishPills.push('<span class="wcpp-bs-salish-badge">Hul\'q\'umi\'num\': ' + escHtml(prof.coastSalish.hulquminum) + "</span>");
            if (prof.coastSalish.halqemeylem) salishPills.push('<span class="wcpp-bs-salish-badge">Halq\'em\u00e9ylem: ' + escHtml(prof.coastSalish.halqemeylem) + "</span>");
            if (prof.coastSalish.sencoten) salishPills.push('<span class="wcpp-bs-salish-badge">SEN\u0106O\u0166EN: ' + escHtml(prof.coastSalish.sencoten) + "</span>");
        }

        const invLoaded = global.WCPPInventory && typeof global.WCPPInventory.isLoaded === "function" && global.WCPPInventory.isLoaded();
        const invBadgeHtml = invLoaded
            ? stripEmojis(global.WCPPInventory.renderBadge({ commonName: com, latinName: sci }, { compact: true, showPreorderFallback: true, pageTheme: "garden" }))
            : "";

        return '<div class="wcpp-bs-modal-hero" id="wcppBsModalHeroHost">' +
            '<div class="wcpp-bs-modal-photo-wrap">' +
                '<img id="wcppBsModalHeroImg" class="wcpp-bs-modal-photo" src="' + escHtml(imgUrl) + '" alt="' + escHtml(com) + '">' +
            "</div>" +
            '<div class="wcpp-bs-modal-hero-info">' +
                '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    '<strong style="font-size:1rem;">' + escHtml(com) + "</strong>" +
                    (sci ? '<em style="font-size:0.84rem; color:var(--bs-muted);">' + escHtml(sci) + "</em>" : "") +
                    (crop && crop.family ? '<span class="wcpp-bs-badge">' + escHtml(crop.family) + "</span>" : "") +
                    (crop && crop.isNativeBC ? '<span class="wcpp-bs-badge wcpp-bs-status-ok">BC Native</span>' : "") +
                    '<span class="wcpp-bs-badge" id="wcppBsModalPhotoSource">' + escHtml(sourceTxt) + "</span>" +
                "</div>" +
                (salishPills.length ? '<div style="display:flex; flex-wrap:wrap; gap:5px;">' + salishPills.join("") + "</div>" : "") +
                '<div class="wcpp-bs-hero-links">' +
                    (sci ? '<a class="wcpp-bs-latin-link" href="latin.html?q=' + encodeURIComponent(sci) + '" target="_blank" rel="noopener">Decode Latin Name \u2197</a>' : "") +
                    (prof && prof.urlSlug ? '<a class="wcpp-bs-latin-link" href="species-' + encodeURIComponent(prof.urlSlug) + '.html" target="_blank" rel="noopener">Species Page \u2197</a>' : "") +
                    '<span id="wcppBsModalInvBadge">' + invBadgeHtml + "</span>" +
                "</div>" +
            "</div>" +
        "</div>";
    }

    function renderModalEcologyBoxHtml(crop, prof) {
        if (!prof) {
            return '<div class="wcpp-bs-ecology-box" id="wcppBsModalEcologyHost"><strong>Ecology &amp; Biocontrol Profile</strong><div style="color:var(--bs-muted);margin-top:4px;">Standard agronomic defaults applied.</div></div>';
        }
        const bioLinks = (prof.matchedBioEntries || []).slice(0, 6).map(function (be) {
            return '<a class="wcpp-bs-bio-pill" href="bios.html?entry=' + encodeURIComponent(be.id) + '" target="_blank" rel="noopener">' + escHtml(be.name) + " \u2197</a>";
        }).join("");

        const bits = [];
        if (prof.bloomLabels && prof.bloomLabels.length) bits.push("<strong>Bloom:</strong> " + escHtml(prof.bloomLabels.join(", ")));
        if (prof.pollinators && prof.pollinators.length) bits.push("<strong>Pollinators:</strong> " + escHtml(prof.pollinators.slice(0, 3).join(", ")));
        if (prof.naturalPredators && prof.naturalPredators.length) bits.push("<strong>Predators:</strong> " + escHtml(prof.naturalPredators.slice(0, 3).join(", ")));
        if (prof.pestsRepelled && prof.pestsRepelled.length) bits.push("<strong>Repels:</strong> " + escHtml(prof.pestsRepelled.slice(0, 3).join(", ")));
        if (prof.pestsAttracted && prof.pestsAttracted.length) bits.push("<strong>Pest Watch:</strong> " + escHtml(prof.pestsAttracted.slice(0, 3).join(", ")));
        if (prof.lepidoptera && prof.lepidoptera.totalHostCount > 0) bits.push("<strong>Lepidoptera Hosts:</strong> " + prof.lepidoptera.totalHostCount + " spp.");

        return '<div class="wcpp-bs-ecology-box" id="wcppBsModalEcologyHost">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">' +
                "<strong>Pest, Predator &amp; Biocontrol Card</strong>" +
                (!_catalog.enriched ? '<span class="wcpp-bs-badge">Enriching...</span>' : "") +
            "</div>" +
            (bits.length ? '<div style="display:flex; flex-direction:column; gap:3px; font-size:0.8rem;">' + bits.map(function (b) { return "<div>" + b + "</div>"; }).join("") + "</div>" : '<div style="font-size:0.8rem;color:var(--bs-muted);">No specific pests or biocontrol targets flagged.</div>') +
            (bioLinks ? '<div class="wcpp-bs-bio-links" style="margin-top:8px;">' + bioLinks + "</div>" : "") +
        "</div>";
    }

    function renderModalCompanionStripHtml(crop) {
        const c = core();
        const suggestions = crop && typeof c.suggestInterplantCompanions === "function"
            ? c.suggestInterplantCompanions(crop, _catalog, 5)
            : [];
        const modeTag = function (m, pct) {
            if (m === "lanes") return "Lanes " + (pct || 50) + "%";
            if (m === "understory") return "Understory";
            if (m === "relay") return "Relay";
            return "Border";
        };
        const pills = suggestions.map(function (s) {
            const m = s.defaultMode || "border";
            const pct = s.defaultSharePct || 50;
            return '<button type="button" class="wcpp-bs-companion-pill-btn" data-action="add-companion-strip" data-crop="' + escHtml(s.cropName) + '" data-mode="' + escHtml(m) + '" data-share-pct="' + pct + '" title="' + escHtml(s.reasonText) + '">' +
                svgIcon("plus", 12) +
                "<span>Add " + escHtml(s.cropName) + " \u00b7 " + escHtml(modeTag(m, pct)) + "</span>" +
            "</button>";
        }).join("");

        return '<div class="wcpp-bs-companion-strip-box" id="wcppBsModalCompanionHost">' +
            "<strong>1-Click Interplant Companion Strips</strong>" +
            '<div style="font-size:0.77rem; color:var(--bs-muted); margin-top:2px;">Add an interplanted companion directly into this bed with suggested sharing mode (antagonists excluded).</div>' +
            '<div class="wcpp-bs-companion-pills">' + (pills || '<span style="font-size:0.78rem; color:var(--bs-muted);">No companion strip suggestions available yet.</span>') + "</div>" +
        "</div>";
    }

    function loadModalPlantPhoto(crop) {
        if (!crop || typeof global.resolveSharedPlantPhoto !== "function") return;
        const sci = crop.latin || "";
        const com = crop.name || "";
        const cacheKey = sci + "|" + com;
        if (_modalPhotoCache.has(cacheKey)) return;

        const reqId = ++_modalPhotoReqId;
        const fallback = getFallbackPlantSvgUrl(sci, com);
        global.resolveSharedPlantPhoto(sci, com, "", fallback).then(function (res) {
            if (!res || !res.url) return;
            _modalPhotoCache.set(cacheKey, res);
            if (_modalMode !== "planting" || _modalPhotoReqId !== reqId) return;
            const img = document.getElementById("wcppBsModalHeroImg");
            const srcBadge = document.getElementById("wcppBsModalPhotoSource");
            if (img) img.src = res.url;
            if (srcBadge && res.source) srcBadge.textContent = res.source;
        }).catch(function () {});
    }

    function renderInterplantSubPanelHtml(d, block) {
        const mode = getEffectiveMode(d);
        const isCustom = Boolean(block && block.shapeType === "custom");
        if (mode === "lanes") {
            const pct = Math.max(25, Math.min(75, Math.round(Number(d.interplantSharePct || 50))));
            return '<div class="wcpp-bs-interplant-panel">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">' +
                    "<strong>Alternating Lane Width Share</strong>" +
                    '<span class="wcpp-bs-badge" id="wcppBsLaneShareVal">' + pct + "% of bed width</span>" +
                "</div>" +
                '<input type="range" min="25" max="75" step="5" value="' + pct + '" data-draft="interplantSharePct" aria-label="Alternating lane width percentage">' +
                '<div style="font-size:0.76rem; color:var(--bs-muted);">Scales rows, plant count, seed weight, trays &amp; yield honestly to ' + pct + "% (co-crops share up to 100% bed width).</div>" +
            "</div>";
        }
        if (mode === "border") {
            return '<div class="wcpp-bs-interplant-panel">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    "<strong>Border Strip Placement</strong>" +
                    (!isCustom ? (
                        '<div class="wcpp-bs-segmented" role="group" aria-label="Border Edges">' +
                            '<button type="button" class="wcpp-bs-seg-btn' + (Number(d.borderSides) === 1 ? " is-active" : "") + '" data-action="set-border-sides" data-sides="1">1 Edge</button>' +
                            '<button type="button" class="wcpp-bs-seg-btn' + (Number(d.borderSides) !== 1 ? " is-active" : "") + '" data-action="set-border-sides" data-sides="2">2 Edges</button>' +
                        "</div>"
                    ) : '<span class="wcpp-bs-badge">Curved Perimeter</span>') +
                "</div>" +
                '<div style="font-size:0.76rem; color:var(--bs-muted);">' +
                    (isCustom
                        ? "Companion plants line the outer curved perimeter of this custom bed."
                        : "Plants sit along " + (Number(d.borderSides) === 1 ? "one outer bed edge" : "both outer bed edges") + " without displacing primary soil space.") +
                "</div>" +
            "</div>";
        }
        if (mode === "understory") {
            return '<div class="wcpp-bs-interplant-panel">' +
                "<strong>Understory / Living Mulch Layer</strong>" +
                '<div style="font-size:0.76rem; color:var(--bs-muted);">Grows beneath taller companion canopy (~85% effective area, staggered around primary stems).</div>' +
            "</div>";
        }
        if (mode === "relay") {
            return '<div class="wcpp-bs-interplant-panel">' +
                "<strong>Relay Catch-Crop Interplant</strong>" +
                '<div style="font-size:0.76rem; color:var(--bs-muted);">Tucked into inter-row alleys to harvest early before main crop canopy closure.</div>' +
            "</div>";
        }
        return '<div class="wcpp-bs-interplant-panel">' +
            "<strong>Full Bed Primary Crop</strong>" +
            '<div style="font-size:0.76rem; color:var(--bs-muted);">Occupies 100% of primary bed fraction. Switch mode above to share a bed via Lanes, Border, Understory, or Relay.</div>' +
        "</div>";
    }

    function renderSharedBedCompatCardHtml(d, block, ctx) {
        if (!d.blockId || !d.bedStart || !ctx) {
            return '<div class="wcpp-bs-shared-compat-card" id="wcppBsModalCompatHost">' +
                "<strong>Shared-Bed Compatibility Preview</strong>" +
                '<div style="color:var(--bs-muted);">Select a Target Block and Bed to inspect live width budget, Canopy &amp; Root stratification, and companion synergy.</div>' +
            "</div>";
        }
        const a = ctx.analysis;
        const elig = ctx.elig;
        const health = (!elig || !elig.eligible) ? "conflict" : ((a && a.healthStatus) || "thriving");
        const stateCls = health === "conflict" ? "is-conflict" : (health === "caution" ? "is-warn" : "is-ok");
        const healthLabel = health === "conflict" ? "Conflict" : (health === "caution" ? "Caution" : "Thriving");

        const badges = [];
        if (a) {
            badges.push('<span class="wcpp-bs-badge">' + a.widthBudgetPct + "% / 100% Width</span>");
            if (a.canopyFit) badges.push('<span class="wcpp-bs-badge">' + escHtml(a.canopyFit.label) + "</span>");
            if (a.rootFit) badges.push('<span class="wcpp-bs-badge">' + escHtml(a.rootFit.label) + "</span>");
            if (a.relayWindowCheck && a.relayWindowCheck.relayCount > 0) {
                badges.push('<span class="wcpp-bs-badge">' + escHtml(a.relayWindowCheck.label) + "</span>");
            }
        }

        const noteLines = [];
        if (elig && !elig.eligible) {
            noteLines.push("<div>" + svgIcon("alert", 11) + " <strong>" + escHtml(elig.message) + "</strong></div>");
        }
        if (a && Array.isArray(a.notes)) {
            a.notes.slice(0, 4).forEach(function (n) {
                noteLines.push("<div>\u2022 " + escHtml(n) + "</div>");
            });
        }

        return '<div class="wcpp-bs-shared-compat-card ' + stateCls + '" id="wcppBsModalCompatHost">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                "<strong>Shared-Bed Compatibility (" + escHtml((block && block.name) || d.blockId) + " \u00b7 Bed " + escHtml(d.bedStart) + ")</strong>" +
                '<span class="wcpp-bs-badge wcpp-bs-status-' + (health === "conflict" ? "conflict" : (health === "caution" ? "warn" : "ok")) + '">' + escHtml(healthLabel) + "</span>" +
            "</div>" +
            '<div style="display:flex; flex-wrap:wrap; gap:5px;">' + badges.join("") + "</div>" +
            (noteLines.length ? '<div style="display:flex; flex-direction:column; gap:3px; font-size:0.78rem;">' + noteLines.join("") + "</div>" : "") +
        "</div>";
    }

    function renderSowingGuideBoxHtml(d, crop, prof) {
        const isImp = _state && _state.units === "imperial";
        const rawDepth = crop && (crop.seedingDepthMm !== undefined && crop.seedingDepthMm !== null
            ? crop.seedingDepthMm
            : crop["Seeding Depth (mm)"]);
        const depthNum = Number.isFinite(Number(rawDepth)) && rawDepth !== "" && rawDepth !== null ? Number(rawDepth) : null;
        let depthText = isImp ? "0.4 in (standard)" : "10 mm (standard)";
        if (depthNum !== null) {
            if (depthNum <= 0) {
                depthText = "Surface sow (light needed)";
            } else {
                depthText = isImp
                    ? (Number((depthNum / 25.4).toFixed(depthNum < 10 ? 2 : 1)) + " in")
                    : (Number(depthNum.toFixed(1)) + " mm");
            }
        }
        const rawGerm = crop && (crop.germinationDays || crop["Days to Emergence @ 20\u00b0C"]);
        const germClean = rawGerm ? String(rawGerm).trim().replace(/\s*days?$/i, "") : "";
        const germText = germClean ? (germClean + " days") : "7\u201314 days";
        const isTransplant = d && d.method === "Transplant";
        const leadWks = isTransplant
            ? Math.max(0, Number(d.nurseryWeeksOverride ?? (crop && crop.nurseryWeeks) ?? 4))
            : 0;
        const leadText = isTransplant
            ? (leadWks > 0 ? (leadWks + " wks indoors before transplant") : "Direct transplant (0 wks)")
            : "Direct sow outdoors (0 wks indoors)";
        const rawPh = (prof && prof.phRange) || (crop && (crop.phRange || crop["pH"])) || "";
        const phText = rawPh
            ? String(rawPh).trim().replace(/(\d+)\.00\b/g, "$1.0").replace(/(\.\d)0\b/g, "$1").replace(/\s*[-–—]\s*/g, "\u2013")
            : "6.0\u20137.0";

        return '<div class="wcpp-bs-sowing-guide-box" id="wcppBsSowingGuideHost">' +
            "<strong>Sowing &amp; Germination Guide (" + escHtml((crop && crop.name) || (d && d.cropName) || "Crop") + ")</strong>" +
            '<div class="wcpp-bs-sowing-guide-grid">' +
                "<div><strong>Depth:</strong> " + escHtml(depthText) + "</div>" +
                "<div><strong>Emergence @ 20\u00b0C:</strong> " + escHtml(germText) + "</div>" +
                "<div><strong>Nursery Start Lead Time:</strong> " + escHtml(leadText) + "</div>" +
                "<div><strong>Soil pH Target:</strong> " + escHtml(phText) + "</div>" +
            "</div>" +
        "</div>";
    }

    function renderPlantingModalHtml() {
        const c = core();
        const season = c.getActiveSeason(_state);
        const blocks = (season && season.blocks) || [];
        const d = _plantingDraft;
        const crop = c.resolveCrop(_catalog.cropMap, d.cropName);
        const prof = crop && typeof c.getCropEcologyProfile === "function" ? c.getCropEcologyProfile(crop, _catalog) : null;
        const block = d.blockId ? blocks.find(function (b) { return b.id === d.blockId; }) : null;
        const isImp = _state.units === "imperial";
        const isCustomBlock = Boolean(block && block.shapeType === "custom");

        const ctx = buildDraftPreviewContext(d, crop, block);
        const dates = ctx.dates;
        const metrics = ctx.metrics;
        const cohorts = ctx.cohorts || [];

        const matches = _catalog.searchCrops(_cropSearchText, 30);
        const dropdownItems = matches.map(function (mc) {
            const sel = crop && mc.name === crop.name;
            return '<div class="wcpp-bs-crop-option' + (sel ? " is-selected" : "") + '" data-action="pick-crop" data-crop="' + escHtml(mc.name) + '">' +
                '<div><strong>' + escHtml(mc.name) + '</strong> <small style="color:var(--bs-muted);">' + escHtml(mc.family) + "</small></div>" +
                '<span class="wcpp-bs-badge">' + mc.dtmDays + "d \u00b7 " + escHtml(mc.method) + "</span>" +
            "</div>";
        }).join("");

        const isContBlock = isContainerBlock(block);
        const blockOpts = '<option value="">Planting Bench (Unplaced)</option>' + blocks.map(function (b) {
            const suffix = b.shapeType === "custom" ? "Custom Shape" : (isContainerBlock(b) ? getBlockTypeLabel(b) : (b.bedCount + " beds"));
            return '<option value="' + escHtml(b.id) + '"' + (d.blockId === b.id ? " selected" : "") + ">" + escHtml(b.name) + " (" + suffix + ")</option>";
        }).join("");

        const bedCountMax = block ? Math.max(1, block.bedCount || 1) : 12;
        let bedOpts = '<option value="">--</option>';
        for (let b = 1; b <= bedCountMax; b++) {
            const bedLbl = isCustomBlock ? "Custom Bed" : (isContBlock ? getBlockTypeLabel(block) : ("Bed " + b));
            bedOpts += '<option value="' + b + '"' + (Number(d.bedStart) === b ? " selected" : "") + ">" + bedLbl + "</option>";
        }

        const trayOpts = TRAY_CELL_OPTIONS.map(function (tc) {
            return '<option value="' + tc + '"' + (Number(d.trayCells) === tc ? " selected" : "") + ">" + tc + "-cell 1020</option>";
        }).join("");

        const sowingGuideBox = renderSowingGuideBoxHtml(d, crop, prof);

        const compatHtml = renderSharedBedCompatCardHtml(d, block, ctx);
        const curMode = getEffectiveMode(d);
        const modeButtons = [
            { id: "sole", label: "Full Bed" },
            { id: "lanes", label: "Alternating Lanes" },
            { id: "border", label: "Border Strip" },
            { id: "understory", label: "Understory" },
            { id: "relay", label: "Relay" }
        ].map(function (mObj) {
            const active = curMode === mObj.id;
            return '<button type="button" class="wcpp-bs-mode-btn' + (active ? " is-active" : "") + '" data-action="set-interplant-mode" data-mode="' + mObj.id + '" aria-pressed="' + (active ? "true" : "false") + '">' + escHtml(mObj.label) + "</button>";
        }).join("");

        const inRowDisp = isImp ? c.cmToIn(d.inRowCm) : d.inRowCm;
        const betRowDisp = isImp ? c.cmToIn(d.betweenRowCm) : d.betweenRowCm;

        return '<div class="wcpp-bs-modal is-wide">' +
            '<div class="wcpp-bs-modal-header">' +
                "<h2>" + (d.isEdit ? "Edit Planting" : "Add Planting") + " \u2014 " + escHtml(crop ? crop.name : d.cropName) + "</h2>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7 Close</button>' +
            "</div>" +
            '<div class="wcpp-bs-modal-body">' +
                renderModalHeroHtml(crop, prof) +
                '<div class="wcpp-bs-modal-split">' +
                    '<div style="display:flex; flex-direction:column; gap:12px;">' +
                        '<div class="wcpp-bs-field">' +
                            '<label id="wcppBsModalCropCountLabel">Search Crop (' + _catalog.crops.length + " Crops &amp; BC Natives)</label>" +
                            '<div class="wcpp-bs-crop-picker">' +
                                '<input type="text" class="wcpp-bs-crop-search" id="wcppModalCropSearch" value="' + escHtml(_cropSearchText) + '" placeholder="Search crop, family, Latin name..." autocomplete="off">' +
                                '<div class="wcpp-bs-crop-dropdown"' + (_cropDropdownOpen ? "" : " hidden") + ">" + dropdownItems + "</div>" +
                            "</div>" +
                            (crop && crop.isEstimatedDefault ? '<small style="color:var(--bs-muted);">Category-level agronomic spacing defaults applied (editable below).</small>' : "") +
                        "</div>" +
                        '<div class="wcpp-bs-form-grid">' +
                            '<div class="wcpp-bs-field"><label>Planting Label / Cultivar</label><input class="wcpp-bs-input" type="text" data-draft="label" value="' + escHtml(d.label) + '"></div>' +
                            '<div class="wcpp-bs-field"><label>Method</label><select class="wcpp-bs-select" data-draft="method"><option value="Direct Seed"' + (d.method === "Direct Seed" ? " selected" : "") + '>Direct Seed</option><option value="Transplant"' + (d.method === "Transplant" ? " selected" : "") + ">Transplant</option></select></div>" +
                            '<div class="wcpp-bs-field"><label>Target Block</label><select class="wcpp-bs-select" data-draft="blockId">' + blockOpts + "</select></div>" +
                            '<div class="wcpp-bs-field"><label>Bed</label><select class="wcpp-bs-select" data-draft="bedStart"' + (d.blockId ? "" : " disabled") + ">" + bedOpts + "</select></div>" +
                            '<div class="wcpp-bs-field"><label>Bed Fraction</label><input class="wcpp-bs-input" type="number" step="0.25" min="0.25" max="12" data-draft="bedCount" value="' + ((isCustomBlock || isContBlock) ? 1 : d.bedCount) + '"' + ((isCustomBlock || isContBlock) ? " disabled" : "") + "></div>" +
                        "</div>" +
                        '<div class="wcpp-bs-field">' +
                            "<label>Bed Sharing Mode (Interplanting)</label>" +
                            '<div class="wcpp-bs-mode-segmented" role="group" aria-label="Bed Sharing Mode">' + modeButtons + "</div>" +
                            renderInterplantSubPanelHtml(d, block) +
                        "</div>" +
                        '<div class="wcpp-bs-form-grid">' +
                            '<div class="wcpp-bs-field"><label>Field Start Date</label><input class="wcpp-bs-input" type="date" data-draft="startDate" value="' + escHtml(dates.startDate) + '"' + (d.lockHarvestDate ? " disabled" : "") + "></div>" +
                            '<div class="wcpp-bs-field"><label>Lock Harvest Date</label><label style="display:flex;align-items:center;gap:6px;height:36px;"><input type="checkbox" data-draft="lockHarvestDate"' + (d.lockHarvestDate ? " checked" : "") + "> Plan Backward</label></div>" +
                            '<div class="wcpp-bs-field"><label>Target Harvest Date</label><input class="wcpp-bs-input" type="date" data-draft="targetHarvestDate" value="' + escHtml(d.lockHarvestDate ? d.targetHarvestDate : dates.harvestStartDate) + '"' + (d.lockHarvestDate ? "" : " disabled") + "></div>" +
                            '<div class="wcpp-bs-field"><label>Base DTM (Days)</label><input class="wcpp-bs-input" type="number" min="7" max="365" data-draft="dtmDaysOverride" value="' + d.dtmDaysOverride + '"></div>' +
                        "</div>" +
                        '<div class="wcpp-bs-form-grid">' +
                            '<div class="wcpp-bs-field"><label>Rows / Bed</label><input class="wcpp-bs-input" type="number" min="1" max="12" data-draft="rowsPerBed" value="' + d.rowsPerBed + '"></div>' +
                            '<div class="wcpp-bs-field"><label>In-Row (' + (isImp ? "in" : "cm") + ')</label><input class="wcpp-bs-input" type="number" step="0.5" min="1" data-draft="inRowDisplay" value="' + inRowDisp + '"></div>' +
                            '<div class="wcpp-bs-field"><label>Between-Row (' + (isImp ? "in" : "cm") + ')</label><input class="wcpp-bs-input" type="number" step="0.5" min="2" data-draft="betweenRowDisplay" value="' + betRowDisp + '"></div>' +
                            '<div class="wcpp-bs-field"><label>Safety Margin %</label><input class="wcpp-bs-input" type="number" min="0" max="100" data-draft="safetyMarginPct" value="' + d.safetyMarginPct + '"></div>' +
                        "</div>" +
                        (d.method === "Transplant" ? (
                            '<div class="wcpp-bs-form-grid">' +
                                '<div class="wcpp-bs-field"><label>Nursery Weeks</label><input class="wcpp-bs-input" type="number" min="0" max="20" data-draft="nurseryWeeksOverride" value="' + d.nurseryWeeksOverride + '"></div>' +
                                '<div class="wcpp-bs-field"><label>Tray Size</label><select class="wcpp-bs-select" data-draft="trayCells">' + trayOpts + "</select></div>" +
                                '<div class="wcpp-bs-field"><label>Seeds / Cell</label><input class="wcpp-bs-input" type="number" min="1" max="10" data-draft="seedsPerCell" value="' + d.seedsPerCell + '"></div>' +
                                '<div class="wcpp-bs-field"><label>Potting Up</label><label style="display:flex;align-items:center;gap:6px;height:36px;"><input type="checkbox" data-draft="potUpEnabled"' + (d.potUpEnabled ? " checked" : "") + "> Pot Up (" + d.potCells + "c / " + d.potWeeks + "w)</label></div>" +
                            "</div>"
                        ) : "") +
                        '<div class="wcpp-bs-succession-box">' +
                            '<strong style="display:block; margin-bottom:6px;">Succession Generator</strong>' +
                            '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">' +
                                "<span>Create</span>" +
                                '<input class="wcpp-bs-input" style="width:70px;" type="number" min="1" max="12" data-draft="successionCount" value="' + d.successionCount + '">' +
                                "<span>successions every</span>" +
                                '<input class="wcpp-bs-input" style="width:76px;" type="number" min="3" max="90" data-draft="successionIntervalDays" value="' + d.successionIntervalDays + '">' +
                                "<span>days</span>" +
                                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="create-successions">Generate Successions</button>' +
                            "</div>" +
                        "</div>" +
                    "</div>" +
                    '<div style="display:flex; flex-direction:column; gap:12px;">' +
                        '<div class="wcpp-bs-cross-section-wrap" id="wcppBsCrossSectionHost">' +
                            renderCrossSectionSvg(d, crop, block, ctx) +
                            renderSharedBedLegendHtml(cohorts) +
                        "</div>" +
                        '<div class="wcpp-bs-math-grid" id="wcppBsMathGridHost">' +
                            renderModalMathGrid(dates, metrics) +
                        "</div>" +
                        sowingGuideBox +
                        compatHtml +
                        renderModalEcologyBoxHtml(crop, prof) +
                        renderModalCompanionStripHtml(crop) +
                    "</div>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-modal-footer">' +
                (d.isEdit ? '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger" data-action="delete-modal-planting" style="margin-right:auto;">Delete Planting</button>' : "") +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-secondary" data-action="close-modal">Cancel</button>' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary" data-action="save-planting">' + (d.isEdit ? "Save Changes" : "Add to Plan") + "</button>" +
            "</div>" +
        "</div>";
    }

    function renderModalMathGrid(dates, metrics) {
        const lenStr = core().formatLength(metrics.bedLengthUsedM, _state.units);
        return '<div class="wcpp-bs-math-cell"><strong>Bed Length</strong><div>' + escHtml(lenStr) + "</div></div>" +
            '<div class="wcpp-bs-math-cell"><strong>Plants (Margin)</strong><div>' + metrics.plants + " (" + metrics.plantsWithMargin + ")</div></div>" +
            '<div class="wcpp-bs-math-cell"><strong>Seeds / Weight</strong><div>' + metrics.seedsNeeded + " (" + metrics.seedGrams + " g)</div></div>" +
            '<div class="wcpp-bs-math-cell"><strong>Nursery Trays</strong><div>' + (metrics.method === "Transplant" ? metrics.nurseryTraysCeil + " \u00d7 " + metrics.trayCells + "c (" + metrics.benchM2 + " m\u00b2)" : "Direct Seed") + "</div></div>" +
            '<div class="wcpp-bs-math-cell"><strong>Schedule Window</strong><div>' + escHtml(dates.seedingDate) + " \u2192 " + escHtml(dates.harvestEndDate) + " (" + dates.effectiveDtm + "d)</div></div>" +
            '<div class="wcpp-bs-math-cell"><strong>Est. Yield / Value</strong><div>' + metrics.estYield + " " + escHtml(metrics.yieldUnit) + " ($" + metrics.estValueCad.toFixed(0) + ")</div></div>";
    }

    function renderConflictModalHtml() {
        const p = _conflictPayload;
        const list = (p && p.conflicts) || [];
        const rescueHtml = p && p.canInterplantRescue
            ? ('<div style="padding:10px 12px; border-radius:10px; background:var(--bs-bg); border:1px solid var(--bs-border-soft);">' +
                '<strong style="display:block; font-size:0.86rem; margin-bottom:4px;">1-Click Interplant Rescue (Co-Plant in Same Bed)</strong>' +
                '<div style="font-size:0.77rem; color:var(--bs-muted); margin-bottom:8px;">Instead of displacing the existing crop, share ' + escHtml(p.blockName) + " Bed " + p.targetBed + ":</div>" +
                '<div class="wcpp-bs-rescue-grid">' +
                    '<button type="button" class="wcpp-bs-rescue-btn" data-action="rescue-interplant" data-mode="lanes" data-share="50"><span>Alternating Lanes (50/50)</span><small style="font-weight:600; color:var(--bs-muted);">Split bed width 50/50</small></button>' +
                    '<button type="button" class="wcpp-bs-rescue-btn" data-action="rescue-interplant" data-mode="border" data-share="50"><span>Border Strip</span><small style="font-weight:600; color:var(--bs-muted);">Plant along outer bed edge</small></button>' +
                    '<button type="button" class="wcpp-bs-rescue-btn" data-action="rescue-interplant" data-mode="understory" data-share="50"><span>Understory</span><small style="font-weight:600; color:var(--bs-muted);">Grow beneath taller canopy</small></button>' +
                    '<button type="button" class="wcpp-bs-rescue-btn" data-action="rescue-interplant" data-mode="relay" data-share="50"><span>Relay Catch-Crop</span><small style="font-weight:600; color:var(--bs-muted);">Tuck into inter-row alleys</small></button>' +
                "</div>" +
               "</div>")
            : "";

        return '<div class="wcpp-bs-modal is-compact">' +
            '<div class="wcpp-bs-modal-header">' +
                "<h2>Bed Schedule Collision</h2>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7</button>' +
            "</div>" +
            '<div class="wcpp-bs-modal-body">' +
                '<p style="margin:0; font-size:0.9rem;">Placing <strong>' + escHtml(p.movedName) + "</strong> in <strong>" + escHtml(p.blockName) + " Bed " + p.targetBed + "</strong> overlaps with:</p>" +
                '<div class="wcpp-bs-entity-list">' +
                    list.map(function (cItem) {
                        return '<div class="wcpp-bs-entity-card"><strong>' + escHtml(cItem.label || cItem.cropName) + '</strong> <small style="color:var(--bs-muted);">' + escHtml(cItem.startDate) + " \u2192 " + escHtml(cItem.endDate || cItem.harvestEndDate || "") + " (" + cItem.bedCount + " bed)</small></div>";
                    }).join("") +
                "</div>" +
                rescueHtml +
                '<p style="margin:0; font-size:0.83rem; color:var(--bs-muted);">Or keep the moved planting here and move colliding planting(s) back to the Planting Bench.</p>' +
            "</div>" +
            '<div class="wcpp-bs-modal-footer">' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-secondary" data-action="close-modal">Cancel</button>' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger" data-action="resolve-conflict-keep">Keep moved &amp; unplace colliding</button>' +
            "</div>" +
        "</div>";
    }

    function renderRotationModalHtml() {
        const c = core();
        const season = c.getActiveSeason(_state);
        const block = season && (season.blocks || []).find(function (b) { return b.id === _rotationModalState.blockId; });
        if (!block) return "";
        const rows = [];
        for (let b = 1; b <= block.bedCount; b++) {
            const rot = c.getBedRotationHistory(_state, block.id, b, season.year, _catalog.cropMap);
            const histStr = rot.history.length
                ? rot.history.map(function (h) { return h.year + ": " + h.cropName + " (" + h.family + ")"; }).join(" \u2192 ")
                : "No prior plantings recorded";
            const statusHtml = rot.violations.length
                ? '<span class="wcpp-bs-badge wcpp-bs-status-conflict">' + svgIcon("alert", 11) + " " + escHtml(rot.violations[0].family + " (" + rot.violations[0].gapYears + "/" + rot.violations[0].rotationYears + " yr)") + "</span>"
                : '<span class="wcpp-bs-badge wcpp-bs-status-ok">\u2713 Compliant</span>';
            rows.push("<tr><td><strong>Bed " + b + "</strong></td><td>" + escHtml(histStr) + "</td><td>" + statusHtml + "</td></tr>");
        }

        return '<div class="wcpp-bs-modal">' +
            '<div class="wcpp-bs-modal-header">' +
                "<h2>Block Info &amp; Rotation History \u2014 " + escHtml(block.name) + "</h2>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7 Close</button>' +
            "</div>" +
            '<div class="wcpp-bs-modal-body">' +
                '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
                    '<span class="wcpp-bs-badge">' + escHtml(formatBedSizeSummary(block, _state.units)) + "</span>" +
                    '<span class="wcpp-bs-badge">Beginning Year: ' + (block.beginningYear || 2025) + "</span>" +
                    '<span class="wcpp-bs-badge">Angle: ' + (block.angleDeg || 0) + "\u00b0</span>" +
                "</div>" +
                '<div class="wcpp-bs-table-scroll">' +
                    '<table class="wcpp-bs-rotation-table">' +
                        "<thead><tr><th>Bed</th><th>Multi-Season Family History</th><th>Rotation Status</th></tr></thead>" +
                        "<tbody>" + rows.join("") + "</tbody>" +
                    "</table>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-modal-footer">' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary" data-action="close-modal">Done</button>' +
            "</div>" +
        "</div>";
    }

    function renderPlansModalHtml() {
        const c = core();
        const plans = typeof c.listSavedPlans === "function" ? c.listSavedPlans() : [];
        const presets = (_catalog && _catalog.starterPresets) || [];
        const presetOpts = '<option value="blank">Blank Farm (4-Bed Block)</option>' + presets.map(function (pr) {
            return '<option value="' + escHtml(pr.id) + '">' + escHtml(pr.name || pr.id) + "</option>";
        }).join("");

        const rowsHtml = plans.length ? plans.map(function (pl) {
            const isRenaming = _renamingPlanId === pl.id;
            const upd = pl.updatedAt ? formatClockHHMM(pl.updatedAt) : "";
            return '<div class="wcpp-bs-plan-row' + (pl.isActive ? " is-active" : "") + '">' +
                '<div class="wcpp-bs-plan-meta">' +
                    (isRenaming
                        ? '<div style="display:flex; gap:6px; align-items:center;"><input class="wcpp-bs-input" id="wcppPlanRenameInput" type="text" value="' + escHtml(pl.name) + '"><button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-xs" data-action="confirm-rename-plan" data-plan-id="' + escHtml(pl.id) + '">Save</button><button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="cancel-rename-plan">Cancel</button></div>'
                        : '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"><strong>' + escHtml(pl.name) + "</strong>" + (pl.isActive ? '<span class="wcpp-bs-badge wcpp-bs-status-ok">Active</span>' : "") + "</div>") +
                    '<div style="font-size:0.77rem; color:var(--bs-muted);">Season ' + pl.activeSeason + " \u00b7 " + pl.blockCount + " blocks \u00b7 " + pl.bedCount + " beds \u00b7 " + pl.plantingCount + " plantings" + (upd ? " \u00b7 Updated " + upd : "") + "</div>" +
                "</div>" +
                '<div class="wcpp-bs-plan-actions">' +
                    (!pl.isActive ? '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-xs" data-action="switch-plan" data-plan-id="' + escHtml(pl.id) + '">Switch</button>' : "") +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="start-rename-plan" data-plan-id="' + escHtml(pl.id) + '">Rename</button>' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="duplicate-plan" data-plan-id="' + escHtml(pl.id) + '">Duplicate</button>' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="copy-plan-link" data-plan-id="' + escHtml(pl.id) + '">' + svgIcon("link", 11) + "<span>Copy Link</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-action="delete-plan" data-plan-id="' + escHtml(pl.id) + '"' + (plans.length <= 1 ? " disabled" : "") + ">Delete</button>" +
                "</div>" +
            "</div>";
        }).join("") : '<p style="margin:0; font-size:0.84rem; color:var(--bs-muted);">No saved plans yet. Save your active plan below.</p>';

        return '<div class="wcpp-bs-modal">' +
            '<div class="wcpp-bs-modal-header">' +
                "<h2>Saved Garden Plans &amp; Shareable Links</h2>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7 Close</button>' +
            "</div>" +
            '<div class="wcpp-bs-modal-body">' +
                '<div class="wcpp-bs-plan-create-bar">' +
                    '<input type="text" class="wcpp-bs-input" id="wcppNewPlanNameInput" placeholder="Plan name (e.g. Back Yard 2026)..." style="flex:1 1 180px;">' +
                    '<select class="wcpp-bs-select" id="wcppNewPlanSourceSelect" aria-label="New Plan Template">' + presetOpts + "</select>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="create-plan">' + svgIcon("plus", 13) + "<span>New Plan</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="save-as-plan">' + svgIcon("copy", 13) + "<span>Save As Copy</span></button>" +
                "</div>" +
                '<div class="wcpp-bs-plans-list">' + rowsHtml + "</div>" +
            "</div>" +
            '<div class="wcpp-bs-modal-footer">' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-secondary" data-action="copy-share-link">' + svgIcon("link", 13) + "<span>Copy Active Shareable Link</span></button>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary" data-action="close-modal">Done</button>' +
            "</div>" +
        "</div>";
    }

    function clientToSvgCoords(svg, clientX, clientY, defaultVb) {
        if (!svg) return null;
        try {
            if (typeof svg.getScreenCTM === "function" && typeof svg.createSVGPoint === "function") {
                const ctm = svg.getScreenCTM();
                if (ctm) {
                    const pt = svg.createSVGPoint();
                    pt.x = clientX;
                    pt.y = clientY;
                    const local = pt.matrixTransform(ctm.inverse());
                    if (Number.isFinite(local.x) && Number.isFinite(local.y)) {
                        return { x: local.x, y: local.y };
                    }
                }
            }
        } catch (_) {}
        const rect = svg.getBoundingClientRect();
        const vb = (svg.getAttribute("viewBox") || defaultVb || "0 0 400 300").split(/\s+/).map(Number);
        if (!rect || rect.width <= 0 || rect.height <= 0 || vb.length !== 4 || !(vb[2] > 0) || !(vb[3] > 0)) return null;
        const scale = Math.min(rect.width / vb[2], rect.height / vb[3]);
        const drawW = vb[2] * scale;
        const drawH = vb[3] * scale;
        const offX = (rect.width - drawW) / 2;
        const offY = (rect.height - drawH) / 2;
        return {
            x: vb[0] + ((clientX - rect.left - offX) / drawW) * vb[2],
            y: vb[1] + ((clientY - rect.top - offY) / drawH) * vb[3]
        };
    }

    function renderModal() {
        const bd = document.getElementById("wcppBsModalBackdrop");
        if (!bd) return;
        if (!_modalMode) {
            closeModal();
            return;
        }
        const mods = getStudioModals();
        const ctx = getStudioModalCtx();
        if (_modalMode === "loading") {
            bd.innerHTML = renderLoadingModalHtml();
        } else if (_modalMode === "planting") {
            bd.innerHTML = renderPlantingModalHtml();
            const crop = core().resolveCrop(_catalog.cropMap, _plantingDraft && _plantingDraft.cropName);
            loadModalPlantPhoto(crop);
        } else if (_modalMode === "conflict") {
            bd.innerHTML = renderConflictModalHtml();
        } else if (_modalMode === "rotation") {
            bd.innerHTML = renderRotationModalHtml();
        } else if (_modalMode === "plans") {
            bd.innerHTML = renderPlansModalHtml();
        } else if (_modalMode === "shape" && mods) {
            const renderShape = mods.renderShapeModalHtml || mods.renderShapeDesignerModalHtml;
            bd.innerHTML = typeof renderShape === "function" ? renderShape(ctx) : "";
            if (typeof mods.attachShapeModalPointerEvents === "function") {
                mods.attachShapeModalPointerEvents(ctx, bd);
            }
        } else if (_modalMode === "container" && mods) {
            bd.innerHTML = typeof mods.renderContainerModalHtml === "function" ? mods.renderContainerModalHtml(ctx) : "";
        } else if (_modalMode === "playground" && mods) {
            bd.innerHTML = typeof mods.renderPlaygroundModalHtml === "function" ? mods.renderPlaygroundModalHtml(ctx) : "";
            if (typeof mods.attachPlaygroundPointerEvents === "function") {
                mods.attachPlaygroundPointerEvents(ctx, bd);
            }
        } else if (_modalMode === "blueprints" && mods) {
            bd.innerHTML = typeof mods.renderBlueprintsModalHtml === "function" ? mods.renderBlueprintsModalHtml(ctx) : "";
        } else if (isStudioModalMode(_modalMode)) {
            bd.innerHTML = renderLoadingModalHtml();
        }
        bd.hidden = false;
        bd.classList.add("is-open");
    }

    function refreshModalPreviewsOnly() {
        if (_modalMode !== "planting" || !_plantingDraft) return;
        const c = core();
        const season = c.getActiveSeason(_state);
        const blocks = (season && season.blocks) || [];
        const crop = c.resolveCrop(_catalog.cropMap, _plantingDraft.cropName);
        const block = _plantingDraft.blockId ? blocks.find(function (b) { return b.id === _plantingDraft.blockId; }) : null;
        const ctx = buildDraftPreviewContext(_plantingDraft, crop, block);
        const svgHost = document.getElementById("wcppBsCrossSectionHost");
        const mathHost = document.getElementById("wcppBsMathGridHost");
        const guideHost = document.getElementById("wcppBsSowingGuideHost");
        const compatHost = document.getElementById("wcppBsModalCompatHost");
        if (svgHost) {
            svgHost.innerHTML = renderCrossSectionSvg(_plantingDraft, crop, block, ctx) + renderSharedBedLegendHtml(ctx.cohorts);
        }
        if (mathHost) mathHost.innerHTML = renderModalMathGrid(ctx.dates, ctx.metrics);
        if (guideHost) {
            const prof = crop && typeof c.getCropEcologyProfile === "function" ? c.getCropEcologyProfile(crop, _catalog) : null;
            guideHost.outerHTML = renderSowingGuideBoxHtml(_plantingDraft, crop, prof);
        }
        if (compatHost) compatHost.outerHTML = renderSharedBedCompatCardHtml(_plantingDraft, block, ctx);
    }

    function refreshModalEnrichmentOnly() {
        if (_modalMode !== "planting" || !_plantingDraft || !_catalog) return;
        const c = core();
        const crop = c.resolveCrop(_catalog.cropMap, _plantingDraft.cropName);
        const prof = crop && typeof c.getCropEcologyProfile === "function" ? c.getCropEcologyProfile(crop, _catalog) : null;
        const countLbl = document.getElementById("wcppBsModalCropCountLabel");
        if (countLbl) countLbl.textContent = "Search Crop (" + _catalog.crops.length + " Crops & BC Natives)";

        const heroHost = document.getElementById("wcppBsModalHeroHost");
        if (heroHost && crop) {
            heroHost.outerHTML = renderModalHeroHtml(crop, prof);
            loadModalPlantPhoto(crop);
        }
        const guideHost = document.getElementById("wcppBsSowingGuideHost");
        if (guideHost && crop) {
            guideHost.outerHTML = renderSowingGuideBoxHtml(_plantingDraft, crop, prof);
        }
        const ecoHost = document.getElementById("wcppBsModalEcologyHost");
        if (ecoHost) ecoHost.outerHTML = renderModalEcologyBoxHtml(crop, prof);
        const compHost = document.getElementById("wcppBsModalCompanionHost");
        if (compHost) compHost.outerHTML = renderModalCompanionStripHtml(crop);
    }

    function buildPlantingFromDraft() {
        const d = _plantingDraft;
        const c = core();
        const crop = c.resolveCrop(_catalog.cropMap, d.cropName);
        const mode = getEffectiveMode(d);
        const sharePct = Math.max(15, Math.min(85, Math.round(Number(d.interplantSharePct || 50))));
        const obj = {
            id: d.id,
            cropName: crop ? crop.name : d.cropName,
            label: (d.label || "").trim() || (crop ? crop.name : d.cropName),
            blockId: d.blockId || null,
            bedStart: d.blockId && d.bedStart ? Number(d.bedStart) : null,
            bedCount: Math.max(0.1, Number(d.bedCount || 1)),
            startDate: d.startDate,
            lockHarvestDate: Boolean(d.lockHarvestDate),
            targetHarvestDate: d.lockHarvestDate ? d.targetHarvestDate : "",
            interplantMode: mode,
            interplanted: mode !== "sole",
            interplantSharePct: sharePct,
            borderSides: Number(d.borderSides) === 1 ? 1 : 2,
            interplantHostId: d.interplantHostId || null,
            laneIndex: d.laneIndex,
            method: d.method,
            rowsPerBed: Math.max(1, Number(d.rowsPerBed || 1)),
            inRowCm: Math.max(1, Number(d.inRowCm || 10)),
            betweenRowCm: Math.max(2, Number(d.betweenRowCm || 15)),
            dtmDaysOverride: Math.max(7, Number(d.dtmDaysOverride || 60)),
            nurseryWeeksOverride: d.method === "Transplant" ? Math.max(0, Number(d.nurseryWeeksOverride || 0)) : 0,
            trayCells: d.method === "Transplant" ? Math.max(1, Number(d.trayCells || 72)) : 0,
            seedsPerCell: Math.max(1, Number(d.seedsPerCell || 1)),
            safetyMarginPct: Math.max(0, Number(d.safetyMarginPct || 0)),
            pottingUp: (d.method === "Transplant" && d.potUpEnabled) ? { cells: Math.max(1, Number(d.potCells || 18)), weeks: Math.max(1, Number(d.potWeeks || 2)) } : null
        };
        if (d.harvestWindowOverride) obj.harvestWindowOverride = d.harvestWindowOverride;
        if (d.notes) obj.notes = d.notes;
        return obj;
    }

    function applyInterplantRescue(season, rescuedObj, conflicts, mode, sharePct) {
        const cleanMode = mode || "border";
        const pct = Math.max(25, Math.min(75, Math.round(Number(sharePct || 50))));
        rescuedObj.interplantMode = cleanMode;
        rescuedObj.interplanted = cleanMode !== "sole";
        rescuedObj.interplantSharePct = pct;
        if (cleanMode === "border") {
            rescuedObj.borderSides = rescuedObj.borderSides || 2;
        }
        if (cleanMode === "lanes") {
            const cIds = new Set((conflicts || []).map(function (x) { return x.id; }));
            let nextLane = 0;
            (season.plantings || []).forEach(function (item) {
                if (!cIds.has(item.id)) return;
                if (getEffectiveMode(item) === "sole") {
                    item.interplantMode = "lanes";
                    item.interplanted = true;
                    item.interplantSharePct = Math.max(25, Math.min(75, 100 - pct));
                    item.laneIndex = nextLane++;
                } else if (getEffectiveMode(item) === "lanes") {
                    if (item.laneIndex === undefined) item.laneIndex = nextLane++;
                    else nextLane = Math.max(nextLane, Number(item.laneIndex) + 1);
                }
            });
            rescuedObj.laneIndex = nextLane;
        }
    }

    function saveDraftPlanting(asSuccessions) {
        const c = core();
        const season = c.getActiveSeason(_state);
        if (!season || !_plantingDraft) return;
        const base = buildPlantingFromDraft();
        const crop = c.resolveCrop(_catalog.cropMap, base.cropName);
        const block = base.blockId ? (season.blocks || []).find(function (b) { return b.id === base.blockId; }) : null;

        if (asSuccessions) {
            const count = Math.max(1, Math.min(12, Math.round(Number(_plantingDraft.successionCount || 2))));
            const interval = Math.max(1, Math.round(Number(_plantingDraft.successionIntervalDays || 14)));
            const items = c.generateSuccessions(base, count, interval, crop, block, season.tunnels || [], _state.climateAdjusted !== false);
            commitStateChange(function () {
                const idx = season.plantings.findIndex(function (p) { return p.id === base.id; });
                if (idx >= 0) season.plantings.splice(idx, 1);
                items.forEach(function (it) {
                    if (it.blockId && it.bedStart) {
                        const elig = c.checkDropEligibility(it, it.blockId, it.bedStart, season, _catalog.cropMap, it.id);
                        if (!elig.eligible) {
                            it.blockId = null;
                            it.bedStart = null;
                        }
                    }
                    season.plantings.push(it);
                });
            });
            closeModal();
            showToast("Generated " + items.length + " succession plantings.");
            return;
        }

        if (base.blockId && base.bedStart) {
            const elig = c.checkDropEligibility(base, base.blockId, base.bedStart, season, _catalog.cropMap, _plantingDraft.isEdit ? base.id : undefined);
            if (!elig.eligible) {
                if (elig.reasonCode === "OCCUPIED" && elig.conflicts && elig.conflicts.length) {
                    const savedBase = base;
                    openConflictModal({
                        movedName: savedBase.label,
                        blockName: block ? block.name : savedBase.blockId,
                        targetBlockId: savedBase.blockId,
                        targetBed: savedBase.bedStart,
                        conflicts: elig.conflicts,
                        canInterplantRescue: Boolean(elig.canInterplantRescue),
                        onRescue: function (mode, sharePct) {
                            commitStateChange(function () {
                                applyInterplantRescue(season, savedBase, elig.conflicts, mode, sharePct);
                                const idx = season.plantings.findIndex(function (p) { return p.id === savedBase.id; });
                                if (idx >= 0) season.plantings[idx] = savedBase;
                                else season.plantings.push(savedBase);
                            });
                            _selectedPlantingId = savedBase.id;
                            closeModal();
                            showToast("Co-planted " + savedBase.label + " as " + getInterplantModeLabel(savedBase, true) + ".");
                        },
                        onResolve: function () {
                            commitStateChange(function () {
                                const cIds = new Set(elig.conflicts.map(function (x) { return x.id; }));
                                season.plantings.forEach(function (p) {
                                    if (cIds.has(p.id)) {
                                        p.blockId = null;
                                        p.bedStart = null;
                                    }
                                });
                                const idx = season.plantings.findIndex(function (p) { return p.id === savedBase.id; });
                                if (idx >= 0) season.plantings[idx] = savedBase;
                                else season.plantings.push(savedBase);
                            });
                            _selectedPlantingId = savedBase.id;
                            closeModal();
                            showToast("Saved planting & moved colliding item(s) to Planting Bench.");
                        }
                    });
                    return;
                }
                showToast(elig.message);
                return;
            }
        }

        commitStateChange(function () {
            const idx = season.plantings.findIndex(function (p) { return p.id === base.id; });
            if (idx >= 0) season.plantings[idx] = base;
            else season.plantings.push(base);
        });
        _selectedPlantingId = base.id;
        closeModal();
        showToast(_plantingDraft.isEdit ? "Updated planting." : "Added planting.");
    }

    function attemptDropOnCell(targetBlockId, targetBed, targetMonth) {
        if (!_dragState || !_state || !_catalog) return;
        const c = core();
        const season = c.getActiveSeason(_state);
        if (!season) return;
        const p = (season.plantings || []).find(function (x) { return x.id === _dragState.plantingId; });
        if (!p) return;

        const block = (season.blocks || []).find(function (b) { return b.id === targetBlockId; });
        const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
        const copy = JSON.parse(JSON.stringify(p));
        copy.blockId = targetBlockId;
        copy.bedStart = targetBed;

        const curMonth = p.startDate ? Number(p.startDate.slice(5, 7)) : 0;
        if (targetMonth && targetMonth !== curMonth) {
            const newStart = season.year + "-" + String(targetMonth).padStart(2, "0") + "-01";
            if (copy.lockHarvestDate && copy.targetHarvestDate && p.startDate) {
                const deltaDays = c.diffDaysIso(p.startDate, newStart);
                copy.targetHarvestDate = c.addDaysIso(copy.targetHarvestDate, deltaDays);
            } else {
                copy.startDate = newStart;
            }
            const d = c.computePlantingDates(copy, crop, block, season.tunnels || [], _state.climateAdjusted !== false);
            copy.startDate = d.startDate;
            copy.endDate = d.endDate;
        }

        const elig = c.checkDropEligibility(copy, targetBlockId, targetBed, season, _catalog.cropMap, p.id);
        if (!elig.eligible) {
            if (elig.reasonCode === "OCCUPIED" && elig.conflicts && elig.conflicts.length) {
                openConflictModal({
                    movedName: copy.label || copy.cropName,
                    blockName: block ? block.name : targetBlockId,
                    targetBlockId: targetBlockId,
                    targetBed: targetBed,
                    conflicts: elig.conflicts,
                    canInterplantRescue: Boolean(elig.canInterplantRescue),
                    onRescue: function (mode, sharePct) {
                        commitStateChange(function () {
                            applyInterplantRescue(season, copy, elig.conflicts, mode, sharePct);
                            Object.assign(p, copy);
                        });
                        _selectedPlantingId = p.id;
                        closeModal();
                        showToast("Co-planted " + (copy.label || copy.cropName) + " as " + getInterplantModeLabel(copy, true) + ".");
                    },
                    onResolve: function () {
                        commitStateChange(function () {
                            const cIds = new Set(elig.conflicts.map(function (x) { return x.id; }));
                            season.plantings.forEach(function (item) {
                                if (cIds.has(item.id)) {
                                    item.blockId = null;
                                    item.bedStart = null;
                                }
                            });
                            Object.assign(p, copy);
                        });
                        _selectedPlantingId = p.id;
                        closeModal();
                        showToast("Moved planting & moved colliding item(s) to Planting Bench.");
                    }
                });
                return;
            }
            showToast(elig.message);
            return;
        }

        commitStateChange(function () {
            Object.assign(p, copy);
        });
        _selectedPlantingId = p.id;
        showToast("Placed " + (copy.label || copy.cropName) + " on " + (block ? block.name : "") + " Bed " + targetBed + ".");
    }

    function nudgePlantingById(pid, deltaStart, deltaDur) {
        const c = core();
        const season = c.getActiveSeason(_state);
        if (!season) return;
        const p = (season.plantings || []).find(function (x) { return x.id === pid; });
        if (!p) return;
        const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
        const block = p.blockId ? (season.blocks || []).find(function (b) { return b.id === p.blockId; }) : null;
        let shiftedRes = null;
        commitStateChange(function () {
            shiftedRes = c.shiftPlantingDates(p, deltaStart, deltaDur, crop, block, season.tunnels || [], _state.climateAdjusted !== false);
        });
        _selectedPlantingId = pid;
        if (shiftedRes) {
            showToast("Updated " + (p.label || p.cropName) + ": " + formatShortDate(shiftedRes.startDate) + " \u2192 " + formatShortDate(shiftedRes.harvestEndDate) + " (" + shiftedRes.effectiveDtm + "d)");
        }
    }

    function createQuickSuccessionForId(pid) {
        const c = core();
        const season = c.getActiveSeason(_state);
        if (!season) return;
        const p = (season.plantings || []).find(function (x) { return x.id === pid; });
        if (!p) return;
        const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
        const block = p.blockId ? (season.blocks || []).find(function (b) { return b.id === p.blockId; }) : null;
        const list = c.generateSuccessions(p, 2, 14, crop, block, season.tunnels || [], _state.climateAdjusted !== false);
        const nextItem = list[1];
        if (!nextItem) return;
        if (nextItem.blockId && nextItem.bedStart) {
            const elig = c.checkDropEligibility(nextItem, nextItem.blockId, nextItem.bedStart, season, _catalog.cropMap, nextItem.id);
            if (!elig.eligible) {
                nextItem.blockId = null;
                nextItem.bedStart = null;
            }
        }
        commitStateChange(function () {
            season.plantings.push(nextItem);
        });
        _selectedPlantingId = nextItem.id;
        showToast("Created +14d succession: " + nextItem.label + (nextItem.blockId ? "" : " (on Planting Bench)"));
    }

    function addCompanionPlantingToSeason(cropName, opts) {
        const c = core();
        const season = c.getActiveSeason(_state);
        if (!season) return null;
        const crop = c.resolveCrop(_catalog.cropMap, cropName);
        if (!crop) return null;

        const options = opts || {};
        const blocks = season.blocks || [];
        let targetBlockId = options.blockId || null;
        let targetBed = options.bedStart ? Number(options.bedStart) : null;

        if (!targetBlockId && blocks.length) {
            const prefBlock = _ecologyBlockId ? blocks.find(function (b) { return b.id === _ecologyBlockId; }) : blocks[0];
            if (prefBlock) {
                targetBlockId = prefBlock.id;
                targetBed = 1;
            }
        }

        const frost = c.getFrostWindow(season.year);
        const defaultStart = crop.frostTolerance === "tender"
            ? c.addDaysIso(frost.lastSpringIso, 14)
            : (season.year + "-04-15");

        const compMode = options.interplantMode || "border";
        const compSharePct = Math.max(15, Math.min(85, Math.round(Number(options.interplantSharePct || 50))));

        const newPlanting = {
            id: "comp_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            cropName: crop.name,
            label: crop.name + (compMode === "lanes" ? " Lane" : " Strip"),
            blockId: targetBlockId,
            bedStart: targetBed,
            bedCount: options.bedCount || 1,
            startDate: options.startDate || defaultStart,
            lockHarvestDate: false,
            interplanted: compMode !== "sole",
            interplantMode: compMode,
            interplantSharePct: compSharePct,
            borderSides: Number(options.borderSides) === 1 ? 1 : 2,
            interplantHostId: options.interplantHostId || null,
            method: crop.method || "Direct Seed",
            rowsPerBed: Math.max(1, Number((crop && crop.rowsPerBed) || 1)),
            notes: options.notes || "Beneficial companion strip"
        };

        if (newPlanting.blockId && newPlanting.bedStart) {
            const elig = c.checkDropEligibility(newPlanting, newPlanting.blockId, newPlanting.bedStart, season, _catalog.cropMap);
            if (!elig.eligible) {
                // Prefer preferred/ecology block first, then scan any open bed, or fall back to Planting Bench
                const orderedBlocks = blocks.slice().sort(function (a, b) {
                    const aPref = (a.id === targetBlockId || (_ecologyBlockId && a.id === _ecologyBlockId)) ? 0 : 1;
                    const bPref = (b.id === targetBlockId || (_ecologyBlockId && b.id === _ecologyBlockId)) ? 0 : 1;
                    return aPref - bPref;
                });
                let placed = false;
                for (let bi = 0; bi < orderedBlocks.length && !placed; bi++) {
                    const blk = orderedBlocks[bi];
                    for (let bn = 1; bn <= (blk.bedCount || 1); bn++) {
                        const tryElig = c.checkDropEligibility(newPlanting, blk.id, bn, season, _catalog.cropMap);
                        if (tryElig.eligible) {
                            newPlanting.blockId = blk.id;
                            newPlanting.bedStart = bn;
                            placed = true;
                            break;
                        }
                    }
                }
                if (!placed) {
                    newPlanting.blockId = null;
                    newPlanting.bedStart = null;
                }
            }
        }

        commitStateChange(function () {
            season.plantings.push(newPlanting);
        });
        return newPlanting;
    }

    function bindRootEvents(root) {
        root.addEventListener("focusin", function (e) {
            const bar = e.target.closest(".wcpp-bs-bar");
            if (!bar || !_state || !_catalog) return;
            const pid = bar.getAttribute("data-planting-id");
            if (!pid || pid === _selectedPlantingId) return;
            _selectedPlantingId = pid;
            root.querySelectorAll(".wcpp-bs-bar.is-selected").forEach(function (el) {
                el.classList.remove("is-selected");
                const oldN = el.querySelector(".wcpp-bs-bar-nudges");
                if (oldN) oldN.remove();
            });
            bar.classList.add("is-selected");
            if (!bar.querySelector(".wcpp-bs-bar-nudges")) {
                bar.insertAdjacentHTML("beforeend", renderBarNudgesHtml(pid));
            }
            const nudgeHost = document.getElementById("wcppBsNudgeBarHost");
            if (nudgeHost) {
                nudgeHost.innerHTML = renderSelectedNudgeBarHtml(core().getActiveSeason(_state));
            }
        });

        root.addEventListener("click", function (e) {
            const subTabBtn = e.target.closest("[data-subtab]");
            if (subTabBtn) {
                _subTab = subTabBtn.getAttribute("data-subtab");
                syncPrefsCookie({ subTab: _subTab });
                renderSimulator();
                return;
            }

            const bar = e.target.closest(".wcpp-bs-bar");
            if (bar && !e.target.closest("button")) {
                const pid = bar.getAttribute("data-planting-id");
                _selectedPlantingId = pid;
                renderSimulator();
                openPlantingModal({ plantingId: pid });
                return;
            }

            const v6ActEl = e.target.closest("[data-v6-action]");
            if (v6ActEl) {
                const v6m = getV6Module();
                if (v6m && typeof v6m.handleClick === "function" && v6m.handleClick(getV6Ctx(), v6ActEl)) {
                    return;
                }
            }

            const actionEl = e.target.closest("[data-action]");
            if (!actionEl) return;
            const act = actionEl.getAttribute("data-action");
            const c = core();
            const season = c.getActiveSeason(_state);

            if (act === "toggle-fullscreen") {
                toggleFullscreen();
            } else if (act === "toggle-native-fullscreen") {
                toggleNativeFullscreen();
            } else if (act === "open-plans-modal") {
                openPlansModal();
            } else if (act === "copy-share-link") {
                const url = buildShareableUrlForState(_state);
                if (url) copyTextToClipboard(url, "Copied shareable #plan= link to clipboard.");
            } else if (act === "save-shared-copy") {
                const copyName = (_state.planName || "Shared Bed Plan") + " (Shared Copy)";
                c.saveNamedPlan(_state, copyName);
                _sharedPlanBanner = null;
                _previousLocalStateBackup = null;
                _lastSavedAt = Date.now();
                syncSavedTabDot();
                syncUrlForMode("simulator", { clearHash: true });
                renderSimulator();
                showToast("Saved copy: " + copyName);
            } else if (act === "dismiss-shared-plan") {
                _state = _previousLocalStateBackup
                    ? c.cloneState(_previousLocalStateBackup)
                    : c.loadState(_catalog.starterPresets, _catalog);
                rehydrateAllSeasons();
                _sharedPlanBanner = null;
                _previousLocalStateBackup = null;
                _optimizerPreview = null;
                syncUrlForMode("simulator", { clearHash: true });
                renderSimulator();
                showToast("Dismissed shared plan and restored local plan.");
            } else if (act === "cropmap-filter") {
                _cropMapFilter = actionEl.getAttribute("data-filter") || "all";
                syncPrefsCookie({ cropMapFilter: _cropMapFilter });
                renderSimulator();
            } else if (act === "set-timeline-zoom") {
                const z = actionEl.getAttribute("data-zoom") === "growing" ? "growing" : "full";
                _timelineZoom = z;
                syncPrefsCookie({ timelineZoom: _timelineZoom });
                renderSimulator();
            } else if (act === "dismiss-swipe-hint") {
                _swipeHintDismissed = true;
                syncPrefsCookie({ swipeHintDismissed: true });
                renderSimulator();
            } else if (act === "nudge-planting") {
                const pid = actionEl.getAttribute("data-planting-id");
                const dStart = Number(actionEl.getAttribute("data-delta-start") || 0);
                const dDur = Number(actionEl.getAttribute("data-delta-dur") || 0);
                nudgePlantingById(pid, dStart, dDur);
            } else if (act === "quick-succession") {
                createQuickSuccessionForId(actionEl.getAttribute("data-planting-id"));
            } else if (act === "select-bloom-month") {
                const mo = Number(actionEl.getAttribute("data-month"));
                _selectedBloomMonth = _selectedBloomMonth === mo ? null : mo;
                renderSimulator();
            } else if (act === "add-bloom-companion") {
                const cropName = actionEl.getAttribute("data-crop");
                const added = addCompanionPlantingToSeason(cropName, { notes: "Added to bridge Zone 8a pollinator gap" });
                if (added) {
                    showToast("Added " + added.cropName + (added.blockId ? " to bed map." : " to Planting Bench."));
                }
            } else if (act === "set-defense-filter") {
                const nextFilter = actionEl.getAttribute("data-defense-filter") || "all";
                _defenseFilter = nextFilter;
                renderSimulator();
            } else if (act === "clear-defense-pest") {
                _selectedDefensePest = "";
                renderSimulator();
            } else if (act === "select-defense-pest") {
                if (e.target.closest("a, button")) return;
                const pid = actionEl.getAttribute("data-pest-id") || "";
                _selectedDefensePest = _selectedDefensePest === pid ? "" : pid;
                renderSimulator();
            } else if (act === "add-defense-companion") {
                const cropName = actionEl.getAttribute("data-crop");
                const mode = actionEl.getAttribute("data-mode") || "border";
                const sharePct = Number(actionEl.getAttribute("data-share-pct") || 25);
                const hostNames = String(actionEl.getAttribute("data-host-crops") || "").split("|").filter(Boolean);
                const pestName = actionEl.getAttribute("data-pest-name") || "garden pests";
                let hostPlanting = null;
                if (season && Array.isArray(season.plantings)) {
                    hostPlanting = season.plantings.find(function (p) {
                        if (!p || !p.blockId || !p.bedStart) return false;
                        if (_ecologyBlockId && p.blockId !== _ecologyBlockId) return false;
                        return hostNames.indexOf(p.cropName) !== -1;
                    }) || season.plantings.find(function (p) {
                        return p && p.blockId && p.bedStart && (!_ecologyBlockId || p.blockId === _ecologyBlockId);
                    }) || null;
                }
                const added = addCompanionPlantingToSeason(cropName, {
                    blockId: hostPlanting ? hostPlanting.blockId : null,
                    bedStart: hostPlanting ? hostPlanting.bedStart : null,
                    interplantMode: mode,
                    interplantSharePct: sharePct,
                    interplantHostId: hostPlanting ? hostPlanting.id : null,
                    notes: "Added as " + mode + " defender against " + pestName
                });
                if (added) {
                    const nextEco = c.analyzeBedEcology(_state, _catalog, _ecologyBlockId || null);
                    const nextPct = nextEco && nextEco.pestDefense && nextEco.pestDefense.coverage
                        ? nextEco.pestDefense.coverage.coveragePct
                        : 0;
                    showToast("Planted " + added.cropName + " (" + getInterplantModeLabel(added, true) + ") \u2014 Defense now " + nextPct + "%.");
                }
            } else if (act === "duplicate-season") {
                const years = Object.keys(_state.seasons || {}).map(Number);
                const nextYear = (years.length ? Math.max.apply(null, years) : Number(_state.activeSeason || 2026)) + 1;
                commitStateChange(function () {
                    c.duplicateSeason(_state, _state.activeSeason, nextYear);
                });
                showToast("Duplicated into Season " + nextYear + " (prior history preserved).");
            } else if (act === "auto-rotate-season") {
                if (typeof c.autoRotateNextSeason !== "function") return;
                const years = Object.keys(_state.seasons || {}).map(Number);
                const fromYear = Number(_state.activeSeason || (years[0] || 2026));
                const nextYear = (years.length ? Math.max.apply(null, years) : fromYear) + 1;
                let rotateRes = null;
                commitStateChange(function () {
                    rotateRes = c.autoRotateNextSeason(_state, fromYear, nextYear, _catalog);
                    _state.activeSeason = nextYear;
                });
                const sum = rotateRes && rotateRes.summary ? rotateRes.summary : null;
                if (sum) {
                    showToast("Auto-rotated to Season " + nextYear + ": " + sum.rotatedCount + " shifted, " + sum.violationsBefore + " -> " + sum.violationsAfter + " rotation conflicts.");
                } else {
                    showToast("Auto-rotated into Season " + nextYear + ".");
                }
            } else if (act === "open-blueprints") {
                openBlueprintsGallery();
            } else if (act === "set-units") {
                const u = actionEl.getAttribute("data-units");
                syncPrefsCookie({ unitSystem: u });
                commitStateChange(function () { _state.units = u; }, { rehydrate: false });
            } else if (act === "toggle-climate") {
                commitStateChange(function () { _state.climateAdjusted = _state.climateAdjusted === false; });
            } else if (act === "undo") {
                if (c.canUndo(_state)) {
                    c.undo(_state);
                    rehydrateAllSeasons();
                    saveCurrentStateSafely();
                    _optimizerPreview = null;
                    renderSimulator();
                    showToast("Undid last change.");
                }
            } else if (act === "redo") {
                if (c.canRedo(_state)) {
                    c.redo(_state);
                    rehydrateAllSeasons();
                    saveCurrentStateSafely();
                    _optimizerPreview = null;
                    renderSimulator();
                    showToast("Redid change.");
                }
            } else if (act === "add-planting") {
                openPlantingModal({ blockId: actionEl.getAttribute("data-block-id") || "" });
            } else if (act === "edit-planting") {
                openPlantingModal({ plantingId: actionEl.getAttribute("data-planting-id") });
            } else if (act === "quick-assign") {
                const pid = actionEl.getAttribute("data-planting-id");
                const firstBlk = season && season.blocks && season.blocks[0];
                openPlantingModal({ plantingId: pid, blockId: firstBlk ? firstBlk.id : "", bedStart: 1 });
            } else if (act === "delete-planting") {
                const pid = actionEl.getAttribute("data-planting-id");
                commitStateChange(function () {
                    season.plantings = (season.plantings || []).filter(function (p) { return p.id !== pid; });
                }, { rehydrate: false });
            } else if (act === "import-garden") {
                importFromMyGardenPlan();
            } else if (act === "print") {
                global.print();
            } else if (act === "export-csv") {
                const csv = "\uFEFF" + c.exportScheduleCsv(_state, _catalog.cropMap);
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
                a.download = "wcpp-bed-designer-" + _state.activeSeason + ".csv";
                a.click();
            } else if (act === "export-media-csv") {
                if (typeof c.exportGrowingMediaCsv !== "function") return;
                const csvBody = c.exportGrowingMediaCsv(_state);
                if (!csvBody) {
                    showToast("No growing media mix data to export yet.");
                    return;
                }
                const csv = "\uFEFF" + csvBody;
                const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = "wcpp-growing-media-" + _state.activeSeason + ".csv";
                a.click();
                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
                showToast("Downloaded Growing Media CSV.");
            } else if (act === "export-tasks-ics") {
                if (typeof c.exportTasksToIcs !== "function") return;
                const icsBody = c.exportTasksToIcs(_state, _catalog.cropMap);
                if (!icsBody) {
                    showToast("No scheduled nursery or field tasks to export yet.");
                    return;
                }
                const icsUrl = URL.createObjectURL(new Blob([icsBody], { type: "text/calendar;charset=utf-8" }));
                const a = document.createElement("a");
                a.href = icsUrl;
                a.download = "wcpp-garden-schedule-" + (_state.activeSeason || 2026) + ".ics";
                a.click();
                setTimeout(function () { URL.revokeObjectURL(icsUrl); }, 1000);
                showToast("Downloaded " + a.download);
            } else if (act === "export-json") {
                const json = JSON.stringify(c.cloneState(_state), null, 2);
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                a.download = "wcpp-bed-designer-" + _state.activeSeason + ".json";
                a.click();
            } else if (act === "import-json") {
                const inp = document.getElementById("wcppBsImportJsonInput");
                if (inp) inp.click();
            } else if (act === "toggle-display") {
                const key = actionEl.getAttribute("data-key");
                commitStateChange(function () {
                    _state.displayOptions = _state.displayOptions || {};
                    _state.displayOptions[key] = !_state.displayOptions[key];
                }, { skipUndo: true, rehydrate: false });
            } else if (act === "block-rotation") {
                openRotationHistoryModal(actionEl.getAttribute("data-block-id"));
            } else if (act === "apply-std-bed") {
                const pr = c.STANDARD_BED_PRESETS.find(function (x) { return x.id === actionEl.getAttribute("data-std-id"); });
                if (pr) {
                    commitStateChange(function () {
                        _state.units = pr.units;
                        _state.farmDefaults = Object.assign({}, _state.farmDefaults, {
                            bedWidthCm: pr.bedWidthCm,
                            pathWidthCm: pr.pathWidthCm,
                            bedLengthM: pr.bedLengthM,
                            benchAreaM2: pr.benchAreaM2
                        });
                    }, { rehydrate: false });
                    showToast("Applied preset: " + pr.name);
                }
            } else if (act === "toggle-farm-layer") {
                const layer = actionEl.getAttribute("data-layer");
                _farmLayers[layer] = !_farmLayers[layer];
                renderSimulator();
            } else if (act === "toggle-farm-snap") {
                _farmSnapEnabled = !_farmSnapEnabled;
                renderSimulator();
            } else if (act === "select-farm-block") {
                if (_suppressFarmBlockClick) {
                    _suppressFarmBlockClick = false;
                    return;
                }
                _selectedBlockId = actionEl.getAttribute("data-block-id");
                _selectedStructureId = null;
                renderSimulator();
            } else if (act === "select-farm-structure") {
                if (_suppressFarmBlockClick) {
                    _suppressFarmBlockClick = false;
                    return;
                }
                _selectedStructureId = actionEl.getAttribute("data-structure-id");
                renderSimulator();
            } else if (act === "add-structure") {
                if (!season || typeof c.createShadeStructure !== "function") return;
                const presetId = actionEl.getAttribute("data-preset-id") || "fence";
                const existingCount = Array.isArray(season.structures) ? season.structures.length : 0;
                const ns = c.createShadeStructure(presetId, {
                    beginningYear: season.year,
                    x: (4 + (existingCount % 3) * 6) * 14,
                    y: (2 + Math.floor(existingCount / 3) * 5) * 14
                });
                if (ns) {
                    commitStateChange(function () {
                        if (!Array.isArray(season.structures)) season.structures = [];
                        season.structures.push(ns);
                        _selectedStructureId = ns.id;
                    }, { rehydrate: false });
                    showToast("Added shade structure: " + ns.name);
                }
            } else if (act === "delete-structure") {
                const sid = actionEl.getAttribute("data-structure-id");
                commitStateChange(function () {
                    season.structures = (season.structures || []).filter(function (s) { return s.id !== sid; });
                    if (_selectedStructureId === sid) _selectedStructureId = null;
                }, { rehydrate: false });
                showToast("Removed shade structure.");
            } else if (act === "toggle-shadow-overlay") {
                _shadowShow = !_shadowShow;
                renderSimulator();
            } else if (act === "set-farm-axis-unit") {
                const u = actionEl.getAttribute("data-unit");
                if (u === "ft" || u === "m" || u === "cm") {
                    _farmAxisUnit = u;
                    renderSimulator();
                }
            } else if (act === "use-my-gps") {
                if (!navigator.geolocation) {
                    showToast("GPS is not supported in this browser; using Coastal BC (49.2\u00b0N).");
                } else {
                    _gpsLoading = true;
                    renderSimulator();
                    navigator.geolocation.getCurrentPosition(function (pos) {
                        _gpsLoading = false;
                        _gpsLat = Number(pos.coords.latitude);
                        _gpsLon = Number(pos.coords.longitude);
                        const now = new Date();
                        _shadowMonth = Math.max(3, Math.min(10, now.getMonth() + 1));
                        _shadowDay = now.getDate();
                        _shadowHour = Math.max(7, Math.min(20, now.getHours()));
                        _gpsLabel = "My GPS (" + _gpsLat.toFixed(2) + "\u00b0" + (_gpsLat >= 0 ? "N" : "S") + ", " + Math.abs(_gpsLon).toFixed(2) + "\u00b0" + (_gpsLon >= 0 ? "E" : "W") + ")";
                        renderSimulator();
                        showToast("Sun peak updated for your GPS location.");
                    }, function () {
                        _gpsLoading = false;
                        renderSimulator();
                        showToast("Could not read GPS location; using Coastal BC (49.2\u00b0N).");
                    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
                }
            } else if (act === "set-shadow-month") {
                const mo = Math.max(3, Math.min(10, Number(actionEl.getAttribute("data-month")) || 6));
                if (_shadowMonth !== mo) {
                    _shadowMonth = mo;
                    renderSimulator();
                }
            } else if (act === "open-shape-designer") {
                openShapeDesigner();
            } else if (act === "open-container-modal") {
                openContainerModal({ blockType: actionEl.getAttribute("data-block-type") || "pot" });
            } else if (act === "edit-container-media") {
                openContainerModal({ blockId: actionEl.getAttribute("data-block-id") });
            } else if (act === "open-playground") {
                const bid = actionEl.getAttribute("data-block-id") || _selectedBlockId || (season && season.blocks && season.blocks[0] && season.blocks[0].id) || "";
                const bnum = Number(actionEl.getAttribute("data-bed-number") || 1);
                openBedPlayground(bid, bnum);
            } else if (act === "edit-block-shape") {
                openShapeDesigner({ blockId: actionEl.getAttribute("data-block-id") });
            } else if (act === "upload-farm-shape") {
                const inp = document.getElementById("wcppBsFarmShapeUploadInput");
                if (inp) inp.click();
            } else if (act === "add-saved-shape-to-garden") {
                const sid = actionEl.getAttribute("data-shape-id");
                const sh = (typeof c.listCustomShapes === "function" ? c.listCustomShapes() : []).find(function (x) { return x.id === sid; });
                if (sh && season) {
                    const count = (season.blocks || []).length;
                    const nb = c.createCustomShapeBlock(sh, {
                        beginningYear: season.year,
                        x: 40 + (count % 2) * 320,
                        y: 40 + Math.floor(count / 2) * 200
                    });
                    if (nb) {
                        commitStateChange(function () {
                            season.blocks.push(nb);
                            _selectedBlockId = nb.id;
                        }, { rehydrate: false });
                        showToast("Added custom bed to garden: " + nb.name);
                    }
                }
            } else if (act === "edit-saved-shape") {
                openShapeDesigner({ shapeId: actionEl.getAttribute("data-shape-id") });
            } else if (act === "download-saved-shape") {
                const sid = actionEl.getAttribute("data-shape-id");
                const sh = (typeof c.listCustomShapes === "function" ? c.listCustomShapes() : []).find(function (x) { return x.id === sid; });
                if (sh) {
                    const json = c.exportCustomShapeJson(sh);
                    const slug = (sh.name || "custom-bed").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-bed";
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                    a.download = slug + ".wcpp-shape.json";
                    a.click();
                }
            } else if (act === "delete-saved-shape") {
                const sid = actionEl.getAttribute("data-shape-id");
                if (c.deleteCustomShape(sid)) {
                    renderSimulator();
                    showToast("Removed shape from library.");
                }
            } else if (act === "add-block") {
                const bType = actionEl.getAttribute("data-block-type") === "greenhouse" ? "greenhouse" : "field";
                const fd = _state.farmDefaults || {};
                commitStateChange(function () {
                    const count = (season.blocks || []).length;
                    const nb = {
                        id: "blk_" + Date.now(),
                        name: (bType === "greenhouse" ? "Greenhouse " : "Field Block ") + (count + 1),
                        type: bType,
                        bedCount: bType === "greenhouse" ? 2 : 4,
                        bedLengthM: fd.bedLengthM || 30,
                        bedWidthCm: fd.bedWidthCm || 75,
                        pathWidthCm: fd.pathWidthCm || 30,
                        angleDeg: 0,
                        beginningYear: season.year,
                        isFallow: false,
                        x: 40 + (count % 2) * 320,
                        y: 40 + Math.floor(count / 2) * 200
                    };
                    season.blocks.push(nb);
                    _selectedBlockId = nb.id;
                }, { rehydrate: false });
            } else if (act === "delete-block") {
                const bid = actionEl.getAttribute("data-block-id");
                commitStateChange(function () {
                    season.blocks = season.blocks.filter(function (b) { return b.id !== bid; });
                    season.tunnels = season.tunnels.filter(function (t) { return t.blockId !== bid; });
                    season.placedPlants = (season.placedPlants || []).filter(function (pp) { return pp && pp.blockId !== bid; });
                    season.plantings.forEach(function (p) {
                        if (p.blockId === bid) { p.blockId = null; p.bedStart = null; }
                    });
                });
            } else if (act === "toggle-fallow") {
                const bid = actionEl.getAttribute("data-block-id");
                commitStateChange(function () {
                    const b = season.blocks.find(function (x) { return x.id === bid; });
                    if (b) b.isFallow = !b.isFallow;
                }, { rehydrate: false });
            } else if (act === "add-tunnel") {
                const name = (document.getElementById("wcppNewTunnelName") || {}).value || "Movable Tunnel";
                const type = (document.getElementById("wcppNewTunnelType") || {}).value || "Caterpillar";
                const blockId = (document.getElementById("wcppNewTunnelBlock") || {}).value;
                const startBed = Math.max(1, Number((document.getElementById("wcppNewTunnelStart") || {}).value || 1));
                const endBed = Math.max(startBed, Number((document.getElementById("wcppNewTunnelEnd") || {}).value || startBed));
                const disableNeighbors = Boolean((document.getElementById("wcppNewTunnelDisable") || {}).checked);
                if (!blockId) return;
                commitStateChange(function () {
                    season.tunnels.push({
                        id: "tun_" + Date.now(),
                        name: name,
                        type: type,
                        blockId: blockId,
                        startBed: startBed,
                        endBed: endBed,
                        disableNeighbors: disableNeighbors
                    });
                });
            } else if (act === "delete-tunnel") {
                const tid = actionEl.getAttribute("data-tunnel-id");
                commitStateChange(function () {
                    season.tunnels = season.tunnels.filter(function (t) { return t.id !== tid; });
                });
            } else if (act === "toggle-tunnel-neighbors") {
                const tid = actionEl.getAttribute("data-tunnel-id");
                commitStateChange(function () {
                    const t = season.tunnels.find(function (x) { return x.id === tid; });
                    if (t) t.disableNeighbors = !t.disableNeighbors;
                });
            } else if (act === "run-optimizer") {
                _optimizerPreview = c.optimizeCropMap(_state, _catalog.cropMap, 2500);
                renderSimulator();
                showToast("Tested " + _optimizerPreview.iterationsTested + " states in " + _optimizerPreview.elapsedMs + " ms.");
            } else if (act === "apply-optimized") {
                if (_optimizerPreview && _optimizerPreview.optimizedState) {
                    const next = _optimizerPreview.optimizedState;
                    commitStateChange(function () {
                        _state.seasons = next.seasons;
                    });
                    showToast("Applied auto-tuned bed plan.");
                }
            } else if (act === "discard-optimized") {
                _optimizerPreview = null;
                renderSimulator();
            } else if (act === "inspect-diag") {
                const pid = actionEl.getAttribute("data-planting-id");
                const bid = actionEl.getAttribute("data-block-id");
                if (bid) {
                    _subTab = "crop-map";
                    syncPrefsCookie({ subTab: _subTab });
                    renderSimulator();
                    const blkEl = root.querySelector('.wcpp-bs-block-card[data-block-id="' + bid + '"]');
                    if (blkEl && blkEl.scrollIntoView) blkEl.scrollIntoView({ behavior: "smooth", block: "center" });
                } else if (pid) {
                    openPlantingModal({ plantingId: pid });
                }
            } else if (act === "select-nursery-week") {
                _selectedNurseryWeek = Number(actionEl.getAttribute("data-week"));
                renderSimulator();
            } else if (act === "set-weather-mode") {
                const nextMode = actionEl.getAttribute("data-weather-mode") || "live";
                if (_weatherPreviewMode !== nextMode) {
                    _weatherPreviewMode = nextMode;
                    renderSimulator();
                }
            } else if (act === "set-stock-filter") {
                const sf = actionEl.getAttribute("data-stock-filter") === "wcpp" ? "wcpp" : "all";
                if (_stockFilterMode !== sf) {
                    _stockFilterMode = sf;
                    if (sf === "wcpp" && global.WCPPInventory && typeof global.WCPPInventory.isLoaded === "function" && !global.WCPPInventory.isLoaded() && typeof global.WCPPInventory.load === "function") {
                        global.WCPPInventory.load();
                    }
                    renderSimulator();
                }
            }
        });

        root.addEventListener("change", function (e) {
            const c = core();
            const season = c.getActiveSeason(_state);
            const t = e.target;
            if (t && t.hasAttribute && t.hasAttribute("data-v6-action")) {
                const v6m = getV6Module();
                if (v6m && typeof v6m.handleChange === "function" && v6m.handleChange(getV6Ctx(), t)) {
                    return;
                }
            }
            const act = t.getAttribute("data-action");

            if (act === "preset-change") {
                const pr = (_catalog.starterPresets || []).find(function (p) { return p.id === t.value; });
                if (pr) {
                    c.pushUndo(_state);
                    const fresh = c.createStateFromPreset(pr, _catalog);
                    fresh.undoStack = _state.undoStack;
                    fresh.redoStack = [];
                    fresh.planId = _state.planId;
                    fresh.planName = _state.planName || pr.name;
                    _state = fresh;
                    rehydrateAllSeasons();
                    saveCurrentStateSafely();
                    _optimizerPreview = null;
                    renderSimulator();
                    showToast("Loaded preset: " + pr.name);
                }
                return;
            }
            if (act === "season-change") {
                _state.activeSeason = Number(t.value);
                saveCurrentStateSafely();
                _optimizerPreview = null;
                renderSimulator();
                return;
            }
            if (act === "ecology-scope-change") {
                _ecologyBlockId = t.value || "";
                if (_ecologyBlockId) _stratTargetKey = _ecologyBlockId + ":1";
                renderSimulator();
                return;
            }
            if (act === "strat-bed-change") {
                _stratTargetKey = t.value || "";
                renderSimulator();
                return;
            }
            if (act === "toggle-task") {
                commitStateChange(function () {
                    c.toggleTaskCompleted(_state, t.getAttribute("data-task-id"));
                }, { rehydrate: false });
                return;
            }
            if (act === "filter-task-type") { _taskTypeFilter = t.value; renderSimulator(); return; }
            if (act === "filter-task-status") { _taskStatusFilter = t.value; renderSimulator(); return; }
            if (act === "filter-task-month") { _taskMonthFilter = t.value; renderSimulator(); return; }
            if (act === "shadow-month") {
                _shadowMonth = Math.max(3, Math.min(10, Number(t.value) || 6));
                renderSimulator();
                return;
            }

            if (t.id === "wcppBsImportJsonInput" && t.files && t.files[0]) {
                const reader = new FileReader();
                reader.onload = function () {
                    try {
                        const parsed = JSON.parse(String(reader.result || "{}"));
                        if (!parsed || !parsed.seasons) throw new Error("Invalid bed plan JSON");
                        c.pushUndo(_state);
                        const restored = c.cloneState(parsed);
                        restored.undoStack = _state.undoStack;
                        restored.redoStack = [];
                        restored.planId = _state.planId;
                        restored.planName = restored.planName || _state.planName;
                        _state = restored;
                        rehydrateAllSeasons();
                        saveCurrentStateSafely();
                        renderSimulator();
                        showToast("Imported bed plan JSON.");
                    } catch (err) {
                        showToast("Import failed: " + (err && err.message || "Invalid JSON"));
                    }
                };
                reader.readAsText(t.files[0]);
                return;
            }

            if (t.id === "wcppBsFarmShapeUploadInput" && t.files && t.files[0]) {
                const reader = new FileReader();
                reader.onload = function () {
                    const imported = typeof c.importCustomShapeJson === "function"
                        ? c.importCustomShapeJson(String(reader.result || ""))
                        : null;
                    if (!imported) {
                        showToast("Import failed: Invalid custom bed shape JSON.");
                        return;
                    }
                    const saved = c.saveCustomShape(imported);
                    renderSimulator();
                    showToast("Imported shape to library: " + (saved ? saved.name : imported.name));
                };
                reader.readAsText(t.files[0]);
                return;
            }

            const stdKey = t.getAttribute("data-std-input");
            if (stdKey) {
                const isImp = _state.units === "imperial";
                const v = Number(t.value);
                if (!Number.isFinite(v) || v <= 0) return;
                commitStateChange(function () {
                    const fd = _state.farmDefaults || {};
                    if (stdKey === "bedWidth") fd.bedWidthCm = isImp ? c.inToCm(v) : v;
                    else if (stdKey === "pathWidth") fd.pathWidthCm = isImp ? c.inToCm(v) : v;
                    else if (stdKey === "bedLength") fd.bedLengthM = isImp ? c.ftToM(v) : v;
                    else if (stdKey === "benchArea") fd.benchAreaM2 = isImp ? +(v / 10.7639).toFixed(2) : v;
                    _state.farmDefaults = fd;
                }, { rehydrate: false });
                return;
            }

            const bKey = t.getAttribute("data-block-edit");
            if (bKey && season) {
                const bid = t.getAttribute("data-block-id");
                const isImp = _state.units === "imperial";
                commitStateChange(function () {
                    const blk = season.blocks.find(function (b) { return b.id === bid; });
                    if (!blk) return;
                    if (bKey === "name") blk.name = t.value.trim() || blk.name;
                    else if (bKey === "bedCount") blk.bedCount = Math.max(1, Math.round(Number(t.value) || 1));
                    else if (bKey === "bedLength") blk.bedLengthM = Math.max(0.5, isImp ? c.ftToM(Number(t.value)) : Number(t.value));
                    else if (bKey === "bedWidth") blk.bedWidthCm = Math.max(20, isImp ? c.inToCm(Number(t.value)) : Number(t.value));
                    else if (bKey === "angleDeg") blk.angleDeg = ((Number(t.value) || 0) % 360 + 360) % 360;
                }, { rehydrate: false });
                return;
            }

            const sKey = t.getAttribute("data-structure-edit");
            if (sKey && season) {
                const sid = t.getAttribute("data-structure-id");
                const isImp = _state.units === "imperial";
                commitStateChange(function () {
                    const stObj = (season.structures || []).find(function (s) { return s.id === sid; });
                    if (!stObj) return;
                    if (sKey === "name") {
                        stObj.name = t.value.trim() || stObj.name;
                    } else if (sKey === "width") {
                        const rawW = Number(t.value);
                        if (Number.isFinite(rawW) && rawW > 0) stObj.widthM = Math.max(0.2, +(isImp ? c.ftToM(rawW) : rawW).toFixed(2));
                    } else if (sKey === "length") {
                        const rawL = Number(t.value);
                        if (Number.isFinite(rawL) && rawL > 0) stObj.lengthM = Math.max(0.2, +(isImp ? c.ftToM(rawL) : rawL).toFixed(2));
                    } else if (sKey === "height") {
                        const rawH = Number(t.value);
                        if (Number.isFinite(rawH) && rawH > 0) stObj.heightM = Math.max(0.2, +(isImp ? c.ftToM(rawH) : rawH).toFixed(2));
                    } else if (sKey === "angleDeg") {
                        stObj.angleDeg = ((Number(t.value) || 0) % 360 + 360) % 360;
                    }
                }, { rehydrate: false });
            }
        });

        root.addEventListener("input", function (e) {
            const act = e.target.getAttribute("data-action");
            if (act === "cropmap-search") {
                _cropMapSearch = e.target.value || "";
                refreshCropMapBodyOnly();
                return;
            }
            if (act === "sun-slider") {
                _sunOrientationDeg = Number(e.target.value) || 0;
                if (_state && _state.farmDefaults) _state.farmDefaults.sunOrientationDeg = _sunOrientationDeg;
                const wrap = root.querySelector(".wcpp-bs-farm-svg-wrap");
                const badge = e.target.parentElement && e.target.parentElement.querySelector(".wcpp-bs-badge");
                if (badge) badge.textContent = _sunOrientationDeg + "\u00b0";
                if (wrap) wrap.innerHTML = renderFarmMapWrapInnerHtml(core().getActiveSeason(_state));
                return;
            }
            if (act === "shadow-hour-slider") {
                const c = core();
                _shadowHour = Math.max(7, Math.min(20, Number(e.target.value) || 13));
                const solarPos = typeof c.computeSolarPosition === "function"
                    ? c.computeSolarPosition(_shadowMonth, _shadowHour, 49.19)
                    : { altitudeDeg: 50, azimuthDeg: 180 };
                const readout = document.getElementById("wcppBsShadowReadout");
                if (readout) {
                    readout.textContent = MONTHS[_shadowMonth - 1] + " \u00b7 " + formatHour12(_shadowHour) +
                        " \u00b7 Alt " + Math.round(solarPos.altitudeDeg) + "\u00b0 \u00b7 Az " + Math.round(solarPos.azimuthDeg) + "\u00b0";
                }
                const wrap = root.querySelector(".wcpp-bs-farm-svg-wrap");
                if (wrap) wrap.innerHTML = renderFarmMapWrapInnerHtml(c.getActiveSeason(_state));
            }
        });

        const STUDIO_PREFETCH_SELECTOR = '[data-action="open-shape-designer"],[data-action="edit-block-shape"],[data-action="edit-saved-shape"],[data-action="open-container-modal"],[data-action="edit-container-media"],[data-action="open-playground"],[data-action="open-blueprints"]';
        root.addEventListener("mouseover", function (e) {
            if (e.target && e.target.closest && e.target.closest(STUDIO_PREFETCH_SELECTOR)) {
                prefetchStudioModals();
            }
        });
        root.addEventListener("focusin", function (e) {
            if (e.target && e.target.closest && e.target.closest(STUDIO_PREFETCH_SELECTOR)) {
                prefetchStudioModals();
            }
        });

        function updateFarmDragHud(text) {
            const hud = document.getElementById("wcppBsFarmDragHud");
            if (!hud) return;
            if (!text) {
                hud.hidden = true;
                hud.textContent = "";
            } else {
                hud.hidden = false;
                hud.textContent = text;
            }
        }

        function releaseFarmPointerCapture(st) {
            try {
                if (st && st.svg && st.pointerId !== undefined && typeof st.svg.releasePointerCapture === "function") {
                    st.svg.releasePointerCapture(st.pointerId);
                }
            } catch (_) {}
        }

        function updateLiveStructureShadow(st) {
            if (!st || st.targetKind !== "structure" || !_shadowShow || !st.svg) return;
            const c = core();
            if (typeof c.computeCastShadowPolygons !== "function") return;
            const season = c.getActiveSeason(_state);
            const origStruct = season && (season.structures || []).find(function (s) { return s.id === st.targetId; });
            if (!origStruct) return;
            const previewStruct = Object.assign({}, origStruct, {
                x: +(st.curXM * 14).toFixed(2),
                y: +(st.curYM * 14).toFixed(2),
                angleDeg: st.curAngleDeg
            });
            const polys = c.computeCastShadowPolygons([previewStruct], (season && season.blocks) || [], _shadowMonth, _shadowHour, 49.19);
            const polyEl = Array.from(st.svg.querySelectorAll(".wcpp-bs-shadow-poly")).find(function (el) {
                return el.getAttribute("data-shadow-source") === st.targetId;
            });
            if (polyEl && polys && polys[0] && Array.isArray(polys[0].pointsM)) {
                const ptsStr = polys[0].pointsM.map(function (pt) {
                    return (st.offsetX + pt.x * st.pxPerM).toFixed(1) + "," + (st.offsetY + pt.y * st.pxPerM).toFixed(1);
                }).join(" ");
                polyEl.setAttribute("points", ptsStr);
            }
        }

        function handleFarmPointerMove(e) {
            const st = _farmDragState;
            if (!st) return;
            if (st.pointerId !== undefined && e.pointerId !== undefined && e.pointerId !== st.pointerId) return;
            const coords = clientToSvgCoords(st.svg, e.clientX, e.clientY, "0 0 820 500");
            if (!coords) return;
            const distClient = Math.hypot(e.clientX - st.startClientX, e.clientY - st.startClientY);
            if (!st.didMove && distClient < 4) return;
            st.didMove = true;
            if (st.blockEl) st.blockEl.classList.add("is-dragging");

            if (st.type === "rotate") {
                let rawDeg = (Math.atan2(coords.y - st.cy, coords.x - st.cx) * 180 / Math.PI) + 90;
                rawDeg = ((rawDeg % 360) + 360) % 360;
                let angleDeg = e.shiftKey ? Math.round(rawDeg) : (Math.round(rawDeg / 5) * 5);
                angleDeg = ((angleDeg % 360) + 360) % 360;
                st.curAngleDeg = angleDeg;
                if (st.blockEl) {
                    st.blockEl.setAttribute("transform", "rotate(" + angleDeg + " " + st.cx.toFixed(1) + " " + st.cy.toFixed(1) + ")");
                    if (st.targetKind === "structure") {
                        const sLbl = st.blockEl.querySelector("[data-farm-structure-label]");
                        if (sLbl) sLbl.textContent = st.itemName + " (" + st.heightDisp + ", " + angleDeg + "\u00b0)";
                    } else {
                        const lbl = st.blockEl.querySelector("[data-farm-block-label]");
                        if (lbl) lbl.textContent = st.itemName + " (" + angleDeg + "\u00b0)";
                    }
                }
                if (st.targetKind === "structure") updateLiveStructureShadow(st);
                updateFarmDragHud('Rotating "' + st.itemName + '" \u00b7 ' + angleDeg + "\u00b0" + (e.shiftKey ? " (Free)" : ""));
                return;
            }

            const deltaXM = (coords.x - st.startSvgX) / st.pxPerM;
            const deltaYM = (coords.y - st.startSvgY) / st.pxPerM;
            const rawXM = st.origXM + deltaXM;
            const rawYM = st.origYM + deltaYM;
            const isImp = _state && _state.units === "imperial";
            let newXM = rawXM;
            let newYM = rawYM;
            let hudCoords = "";

            if (_farmSnapEnabled) {
                if (isImp) {
                    const xFt = Math.round(rawXM / 0.3048);
                    const yFt = Math.round(rawYM / 0.3048);
                    newXM = +(xFt * 0.3048).toFixed(4);
                    newYM = +(yFt * 0.3048).toFixed(4);
                    hudCoords = "X: " + xFt + " ft, Y: " + yFt + " ft";
                } else {
                    newXM = +(Math.round(rawXM / 0.5) * 0.5).toFixed(2);
                    newYM = +(Math.round(rawYM / 0.5) * 0.5).toFixed(2);
                    hudCoords = "X: " + newXM.toFixed(1) + " m, Y: " + newYM.toFixed(1) + " m";
                }
            } else {
                newXM = +rawXM.toFixed(2);
                newYM = +rawYM.toFixed(2);
                hudCoords = isImp
                    ? ("X: " + (newXM / 0.3048).toFixed(1) + " ft, Y: " + (newYM / 0.3048).toFixed(1) + " ft")
                    : ("X: " + newXM.toFixed(2) + " m, Y: " + newYM.toFixed(2) + " m");
            }

            st.curXM = newXM;
            st.curYM = newYM;
            const dxSvg = (newXM - st.origXM) * st.pxPerM;
            const dySvg = (newYM - st.origYM) * st.pxPerM;
            if (st.blockEl) {
                st.blockEl.setAttribute(
                    "transform",
                    "translate(" + dxSvg.toFixed(2) + " " + dySvg.toFixed(2) + ") rotate(" + st.origAngleDeg + " " + st.cx.toFixed(1) + " " + st.cy.toFixed(1) + ")"
                );
            }
            if (st.targetKind === "structure") updateLiveStructureShadow(st);
            updateFarmDragHud('Moving "' + st.itemName + '" \u00b7 ' + hudCoords);
        }

        function finishFarmPointer(e, isCancel) {
            const st = _farmDragState;
            if (!st) return;
            if (e && st.pointerId !== undefined && e.pointerId !== undefined && e.pointerId !== st.pointerId) return;
            _farmDragState = null;
            releaseFarmPointerCapture(st);
            updateFarmDragHud("");
            if (st.blockEl) st.blockEl.classList.remove("is-dragging");

            if (isCancel) {
                st.curXM = st.origXM;
                st.curYM = st.origYM;
                st.curAngleDeg = st.origAngleDeg;
                if (st.blockEl) {
                    st.blockEl.setAttribute("transform", "rotate(" + st.origAngleDeg + " " + st.cx.toFixed(1) + " " + st.cy.toFixed(1) + ")");
                    if (st.targetKind === "structure") {
                        const sLbl = st.blockEl.querySelector("[data-farm-structure-label]");
                        if (sLbl) sLbl.textContent = st.itemName + " (" + st.heightDisp + ", " + st.origAngleDeg + "\u00b0)";
                    } else {
                        const lbl = st.blockEl.querySelector("[data-farm-block-label]");
                        if (lbl) lbl.textContent = st.itemName + " (" + st.origAngleDeg + "\u00b0)";
                    }
                }
                if (st.targetKind === "structure") updateLiveStructureShadow(st);
                return;
            }

            _suppressFarmBlockClick = true;
            setTimeout(function () { _suppressFarmBlockClick = false; }, 0);

            if (!st.didMove) {
                if (st.targetKind === "structure") {
                    if (_selectedStructureId !== st.targetId) {
                        _selectedStructureId = st.targetId;
                        renderSimulator();
                    }
                } else {
                    if (_selectedBlockId !== st.targetId || _selectedStructureId) {
                        _selectedBlockId = st.targetId;
                        _selectedStructureId = null;
                        renderSimulator();
                    }
                }
                return;
            }

            if (st.targetKind === "structure") {
                _selectedStructureId = st.targetId;
                if (st.type === "rotate") {
                    commitStateChange(function (stateObj) {
                        const s = core().getActiveSeason(stateObj);
                        const stObj = s && (s.structures || []).find(function (x) { return x.id === st.targetId; });
                        if (stObj) stObj.angleDeg = st.curAngleDeg;
                    }, { rehydrate: false });
                    showToast('Rotated "' + st.itemName + '" to ' + st.curAngleDeg + "\u00b0.");
                } else {
                    commitStateChange(function (stateObj) {
                        const s = core().getActiveSeason(stateObj);
                        const stObj = s && (s.structures || []).find(function (x) { return x.id === st.targetId; });
                        if (stObj) {
                            stObj.x = +(st.curXM * 14).toFixed(2);
                            stObj.y = +(st.curYM * 14).toFixed(2);
                        }
                    }, { rehydrate: false });
                }
                return;
            }

            _selectedBlockId = st.targetId;
            _selectedStructureId = null;
            if (st.type === "rotate") {
                commitStateChange(function (stateObj) {
                    const s = core().getActiveSeason(stateObj);
                    const blk = s && (s.blocks || []).find(function (b) { return b.id === st.targetId; });
                    if (blk) blk.angleDeg = st.curAngleDeg;
                }, { rehydrate: false });
                showToast('Rotated "' + st.itemName + '" to ' + st.curAngleDeg + "\u00b0.");
            } else {
                commitStateChange(function (stateObj) {
                    const s = core().getActiveSeason(stateObj);
                    const blk = s && (s.blocks || []).find(function (b) { return b.id === st.targetId; });
                    if (blk) {
                        blk.x = +(st.curXM * 14).toFixed(2);
                        blk.y = +(st.curYM * 14).toFixed(2);
                    }
                }, { rehydrate: false });
            }
        }

        root.addEventListener("pointerdown", function (e) {
            if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
            const svg = e.target.closest("#wcppBsFarmMapSvg");
            if (!svg || !_state || !_catalog) return;
            const rotStructEl = e.target.closest("[data-farm-rotate-structure]");
            const dragStructEl = e.target.closest("[data-farm-drag-structure]");
            const rotEl = e.target.closest("[data-farm-rotate-block]");
            const dragEl = e.target.closest("[data-farm-drag-block]");
            const isStruct = Boolean(rotStructEl || dragStructEl);
            if (!isStruct && !rotEl && !dragEl) return;

            const c = core();
            const season = c.getActiveSeason(_state);
            const targetId = isStruct
                ? (rotStructEl ? rotStructEl.getAttribute("data-farm-rotate-structure") : dragStructEl.getAttribute("data-farm-drag-structure"))
                : (rotEl ? rotEl.getAttribute("data-farm-rotate-block") : dragEl.getAttribute("data-farm-drag-block"));

            let targetObj = null;
            let targetEl = null;
            if (isStruct) {
                targetEl = dragStructEl || Array.from(svg.querySelectorAll(".wcpp-bs-farm-structure")).find(function (el) {
                    return el.getAttribute("data-farm-drag-structure") === targetId;
                });
                targetObj = season && (season.structures || []).find(function (s) { return s.id === targetId; });
            } else {
                targetEl = dragEl || Array.from(svg.querySelectorAll(".wcpp-bs-farm-block")).find(function (el) {
                    return el.getAttribute("data-farm-drag-block") === targetId;
                });
                targetObj = season && (season.blocks || []).find(function (b) { return b.id === targetId; });
            }
            if (!targetObj || !targetEl) return;

            const startSvg = clientToSvgCoords(svg, e.clientX, e.clientY, "0 0 820 500");
            if (!startSvg) return;

            const pxPerM = Math.max(0.01, Number(svg.getAttribute("data-px-per-m") || 10));
            const offsetX = Number(svg.getAttribute("data-offset-x") || 0);
            const offsetY = Number(svg.getAttribute("data-offset-y") || 0);
            const origXM = Number(targetEl.getAttribute("data-orig-x-m") || 0);
            const origYM = Number(targetEl.getAttribute("data-orig-y-m") || 0);
            const cx = Number(targetEl.getAttribute("data-cx") || 0);
            const cy = Number(targetEl.getAttribute("data-cy") || 0);
            const origAngleDeg = Number(targetEl.getAttribute("data-angle") || targetObj.angleDeg || 0);
            const isImp = _state && _state.units === "imperial";
            const heightDisp = isStruct
                ? (isImp ? (c.mToFt(targetObj.heightM || 1.8) + " ft") : (Number(targetObj.heightM || 1.8).toFixed(1).replace(/\.0$/, "") + " m"))
                : "";

            _farmDragState = {
                targetKind: isStruct ? "structure" : "block",
                type: (rotStructEl || rotEl) ? "rotate" : "move",
                targetId: targetId,
                blockId: targetId,
                blockEl: targetEl,
                svg: svg,
                pointerId: e.pointerId,
                startClientX: e.clientX,
                startClientY: e.clientY,
                startSvgX: startSvg.x,
                startSvgY: startSvg.y,
                didMove: false,
                pxPerM: pxPerM,
                offsetX: offsetX,
                offsetY: offsetY,
                origXM: origXM,
                origYM: origYM,
                curXM: origXM,
                curYM: origYM,
                cx: cx,
                cy: cy,
                origAngleDeg: origAngleDeg,
                curAngleDeg: origAngleDeg,
                itemName: targetObj.name || (isStruct ? "Structure" : "Block"),
                heightDisp: heightDisp
            };
            e.preventDefault();
            try { svg.setPointerCapture(e.pointerId); } catch (_) {}
        });

        if (!_docFarmPointerBound) {
            _docFarmPointerBound = true;
            document.addEventListener("pointermove", handleFarmPointerMove);
            document.addEventListener("pointerup", function (e) { finishFarmPointer(e, false); });
            document.addEventListener("pointercancel", function (e) { finishFarmPointer(e, true); });
            global.addEventListener("blur", function () { finishFarmPointer(null, true); });
        }

        root.addEventListener("keydown", function (e) {
            if (e.key !== "Enter" && e.key !== " ") return;
            const pestCard = e.target.closest('.wcpp-bs-defense-card[data-action="select-defense-pest"]');
            if (!pestCard || e.target.closest("a, button")) return;
            e.preventDefault();
            const pid = pestCard.getAttribute("data-pest-id") || "";
            _selectedDefensePest = _selectedDefensePest === pid ? "" : pid;
            renderSimulator();
        });

        root.addEventListener("dragstart", function (e) {
            const item = e.target.closest("[data-planting-id]");
            if (!item || (!item.classList.contains("wcpp-bs-bar") && !item.classList.contains("wcpp-bs-unassigned-card"))) return;
            const pid = item.getAttribute("data-planting-id");
            _dragState = { plantingId: pid };
            item.classList.add("is-dragging");
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", pid);
            }
        });

        root.addEventListener("dragend", function () {
            _dragState = null;
            root.querySelectorAll(".is-dragging").forEach(function (el) { el.classList.remove("is-dragging"); });
            root.querySelectorAll(".is-drop-valid, .is-drop-invalid, .is-drop-target").forEach(function (el) {
                el.classList.remove("is-drop-valid", "is-drop-invalid", "is-drop-target");
            });
        });

        root.addEventListener("dragover", function (e) {
            if (!_dragState) return;
            const cell = e.target.closest("[data-drop-bed]");
            const tray = e.target.closest("[data-drop-tray]");
            if (!cell && !tray) return;
            e.preventDefault();

            if (tray) {
                tray.classList.add("is-drop-target");
                return;
            }

            const blockId = cell.getAttribute("data-drop-block");
            const bed = Number(cell.getAttribute("data-drop-bed"));
            const c = core();
            const season = c.getActiveSeason(_state);
            const p = season && (season.plantings || []).find(function (x) { return x.id === _dragState.plantingId; });
            if (!p) return;
            const elig = c.checkDropEligibility(p, blockId, bed, season, _catalog.cropMap, p.id);
            const validOrConflict = elig.eligible || elig.reasonCode === "OCCUPIED";
            cell.classList.toggle("is-drop-valid", validOrConflict);
            cell.classList.toggle("is-drop-invalid", !validOrConflict);
        });

        root.addEventListener("dragleave", function (e) {
            const cell = e.target.closest("[data-drop-bed]");
            if (cell) cell.classList.remove("is-drop-valid", "is-drop-invalid");
            const tray = e.target.closest("[data-drop-tray]");
            if (tray && !tray.contains(e.relatedTarget)) tray.classList.remove("is-drop-target");
        });

        root.addEventListener("drop", function (e) {
            if (!_dragState) return;
            const cell = e.target.closest("[data-drop-bed]");
            const tray = e.target.closest("[data-drop-tray]");
            if (!cell && !tray) return;
            e.preventDefault();

            if (tray) {
                const c = core();
                const season = c.getActiveSeason(_state);
                const p = season && (season.plantings || []).find(function (x) { return x.id === _dragState.plantingId; });
                if (p && p.blockId) {
                    commitStateChange(function () {
                        p.blockId = null;
                        p.bedStart = null;
                    });
                    showToast("Moved " + (p.label || p.cropName) + " to Planting Bench.");
                }
                return;
            }

            const blockId = cell.getAttribute("data-drop-block");
            const bed = Number(cell.getAttribute("data-drop-bed"));
            const month = Number(cell.getAttribute("data-drop-month"));
            attemptDropOnCell(blockId, bed, month);
        });
    }

    function bindModalEvents(backdrop) {
        backdrop.addEventListener("click", function (e) {
            if (e.target === backdrop) {
                closeModal();
                return;
            }
            if (isStudioModalMode(_modalMode)) {
                const mods = getStudioModals();
                if (mods && typeof mods.handleModalClick === "function" && mods.handleModalClick(getStudioModalCtx(), _modalMode, e, backdrop)) {
                    return;
                }
            }
            if (!e.target.closest(".wcpp-bs-crop-picker")) {
                if (_cropDropdownOpen) {
                    _cropDropdownOpen = false;
                    const dd = backdrop.querySelector(".wcpp-bs-crop-dropdown");
                    if (dd) dd.hidden = true;
                }
            }
            const actEl = e.target.closest("[data-action]");
            if (!actEl) return;
            const act = actEl.getAttribute("data-action");
            const c = core();

            if (act === "close-modal") {
                closeModal();
            } else if (act === "save-planting") {
                saveDraftPlanting(false);
            } else if (act === "create-successions") {
                saveDraftPlanting(true);
            } else if (act === "delete-modal-planting" && _plantingDraft) {
                const season = c.getActiveSeason(_state);
                const id = _plantingDraft.id;
                commitStateChange(function () {
                    season.plantings = season.plantings.filter(function (p) { return p.id !== id; });
                }, { rehydrate: false });
                closeModal();
                showToast("Deleted planting.");
            } else if (act === "resolve-conflict-keep" && _conflictPayload && typeof _conflictPayload.onResolve === "function") {
                _conflictPayload.onResolve();
            } else if (act === "rescue-interplant" && _conflictPayload && typeof _conflictPayload.onRescue === "function") {
                _conflictPayload.onRescue(actEl.getAttribute("data-mode"), Number(actEl.getAttribute("data-share") || 50));
            } else if (act === "set-interplant-mode" && _plantingDraft) {
                const mode = actEl.getAttribute("data-mode") || "sole";
                _plantingDraft.interplantMode = mode;
                _plantingDraft.interplanted = mode !== "sole";
                renderModal();
            } else if (act === "set-border-sides" && _plantingDraft) {
                _plantingDraft.borderSides = Number(actEl.getAttribute("data-sides")) === 1 ? 1 : 2;
                renderModal();
            } else if (act === "pick-crop" && _plantingDraft) {
                const crop = c.resolveCrop(_catalog.cropMap, actEl.getAttribute("data-crop"));
                if (crop) {
                    _plantingDraft.cropName = crop.name;
                    _plantingDraft.label = crop.name;
                    _plantingDraft.method = crop.method || "Direct Seed";
                    _plantingDraft.rowsPerBed = crop.rowsPerBed || 2;
                    _plantingDraft.inRowCm = crop.inRowCm || 25;
                    _plantingDraft.betweenRowCm = crop.betweenRowCm || 25;
                    _plantingDraft.dtmDaysOverride = crop.dtmDays || 60;
                    _plantingDraft.nurseryWeeksOverride = crop.nurseryWeeks || 4;
                    _plantingDraft.trayCells = crop.trayCells || 72;
                    _plantingDraft.seedsPerCell = crop.seedsPerCell || 1;
                    _plantingDraft.potUpEnabled = Boolean(crop.pottingUp);
                    if (crop.pottingUp) {
                        _plantingDraft.potCells = crop.pottingUp.cells || 18;
                        _plantingDraft.potWeeks = crop.pottingUp.weeks || 3;
                    }
                    _plantingDraft.targetHarvestDate = c.addDaysIso(_plantingDraft.startDate, _plantingDraft.dtmDaysOverride);
                    _cropSearchText = crop.name;
                    _cropDropdownOpen = false;
                    renderModal();
                }
            } else if (act === "add-companion-strip" && _plantingDraft) {
                const compName = actEl.getAttribute("data-crop");
                const compMode = actEl.getAttribute("data-mode") || "border";
                const compShare = Number(actEl.getAttribute("data-share-pct") || 50);
                const added = addCompanionPlantingToSeason(compName, {
                    blockId: _plantingDraft.blockId || null,
                    bedStart: _plantingDraft.bedStart ? Number(_plantingDraft.bedStart) : null,
                    bedCount: Math.min(1, Number(_plantingDraft.bedCount) || 1),
                    startDate: _plantingDraft.startDate,
                    interplantMode: compMode,
                    interplantSharePct: compShare,
                    interplantHostId: _plantingDraft.id,
                    borderSides: 2,
                    notes: "Companion strip for " + _plantingDraft.cropName
                });
                if (added) {
                    showToast("Added companion strip: " + added.cropName + " (" + getInterplantModeLabel(added, true) + (added.blockId ? ")" : ", on Planting Bench)"));
                    renderModal();
                }
            } else if (act === "copy-share-link") {
                const url = buildShareableUrlForState(_state);
                if (url) copyTextToClipboard(url, "Copied shareable #plan= link to clipboard.");
            } else if (act === "create-plan") {
                const nameInp = document.getElementById("wcppNewPlanNameInput");
                const srcSel = document.getElementById("wcppNewPlanSourceSelect");
                const srcId = srcSel ? srcSel.value : "blank";
                const rawName = nameInp ? nameInp.value.trim() : "";
                let newState = null;
                let defaultName = "Custom Garden Plan";
                if (srcId === "blank") {
                    const pr0 = (_catalog.starterPresets && _catalog.starterPresets[0]) || null;
                    newState = c.createStateFromPreset(pr0, _catalog);
                    const yr = Number(newState.activeSeason || 2026);
                    newState.seasons[yr].plantings = [];
                    newState.seasons[yr].tunnels = [];
                    newState.seasons[yr].blocks = [{
                        id: "blk_" + Date.now(),
                        name: "Kitchen Block 1",
                        type: "field",
                        bedCount: 4,
                        bedLengthM: 10,
                        bedWidthCm: 75,
                        pathWidthCm: 30,
                        angleDeg: 0,
                        beginningYear: yr,
                        isFallow: false,
                        x: 40,
                        y: 40
                    }];
                    newState.activePresetId = "custom";
                    defaultName = "Blank Farm Plan";
                } else {
                    const pr = (_catalog.starterPresets || []).find(function (x) { return x.id === srcId; });
                    newState = c.createStateFromPreset(pr, _catalog);
                    defaultName = (pr && pr.name) || "Starter Plan";
                }
                const finalName = rawName || defaultName;
                delete newState.planId;
                newState.planName = finalName;
                c.saveNamedPlan(newState, finalName);
                _state = newState;
                rehydrateAllSeasons();
                _sharedPlanBanner = null;
                _lastSavedAt = Date.now();
                syncSavedTabDot();
                renderSimulator();
                renderModal();
                showToast("Created new plan: " + finalName);
            } else if (act === "save-as-plan") {
                const nameInp = document.getElementById("wcppNewPlanNameInput");
                const rawName = nameInp ? nameInp.value.trim() : "";
                const newName = rawName || ((_state.planName || "Garden Plan") + " (Copy)");
                const copyState = c.cloneState(_state);
                delete copyState.planId;
                c.saveNamedPlan(copyState, newName);
                _state = copyState;
                rehydrateAllSeasons();
                _sharedPlanBanner = null;
                _lastSavedAt = Date.now();
                syncSavedTabDot();
                renderSimulator();
                renderModal();
                showToast("Saved plan as: " + newName);
            } else if (act === "switch-plan") {
                const pid = actEl.getAttribute("data-plan-id");
                const loaded = c.loadNamedPlan(pid, _catalog);
                if (loaded) {
                    _state = loaded;
                    rehydrateAllSeasons();
                    _sharedPlanBanner = null;
                    _previousLocalStateBackup = null;
                    _optimizerPreview = null;
                    _selectedPlantingId = null;
                    _lastSavedAt = Date.now();
                    syncSavedTabDot();
                    closeModal();
                    renderSimulator();
                    showToast("Switched to plan: " + (_state.planName || pid));
                }
            } else if (act === "start-rename-plan") {
                _renamingPlanId = actEl.getAttribute("data-plan-id");
                renderModal();
                const ri = document.getElementById("wcppPlanRenameInput");
                if (ri) ri.focus();
            } else if (act === "cancel-rename-plan") {
                _renamingPlanId = null;
                renderModal();
            } else if (act === "confirm-rename-plan") {
                const pid = actEl.getAttribute("data-plan-id");
                const ri = document.getElementById("wcppPlanRenameInput");
                const newName = ri ? ri.value.trim() : "";
                if (newName) {
                    c.renameSavedPlan(pid, newName);
                    if (_state && _state.planId === pid) _state.planName = newName;
                    _renamingPlanId = null;
                    renderSimulator();
                    renderModal();
                    showToast("Renamed plan to " + newName);
                }
            } else if (act === "duplicate-plan") {
                const pid = actEl.getAttribute("data-plan-id");
                const meta = c.duplicateSavedPlan(pid);
                if (meta) {
                    syncSavedTabDot();
                    renderSimulator();
                    renderModal();
                    showToast("Duplicated plan: " + meta.name);
                }
            } else if (act === "copy-plan-link") {
                const pid = actEl.getAttribute("data-plan-id");
                let targetState = (_state && _state.planId === pid) ? _state : null;
                if (!targetState) {
                    try {
                        const raw = global.localStorage.getItem(c.PLANS_STORAGE_KEY);
                        const lib = raw ? JSON.parse(raw) : null;
                        if (lib && lib.plans && lib.plans[pid] && lib.plans[pid].state) {
                            targetState = lib.plans[pid].state;
                        }
                    } catch (_) {}
                }
                if (targetState) {
                    const url = buildShareableUrlForState(targetState);
                    if (url) copyTextToClipboard(url, "Copied shareable #plan= link.");
                }
            } else if (act === "delete-plan") {
                const pid = actEl.getAttribute("data-plan-id");
                const res = c.deleteSavedPlan(pid);
                if (res && res.deleted) {
                    if (_state && _state.planId === pid) {
                        _state = res.activePlanId
                            ? c.loadNamedPlan(res.activePlanId, _catalog)
                            : c.loadState(_catalog.starterPresets, _catalog);
                        rehydrateAllSeasons();
                    }
                    syncSavedTabDot();
                    renderSimulator();
                    renderModal();
                    showToast("Deleted saved plan.");
                }
            }
        });

        backdrop.addEventListener("dblclick", function (e) {
            if (!isStudioModalMode(_modalMode)) return;
            const mods = getStudioModals();
            if (mods && typeof mods.handleModalDblClick === "function") {
                mods.handleModalDblClick(getStudioModalCtx(), _modalMode, e, backdrop);
            }
        });

        backdrop.addEventListener("focusin", function (e) {
            if (!e.target) return;
            if (isStudioModalMode(_modalMode)) {
                const mods = getStudioModals();
                if (mods && typeof mods.handleModalFocusIn === "function") {
                    mods.handleModalFocusIn(getStudioModalCtx(), _modalMode, e.target, backdrop);
                }
                return;
            }
            if (e.target.id === "wcppModalCropSearch") {
                _cropDropdownOpen = true;
                const dd = backdrop.querySelector(".wcpp-bs-crop-dropdown");
                if (dd) dd.hidden = false;
            }
        });

        backdrop.addEventListener("input", function (e) {
            const t = e.target;
            if (!t) return;
            if (isStudioModalMode(_modalMode)) {
                const mods = getStudioModals();
                if (mods && typeof mods.handleModalInput === "function" && mods.handleModalInput(getStudioModalCtx(), _modalMode, t, backdrop)) {
                    return;
                }
            }
            if (t.id === "wcppModalCropSearch") {
                _cropSearchText = t.value;
                _cropDropdownOpen = true;
                const dd = backdrop.querySelector(".wcpp-bs-crop-dropdown");
                if (dd && _catalog) {
                    const matches = _catalog.searchCrops(_cropSearchText, 30);
                    dd.innerHTML = matches.map(function (mc) {
                        return '<div class="wcpp-bs-crop-option" data-action="pick-crop" data-crop="' + escHtml(mc.name) + '">' +
                            '<div><strong>' + escHtml(mc.name) + '</strong> <small style="color:var(--bs-muted);">' + escHtml(mc.family) + "</small></div>" +
                            '<span class="wcpp-bs-badge">' + mc.dtmDays + "d \u00b7 " + escHtml(mc.method) + "</span>" +
                        "</div>";
                    }).join("");
                    dd.hidden = false;
                }
                return;
            }
            const field = t.getAttribute("data-draft");
            if (!field || !_plantingDraft) return;
            const isImp = _state.units === "imperial";
            if (field === "inRowDisplay") {
                _plantingDraft.inRowCm = Math.max(1, isImp ? cInToCm(t.value) : Number(t.value));
                refreshModalPreviewsOnly();
            } else if (field === "betweenRowDisplay") {
                _plantingDraft.betweenRowCm = Math.max(2, isImp ? cInToCm(t.value) : Number(t.value));
                refreshModalPreviewsOnly();
            } else if (field === "interplantSharePct") {
                _plantingDraft.interplantSharePct = Math.max(25, Math.min(75, Math.round(Number(t.value) || 50)));
                const lbl = document.getElementById("wcppBsLaneShareVal");
                if (lbl) lbl.textContent = _plantingDraft.interplantSharePct + "% of bed width";
                refreshModalPreviewsOnly();
            } else if (field === "rowsPerBed" || field === "bedCount" || field === "dtmDaysOverride" || field === "safetyMarginPct" || field === "nurseryWeeksOverride" || field === "seedsPerCell") {
                _plantingDraft[field] = Number(t.value) || 1;
                refreshModalPreviewsOnly();
            } else if (field === "label" || field === "successionCount" || field === "successionIntervalDays") {
                _plantingDraft[field] = t.value;
            }
        });

        function cInToCm(v) {
            return core().inToCm(Number(v));
        }

        backdrop.addEventListener("change", function (e) {
            const t = e.target;
            const c = core();
            if (!t) return;
            if (isStudioModalMode(_modalMode)) {
                const mods = getStudioModals();
                if (mods && typeof mods.handleModalChange === "function" && mods.handleModalChange(getStudioModalCtx(), _modalMode, t, backdrop)) {
                    return;
                }
            }
            const field = t.getAttribute("data-draft");
            if (!field || !_plantingDraft) return;
            const season = c.getActiveSeason(_state);
            const crop = c.resolveCrop(_catalog.cropMap, _plantingDraft.cropName);
            const block = _plantingDraft.blockId && season ? (season.blocks || []).find(function (b) { return b.id === _plantingDraft.blockId; }) : null;
            if (field === "lockHarvestDate") {
                const currentDates = c.computePlantingDates(
                    Object.assign({}, _plantingDraft, { blockId: _plantingDraft.blockId || null, bedStart: _plantingDraft.bedStart ? Number(_plantingDraft.bedStart) : null }),
                    crop, block, (season && season.tunnels) || [], _state.climateAdjusted !== false
                );
                _plantingDraft.lockHarvestDate = t.checked;
                if (t.checked) {
                    _plantingDraft.targetHarvestDate = currentDates.harvestStartDate;
                } else {
                    _plantingDraft.startDate = currentDates.startDate;
                }
            } else if (t.type === "checkbox") {
                _plantingDraft[field] = t.checked;
            } else if (field === "inRowDisplay" || field === "betweenRowDisplay" || field === "interplantSharePct") {
                return;
            } else {
                _plantingDraft[field] = t.value;
            }
            if (field === "blockId" && !_plantingDraft.blockId) _plantingDraft.bedStart = "";
            if (field === "blockId" && _plantingDraft.blockId) {
                const nextBlk = season ? (season.blocks || []).find(function (b) { return b.id === _plantingDraft.blockId; }) : null;
                if (nextBlk && (nextBlk.shapeType === "custom" || isContainerBlock(nextBlk))) {
                    _plantingDraft.bedStart = 1;
                    _plantingDraft.bedCount = 1;
                } else if (!_plantingDraft.bedStart) {
                    _plantingDraft.bedStart = 1;
                }
            }
            renderModal();
        });
    }

    function init() {
        if (_initialized) return;
        _initialized = true;
        global._wcppBedSimUiInitialized = true;

        const boot = function () {
            ensureShellDom();
            initCompatObserver();

            document.addEventListener("keydown", function (e) {
                if (e.key === "Escape") {
                    if (_modalMode) {
                        closeModal();
                        return;
                    }
                    if (_isFullscreen) {
                        toggleFullscreen(false);
                        return;
                    }
                }
                if (_mode !== "simulator" || _modalMode) return;
                const tag = e.target && e.target.tagName;
                if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target && e.target.isContentEditable)) return;

                if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "f" || e.key === "F")) {
                    e.preventDefault();
                    toggleFullscreen();
                } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
                    e.preventDefault();
                    const c = core();
                    if (c && _state && c.canUndo(_state)) {
                        c.undo(_state);
                        rehydrateAllSeasons();
                        saveCurrentStateSafely();
                        _optimizerPreview = null;
                        renderSimulator();
                        showToast("Undid last change.");
                    }
                } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
                    e.preventDefault();
                    const c = core();
                    if (c && _state && c.canRedo(_state)) {
                        c.redo(_state);
                        rehydrateAllSeasons();
                        saveCurrentStateSafely();
                        _optimizerPreview = null;
                        renderSimulator();
                        showToast("Redid change.");
                    }
                }
            });

            document.addEventListener("fullscreenchange", function () {
                if (_mode === "simulator" && _catalog && _state) {
                    renderSimulator();
                }
            });

            global.addEventListener("wcpp:city-changed", function () {
                _weatherFetchRequested = false;
                if (_state && _catalog) {
                    rehydrateAllSeasons();
                    if (_mode === "simulator") renderSimulator();
                }
            });

            global.addEventListener("wcpp:weather-ready", function () {
                if (_mode === "simulator" && _subTab === "nursery" && _catalog && _state) {
                    renderSimulator();
                }
            });

            global.addEventListener("wcpp:inventory-ready", function () {
                if (_mode === "simulator" && _subTab === "nursery") {
                    renderSimulator();
                }
                if (_modalMode === "planting" && _plantingDraft && _catalog) {
                    const badgeHost = document.getElementById("wcppBsModalInvBadge");
                    const crop = core().resolveCrop(_catalog.cropMap, _plantingDraft.cropName);
                    if (badgeHost && crop && global.WCPPInventory && global.WCPPInventory.isLoaded()) {
                        badgeHost.innerHTML = stripEmojis(global.WCPPInventory.renderBadge({ commonName: crop.name, latinName: crop.latin }, { compact: true, showPreorderFallback: true, pageTheme: "garden" }));
                    }
                }
            });

            global.addEventListener("wcpp:articles-ready", function () {
                if (_mode === "simulator" && _subTab === "ecology" && _catalog && _state) {
                    const stripEl = document.querySelector("#wcppBedSimRoot .wcpp-bs-research-strip");
                    if (stripEl) {
                        stripEl.outerHTML = renderEcologyResearchStrip(core().getActiveSeason(_state));
                    }
                }
            });

            global.addEventListener("wcpp:bedsim-enriched", function () {
                if (!_catalog || !_state) return;
                rehydrateAllSeasons();
                if (_mode === "simulator") {
                    renderSimulator();
                }
                if (_modalMode === "planting" && _plantingDraft) {
                    refreshModalEnrichmentOnly();
                }
            });

            global.addEventListener("hashchange", function () {
                const h = String((global.location && global.location.hash) || "");
                if (/^#plan=/i.test(h)) {
                    loadSharedPlanFromHash(h);
                } else if (h === "#simulator" || h === "#designer") {
                    switchMode("simulator", { skipUrlSync: true });
                }
            });

            try {
                const pending = global.__wcppBedSimPending ? Object.assign({}, global.__wcppBedSimPending) : null;
                global.__wcppBedSimPending = null;
                const params = new URLSearchParams(global.location.search || "");
                const hash = String((global.location && global.location.hash) || "");
                const viewParam = params.get("view");

                if (pending && Array.isArray(pending.importGuild) && pending.importGuild.length) {
                    importGuild(pending.importGuild);
                } else if ((pending && pending.planHash) || /^#plan=/i.test(hash)) {
                    loadSharedPlanFromHash((pending && pending.planHash) || hash);
                } else if ((pending && pending.mode === "simulator") || viewParam === "simulator" || viewParam === "designer" || hash === "#simulator" || hash === "#designer") {
                    switchMode("simulator", { skipUrlSync: true });
                } else if (pending && pending.mode === "compare") {
                    switchMode("compare", { skipUrlSync: true });
                }
            } catch (_) {}
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", boot);
        } else {
            boot();
        }
    }

    global.WCPPBedSimulatorUI = {
        init: init,
        switchMode: switchMode,
        importGuild: importGuild,
        openPlantingModal: openPlantingModal,
        toggleFullscreen: toggleFullscreen,
        openShapeDesigner: openShapeDesigner,
        openContainerModal: openContainerModal,
        openBedPlayground: openBedPlayground,
        openBlueprintsGallery: openBlueprintsGallery
    };
})(typeof window !== "undefined" ? window : globalThis);
