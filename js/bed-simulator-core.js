(function (global) {
    "use strict";

    // =========================================================================
    // CONSTANTS & REFERENCE TABLES
    // =========================================================================
    const STORAGE_KEY = "wcpp_bed_sim_v1";
    const MAX_UNDO_SNAPSHOTS = 30;
    const TRAY_AREA_1020_M2 = 0.15;

    // South Coastal BC (Surrey / Lower Mainland Zone 8a) monthly mean air temperatures (°C), Jan–Dec
    const BC_MONTHLY_TEMP_C = [3.6, 5.1, 7.1, 9.9, 13.4, 16.3, 18.8, 18.7, 15.6, 10.6, 6.2, 3.6];

    const SURREY_CLIMATE_FALLBACK = {
        name: "Surrey",
        lastSpring: "Apr 6",
        firstFall: "Nov 16",
        fallDOY: 320,
        days: 225,
        lat: 49.1678,
        lon: -122.8274
    };

    const DEFAULT_ROTATION_CYCLES = {
        Solanaceae: 4,
        Brassicaceae: 4,
        Amaryllidaceae: 4,
        Alliaceae: 4,
        Apiaceae: 3,
        Cucurbitaceae: 3,
        Fabaceae: 3,
        Amaranthaceae: 3,
        Asteraceae: 2,
        Lamiaceae: 2,
        Poaceae: 2,
        Rosaceae: 3,
        Convolvulaceae: 3,
        Polygonaceae: 2,
        Boraginaceae: 2,
        Tropaeolaceae: 2,
        Malvaceae: 3,
        Valerianaceae: 2,
        Portulacaceae: 2
    };

    const FAMILY_COLORS = {
        Solanaceae: "#dc2626",
        Brassicaceae: "#15803d",
        Apiaceae: "#ea580c",
        Amaryllidaceae: "#7c3aed",
        Alliaceae: "#7c3aed",
        Cucurbitaceae: "#ca8a04",
        Fabaceae: "#0284c7",
        Amaranthaceae: "#be185d",
        Asteraceae: "#0d9488",
        Lamiaceae: "#4f46e5",
        Poaceae: "#65a30d",
        Rosaceae: "#e11d48",
        Boraginaceae: "#2563eb",
        Tropaeolaceae: "#d97706",
        Polygonaceae: "#9333ea",
        Convolvulaceae: "#c2410c"
    };

    const CATEGORY_COLORS = {
        Vegetable: "#15803d",
        Fruiting: "#16a34a",
        Leafy: "#15803d",
        Root: "#c2410c",
        Brassica: "#047857",
        Allium: "#6d28d9",
        Legume: "#0284c7",
        Berry: "#be123c",
        Herb: "#0f766e",
        Fruit: "#b91c1c",
        Flower: "#b45309",
        "Cover Crop": "#4d7c0f",
        "BC Native": "#0369a1"
    };

    const STANDARD_BED_PRESETS = [
        {
            id: "market-metric",
            name: "Market Standard (75 cm × 30 m)",
            units: "metric",
            bedWidthCm: 75,
            pathWidthCm: 30,
            bedLengthM: 30,
            benchAreaM2: 40
        },
        {
            id: "market-imperial",
            name: "Market Standard (30 in × 100 ft)",
            units: "imperial",
            bedWidthCm: 76.2,
            pathWidthCm: 45.72,
            bedLengthM: 30.48,
            benchAreaM2: 40
        },
        {
            id: "backyard-4x8",
            name: "Backyard Raised Bed (4 × 8 ft)",
            units: "imperial",
            bedWidthCm: 121.92,
            pathWidthCm: 60.96,
            bedLengthM: 2.4384,
            benchAreaM2: 6
        }
    ];

    const PLANT_SYNONYM_ALIASES = {
        "coriander": "cilantro",
        "chives": "chive",
        "chamomile": "german chamomile",
        "marigold": "marigold (french)",
        "marigolds": "marigold (french)",
        "french marigold": "marigold (french)",
        "french marigolds": "marigold (french)",
        "african marigold": "marigold (african)",
        "african marigolds": "marigold (african)",
        "signet marigold": "marigold (signet)",
        "green bean": "green bean",
        "green beans": "bush green bean",
        "bush bean": "bush green bean",
        "green bean (bush)": "bush green bean",
        "bush green beans": "bush green bean",
        "pole bean": "green bean (pole)",
        "pole beans": "green bean (pole)",
        "fava": "fava bean",
        "broad bean": "fava bean",
        "bean, broad (fava)": "fava bean",
        "bean, bush & pole": "bush green bean",
        "sweet corn": "corn",
        "corn (sweet)": "corn",
        "java corn": "corn",
        "sugar jean corn": "corn",
        "sweet pepper": "pepper",
        "pepper (sweet & hot)": "pepper",
        "brussels sprouts": "brussel sprout",
        "brussels sprout": "brussel sprout",
        "black-eyed pea": "black-eyed peas",
        "sweet allysum": "sweet alyssum",
        "alyssum": "sweet alyssum",
        "lavender": "lavender (english)",
        "lavender (portugese)": "lavender (french)",
        "portuguese lavender": "lavender (french)",
        "pak choi & choi sum": "bok choi",
        "pac choi & choi sum": "bok choi",
        "pac choi": "pak choi",
        "kale & collards": "kale",
        "pea (shelling, snap, snow)": "pea",
        "peas": "pea",
        "squash & pumpkin": "squash (summer)",
        "summer squash": "squash (summer)",
        "winter squash": "squash (winter)",
        "cabbage (spring/fall)": "cabbage",
        "celery / celeriac": "celery",
        "onion (bulbing)": "onion",
        "onion, scallion (bunching)": "scallion",
        "cilantro (coriander)": "cilantro",
        "swiss chard": "swiss chard",
        "chard": "chard",
        "red-flowering currant": "red-flowering currant",
        "red-osier dogwood": "red-osier dogwood",
        "tall oregon-grape": "tall oregon-grape",
        "tall oregon grape": "tall oregon-grape",
        "oregon grape": "tall oregon-grape",
        "wild strawberry": "coastal wild strawberry",
        "saskatoon": "saskatoon",
        "saskatoon serviceberry": "saskatoon",
        "serviceberry": "saskatoon",
        "sword fern": "western sword fern",
        "camas": "common camas",
        "shooting star": "henderson's shooting star",
        "dogwood": "red-osier dogwood",
        "ninebark": "pacific ninebark"
    };

    const GROUP_FAMILY_ALIASES = {
        "brassica": "Brassicaceae",
        "brassicas": "Brassicaceae",
        "cole crops": "Brassicaceae",
        "cole crop": "Brassicaceae",
        "nightshade": "Solanaceae",
        "nightshades": "Solanaceae",
        "allium": "Amaryllidaceae",
        "alliums": "Amaryllidaceae",
        "onion family": "Amaryllidaceae",
        "legume": "Fabaceae",
        "legumes": "Fabaceae",
        "cucurbit": "Cucurbitaceae",
        "cucurbits": "Cucurbitaceae"
    };

    const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const MONTH_MAP = {
        jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
        apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
        aug: 8, august: 8, sep: 9, sept: 9, september: 9,
        oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
    };

    const NUTRIENT_LEVEL = {
        "Soil Builder": -1,
        "None": 0,
        "Light": 1,
        "Medium": 2,
        "Heavy": 3
    };

    const COMPANION_COLUMNS = [
        "Companion Plants",
        "Companion Plants to Improve Growth/Vigor and/or Flavour",
        "Companion Plants to Improve Shade",
        "Companion Plants to Improve Soil",
        "Companion Plants to Improve Yield",
        "Companion Plants to Repel/Deter Harmful Insects",
        "Companion Plants to Trap Harmful Insects",
        "Companion Plants to Attract Beneficial Natural Predators",
        "Companion Plants to Increase Pollination",
        "Companion Plants in Containers"
    ];

    let _cachedCatalog = null;
    let _catalogPromise = null;
    let _uidCounter = 1;

    // =========================================================================
    // LOW-LEVEL HELPERS (DATES, UNITS, TEXT, COLORS)
    // =========================================================================
    function generateId(prefix) {
        _uidCounter += 1;
        return (prefix || "id") + "_" + Date.now().toString(36) + "_" + _uidCounter.toString(36);
    }

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function pad2(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function parseIsoDateUtc(iso) {
        if (!iso || typeof iso !== "string") return null;
        const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return null;
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const d = Number(m[3]);
        const dt = new Date(Date.UTC(y, mo, d));
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function formatIsoDateUtc(dt) {
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "";
        return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate());
    }

    function addDaysIso(iso, days) {
        const dt = parseIsoDateUtc(iso);
        if (!dt) return iso || "";
        const d = Math.round(Number(days) || 0);
        dt.setUTCDate(dt.getUTCDate() + d);
        return formatIsoDateUtc(dt);
    }

    function diffDaysIso(startIso, endIso) {
        const a = parseIsoDateUtc(startIso);
        const b = parseIsoDateUtc(endIso);
        if (!a || !b) return 0;
        return Math.round((b.getTime() - a.getTime()) / 86400000);
    }

    function shiftIsoYear(iso, fromYear, toYear) {
        const dt = parseIsoDateUtc(iso);
        if (!dt) return iso || "";
        const delta = Number(toYear) - Number(fromYear);
        const targetYear = dt.getUTCFullYear() + delta;
        const month = dt.getUTCMonth();
        const maxDay = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
        const day = Math.min(dt.getUTCDate(), maxDay);
        return formatIsoDateUtc(new Date(Date.UTC(targetYear, month, day)));
    }

    function getIsoWeekNumber(iso) {
        const dt = parseIsoDateUtc(iso);
        if (!dt) return 1;
        const jan1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
        const days = Math.floor((dt.getTime() - jan1.getTime()) / 86400000);
        return clamp(Math.floor(days / 7) + 1, 1, 52);
    }

    function dateToYearFraction(iso, year) {
        const dt = parseIsoDateUtc(iso);
        if (!dt) return 0;
        const yr = Number(year) || dt.getUTCFullYear();
        const start = Date.UTC(yr, 0, 1);
        const end = Date.UTC(yr + 1, 0, 1);
        return (dt.getTime() - start) / (end - start);
    }

    function parseMonthDayToIso(label, year) {
        const yr = Number(year) || new Date().getFullYear();
        if (!label || typeof label !== "string") return yr + "-04-06";
        const parts = label.trim().split(/\s+/);
        const mo = MONTH_MAP[(parts[0] || "").toLowerCase().replace(/\./g, "")];
        const day = parseInt(parts[1], 10);
        if (!mo || !Number.isFinite(day)) return yr + "-04-06";
        return yr + "-" + pad2(mo) + "-" + pad2(day);
    }

    function cmToIn(cm) {
        return +(Number(cm || 0) / 2.54).toFixed(1);
    }

    function inToCm(inches) {
        return +(Number(inches || 0) * 2.54).toFixed(1);
    }

    function mToFt(m) {
        return +(Number(m || 0) * 3.28084).toFixed(1);
    }

    function ftToM(ft) {
        return +(Number(ft || 0) / 3.28084).toFixed(2);
    }

    function formatCleanNum(n, decimals) {
        const v = Number(n);
        if (!Number.isFinite(v)) return "0";
        const fixed = v.toFixed(decimals == null ? 1 : decimals);
        return fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
    }

    function formatLength(meters, units) {
        const m = Number(meters) || 0;
        if (units === "imperial") {
            const ft = m * 3.28084;
            const rounded = Math.abs(ft - Math.round(ft)) < 0.08 ? Math.round(ft) : +ft.toFixed(1);
            return formatCleanNum(rounded, 1) + " ft";
        }
        return formatCleanNum(m, 1) + " m";
    }

    function formatSpacing(cm, units) {
        const c = Number(cm) || 0;
        if (units === "imperial") {
            const inches = c / 2.54;
            const rounded = Math.abs(inches - Math.round(inches)) < 0.08 ? Math.round(inches) : +inches.toFixed(1);
            return formatCleanNum(rounded, 1) + " in";
        }
        return formatCleanNum(c, 1) + " cm";
    }

    function getFamilyColor(family) {
        if (!family) return "#475569";
        if (FAMILY_COLORS[family]) return FAMILY_COLORS[family];
        let hash = 0;
        for (let i = 0; i < family.length; i++) {
            hash = ((hash << 5) - hash) + family.charCodeAt(i);
            hash |= 0;
        }
        const hue = Math.abs(hash) % 360;
        return "hsl(" + hue + ", 52%, 40%)";
    }

    function getCategoryColor(category) {
        return CATEGORY_COLORS[category] || "#15803d";
    }

    function unpackDataset(data) {
        if (typeof global.unpackDatasetJson === "function") {
            return global.unpackDatasetJson(data);
        }
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.columns) && Array.isArray(data.rows)) {
            const cols = data.columns;
            return data.rows.map(function (r) {
                const obj = {};
                for (let i = 0; i < cols.length; i++) {
                    obj[cols[i]] = r[i] || "";
                }
                return obj;
            });
        }
        return [];
    }

    function normalizeKey(str) {
        return String(str || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/^['"‘’]+|['"‘’]+$/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function isMeaningful(val) {
        if (val === null || val === undefined) return false;
        const s = String(val).trim();
        return s.length > 0 && !/^(coming soon|no information|n\/a|-|#ref!|false)$/i.test(s);
    }

    function parseFirstNumber(val) {
        if (typeof val === "number" && Number.isFinite(val)) return val;
        if (!isMeaningful(val)) return null;
        const s = String(val).replace(/,/g, "");
        const m = s.match(/(\d+(?:\.\d+)?)/);
        if (!m) return null;
        const num = parseFloat(m[1]);
        return Number.isFinite(num) ? num : null;
    }

    function splitTopLevelItems(rawStr) {
        let str = String(rawStr || "").trim();
        if (!isMeaningful(str)) return [];
        str = str
            .replace(/\)\s+(?=['"‘’]?[A-Z])/g, "), ")
            .replace(/(?<!\b(?:spp|var|subsp))\.\s+(?=[A-Z])/g, ", ");
        const out = [];
        let cur = "";
        let depth = 0;
        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (ch === "(") {
                depth++;
                cur += ch;
            } else if (ch === ")") {
                depth = Math.max(0, depth - 1);
                cur += ch;
            } else if ((ch === "," || ch === ";") && depth === 0) {
                if (cur.trim()) out.push(cur.trim());
                cur = "";
            } else {
                cur += ch;
            }
        }
        if (cur.trim()) out.push(cur.trim());
        return out;
    }

    function extractPlantNameToken(rawItem) {
        const trimmed = String(rawItem || "").trim().replace(/^['"‘’]+|['"‘’]+$/g, "");
        if (!trimmed) return "";
        const idx = trimmed.indexOf("(");
        if (idx === -1) return trimmed.replace(/\s+to\s+(?:repel|attract|deter|trap).*$/i, "").trim();
        const base = trimmed.slice(0, idx).trim();
        const closeIdx = trimmed.indexOf(")", idx);
        const inside = closeIdx > idx ? trimmed.slice(idx + 1, closeIdx).trim() : "";
        if (/^(french|african|signet|english|portugese|portuguese|spanish|bush|pole|sweet|wild|red|white|yellow|black|purple|winter|summer)$/i.test(inside)) {
            return base + " (" + inside + ")";
        }
        return base;
    }

    function makeShortCode(name, usedCodes) {
        const words = String(name || "CRP").toUpperCase().replace(/[^A-Z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
        let code = "";
        if (words.length >= 2) {
            code = (words[0].slice(0, 2) + words[1].slice(0, 1)).slice(0, 3);
        } else if (words.length === 1) {
            code = words[0].slice(0, 3);
        } else {
            code = "CRP";
        }
        if (!usedCodes.has(code)) {
            usedCodes.add(code);
            return code;
        }
        for (let i = 1; i < 99; i++) {
            const candidate = code.slice(0, 2) + String(i);
            if (!usedCodes.has(candidate)) {
                usedCodes.add(candidate);
                return candidate;
            }
        }
        return code;
    }

    // =========================================================================
    // 1. CATALOG LOADING & NORMALIZATION
    // =========================================================================
    function parseMonthsList(str) {
        if (!str || typeof str !== "string") return [];
        const parts = str.split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        const out = [];
        parts.forEach(function (p) {
            const mNum = MONTH_MAP[p.toLowerCase().replace(/\./g, "")];
            if (mNum) {
                const abbr = MONTH_ABBR[mNum - 1];
                if (out.indexOf(abbr) === -1) out.push(abbr);
            }
        });
        return out;
    }

    function inferCategory(name, family, raw) {
        const nLow = String(name || "").toLowerCase();
        const fam = String(family || "");
        const nut = String((raw && raw["Nutrient Feeding Type"]) || "").toLowerCase();
        const uses = String((raw && (raw["Characteristics / Uses"] || raw["Cover Crop Use"])) || "").toLowerCase();
        if (nut.includes("soil builder") || /clover|vetch|ryegrass|buckwheat|alfalfa|sudan grass|patridge pea|lespedeza|field pea|mustard/i.test(nLow) || (isMeaningful(uses) && uses.includes("cover crop"))) {
            return "Cover Crop";
        }
        if (/apple|apricot|blackberry|blueberry|citrus|fig|gooseberry|grape|grapefruit|kiwi|melon|nectarine|olive|peach|pineapple|plum|pomegranate|raspberry|strawberry|watermelon/i.test(nLow)) {
            return "Fruit";
        }
        if (fam === "Lamiaceae" || /basil|cilantro|coriander|dill|parsley|chive|chervil|fennel|tarragon|lovage|savory|savoury|marjoram|fenugreek|anise|lemongrass|stevia|sorrel|rue|borage|chamomile/i.test(nLow)) {
            return "Herb";
        }
        if (/alyssum|calendula|poppy|canna|celosia|chrysanthemum|coneflower|cornflower|cosmo|daffodil|dahlia|fuchsia|geranium|larkspur|lupine|marigold|pelargonium|peony|petunia|poached egg|rose|sneezeweed|sunflower|tansy|yarrow|zinnia|bee balm/i.test(nLow)) {
            return "Flower";
        }
        return "Vegetable";
    }

    function mapNutrientDemand(rawVal, family, category) {
        const s = String(rawVal || "").toLowerCase();
        if (s.includes("soil builder")) return "Soil Builder";
        if (s.includes("heavy")) return "Heavy";
        if (s.includes("medium")) return "Medium";
        if (s.includes("light")) return "Light";
        if (s === "none") return "None";
        if (category === "Cover Crop" || family === "Fabaceae") return "Soil Builder";
        if (family === "Solanaceae" || family === "Cucurbitaceae" || family === "Brassicaceae" || family === "Poaceae") return "Heavy";
        if (category === "BC Native" || category === "Herb" || category === "Flower") return "Light";
        return "Medium";
    }

    function buildEstimatedCropDefaults(name, latin, family, category, rawGarden, rawNative, rotationCycles, usedCodes) {
        const isNative = Boolean(rawNative && !rawGarden);
        const nutrientDemand = mapNutrientDemand(rawGarden && rawGarden["Nutrient Feeding Type"], family, isNative ? "BC Native" : category);
        const rotYears = rotationCycles[family] || (isNative ? 2 : 3);
        const lifecycle = String((rawGarden && rawGarden["Lifecycle"]) || (rawNative && rawNative["Lifecycle"]) || "").toLowerCase();
        const plantTags = String((rawNative && rawNative["Plant_Type_Tags"]) || "").toLowerCase();

        // Spacing defaults
        let rowsPerBed = 3;
        let inRowCm = 25;
        let betweenRowCm = 22;
        let dtmDays = 65;
        let harvestWindowDays = 21;
        let method = "Direct Seed";
        let nurseryWeeks = 0;
        let tempBaseC = 4;
        let tempMaxC = 26;
        let frostTolerance = "half-hardy";
        let prefersProtected = false;
        let interplantable = false;
        let yieldPer30m = 30;
        let yieldUnit = "kg";
        let typicalPriceCad = 6.0;

        if (isNative) {
            const spMin = parseFirstNumber(rawNative.Spread_Min_cm);
            const spMax = parseFirstNumber(rawNative.Spread_Max_cm);
            const spread = (spMin && spMax) ? Math.round((spMin + spMax) / 2) : (spMin || spMax || 40);
            if (/tree|shrub/i.test(plantTags)) {
                rowsPerBed = 1;
                inRowCm = clamp(spread, 60, 150);
                betweenRowCm = 75;
                dtmDays = 120;
            } else if (/grass|sedge|rush|fern/i.test(plantTags)) {
                rowsPerBed = 2;
                inRowCm = clamp(spread, 25, 60);
                betweenRowCm = 35;
                dtmDays = 90;
            } else {
                rowsPerBed = spread >= 45 ? 2 : 3;
                inRowCm = clamp(spread, 15, 50);
                betweenRowCm = Math.max(20, Math.round(70 / rowsPerBed));
                dtmDays = 80;
            }
            method = /annual/i.test(lifecycle) ? "Direct Seed" : "Transplant";
            nurseryWeeks = method === "Transplant" ? 6 : 0;
            frostTolerance = "hardy";
            interplantable = /groundcover|herb|forb/i.test(plantTags);
            yieldPer30m = 40;
            yieldUnit = "stems";
            typicalPriceCad = 2.5;
        } else if (category === "Cover Crop") {
            rowsPerBed = 6;
            inRowCm = 5;
            betweenRowCm = 12;
            dtmDays = 60;
            harvestWindowDays = 14;
            method = "Direct Seed";
            frostTolerance = "hardy";
            yieldPer30m = 0;
            yieldUnit = "kg";
            typicalPriceCad = 0;
        } else if (category === "Fruit" || family === "Solanaceae" || family === "Cucurbitaceae") {
            rowsPerBed = 1;
            inRowCm = 50;
            betweenRowCm = 75;
            dtmDays = 75;
            harvestWindowDays = 35;
            method = "Transplant";
            nurseryWeeks = 5;
            tempBaseC = 9;
            tempMaxC = 30;
            frostTolerance = "tender";
            prefersProtected = family === "Solanaceae";
            yieldPer30m = 60;
            yieldUnit = "kg";
            typicalPriceCad = 7.5;
        } else if (category === "Herb") {
            rowsPerBed = 3;
            inRowCm = 20;
            betweenRowCm = 22;
            dtmDays = 55;
            harvestWindowDays = 45;
            method = /basil|rosemary|thyme|oregano|sage|lavender|mint|lemon balm/i.test(name) ? "Transplant" : "Direct Seed";
            nurseryWeeks = method === "Transplant" ? 5 : 0;
            interplantable = true;
            yieldPer30m = 60;
            yieldUnit = "bunches";
            typicalPriceCad = 3.5;
        } else if (category === "Flower") {
            rowsPerBed = 3;
            inRowCm = 22;
            betweenRowCm = 22;
            dtmDays = 65;
            harvestWindowDays = 45;
            method = /marigold|calendula|zinnia|dahlia|cosmos|alyssum/i.test(name) ? "Transplant" : "Direct Seed";
            nurseryWeeks = method === "Transplant" ? 4 : 0;
            interplantable = /alyssum|marigold|calendula|nasturtium|borage/i.test(name);
            yieldPer30m = 120;
            yieldUnit = "stems";
            typicalPriceCad = 1.5;
        } else {
            // General Vegetable fallback
            rowsPerBed = 2;
            inRowCm = 25;
            betweenRowCm = 35;
            dtmDays = 60;
            harvestWindowDays = 21;
            method = family === "Brassicaceae" ? "Transplant" : "Direct Seed";
            nurseryWeeks = method === "Transplant" ? 4 : 0;
            yieldPer30m = 40;
            yieldUnit = "kg";
            typicalPriceCad = 5.5;
        }

        const spg = parseFirstNumber((rawGarden && rawGarden["seeds/gram"]) || (rawNative && rawNative.Seeds_Per_Gram)) || 200;
        const depth = parseFirstNumber(rawGarden && rawGarden["Seeding Depth (mm)"]) || 6;
        const germ = parseFirstNumber(rawGarden && rawGarden["Days to Emergence @ 20°C"]) || 8;

        return {
            name: name,
            latin: latin || "",
            family: family || "Other",
            shortCode: makeShortCode(name, usedCodes),
            category: isNative ? "BC Native" : category,
            nutrientDemand: nutrientDemand,
            rotationYears: rotYears,
            method: method,
            rowsPerBed: rowsPerBed,
            inRowCm: inRowCm,
            betweenRowCm: betweenRowCm,
            dtmDays: dtmDays,
            harvestWindowDays: harvestWindowDays,
            germinationDays: germ,
            nurseryWeeks: nurseryWeeks,
            seedsPerCell: 1,
            trayCells: method === "Transplant" ? 72 : 128,
            pottingUp: null,
            seedingDepthMm: depth,
            seedsPerGram: spg,
            tempBaseC: tempBaseC,
            tempMaxC: tempMaxC,
            frostTolerance: frostTolerance,
            prefersProtected: prefersProtected,
            interplantable: interplantable,
            seederPreset: null,
            yieldPer30m: yieldPer30m,
            yieldUnit: yieldUnit,
            typicalPriceCad: typicalPriceCad,
            isNativeBC: isNative,
            isCoverCrop: category === "Cover Crop",
            isEstimatedDefault: true,
            companions: [],
            antagonists: [],
            bcCalendar: null
        };
    }

    function registerAlias(aliasMap, key, crop) {
        const k = normalizeKey(key);
        if (!k || k === "no information" || k === "coming soon") return;
        if (!aliasMap.has(k)) {
            aliasMap.set(k, crop);
        }
    }

    function registerCropAliases(aliasMap, crop) {
        registerAlias(aliasMap, crop.name, crop);
        if (crop.latin) registerAlias(aliasMap, crop.latin, crop);
        const low = normalizeKey(crop.name);
        if (low && !low.endsWith("s")) registerAlias(aliasMap, low + "s", crop);
        if (low && low.endsWith("s") && low.length > 4) registerAlias(aliasMap, low.slice(0, -1), crop);
        const paren = crop.name.match(/^([^(]+)\s*\(([^)]+)\)$/);
        if (paren) {
            const base = paren[1].trim();
            const sub = paren[2].trim();
            registerAlias(aliasMap, sub + " " + base, crop);
            registerAlias(aliasMap, sub + " " + base + "s", crop);
            registerAlias(aliasMap, base, crop);
        }
    }

    const CALENDAR_EXTRA_KEYS = {
        "green bean (pole)": ["bean, bush & pole"],
        "green bean": ["bean, bush & pole"],
        "collard": ["kale & collards"],
        "pak choi": ["pac choi & choi sum", "pac choi / gai lan / choi sum"],
        "bok choi": ["pac choi & choi sum", "pac choi / gai lan / choi sum"],
        "mustard": ["mustard greens"],
        "soy bean": ["bean, soya (edamame)"],
        "squash (winter)": ["squash & pumpkin"],
        "zucchini": ["squash & pumpkin"],
        "pumpkin": ["squash & pumpkin"],
        "marigold (african)": ["marigold"],
        "marigold (signet)": ["marigold"],
        "california poppy": ["poppy"],
        "coneflower": ["echinacea (coneflower)"],
        "cosmo": ["cosmos"],
        "lupine": ["lupin"],
        "bee balm": ["bergamot (bee balm)"],
        "peppermint": ["mint"],
        "spearmint": ["mint"],
        "lavender (french)": ["lavender"],
        "summer savoury": ["savory (summer & winter)"],
        "savory": ["savory (summer & winter)"],
        "green onion": ["onion, scallion (bunching)", "scallion"],
        "snow pea": ["pea (shelling, snap, snow)", "pea"],
        "oceanspray": ["ocean spray"],
        "tall oregon-grape": ["tall oregon grape"],
        "henderson's shooting star": ["broad-leaved shooting star"]
    };

    function buildCalendarMap(calRows) {
        const map = new Map();
        (calRows || []).forEach(function (item) {
            if (!item || !item.name) return;
            const rawName = String(item.name).trim();
            const isFW = rawName.toLowerCase().startsWith("fw:");
            const cleanName = isFW ? rawName.slice(3).trim() : rawName;
            // Strip trailing latin parens if native like "Garry Oak (Quercus garryana)"
            const baseNoLatin = cleanName.replace(/\s*\([A-Z][a-z]+\s+[a-z-]+\)\s*$/, "").trim();
            const keys = [normalizeKey(cleanName), normalizeKey(baseNoLatin)];
            const entry = {
                name: cleanName,
                category: item.category || "",
                startIndoors: parseMonthsList(item.startIndoors),
                directSow: parseMonthsList(item.directSow),
                transplant: parseMonthsList(item.transplant),
                cover: parseMonthsList(item.cover),
                harvest: parseMonthsList(item.harvest),
                wks: item.wks || "",
                method: item.method || "",
                temp: item.temp || "",
                depth: item.depth || "",
                space: item.space || ""
            };
            keys.forEach(function (k) {
                if (!k) return;
                if (!map.has(k)) {
                    map.set(k, {
                        startIndoors: [],
                        directSow: [],
                        transplant: [],
                        cover: [],
                        harvest: [],
                        fallWinter: null
                    });
                }
                const target = map.get(k);
                if (isFW) {
                    target.fallWinter = entry;
                } else {
                    ["startIndoors", "directSow", "transplant", "cover", "harvest"].forEach(function (field) {
                        entry[field].forEach(function (m) {
                            if (target[field].indexOf(m) === -1) target[field].push(m);
                        });
                    });
                }
            });
        });
        return map;
    }

    function resolveCrop(cropMap, nameOrAlias) {
        if (!cropMap || !nameOrAlias) return null;
        if (Object.prototype.hasOwnProperty.call(cropMap, nameOrAlias)) {
            return cropMap[nameOrAlias];
        }
        const key = normalizeKey(nameOrAlias);
        const aliases = cropMap._aliases;
        if (aliases && aliases.has(key)) return aliases.get(key);
        const mappedAlias = PLANT_SYNONYM_ALIASES[key];
        if (mappedAlias && aliases && aliases.has(mappedAlias)) {
            return aliases.get(mappedAlias);
        }
        const baseOnly = key.split("(")[0].trim();
        if (aliases && aliases.has(baseOnly)) return aliases.get(baseOnly);
        return null;
    }

    async function fetchJsonSafe(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            return await res.json();
        } catch (_) {
            return null;
        }
    }

    async function loadCatalog(options) {
        const opts = options || {};
        if (_cachedCatalog && !opts.force) return _cachedCatalog;
        if (_catalogPromise && !opts.force) return _catalogPromise;

        const base = opts.baseUrl || "";
        const fetcher = opts.fetcher || fetchJsonSafe;

        _catalogPromise = Promise.all([
            fetcher(base + "data/bed_simulator_crops.json"),
            fetcher(base + "data/garden_crops.json"),
            fetcher(base + "data/calendar_base.json"),
            fetcher(base + "data/plants_212.json")
        ]).then(function (results) {
            const simJson = results[0] || {};
            const gcRaw = results[1];
            const calRaw = results[2];
            const nativeRaw = results[3];

            const gcRows = unpackDataset(gcRaw);
            const calRows = unpackDataset(calRaw);
            const nativeRows = unpackDataset(nativeRaw);

            const rotationCyclesByFamily = Object.assign(
                {},
                DEFAULT_ROTATION_CYCLES,
                simJson.rotationCyclesByFamily || {}
            );

            const crops = [];
            const cropMap = {};
            const aliasMap = new Map();
            Object.defineProperties(cropMap, {
                _aliases: { value: aliasMap, enumerable: false },
                get: { value: function (k) { return resolveCrop(cropMap, k); }, enumerable: false },
                has: { value: function (k) { return Boolean(resolveCrop(cropMap, k)); }, enumerable: false },
                resolve: { value: function (k) { return resolveCrop(cropMap, k); }, enumerable: false }
            });

            const usedCodes = new Set();
            const seenNames = new Set();
            const seenLatins = new Set();

            // Index garden_crops by normalized Common Name & Latin Name for enrichment
            const gcByCommon = new Map();
            const gcByLatin = new Map();
            gcRows.forEach(function (row) {
                const cName = String(row["Common Name"] || "").trim();
                const lName = String(row["Latin Name"] || "").trim();
                if (cName) gcByCommon.set(normalizeKey(cName), row);
                if (lName) gcByLatin.set(normalizeKey(lName), row);
            });

            // Step 1: Load calibrated simulator crops from bed_simulator_crops.json
            (simJson.crops || []).forEach(function (c) {
                if (!c || !c.name) return;
                const copy = Object.assign({}, c, {
                    isEstimatedDefault: false,
                    isNativeBC: Boolean(c.isNativeBC),
                    isCoverCrop: c.category === "Cover Crop" || Boolean(c.isCoverCrop),
                    companions: Array.isArray(c.companions) ? c.companions.slice() : [],
                    antagonists: Array.isArray(c.antagonists) ? c.antagonists.slice() : [],
                    bcCalendar: c.bcCalendar || null
                });
                if (!copy.rotationYears) {
                    copy.rotationYears = rotationCyclesByFamily[copy.family] || 3;
                }
                if (copy.shortCode) usedCodes.add(copy.shortCode);
                crops.push(copy);
                cropMap[copy.name] = copy;
                seenNames.add(normalizeKey(copy.name));
                if (copy.latin) seenLatins.add(normalizeKey(copy.latin));
                registerAlias(aliasMap, copy.name, copy);
            });

            // Step 2: Merge all 185 rows from garden_crops.json (preserve all unique Common Names)
            gcRows.forEach(function (row) {
                const cName = String(row["Common Name"] || "").trim();
                const lName = String(row["Latin Name"] || "").trim();
                const family = String(row["Family"] || "").trim() || "Other";
                if (!cName && !lName) return;
                const name = cName || lName;
                const nKey = normalizeKey(name);
                const lKey = normalizeKey(lName);

                let crop = cropMap[name] || aliasMap.get(nKey);
                if (!crop) {
                    const cat = inferCategory(name, family, row);
                    crop = buildEstimatedCropDefaults(name, lName, family, cat, row, null, rotationCyclesByFamily, usedCodes);
                    crops.push(crop);
                    cropMap[crop.name] = crop;
                    seenNames.add(nKey);
                    if (lKey) seenLatins.add(lKey);
                    registerAlias(aliasMap, crop.name, crop);
                } else {
                    if (!crop.latin && lName) crop.latin = lName;
                    if (!crop.family && family) crop.family = family;
                    if (!crop.seedsPerGram && parseFirstNumber(row["seeds/gram"])) {
                        crop.seedsPerGram = parseFirstNumber(row["seeds/gram"]);
                    }
                    if (!crop.seedingDepthMm && parseFirstNumber(row["Seeding Depth (mm)"])) {
                        crop.seedingDepthMm = parseFirstNumber(row["Seeding Depth (mm)"]);
                    }
                    if (!crop.germinationDays && parseFirstNumber(row["Days to Emergence @ 20°C"])) {
                        crop.germinationDays = parseFirstNumber(row["Days to Emergence @ 20°C"]);
                    }
                }

                crop._gardenRow = row;
                if (isMeaningful(row["Light"])) crop.light = row["Light"];
                if (isMeaningful(row["Water Needs"])) crop.waterNeeds = row["Water Needs"];
                if (isMeaningful(row["pH"])) crop.phRange = row["pH"];
                if (isMeaningful(row["Lifecycle"])) crop.lifecycle = row["Lifecycle"];
                if (isMeaningful(row["Sowing Time"])) crop.sowingTime = row["Sowing Time"];
            });

            // Step 3: Merge all unique BC native plants from plants_212.json (391+ total)
            nativeRows.forEach(function (p) {
                const cName = String(p.Common_Name_Primary || "").trim();
                const lName = String(p.Latin_Name || "").trim();
                const family = String(p.Family || "").trim() || "Other";
                if (!cName && !lName) return;
                const name = cName || lName;
                const nKey = normalizeKey(name);
                const lKey = normalizeKey(lName);

                // Avoid duplicating species already loaded from garden_crops
                if (seenNames.has(nKey) || (lKey && seenLatins.has(lKey))) {
                    const existing = aliasMap.get(nKey) || crops.find(function (c) {
                        return lKey && normalizeKey(c.latin) === lKey;
                    });
                    if (existing) {
                        existing._nativeRow = p;
                        existing.isNativeBC = String(p.Origin_BC || "Native").toLowerCase() === "native";
                        if (p.Common_Names_Alt) {
                            String(p.Common_Names_Alt).split(/[;,]/).forEach(function (alt) {
                                registerAlias(aliasMap, alt, existing);
                            });
                        }
                    }
                    return;
                }

                const crop = buildEstimatedCropDefaults(name, lName, family, "BC Native", null, p, rotationCyclesByFamily, usedCodes);
                crop._nativeRow = p;
                crop.isNativeBC = String(p.Origin_BC || "Native").toLowerCase() === "native";
                if (isMeaningful(p.Light_Tags)) crop.light = String(p.Light_Tags).replace(/;\s*/g, ", ");
                if (isMeaningful(p.Moisture_Tags)) crop.waterNeeds = String(p.Moisture_Tags).replace(/;\s*/g, ", ");
                if (isMeaningful(p.pH_Range)) crop.phRange = p.pH_Range;
                if (isMeaningful(p.Lifecycle)) crop.lifecycle = p.Lifecycle;
                if (isMeaningful(p.Bloom_Months)) crop.bloomMonths = p.Bloom_Months;
                if (isMeaningful(p.Plant_Type_Tags)) crop.plantTypeTags = p.Plant_Type_Tags;
                if (isMeaningful(p.Allelopathy_Competition_Notes)) crop.allelopathyNotes = p.Allelopathy_Competition_Notes;

                crops.push(crop);
                cropMap[crop.name] = crop;
                seenNames.add(nKey);
                if (lKey) seenLatins.add(lKey);
                registerAlias(aliasMap, crop.name, crop);
                if (p.Common_Names_Alt) {
                    String(p.Common_Names_Alt).split(/[;,]/).forEach(function (alt) {
                        registerAlias(aliasMap, alt, crop);
                    });
                }
            });

            // Step 3b: Register secondary aliases (plurals, parentheticals, latin, synonym table)
            crops.forEach(function (crop) {
                registerCropAliases(aliasMap, crop);
            });
            Object.keys(PLANT_SYNONYM_ALIASES).forEach(function (aliasKey) {
                const target = PLANT_SYNONYM_ALIASES[aliasKey];
                const match = aliasMap.get(normalizeKey(target));
                if (match && !aliasMap.has(aliasKey)) {
                    aliasMap.set(aliasKey, match);
                }
            });

            // Step 4: Enrich companions, antagonists, and bcCalendar across all crops
            const calMap = buildCalendarMap(calRows);
            crops.forEach(function (crop) {
                // Calendar enrichment
                const cKey = normalizeKey(crop.name);
                const tryKeys = [cKey, normalizeKey(crop.name.split("(")[0])];
                if (CALENDAR_EXTRA_KEYS[cKey]) {
                    CALENDAR_EXTRA_KEYS[cKey].forEach(function (k) { tryKeys.push(k); });
                }
                Object.keys(PLANT_SYNONYM_ALIASES).forEach(function (ak) {
                    if (PLANT_SYNONYM_ALIASES[ak] === cKey) {
                        tryKeys.push(ak);
                    }
                });
                for (let i = 0; i < tryKeys.length; i++) {
                    if (calMap.has(tryKeys[i])) {
                        crop.bcCalendar = calMap.get(tryKeys[i]);
                        break;
                    }
                }

                // Companions & Antagonists from garden_crops
                const compSet = new Set(crop.companions || []);
                const antSet = new Set(crop.antagonists || []);
                const gRow = crop._gardenRow || gcByCommon.get(normalizeKey(crop.name)) || (crop.latin ? gcByLatin.get(normalizeKey(crop.latin)) : null);
                if (gRow) {
                    COMPANION_COLUMNS.forEach(function (col) {
                        const val = gRow[col];
                        if (!isMeaningful(val)) return;
                        splitTopLevelItems(val).forEach(function (item) {
                            const tok = extractPlantNameToken(item);
                            if (!tok || !isMeaningful(tok)) return;
                            const resolved = resolveCrop(cropMap, tok);
                            compSet.add(resolved ? resolved.name : tok);
                        });
                    });
                    const worstVal = gRow["Worst Companion Plants"];
                    if (isMeaningful(worstVal)) {
                        splitTopLevelItems(worstVal).forEach(function (item) {
                            const tok = extractPlantNameToken(item);
                            if (!tok || !isMeaningful(tok)) return;
                            if (/^everything$/i.test(tok)) {
                                antSet.add("Everything");
                            } else {
                                const resolved = resolveCrop(cropMap, tok);
                                antSet.add(resolved ? resolved.name : tok);
                            }
                        });
                    }
                }

                // Companions from plants_212
                const nRow = crop._nativeRow;
                if (nRow && isMeaningful(nRow.Companion_Plants)) {
                    splitTopLevelItems(nRow.Companion_Plants).forEach(function (item) {
                        const tok = extractPlantNameToken(item);
                        if (!tok || !isMeaningful(tok)) return;
                        const resolved = resolveCrop(cropMap, tok);
                        compSet.add(resolved ? resolved.name : tok);
                    });
                }

                crop.companions = Array.from(compSet).filter(function (n) { return n !== crop.name; });
                crop.antagonists = Array.from(antSet).filter(function (n) { return n !== crop.name; });

                // Clean internal row references
                delete crop._gardenRow;
                delete crop._nativeRow;
            });

            const catalog = {
                version: simJson.version || "1.0.0",
                region: simJson.region || "South Coastal BC (Zone 8a)",
                rotationCyclesByFamily: rotationCyclesByFamily,
                crops: crops,
                cropMap: cropMap,
                aliasMap: aliasMap,
                starterPresets: Array.isArray(simJson.starterPresets) ? simJson.starterPresets : [],
                resolveCrop: function (name) { return resolveCrop(cropMap, name); },
                searchCrops: function (query, limit) {
                    const q = normalizeKey(query);
                    const cap = limit || 40;
                    if (!q) return crops.slice(0, cap);
                    const starts = [];
                    const contains = [];
                    for (let i = 0; i < crops.length; i++) {
                        const c = crops[i];
                        const cn = normalizeKey(c.name);
                        const ln = normalizeKey(c.latin);
                        const fam = normalizeKey(c.family);
                        const code = normalizeKey(c.shortCode);
                        if (cn.startsWith(q) || code === q) starts.push(c);
                        else if (cn.includes(q) || ln.includes(q) || fam.includes(q)) contains.push(c);
                    }
                    return starts.concat(contains).slice(0, cap);
                }
            };

            _cachedCatalog = catalog;
            return catalog;
        }).catch(function (err) {
            _catalogPromise = null;
            throw err;
        });

        return _catalogPromise;
    }

    // =========================================================================
    // 2. CLIMATE & EFFECTIVE DTM + BACKWARD HARVEST SCHEDULING
    // =========================================================================
    function getClimateInfo() {
        if (global.WCPPClimate && typeof global.WCPPClimate.getInfo === "function") {
            try {
                const info = global.WCPPClimate.getInfo();
                if (info && info.name) return info;
            } catch (_) {}
        }
        return Object.assign({}, SURREY_CLIMATE_FALLBACK);
    }

    function getFrostWindow(year) {
        const yr = Number(year) || new Date().getFullYear();
        const info = getClimateInfo();
        return {
            city: info.name || "Surrey",
            lastSpring: info.lastSpring || "Apr 6",
            firstFall: info.firstFall || "Nov 16",
            lastSpringIso: parseMonthDayToIso(info.lastSpring || "Apr 6", yr),
            firstFallIso: parseMonthDayToIso(info.firstFall || "Nov 16", yr),
            frostFreeDays: info.days || 225
        };
    }

    function getCoastalTempAtUtcDate(dt) {
        const m = dt.getUTCMonth();
        const day = dt.getUTCDate();
        const daysInMonth = new Date(Date.UTC(dt.getUTCFullYear(), m + 1, 0)).getUTCDate();
        const midDay = (daysInMonth + 1) / 2;
        const currTemp = BC_MONTHLY_TEMP_C[m];
        if (day === midDay) return currTemp;
        if (day < midDay) {
            const prevTemp = BC_MONTHLY_TEMP_C[(m + 11) % 12];
            const frac = 0.5 + (day / (2 * midDay));
            return prevTemp + (currTemp - prevTemp) * frac;
        }
        const nextTemp = BC_MONTHLY_TEMP_C[(m + 1) % 12];
        const span = daysInMonth - midDay;
        const frac = span > 0 ? (day - midDay) / (2 * span) : 0;
        return currTemp + (nextTemp - currTemp) * frac;
    }

    function getStructureTempOffset(structureType) {
        const s = String(structureType || "field").toLowerCase();
        if (s.includes("greenhouse") || s === "gh") return 4.0;
        if (s.includes("tunnel") || s === "caterpillar" || s === "mini" || s === "high" || s === "hoop") return 2.5;
        return 0.0;
    }

    function computeEffectiveDtm(crop, startDateIso, structureType, climateAdjusted) {
        const baseDtm = Math.max(1, Math.round(Number(crop && crop.dtmDays) || 60));
        if (climateAdjusted === false) return baseDtm;

        const startDt = parseIsoDateUtc(startDateIso) || parseIsoDateUtc("2026-05-01");
        const structOffset = getStructureTempOffset(structureType);
        const tBase = Number.isFinite(Number(crop && crop.tempBaseC)) ? Number(crop.tempBaseC) : 4;
        const tMax = Number.isFinite(Number(crop && crop.tempMaxC)) ? Number(crop.tempMaxC) : 28;
        const tOpt = tBase + 0.8 * Math.max(6, tMax - tBase);
        const tRef = clamp(tBase + 7.0, 15.5, 20.0);
        const refSpan = Math.max(4.0, tRef - tBase);

        const minDays = Math.max(1, Math.round(baseDtm * 0.65));
        const maxDays = Math.max(minDays, Math.round(baseDtm * 1.65));

        let progress = 0;
        let days = 0;
        const cursor = new Date(startDt.getTime());

        while (progress < baseDtm && days < maxDays) {
            const effTemp = getCoastalTempAtUtcDate(cursor) + structOffset;
            let rate;
            if (effTemp <= tOpt) {
                rate = (effTemp - tBase) / refSpan;
            } else {
                const optRate = (tOpt - tBase) / refSpan;
                const over = effTemp - tOpt;
                rate = optRate * Math.max(0.55, 1 - over / Math.max(6, tMax - tOpt + 4));
            }
            // Prevent complete thermal stall in deep winter while allowing slow overwintering
            rate = clamp(rate, 0.35, 1.65);
            progress += rate;
            days += 1;
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        return clamp(days, minDays, maxDays);
    }

    function getPlantingStructureType(planting, block, tunnels) {
        if (block && (block.type === "greenhouse" || block.isGreenhouse)) {
            return "greenhouse";
        }
        if (block && Array.isArray(tunnels) && planting && planting.bedStart) {
            const pStart = Number(planting.bedStart);
            const pEnd = pStart + Math.max(1, Math.ceil(Number(planting.bedCount || 1))) - 1;
            for (let i = 0; i < tunnels.length; i++) {
                const t = tunnels[i];
                if (!t || t.blockId !== block.id) continue;
                const tStart = Math.min(Number(t.startBed), Number(t.endBed));
                const tEnd = Math.max(Number(t.startBed), Number(t.endBed));
                if (pStart <= tEnd && pEnd >= tStart) {
                    return t.type || "tunnel";
                }
            }
        }
        return "field";
    }

    function computePlantingDates(planting, crop, block, tunnels, climateAdjusted) {
        const p = planting || {};
        const c = crop || {};
        const useClimate = climateAdjusted !== false;
        const structureType = p.structureOverride || getPlantingStructureType(p, block, tunnels);
        const baseDtm = Math.max(1, Math.round(Number(p.dtmDaysOverride ?? (p.dtmDays > 0 ? p.dtmDays : undefined) ?? c.dtmDays ?? 60)));
        const harvestWindow = Math.max(1, Math.round(Number(p.harvestWindowOverride ?? (p.harvestWindowDays > 0 ? p.harvestWindowDays : undefined) ?? c.harvestWindowDays ?? 14)));
        const method = p.method || c.method || "Direct Seed";
        const isTransplant = method === "Transplant";
        const nurseryWeeks = isTransplant ? Math.max(0, Number(p.nurseryWeeksOverride ?? (p.nurseryWeeks > 0 ? p.nurseryWeeks : undefined) ?? c.nurseryWeeks ?? 4)) : 0;
        const potting = p.pottingUp !== undefined ? p.pottingUp : c.pottingUp;
        const pottingWeeks = (isTransplant && potting && potting.weeks) ? Math.max(0, Number(potting.weeks)) : 0;
        const totalNurseryDays = isTransplant ? Math.round((nurseryWeeks + pottingWeeks) * 7) : 0;

        const dtmCropArg = {
            dtmDays: baseDtm,
            tempBaseC: c.tempBaseC,
            tempMaxC: c.tempMaxC
        };

        let fieldStartDate;
        let effectiveDtm;
        let harvestStartDate;

        if (p.lockHarvestDate && (p.targetHarvestDate || p.harvestDate || p.harvestStartDate)) {
            const targetHarvest = p.targetHarvestDate || p.harvestDate || p.harvestStartDate;
            const maxBack = Math.ceil(baseDtm * 1.65) + 4;
            const minBack = Math.max(1, Math.floor(baseDtm * 0.65) - 4);
            let lo = addDaysIso(targetHarvest, -maxBack);
            let hi = addDaysIso(targetHarvest, -minBack);

            // Binary search for fieldStartDate whose predicted harvest hits targetHarvest
            for (let iter = 0; iter < 14; iter++) {
                const span = diffDaysIso(lo, hi);
                if (span <= 1) break;
                const mid = addDaysIso(lo, Math.floor(span / 2));
                const dtmMid = computeEffectiveDtm(dtmCropArg, mid, structureType, useClimate);
                const harvMid = addDaysIso(mid, dtmMid);
                if (harvMid <= targetHarvest) {
                    lo = mid;
                } else {
                    hi = mid;
                }
            }

            // Pick closest candidate around lo
            let bestDate = lo;
            let bestErr = Infinity;
            for (let offset = -3; offset <= 3; offset++) {
                const cand = addDaysIso(lo, offset);
                const dtmCand = computeEffectiveDtm(dtmCropArg, cand, structureType, useClimate);
                const harvCand = addDaysIso(cand, dtmCand);
                const err = Math.abs(diffDaysIso(harvCand, targetHarvest));
                if (err < bestErr) {
                    bestErr = err;
                    bestDate = cand;
                    effectiveDtm = dtmCand;
                }
            }
            fieldStartDate = bestDate;
            harvestStartDate = targetHarvest;
        } else {
            if (p.startDate) {
                fieldStartDate = p.startDate;
            } else if (p.transplantDate) {
                fieldStartDate = p.transplantDate;
            } else if (p.seedingDate && totalNurseryDays > 0) {
                fieldStartDate = addDaysIso(p.seedingDate, totalNurseryDays);
            } else if (p.seedingDate) {
                fieldStartDate = p.seedingDate;
            } else {
                fieldStartDate = "2026-05-01";
            }
            effectiveDtm = computeEffectiveDtm(dtmCropArg, fieldStartDate, structureType, useClimate);
            harvestStartDate = addDaysIso(fieldStartDate, effectiveDtm);
        }

        const harvestEndDate = addDaysIso(harvestStartDate, harvestWindow);
        const seedingDate = totalNurseryDays > 0 ? addDaysIso(fieldStartDate, -totalNurseryDays) : fieldStartDate;
        const transplantDate = isTransplant ? fieldStartDate : null;
        const pottingUpDate = (isTransplant && pottingWeeks > 0) ? addDaysIso(fieldStartDate, -Math.round(pottingWeeks * 7)) : null;

        return {
            startDate: fieldStartDate,
            endDate: harvestEndDate,
            fieldStartDate: fieldStartDate,
            seedingDate: seedingDate,
            pottingUpDate: pottingUpDate,
            transplantDate: transplantDate,
            harvestStartDate: harvestStartDate,
            harvestEndDate: harvestEndDate,
            baseDtm: baseDtm,
            effectiveDtm: effectiveDtm,
            harvestWindowDays: harvestWindow,
            nurseryDays: totalNurseryDays,
            structureType: structureType,
            climateAdjusted: useClimate
        };
    }

    // =========================================================================
    // 3. STATE MANAGEMENT, PERSISTENCE & UNDO/REDO
    // =========================================================================
    function buildFallbackPreset() {
        return {
            id: "heirloom-market-6bed",
            name: "Surrey 6-Bed Intensive Block (Default)",
            units: "metric",
            farmDefaults: { bedWidthCm: 75, pathWidthCm: 30, bedLengthM: 30, benchAreaM2: 40 },
            activeSeason: 2026,
            blocks: [
                { id: "block-a", name: "Field Block A", type: "field", bedCount: 6, bedLengthM: 30, bedWidthCm: 75, pathWidthCm: 30, angleDeg: 15, beginningYear: 2025, isFallow: false, x: 40, y: 40 },
                { id: "gh-1", name: "Propagation Greenhouse", type: "greenhouse", bedCount: 2, bedLengthM: 15, bedWidthCm: 75, pathWidthCm: 30, angleDeg: 0, beginningYear: 2025, isFallow: false, x: 40, y: 260 }
            ],
            tunnels: [
                { id: "tun-1", name: "Caterpillar Tunnel 1", blockId: "block-a", type: "caterpillar", startBed: 3, endBed: 4, disableNeighbors: true }
            ],
            plantings: []
        };
    }

    function normalizeBlock(b, defaults, idx) {
        return {
            id: b.id || ("block_" + (idx + 1)),
            name: b.name || ("Block " + (idx + 1)),
            type: (b.type === "greenhouse" || b.isGreenhouse) ? "greenhouse" : "field",
            bedCount: Math.max(1, Math.round(Number(b.bedCount ?? b.beds ?? 4))),
            bedLengthM: Math.max(0.5, Number(b.bedLengthM ?? defaults.bedLengthM ?? 30)),
            bedWidthCm: Math.max(20, Number(b.bedWidthCm ?? defaults.bedWidthCm ?? 75)),
            pathWidthCm: Math.max(10, Number(b.pathWidthCm ?? defaults.pathWidthCm ?? 30)),
            angleDeg: Number.isFinite(Number(b.angleDeg ?? b.angle)) ? Number(b.angleDeg ?? b.angle) : 0,
            beginningYear: Number(b.beginningYear ?? 2025),
            isFallow: Boolean(b.isFallow ?? b.fallow),
            x: Number.isFinite(Number(b.x)) ? Number(b.x) : 40 + (idx % 2) * 320,
            y: Number.isFinite(Number(b.y)) ? Number(b.y) : 40 + Math.floor(idx / 2) * 200
        };
    }

    function normalizeTunnel(t, idx) {
        const s = Math.max(1, Math.round(Number(t.startBed ?? 1)));
        const e = Math.max(s, Math.round(Number(t.endBed ?? s)));
        return {
            id: t.id || ("tunnel_" + (idx + 1)),
            name: t.name || ("Tunnel " + (idx + 1)),
            blockId: t.blockId,
            type: t.type || "caterpillar",
            startBed: s,
            endBed: e,
            disableNeighbors: Boolean(t.disableNeighbors)
        };
    }

    function normalizePlanting(p, idx, defaultYear) {
        const cropName = p.cropName || p.crop || "Carrot";
        const bedStartRaw = p.bedStart !== undefined ? p.bedStart : p.bed;
        const bedStart = (bedStartRaw !== null && bedStartRaw !== undefined && bedStartRaw !== "") ? Number(bedStartRaw) : null;
        return {
            id: p.id || generateId("pl_" + idx),
            cropName: cropName,
            label: p.label || "",
            blockId: p.blockId || null,
            bedStart: Number.isFinite(bedStart) ? bedStart : null,
            bedCount: Math.max(0.05, Number(p.bedCount ?? p.bedFraction ?? p.beds ?? 1)),
            startDate: p.startDate || (defaultYear + "-05-01"),
            endDate: p.endDate || "",
            targetHarvestDate: p.targetHarvestDate || p.harvestDate || "",
            lockHarvestDate: Boolean(p.lockHarvestDate),
            interplanted: Boolean(p.interplanted),
            method: p.method || undefined,
            rowsPerBed: (p.rowsPerBed !== undefined && p.rowsPerBed > 0) ? Number(p.rowsPerBed) : undefined,
            inRowCm: (p.inRowCm !== undefined && p.inRowCm > 0) ? Number(p.inRowCm) : undefined,
            betweenRowCm: (p.betweenRowCm !== undefined && p.betweenRowCm > 0) ? Number(p.betweenRowCm) : undefined,
            nurseryWeeksOverride: p.nurseryWeeksOverride !== undefined ? Number(p.nurseryWeeksOverride) : (p.nurseryWeeks > 0 ? Number(p.nurseryWeeks) : undefined),
            trayCells: (p.trayCells !== undefined && p.trayCells > 0) ? Number(p.trayCells) : undefined,
            seedsPerCell: (p.seedsPerCell !== undefined && p.seedsPerCell > 0) ? Number(p.seedsPerCell) : undefined,
            safetyMarginPct: p.safetyMarginPct !== undefined ? Number(p.safetyMarginPct) : undefined,
            pottingUp: p.pottingUp !== undefined ? p.pottingUp : undefined,
            dtmDaysOverride: p.dtmDaysOverride !== undefined ? Number(p.dtmDaysOverride) : (p.dtmDays > 0 ? Number(p.dtmDays) : undefined),
            harvestWindowOverride: p.harvestWindowOverride !== undefined ? Number(p.harvestWindowOverride) : (p.harvestWindowDays > 0 ? Number(p.harvestWindowDays) : undefined),
            seederPreset: p.seederPreset || undefined,
            notes: p.notes || ""
        };
    }

    function hydrateSeasonDates(seasonData, cropMap, climateAdjusted) {
        if (!seasonData || !Array.isArray(seasonData.plantings)) return;
        const blocksById = new Map((seasonData.blocks || []).map(function (b) { return [b.id, b]; }));
        const tunnels = seasonData.tunnels || [];
        seasonData.plantings.forEach(function (p) {
            const crop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
            const block = p.blockId ? blocksById.get(p.blockId) : null;
            const dates = computePlantingDates(p, crop, block, tunnels, climateAdjusted);
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

    function createStateFromPreset(preset, catalog) {
        const src = preset || buildFallbackPreset();
        const sb = src.standardBed || src.farmDefaults || src;
        const defaults = {
            bedWidthCm: Number(sb.bedWidthCm ?? src.bedWidthCm ?? 75),
            pathWidthCm: Number(sb.pathWidthCm ?? src.pathWidthCm ?? 30),
            bedLengthM: Number(sb.bedLengthM ?? src.bedLengthM ?? 30),
            benchAreaM2: Number(sb.benchAreaM2 ?? sb.nurseryBenchM2 ?? src.benchAreaM2 ?? src.nurseryBenchM2 ?? 40)
        };
        const activeSeason = Number(src.activeSeason || src.defaultSeason || 2026);
        const seasons = {};

        if (src.seasons && typeof src.seasons === "object") {
            Object.keys(src.seasons).forEach(function (yrKey) {
                const yr = Number(yrKey);
                const s = src.seasons[yrKey] || {};
                seasons[yr] = {
                    year: yr,
                    blocks: (s.blocks || src.blocks || []).map(function (b, idx) { return normalizeBlock(b, defaults, idx); }),
                    tunnels: (s.tunnels || src.tunnels || []).map(normalizeTunnel),
                    plantings: (s.plantings || []).map(function (p, idx) { return normalizePlanting(p, idx, yr); }),
                    completedTaskIds: Array.isArray(s.completedTaskIds) ? s.completedTaskIds.slice() : []
                };
            });
        } else {
            const baseBlocks = (src.blocks || []).map(function (b, idx) { return normalizeBlock(b, defaults, idx); });
            const baseTunnels = (src.tunnels || []).map(normalizeTunnel);
            seasons[activeSeason] = {
                year: activeSeason,
                blocks: baseBlocks,
                tunnels: baseTunnels,
                plantings: (src.plantings || []).map(function (p, idx) { return normalizePlanting(p, idx, activeSeason); }),
                completedTaskIds: []
            };
            const hist = src.history2025 || src.rotationHistory;
            if (Array.isArray(hist)) {
                const prevYr = activeSeason - 1;
                seasons[prevYr] = {
                    year: prevYr,
                    blocks: JSON.parse(JSON.stringify(baseBlocks)),
                    tunnels: JSON.parse(JSON.stringify(baseTunnels)),
                    plantings: hist.map(function (p, idx) { return normalizePlanting(p, idx, prevYr); }),
                    completedTaskIds: []
                };
            }
        }

        if (!seasons[activeSeason]) {
            const years = Object.keys(seasons).map(Number).sort(function (a, b) { return b - a; });
            if (years.length) {
                const latest = seasons[years[0]];
                seasons[activeSeason] = {
                    year: activeSeason,
                    blocks: JSON.parse(JSON.stringify(latest.blocks)),
                    tunnels: JSON.parse(JSON.stringify(latest.tunnels)),
                    plantings: [],
                    completedTaskIds: []
                };
            }
        }

        const state = {
            version: "1.0.0",
            activePresetId: src.id || "custom",
            activeSeason: activeSeason,
            units: src.units === "imperial" ? "imperial" : "metric",
            climateAdjusted: src.climateAdjusted !== false,
            farmDefaults: defaults,
            displayOptions: Object.assign({
                highlightActive: false,
                highlightInterplanted: false,
                colorByFamily: false,
                showFrostToday: true,
                showTunnels: true
            }, src.displayOptions || {}),
            seasons: seasons,
            undoStack: [],
            redoStack: []
        };

        const cropMap = (catalog && catalog.cropMap) || (_cachedCatalog && _cachedCatalog.cropMap) || null;
        if (cropMap) {
            Object.keys(state.seasons).forEach(function (yr) {
                hydrateSeasonDates(state.seasons[yr], cropMap, state.climateAdjusted);
            });
        }

        return state;
    }

    function cloneState(state) {
        if (!state) return null;
        const clean = {
            version: state.version || "1.0.0",
            activePresetId: state.activePresetId || "custom",
            activeSeason: Number(state.activeSeason || 2026),
            units: state.units === "imperial" ? "imperial" : "metric",
            climateAdjusted: state.climateAdjusted !== false,
            farmDefaults: Object.assign({}, state.farmDefaults || {}),
            displayOptions: Object.assign({}, state.displayOptions || {}),
            seasons: state.seasons || {}
        };
        const cloned = JSON.parse(JSON.stringify(clean));
        cloned.undoStack = [];
        cloned.redoStack = [];
        return cloned;
    }

    function applySnapshotOntoState(target, snap) {
        target.version = snap.version;
        target.activePresetId = snap.activePresetId;
        target.activeSeason = snap.activeSeason;
        target.units = snap.units;
        target.climateAdjusted = snap.climateAdjusted;
        target.farmDefaults = JSON.parse(JSON.stringify(snap.farmDefaults));
        target.displayOptions = JSON.parse(JSON.stringify(snap.displayOptions));
        target.seasons = JSON.parse(JSON.stringify(snap.seasons));
        return target;
    }

    function pushUndo(state) {
        if (!state) return state;
        if (!Array.isArray(state.undoStack)) state.undoStack = [];
        state.undoStack.push(cloneState(state));
        if (state.undoStack.length > MAX_UNDO_SNAPSHOTS) {
            state.undoStack.shift();
        }
        state.redoStack = [];
        return state;
    }

    function undo(state) {
        if (!state || !Array.isArray(state.undoStack) || state.undoStack.length === 0) return state;
        if (!Array.isArray(state.redoStack)) state.redoStack = [];
        state.redoStack.push(cloneState(state));
        if (state.redoStack.length > MAX_UNDO_SNAPSHOTS) {
            state.redoStack.shift();
        }
        const prev = state.undoStack.pop();
        return applySnapshotOntoState(state, prev);
    }

    function redo(state) {
        if (!state || !Array.isArray(state.redoStack) || state.redoStack.length === 0) return state;
        if (!Array.isArray(state.undoStack)) state.undoStack = [];
        state.undoStack.push(cloneState(state));
        if (state.undoStack.length > MAX_UNDO_SNAPSHOTS) {
            state.undoStack.shift();
        }
        const next = state.redoStack.pop();
        return applySnapshotOntoState(state, next);
    }

    function canUndo(state) {
        return Boolean(state && Array.isArray(state.undoStack) && state.undoStack.length > 0);
    }

    function canRedo(state) {
        return Boolean(state && Array.isArray(state.redoStack) && state.redoStack.length > 0);
    }

    function saveState(state) {
        if (!state) return false;
        try {
            const serializable = cloneState(state);
            delete serializable.undoStack;
            delete serializable.redoStack;
            if (global.localStorage) {
                global.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
            }
            return true;
        } catch (_) {
            return false;
        }
    }

    function loadState(starterPresets, catalog) {
        try {
            if (global.localStorage) {
                const raw = global.localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && parsed.seasons && typeof parsed.seasons === "object" && Object.keys(parsed.seasons).length > 0) {
                        const restored = cloneState(parsed);
                        const cropMap = (catalog && catalog.cropMap) || (_cachedCatalog && _cachedCatalog.cropMap) || null;
                        if (cropMap) {
                            Object.keys(restored.seasons).forEach(function (yr) {
                                hydrateSeasonDates(restored.seasons[yr], cropMap, restored.climateAdjusted);
                            });
                        }
                        return restored;
                    }
                }
            }
        } catch (_) {}

        const presets = Array.isArray(starterPresets) && starterPresets.length
            ? starterPresets
            : (_cachedCatalog && _cachedCatalog.starterPresets && _cachedCatalog.starterPresets.length ? _cachedCatalog.starterPresets : [buildFallbackPreset()]);
        return createStateFromPreset(presets[0], catalog);
    }

    function getActiveSeason(state) {
        if (!state || !state.seasons) return null;
        return state.seasons[state.activeSeason] || state.seasons[String(state.activeSeason)] || null;
    }

    function duplicateSeason(state, fromYear, toYear) {
        if (!state || !state.seasons) return state;
        const src = state.seasons[fromYear] || state.seasons[String(fromYear)];
        if (!src) return state;

        const yrTo = Number(toYear);
        const yrFrom = Number(fromYear);

        const newBlocks = JSON.parse(JSON.stringify(src.blocks || [])).filter(function (b) {
            return !b.beginningYear || b.beginningYear <= yrTo;
        });
        const validBlockIds = new Set(newBlocks.map(function (b) { return b.id; }));
        const newTunnels = JSON.parse(JSON.stringify(src.tunnels || [])).filter(function (t) {
            return validBlockIds.has(t.blockId);
        });
        const newPlantings = (src.plantings || []).map(function (p) {
            const copy = JSON.parse(JSON.stringify(p));
            copy.id = generateId("pl");
            if (copy.startDate) copy.startDate = shiftIsoYear(copy.startDate, yrFrom, yrTo);
            if (copy.endDate) copy.endDate = shiftIsoYear(copy.endDate, yrFrom, yrTo);
            if (copy.targetHarvestDate) copy.targetHarvestDate = shiftIsoYear(copy.targetHarvestDate, yrFrom, yrTo);
            if (copy.harvestStartDate) copy.harvestStartDate = shiftIsoYear(copy.harvestStartDate, yrFrom, yrTo);
            if (copy.harvestEndDate) copy.harvestEndDate = shiftIsoYear(copy.harvestEndDate, yrFrom, yrTo);
            if (copy.seedingDate) copy.seedingDate = shiftIsoYear(copy.seedingDate, yrFrom, yrTo);
            if (copy.transplantDate) copy.transplantDate = shiftIsoYear(copy.transplantDate, yrFrom, yrTo);
            if (copy.pottingUpDate) copy.pottingUpDate = shiftIsoYear(copy.pottingUpDate, yrFrom, yrTo);
            if (copy.blockId && !validBlockIds.has(copy.blockId)) {
                copy.blockId = null;
                copy.bedStart = null;
            }
            return copy;
        });

        state.seasons[yrTo] = {
            year: yrTo,
            blocks: newBlocks,
            tunnels: newTunnels,
            plantings: newPlantings,
            completedTaskIds: []
        };
        state.activeSeason = yrTo;
        return state;
    }

    function getBedRotationHistory(state, blockId, bedNumber, upToYear, cropMap) {
        const history = [];
        const violations = [];
        if (!state || !state.seasons) return { history: history, violations: violations };

        const targetBed = Number(bedNumber);
        const capYear = upToYear ? Number(upToYear) : Number(state.activeSeason || 9999);
        const years = Object.keys(state.seasons).map(Number).filter(function (y) {
            return y <= capYear;
        }).sort(function (a, b) { return a - b; });

        const lastYearByFamily = {};

        years.forEach(function (yr) {
            const s = state.seasons[yr];
            if (!s || !Array.isArray(s.plantings)) return;
            s.plantings.forEach(function (p) {
                if (!p || p.blockId !== blockId || !p.bedStart) return;
                const pStart = Number(p.bedStart);
                const pEnd = pStart + Math.max(1, Math.ceil(Number(p.bedCount || 1))) - 1;
                if (targetBed < pStart || targetBed > pEnd) return;

                const crop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
                const family = (crop && crop.family) || "Unknown";
                const rotYears = (crop && crop.rotationYears) || DEFAULT_ROTATION_CYCLES[family] || 3;

                const entry = {
                    year: yr,
                    plantingId: p.id,
                    cropName: crop ? crop.name : p.cropName,
                    family: family,
                    rotationYears: rotYears,
                    interplanted: Boolean(p.interplanted),
                    nutrientDemand: (crop && crop.nutrientDemand) || "Medium"
                };
                history.push(entry);

                if (family !== "Unknown" && !entry.interplanted) {
                    const prevYr = lastYearByFamily[family];
                    if (prevYr !== undefined && (yr - prevYr) < rotYears) {
                        violations.push({
                            year: yr,
                            previousYear: prevYr,
                            family: family,
                            rotationYears: rotYears,
                            cropName: entry.cropName,
                            gapYears: yr - prevYr
                        });
                    }
                    lastYearByFamily[family] = yr;
                }
            });
        });

        return { history: history, violations: violations };
    }

    // =========================================================================
    // 4. PLANTING METRICS & PARAMETRIC BED MATH
    // =========================================================================
    function computePlantingMetrics(planting, crop, block, units) {
        const p = planting || {};
        const c = crop || {};
        const b = block || {};

        const bedCount = Math.max(0.1, Number(p.bedCount ?? 1));
        const blockLengthM = Math.max(0.5, Number(p.bedLengthM ?? b.bedLengthM ?? 30));
        const bedWidthCm = Math.max(20, Number(p.bedWidthCm ?? b.bedWidthCm ?? 75));
        const bedLengthUsedM = +(bedCount * blockLengthM).toFixed(2);
        const bedLengthUsedFt = +(bedLengthUsedM * 3.28084).toFixed(1);

        const rowsPerBed = Math.max(1, Math.round(Number(p.rowsPerBed ?? c.rowsPerBed ?? 2)));
        const inRowCm = Math.max(1, Number(p.inRowCm ?? c.inRowCm ?? 25));
        const betweenRowCm = Math.max(1, Number(p.betweenRowCm ?? c.betweenRowCm ?? Math.max(8, Math.round(bedWidthCm / (rowsPerBed + 0.5)))));

        const plants = Math.max(1, Math.round(((bedLengthUsedM * 100) / inRowCm) * rowsPerBed));
        const safetyMarginPct = Math.max(0, Number(p.safetyMarginPct ?? c.safetyMarginPct ?? 10));
        const plantsWithMargin = Math.ceil(plants * (1 + safetyMarginPct / 100));

        const method = p.method || c.method || "Direct Seed";
        const seedsPerCell = Math.max(1, Number(p.seedsPerCell ?? c.seedsPerCell ?? 1));
        const seedsNeeded = Math.ceil(plantsWithMargin * seedsPerCell);
        const seedsPerGram = Math.max(0.1, Number(p.seedsPerGram ?? c.seedsPerGram ?? 200));
        const seedGrams = +(seedsNeeded / seedsPerGram).toFixed(2);

        const isTransplant = method === "Transplant";
        const rawTray = p.trayCells ?? (c.trayCells > 0 ? c.trayCells : undefined);
        const trayCells = isTransplant ? Math.max(1, Math.round(Number(rawTray ?? 72))) : 0;
        const nurseryTrays = isTransplant ? +(plantsWithMargin / trayCells).toFixed(2) : 0;
        const nurseryTraysCeil = isTransplant ? Math.ceil(plantsWithMargin / trayCells) : 0;

        const pottingUp = p.pottingUp !== undefined ? p.pottingUp : c.pottingUp;
        const potUpCount = (isTransplant && pottingUp) ? plantsWithMargin : 0;
        const propagationBenchM2 = +(nurseryTrays * TRAY_AREA_1020_M2).toFixed(2);
        let potUpBenchM2 = 0;
        if (potUpCount > 0 && pottingUp) {
            if (pottingUp.cells && Number(pottingUp.cells) > 1) {
                potUpBenchM2 = +((potUpCount / Number(pottingUp.cells)) * TRAY_AREA_1020_M2).toFixed(2);
            } else {
                potUpBenchM2 = +(potUpCount * 0.01).toFixed(2);
            }
        }
        const benchM2 = +(Math.max(propagationBenchM2, potUpBenchM2)).toFixed(2);

        const yieldPer30m = Math.max(0, Number(p.yieldPer30m ?? c.yieldPer30m ?? 0));
        const estYield = +((bedLengthUsedM / 30) * yieldPer30m).toFixed(1);
        const yieldUnit = p.yieldUnit || c.yieldUnit || "kg";
        const typicalPriceCad = Math.max(0, Number(p.typicalPriceCad ?? c.typicalPriceCad ?? 0));
        const estValueCad = +(estYield * typicalPriceCad).toFixed(2);

        return {
            bedCount: bedCount,
            bedLengthUsedM: bedLengthUsedM,
            bedLengthUsedFt: bedLengthUsedFt,
            rowsPerBed: rowsPerBed,
            inRowCm: inRowCm,
            betweenRowCm: betweenRowCm,
            plants: plants,
            plantsWithMargin: plantsWithMargin,
            safetyMarginPct: safetyMarginPct,
            method: method,
            seedsPerCell: seedsPerCell,
            seedsNeeded: seedsNeeded,
            seedsPerGram: seedsPerGram,
            seedGrams: seedGrams,
            trayCells: trayCells,
            nurseryTrays: nurseryTrays,
            nurseryTraysCeil: nurseryTraysCeil,
            benchM2: benchM2,
            propagationBenchM2: propagationBenchM2,
            potUpCount: potUpCount,
            potUpBenchM2: potUpBenchM2,
            estYield: estYield,
            yieldUnit: yieldUnit,
            typicalPriceCad: typicalPriceCad,
            estValueCad: estValueCad,
            units: units || "metric"
        };
    }

    // =========================================================================
    // 5. COLLISION & COMPANION ENGINE
    // =========================================================================
    function getDisabledNeighborBeds(block, tunnels) {
        const disabled = new Set();
        if (!block || !Array.isArray(tunnels)) return disabled;
        const bedCount = Math.max(1, Number(block.bedCount || 1));
        const insideTunnelBeds = new Set();

        tunnels.forEach(function (t) {
            if (!t || t.blockId !== block.id) return;
            const s = Math.min(Number(t.startBed), Number(t.endBed));
            const e = Math.max(Number(t.startBed), Number(t.endBed));
            for (let b = s; b <= e; b++) insideTunnelBeds.add(b);
        });

        tunnels.forEach(function (t) {
            if (!t || t.blockId !== block.id || !t.disableNeighbors) return;
            const s = Math.min(Number(t.startBed), Number(t.endBed));
            const e = Math.max(Number(t.startBed), Number(t.endBed));
            if (s - 1 >= 1 && !insideTunnelBeds.has(s - 1)) disabled.add(s - 1);
            if (e + 1 <= bedCount && !insideTunnelBeds.has(e + 1)) disabled.add(e + 1);
        });

        return disabled;
    }

    function getPlantingDateRangeMs(p, crop, block, tunnels) {
        let startIso = p.startDate;
        let endIso = p.endDate;
        if (!startIso || !endIso) {
            const dates = computePlantingDates(p, crop, block, tunnels, true);
            startIso = startIso || dates.startDate;
            endIso = endIso || dates.endDate;
        }
        const sDt = parseIsoDateUtc(startIso);
        const eDt = parseIsoDateUtc(endIso);
        if (!sDt || !eDt) return [0, 0];
        const sMs = sDt.getTime();
        const eMs = Math.max(sMs + 86400000, eDt.getTime());
        return [sMs, eMs];
    }

    function rangesOverlap(aStart, aEnd, bStart, bEnd) {
        return aStart < bEnd && bStart < aEnd;
    }

    function checkDropEligibility(planting, targetBlockId, targetBed, seasonData, cropMap, excludeId) {
        const p = planting || {};
        const season = seasonData || {};
        const blocks = season.blocks || [];
        const tunnels = season.tunnels || [];
        const plantings = season.plantings || [];
        const skipId = excludeId !== undefined ? excludeId : p.id;

        const block = blocks.find(function (b) { return b.id === targetBlockId; });
        if (!block) {
            return {
                eligible: false,
                reasonCode: "MISSING_BLOCK",
                message: "Target block not found.",
                conflicts: []
            };
        }

        if (block.isFallow) {
            return {
                eligible: false,
                reasonCode: "FALLOW_BLOCK",
                message: (block.name || "Block") + " is fallow / under cover crop for this season.",
                conflicts: []
            };
        }

        const bedStart = Math.floor(Number(targetBed));
        const bedCount = Math.max(0.1, Number(p.bedCount ?? 1));
        const bedSpan = Math.max(1, Math.ceil(bedCount));
        const totalBeds = Math.max(1, Number(block.bedCount || 1));

        if (!Number.isFinite(bedStart) || bedStart < 1 || (bedStart + bedSpan - 1) > totalBeds) {
            return {
                eligible: false,
                reasonCode: "OVERFLOW",
                message: "Needs " + bedSpan + " bed(s) starting at Bed " + bedStart + ", exceeding " + (block.name || "block") + " (" + totalBeds + " beds).",
                conflicts: []
            };
        }

        const disabledBeds = getDisabledNeighborBeds(block, tunnels);
        for (let b = bedStart; b < bedStart + bedSpan; b++) {
            if (disabledBeds.has(b)) {
                return {
                    eligible: false,
                    reasonCode: "HATCHED_NEIGHBOR",
                    message: "Bed " + b + " is hatched (disabled adjacent to a movable tunnel).",
                    conflicts: [],
                    hatchedBed: b
                };
            }
        }

        // Interplanted companion strips overlay without double-counting bed space
        if (p.interplanted) {
            return {
                eligible: true,
                reasonCode: null,
                message: "Interplanted companion strip eligible.",
                conflicts: []
            };
        }

        const pCrop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
        const pRange = getPlantingDateRangeMs(p, pCrop, block, tunnels);
        const conflictMap = new Map();

        for (let offset = 0; offset < bedSpan; offset++) {
            const b = bedStart + offset;
            const rem = bedCount - offset;
            const incomingFrac = rem >= 1 ? 1.0 : Math.max(0.1, rem);

            // Gather non-interplanted plantings occupying bed b during overlapping dates
            const overlapping = [];
            for (let i = 0; i < plantings.length; i++) {
                const other = plantings[i];
                if (!other || other.id === skipId || other.blockId !== targetBlockId || other.interplanted || !other.bedStart) {
                    continue;
                }
                const oStartBed = Number(other.bedStart);
                const oBedCount = Math.max(0.1, Number(other.bedCount ?? 1));
                const oSpan = Math.max(1, Math.ceil(oBedCount));
                if (b < oStartBed || b > oStartBed + oSpan - 1) continue;

                const oCrop = cropMap ? resolveCrop(cropMap, other.cropName) : null;
                const oRange = getPlantingDateRangeMs(other, oCrop, block, tunnels);
                if (!rangesOverlap(pRange[0], pRange[1], oRange[0], oRange[1])) continue;

                const oOffset = b - oStartBed;
                const oRem = oBedCount - oOffset;
                const oFrac = oRem >= 1 ? 1.0 : Math.max(0.1, oRem);

                overlapping.push({
                    planting: other,
                    start: Math.max(pRange[0], oRange[0]),
                    end: Math.min(pRange[1], oRange[1]),
                    frac: oFrac
                });
            }

            if (overlapping.length === 0) continue;

            // Sweep-line check for concurrent bed occupancy > 1.0
            const points = [];
            overlapping.forEach(function (item) {
                points.push(item.start, item.end);
            });
            points.sort(function (a, b2) { return a - b2; });

            for (let pi = 0; pi < points.length - 1; pi++) {
                const segStart = points[pi];
                const segEnd = points[pi + 1];
                if (segEnd <= segStart) continue;
                const mid = (segStart + segEnd) / 2;
                let used = 0;
                const activeAtMid = [];
                for (let oi = 0; oi < overlapping.length; oi++) {
                    const item = overlapping[oi];
                    if (item.start <= mid && mid < item.end) {
                        used += item.frac;
                        activeAtMid.push(item.planting);
                    }
                }
                if (used + incomingFrac > 1.001) {
                    activeAtMid.forEach(function (cp) {
                        conflictMap.set(cp.id, cp);
                    });
                }
            }
        }

        if (conflictMap.size > 0) {
            const conflicts = Array.from(conflictMap.values());
            const names = conflicts.map(function (c) { return c.label || c.cropName; }).join(", ");
            return {
                eligible: false,
                reasonCode: "OCCUPIED",
                message: "Bed " + bedStart + " overlaps with " + names + ".",
                conflicts: conflicts
            };
        }

        return {
            eligible: true,
            reasonCode: null,
            message: "Eligible",
            conflicts: []
        };
    }

    function matchesListOrFamily(list, targetCrop, targetRawName) {
        if (!Array.isArray(list) || list.length === 0) return false;
        const targetCanonical = targetCrop ? normalizeKey(targetCrop.name) : normalizeKey(targetRawName);
        const targetFamily = targetCrop ? targetCrop.family : "";
        for (let i = 0; i < list.length; i++) {
            const entry = list[i];
            if (entry === "Everything") return true;
            const eKey = normalizeKey(entry);
            if (eKey === targetCanonical) return true;
            if (targetFamily && GROUP_FAMILY_ALIASES[eKey] === targetFamily) return true;
        }
        return false;
    }

    function pairCompatibility(cropA, nameA, cropB, nameB) {
        const keyA = cropA ? normalizeKey(cropA.name) : normalizeKey(nameA);
        const keyB = cropB ? normalizeKey(cropB.name) : normalizeKey(nameB);
        if (!keyA || !keyB || keyA === keyB) return "neutral";

        const isAntA = cropA && matchesListOrFamily(cropA.antagonists, cropB, nameB);
        const isAntB = cropB && matchesListOrFamily(cropB.antagonists, cropA, nameA);
        if (isAntA || isAntB) return "conflict";

        const isGoodA = cropA && matchesListOrFamily(cropA.companions, cropB, nameB);
        const isGoodB = cropB && matchesListOrFamily(cropB.companions, cropA, nameA);
        if (isGoodA || isGoodB) return "companion";

        return "neutral";
    }

    function checkCompanionRelationships(planting, seasonData, cropMap) {
        const result = {
            companions: [],
            conflicts: [],
            companionCount: 0,
            conflictCount: 0,
            status: "neutral"
        };
        if (!planting || !planting.blockId || !planting.bedStart || !seasonData) {
            return result;
        }

        const blocks = seasonData.blocks || [];
        const tunnels = seasonData.tunnels || [];
        const block = blocks.find(function (b) { return b.id === planting.blockId; });
        const cropA = cropMap ? resolveCrop(cropMap, planting.cropName) : null;
        const rangeA = getPlantingDateRangeMs(planting, cropA, block, tunnels);

        const pStart = Number(planting.bedStart);
        const pEnd = pStart + Math.max(1, Math.ceil(Number(planting.bedCount ?? 1))) - 1;

        const plantings = seasonData.plantings || [];
        for (let i = 0; i < plantings.length; i++) {
            const other = plantings[i];
            if (!other || other.id === planting.id || other.blockId !== planting.blockId || !other.bedStart) {
                continue;
            }
            const oStart = Number(other.bedStart);
            const oEnd = oStart + Math.max(1, Math.ceil(Number(other.bedCount ?? 1))) - 1;
            const sameBed = pStart <= oEnd && oStart <= pEnd;
            const adjacentBed = !sameBed && (oEnd >= pStart - 1 && oStart <= pEnd + 1);
            if (!sameBed && !adjacentBed) continue;

            const cropB = cropMap ? resolveCrop(cropMap, other.cropName) : null;
            const rangeB = getPlantingDateRangeMs(other, cropB, block, tunnels);
            if (!rangesOverlap(rangeA[0], rangeA[1], rangeB[0], rangeB[1])) continue;

            const rel = pairCompatibility(cropA, planting.cropName, cropB, other.cropName);
            const relationLabel = sameBed ? "same-bed" : "adjacent-bed";
            if (rel === "conflict") {
                result.conflicts.push({
                    plantingId: other.id,
                    cropName: cropB ? cropB.name : other.cropName,
                    bedStart: oStart,
                    relation: relationLabel,
                    reason: "Antagonistic pairing (" + relationLabel.replace("-", " ") + ")"
                });
            } else if (rel === "companion") {
                result.companions.push({
                    plantingId: other.id,
                    cropName: cropB ? cropB.name : other.cropName,
                    bedStart: oStart,
                    relation: relationLabel,
                    notes: "Beneficial companion (" + relationLabel.replace("-", " ") + ")"
                });
            }
        }

        result.companionCount = result.companions.length;
        result.conflictCount = result.conflicts.length;
        result.status = result.conflictCount > 0 ? "conflict" : (result.companionCount > 0 ? "companion" : "neutral");
        return result;
    }

    // =========================================================================
    // 6. INSIGHTS SCORER & SIMULATED ANNEALING OPTIMIZER
    // =========================================================================
    function buildPriorBedHistoryIndex(state, activeYear, cropMap) {
        const byBed = new Map(); // key: blockId + "::" + bed -> { families: Map<fam, maxYear>, maxNutrient: number, hasSoilBuilder: bool }
        const seasons = (state && state.seasons) || {};
        const priorYears = Object.keys(seasons).map(Number).filter(function (y) {
            return y < activeYear;
        }).sort(function (a, b) { return a - b; });

        priorYears.forEach(function (yr) {
            const s = seasons[yr];
            if (!s || !Array.isArray(s.plantings)) return;
            s.plantings.forEach(function (p) {
                if (!p || !p.blockId || !p.bedStart) return;
                const crop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
                const fam = (crop && crop.family) || "Unknown";
                const nut = NUTRIENT_LEVEL[(crop && crop.nutrientDemand) || "Medium"] ?? 2;
                const pStart = Number(p.bedStart);
                const pEnd = pStart + Math.max(1, Math.ceil(Number(p.bedCount ?? 1))) - 1;
                for (let b = pStart; b <= pEnd; b++) {
                    const key = p.blockId + "::" + b;
                    if (!byBed.has(key)) {
                        byBed.set(key, { families: new Map(), lastNutrient: 0, hasSoilBuilder: false });
                    }
                    const rec = byBed.get(key);
                    if (fam !== "Unknown" && !p.interplanted) {
                        const prev = rec.families.get(fam) || 0;
                        if (yr > prev) rec.families.set(fam, yr);
                    }
                    if (yr === activeYear - 1) {
                        if (nut === -1) rec.hasSoilBuilder = true;
                        if (nut > rec.lastNutrient) rec.lastNutrient = nut;
                    }
                }
            });
        });
        return byBed;
    }

    function evaluatePlanCore(items, assignments, context, collectDiagnostics) {
        const n = items.length;
        if (n === 0) {
            return {
                rotations: 100,
                fertility: 100,
                standardization: 100,
                structure: 100,
                overall: 100,
                assignedCount: 0,
                totalCount: 0,
                diagnostics: []
            };
        }

        let rotSum = 0;
        let fertSum = 0;
        let stdSum = 0;
        let structSum = 0;
        let assignedCount = 0;

        const diagnostics = collectDiagnostics ? [] : null;
        const bedMap = new Map(); // key: blockId + "::" + bed -> array of item indices

        for (let i = 0; i < n; i++) {
            const a = assignments[i];
            if (a && a.blockId && a.bedStart) {
                assignedCount += 1;
                const span = items[i].bedSpan;
                for (let b = a.bedStart; b < a.bedStart + span; b++) {
                    const k = a.blockId + "::" + b;
                    if (!bedMap.has(k)) bedMap.set(k, []);
                    bedMap.get(k).push(i);
                }
            }
        }

        const frost = context.frost;

        for (let i = 0; i < n; i++) {
            const item = items[i];
            const a = assignments[i];

            if (!a || !a.blockId || !a.bedStart) {
                rotSum += 0.25;
                fertSum += 0.30;
                stdSum += 0.30;
                structSum += 0.30;
                if (collectDiagnostics) {
                    diagnostics.push({
                        id: "unassigned_" + item.id,
                        dimension: "standardization",
                        severity: "warn",
                        title: "Unassigned planting: " + item.displayName,
                        message: "Drag onto a bed or run Optimize Crop Map to schedule it.",
                        plantingId: item.id,
                        cropName: item.cropName
                    });
                }
                continue;
            }

            const block = context.blocksById.get(a.blockId);
            if (!block || block.isFallow) {
                rotSum += 0.1;
                fertSum += 0.1;
                stdSum += 0.1;
                structSum += 0.0;
                continue;
            }

            // 1. ROTATIONS DIMENSION
            let rotScore = 1.0;
            let worstRotGap = null;
            let sameYearRepeat = false;

            for (let b = a.bedStart; b < a.bedStart + item.bedSpan; b++) {
                const key = a.blockId + "::" + b;
                const hist = context.priorHistory.get(key);
                if (hist && item.family !== "Unknown" && !item.interplanted) {
                    const prevYr = hist.families.get(item.family);
                    if (prevYr !== undefined) {
                        const gap = context.activeYear - prevYr;
                        if (gap < item.rotationYears) {
                            const penalty = gap <= 1 ? 0.68 : (gap === 2 ? 0.45 : 0.28);
                            rotScore = Math.min(rotScore, 1.0 - penalty);
                            if (worstRotGap === null || gap < worstRotGap) worstRotGap = gap;
                        }
                    }
                }
                const peers = bedMap.get(key) || [];
                for (let pi = 0; pi < peers.length; pi++) {
                    const j = peers[pi];
                    if (j === i) continue;
                    const other = items[j];
                    if (!item.interplanted && !other.interplanted && other.family === item.family && item.family !== "Unknown") {
                        sameYearRepeat = true;
                        rotScore = Math.min(rotScore, 0.70);
                    }
                }
            }
            rotSum += Math.max(0.05, rotScore);

            if (collectDiagnostics && worstRotGap !== null) {
                diagnostics.push({
                    id: "rot_" + item.id,
                    dimension: "rotations",
                    severity: worstRotGap <= 1 ? "error" : "warn",
                    title: item.family + " rotation conflict (" + item.displayName + ")",
                    message: block.name + " Bed " + a.bedStart + " grew " + item.family + " " + worstRotGap + " yr(s) ago (cycle: " + item.rotationYears + " yrs).",
                    blockId: a.blockId,
                    bedStart: a.bedStart,
                    plantingId: item.id,
                    cropName: item.cropName
                });
            } else if (collectDiagnostics && sameYearRepeat) {
                diagnostics.push({
                    id: "rot_same_" + item.id,
                    dimension: "rotations",
                    severity: "warn",
                    title: "Same-season " + item.family + " repeat (" + item.displayName + ")",
                    message: block.name + " Bed " + a.bedStart + " has multiple " + item.family + " plantings in " + context.activeYear + ".",
                    blockId: a.blockId,
                    bedStart: a.bedStart,
                    plantingId: item.id,
                    cropName: item.cropName
                });
            }

            // 2. FERTILITY & COMPANION SYNERGY DIMENSION
            let fertScore = 0.85;
            let heavyDepletion = false;
            let compGoodCount = 0;
            let compBadCount = 0;

            for (let b = a.bedStart; b < a.bedStart + item.bedSpan; b++) {
                const key = a.blockId + "::" + b;
                const hist = context.priorHistory.get(key);
                if (hist && !item.interplanted) {
                    if (item.nutrientLevel === 3 && hist.hasSoilBuilder) {
                        fertScore = Math.min(1.0, fertScore + 0.15);
                    } else if (item.nutrientLevel === 3 && hist.lastNutrient === 3) {
                        fertScore -= 0.35;
                        heavyDepletion = true;
                    } else if (item.nutrientLevel === -1 && hist.lastNutrient >= 2) {
                        fertScore = Math.min(1.0, fertScore + 0.12);
                    }
                }
                // Check active same-bed + adjacent bed companions/antagonists & stacked heavy feeders
                for (let adj = Math.max(1, b - 1); adj <= Math.min(block.bedCount, b + 1); adj++) {
                    const adjPeers = bedMap.get(a.blockId + "::" + adj) || [];
                    for (let pi = 0; pi < adjPeers.length; pi++) {
                        const j = adjPeers[pi];
                        if (j === i) continue;
                        const other = items[j];
                        if (adj === b && !item.interplanted && !other.interplanted && item.nutrientLevel === 3 && other.nutrientLevel === 3) {
                            fertScore -= 0.15;
                            heavyDepletion = true;
                        }
                        if (rangesOverlap(item.startMs, item.endMs, other.startMs, other.endMs)) {
                            const rel = context.compatMatrix[i][j];
                            if (rel === 2) compBadCount += 1;
                            else if (rel === 1) compGoodCount += 1;
                        }
                    }
                }
            }

            if (compGoodCount > 0) fertScore += Math.min(0.15, compGoodCount * 0.08);
            if (compBadCount > 0) fertScore -= Math.min(0.55, compBadCount * 0.32);
            fertSum += clamp(fertScore, 0.05, 1.0);

            if (collectDiagnostics && compBadCount > 0) {
                diagnostics.push({
                    id: "ant_" + item.id,
                    dimension: "fertility",
                    severity: "error",
                    title: "Antagonistic neighbor near " + item.displayName,
                    message: block.name + " Bed " + a.bedStart + " has an incompatible companion on the same or adjacent bed.",
                    blockId: a.blockId,
                    bedStart: a.bedStart,
                    plantingId: item.id,
                    cropName: item.cropName
                });
            } else if (collectDiagnostics && heavyDepletion) {
                diagnostics.push({
                    id: "fert_" + item.id,
                    dimension: "fertility",
                    severity: "warn",
                    title: "Back-to-back heavy feeder (" + item.displayName + ")",
                    message: block.name + " Bed " + a.bedStart + " follows another heavy feeder — consider compost amendment or rotating after legumes.",
                    blockId: a.blockId,
                    bedStart: a.bedStart,
                    plantingId: item.id,
                    cropName: item.cropName
                });
            }

            // 3. STANDARDIZATION DIMENSION
            let stdScore = 0.88;
            const lenDiff = Math.abs(block.bedLengthM - context.standardLengthM);
            if (lenDiff <= 0.5) stdScore += 0.12;
            else if (lenDiff > 10) stdScore -= 0.12;
            if (item.bedCount === 1 || item.bedCount === 0.5 || item.bedCount === 2) stdScore += 0.04;
            stdSum += clamp(stdScore, 0.2, 1.0);

            // 4. STRUCTURE COMPLIANCE DIMENSION
            let structScore = 1.0;
            const hasTunnel = context.isBedUnderTunnel(block, a.bedStart, item.bedSpan);
            const isProtected = block.type === "greenhouse" || hasTunnel;
            const disabledSet = context.disabledByBlock.get(block.id);
            let hitsHatched = false;
            if (disabledSet) {
                for (let b = a.bedStart; b < a.bedStart + item.bedSpan; b++) {
                    if (disabledSet.has(b)) hitsHatched = true;
                }
            }

            if (hitsHatched) {
                structScore = 0.0;
            } else if (item.prefersProtected && !isProtected) {
                structScore = 0.42;
                if (collectDiagnostics) {
                    diagnostics.push({
                        id: "prot_" + item.id,
                        dimension: "structure",
                        severity: "warn",
                        title: "Protected structure recommended for " + item.displayName,
                        message: item.displayName + " performs best in a Greenhouse or Tunnel rather than open " + block.name + ".",
                        blockId: a.blockId,
                        bedStart: a.bedStart,
                        plantingId: item.id,
                        cropName: item.cropName
                    });
                }
            } else if (!isProtected && item.frostTolerance === "tender") {
                if (item.startIso < frost.lastSpringIso || item.harvestStartIso > frost.firstFallIso) {
                    structScore = 0.48;
                    if (collectDiagnostics) {
                        diagnostics.push({
                            id: "frost_" + item.id,
                            dimension: "structure",
                            severity: "error",
                            title: "Frost exposure risk: " + item.displayName,
                            message: "Tender crop in open " + block.name + " Bed " + a.bedStart + " extends outside " + frost.city + " frost-free window (" + frost.lastSpring + "–" + frost.firstFall + ").",
                            blockId: a.blockId,
                            bedStart: a.bedStart,
                            plantingId: item.id,
                            cropName: item.cropName
                        });
                    }
                }
            } else if (block.type === "greenhouse" && !item.prefersProtected && (item.category === "Cover Crop" || item.frostTolerance === "hardy")) {
                structScore = 0.72;
            }
            structSum += clamp(structScore, 0.0, 1.0);
        }

        const rotations = Math.round((rotSum / n) * 100);
        const fertility = Math.round((fertSum / n) * 100);
        const standardization = Math.round((stdSum / n) * 100);
        const structure = Math.round((structSum / n) * 100);
        const overall = clamp(
            Math.round(0.32 * rotations + 0.28 * fertility + 0.18 * standardization + 0.22 * structure),
            0,
            100
        );

        if (collectDiagnostics) {
            if (diagnostics.length === 0 && assignedCount === n) {
                diagnostics.push({
                    id: "all_clear",
                    dimension: "rotations",
                    severity: "ok",
                    title: "All " + n + " plantings cleanly scheduled",
                    message: "Zero botanical family rotation conflicts, zero antagonistic pairings, and full structure compliance."
                });
            }
            const sevOrder = { error: 0, warn: 1, info: 2, ok: 3 };
            diagnostics.sort(function (x, y) { return (sevOrder[x.severity] ?? 9) - (sevOrder[y.severity] ?? 9); });
        }

        return {
            rotations: rotations,
            fertility: fertility,
            standardization: standardization,
            structure: structure,
            overall: overall,
            assignedCount: assignedCount,
            totalCount: n,
            diagnostics: diagnostics || []
        };
    }

    function buildScoringContext(state, cropMap) {
        const season = getActiveSeason(state) || { year: state.activeSeason || 2026, blocks: [], tunnels: [], plantings: [] };
        const activeYear = Number(season.year || state.activeSeason || 2026);
        const blocks = season.blocks || [];
        const tunnels = season.tunnels || [];
        const plantings = season.plantings || [];

        const blocksById = new Map();
        const disabledByBlock = new Map();
        const tunnelBedsByBlock = new Map();

        blocks.forEach(function (b) {
            blocksById.set(b.id, b);
            disabledByBlock.set(b.id, getDisabledNeighborBeds(b, tunnels));
            const tSet = new Set();
            tunnels.forEach(function (t) {
                if (t.blockId !== b.id) return;
                const s = Math.min(Number(t.startBed), Number(t.endBed));
                const e = Math.max(Number(t.startBed), Number(t.endBed));
                for (let k = s; k <= e; k++) tSet.add(k);
            });
            tunnelBedsByBlock.set(b.id, tSet);
        });

        const items = plantings.map(function (p) {
            const crop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
            const block = p.blockId ? blocksById.get(p.blockId) : null;
            const dates = computePlantingDates(p, crop, block, tunnels, state.climateAdjusted !== false);
            const range = getPlantingDateRangeMs(Object.assign({}, p, dates), crop, block, tunnels);
            const fam = (crop && crop.family) || "Unknown";
            const bedCount = Math.max(0.1, Number(p.bedCount ?? 1));
            return {
                id: p.id,
                cropName: crop ? crop.name : p.cropName,
                displayName: p.label || (crop ? crop.name : p.cropName),
                crop: crop,
                family: fam,
                rotationYears: (crop && crop.rotationYears) || DEFAULT_ROTATION_CYCLES[fam] || 3,
                nutrientLevel: NUTRIENT_LEVEL[(crop && crop.nutrientDemand) || "Medium"] ?? 2,
                category: (crop && crop.category) || "Vegetable",
                prefersProtected: Boolean(crop && crop.prefersProtected),
                frostTolerance: (crop && crop.frostTolerance) || "half-hardy",
                interplanted: Boolean(p.interplanted),
                bedCount: bedCount,
                bedSpan: Math.max(1, Math.ceil(bedCount)),
                startIso: dates.startDate,
                harvestStartIso: dates.harvestStartDate,
                startMs: range[0],
                endMs: range[1]
            };
        });

        const n = items.length;
        const compatMatrix = new Array(n);
        for (let i = 0; i < n; i++) {
            compatMatrix[i] = new Uint8Array(n);
        }
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const rel = pairCompatibility(items[i].crop, items[i].cropName, items[j].crop, items[j].cropName);
                const code = rel === "conflict" ? 2 : (rel === "companion" ? 1 : 0);
                compatMatrix[i][j] = code;
                compatMatrix[j][i] = code;
            }
        }

        const assignments = plantings.map(function (p) {
            return (p.blockId && p.bedStart) ? { blockId: p.blockId, bedStart: Number(p.bedStart) } : null;
        });

        return {
            season: season,
            activeYear: activeYear,
            blocks: blocks,
            blocksById: blocksById,
            disabledByBlock: disabledByBlock,
            isBedUnderTunnel: function (block, bedStart, bedSpan) {
                const tSet = tunnelBedsByBlock.get(block.id);
                if (!tSet || tSet.size === 0) return false;
                for (let b = bedStart; b < bedStart + bedSpan; b++) {
                    if (tSet.has(b)) return true;
                }
                return false;
            },
            priorHistory: buildPriorBedHistoryIndex(state, activeYear, cropMap),
            frost: getFrostWindow(activeYear),
            standardLengthM: Number((state.farmDefaults && state.farmDefaults.bedLengthM) || 30),
            items: items,
            assignments: assignments,
            compatMatrix: compatMatrix
        };
    }

    function scoreCropMap(state, cropMap) {
        if (!state) return evaluatePlanCore([], [], {}, true);
        const context = buildScoringContext(state, cropMap);
        return evaluatePlanCore(context.items, context.assignments, context, true);
    }

    function makePrng(seed) {
        let s = seed >>> 0;
        return function () {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function canPlaceLightweight(itemIdx, blockId, bedStart, assignments, items, overlapMatrix) {
        const item = items[itemIdx];
        if (item.interplanted) return true;
        const startBed = bedStart;
        const endBed = startBed + item.bedSpan - 1;

        for (let b = startBed; b <= endBed; b++) {
            const offset = b - startBed;
            const rem = item.bedCount - offset;
            const incomingFrac = rem >= 1 ? 1.0 : Math.max(0.1, rem);

            // Fast check against assigned items on same block, overlapping bed b and dates
            const active = [];
            for (let j = 0; j < items.length; j++) {
                if (j === itemIdx || items[j].interplanted) continue;
                const aj = assignments[j];
                if (!aj || aj.blockId !== blockId) continue;
                if (!overlapMatrix[itemIdx][j]) continue;
                const oStart = aj.bedStart;
                const oEnd = oStart + items[j].bedSpan - 1;
                if (b < oStart || b > oEnd) continue;
                const oOff = b - oStart;
                const oRem = items[j].bedCount - oOff;
                const oFrac = oRem >= 1 ? 1.0 : Math.max(0.1, oRem);
                active.push({ idx: j, frac: oFrac });
            }

            if (active.length === 0) continue;
            // Fast upper bound: if sum of all overlapping fracs + incoming <= 1.001, definitely safe!
            let totalSum = incomingFrac;
            for (let k = 0; k < active.length; k++) totalSum += active[k].frac;
            if (totalSum <= 1.001) continue;

            // Exact midpoint overlap check across active items
            for (let a = 0; a < active.length; a++) {
                const ia = active[a].idx;
                const mid = (Math.max(item.startMs, items[ia].startMs) + Math.min(item.endMs, items[ia].endMs)) / 2;
                let used = incomingFrac;
                for (let c = 0; c < active.length; c++) {
                    const ic = active[c].idx;
                    if (items[ic].startMs <= mid && mid < items[ic].endMs) {
                        used += active[c].frac;
                    }
                }
                if (used > 1.001) return false;
            }
        }
        return true;
    }

    function optimizeCropMap(state, cropMap, maxIterations) {
        const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        const itersLimit = Math.max(1, Math.round(Number(maxIterations) || 2500));
        const context = buildScoringContext(state, cropMap);
        const items = context.items;
        const n = items.length;
        const baseline = evaluatePlanCore(items, context.assignments, context, true);

        if (n === 0 || context.blocks.length === 0) {
            return {
                baseline: baseline,
                optimized: baseline,
                optimizedState: cloneState(state),
                improved: false,
                iterationsTested: 0,
                elapsedMs: 0,
                changes: []
            };
        }

        // Precompute overlap matrix & static valid candidate slots per planting
        const overlapMatrix = new Array(n);
        for (let i = 0; i < n; i++) {
            overlapMatrix[i] = new Uint8Array(n);
        }
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (rangesOverlap(items[i].startMs, items[i].endMs, items[j].startMs, items[j].endMs)) {
                    overlapMatrix[i][j] = 1;
                    overlapMatrix[j][i] = 1;
                }
            }
        }

        const candidateSlots = new Array(n);
        for (let i = 0; i < n; i++) {
            const slots = [];
            const span = items[i].bedSpan;
            for (let bi = 0; bi < context.blocks.length; bi++) {
                const blk = context.blocks[bi];
                if (blk.isFallow) continue;
                const disabled = context.disabledByBlock.get(blk.id);
                const maxStart = blk.bedCount - span + 1;
                for (let b = 1; b <= maxStart; b++) {
                    let hatched = false;
                    if (disabled) {
                        for (let k = b; k < b + span; k++) {
                            if (disabled.has(k)) { hatched = true; break; }
                        }
                    }
                    if (!hatched) slots.push({ blockId: blk.id, bedStart: b });
                }
            }
            candidateSlots[i] = slots;
        }

        const rand = makePrng(context.activeYear * 2654435761 + n * 17);
        const current = context.assignments.map(function (a) { return a ? { blockId: a.blockId, bedStart: a.bedStart } : null; });
        let currentScore = baseline;
        let best = current.map(function (a) { return a ? { blockId: a.blockId, bedStart: a.bedStart } : null; });
        let bestScore = baseline;

        // First greedy pass: place all unassigned plantings into best non-colliding slot
        let iterationsTested = 0;
        for (let i = 0; i < n; i++) {
            if (current[i]) continue;
            const slots = candidateSlots[i];
            let bestSlot = null;
            let bestSlotScore = -1;
            for (let si = 0; si < slots.length; si++) {
                const slot = slots[si];
                if (!canPlaceLightweight(i, slot.blockId, slot.bedStart, current, items, overlapMatrix)) continue;
                iterationsTested += 1;
                current[i] = slot;
                const sc = evaluatePlanCore(items, current, context, false);
                const rank = sc.overall * 1000 + sc.rotations + sc.fertility + sc.structure;
                if (rank > bestSlotScore) {
                    bestSlotScore = rank;
                    bestSlot = slot;
                }
            }
            current[i] = bestSlot;
        }

        currentScore = evaluatePlanCore(items, current, context, false);
        if (currentScore.overall > bestScore.overall ||
            (currentScore.overall === bestScore.overall && (currentScore.rotations + currentScore.fertility + currentScore.structure) > (bestScore.rotations + bestScore.fertility + bestScore.structure))) {
            bestScore = currentScore;
            best = current.map(function (a) { return a ? { blockId: a.blockId, bedStart: a.bedStart } : null; });
        }

        // Simulated annealing refinement loop
        let temp = 6.0;
        const cooling = 0.9965;
        while (iterationsTested < itersLimit) {
            if ((iterationsTested & 127) === 0) {
                const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
                if (now - t0 > 95) break;
            }

            const i = Math.floor(rand() * n);
            const slots = candidateSlots[i];
            if (!slots.length) {
                iterationsTested += 1;
                continue;
            }

            // 35% chance swap two plantings, 65% chance move planting i to a valid slot
            if (n >= 2 && rand() < 0.35 && current[i]) {
                const j = Math.floor(rand() * n);
                if (i !== j && current[j]) {
                    const slotA = current[i];
                    const slotB = current[j];
                    const validA = candidateSlots[i].some(function (s) { return s.blockId === slotB.blockId && s.bedStart === slotB.bedStart; });
                    const validB = candidateSlots[j].some(function (s) { return s.blockId === slotA.blockId && s.bedStart === slotA.bedStart; });
                    if (validA && validB) {
                        current[i] = null;
                        current[j] = null;
                        if (canPlaceLightweight(i, slotB.blockId, slotB.bedStart, current, items, overlapMatrix)) {
                            current[i] = slotB;
                            if (canPlaceLightweight(j, slotA.blockId, slotA.bedStart, current, items, overlapMatrix)) {
                                current[j] = slotA;
                                iterationsTested += 1;
                                const candScore = evaluatePlanCore(items, current, context, false);
                                const delta = (candScore.overall - currentScore.overall) +
                                    0.15 * ((candScore.rotations + candScore.fertility + candScore.structure) - (currentScore.rotations + currentScore.fertility + currentScore.structure));
                                if (delta >= 0 || rand() < Math.exp(delta / Math.max(0.05, temp))) {
                                    currentScore = candScore;
                                    if (candScore.overall > bestScore.overall ||
                                        (candScore.overall === bestScore.overall && (candScore.rotations + candScore.fertility + candScore.structure) > (bestScore.rotations + bestScore.fertility + bestScore.structure))) {
                                        bestScore = candScore;
                                        best = current.map(function (a) { return a ? { blockId: a.blockId, bedStart: a.bedStart } : null; });
                                    }
                                    temp *= cooling;
                                    continue;
                                }
                            }
                        }
                        current[i] = slotA;
                        current[j] = slotB;
                        iterationsTested += 1;
                        temp *= cooling;
                        continue;
                    }
                }
            }

            // Single move to a random valid non-colliding slot
            const prev = current[i];
            const candSlot = slots[Math.floor(rand() * slots.length)];
            if (prev && prev.blockId === candSlot.blockId && prev.bedStart === candSlot.bedStart) {
                iterationsTested += 1;
                temp *= cooling;
                continue;
            }
            if (canPlaceLightweight(i, candSlot.blockId, candSlot.bedStart, current, items, overlapMatrix)) {
                current[i] = candSlot;
                iterationsTested += 1;
                const candScore = evaluatePlanCore(items, current, context, false);
                const delta = (candScore.overall - currentScore.overall) +
                    0.15 * ((candScore.rotations + candScore.fertility + candScore.structure) - (currentScore.rotations + currentScore.fertility + currentScore.structure));
                if (delta >= 0 || rand() < Math.exp(delta / Math.max(0.05, temp))) {
                    currentScore = candScore;
                    if (candScore.overall > bestScore.overall ||
                        (candScore.overall === bestScore.overall && (candScore.rotations + candScore.fertility + candScore.structure) > (bestScore.rotations + bestScore.fertility + bestScore.structure))) {
                        bestScore = candScore;
                        best = current.map(function (a) { return a ? { blockId: a.blockId, bedStart: a.bedStart } : null; });
                    }
                } else {
                    current[i] = prev;
                }
            } else {
                iterationsTested += 1;
            }
            temp *= cooling;
        }

        // Build final state guaranteeing optimized.overall >= baseline.overall
        const optimizedState = cloneState(state);
        const optSeason = getActiveSeason(optimizedState);
        const changes = [];
        if (optSeason && Array.isArray(optSeason.plantings)) {
            optSeason.plantings.forEach(function (p, idx) {
                const oldA = context.assignments[idx];
                const newA = best[idx];
                const oldKey = oldA ? (oldA.blockId + ":" + oldA.bedStart) : "";
                const newKey = newA ? (newA.blockId + ":" + newA.bedStart) : "";
                if (oldKey !== newKey && newA) {
                    changes.push({
                        plantingId: p.id,
                        cropName: p.label || p.cropName,
                        fromBlockId: oldA ? oldA.blockId : null,
                        fromBedStart: oldA ? oldA.bedStart : null,
                        toBlockId: newA.blockId,
                        toBedStart: newA.bedStart
                    });
                    p.blockId = newA.blockId;
                    p.bedStart = newA.bedStart;
                }
            });
            hydrateSeasonDates(optSeason, cropMap, optimizedState.climateAdjusted);
        }

        let finalScore = scoreCropMap(optimizedState, cropMap);
        if (finalScore.overall < baseline.overall) {
            return {
                baseline: baseline,
                optimized: baseline,
                optimizedState: cloneState(state),
                improved: false,
                iterationsTested: iterationsTested,
                elapsedMs: +(((typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) - t0)).toFixed(1),
                changes: []
            };
        }

        const elapsedMs = +(((typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) - t0)).toFixed(1);
        return {
            baseline: baseline,
            optimized: finalScore,
            optimizedState: optimizedState,
            improved: finalScore.overall > baseline.overall || changes.length > 0,
            iterationsTested: iterationsTested,
            elapsedMs: elapsedMs,
            changes: changes
        };
    }

    // =========================================================================
    // 7. NURSERY FORECASTER, FIELD TASKS, SEED SUMMARY, SUCCESSIONS & CSV
    // =========================================================================
    function computeWeeklyNurseryLoad(state, cropMap) {
        const season = getActiveSeason(state);
        const year = Number((season && season.year) || (state && state.activeSeason) || 2026);
        const capacityM2 = Math.max(1, Number((state && state.farmDefaults && (state.farmDefaults.benchAreaM2 ?? state.farmDefaults.nurseryBenchM2)) || 40));

        const weeks = [];
        for (let w = 1; w <= 52; w++) {
            const startIso = addDaysIso(year + "-01-01", (w - 1) * 7);
            const endIso = addDaysIso(startIso, 6);
            weeks.push({
                week: w,
                startDate: startIso,
                endDate: endIso,
                label: "W" + w,
                benchUsedM2: 0,
                capacityM2: capacityM2,
                utilizationPct: 0,
                status: "ok",
                trays: 0,
                potUpCount: 0,
                breakdown: []
            });
        }

        let totalTrays = 0;
        if (season && Array.isArray(season.plantings)) {
            const blocksById = new Map((season.blocks || []).map(function (b) { return [b.id, b]; }));
            const tunnels = season.tunnels || [];

            season.plantings.forEach(function (p) {
                const crop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
                const block = p.blockId ? blocksById.get(p.blockId) : null;
                const dates = computePlantingDates(p, crop, block, tunnels, state.climateAdjusted !== false);
                const metrics = computePlantingMetrics(p, crop, block, state.units);
                if (metrics.method !== "Transplant" || dates.nurseryDays <= 0) return;

                totalTrays += metrics.nurseryTraysCeil;
                const propEnd = dates.pottingUpDate || dates.transplantDate;
                const propStartMs = parseIsoDateUtc(dates.seedingDate).getTime();
                const propEndMs = parseIsoDateUtc(propEnd).getTime();
                const potStartMs = dates.pottingUpDate ? parseIsoDateUtc(dates.pottingUpDate).getTime() : 0;
                const transMs = parseIsoDateUtc(dates.transplantDate).getTime();

                weeks.forEach(function (wk) {
                    const wStartMs = parseIsoDateUtc(wk.startDate).getTime();
                    const wEndMs = parseIsoDateUtc(wk.endDate).getTime() + 86400000;
                    if (rangesOverlap(wStartMs, wEndMs, propStartMs, propEndMs)) {
                        wk.benchUsedM2 += metrics.propagationBenchM2;
                        wk.trays += metrics.nurseryTraysCeil;
                        wk.breakdown.push({
                            plantingId: p.id,
                            cropName: p.label || (crop ? crop.name : p.cropName),
                            stage: "propagation",
                            benchM2: metrics.propagationBenchM2,
                            trays: metrics.nurseryTraysCeil
                        });
                    } else if (dates.pottingUpDate && rangesOverlap(wStartMs, wEndMs, potStartMs, transMs)) {
                        wk.benchUsedM2 += metrics.potUpBenchM2;
                        wk.potUpCount += metrics.potUpCount;
                        wk.breakdown.push({
                            plantingId: p.id,
                            cropName: p.label || (crop ? crop.name : p.cropName),
                            stage: "pottingUp",
                            benchM2: metrics.potUpBenchM2,
                            trays: 0
                        });
                    }
                });
            });
        }

        let peakUtilizationPct = 0;
        let peakWeek = 1;
        weeks.forEach(function (wk) {
            wk.benchUsedM2 = +wk.benchUsedM2.toFixed(2);
            wk.utilizationPct = +((wk.benchUsedM2 / capacityM2) * 100).toFixed(1);
            wk.status = wk.utilizationPct >= 100 ? "over" : (wk.utilizationPct >= 85 ? "warn" : "ok");
            if (wk.utilizationPct > peakUtilizationPct) {
                peakUtilizationPct = wk.utilizationPct;
                peakWeek = wk.week;
            }
        });

        return {
            year: year,
            capacityM2: capacityM2,
            peakUtilizationPct: peakUtilizationPct,
            peakWeek: peakWeek,
            totalTrays: totalTrays,
            weeks: weeks
        };
    }

    function generateFieldTasks(state, cropMap) {
        const season = getActiveSeason(state);
        if (!season || !Array.isArray(season.plantings)) return [];

        const blocksById = new Map((season.blocks || []).map(function (b) { return [b.id, b]; }));
        const tunnels = season.tunnels || [];
        const completedSet = new Set(season.completedTaskIds || []);
        const tasks = [];

        season.plantings.forEach(function (p) {
            const crop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
            const block = p.blockId ? blocksById.get(p.blockId) : null;
            const dates = computePlantingDates(p, crop, block, tunnels, state.climateAdjusted !== false);
            const m = computePlantingMetrics(p, crop, block, state.units);
            const cropTitle = p.label || (crop ? crop.name : p.cropName);
            const loc = block && p.bedStart
                ? (block.name + " · Bed " + p.bedStart + (m.bedCount > 1 ? "–" + (p.bedStart + Math.ceil(m.bedCount) - 1) : ""))
                : "Unassigned";

            if (m.method === "Transplant") {
                const seedId = p.id + "__seed_indoors";
                tasks.push({
                    id: seedId,
                    plantingId: p.id,
                    cropName: cropTitle,
                    type: "seed_indoors",
                    typeLabel: "Seed Indoors",
                    date: dates.seedingDate,
                    week: getIsoWeekNumber(dates.seedingDate),
                    blockId: p.blockId,
                    blockName: block ? block.name : "Unassigned",
                    bedStart: p.bedStart,
                    bedCount: m.bedCount,
                    locationLabel: "Nursery → " + loc,
                    details: m.nurseryTraysCeil + "× " + m.trayCells + "-cell tray (" + m.seedsNeeded + " seeds, " + m.seedGrams + " g)",
                    completed: completedSet.has(seedId)
                });

                if (dates.pottingUpDate && m.potUpCount > 0) {
                    const potId = p.id + "__pot_up";
                    tasks.push({
                        id: potId,
                        plantingId: p.id,
                        cropName: cropTitle,
                        type: "pot_up",
                        typeLabel: "Pot Up",
                        date: dates.pottingUpDate,
                        week: getIsoWeekNumber(dates.pottingUpDate),
                        blockId: p.blockId,
                        blockName: block ? block.name : "Unassigned",
                        bedStart: p.bedStart,
                        bedCount: m.bedCount,
                        locationLabel: "Nursery → " + loc,
                        details: "Pot up " + m.potUpCount + " seedlings (" + m.potUpBenchM2 + " m² bench)",
                        completed: completedSet.has(potId)
                    });
                }

                const transId = p.id + "__transplant";
                tasks.push({
                    id: transId,
                    plantingId: p.id,
                    cropName: cropTitle,
                    type: "transplant",
                    typeLabel: "Transplant",
                    date: dates.transplantDate,
                    week: getIsoWeekNumber(dates.transplantDate),
                    blockId: p.blockId,
                    blockName: block ? block.name : "Unassigned",
                    bedStart: p.bedStart,
                    bedCount: m.bedCount,
                    locationLabel: loc,
                    details: m.plants + " plants · " + m.rowsPerBed + " rows @ " + formatSpacing(m.inRowCm, state.units),
                    completed: completedSet.has(transId)
                });
            } else {
                const dsId = p.id + "__direct_seed";
                const seederTag = (crop && crop.seederPreset) ? " · Seeder preset ready" : "";
                tasks.push({
                    id: dsId,
                    plantingId: p.id,
                    cropName: cropTitle,
                    type: "direct_seed",
                    typeLabel: "Direct Seed",
                    date: dates.seedingDate,
                    week: getIsoWeekNumber(dates.seedingDate),
                    blockId: p.blockId,
                    blockName: block ? block.name : "Unassigned",
                    bedStart: p.bedStart,
                    bedCount: m.bedCount,
                    locationLabel: loc,
                    details: m.seedsNeeded + " seeds (" + m.seedGrams + " g) · " + m.rowsPerBed + " rows @ " + formatSpacing(m.inRowCm, state.units) + seederTag,
                    completed: completedSet.has(dsId)
                });
            }

            const harvId = p.id + "__harvest";
            tasks.push({
                id: harvId,
                plantingId: p.id,
                cropName: cropTitle,
                type: "harvest",
                typeLabel: "Harvest",
                date: dates.harvestStartDate,
                week: getIsoWeekNumber(dates.harvestStartDate),
                blockId: p.blockId,
                blockName: block ? block.name : "Unassigned",
                bedStart: p.bedStart,
                bedCount: m.bedCount,
                locationLabel: loc,
                details: "Window " + dates.harvestStartDate + " → " + dates.harvestEndDate + " (Est. " + m.estYield + " " + m.yieldUnit + ")",
                completed: completedSet.has(harvId)
            });
        });

        tasks.sort(function (a, b) {
            if (a.date !== b.date) return a.date < b.date ? -1 : 1;
            return a.typeLabel.localeCompare(b.typeLabel);
        });

        return tasks;
    }

    function toggleTaskCompleted(state, taskId) {
        const season = getActiveSeason(state);
        if (!season || !taskId) return false;
        if (!Array.isArray(season.completedTaskIds)) season.completedTaskIds = [];
        const idx = season.completedTaskIds.indexOf(taskId);
        if (idx === -1) {
            season.completedTaskIds.push(taskId);
            return true;
        }
        season.completedTaskIds.splice(idx, 1);
        return false;
    }

    function computeSeedOrderSummary(state, cropMap) {
        const season = getActiveSeason(state);
        if (!season || !Array.isArray(season.plantings)) return [];

        const blocksById = new Map((season.blocks || []).map(function (b) { return [b.id, b]; }));
        const byCrop = new Map();

        season.plantings.forEach(function (p) {
            const crop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
            const canonical = crop ? crop.name : p.cropName;
            const block = p.blockId ? blocksById.get(p.blockId) : null;
            const m = computePlantingMetrics(p, crop, block, state.units);

            if (!byCrop.has(canonical)) {
                byCrop.set(canonical, {
                    cropName: canonical,
                    latin: (crop && crop.latin) || "",
                    family: (crop && crop.family) || "Other",
                    method: m.method,
                    plantingsCount: 0,
                    totalBedLengthM: 0,
                    totalPlants: 0,
                    totalSeedsNeeded: 0,
                    totalSeedGrams: 0,
                    totalTrays: 0,
                    totalEstYield: 0,
                    yieldUnit: m.yieldUnit,
                    totalValueCad: 0,
                    seederPreset: p.seederPreset || (crop && crop.seederPreset) || null
                });
            }
            const agg = byCrop.get(canonical);
            agg.plantingsCount += 1;
            agg.totalBedLengthM = +(agg.totalBedLengthM + m.bedLengthUsedM).toFixed(2);
            agg.totalPlants += m.plantsWithMargin;
            agg.totalSeedsNeeded += m.seedsNeeded;
            agg.totalSeedGrams = +(agg.totalSeedGrams + m.seedGrams).toFixed(2);
            agg.totalTrays += m.nurseryTraysCeil;
            agg.totalEstYield = +(agg.totalEstYield + m.estYield).toFixed(1);
            agg.totalValueCad = +(agg.totalValueCad + m.estValueCad).toFixed(2);
        });

        return Array.from(byCrop.values()).sort(function (a, b) {
            return a.cropName.localeCompare(b.cropName);
        });
    }

    function generateSuccessions(basePlanting, count, intervalDays, crop, block, tunnels, climateAdjusted) {
        const total = clamp(Math.round(Number(count) || 1), 1, 20);
        const step = Math.max(1, Math.round(Number(intervalDays) || 14));
        const base = basePlanting || {};
        const baseLabel = (base.label || base.cropName || (crop && crop.name) || "Planting").replace(/\s*#\d+$/, "").trim();
        const out = [];
        let prevEndIso = null;

        for (let i = 0; i < total; i++) {
            const copy = JSON.parse(JSON.stringify(base));
            copy.id = i === 0 && base.id ? base.id : generateId("succ");
            copy.label = baseLabel + " #" + (i + 1);
            if (copy.lockHarvestDate && copy.targetHarvestDate) {
                copy.targetHarvestDate = addDaysIso(base.targetHarvestDate, i * step);
            } else {
                const startBase = base.startDate || "2026-05-01";
                copy.startDate = addDaysIso(startBase, i * step);
            }
            const dates = computePlantingDates(copy, crop, block, tunnels, climateAdjusted);
            copy.startDate = dates.startDate;
            copy.endDate = dates.endDate;
            copy.harvestStartDate = dates.harvestStartDate;
            copy.harvestEndDate = dates.harvestEndDate;
            copy.seedingDate = dates.seedingDate;
            copy.transplantDate = dates.transplantDate;
            copy.pottingUpDate = dates.pottingUpDate;
            copy.effectiveDtm = dates.effectiveDtm;

            // Keep same bed only if it does not overlap the previous succession on that bed
            if (i > 0 && prevEndIso && copy.startDate < prevEndIso && !copy.interplanted) {
                copy.blockId = null;
                copy.bedStart = null;
            }
            if (copy.blockId && copy.bedStart) {
                prevEndIso = copy.endDate;
            }
            out.push(copy);
        }
        return out;
    }

    function escapeCsv(val) {
        const s = String(val === null || val === undefined ? "" : val);
        if (/[",\n\r]/.test(s)) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    function exportScheduleCsv(state, cropMap) {
        const season = getActiveSeason(state);
        if (!season) return "";
        const blocksById = new Map((season.blocks || []).map(function (b) { return [b.id, b]; }));
        const tunnels = season.tunnels || [];

        const headers = [
            "Season", "Block", "Bed Start", "Bed Count", "Interplanted",
            "Crop", "Latin Name", "Family", "Method",
            "Seeding Date", "Transplant Date", "Harvest Start", "Harvest End", "Effective DTM",
            "Rows/Bed", "In-Row (cm)", "Between-Row (cm)",
            "Plants", "Seeds Needed", "Seed (g)", "Nursery Trays",
            "Est Yield", "Yield Unit", "Est Value (CAD)"
        ];
        const lines = [headers.join(",")];

        (season.plantings || []).forEach(function (p) {
            const crop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
            const block = p.blockId ? blocksById.get(p.blockId) : null;
            const d = computePlantingDates(p, crop, block, tunnels, state.climateAdjusted !== false);
            const m = computePlantingMetrics(p, crop, block, state.units);
            lines.push([
                season.year,
                block ? block.name : "Unassigned",
                p.bedStart || "",
                m.bedCount,
                p.interplanted ? "Yes" : "No",
                p.label || (crop ? crop.name : p.cropName),
                (crop && crop.latin) || "",
                (crop && crop.family) || "",
                m.method,
                d.seedingDate,
                d.transplantDate || "",
                d.harvestStartDate,
                d.harvestEndDate,
                d.effectiveDtm,
                m.rowsPerBed,
                m.inRowCm,
                m.betweenRowCm,
                m.plants,
                m.seedsNeeded,
                m.seedGrams,
                m.nurseryTraysCeil,
                m.estYield,
                m.yieldUnit,
                m.estValueCad
            ].map(escapeCsv).join(","));
        });

        return lines.join("\n");
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================
    global.WCPPBedSimCore = {
        STORAGE_KEY: STORAGE_KEY,
        BC_MONTHLY_TEMP_C: BC_MONTHLY_TEMP_C,
        DEFAULT_ROTATION_CYCLES: DEFAULT_ROTATION_CYCLES,
        STANDARD_BED_PRESETS: STANDARD_BED_PRESETS,
        FAMILY_COLORS: FAMILY_COLORS,
        CATEGORY_COLORS: CATEGORY_COLORS,

        loadCatalog: loadCatalog,
        getCatalog: function () { return _cachedCatalog; },
        resolveCrop: resolveCrop,
        getFamilyColor: getFamilyColor,
        getCategoryColor: getCategoryColor,

        loadState: loadState,
        saveState: saveState,
        createStateFromPreset: createStateFromPreset,
        cloneState: cloneState,
        pushUndo: pushUndo,
        undo: undo,
        redo: redo,
        canUndo: canUndo,
        canRedo: canRedo,
        duplicateSeason: duplicateSeason,
        getActiveSeason: getActiveSeason,
        getBedRotationHistory: getBedRotationHistory,

        getClimateInfo: getClimateInfo,
        getFrostWindow: getFrostWindow,
        computeEffectiveDtm: computeEffectiveDtm,
        computePlantingDates: computePlantingDates,
        addDaysIso: addDaysIso,
        diffDaysIso: diffDaysIso,
        dateToYearFraction: dateToYearFraction,
        getIsoWeekNumber: getIsoWeekNumber,

        computePlantingMetrics: computePlantingMetrics,

        getDisabledNeighborBeds: getDisabledNeighborBeds,
        checkDropEligibility: checkDropEligibility,
        checkCompanionRelationships: checkCompanionRelationships,

        scoreCropMap: scoreCropMap,
        optimizeCropMap: optimizeCropMap,

        computeWeeklyNurseryLoad: computeWeeklyNurseryLoad,
        generateFieldTasks: generateFieldTasks,
        toggleTaskCompleted: toggleTaskCompleted,
        computeSeedOrderSummary: computeSeedOrderSummary,
        generateSuccessions: generateSuccessions,
        exportScheduleCsv: exportScheduleCsv,

        cmToIn: cmToIn,
        inToCm: inToCm,
        mToFt: mToFt,
        ftToM: ftToM,
        formatLength: formatLength,
        formatSpacing: formatSpacing
    };
})(typeof window !== "undefined" ? window : globalThis);
