/* =========================================================================
   West Coast Plant Project (plantproject.ca) — Garden Bed Designer V6
   Lazy-Loaded Module (js/bed-simulator-v6.js)
   Features:
     1. Plain-English Sowing & Germination Guide
     2. Season Time-Lapse Scrubber (Jan -> Dec Living Map & Playground)
     3. Printable QR Plant Stakes (Pure-JS Scannable SVG QR Codes)
     4. BC Habitat & Pollinator Scorecard + Printable Vector Yard Sign
     5. "What's Eating My Plant?" Coastal BC Crop Troubleshooter
     6. Coastal BC Soil pH & Mycorrhizal Lab
     7. Local-First Garden Journal & Harvest Log
     8. Royal Heights Seed Library Surplus & Request Bridge
   Zero external dependencies · Zero emojis · Zero AI imagery
   ========================================================================= */
(function (global) {
    "use strict";

    const JOURNAL_STORAGE_KEY = "wcpp_garden_journal_v1";
    const SEED_SURPLUS_STORAGE_KEY = "wcpp_seed_library_surplus_v1";
    const SEED_REQUEST_STORAGE_KEY = "wcpp_seed_library_requests_v1";
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Module-scoped interactive UI state
    const _v6State = {
        sowingFilterCrop: "",
        soilPh: 5.8,
        soilTexture: "loam", // sandy | loam | clay | raised
        troubleshooterCrop: "",
        troubleshooterSymptom: "holes_slime",
        journalFilter: "all", // all | harvest | observation | sowing | pest | seed
        timeLapseMonth: 0, // 0 = Off (All Season), 1..12 = Jan..Dec
        timeLapsePlaying: false,
        timeLapseTimer: null
    };

    function escHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function readJsonLs(key, fallback) {
        try {
            const raw = global.localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed == null ? fallback : parsed;
        } catch (_) {
            return fallback;
        }
    }

    function writeJsonLs(key, val) {
        try {
            global.localStorage.setItem(key, JSON.stringify(val));
            return true;
        } catch (_) {
            return false;
        }
    }

    function todayIso() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + day;
    }

    function slugify(str) {
        return String(str || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function buildPlantUrl(crop, catalog) {
        if (crop && crop.slug) {
            return "https://plantproject.ca/species-" + encodeURIComponent(crop.slug) + ".html";
        }
        if (crop && crop.latin && catalog && Array.isArray(catalog.nativePlants)) {
            const lat = String(crop.latin).toLowerCase().trim();
            const found = catalog.nativePlants.find(function (np) {
                return np && String(np.Latin_Name || np.latin || "").toLowerCase().trim() === lat;
            });
            if (found && (found.URL_Slug || found.slug)) {
                return "https://plantproject.ca/species-" + encodeURIComponent(found.URL_Slug || found.slug) + ".html";
            }
        }
        if (crop && crop.isNative && crop.latin) {
            return "https://plantproject.ca/species-" + slugify(crop.latin) + ".html";
        }
        const name = (crop && crop.name) ? crop.name : String(crop || "");
        return "https://plantproject.ca/garden.html?crop=" + encodeURIComponent(name);
    }

    function collectUniqueSeasonCrops(season, catalog, core) {
        const seen = new Set();
        const out = [];
        const addByName = function (name, meta) {
            if (!name) return;
            const crop = (catalog && catalog.cropMap && core && typeof core.resolveCrop === "function")
                ? core.resolveCrop(catalog.cropMap, name)
                : null;
            const key = crop ? crop.name : String(name);
            if (seen.has(key)) return;
            seen.add(key);
            out.push({
                name: key,
                crop: crop || { name: key, category: "Vegetable", family: "Other", method: "Direct", seedingDepthMm: 10, germinationDays: 10, inRowCm: 25, betweenRowCm: 35, dtmDays: 65 },
                meta: meta || {}
            });
        };
        if (season && Array.isArray(season.plantings)) {
            season.plantings.forEach(function (p) {
                if (p && p.cropName) addByName(p.cropName, { startDate: p.startDate, harvestStartDate: p.harvestStartDate, blockId: p.blockId, bedNumber: p.bedStart });
            });
        }
        if (season && Array.isArray(season.placedPlants)) {
            season.placedPlants.forEach(function (pp) {
                if (pp && pp.cropName) addByName(pp.cropName, { startDate: pp.startDate, blockId: pp.blockId, bedNumber: pp.bedNumber });
            });
        }
        return out;
    }

    /* =========================================================================
       PURE-JS QR CODE GENERATOR (ISO/IEC 18004, Version 2-6, EC Level L, Byte Mode)
       Generates real, camera-scannable inline SVG QR codes with zero dependencies
       ========================================================================= */
    const QR_GF_EXP = new Uint8Array(512);
    const QR_GF_LOG = new Uint8Array(256);
    (function initQrGalois() {
        let x = 1;
        for (let i = 0; i < 255; i++) {
            QR_GF_EXP[i] = x;
            QR_GF_LOG[x] = i;
            x <<= 1;
            if (x & 0x100) x ^= 0x11d;
        }
        for (let i = 255; i < 512; i++) QR_GF_EXP[i] = QR_GF_EXP[i - 255];
    })();

    function qrGfMul(a, b) {
        if (a === 0 || b === 0) return 0;
        return QR_GF_EXP[QR_GF_LOG[a] + QR_GF_LOG[b]];
    }

    function qrRsPoly(ecLen) {
        let poly = [1];
        for (let i = 0; i < ecLen; i++) {
            const next = new Array(poly.length + 1).fill(0);
            const factor = QR_GF_EXP[i];
            for (let j = 0; j < poly.length; j++) {
                next[j] ^= poly[j];
                next[j + 1] ^= qrGfMul(poly[j], factor);
            }
            poly = next;
        }
        return poly;
    }

    function qrRsEncode(data, ecLen) {
        const gen = qrRsPoly(ecLen);
        const res = new Uint8Array(data.length + ecLen);
        res.set(data);
        for (let i = 0; i < data.length; i++) {
            const coef = res[i];
            if (coef !== 0) {
                for (let j = 0; j < gen.length; j++) {
                    res[i + j] ^= qrGfMul(gen[j], coef);
                }
            }
        }
        return Array.from(res.slice(data.length));
    }

    // Version table for EC Level L (single block versions 1..5, two-block v6)
    const QR_VERSIONS_L = [
        { ver: 1, size: 21, dataBytes: 19, ecPerBlock: 7, blocks: 1, align: [] },
        { ver: 2, size: 25, dataBytes: 34, ecPerBlock: 10, blocks: 1, align: [6, 18] },
        { ver: 3, size: 29, dataBytes: 55, ecPerBlock: 15, blocks: 1, align: [6, 22] },
        { ver: 4, size: 33, dataBytes: 80, ecPerBlock: 20, blocks: 1, align: [6, 26] },
        { ver: 5, size: 37, dataBytes: 108, ecPerBlock: 26, blocks: 1, align: [6, 30] },
        { ver: 6, size: 41, dataBytes: 136, ecPerBlock: 18, blocks: 2, align: [6, 34] }
    ];

    function utf8Bytes(str) {
        const out = [];
        for (let i = 0; i < str.length; i++) {
            let code = str.charCodeAt(i);
            if (code < 0x80) out.push(code);
            else if (code < 0x800) {
                out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
            } else {
                out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
            }
        }
        return out;
    }

    function buildQrMatrix(text) {
        let bytes = utf8Bytes(String(text || "https://plantproject.ca/"));
        if (bytes.length > 130) bytes = bytes.slice(0, 130);
        let spec = QR_VERSIONS_L[QR_VERSIONS_L.length - 1];
        for (let i = 0; i < QR_VERSIONS_L.length; i++) {
            if (bytes.length + 2 <= QR_VERSIONS_L[i].dataBytes) {
                spec = QR_VERSIONS_L[i];
                break;
            }
        }
        const N = spec.size;
        const grid = Array.from({ length: N }, function () { return new Int8Array(N).fill(-1); });
        const reserved = Array.from({ length: N }, function () { return new Uint8Array(N); });

        function setMod(r, c, val, isFunc) {
            if (r < 0 || c < 0 || r >= N || c >= N) return;
            grid[r][c] = val ? 1 : 0;
            if (isFunc) reserved[r][c] = 1;
        }

        function drawFinder(r0, c0) {
            for (let dr = -1; dr <= 7; dr++) {
                for (let dc = -1; dc <= 7; dc++) {
                    const r = r0 + dr;
                    const c = c0 + dc;
                    if (r < 0 || c < 0 || r >= N || c >= N) continue;
                    const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
                    const isBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
                    const isCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
                    setMod(r, c, inOuter && (isBorder || isCore), true);
                }
            }
        }

        drawFinder(0, 0);
        drawFinder(0, N - 7);
        drawFinder(N - 7, 0);

        // Alignment pattern (skip overlaps with finders)
        for (let i = 0; i < spec.align.length; i++) {
            for (let j = 0; j < spec.align.length; j++) {
                const ar = spec.align[i];
                const ac = spec.align[j];
                if ((ar === 6 && ac === 6) || (ar === 6 && ac === N - 7) || (ar === N - 7 && ac === 6)) continue;
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
                        setMod(ar + dr, ac + dc, on, true);
                    }
                }
            }
        }

        // Timing patterns
        for (let i = 8; i < N - 8; i++) {
            setMod(6, i, i % 2 === 0, true);
            setMod(i, 6, i % 2 === 0, true);
        }

        // Dark module
        setMod(4 * spec.ver + 9, 8, true, true);

        // Reserve format info strips
        for (let i = 0; i < 9; i++) {
            if (i !== 6) {
                reserved[8][i] = 1;
                reserved[i][8] = 1;
            }
        }
        for (let i = 0; i < 8; i++) {
            reserved[8][N - 1 - i] = 1;
            reserved[N - 1 - i][8] = 1;
        }

        // Encode byte-mode bit stream
        const bits = [];
        function pushBits(val, count) {
            for (let b = count - 1; b >= 0; b--) bits.push((val >> b) & 1);
        }
        pushBits(0x4, 4); // Byte mode indicator
        pushBits(bytes.length, 8);
        for (let i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);
        const totalDataBits = spec.dataBytes * 8;
        const termLen = Math.min(4, totalDataBits - bits.length);
        for (let i = 0; i < termLen; i++) bits.push(0);
        while (bits.length % 8 !== 0) bits.push(0);
        const padBytes = [0xec, 0x11];
        let pIdx = 0;
        while (bits.length < totalDataBits) {
            pushBits(padBytes[pIdx % 2], 8);
            pIdx++;
        }

        const dataCw = [];
        for (let i = 0; i < bits.length; i += 8) {
            let byteVal = 0;
            for (let b = 0; b < 8; b++) byteVal = (byteVal << 1) | bits[i + b];
            dataCw.push(byteVal);
        }

        // Split into RS blocks and interleave
        const blockLen = Math.floor(spec.dataBytes / spec.blocks);
        const dataBlocks = [];
        const ecBlocks = [];
        for (let b = 0; b < spec.blocks; b++) {
            const slice = dataCw.slice(b * blockLen, (b + 1) * blockLen);
            dataBlocks.push(slice);
            ecBlocks.push(qrRsEncode(slice, spec.ecPerBlock));
        }
        const finalCw = [];
        for (let i = 0; i < blockLen; i++) {
            for (let b = 0; b < spec.blocks; b++) finalCw.push(dataBlocks[b][i]);
        }
        for (let i = 0; i < spec.ecPerBlock; i++) {
            for (let b = 0; b < spec.blocks; b++) finalCw.push(ecBlocks[b][i]);
        }

        const stream = [];
        for (let i = 0; i < finalCw.length; i++) {
            for (let b = 7; b >= 0; b--) stream.push((finalCw[i] >> b) & 1);
        }

        // Place data bits in zig-zag columns with Mask 0: (r + c) % 2 === 0
        let bitIdx = 0;
        let goingUp = true;
        for (let col = N - 1; col >= 1; col -= 2) {
            if (col === 6) col--;
            for (let step = 0; step < N; step++) {
                const row = goingUp ? (N - 1 - step) : step;
                for (let dx = 0; dx < 2; dx++) {
                    const c = col - dx;
                    if (!reserved[row][c]) {
                        let bit = bitIdx < stream.length ? stream[bitIdx++] : 0;
                        if ((row + c) % 2 === 0) bit ^= 1;
                        grid[row][c] = bit;
                    }
                }
            }
            goingUp = !goingUp;
        }

        // Write format information for EC Level L (01) + Mask 0 (000) -> 15-bit BCH + XOR 0x5412 = 0x77c4
        const fmt = 0x77c4;
        const fmtBits = [];
        for (let i = 14; i >= 0; i--) fmtBits.push((fmt >> i) & 1);
        const coordsA = [
            [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
            [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
        ];
        const coordsB = [
            [N - 1, 8], [N - 2, 8], [N - 3, 8], [N - 4, 8], [N - 5, 8], [N - 6, 8], [N - 7, 8],
            [8, N - 8], [8, N - 7], [8, N - 6], [8, N - 5], [8, N - 4], [8, N - 3], [8, N - 2], [8, N - 1]
        ];
        for (let i = 0; i < 15; i++) {
            grid[coordsA[i][0]][coordsA[i][1]] = fmtBits[i];
            grid[coordsB[i][0]][coordsB[i][1]] = fmtBits[i];
        }
        return grid;
    }

    function renderQrSvg(text, sizePx) {
        const matrix = buildQrMatrix(text);
        const n = matrix.length;
        const quiet = 2;
        const total = n + quiet * 2;
        const px = Number(sizePx) || 88;
        let pathD = "";
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (matrix[r][c] === 1) {
                    pathD += "M" + (c + quiet) + "," + (r + quiet) + "h1v1h-1z";
                }
            }
        }
        return '<svg class="wcpp-bs-qr-svg" xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px + '" viewBox="0 0 ' + total + " " + total + '" shape-rendering="crispEdges" role="img" aria-label="QR code linking to ' + escHtml(text) + '">' +
            '<rect width="' + total + '" height="' + total + '" fill="#ffffff"/>' +
            '<path d="' + pathD + '" fill="#0f172a"/>' +
        "</svg>";
    }

    /* =========================================================================
       FEATURE 1: PLAIN-ENGLISH SOWING & GERMINATION GUIDE
       ========================================================================= */
    function formatDepthPlainEnglish(mm, isImp) {
        const val = Number(mm);
        if (!Number.isFinite(val) || val <= 2) return "Press onto soil surface (needs light to sprout)";
        if (val <= 5) return isImp ? "1/8 to 1/4 in deep (light dusting of soil)" : "3–5 mm deep (light dusting of soil)";
        if (val <= 10) return isImp ? "1/4 to 1/2 in deep (about fingernail depth)" : "6–10 mm deep (fingernail depth)";
        if (val <= 20) return isImp ? "1/2 to 3/4 in deep (first knuckle depth)" : "1–2 cm deep (first knuckle depth)";
        return isImp ? "1 to 1.5 in deep (push firmly into moist soil)" : "2.5–3.5 cm deep (push firmly into moist soil)";
    }

    function formatCoastalTimingTip(crop) {
        const ft = String((crop && crop.frostTolerance) || "").toLowerCase();
        const method = String((crop && crop.method) || "Direct").toLowerCase();
        if (ft === "hardy") {
            return method === "transplant"
                ? "Cool-season hardy — set out transplants March–April or late August for fall harvest."
                : "Frost-hardy — direct sow outdoors as soon as soil is workable (late Feb–April in Coastal BC).";
        }
        if (ft === "half-hardy" || ft === "semi-hardy") {
            return "Tolerates light spring chill — plant out mid-April under fleece or early May uncovered.";
        }
        if (ft === "tender") {
            return crop && crop.prefersProtected
                ? "Heat-lover — thrives in a greenhouse or warm south wall after mid-May (soil > 16\u00b0C)."
                : "Frost-sensitive — wait until mid-May in Coastal BC when night lows stay above 10\u00b0C.";
        }
        if (crop && crop.isNative) {
            return "Coastal BC native — autumn or winter sowing gives natural cool-moist stratification.";
        }
        return "Sow into warm, evenly moist soil in spring; keep top 1 cm damp until sprouts emerge.";
    }

    function renderSowingGuideCard(ctx, season) {
        const state = ctx.getState();
        const catalog = ctx.getCatalog();
        const c = ctx.core();
        const isImp = state && state.units === "imperial";
        const seasonCrops = collectUniqueSeasonCrops(season, catalog, c);

        const lookupOpts = ((catalog && catalog.crops) || []).slice(0, 140).map(function (cr) {
            return '<option value="' + escHtml(cr.name) + '"' + (_v6State.sowingFilterCrop === cr.name ? " selected" : "") + ">" + escHtml(cr.name) + "</option>";
        }).join("");

        let displayList = seasonCrops.slice();
        if (_v6State.sowingFilterCrop && catalog && catalog.cropMap) {
            const extra = c.resolveCrop(catalog.cropMap, _v6State.sowingFilterCrop);
            if (extra && !displayList.some(function (x) { return x.name === extra.name; })) {
                displayList.unshift({ name: extra.name, crop: extra, meta: { lookup: true } });
            }
        }

        const rowsHtml = displayList.length ? displayList.map(function (entry) {
            const cr = entry.crop;
            const isTransplant = String(cr.method || "").toLowerCase() === "transplant";
            const startHow = isTransplant
                ? ("Start indoors " + Math.max(3, Number(cr.nurseryWeeks || 5)) + " wks before planting out")
                : "Direct sow right into bed or container";
            const depthStr = formatDepthPlainEnglish(cr.seedingDepthMm, isImp);
            const germDays = Number(cr.germinationDays || 10);
            const minT = Number(cr.tempBaseC != null ? cr.tempBaseC : 10);
            const optLow = Math.max(12, Math.min(22, minT + 6));
            const optHigh = Math.max(optLow + 4, Math.min(28, Number(cr.tempMaxC || 26)));
            const inRow = Number(cr.inRowCm || 25);
            const spacingStr = isImp
                ? (Math.max(1, Math.round(inRow / 2.54)) + " in apart")
                : (inRow + " cm apart");
            const tip = formatCoastalTimingTip(cr);

            return '<div class="wcpp-bs-v6-sow-row">' +
                '<div class="wcpp-bs-v6-sow-head">' +
                    "<strong>" + escHtml(cr.name) + "</strong>" +
                    '<span class="wcpp-bs-badge ' + (isTransplant ? "wcpp-bs-status-warn" : "wcpp-bs-status-ok") + '">' + escHtml(isTransplant ? "Start Indoors" : "Direct Sow") + "</span>" +
                    '<span class="wcpp-bs-badge">Sprouts ~' + germDays + " days</span>" +
                "</div>" +
                '<div class="wcpp-bs-v6-sow-grid">' +
                    "<div><span>How to Start:</span> " + escHtml(startHow) + "</div>" +
                    "<div><span>Seed Depth:</span> " + escHtml(depthStr) + "</div>" +
                    "<div><span>Soil Warmth:</span> " + optLow + "\u2013" + optHigh + "\u00b0C</div>" +
                    "<div><span>Final Spacing:</span> " + escHtml(spacingStr) + "</div>" +
                "</div>" +
                '<div class="wcpp-bs-v6-sow-tip">' + escHtml(tip) + "</div>" +
            "</div>";
        }).join("") : '<p style="margin:0; font-size:0.84rem; color:var(--bs-muted);">Add crops to your beds or pick any crop above to see plain-English sowing instructions.</p>';

        return '<div class="wcpp-bs-card wcpp-bs-v6-card">' +
            '<div class="wcpp-bs-card-header">' +
                "<div>" +
                    "<h3>Sowing &amp; Germination Guide (Plain English)</h3>" +
                    '<p class="wcpp-bs-v6-sub">Depth, warmth, sprouting time, and Coastal BC planting tips for every crop in your plan.</p>' +
                "</div>" +
                '<div class="wcpp-bs-toolbar-group">' +
                    '<select class="wcpp-bs-select" data-v6-action="sowing-lookup-crop" aria-label="Look up sowing guide for any crop">' +
                        '<option value="">+ Look up any crop...</option>' + lookupOpts +
                    "</select>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-v6-action="print-qr-stakes">' +
                        ctx.svgIcon("print", 13) + "<span>Print QR Plant Stakes</span>" +
                    "</button>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-v6-sow-list">' + rowsHtml + "</div>" +
        "</div>";
    }

    /* =========================================================================
       FEATURE 2: SEASON TIME-LAPSE SCRUBBER (JAN -> DEC LIVING MAP)
       ========================================================================= */
    function parseMonthFromIso(iso, fallbackMonth) {
        if (!iso || typeof iso !== "string") return fallbackMonth;
        const m = Number(iso.slice(5, 7));
        return (m >= 1 && m <= 12) ? m : fallbackMonth;
    }

    function computeCropGrowthStage(crop, planting, monthNum) {
        if (!monthNum || monthNum < 1 || monthNum > 12) {
            return { active: true, stage: "mature", stageLabel: "Full Season", canopyScale: 1.0, isBlooming: false, isHarvesting: false };
        }
        const startM = parseMonthFromIso(planting && (planting.transplantDate || planting.startDate), 4);
        const dtmMonths = Math.max(1, Math.round(Number((crop && crop.dtmDays) || 65) / 30));
        const harvestMonths = Math.max(1, Math.round(Number((crop && crop.harvestWindowDays) || 35) / 30));
        const harvStartM = parseMonthFromIso(planting && planting.harvestStartDate, Math.min(11, startM + dtmMonths));
        const harvEndM = parseMonthFromIso(planting && (planting.harvestEndDate || planting.endDate), Math.min(12, harvStartM + harvestMonths));

        // Perennial natives stay present year-round with seasonal flush
        const isPerennialNative = Boolean(crop && (crop.isNative || crop.category === "Native" || crop.category === "Shrub" || crop.category === "Tree"));
        if (isPerennialNative) {
            if (monthNum <= 2 || monthNum === 12) {
                return { active: true, stage: "dormant", stageLabel: "Winter Dormant", canopyScale: 0.45, isBlooming: false, isHarvesting: false };
            }
            if (monthNum === 3) {
                return { active: true, stage: "seedling", stageLabel: "Spring Emergence", canopyScale: 0.65, isBlooming: false, isHarvesting: false };
            }
            const isBloom = monthNum >= 4 && monthNum <= 8;
            return {
                active: true,
                stage: isBloom ? "bloom" : "mature",
                stageLabel: isBloom ? "Active Bloom & Pollinators" : "Foliage & Seed Heads",
                canopyScale: monthNum >= 5 && monthNum <= 9 ? 1.0 : 0.82,
                isBlooming: isBloom,
                isHarvesting: monthNum >= 8 && monthNum <= 10
            };
        }

        if (monthNum < startM) {
            return { active: false, stage: "pre-sow", stageLabel: "Empty / Pre-Planting", canopyScale: 0.22, isBlooming: false, isHarvesting: false };
        }
        if (monthNum > harvEndM) {
            return { active: false, stage: "finished", stageLabel: "Post-Harvest / Cover Crop", canopyScale: 0.30, isBlooming: false, isHarvesting: false };
        }
        const progress = Math.min(1, Math.max(0, (monthNum - startM + 0.5) / Math.max(1, harvStartM - startM + 0.5)));
        if (monthNum === startM && progress < 0.55) {
            return { active: true, stage: "seedling", stageLabel: "Seedling / Establishing", canopyScale: 0.32, isBlooming: false, isHarvesting: false };
        }
        if (monthNum >= harvStartM && monthNum <= harvEndM) {
            return { active: true, stage: "harvest", stageLabel: "Peak Harvest", canopyScale: 1.0, isBlooming: monthNum === harvStartM, isHarvesting: true };
        }
        const scale = +(0.38 + progress * 0.58).toFixed(2);
        return { active: true, stage: "growing", stageLabel: "Vegetative Growth", canopyScale: scale, isBlooming: progress > 0.72, isHarvesting: false };
    }

    function getTimeLapseMonth() {
        return _v6State.timeLapseMonth;
    }

    function setTimeLapseMonth(m) {
        const next = Math.max(0, Math.min(12, Math.round(Number(m) || 0)));
        _v6State.timeLapseMonth = next;
        return next;
    }

    function renderFarmTimeLapseBar(ctx, season) {
        const c = ctx.core();
        const catalog = ctx.getCatalog();
        const m = _v6State.timeLapseMonth;
        let sprouting = 0, growing = 0, blooming = 0, harvesting = 0;
        const plantings = (season && season.plantings) || [];
        if (m > 0) {
            plantings.forEach(function (p) {
                const cr = catalog && catalog.cropMap ? c.resolveCrop(catalog.cropMap, p.cropName) : null;
                const st = computeCropGrowthStage(cr, p, m);
                if (st.stage === "seedling") sprouting++;
                else if (st.stage === "growing" || st.stage === "mature") growing++;
                if (st.isBlooming) blooming++;
                if (st.isHarvesting) harvesting++;
            });
        }

        const statusSummary = m === 0
            ? "Showing full-season layout — slide to any month (Jan–Dec) to animate growth & harvest."
            : (MONTHS_FULL[m - 1] + ": " + sprouting + " establishing · " + growing + " growing · " + blooming + " blooming · " + harvesting + " harvesting");

        return '<div class="wcpp-bs-v6-timelapse-bar" role="region" aria-label="Season Time-Lapse Scrubber">' +
            '<div class="wcpp-bs-v6-tl-top">' +
                '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    "<strong>Season Time-Lapse:</strong>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs' + (_v6State.timeLapsePlaying ? " wcpp-bs-btn-primary" : "") + '" data-v6-action="tl-toggle-play">' +
                        escHtml(_v6State.timeLapsePlaying ? "Pause" : "Play Jan\u2013Dec") +
                    "</button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs' + (m === 0 ? " wcpp-bs-btn-primary" : "") + '" data-v6-action="tl-set-month" data-month="0">All Season</button>' +
                "</div>" +
                '<span class="wcpp-bs-badge' + (m > 0 ? " wcpp-bs-status-ok" : "") + '">' + escHtml(m === 0 ? "Full Season" : MONTHS_FULL[m - 1]) + "</span>" +
            "</div>" +
            '<div class="wcpp-bs-v6-tl-slider-row">' +
                '<span class="wcpp-bs-v6-tl-end">Jan</span>' +
                '<input type="range" class="wcpp-bs-v6-tl-slider" min="1" max="12" step="1" value="' + (m || 6) + '" data-v6-action="tl-slider" aria-label="Time-Lapse Month (January to December)">' +
                '<span class="wcpp-bs-v6-tl-end">Dec</span>' +
            "</div>" +
            '<div class="wcpp-bs-v6-tl-summary">' + escHtml(statusSummary) + "</div>" +
        "</div>";
    }

    function getBlockTimeLapseVisual(block, season, catalog, core) {
        const m = _v6State.timeLapseMonth;
        if (!m || !block || !season) return null;
        const bPlantings = (season.plantings || []).filter(function (p) { return p && p.blockId === block.id; });
        const bPlaced = (season.placedPlants || []).filter(function (pp) { return pp && pp.blockId === block.id; });
        if (!bPlantings.length && !bPlaced.length) {
            return { fill: "#f1f5f9", stroke: "#94a3b8", badge: "Empty", scale: 0.3, blooming: false };
        }
        let maxScale = 0.25;
        let anyBloom = false;
        let anyHarvest = false;
        let anyActive = false;
        bPlantings.forEach(function (p) {
            const cr = catalog && catalog.cropMap ? core.resolveCrop(catalog.cropMap, p.cropName) : null;
            const st = computeCropGrowthStage(cr, p, m);
            if (st.active) anyActive = true;
            if (st.canopyScale > maxScale) maxScale = st.canopyScale;
            if (st.isBlooming) anyBloom = true;
            if (st.isHarvesting) anyHarvest = true;
        });
        bPlaced.forEach(function (pp) {
            const cr = catalog && catalog.cropMap ? core.resolveCrop(catalog.cropMap, pp.cropName) : null;
            const st = computeCropGrowthStage(cr, pp, m);
            if (st.active) anyActive = true;
            if (st.canopyScale > maxScale) maxScale = st.canopyScale;
            if (st.isBlooming) anyBloom = true;
            if (st.isHarvesting) anyHarvest = true;
        });
        if (!anyActive) {
            return { fill: "#f3f4f6", stroke: "#9ca3af", badge: "Dormant", scale: 0.28, blooming: false };
        }
        if (anyHarvest) {
            return { fill: "#fef3c7", stroke: "#d97706", badge: "Harvest", scale: maxScale, blooming: anyBloom };
        }
        if (anyBloom) {
            return { fill: "#dcfce7", stroke: "#15803d", badge: "Bloom", scale: maxScale, blooming: true };
        }
        return {
            fill: maxScale < 0.5 ? "#ecfdf5" : "#bbf7d0",
            stroke: "#16a34a",
            badge: maxScale < 0.5 ? "Sprouting" : "Growing",
            scale: maxScale,
            blooming: false
        };
    }

    /* =========================================================================
       FEATURE 3: PRINTABLE QR PLANT STAKES
       ========================================================================= */
    function openPrintSheet(titleHtml, bodyHtml, footerNote) {
        let sheet = document.getElementById("wcppBsPrintSheet");
        if (!sheet) {
            sheet = document.createElement("div");
            sheet.id = "wcppBsPrintSheet";
            document.body.appendChild(sheet);
        }
        sheet.innerHTML =
            '<div class="wcpp-bs-print-sheet-header">' +
                "<div>" + titleHtml + "</div>" +
                '<div style="font-size:0.76rem; color:#475569; text-align:right;">West Coast Plant Project · plantproject.ca<br>' + escHtml(todayIso()) + "</div>" +
            "</div>" +
            bodyHtml +
            '<div class="wcpp-bs-print-sheet-footer">' +
                "<span>" + escHtml(footerNote || "Generated by West Coast Plant Project Garden Bed Designer") + "</span>" +
                "<span>plantproject.ca</span>" +
            "</div>";

        document.body.classList.add("wcpp-bs-print-sheet-active");
        const cleanup = function () {
            document.body.classList.remove("wcpp-bs-print-sheet-active");
            if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
            global.removeEventListener("afterprint", cleanup);
        };
        global.addEventListener("afterprint", cleanup);
        setTimeout(function () {
            try { global.print(); } catch (_) {}
            setTimeout(cleanup, 1200);
        }, 120);
    }

    function openPrintQrStakes(ctx, season, filterBlockIdOpt) {
        const state = ctx.getState();
        const catalog = ctx.getCatalog();
        const c = ctx.core();
        const isImp = state && state.units === "imperial";
        let items = collectUniqueSeasonCrops(season, catalog, c);
        if (filterBlockIdOpt) {
            const filtered = items.filter(function (x) { return x.meta && x.meta.blockId === filterBlockIdOpt; });
            if (filtered.length) items = filtered;
        }
        if (!items.length) {
            ctx.showToast("Add at least one crop to your garden plan to generate QR plant stakes.");
            return;
        }
        const stakesHtml = '<div class="wcpp-bs-v6-stakes-grid">' + items.map(function (entry) {
            const cr = entry.crop;
            const url = buildPlantUrl(cr, catalog);
            const qr = renderQrSvg(url, 84);
            const spacing = isImp
                ? (Math.max(1, Math.round(Number(cr.inRowCm || 25) / 2.54)) + " in")
                : (Math.round(Number(cr.inRowCm || 25)) + " cm");
            const depth = formatDepthPlainEnglish(cr.seedingDepthMm, isImp).split("(")[0].trim();
            const dtm = Number(cr.dtmDays || 65);
            return '<div class="wcpp-bs-v6-stake-card">' +
                '<div class="wcpp-bs-v6-stake-info">' +
                    '<div class="wcpp-bs-v6-stake-title">' + escHtml(cr.name) + "</div>" +
                    (cr.latin ? '<div class="wcpp-bs-v6-stake-latin">' + escHtml(cr.latin) + "</div>" : "") +
                    '<div class="wcpp-bs-v6-stake-meta">' +
                        "<div><strong>Spacing:</strong> " + escHtml(spacing) + " · <strong>DTM:</strong> " + dtm + "d</div>" +
                        "<div><strong>Depth:</strong> " + escHtml(depth) + "</div>" +
                        (entry.meta && entry.meta.startDate ? "<div><strong>Planted:</strong> " + escHtml(entry.meta.startDate) + "</div>" : "<div><strong>Planted:</strong> _______________</div>") +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-v6-stake-qr">' + qr + "<span>Scan Guide</span></div>" +
            "</div>";
        }).join("") + "</div>";

        openPrintSheet(
            "<h1>Printable QR Plant Stakes (" + items.length + " Crops)</h1><div style='font-size:0.8rem;color:#475569;'>Cut along dashed borders &amp; laminate or tape onto cedar/bamboo garden stakes.</div>",
            stakesHtml,
            "Scan any stake QR code on your phone to open its full Coastal BC growing profile on plantproject.ca"
        );
    }

    /* =========================================================================
       FEATURE 4: BC HABITAT & POLLINATOR SCORECARD + YARD SIGN
       ========================================================================= */
    function computeHabitatScorecard(season, catalog, core) {
        const items = collectUniqueSeasonCrops(season, catalog, core);
        const total = items.length;
        let nativeCount = 0;
        let springBloom = false, summerBloom = false, fallBloom = false;
        const guilds = new Set();
        const layers = new Set();
        let droughtCount = 0;

        items.forEach(function (entry) {
            const cr = entry.crop;
            const prof = (core && typeof core.getCropEcologyProfile === "function")
                ? core.getCropEcologyProfile(cr, catalog)
                : null;
            const isNat = Boolean(cr.isNative || cr.category === "Native" || (prof && prof.isNative));
            if (isNat) nativeCount++;

            const bloom = (prof && Array.isArray(prof.bloomMonths)) ? prof.bloomMonths : [];
            if (bloom.some(function (m) { return m >= 3 && m <= 5; })) springBloom = true;
            if (bloom.some(function (m) { return m >= 6 && m <= 8; })) summerBloom = true;
            if (bloom.some(function (m) { return m >= 9 && m <= 11; })) fallBloom = true;
            if (!bloom.length) {
                const cat = String(cr.category || "").toLowerCase();
                if (cat.includes("herb") || cat.includes("flower") || cat.includes("fruiting")) summerBloom = true;
            }

            if (prof && Array.isArray(prof.pollinators)) {
                prof.pollinators.forEach(function (p) { if (p) guilds.add(p); });
            } else if (isNat || String(cr.category || "").toLowerCase().includes("herb")) {
                guilds.add("Native Bees");
            }

            const cat = String(cr.category || "Herbaceous");
            if (/tree/i.test(cat)) layers.add("Canopy");
            else if (/shrub|berry/i.test(cat)) layers.add("Shrub");
            else if (/ground|cover|leaf/i.test(cat)) layers.add("Groundcover");
            else layers.add("Herbaceous");

            const water = String((prof && prof.waterTier) || (cr && cr.waterNeed) || "").toLowerCase();
            if (water === "low" || isNat || /rosemary|thyme|sage|lavender|yarrow|oregano/i.test(cr.name)) {
                droughtCount++;
            }
        });

        const nativePct = total ? Math.round((nativeCount / total) * 100) : 0;
        const bloomSeasons = (springBloom ? 1 : 0) + (summerBloom ? 1 : 0) + (fallBloom ? 1 : 0);
        const waterWisePct = total ? Math.round((droughtCount / total) * 100) : 0;

        const score = total === 0 ? 0 : Math.min(100, Math.round(
            Math.min(35, nativePct * 0.45 + nativeCount * 4) +
            bloomSeasons * 10 +
            Math.min(20, guilds.size * 5) +
            Math.min(15, layers.size * 5) +
            Math.min(15, waterWisePct * 0.25)
        ));

        let tier = "Seedling Patch";
        if (score >= 82) tier = "Certified Coastal BC Habitat Sanctuary";
        else if (score >= 62) tier = "Pollinator Corridor";
        else if (score >= 38) tier = "Backyard Oasis";

        return {
            total: total,
            nativeCount: nativeCount,
            nativePct: nativePct,
            springBloom: springBloom,
            summerBloom: summerBloom,
            fallBloom: fallBloom,
            bloomSeasons: bloomSeasons,
            guildCount: guilds.size,
            guilds: Array.from(guilds).slice(0, 6),
            layerCount: layers.size,
            waterWisePct: waterWisePct,
            score: score,
            tier: tier
        };
    }

    function renderHabitatScorecardCard(ctx, season) {
        const sc = computeHabitatScorecard(season, ctx.getCatalog(), ctx.core());
        const badgeCls = sc.score >= 70 ? "wcpp-bs-status-ok" : (sc.score >= 40 ? "wcpp-bs-status-warn" : "");

        return '<div class="wcpp-bs-card wcpp-bs-v6-card">' +
            '<div class="wcpp-bs-card-header">' +
                "<div>" +
                    "<h3>BC Habitat &amp; Pollinator Scorecard</h3>" +
                    '<p class="wcpp-bs-v6-sub">Live ecological audit of your plan\'s Coastal BC native ratio, 3-season nectar continuity, and habitat layers.</p>' +
                "</div>" +
                '<div class="wcpp-bs-toolbar-group">' +
                    '<span class="wcpp-bs-badge ' + badgeCls + '">' + sc.score + "/100 \u00b7 " + escHtml(sc.tier) + "</span>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-v6-action="print-yard-sign">' +
                        ctx.svgIcon("print", 13) + "<span>Print Yard Sign</span>" +
                    "</button>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-v6-score-grid">' +
                '<div class="wcpp-bs-v6-metric"><strong>' + sc.nativeCount + " / " + sc.total + "</strong><span>BC Native Species (" + sc.nativePct + "%)</span></div>" +
                '<div class="wcpp-bs-v6-metric"><strong>' + sc.bloomSeasons + " / 3</strong><span>Bloom Seasons (" + [sc.springBloom ? "Spr" : "", sc.summerBloom ? "Sum" : "", sc.fallBloom ? "Fall" : ""].filter(Boolean).join(", ") + (sc.bloomSeasons ? "" : "None yet") + ")</span></div>" +
                '<div class="wcpp-bs-v6-metric"><strong>' + sc.guildCount + "</strong><span>Pollinator &amp; Beneficial Guilds</span></div>" +
                '<div class="wcpp-bs-v6-metric"><strong>' + sc.waterWisePct + "%</strong><span>Summer-Dry / Water-Wise</span></div>" +
            "</div>" +
            (sc.score < 80
                ? '<div class="wcpp-bs-v6-tip-banner"><strong>Next boost:</strong> ' + escHtml(
                    sc.nativeCount < 3
                        ? "Add 2–3 Coastal BC native perennials (e.g. Yarrow, Nodding Onion, Red-Flowering Currant, or Gumweed) to jump up a Habitat Tier."
                        : (!sc.fallBloom
                            ? "Add a late-season bloomer (Douglas Aster, Goldenrod, or Grindelia) to feed overwintering queen bumblebees in September–October."
                            : "Add a woody shrub or groundcover layer to give native bees nesting stems and shelter.")
                ) + "</div>"
                : '<div class="wcpp-bs-v6-tip-banner is-ok"><strong>Sanctuary-grade habitat!</strong> Your garden supports Coastal BC pollinators across seasons. Print your custom Yard Sign to share with neighbours.</div>') +
        "</div>";
    }

    function printHabitatYardSign(ctx, season) {
        const state = ctx.getState();
        const sc = computeHabitatScorecard(season, ctx.getCatalog(), ctx.core());
        const planName = (state && state.planName) || "Coastal BC Pollinator Garden";
        const qr = renderQrSvg("https://plantproject.ca/", 108);

        const emblemSvg = '<svg width="72" height="72" viewBox="0 0 64 64" fill="none" aria-hidden="true">' +
            '<circle cx="32" cy="32" r="30" fill="#dcfce7" stroke="#166534" stroke-width="3"/>' +
            '<path d="M32 50V22" stroke="#166534" stroke-width="3" stroke-linecap="round"/>' +
            '<path d="M32 38C22 38 17 30 19 22C27 21 32 28 32 38Z" fill="#22c55e" stroke="#166534" stroke-width="2"/>' +
            '<path d="M32 33C42 33 47 25 45 17C37 16 32 23 32 33Z" fill="#16a34a" stroke="#166534" stroke-width="2"/>' +
            '<circle cx="32" cy="17" r="4" fill="#f59e0b" stroke="#b45309" stroke-width="1.5"/>' +
        "</svg>";

        const signHtml =
            '<div class="wcpp-bs-v6-yard-sign">' +
                '<div class="wcpp-bs-v6-yard-top">' +
                    emblemSvg +
                    "<div>" +
                        '<div class="wcpp-bs-v6-yard-kicker">WEST COAST PLANT PROJECT · COASTAL BC HABITAT</div>' +
                        '<div class="wcpp-bs-v6-yard-title">' + escHtml(sc.tier) + "</div>" +
                        '<div class="wcpp-bs-v6-yard-sub">' + escHtml(planName) + "</div>" +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-v6-yard-stats">' +
                    "<div><strong>" + sc.score + "/100</strong><span>Habitat Score</span></div>" +
                    "<div><strong>" + sc.nativeCount + "</strong><span>Native BC Species</span></div>" +
                    "<div><strong>" + sc.bloomSeasons + "/3</strong><span>Seasons of Bloom</span></div>" +
                    "<div><strong>" + sc.waterWisePct + "%</strong><span>Water-Wise</span></div>" +
                "</div>" +
                '<div class="wcpp-bs-v6-yard-foot">' +
                    '<div class="wcpp-bs-v6-yard-pledge">' +
                        "<strong>Pesticide-Free Pollinator Corridor</strong><br>" +
                        "This garden grows food and native South Coastal BC flora to shelter native bees, hummingbirds, butterflies, and beneficial insects." +
                    "</div>" +
                    '<div class="wcpp-bs-v6-stake-qr">' + qr + "<span>plantproject.ca</span></div>" +
                "</div>" +
            "</div>";

        openPrintSheet(
            "<h1>Printable Coastal BC Habitat Yard Sign</h1>",
            signHtml,
            "Print on heavy cardstock & laminate for a weatherproof garden fence or bed sign."
        );
    }

    /* =========================================================================
       FEATURE 5: "WHAT'S EATING MY PLANT?" COASTAL BC CROP TROUBLESHOOTER
       ========================================================================= */
    const PNW_SYMPTOMS = [
        {
            id: "holes_slime",
            label: "Ragged Holes & Slime Trails",
            causes: [
                {
                    name: "Slugs & Snails (Coastal BC #1 Spring Pest)",
                    confirm: "Irregular ragged holes in leaves/seedlings and silvery dried mucus trails visible in early morning.",
                    fix: "Water in the morning instead of evening, hand-pick at dusk, set shallow beer traps, or scatter iron-phosphate bait around seedlings.",
                    defenders: ["Yarrow", "Thyme", "Garlic", "Chives"]
                },
                {
                    name: "Cabbage White / Looper Caterpillars",
                    confirm: "Chewed leaf margins with dark green pellet frass (droppings) on Brassicas or leafy greens; no slime.",
                    fix: "Hand-pick green caterpillars from leaf undersides, drape fine insect mesh, or spray organic Bt (Bacillus thuringiensis).",
                    defenders: ["Dill", "Alyssum", "Yarrow", "Marigold"]
                }
            ]
        },
        {
            id: "curled_sticky",
            label: "Curled / Sticky Leaves",
            causes: [
                {
                    name: "Aphids (Green, Black, or Cabbage Aphids)",
                    confirm: "Clusters of tiny soft-bodied insects under tender shoot tips, sticky honeydew, and ants farming them.",
                    fix: "Blast leaf undersides with a sharp jet of cold water every 2 days, or apply diluted insecticidal soap. Avoid excess synthetic nitrogen.",
                    defenders: ["Sweet Alyssum", "Yarrow", "Dill", "Cilantro", "Calendula"]
                }
            ]
        },
        {
            id: "shot_holes",
            label: "Tiny Pinhead 'Shot-Holes'",
            causes: [
                {
                    name: "Flea Beetles",
                    confirm: "Dozens of tiny round 1–2 mm pinholes on radishes, arugula, kale, eggplant, or potatoes; tiny shiny beetles jump when touched.",
                    fix: "Cover young beds with lightweight floating row cover immediately at sowing; keep soil consistently moist.",
                    defenders: ["Radish (Trap Crop)", "Catnip", "Dill", "Mint"]
                }
            ]
        },
        {
            id: "powdery_white",
            label: "White Powdery Coating",
            causes: [
                {
                    name: "Powdery Mildew (Late-Summer Coastal Fungal Bloom)",
                    confirm: "White flour-like patches on upper leaf surfaces of squash, peas, cucumbers, or zinnias during dry days + cool humid nights.",
                    fix: "Prune crowded lower leaves for airflow, water soil at the base (not foliage), and mist early morning with 1 tsp baking soda + drop of soap per litre of water.",
                    defenders: ["Chives", "Garlic", "Borage"]
                }
            ]
        },
        {
            id: "snipped_seedlings",
            label: "Seedlings Snipped Overnight",
            causes: [
                {
                    name: "Cutworms (Nocturnal Soil Caterpillars)",
                    confirm: "Young stems cleanly severed right at the soil line overnight; plump grey-brown grub curled in top 3 cm of soil nearby.",
                    fix: "Slip cardboard or yogurt-cup collars 3 cm into the soil around transplants and scratch the top soil around stems to hand-remove grubs.",
                    defenders: ["Yarrow", "Dill", "Fennel"]
                }
            ]
        },
        {
            id: "leaf_tunnels",
            label: "Squiggly Pale Leaf Tunnels",
            causes: [
                {
                    name: "Spinach / Beet Leafminer",
                    confirm: "Translucent winding trails or blotches inside spinach, chard, or beet leaves; tiny white egg clusters on leaf undersides.",
                    fix: "Pinch and discard affected leaves (do not compost), rub off white egg clusters under leaves, and cover early spring crops with fine mesh.",
                    defenders: ["Sweet Alyssum", "Yarrow", "Chamomile"]
                }
            ]
        },
        {
            id: "wilting_moist",
            label: "Wilting Even in Moist Soil",
            causes: [
                {
                    name: "Root Maggots (Cabbage / Onion / Carrot Rust Fly)",
                    confirm: "Plant wilts in midday sun despite damp soil; roots show brown tunneling or tiny white legless maggots.",
                    fix: "Use fine exclusion mesh from seeding day, rotate crop families 3–4 years, and avoid fresh uncomposted manure before root crops.",
                    defenders: ["Rosemary", "Sage", "Thyme", "Chives"]
                }
            ]
        },
        {
            id: "brown_bottom",
            label: "Dark Sunken Bottom on Fruit",
            causes: [
                {
                    name: "Blossom End Rot (Calcium Transport Stress)",
                    confirm: "Leathery dark brown/black patch on the blossom end of tomatoes, peppers, or zucchini.",
                    fix: "Not a disease! Caused by uneven watering stopping calcium flow. Mulch deeply, water deeply on a steady schedule, and ensure pH is 6.2–6.8.",
                    defenders: ["Basil", "Borage", "Marigold"]
                }
            ]
        },
        {
            id: "yellow_lower",
            label: "Yellowing Lower Leaves",
            causes: [
                {
                    name: "Nitrogen Leaching (Common After Heavy Coastal Rain)",
                    confirm: "Older lower leaves turn uniform pale yellow while new top growth stays smaller and light green.",
                    fix: "Top-dress with 2 cm finished compost, kelp meal, or diluted fish/alfalfa tea, then mulch to prevent rain washout.",
                    defenders: ["Crimson Clover", "Bush Beans", "Lupine"]
                }
            ]
        }
    ];

    function renderCropTroubleshooterCard(ctx, season) {
        const seasonCrops = collectUniqueSeasonCrops(season, ctx.getCatalog(), ctx.core());
        const cropOpts = ['<option value="">Any Crop in My Garden</option>'].concat(seasonCrops.map(function (entry) {
            return '<option value="' + escHtml(entry.name) + '"' + (_v6State.troubleshooterCrop === entry.name ? " selected" : "") + ">" + escHtml(entry.name) + "</option>";
        })).join("");

        const symBtns = PNW_SYMPTOMS.map(function (sym) {
            const active = _v6State.troubleshooterSymptom === sym.id;
            return '<button type="button" class="wcpp-bs-filter-pill' + (active ? " is-active" : "") + '" data-v6-action="ts-symptom" data-symptom="' + sym.id + '">' + escHtml(sym.label) + "</button>";
        }).join("");

        const activeSym = PNW_SYMPTOMS.find(function (s) { return s.id === _v6State.troubleshooterSymptom; }) || PNW_SYMPTOMS[0];
        const cropPrefix = _v6State.troubleshooterCrop ? ("For <strong>" + escHtml(_v6State.troubleshooterCrop) + "</strong>: ") : "";

        const resultsHtml = activeSym.causes.map(function (cause) {
            const defPills = cause.defenders.map(function (d) {
                return '<span class="wcpp-bs-badge wcpp-bs-status-ok">' + escHtml(d) + "</span>";
            }).join(" ");
            return '<div class="wcpp-bs-v6-ts-result">' +
                '<div class="wcpp-bs-v6-ts-title">' + escHtml(cause.name) + "</div>" +
                '<div class="wcpp-bs-v6-ts-line"><strong>How to confirm:</strong> ' + cropPrefix + escHtml(cause.confirm) + "</div>" +
                '<div class="wcpp-bs-v6-ts-line"><strong>Organic Coastal BC fix:</strong> ' + escHtml(cause.fix) + "</div>" +
                '<div class="wcpp-bs-v6-ts-defs"><strong>Companion / Defender Plants:</strong> ' + defPills + "</div>" +
            "</div>";
        }).join("");

        return '<div class="wcpp-bs-card wcpp-bs-v6-card">' +
            '<div class="wcpp-bs-card-header">' +
                "<div>" +
                    "<h3>\"What's Eating My Plant?\" Coastal BC Troubleshooter</h3>" +
                    '<p class="wcpp-bs-v6-sub">Pick the symptom you see in the garden for an instant organic Pacific Northwest diagnosis.</p>' +
                "</div>" +
                '<select class="wcpp-bs-select" data-v6-action="ts-crop" aria-label="Affected crop">' + cropOpts + "</select>" +
            "</div>" +
            '<div class="wcpp-bs-v6-pill-row" role="group" aria-label="Observed plant symptom">' + symBtns + "</div>" +
            '<div class="wcpp-bs-v6-ts-results">' + resultsHtml + "</div>" +
        "</div>";
    }

    /* =========================================================================
       FEATURE 6: COASTAL BC SOIL pH & MYCORRHIZAL LAB
       ========================================================================= */
    function getCropSoilProfile(crop) {
        const name = String((crop && crop.name) || "").toLowerCase();
        const fam = String((crop && crop.family) || "").toLowerCase();
        const cat = String((crop && crop.category) || "").toLowerCase();

        // Acid-loving Ericaceous & Coastal Acid Lovers
        if (/blueberry|salal|cranberry|huckleberry|rhododendron|heather|kinnikinnick|gaultheria|vaccinium|arctostaphylos/.test(name)) {
            return { minPh: 4.5, maxPh: 5.5, myco: "Ericoid", mycoNote: "Needs acidic pine-bark / peat-free ericoid fungal mulch — never lime." };
        }
        if (/potato|solanum tuberosum/.test(name)) {
            return { minPh: 5.0, maxPh: 6.0, myco: "Arbuscular (AM)", mycoNote: "Prefers mildly acidic soil (helps prevent potato scab)." };
        }
        // Non-mycorrhizal families (Brassicas, Chenopods/Beets/Spinach, Buckwheat)
        if (/brassic|crucifer/.test(fam) || /kale|broccoli|cabbage|radish|arugula|turnip|cauliflower|bok choy|mustard|kohlrabi/.test(name)) {
            return { minPh: 6.5, maxPh: 7.2, myco: "Non-Mycorrhizal", mycoNote: "Brassicas do NOT form mycorrhizae — save inoculant for other beds; lime helps prevent clubroot." };
        }
        if (/amaranth|chenopod/.test(fam) || /beet|spinach|chard/.test(name)) {
            return { minPh: 6.4, maxPh: 7.2, myco: "Non-Mycorrhizal", mycoNote: "Non-mycorrhizal — thrives on finished compost and sweet (pH 6.5+) soil." };
        }
        // Higher-pH lovers
        if (/allium|garlic|onion|leek|asparagus|pea|bean|fabaceae/.test(fam + " " + name)) {
            return { minPh: 6.2, maxPh: 7.0, myco: "Arbuscular (AM)", mycoNote: "Strong AM fungal partner (plus Rhizobia for peas/beans) — benefits from gentle liming in acidic BC soil." };
        }
        if (crop && crop.isNative) {
            return { minPh: 5.2, maxPh: 6.6, myco: /tree|shrub|pine|fir|cedar|oak/.test(cat + " " + name) ? "Ectomycorrhizal" : "Arbuscular (AM)", mycoNote: "Adapted to naturally acidic Coastal BC glacial soils; top-dress with leaf mould or woodchip mulch." };
        }
        return { minPh: 6.0, maxPh: 6.8, myco: "Arbuscular (AM)", mycoNote: "Forms beneficial AM fungal networks — avoid deep tilling and top-dress with compost." };
    }

    function renderSoilPhLabCard(ctx, season) {
        const state = ctx.getState();
        const catalog = ctx.getCatalog();
        const c = ctx.core();
        const isImp = state && state.units === "imperial";
        const ph = Number(_v6State.soilPh || 5.8);
        const tex = _v6State.soilTexture || "loam";
        const items = collectUniqueSeasonCrops(season, catalog, c);

        // Compute total bed area m2
        let totalAreaM2 = 0;
        ((season && season.blocks) || []).forEach(function (b) {
            if (b.areaM2 && Number(b.areaM2) > 0) totalAreaM2 += Number(b.areaM2);
            else {
                const beds = Math.max(1, Number(b.bedCount || 1));
                totalAreaM2 += beds * (Number(b.bedWidthCm || 75) / 100) * Number(b.bedLengthM || 3);
            }
        });
        if (totalAreaM2 < 1) totalAreaM2 = 10;

        let happy = 0, tooAcid = 0, tooAlk = 0;
        let amCount = 0, ericoidCount = 0, nonMycoCount = 0;
        const cropChecks = items.map(function (entry) {
            const prof = getCropSoilProfile(entry.crop);
            if (prof.myco.indexOf("Non-") === 0) nonMycoCount++;
            else if (prof.myco === "Ericoid") ericoidCount++;
            else amCount++;

            let status = "ok";
            let msg = "Ideal (" + prof.minPh.toFixed(1) + "\u2013" + prof.maxPh.toFixed(1) + ")";
            if (ph < prof.minPh - 0.05) {
                tooAcid++;
                status = "acid";
                msg = "Too acidic — wants " + prof.minPh.toFixed(1) + "\u2013" + prof.maxPh.toFixed(1);
            } else if (ph > prof.maxPh + 0.05) {
                tooAlk++;
                status = "alk";
                msg = "Too alkaline — wants " + prof.minPh.toFixed(1) + "\u2013" + prof.maxPh.toFixed(1);
            } else {
                happy++;
            }
            return { name: entry.name, status: status, msg: msg, myco: prof.myco, mycoNote: prof.mycoNote };
        });

        // Dolomitic lime calculation for raising pH to 6.5 (g per m2 per +1.0 pH by texture)
        const limeFactorGPerM2 = tex === "sandy" ? 180 : (tex === "clay" ? 380 : (tex === "raised" ? 210 : 270));
        const deltaUp = Math.max(0, 6.5 - ph);
        const limeKg = +((deltaUp * limeFactorGPerM2 * totalAreaM2) / 1000).toFixed(2);
        const limeLb = +(limeKg * 2.20462).toFixed(1);

        // Elemental sulfur calculation if alkaline (> 7.0)
        const deltaDown = Math.max(0, ph - 6.5);
        const sulfurFactorG = tex === "sandy" ? 55 : (tex === "clay" ? 110 : 80);
        const sulfurKg = +((deltaDown * sulfurFactorG * totalAreaM2) / 1000).toFixed(2);
        const sulfurLb = +(sulfurKg * 2.20462).toFixed(1);

        const areaDisp = isImp ? (Math.round(totalAreaM2 * 10.7639) + " ft\u00b2") : (totalAreaM2.toFixed(1) + " m\u00b2");
        let amendAdvice = "Your pH (" + ph.toFixed(1) + ") sits right in the Coastal BC vegetable sweet spot — maintain with 2 cm annual compost top-dressing.";
        if (deltaUp >= 0.25) {
            amendAdvice = "To gently raise " + areaDisp + " of " + tex + " soil toward pH 6.5 for brassicas & vegetables, scratch in about " +
                (isImp ? (limeLb + " lb") : (limeKg + " kg")) + " of Dolomitic Lime in autumn or early spring (skip any blueberry/potato/acid-native beds!).";
        } else if (deltaDown >= 0.45) {
            amendAdvice = "Soil is alkaline for Coastal BC — incorporate about " +
                (isImp ? (sulfurLb + " lb") : (sulfurKg + " kg")) + " of elemental sulfur + pine-bark compost across " + areaDisp + " to unlock iron and phosphorus.";
        }

        const cropRowsHtml = cropChecks.slice(0, 14).map(function (cc) {
            const cls = cc.status === "ok" ? "wcpp-bs-status-ok" : "wcpp-bs-status-warn";
            return '<div class="wcpp-bs-v6-ph-row">' +
                "<div><strong>" + escHtml(cc.name) + '</strong> <span class="wcpp-bs-badge">' + escHtml(cc.myco) + "</span></div>" +
                '<span class="wcpp-bs-badge ' + cls + '">' + escHtml(cc.msg) + "</span>" +
            "</div>";
        }).join("");

        return '<div class="wcpp-bs-card wcpp-bs-v6-card">' +
            '<div class="wcpp-bs-card-header">' +
                "<div>" +
                    "<h3>Coastal BC Soil pH &amp; Mycorrhizal Lab</h3>" +
                    '<p class="wcpp-bs-v6-sub">Calibrated for South Coastal BC rainwater-leached soils (typically pH 5.2–6.2).</p>' +
                "</div>" +
                '<span class="wcpp-bs-badge">pH ' + ph.toFixed(1) + " \u00b7 " + escHtml(areaDisp) + "</span>" +
            "</div>" +
            '<div class="wcpp-bs-form-grid" style="margin-bottom:10px;">' +
                '<div class="wcpp-bs-field">' +
                    "<label>Measured Soil pH: <strong>" + ph.toFixed(1) + "</strong></label>" +
                    '<input type="range" min="4.5" max="8.0" step="0.1" value="' + ph.toFixed(1) + '" data-v6-action="soil-ph-slider" aria-label="Measured Soil pH">' +
                "</div>" +
                '<div class="wcpp-bs-field">' +
                    "<label>Soil Texture</label>" +
                    '<select class="wcpp-bs-select" data-v6-action="soil-texture" aria-label="Soil Texture">' +
                        '<option value="sandy"' + (tex === "sandy" ? " selected" : "") + ">Sandy / Glacial Outwash</option>" +
                        '<option value="loam"' + (tex === "loam" ? " selected" : "") + ">Coastal Loam (Typical BC)</option>" +
                        '<option value="clay"' + (tex === "clay" ? " selected" : "") + ">Heavy Fraser Valley Clay</option>" +
                        '<option value="raised"' + (tex === "raised" ? " selected" : "") + ">Raised Bed Compost Mix</option>" +
                    "</select>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-v6-tip-banner">' + escHtml(amendAdvice) + "</div>" +
            '<div class="wcpp-bs-v6-score-grid" style="margin:10px 0;">' +
                '<div class="wcpp-bs-v6-metric"><strong>' + happy + "</strong><span>Crops in Ideal pH</span></div>" +
                '<div class="wcpp-bs-v6-metric"><strong>' + tooAcid + "</strong><span>Need Lime (Too Acidic)</span></div>" +
                '<div class="wcpp-bs-v6-metric"><strong>' + amCount + "</strong><span>Mycorrhizal (AM) Crops</span></div>" +
                '<div class="wcpp-bs-v6-metric"><strong>' + nonMycoCount + "</strong><span>Non-Mycorrhizal (Skip Inoculant)</span></div>" +
            "</div>" +
            (cropRowsHtml ? '<div class="wcpp-bs-v6-ph-list">' + cropRowsHtml + "</div>" : "") +
        "</div>";
    }

    /* =========================================================================
       FEATURES 7 & 8: LOCAL-FIRST GARDEN JOURNAL & HARVEST LOG +
       ROYAL HEIGHTS SEED LIBRARY SURPLUS & REQUEST BRIDGE
       ========================================================================= */
    function getJournalEntries() {
        const list = readJsonLs(JOURNAL_STORAGE_KEY, []);
        return Array.isArray(list) ? list : [];
    }

    function getSeedSurplusList() {
        const list = readJsonLs(SEED_SURPLUS_STORAGE_KEY, []);
        return Array.isArray(list) ? list : [];
    }

    function getSeedRequestList() {
        const list = readJsonLs(SEED_REQUEST_STORAGE_KEY, []);
        return Array.isArray(list) ? list : [];
    }

    function renderJournalAndSeedsTab(ctx, season) {
        const state = ctx.getState();
        const catalog = ctx.getCatalog();
        const c = ctx.core();
        const isImp = state && state.units === "imperial";
        const entries = getJournalEntries();
        const surplus = getSeedSurplusList();
        const requests = getSeedRequestList();
        const seasonCrops = collectUniqueSeasonCrops(season, catalog, c);

        // Harvest stats
        let harvestCount = 0;
        let totalKg = 0;
        entries.forEach(function (e) {
            if (e.type === "harvest") {
                harvestCount++;
                const q = Number(e.qty || 0);
                if (e.unit === "kg") totalKg += q;
                else if (e.unit === "g") totalKg += q / 1000;
                else if (e.unit === "lb") totalKg += q * 0.453592;
            }
        });
        const totalWtStr = isImp ? ((totalKg * 2.20462).toFixed(1) + " lb") : (totalKg.toFixed(2) + " kg");

        const filteredEntries = _v6State.journalFilter === "all"
            ? entries
            : entries.filter(function (e) { return e.type === _v6State.journalFilter; });

        const filterPills = [
            { id: "all", label: "All (" + entries.length + ")" },
            { id: "harvest", label: "Harvests (" + harvestCount + ")" },
            { id: "sowing", label: "Sowings" },
            { id: "observation", label: "Notes" },
            { id: "pest", label: "Pests / Weather" },
            { id: "seed", label: "Seeds Saved" }
        ].map(function (fp) {
            return '<button type="button" class="wcpp-bs-filter-pill' + (_v6State.journalFilter === fp.id ? " is-active" : "") + '" data-v6-action="journal-filter" data-filter="' + fp.id + '">' + escHtml(fp.label) + "</button>";
        }).join("");

        const cropDatalist = '<datalist id="wcppV6CropSuggestions">' +
            seasonCrops.map(function (x) { return '<option value="' + escHtml(x.name) + '"></option>'; }).join("") +
        "</datalist>";

        const entriesHtml = filteredEntries.length ? filteredEntries.map(function (e) {
            const qtyBadge = Number(e.qty) > 0 ? ('<span class="wcpp-bs-badge wcpp-bs-status-ok">' + escHtml(e.qty + " " + (e.unit || "")) + "</span>") : "";
            return '<div class="wcpp-bs-v6-journal-row">' +
                '<div class="wcpp-bs-v6-journal-meta">' +
                    '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">' +
                        '<span class="wcpp-bs-badge">' + escHtml(e.date || "") + "</span>" +
                        '<span class="wcpp-bs-badge">' + escHtml(String(e.type || "note").toUpperCase()) + "</span>" +
                        "<strong>" + escHtml(e.crop || "Garden Note") + "</strong>" +
                        qtyBadge +
                    "</div>" +
                    (e.notes ? '<div class="wcpp-bs-v6-journal-note">' + escHtml(e.notes) + "</div>" : "") +
                "</div>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-v6-action="journal-delete" data-id="' + escHtml(e.id) + '">Remove</button>' +
            "</div>";
        }).join("") : '<p style="margin:0; font-size:0.84rem; color:var(--bs-muted);">No journal entries yet. Log your first sowing, harvest weight, or garden observation above — everything stays saved privately in your browser.</p>';

        // Royal Heights Seed Library section
        const surplusHtml = surplus.length ? surplus.map(function (s) {
            return '<div class="wcpp-bs-v6-journal-row">' +
                '<div class="wcpp-bs-v6-journal-meta">' +
                    '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">' +
                        "<strong>" + escHtml(s.crop) + "</strong>" +
                        '<span class="wcpp-bs-badge wcpp-bs-status-ok">' + escHtml(s.packets) + " pkts</span>" +
                        '<span class="wcpp-bs-badge">Harvest ' + escHtml(s.year) + "</span>" +
                    "</div>" +
                    (s.notes ? '<div class="wcpp-bs-v6-journal-note">' + escHtml(s.notes) + "</div>" : "") +
                "</div>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-v6-action="surplus-delete" data-id="' + escHtml(s.id) + '">Remove</button>' +
            "</div>";
        }).join("") : '<p style="margin:0; font-size:0.82rem; color:var(--bs-muted);">No surplus packets logged yet. Add extra open-pollinated or native seeds you want to share with the Royal Heights Seed Library.</p>';

        const reqSet = new Set(requests.map(function (r) { return String(r).toLowerCase(); }));
        const planQuickChips = seasonCrops.slice(0, 16).map(function (entry) {
            const on = reqSet.has(entry.name.toLowerCase());
            return '<button type="button" class="wcpp-bs-chip-toggle' + (on ? " is-on" : "") + '" data-v6-action="seed-req-toggle" data-crop="' + escHtml(entry.name) + '">' +
                escHtml((on ? "Requested: " : "+ ") + entry.name) +
            "</button>";
        }).join("");

        return '<div class="wcpp-bs-v6-stack">' +
            cropDatalist +
            '<div class="wcpp-bs-card wcpp-bs-v6-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<div>" +
                        "<h3>Local-First Garden Journal &amp; Harvest Log</h3>" +
                        '<p class="wcpp-bs-v6-sub">Track sowings, germination dates, harvest yields, and weather observations — stored offline on your device.</p>' +
                    "</div>" +
                    '<div class="wcpp-bs-toolbar-group">' +
                        '<span class="wcpp-bs-badge wcpp-bs-status-ok">' + harvestCount + " Harvests \u00b7 " + escHtml(totalWtStr) + "</span>" +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-v6-action="journal-export-csv">' + ctx.svgIcon("download", 13) + "<span>Export CSV</span></button>" +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-form-grid" style="margin-bottom:10px;">' +
                    '<div class="wcpp-bs-field"><label>Date</label><input type="date" class="wcpp-bs-input" id="wcppV6JournalDate" value="' + escHtml(todayIso()) + '"></div>' +
                    '<div class="wcpp-bs-field"><label>Entry Type</label><select class="wcpp-bs-select" id="wcppV6JournalType">' +
                        '<option value="harvest">Harvest</option>' +
                        '<option value="sowing">Sowing / Transplant</option>' +
                        '<option value="observation">Garden Note</option>' +
                        '<option value="pest">Pest / Weather</option>' +
                        '<option value="seed">Seed Saved</option>' +
                    "</select></div>" +
                    '<div class="wcpp-bs-field"><label>Crop / Plant</label><input type="text" class="wcpp-bs-input" id="wcppV6JournalCrop" list="wcppV6CropSuggestions" placeholder="e.g. Sungold Tomato, Kale..."></div>' +
                    '<div class="wcpp-bs-field"><label>Yield / Qty (Opt.)</label><div style="display:flex; gap:6px;"><input type="number" step="0.1" min="0" class="wcpp-bs-input" id="wcppV6JournalQty" placeholder="0" style="width:90px;"><select class="wcpp-bs-select" id="wcppV6JournalUnit" style="min-width:86px;"><option value="' + (isImp ? "lb" : "kg") + '">' + (isImp ? "lb" : "kg") + '</option><option value="g">g</option><option value="bunches">bunches</option><option value="packets">packets</option></select></div></div>' +
                    '<div class="wcpp-bs-field" style="grid-column:1 / -1;"><label>Notes</label><input type="text" class="wcpp-bs-input" id="wcppV6JournalNotes" placeholder="Sprout rate, flavour notes, frost cover used, seed source..."></div>' +
                "</div>" +
                '<div style="margin-bottom:12px;"><button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-v6-action="journal-add">' + ctx.svgIcon("plus", 13) + "<span>Add Journal Entry</span></button></div>" +
                '<div class="wcpp-bs-v6-pill-row" style="margin-bottom:10px;">' + filterPills + "</div>" +
                '<div class="wcpp-bs-v6-journal-list">' + entriesHtml + "</div>" +
            "</div>" +

            '<div class="wcpp-bs-card wcpp-bs-v6-card">' +
                '<div class="wcpp-bs-card-header">' +
                    "<div>" +
                        "<h3>Royal Heights Seed Library Surplus &amp; Request Bridge</h3>" +
                        '<p class="wcpp-bs-v6-sub">Surrey Royal Heights Seed &amp; Book Library (11531 97 Ave, Surrey, BC) — share surplus seed packets or build a seed request list from your plan.</p>' +
                    "</div>" +
                    '<div class="wcpp-bs-toolbar-group">' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-v6-action="surplus-print-slips">' + ctx.svgIcon("print", 13) + "<span>Print Packet Slips</span></button>" +
                        '<a class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" href="orders.html">Open Orders &amp; Requests</a>' +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-v6-two-col">' +
                    '<div class="wcpp-bs-v6-subpanel">' +
                        "<h4>Share Surplus Seeds</h4>" +
                        '<div class="wcpp-bs-form-grid" style="margin-bottom:8px;">' +
                            '<div class="wcpp-bs-field"><label>Species / Variety</label><input type="text" class="wcpp-bs-input" id="wcppV6SurplusCrop" list="wcppV6CropSuggestions" placeholder="e.g. Purple Sprouting Broccoli"></div>' +
                            '<div class="wcpp-bs-field"><label>Packets</label><input type="number" min="1" max="200" class="wcpp-bs-input" id="wcppV6SurplusPackets" value="5"></div>' +
                            '<div class="wcpp-bs-field"><label>Harvest Year</label><input type="number" min="2020" max="2030" class="wcpp-bs-input" id="wcppV6SurplusYear" value="' + new Date().getFullYear() + '"></div>' +
                            '<div class="wcpp-bs-field"><label>Origin / Isolation Note</label><input type="text" class="wcpp-bs-input" id="wcppV6SurplusNotes" placeholder="Open-pollinated, Surrey BC grown"></div>' +
                        "</div>" +
                        '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">' +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-v6-action="surplus-add">' + ctx.svgIcon("plus", 13) + "<span>Add Surplus Lot</span></button>" +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-v6-action="surplus-copy">' + ctx.svgIcon("copy", 13) + "<span>Copy Donation List</span></button>" +
                        "</div>" +
                        '<div class="wcpp-bs-v6-journal-list">' + surplusHtml + "</div>" +
                    "</div>" +
                    '<div class="wcpp-bs-v6-subpanel">' +
                        "<h4>Seed Request List (" + requests.length + ")</h4>" +
                        '<p style="margin:0 0 8px; font-size:0.78rem; color:var(--bs-muted);">Tap crops from your active season plan (or add custom species) to build a pickup/request list for the Royal Heights Seed Library.</p>' +
                        '<div class="wcpp-bs-v6-pill-row" style="margin-bottom:10px;">' + (planQuickChips || '<span style="font-size:0.8rem; color:var(--bs-muted);">Add crops to your beds to quick-pick them here.</span>') + "</div>" +
                        '<div style="display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap;">' +
                            '<input type="text" class="wcpp-bs-input" id="wcppV6ReqInput" placeholder="Add another species to request..." style="flex:1 1 160px;">' +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-v6-action="seed-req-add">Add</button>' +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-v6-action="seed-req-copy">' + ctx.svgIcon("copy", 13) + "<span>Copy Request List</span></button>" +
                        "</div>" +
                        (requests.length
                            ? '<div class="wcpp-bs-v6-req-summary"><strong>Selected (' + requests.length + "):</strong> " + escHtml(requests.join(", ")) + "</div>"
                            : "") +
                    "</div>" +
                "</div>" +
            "</div>" +
        "</div>";
    }

    function printSurplusPacketSlips(ctx) {
        const surplus = getSeedSurplusList();
        if (!surplus.length) {
            ctx.showToast("Add at least one surplus seed lot before printing packet slips.");
            return;
        }
        const qr = renderQrSvg("https://plantproject.ca/orders.html", 72);
        const slipsHtml = '<div class="wcpp-bs-v6-stakes-grid">' + surplus.map(function (s) {
            return '<div class="wcpp-bs-v6-stake-card">' +
                '<div class="wcpp-bs-v6-stake-info">' +
                    '<div style="font-size:0.68rem; font-weight:800; color:#166534; text-transform:uppercase;">Royal Heights Seed Library · Surrey BC</div>' +
                    '<div class="wcpp-bs-v6-stake-title">' + escHtml(s.crop) + "</div>" +
                    '<div class="wcpp-bs-v6-stake-meta">' +
                        "<div><strong>Harvest Year:</strong> " + escHtml(s.year) + " · <strong>Qty:</strong> " + escHtml(s.packets) + " pkts</div>" +
                        "<div><strong>Notes:</strong> " + escHtml(s.notes || "Open-pollinated · Local BC grown") + "</div>" +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-v6-stake-qr">' + qr + "<span>Seed Library</span></div>" +
            "</div>";
        }).join("") + "</div>";

        openPrintSheet(
            "<h1>Royal Heights Seed Library — Donation Packet Slips</h1><div style='font-size:0.8rem;color:#475569;'>Drop-off: 11531 97 Avenue, Surrey, BC · plantproject.ca</div>",
            slipsHtml,
            "Thank you for sharing locally adapted seeds with the Surrey Royal Heights community!"
        );
    }

    /* =========================================================================
       UNIFIED V6 EVENT HANDLERS (CLICK & CHANGE/INPUT)
       ========================================================================= */
    function stopTimeLapseTimer() {
        if (_v6State.timeLapseTimer) {
            clearInterval(_v6State.timeLapseTimer);
            _v6State.timeLapseTimer = null;
        }
        _v6State.timeLapsePlaying = false;
    }

    function handleClick(ctx, actEl) {
        const act = actEl.getAttribute("data-v6-action");
        if (!act) return false;
        const c = ctx.core();
        const state = ctx.getState();
        const season = state && c ? c.getActiveSeason(state) : null;

        if (act === "print-qr-stakes") {
            openPrintQrStakes(ctx, season, actEl.getAttribute("data-block-id") || "");
            return true;
        }
        if (act === "print-yard-sign") {
            printHabitatYardSign(ctx, season);
            return true;
        }
        if (act === "ts-symptom") {
            _v6State.troubleshooterSymptom = actEl.getAttribute("data-symptom") || "holes_slime";
            ctx.renderSimulator();
            return true;
        }
        if (act === "tl-set-month") {
            stopTimeLapseTimer();
            setTimeLapseMonth(Number(actEl.getAttribute("data-month") || 0));
            ctx.renderSimulator();
            return true;
        }
        if (act === "tl-toggle-play") {
            if (_v6State.timeLapsePlaying) {
                stopTimeLapseTimer();
                ctx.renderSimulator();
            } else {
                _v6State.timeLapsePlaying = true;
                if (_v6State.timeLapseMonth === 0) _v6State.timeLapseMonth = 1;
                ctx.renderSimulator();
                _v6State.timeLapseTimer = setInterval(function () {
                    if (ctx.getSubTab && ctx.getSubTab() !== "farm-layout") {
                        stopTimeLapseTimer();
                        return;
                    }
                    _v6State.timeLapseMonth = (_v6State.timeLapseMonth % 12) + 1;
                    ctx.renderSimulator();
                }, 1100);
            }
            return true;
        }
        if (act === "journal-filter") {
            _v6State.journalFilter = actEl.getAttribute("data-filter") || "all";
            ctx.renderSimulator();
            return true;
        }
        if (act === "journal-add") {
            const dateEl = document.getElementById("wcppV6JournalDate");
            const typeEl = document.getElementById("wcppV6JournalType");
            const cropEl = document.getElementById("wcppV6JournalCrop");
            const qtyEl = document.getElementById("wcppV6JournalQty");
            const unitEl = document.getElementById("wcppV6JournalUnit");
            const notesEl = document.getElementById("wcppV6JournalNotes");
            const cropVal = (cropEl && cropEl.value || "").trim();
            const notesVal = (notesEl && notesEl.value || "").trim();
            if (!cropVal && !notesVal) {
                ctx.showToast("Enter a crop name or garden note to save an entry.");
                return true;
            }
            const list = getJournalEntries();
            list.unshift({
                id: "j_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                date: (dateEl && dateEl.value) || todayIso(),
                type: (typeEl && typeEl.value) || "observation",
                crop: cropVal || "General Garden",
                qty: Number(qtyEl && qtyEl.value) || 0,
                unit: (unitEl && unitEl.value) || "kg",
                notes: notesVal
            });
            writeJsonLs(JOURNAL_STORAGE_KEY, list);
            ctx.renderSimulator();
            ctx.showToast("Saved journal entry locally.");
            return true;
        }
        if (act === "journal-delete") {
            const id = actEl.getAttribute("data-id");
            const next = getJournalEntries().filter(function (x) { return x.id !== id; });
            writeJsonLs(JOURNAL_STORAGE_KEY, next);
            ctx.renderSimulator();
            ctx.showToast("Removed journal entry.");
            return true;
        }
        if (act === "journal-export-csv") {
            const list = getJournalEntries();
            const rows = [["Date", "Type", "Crop", "Quantity", "Unit", "Notes"]].concat(list.map(function (e) {
                return [e.date, e.type, e.crop, e.qty || "", e.unit || "", e.notes || ""];
            }));
            const csv = rows.map(function (r) {
                return r.map(function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }).join(",");
            }).join("\r\n");
            try {
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "wcpp-garden-journal-" + todayIso() + ".csv";
                document.body.appendChild(a);
                a.click();
                setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 300);
                ctx.showToast("Exported Garden Journal CSV (" + list.length + " entries).");
            } catch (_) {
                ctx.showToast("Unable to download CSV in this browser.");
            }
            return true;
        }
        if (act === "surplus-add") {
            const cropEl = document.getElementById("wcppV6SurplusCrop");
            const pktEl = document.getElementById("wcppV6SurplusPackets");
            const yrEl = document.getElementById("wcppV6SurplusYear");
            const notesEl = document.getElementById("wcppV6SurplusNotes");
            const cropVal = (cropEl && cropEl.value || "").trim();
            if (!cropVal) {
                ctx.showToast("Enter a species or variety name to add a surplus seed lot.");
                return true;
            }
            const list = getSeedSurplusList();
            list.unshift({
                id: "s_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                crop: cropVal,
                packets: Math.max(1, Number(pktEl && pktEl.value) || 1),
                year: Number(yrEl && yrEl.value) || new Date().getFullYear(),
                notes: (notesEl && notesEl.value || "").trim()
            });
            writeJsonLs(SEED_SURPLUS_STORAGE_KEY, list);
            ctx.renderSimulator();
            ctx.showToast("Added surplus seed lot for Royal Heights Seed Library.");
            return true;
        }
        if (act === "surplus-delete") {
            const id = actEl.getAttribute("data-id");
            writeJsonLs(SEED_SURPLUS_STORAGE_KEY, getSeedSurplusList().filter(function (x) { return x.id !== id; }));
            ctx.renderSimulator();
            ctx.showToast("Removed surplus lot.");
            return true;
        }
        if (act === "surplus-copy") {
            const list = getSeedSurplusList();
            if (!list.length) {
                ctx.showToast("Add at least one surplus lot first.");
                return true;
            }
            const txt = "Royal Heights Seed Library Surplus Donation (" + todayIso() + "):\n" +
                list.map(function (s) { return "- " + s.crop + " (" + s.packets + " pkts, " + s.year + (s.notes ? " — " + s.notes : "") + ")"; }).join("\n");
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(txt).catch(function () {});
            }
            ctx.showToast("Copied donation summary (" + list.length + " lots) to clipboard.");
            return true;
        }
        if (act === "surplus-print-slips") {
            printSurplusPacketSlips(ctx);
            return true;
        }
        if (act === "seed-req-toggle") {
            const cropName = (actEl.getAttribute("data-crop") || "").trim();
            if (!cropName) return true;
            const list = getSeedRequestList();
            const idx = list.findIndex(function (x) { return String(x).toLowerCase() === cropName.toLowerCase(); });
            if (idx >= 0) list.splice(idx, 1);
            else list.push(cropName);
            writeJsonLs(SEED_REQUEST_STORAGE_KEY, list);
            ctx.renderSimulator();
            return true;
        }
        if (act === "seed-req-add") {
            const inp = document.getElementById("wcppV6ReqInput");
            const val = (inp && inp.value || "").trim();
            if (!val) {
                ctx.showToast("Type a species name to add to your request list.");
                return true;
            }
            const list = getSeedRequestList();
            if (!list.some(function (x) { return String(x).toLowerCase() === val.toLowerCase(); })) {
                list.push(val);
                writeJsonLs(SEED_REQUEST_STORAGE_KEY, list);
            }
            ctx.renderSimulator();
            ctx.showToast("Added " + val + " to your Royal Heights Seed Library request list.");
            return true;
        }
        if (act === "seed-req-copy") {
            const list = getSeedRequestList();
            if (!list.length) {
                ctx.showToast("Select or add at least one crop to your request list first.");
                return true;
            }
            const txt = "Royal Heights Seed Library Request List (" + todayIso() + "):\n" + list.map(function (x) { return "- " + x; }).join("\n");
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(txt).catch(function () {});
            }
            ctx.showToast("Copied request list (" + list.length + " species) to clipboard.");
            return true;
        }
        return false;
    }

    function handleChange(ctx, el) {
        const act = el.getAttribute("data-v6-action");
        if (!act) return false;
        if (act === "sowing-lookup-crop") {
            _v6State.sowingFilterCrop = el.value || "";
            ctx.renderSimulator();
            return true;
        }
        if (act === "soil-ph-slider") {
            _v6State.soilPh = Number(el.value || 5.8);
            ctx.renderSimulator();
            return true;
        }
        if (act === "soil-texture") {
            _v6State.soilTexture = el.value || "loam";
            ctx.renderSimulator();
            return true;
        }
        if (act === "ts-crop") {
            _v6State.troubleshooterCrop = el.value || "";
            ctx.renderSimulator();
            return true;
        }
        if (act === "tl-slider") {
            stopTimeLapseTimer();
            setTimeLapseMonth(Number(el.value || 6));
            ctx.renderSimulator();
            return true;
        }
        return false;
    }

    global.WCPPBedSimulatorV6 = {
        version: "6.0.0",
        renderQrSvg: renderQrSvg,
        buildQrMatrix: buildQrMatrix,
        computeCropGrowthStage: computeCropGrowthStage,
        getTimeLapseMonth: getTimeLapseMonth,
        setTimeLapseMonth: setTimeLapseMonth,
        getBlockTimeLapseVisual: getBlockTimeLapseVisual,
        renderFarmTimeLapseBar: renderFarmTimeLapseBar,
        renderSowingGuideCard: renderSowingGuideCard,
        openPrintQrStakes: openPrintQrStakes,
        computeHabitatScorecard: computeHabitatScorecard,
        renderHabitatScorecardCard: renderHabitatScorecardCard,
        printHabitatYardSign: printHabitatYardSign,
        renderCropTroubleshooterCard: renderCropTroubleshooterCard,
        renderSoilPhLabCard: renderSoilPhLabCard,
        renderJournalAndSeedsTab: renderJournalAndSeedsTab,
        getJournalEntries: getJournalEntries,
        handleClick: handleClick,
        handleChange: handleChange
    };
})(typeof window !== "undefined" ? window : globalThis);
