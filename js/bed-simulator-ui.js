/* =========================================================================
   West Coast Plant Project (plantproject.ca)
   Spatial-Temporal Garden Bed Simulator UI (3-Layer Heirloom Architecture)
   - Mode Switcher for garden.html (Compare Crops vs Spatial-Temporal Simulator)
   - Layer 2: Interactive 2D Crop Map (Bed x Month Grid, Drag & Drop, Overlays)
   - Layer 1: Farm & Bed Layout CAD SVG + Sun Orientation + Block/Tunnel CRUD
   - Insights & 4-Dimension Optimizer SVG Chart + Clickable Diagnostics
   - 52-Week Nursery Bench SVG Chart + Field Tasks + Seed Order Summary
   - Layer 3: Parametric Row-Spacing Cross-Section SVG & Planting Modal
   ========================================================================= */
(function (global) {
    "use strict";

    const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const TRAY_CELL_OPTIONS = [50, 72, 98, 128, 200, 288, 32, 18];

    let _initialized = false;
    let _mode = "compare";
    let _subTab = "crop-map";
    let _catalog = null;
    let _catalogPromise = null;
    let _state = null;
    let _optimizerPreview = null;
    let _selectedBlockId = null;
    let _selectedNurseryWeek = null;
    let _taskTypeFilter = "all";
    let _taskStatusFilter = "all";
    let _taskMonthFilter = "all";
    let _farmLayers = {
        blockNames: true,
        bedNumbers: true,
        tunnels: true,
        sunPath: true
    };
    let _sunOrientationDeg = 180;
    let _dragState = null;
    let _compatObserver = null;
    let _modalMode = null;
    let _plantingDraft = null;
    let _cropDropdownOpen = false;
    let _cropSearchText = "";
    let _conflictPayload = null;
    let _rotationModalState = null;

    function core() {
        return global.WCPPBedSimCore;
    }

    function escHtml(val) {
        return String(val === null || val === undefined ? "" : val)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
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
            spark: '<polygon points="12 2 14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5 12 2"/>'
        };
        return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || "") + "</svg>";
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

    function dateToMatrixPct(iso, year) {
        if (!iso || typeof iso !== "string") return 0;
        const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return 0;
        const yr = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const dy = Number(m[3]);
        if (yr < year) return 0;
        if (yr > year) return 100;
        const daysInMo = (mo === 1 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) ? 29 : (DAYS_IN_MONTH[mo] || 30);
        const frac = (mo + (dy - 1) / daysInMo) / 12;
        return Math.max(0, Math.min(100, +(frac * 100).toFixed(3)));
    }

    function formatShortDate(iso) {
        if (!iso || typeof iso !== "string") return "";
        const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return iso;
        const moIdx = Number(m[2]) - 1;
        return (MONTHS[moIdx] || m[2]) + " " + Number(m[3]);
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

    function commitStateChange(mutatorFn, options) {
        const c = core();
        if (!c || !_state) return;
        const opts = options || {};
        if (!opts.skipUndo) c.pushUndo(_state);
        mutatorFn(_state);
        if (opts.rehydrate !== false) rehydrateAllSeasons();
        c.saveState(_state);
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
                _state = c.loadState(cat.starterPresets, cat);
                rehydrateAllSeasons();
                if (_state.farmDefaults && Number.isFinite(Number(_state.farmDefaults.sunOrientationDeg))) {
                    _sunOrientationDeg = Number(_state.farmDefaults.sunOrientationDeg);
                }
                const activeSeason = c.getActiveSeason(_state);
                if (activeSeason && activeSeason.blocks && activeSeason.blocks.length) {
                    _selectedBlockId = activeSeason.blocks[0].id;
                }
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
        if (titleRow && !document.getElementById("wcppGardenModeTabs")) {
            const tabs = document.createElement("div");
            tabs.id = "wcppGardenModeTabs";
            tabs.className = "wcpp-garden-mode-tabs";
            tabs.setAttribute("role", "tablist");
            tabs.setAttribute("aria-label", "Garden Planner Mode Switcher");
            tabs.innerHTML =
                '<button type="button" class="wcpp-garden-mode-tab is-active" data-mode="compare" role="tab" aria-selected="true">' +
                    svgIcon("compare", 16) +
                    "<span>Compare Crops (73 Attributes)</span>" +
                "</button>" +
                '<button type="button" class="wcpp-garden-mode-tab" data-mode="simulator" role="tab" aria-selected="false">' +
                    svgIcon("grid", 16) +
                    "<span>Spatial-Temporal Bed Simulator</span>" +
                    '<span class="wcpp-garden-mode-badge">3-Layer Engine</span>' +
                "</button>";
            titleRow.insertAdjacentElement("afterend", tabs);
            tabs.addEventListener("click", function (e) {
                const btn = e.target.closest(".wcpp-garden-mode-tab");
                if (!btn) return;
                switchMode(btn.getAttribute("data-mode"));
            });
        }

        const mainContent = document.querySelector("main.main-content") || document.querySelector(".main-content");
        if (mainContent && !document.getElementById("wcppBedSimRoot")) {
            const root = document.createElement("section");
            root.id = "wcppBedSimRoot";
            root.className = "wcpp-bs-root";
            root.hidden = true;
            root.setAttribute("aria-label", "Spatial-Temporal Garden Bed Simulator");
            const relBottom = document.getElementById("gardenRelatedArticlesBottom");
            if (relBottom && relBottom.parentElement === mainContent) {
                relBottom.insertAdjacentElement("afterend", root);
            } else {
                mainContent.appendChild(root);
            }
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
        const existing = document.getElementById("wcppSendGuildToSimBtn");
        if (!selected.length) {
            if (existing) existing.remove();
            return;
        }
        if (existing) return;

        let targetHost = compat.querySelector(".compat-top-bar > div");
        if (!targetHost) targetHost = compat.querySelector(".compat-empty > div");
        if (!targetHost) {
            targetHost = compat.querySelector(".compat-empty") || compat;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = "wcppSendGuildToSimBtn";
        btn.className = "wcpp-bs-send-guild-btn";
        btn.innerHTML = svgIcon("grid", 14) + "<span>Send Active Guild \u2192 Bed Simulator</span>";
        btn.addEventListener("click", function () {
            importGuild(getActiveCompareGuild());
        });
        targetHost.appendChild(btn);
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

    function syncUrlForMode(mode) {
        try {
            const url = new URL(window.location.href);
            if (mode === "simulator") {
                url.searchParams.set("view", "simulator");
            } else {
                url.searchParams.delete("view");
                if (url.hash === "#simulator") url.hash = "";
            }
            window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        } catch (_) {}
    }

    function switchMode(mode, opts) {
        const target = mode === "simulator" ? "simulator" : "compare";
        _mode = target;
        ensureShellDom();

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
                if (!_catalog || !_state) {
                    simRoot.innerHTML = '<div class="wcpp-bs-card"><p>Loading Spatial-Temporal Bed Simulator (391+ crops, climate models &amp; starter farms)...</p></div>';
                }
            }
            ensureReady().then(function () {
                if (_mode === "simulator") renderSimulator();
            }).catch(function (err) {
                if (simRoot) {
                    simRoot.innerHTML = '<div class="wcpp-bs-card"><p>Unable to initialize Bed Simulator: ' + escHtml(err && err.message || err) + "</p></div>";
                }
            });
        } else {
            hostEls.forEach(function (el) { el.classList.remove("wcpp-bs-host-hidden"); });
            if (simRoot) {
                simRoot.hidden = true;
                simRoot.classList.remove("is-active");
            }
        }

        if (!opts || !opts.skipUrlSync) {
            syncUrlForMode(target);
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
            const p = {
                id: "guild_" + Date.now() + "_" + idx + "_" + Math.floor(Math.random() * 1000),
                cropName: canonical,
                label: canonical,
                blockId: null,
                bedStart: null,
                bedCount: idx === 0 ? 1.0 : 0.5,
                startDate: startIso,
                lockHarvestDate: false,
                interplanted: idx > 0 && Boolean(crop && crop.interplantable),
                method: (crop && crop.method) || "Direct Seed",
                notes: "Imported from Compare Crops guild"
            };
            season.plantings.push(p);
            importedCount += 1;
        });

        rehydrateSeason(season, _catalog.cropMap, _state.climateAdjusted);
        c.saveState(_state);
        _subTab = "crop-map";
        switchMode("simulator");
        showToast("Imported " + importedCount + " guild crop(s) into Unassigned Tray.");
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

    function getPlantingBarColor(p, crop, block, tunnels) {
        const c = core();
        const opts = (_state && _state.displayOptions) || {};
        if (opts.colorByFamily) {
            return c.getFamilyColor((crop && crop.family) || "Other");
        }
        if (p.interplanted) {
            return "#d97706";
        }
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

    function formatBedSizeSummary(block, units) {
        const c = core();
        const w = units === "imperial" ? (c.cmToIn(block.bedWidthCm) + " in") : (Math.round(block.bedWidthCm) + " cm");
        const l = units === "imperial" ? (c.mToFt(block.bedLengthM) + " ft") : (Number(block.bedLengthM).toFixed(1).replace(/\.0$/, "") + " m");
        return block.bedCount + " bed" + (block.bedCount === 1 ? "" : "s") + " \u00b7 " + l + " \u00d7 " + w;
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
                '<div class="wcpp-bs-kpi-sub">' + (plantings.length - assigned) + " in Unassigned Tray</div>" +
            "</div>" +
            '<div class="wcpp-bs-kpi-card">' +
                '<div class="wcpp-bs-kpi-label">Crop Map Health</div>' +
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

        return '<div class="wcpp-bs-toolbar">' +
            '<div class="wcpp-bs-toolbar-row">' +
                '<div class="wcpp-bs-toolbar-group">' +
                    '<select class="wcpp-bs-select" data-action="preset-change" aria-label="Farm Preset">' + presetOptions + "</select>" +
                    '<select class="wcpp-bs-select" data-action="season-change" aria-label="Season Year">' + yearOptions + "</select>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="duplicate-season" title="Duplicate active season forward one year">' + svgIcon("plus", 13) + "<span>Duplicate Season</span></button>" +
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

    function renderUnassignedTray(season) {
        const c = core();
        const unassigned = (season.plantings || []).filter(function (p) {
            return !p.blockId || !p.bedStart;
        });

        const cardsHtml = unassigned.length
            ? unassigned.map(function (p) {
                const crop = c.resolveCrop(_catalog.cropMap, p.cropName);
                const fam = (crop && crop.family) || "Other";
                const m = c.computePlantingMetrics(p, crop, null, _state.units);
                const d = c.computePlantingDates(p, crop, null, season.tunnels || [], _state.climateAdjusted !== false);
                const borderCol = getPlantingBarColor(p, crop, null, null);

                return '<div class="wcpp-bs-unassigned-card" draggable="true" data-planting-id="' + escHtml(p.id) + '" style="border-left-color:' + escHtml(borderCol) + ';">' +
                    '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">' +
                        '<strong style="font-size:0.86rem;">' + escHtml(p.label || (crop ? crop.name : p.cropName)) + "</strong>" +
                        '<span class="wcpp-bs-badge">' + escHtml(m.bedCount) + " bed</span>" +
                    "</div>" +
                    '<div style="font-size:0.74rem; color:var(--bs-muted); margin:3px 0 6px;">' +
                        escHtml(fam) + " \u00b7 " + escHtml(formatShortDate(d.startDate)) + " \u2192 " + escHtml(formatShortDate(d.harvestEndDate)) +
                        (p.interplanted ? ' \u00b7 <strong style="color:var(--bs-interplant);">Interplanted</strong>' : "") +
                    "</div>" +
                    '<div style="display:flex; gap:5px; flex-wrap:wrap;">' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-xs" data-action="quick-assign" data-planting-id="' + escHtml(p.id) + '">Quick Assign</button>' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="edit-planting" data-planting-id="' + escHtml(p.id) + '">Edit</button>' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-action="delete-planting" data-planting-id="' + escHtml(p.id) + '" title="Delete planting">\u00d7</button>' +
                    "</div>" +
                "</div>";
            }).join("")
            : '<p style="margin:4px 0; font-size:0.82rem; color:var(--bs-muted);">All plantings are assigned to beds. Drag any bed bar here to unassign, or click + Add Planting.</p>';

        return '<aside class="wcpp-bs-tray" data-drop-tray="true">' +
            '<div class="wcpp-bs-tray-header">' +
                '<strong style="font-size:0.92rem;">Unassigned Tray (' + unassigned.length + ")</strong>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="add-planting">' + svgIcon("plus", 12) + "<span>New</span></button>" +
            "</div>" +
            '<div class="wcpp-bs-tray-list">' + cardsHtml + "</div>" +
        "</aside>";
    }

    function computeBedLanes(placedBars) {
        const sorted = placedBars.slice().sort(function (a, b) {
            if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
            return b.bedCount - a.bedCount;
        });
        const laneInfo = new Map();
        const byBed = new Map();

        sorted.forEach(function (item) {
            if (item.p.interplanted) {
                laneInfo.set(item.p.id, { offsetFrac: 0.62, widthFrac: 0.36 });
                return;
            }
            if (item.bedCount >= 1) {
                laneInfo.set(item.p.id, { offsetFrac: 0, widthFrac: item.spanBeds });
                return;
            }
            const bedNum = Number(item.p.bedStart);
            if (!byBed.has(bedNum)) byBed.set(bedNum, []);
            const peers = byBed.get(bedNum);
            let offset = 0;
            for (let step = 0; step < 4; step++) {
                const cand = +(step * 0.5).toFixed(2);
                if (cand + item.bedCount > 1.01) continue;
                const overlaps = peers.some(function (peer) {
                    const timeOverlap = !(item.endDate <= peer.startDate || peer.endDate <= item.startDate);
                    const spaceOverlap = !(cand + item.bedCount <= peer.offset + 0.01 || peer.offset + peer.frac <= cand + 0.01);
                    return timeOverlap && spaceOverlap;
                });
                if (!overlaps) {
                    offset = cand;
                    break;
                }
            }
            peers.push({ offset: offset, frac: item.bedCount, startDate: item.startDate, endDate: item.endDate });
            laneInfo.set(item.p.id, { offsetFrac: offset, widthFrac: item.bedCount });
        });

        return laneInfo;
    }

    function renderBlockCard(block, season) {
        const c = core();
        const opts = _state.displayOptions || {};
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
        const headersHtml = [];
        const colsHtml = [];

        for (let b = 1; b <= totalBeds; b++) {
            const isTun = tunnelBedSet.has(b);
            const isHatch = disabledBeds.has(b);
            headersHtml.push(
                '<div class="wcpp-bs-bed-header' + (isTun ? " is-tunnel" : "") + (isHatch ? " is-hatched" : "") + '">' +
                    "<span>Bed " + b + "</span>" +
                    (isHatch ? '<span style="font-size:0.65rem;">(Hatched)</span>' : "") +
                "</div>"
            );
            let monthCells = "";
            for (let m = 0; m < 12; m++) {
                monthCells += '<div class="wcpp-bs-month-cell" data-drop-block="' + escHtml(block.id) + '" data-drop-bed="' + b + '" data-drop-month="' + (m + 1) + '"></div>';
            }
            colsHtml.push('<div class="wcpp-bs-bed-col' + (isTun ? " is-tunnel" : "") + (isHatch ? " is-hatched" : "") + '">' + monthCells + "</div>");
        }

        let overlaysHtml = "";
        if (opts.showFrostToday !== false) {
            const frost = c.getFrostWindow(season.year);
            const springPct = dateToMatrixPct(frost.lastSpringIso, season.year);
            const fallPct = dateToMatrixPct(frost.firstFallIso, season.year);
            if (springPct > 0) {
                overlaysHtml += '<div class="wcpp-bs-frost-band is-spring" style="top:0%;height:' + springPct + '%;" title="Spring Frost Zone (until ' + escHtml(frost.lastSpring) + ')"></div>';
            }
            if (fallPct < 100) {
                overlaysHtml += '<div class="wcpp-bs-frost-band is-fall" style="top:' + fallPct + '%;height:' + (100 - fallPct) + '%;" title="Fall Frost Zone (from ' + escHtml(frost.firstFall) + ')"></div>';
            }
            const todayIso = getTodayIso();
            const todayYear = Number(todayIso.slice(0, 4));
            const mappedToday = season.year + todayIso.slice(4);
            const todayPct = dateToMatrixPct(todayYear === season.year ? todayIso : mappedToday, season.year);
            overlaysHtml += '<div class="wcpp-bs-today-line" style="top:' + todayPct + '%;"><span class="wcpp-bs-today-label">Today (' + escHtml(formatShortDate(todayIso)) + ")</span></div>";
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
            const bedCount = Math.max(0.1, Number(p.bedCount || 1));
            const spanBeds = Math.min(totalBeds - Number(p.bedStart) + 1, Math.max(1, Math.ceil(bedCount)));
            return {
                p: p,
                crop: crop,
                dates: dates,
                startDate: dates.startDate,
                endDate: dates.endDate,
                bedCount: bedCount,
                spanBeds: spanBeds
            };
        });
        const lanes = computeBedLanes(enriched);
        const todayIso = getTodayIso();

        const barsHtml = enriched.map(function (item) {
            const p = item.p;
            const crop = item.crop;
            const d = item.dates;
            const lane = lanes.get(p.id) || { offsetFrac: 0, widthFrac: 1 };
            const topPct = dateToMatrixPct(d.startDate, season.year);
            const bottomPct = Math.max(topPct + 3.2, dateToMatrixPct(d.endDate, season.year));
            const heightPct = Math.min(100 - topPct, bottomPct - topPct);
            const leftPct = (((Number(p.bedStart) - 1) + lane.offsetFrac) / totalBeds) * 100;
            const widthPct = (lane.widthFrac / totalBeds) * 100;
            const color = getPlantingBarColor(p, crop, block, season.tunnels || []);
            const rels = c.checkCompanionRelationships(p, season, _catalog.cropMap);

            const isActiveNow = d.startDate <= todayIso && d.endDate >= todayIso;
            let highlightClass = "";
            if (opts.highlightActive) {
                highlightClass = isActiveNow ? " is-highlighted" : " is-dimmed";
            } else if (opts.highlightInterplanted) {
                highlightClass = p.interplanted ? " is-highlighted" : " is-dimmed";
            }

            const classes = [
                "wcpp-bs-bar",
                p.interplanted ? "is-interplanted" : "",
                item.bedCount < 1 ? "is-fractional" : "",
                item.bedCount > 1 ? "is-multi-bed" : "",
                rels.conflictCount > 0 ? "has-conflict" : (rels.companionCount > 0 ? "has-companion" : ""),
                highlightClass.trim()
            ].filter(Boolean).join(" ");

            const badges = [];
            if (rels.companionCount > 0) {
                const compTitle = rels.companions.map(function (x) { return x.cropName + " (" + x.relation + ")"; }).join(", ");
                badges.push('<span class="wcpp-bs-badge-companion" title="Companions: ' + escHtml(compTitle) + '">\u2713 ' + rels.companionCount + "</span>");
            }
            if (rels.conflictCount > 0) {
                const confTitle = rels.conflicts.map(function (x) { return x.cropName + ": " + x.reason; }).join("; ");
                badges.push('<span class="wcpp-bs-badge-conflict" title="Conflicts: ' + escHtml(confTitle) + '">\u26a0 ' + rels.conflictCount + "</span>");
            }
            if (d.startDate < season.year + "-01-01") {
                badges.push('<span class="wcpp-bs-badge-companion">Overwinter</span>');
            }

            const titleText = (p.label || (crop ? crop.name : p.cropName)) + (item.bedCount !== 1 ? " (" + item.bedCount + ")" : "");
            const metaText = formatShortDate(d.startDate) + "\u2013" + formatShortDate(d.harvestEndDate) + " \u00b7 " + d.effectiveDtm + "d";

            return '<div class="' + classes + '" draggable="true" data-planting-id="' + escHtml(p.id) + '" ' +
                'style="top:' + topPct + "%;height:" + heightPct + "%;left:calc(" + leftPct + "% + 3px);width:calc(" + widthPct + '% - 6px);--bar-color:' + escHtml(color) + ';" ' +
                'title="' + escHtml(titleText + " | " + metaText + " | Click to edit or drag to move") + '">' +
                (p.interplanted ? '<span class="wcpp-bs-bar-stripe"></span>' : "") +
                '<div class="wcpp-bs-bar-title">' + escHtml(titleText) + "</div>" +
                '<div class="wcpp-bs-bar-meta">' + escHtml(metaText) + "</div>" +
                (badges.length ? '<div class="wcpp-bs-bar-badges">' + badges.join("") + "</div>" : "") +
            "</div>";
        }).join("");

        const monthLabelsHtml = MONTHS.map(function (m) {
            return '<div class="wcpp-bs-month-label">' + m + "</div>";
        }).join("");

        return '<article class="wcpp-bs-block-card' + (block.type === "greenhouse" ? " is-greenhouse" : "") + (block.isFallow ? " is-fallow" : "") + '" data-block-id="' + escHtml(block.id) + '">' +
            '<div class="wcpp-bs-block-header">' +
                '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    '<h3 style="margin:0; font-size:1.02rem; font-weight:800;">' + escHtml(block.name) + "</h3>" +
                    '<span class="wcpp-bs-badge">' + (block.type === "greenhouse" ? "Greenhouse" : "Field Block") + "</span>" +
                    '<span class="wcpp-bs-badge">' + escHtml(formatBedSizeSummary(block, _state.units)) + "</span>" +
                    (block.isFallow ? '<span class="wcpp-bs-badge wcpp-bs-status-warn">Fallow / Cover Crop</span>' : "") +
                    tunnels.map(function (t) {
                        return '<span class="wcpp-bs-badge">' + escHtml(t.name) + " (Beds " + t.startBed + "\u2013" + t.endBed + ")</span>";
                    }).join("") +
                "</div>" +
                '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="block-rotation" data-block-id="' + escHtml(block.id) + '">' + svgIcon("history", 13) + "<span>Block Info &amp; Rotation History</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="add-planting" data-block-id="' + escHtml(block.id) + '">' + svgIcon("plus", 13) + "<span>Add Here</span></button>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-grid-scroll">' +
                '<div class="wcpp-bs-matrix" style="--bed-count:' + totalBeds + ';">' +
                    '<div class="wcpp-bs-matrix-header">' +
                        '<div class="wcpp-bs-corner-cell">' + season.year + "</div>" +
                        '<div class="wcpp-bs-bed-headers">' + headersHtml.join("") + "</div>" +
                    "</div>" +
                    '<div class="wcpp-bs-matrix-body">' +
                        '<div class="wcpp-bs-month-axis">' + monthLabelsHtml + "</div>" +
                        '<div class="wcpp-bs-beds-stage">' + colsHtml.join("") + overlaysHtml + barsHtml + "</div>" +
                    "</div>" +
                "</div>" +
            "</div>" +
        "</article>";
    }

    function renderCropMapTab(season) {
        const blocks = (season && season.blocks) || [];
        const blocksHtml = blocks.length
            ? blocks.map(function (b) { return renderBlockCard(b, season); }).join("")
            : '<div class="wcpp-bs-card"><p>No field blocks or greenhouses in this season. Add one in <strong>Farm &amp; Bed Layout</strong>.</p></div>';

        return '<div class="wcpp-bs-cropmap-layout">' +
            renderUnassignedTray(season) +
            '<div class="wcpp-bs-blocks-stack">' + blocksHtml + "</div>" +
        "</div>";
    }

    function renderFarmSvg(season) {
        const c = core();
        const blocks = (season && season.blocks) || [];
        const tunnels = (season && season.tunnels) || [];
        const W = 820;
        const H = 500;
        const pad = 54;

        const layouts = blocks.map(function (b, idx) {
            const beds = Math.max(1, Number(b.bedCount || 4));
            const bwM = Number(b.bedWidthCm || 75) / 100;
            const pwM = Number(b.pathWidthCm || 30) / 100;
            const lenM = Math.max(1, Number(b.bedLengthM || 30));
            const widthM = beds * bwM + Math.max(0, beds - 1) * pwM;
            const xM = Number.isFinite(Number(b.x)) ? Number(b.x) / 14 : (idx % 2) * 26;
            const yM = Number.isFinite(Number(b.y)) ? Number(b.y) / 14 : Math.floor(idx / 2) * 38;
            return { b: b, beds: beds, bwM: bwM, pwM: pwM, lenM: lenM, widthM: widthM, xM: xM, yM: yM };
        });

        let minX = 0, minY = 0, maxX = 30, maxY = 30;
        if (layouts.length) {
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
        }
        const spanX = Math.max(12, maxX - minX);
        const spanY = Math.max(12, maxY - minY);
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

        const blocksSvg = layouts.map(function (l) {
            const b = l.b;
            const pxW = Math.max(24, l.widthM * pxPerM);
            const pxH = Math.max(24, l.lenM * pxPerM);
            const x0 = offsetX + l.xM * pxPerM;
            const y0 = offsetY + l.yM * pxPerM;
            const cx = x0 + pxW / 2;
            const cy = y0 + pxH / 2;
            const angle = Number(b.angleDeg || 0);
            const isSelected = _selectedBlockId === b.id;
            const isGh = b.type === "greenhouse";
            const disabled = c.getDisabledNeighborBeds(b, tunnels);
            const blockTunnels = tunnels.filter(function (t) { return t.blockId === b.id; });

            let inner = '<rect x="' + x0 + '" y="' + y0 + '" width="' + pxW + '" height="' + pxH + '" rx="6" ' +
                'fill="' + (isGh ? "#ecfeff" : (b.isFallow ? "#fef3c7" : "#f0fdf4")) + '" ' +
                'stroke="' + (isSelected ? "#166534" : (isGh ? "#0f766e" : "#94a3b8")) + '" ' +
                'stroke-width="' + (isSelected ? 2.5 : 1.5) + '"' + (b.isFallow ? ' stroke-dasharray="6 4"' : "") + "/>";

            const bedWpx = l.bwM * pxPerM;
            const pathWpx = l.pwM * pxPerM;
            for (let k = 1; k <= l.beds; k++) {
                const bx = x0 + (k - 1) * (bedWpx + pathWpx);
                const isHatched = disabled.has(k);
                inner += '<rect x="' + bx.toFixed(1) + '" y="' + (y0 + 3).toFixed(1) + '" width="' + Math.max(3, bedWpx).toFixed(1) + '" height="' + Math.max(8, pxH - 6).toFixed(1) + '" rx="2" ' +
                    'fill="' + (isHatched ? "url(#wcppFarmHatch)" : (isGh ? "#bae6fd" : "#bbf7d0")) + '" ' +
                    'stroke="' + (isGh ? "#0284c7" : "#15803d") + '" stroke-width="0.9"/>';
                if (_farmLayers.bedNumbers && bedWpx >= 10) {
                    inner += '<text x="' + (bx + bedWpx / 2).toFixed(1) + '" y="' + (y0 + pxH / 2 + 3).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#111827">' + k + "</text>";
                }
            }

            if (_farmLayers.tunnels) {
                blockTunnels.forEach(function (t) {
                    const s = Math.max(1, Math.min(l.beds, t.startBed));
                    const e = Math.max(s, Math.min(l.beds, t.endBed));
                    const tx = x0 + (s - 1) * (bedWpx + pathWpx) - 2;
                    const tw = (e - s + 1) * bedWpx + (e - s) * pathWpx + 4;
                    inner += '<rect x="' + tx.toFixed(1) + '" y="' + (y0 + 1).toFixed(1) + '" width="' + tw.toFixed(1) + '" height="' + Math.max(12, pxH - 2).toFixed(1) + '" rx="4" ' +
                        'fill="rgba(3,105,161,0.14)" stroke="#0369a1" stroke-width="1.8" stroke-dasharray="5 3"/>';
                });
            }

            if (_farmLayers.blockNames) {
                inner += '<text x="' + cx.toFixed(1) + '" y="' + (y0 - 7).toFixed(1) + '" text-anchor="middle" font-size="11.5" font-weight="800" fill="#111827">' +
                    escHtml(b.name) + " (" + angle + "\u00b0)</text>";
            }

            return '<g class="wcpp-bs-farm-block" data-action="select-farm-block" data-block-id="' + escHtml(b.id) + '" transform="rotate(' + angle + " " + cx.toFixed(1) + " " + cy.toFixed(1) + ')" style="cursor:pointer;">' +
                inner +
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

        return '<svg class="wcpp-bs-farm-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Scaled physical farm map with blocks, greenhouses, movable tunnels, compass rose, and solar orientation">' +
            "<defs>" +
                '<pattern id="wcppFarmHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">' +
                    '<line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" stroke-width="2"/>' +
                "</pattern>" +
            "</defs>" +
            '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
            gridLines +
            blocksSvg +
            sunPathSvg +
            '<g transform="translate(' + (W - 56) + ', 52)">' +
                '<circle cx="0" cy="0" r="24" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>' +
                '<polygon points="0,-18 5,-3 0,-7 -5,-3" fill="#166534"/>' +
                '<polygon points="0,18 5,3 0,7 -5,3" fill="#94a3b8"/>' +
                '<text x="0" y="-27" text-anchor="middle" font-size="10" font-weight="800" fill="#111827">N</text>' +
                '<text x="0" y="34" text-anchor="middle" font-size="9" font-weight="700" fill="#4b5563">S</text>' +
                '<text x="-31" y="3" text-anchor="middle" font-size="9" font-weight="700" fill="#4b5563">W</text>' +
                '<text x="31" y="3" text-anchor="middle" font-size="9" font-weight="700" fill="#4b5563">E</text>' +
            "</g>" +
            '<g transform="translate(24, ' + (H - 26) + ')">' +
                '<line x1="0" y1="0" x2="' + scalePx.toFixed(1) + '" y2="0" stroke="#111827" stroke-width="2.5"/>' +
                '<line x1="0" y1="-5" x2="0" y2="5" stroke="#111827" stroke-width="2"/>' +
                '<line x1="' + scalePx.toFixed(1) + '" y1="-5" x2="' + scalePx.toFixed(1) + '" y2="5" stroke="#111827" stroke-width="2"/>' +
                '<text x="0" y="-8" font-size="10.5" font-weight="700" fill="#4b5563">' + scaleLabel + " \u00b7 South Coastal BC (49.2\u00b0N)</text>" +
            "</g>" +
        "</svg>";
    }

    function renderFarmLayoutTab(season) {
        const c = core();
        const fd = _state.farmDefaults || {};
        const blocks = (season && season.blocks) || [];
        const tunnels = (season && season.tunnels) || [];
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
            const lenInp = isImp ? c.mToFt(b.bedLengthM) : b.bedLengthM;
            const widInp = isImp ? c.cmToIn(b.bedWidthCm) : b.bedWidthCm;
            return '<div class="wcpp-bs-entity-card" style="' + (isSel ? "border-color:var(--bs-primary);" : "") + '">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    '<strong>' + escHtml(b.name) + " (" + (b.type === "greenhouse" ? "Greenhouse" : "Field") + ")</strong>" +
                    '<div style="display:flex; gap:6px;">' +
                        '<button type="button" class="wcpp-bs-chip-toggle' + (b.isFallow ? " is-on" : "") + '" data-action="toggle-fallow" data-block-id="' + escHtml(b.id) + '">' + (b.isFallow ? "Fallow: ON" : "Fallow: OFF") + "</button>" +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-action="delete-block" data-block-id="' + escHtml(b.id) + '">Remove</button>' +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-form-grid">' +
                    '<div class="wcpp-bs-field"><label>Name</label><input class="wcpp-bs-input" type="text" value="' + escHtml(b.name) + '" data-block-edit="name" data-block-id="' + escHtml(b.id) + '"></div>' +
                    '<div class="wcpp-bs-field"><label>Beds</label><input class="wcpp-bs-input" type="number" min="1" max="24" value="' + b.bedCount + '" data-block-edit="bedCount" data-block-id="' + escHtml(b.id) + '"></div>' +
                    '<div class="wcpp-bs-field"><label>Length (' + (isImp ? "ft" : "m") + ')</label><input class="wcpp-bs-input" type="number" step="0.5" min="1" value="' + lenInp + '" data-block-edit="bedLength" data-block-id="' + escHtml(b.id) + '"></div>' +
                    '<div class="wcpp-bs-field"><label>Width (' + (isImp ? "in" : "cm") + ')</label><input class="wcpp-bs-input" type="number" min="12" value="' + widInp + '" data-block-edit="bedWidth" data-block-id="' + escHtml(b.id) + '"></div>' +
                    '<div class="wcpp-bs-field"><label>Angle (0\u2013360\u00b0)</label><input class="wcpp-bs-input" type="number" min="0" max="360" value="' + (b.angleDeg || 0) + '" data-block-edit="angleDeg" data-block-id="' + escHtml(b.id) + '"></div>' +
                "</div>" +
            "</div>";
        }).join("");

        const blockOptions = blocks.map(function (b) {
            return '<option value="' + escHtml(b.id) + '">' + escHtml(b.name) + " (" + b.bedCount + " beds)</option>";
        }).join("");

        const tunnelsListHtml = tunnels.length ? tunnels.map(function (t) {
            const blk = blocks.find(function (b) { return b.id === t.blockId; });
            return '<div class="wcpp-bs-entity-card">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    "<div><strong>" + escHtml(t.name) + "</strong> <span class=\"wcpp-bs-badge\">" + escHtml(t.type) + "</span> <span style=\"font-size:0.78rem; color:var(--bs-muted);\">" + escHtml(blk ? blk.name : t.blockId) + " \u00b7 Beds " + t.startBed + "\u2013" + t.endBed + "</span></div>" +
                    '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
                        '<button type="button" class="wcpp-bs-chip-toggle' + (t.disableNeighbors ? " is-on" : "") + '" data-action="toggle-tunnel-neighbors" data-tunnel-id="' + escHtml(t.id) + '">Disable Neighbors: ' + (t.disableNeighbors ? "ON" : "OFF") + "</button>" +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-action="delete-tunnel" data-tunnel-id="' + escHtml(t.id) + '">Remove</button>' +
                    "</div>" +
                "</div>" +
            "</div>";
        }).join("") : '<p style="margin:0; font-size:0.83rem; color:var(--bs-muted);">No movable tunnels in this season.</p>';

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
                        "<h3>Field Blocks &amp; Greenhouses</h3>" +
                        '<div style="display:flex; gap:6px;">' +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-xs" data-action="add-block" data-block-type="field">+ Field Block</button>' +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="add-block" data-block-type="greenhouse">+ Greenhouse</button>' +
                        "</div>" +
                    "</div>" +
                    '<div class="wcpp-bs-entity-list">' + blocksListHtml + "</div>" +
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
                            '<div class="wcpp-bs-field"><label>Neighbor Beds</label><label style="display:flex;align-items:center;gap:6px;height:36px;font-weight:700;"><input type="checkbox" id="wcppNewTunnelDisable" checked> Hatch Neighbors</label></div>' +
                        "</div>" +
                        '<div style="margin-top:10px;"><button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="add-tunnel">' + svgIcon("plus", 13) + "<span>Add Movable Tunnel</span></button></div>"
                    ) : "") +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<h3>Physical Farm Map (To Scale)</h3>" +
                    '<div class="wcpp-bs-toolbar-group">' + layerSwitches + "</div>" +
                "</div>" +
                '<div class="wcpp-bs-slider-row" style="margin-bottom:12px;">' +
                    '<label for="wcppSunSlider" style="font-size:0.82rem; font-weight:800;">Sun Orientation Angle:</label>' +
                    '<input id="wcppSunSlider" type="range" min="0" max="360" value="' + _sunOrientationDeg + '" data-action="sun-slider">' +
                    '<span class="wcpp-bs-badge">' + _sunOrientationDeg + "\u00b0</span>" +
                "</div>" +
                '<div class="wcpp-bs-farm-svg-wrap">' + renderFarmSvg(season) + "</div>" +
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

        return '<svg class="wcpp-bs-optimizer-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="4-dimension baseline versus optimized crop map comparison chart">' +
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
                    "<h3>Crop Map Optimizer (4 Dimensions)</h3>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="run-optimizer">' + svgIcon("spark", 14) + "<span>Optimize Crop Map</span></button>" +
                "</div>" +
                previewBanner +
                renderOptimizerChartSvg(baseline, opt ? opt.optimized : null) +
            "</div>" +
            '<div class="wcpp-bs-chart-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<h3>Agronomic Diagnostics (" + diags.length + ")</h3>" +
                    '<span class="wcpp-bs-badge">Click item to inspect on Crop Map</span>' +
                "</div>" +
                '<div class="wcpp-bs-diagnostics-list">' + (diagHtml || '<p style="color:var(--bs-muted);">No diagnostics recorded.</p>') + "</div>" +
            "</div>" +
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

    function renderNurseryTasksTab(season, nursery) {
        const c = core();
        const tasks = c.generateFieldTasks(_state, _catalog.cropMap);
        const orders = c.computeSeedOrderSummary(_state, _catalog.cropMap);
        const invLoaded = global.WCPPInventory && typeof global.WCPPInventory.isLoaded === "function" && global.WCPPInventory.isLoaded();
        if (global.WCPPInventory && !invLoaded && typeof global.WCPPInventory.load === "function") {
            global.WCPPInventory.load();
        }

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

        const ordersRows = orders.map(function (row) {
            const lenStr = c.formatLength(row.totalBedLengthM, _state.units);
            const stockBadge = invLoaded
                ? global.WCPPInventory.renderBadge({ commonName: row.cropName, latinName: row.latin }, { compact: true, showPreorderFallback: true, pageTheme: "garden" })
                : '<span class="wcpp-bs-badge">Inventory syncing...</span>';
            let seederStr = "\u2014";
            if (row.seederPreset) {
                const parts = [];
                if (row.seederPreset.jang) parts.push("Jang: " + (row.seederPreset.jang.roller || "") + (row.seederPreset.jang.gears ? " (" + row.seederPreset.jang.gears + ")" : ""));
                if (row.seederPreset.earthway) parts.push("Earthway: " + (row.seederPreset.earthway.plate || ""));
                seederStr = parts.join(" / ") || "Preset ready";
            }
            return "<tr>" +
                "<td><strong>" + escHtml(row.cropName) + "</strong><div style=\"font-size:0.74rem; color:var(--bs-muted);\">" + escHtml(row.family) + " \u00b7 " + escHtml(row.method) + "</div></td>" +
                "<td>" + escHtml(lenStr) + " (" + row.plantingsCount + ")</td>" +
                "<td>" + row.totalPlants.toLocaleString("en-CA") + "</td>" +
                "<td>" + row.totalSeedsNeeded.toLocaleString("en-CA") + " (" + row.totalSeedGrams + " g)</td>" +
                "<td>" + (row.totalTrays || "\u2014") + "</td>" +
                "<td>" + escHtml(seederStr) + "</td>" +
                "<td>" + stockBadge + "</td>" +
                "<td>" + row.totalEstYield + " " + escHtml(row.yieldUnit) + " ($" + row.totalValueCad.toFixed(0) + ")</td>" +
            "</tr>";
        }).join("");

        const monthOpts = '<option value="all">All Months</option>' + MONTHS.map(function (m, i) {
            return '<option value="' + (i + 1) + '"' + (_taskMonthFilter === String(i + 1) ? " selected" : "") + ">" + m + "</option>";
        }).join("");

        return '<div class="wcpp-bs-nursery-layout">' +
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
                    "<h3>Seed &amp; Transplant Order Summary</h3>" +
                    '<span class="wcpp-bs-badge">Live WCPPInventory &amp; Seeder Calibration</span>' +
                "</div>" +
                '<div class="wcpp-bs-table-scroll">' +
                    '<table class="wcpp-bs-table">' +
                        "<thead><tr><th>Crop</th><th>Bed Length</th><th>Plants (Margin)</th><th>Seeds Needed</th><th>Trays</th><th>Jang / Earthway Preset</th><th>WCPP Stock</th><th>Est. Yield &amp; Value</th></tr></thead>" +
                        "<tbody>" + (ordersRows || '<tr><td colspan="8">No plantings yet.</td></tr>') + "</tbody>" +
                    "</table>" +
                "</div>" +
            "</div>" +
        "</div>";
    }

    function renderSimulator() {
        const root = document.getElementById("wcppBedSimRoot");
        if (!root || !_catalog || !_state || _mode !== "simulator") return;
        const c = core();
        const season = c.getActiveSeason(_state);
        if (!season) return;

        const score = c.scoreCropMap(_state, _catalog.cropMap);
        const nursery = c.computeWeeklyNurseryLoad(_state, _catalog.cropMap);
        const tasks = c.generateFieldTasks(_state, _catalog.cropMap);
        const openTasks = tasks.filter(function (t) { return !t.completed; }).length;

        const subTabs = [
            { id: "crop-map", label: "2D Crop Map", icon: "grid", count: (season.plantings || []).length },
            { id: "farm-layout", label: "Farm & Bed Layout", icon: "farm", count: (season.blocks || []).length },
            { id: "insights", label: "Insights & Optimizer", icon: "chart", count: score.overall + "%" },
            { id: "nursery", label: "Nursery & Tasks", icon: "nursery", count: openTasks }
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
        else tabBody = renderNurseryTasksTab(season, nursery);

        root.innerHTML = subNavHtml + renderKpiStrip(season, score, nursery) + renderToolbar(season) + tabBody;
    }

    function renderCrossSectionSvg(draft, crop, block) {
        const c = core();
        const W = 540;
        const H = 225;
        const isImp = _state.units === "imperial";
        const bedWidthCm = Math.max(20, Number((block && block.bedWidthCm) || (_state.farmDefaults && _state.farmDefaults.bedWidthCm) || 75));
        const pathWidthCm = Math.max(10, Number((block && block.pathWidthCm) || (_state.farmDefaults && _state.farmDefaults.pathWidthCm) || 30));
        const rows = Math.max(1, Math.min(12, Math.round(Number(draft.rowsPerBed || (crop && crop.rowsPerBed) || 2))));
        const inRowCm = Math.max(2, Number(draft.inRowCm || (crop && crop.inRowCm) || 25));
        const betweenRowCm = Math.max(3, Number(draft.betweenRowCm || (crop && crop.betweenRowCm) || Math.round(bedWidthCm / (rows + 0.5))));

        const sampleLenCm = 240;
        const bedTop = 44;
        const bedLeft = 48;
        const bedPxW = W - 96;
        const bedPxH = Math.max(74, Math.min(124, Math.round((bedWidthCm / 125) * 116)));
        const pathPx = Math.max(12, Math.min(26, Math.round((pathWidthCm / bedWidthCm) * bedPxH)));

        const pxPerCmY = bedPxH / bedWidthCm;
        const totalSpanY = (rows - 1) * betweenRowCm * pxPerCmY;
        const firstRowY = bedTop + (bedPxH - Math.min(bedPxH - 16, totalSpanY)) / 2;
        const rowStepY = rows > 1 ? Math.min((bedPxH - 16) / (rows - 1), betweenRowCm * pxPerCmY) : 0;

        const pxPerCmX = bedPxW / sampleLenCm;
        const stepX = Math.max(10, inRowCm * pxPerCmX);
        const dotR = Math.max(3.5, Math.min(9, stepX * 0.28));

        let rowsSvg = "";
        for (let r = 0; r < rows; r++) {
            const ry = firstRowY + r * rowStepY;
            rowsSvg += '<line x1="' + (bedLeft + 8) + '" y1="' + ry.toFixed(1) + '" x2="' + (bedLeft + bedPxW - 8) + '" y2="' + ry.toFixed(1) + '" stroke="#166534" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>';
            for (let cx = bedLeft + 18; cx <= bedLeft + bedPxW - 14; cx += stepX) {
                rowsSvg += '<circle cx="' + cx.toFixed(1) + '" cy="' + ry.toFixed(1) + '" r="' + dotR.toFixed(1) + '" fill="' + (draft.interplanted ? "#d97706" : "#15803d") + '" stroke="#ffffff" stroke-width="1"/>';
            }
        }

        const bedWidLabel = isImp ? (c.cmToIn(bedWidthCm) + " in bed") : (Math.round(bedWidthCm) + " cm bed");
        const inRowLabel = "In-row: " + c.formatSpacing(inRowCm, _state.units);
        const betRowLabel = rows > 1 ? ("Between rows: " + c.formatSpacing(betweenRowCm, _state.units)) : "Single center row";

        return '<svg class="wcpp-bs-cross-section-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Top-down parametric bed cross-section showing row spacing and in-row spacing">' +
            '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
            '<rect x="' + bedLeft + '" y="' + (bedTop - pathPx) + '" width="' + bedPxW + '" height="' + pathPx + '" fill="#f8fafc" stroke="#e2e8f0"/>' +
            '<rect x="' + bedLeft + '" y="' + (bedTop + bedPxH) + '" width="' + bedPxW + '" height="' + pathPx + '" fill="#f8fafc" stroke="#e2e8f0"/>' +
            '<rect x="' + bedLeft + '" y="' + bedTop + '" width="' + bedPxW + '" height="' + bedPxH + '" rx="5" fill="#ecfdf5" stroke="#166534" stroke-width="1.6"/>' +
            rowsSvg +
            '<text x="' + (bedLeft + bedPxW / 2) + '" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="#111827">' + escHtml((crop ? crop.name : draft.cropName) + " \u00b7 " + rows + " Row" + (rows > 1 ? "s" : "") + " (" + bedWidLabel + ")") + "</text>" +
            '<text x="' + (bedLeft + bedPxW / 2) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="11.5" font-weight="600" fill="#4b5563">' + escHtml(inRowLabel + " \u00b7 " + betRowLabel + " \u00b7 2.4 m / 8 ft sample window") + "</text>" +
        "</svg>";
    }

    function openPlantingModal(opts) {
        ensureReady().then(function () {
            const c = core();
            const season = c.getActiveSeason(_state);
            const options = opts || {};
            let existing = null;
            if (options.plantingId && season) {
                existing = (season.plantings || []).find(function (p) { return p.id === options.plantingId; }) || null;
            }
            const defaultCropName = (existing && existing.cropName) || options.cropName || "Carrot";
            const crop = c.resolveCrop(_catalog.cropMap, defaultCropName) || _catalog.crops[0];
            const defBlockId = existing ? existing.blockId : (options.blockId || null);
            const defBed = existing ? existing.bedStart : (options.bedStart || null);
            const startDefault = (season ? season.year : 2026) + "-04-15";

            _plantingDraft = {
                isEdit: Boolean(existing),
                id: existing ? existing.id : ("pl_" + Date.now() + "_" + Math.floor(Math.random() * 1000)),
                cropName: crop ? crop.name : defaultCropName,
                label: existing ? (existing.label || crop.name) : (crop ? crop.name : defaultCropName),
                blockId: defBlockId || "",
                bedStart: defBed || "",
                bedCount: existing ? Number(existing.bedCount || 1) : Number(options.bedCount || 1),
                method: (existing && existing.method) || (crop && crop.method) || "Direct Seed",
                interplanted: existing ? Boolean(existing.interplanted) : Boolean(options.interplanted),
                startDate: (existing && existing.startDate) || options.startDate || startDefault,
                lockHarvestDate: existing ? Boolean(existing.lockHarvestDate) : false,
                targetHarvestDate: (existing && (existing.targetHarvestDate || existing.harvestStartDate)) || c.addDaysIso(startDefault, (crop && crop.dtmDays) || 60),
                rowsPerBed: Number((existing && existing.rowsPerBed) || (crop && crop.rowsPerBed) || 2),
                inRowCm: Number((existing && existing.inRowCm) || (crop && crop.inRowCm) || 25),
                betweenRowCm: Number((existing && existing.betweenRowCm) || (crop && crop.betweenRowCm) || 25),
                dtmDaysOverride: Number((existing && (existing.dtmDaysOverride || existing.dtmDays)) || (crop && crop.dtmDays) || 60),
                nurseryWeeksOverride: Number((existing && (existing.nurseryWeeksOverride !== undefined ? existing.nurseryWeeksOverride : existing.nurseryWeeks)) ?? (crop && crop.nurseryWeeks) ?? 4),
                trayCells: Number((existing && existing.trayCells) || (crop && crop.trayCells) || 72),
                seedsPerCell: Number((existing && existing.seedsPerCell) || (crop && crop.seedsPerCell) || 1),
                safetyMarginPct: Number((existing && existing.safetyMarginPct) ?? 10),
                potUpEnabled: Boolean(existing ? existing.pottingUp : (crop && crop.pottingUp)),
                potCells: Number((existing && existing.pottingUp && existing.pottingUp.cells) || (crop && crop.pottingUp && crop.pottingUp.cells) || 18),
                potWeeks: Number((existing && existing.pottingUp && existing.pottingUp.weeks) || (crop && crop.pottingUp && crop.pottingUp.weeks) || 3),
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

    function closeModal() {
        _modalMode = null;
        _conflictPayload = null;
        _rotationModalState = null;
        _cropDropdownOpen = false;
        const bd = document.getElementById("wcppBsModalBackdrop");
        if (bd) {
            bd.hidden = true;
            bd.classList.remove("is-open");
            bd.innerHTML = "";
        }
    }

    function renderPlantingModalHtml() {
        const c = core();
        const season = c.getActiveSeason(_state);
        const blocks = (season && season.blocks) || [];
        const d = _plantingDraft;
        const crop = c.resolveCrop(_catalog.cropMap, d.cropName);
        const block = d.blockId ? blocks.find(function (b) { return b.id === d.blockId; }) : null;
        const isImp = _state.units === "imperial";

        const simPlanting = Object.assign({}, d, {
            bedStart: d.bedStart ? Number(d.bedStart) : null,
            blockId: d.blockId || null,
            pottingUp: d.potUpEnabled ? { cells: d.potCells, weeks: d.potWeeks } : null
        });
        const dates = c.computePlantingDates(simPlanting, crop, block, (season && season.tunnels) || [], _state.climateAdjusted !== false);
        const metrics = c.computePlantingMetrics(simPlanting, crop, block, _state.units);

        const matches = _catalog.searchCrops(_cropSearchText, 30);
        const dropdownItems = matches.map(function (mc) {
            const sel = crop && mc.name === crop.name;
            return '<div class="wcpp-bs-crop-option' + (sel ? " is-selected" : "") + '" data-action="pick-crop" data-crop="' + escHtml(mc.name) + '">' +
                '<div><strong>' + escHtml(mc.name) + '</strong> <small style="color:var(--bs-muted);">' + escHtml(mc.family) + "</small></div>" +
                '<span class="wcpp-bs-badge">' + mc.dtmDays + "d \u00b7 " + escHtml(mc.method) + "</span>" +
            "</div>";
        }).join("");

        const blockOpts = '<option value="">Unassigned Tray</option>' + blocks.map(function (b) {
            return '<option value="' + escHtml(b.id) + '"' + (d.blockId === b.id ? " selected" : "") + ">" + escHtml(b.name) + " (" + b.bedCount + " beds)</option>";
        }).join("");

        const bedCountMax = block ? block.bedCount : 12;
        let bedOpts = '<option value="">--</option>';
        for (let b = 1; b <= bedCountMax; b++) {
            bedOpts += '<option value="' + b + '"' + (Number(d.bedStart) === b ? " selected" : "") + ">Bed " + b + "</option>";
        }

        const trayOpts = TRAY_CELL_OPTIONS.map(function (tc) {
            return '<option value="' + tc + '"' + (Number(d.trayCells) === tc ? " selected" : "") + ">" + tc + "-cell 1020</option>";
        }).join("");

        let seederBox = "";
        if (d.method === "Direct Seed") {
            const sp = crop && crop.seederPreset;
            if (sp) {
                const j = sp.jang || {};
                const ew = sp.earthway || {};
                seederBox = '<div class="wcpp-bs-seeder-box">' +
                    '<strong style="display:block; margin-bottom:4px;">Mechanical Seeder Presets (' + escHtml(crop.name) + ")</strong>" +
                    (j.roller ? "<div><strong>Jang:</strong> Roller " + escHtml(j.roller) + (j.brush ? ", Brush " + escHtml(j.brush) : "") + (j.gears ? ", Gears " + escHtml(j.gears) : "") + "</div>" : "") +
                    (ew.plate ? "<div><strong>Earthway:</strong> Plate " + escHtml(ew.plate) + (ew.depthMm ? " (" + ew.depthMm + " mm)" : "") + "</div>" : "") +
                "</div>";
            } else {
                seederBox = '<div class="wcpp-bs-seeder-box"><strong>Seeder Calibration:</strong> Standard hand/row seeding (' + ((crop && crop.seedingDepthMm) || 10) + " mm depth).</div>";
            }
        }

        let compatHtml = '<div class="wcpp-bs-compat-preview">Assign a target block and bed to preview live same-bed and adjacent-bed companion compatibility.</div>';
        if (d.blockId && d.bedStart && season) {
            const rels = c.checkCompanionRelationships(simPlanting, season, _catalog.cropMap);
            const elig = c.checkDropEligibility(simPlanting, d.blockId, Number(d.bedStart), season, _catalog.cropMap, d.isEdit ? d.id : undefined);
            const lines = [];
            if (!elig.eligible) {
                lines.push('<span class="wcpp-bs-badge wcpp-bs-status-conflict">\u26a0 ' + escHtml(elig.message) + "</span>");
            } else {
                lines.push('<span class="wcpp-bs-badge wcpp-bs-status-ok">\u2713 Bed placement open</span>');
            }
            if (rels.companions.length) {
                lines.push('<div style="margin-top:6px; color:var(--bs-primary); font-weight:700;">\u2713 Companions: ' + escHtml(rels.companions.map(function (x) { return x.cropName + " (Bed " + x.bedStart + ")"; }).join(", ")) + "</div>");
            }
            if (rels.conflicts.length) {
                lines.push('<div style="margin-top:4px; color:var(--bs-danger-text); font-weight:700;">\u26a0 Antagonists: ' + escHtml(rels.conflicts.map(function (x) { return x.cropName + " (Bed " + x.bedStart + ")"; }).join(", ")) + "</div>");
            }
            compatHtml = '<div class="wcpp-bs-compat-preview">' + lines.join("") + "</div>";
        }

        const inRowDisp = isImp ? c.cmToIn(d.inRowCm) : d.inRowCm;
        const betRowDisp = isImp ? c.cmToIn(d.betweenRowCm) : d.betweenRowCm;

        return '<div class="wcpp-bs-modal is-wide">' +
            '<div class="wcpp-bs-modal-header">' +
                "<h2>" + (d.isEdit ? "Edit Planting" : "Add Planting") + " \u2014 " + escHtml(crop ? crop.name : d.cropName) + "</h2>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7 Close</button>' +
            "</div>" +
            '<div class="wcpp-bs-modal-body">' +
                '<div class="wcpp-bs-modal-split">' +
                    '<div style="display:flex; flex-direction:column; gap:12px;">' +
                        '<div class="wcpp-bs-field">' +
                            '<label>Search Crop (391+ Crops &amp; BC Natives)</label>' +
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
                            '<div class="wcpp-bs-field"><label>Bed Fraction</label><input class="wcpp-bs-input" type="number" step="0.25" min="0.25" max="12" data-draft="bedCount" value="' + d.bedCount + '"></div>' +
                            '<div class="wcpp-bs-field"><label>Companion Strip</label><label style="display:flex;align-items:center;gap:6px;height:36px;"><input type="checkbox" data-draft="interplanted"' + (d.interplanted ? " checked" : "") + "> Interplanted</label></div>" +
                        "</div>" +
                        '<div class="wcpp-bs-form-grid">' +
                            '<div class="wcpp-bs-field"><label>Field Start Date</label><input class="wcpp-bs-input" type="date" data-draft="startDate" value="' + escHtml(dates.startDate) + '"' + (d.lockHarvestDate ? " disabled" : "") + "></div>" +
                            '<div class="wcpp-bs-field"><label>Lock Harvest Date</label><label style="display:flex;align-items:center;gap:6px;height:36px;"><input type="checkbox" data-draft="lockHarvestDate"' + (d.lockHarvestDate ? " checked" : "") + "> Plan Backward</label></div>" +
                            '<div class="wcpp-bs-field"><label>Target Harvest Date</label><input class="wcpp-bs-input" type="date" data-draft="targetHarvestDate" value="' + escHtml(d.lockHarvestDate ? d.targetHarvestDate : dates.harvestStartDate) + '"' + (d.lockHarvestDate ? "" : " disabled") + "></div>" +
                            '<div class="wcpp-bs-field"><label>Base DTM (Days)</label><input class="wcpp-bs-input" type="number" min="10" max="365" data-draft="dtmDaysOverride" value="' + d.dtmDaysOverride + '"></div>' +
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
                            renderCrossSectionSvg(d, crop, block) +
                        "</div>" +
                        '<div class="wcpp-bs-math-grid" id="wcppBsMathGridHost">' +
                            renderModalMathGrid(dates, metrics) +
                        "</div>" +
                        seederBox +
                        compatHtml +
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
        return '<div class="wcpp-bs-modal is-compact">' +
            '<div class="wcpp-bs-modal-header">' +
                "<h2>Bed Schedule Collision</h2>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7</button>' +
            "</div>" +
            '<div class="wcpp-bs-modal-body">' +
                '<p style="margin:0; font-size:0.9rem;">Moving <strong>' + escHtml(p.movedName) + "</strong> to <strong>" + escHtml(p.blockName) + " Bed " + p.targetBed + "</strong> overlaps with:</p>" +
                '<div class="wcpp-bs-entity-list">' +
                    list.map(function (cItem) {
                        return '<div class="wcpp-bs-entity-card"><strong>' + escHtml(cItem.label || cItem.cropName) + "</strong> <small style=\"color:var(--bs-muted);\">" + escHtml(cItem.startDate) + " \u2192 " + escHtml(cItem.endDate || cItem.harvestEndDate || "") + " (" + cItem.bedCount + " bed)</small></div>";
                    }).join("") +
                "</div>" +
                '<p style="margin:0; font-size:0.83rem; color:var(--bs-muted);">Choose whether to keep the moved planting here and move colliding planting(s) back to the Unassigned Tray, or cancel the move.</p>' +
            "</div>" +
            '<div class="wcpp-bs-modal-footer">' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-secondary" data-action="close-modal">Cancel</button>' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger" data-action="resolve-conflict-keep">Keep moved &amp; unassign colliding</button>' +
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
                ? '<span class="wcpp-bs-badge wcpp-bs-status-conflict">\u26a0 ' + escHtml(rot.violations[0].family + " (" + rot.violations[0].gapYears + "/" + rot.violations[0].rotationYears + " yr)") + "</span>"
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

    function renderModal() {
        const bd = document.getElementById("wcppBsModalBackdrop");
        if (!bd) return;
        if (!_modalMode) {
            closeModal();
            return;
        }
        if (_modalMode === "planting") bd.innerHTML = renderPlantingModalHtml();
        else if (_modalMode === "conflict") bd.innerHTML = renderConflictModalHtml();
        else if (_modalMode === "rotation") bd.innerHTML = renderRotationModalHtml();
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
        const simPlanting = Object.assign({}, _plantingDraft, {
            bedStart: _plantingDraft.bedStart ? Number(_plantingDraft.bedStart) : null,
            blockId: _plantingDraft.blockId || null,
            pottingUp: _plantingDraft.potUpEnabled ? { cells: _plantingDraft.potCells, weeks: _plantingDraft.potWeeks } : null
        });
        const dates = c.computePlantingDates(simPlanting, crop, block, (season && season.tunnels) || [], _state.climateAdjusted !== false);
        const metrics = c.computePlantingMetrics(simPlanting, crop, block, _state.units);
        const svgHost = document.getElementById("wcppBsCrossSectionHost");
        const mathHost = document.getElementById("wcppBsMathGridHost");
        if (svgHost) svgHost.innerHTML = renderCrossSectionSvg(_plantingDraft, crop, block);
        if (mathHost) mathHost.innerHTML = renderModalMathGrid(dates, metrics);
    }

    function buildPlantingFromDraft() {
        const d = _plantingDraft;
        const c = core();
        const crop = c.resolveCrop(_catalog.cropMap, d.cropName);
        return {
            id: d.id,
            cropName: crop ? crop.name : d.cropName,
            label: (d.label || "").trim() || (crop ? crop.name : d.cropName),
            blockId: d.blockId || null,
            bedStart: d.blockId && d.bedStart ? Number(d.bedStart) : null,
            bedCount: Math.max(0.1, Number(d.bedCount || 1)),
            startDate: d.startDate,
            lockHarvestDate: Boolean(d.lockHarvestDate),
            targetHarvestDate: d.lockHarvestDate ? d.targetHarvestDate : "",
            interplanted: Boolean(d.interplanted),
            method: d.method,
            rowsPerBed: Math.max(1, Number(d.rowsPerBed || 1)),
            inRowCm: Math.max(1, Number(d.inRowCm || 10)),
            betweenRowCm: Math.max(2, Number(d.betweenRowCm || 15)),
            dtmDaysOverride: Math.max(1, Number(d.dtmDaysOverride || 60)),
            nurseryWeeksOverride: d.method === "Transplant" ? Math.max(0, Number(d.nurseryWeeksOverride || 0)) : 0,
            trayCells: d.method === "Transplant" ? Math.max(1, Number(d.trayCells || 72)) : 0,
            seedsPerCell: Math.max(1, Number(d.seedsPerCell || 1)),
            safetyMarginPct: Math.max(0, Number(d.safetyMarginPct || 0)),
            pottingUp: (d.method === "Transplant" && d.potUpEnabled) ? { cells: Math.max(1, Number(d.potCells || 18)), weeks: Math.max(1, Number(d.potWeeks || 2)) } : null
        };
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
                            closeModal();
                            showToast("Saved planting & unassigned colliding item(s).");
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
                        closeModal();
                        showToast("Moved planting & unassigned colliding item(s).");
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
        showToast("Placed " + (copy.label || copy.cropName) + " on " + (block ? block.name : "") + " Bed " + targetBed + ".");
    }

    function bindRootEvents(root) {
        root.addEventListener("click", function (e) {
            const subTabBtn = e.target.closest("[data-subtab]");
            if (subTabBtn) {
                _subTab = subTabBtn.getAttribute("data-subtab");
                renderSimulator();
                return;
            }

            const bar = e.target.closest(".wcpp-bs-bar");
            if (bar && !e.target.closest("button")) {
                openPlantingModal({ plantingId: bar.getAttribute("data-planting-id") });
                return;
            }

            const actionEl = e.target.closest("[data-action]");
            if (!actionEl) return;
            const act = actionEl.getAttribute("data-action");
            const c = core();
            const season = c.getActiveSeason(_state);

            if (act === "duplicate-season") {
                const years = Object.keys(_state.seasons || {}).map(Number);
                const nextYear = (years.length ? Math.max.apply(null, years) : Number(_state.activeSeason || 2026)) + 1;
                commitStateChange(function () {
                    c.duplicateSeason(_state, _state.activeSeason, nextYear);
                });
                showToast("Duplicated into Season " + nextYear + " (prior history preserved).");
            } else if (act === "set-units") {
                const u = actionEl.getAttribute("data-units");
                commitStateChange(function () { _state.units = u; }, { rehydrate: false });
            } else if (act === "toggle-climate") {
                commitStateChange(function () { _state.climateAdjusted = _state.climateAdjusted === false; });
            } else if (act === "undo") {
                if (c.canUndo(_state)) {
                    c.undo(_state);
                    rehydrateAllSeasons();
                    c.saveState(_state);
                    _optimizerPreview = null;
                    renderSimulator();
                    showToast("Undid last change.");
                }
            } else if (act === "redo") {
                if (c.canRedo(_state)) {
                    c.redo(_state);
                    rehydrateAllSeasons();
                    c.saveState(_state);
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
                a.download = "wcpp-bed-simulator-" + _state.activeSeason + ".csv";
                a.click();
            } else if (act === "export-json") {
                const json = JSON.stringify(c.cloneState(_state), null, 2);
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                a.download = "wcpp-bed-simulator-" + _state.activeSeason + ".json";
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
            } else if (act === "select-farm-block") {
                _selectedBlockId = actionEl.getAttribute("data-block-id");
                renderSimulator();
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
                    showToast("Applied optimized crop map.");
                }
            } else if (act === "discard-optimized") {
                _optimizerPreview = null;
                renderSimulator();
            } else if (act === "inspect-diag") {
                const pid = actionEl.getAttribute("data-planting-id");
                const bid = actionEl.getAttribute("data-block-id");
                if (bid) {
                    _subTab = "crop-map";
                    renderSimulator();
                    const blkEl = root.querySelector('.wcpp-bs-block-card[data-block-id="' + bid + '"]');
                    if (blkEl && blkEl.scrollIntoView) blkEl.scrollIntoView({ behavior: "smooth", block: "center" });
                } else if (pid) {
                    openPlantingModal({ plantingId: pid });
                }
            } else if (act === "select-nursery-week") {
                _selectedNurseryWeek = Number(actionEl.getAttribute("data-week"));
                renderSimulator();
            }
        });

        root.addEventListener("change", function (e) {
            const c = core();
            const season = c.getActiveSeason(_state);
            const t = e.target;
            const act = t.getAttribute("data-action");

            if (act === "preset-change") {
                const pr = (_catalog.starterPresets || []).find(function (p) { return p.id === t.value; });
                if (pr) {
                    c.pushUndo(_state);
                    const fresh = c.createStateFromPreset(pr, _catalog);
                    fresh.undoStack = _state.undoStack;
                    fresh.redoStack = [];
                    _state = fresh;
                    rehydrateAllSeasons();
                    c.saveState(_state);
                    _optimizerPreview = null;
                    renderSimulator();
                    showToast("Loaded preset: " + pr.name);
                }
                return;
            }
            if (act === "season-change") {
                _state.activeSeason = Number(t.value);
                c.saveState(_state);
                _optimizerPreview = null;
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

            if (t.id === "wcppBsImportJsonInput" && t.files && t.files[0]) {
                const reader = new FileReader();
                reader.onload = function () {
                    try {
                        const parsed = JSON.parse(String(reader.result || "{}"));
                        if (!parsed || !parsed.seasons) throw new Error("Invalid simulator JSON");
                        c.pushUndo(_state);
                        const restored = c.cloneState(parsed);
                        restored.undoStack = _state.undoStack;
                        restored.redoStack = [];
                        _state = restored;
                        rehydrateAllSeasons();
                        c.saveState(_state);
                        renderSimulator();
                        showToast("Imported simulator JSON.");
                    } catch (err) {
                        showToast("Import failed: " + (err && err.message || "Invalid JSON"));
                    }
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
            }
        });

        root.addEventListener("input", function (e) {
            if (e.target.getAttribute("data-action") === "sun-slider") {
                _sunOrientationDeg = Number(e.target.value) || 0;
                if (_state && _state.farmDefaults) _state.farmDefaults.sunOrientationDeg = _sunOrientationDeg;
                const wrap = root.querySelector(".wcpp-bs-farm-svg-wrap");
                const badge = e.target.parentElement && e.target.parentElement.querySelector(".wcpp-bs-badge");
                if (badge) badge.textContent = _sunOrientationDeg + "\u00b0";
                if (wrap) wrap.innerHTML = renderFarmSvg(core().getActiveSeason(_state));
            }
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
                    showToast("Moved " + (p.label || p.cropName) + " to Unassigned Tray.");
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
            if (!e.target.closest(".wcpp-bs-crop-picker") && _cropDropdownOpen) {
                _cropDropdownOpen = false;
                const dd = backdrop.querySelector(".wcpp-bs-crop-dropdown");
                if (dd) dd.hidden = true;
            }
            const actEl = e.target.closest("[data-action]");
            if (!actEl) return;
            const act = actEl.getAttribute("data-action");
            if (act === "close-modal") {
                closeModal();
            } else if (act === "save-planting") {
                saveDraftPlanting(false);
            } else if (act === "create-successions") {
                saveDraftPlanting(true);
            } else if (act === "delete-modal-planting" && _plantingDraft) {
                const c = core();
                const season = c.getActiveSeason(_state);
                const id = _plantingDraft.id;
                commitStateChange(function () {
                    season.plantings = season.plantings.filter(function (p) { return p.id !== id; });
                }, { rehydrate: false });
                closeModal();
                showToast("Deleted planting.");
            } else if (act === "resolve-conflict-keep" && _conflictPayload && typeof _conflictPayload.onResolve === "function") {
                _conflictPayload.onResolve();
            } else if (act === "pick-crop" && _plantingDraft) {
                const crop = core().resolveCrop(_catalog.cropMap, actEl.getAttribute("data-crop"));
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
                    _plantingDraft.interplanted = Boolean(crop.interplantable);
                    _plantingDraft.potUpEnabled = Boolean(crop.pottingUp);
                    if (crop.pottingUp) {
                        _plantingDraft.potCells = crop.pottingUp.cells || 18;
                        _plantingDraft.potWeeks = crop.pottingUp.weeks || 3;
                    }
                    _plantingDraft.targetHarvestDate = core().addDaysIso(_plantingDraft.startDate, _plantingDraft.dtmDaysOverride);
                    _cropSearchText = crop.name;
                    _cropDropdownOpen = false;
                    renderModal();
                }
            }
        });

        backdrop.addEventListener("focusin", function (e) {
            if (e.target && e.target.id === "wcppModalCropSearch") {
                _cropDropdownOpen = true;
                const dd = backdrop.querySelector(".wcpp-bs-crop-dropdown");
                if (dd) dd.hidden = false;
            }
        });

        backdrop.addEventListener("input", function (e) {
            const t = e.target;
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
            const c = core();
            const isImp = _state.units === "imperial";
            if (field === "inRowDisplay") {
                _plantingDraft.inRowCm = Math.max(1, isImp ? c.inToCm(Number(t.value)) : Number(t.value));
                refreshModalPreviewsOnly();
            } else if (field === "betweenRowDisplay") {
                _plantingDraft.betweenRowCm = Math.max(2, isImp ? c.inToCm(Number(t.value)) : Number(t.value));
                refreshModalPreviewsOnly();
            } else if (field === "rowsPerBed" || field === "bedCount" || field === "dtmDaysOverride" || field === "safetyMarginPct" || field === "nurseryWeeksOverride" || field === "seedsPerCell") {
                _plantingDraft[field] = Number(t.value) || 1;
                refreshModalPreviewsOnly();
            } else if (field === "label" || field === "successionCount" || field === "successionIntervalDays") {
                _plantingDraft[field] = t.value;
            }
        });

        backdrop.addEventListener("change", function (e) {
            const t = e.target;
            const field = t.getAttribute("data-draft");
            if (!field || !_plantingDraft) return;
            const c = core();
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
            } else if (field === "inRowDisplay" || field === "betweenRowDisplay") {
                return;
            } else {
                _plantingDraft[field] = t.value;
            }
            if (field === "blockId" && !_plantingDraft.blockId) _plantingDraft.bedStart = "";
            if (field === "blockId" && _plantingDraft.blockId && !_plantingDraft.bedStart) _plantingDraft.bedStart = 1;
            renderModal();
        });
    }

    function init() {
        if (_initialized) return;
        _initialized = true;

        const boot = function () {
            ensureShellDom();
            initCompatObserver();

            document.addEventListener("keydown", function (e) {
                if (e.key === "Escape" && _modalMode) {
                    closeModal();
                    return;
                }
                if (_mode !== "simulator" || _modalMode) return;
                const tag = e.target && e.target.tagName;
                if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
                if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
                    e.preventDefault();
                    const c = core();
                    if (c && _state && c.canUndo(_state)) {
                        c.undo(_state);
                        rehydrateAllSeasons();
                        c.saveState(_state);
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
                        c.saveState(_state);
                        _optimizerPreview = null;
                        renderSimulator();
                        showToast("Redid change.");
                    }
                }
            });

            global.addEventListener("wcpp:city-changed", function () {
                if (_state && _catalog) {
                    rehydrateAllSeasons();
                    if (_mode === "simulator") renderSimulator();
                }
            });

            global.addEventListener("wcpp:inventory-ready", function () {
                if (_mode === "simulator" && _subTab === "nursery") {
                    renderSimulator();
                }
            });

            try {
                const params = new URLSearchParams(global.location.search);
                if (params.get("view") === "simulator" || global.location.hash === "#simulator") {
                    switchMode("simulator", { skipUrlSync: true });
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
        openPlantingModal: openPlantingModal
    };
})(typeof window !== "undefined" ? window : globalThis);
