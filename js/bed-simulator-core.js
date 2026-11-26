(function (global) {
    "use strict";

    // =========================================================================
    // CONSTANTS & REFERENCE TABLES
    // =========================================================================
    const STORAGE_KEY = "wcpp_bed_sim_v1";
    const PLANS_STORAGE_KEY = "wcpp_bed_sim_plans_v2";
    const PREFS_COOKIE_NAME = "wcpp_bedsim_prefs";
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
    let _enrichmentPromise = null;
    let _enrichmentTimer = null;
    let _bootBaseUrl = "";
    let _bootFetcher = null;
    let _activePlanId = null;
    let _memPrefsFallback = {};
    let _uidCounter = 1;

    // South Coastal BC (Zone 8a) verified flowering windows (month ints 1..12) for common
    // pollinator-attracting companion flowers, culinary herbs, cover crops & fruiting blossoms
    // where garden_crops.json Flower Bloom Time is not yet populated.
    const PNW_COMPANION_BLOOM_MONTHS = {
        "sweet alyssum": [5, 6, 7, 8, 9, 10],
        "alyssum": [5, 6, 7, 8, 9, 10],
        "calendula": [5, 6, 7, 8, 9, 10],
        "marigold (french)": [6, 7, 8, 9, 10],
        "marigold (african)": [6, 7, 8, 9, 10],
        "marigold (signet)": [6, 7, 8, 9, 10],
        "nasturtium": [6, 7, 8, 9, 10],
        "borage": [6, 7, 8, 9],
        "sunflower": [7, 8, 9],
        "zinnia": [7, 8, 9, 10],
        "cornflower": [6, 7, 8],
        "cosmo": [7, 8, 9, 10],
        "cosmos": [7, 8, 9, 10],
        "black-eyed susan": [7, 8, 9],
        "bee balm": [7, 8, 9],
        "coneflower": [7, 8, 9],
        "california poppy": [5, 6, 7, 8],
        "poached egg plant": [4, 5, 6],
        "german chamomile": [6, 7, 8],
        "chive": [5, 6],
        "dill": [7, 8, 9],
        "cilantro": [6, 7, 8],
        "basil": [7, 8, 9],
        "oregano": [7, 8, 9],
        "thyme": [5, 6, 7],
        "rosemary": [3, 4, 5],
        "sage": [6, 7],
        "mint": [7, 8, 9],
        "lavender (english)": [6, 7, 8],
        "lavender (french)": [5, 6, 7, 8],
        "marjoram": [7, 8],
        "savory": [7, 8],
        "lemon balm": [6, 7, 8],
        "crimson clover": [5, 6, 7],
        "red clover": [6, 7, 8],
        "white clover": [5, 6, 7, 8, 9],
        "hairy vetch": [5, 6, 7],
        "alfalfa": [6, 7, 8],
        "buckwheat": [6, 7, 8, 9],
        "strawberry": [4, 5, 6],
        "raspberry": [5, 6],
        "blueberry": [4, 5],
        "fava bean": [4, 5, 6],
        "pea": [5, 6],
        "snow pea": [5, 6],
        "bush green bean": [7, 8],
        "green bean (pole)": [7, 8],
        "tomato": [6, 7, 8],
        "pepper": [6, 7, 8],
        "eggplant": [7, 8],
        "tomatillos": [7, 8],
        "cucumber": [7, 8],
        "zucchini": [6, 7, 8],
        "squash (summer)": [6, 7, 8],
        "squash (winter)": [7, 8],
        "pumpkin": [7, 8],
        "melon": [7, 8],
        "watermelon": [7, 8]
    };

    const GARDEN_ENRICH_FIELDS = [
        "Pollinators Attracted",
        "Natural Predators Attracted",
        "Pest Deterred",
        "Pest Repelled",
        "Pest Attracted / Trapped",
        "Biopesticide Produced Chemical",
        "Disease Suceptibility",
        "Root Formation",
        "Nutrient Feeding Type",
        "pH",
        "Seeding Depth (mm)",
        "Days to Emergence @ 20°C",
        "seeds/gram",
        "Flower Bloom Time"
    ];

    const NATIVE_ENRICH_FIELDS = [
        "Hulquminum_Primary",
        "Halqemeylem_Primary",
        "SENCOTEN_Primary",
        "Hulquminum_Downriver_Primary",
        "Salishan_Alternates_Dialects",
        "Other_First_Nations_Names",
        "Canopy_Layer",
        "Spread_Behavior",
        "Height_Display",
        "Height_Min_cm",
        "Height_Max_cm",
        "Spread_Min_cm",
        "Spread_Max_cm",
        "Light_Tags",
        "Moisture_Tags",
        "Mycorrhizal_Association",
        "Drought_Tolerance",
        "Companion_Plants",
        "Bloom_Months",
        "Pollinators",
        "Common_Bee_Visitors",
        "Lepidoptera_Host_Genera",
        "Total_Lepidoptera_Host_Count",
        "Host_Butterflies_Common",
        "Host_Moths_Common",
        "URL_Slug",
        "Root_Formation",
        "Origin_BC",
        "Plant_Type_Tags",
        "Common_Names_Alt",
        "Synonyms_Basionyms"
    ];

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

    function applyCalendarToCrop(crop, calMap) {
        if (!crop || !calMap) return;
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
                return;
            }
        }
    }

    function copyMeaningfulFields(target, source, fieldList) {
        if (!target || !source || !Array.isArray(fieldList)) return;
        for (let i = 0; i < fieldList.length; i++) {
            const key = fieldList[i];
            if (isMeaningful(source[key])) {
                target[key] = String(source[key]).trim();
            }
        }
    }

    function indexBiosEntries(catalog, biosRows) {
        const list = Array.isArray(biosRows) ? biosRows.filter(function (b) { return b && b.id; }) : [];
        const byId = new Map();
        const byName = new Map();
        const byCategory = new Map();

        function putName(key, entry) {
            const k = normalizeKey(key);
            if (!k || k === "none" || k === "other" || k.length < 2) return;
            if (!byName.has(k)) byName.set(k, entry);
        }

        function putCat(catName, entry) {
            const c = String(catName || "").trim();
            if (!c) return;
            if (!byCategory.has(c)) byCategory.set(c, []);
            const arr = byCategory.get(c);
            if (!arr.some(function (x) { return x.id === entry.id; })) {
                arr.push(entry);
            }
        }

        list.forEach(function (entry) {
            byId.set(entry.id, entry);
            putName(entry.id, entry);
            putName(entry.metabolite, entry);
            putName(entry.scientificName, entry);

            if (entry.category) {
                putCat(entry.category, entry);
                String(entry.category).split(",").forEach(function (subCat) {
                    putCat(subCat, entry);
                });
            }
        });

        list.forEach(function (entry) {
            if (entry.metabolite) {
                String(entry.metabolite).split(/[\/;,]+/).forEach(function (part) {
                    putName(part, entry);
                    const paren = part.match(/^([^(]+)\(([^)]+)\)/);
                    if (paren) {
                        putName(paren[1], entry);
                        putName(paren[2], entry);
                    }
                });
            }
            if (entry.scientificName && isMeaningful(entry.scientificName)) {
                String(entry.scientificName).split(/[;,]+/).forEach(function (part) {
                    putName(part, entry);
                    const paren = part.match(/^([^(]+)\(([^)]+)\)/);
                    if (paren) putName(paren[1], entry);
                });
            }
            if (entry.synonyms && isMeaningful(entry.synonyms)) {
                String(entry.synonyms).split(/[;,]+/).forEach(function (syn) {
                    const clean = syn.replace(/^related species:\s*/i, "").trim();
                    putName(clean, entry);
                    const base = clean.split("(")[0].trim();
                    if (base) putName(base, entry);
                });
            }
            if (entry.tradeNames && isMeaningful(entry.tradeNames)) {
                String(entry.tradeNames).split(/[;,]+/).forEach(function (tn) {
                    putName(tn, entry);
                });
            }
        });

        catalog.bios = list;
        catalog.biosById = byId;
        catalog.biosByName = byName;
        catalog.biosByCategory = byCategory;
    }

    function applyEcologicalEnrichmentData(catalog, gcRaw, nativeRaw, biosRaw) {
        if (!catalog) return catalog;
        const gcRows = unpackDataset(gcRaw);
        const nativeRows = unpackDataset(nativeRaw);
        const biosRows = unpackDataset(biosRaw);

        const crops = catalog.crops;
        const cropMap = catalog.cropMap;
        const aliasMap = catalog.aliasMap;
        const rotationCyclesByFamily = catalog.rotationCyclesByFamily || DEFAULT_ROTATION_CYCLES;
        const usedCodes = catalog._usedCodes || new Set();
        const seenNames = catalog._seenNames || new Set();
        const seenLatins = catalog._seenLatins || new Set();
        const calMap = catalog._calMap || new Map();

        // Index garden_crops by normalized Common Name & Latin Name
        const gcByCommon = new Map();
        const gcByLatin = new Map();
        gcRows.forEach(function (row) {
            const cName = String(row["Common Name"] || "").trim();
            const lName = String(row["Latin Name"] || "").trim();
            if (cName) gcByCommon.set(normalizeKey(cName), row);
            if (lName) gcByLatin.set(normalizeKey(lName), row);
        });

        // Step 2: Merge all 185 rows from garden_crops.json
        gcRows.forEach(function (row) {
            const cName = String(row["Common Name"] || "").trim();
            const lName = String(row["Latin Name"] || "").trim();
            const family = String(row["Family"] || "").trim() || "Other";
            if (!cName && !lName) return;
            const name = cName || lName;
            const nKey = normalizeKey(name);
            const lKey = normalizeKey(lName);

            let crop = cropMap[name] || aliasMap.get(nKey);
            if (!crop && PLANT_SYNONYM_ALIASES[nKey]) {
                const aliasMatch = aliasMap.get(normalizeKey(PLANT_SYNONYM_ALIASES[nKey]));
                if (aliasMatch && aliasMatch.isEstimatedDefault === false && normalizeKey(aliasMatch.name) === normalizeKey(PLANT_SYNONYM_ALIASES[nKey])) {
                    crop = aliasMatch;
                }
            }
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

            if (!Array.isArray(crop._gardenRows)) crop._gardenRows = [];
            crop._gardenRows.push(row);
            if (!crop._gardenRow) crop._gardenRow = row;
            if (!crop.light && isMeaningful(row["Light"])) crop.light = row["Light"];
            if (!crop.waterNeeds && isMeaningful(row["Water Needs"])) crop.waterNeeds = row["Water Needs"];
            if (!crop.phRange && isMeaningful(row["pH"])) crop.phRange = row["pH"];
            if (!crop.lifecycle && isMeaningful(row["Lifecycle"])) crop.lifecycle = row["Lifecycle"];
            if (!crop.sowingTime && isMeaningful(row["Sowing Time"])) crop.sowingTime = row["Sowing Time"];
            copyMeaningfulFields(crop, row, GARDEN_ENRICH_FIELDS);
            copyMeaningfulFields(crop, row, [
                "Height", "Spread", "Drought Tolerance", "Water Needs",
                "Season of Interest", "Characteristics / Uses",
                "Host Bees & Insects (Genus species & Damage)", "Best Temperature Needs"
            ]);
        });

        // Step 3: Merge all unique BC native plants from plants_212.json & index catalog.nativesByName
        const nativesByName = catalog.nativesByName instanceof Map ? catalog.nativesByName : new Map();
        const registerNativeIndex = function (key, cropObj, overwritePrimary) {
            const k = normalizeKey(key);
            if (!k || k === "no information" || k === "coming soon") return;
            if (overwritePrimary || !nativesByName.has(k)) {
                nativesByName.set(k, cropObj);
            }
        };

        nativeRows.forEach(function (p) {
            const cName = String(p.Common_Name_Primary || "").trim();
            const lName = String(p.Latin_Name || "").trim();
            const family = String(p.Family || "").trim() || "Other";
            if (!cName && !lName) return;
            const name = cName || lName;
            const nKey = normalizeKey(name);
            const lKey = normalizeKey(lName);

            let targetCrop = null;
            if (seenNames.has(nKey) || (lKey && seenLatins.has(lKey))) {
                targetCrop = aliasMap.get(nKey) || crops.find(function (c) {
                    return lKey && normalizeKey(c.latin) === lKey;
                });
            }
            if (!targetCrop && p.Synonyms_Basionyms) {
                const synList = String(p.Synonyms_Basionyms).split(/[;,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
                for (let si = 0; si < synList.length; si++) {
                    const sk = normalizeKey(synList[si]);
                    if (seenLatins.has(sk)) {
                        targetCrop = crops.find(function (c) { return normalizeKey(c.latin) === sk; });
                        if (targetCrop) break;
                    }
                }
            }

            if (targetCrop) {
                targetCrop._nativeRow = p;
                targetCrop.isNativeBC = String(p.Origin_BC || "Native").toLowerCase() === "native";
                if (!targetCrop.light && isMeaningful(p.Light_Tags)) targetCrop.light = String(p.Light_Tags).replace(/;\s*/g, ", ");
                if (!targetCrop.waterNeeds && isMeaningful(p.Moisture_Tags)) targetCrop.waterNeeds = String(p.Moisture_Tags).replace(/;\s*/g, ", ");
                if (!targetCrop.phRange && isMeaningful(p.pH_Range)) targetCrop.phRange = p.pH_Range;
                if (!targetCrop.lifecycle && isMeaningful(p.Lifecycle)) targetCrop.lifecycle = p.Lifecycle;
                if (isMeaningful(p.Bloom_Months)) targetCrop.bloomMonths = p.Bloom_Months;
                if (isMeaningful(p.Plant_Type_Tags)) targetCrop.plantTypeTags = p.Plant_Type_Tags;
                if (isMeaningful(p.Allelopathy_Competition_Notes)) targetCrop.allelopathyNotes = p.Allelopathy_Competition_Notes;
                copyMeaningfulFields(targetCrop, p, NATIVE_ENRICH_FIELDS);
            } else {
                targetCrop = buildEstimatedCropDefaults(name, lName, family, "BC Native", null, p, rotationCyclesByFamily, usedCodes);
                targetCrop._nativeRow = p;
                targetCrop.isNativeBC = String(p.Origin_BC || "Native").toLowerCase() === "native";
                if (isMeaningful(p.Light_Tags)) targetCrop.light = String(p.Light_Tags).replace(/;\s*/g, ", ");
                if (isMeaningful(p.Moisture_Tags)) targetCrop.waterNeeds = String(p.Moisture_Tags).replace(/;\s*/g, ", ");
                if (isMeaningful(p.pH_Range)) targetCrop.phRange = p.pH_Range;
                if (isMeaningful(p.Lifecycle)) targetCrop.lifecycle = p.Lifecycle;
                if (isMeaningful(p.Bloom_Months)) targetCrop.bloomMonths = p.Bloom_Months;
                if (isMeaningful(p.Plant_Type_Tags)) targetCrop.plantTypeTags = p.Plant_Type_Tags;
                if (isMeaningful(p.Allelopathy_Competition_Notes)) targetCrop.allelopathyNotes = p.Allelopathy_Competition_Notes;
                copyMeaningfulFields(targetCrop, p, NATIVE_ENRICH_FIELDS);

                crops.push(targetCrop);
                cropMap[targetCrop.name] = targetCrop;
                seenNames.add(nKey);
                if (lKey) seenLatins.add(lKey);
                registerAlias(aliasMap, targetCrop.name, targetCrop);
            }

            registerNativeIndex(cName, targetCrop, true);
            registerNativeIndex(lName, targetCrop, true);
            if (p.URL_Slug) registerNativeIndex(p.URL_Slug, targetCrop, true);
            if (p.Common_Names_Alt) {
                String(p.Common_Names_Alt).split(/[;,]+/).forEach(function (alt) {
                    registerAlias(aliasMap, alt, targetCrop);
                    registerNativeIndex(alt, targetCrop, false);
                });
            }
            if (p.Synonyms_Basionyms) {
                String(p.Synonyms_Basionyms).split(/[;,]+/).forEach(function (syn) {
                    registerAlias(aliasMap, syn, targetCrop);
                    registerNativeIndex(syn, targetCrop, false);
                });
            }
        });
        catalog.nativesByName = nativesByName;

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
        crops.forEach(function (crop) {
            if (!crop.bcCalendar) {
                applyCalendarToCrop(crop, calMap);
            }

            const compSet = new Set(crop.companions || []);
            const antSet = new Set(crop.antagonists || []);
            const gRows = Array.isArray(crop._gardenRows) && crop._gardenRows.length
                ? crop._gardenRows
                : [crop._gardenRow || gcByCommon.get(normalizeKey(crop.name)) || (crop.latin ? gcByLatin.get(normalizeKey(crop.latin)) : null)].filter(Boolean);
            gRows.forEach(function (gRow) {
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
            });

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

            delete crop._gardenRow;
            delete crop._gardenRows;
            delete crop._nativeRow;
        });

        // Step 5: Index bios_base.json
        indexBiosEntries(catalog, biosRows);

        catalog.enriched = true;
        catalog.enriching = false;
        catalog.enrichedAt = Date.now();
        return catalog;
    }

    function clearPendingEnrichmentTimer() {
        if (_enrichmentTimer !== null) {
            if (_enrichmentTimer.kind === "idle" && typeof global.cancelIdleCallback === "function") {
                try { global.cancelIdleCallback(_enrichmentTimer.id); } catch (_) {}
            } else {
                clearTimeout(_enrichmentTimer.id);
            }
            _enrichmentTimer = null;
        }
    }

    function scheduleBackgroundEnrichment(catalog, options) {
        if (!catalog || catalog.enriched || _enrichmentPromise || _enrichmentTimer) return;
        const opts = options || {};
        const runNow = function () {
            _enrichmentTimer = null;
            loadEcologicalEnrichment(catalog, {
                immediate: true,
                baseUrl: opts.baseUrl,
                fetcher: opts.fetcher
            }).catch(function () {});
        };
        const delayMs = Number.isFinite(Number(opts.delayMs)) ? Math.max(0, Number(opts.delayMs)) : 90;
        const timerId = setTimeout(function () {
            _enrichmentTimer = null;
            if (typeof global.requestIdleCallback === "function") {
                const ricId = global.requestIdleCallback(runNow, { timeout: 1200 });
                _enrichmentTimer = { kind: "idle", id: ricId };
            } else {
                runNow();
            }
        }, delayMs);
        _enrichmentTimer = { kind: "timeout", id: timerId };
    }

    async function loadEcologicalEnrichment(catalog, options) {
        const opts = options || {};
        let targetCatalog = catalog || _cachedCatalog;
        if (!targetCatalog) {
            targetCatalog = await loadCatalog(Object.assign({}, opts, { autoEnrich: false }));
        }
        if (targetCatalog.enriched && !opts.force) {
            return targetCatalog;
        }
        if (opts.force) {
            clearPendingEnrichmentTimer();
            _enrichmentPromise = null;
        }
        if (_enrichmentPromise && !opts.force) {
            if (opts.immediate) {
                clearPendingEnrichmentTimer();
            }
            return _enrichmentPromise;
        }
        if (opts.background === true || opts.immediate === false) {
            scheduleBackgroundEnrichment(targetCatalog, opts);
            return new Promise(function (resolve, reject) {
                const checkOrWait = function () {
                    if (targetCatalog.enriched) {
                        resolve(targetCatalog);
                    } else if (_enrichmentPromise) {
                        _enrichmentPromise.then(resolve, reject);
                    } else {
                        setTimeout(checkOrWait, 40);
                    }
                };
                checkOrWait();
            });
        }

        clearPendingEnrichmentTimer();
        const base = opts.baseUrl !== undefined ? opts.baseUrl : (targetCatalog._baseUrl !== undefined ? targetCatalog._baseUrl : _bootBaseUrl);
        const fetcher = opts.fetcher || targetCatalog._fetcher || _bootFetcher || fetchJsonSafe;
        targetCatalog.enriching = true;

        _enrichmentPromise = Promise.all([
            fetcher(base + "data/garden_crops.json"),
            fetcher(base + "data/plants_212.json"),
            fetcher(base + "data/bios_base.json")
        ]).then(function (results) {
            applyEcologicalEnrichmentData(targetCatalog, results[0], results[1], results[2]);
            if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
                try {
                    global.dispatchEvent(new global.CustomEvent("wcpp:bedsim-enriched", {
                        detail: { catalog: targetCatalog }
                    }));
                } catch (_) {}
            }
            return targetCatalog;
        }).catch(function (err) {
            targetCatalog.enriching = false;
            _enrichmentPromise = null;
            throw err;
        });

        return _enrichmentPromise;
    }

    function whenEnriched(catalogOpt, options) {
        const target = catalogOpt || _cachedCatalog;
        if (target && target.enriched) {
            return Promise.resolve(target);
        }
        if (target) {
            return loadEcologicalEnrichment(target, Object.assign({}, options, { immediate: true }));
        }
        return loadCatalog(Object.assign({}, options, { autoEnrich: false })).then(function (cat) {
            return loadEcologicalEnrichment(cat, Object.assign({}, options, { immediate: true }));
        });
    }

    async function loadCatalog(options) {
        const opts = options || {};
        if (_cachedCatalog && !opts.force) {
            if (opts.immediateEnrich) {
                loadEcologicalEnrichment(_cachedCatalog, {
                    immediate: true,
                    baseUrl: opts.baseUrl,
                    fetcher: opts.fetcher
                }).catch(function () {});
            }
            return _cachedCatalog;
        }
        if (_catalogPromise && !opts.force) return _catalogPromise;

        if (opts.force) {
            clearPendingEnrichmentTimer();
            _enrichmentPromise = null;
            _cachedCatalog = null;
        }

        const base = opts.baseUrl || "";
        const fetcher = opts.fetcher || fetchJsonSafe;
        _bootBaseUrl = base;
        _bootFetcher = fetcher;

        _catalogPromise = Promise.all([
            fetcher(base + "data/bed_simulator_crops.json"),
            fetcher(base + "data/calendar_base.json")
        ]).then(function (results) {
            const simJson = results[0] || {};
            const calRaw = results[1];
            const calRows = unpackDataset(calRaw);

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

            // Phase 1: Load calibrated simulator crops from bed_simulator_crops.json
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

            // Phase 1 alias & calendar pass
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

            const calMap = buildCalendarMap(calRows);
            crops.forEach(function (crop) {
                applyCalendarToCrop(crop, calMap);
            });

            const catalog = {
                version: simJson.version || "1.0.0",
                region: simJson.region || "South Coastal BC (Zone 8a)",
                rotationCyclesByFamily: rotationCyclesByFamily,
                crops: crops,
                cropMap: cropMap,
                aliasMap: aliasMap,
                starterPresets: Array.isArray(simJson.starterPresets) ? simJson.starterPresets : [],
                enriched: false,
                enriching: false,
                enrichedAt: null,
                bios: [],
                biosById: new Map(),
                biosByName: new Map(),
                biosByCategory: new Map(),
                nativesByName: new Map(),
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
                        const salish = normalizeKey((c.Hulquminum_Primary || "") + " " + (c.Halqemeylem_Primary || "") + " " + (c.SENCOTEN_Primary || ""));
                        const alt = normalizeKey(c.Common_Names_Alt || "");
                        if (cn.startsWith(q) || code === q) starts.push(c);
                        else if (cn.includes(q) || ln.includes(q) || fam.includes(q) || (salish && salish.includes(q)) || (alt && alt.includes(q))) {
                            contains.push(c);
                        }
                    }
                    return starts.concat(contains).slice(0, cap);
                }
            };

            Object.defineProperties(catalog, {
                _calMap: { value: calMap, enumerable: false },
                _usedCodes: { value: usedCodes, enumerable: false },
                _seenNames: { value: seenNames, enumerable: false },
                _seenLatins: { value: seenLatins, enumerable: false },
                _baseUrl: { value: base, enumerable: false },
                _fetcher: { value: fetcher, enumerable: false }
            });

            _cachedCatalog = catalog;

            if (opts.immediateEnrich === true) {
                loadEcologicalEnrichment(catalog, { immediate: true, baseUrl: base, fetcher: fetcher }).catch(function () {});
            } else if (opts.autoEnrich !== false && opts.deferEnrichment !== false) {
                scheduleBackgroundEnrichment(catalog, { baseUrl: base, fetcher: fetcher, delayMs: opts.enrichDelayMs });
            }

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
            planName: src.name || "",
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
        if (state.planId) clean.planId = String(state.planId);
        if (state.planName) clean.planName = String(state.planName);
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
        if (snap.planId !== undefined) target.planId = snap.planId;
        if (snap.planName !== undefined) target.planName = snap.planName;
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

    // -------------------------------------------------------------------------
    // Preferences Cookie (`wcpp_bedsim_prefs`) — compact scalars only
    // -------------------------------------------------------------------------
    const FORBIDDEN_PREF_KEYS = new Set(["seasons", "blocks", "plantings", "tunnels", "state", "plans", "undoStack", "redoStack"]);

    function sanitizePrefsObject(rawObj) {
        const out = {};
        if (!rawObj || typeof rawObj !== "object" || Array.isArray(rawObj)) return out;
        Object.keys(rawObj).forEach(function (k) {
            if (FORBIDDEN_PREF_KEYS.has(k)) return;
            const val = rawObj[k];
            if (val === undefined || val === null) return;
            const t = typeof val;
            if (t === "boolean" || (t === "number" && Number.isFinite(val))) {
                out[k] = val;
            } else if (t === "string") {
                out[k] = val.slice(0, 120);
            }
        });
        return out;
    }

    function readPrefsCookie() {
        try {
            if (typeof document !== "undefined" && typeof document.cookie === "string" && document.cookie) {
                const prefix = PREFS_COOKIE_NAME + "=";
                const parts = document.cookie.split(";");
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i].trim();
                    if (part.indexOf(prefix) === 0) {
                        const rawVal = part.slice(prefix.length);
                        const parsed = JSON.parse(decodeURIComponent(rawVal));
                        const clean = sanitizePrefsObject(parsed);
                        _memPrefsFallback = Object.assign({}, clean);
                        return clean;
                    }
                }
            }
        } catch (_) {}
        return sanitizePrefsObject(_memPrefsFallback);
    }

    function writePrefsCookie(obj) {
        const current = readPrefsCookie();
        const merged = Object.assign({}, current);
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            Object.keys(obj).forEach(function (k) {
                if (FORBIDDEN_PREF_KEYS.has(k)) return;
                const v = obj[k];
                if (v === null || v === undefined) {
                    delete merged[k];
                } else if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) {
                    merged[k] = v;
                } else if (typeof v === "string") {
                    merged[k] = v.slice(0, 120);
                }
            });
        }
        let encoded = encodeURIComponent(JSON.stringify(merged));
        if (encoded.length > 1600) {
            // Trim least-essential string values if ever oversized
            const compact = sanitizePrefsObject({
                activePlanId: merged.activePlanId,
                unitSystem: merged.unitSystem,
                subTab: merged.subTab,
                timelineZoom: merged.timelineZoom,
                showTempCurve: merged.showTempCurve,
                showRotations: merged.showRotations,
                swipeHintDismissed: merged.swipeHintDismissed
            });
            encoded = encodeURIComponent(JSON.stringify(compact));
            _memPrefsFallback = Object.assign({}, compact);
        } else {
            _memPrefsFallback = Object.assign({}, merged);
        }
        try {
            if (typeof document !== "undefined" && "cookie" in document) {
                document.cookie = PREFS_COOKIE_NAME + "=" + encoded + "; max-age=31536000; path=/; SameSite=Lax";
            }
        } catch (_) {}
        return Object.assign({}, _memPrefsFallback);
    }

    // -------------------------------------------------------------------------
    // Multi-Plan Library (`wcpp_bed_sim_plans_v2`) + V1 Automatic Migration
    // -------------------------------------------------------------------------
    function deriveDefaultPlanName(state, fallbackIdx) {
        if (state && typeof state.planName === "string" && state.planName.trim()) {
            return state.planName.trim();
        }
        const presetId = state && state.activePresetId;
        if (presetId && _cachedCatalog && Array.isArray(_cachedCatalog.starterPresets)) {
            const match = _cachedCatalog.starterPresets.find(function (p) { return p.id === presetId; });
            if (match && match.name) return match.name;
        }
        if (presetId === "heirloom-market-6bed") return "Surrey 6-Bed Intensive Block";
        if (presetId === "backyard-raised-4bed") return "Backyard 4-Bed Raised Kitchen Garden";
        if (presetId === "zone8a-four-season") return "South Coastal BC 4-Season Guild";
        return "Garden Plan " + (fallbackIdx || 1);
    }

    function buildPlanMeta(entry, activeId) {
        if (!entry || !entry.state) return null;
        const st = entry.state;
        const activeSeason = Number(st.activeSeason || 2026);
        const season = (st.seasons && (st.seasons[activeSeason] || st.seasons[String(activeSeason)])) || null;
        const blocks = (season && Array.isArray(season.blocks)) ? season.blocks : [];
        const plantings = (season && Array.isArray(season.plantings)) ? season.plantings : [];
        const bedCount = blocks.reduce(function (sum, b) { return sum + (Number(b.bedCount) || 0); }, 0);
        return {
            id: entry.id,
            name: entry.name || "Garden Plan",
            presetId: entry.presetId || st.activePresetId || "custom",
            activeSeason: activeSeason,
            blockCount: blocks.length,
            bedCount: bedCount,
            plantingCount: plantings.length,
            createdAt: entry.createdAt || entry.updatedAt || null,
            updatedAt: entry.updatedAt || entry.createdAt || null,
            isActive: entry.id === activeId
        };
    }

    function stripSerializableState(state) {
        const serializable = cloneState(state);
        if (!serializable) return null;
        delete serializable.undoStack;
        delete serializable.redoStack;
        return serializable;
    }

    function readRawPlansLibrary() {
        const empty = { version: 2, activePlanId: null, plans: {}, order: [] };
        try {
            if (!global.localStorage) return empty;
            const rawV2 = global.localStorage.getItem(PLANS_STORAGE_KEY);
            if (rawV2) {
                const parsed = JSON.parse(rawV2);
                if (parsed && typeof parsed === "object" && parsed.plans && typeof parsed.plans === "object") {
                    const order = Array.isArray(parsed.order)
                        ? parsed.order.filter(function (id) { return Boolean(parsed.plans[id]); })
                        : Object.keys(parsed.plans);
                    Object.keys(parsed.plans).forEach(function (id) {
                        if (order.indexOf(id) === -1) order.push(id);
                    });
                    const activeId = (parsed.activePlanId && parsed.plans[parsed.activePlanId])
                        ? parsed.activePlanId
                        : (order[0] || null);
                    return {
                        version: 2,
                        activePlanId: activeId,
                        plans: parsed.plans,
                        order: order
                    };
                }
            }
            // Auto-migrate legacy STORAGE_KEY ("wcpp_bed_sim_v1") into V2 library on first access
            const rawV1 = global.localStorage.getItem(STORAGE_KEY);
            if (rawV1) {
                const parsedV1 = JSON.parse(rawV1);
                if (parsedV1 && parsedV1.seasons && typeof parsedV1.seasons === "object" && Object.keys(parsedV1.seasons).length > 0) {
                    const now = Date.now();
                    const migId = "plan_migrated_v1";
                    const cleanState = stripSerializableState(parsedV1);
                    const name = deriveDefaultPlanName(cleanState, 1);
                    cleanState.planId = migId;
                    cleanState.planName = name;
                    const migrated = {
                        version: 2,
                        activePlanId: migId,
                        plans: {},
                        order: [migId]
                    };
                    migrated.plans[migId] = {
                        id: migId,
                        name: name,
                        presetId: cleanState.activePresetId || "custom",
                        createdAt: now,
                        updatedAt: now,
                        state: cleanState
                    };
                    writePlansLibrary(migrated);
                    const prefs = readPrefsCookie();
                    if (!prefs.activePlanId) {
                        writePrefsCookie({ activePlanId: migId });
                    }
                    return migrated;
                }
            }
        } catch (_) {}
        return empty;
    }

    function writePlansLibrary(lib) {
        try {
            if (global.localStorage) {
                global.localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(lib));
            }
            return true;
        } catch (_) {
            return false;
        }
    }

    function syncLegacyStorageFromState(serializableState) {
        try {
            if (!global.localStorage) return;
            if (serializableState) {
                global.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState));
            } else {
                global.localStorage.removeItem(STORAGE_KEY);
            }
        } catch (_) {}
    }

    function listSavedPlans() {
        const lib = readRawPlansLibrary();
        const out = [];
        lib.order.forEach(function (id) {
            const meta = buildPlanMeta(lib.plans[id], lib.activePlanId);
            if (meta) out.push(meta);
        });
        out.sort(function (a, b) {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        return out;
    }

    function getActivePlanMeta() {
        const lib = readRawPlansLibrary();
        const prefs = readPrefsCookie();
        const candidateId = (prefs.activePlanId && lib.plans[prefs.activePlanId])
            ? prefs.activePlanId
            : lib.activePlanId;
        if (!candidateId || !lib.plans[candidateId]) return null;
        return buildPlanMeta(lib.plans[candidateId], candidateId);
    }

    function saveNamedPlan(state, nameOpt, idOpt) {
        if (!state || !state.seasons) return null;
        const lib = readRawPlansLibrary();
        const now = Date.now();
        const explicitId = (typeof idOpt === "string" && idOpt.trim()) ? idOpt.trim() : null;
        const planId = explicitId || generateId("plan");
        const existing = lib.plans[planId] || null;
        const cleanName = (typeof nameOpt === "string" && nameOpt.trim())
            ? nameOpt.trim()
            : (existing ? existing.name : deriveDefaultPlanName(state, lib.order.length + 1));

        const serializable = stripSerializableState(state);
        serializable.planId = planId;
        serializable.planName = cleanName;
        state.planId = planId;
        state.planName = cleanName;
        _activePlanId = planId;

        lib.plans[planId] = {
            id: planId,
            name: cleanName,
            presetId: serializable.activePresetId || "custom",
            createdAt: existing ? existing.createdAt : now,
            updatedAt: now,
            state: serializable
        };
        if (lib.order.indexOf(planId) === -1) {
            lib.order.unshift(planId);
        }
        lib.activePlanId = planId;

        writePlansLibrary(lib);
        syncLegacyStorageFromState(serializable);
        writePrefsCookie({ activePlanId: planId });
        return buildPlanMeta(lib.plans[planId], planId);
    }

    function loadNamedPlan(planId, catalog) {
        if (!planId) return null;
        const lib = readRawPlansLibrary();
        const entry = lib.plans[planId];
        if (!entry || !entry.state) return null;

        lib.activePlanId = planId;
        _activePlanId = planId;
        writePlansLibrary(lib);
        writePrefsCookie({ activePlanId: planId });

        const restored = cloneState(entry.state);
        restored.planId = entry.id;
        restored.planName = entry.name;
        const cropMap = (catalog && catalog.cropMap) || (_cachedCatalog && _cachedCatalog.cropMap) || null;
        if (cropMap) {
            Object.keys(restored.seasons || {}).forEach(function (yr) {
                hydrateSeasonDates(restored.seasons[yr], cropMap, restored.climateAdjusted);
            });
        }
        syncLegacyStorageFromState(stripSerializableState(restored));
        return restored;
    }

    function renameSavedPlan(planId, newName) {
        const trimmed = typeof newName === "string" ? newName.trim() : "";
        if (!planId || !trimmed) return null;
        const lib = readRawPlansLibrary();
        const entry = lib.plans[planId];
        if (!entry) return null;

        entry.name = trimmed;
        entry.updatedAt = Date.now();
        if (entry.state) entry.state.planName = trimmed;
        writePlansLibrary(lib);
        if (lib.activePlanId === planId && entry.state) {
            syncLegacyStorageFromState(entry.state);
        }
        return buildPlanMeta(entry, lib.activePlanId);
    }

    function duplicateSavedPlan(planId, newName) {
        if (!planId) return null;
        const lib = readRawPlansLibrary();
        const src = lib.plans[planId];
        if (!src || !src.state) return null;

        const now = Date.now();
        const copyId = generateId("plan");
        const copyName = (typeof newName === "string" && newName.trim())
            ? newName.trim()
            : (src.name + " (Copy)");
        const copyState = stripSerializableState(src.state);
        copyState.planId = copyId;
        copyState.planName = copyName;

        lib.plans[copyId] = {
            id: copyId,
            name: copyName,
            presetId: src.presetId || copyState.activePresetId || "custom",
            createdAt: now,
            updatedAt: now,
            state: copyState
        };
        lib.order.unshift(copyId);
        if (!lib.activePlanId) lib.activePlanId = copyId;
        writePlansLibrary(lib);
        return buildPlanMeta(lib.plans[copyId], lib.activePlanId);
    }

    function deleteSavedPlan(planId) {
        if (!planId) return false;
        const lib = readRawPlansLibrary();
        if (!lib.plans[planId]) return false;

        delete lib.plans[planId];
        lib.order = lib.order.filter(function (id) { return id !== planId; });

        if (lib.activePlanId === planId) {
            lib.activePlanId = lib.order[0] || null;
            _activePlanId = lib.activePlanId;
            writePrefsCookie({ activePlanId: lib.activePlanId });
            const nextEntry = lib.activePlanId ? lib.plans[lib.activePlanId] : null;
            syncLegacyStorageFromState(nextEntry ? nextEntry.state : null);
        }
        writePlansLibrary(lib);
        return {
            deleted: true,
            activePlanId: lib.activePlanId,
            remainingCount: lib.order.length
        };
    }

    function saveState(state) {
        if (!state) return false;
        try {
            const lib = readRawPlansLibrary();
            const targetId = (state.planId && lib.plans[state.planId])
                ? state.planId
                : (lib.activePlanId && lib.plans[lib.activePlanId]
                    ? lib.activePlanId
                    : (state.planId || _activePlanId || generateId("plan")));
            const existing = lib.plans[targetId] || null;
            const planName = (state.planName && String(state.planName).trim())
                ? String(state.planName).trim()
                : (existing ? existing.name : deriveDefaultPlanName(state, lib.order.length + 1));

            const serializable = stripSerializableState(state);
            serializable.planId = targetId;
            serializable.planName = planName;
            state.planId = targetId;
            state.planName = planName;
            _activePlanId = targetId;

            const now = Date.now();
            lib.plans[targetId] = {
                id: targetId,
                name: planName,
                presetId: serializable.activePresetId || "custom",
                createdAt: existing ? existing.createdAt : now,
                updatedAt: now,
                state: serializable
            };
            if (lib.order.indexOf(targetId) === -1) {
                lib.order.unshift(targetId);
            }
            lib.activePlanId = targetId;

            writePlansLibrary(lib);
            syncLegacyStorageFromState(serializable);
            writePrefsCookie({ activePlanId: targetId });
            return true;
        } catch (_) {
            return false;
        }
    }

    function loadState(starterPresets, catalog) {
        try {
            const lib = readRawPlansLibrary();
            const prefs = readPrefsCookie();
            const targetId = (prefs.activePlanId && lib.plans[prefs.activePlanId])
                ? prefs.activePlanId
                : lib.activePlanId;
            if (targetId && lib.plans[targetId] && lib.plans[targetId].state) {
                const entry = lib.plans[targetId];
                const restored = cloneState(entry.state);
                if (restored && restored.seasons && typeof restored.seasons === "object" && Object.keys(restored.seasons).length > 0) {
                    restored.planId = entry.id;
                    restored.planName = entry.name;
                    _activePlanId = entry.id;
                    const cropMap = (catalog && catalog.cropMap) || (_cachedCatalog && _cachedCatalog.cropMap) || null;
                    if (cropMap) {
                        Object.keys(restored.seasons).forEach(function (yr) {
                            hydrateSeasonDates(restored.seasons[yr], cropMap, restored.climateAdjusted);
                        });
                    }
                    return restored;
                }
            }
        } catch (_) {}

        const presets = Array.isArray(starterPresets) && starterPresets.length
            ? starterPresets
            : (_cachedCatalog && _cachedCatalog.starterPresets && _cachedCatalog.starterPresets.length ? _cachedCatalog.starterPresets : [buildFallbackPreset()]);
        return createStateFromPreset(presets[0], catalog);
    }

    // -------------------------------------------------------------------------
    // Shareable URL Hash (`#plan=...`) — Unicode-safe Base64URL
    // -------------------------------------------------------------------------
    function utf8ToBase64Url(str) {
        let bin = "";
        if (typeof TextEncoder === "function") {
            const bytes = new TextEncoder().encode(str);
            for (let i = 0; i < bytes.length; i++) {
                bin += String.fromCharCode(bytes[i]);
            }
        } else {
            bin = unescape(encodeURIComponent(str));
        }
        return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    function base64UrlToUtf8(b64u) {
        let b64 = String(b64u || "").replace(/-/g, "+").replace(/_/g, "/");
        while (b64.length % 4 !== 0) b64 += "=";
        const bin = atob(b64);
        if (typeof TextDecoder === "function") {
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) {
                bytes[i] = bin.charCodeAt(i);
            }
            return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        }
        return decodeURIComponent(escape(bin));
    }

    function encodePlanToHash(state) {
        if (!state || !state.seasons) return "";
        try {
            const payload = stripSerializableState(state);
            delete payload.planId;
            if (!payload.planName) {
                payload.planName = deriveDefaultPlanName(state, 1);
            }
            // Strip derived planting dates so URL hash stays compact; decodePlanFromHash re-hydrates them
            Object.keys(payload.seasons || {}).forEach(function (yr) {
                const s = payload.seasons[yr];
                if (!s || !Array.isArray(s.plantings)) return;
                s.plantings.forEach(function (p) {
                    delete p.harvestStartDate;
                    delete p.harvestEndDate;
                    delete p.seedingDate;
                    delete p.transplantDate;
                    delete p.pottingUpDate;
                    delete p.effectiveDtm;
                    if (!p.lockHarvestDate) {
                        delete p.endDate;
                        delete p.targetHarvestDate;
                    }
                });
            });
            return "#plan=" + utf8ToBase64Url(JSON.stringify(payload));
        } catch (_) {
            return "";
        }
    }

    function decodePlanFromHash(hashStr, catalog) {
        if (!hashStr || typeof hashStr !== "string") return null;
        try {
            let token = hashStr.trim();
            if (!token) return null;
            const hashIdx = token.indexOf("#");
            if (hashIdx !== -1) token = token.slice(hashIdx + 1);
            const planMatch = token.match(/(?:^|[&?])plan=([^&]+)/i);
            if (planMatch) {
                token = planMatch[1];
            } else if (/=/.test(token)) {
                return null;
            }
            if (!token || token.length < 4) return null;

            let jsonStr = "";
            try {
                jsonStr = base64UrlToUtf8(token);
            } catch (_) {
                jsonStr = decodeURIComponent(token);
            }
            const parsed = JSON.parse(jsonStr);
            if (!parsed || typeof parsed !== "object" || !parsed.seasons || typeof parsed.seasons !== "object") {
                return null;
            }
            const yrKeys = Object.keys(parsed.seasons);
            if (yrKeys.length === 0) return null;

            const defaults = Object.assign(
                { bedWidthCm: 75, pathWidthCm: 30, bedLengthM: 30, benchAreaM2: 40 },
                parsed.farmDefaults || {}
            );
            const normalizedSeasons = {};
            yrKeys.forEach(function (yrKey) {
                const yr = Number(yrKey);
                if (!Number.isFinite(yr)) return;
                const s = parsed.seasons[yrKey] || {};
                normalizedSeasons[yr] = {
                    year: yr,
                    blocks: (Array.isArray(s.blocks) ? s.blocks : []).map(function (b, idx) { return normalizeBlock(b, defaults, idx); }),
                    tunnels: (Array.isArray(s.tunnels) ? s.tunnels : []).map(normalizeTunnel),
                    plantings: (Array.isArray(s.plantings) ? s.plantings : []).map(function (p, idx) { return normalizePlanting(p, idx, yr); }),
                    completedTaskIds: Array.isArray(s.completedTaskIds) ? s.completedTaskIds.slice() : []
                };
            });
            if (Object.keys(normalizedSeasons).length === 0) return null;

            const restored = {
                version: parsed.version || "1.0.0",
                activePresetId: parsed.activePresetId || "shared",
                planName: (typeof parsed.planName === "string" && parsed.planName.trim()) ? parsed.planName.trim() : "Shared Bed Plan",
                activeSeason: Number(parsed.activeSeason) || Number(Object.keys(normalizedSeasons)[0]) || 2026,
                units: parsed.units === "imperial" ? "imperial" : "metric",
                climateAdjusted: parsed.climateAdjusted !== false,
                farmDefaults: defaults,
                displayOptions: Object.assign({
                    highlightActive: false,
                    highlightInterplanted: false,
                    colorByFamily: false,
                    showFrostToday: true,
                    showTunnels: true
                }, parsed.displayOptions || {}),
                seasons: normalizedSeasons,
                undoStack: [],
                redoStack: []
            };
            const cropMap = (catalog && catalog.cropMap) || (_cachedCatalog && _cachedCatalog.cropMap) || null;
            if (cropMap) {
                Object.keys(restored.seasons).forEach(function (yr) {
                    hydrateSeasonDates(restored.seasons[yr], cropMap, restored.climateAdjusted);
                });
            }
            return restored;
        } catch (_) {
            return null;
        }
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
    // 8. CROSS-SITE ECOLOGY ENGINE & DATE-NUDGE HELPER (V2)
    // =========================================================================
    const BIOS_ROLE_KEYWORDS = [
        { re: /\baphidius\b/i, ids: ["aphidius-colemani", "aphidius-matricariae"] },
        { re: /\bladybird|\bladybug|\bcoccinell/i, ids: ["adalia-bipunctata", "hippodamia-convergens"] },
        { re: /\blacewing|\bchrysop/i, ids: ["chrysoperla-rufilabris", "micromus-variegatus"] },
        { re: /\bsyrphid|\bhoverfly/i, ids: ["eupeodes-americanus"] },
        { re: /\bpredatory\s*wasp|\btrichogramma|\bcotesia/i, ids: ["trichogramma-brassicae", "cotesia-glomerata", "aphidius-colemani"] },
        { re: /\baphid/i, ids: ["aphidoidea-overview", "myzus-persicae", "aphid-natural-enemies-overview"] },
        { re: /\bwhitefl/i, ids: ["trialeurodes-vaporariorum", "encarsia-formosa", "lecanicillium-muscari"] },
        { re: /\bspider\s*mite|\bspidermite/i, ids: ["tetranychus-urticae", "phytoseiulus-persimilis", "neoseiulus-californicus"] },
        { re: /\bthrip/i, ids: ["thysanoptera-overview", "frankliniella-occidentalis", "amblyseius-swirskii"] },
        { re: /\bcabbage\s*worm|\bcabbageworm|\blooper|\bhornworm|\bcaterpillar|\bcutworm|\bdiamondback|\barmyworm/i, ids: ["lepidoptera-caterpillars", "cotesia-glomerata", "trichogramma-brassicae", "trichogramma-pretiosum"] },
        { re: /\bleaf\s*miner|\bleafminer/i, ids: ["liriomyza-general", "liriomyza-huidobrensis"] },
        { re: /\bfungus\s*gnat/i, ids: ["bradysia-impatiens", "dalotia-coriaria"] },
        { re: /\bvine\s*weevil/i, ids: ["otiorhynchus-sulcatus"] },
        { re: /\bpsyllid/i, ids: ["bactericera-cockerelli", "tamarixia-triozae"] }
    ];

    function getBiosRole(entry) {
        const cat = String((entry && entry.category) || "");
        if (/Beneficial Insects & Mites/i.test(cat) && !/Greenhouse Pests/i.test(cat)) return "beneficial";
        if (/Greenhouse Pests/i.test(cat)) return "pest";
        if (/Biocontrol|Entomopathogenic|Pseudomonads|Bacillus|Streptomyces|Plant Growth/i.test(cat)) return "biocontrol";
        if (/Insecticides|Miticides/i.test(cat)) return "chemical";
        return "biocontrol";
    }

    function splitSemicolonOrCommaClean(rawStr) {
        if (!isMeaningful(rawStr)) return [];
        const seen = new Set();
        const out = [];
        splitTopLevelItems(String(rawStr).replace(/;\s*,/g, ";")).forEach(function (part) {
            const clean = part.replace(/^[\s.;,]+|[\s.;,]+$/g, "").trim();
            if (!isMeaningful(clean)) return;
            const k = normalizeKey(clean);
            if (!k || seen.has(k)) return;
            seen.add(k);
            out.push(clean);
        });
        return out;
    }

    function parsePestAttractedList(rawStr) {
        if (!isMeaningful(rawStr)) return [];
        const seen = new Set();
        const out = [];
        String(rawStr).split(/[;,]+/).forEach(function (chunk) {
            let clean = chunk.trim();
            if (!isMeaningful(clean)) return;
            // Trim ": on leaves..." host-part annotations from garden_crops
            clean = clean.replace(/:\s*(?:on|in|under|at)\b.*$/i, "").trim();
            clean = clean.replace(/^[\s.;,]+|[\s.;,]+$/g, "");
            if (!clean || clean.length < 2) return;
            const k = normalizeKey(clean);
            if (seen.has(k)) return;
            seen.add(k);
            out.push(clean);
        });
        return out;
    }

    function parseBloomMonthsFromText(rawStr) {
        if (!isMeaningful(rawStr)) return [];
        const found = new Set();
        const str = String(rawStr);
        // Handle explicit month ranges like "May-Aug" or "Apr–Jun"
        const rangeRe = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[-–—to]+\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi;
        let m;
        while ((m = rangeRe.exec(str)) !== null) {
            const startM = MONTH_MAP[m[1].toLowerCase()];
            const endM = MONTH_MAP[m[2].toLowerCase()];
            if (startM && endM) {
                if (startM <= endM) {
                    for (let mo = startM; mo <= endM; mo++) found.add(mo);
                } else {
                    for (let mo = startM; mo <= 12; mo++) found.add(mo);
                    for (let mo = 1; mo <= endM; mo++) found.add(mo);
                }
            }
        }
        // Individual month tokens
        const tokRe = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi;
        while ((m = tokRe.exec(str)) !== null) {
            const mo = MONTH_MAP[m[1].toLowerCase()];
            if (mo) found.add(mo);
        }
        return Array.from(found).sort(function (a, b) { return a - b; });
    }

    function parseSeasonOfInterestToMonths(rawStr) {
        if (!isMeaningful(rawStr)) return [];
        const s = String(rawStr).toLowerCase();
        const out = new Set();
        if (s.includes("spring")) {
            const hasSub = /spring\s*\(([^)]+)\)/.exec(s);
            if (hasSub) {
                if (hasSub[1].includes("early")) out.add(3);
                if (hasSub[1].includes("mid")) out.add(4);
                if (hasSub[1].includes("late")) out.add(5);
            } else {
                out.add(4); out.add(5);
            }
        }
        if (s.includes("summer")) {
            const hasSub = /summer\s*\(([^)]+)\)/.exec(s);
            if (hasSub) {
                if (hasSub[1].includes("early")) out.add(6);
                if (hasSub[1].includes("mid")) out.add(7);
                if (hasSub[1].includes("late")) out.add(8);
            } else {
                out.add(6); out.add(7); out.add(8);
            }
        }
        if (s.includes("fall") || s.includes("autumn")) {
            out.add(9); out.add(10);
        }
        return Array.from(out).sort(function (a, b) { return a - b; });
    }

    function getCropBloomMonths(crop) {
        if (!crop) return [];
        let months = parseBloomMonthsFromText(crop.Bloom_Months || crop["Flower Bloom Time"] || crop.bloomMonths);
        if (months.length > 0) return months;

        const isFloweringClass = crop.category === "Flower" || crop.category === "Herb" ||
            crop.category === "Berry" || crop.category === "Fruit" ||
            crop.category === "BC Native" || Boolean(crop.isNativeBC);
        if (isFloweringClass && isMeaningful(crop["Season of Interest"])) {
            months = parseSeasonOfInterestToMonths(crop["Season of Interest"]);
            if (months.length > 0) return months;
        }

        const key = normalizeKey(crop.name);
        if (PNW_COMPANION_BLOOM_MONTHS[key]) return PNW_COMPANION_BLOOM_MONTHS[key].slice();
        const aliasTarget = PLANT_SYNONYM_ALIASES[key];
        if (aliasTarget && PNW_COMPANION_BLOOM_MONTHS[aliasTarget]) {
            return PNW_COMPANION_BLOOM_MONTHS[aliasTarget].slice();
        }
        return [];
    }

    function parseDimensionStringToCm(rawStr) {
        if (!isMeaningful(rawStr)) return { min: null, max: null };
        const str = String(rawStr);
        // Prefer parenthetical metric units if present e.g. "6' - 15' (1.8 to 4.5 meters)" or "(30cm - 60cm)"
        const paren = str.match(/\(([^)]+)\)/);
        const target = paren ? paren[1] : str;
        const isMeters = /\bmeters?\b|\bm\b/i.test(target) && !/\bcm\b/i.test(target);
        const isCm = /\bcm\b/i.test(target);
        const isFeet = /'|\bfeet\b|\bft\b/i.test(target);
        const isInches = /"|\binch(?:es)?\b|\bin\b/i.test(target);

        const nums = [];
        const re = /(\d+(?:\.\d+)?)/g;
        let m;
        while ((m = re.exec(target)) !== null) {
            let v = parseFloat(m[1]);
            if (isMeters) v *= 100;
            else if (!isCm && isFeet && !isInches) v *= 30.48;
            else if (!isCm && isInches) v *= 2.54;
            nums.push(Math.round(v));
        }
        if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
        if (nums.length === 1) return { min: nums[0], max: nums[0] };
        return { min: null, max: null };
    }

    function estimateCropDimensionsCm(crop) {
        const hMinRaw = parseFirstNumber(crop && crop.Height_Min_cm);
        const hMaxRaw = parseFirstNumber(crop && crop.Height_Max_cm);
        const sMinRaw = parseFirstNumber(crop && crop.Spread_Min_cm);
        const sMaxRaw = parseFirstNumber(crop && crop.Spread_Max_cm);

        let hMin = hMinRaw;
        let hMax = hMaxRaw;
        if (hMin === null && hMax === null && crop && crop.Height) {
            const parsedH = parseDimensionStringToCm(crop.Height);
            hMin = parsedH.min;
            hMax = parsedH.max;
        }

        let sMin = sMinRaw;
        let sMax = sMaxRaw;
        if (sMin === null && sMax === null && crop && crop.Spread) {
            const parsedS = parseDimensionStringToCm(crop.Spread);
            sMin = parsedS.min;
            sMax = parsedS.max;
        }

        if (hMin === null && hMax === null) {
            const n = normalizeKey(crop && crop.name);
            const cat = (crop && crop.category) || "";
            if (/corn|sunflower|pole|artichoke/.test(n)) { hMin = 150; hMax = 220; }
            else if (/tomato|tomatillo|dill|fennel|okra/.test(n)) { hMin = 90; hMax = 160; }
            else if (/alyssum|thyme|strawberry|white clover|sorrel|radish/.test(n)) { hMin = 10; hMax = 25; }
            else if (/lettuce|spinach|arugula|carrot|beet|turnip|onion|garlic|chive|marigold|parsley|cilantro/.test(n)) { hMin = 22; hMax = 42; }
            else if (cat === "Brassica" || cat === "Fruiting" || cat === "Legume") { hMin = 45; hMax = 85; }
            else if (cat === "Cover Crop") { hMin = 30; hMax = 65; }
            else { hMin = 30; hMax = 60; }
        }
        if (hMin !== null && hMax === null) hMax = hMin;
        if (hMax !== null && hMin === null) hMin = hMax;

        if (sMin === null && sMax === null) {
            const spreadEst = Math.max(15, Math.round(Number((crop && crop.inRowCm) || 30)));
            sMin = spreadEst;
            sMax = Math.round(spreadEst * 1.3);
        }
        if (sMin !== null && sMax === null) sMax = sMin;
        if (sMax !== null && sMin === null) sMin = sMax;

        return {
            heightMinCm: hMin,
            heightMaxCm: hMax,
            heightMidCm: Math.round((hMin + hMax) / 2),
            heightDisplay: (crop && crop.Height_Display) || (hMin === hMax ? (hMin + " cm") : (hMin + "–" + hMax + " cm")),
            spreadMinCm: sMin,
            spreadMaxCm: sMax,
            spreadMidCm: Math.round((sMin + sMax) / 2)
        };
    }

    function classifyCanopyStratum(crop, heightMidCm) {
        const raw = String((crop && crop.Canopy_Layer) || "").trim();
        const low = raw.toLowerCase();
        if (low.includes("canopy tree") || low.includes("understory tree") || low.includes("vine") || low.includes("climber")) {
            return { canopyLayer: raw, canopyStratum: "tall" };
        }
        if (low.includes("tall shrub")) {
            return { canopyLayer: raw, canopyStratum: heightMidCm >= 140 ? "tall" : "mid" };
        }
        if (low.includes("groundcover")) {
            return { canopyLayer: raw, canopyStratum: "groundcover" };
        }
        if (low.includes("low shrub") || low.includes("fern") || low.includes("graminoid") || low.includes("herbaceous")) {
            return { canopyLayer: raw, canopyStratum: heightMidCm < 25 ? "groundcover" : (heightMidCm >= 140 ? "tall" : (heightMidCm >= 50 ? "mid" : "low")) };
        }
        if (heightMidCm >= 140) return { canopyLayer: raw || "Tall Canopy / Trellis", canopyStratum: "tall" };
        if (heightMidCm >= 50) return { canopyLayer: raw || "Mid Herbaceous / Shrub", canopyStratum: "mid" };
        if (heightMidCm >= 22) return { canopyLayer: raw || "Low Herb / Leafy", canopyStratum: "low" };
        return { canopyLayer: raw || "Groundcover / Living Mulch", canopyStratum: "groundcover" };
    }

    function parseRootProfile(crop) {
        let rawRoot = String((crop && (crop["Root Formation"] || crop.Root_Formation)) || "").trim();
        // Guard against shifted disease strings in garden_crops (e.g. Lettuce cell containing Botrytis/Mosaic)
        if (/botrytis|mildew|mosaic|blight|wilt|virus|rot|rust/i.test(rawRoot) &&
            !/taproot|fibrous|rhizom|bulb|corm|tuber|stolon|woody|root/i.test(rawRoot)) {
            rawRoot = "";
        }
        const n = normalizeKey(crop && crop.name);
        const fam = (crop && crop.family) || "";
        const low = rawRoot.toLowerCase();

        if (low.includes("deep taproot") || low.includes("woody")) {
            return { rootFormation: rawRoot, rootStratum: "deep", estimatedRootCm: 75 };
        }
        if (low.includes("taproot")) {
            return { rootFormation: rawRoot, rootStratum: "deep", estimatedRootCm: 60 };
        }
        if (low.includes("bulb") || low.includes("corm") || low.includes("tuber")) {
            return { rootFormation: rawRoot, rootStratum: "shallow", estimatedRootCm: 22 };
        }
        if (low.includes("rhizom")) {
            return { rootFormation: rawRoot, rootStratum: "medium", estimatedRootCm: 32 };
        }
        if (low.includes("stolon") || low.includes("fibrous")) {
            return { rootFormation: rawRoot, rootStratum: "shallow", estimatedRootCm: 18 };
        }

        if (/carrot|parsnip|daikon|rutabaga|radish|beet|alfalfa|borage|sunflower|tomato|squash|pumpkin|melon|cucumber|watermelon/.test(n)) {
            return {
                rootFormation: rawRoot || (/carrot|parsnip|daikon|alfalfa|beet/.test(n) ? "Deep Taproot" : "Taproot & Lateral"),
                rootStratum: "deep",
                estimatedRootCm: /parsnip|daikon|alfalfa|tomato/.test(n) ? 70 : 50
            };
        }
        if (/onion|garlic|shallot|leek|potato|sweet potato/.test(n) || fam === "Amaryllidaceae" || fam === "Alliaceae") {
            return { rootFormation: rawRoot || "Bulb / Shallow Fibrous", rootStratum: "shallow", estimatedRootCm: 20 };
        }
        if (/lettuce|spinach|arugula|mizuna|strawberry|alyssum|chive|cilantro|thyme|white clover|crimson clover/.test(n)) {
            return { rootFormation: rawRoot || "Shallow Fibrous", rootStratum: "shallow", estimatedRootCm: 18 };
        }
        return { rootFormation: rawRoot || "Branching / Medium Root", rootStratum: "medium", estimatedRootCm: 35 };
    }

    function classifyMycorrhizae(crop) {
        const raw = String((crop && crop.Mycorrhizal_Association) || "").trim();
        const fam = (crop && crop.family) || "";
        const low = raw.toLowerCase();
        if (low.includes("non-mycorrhizal") || fam === "Brassicaceae" || fam === "Amaranthaceae" || fam === "Polygonaceae") {
            return {
                mycorrhizae: raw || ("Non-mycorrhizal (" + (fam || "Brassica/Beet guild") + ")"),
                mycorrhizaeType: "Non-mycorrhizal"
            };
        }
        if (low.includes("ericoid") || low.includes("arbutoid")) {
            return { mycorrhizae: raw, mycorrhizaeType: "Ericoid" };
        }
        if (low.includes("ectomycorr")) {
            return { mycorrhizae: raw, mycorrhizaeType: "EM" };
        }
        if (low.includes("arbuscular") || fam === "Fabaceae" || fam === "Solanaceae" || fam === "Apiaceae" ||
            fam === "Asteraceae" || fam === "Cucurbitaceae" || fam === "Lamiaceae" || fam === "Poaceae" ||
            fam === "Amaryllidaceae" || fam === "Alliaceae" || fam === "Rosaceae") {
            return {
                mycorrhizae: raw || "Arbuscular Mycorrhizal (AM)",
                mycorrhizaeType: "AM"
            };
        }
        return { mycorrhizae: raw || "", mycorrhizaeType: "Unknown" };
    }

    function matchCropToBios(crop, parsedLists, catalog) {
        if (!crop || !catalog || !Array.isArray(catalog.bios) || catalog.bios.length === 0) {
            return [];
        }
        const matchedMap = new Map(); // id -> { entry, score, via }

        function addHit(entry, score, via) {
            if (!entry || !entry.id) return;
            const role = getBiosRole(entry);
            // Prioritize biological/ecological entries over synthetic chemical pesticides
            const roleBonus = role === "beneficial" ? 25 : (role === "pest" ? 20 : (role === "biocontrol" ? 15 : -20));
            const total = score + roleBonus;
            const prev = matchedMap.get(entry.id);
            if (!prev || total > prev.score) {
                matchedMap.set(entry.id, { entry: entry, score: total, via: via, role: role });
            }
        }

        const cNameKey = normalizeKey(crop.name);
        const baseNameKey = normalizeKey(crop.name.split("(")[0]);
        const cLatinKey = normalizeKey(crop.latin);
        const famKey = normalizeKey(crop.family);
        const cropSearchTokens = [cNameKey, baseNameKey].filter(function (k) { return k && k.length >= 3; });
        if (famKey === "brassicaceae") cropSearchTokens.push("brassica");
        if (famKey === "solanaceae") cropSearchTokens.push("solanaceous");
        if (famKey === "cucurbitaceae") cropSearchTokens.push("cucurbit");
        if (famKey === "fabaceae") cropSearchTokens.push("legume");

        // 1. Match crop name/family against bios.crops tokens
        catalog.bios.forEach(function (entry) {
            if (!isMeaningful(entry.crops)) return;
            const cropList = String(entry.crops).split(/[;,]+/).map(normalizeKey).filter(Boolean);
            for (let i = 0; i < cropSearchTokens.length; i++) {
                const tok = cropSearchTokens[i];
                const exactHit = cropList.some(function (cl) {
                    return cl === tok || cl === tok + "s" || (tok.length >= 4 && cl.includes(tok));
                });
                if (exactHit) {
                    addHit(entry, i < 2 ? 40 : 24, "Host crop: " + crop.name);
                    break;
                }
            }
            if (cLatinKey && isMeaningful(entry.hostPlantsBeeSheet)) {
                const hLow = normalizeKey(entry.hostPlantsBeeSheet);
                if (hLow.includes(cLatinKey) || (cLatinKey.split(" ")[0].length >= 5 && hLow.includes(cLatinKey.split(" ")[0]))) {
                    addHit(entry, 35, "Host plant sheet");
                }
            }
        });

        // 2. Match predators, pests, deterred & repelled organisms against biosByName & keyword table
        const checkTexts = []
            .concat((parsedLists.naturalPredators || []).map(function (t) { return { text: t, via: "Predator attracted: " + t, boost: 45 }; }))
            .concat((parsedLists.pestsAttracted || []).map(function (t) { return { text: t, via: "Pest risk: " + t, boost: 34 }; }))
            .concat((parsedLists.pestsDeterred || []).map(function (t) { return { text: t, via: "Pest deterred: " + t, boost: 32 }; }))
            .concat((parsedLists.pestsRepelled || []).map(function (t) { return { text: t, via: "Pest repelled: " + t, boost: 32 }; }));

        checkTexts.forEach(function (item) {
            const clean = extractPlantNameToken(item.text);
            const k = normalizeKey(clean);
            const kFull = normalizeKey(item.text);
            if (catalog.biosByName instanceof Map) {
                const direct = catalog.biosByName.get(k) || catalog.biosByName.get(kFull);
                if (direct) addHit(direct, item.boost, item.via);
            }
            for (let ri = 0; ri < BIOS_ROLE_KEYWORDS.length; ri++) {
                const rule = BIOS_ROLE_KEYWORDS[ri];
                if (rule.re.test(item.text)) {
                    for (let ii = 0; ii < rule.ids.length; ii++) {
                        const hit = catalog.biosById instanceof Map ? catalog.biosById.get(rule.ids[ii]) : null;
                        if (hit) addHit(hit, item.boost - ii * 2, item.via);
                    }
                }
            }
        });

        return Array.from(matchedMap.values())
            .sort(function (a, b) { return b.score - a.score; })
            .slice(0, 16)
            .map(function (item) {
                return {
                    id: item.entry.id,
                    name: item.entry.metabolite || item.entry.scientificName || item.entry.id,
                    scientificName: item.entry.scientificName || "",
                    category: item.entry.category || "",
                    role: item.role,
                    targets: item.entry.targets || "",
                    crops: item.entry.crops || "",
                    matchedVia: item.via
                };
            });
    }

    function getCropEcologyProfile(cropOrName, catalogOpt) {
        const cat = catalogOpt || _cachedCatalog;
        const crop = typeof cropOrName === "string"
            ? (cat && cat.cropMap ? resolveCrop(cat.cropMap, cropOrName) : null)
            : cropOrName;
        if (!crop) return null;

        const bloomMonths = getCropBloomMonths(crop);
        const dims = estimateCropDimensionsCm(crop);
        const canopy = classifyCanopyStratum(crop, dims.heightMidCm);
        const root = parseRootProfile(crop);
        const myco = classifyMycorrhizae(crop);

        const naturalPredators = splitSemicolonOrCommaClean(crop["Natural Predators Attracted"]);
        const pestsDeterred = splitSemicolonOrCommaClean(crop["Pest Deterred"]);
        const pestsRepelled = splitSemicolonOrCommaClean(crop["Pest Repelled"]);
        const pestsAttracted = parsePestAttractedList(crop["Pest Attracted / Trapped"]);
        const biopesticides = splitSemicolonOrCommaClean(crop["Biopesticide Produced Chemical"]);
        const diseases = splitSemicolonOrCommaClean(crop["Disease Suceptibility"]);
        const pollinators = splitSemicolonOrCommaClean(
            [crop.Pollinators, crop["Pollinators Attracted"]].filter(isMeaningful).join("; ")
        );
        const beeVisitors = splitSemicolonOrCommaClean(crop.Common_Bee_Visitors);
        const butterflies = splitSemicolonOrCommaClean(crop.Host_Butterflies_Common);
        const moths = splitSemicolonOrCommaClean(crop.Host_Moths_Common);
        const lightTags = splitSemicolonOrCommaClean(crop.Light_Tags || crop.light);
        const moistureTags = splitSemicolonOrCommaClean(crop.Moisture_Tags || crop.waterNeeds);

        const matchedBioEntries = matchCropToBios(crop, {
            naturalPredators: naturalPredators,
            pestsAttracted: pestsAttracted,
            pestsDeterred: pestsDeterred,
            pestsRepelled: pestsRepelled
        }, cat);

        const hulq = isMeaningful(crop.Hulquminum_Primary) ? String(crop.Hulquminum_Primary).trim() : "";
        const halq = isMeaningful(crop.Halqemeylem_Primary) ? String(crop.Halqemeylem_Primary).trim() : "";
        const senc = isMeaningful(crop.SENCOTEN_Primary) ? String(crop.SENCOTEN_Primary).trim() : "";

        return {
            name: crop.name,
            latin: crop.latin || "",
            family: crop.family || "Other",
            category: crop.category || "Vegetable",
            isNativeBC: Boolean(crop.isNativeBC),
            urlSlug: crop.URL_Slug || "",
            coastSalish: {
                hulquminum: hulq,
                halqemeylem: halq,
                sencoten: senc,
                hasAny: Boolean(hulq || halq || senc)
            },
            canopyLayer: canopy.canopyLayer,
            canopyStratum: canopy.canopyStratum,
            spreadBehavior: crop.Spread_Behavior || "",
            heightCm: {
                min: dims.heightMinCm,
                max: dims.heightMaxCm,
                mid: dims.heightMidCm,
                display: dims.heightDisplay
            },
            spreadCm: {
                min: dims.spreadMinCm,
                max: dims.spreadMaxCm,
                mid: dims.spreadMidCm
            },
            rootFormation: root.rootFormation,
            rootStratum: root.rootStratum,
            estimatedRootCm: root.estimatedRootCm,
            mycorrhizae: myco.mycorrhizae,
            mycorrhizaeType: myco.mycorrhizaeType,
            lightTags: lightTags,
            moistureTags: moistureTags,
            droughtTolerance: crop.Drought_Tolerance || crop["Drought Tolerance"] || "",
            phRange: crop.phRange || crop["pH"] || "",
            nutrientFeedingType: crop["Nutrient Feeding Type"] || crop.nutrientDemand || "",
            bloomMonths: bloomMonths,
            bloomLabels: bloomMonths.map(function (m) { return MONTH_ABBR[m - 1]; }),
            pollinators: pollinators,
            beeVisitors: beeVisitors,
            lepidoptera: {
                hostGenera: crop.Lepidoptera_Host_Genera || "",
                totalHostCount: Number(crop.Total_Lepidoptera_Host_Count) || 0,
                butterflies: butterflies,
                moths: moths
            },
            naturalPredators: naturalPredators,
            pestsDeterred: pestsDeterred,
            pestsRepelled: pestsRepelled,
            pestsAttracted: pestsAttracted,
            biopesticides: biopesticides,
            diseases: diseases,
            companions: Array.isArray(crop.companions) ? crop.companions.slice() : [],
            antagonists: Array.isArray(crop.antagonists) ? crop.antagonists.slice() : [],
            matchedBioEntries: matchedBioEntries
        };
    }

    function getActiveMonthsFromIsoRange(startIso, endIso) {
        const s = parseIsoDateUtc(startIso);
        const e = parseIsoDateUtc(endIso);
        if (!s || !e) return [];
        const months = new Set();
        const cur = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1));
        const endMark = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), 1));
        let guard = 0;
        while (cur.getTime() <= endMark.getTime() && guard < 18) {
            months.add(cur.getUTCMonth() + 1);
            cur.setUTCMonth(cur.getUTCMonth() + 1);
            guard++;
        }
        return Array.from(months);
    }

    function analyzeBedEcology(state, catalogOpt, blockIdOpt) {
        const cat = catalogOpt || _cachedCatalog;
        const season = getActiveSeason(state) || { year: (state && state.activeSeason) || 2026, blocks: [], tunnels: [], plantings: [] };
        const blocks = season.blocks || [];
        const blocksById = new Map(blocks.map(function (b) { return [b.id, b]; }));
        const targetBlock = blockIdOpt ? (blocksById.get(blockIdOpt) || null) : null;

        const scopedPlantings = (season.plantings || []).filter(function (p) {
            if (!p) return false;
            if (blockIdOpt) return p.blockId === blockIdOpt;
            return true;
        });

        // 1. 12-Month Bloom Continuity (Mar-Oct active pollinator season in Zone 8a)
        const monthBuckets = [];
        for (let m = 1; m <= 12; m++) {
            monthBuckets.push({
                month: m,
                label: MONTH_ABBR[m - 1],
                count: 0,
                crops: [],
                activePollinatorSeason: m >= 3 && m <= 10,
                isGap: false
            });
        }

        const pestAgg = new Map();
        const predatorAgg = new Map();
        const biocontrolList = [];
        const diseaseAgg = new Map();
        const matchedBiosMap = new Map();
        const uniqueCropProfiles = new Map();
        const familySet = new Set();
        const nitrogenFixers = [];
        const trapCrops = [];
        const deterrentPlants = [];
        const coastSalishPlants = [];
        const lepidopteraHosts = [];
        const mycorrhizalBreakdown = { AM: 0, EM: 0, Ericoid: 0, nonMycorrhizal: 0, unknown: 0 };
        const rootFormationBreakdown = { shallow: 0, medium: 0, deep: 0 };
        const nutrientBalance = { soilBuilders: 0, none: 0, light: 0, medium: 0, heavy: 0 };

        let nativeCount = 0;
        let coastSalishCount = 0;
        let pollinatorSupportingCount = 0;
        let totalLepCount = 0;
        const presentCropKeys = new Set();
        const activeCropsList = [];

        scopedPlantings.forEach(function (p) {
            const crop = (cat && cat.cropMap) ? resolveCrop(cat.cropMap, p.cropName) : null;
            const block = p.blockId ? blocksById.get(p.blockId) : null;
            const dates = computePlantingDates(p, crop, block, season.tunnels || [], state ? state.climateAdjusted !== false : true);
            const prof = crop ? getCropEcologyProfile(crop, cat) : null;

            const canonicalName = crop ? crop.name : p.cropName;
            presentCropKeys.add(normalizeKey(canonicalName));
            if (crop) activeCropsList.push(crop);

            const fam = (crop && crop.family) || "Other";
            if (fam && fam !== "Other") familySet.add(fam);

            // Nutrient balance
            const nut = (crop && crop.nutrientDemand) || "Medium";
            if (nut === "Soil Builder") nutrientBalance.soilBuilders += 1;
            else if (nut === "None") nutrientBalance.none += 1;
            else if (nut === "Light") nutrientBalance.light += 1;
            else if (nut === "Heavy") nutrientBalance.heavy += 1;
            else nutrientBalance.medium += 1;

            if (fam === "Fabaceae" || nut === "Soil Builder") {
                nitrogenFixers.push({
                    plantingId: p.id,
                    cropName: canonicalName,
                    family: fam,
                    blockId: p.blockId,
                    bedStart: p.bedStart
                });
            }

            if (!prof) return;

            // Bloom months (for annuals intersect with active field months so schedule drives gaps)
            const isPerennial = Boolean(crop.isNativeBC) || /perennial|biennial|shrub|tree/i.test(String(crop.lifecycle || ""));
            let activeBloomMonths = prof.bloomMonths.slice();
            if (!isPerennial && activeBloomMonths.length > 0) {
                const inFieldMonths = getActiveMonthsFromIsoRange(dates.startDate, dates.endDate);
                if (inFieldMonths.length > 0) {
                    const intersected = activeBloomMonths.filter(function (m) { return inFieldMonths.indexOf(m) !== -1; });
                    activeBloomMonths = intersected;
                }
            }
            activeBloomMonths.forEach(function (m) {
                const b = monthBuckets[m - 1];
                if (b && b.crops.indexOf(canonicalName) === -1) {
                    b.crops.push(canonicalName);
                    b.count = b.crops.length;
                }
            });

            // Mycorrhizal & Root breakdowns
            if (prof.mycorrhizaeType === "AM") mycorrhizalBreakdown.AM += 1;
            else if (prof.mycorrhizaeType === "EM") mycorrhizalBreakdown.EM += 1;
            else if (prof.mycorrhizaeType === "Ericoid") mycorrhizalBreakdown.Ericoid += 1;
            else if (prof.mycorrhizaeType === "Non-mycorrhizal") mycorrhizalBreakdown.nonMycorrhizal += 1;
            else mycorrhizalBreakdown.unknown += 1;

            rootFormationBreakdown[prof.rootStratum] = (rootFormationBreakdown[prof.rootStratum] || 0) + 1;

            // Aggregate per unique species
            if (!uniqueCropProfiles.has(canonicalName)) {
                uniqueCropProfiles.set(canonicalName, prof);
                if (prof.isNativeBC) nativeCount += 1;
                if (prof.coastSalish.hasAny) {
                    coastSalishCount += 1;
                    coastSalishPlants.push({
                        cropName: canonicalName,
                        latin: prof.latin,
                        hulquminum: prof.coastSalish.hulquminum,
                        halqemeylem: prof.coastSalish.halqemeylem,
                        sencoten: prof.coastSalish.sencoten,
                        urlSlug: prof.urlSlug
                    });
                }
                if (prof.pollinators.length > 0 || prof.beeVisitors.length > 0 || prof.bloomMonths.length > 0) {
                    pollinatorSupportingCount += 1;
                }
                if (prof.lepidoptera.totalHostCount > 0 || prof.lepidoptera.butterflies.length > 0 || prof.lepidoptera.moths.length > 0) {
                    totalLepCount += prof.lepidoptera.totalHostCount || (prof.lepidoptera.butterflies.length + prof.lepidoptera.moths.length);
                    lepidopteraHosts.push({
                        cropName: canonicalName,
                        latin: prof.latin,
                        hostGenera: prof.lepidoptera.hostGenera,
                        totalHostCount: prof.lepidoptera.totalHostCount,
                        butterflies: prof.lepidoptera.butterflies,
                        moths: prof.lepidoptera.moths
                    });
                }

                // Bios matches
                const bioByPestOrPred = function (list, targetMap, roleFilter) {
                    list.forEach(function (label) {
                        const k = normalizeKey(label);
                        if (!targetMap.has(k)) {
                            targetMap.set(k, { name: label, count: 0, crops: [], bioEntries: [] });
                        }
                        const rec = targetMap.get(k);
                        rec.count += 1;
                        if (rec.crops.indexOf(canonicalName) === -1) rec.crops.push(canonicalName);
                        prof.matchedBioEntries.forEach(function (be) {
                            if (roleFilter && be.role !== roleFilter) return;
                            if (be.matchedVia && normalizeKey(be.matchedVia).includes(k) &&
                                !rec.bioEntries.some(function (x) { return x.id === be.id; })) {
                                rec.bioEntries.push({ id: be.id, name: be.name, category: be.category, role: be.role });
                            }
                        });
                    });
                };

                bioByPestOrPred(prof.pestsAttracted, pestAgg, "pest");
                bioByPestOrPred(prof.naturalPredators, predatorAgg, "beneficial");

                prof.diseases.forEach(function (dis) {
                    const dk = normalizeKey(dis);
                    if (!diseaseAgg.has(dk)) diseaseAgg.set(dk, { name: dis, crops: [] });
                    const dRec = diseaseAgg.get(dk);
                    if (dRec.crops.indexOf(canonicalName) === -1) dRec.crops.push(canonicalName);
                });

                if (prof.pestsDeterred.length > 0 || prof.pestsRepelled.length > 0 || prof.biopesticides.length > 0) {
                    deterrentPlants.push({
                        plantingId: p.id,
                        cropName: canonicalName,
                        pestsDeterred: prof.pestsDeterred,
                        pestsRepelled: prof.pestsRepelled,
                        biopesticides: prof.biopesticides
                    });
                    if (prof.pestsRepelled.length > 0 || prof.pestsDeterred.length > 0) {
                        biocontrolList.push({
                            name: canonicalName + " (Repellent / Deterrent)",
                            sourceCrop: canonicalName,
                            action: "repel",
                            targets: prof.pestsRepelled.concat(prof.pestsDeterred),
                            bioEntries: prof.matchedBioEntries.filter(function (be) { return be.role !== "chemical"; }).slice(0, 4)
                        });
                    }
                    if (prof.biopesticides.length > 0) {
                        biocontrolList.push({
                            name: prof.biopesticides.slice(0, 2).join("; "),
                            sourceCrop: canonicalName,
                            action: "biopesticide",
                            targets: prof.pestsRepelled.concat(prof.pestsDeterred),
                            bioEntries: prof.matchedBioEntries.filter(function (be) { return be.role === "biocontrol"; }).slice(0, 3)
                        });
                    }
                }

                if (p.interplanted || (/nasturtium|mustard|calendula|radish/i.test(canonicalName) && prof.pestsAttracted.length > 0)) {
                    trapCrops.push({
                        plantingId: p.id,
                        cropName: canonicalName,
                        pestsTrapped: prof.pestsAttracted.slice(0, 5),
                        blockId: p.blockId,
                        bedStart: p.bedStart
                    });
                }

                prof.matchedBioEntries.forEach(function (be) {
                    if (!matchedBiosMap.has(be.id)) {
                        matchedBiosMap.set(be.id, be);
                    }
                    if (be.role === "biocontrol") {
                        biocontrolList.push({
                            name: be.name,
                            sourceCrop: canonicalName,
                            action: "bios",
                            targets: be.targets ? [be.targets] : [],
                            bioEntries: [be]
                        });
                    }
                });
            }
        });

        // Mark gap months (Mar..Oct with 0 active blooms)
        const gapMonths = [];
        monthBuckets.forEach(function (b) {
            if (b.activePollinatorSeason && b.count === 0) {
                b.isGap = true;
                gapMonths.push(b.month);
            }
        });

        // Recommend gap-month blooming companions from catalog (excluding antagonists)
        const recommendedCompanions = [];
        if (gapMonths.length > 0 && cat && Array.isArray(cat.crops)) {
            const candidates = [];
            cat.crops.forEach(function (cand) {
                if (!cand || presentCropKeys.has(normalizeKey(cand.name))) return;
                const candBlooms = getCropBloomMonths(cand);
                if (!candBlooms.length) return;
                const covers = gapMonths.filter(function (gm) { return candBlooms.indexOf(gm) !== -1; });
                if (!covers.length) return;

                let conflict = false;
                for (let ai = 0; ai < activeCropsList.length; ai++) {
                    if (pairCompatibility(cand, cand.name, activeCropsList[ai], activeCropsList[ai].name) === "conflict") {
                        conflict = true;
                        break;
                    }
                }
                if (conflict) return;

                let sc = covers.length * 15;
                if (!cand.isEstimatedDefault) sc += 18;
                if (cand.interplantable) sc += 12;
                if (cand.isNativeBC) sc += 10;
                if (cand.category === "Flower" || cand.category === "Herb") sc += 8;
                if (isMeaningful(cand["Natural Predators Attracted"])) sc += 10;
                candidates.push({
                    cropName: cand.name,
                    category: cand.category,
                    isNativeBC: Boolean(cand.isNativeBC),
                    bloomMonths: candBlooms,
                    coversGapMonths: covers,
                    coversLabels: covers.map(function (m) { return MONTH_ABBR[m - 1]; }),
                    reason: "Blooms " + covers.map(function (m) { return MONTH_ABBR[m - 1]; }).join(", ") +
                        (isMeaningful(cand["Natural Predators Attracted"]) ? " · Attracts beneficial predators" : " · Bridges pollinator gap"),
                    score: sc,
                    crop: cand
                });
            });
            candidates.sort(function (a, b) { return b.score - a.score; });
            candidates.slice(0, 6).forEach(function (item) { recommendedCompanions.push(item); });
        }

        // Companion harmony & antagonism pairs across scoped plantings
        const harmonyPairs = [];
        const antagonismPairs = [];
        const seenPairs = new Set();
        scopedPlantings.forEach(function (p) {
            if (!p.blockId || !p.bedStart) return;
            const rel = checkCompanionRelationships(p, season, cat ? cat.cropMap : null);
            rel.companions.forEach(function (cp) {
                const pairKey = [p.cropName, cp.cropName].sort().join("|") + "|" + cp.relation;
                if (!seenPairs.has(pairKey)) {
                    seenPairs.add(pairKey);
                    harmonyPairs.push({
                        cropA: p.cropName,
                        cropB: cp.cropName,
                        bedA: p.bedStart,
                        bedB: cp.bedStart,
                        relation: cp.relation,
                        note: cp.notes
                    });
                }
            });
            rel.conflicts.forEach(function (cf) {
                const pairKey = [p.cropName, cf.cropName].sort().join("|") + "|" + cf.relation;
                if (!seenPairs.has(pairKey)) {
                    seenPairs.add(pairKey);
                    antagonismPairs.push({
                        cropA: p.cropName,
                        cropB: cf.cropName,
                        bedA: p.bedStart,
                        bedB: cf.bedStart,
                        relation: cf.relation,
                        reason: cf.reason
                    });
                }
            });
        });

        const coveredPollinatorMonths = 8 - gapMonths.length;
        const continuityScore = Math.round((coveredPollinatorMonths / 8) * 100);
        const uniqueSpeciesCount = uniqueCropProfiles.size;
        const diversityBonus = Math.min(25, uniqueSpeciesCount * 2 + familySet.size * 2);
        const defenseBonus = Math.min(25, predatorAgg.size * 4 + biocontrolList.length * 3 + harmonyPairs.length * 3);
        const penalty = Math.min(30, antagonismPairs.length * 12);
        const ecologyScore = scopedPlantings.length === 0
            ? 0
            : clamp(Math.round(continuityScore * 0.5 + diversityBonus + defenseBonus - penalty), 0, 100);

        return {
            scope: {
                blockId: blockIdOpt || null,
                blockName: targetBlock ? targetBlock.name : "All Active Blocks",
                seasonYear: Number(season.year || 2026)
            },
            bloomContinuity: {
                months: monthBuckets,
                gapMonths: gapMonths,
                gapMonthLabels: gapMonths.map(function (m) { return MONTH_ABBR[m - 1]; }),
                activePollinatorMonthsCount: coveredPollinatorMonths,
                score: continuityScore,
                recommendedCompanions: recommendedCompanions
            },
            pestDefense: {
                pests: Array.from(pestAgg.values()).sort(function (a, b) { return b.count - a.count; }).slice(0, 18),
                predators: Array.from(predatorAgg.values()).sort(function (a, b) { return b.count - a.count; }).slice(0, 16),
                biocontrols: biocontrolList.slice(0, 16),
                diseases: Array.from(diseaseAgg.values()).slice(0, 14),
                matchedBios: Array.from(matchedBiosMap.values()).slice(0, 24)
            },
            companionSummary: {
                harmonyPairs: harmonyPairs,
                antagonismPairs: antagonismPairs,
                nitrogenFixers: nitrogenFixers,
                trapCrops: trapCrops,
                deterrentPlants: deterrentPlants
            },
            diversity: {
                totalPlantings: scopedPlantings.length,
                uniqueSpecies: uniqueSpeciesCount,
                uniqueFamilies: familySet.size,
                nativeCount: nativeCount,
                nativeSharePct: uniqueSpeciesCount > 0 ? Math.round((nativeCount / uniqueSpeciesCount) * 100) : 0,
                coastSalishCount: coastSalishCount,
                pollinatorSupportingCount: pollinatorSupportingCount,
                lepidopteraHostSpeciesCount: lepidopteraHosts.length,
                totalLepidopteraHostsSupported: totalLepCount,
                coastSalishPlants: coastSalishPlants,
                lepidopteraHosts: lepidopteraHosts
            },
            soilGuilds: {
                mycorrhizalBreakdown: mycorrhizalBreakdown,
                rootFormationBreakdown: rootFormationBreakdown,
                nutrientBalance: nutrientBalance
            },
            ecologyScore: ecologyScore
        };
    }

    function getBedStratificationProfile(blockOrId, bedNumber, seasonData, catalogOpt) {
        const cat = catalogOpt || _cachedCatalog;
        const season = seasonData || { blocks: [], tunnels: [], plantings: [] };
        const blocks = season.blocks || [];
        const block = typeof blockOrId === "string"
            ? (blocks.find(function (b) { return b.id === blockOrId; }) || { id: blockOrId, name: blockOrId })
            : (blockOrId || blocks[0] || { id: "block", name: "Bed", bedCount: 1 });
        const targetBed = Math.max(1, Math.round(Number(bedNumber) || 1));

        const canopyMap = {
            tall: { stratum: "tall", label: "Tall Canopy / Trellis (>140 cm)", items: [] },
            mid: { stratum: "mid", label: "Mid Canopy (50–140 cm)", items: [] },
            low: { stratum: "low", label: "Low Herb / Leafy (22–50 cm)", items: [] },
            groundcover: { stratum: "groundcover", label: "Groundcover (<22 cm)", items: [] }
        };
        const rootMap = {
            shallow: { stratum: "shallow", label: "Shallow Roots (0–22 cm)", items: [] },
            medium: { stratum: "medium", label: "Mid-Zone Roots (22–45 cm)", items: [] },
            deep: { stratum: "deep", label: "Deep Taproot / Mining (>45 cm)", items: [] }
        };

        const items = [];
        (season.plantings || []).forEach(function (p) {
            if (!p || p.blockId !== block.id || !p.bedStart) return;
            const pStart = Number(p.bedStart);
            const pEnd = pStart + Math.max(1, Math.ceil(Number(p.bedCount ?? 1))) - 1;
            if (targetBed < pStart || targetBed > pEnd) return;

            const crop = (cat && cat.cropMap) ? resolveCrop(cat.cropMap, p.cropName) : null;
            const prof = crop ? getCropEcologyProfile(crop, cat) : null;
            const canopyStratum = prof ? prof.canopyStratum : "mid";
            const rootStratum = prof ? prof.rootStratum : "medium";
            const item = {
                plantingId: p.id,
                cropName: crop ? crop.name : p.cropName,
                label: p.label || (crop ? crop.name : p.cropName),
                category: (crop && crop.category) || "Vegetable",
                family: (crop && crop.family) || "Other",
                interplanted: Boolean(p.interplanted),
                canopyStratum: canopyStratum,
                canopyLayerLabel: prof ? prof.canopyLayer : "Mid Canopy",
                heightCm: prof ? prof.heightCm.mid : 45,
                spreadCm: prof ? prof.spreadCm.mid : 30,
                rootStratum: rootStratum,
                rootFormation: prof ? prof.rootFormation : "Fibrous",
                estimatedRootCm: prof ? prof.estimatedRootCm : 30,
                mycorrhizaeType: prof ? prof.mycorrhizaeType : "Unknown",
                startDate: p.startDate || "",
                endDate: p.endDate || "",
                color: getCategoryColor((crop && crop.category) || "Vegetable")
            };
            items.push(item);
            if (canopyMap[canopyStratum]) canopyMap[canopyStratum].items.push(item);
            if (rootMap[rootStratum]) rootMap[rootStratum].items.push(item);
        });

        const canopyLayers = [canopyMap.tall, canopyMap.mid, canopyMap.low, canopyMap.groundcover];
        const rootLayers = [rootMap.shallow, rootMap.medium, rootMap.deep];
        const canopyFilled = canopyLayers.filter(function (l) { return l.items.length > 0; }).length;
        const rootFilled = rootLayers.filter(function (l) { return l.items.length > 0; }).length;

        const notes = [];
        if (items.length === 0) {
            notes.push("No active plantings assigned to " + (block.name || "Block") + " Bed " + targetBed + ".");
        } else {
            if (canopyFilled >= 2 && rootFilled >= 2) {
                notes.push("Multi-tier guild: occupies " + canopyFilled + " canopy strata & " + rootFilled + " root depths.");
            }
            if (canopyMap.groundcover.items.length === 0) {
                notes.push("Open soil surface: consider interplanting Sweet Alyssum or White Clover as living mulch.");
            }
            if (rootMap.deep.items.length === 0 && rootMap.shallow.items.length > 0) {
                notes.push("Shallow-rooted bed: pairs well with deep-mining taproots or cover crops next succession.");
            }
        }

        return {
            blockId: block.id,
            blockName: block.name || "",
            bedNumber: targetBed,
            plantingCount: items.length,
            canopyLayers: canopyLayers,
            rootLayers: rootLayers,
            items: items,
            layerDiversity: {
                canopyFilled: canopyFilled,
                rootFilled: rootFilled,
                hasGroundcover: canopyMap.groundcover.items.length > 0,
                hasDeepRoot: rootMap.deep.items.length > 0
            },
            notes: notes
        };
    }

    function suggestInterplantCompanions(cropOrName, catalogOpt, limitOpt) {
        const cat = catalogOpt || _cachedCatalog;
        const cap = clamp(Math.round(Number(limitOpt) || 5), 1, 20);
        if (!cat || !Array.isArray(cat.crops) || cat.crops.length === 0) return [];

        const target = typeof cropOrName === "string"
            ? resolveCrop(cat.cropMap, cropOrName)
            : cropOrName;
        const targetProf = target ? getCropEcologyProfile(target, cat) : null;
        const targetPestTokens = targetProf
            ? targetProf.pestsAttracted.concat(targetProf.diseases).map(normalizeKey)
            : [];

        const scored = [];
        cat.crops.forEach(function (cand) {
            if (!cand || !cand.name) return;
            if (target && normalizeKey(cand.name) === normalizeKey(target.name)) return;
            if (target && pairCompatibility(target, target.name, cand, cand.name) === "conflict") return;

            const reasons = [];
            let score = 0;

            if (target && pairCompatibility(target, target.name, cand, cand.name) === "companion") {
                score += 45;
                reasons.push("Verified companion");
            }
            if (cand.interplantable) {
                score += 24;
                reasons.push("Interplantable strip");
            }
            if (cand.category === "Flower" || cand.category === "Herb" || cand.category === "Cover Crop") {
                score += 16;
            }
            if (cand.isNativeBC) score += 6;

            const predators = splitSemicolonOrCommaClean(cand["Natural Predators Attracted"]);
            if (predators.length > 0) {
                score += 18;
                reasons.push("Attracts " + predators.slice(0, 2).join(", "));
            }

            const repelled = splitSemicolonOrCommaClean(cand["Pest Repelled"]).concat(splitSemicolonOrCommaClean(cand["Pest Deterred"]));
            if (repelled.length > 0) {
                score += 12;
                const targetedMatch = targetPestTokens.some(function (tp) {
                    return repelled.some(function (rp) {
                        const rpk = normalizeKey(rp);
                        return rpk && tp && (tp.includes(rpk) || rpk.includes(tp));
                    });
                });
                if (targetedMatch) {
                    score += 22;
                    reasons.push("Deters " + target.name + " pests (" + repelled.slice(0, 2).join(", ") + ")");
                } else {
                    reasons.push("Repels " + repelled.slice(0, 2).join(", "));
                }
            }

            if (isMeaningful(cand["Biopesticide Produced Chemical"])) {
                score += 8;
            }
            if (cand.family === "Fabaceae" && target && target.nutrientDemand === "Heavy") {
                score += 12;
                reasons.push("Nitrogen fixer");
            }
            if (target && cand.family && target.family && cand.family === target.family) {
                score -= 22;
            } else if (target && cand.family && target.family) {
                score += 6;
            }

            const bloomMonths = getCropBloomMonths(cand);
            if (bloomMonths.length > 0 || isMeaningful(cand["Pollinators Attracted"]) || isMeaningful(cand.Pollinators)) {
                score += 8;
                if (reasons.length < 2 && bloomMonths.length > 0) {
                    reasons.push("Blooms " + MONTH_ABBR[bloomMonths[0] - 1] + "–" + MONTH_ABBR[bloomMonths[bloomMonths.length - 1] - 1]);
                }
            }
            if (!cand.isEstimatedDefault) score += 16;

            if (score <= 15) return;
            if (reasons.length === 0) reasons.push("Beneficial companion diversity");

            const genus = (cand.latin || "").trim().split(/\s+/)[0].toLowerCase() || normalizeKey(cand.name.split("(")[0]);
            scored.push({
                cropName: cand.name,
                latin: cand.latin || "",
                genus: genus,
                family: cand.family || "Other",
                category: cand.category || "Flower",
                shortCode: cand.shortCode || "",
                isExplicitCompanion: target ? pairCompatibility(target, target.name, cand, cand.name) === "companion" : false,
                isInterplantable: Boolean(cand.interplantable),
                isNativeBC: Boolean(cand.isNativeBC),
                score: score,
                reasons: reasons,
                reasonText: reasons.slice(0, 2).join(" · "),
                predatorsAttracted: predators,
                pestsRepelled: repelled,
                bloomMonths: bloomMonths,
                defaultStrip: {
                    cropName: cand.name,
                    label: cand.name + " Strip",
                    bedCount: 1,
                    interplanted: true,
                    method: cand.method || "Direct Seed",
                    rowsPerBed: 1
                }
            });
        });

        scored.sort(function (a, b) {
            if (b.score !== a.score) return b.score - a.score;
            return a.cropName.localeCompare(b.cropName);
        });

        // Diversify genera in top picks (first pick best species per genus, then fill remaining slots)
        const picked = [];
        const usedGenera = new Set();
        const deferred = [];
        for (let i = 0; i < scored.length && picked.length < cap; i++) {
            const item = scored[i];
            if (item.genus && !usedGenera.has(item.genus)) {
                usedGenera.add(item.genus);
                delete item.genus;
                picked.push(item);
            } else {
                delete item.genus;
                deferred.push(item);
            }
        }
        for (let i = 0; i < deferred.length && picked.length < cap; i++) {
            picked.push(deferred[i]);
        }
        return picked;
    }

    function shiftPlantingDates(planting, deltaStartDays, deltaDurationDays, crop, block, tunnels, climateAdjusted) {
        if (!planting) return null;
        const useClimate = climateAdjusted !== false;
        const dStart = Math.round(Number(deltaStartDays) || 0);
        const dDur = Math.round(Number(deltaDurationDays) || 0);

        const before = computePlantingDates(planting, crop, block, tunnels, useClimate);

        if (dStart !== 0) {
            if (planting.lockHarvestDate) {
                const baseTarget = planting.targetHarvestDate || before.harvestStartDate;
                planting.targetHarvestDate = addDaysIso(baseTarget, dStart);
            } else {
                planting.startDate = addDaysIso(before.startDate, dStart);
            }
        }

        if (dDur !== 0) {
            const nextDtmRaw = before.baseDtm + dDur;
            if (nextDtmRaw >= 7) {
                planting.dtmDaysOverride = clamp(nextDtmRaw, 7, 365);
            } else {
                planting.dtmDaysOverride = 7;
                const remainder = nextDtmRaw - 7;
                planting.harvestWindowOverride = clamp(before.harvestWindowDays + remainder, 1, 180);
            }
        }

        const after = computePlantingDates(planting, crop, block, tunnels, useClimate);
        planting.startDate = after.startDate;
        planting.endDate = after.endDate;
        planting.harvestStartDate = after.harvestStartDate;
        planting.harvestEndDate = after.harvestEndDate;
        planting.seedingDate = after.seedingDate;
        planting.transplantDate = after.transplantDate;
        planting.pottingUpDate = after.pottingUpDate;
        planting.effectiveDtm = after.effectiveDtm;

        return Object.assign({
            planting: planting,
            dtmDaysOverride: planting.dtmDaysOverride,
            harvestWindowOverride: planting.harvestWindowOverride
        }, after);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================
    global.WCPPBedSimCore = {
        STORAGE_KEY: STORAGE_KEY,
        PLANS_STORAGE_KEY: PLANS_STORAGE_KEY,
        PREFS_COOKIE_NAME: PREFS_COOKIE_NAME,
        BC_MONTHLY_TEMP_C: BC_MONTHLY_TEMP_C,
        DEFAULT_ROTATION_CYCLES: DEFAULT_ROTATION_CYCLES,
        STANDARD_BED_PRESETS: STANDARD_BED_PRESETS,
        FAMILY_COLORS: FAMILY_COLORS,
        CATEGORY_COLORS: CATEGORY_COLORS,

        loadCatalog: loadCatalog,
        loadEcologicalEnrichment: loadEcologicalEnrichment,
        whenEnriched: whenEnriched,
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

        listSavedPlans: listSavedPlans,
        getActivePlanMeta: getActivePlanMeta,
        saveNamedPlan: saveNamedPlan,
        loadNamedPlan: loadNamedPlan,
        renameSavedPlan: renameSavedPlan,
        duplicateSavedPlan: duplicateSavedPlan,
        deleteSavedPlan: deleteSavedPlan,
        readPrefsCookie: readPrefsCookie,
        writePrefsCookie: writePrefsCookie,
        encodePlanToHash: encodePlanToHash,
        decodePlanFromHash: decodePlanFromHash,

        getClimateInfo: getClimateInfo,
        getFrostWindow: getFrostWindow,
        computeEffectiveDtm: computeEffectiveDtm,
        computePlantingDates: computePlantingDates,
        shiftPlantingDates: shiftPlantingDates,
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

        getCropEcologyProfile: getCropEcologyProfile,
        analyzeBedEcology: analyzeBedEcology,
        getBedStratificationProfile: getBedStratificationProfile,
        suggestInterplantCompanions: suggestInterplantCompanions,

        cmToIn: cmToIn,
        inToCm: inToCm,
        mToFt: mToFt,
        ftToM: ftToM,
        formatLength: formatLength,
        formatSpacing: formatSpacing
    };
})(typeof window !== "undefined" ? window : globalThis);
