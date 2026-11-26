(function (global) {
    "use strict";

    // =========================================================================
    // CONSTANTS & REFERENCE TABLES
    // =========================================================================
    const STORAGE_KEY = "wcpp_bed_sim_v1";
    const PLANS_STORAGE_KEY = "wcpp_bed_sim_plans_v2";
    const CUSTOM_SHAPES_STORAGE_KEY = "wcpp_bed_custom_shapes_v1";
    const CUSTOM_SHAPE_FORMAT = "wcpp-custom-bed-shape";
    const CUSTOM_SHAPE_VERSION = "1.0";
    const PREFS_COOKIE_NAME = "wcpp_bedsim_prefs";
    const MAX_UNDO_SNAPSHOTS = 30;
    const TRAY_AREA_1020_M2 = 0.15;
    const INTERPLANT_MODES = ["sole", "lanes", "border", "understory", "relay"];

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

    const CUSTOM_SHAPE_TEMPLATES = [
        {
            id: "rectangle",
            name: "Rectangle",
            description: "Classic straight-sided raised bed (240 × 120 cm)",
            gridStepCm: 25,
            points: [
                { x: 0, y: 0, curve: null },
                { x: 240, y: 0, curve: null },
                { x: 240, y: 120, curve: null },
                { x: 0, y: 120, curve: null }
            ]
        },
        {
            id: "l-shape",
            name: "L-Shape",
            description: "Corner wraparound raised bed (240 × 240 cm)",
            gridStepCm: 25,
            points: [
                { x: 0, y: 0, curve: null },
                { x: 240, y: 0, curve: null },
                { x: 240, y: 100, curve: null },
                { x: 100, y: 100, curve: null },
                { x: 100, y: 240, curve: null },
                { x: 0, y: 240, curve: null }
            ]
        },
        {
            id: "keyhole",
            name: "Keyhole",
            description: "Circular bed with compost access notch (240 cm)",
            gridStepCm: 25,
            points: [
                { x: 89.6, y: 235.9, curve: { cx: 16.5, cy: 205.5 } },
                { x: 2.3, y: 141.4, curve: { cx: -4.2, cy: 62.6 } },
                { x: 52.3, y: 21.8, curve: { cx: 120.7, cy: -18.7 } },
                { x: 189.1, y: 21.8, curve: { cx: 245.6, cy: 62.6 } },
                { x: 239.1, y: 141.4, curve: { cx: 224.9, cy: 205.5 } },
                { x: 151.8, y: 235.9, curve: null },
                { x: 144.7, y: 145, curve: { cx: 120.7, cy: 95 } },
                { x: 96.7, y: 145, curve: null }
            ]
        },
        {
            id: "crescent",
            name: "Crescent",
            description: "Sun-trap curved moon bed (300 × 150 cm)",
            gridStepCm: 25,
            points: [
                { x: 0, y: 150, curve: { cx: 35, cy: 0 } },
                { x: 150, y: 0, curve: { cx: 265, cy: 0 } },
                { x: 300, y: 150, curve: { cx: 230, cy: 95 } },
                { x: 150, y: 95, curve: { cx: 70, cy: 95 } }
            ]
        },
        {
            id: "kidney",
            name: "Kidney",
            description: "Organic contoured bean-shaped bed (292 × 155 cm)",
            gridStepCm: 25,
            points: [
                { x: 1.2, y: 85, curve: { cx: 11.2, cy: 0 } },
                { x: 146.2, y: 0, curve: { cx: 281.2, cy: 0 } },
                { x: 291.2, y: 85, curve: { cx: 301.2, cy: 155 } },
                { x: 226.2, y: 155, curve: { cx: 191.2, cy: 155 } },
                { x: 181.2, y: 130, curve: { cx: 171.2, cy: 105 } },
                { x: 146.2, y: 105, curve: { cx: 121.2, cy: 105 } },
                { x: 111.2, y: 130, curve: { cx: 101.2, cy: 155 } },
                { x: 66.2, y: 155, curve: { cx: -8.8, cy: 155 } }
            ]
        },
        {
            id: "circle",
            name: "Circle",
            description: "Mandala herb & pollinator wheel (240 cm diameter)",
            gridStepCm: 25,
            points: [
                { x: 240, y: 120, curve: { cx: 240, cy: 169.7 } },
                { x: 204.9, y: 204.9, curve: { cx: 169.7, cy: 240 } },
                { x: 120, y: 240, curve: { cx: 70.3, cy: 240 } },
                { x: 35.1, y: 204.9, curve: { cx: 0, cy: 169.7 } },
                { x: 0, y: 120, curve: { cx: 0, cy: 70.3 } },
                { x: 35.1, y: 35.1, curve: { cx: 70.3, cy: 0 } },
                { x: 120, y: 0, curve: { cx: 169.7, cy: 0 } },
                { x: 204.9, y: 35.1, curve: { cx: 240, cy: 70.3 } }
            ]
        }
    ];

    const BLOCK_TYPES = ["field", "greenhouse", "bench", "pot", "basket"];
    const CONTAINER_BLOCK_TYPES = new Set(["bench", "pot", "basket"]);
    const SQ_FT_CM2 = 929.0304;
    const LITERS_PER_US_GALLON = 3.785411784;
    const LITERS_PER_US_QUART = LITERS_PER_US_GALLON / 4;
    const LITERS_PER_CUBIC_FOOT = 28.316846592;
    const MAX_PLAYGROUND_GEN_PLANTS = 600;

    const CONTAINER_PRESETS = [
        {
            id: "pot-8in-herb",
            name: '8" Herb Pot',
            label: '8" Herb Pot',
            blockType: "pot",
            shapeKind: "circle",
            diameterCm: 20.32,
            widthCm: 20.32,
            lengthCm: 20.32,
            depthCm: 17.78,
            bowlFactor: 1.0,
            defaultMediaPreset: "airy-container",
            description: "Compact windowsill or patio herb pot (~5.8 L / 1.5 gal)"
        },
        {
            id: "pot-12in-std",
            name: '12" Standard Pot',
            label: '12" Standard Pot',
            blockType: "pot",
            shapeKind: "circle",
            diameterCm: 30.48,
            widthCm: 30.48,
            lengthCm: 30.48,
            depthCm: 27.94,
            bowlFactor: 1.0,
            defaultMediaPreset: "airy-container",
            description: "Versatile 12-inch deck pot for greens, peppers & herbs (~20.4 L / 5.4 gal)"
        },
        {
            id: "pot-16in-barrel",
            name: '16" Patio Barrel',
            label: '16" Patio Barrel',
            blockType: "pot",
            shapeKind: "circle",
            diameterCm: 40.64,
            widthCm: 40.64,
            lengthCm: 40.64,
            depthCm: 38.1,
            bowlFactor: 1.0,
            defaultMediaPreset: "mels-mix",
            description: "Deep patio planter for tomatoes, squash & multi-crop guilds (~49.4 L / 13 gal)"
        },
        {
            id: "pot-5gal-bag",
            name: "5-Gal Grow Bag",
            label: "5-Gal Grow Bag",
            blockType: "pot",
            shapeKind: "circle",
            diameterCm: 30.0,
            widthCm: 30.0,
            lengthCm: 30.0,
            depthCm: 26.8,
            bowlFactor: 1.0,
            defaultMediaPreset: "airy-container",
            description: "Breathable fabric grow bag (~18.9 L / 5.0 gal)"
        },
        {
            id: "pot-window-trough",
            name: "Window Box Trough",
            label: "Window Box Trough",
            blockType: "pot",
            shapeKind: "rectangle",
            diameterCm: null,
            widthCm: 20.0,
            lengthCm: 75.0,
            depthCm: 20.0,
            bowlFactor: 1.0,
            defaultMediaPreset: "airy-container",
            description: "Rectangular railing or sill trough (75 × 20 × 20 cm, 30.0 L)"
        },
        {
            id: "basket-10in",
            name: '10" Hanging Basket',
            label: '10" Hanging Basket',
            blockType: "basket",
            shapeKind: "circle",
            diameterCm: 25.4,
            widthCm: 25.4,
            lengthCm: 25.4,
            depthCm: 15.24,
            bowlFactor: 0.85,
            defaultMediaPreset: "hanging-ultralight",
            description: "Compact trailing herb & flower basket (~6.6 L / 1.7 gal)"
        },
        {
            id: "basket-12in",
            name: '12" Hanging Basket',
            label: '12" Hanging Basket',
            blockType: "basket",
            shapeKind: "circle",
            diameterCm: 30.48,
            widthCm: 30.48,
            lengthCm: 30.48,
            depthCm: 17.78,
            bowlFactor: 0.85,
            defaultMediaPreset: "hanging-ultralight",
            description: "Classic 12-inch hanging basket for strawberries & herbs (~11.0 L / 2.9 gal)"
        },
        {
            id: "basket-14in",
            name: '14" Hanging Basket',
            label: '14" Hanging Basket',
            blockType: "basket",
            shapeKind: "circle",
            diameterCm: 35.56,
            widthCm: 35.56,
            lengthCm: 35.56,
            depthCm: 20.32,
            bowlFactor: 0.85,
            defaultMediaPreset: "hanging-ultralight",
            description: "Generous multi-crop basket (~17.1 L / 4.5 gal)"
        },
        {
            id: "basket-16in",
            name: '16" Hanging Basket',
            label: '16" Hanging Basket',
            blockType: "basket",
            shapeKind: "circle",
            diameterCm: 40.64,
            widthCm: 40.64,
            lengthCm: 40.64,
            depthCm: 22.86,
            bowlFactor: 0.85,
            defaultMediaPreset: "hanging-ultralight",
            description: "Large thriller-filler-spiller basket (~25.2 L / 6.7 gal)"
        },
        {
            id: "bench-6x3",
            name: "6×3 ft Patio/Greenhouse Bench",
            label: "6×3 ft Patio/Greenhouse Bench",
            blockType: "bench",
            shapeKind: "rectangle",
            diameterCm: null,
            widthCm: 91.44,
            lengthCm: 182.88,
            depthCm: 25.4,
            bowlFactor: 1.0,
            defaultMediaPreset: "mels-mix",
            description: "Elevated 6 × 3 ft square-foot growing bench (18 ft², ~425 L)"
        }
    ];

    const GROWING_MEDIA_INGREDIENTS = [
        {
            id: "coco-coir",
            label: "Coco Coir",
            aeration: 65,
            retention: 85,
            nutrition: 10,
            weight: 32,
            drainageNote: "Wets evenly, re-wets easily after drying, near-neutral pH (~6.0–6.5)"
        },
        {
            id: "peat-moss",
            label: "Sphagnum Peat Moss",
            aeration: 55,
            retention: 88,
            nutrition: 10,
            weight: 28,
            drainageNote: "Lightweight acidic fiber (~pH 4.0–4.8); helpful for blueberries & berries"
        },
        {
            id: "perlite",
            label: "Perlite",
            aeration: 95,
            retention: 15,
            nutrition: 0,
            weight: 12,
            drainageNote: "Ultralight expanded volcanic glass for fast drainage & root oxygen"
        },
        {
            id: "vermiculite",
            label: "Vermiculite",
            aeration: 45,
            retention: 90,
            nutrition: 20,
            weight: 18,
            drainageNote: "Spongy mineral mica holding moisture, potassium & magnesium in light mixes"
        },
        {
            id: "pumice",
            label: "Pumice",
            aeration: 92,
            retention: 25,
            nutrition: 5,
            weight: 52,
            drainageNote: "Permanent porous volcanic grit; will not float or crush in perennials"
        },
        {
            id: "compost",
            label: "Screened Compost",
            aeration: 45,
            retention: 72,
            nutrition: 88,
            weight: 62,
            drainageNote: "Balanced organic humus, microbes & slow-release fertility"
        },
        {
            id: "worm-castings",
            label: "Worm Castings",
            aeration: 35,
            retention: 75,
            nutrition: 95,
            weight: 68,
            drainageNote: "Dense biological inoculant & gentle trace minerals; best at 5–20%"
        },
        {
            id: "pine-bark",
            label: "Aged Pine Bark Fines",
            aeration: 82,
            retention: 40,
            nutrition: 20,
            weight: 38,
            drainageNote: "Long-lasting structural chunks & mild acidity that resist compaction"
        },
        {
            id: "potting-soil",
            label: "Organic Potting Soil",
            aeration: 62,
            retention: 68,
            nutrition: 60,
            weight: 48,
            drainageNote: "Pre-blended soilless container base ready for herbs, greens & annuals"
        },
        {
            id: "garden-loam",
            label: "Garden Loam / Topsoil",
            aeration: 25,
            retention: 65,
            nutrition: 70,
            weight: 88,
            drainageNote: "Heavy mineral soil; great in open beds, compacts and weighs down baskets"
        },
        {
            id: "coarse-sand",
            label: "Coarse Horticultural Sand",
            aeration: 85,
            retention: 10,
            nutrition: 0,
            weight: 95,
            drainageNote: "Heavy fast-draining mineral grit for PNW rock natives & root crops"
        },
        {
            id: "biochar",
            label: "Charged Biochar",
            aeration: 75,
            retention: 60,
            nutrition: 35,
            weight: 36,
            drainageNote: "Micro-porous carbon sponge that stabilizes moisture & cation exchange"
        },
        {
            id: "leaf-mold",
            label: "Leaf Mold",
            aeration: 58,
            retention: 80,
            nutrition: 45,
            weight: 44,
            drainageNote: "Fungal-dominant woodland humus ideal for Coastal BC native perennials"
        }
    ];

    const GROWING_MEDIA_BY_ID = new Map(GROWING_MEDIA_INGREDIENTS.map(function (ing) { return [ing.id, ing]; }));

    const GROWING_MEDIA_PRESETS = [
        {
            id: "airy-container",
            name: "Airy Container Mix",
            label: "Airy Container Mix",
            description: "Balanced soilless pot blend with crisp aeration & steady moisture",
            recommendedFor: ["pot", "bench"],
            ingredients: [
                { id: "coco-coir", pct: 45 },
                { id: "perlite", pct: 25 },
                { id: "compost", pct: 20 },
                { id: "worm-castings", pct: 10 }
            ]
        },
        {
            id: "hanging-ultralight",
            name: "Hanging Basket Ultra-Light",
            label: "Hanging Basket Ultra-Light",
            description: "Featherweight moisture-retaining mix engineered for overhead baskets",
            recommendedFor: ["basket", "pot"],
            ingredients: [
                { id: "coco-coir", pct: 40 },
                { id: "perlite", pct: 30 },
                { id: "vermiculite", pct: 15 },
                { id: "compost", pct: 15 }
            ]
        },
        {
            id: "mels-mix",
            name: "Mel's Mix (Square Foot)",
            label: "Mel's Mix (Square Foot)",
            description: "Classic 1/3 fiber, 1/3 vermiculite, 1/3 compost for benches & raised beds",
            recommendedFor: ["bench", "pot", "field"],
            ingredients: [
                { id: "coco-coir", pct: 34 },
                { id: "vermiculite", pct: 33 },
                { id: "compost", pct: 33 }
            ]
        },
        {
            id: "pnw-native-grit",
            name: "PNW Native Grit & Woodland",
            label: "PNW Native Grit & Woodland",
            description: "Fast-draining coastal mineral & leaf-humus mix for BC natives & Mediterranean herbs",
            recommendedFor: ["pot", "bench", "field"],
            ingredients: [
                { id: "leaf-mold", pct: 35 },
                { id: "coarse-sand", pct: 25 },
                { id: "pumice", pct: 20 },
                { id: "pine-bark", pct: 20 }
            ]
        },
        {
            id: "raised-bed-loam",
            name: "Raised Bed Fertile Loam",
            label: "Raised Bed Fertile Loam",
            description: "Rich mineral topsoil & humus blend for ground beds & deep troughs",
            recommendedFor: ["field", "greenhouse", "bench"],
            ingredients: [
                { id: "garden-loam", pct: 45 },
                { id: "compost", pct: 35 },
                { id: "leaf-mold", pct: 10 },
                { id: "perlite", pct: 10 }
            ]
        },
        {
            id: "seed-starting",
            name: "Seed Starting Fine Mix",
            label: "Seed Starting Fine Mix",
            description: "Fine, low-salt, pathogen-light medium for sowing & shallow greens",
            recommendedFor: ["bench", "pot"],
            ingredients: [
                { id: "coco-coir", pct: 50 },
                { id: "vermiculite", pct: 25 },
                { id: "perlite", pct: 20 },
                { id: "worm-castings", pct: 5 }
            ]
        }
    ];

    const GROWING_MEDIA_PRESETS_BY_ID = new Map(GROWING_MEDIA_PRESETS.map(function (p) { return [p.id, p]; }));

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
        "Flower Bloom Time",
        "Companion Plants in Containers",
        "Spacing",
        "Suitable Soil",
        "Drainage"
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
        "Synonyms_Basionyms",
        "Container_Suitability"
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
    // 2B. CUSTOM BED SHAPE GEOMETRY & LIBRARY (V3)
    // =========================================================================
    function evalQuadBezier(p0, c, p1, t) {
        const mt = 1 - t;
        const cx = c.cx !== undefined ? c.cx : c.x;
        const cy = c.cy !== undefined ? c.cy : c.y;
        return {
            x: mt * mt * p0.x + 2 * mt * t * cx + t * t * p1.x,
            y: mt * mt * p0.y + 2 * mt * t * cy + t * t * p1.y
        };
    }

    function getQuadBezierBounds(p0, c, p1) {
        const cx = c.cx !== undefined ? c.cx : c.x;
        const cy = c.cy !== undefined ? c.cy : c.y;
        let minX = Math.min(p0.x, p1.x);
        let maxX = Math.max(p0.x, p1.x);
        let minY = Math.min(p0.y, p1.y);
        let maxY = Math.max(p0.y, p1.y);

        const denomX = p0.x - 2 * cx + p1.x;
        if (Math.abs(denomX) > 1e-9) {
            const tx = (p0.x - cx) / denomX;
            if (tx > 0 && tx < 1) {
                const mt = 1 - tx;
                const vx = mt * mt * p0.x + 2 * mt * tx * cx + tx * tx * p1.x;
                if (vx < minX) minX = vx;
                if (vx > maxX) maxX = vx;
            }
        }

        const denomY = p0.y - 2 * cy + p1.y;
        if (Math.abs(denomY) > 1e-9) {
            const ty = (p0.y - cy) / denomY;
            if (ty > 0 && ty < 1) {
                const mt = 1 - ty;
                const vy = mt * mt * p0.y + 2 * mt * ty * cy + ty * ty * p1.y;
                if (vy < minY) minY = vy;
                if (vy > maxY) maxY = vy;
            }
        }

        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }

    function quadBezierArcLength(p0, c, p1, steps) {
        const segs = Math.max(8, Math.round(Number(steps) || 24));
        let len = 0;
        let prev = p0;
        for (let k = 1; k <= segs; k++) {
            const curr = evalQuadBezier(p0, c, p1, k / segs);
            len += Math.hypot(curr.x - prev.x, curr.y - prev.y);
            prev = curr;
        }
        return len;
    }

    function extractRawShapePoints(raw) {
        if (!raw || typeof raw !== "object") return null;
        const arr = Array.isArray(raw.points) ? raw.points : (Array.isArray(raw.pts) ? raw.pts : null);
        if (!arr || arr.length < 3 || arr.length > 40) return null;

        const out = [];
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            let rx, ry, rcx, rcy, hasCurve = false;
            if (Array.isArray(item)) {
                if (item.length < 2) return null;
                rx = item[0];
                ry = item[1];
                if (item.length >= 4 && item[2] !== null && item[2] !== undefined && item[3] !== null && item[3] !== undefined) {
                    rcx = item[2];
                    rcy = item[3];
                    hasCurve = true;
                }
            } else if (item && typeof item === "object") {
                rx = item.x;
                ry = item.y;
                if (item.curve && typeof item.curve === "object") {
                    rcx = item.curve.cx;
                    rcy = item.curve.cy;
                    hasCurve = true;
                }
            } else {
                return null;
            }

            if (rx === null || rx === undefined || rx === "" || ry === null || ry === undefined || ry === "") {
                return null;
            }
            const x = Number(rx);
            const y = Number(ry);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

            let curveObj = null;
            if (hasCurve && rcx !== null && rcx !== undefined && rcx !== "" && rcy !== null && rcy !== undefined && rcy !== "") {
                const cx = Number(rcx);
                const cy = Number(rcy);
                if (Number.isFinite(cx) && Number.isFinite(cy)) {
                    curveObj = {
                        cx: clamp(cx, -10000, 10000),
                        cy: clamp(cy, -10000, 10000)
                    };
                }
            }

            out.push({
                x: clamp(x, -10000, 10000),
                y: clamp(y, -10000, 10000),
                curve: curveObj
            });
        }
        return out;
    }

    function computeSignedPolygonArea(poly) {
        if (!Array.isArray(poly) || poly.length < 3) return 0;
        let sum = 0;
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const p0 = poly[i];
            const p1 = poly[(i + 1) % n];
            sum += p0.x * p1.y - p1.x * p0.y;
        }
        return sum * 0.5;
    }

    function samplePointsOutline(pts, samplesPerCurve) {
        if (!Array.isArray(pts) || pts.length < 3) return [];
        const samples = clamp(Math.round(Number(samplesPerCurve) || 16), 2, 128);
        const out = [];
        const n = pts.length;
        for (let i = 0; i < n; i++) {
            const p0 = pts[i];
            const p1 = pts[(i + 1) % n];
            out.push({ x: p0.x, y: p0.y });
            if (p0.curve) {
                for (let k = 1; k < samples; k++) {
                    const pt = evalQuadBezier(p0, p0.curve, p1, k / samples);
                    out.push(pt);
                }
            }
        }
        return out;
    }

    function computeBoundsFromPoints(pts) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        const n = pts.length;
        for (let i = 0; i < n; i++) {
            const p0 = pts[i];
            const p1 = pts[(i + 1) % n];
            if (p0.curve) {
                const b = getQuadBezierBounds(p0, p0.curve, p1);
                if (b.minX < minX) minX = b.minX;
                if (b.minY < minY) minY = b.minY;
                if (b.maxX > maxX) maxX = b.maxX;
                if (b.maxY > maxY) maxY = b.maxY;
            } else {
                if (p0.x < minX) minX = p0.x;
                if (p0.y < minY) minY = p0.y;
                if (p0.x > maxX) maxX = p0.x;
                if (p0.y > maxY) maxY = p0.y;
            }
        }
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }

    function roundCoordCm(v) {
        const r = Math.round(v * 100) / 100;
        return Object.is(r, -0) ? 0 : r;
    }

    function validateAndNormalizeCustomShape(raw) {
        const pts = extractRawShapePoints(raw);
        if (!pts) return null;

        const bounds = computeBoundsFromPoints(pts);
        const spanW = bounds.maxX - bounds.minX;
        const spanH = bounds.maxY - bounds.minY;
        if (!Number.isFinite(spanW) || !Number.isFinite(spanH) || spanW < 1 || spanH < 1) {
            return null;
        }

        const polyCheck = samplePointsOutline(pts, 12);
        if (Math.abs(computeSignedPolygonArea(polyCheck)) < 1) {
            return null;
        }

        const shifted = pts.map(function (pt) {
            const nx = clamp(roundCoordCm(pt.x - bounds.minX), 0, 10000);
            const ny = clamp(roundCoordCm(pt.y - bounds.minY), 0, 10000);
            let curve = null;
            if (pt.curve) {
                curve = {
                    cx: clamp(roundCoordCm(pt.curve.cx - bounds.minX), -10000, 10000),
                    cy: clamp(roundCoordCm(pt.curve.cy - bounds.minY), -10000, 10000)
                };
            }
            return { x: nx, y: ny, curve: curve };
        });

        const nowIso = new Date().toISOString();
        const rawGrid = Number(raw.gridStepCm);
        const gridStepCm = (Number.isFinite(rawGrid) && rawGrid > 0) ? clamp(Math.round(rawGrid), 1, 500) : 25;

        return {
            format: CUSTOM_SHAPE_FORMAT,
            version: CUSTOM_SHAPE_VERSION,
            id: (typeof raw.id === "string" && raw.id.trim()) ? raw.id.trim().slice(0, 64) : generateId("shape"),
            name: (typeof raw.name === "string" && raw.name.trim()) ? raw.name.trim().slice(0, 80) : "Custom Bed Shape",
            units: raw.units === "imperial" ? "imperial" : "metric",
            gridStepCm: gridStepCm,
            points: shifted,
            createdAt: raw.createdAt || nowIso,
            updatedAt: raw.updatedAt || nowIso
        };
    }

    function createCustomShapeTemplate(templateId, options) {
        const key = String(templateId || "rectangle").trim().toLowerCase();
        const tpl = CUSTOM_SHAPE_TEMPLATES.find(function (t) { return t.id === key; }) || CUSTOM_SHAPE_TEMPLATES[0];
        const opts = (options && typeof options === "object") ? options : {};
        const scale = (Number.isFinite(Number(opts.scale)) && Number(opts.scale) > 0) ? clamp(Number(opts.scale), 0.1, 10) : 1;
        const nowIso = new Date().toISOString();

        const points = tpl.points.map(function (pt) {
            return {
                x: pt.x * scale,
                y: pt.y * scale,
                curve: pt.curve ? { cx: pt.curve.cx * scale, cy: pt.curve.cy * scale } : null
            };
        });

        return validateAndNormalizeCustomShape({
            format: CUSTOM_SHAPE_FORMAT,
            version: CUSTOM_SHAPE_VERSION,
            id: (typeof opts.id === "string" && opts.id.trim()) ? opts.id.trim() : generateId("shape"),
            name: (typeof opts.name === "string" && opts.name.trim()) ? opts.name.trim() : tpl.name,
            units: opts.units === "imperial" ? "imperial" : "metric",
            gridStepCm: opts.gridStepCm || tpl.gridStepCm || 25,
            points: points,
            createdAt: nowIso,
            updatedAt: nowIso
        });
    }

    function sampleCustomShapeOutline(shape, samplesPerCurve) {
        const pts = extractRawShapePoints(shape);
        if (!pts) return [];
        return samplePointsOutline(pts, samplesPerCurve === undefined ? 16 : samplesPerCurve);
    }

    function isPointInPolygon(x, y, poly) {
        if (!Array.isArray(poly) || poly.length < 3 || !Number.isFinite(x) || !Number.isFinite(y)) {
            return false;
        }
        let inside = false;
        const n = poly.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = poly[i].x;
            const yi = poly[i].y;
            const xj = poly[j].x;
            const yj = poly[j].y;

            // Treat boundary segment points within 1e-6 cm as inside
            if (pointToSegmentDistance(x, y, xi, yi, xj, yj) <= 1e-6) {
                return true;
            }
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    function pointToSegmentDistance(px, py, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq <= 1e-12) return Math.hypot(px - ax, py - ay);
        const t = clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
        const projX = ax + t * dx;
        const projY = ay + t * dy;
        return Math.hypot(px - projX, py - projY);
    }

    function pointToPolylineDistance(x, y, poly) {
        if (!Array.isArray(poly) || poly.length === 0 || !Number.isFinite(x) || !Number.isFinite(y)) {
            return Infinity;
        }
        if (poly.length === 1) {
            return Math.hypot(x - poly[0].x, y - poly[0].y);
        }
        let minDist = Infinity;
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % n];
            const d = pointToSegmentDistance(x, y, a.x, a.y, b.x, b.y);
            if (d < minDist) minDist = d;
        }
        return minDist;
    }

    function computeCustomShapeGeometry(shape) {
        const pts = extractRawShapePoints(shape);
        if (!pts) return null;

        const poly = samplePointsOutline(pts, 24);
        const signedArea = computeSignedPolygonArea(poly);
        const areaCm2 = +Math.abs(signedArea).toFixed(2);
        const areaM2 = +(areaCm2 / 10000).toFixed(3);
        const areaFt2 = +(areaM2 * 10.76391).toFixed(2);

        let cx = 0;
        let cy = 0;
        if (Math.abs(signedArea) > 1e-4) {
            let sumX = 0;
            let sumY = 0;
            const pn = poly.length;
            for (let i = 0; i < pn; i++) {
                const p0 = poly[i];
                const p1 = poly[(i + 1) % pn];
                const cross = p0.x * p1.y - p1.x * p0.y;
                sumX += (p0.x + p1.x) * cross;
                sumY += (p0.y + p1.y) * cross;
            }
            cx = sumX / (6 * signedArea);
            cy = sumY / (6 * signedArea);
        } else {
            pts.forEach(function (pt) { cx += pt.x; cy += pt.y; });
            cx /= pts.length;
            cy /= pts.length;
        }

        const bounds = computeBoundsFromPoints(pts);
        const minX = roundCoordCm(bounds.minX);
        const minY = roundCoordCm(bounds.minY);
        const maxX = roundCoordCm(bounds.maxX);
        const maxY = roundCoordCm(bounds.maxY);
        const widthCm = roundCoordCm(maxX - minX);
        const heightCm = roundCoordCm(maxY - minY);

        let perimeterCmRaw = 0;
        const edges = [];
        const n = pts.length;
        const pathParts = ["M " + roundCoordCm(pts[0].x) + "," + roundCoordCm(pts[0].y)];

        for (let i = 0; i < n; i++) {
            const p0 = pts[i];
            const p1 = pts[(i + 1) % n];
            if (p0.curve) {
                const segLen = quadBezierArcLength(p0, p0.curve, p1, 24);
                perimeterCmRaw += segLen;
                const mid = evalQuadBezier(p0, p0.curve, p1, 0.5);
                edges.push({
                    index: i,
                    lengthCm: +segLen.toFixed(2),
                    isCurved: true,
                    midX: roundCoordCm(mid.x),
                    midY: roundCoordCm(mid.y),
                    controlX: roundCoordCm(p0.curve.cx),
                    controlY: roundCoordCm(p0.curve.cy)
                });
                pathParts.push("Q " + roundCoordCm(p0.curve.cx) + "," + roundCoordCm(p0.curve.cy) + " " + roundCoordCm(p1.x) + "," + roundCoordCm(p1.y));
            } else {
                const segLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
                perimeterCmRaw += segLen;
                edges.push({
                    index: i,
                    lengthCm: +segLen.toFixed(2),
                    isCurved: false,
                    midX: roundCoordCm((p0.x + p1.x) / 2),
                    midY: roundCoordCm((p0.y + p1.y) / 2),
                    controlX: null,
                    controlY: null
                });
                if (i < n - 1) {
                    pathParts.push("L " + roundCoordCm(p1.x) + "," + roundCoordCm(p1.y));
                } else {
                    pathParts.push("L " + roundCoordCm(p1.x) + "," + roundCoordCm(p1.y));
                }
            }
        }
        pathParts.push("Z");

        const perimeterCm = +perimeterCmRaw.toFixed(2);
        const perimeterM = +(perimeterCm / 100).toFixed(3);
        const perimeterFt = +(perimeterM * 3.28084).toFixed(2);

        const anglesDeg = [];
        for (let i = 0; i < n; i++) {
            const prevIdx = (i - 1 + n) % n;
            const nextIdx = (i + 1) % n;
            const prev = pts[prevIdx];
            const curr = pts[i];
            const next = pts[nextIdx];

            // Incoming vector pointing backwards along edge (prev -> curr)
            let inRef = prev;
            if (prev.curve && Math.hypot(prev.curve.cx - curr.x, prev.curve.cy - curr.y) > 1e-4) {
                inRef = { x: prev.curve.cx, y: prev.curve.cy };
            }
            const ax = inRef.x - curr.x;
            const ay = inRef.y - curr.y;

            // Outgoing vector pointing forwards along edge (curr -> next)
            let outRef = next;
            if (curr.curve && Math.hypot(curr.curve.cx - curr.x, curr.curve.cy - curr.y) > 1e-4) {
                outRef = { x: curr.curve.cx, y: curr.curve.cy };
            }
            const bx = outRef.x - curr.x;
            const by = outRef.y - curr.y;

            const magA = Math.hypot(ax, ay);
            const magB = Math.hypot(bx, by);
            if (magA < 1e-6 || magB < 1e-6) {
                anglesDeg.push(180);
                continue;
            }
            const dot = clamp((ax * bx + ay * by) / (magA * magB), -1, 1);
            const unsignedDeg = (Math.acos(dot) * 180) / Math.PI;
            const cross = ax * by - ay * bx;
            const interior = signedArea >= 0
                ? (cross > 0 ? 360 - unsignedDeg : unsignedDeg)
                : (cross < 0 ? 360 - unsignedDeg : unsignedDeg);
            anglesDeg.push(+interior.toFixed(1));
        }

        return {
            areaCm2: areaCm2,
            areaM2: areaM2,
            areaFt2: areaFt2,
            perimeterCm: perimeterCm,
            perimeterM: perimeterM,
            perimeterFt: perimeterFt,
            minX: minX,
            minY: minY,
            maxX: maxX,
            maxY: maxY,
            widthCm: widthCm,
            heightCm: heightCm,
            cx: roundCoordCm(cx),
            cy: roundCoordCm(cy),
            pathD: pathParts.join(" "),
            edges: edges,
            anglesDeg: anglesDeg
        };
    }

    function getPolygonSliceAtAxis(poly, coord, axis) {
        const hits = [];
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % n];
            const aMain = axis === "y" ? a.x : a.y;
            const bMain = axis === "y" ? b.x : b.y;
            const aCross = axis === "y" ? a.y : a.x;
            const bCross = axis === "y" ? b.y : b.x;
            if ((aMain <= coord && bMain > coord) || (bMain <= coord && aMain > coord)) {
                const t = (coord - aMain) / (bMain - aMain);
                hits.push(aCross + t * (bCross - aCross));
            }
        }
        hits.sort(function (u, v) { return u - v; });
        if (hits.length < 2) return null;
        return { min: hits[0], max: hits[hits.length - 1] };
    }

    function generateCustomShapePlantPoints(shape, inRowCm, betweenRowCm, mode, options) {
        const norm = validateAndNormalizeCustomShape(shape);
        if (!norm) return { points: [], count: 0, areaM2: 0 };

        const geom = computeCustomShapeGeometry(norm);
        const poly = samplePointsOutline(norm.points, 20);
        if (!geom || poly.length < 3) return { points: [], count: 0, areaM2: 0 };

        const inRow = clamp(Number(inRowCm) || 25, 2, 500);
        const betweenRow = clamp(Number(betweenRowCm) || 30, 2, 500);
        const plantMode = INTERPLANT_MODES.indexOf(mode) !== -1 ? mode : "sole";
        const opts = (options && typeof options === "object") ? options : {};

        const defaultMargin = clamp(Math.min(inRow, betweenRow) * 0.35, 3, 16);
        const baseMargin = Number.isFinite(Number(opts.edgeMarginCm)) ? Math.max(0, Number(opts.edgeMarginCm)) : defaultMargin;

        if (plantMode === "border") {
            const signedArea = computeSignedPolygonArea(poly);
            const normalSign = signedArea >= 0 ? 1 : -1;
            const insetDist = Number.isFinite(Number(opts.insetCm))
                ? clamp(Number(opts.insetCm), 2, 40)
                : clamp(Math.min(inRow, betweenRow) * 0.45, 5, 16);

            const segs = [];
            let totalLen = 0;
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i];
                const b = poly[(i + 1) % poly.length];
                const len = Math.hypot(b.x - a.x, b.y - a.y);
                if (len > 1e-4) {
                    segs.push({ a: a, b: b, len: len, startLen: totalLen, endLen: totalLen + len });
                    totalLen += len;
                }
            }

            const borderPts = [];
            if (totalLen > 0) {
                const step = inRow;
                let segIdx = 0;
                for (let d = step * 0.5; d < totalLen; d += step) {
                    while (segIdx < segs.length - 1 && segs[segIdx].endLen < d) {
                        segIdx++;
                    }
                    const s = segs[segIdx];
                    const t = clamp((d - s.startLen) / s.len, 0, 1);
                    const px = s.a.x + t * (s.b.x - s.a.x);
                    const py = s.a.y + t * (s.b.y - s.a.y);
                    const tx = (s.b.x - s.a.x) / s.len;
                    const ty = (s.b.y - s.a.y) / s.len;
                    const nx = -ty * normalSign;
                    const ny = tx * normalSign;

                    let qx = px + nx * insetDist;
                    let qy = py + ny * insetDist;
                    if (!isPointInPolygon(qx, qy, poly)) {
                        qx = px + nx * (insetDist * 0.45);
                        qy = py + ny * (insetDist * 0.45);
                    }
                    if (!isPointInPolygon(qx, qy, poly)) {
                        qx = px + nx * 1.5;
                        qy = py + ny * 1.5;
                    }
                    if (isPointInPolygon(qx, qy, poly)) {
                        const tooClose = borderPts.some(function (prev) {
                            return Math.hypot(prev.x - qx, prev.y - qy) < step * 0.55;
                        });
                        if (!tooClose) {
                            borderPts.push({ x: +qx.toFixed(1), y: +qy.toFixed(1) });
                        }
                    }
                }
            }

            const stripWidthM = clamp(betweenRow, 12, 30) / 100;
            const borderAreaM2 = +Math.min(geom.areaM2, geom.perimeterM * stripWidthM).toFixed(3);
            return {
                points: borderPts,
                count: borderPts.length,
                areaM2: borderAreaM2
            };
        }

        const isHorizontalBed = geom.widthCm >= geom.heightCm;
        const rowAxis = isHorizontalBed ? "y" : "x";
        const mainSpan = isHorizontalBed ? geom.widthCm : geom.heightCm;
        const crossSpan = isHorizontalBed ? geom.heightCm : geom.widthCm;

        let rawShare = Number(opts.sharePct ?? opts.interplantSharePct ?? 0.5);
        if (!Number.isFinite(rawShare) || rawShare <= 0) rawShare = 0.5;
        if (rawShare > 1) rawShare = rawShare / 100;
        const share = clamp(rawShare, 0.15, 0.85);
        const laneIndex = Math.max(0, Math.round(Number(opts.laneIndex ?? 0)));

        let bandStart = 0;
        let bandEnd = 1;
        if (plantMode === "lanes") {
            if (opts.laneStartPct !== undefined && Number.isFinite(Number(opts.laneStartPct))) {
                const rs = Number(opts.laneStartPct) > 1 ? Number(opts.laneStartPct) / 100 : Number(opts.laneStartPct);
                bandStart = clamp(rs, 0, Math.max(0, 1 - share));
                bandEnd = clamp(bandStart + share, bandStart + 0.05, 1);
            } else if (laneIndex === 0) {
                bandStart = 0;
                bandEnd = share;
            } else if (laneIndex === 1) {
                bandStart = clamp(1 - share, 0, 1);
                bandEnd = 1;
            } else {
                bandStart = clamp((laneIndex * share) % 1, 0, Math.max(0, 1 - share));
                bandEnd = Math.min(1, bandStart + share);
            }
        }

        const rowStep = plantMode === "understory"
            ? betweenRow / 0.85
            : (plantMode === "relay" ? betweenRow * 1.5 : betweenRow);
        const colStep = inRow;
        const phaseCol = (plantMode === "understory" || plantMode === "relay") ? colStep * 0.5 : 0;
        const phaseRow = plantMode === "relay" ? betweenRow * 0.5 : (plantMode === "understory" ? rowStep * 0.25 : 0);

        function sampleGrid(marginCm) {
            const pts = [];
            const crossStart = marginCm + Math.min(rowStep * 0.5, crossSpan * 0.25) + phaseRow;
            const mainStart = marginCm + Math.min(colStep * 0.5, mainSpan * 0.25) + phaseCol;

            for (let c = crossStart; c <= crossSpan - marginCm + 0.01; c += rowStep) {
                for (let m = mainStart; m <= mainSpan - marginCm + 0.01; m += colStep) {
                    const x = isHorizontalBed ? m : c;
                    const y = isHorizontalBed ? c : m;
                    if (!isPointInPolygon(x, y, poly)) continue;
                    if (marginCm > 0 && pointToPolylineDistance(x, y, poly) < marginCm - 0.1) continue;

                    if (plantMode === "lanes") {
                        const slice = getPolygonSliceAtAxis(poly, isHorizontalBed ? x : y, rowAxis);
                        if (!slice || slice.max - slice.min <= 1e-4) continue;
                        const u = (c - slice.min) / (slice.max - slice.min);
                        if (bandStart > 0.001 && u < bandStart + 1e-4) continue;
                        if (bandStart <= 0.001 && u < -1e-4) continue;
                        if (bandEnd < 0.999 && u >= bandEnd - 1e-4) continue;
                        if (bandEnd >= 0.999 && u > 1 + 1e-4) continue;
                    }
                    pts.push({ x: +x.toFixed(1), y: +y.toFixed(1) });
                }
            }
            return pts;
        }

        let points = sampleGrid(baseMargin);
        if (points.length === 0 && baseMargin > 2) {
            points = sampleGrid(Math.min(2, baseMargin * 0.25));
        }
        if (points.length === 0 && plantMode === "lanes") {
            const uMid = (bandStart + bandEnd) * 0.5;
            const mainStart = Math.min(2, baseMargin) + Math.min(colStep * 0.5, mainSpan * 0.25);
            for (let m = mainStart; m <= mainSpan - 2; m += colStep) {
                const slice = getPolygonSliceAtAxis(poly, m, rowAxis);
                if (!slice || slice.max - slice.min <= 1e-4) continue;
                const c = slice.min + uMid * (slice.max - slice.min);
                const x = isHorizontalBed ? m : c;
                const y = isHorizontalBed ? c : m;
                if (isPointInPolygon(x, y, poly)) {
                    points.push({ x: +x.toFixed(1), y: +y.toFixed(1) });
                }
            }
        }
        if (points.length === 0) {
            if (isPointInPolygon(geom.cx, geom.cy, poly)) {
                points.push({ x: +geom.cx.toFixed(1), y: +geom.cy.toFixed(1) });
            } else {
                const midMain = mainSpan * 0.5;
                const slice = getPolygonSliceAtAxis(poly, midMain, rowAxis);
                if (slice) {
                    const midCross = (slice.min + slice.max) * 0.5;
                    const x = isHorizontalBed ? midMain : midCross;
                    const y = isHorizontalBed ? midCross : midMain;
                    if (isPointInPolygon(x, y, poly)) {
                        points.push({ x: +x.toFixed(1), y: +y.toFixed(1) });
                    }
                }
            }
        }

        const areaFactor = plantMode === "lanes"
            ? share
            : (plantMode === "understory" ? 0.85 : (plantMode === "relay" ? 0.5 : 1));
        return {
            points: points,
            count: points.length,
            areaM2: +(geom.areaM2 * areaFactor).toFixed(3)
        };
    }

    function listCustomShapes() {
        try {
            if (!global.localStorage) return [];
            const raw = global.localStorage.getItem(CUSTOM_SHAPES_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            const valid = [];
            parsed.forEach(function (item) {
                const norm = validateAndNormalizeCustomShape(item);
                if (norm) valid.push(norm);
            });
            valid.sort(function (a, b) {
                return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
            });
            return valid;
        } catch (_) {
            return [];
        }
    }

    function saveCustomShape(shape) {
        const norm = validateAndNormalizeCustomShape(shape);
        if (!norm) return null;
        norm.updatedAt = new Date().toISOString();
        if (!norm.createdAt) norm.createdAt = norm.updatedAt;

        const existing = listCustomShapes().filter(function (s) { return s.id !== norm.id; });
        existing.unshift(norm);
        try {
            if (global.localStorage) {
                global.localStorage.setItem(CUSTOM_SHAPES_STORAGE_KEY, JSON.stringify(existing));
            }
        } catch (_) {}
        return norm;
    }

    function deleteCustomShape(shapeId) {
        if (!shapeId) return false;
        const list = listCustomShapes();
        const next = list.filter(function (s) { return s.id !== shapeId; });
        if (next.length === list.length) return false;
        try {
            if (global.localStorage) {
                global.localStorage.setItem(CUSTOM_SHAPES_STORAGE_KEY, JSON.stringify(next));
            }
        } catch (_) {}
        return {
            deleted: true,
            remainingCount: next.length
        };
    }

    function exportCustomShapeJson(shape) {
        const norm = validateAndNormalizeCustomShape(shape);
        if (!norm) return "";
        return JSON.stringify(norm, null, 2);
    }

    function importCustomShapeJson(jsonText) {
        if (!jsonText) return null;
        try {
            const parsed = typeof jsonText === "string" ? JSON.parse(jsonText) : jsonText;
            if (!parsed || typeof parsed !== "object") return null;
            if (parsed.format && parsed.format !== CUSTOM_SHAPE_FORMAT) return null;
            return validateAndNormalizeCustomShape(parsed);
        } catch (_) {
            return null;
        }
    }

    function escapeXmlText(str) {
        return String(str === null || str === undefined ? "" : str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    function exportCustomShapeSvg(shape) {
        const norm = validateAndNormalizeCustomShape(shape);
        if (!norm) return "";
        const geom = computeCustomShapeGeometry(norm);
        if (!geom) return "";

        const padX = 48;
        const padTop = 52;
        const padBottom = 68;
        const vbW = Math.max(320, Math.ceil(geom.widthCm + padX * 2));
        const vbH = Math.max(240, Math.ceil(geom.heightCm + padTop + padBottom));
        const offsetX = (vbW - geom.widthCm) / 2;
        const offsetY = padTop;
        const gridStep = norm.gridStepCm || 25;
        const patId = "wcppBlueprintGrid";
        const unitLabel = norm.units === "imperial"
            ? (formatLength(geom.widthCm / 100, "imperial") + " × " + formatLength(geom.heightCm / 100, "imperial"))
            : (formatCleanNum(geom.widthCm, 0) + " × " + formatCleanNum(geom.heightCm, 0) + " cm");
        const areaText = norm.units === "imperial"
            ? (geom.areaFt2 + " ft² (" + geom.areaM2 + " m²)")
            : (geom.areaM2 + " m² (" + geom.areaFt2 + " ft²)");
        const perimText = norm.units === "imperial"
            ? (geom.perimeterFt + " ft (" + geom.perimeterM + " m)")
            : (geom.perimeterM + " m (" + geom.perimeterFt + " ft)");

        let edgeLabelsSvg = "";
        geom.edges.forEach(function (edge) {
            const lbl = norm.units === "imperial"
                ? formatSpacing(edge.lengthCm, "imperial")
                : (formatCleanNum(edge.lengthCm, 0) + " cm");
            edgeLabelsSvg += '<text x="' + roundCoordCm(offsetX + edge.midX) + '" y="' + roundCoordCm(offsetY + edge.midY - 6) +
                '" font-size="10" font-family="system-ui, sans-serif" font-weight="600" text-anchor="middle" fill="#14532d" stroke="#f8fafc" stroke-width="2.5" paint-order="stroke">' +
                escapeXmlText(lbl) + "</text>";
        });

        let verticesSvg = "";
        norm.points.forEach(function (pt, idx) {
            const vx = roundCoordCm(offsetX + pt.x);
            const vy = roundCoordCm(offsetY + pt.y);
            verticesSvg += '<circle cx="' + vx + '" cy="' + vy + '" r="3.5" fill="#15803d" stroke="#ffffff" stroke-width="1.2"/>';
            if (geom.anglesDeg[idx] !== undefined) {
                verticesSvg += '<text x="' + (vx + 6) + '" y="' + (vy - 5) +
                    '" font-size="8.5" font-family="system-ui, sans-serif" fill="#475569">' +
                    geom.anglesDeg[idx] + "°</text>";
            }
        });

        return '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vbW + " " + vbH + '" width="' + vbW + '" height="' + vbH + '">\n' +
            "  <defs>\n" +
            '    <pattern id="' + patId + '" width="' + gridStep + '" height="' + gridStep + '" patternUnits="userSpaceOnUse">\n' +
            '      <path d="M ' + gridStep + ' 0 L 0 0 0 ' + gridStep + '" fill="none" stroke="#dbeafe" stroke-width="0.7"/>\n' +
            "    </pattern>\n" +
            "  </defs>\n" +
            '  <rect x="0" y="0" width="' + vbW + '" height="' + vbH + '" fill="#f8fafc"/>\n' +
            '  <rect x="10" y="10" width="' + (vbW - 20) + '" height="' + (vbH - 20) + '" fill="url(#' + patId + ')" stroke="#1e293b" stroke-width="1.4" rx="4"/>\n' +
            '  <text x="20" y="30" font-size="13" font-family="system-ui, sans-serif" font-weight="700" fill="#0f172a">' + escapeXmlText(norm.name) + " — Bed Blueprint</text>\n" +
            '  <text x="' + (vbW - 20) + '" y="30" font-size="10.5" font-family="system-ui, sans-serif" text-anchor="end" fill="#475569">Grid: ' + gridStep + " cm</text>\n" +
            '  <g transform="translate(' + roundCoordCm(offsetX) + "," + roundCoordCm(offsetY) + ')">\n' +
            '    <path d="' + geom.pathD + '" fill="#dcfce7" fill-opacity="0.78" stroke="#15803d" stroke-width="2.2" stroke-linejoin="round"/>\n' +
            "  </g>\n" +
            "  " + edgeLabelsSvg + "\n" +
            "  " + verticesSvg + "\n" +
            '  <rect x="10" y="' + (vbH - 50) + '" width="' + (vbW - 20) + '" height="40" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>\n' +
            '  <text x="20" y="' + (vbH - 33) + '" font-size="10.5" font-family="system-ui, sans-serif" font-weight="600" fill="#0f172a">Area: ' + escapeXmlText(areaText) + "  |  Perimeter: " + escapeXmlText(perimText) + "</text>\n" +
            '  <text x="20" y="' + (vbH - 18) + '" font-size="9.5" font-family="system-ui, sans-serif" fill="#475569">Bounds: ' + escapeXmlText(unitLabel) + "  |  West Coast Plant Project · Garden Bed Designer</text>\n" +
            "</svg>";
    }

    function createCustomShapeBlock(shape, options) {
        const norm = validateAndNormalizeCustomShape(shape);
        if (!norm) return null;
        const geom = computeCustomShapeGeometry(norm);
        if (!geom) return null;
        const opts = (options && typeof options === "object") ? options : {};
        const rawType = String(opts.type || "").toLowerCase();
        const type = BLOCK_TYPES.indexOf(rawType) !== -1
            ? rawType
            : (opts.isGreenhouse ? "greenhouse" : "field");
        const cSpec = opts.containerSpec ? normalizeContainerSpec(opts.containerSpec, type) : null;
        const gMedia = opts.growingMedia ? normalizeGrowingMedia(opts.growingMedia, type) : null;
        const out = {
            id: (typeof opts.id === "string" && opts.id.trim()) ? opts.id.trim() : generateId("block"),
            name: (typeof opts.name === "string" && opts.name.trim()) ? opts.name.trim() : norm.name,
            type: type,
            shapeType: "custom",
            customShape: norm,
            containerSpec: cSpec,
            growingMedia: gMedia,
            bedCount: 1,
            bedLengthM: Math.max(0.5, +(geom.widthCm / 100).toFixed(2)),
            bedWidthCm: Math.max(20, +geom.heightCm.toFixed(1)),
            areaM2: geom.areaM2,
            pathWidthCm: Math.max(10, Number(opts.pathWidthCm ?? 30)),
            angleDeg: Number.isFinite(Number(opts.angleDeg)) ? Number(opts.angleDeg) : 0,
            beginningYear: Number.isFinite(Number(opts.beginningYear)) ? Number(opts.beginningYear) : 2025,
            isFallow: Boolean(opts.isFallow),
            x: Number.isFinite(Number(opts.x)) ? Number(opts.x) : 40,
            y: Number.isFinite(Number(opts.y)) ? Number(opts.y) : 40
        };
        if (cSpec && cSpec.depthCm > 0) {
            out.volumeLiters = +((geom.areaM2 * 10000 * cSpec.depthCm) / 1000).toFixed(1);
        }
        return out;
    }

    // =========================================================================
    // 2C. CONTAINERS, GROWING MEDIA & PLAYGROUND ENGINE (V4)
    // =========================================================================
    function isContainerBlockType(type) {
        return CONTAINER_BLOCK_TYPES.has(String(type || "").toLowerCase());
    }

    function getDefaultContainerPreset(blockType) {
        const t = String(blockType || "pot").toLowerCase();
        if (t === "basket") return CONTAINER_PRESETS.find(function (p) { return p.id === "basket-12in"; }) || CONTAINER_PRESETS[5];
        if (t === "bench") return CONTAINER_PRESETS.find(function (p) { return p.id === "bench-6x3"; }) || CONTAINER_PRESETS[9];
        return CONTAINER_PRESETS.find(function (p) { return p.id === "pot-12in-std"; }) || CONTAINER_PRESETS[1];
    }

    function getDefaultMediaPresetForBlockType(blockType) {
        const t = String(blockType || "field").toLowerCase();
        if (t === "basket") return "hanging-ultralight";
        if (t === "pot") return "airy-container";
        if (t === "bench") return "mels-mix";
        return "raised-bed-loam";
    }

    function computeContainerGeometry(spec, blockType) {
        const s = (spec && typeof spec === "object") ? spec : {};
        const inferredType = String(blockType || s.blockType || (s.shapeKind === "rectangle" ? "bench" : "pot")).toLowerCase();
        const presetId = s.presetId || s.p || null;
        const preset = presetId ? CONTAINER_PRESETS.find(function (p) { return p.id === presetId; }) : null;
        const defPreset = preset || getDefaultContainerPreset(inferredType);

        const rawShape = s.shapeKind || s.s || (preset ? preset.shapeKind : null);
        let shapeKind;
        if (rawShape === "circle" || rawShape === "rectangle") {
            shapeKind = rawShape;
        } else if ((s.widthCm || s.w || s.lengthCm || s.l) && !(s.diameterCm || s.d)) {
            shapeKind = "rectangle";
        } else if (s.diameterCm || s.d) {
            shapeKind = "circle";
        } else {
            shapeKind = defPreset.shapeKind || (inferredType === "bench" ? "rectangle" : "circle");
        }

        const rawDepth = s.depthCm ?? s.h ?? defPreset.depthCm ?? 25;
        const depthCm = +clamp(Number(rawDepth) || 25, 6, 200).toFixed(2);
        const rawFactor = s.bowlFactor ?? s.f;
        const bowlFactor = Number.isFinite(Number(rawFactor)) && Number(rawFactor) > 0
            ? +clamp(Number(rawFactor), 0.5, 1.0).toFixed(2)
            : (inferredType === "basket" ? 0.85 : 1.0);

        let diameterCm = null;
        let widthCm = 0;
        let lengthCm = 0;
        let surfaceAreaCm2 = 0;

        if (shapeKind === "circle") {
            const rawDiam = s.diameterCm ?? s.d ?? s.widthCm ?? s.w ?? defPreset.diameterCm ?? 30.48;
            diameterCm = +clamp(Number(rawDiam) || 30.48, 8, 500).toFixed(2);
            widthCm = diameterCm;
            lengthCm = diameterCm;
            const r = diameterCm / 2;
            surfaceAreaCm2 = Math.PI * r * r;
        } else {
            const rawW = s.widthCm ?? s.w ?? defPreset.widthCm ?? 30;
            const rawL = s.lengthCm ?? s.l ?? defPreset.lengthCm ?? 75;
            widthCm = +clamp(Number(rawW) || 30, 8, 1000).toFixed(2);
            lengthCm = +clamp(Number(rawL) || 75, 8, 5000).toFixed(2);
            surfaceAreaCm2 = widthCm * lengthCm;
        }

        const surfaceAreaM2 = +(surfaceAreaCm2 / 10000).toFixed(4);
        const surfaceAreaFt2 = +((surfaceAreaCm2 / SQ_FT_CM2)).toFixed(2);
        const rawVolumeL = (surfaceAreaCm2 * depthCm * bowlFactor) / 1000;
        const volumeLiters = +rawVolumeL.toFixed(1);
        const volumeGallons = +(rawVolumeL / LITERS_PER_US_GALLON).toFixed(2);

        return {
            presetId: preset ? preset.id : (presetId || null),
            blockType: inferredType,
            shapeKind: shapeKind,
            diameterCm: diameterCm,
            widthCm: widthCm,
            lengthCm: lengthCm,
            depthCm: depthCm,
            bowlFactor: bowlFactor,
            surfaceAreaCm2: +surfaceAreaCm2.toFixed(1),
            surfaceAreaM2: surfaceAreaM2,
            surfaceAreaFt2: surfaceAreaFt2,
            volumeLiters: volumeLiters,
            volumeGallons: volumeGallons
        };
    }

    function normalizeContainerSpec(spec, blockType, fallbackBlock) {
        const s = (spec && typeof spec === "object") ? spec : {};
        const fb = (fallbackBlock && typeof fallbackBlock === "object") ? fallbackBlock : {};
        const merged = {
            presetId: s.presetId ?? s.p ?? null,
            shapeKind: s.shapeKind ?? s.s ?? (fb.shapeType === "circle" ? "circle" : undefined),
            diameterCm: s.diameterCm ?? s.d,
            widthCm: s.widthCm ?? s.w ?? (fb.bedWidthCm ? Number(fb.bedWidthCm) : undefined),
            lengthCm: s.lengthCm ?? s.l ?? (fb.bedLengthM ? Number(fb.bedLengthM) * 100 : undefined),
            depthCm: s.depthCm ?? s.h,
            bowlFactor: s.bowlFactor ?? s.f
        };
        const geom = computeContainerGeometry(merged, blockType);
        return {
            presetId: geom.presetId,
            shapeKind: geom.shapeKind,
            diameterCm: geom.diameterCm,
            widthCm: geom.widthCm,
            lengthCm: geom.lengthCm,
            depthCm: geom.depthCm,
            bowlFactor: geom.bowlFactor
        };
    }

    function normalizeMediaIngredientsArray(rawList) {
        if (!Array.isArray(rawList)) return [];
        const byId = new Map();
        rawList.forEach(function (item) {
            if (!item) return;
            let id;
            let pct;
            if (Array.isArray(item)) {
                id = String(item[0] || "").trim().toLowerCase();
                pct = Number(item[1]);
            } else if (typeof item === "object") {
                id = String(item.id || item.ingredientId || "").trim().toLowerCase();
                pct = Number(item.pct ?? item.percent ?? item.share ?? 0);
            } else {
                return;
            }
            if (!id || !GROWING_MEDIA_BY_ID.has(id)) return;
            const cleanPct = Number.isFinite(pct) ? clamp(+pct.toFixed(1), 0, 100) : 0;
            byId.set(id, +clamp((byId.get(id) || 0) + cleanPct, 0, 100).toFixed(1));
        });
        const out = [];
        byId.forEach(function (pct, id) {
            out.push({ id: id, pct: pct });
        });
        return out;
    }

    function normalizeGrowingMedia(rawMedia, blockType) {
        const defPresetId = getDefaultMediaPresetForBlockType(blockType);
        if (!rawMedia) {
            const p = GROWING_MEDIA_PRESETS_BY_ID.get(defPresetId) || GROWING_MEDIA_PRESETS[0];
            return {
                presetId: p.id,
                name: p.name,
                ingredients: p.ingredients.map(function (it) { return { id: it.id, pct: it.pct }; }),
                notes: ""
            };
        }
        if (typeof rawMedia === "string") {
            const p = GROWING_MEDIA_PRESETS_BY_ID.get(rawMedia.trim()) || GROWING_MEDIA_PRESETS_BY_ID.get(defPresetId) || GROWING_MEDIA_PRESETS[0];
            return {
                presetId: p.id,
                name: p.name,
                ingredients: p.ingredients.map(function (it) { return { id: it.id, pct: it.pct }; }),
                notes: ""
            };
        }
        if (Array.isArray(rawMedia)) {
            const ings = normalizeMediaIngredientsArray(rawMedia);
            if (ings.length === 0) return normalizeGrowingMedia(defPresetId, blockType);
            return {
                presetId: "custom",
                name: "Custom Mix",
                ingredients: ings,
                notes: ""
            };
        }
        const presetId = rawMedia.presetId || rawMedia.p || "custom";
        const presetObj = GROWING_MEDIA_PRESETS_BY_ID.get(presetId) || null;
        const rawIngs = rawMedia.ingredients || rawMedia.i;
        let ings = normalizeMediaIngredientsArray(rawIngs);
        if (ings.length === 0) {
            const fbPreset = presetObj || GROWING_MEDIA_PRESETS_BY_ID.get(defPresetId) || GROWING_MEDIA_PRESETS[0];
            ings = fbPreset.ingredients.map(function (it) { return { id: it.id, pct: it.pct }; });
        }
        const name = (typeof (rawMedia.name ?? rawMedia.n) === "string" && String(rawMedia.name ?? rawMedia.n).trim())
            ? String(rawMedia.name ?? rawMedia.n).trim()
            : (presetObj ? presetObj.name : "Custom Mix");
        return {
            presetId: presetObj ? presetObj.id : "custom",
            name: name,
            ingredients: ings,
            notes: typeof rawMedia.notes === "string" ? rawMedia.notes.trim() : ""
        };
    }

    function balanceGrowingMediaPct(ingredients) {
        const isMediaObj = Boolean(ingredients && !Array.isArray(ingredients) && Array.isArray(ingredients.ingredients));
        const rawArr = isMediaObj ? ingredients.ingredients : ingredients;
        const clean = normalizeMediaIngredientsArray(rawArr);
        if (clean.length === 0) {
            return isMediaObj
                ? Object.assign({}, ingredients, { ingredients: [] })
                : [];
        }

        const total = clean.reduce(function (sum, item) { return sum + item.pct; }, 0);
        const n = clean.length;
        const out = [];

        if (total <= 0) {
            const base = Math.floor(100 / n);
            let rem = 100 - base * n;
            for (let i = 0; i < n; i++) {
                out.push({ id: clean[i].id, pct: base + (rem > 0 ? 1 : 0) });
                if (rem > 0) rem -= 1;
            }
        } else {
            const items = clean.map(function (item, idx) {
                const exact = (item.pct / total) * 100;
                const fl = Math.floor(exact);
                return { id: item.id, idx: idx, floor: fl, frac: exact - fl };
            });
            let floorSum = items.reduce(function (s, it) { return s + it.floor; }, 0);
            const needed = 100 - floorSum;
            const byRem = items.slice().sort(function (a, b) {
                if (Math.abs(b.frac - a.frac) > 1e-9) return b.frac - a.frac;
                return a.idx - b.idx;
            });
            for (let i = 0; i < needed; i++) {
                byRem[i % byRem.length].floor += 1;
            }
            items.sort(function (a, b) { return a.idx - b.idx; });
            items.forEach(function (it) {
                out.push({ id: it.id, pct: it.floor });
            });
        }

        if (isMediaObj) {
            return Object.assign({}, normalizeGrowingMedia(ingredients), { ingredients: out });
        }
        return out;
    }

    function analyzeGrowingMedia(media, blockType, cropsInBlock, volumeLiters) {
        const bType = String(blockType || "pot").toLowerCase();
        const norm = normalizeGrowingMedia(media, bType);
        const volL = Math.max(0, Number(volumeLiters) || 0);

        let totalPctRaw = 0;
        let aerSum = 0;
        let retSum = 0;
        let nutSum = 0;
        let weightSum = 0;
        let loamPct = 0;
        let sandPct = 0;
        let acidPct = 0;
        let perlitePumicePct = 0;

        const ingredientVolumesL = [];
        norm.ingredients.forEach(function (item) {
            const def = GROWING_MEDIA_BY_ID.get(item.id);
            if (!def) return;
            const pct = Number(item.pct) || 0;
            totalPctRaw += pct;
            aerSum += pct * def.aeration;
            retSum += pct * def.retention;
            nutSum += pct * def.nutrition;
            weightSum += pct * def.weight;
            if (item.id === "garden-loam") loamPct += pct;
            if (item.id === "coarse-sand") sandPct += pct;
            if (item.id === "peat-moss" || item.id === "pine-bark") acidPct += pct;
            if (item.id === "perlite" || item.id === "pumice") perlitePumicePct += pct;

            ingredientVolumesL.push({
                id: item.id,
                label: def.label,
                pct: pct,
                liters: volL > 0 ? +((pct / 100) * volL).toFixed(2) : 0
            });
        });

        const totalPct = +totalPctRaw.toFixed(1);
        const isBalanced = Math.abs(totalPct - 100) < 0.05;
        const denom = totalPctRaw > 0 ? totalPctRaw : 1;
        const aerationScore = totalPctRaw > 0 ? Math.round(aerSum / denom) : 0;
        const retentionScore = totalPctRaw > 0 ? Math.round(retSum / denom) : 0;
        const nutrientScore = totalPctRaw > 0 ? Math.round(nutSum / denom) : 0;
        const weightScore = totalPctRaw > 0 ? Math.round(weightSum / denom) : 0;

        let drainageLabel = "Balanced Moisture & Drainage";
        if (aerationScore >= 75) drainageLabel = "Fast-Draining / Gritty";
        else if (aerationScore >= 58) drainageLabel = "Well-Drained & Aerated";
        else if (aerationScore < 42) drainageLabel = "Dense / Moisture-Retentive";

        let weightRating = "Moderate";
        if (weightScore <= 35) weightRating = "Ultralight";
        else if (weightScore <= 48) weightRating = "Light";
        else if (weightScore > 65) weightRating = "Heavy";

        const warnings = [];
        if (!isBalanced) {
            warnings.push("Ingredient shares total " + totalPct + "% (target 100%) — use Auto-Balance 100% to scale proportionally.");
        }
        const loamShare = totalPctRaw > 0 ? (loamPct / totalPctRaw) * 100 : 0;
        const mineralShare = totalPctRaw > 0 ? ((loamPct + sandPct) / totalPctRaw) * 100 : 0;
        if (bType === "basket" && loamPct > 20) {
            warnings.push("Heavy garden-loam (" + +loamPct.toFixed(1) + "% > 20%) is too heavy for a hanging basket and risks compaction or bracket strain.");
        } else if (bType === "basket" && (weightScore > 62 || mineralShare > 35)) {
            warnings.push("Heavy hanging basket blend (" + weightRating + "): swap dense mineral soil for coco coir, perlite, and vermiculite.");
        } else if (bType === "pot" && loamShare > 40) {
            warnings.push("High garden-loam (> 40%) in pots compacts easily and slows drainage; blend more perlite, bark, or coir.");
        }
        if ((bType === "pot" || bType === "basket") && aerationScore < 42 && totalPctRaw > 0) {
            warnings.push("Low aeration (" + aerationScore + "/100): add perlite, pumice, or aged pine bark fines to protect container roots.");
        }
        if (bType === "basket" && retentionScore < 38 && totalPctRaw > 0) {
            warnings.push("Low water retention (" + retentionScore + "/100): hanging baskets dry rapidly in sun and wind — add coco coir or vermiculite.");
        }
        if (nutrientScore < 20 && totalPctRaw > 0 && norm.presetId !== "seed-starting") {
            warnings.push("Low baseline nutrients (" + nutrientScore + "/100): incorporate compost, worm castings, or gentle organic fertilizer.");
        }

        const cropFitNotes = [];
        const seenCrops = new Set();
        const cat = _cachedCatalog;
        const cropList = Array.isArray(cropsInBlock) ? cropsInBlock : [];
        let hasHeavyFeeder = false;
        let hasRootCrop = false;
        let hasAcidLover = false;
        let hasWellDrainedCrop = false;
        let hasNativeCrop = false;

        cropList.forEach(function (entry) {
            const rawName = typeof entry === "string"
                ? entry
                : ((entry && (entry.cropName || entry.name)) || "");
            if (!rawName) return;
            const resolved = (entry && typeof entry === "object" && entry.family && entry.name)
                ? entry
                : (cat && cat.cropMap ? resolveCrop(cat.cropMap, rawName) : null);
            const cName = resolved ? resolved.name : rawName;
            const key = normalizeKey(cName);
            if (!key || seenCrops.has(key)) return;
            seenCrops.add(key);

            const fam = (resolved && resolved.family) || "";
            const nut = (resolved && resolved.nutrientDemand) || "Medium";
            const drainStr = String((resolved && (resolved.Drainage || resolved["Drainage"])) || "").toLowerCase();
            const soilStr = String((resolved && (resolved["Suitable Soil"] || resolved.Moisture_Tags)) || "").toLowerCase();
            const cCat = (resolved && resolved.category) || "";

            if (nut === "Heavy") hasHeavyFeeder = true;
            if (cCat === "Root" || /\b(carrot|parsnip|beet|radish|turnip)\b/i.test(cName)) hasRootCrop = true;
            if (/\b(blueberry|cranberry|huckleberry|salal|rhododendron|azalea)\b/i.test(cName) ||
                (resolved && String(resolved.Mycorrhizal_Association || "").toLowerCase().includes("ericoid"))) {
                hasAcidLover = true;
            }
            if (drainStr.includes("well-drained") || soilStr.includes("dry") || /\b(rosemary|thyme|lavender|oregano|sage)\b/i.test(cName)) {
                hasWellDrainedCrop = true;
            }
            if (resolved && resolved.isNativeBC) hasNativeCrop = true;
            if (fam === "Solanaceae" && bType === "basket" && !/cherry|tumbling|patio/i.test(cName)) {
                cropFitNotes.push(cName + " needs generous root volume and steady moisture in containers.");
            }
        });

        if (hasHeavyFeeder && nutrientScore < 40) {
            cropFitNotes.push("Heavy-feeding crops present — boost compost/worm castings (>= 25%) or side-dress biweekly.");
        } else if (hasHeavyFeeder && nutrientScore >= 40) {
            cropFitNotes.push("Nutrient richness (" + nutrientScore + "/100) supports heavy-feeding crops.");
        }
        if (hasRootCrop && (loamShare > 40 || aerationScore < 50)) {
            cropFitNotes.push("Root crops need loose, stone-free, high-aeration media (" + aerationScore + "/100) to avoid forking.");
        }
        if (hasWellDrainedCrop && aerationScore < 55) {
            cropFitNotes.push("Mediterranean herbs / well-drained crops prefer >= 55 aeration (add perlite or pumice).");
        } else if (hasWellDrainedCrop && perlitePumicePct >= 20) {
            cropFitNotes.push("Good mineral drainage for herbs and well-drained perennials.");
        }
        if (hasAcidLover) {
            if (acidPct >= 25) {
                cropFitNotes.push("Acidic peat/pine-bark base (" + +acidPct.toFixed(0) + "%) supports acid-loving ericoid roots.");
            } else {
                cropFitNotes.push("Acid-loving berries prefer >= 30% sphagnum peat moss or aged pine bark fines.");
            }
        }
        if (hasNativeCrop && norm.presetId === "pnw-native-grit") {
            cropFitNotes.push("Woodland leaf-mold & grit profile matches Coastal BC native soil biology.");
        }
        if (cropFitNotes.length === 0 && seenCrops.size > 0 && warnings.length === 0) {
            cropFitNotes.push("Media profile (" + drainageLabel + ", " + weightRating + ") is well matched to crops in this container.");
        }

        return {
            presetId: norm.presetId,
            name: norm.name,
            totalPct: totalPct,
            isBalanced: isBalanced,
            aerationScore: aerationScore,
            retentionScore: retentionScore,
            nutrientScore: nutrientScore,
            weightScore: weightScore,
            drainageLabel: drainageLabel,
            weightRating: weightRating,
            warnings: warnings,
            ingredientVolumesL: ingredientVolumesL,
            cropFitNotes: cropFitNotes
        };
    }

    function createContainerBlock(opts) {
        const o = (opts && typeof opts === "object") ? opts : {};
        const rawType = String(o.type || o.blockType || "pot").toLowerCase();
        const blockType = isContainerBlockType(rawType) ? rawType : "pot";
        const specIn = Object.assign({}, o.containerSpec || {});
        if (o.presetId && !specIn.presetId) specIn.presetId = o.presetId;
        if (o.shapeKind && !specIn.shapeKind) specIn.shapeKind = o.shapeKind;
        if (o.diameterCm !== undefined && specIn.diameterCm === undefined) specIn.diameterCm = o.diameterCm;
        if (o.widthCm !== undefined && specIn.widthCm === undefined) specIn.widthCm = o.widthCm;
        if (o.lengthCm !== undefined && specIn.lengthCm === undefined) specIn.lengthCm = o.lengthCm;
        if (o.depthCm !== undefined && specIn.depthCm === undefined) specIn.depthCm = o.depthCm;
        if (o.bowlFactor !== undefined && specIn.bowlFactor === undefined) specIn.bowlFactor = o.bowlFactor;

        const presetObj = specIn.presetId
            ? CONTAINER_PRESETS.find(function (p) { return p.id === specIn.presetId; })
            : getDefaultContainerPreset(blockType);
        const containerSpec = normalizeContainerSpec(specIn, blockType);
        const geom = computeContainerGeometry(containerSpec, blockType);
        const rawMedia = o.growingMedia !== undefined
            ? o.growingMedia
            : (o.mediaPresetId || (presetObj && presetObj.defaultMediaPreset) || getDefaultMediaPresetForBlockType(blockType));
        const growingMedia = normalizeGrowingMedia(rawMedia, blockType);

        const defaultName = (presetObj && presetObj.name) ||
            (blockType === "basket" ? "Hanging Basket" : (blockType === "bench" ? "Growing Bench" : "Container Pot"));

        return {
            id: (typeof o.id === "string" && o.id.trim()) ? o.id.trim() : generateId("blk"),
            name: (typeof o.name === "string" && o.name.trim()) ? o.name.trim() : defaultName,
            type: blockType,
            shapeType: geom.shapeKind === "circle" ? "circle" : "rectangle",
            customShape: null,
            containerSpec: containerSpec,
            growingMedia: growingMedia,
            bedCount: 1,
            bedLengthM: +((geom.shapeKind === "circle" ? geom.diameterCm : geom.lengthCm) / 100).toFixed(3),
            bedWidthCm: +(geom.shapeKind === "circle" ? geom.diameterCm : geom.widthCm).toFixed(1),
            areaM2: geom.surfaceAreaM2,
            volumeLiters: geom.volumeLiters,
            pathWidthCm: Math.max(5, Number(o.pathWidthCm ?? 20)),
            angleDeg: Number.isFinite(Number(o.angleDeg)) ? Number(o.angleDeg) : 0,
            beginningYear: Number.isFinite(Number(o.beginningYear)) ? Number(o.beginningYear) : 2025,
            isFallow: Boolean(o.isFallow),
            x: Number.isFinite(Number(o.x)) ? Number(o.x) : 40,
            y: Number.isFinite(Number(o.y)) ? Number(o.y) : 40
        };
    }

    function estimateContainerRootDepthCm(crop, rootProf) {
        const nameKey = normalizeKey(crop && crop.name);
        const cat = (crop && crop.category) || "";
        const plantTags = String((crop && crop.Plant_Type_Tags) || "").toLowerCase();
        if (crop && crop.isNativeBC) {
            if (/tree|shrub/.test(plantTags)) return 55;
            if (/fern|grass|sedge|rush/.test(plantTags)) return 26;
        }
        if (/parsnip|daikon|alfalfa|horseradish|artichoke/.test(nameKey)) return 45;
        if (/tomato|tomatillo|pumpkin|winter squash|watermelon|corn|sunflower|okra|borage/.test(nameKey)) return 36;
        if (/carrot|salsify|rutabaga|potato|sweet potato|zucchini|squash|cucumber|melon|fava bean/.test(nameKey)) return 30;
        if (/pepper|eggplant|broccoli|cabbage|cauliflower|brussel|kale|collard|kohlrabi|fennel|celery|rosemary|lavender|sage|bush green bean|green bean|pea|snow pea|beet|swiss chard|chard/.test(nameKey)) return 24;
        if (/radish|lettuce|spinach|arugula|mizuna|mustard|asian greens|pak choi|bok choi|basil|cilantro|chive|thyme|oregano|mint|parsley|dill|strawberry|alyssum|marigold|nasturtium|calendula|chamomile|scallion|green onion|onion|garlic/.test(nameKey)) return 16;
        if (cat === "Flower" || cat === "Herb" || cat === "Leafy") return 18;
        if (rootProf && rootProf.rootStratum === "shallow") return 18;
        if (rootProf && rootProf.rootStratum === "deep") return 36;
        return 25;
    }

    function computeRecommendedDensity(cropOrName, catalogOpt, containerOpt) {
        const cat = catalogOpt || _cachedCatalog;
        let crop = null;
        if (cropOrName && typeof cropOrName === "object" && cropOrName.name) {
            crop = cropOrName;
        } else if (typeof cropOrName === "string" && cat && cat.cropMap) {
            crop = resolveCrop(cat.cropMap, cropOrName);
        }

        const c = crop || { name: typeof cropOrName === "string" ? cropOrName : "Plant", inRowCm: 25, betweenRowCm: 30, isEstimatedDefault: true };
        const dims = estimateCropDimensionsCm(c);
        const rootProf = parseRootProfile(c);
        const rootDepthCm = estimateContainerRootDepthCm(c, rootProf);

        let inRowCm = Number(c.inRowCm) > 0 ? Number(c.inRowCm) : 25;
        let betweenRowCm = Number(c.betweenRowCm) > 0 ? Number(c.betweenRowCm) : 30;
        let basisLabel = "Calibrated row spacing (" + formatCleanNum(inRowCm, 0) + " × " + formatCleanNum(betweenRowCm, 0) + " cm)";

        const hasExplicitSpread = Boolean(parseFirstNumber(c.Spread_Min_cm) || parseFirstNumber(c.Spread_Max_cm) || isMeaningful(c.Spread));
        const hasExplicitSpacing = Boolean(isMeaningful(c.Spacing));

        if (c.isEstimatedDefault) {
            if (hasExplicitSpacing) {
                const sp = parseDimensionStringToCm(c.Spacing);
                const sMid = (sp.min && sp.max) ? Math.round((sp.min + sp.max) / 2) : (sp.min || sp.max);
                if (sMid && sMid > 2) {
                    inRowCm = sMid;
                    betweenRowCm = sMid;
                    basisLabel = "Dataset spacing (" + sMid + " cm)";
                }
            } else if (c.isNativeBC && hasExplicitSpread) {
                const sp = Math.max(8, dims.spreadMidCm);
                inRowCm = sp;
                betweenRowCm = Math.max(8, Math.round(sp * 0.9));
                basisLabel = "BC native canopy spread (" + sp + " cm)";
            } else if (hasExplicitSpread) {
                const sp = Math.max(8, dims.spreadMidCm);
                inRowCm = sp;
                betweenRowCm = sp;
                basisLabel = "Horticultural spread (" + sp + " cm)";
            } else {
                basisLabel = "Category spacing estimate (" + formatCleanNum(inRowCm, 0) + " × " + formatCleanNum(betweenRowCm, 0) + " cm)";
            }
        }

        inRowCm = +clamp(inRowCm, 2, 300).toFixed(1);
        betweenRowCm = +clamp(betweenRowCm, 2, 300).toFixed(1);
        const eqDiam = Math.sqrt(inRowCm * betweenRowCm);
        const spreadCm = hasExplicitSpread && c.isEstimatedDefault
            ? +clamp(dims.spreadMidCm, 4, 350).toFixed(1)
            : +clamp(Math.max(eqDiam, Math.min(dims.spreadMidCm, eqDiam * 1.15)), 4, 300).toFixed(1);

        const plantAreaCm2 = +Math.max(4, inRowCm * betweenRowCm).toFixed(1);
        const rawPerSqFt = SQ_FT_CM2 / plantAreaCm2;
        const plantsPerSqFt = rawPerSqFt < 1
            ? +rawPerSqFt.toFixed(2)
            : +rawPerSqFt.toFixed(1);
        const plantsPerSqM = +(10000 / plantAreaCm2).toFixed(rawPerSqFt < 1 ? 1 : 0);
        const canopyRadiusCm = +clamp(Math.max(eqDiam * 0.48, Math.min(spreadCm * 0.5, eqDiam * 0.58)), 2.2, 85).toFixed(1);

        let containerSuitability = "Deep Planter / Raised Bed";
        if (rootDepthCm <= 20 && spreadCm <= 40) {
            containerSuitability = (c.Container_Suitability && String(c.Container_Suitability)) || "Container & Basket Friendly";
        } else if (rootDepthCm <= 26 && spreadCm <= 55) {
            containerSuitability = (c.Container_Suitability && String(c.Container_Suitability)) || "Container-friendly (10\"+ pot)";
        } else if (rootDepthCm <= 38 && spreadCm <= 85) {
            containerSuitability = "Deep Pot / Patio Barrel (" + rootDepthCm + "+ cm)";
        } else {
            containerSuitability = "Open Ground / Deep Bed Preferred";
        }

        let containerDepthCm = null;
        if (containerOpt !== null && containerOpt !== undefined) {
            if (typeof containerOpt === "number" && Number.isFinite(containerOpt)) {
                containerDepthCm = containerOpt;
            } else if (typeof containerOpt === "object") {
                const spec = containerOpt.containerSpec || containerOpt;
                if (Number.isFinite(Number(spec.depthCm)) && Number(spec.depthCm) > 0) {
                    containerDepthCm = Number(spec.depthCm);
                } else if (isContainerBlockType(containerOpt.type)) {
                    containerDepthCm = computeContainerGeometry(containerOpt.containerSpec || containerOpt, containerOpt.type).depthCm;
                }
            }
        }

        const depthWarning = (containerDepthCm !== null && rootDepthCm > containerDepthCm)
            ? ((c.name || "Crop") + " needs ~" + rootDepthCm + " cm root depth; container is " + formatCleanNum(containerDepthCm, 1) + " cm deep.")
            : null;

        return {
            cropName: c.name || "Plant",
            inRowCm: inRowCm,
            betweenRowCm: betweenRowCm,
            spreadCm: spreadCm,
            plantAreaCm2: plantAreaCm2,
            plantsPerSqFt: plantsPerSqFt,
            plantsPerSqM: plantsPerSqM,
            canopyRadiusCm: canopyRadiusCm,
            rootDepthCm: rootDepthCm,
            containerSuitability: containerSuitability,
            depthWarning: depthWarning,
            basisLabel: basisLabel,
            recommendedCountForArea: function (areaFt2) {
                const a = Number(areaFt2);
                if (!Number.isFinite(a) || a <= 0) return 0;
                return Math.max(1, Math.round(a * rawPerSqFt));
            }
        };
    }

    function getPlaygroundBounds(block) {
        const b = block || {};
        if (b.shapeType === "custom" && b.customShape) {
            const norm = validateAndNormalizeCustomShape(b.customShape);
            if (norm) {
                const geom = computeCustomShapeGeometry(norm);
                const poly = samplePointsOutline(norm.points, 20);
                const depthCm = (b.containerSpec && Number(b.containerSpec.depthCm) > 0) ? Number(b.containerSpec.depthCm) : null;
                return {
                    shapeKind: "custom",
                    widthCm: geom.widthCm,
                    heightCm: geom.heightCm,
                    radiusCm: +(Math.min(geom.widthCm, geom.heightCm) / 2).toFixed(2),
                    cx: geom.cx,
                    cy: geom.cy,
                    areaM2: geom.areaM2,
                    areaFt2: geom.areaFt2,
                    depthCm: depthCm,
                    customShape: norm,
                    pathD: geom.pathD,
                    poly: poly
                };
            }
        }

        const isContainer = isContainerBlockType(b.type) || Boolean(b.containerSpec);
        if (isContainer) {
            const geom = computeContainerGeometry(b.containerSpec || b, b.type || "pot");
            if (geom.shapeKind === "circle") {
                const r = +(geom.diameterCm / 2).toFixed(2);
                const poly = [];
                const segs = 32;
                for (let i = 0; i < segs; i++) {
                    const ang = (2 * Math.PI * i) / segs;
                    poly.push({
                        x: +(r + r * Math.cos(ang)).toFixed(2),
                        y: +(r + r * Math.sin(ang)).toFixed(2)
                    });
                }
                return {
                    shapeKind: "circle",
                    widthCm: geom.diameterCm,
                    heightCm: geom.diameterCm,
                    radiusCm: r,
                    cx: r,
                    cy: r,
                    areaM2: geom.surfaceAreaM2,
                    areaFt2: geom.surfaceAreaFt2,
                    depthCm: geom.depthCm,
                    customShape: null,
                    pathD: null,
                    poly: poly
                };
            }
            const wCm = geom.lengthCm;
            const hCm = geom.widthCm;
            return {
                shapeKind: "rectangle",
                widthCm: wCm,
                heightCm: hCm,
                radiusCm: +(Math.min(wCm, hCm) / 2).toFixed(2),
                cx: +(wCm / 2).toFixed(2),
                cy: +(hCm / 2).toFixed(2),
                areaM2: geom.surfaceAreaM2,
                areaFt2: geom.surfaceAreaFt2,
                depthCm: geom.depthCm,
                customShape: null,
                pathD: null,
                poly: [
                    { x: 0, y: 0 },
                    { x: wCm, y: 0 },
                    { x: wCm, y: hCm },
                    { x: 0, y: hCm }
                ]
            };
        }

        const wCm = +Math.max(20, Number(b.bedLengthM || 2.4) * 100).toFixed(1);
        const hCm = +Math.max(15, Number(b.bedWidthCm || 75)).toFixed(1);
        const areaM2 = +((wCm * hCm) / 10000).toFixed(4);
        const areaFt2 = +((wCm * hCm) / SQ_FT_CM2).toFixed(2);
        return {
            shapeKind: "rectangle",
            widthCm: wCm,
            heightCm: hCm,
            radiusCm: +(Math.min(wCm, hCm) / 2).toFixed(2),
            cx: +(wCm / 2).toFixed(2),
            cy: +(hCm / 2).toFixed(2),
            areaM2: areaM2,
            areaFt2: areaFt2,
            depthCm: null,
            customShape: null,
            pathD: null,
            poly: [
                { x: 0, y: 0 },
                { x: wCm, y: 0 },
                { x: wCm, y: hCm },
                { x: 0, y: hCm }
            ]
        };
    }

    function isPointInsidePlayground(xCm, yCm, block, marginCm) {
        const x = Number(xCm);
        const y = Number(yCm);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        const bounds = getPlaygroundBounds(block);
        const m = Math.max(0, Number(marginCm) || 0);

        if (bounds.shapeKind === "circle") {
            const effR = bounds.radiusCm - m;
            if (effR < 0) return false;
            return Math.hypot(x - bounds.cx, y - bounds.cy) <= effR + 1e-4;
        }
        if (bounds.shapeKind === "custom" && bounds.poly && bounds.poly.length >= 3) {
            if (!isPointInPolygon(x, y, bounds.poly)) return false;
            if (m > 0 && pointToPolylineDistance(x, y, bounds.poly) < m - 1e-4) return false;
            return true;
        }
        if (m * 2 > bounds.widthCm + 1e-4 || m * 2 > bounds.heightCm + 1e-4) return false;
        return x >= m - 1e-4 && x <= bounds.widthCm - m + 1e-4 &&
            y >= m - 1e-4 && y <= bounds.heightCm - m + 1e-4;
    }

    function clampPointToPlayground(xCm, yCm, block, marginCm) {
        const bounds = getPlaygroundBounds(block);
        const mReq = Math.max(0, Number(marginCm) || 0);
        const minHalf = Math.min(bounds.widthCm, bounds.heightCm) * 0.5;
        const m = Math.min(mReq, Math.max(0, minHalf - 1));

        let x = Number(xCm);
        let y = Number(yCm);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            x = bounds.cx;
            y = bounds.cy;
        }

        if (bounds.shapeKind === "circle") {
            const maxR = Math.max(0.5, bounds.radiusCm - m);
            const dx = x - bounds.cx;
            const dy = y - bounds.cy;
            const dist = Math.hypot(dx, dy);
            if (dist > maxR && dist > 1e-9) {
                x = bounds.cx + (dx / dist) * maxR;
                y = bounds.cy + (dy / dist) * maxR;
            }
            return { xCm: +x.toFixed(1), yCm: +y.toFixed(1) };
        }

        if (bounds.shapeKind === "custom" && bounds.poly && bounds.poly.length >= 3) {
            if (isPointInsidePlayground(x, y, block, m)) {
                return { xCm: +x.toFixed(1), yCm: +y.toFixed(1) };
            }
            const poly = bounds.poly;
            // Project onto nearest boundary segment first, then nudge inward
            let bestDist = Infinity;
            let bestProjX = bounds.cx;
            let bestProjY = bounds.cy;
            let bestNx = 0;
            let bestNy = 0;
            const signedArea = computeSignedPolygonArea(poly);
            const normalSign = signedArea >= 0 ? 1 : -1;
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i];
                const b = poly[(i + 1) % poly.length];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const lenSq = dx * dx + dy * dy;
                const t = lenSq > 1e-12 ? clamp(((x - a.x) * dx + (y - a.y) * dy) / lenSq, 0, 1) : 0;
                const px = a.x + t * dx;
                const py = a.y + t * dy;
                const d = Math.hypot(x - px, y - py);
                if (d < bestDist) {
                    bestDist = d;
                    bestProjX = px;
                    bestProjY = py;
                    const len = Math.sqrt(lenSq) || 1;
                    bestNx = (-dy / len) * normalSign;
                    bestNy = (dx / len) * normalSign;
                }
            }
            const stepInset = Math.max(0.5, m);
            let candX = bestProjX + bestNx * stepInset;
            let candY = bestProjY + bestNy * stepInset;
            if (isPointInsidePlayground(candX, candY, block, m * 0.9)) {
                return { xCm: +candX.toFixed(1), yCm: +candY.toFixed(1) };
            }
            // Binary search from interior anchor (cx, cy) or centroid toward (x, y)
            let anchorX = bounds.cx;
            let anchorY = bounds.cy;
            if (!isPointInPolygon(anchorX, anchorY, poly)) {
                // Find an interior sample inside poly
                for (let gy = 0.2; gy <= 0.8; gy += 0.15) {
                    for (let gx = 0.2; gx <= 0.8; gx += 0.15) {
                        const tx = gx * bounds.widthCm;
                        const ty = gy * bounds.heightCm;
                        if (isPointInPolygon(tx, ty, poly)) {
                            anchorX = tx;
                            anchorY = ty;
                            break;
                        }
                    }
                }
            }
            let lo = 0;
            let hi = 1;
            for (let iter = 0; iter < 16; iter++) {
                const mid = (lo + hi) * 0.5;
                const tx = anchorX + (x - anchorX) * mid;
                const ty = anchorY + (y - anchorY) * mid;
                if (isPointInsidePlayground(tx, ty, block, m * 0.9)) lo = mid;
                else hi = mid;
            }
            candX = anchorX + (x - anchorX) * lo;
            candY = anchorY + (y - anchorY) * lo;
            return { xCm: +candX.toFixed(1), yCm: +candY.toFixed(1) };
        }

        const nx = clamp(x, m, Math.max(m, bounds.widthCm - m));
        const ny = clamp(y, m, Math.max(m, bounds.heightCm - m));
        return { xCm: +nx.toFixed(1), yCm: +ny.toFixed(1) };
    }

    function normalizePlacedPlant(spec, idx, defaultYear) {
        const defYr = Number(defaultYear || 2026);
        if (Array.isArray(spec)) {
            return {
                id: generateId("pp_" + (idx || 0)),
                blockId: spec[0] ? String(spec[0]) : null,
                bedNumber: Math.max(1, Math.round(Number(spec[1] ?? 1))),
                cropName: String(spec[2] || "Carrot").trim(),
                xCm: Number.isFinite(Number(spec[3])) ? +Number(spec[3]).toFixed(1) : 0,
                yCm: Number.isFinite(Number(spec[4])) ? +Number(spec[4]).toFixed(1) : 0,
                radiusCm: Math.max(1.5, Number.isFinite(Number(spec[5])) ? +Number(spec[5]).toFixed(1) : 10),
                role: (typeof spec[6] === "string" && spec[6].trim()) ? spec[6].trim() : "primary",
                startDate: (typeof spec[7] === "string" && spec[7].trim()) ? spec[7].trim() : (defYr + "-05-01"),
                notes: (typeof spec[8] === "string") ? spec[8] : ""
            };
        }
        const s = (spec && typeof spec === "object") ? spec : {};
        return {
            id: (typeof s.id === "string" && s.id.trim()) ? s.id.trim() : generateId("pp_" + (idx || 0)),
            blockId: s.blockId || null,
            bedNumber: Math.max(1, Math.round(Number(s.bedNumber ?? s.bedStart ?? 1))),
            cropName: String(s.cropName || s.crop || "Carrot").trim(),
            xCm: Number.isFinite(Number(s.xCm ?? s.x)) ? +Number(s.xCm ?? s.x).toFixed(1) : 0,
            yCm: Number.isFinite(Number(s.yCm ?? s.y)) ? +Number(s.yCm ?? s.y).toFixed(1) : 0,
            radiusCm: Math.max(1.5, Number.isFinite(Number(s.radiusCm)) ? +Number(s.radiusCm).toFixed(1) : 10),
            role: (typeof s.role === "string" && s.role.trim()) ? s.role.trim() : "primary",
            startDate: (typeof s.startDate === "string" && s.startDate.trim()) ? s.startDate.trim() : (defYr + "-05-01"),
            notes: typeof s.notes === "string" ? s.notes : ""
        };
    }

    function generateRecommendedPlaygroundPlants(block, bedNumber, cropOrName, catalogOpt, options) {
        if (!block) return [];
        const cat = catalogOpt || _cachedCatalog;
        const opts = (options && typeof options === "object") ? options : {};
        const targetBed = Math.max(1, Math.round(Number(bedNumber) || 1));
        const zone = ["whole", "center", "mid-ring", "rim", "left", "right"].indexOf(opts.zone) !== -1
            ? opts.zone
            : "whole";
        const densityMult = clamp(Number(opts.densityMultiplier ?? 1) || 1, 0.5, 1.5);
        const keepExisting = Boolean(opts.keepExisting);
        const existing = keepExisting && Array.isArray(opts.existingPlants) ? opts.existingPlants : [];
        const startDate = opts.startDate || "2026-05-01";
        const notes = typeof opts.notes === "string" ? opts.notes : "";

        const density = computeRecommendedDensity(cropOrName, cat, block.containerSpec || block);
        const cropName = density.cropName;
        const radiusCm = density.canopyRadiusCm;
        const bounds = getPlaygroundBounds(block);
        const minDim = Math.min(bounds.widthCm, bounds.heightCm);
        const margin = clamp(Math.min(radiusCm * 0.45, minDim * 0.12), 1.5, 14);

        const defaultRole = opts.role || (zone === "center" ? "thriller" : (zone === "mid-ring" ? "filler" : (zone === "rim" ? "spiller" : "primary")));

        let targetCount;
        if (Number.isFinite(Number(opts.targetCount)) && Number(opts.targetCount) > 0) {
            targetCount = Math.min(MAX_PLAYGROUND_GEN_PLANTS, Math.max(1, Math.round(Number(opts.targetCount))));
        } else {
            let zoneAreaFrac = 1.0;
            if (zone === "center") zoneAreaFrac = 0.22;
            else if (zone === "mid-ring") zoneAreaFrac = 0.40;
            else if (zone === "rim") zoneAreaFrac = 0.35;
            else if (zone === "left" || zone === "right") zoneAreaFrac = 0.50;

            if (zone === "rim") {
                const perimEst = bounds.shapeKind === "circle"
                    ? (Math.PI * 2 * Math.max(2, bounds.radiusCm - margin))
                    : (bounds.shapeKind === "custom" && bounds.customShape
                        ? computeCustomShapeGeometry(bounds.customShape).perimeterCm
                        : 2 * Math.max(10, bounds.widthCm - 2 * margin + bounds.heightCm - 2 * margin));
                const perimCount = Math.max(1, Math.round((perimEst / Math.max(5, density.inRowCm)) * densityMult));
                const areaCap = Math.max(1, density.recommendedCountForArea(bounds.areaFt2 * 0.55 * densityMult));
                targetCount = Math.min(MAX_PLAYGROUND_GEN_PLANTS, Math.min(perimCount, Math.max(3, areaCap)));
            } else {
                const rawAreaCount = density.recommendedCountForArea(bounds.areaFt2 * zoneAreaFrac * densityMult);
                targetCount = Math.min(MAX_PLAYGROUND_GEN_PLANTS, Math.max(1, rawAreaCount));
            }
        }

        const candidates = [];

        if (bounds.shapeKind === "circle") {
            const usableR = Math.max(1.5, bounds.radiusCm - margin);
            if (zone === "rim") {
                const ringR = Math.max(usableR * 0.72, usableR - Math.max(1.0, margin * 0.25));
                const nCand = Math.max(targetCount * 2, 16);
                for (let i = 0; i < nCand; i++) {
                    const ang = (2 * Math.PI * i) / nCand - Math.PI / 2;
                    candidates.push({
                        xCm: bounds.cx + ringR * Math.cos(ang),
                        yCm: bounds.cy + ringR * Math.sin(ang)
                    });
                }
            } else if (zone === "center" && targetCount === 1 && existing.length === 0) {
                candidates.push({ xCm: bounds.cx, yCm: bounds.cy });
            } else {
                let rMin = 0;
                let rMax = usableR;
                if (zone === "center") {
                    rMin = 0;
                    rMax = Math.max(2, usableR * 0.36);
                } else if (zone === "mid-ring") {
                    rMin = usableR * 0.36;
                    rMax = usableR * 0.74;
                }
                const sampleTotal = Math.max(targetCount * (zone === "left" || zone === "right" ? 5 : 3), 36);
                const goldenAngle = 2.399963229728653;
                for (let i = 0; i < sampleTotal; i++) {
                    const frac = (i + 0.5) / sampleTotal;
                    const r = Math.sqrt(rMin * rMin + frac * (rMax * rMax - rMin * rMin));
                    const ang = i * goldenAngle;
                    const px = bounds.cx + r * Math.cos(ang);
                    const py = bounds.cy + r * Math.sin(ang);
                    if (zone === "left" && px > bounds.cx - 0.5) continue;
                    if (zone === "right" && px < bounds.cx + 0.5) continue;
                    candidates.push({ xCm: px, yCm: py });
                }
                if (candidates.length === 0) {
                    candidates.push({
                        xCm: zone === "left" ? bounds.cx - usableR * 0.45 : (zone === "right" ? bounds.cx + usableR * 0.45 : bounds.cx),
                        yCm: bounds.cy
                    });
                }
            }
        } else if (bounds.shapeKind === "custom" && bounds.customShape) {
            if (zone === "rim") {
                const poly = bounds.poly;
                const signedArea = computeSignedPolygonArea(poly);
                const normalSign = signedArea >= 0 ? 1 : -1;
                const segs = [];
                let totalLen = 0;
                for (let i = 0; i < poly.length; i++) {
                    const a = poly[i];
                    const b = poly[(i + 1) % poly.length];
                    const len = Math.hypot(b.x - a.x, b.y - a.y);
                    if (len > 1e-4) {
                        segs.push({ a: a, b: b, len: len, startLen: totalLen, endLen: totalLen + len });
                        totalLen += len;
                    }
                }
                const nCand = Math.max(targetCount * 2, 16);
                const step = totalLen / nCand;
                let sIdx = 0;
                for (let d = step * 0.5; d < totalLen; d += step) {
                    while (sIdx < segs.length - 1 && segs[sIdx].endLen < d) sIdx++;
                    const seg = segs[sIdx];
                    const t = clamp((d - seg.startLen) / seg.len, 0, 1);
                    const px = seg.a.x + t * (seg.b.x - seg.a.x);
                    const py = seg.a.y + t * (seg.b.y - seg.a.y);
                    const nx = -((seg.b.y - seg.a.y) / seg.len) * normalSign;
                    const ny = ((seg.b.x - seg.a.x) / seg.len) * normalSign;
                    const inset = clamp(margin + 1, 2, 12);
                    const qx = px + nx * inset;
                    const qy = py + ny * inset;
                    if (isPointInsidePlayground(qx, qy, block, Math.min(1.5, margin * 0.5))) {
                        candidates.push({ xCm: qx, yCm: qy });
                    }
                }
            } else {
                const desiredSamples = Math.max(targetCount * 4, 160);
                const step = Math.max(3, Math.sqrt((bounds.areaM2 * 10000) / desiredSamples));
                const rawInterior = [];
                for (let y = margin; y <= bounds.heightCm - margin + 0.01; y += step) {
                    for (let x = margin; x <= bounds.widthCm - margin + 0.01; x += step) {
                        if (!isPointInsidePlayground(x, y, block, margin)) continue;
                        if (zone === "left" && x > bounds.cx) continue;
                        if (zone === "right" && x < bounds.cx) continue;
                        rawInterior.push({
                            xCm: x,
                            yCm: y,
                            distC: Math.hypot(x - bounds.cx, y - bounds.cy)
                        });
                    }
                }
                if (rawInterior.length > 0 && (zone === "center" || zone === "mid-ring")) {
                    rawInterior.sort(function (a, b) { return a.distC - b.distC; });
                    const maxD = rawInterior[rawInterior.length - 1].distC || 1;
                    rawInterior.forEach(function (pt) {
                        const rNorm = pt.distC / maxD;
                        if (zone === "center" && rNorm <= 0.45) candidates.push(pt);
                        else if (zone === "mid-ring" && rNorm >= 0.35 && rNorm <= 0.78) candidates.push(pt);
                    });
                }
                if (candidates.length === 0) {
                    rawInterior.forEach(function (pt) { candidates.push(pt); });
                }
            }
        } else {
            // Rectangle (field, greenhouse, bench, trough)
            const xMin = margin;
            const xMax = Math.max(margin, bounds.widthCm - margin);
            const yMin = margin;
            const yMax = Math.max(margin, bounds.heightCm - margin);
            const spanX = Math.max(1, xMax - xMin);
            const spanY = Math.max(1, yMax - yMin);

            if (zone === "rim") {
                const perim = 2 * (spanX + spanY);
                const nCand = Math.max(targetCount * 2, 16);
                const step = perim / nCand;
                for (let i = 0; i < nCand; i++) {
                    let d = (i + 0.5) * step;
                    let px;
                    let py;
                    if (d <= spanX) {
                        px = xMin + d;
                        py = yMin;
                    } else if (d <= spanX + spanY) {
                        px = xMax;
                        py = yMin + (d - spanX);
                    } else if (d <= 2 * spanX + spanY) {
                        px = xMax - (d - spanX - spanY);
                        py = yMax;
                    } else {
                        px = xMin;
                        py = yMax - (d - 2 * spanX - spanY);
                    }
                    candidates.push({ xCm: px, yCm: py });
                }
            } else {
                let bxMin = xMin;
                let bxMax = xMax;
                let byMin = yMin;
                let byMax = yMax;
                if (zone === "left") {
                    bxMax = Math.max(bxMin, bounds.cx - Math.min(2, spanX * 0.04));
                } else if (zone === "right") {
                    bxMin = Math.min(bxMax, bounds.cx + Math.min(2, spanX * 0.04));
                } else if (zone === "center") {
                    bxMin = bounds.cx - spanX * 0.24;
                    bxMax = bounds.cx + spanX * 0.24;
                    byMin = bounds.cy - spanY * 0.24;
                    byMax = bounds.cy + spanY * 0.24;
                }

                const bSpanX = Math.max(1, bxMax - bxMin);
                const bSpanY = Math.max(1, byMax - byMin);
                const nCandGoal = zone === "mid-ring" ? Math.max(targetCount * 4, 48) : Math.max(targetCount, 12);
                const aspect = bSpanX / bSpanY;
                const cols = Math.max(1, Math.ceil(Math.sqrt(nCandGoal * aspect)));
                const rows = Math.max(1, Math.ceil(nCandGoal / cols));

                for (let r = 0; r < rows; r++) {
                    const fy = rows === 1 ? 0.5 : (r + 0.5) / rows;
                    const py = byMin + fy * bSpanY;
                    for (let c = 0; c < cols; c++) {
                        const fx = cols === 1 ? 0.5 : (c + 0.5) / cols;
                        const px = bxMin + fx * bSpanX;
                        if (zone === "mid-ring") {
                            const rx = Math.abs(px - bounds.cx) / Math.max(1, spanX * 0.5);
                            const ry = Math.abs(py - bounds.cy) / Math.max(1, spanY * 0.5);
                            const cheb = Math.max(rx, ry);
                            if (cheb < 0.36 || cheb > 0.78) continue;
                        }
                        candidates.push({ xCm: px, yCm: py });
                    }
                }
            }
        }

        // Validate & clamp every candidate strictly inside bounds
        const cleanCands = [];
        candidates.forEach(function (pt) {
            const clamped = clampPointToPlayground(pt.xCm, pt.yCm, block, margin);
            if (isPointInsidePlayground(clamped.xCm, clamped.yCm, block, Math.min(0.5, margin * 0.4))) {
                cleanCands.push(clamped);
            }
        });
        if (cleanCands.length === 0) {
            cleanCands.push(clampPointToPlayground(bounds.cx, bounds.cy, block, Math.min(1, margin)));
        }

        let selected = [];
        if (existing.length === 0 && cleanCands.length <= targetCount) {
            selected = cleanCands.slice(0, targetCount);
        } else if (existing.length === 0 && bounds.shapeKind === "rectangle" && zone !== "mid-ring") {
            // Even stride sampling for structured rectangular grid
            if (cleanCands.length === targetCount) {
                selected = cleanCands;
            } else {
                const stride = cleanCands.length / targetCount;
                for (let i = 0; i < targetCount; i++) {
                    selected.push(cleanCands[Math.min(cleanCands.length - 1, Math.floor(i * stride))]);
                }
            }
        } else {
            // Filter out collisions with existing plants when keepExisting is true, then farthest-point pick
            const baseClear = Math.max(3, Math.min(radiusCm * 1.1, Math.sqrt(density.plantAreaCm2) * 0.55));
            let pool = cleanCands;
            if (existing.length > 0) {
                const scales = [1.0, 0.65, 0.35, 0];
                for (let si = 0; si < scales.length; si++) {
                    const thresh = baseClear * scales[si];
                    const filtered = cleanCands.filter(function (cand) {
                        return existing.every(function (ex) {
                            const exR = Number(ex.radiusCm) || radiusCm;
                            const minSep = Math.min(thresh, (radiusCm + exR) * 0.55 * scales[si]);
                            return Math.hypot(cand.xCm - ex.xCm, cand.yCm - ex.yCm) >= minSep;
                        });
                    });
                    if (filtered.length >= targetCount || si === scales.length - 1) {
                        pool = filtered.length > 0 ? filtered : cleanCands;
                        break;
                    }
                }
            }

            if (pool.length <= targetCount) {
                selected = pool.slice();
            } else if (targetCount > 180 || pool.length > 1000) {
                const stride = pool.length / targetCount;
                for (let i = 0; i < targetCount; i++) {
                    selected.push(pool[Math.min(pool.length - 1, Math.floor(i * stride))]);
                }
            } else {
                const used = new Array(pool.length).fill(false);
                // Start with candidate farthest from existing plants (or first candidate)
                let firstIdx = 0;
                if (existing.length > 0) {
                    let bestD = -1;
                    for (let i = 0; i < pool.length; i++) {
                        let minD = Infinity;
                        for (let ei = 0; ei < existing.length; ei++) {
                            const d = Math.hypot(pool[i].xCm - existing[ei].xCm, pool[i].yCm - existing[ei].yCm);
                            if (d < minD) minD = d;
                        }
                        if (minD > bestD) {
                            bestD = minD;
                            firstIdx = i;
                        }
                    }
                }
                selected.push(pool[firstIdx]);
                used[firstIdx] = true;

                const minDistArr = pool.map(function (pt, idx) {
                    let md = Math.hypot(pt.xCm - pool[firstIdx].xCm, pt.yCm - pool[firstIdx].yCm);
                    for (let ei = 0; ei < existing.length; ei++) {
                        const ed = Math.hypot(pt.xCm - existing[ei].xCm, pt.yCm - existing[ei].yCm);
                        if (ed < md) md = ed;
                    }
                    return md;
                });

                while (selected.length < targetCount) {
                    let bestIdx = -1;
                    let bestScore = -1;
                    for (let i = 0; i < pool.length; i++) {
                        if (used[i]) continue;
                        if (minDistArr[i] > bestScore) {
                            bestScore = minDistArr[i];
                            bestIdx = i;
                        }
                    }
                    if (bestIdx === -1) break;
                    used[bestIdx] = true;
                    const chosen = pool[bestIdx];
                    selected.push(chosen);
                    for (let i = 0; i < pool.length; i++) {
                        if (used[i]) continue;
                        const d = Math.hypot(pool[i].xCm - chosen.xCm, pool[i].yCm - chosen.yCm);
                        if (d < minDistArr[i]) minDistArr[i] = d;
                    }
                }
            }
        }

        // Top up up to targetCount if pool was smaller than requested explicit targetCount
        while (selected.length < targetCount && selected.length < cleanCands.length) {
            selected.push(cleanCands[selected.length % cleanCands.length]);
        }

        return selected.map(function (pt, i) {
            const safePt = clampPointToPlayground(pt.xCm, pt.yCm, block, Math.min(1, margin * 0.5));
            return normalizePlacedPlant({
                blockId: block.id,
                bedNumber: targetBed,
                cropName: cropName,
                xCm: safePt.xCm,
                yCm: safePt.yCm,
                radiusCm: radiusCm,
                role: defaultRole,
                startDate: startDate,
                notes: notes
            }, i);
        });
    }

    function hydratePlacedPlantsFromSchedule(block, bedNumber, seasonData, catalogOpt) {
        if (!block) return [];
        const cat = catalogOpt || _cachedCatalog;
        const season = seasonData || { blocks: [], tunnels: [], plantings: [] };
        const targetBed = Math.max(1, Math.round(Number(bedNumber) || 1));
        const year = Number(season.year || 2026);
        const bounds = getPlaygroundBounds(block);

        const matching = (season.plantings || []).filter(function (p) {
            if (!p || p.blockId !== block.id || !p.bedStart) return false;
            const pStart = Number(p.bedStart);
            const pEnd = pStart + Math.max(1, Math.ceil(Number(p.bedCount ?? 1))) - 1;
            return targetBed >= pStart && targetBed <= pEnd;
        });

        const modeRank = { sole: 0, lanes: 1, understory: 2, border: 3, relay: 4 };
        matching.sort(function (a, b) {
            const ma = getEffectiveInterplantMode(a);
            const mb = getEffectiveInterplantMode(b);
            return (modeRank[ma] ?? 9) - (modeRank[mb] ?? 9);
        });

        const placed = [];
        let laneCounter = 0;

        matching.forEach(function (p) {
            const crop = (cat && cat.cropMap) ? resolveCrop(cat.cropMap, p.cropName) : null;
            const mode = getEffectiveInterplantMode(p);
            const metrics = computePlantingMetrics(p, crop, block);
            const shareFrac = clamp(Number(p.interplantSharePct ?? 50) || 50, 15, 85) / 100;

            let zone = "whole";
            let role = "primary";
            let desiredCount;

            if (mode === "border") {
                zone = "rim";
                role = "border";
                desiredCount = Math.min(180, Math.max(2, Math.round(metrics.plants / Math.max(1, Math.ceil(metrics.bedCount)))));
            } else if (mode === "understory") {
                zone = "whole";
                role = "understory";
                desiredCount = Math.min(180, Math.max(1, Math.round((metrics.plants / Math.max(1, Math.ceil(metrics.bedCount))) * 0.6)));
            } else if (mode === "relay") {
                zone = "whole";
                role = "relay";
                desiredCount = Math.min(150, Math.max(1, Math.round((metrics.plants / Math.max(1, Math.ceil(metrics.bedCount))) * 0.5)));
            } else if (mode === "lanes") {
                const lIdx = p.laneIndex !== undefined ? p.laneIndex : laneCounter;
                zone = lIdx % 2 === 0 ? "left" : "right";
                laneCounter += 1;
                role = "primary";
                desiredCount = Math.min(200, Math.max(1, Math.round(metrics.plants / Math.max(1, Math.ceil(metrics.bedCount)))));
            } else {
                zone = "whole";
                role = "primary";
                desiredCount = Math.min(240, Math.max(1, Math.round(metrics.plants / Math.max(1, Math.ceil(metrics.bedCount)))));
            }

            if (isContainerBlockType(block.type)) {
                const density = computeRecommendedDensity(crop || p.cropName, cat, block.containerSpec || block);
                const areaFrac = mode === "lanes" ? shareFrac : (mode === "border" ? 0.35 : (mode === "understory" ? 0.65 : (mode === "relay" ? 0.5 : 1)));
                desiredCount = p.placedCountOverride > 0
                    ? Math.round(Number(p.placedCountOverride))
                    : Math.max(1, density.recommendedCountForArea(bounds.areaFt2 * areaFrac));
            }

            const batch = generateRecommendedPlaygroundPlants(block, targetBed, crop || p.cropName, cat, {
                zone: zone,
                targetCount: desiredCount,
                role: role,
                existingPlants: placed,
                keepExisting: placed.length > 0,
                startDate: p.startDate || (year + "-05-01"),
                notes: p.notes || ""
            });
            batch.forEach(function (item) { placed.push(item); });
        });

        return placed;
    }

    function analyzePlaygroundBed(block, bedNumber, placedPlants, catalogOpt) {
        const cat = catalogOpt || _cachedCatalog;
        const b = block || { id: "block", type: "field", bedLengthM: 2.4, bedWidthCm: 75 };
        const targetBed = Math.max(1, Math.round(Number(bedNumber) || 1));
        const bounds = getPlaygroundBounds(b);
        const areaM2 = bounds.areaM2;
        const areaFt2 = bounds.areaFt2;

        const allPlants = Array.isArray(placedPlants) ? placedPlants : [];
        const plants = allPlants.filter(function (pp) {
            if (!pp) return false;
            if (pp.blockId && b.id && pp.blockId !== b.id) return false;
            if (pp.bedNumber !== undefined && pp.bedNumber !== null && Number(pp.bedNumber) !== targetBed) return false;
            return true;
        });

        const tallyMap = new Map();
        const resolvedList = [];
        let canopyAreaCm2 = 0;

        plants.forEach(function (pp) {
            const crop = (cat && cat.cropMap) ? resolveCrop(cat.cropMap, pp.cropName) : null;
            const canonical = crop ? crop.name : pp.cropName;
            const density = computeRecommendedDensity(crop || pp.cropName, cat, bounds.depthCm);
            const rCm = Math.max(1.5, Number(pp.radiusCm) || density.canopyRadiusCm);
            canopyAreaCm2 += Math.PI * rCm * rCm;

            resolvedList.push({
                raw: pp,
                crop: crop,
                canonical: canonical,
                xCm: Number(pp.xCm) || 0,
                yCm: Number(pp.yCm) || 0,
                radiusCm: rCm
            });

            if (!tallyMap.has(canonical)) {
                const recForBed = density.recommendedCountForArea(areaFt2);
                tallyMap.set(canonical, {
                    cropName: canonical,
                    shortCode: (crop && crop.shortCode) || canonical.slice(0, 3).toUpperCase(),
                    category: (crop && crop.category) || "Vegetable",
                    family: (crop && crop.family) || "Other",
                    color: getCategoryColor((crop && crop.category) || "Vegetable"),
                    count: 0,
                    recommendedPerSqFt: density.plantsPerSqFt,
                    recommendedCount: recForBed,
                    densityRatio: 0,
                    canopyRadiusCm: density.canopyRadiusCm,
                    rootDepthCm: density.rootDepthCm,
                    depthWarning: density.depthWarning,
                    containerSuitability: density.containerSuitability
                });
            }
            const tRec = tallyMap.get(canonical);
            tRec.count += 1;
        });

        const depthWarnings = [];
        const speciesTally = Array.from(tallyMap.values()).map(function (t) {
            t.densityRatio = t.recommendedCount > 0 ? +(t.count / t.recommendedCount).toFixed(2) : 1;
            if (t.depthWarning) {
                depthWarnings.push({
                    cropName: t.cropName,
                    rootDepthCm: t.rootDepthCm,
                    containerDepthCm: bounds.depthCm,
                    message: t.depthWarning
                });
            }
            return t;
        }).sort(function (a, b2) { return b2.count - a.count || a.cropName.localeCompare(b2.cropName); });

        // Spatial neighbor proximity & compatibility
        const compPairMap = new Map();
        const antPairMap = new Map();
        for (let i = 0; i < resolvedList.length; i++) {
            for (let j = i + 1; j < resolvedList.length; j++) {
                const a = resolvedList[i];
                const cB = resolvedList[j];
                if (normalizeKey(a.canonical) === normalizeKey(cB.canonical)) continue;
                const distCm = Math.hypot(a.xCm - cB.xCm, a.yCm - cB.yCm);
                const neighborThreshold = Math.max(45, (a.radiusCm + cB.radiusCm) * 2.2);
                if (distCm > neighborThreshold) continue;

                const rel = pairCompatibility(a.crop, a.canonical, cB.crop, cB.canonical);
                if (rel === "neutral") continue;

                const pairNames = [a.canonical, cB.canonical].sort();
                const pairKey = pairNames.join("|");
                const targetMap = rel === "companion" ? compPairMap : antPairMap;
                if (!targetMap.has(pairKey)) {
                    targetMap.set(pairKey, {
                        cropA: pairNames[0],
                        cropB: pairNames[1],
                        pairCount: 0,
                        minDistanceCm: Infinity,
                        reason: rel === "companion"
                            ? (pairNames[0] + " + " + pairNames[1] + " beneficial spatial neighbors")
                            : (pairNames[0] + " and " + pairNames[1] + " are antagonistic neighbors")
                    });
                }
                const pRec = targetMap.get(pairKey);
                pRec.pairCount += 1;
                if (distCm < pRec.minDistanceCm) pRec.minDistanceCm = +distCm.toFixed(1);
            }
        }

        const companionPairs = Array.from(compPairMap.values());
        const antagonistPairs = Array.from(antPairMap.values());
        const totalPlants = plants.length;
        const actualPlantsPerSqFt = areaFt2 > 0 ? +(totalPlants / areaFt2).toFixed(2) : 0;
        const bedAreaCm2 = Math.max(1, areaM2 * 10000);
        const canopyFillPct = Math.round((canopyAreaCm2 / bedAreaCm2) * 100);

        const volL = b.volumeLiters || (b.containerSpec ? computeContainerGeometry(b.containerSpec, b.type).volumeLiters : 0);
        const mediaAnalysis = analyzeGrowingMedia(
            b.growingMedia,
            b.type || "field",
            speciesTally.map(function (s) { return s.cropName; }),
            volL
        );

        let healthStatus = "thriving";
        if (antagonistPairs.length > 0) {
            healthStatus = "conflict";
        } else if (depthWarnings.length > 0 || canopyFillPct > 125 || (mediaAnalysis && mediaAnalysis.warnings.length > 0)) {
            healthStatus = "caution";
        }

        return {
            blockId: b.id,
            blockName: b.name || "",
            bedNumber: targetBed,
            totalPlants: totalPlants,
            areaFt2: areaFt2,
            areaM2: areaM2,
            actualPlantsPerSqFt: actualPlantsPerSqFt,
            canopyFillPct: canopyFillPct,
            speciesTally: speciesTally,
            companionPairs: companionPairs,
            antagonistPairs: antagonistPairs,
            depthWarnings: depthWarnings,
            mediaAnalysis: mediaAnalysis,
            healthStatus: healthStatus
        };
    }

    function syncPlacedPlantsToSchedule(seasonData, blockId, bedNumber, catalogOpt) {
        if (!seasonData || !blockId) return [];
        const cat = catalogOpt || _cachedCatalog;
        const targetBed = Math.max(1, Math.round(Number(bedNumber) || 1));
        const year = Number(seasonData.year || 2026);
        const blocks = seasonData.blocks || [];
        const block = blocks.find(function (b) { return b.id === blockId; }) || null;
        const tunnels = seasonData.tunnels || [];
        const bounds = block ? getPlaygroundBounds(block) : { areaM2: 1, areaFt2: 10.76 };

        const bedPlants = (seasonData.placedPlants || []).filter(function (pp) {
            return pp && pp.blockId === blockId && Number(pp.bedNumber || 1) === targetBed;
        });

        // Remove existing single-bed plantings scoped solely to (blockId, targetBed)
        const preservedPlantings = (seasonData.plantings || []).filter(function (p) {
            if (!p || p.blockId !== blockId) return true;
            const pStart = Number(p.bedStart || 0);
            const pSpan = Math.max(1, Math.ceil(Number(p.bedCount || 1)));
            return !(pStart === targetBed && pSpan === 1);
        });

        const bySpecies = new Map();
        bedPlants.forEach(function (pp) {
            const crop = (cat && cat.cropMap) ? resolveCrop(cat.cropMap, pp.cropName) : null;
            const canonical = crop ? crop.name : pp.cropName;
            if (!bySpecies.has(canonical)) {
                bySpecies.set(canonical, {
                    cropName: canonical,
                    crop: crop,
                    count: 0,
                    roles: {},
                    startDate: pp.startDate || (year + "-05-01"),
                    notes: pp.notes || ""
                });
            }
            const rec = bySpecies.get(canonical);
            rec.count += 1;
            const r = pp.role || "primary";
            rec.roles[r] = (rec.roles[r] || 0) + 1;
            if (pp.startDate && pp.startDate < rec.startDate) rec.startDate = pp.startDate;
        });

        const groups = Array.from(bySpecies.values()).sort(function (a, b) {
            return b.count - a.count;
        });

        const primaryGroups = [];
        const secondaryGroups = [];
        groups.forEach(function (g) {
            const topRole = Object.keys(g.roles).sort(function (a, b) { return g.roles[b] - g.roles[a]; })[0] || "primary";
            g.topRole = topRole;
            if (topRole === "border" || topRole === "spiller" || topRole === "understory" || topRole === "relay") {
                secondaryGroups.push(g);
            } else {
                primaryGroups.push(g);
            }
        });

        if (primaryGroups.length === 0 && secondaryGroups.length > 0) {
            primaryGroups.push(secondaryGroups.shift());
        }

        const totalPrimary = primaryGroups.reduce(function (s, g) { return s + g.count; }, 0) || 1;
        const newPlantings = [];
        let allocatedShare = 0;

        primaryGroups.forEach(function (g, idx) {
            const mode = primaryGroups.length === 1 ? "sole" : "lanes";
            let sharePct = 50;
            if (mode === "lanes") {
                if (idx === primaryGroups.length - 1) {
                    sharePct = clamp(100 - allocatedShare, 15, 85);
                } else {
                    sharePct = clamp(Math.round((g.count / totalPrimary) * 100), 15, 85);
                    allocatedShare += sharePct;
                }
            }
            const pl = normalizePlanting({
                cropName: g.cropName,
                blockId: blockId,
                bedStart: targetBed,
                bedCount: 1,
                startDate: g.startDate,
                interplantMode: mode,
                interplantSharePct: sharePct,
                laneIndex: mode === "lanes" ? idx : undefined,
                placedCountOverride: g.count,
                notes: g.notes
            }, idx, year);
            if (g.crop || block) {
                const dates = computePlantingDates(pl, g.crop, block, tunnels, true);
                Object.assign(pl, {
                    startDate: dates.startDate,
                    endDate: dates.endDate,
                    harvestStartDate: dates.harvestStartDate,
                    harvestEndDate: dates.harvestEndDate,
                    seedingDate: dates.seedingDate,
                    transplantDate: dates.transplantDate,
                    pottingUpDate: dates.pottingUpDate,
                    effectiveDtm: dates.effectiveDtm
                });
            }
            newPlantings.push(pl);
        });

        secondaryGroups.forEach(function (g, idx) {
            const mode = (g.topRole === "spiller" || g.topRole === "border")
                ? "border"
                : (g.topRole === "relay" ? "relay" : "understory");
            const pl = normalizePlanting({
                cropName: g.cropName,
                blockId: blockId,
                bedStart: targetBed,
                bedCount: 1,
                startDate: g.startDate,
                interplantMode: mode,
                interplantSharePct: clamp(Math.round((g.count / Math.max(1, bedPlants.length)) * 100), 15, 65),
                placedCountOverride: g.count,
                notes: g.notes
            }, primaryGroups.length + idx, year);
            if (g.crop || block) {
                const dates = computePlantingDates(pl, g.crop, block, tunnels, true);
                Object.assign(pl, {
                    startDate: dates.startDate,
                    endDate: dates.endDate,
                    harvestStartDate: dates.harvestStartDate,
                    harvestEndDate: dates.harvestEndDate,
                    seedingDate: dates.seedingDate,
                    transplantDate: dates.transplantDate,
                    pottingUpDate: dates.pottingUpDate,
                    effectiveDtm: dates.effectiveDtm
                });
            }
            newPlantings.push(pl);
        });

        seasonData.plantings = preservedPlantings.concat(newPlantings);
        return newPlantings;
    }

    function getEffectiveInterplantMode(p) {
        if (!p || typeof p !== "object") return "sole";
        if (INTERPLANT_MODES.indexOf(p.interplantMode) !== -1) return p.interplantMode;
        return p.interplanted ? "border" : "sole";
    }

    function isPrimarySoilMode(mode) {
        return mode === "sole" || mode === "lanes";
    }

    function formatBlockSpaceType(block) {
        if (!block) return "Unassigned";
        if (block.shapeType === "custom" && block.customShape) return "Custom Shape";
        const t = String(block.type || "field").toLowerCase();
        if (t === "greenhouse") return "Greenhouse";
        if (t === "bench") return "Bench";
        if (t === "pot") return "Pot";
        if (t === "basket") return "Hanging Basket";
        return "Field";
    }

    function formatInterplantModeLabel(mode, sharePct) {
        const m = String(mode || "sole").toLowerCase();
        if (m === "lanes") {
            return "Alternating Lanes (" + clamp(Math.round(Number(sharePct) || 50), 15, 85) + "%)";
        }
        if (m === "border") return "Border Strip";
        if (m === "understory") return "Understory";
        if (m === "relay") return "Relay";
        return "Full Bed";
    }

    function formatGrowingMediaMixLabel(rawMedia, blockTypeOpt) {
        if (!rawMedia && !isContainerBlockType(blockTypeOpt)) return "";
        const norm = normalizeGrowingMedia(rawMedia, blockTypeOpt);
        if (!norm || !Array.isArray(norm.ingredients) || norm.ingredients.length === 0) return "";
        const parts = [];
        norm.ingredients.forEach(function (item) {
            const pct = Number(item.pct);
            if (!(pct > 0)) return;
            const def = GROWING_MEDIA_BY_ID.get(item.id);
            if (!def) return;
            parts.push(def.label + " " + formatCleanNum(pct, 1) + "%");
        });
        return parts.join(", ");
    }

    function wrapSvgTextLines(text, maxChars, maxLines) {
        const clean = String(text || "").trim();
        if (!clean) return [""];
        const limit = Math.max(20, Number(maxChars) || 88);
        const cap = Math.max(1, Number(maxLines) || 2);
        if (clean.length <= limit) return [clean];

        const tokens = clean.split(/,\s+/);
        const lines = [];
        let cur = "";
        for (let i = 0; i < tokens.length; i++) {
            const part = (i < tokens.length - 1) ? (tokens[i] + ",") : tokens[i];
            const cand = cur ? (cur + " " + part) : part;
            if (cand.length <= limit || !cur) {
                cur = cand;
            } else {
                lines.push(cur);
                cur = part;
                if (lines.length >= cap - 1) {
                    const rest = tokens.slice(i).join(", ");
                    cur = rest.length > limit ? (rest.slice(0, limit - 3) + "...") : rest;
                    break;
                }
            }
        }
        if (cur) lines.push(cur);
        return lines.slice(0, cap);
    }

    function exportPlaygroundSvg(block, bedNumber, placedPlants, catalogOpt, options) {
        if (!block || typeof block !== "object") return "";
        const cat = catalogOpt || _cachedCatalog;
        const opts = (options && typeof options === "object") ? options : {};
        const targetBed = Math.max(1, Math.round(Number(bedNumber) || 1));
        const units = (opts.units === "imperial" || opts.units === "metric")
            ? opts.units
            : ((block.customShape && block.customShape.units === "imperial") ? "imperial" : "metric");
        const isImp = units === "imperial";
        const showGrid = opts.showGrid !== false;
        const showLabels = opts.showLabels !== false;

        const allPlaced = Array.isArray(placedPlants) ? placedPlants : [];
        const bedPlants = allPlaced.filter(function (pp) {
            if (!pp) return false;
            if (pp.blockId && block.id && pp.blockId !== block.id) return false;
            if (pp.bedNumber !== undefined && pp.bedNumber !== null && Number(pp.bedNumber) !== targetBed) return false;
            return true;
        });

        const bounds = getPlaygroundBounds(block);
        const analysis = opts.analysis || analyzePlaygroundBed(block, targetBed, bedPlants, cat);

        let viewStartCm = 0;
        let viewEndCm = Math.max(1, bounds.widthCm);
        if (bounds.shapeKind === "rectangle" &&
            Number.isFinite(Number(opts.sectionStartCm)) &&
            Number.isFinite(Number(opts.sectionEndCm)) &&
            Number(opts.sectionEndCm) > Number(opts.sectionStartCm)) {
            viewStartCm = clamp(Number(opts.sectionStartCm), 0, Math.max(0, bounds.widthCm - 10));
            viewEndCm = clamp(Number(opts.sectionEndCm), viewStartCm + 10, bounds.widthCm);
        }
        const isSectionZoom = viewStartCm > 0.05 || viewEndCm < bounds.widthCm - 0.05;
        const viewW = Math.max(1, viewEndCm - viewStartCm);
        const viewH = Math.max(1, bounds.heightCm);
        const aspect = viewW / viewH;
        const sheetW = aspect > 8 ? 1200 : 960;

        const spaceType = formatBlockSpaceType(block);
        const bedCount = Math.max(1, Math.round(Number(block.bedCount || 1)));
        const titleBase = opts.title
            ? String(opts.title)
            : ((block.name || spaceType) + (bedCount > 1 || targetBed > 1 ? (" (Bed " + targetBed + ")") : ""));

        let dimText;
        if (bounds.shapeKind === "circle") {
            const depthVal = bounds.depthCm || 25;
            dimText = isImp
                ? (cmToIn(bounds.widthCm) + '" Ø × ' + cmToIn(depthVal) + '" deep')
                : (formatCleanNum(bounds.widthCm, 1) + " cm Ø × " + formatCleanNum(depthVal, 1) + " cm deep");
        } else if (bounds.shapeKind === "custom") {
            dimText = isImp
                ? (formatLength(bounds.widthCm / 100, "imperial") + " × " + formatLength(bounds.heightCm / 100, "imperial") + " bounds")
                : (formatCleanNum(bounds.widthCm, 0) + " × " + formatCleanNum(bounds.heightCm, 0) + " cm bounds");
            if (bounds.depthCm) {
                dimText += " · " + (isImp ? (cmToIn(bounds.depthCm) + '" deep') : (formatCleanNum(bounds.depthCm, 1) + " cm deep"));
            }
        } else {
            dimText = isImp
                ? (formatLength(bounds.widthCm / 100, "imperial") + " × " + (bounds.heightCm >= 91 ? formatLength(bounds.heightCm / 100, "imperial") : cmToIn(bounds.heightCm) + '"'))
                : ((bounds.widthCm >= 200 ? formatLength(bounds.widthCm / 100, "metric") : formatCleanNum(bounds.widthCm, 0) + " cm") + " × " + formatCleanNum(bounds.heightCm, 0) + " cm");
            if (bounds.depthCm) {
                dimText += " × " + (isImp ? (cmToIn(bounds.depthCm) + '" deep') : (formatCleanNum(bounds.depthCm, 1) + " cm deep"));
            }
        }

        const areaText = formatCleanNum(bounds.areaM2, bounds.areaM2 < 1 ? 3 : 2) + " m² / " + formatCleanNum(bounds.areaFt2, 2) + " ft²";
        const isContainer = isContainerBlockType(block.type);
        const volLiters = Number(block.volumeLiters) > 0
            ? Number(block.volumeLiters)
            : (isContainer
                ? computeContainerGeometry(block.containerSpec || block, block.type).volumeLiters
                : (bounds.depthCm ? +(bounds.areaM2 * bounds.depthCm * 10).toFixed(1) : 0));
        const volText = volLiters > 0
            ? (formatCleanNum(volLiters, 1) + " L (" + formatCleanNum(volLiters / LITERS_PER_US_GALLON, 2) + " gal)")
            : "";

        let mediaRecipe = "Native Field Soil (No Custom Media Mix)";
        if (isContainer || block.growingMedia) {
            const normMedia = normalizeGrowingMedia(block.growingMedia, block.type);
            const mixStr = formatGrowingMediaMixLabel(normMedia, block.type);
            mediaRecipe = (normMedia && normMedia.name ? normMedia.name + ": " : "") + (mixStr || "Default Mix");
        }

        const maxMediaChars = sheetW > 1000 ? 104 : 80;
        const mediaLines = wrapSvgTextLines("Growing Media Mix: " + mediaRecipe, maxMediaChars, 2);
        const titleX = 16;
        const titleY = 16;
        const titleW = sheetW - 32;
        const titleH = mediaLines.length > 1 ? 106 : 92;

        const plotAreaTop = titleY + titleH + 14;
        const availW = sheetW - 128;
        const maxPlotH = 440;
        const scale = Math.min(availW / viewW, maxPlotH / viewH);
        const drawnW = viewW * scale;
        const drawnH = viewH * scale;
        const plotBoxH = Math.max(126, Math.ceil(drawnH + 66));
        const plotOriginX = (sheetW - drawnW) / 2;
        const plotOriginY = plotAreaTop + Math.max(30, (plotBoxH - drawnH) / 2);

        const mapX = function (xCm) { return plotOriginX + (xCm - viewStartCm) * scale; };
        const mapY = function (yCm) { return plotOriginY + yCm * scale; };
        const stepCm = isImp ? 30.48 : 25;
        const gridLabel = isImp ? "1 ft² (30.5 cm)" : "25 cm × 25 cm";

        let defsSvg = "";
        let outlineSvg = "";
        let gridSvg = "";

        if (bounds.shapeKind === "circle") {
            const cxPx = mapX(bounds.cx);
            const cyPx = mapY(bounds.cy);
            const rPx = bounds.radiusCm * scale;
            const rimPadPx = clamp(rPx * 0.05, 4, 12);
            defsSvg += '<clipPath id="wcppPgExportClip"><circle cx="' + cxPx.toFixed(2) + '" cy="' + cyPx.toFixed(2) + '" r="' + rPx.toFixed(2) + '"/></clipPath>';
            outlineSvg += '<circle cx="' + cxPx.toFixed(2) + '" cy="' + cyPx.toFixed(2) + '" r="' + (rPx + rimPadPx).toFixed(2) + '" fill="#fffbeb" stroke="#9a3412" stroke-width="2.2"/>';
            outlineSvg += '<circle cx="' + cxPx.toFixed(2) + '" cy="' + cyPx.toFixed(2) + '" r="' + rPx.toFixed(2) + '" fill="#ecfdf5" stroke="#166534" stroke-width="1.8"/>';
            if (showGrid) {
                let innerG = "";
                for (let gx = stepCm; gx < bounds.widthCm; gx += stepCm) {
                    const px = mapX(gx);
                    innerG += '<line x1="' + px.toFixed(2) + '" y1="' + (cyPx - rPx).toFixed(2) + '" x2="' + px.toFixed(2) + '" y2="' + (cyPx + rPx).toFixed(2) + '" stroke="#cbd5e1" stroke-width="0.9"/>';
                }
                for (let gy = stepCm; gy < bounds.heightCm; gy += stepCm) {
                    const py = mapY(gy);
                    innerG += '<line x1="' + (cxPx - rPx).toFixed(2) + '" y1="' + py.toFixed(2) + '" x2="' + (cxPx + rPx).toFixed(2) + '" y2="' + py.toFixed(2) + '" stroke="#cbd5e1" stroke-width="0.9"/>';
                }
                innerG += '<circle cx="' + cxPx.toFixed(2) + '" cy="' + cyPx.toFixed(2) + '" r="' + (rPx * 0.42).toFixed(2) + '" fill="none" stroke="#94a3b8" stroke-width="0.9" stroke-dasharray="4 3"/>';
                innerG += '<circle cx="' + cxPx.toFixed(2) + '" cy="' + cyPx.toFixed(2) + '" r="' + (rPx * 0.76).toFixed(2) + '" fill="none" stroke="#94a3b8" stroke-width="0.9" stroke-dasharray="4 3"/>';
                gridSvg = '<g clip-path="url(#wcppPgExportClip)">' + innerG + "</g>";
            }
            if (block.type === "basket") {
                [-90, 30, 150].forEach(function (deg) {
                    const rad = (deg * Math.PI) / 180;
                    const rx = cxPx + Math.cos(rad) * (rPx + rimPadPx);
                    const ry = cyPx + Math.sin(rad) * (rPx + rimPadPx);
                    gridSvg += '<line x1="' + rx.toFixed(2) + '" y1="' + ry.toFixed(2) + '" x2="' + cxPx.toFixed(2) + '" y2="' + cyPx.toFixed(2) + '" stroke="#0f766e" stroke-width="1.2" stroke-dasharray="4 3" stroke-opacity="0.7"/>';
                    gridSvg += '<circle cx="' + rx.toFixed(2) + '" cy="' + ry.toFixed(2) + '" r="3.5" fill="#0f766e"/>';
                });
                gridSvg += '<circle cx="' + cxPx.toFixed(2) + '" cy="' + cyPx.toFixed(2) + '" r="4.2" fill="#ffffff" stroke="#0f766e" stroke-width="1.5"/>';
            }
        } else if (bounds.shapeKind === "custom" && bounds.pathD) {
            const xform = "translate(" + plotOriginX.toFixed(2) + "," + plotOriginY.toFixed(2) + ") scale(" + scale.toFixed(5) + ")";
            defsSvg += '<clipPath id="wcppPgExportClip"><path d="' + escapeXmlText(bounds.pathD) + '" transform="' + xform + '"/></clipPath>';
            outlineSvg += '<g transform="' + xform + '"><path d="' + escapeXmlText(bounds.pathD) + '" fill="#ecfdf5" stroke="#166534" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></g>';
            if (showGrid) {
                let innerG = "";
                for (let gx = stepCm; gx < bounds.widthCm; gx += stepCm) {
                    const px = mapX(gx);
                    innerG += '<line x1="' + px.toFixed(2) + '" y1="' + plotOriginY.toFixed(2) + '" x2="' + px.toFixed(2) + '" y2="' + (plotOriginY + drawnH).toFixed(2) + '" stroke="#cbd5e1" stroke-width="0.9"/>';
                }
                for (let gy = stepCm; gy < bounds.heightCm; gy += stepCm) {
                    const py = mapY(gy);
                    innerG += '<line x1="' + plotOriginX.toFixed(2) + '" y1="' + py.toFixed(2) + '" x2="' + (plotOriginX + drawnW).toFixed(2) + '" y2="' + py.toFixed(2) + '" stroke="#cbd5e1" stroke-width="0.9"/>';
                }
                gridSvg = '<g clip-path="url(#wcppPgExportClip)">' + innerG + "</g>";
            }
        } else {
            const frameCol = block.type === "bench" ? "#92400e" : (block.type === "pot" ? "#9a3412" : "#166534");
            const rimPadPx = 5;
            outlineSvg += '<rect x="' + (plotOriginX - rimPadPx).toFixed(2) + '" y="' + (plotOriginY - rimPadPx).toFixed(2) + '" width="' + (drawnW + rimPadPx * 2).toFixed(2) + '" height="' + (drawnH + rimPadPx * 2).toFixed(2) + '" rx="4" fill="#fffbeb" stroke="' + frameCol + '" stroke-width="1.8"/>';
            outlineSvg += '<rect x="' + plotOriginX.toFixed(2) + '" y="' + plotOriginY.toFixed(2) + '" width="' + drawnW.toFixed(2) + '" height="' + drawnH.toFixed(2) + '" fill="#ecfdf5" stroke="#166534" stroke-width="1.5"/>';
            if (showGrid) {
                const startGridX = Math.max(stepCm, Math.ceil((viewStartCm + 0.5) / stepCm) * stepCm);
                for (let gx = startGridX; gx < viewEndCm - 0.5; gx += stepCm) {
                    const px = mapX(gx);
                    gridSvg += '<line x1="' + px.toFixed(2) + '" y1="' + plotOriginY.toFixed(2) + '" x2="' + px.toFixed(2) + '" y2="' + (plotOriginY + drawnH).toFixed(2) + '" stroke="#cbd5e1" stroke-width="0.8"/>';
                }
                for (let gy = stepCm; gy < bounds.heightCm - 0.5; gy += stepCm) {
                    const py = mapY(gy);
                    gridSvg += '<line x1="' + plotOriginX.toFixed(2) + '" y1="' + py.toFixed(2) + '" x2="' + (plotOriginX + drawnW).toFixed(2) + '" y2="' + py.toFixed(2) + '" stroke="#cbd5e1" stroke-width="0.8"/>';
                }
            }
        }

        // Architectural dimension bars
        const topDimY = plotOriginY - 14;
        const leftDimX = plotOriginX - 16;
        const topWidthLabel = isSectionZoom
            ? ("Section " + (isImp ? (formatLength(viewStartCm / 100, "imperial") + " – " + formatLength(viewEndCm / 100, "imperial")) : (formatCleanNum(viewStartCm / 100, 1) + " m – " + formatCleanNum(viewEndCm / 100, 1) + " m")) + " of " + (isImp ? formatLength(bounds.widthCm / 100, "imperial") : formatLength(bounds.widthCm / 100, "metric")))
            : (bounds.shapeKind === "circle"
                ? ("Diameter: " + (isImp ? (cmToIn(bounds.widthCm) + '"') : (formatCleanNum(bounds.widthCm, 1) + " cm")))
                : (isImp ? formatLength(viewW / 100, "imperial") : (viewW >= 200 ? formatLength(viewW / 100, "metric") : formatCleanNum(viewW, 0) + " cm")));
        const leftHeightLabel = isImp
            ? (bounds.heightCm >= 91 ? formatLength(bounds.heightCm / 100, "imperial") : (cmToIn(bounds.heightCm) + '"'))
            : formatCleanNum(bounds.heightCm, 0) + " cm";

        let dimLinesSvg =
            '<line x1="' + plotOriginX.toFixed(2) + '" y1="' + topDimY.toFixed(2) + '" x2="' + (plotOriginX + drawnW).toFixed(2) + '" y2="' + topDimY.toFixed(2) + '" stroke="#64748b" stroke-width="1"/>' +
            '<line x1="' + plotOriginX.toFixed(2) + '" y1="' + (topDimY - 4).toFixed(2) + '" x2="' + plotOriginX.toFixed(2) + '" y2="' + (topDimY + 4).toFixed(2) + '" stroke="#64748b" stroke-width="1"/>' +
            '<line x1="' + (plotOriginX + drawnW).toFixed(2) + '" y1="' + (topDimY - 4).toFixed(2) + '" x2="' + (plotOriginX + drawnW).toFixed(2) + '" y2="' + (topDimY + 4).toFixed(2) + '" stroke="#64748b" stroke-width="1"/>' +
            '<text x="' + (plotOriginX + drawnW / 2).toFixed(2) + '" y="' + (topDimY - 4).toFixed(2) + '" font-size="10" font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle" fill="#334155">' + escapeXmlText(topWidthLabel) + "</text>";

        if (bounds.shapeKind !== "circle") {
            const leftCy = plotOriginY + drawnH / 2;
            dimLinesSvg +=
                '<line x1="' + leftDimX.toFixed(2) + '" y1="' + plotOriginY.toFixed(2) + '" x2="' + leftDimX.toFixed(2) + '" y2="' + (plotOriginY + drawnH).toFixed(2) + '" stroke="#64748b" stroke-width="1"/>' +
                '<line x1="' + (leftDimX - 4).toFixed(2) + '" y1="' + plotOriginY.toFixed(2) + '" x2="' + (leftDimX + 4).toFixed(2) + '" y2="' + plotOriginY.toFixed(2) + '" stroke="#64748b" stroke-width="1"/>' +
                '<line x1="' + (leftDimX - 4).toFixed(2) + '" y1="' + (plotOriginY + drawnH).toFixed(2) + '" x2="' + (leftDimX + 4).toFixed(2) + '" y2="' + (plotOriginY + drawnH).toFixed(2) + '" stroke="#64748b" stroke-width="1"/>' +
                '<text x="' + (leftDimX - 6).toFixed(2) + '" y="' + leftCy.toFixed(2) + '" transform="rotate(-90 ' + (leftDimX - 6).toFixed(2) + " " + leftCy.toFixed(2) + ')" font-size="10" font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle" fill="#334155">' + escapeXmlText(leftHeightLabel) + "</text>";
        }

        const antSet = new Set();
        const compSet = new Set();
        const depthWarnSet = new Set();
        (analysis.antagonistPairs || []).forEach(function (pr) { antSet.add(pr.cropA); antSet.add(pr.cropB); });
        (analysis.companionPairs || []).forEach(function (pr) { compSet.add(pr.cropA); compSet.add(pr.cropB); });
        (analysis.depthWarnings || []).forEach(function (dw) { depthWarnSet.add(dw.cropName); });

        let nodesSvg = "";
        bedPlants.forEach(function (pp) {
            const cropObj = (cat && cat.cropMap) ? resolveCrop(cat.cropMap, pp.cropName) : null;
            const canonical = cropObj ? cropObj.name : pp.cropName;
            const rCm = Math.max(1.5, Number(pp.radiusCm) || 8);
            if (isSectionZoom && (pp.xCm + rCm < viewStartCm - 1 || pp.xCm - rCm > viewEndCm + 1)) return;

            const col = getCategoryColor((cropObj && cropObj.category) || "Vegetable");
            const code = (cropObj && cropObj.shortCode) || String(canonical || "PL").slice(0, 3).toUpperCase();
            const isAnt = antSet.has(canonical);
            const isDW = depthWarnSet.has(canonical);
            const strokeCol = isAnt ? "#dc2626" : (isDW ? "#d97706" : col);

            const cx = mapX(Number(pp.xCm) || 0);
            const cy = mapY(Number(pp.yCm) || 0);
            const rPx = Math.max(3.2, rCm * scale);
            const stemR = clamp(rPx * 0.22, 1.5, 4.2);
            const labelFont = clamp(rPx * 0.56, 7, 11);
            const labelY = rPx >= 13 ? (cy + stemR + labelFont * 0.98) : (cy + labelFont * 0.35);

            nodesSvg += '<g>' +
                '<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + rPx.toFixed(2) + '" fill="' + escapeXmlText(col) + '" fill-opacity="0.28" stroke="' + escapeXmlText(strokeCol) + '" stroke-width="' + (isAnt ? "1.8" : "1.3") + '"' + (isAnt ? ' stroke-dasharray="3 2"' : "") + "/>" +
                '<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + stemR.toFixed(2) + '" fill="' + escapeXmlText(col) + '" stroke="#ffffff" stroke-width="0.9"/>' +
                (showLabels && rPx >= 8.5
                    ? '<text x="' + cx.toFixed(2) + '" y="' + labelY.toFixed(2) + '" text-anchor="middle" font-size="' + labelFont.toFixed(1) + '" font-family="system-ui, sans-serif" font-weight="800" fill="#0f172a" stroke="#ffffff" stroke-width="2.4" paint-order="stroke">' + escapeXmlText(code) + "</text>"
                    : "") +
                "<title>" + escapeXmlText(canonical + " (" + (pp.role || "primary") + ") · (" + formatCleanNum(pp.xCm, 1) + ", " + formatCleanNum(pp.yCm, 1) + " cm)") + "</title>" +
            "</g>";
        });

        // Bottom Species Tally Legend
        const legendTop = plotAreaTop + plotBoxH + 14;
        const tally = analysis.speciesTally || [];
        const cols = tally.length >= 9 ? 3 : 2;
        const rowsCount = Math.max(1, Math.ceil(tally.length / cols));
        const colW = (titleW - 28) / cols;

        const notesParts = [];
        if (analysis.companionPairs && analysis.companionPairs.length) {
            notesParts.push("Companions: " + analysis.companionPairs.slice(0, 3).map(function (c2) { return c2.cropA + " + " + c2.cropB; }).join("; "));
        }
        if (analysis.antagonistPairs && analysis.antagonistPairs.length) {
            notesParts.push("Conflict: " + analysis.antagonistPairs.slice(0, 2).map(function (a2) { return a2.cropA + " / " + a2.cropB; }).join("; "));
        }
        if (analysis.depthWarnings && analysis.depthWarnings.length) {
            notesParts.push("Depth Watch: " + analysis.depthWarnings.slice(0, 2).map(function (d2) { return d2.cropName; }).join(", "));
        }
        const notesLine = notesParts.join("  |  ");
        const legendH = 38 + rowsCount * 22 + (notesLine ? 20 : 0) + 22;
        const sheetH = legendTop + legendH + 16;

        let legendItemsSvg = "";
        if (tally.length === 0) {
            legendItemsSvg = '<text x="' + (titleX + 14) + '" y="' + (legendTop + 44) + '" font-size="11" font-family="system-ui, sans-serif" fill="#475569">No individual plants placed yet — open Plant Playground to drop specimens or apply recommended density.</text>';
        } else {
            tally.forEach(function (sp, idx) {
                const cIdx = idx % cols;
                const rIdx = Math.floor(idx / cols);
                const lx = titleX + 14 + cIdx * colW;
                const ly = legendTop + 42 + rIdx * 22;
                const labelTxt = sp.shortCode + " · " + sp.cropName + " — " + sp.count + " (Rec: " + sp.recommendedPerSqFt + "/ft²)";
                legendItemsSvg +=
                    '<circle cx="' + (lx + 6).toFixed(1) + '" cy="' + (ly - 3.5).toFixed(1) + '" r="5" fill="' + escapeXmlText(sp.color) + '" fill-opacity="0.85" stroke="#0f172a" stroke-width="0.6"/>' +
                    '<text x="' + (lx + 17).toFixed(1) + '" y="' + ly.toFixed(1) + '" font-size="10.5" font-family="system-ui, sans-serif" font-weight="600" fill="#0f172a">' + escapeXmlText(labelTxt) + "</text>";
            });
        }

        const stampX = sheetW - 236;
        const metaRow1 = "Space Type: " + spaceType + "  |  Dimensions: " + dimText + "  |  Surface Area: " + areaText + (volText ? ("  |  Volume: " + volText) : "");
        let mediaLinesSvg = "";
        mediaLines.forEach(function (ln, li) {
            mediaLinesSvg += '<text x="' + (titleX + 14) + '" y="' + (titleY + 66 + li * 15) + '" font-size="10.5" font-family="system-ui, sans-serif" fill="#334155">' + escapeXmlText(ln) + "</text>";
        });

        const footerY = legendTop + legendH - 8;
        const notesSvg = notesLine
            ? ('<text x="' + (titleX + 14) + '" y="' + (footerY - 18) + '" font-size="9.8" font-family="system-ui, sans-serif" font-weight="600" fill="#475569">' + escapeXmlText(notesLine) + "</text>")
            : "";

        return '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + sheetW + " " + sheetH + '" width="' + sheetW + '" height="' + sheetH + '">\n' +
            "  <defs>\n" +
            (defsSvg ? "    " + defsSvg + "\n" : "") +
            "  </defs>\n" +
            '  <rect x="0" y="0" width="' + sheetW + '" height="' + sheetH + '" fill="#ffffff"/>\n' +
            '  <rect x="8" y="8" width="' + (sheetW - 16) + '" height="' + (sheetH - 16) + '" fill="none" stroke="#1e293b" stroke-width="1.5" rx="4"/>\n' +
            '  <rect x="' + titleX + '" y="' + titleY + '" width="' + titleW + '" height="' + titleH + '" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2" rx="4"/>\n' +
            '  <text x="' + (titleX + 14) + '" y="' + (titleY + 24) + '" font-size="15.5" font-family="system-ui, sans-serif" font-weight="800" fill="#0f172a">' + escapeXmlText(titleBase) + " — Planting Blueprint</text>\n" +
            '  <text x="' + (titleX + 14) + '" y="' + (titleY + 44) + '" font-size="10.5" font-family="system-ui, sans-serif" font-weight="600" fill="#1e293b">' + escapeXmlText(metaRow1) + "</text>\n" +
            "  " + mediaLinesSvg + "\n" +
            '  <rect x="' + stampX + '" y="' + (titleY + 8) + '" width="212" height="' + (titleH - 16) + '" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" rx="3"/>\n' +
            '  <text x="' + (stampX + 10) + '" y="' + (titleY + 26) + '" font-size="10.5" font-family="system-ui, sans-serif" font-weight="800" fill="#166534">' + escapeXmlText(analysis.totalPlants + " Plants (" + analysis.actualPlantsPerSqFt + " / ft²)") + "</text>\n" +
            '  <text x="' + (stampX + 10) + '" y="' + (titleY + 43) + '" font-size="9.8" font-family="system-ui, sans-serif" fill="#475569">Grid: ' + escapeXmlText(showGrid ? gridLabel : "Hidden") + "</text>\n" +
            '  <text x="' + (stampX + 10) + '" y="' + (titleY + 59) + '" font-size="9.8" font-family="system-ui, sans-serif" fill="#475569">Canopy Fill: ' + escapeXmlText(analysis.canopyFillPct + "% (" + analysis.healthStatus.toUpperCase() + ")") + "</text>\n" +
            '  <text x="' + (stampX + 10) + '" y="' + (titleY + 75) + '" font-size="9" font-family="system-ui, sans-serif" fill="#64748b">West Coast Plant Project</text>\n' +
            '  <rect x="' + titleX + '" y="' + plotAreaTop + '" width="' + titleW + '" height="' + plotBoxH + '" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" rx="4"/>\n' +
            "  " + outlineSvg + "\n" +
            "  " + gridSvg + "\n" +
            "  " + dimLinesSvg + "\n" +
            "  " + nodesSvg + "\n" +
            '  <rect x="' + titleX + '" y="' + legendTop + '" width="' + titleW + '" height="' + legendH + '" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2" rx="4"/>\n' +
            '  <text x="' + (titleX + 14) + '" y="' + (legendTop + 20) + '" font-size="11.5" font-family="system-ui, sans-serif" font-weight="800" fill="#0f172a">Species Tally &amp; Density Legend</text>\n' +
            '  <text x="' + (sheetW - 30) + '" y="' + (legendTop + 20) + '" font-size="10" font-family="system-ui, sans-serif" font-weight="600" text-anchor="end" fill="#475569">' + escapeXmlText(tally.length + " species · " + analysis.totalPlants + " total specimens · " + analysis.actualPlantsPerSqFt + " plants/ft²") + "</text>\n" +
            '  <line x1="' + (titleX + 12) + '" y1="' + (legendTop + 27) + '" x2="' + (sheetW - 28) + '" y2="' + (legendTop + 27) + '" stroke="#e2e8f0" stroke-width="1"/>\n' +
            "  " + legendItemsSvg + "\n" +
            "  " + notesSvg + "\n" +
            '  <text x="' + (titleX + 14) + '" y="' + footerY + '" font-size="9.2" font-family="system-ui, sans-serif" fill="#64748b">West Coast Plant Project · Garden Bed Designer Printable Blueprint</text>\n' +
            '  <text x="' + (sheetW - 30) + '" y="' + footerY + '" font-size="9.2" font-family="system-ui, sans-serif" text-anchor="end" fill="#64748b">Units: ' + (isImp ? "Imperial (ft / in)" : "Metric (m / cm)") + "</text>\n" +
            "</svg>";
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
        const defs = defaults || {};
        const src = (b && typeof b === "object") ? b : {};
        const rawType = String(src.type || "").toLowerCase();
        const type = BLOCK_TYPES.indexOf(rawType) !== -1
            ? rawType
            : (src.isGreenhouse ? "greenhouse" : "field");
        const isContainer = isContainerBlockType(type);

        const isCustomReq = src.shapeType === "custom" && src.customShape;
        const customShape = isCustomReq ? validateAndNormalizeCustomShape(src.customShape) : null;
        if (customShape) {
            const geom = computeCustomShapeGeometry(customShape);
            const widthM = geom ? Math.max(0.5, +(geom.widthCm / 100).toFixed(2)) : Math.max(0.5, Number(src.bedLengthM ?? defs.bedLengthM ?? 2.4));
            const heightCm = geom ? Math.max(20, +geom.heightCm.toFixed(1)) : Math.max(20, Number(src.bedWidthCm ?? defs.bedWidthCm ?? 75));
            const areaM2 = geom ? geom.areaM2 : +(widthM * (heightCm / 100)).toFixed(3);
            const customSpec = src.containerSpec ? normalizeContainerSpec(src.containerSpec, type, src) : null;
            const customMedia = src.growingMedia ? normalizeGrowingMedia(src.growingMedia, type) : null;
            const customVol = (customSpec && customSpec.depthCm > 0)
                ? +((areaM2 * 10000 * customSpec.depthCm) / 1000).toFixed(1)
                : (Number.isFinite(Number(src.volumeLiters)) && Number(src.volumeLiters) > 0 ? +Number(src.volumeLiters).toFixed(1) : null);
            const outCustom = {
                id: src.id || ("block_" + (idx + 1)),
                name: src.name || customShape.name || ("Block " + (idx + 1)),
                type: type,
                shapeType: "custom",
                customShape: customShape,
                containerSpec: customSpec,
                growingMedia: customMedia,
                bedCount: 1,
                bedLengthM: widthM,
                bedWidthCm: heightCm,
                areaM2: areaM2,
                pathWidthCm: Math.max(10, Number(src.pathWidthCm ?? defs.pathWidthCm ?? 30)),
                angleDeg: Number.isFinite(Number(src.angleDeg ?? src.angle)) ? Number(src.angleDeg ?? src.angle) : 0,
                beginningYear: Number(src.beginningYear ?? 2025),
                isFallow: Boolean(src.isFallow ?? src.fallow),
                x: Number.isFinite(Number(src.x)) ? Number(src.x) : 40 + (idx % 2) * 320,
                y: Number.isFinite(Number(src.y)) ? Number(src.y) : 40 + Math.floor(idx / 2) * 200
            };
            if (customVol !== null) outCustom.volumeLiters = customVol;
            return outCustom;
        }

        if (isContainer) {
            const cSpec = normalizeContainerSpec(src.containerSpec, type, src);
            const geom = computeContainerGeometry(cSpec, type);
            const media = normalizeGrowingMedia(src.growingMedia, type);
            return {
                id: src.id || ("block_" + (idx + 1)),
                name: src.name || (type === "basket" ? "Hanging Basket" : (type === "bench" ? "Growing Bench" : "Container Pot")) + " " + (idx + 1),
                type: type,
                shapeType: geom.shapeKind === "circle" ? "circle" : "rectangle",
                customShape: null,
                containerSpec: cSpec,
                growingMedia: media,
                bedCount: 1,
                bedLengthM: +((geom.shapeKind === "circle" ? geom.diameterCm : geom.lengthCm) / 100).toFixed(3),
                bedWidthCm: +(geom.shapeKind === "circle" ? geom.diameterCm : geom.widthCm).toFixed(1),
                areaM2: geom.surfaceAreaM2,
                volumeLiters: geom.volumeLiters,
                pathWidthCm: Math.max(5, Number(src.pathWidthCm ?? 20)),
                angleDeg: Number.isFinite(Number(src.angleDeg ?? src.angle)) ? Number(src.angleDeg ?? src.angle) : 0,
                beginningYear: Number(src.beginningYear ?? 2025),
                isFallow: Boolean(src.isFallow ?? src.fallow),
                x: Number.isFinite(Number(src.x)) ? Number(src.x) : 40 + (idx % 2) * 320,
                y: Number.isFinite(Number(src.y)) ? Number(src.y) : 40 + Math.floor(idx / 2) * 200
            };
        }

        const bedCount = Math.max(1, Math.round(Number(src.bedCount ?? src.beds ?? 4)));
        const bedLengthM = Math.max(0.5, Number(src.bedLengthM ?? defs.bedLengthM ?? 30));
        const bedWidthCm = Math.max(20, Number(src.bedWidthCm ?? defs.bedWidthCm ?? 75));
        const areaM2 = +(bedCount * bedLengthM * (bedWidthCm / 100)).toFixed(3);
        const fieldSpec = src.containerSpec ? normalizeContainerSpec(src.containerSpec, type, src) : null;
        const fieldMedia = src.growingMedia ? normalizeGrowingMedia(src.growingMedia, type) : null;
        const outField = {
            id: src.id || ("block_" + (idx + 1)),
            name: src.name || ("Block " + (idx + 1)),
            type: type,
            shapeType: "rectangle",
            customShape: null,
            containerSpec: fieldSpec,
            growingMedia: fieldMedia,
            bedCount: bedCount,
            bedLengthM: bedLengthM,
            bedWidthCm: bedWidthCm,
            areaM2: areaM2,
            pathWidthCm: Math.max(10, Number(src.pathWidthCm ?? defs.pathWidthCm ?? 30)),
            angleDeg: Number.isFinite(Number(src.angleDeg ?? src.angle)) ? Number(src.angleDeg ?? src.angle) : 0,
            beginningYear: Number(src.beginningYear ?? 2025),
            isFallow: Boolean(src.isFallow ?? src.fallow),
            x: Number.isFinite(Number(src.x)) ? Number(src.x) : 40 + (idx % 2) * 320,
            y: Number.isFinite(Number(src.y)) ? Number(src.y) : 40 + Math.floor(idx / 2) * 200
        };
        if (fieldSpec && fieldSpec.depthCm > 0) {
            outField.volumeLiters = +((areaM2 * 10000 * fieldSpec.depthCm) / 1000).toFixed(1);
        }
        return outField;
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
        const rawMode = p.interplantMode;
        const interplantMode = INTERPLANT_MODES.indexOf(rawMode) !== -1
            ? rawMode
            : (p.interplanted === true ? "border" : "sole");
        const interplanted = interplantMode !== "sole";
        const rawShare = Number(p.interplantSharePct);
        const interplantSharePct = Number.isFinite(rawShare) && rawShare > 0 ? clamp(Math.round(rawShare), 15, 85) : 50;
        const interplantHostId = (typeof p.interplantHostId === "string" && p.interplantHostId.trim()) ? p.interplantHostId.trim() : null;
        const borderSides = Number(p.borderSides) === 1 ? 1 : 2;
        const laneIndex = (p.laneIndex !== undefined && p.laneIndex !== null && Number.isFinite(Number(p.laneIndex)))
            ? Math.max(0, Math.round(Number(p.laneIndex)))
            : undefined;
        const placedCountOverride = (p.placedCountOverride !== undefined && p.placedCountOverride !== null && Number(p.placedCountOverride) > 0)
            ? Math.max(1, Math.round(Number(p.placedCountOverride)))
            : undefined;
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
            interplanted: interplanted,
            interplantMode: interplantMode,
            interplantSharePct: interplantSharePct,
            interplantHostId: interplantHostId,
            borderSides: borderSides,
            laneIndex: laneIndex,
            placedCountOverride: placedCountOverride,
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

    function normalizeSeason(season, yrKey, defaults) {
        const s = (season && typeof season === "object") ? season : {};
        const yr = Number(s.year || yrKey || 2026);
        const defs = defaults || { bedWidthCm: 75, pathWidthCm: 30, bedLengthM: 30, benchAreaM2: 40 };
        const blocks = (Array.isArray(s.blocks) ? s.blocks : []).map(function (b, idx) {
            return normalizeBlock(b, defs, idx);
        });
        const tunnels = (Array.isArray(s.tunnels) ? s.tunnels : []).map(normalizeTunnel);
        const plantings = (Array.isArray(s.plantings) ? s.plantings : []).map(function (p, idx) {
            const norm = normalizePlanting(p, idx, yr);
            if (p && p.harvestStartDate) norm.harvestStartDate = p.harvestStartDate;
            if (p && p.harvestEndDate) norm.harvestEndDate = p.harvestEndDate;
            if (p && p.seedingDate) norm.seedingDate = p.seedingDate;
            if (p && p.transplantDate) norm.transplantDate = p.transplantDate;
            if (p && p.pottingUpDate) norm.pottingUpDate = p.pottingUpDate;
            if (p && p.effectiveDtm !== undefined) norm.effectiveDtm = p.effectiveDtm;
            return norm;
        });
        const placedPlants = (Array.isArray(s.placedPlants) ? s.placedPlants : []).map(function (pp, idx) {
            return normalizePlacedPlant(pp, idx, yr);
        });
        const completedTaskIds = Array.isArray(s.completedTaskIds) ? s.completedTaskIds.slice() : [];
        return {
            year: yr,
            blocks: blocks,
            tunnels: tunnels,
            plantings: plantings,
            placedPlants: placedPlants,
            completedTaskIds: completedTaskIds
        };
    }

    function normalizeStateInPlace(state) {
        if (!state || !state.seasons || typeof state.seasons !== "object") return state;
        const defaults = state.farmDefaults || { bedWidthCm: 75, pathWidthCm: 30, bedLengthM: 30, benchAreaM2: 40 };
        Object.keys(state.seasons).forEach(function (yrKey) {
            const s = state.seasons[yrKey];
            if (!s) return;
            state.seasons[yrKey] = normalizeSeason(s, yrKey || state.activeSeason || 2026, defaults);
        });
        return state;
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
                seasons[yr] = normalizeSeason({
                    year: yr,
                    blocks: s.blocks || src.blocks || [],
                    tunnels: s.tunnels || src.tunnels || [],
                    plantings: s.plantings || [],
                    placedPlants: s.placedPlants || [],
                    completedTaskIds: s.completedTaskIds || []
                }, yr, defaults);
            });
        } else {
            const baseBlocks = (src.blocks || []).map(function (b, idx) { return normalizeBlock(b, defaults, idx); });
            const baseTunnels = (src.tunnels || []).map(normalizeTunnel);
            seasons[activeSeason] = normalizeSeason({
                year: activeSeason,
                blocks: baseBlocks,
                tunnels: baseTunnels,
                plantings: src.plantings || [],
                placedPlants: src.placedPlants || [],
                completedTaskIds: []
            }, activeSeason, defaults);
            const hist = src.history2025 || src.rotationHistory;
            if (Array.isArray(hist)) {
                const prevYr = activeSeason - 1;
                seasons[prevYr] = normalizeSeason({
                    year: prevYr,
                    blocks: JSON.parse(JSON.stringify(baseBlocks)),
                    tunnels: JSON.parse(JSON.stringify(baseTunnels)),
                    plantings: hist,
                    placedPlants: [],
                    completedTaskIds: []
                }, prevYr, defaults);
            }
        }

        if (!seasons[activeSeason]) {
            const years = Object.keys(seasons).map(Number).sort(function (a, b) { return b - a; });
            if (years.length) {
                const latest = seasons[years[0]];
                seasons[activeSeason] = normalizeSeason({
                    year: activeSeason,
                    blocks: JSON.parse(JSON.stringify(latest.blocks)),
                    tunnels: JSON.parse(JSON.stringify(latest.tunnels)),
                    plantings: [],
                    placedPlants: [],
                    completedTaskIds: []
                }, activeSeason, defaults);
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

        const restored = normalizeStateInPlace(cloneState(entry.state));
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
                const restored = normalizeStateInPlace(cloneState(entry.state));
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
            // Strip derived planting dates & compact customShape / containerSpec / growingMedia / placedPlants so URL hash stays compact
            Object.keys(payload.seasons || {}).forEach(function (yr) {
                const s = payload.seasons[yr];
                if (!s) return;
                if (Array.isArray(s.blocks)) {
                    s.blocks.forEach(function (b) {
                        if (!b) return;
                        if (b.shapeType === "custom" && b.customShape) {
                            const normShape = validateAndNormalizeCustomShape(b.customShape);
                            if (normShape) {
                                b.shapeType = "custom";
                                b.customShape = {
                                    id: normShape.id,
                                    name: normShape.name,
                                    units: normShape.units,
                                    gridStepCm: normShape.gridStepCm,
                                    pts: normShape.points.map(function (pt) {
                                        const x = +pt.x.toFixed(1);
                                        const y = +pt.y.toFixed(1);
                                        return pt.curve
                                            ? [x, y, +pt.curve.cx.toFixed(1), +pt.curve.cy.toFixed(1)]
                                            : [x, y];
                                    })
                                };
                            } else {
                                delete b.customShape;
                                delete b.shapeType;
                            }
                        } else {
                            delete b.customShape;
                            if (b.shapeType !== "circle") delete b.shapeType;
                            delete b.areaM2;
                        }
                        delete b.volumeLiters;

                        if (b.containerSpec && typeof b.containerSpec === "object") {
                            const cs = {};
                            if (b.containerSpec.presetId) cs.p = b.containerSpec.presetId;
                            if (b.containerSpec.shapeKind) cs.s = b.containerSpec.shapeKind;
                            if (b.containerSpec.diameterCm) cs.d = +Number(b.containerSpec.diameterCm).toFixed(1);
                            if (b.containerSpec.widthCm) cs.w = +Number(b.containerSpec.widthCm).toFixed(1);
                            if (b.containerSpec.lengthCm) cs.l = +Number(b.containerSpec.lengthCm).toFixed(1);
                            if (b.containerSpec.depthCm) cs.h = +Number(b.containerSpec.depthCm).toFixed(1);
                            if (b.containerSpec.bowlFactor && b.containerSpec.bowlFactor !== 1) cs.f = +Number(b.containerSpec.bowlFactor).toFixed(2);
                            b.containerSpec = cs;
                        } else {
                            delete b.containerSpec;
                        }

                        if (b.growingMedia && typeof b.growingMedia === "object") {
                            const gm = normalizeGrowingMedia(b.growingMedia, b.type);
                            const compactGm = {
                                p: gm.presetId,
                                i: gm.ingredients.map(function (it) { return [it.id, it.pct]; })
                            };
                            if (gm.name && gm.presetId === "custom") compactGm.n = gm.name;
                            if (gm.notes) compactGm.notes = gm.notes;
                            b.growingMedia = compactGm;
                        } else {
                            delete b.growingMedia;
                        }
                    });
                }

                if (Array.isArray(s.placedPlants) && s.placedPlants.length > 0) {
                    s.placedPlants = s.placedPlants.map(function (pp) {
                        const row = [
                            pp.blockId || "",
                            Math.max(1, Math.round(Number(pp.bedNumber || 1))),
                            pp.cropName || "Carrot",
                            +Number(pp.xCm || 0).toFixed(1),
                            +Number(pp.yCm || 0).toFixed(1),
                            +Number(pp.radiusCm || 10).toFixed(1),
                            pp.role || "primary"
                        ];
                        if (pp.notes) {
                            row.push(pp.startDate || "", pp.notes);
                        } else if (pp.startDate && pp.startDate !== (yr + "-05-01")) {
                            row.push(pp.startDate);
                        }
                        return row;
                    });
                } else {
                    delete s.placedPlants;
                }

                if (!Array.isArray(s.plantings)) return;
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
                normalizedSeasons[yr] = normalizeSeason(s, yr, defaults);
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
        const idMap = {};
        const newPlantings = (src.plantings || []).map(function (p) {
            const copy = JSON.parse(JSON.stringify(p));
            const newId = generateId("pl");
            if (p.id) idMap[p.id] = newId;
            copy.id = newId;
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
        newPlantings.forEach(function (copy) {
            if (copy.interplantHostId && idMap[copy.interplantHostId]) {
                copy.interplantHostId = idMap[copy.interplantHostId];
            } else if (copy.interplantHostId && !idMap[copy.interplantHostId]) {
                copy.interplantHostId = null;
            }
        });

        const newPlacedPlants = (src.placedPlants || [])
            .filter(function (pp) { return pp && (!pp.blockId || validBlockIds.has(pp.blockId)); })
            .map(function (pp, idx) {
                const copy = normalizePlacedPlant(pp, idx, yrTo);
                copy.id = generateId("pp");
                if (pp.startDate) copy.startDate = shiftIsoYear(pp.startDate, yrFrom, yrTo);
                return copy;
            });

        state.seasons[yrTo] = {
            year: yrTo,
            blocks: newBlocks,
            tunnels: newTunnels,
            plantings: newPlantings,
            placedPlants: newPlacedPlants,
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

                const mode = getEffectiveInterplantMode(p);
                const entry = {
                    year: yr,
                    plantingId: p.id,
                    cropName: crop ? crop.name : p.cropName,
                    family: family,
                    rotationYears: rotYears,
                    interplanted: mode !== "sole",
                    interplantMode: mode,
                    nutrientDemand: (crop && crop.nutrientDemand) || "Medium"
                };
                history.push(entry);

                if (family !== "Unknown" && isPrimarySoilMode(mode)) {
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
    function computePlantingMetrics(planting, crop, block, optionsOpt) {
        const p = planting || {};
        const c = crop || {};
        const b = block || {};
        const opts = (optionsOpt && typeof optionsOpt === "object") ? optionsOpt : {};
        const units = typeof optionsOpt === "string" ? optionsOpt : (opts.units || "metric");

        const interplantMode = getEffectiveInterplantMode(p);
        const sharePct = clamp(Number(p.interplantSharePct ?? 50) || 50, 15, 85);
        const shareFrac = sharePct / 100;
        const borderSides = Number(p.borderSides) === 1 ? 1 : 2;

        const customShapeNorm = (b && b.shapeType === "custom" && b.customShape)
            ? validateAndNormalizeCustomShape(b.customShape)
            : null;
        const isCustomShape = Boolean(customShapeNorm);
        const customGeom = isCustomShape ? computeCustomShapeGeometry(customShapeNorm) : null;
        const isContainer = Boolean(!isCustomShape && b && (isContainerBlockType(b.type) || b.containerSpec));
        const containerGeom = isContainer ? computeContainerGeometry(b.containerSpec || b, b.type || "pot") : null;

        const bedCount = (isCustomShape || isContainer) ? 1 : Math.max(0.1, Number(p.bedCount ?? 1));
        const blockLengthM = customGeom
            ? Math.max(0.5, +(customGeom.widthCm / 100).toFixed(2))
            : (containerGeom
                ? Math.max(0.1, +(containerGeom.lengthCm / 100).toFixed(3))
                : Math.max(0.5, Number(p.bedLengthM ?? b.bedLengthM ?? 30)));
        const bedWidthCm = customGeom
            ? Math.max(20, +customGeom.heightCm.toFixed(1))
            : (containerGeom
                ? Math.max(8, +containerGeom.widthCm.toFixed(1))
                : Math.max(20, Number(p.bedWidthCm ?? b.bedWidthCm ?? 75)));

        const baseRowsPerBed = Math.max(1, Math.round(Number(p.rowsPerBed ?? c.rowsPerBed ?? 2)));
        const inRowCm = Math.max(1, Number(p.inRowCm ?? c.inRowCm ?? 25));
        const betweenRowCm = Math.max(1, Number(p.betweenRowCm ?? c.betweenRowCm ?? Math.max(8, Math.round(bedWidthCm / (baseRowsPerBed + 0.5)))));

        let bedLengthUsedM = +(bedCount * blockLengthM).toFixed(2);
        let rowsPerBed = baseRowsPerBed;
        let plants = 1;
        let effectiveAreaM2 = 0;
        let yieldScale = bedLengthUsedM / 30;

        if (isCustomShape && customGeom) {
            const shapePts = generateCustomShapePlantPoints(customShapeNorm, inRowCm, betweenRowCm, interplantMode, {
                sharePct: shareFrac,
                laneIndex: opts.laneIndex ?? p.laneIndex ?? 0
            });
            plants = Math.max(1, shapePts.count);
            effectiveAreaM2 = +Math.max(0.01, shapePts.areaM2 || 0).toFixed(3);
            if (interplantMode === "border") {
                bedLengthUsedM = +customGeom.perimeterM.toFixed(2);
                rowsPerBed = 1;
            } else if (interplantMode === "lanes") {
                bedLengthUsedM = +(effectiveAreaM2 / Math.max(0.2, bedWidthCm / 100)).toFixed(2);
                rowsPerBed = Math.max(1, Math.round(baseRowsPerBed * shareFrac));
            } else if (interplantMode === "relay") {
                bedLengthUsedM = +(effectiveAreaM2 / Math.max(0.2, bedWidthCm / 100)).toFixed(2);
                rowsPerBed = baseRowsPerBed >= 2 ? Math.max(1, baseRowsPerBed - 1) : 1;
            } else {
                bedLengthUsedM = +(effectiveAreaM2 / Math.max(0.2, bedWidthCm / 100)).toFixed(2);
                rowsPerBed = baseRowsPerBed;
            }
            const standardPlantsPer30m = Math.max(1, (3000 / inRowCm) * baseRowsPerBed);
            yieldScale = plants / standardPlantsPer30m;
        } else if (isContainer && containerGeom) {
            const fullAreaM2 = containerGeom.surfaceAreaM2;
            const density = computeRecommendedDensity(crop || p.cropName, _cachedCatalog, containerGeom);
            const solePlants = Math.max(1, density.recommendedCountForArea(containerGeom.surfaceAreaFt2));
            let modeFrac = 1.0;
            if (interplantMode === "lanes") {
                modeFrac = shareFrac;
                rowsPerBed = Math.max(1, Math.round(baseRowsPerBed * shareFrac));
            } else if (interplantMode === "border") {
                modeFrac = 0.35;
                rowsPerBed = 1;
            } else if (interplantMode === "understory") {
                modeFrac = 0.85;
                rowsPerBed = baseRowsPerBed;
            } else if (interplantMode === "relay") {
                modeFrac = 0.5;
                rowsPerBed = baseRowsPerBed >= 2 ? Math.max(1, baseRowsPerBed - 1) : 1;
            } else {
                rowsPerBed = baseRowsPerBed;
            }
            plants = Math.max(1, Math.round(solePlants * modeFrac));
            effectiveAreaM2 = +Math.max(0.005, fullAreaM2 * modeFrac).toFixed(4);
            bedLengthUsedM = +(effectiveAreaM2 / Math.max(0.1, bedWidthCm / 100)).toFixed(2);
            const standardPlantsPer30m = Math.max(1, (3000 / inRowCm) * baseRowsPerBed);
            yieldScale = plants / standardPlantsPer30m;
        } else {
            const fullAreaM2 = +(bedLengthUsedM * (bedWidthCm / 100)).toFixed(3);
            const solePlants = Math.max(1, Math.round(((bedLengthUsedM * 100) / inRowCm) * baseRowsPerBed));

            if (interplantMode === "lanes") {
                rowsPerBed = Math.max(1, Math.round(baseRowsPerBed * shareFrac));
                plants = Math.max(1, Math.round(solePlants * shareFrac));
                effectiveAreaM2 = +(fullAreaM2 * shareFrac).toFixed(3);
                yieldScale = (bedLengthUsedM / 30) * shareFrac;
            } else if (interplantMode === "border") {
                const edgeLengthM = +(borderSides * bedLengthUsedM).toFixed(2);
                rowsPerBed = borderSides;
                plants = Math.max(1, Math.round((edgeLengthM * 100) / inRowCm));
                const stripWidthM = clamp(betweenRowCm, 12, 30) / 100;
                effectiveAreaM2 = +Math.min(fullAreaM2, edgeLengthM * stripWidthM).toFixed(3);
                yieldScale = (edgeLengthM / Math.max(1, baseRowsPerBed)) / 30;
            } else if (interplantMode === "understory") {
                rowsPerBed = baseRowsPerBed;
                plants = Math.max(1, Math.round(solePlants * 0.85));
                effectiveAreaM2 = +(fullAreaM2 * 0.85).toFixed(3);
                yieldScale = (bedLengthUsedM / 30) * 0.85;
            } else if (interplantMode === "relay") {
                const alleyRows = baseRowsPerBed >= 2 ? Math.max(1, baseRowsPerBed - 1) : 0.5;
                const relayFrac = baseRowsPerBed >= 2 ? (alleyRows / baseRowsPerBed) : 0.5;
                rowsPerBed = baseRowsPerBed >= 2 ? alleyRows : 1;
                plants = Math.max(1, Math.round(((bedLengthUsedM * 100) / inRowCm) * alleyRows));
                effectiveAreaM2 = +(fullAreaM2 * relayFrac).toFixed(3);
                yieldScale = (bedLengthUsedM / 30) * relayFrac;
            } else {
                rowsPerBed = baseRowsPerBed;
                plants = solePlants;
                effectiveAreaM2 = fullAreaM2;
                yieldScale = bedLengthUsedM / 30;
            }
        }

        if (Number.isFinite(Number(p.placedCountOverride)) && Number(p.placedCountOverride) > 0) {
            plants = Math.max(1, Math.round(Number(p.placedCountOverride)));
            const standardPlantsPer30m = Math.max(1, (3000 / inRowCm) * baseRowsPerBed);
            yieldScale = plants / standardPlantsPer30m;
        }

        const bedLengthUsedFt = +(bedLengthUsedM * 3.28084).toFixed(1);
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
        const estYield = +(yieldScale * yieldPer30m).toFixed(1);
        const yieldUnit = p.yieldUnit || c.yieldUnit || "kg";
        const typicalPriceCad = Math.max(0, Number(p.typicalPriceCad ?? c.typicalPriceCad ?? 0));
        const estValueCad = +(estYield * typicalPriceCad).toFixed(2);

        return {
            bedCount: bedCount,
            bedLengthUsedM: bedLengthUsedM,
            bedLengthUsedFt: bedLengthUsedFt,
            effectiveAreaM2: effectiveAreaM2,
            interplantMode: interplantMode,
            interplantSharePct: sharePct,
            borderSides: borderSides,
            isCustomShape: isCustomShape,
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
            units: units
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

    function getPlantingWidthPctOnBed(p, bedNumber) {
        const mode = getEffectiveInterplantMode(p);
        if (!isPrimarySoilMode(mode)) return 0;
        const pStart = Number(p.bedStart || bedNumber || 1);
        const bedCount = Math.max(0.1, Number(p.bedCount ?? 1));
        const offset = Math.max(0, Number(bedNumber) - pStart);
        const rem = bedCount - offset;
        const bedFrac = rem >= 1 ? 1.0 : Math.max(0.1, rem);
        if (mode === "sole") return bedFrac * 100;
        const sharePct = clamp(Number(p.interplantSharePct ?? 50) || 50, 15, 85);
        return sharePct * bedFrac;
    }

    function computePeakWidthBudgetPct(entries) {
        if (!Array.isArray(entries) || entries.length === 0) return 0;
        const active = entries.filter(function (e) { return e.widthPct > 0; });
        if (active.length === 0) return 0;
        const pts = [];
        active.forEach(function (e) { pts.push(e.range[0], e.range[1]); });
        pts.sort(function (a, b) { return a - b; });
        let peak = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const s = pts[i];
            const e = pts[i + 1];
            if (e <= s) continue;
            const mid = (s + e) / 2;
            let used = 0;
            for (let j = 0; j < active.length; j++) {
                if (active[j].range[0] <= mid && mid < active[j].range[1]) {
                    used += active[j].widthPct;
                }
            }
            if (used > peak) peak = used;
        }
        return +peak.toFixed(1);
    }

    function analyzeBedInterplanting(blockOrId, bedNumber, seasonData, catalogOpt) {
        const cat = catalogOpt || _cachedCatalog;
        const cropMap = (cat && cat.cropMap) || null;
        const season = seasonData || { blocks: [], tunnels: [], plantings: [] };
        const blocks = season.blocks || [];
        const tunnels = season.tunnels || [];
        const block = typeof blockOrId === "string"
            ? (blocks.find(function (b) { return b.id === blockOrId; }) || { id: blockOrId, name: blockOrId })
            : (blockOrId || blocks[0] || { id: "block", name: "Bed", bedCount: 1 });
        const targetBed = Math.max(1, Math.round(Number(bedNumber) || 1));

        const entries = [];
        (season.plantings || []).forEach(function (p) {
            if (!p || p.blockId !== block.id || !p.bedStart) return;
            const pStart = Number(p.bedStart);
            const pEnd = pStart + Math.max(1, Math.ceil(Number(p.bedCount ?? 1))) - 1;
            if (targetBed < pStart || targetBed > pEnd) return;

            const crop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
            const dates = computePlantingDates(p, crop, block, tunnels, true);
            const range = getPlantingDateRangeMs(Object.assign({}, p, dates), crop, block, tunnels);
            const dims = estimateCropDimensionsCm(crop);
            const canopy = classifyCanopyStratum(crop, dims.heightMidCm);
            const root = parseRootProfile(crop);
            const mode = getEffectiveInterplantMode(p);
            const sharePct = clamp(Number(p.interplantSharePct ?? 50) || 50, 15, 85);
            const widthPct = getPlantingWidthPctOnBed(p, targetBed);

            entries.push({
                raw: p,
                crop: crop,
                range: range,
                id: p.id,
                cropName: crop ? crop.name : p.cropName,
                label: p.label || (crop ? crop.name : p.cropName),
                family: (crop && crop.family) || "Unknown",
                nutrientLevel: NUTRIENT_LEVEL[(crop && crop.nutrientDemand) || "Medium"] ?? 2,
                dtmDays: Number(p.dtmDaysOverride || (crop && crop.dtmDays) || 60),
                interplantMode: mode,
                interplantSharePct: sharePct,
                borderSides: Number(p.borderSides) === 1 ? 1 : 2,
                laneIndex: p.laneIndex,
                startDate: dates.startDate,
                endDate: dates.endDate,
                widthPct: widthPct,
                widthContributionPct: +widthPct.toFixed(1),
                canopyStratum: canopy.canopyStratum,
                heightMidCm: dims.heightMidCm,
                rootStratum: root.rootStratum,
                estimatedRootCm: root.estimatedRootCm,
                color: getCategoryColor((crop && crop.category) || "Vegetable")
            });
        });

        const widthBudgetPct = Math.round(computePeakWidthBudgetPct(entries));
        const companionPairs = [];
        const antagonistPairs = [];
        const overlappingPairs = [];

        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                const a = entries[i];
                const b = entries[j];
                if (!rangesOverlap(a.range[0], a.range[1], b.range[0], b.range[1])) continue;
                overlappingPairs.push([a, b]);

                const rel = pairCompatibility(a.crop, a.cropName, b.crop, b.cropName);
                if (rel === "companion") {
                    companionPairs.push({
                        aId: a.id,
                        bId: b.id,
                        aName: a.label,
                        bName: b.label,
                        aMode: a.interplantMode,
                        bMode: b.interplantMode,
                        reason: a.cropName + " + " + b.cropName + " verified companion pairing"
                    });
                } else if (rel === "conflict") {
                    antagonistPairs.push({
                        aId: a.id,
                        bId: b.id,
                        aName: a.label,
                        bName: b.label,
                        aMode: a.interplantMode,
                        bMode: b.interplantMode,
                        reason: a.cropName + " and " + b.cropName + " are antagonistic when sharing a bed"
                    });
                }
            }
        }

        // Canopy fit evaluation across concurrent overlapping cohorts
        const overlapEntrySet = new Set();
        overlappingPairs.forEach(function (pair) {
            overlapEntrySet.add(pair[0]);
            overlapEntrySet.add(pair[1]);
        });
        const overlapEntries = overlapEntrySet.size > 0 ? Array.from(overlapEntrySet) : entries;
        const canopyStrata = Array.from(new Set(overlapEntries.map(function (e) { return e.canopyStratum; })));
        const rootStrata = Array.from(new Set(overlapEntries.map(function (e) { return e.rootStratum; })));

        let canopyFit = {
            ok: true,
            status: "ok",
            strata: canopyStrata,
            label: "Single canopy layer",
            detail: "No competing canopy shading detected."
        };
        if (overlappingPairs.length > 0) {
            let shadeWarning = null;
            overlappingPairs.forEach(function (pair) {
                const a = pair[0];
                const b = pair[1];
                if (a.interplantMode === "understory" && isPrimarySoilMode(b.interplantMode) && a.heightMidCm > b.heightMidCm * 0.95) {
                    shadeWarning = a.label + " (" + a.heightMidCm + " cm) may over-shade understory host " + b.label + " (" + b.heightMidCm + " cm).";
                } else if (b.interplantMode === "understory" && isPrimarySoilMode(a.interplantMode) && b.heightMidCm > a.heightMidCm * 0.95) {
                    shadeWarning = b.label + " (" + b.heightMidCm + " cm) may over-shade understory host " + a.label + " (" + a.heightMidCm + " cm).";
                }
            });
            if (shadeWarning) {
                canopyFit = {
                    ok: false,
                    status: "caution",
                    strata: canopyStrata,
                    label: "Canopy height mismatch",
                    detail: shadeWarning
                };
            } else if (canopyStrata.length >= 2) {
                canopyFit = {
                    ok: true,
                    status: "good",
                    strata: canopyStrata,
                    label: "Stratified canopy",
                    detail: canopyStrata.length + " vertical canopy tiers (" + canopyStrata.join(" / ") + ")."
                };
            } else {
                canopyFit = {
                    ok: true,
                    status: "ok",
                    strata: canopyStrata,
                    label: "Uniform canopy (" + (canopyStrata[0] || "mid") + ")",
                    detail: "Even-height companions share bed light."
                };
            }
        }

        // Root fit evaluation
        let rootFit = {
            ok: true,
            status: "ok",
            strata: rootStrata,
            label: "Single root zone",
            detail: "No overlapping root competition."
        };
        if (overlappingPairs.length > 0) {
            let rootClash = null;
            overlappingPairs.forEach(function (pair) {
                const a = pair[0];
                const b = pair[1];
                if (a.interplantMode !== "lanes" && b.interplantMode !== "lanes" &&
                    a.rootStratum === b.rootStratum && a.nutrientLevel === 3 && b.nutrientLevel === 3) {
                    rootClash = a.label + " and " + b.label + " both feed heavily in the " + a.rootStratum + " root zone.";
                }
            });
            if (rootStrata.length >= 2 && !rootClash) {
                rootFit = {
                    ok: true,
                    status: "good",
                    strata: rootStrata,
                    label: "Stratified root zones",
                    detail: "Complementary " + rootStrata.join(" + ") + " root depths."
                };
            } else if (rootClash) {
                rootFit = {
                    ok: false,
                    status: "caution",
                    strata: rootStrata,
                    label: "Shared heavy-feeder root zone",
                    detail: rootClash
                };
            } else {
                rootFit = {
                    ok: true,
                    status: "ok",
                    strata: rootStrata,
                    label: "Compatible root depth (" + (rootStrata[0] || "medium") + ")",
                    detail: "Manage moisture evenly across shared root zone."
                };
            }
        }

        // Relay window evaluation
        const relayEntries = entries.filter(function (e) { return e.interplantMode === "relay"; });
        let relayWindowCheck = {
            ok: true,
            status: "ok",
            overlapDays: 0,
            relayCount: relayEntries.length,
            label: "No active relay",
            detail: "No relay catch-crop overlapping on this bed."
        };
        if (relayEntries.length > 0) {
            let maxOverlapDays = 0;
            let tightRelayMsg = null;
            let goodRelayMsg = null;
            relayEntries.forEach(function (relEntry) {
                const peers = entries.filter(function (o) {
                    return o.id !== relEntry.id && isPrimarySoilMode(o.interplantMode) &&
                        rangesOverlap(relEntry.range[0], relEntry.range[1], o.range[0], o.range[1]);
                });
                if (peers.length === 0) {
                    goodRelayMsg = relEntry.label + " sits in open relay space.";
                    return;
                }
                peers.forEach(function (host) {
                    const overlapMs = Math.min(relEntry.range[1], host.range[1]) - Math.max(relEntry.range[0], host.range[0]);
                    const overlapDays = Math.max(1, Math.round(overlapMs / 86400000));
                    const hostDays = Math.max(1, Math.round((host.range[1] - host.range[0]) / 86400000));
                    if (overlapDays > maxOverlapDays) maxOverlapDays = overlapDays;
                    const clearanceDays = Math.round((host.range[1] - relEntry.range[1]) / 86400000);
                    if (clearanceDays < 7 && overlapDays > hostDays * 0.75 && relEntry.dtmDays > 45) {
                        tightRelayMsg = relEntry.label + " overlaps " + host.label + " for " + overlapDays + "d without clearing before full canopy closure.";
                    } else {
                        goodRelayMsg = relEntry.label + " overlaps " + host.label + " for " + overlapDays + "d" +
                            (clearanceDays > 0 ? " (clears " + clearanceDays + "d early)." : ".");
                    }
                });
            });
            if (tightRelayMsg) {
                relayWindowCheck = {
                    ok: false,
                    status: "caution",
                    overlapDays: maxOverlapDays,
                    relayCount: relayEntries.length,
                    label: "Tight relay window",
                    detail: tightRelayMsg
                };
            } else {
                relayWindowCheck = {
                    ok: true,
                    status: "good",
                    overlapDays: maxOverlapDays,
                    relayCount: relayEntries.length,
                    label: "Clean relay window",
                    detail: goodRelayMsg || (relayEntries.length + " relay catch-crop(s) timed cleanly.")
                };
            }
        }

        // Same-family same-bed check for primary/understory crops
        let sameFamilyWarning = null;
        for (let i = 0; i < overlappingPairs.length; i++) {
            const a = overlappingPairs[i][0];
            const b = overlappingPairs[i][1];
            if (a.family !== "Unknown" && a.family === b.family &&
                (a.interplantMode !== "border" || b.interplantMode !== "border")) {
                sameFamilyWarning = a.label + " and " + b.label + " share family " + a.family + " simultaneously.";
                break;
            }
        }

        let healthStatus = "thriving";
        if (widthBudgetPct > 100 || antagonistPairs.length > 0 ||
            canopyFit.status === "conflict" || rootFit.status === "conflict" || relayWindowCheck.status === "conflict") {
            healthStatus = "conflict";
        } else if (canopyFit.status === "caution" || rootFit.status === "caution" ||
            relayWindowCheck.status === "caution" || sameFamilyWarning) {
            healthStatus = "caution";
        }

        const notes = [];
        if (entries.length === 0) {
            notes.push("No active plantings assigned to " + (block.name || "Block") + " Bed " + targetBed + ".");
        } else {
            if (widthBudgetPct > 100) {
                notes.push("Width budget overflow (" + widthBudgetPct + "% > 100%): adjust lane share percentages or switch one crop to Border / Understory / Relay.");
            } else if (widthBudgetPct > 0) {
                notes.push("Bed width budget: " + widthBudgetPct + "% of 100% primary space allocated.");
            }
            if (antagonistPairs.length > 0) {
                notes.push(antagonistPairs[0].reason + ".");
            }
            if (companionPairs.length > 0) {
                notes.push(companionPairs.length + " beneficial companion pairing(s): " + companionPairs.slice(0, 2).map(function (c) { return c.aName + " + " + c.bName; }).join(", ") + ".");
            }
            if (canopyFit.status === "good" || canopyFit.status === "caution") notes.push(canopyFit.detail);
            if (rootFit.status === "good" || rootFit.status === "caution") notes.push(rootFit.detail);
            if (relayEntries.length > 0) notes.push(relayWindowCheck.detail);
            if (sameFamilyWarning) notes.push(sameFamilyWarning);
        }

        const plantingsOut = entries.map(function (e) {
            return {
                id: e.id,
                cropName: e.cropName,
                label: e.label,
                family: e.family,
                interplantMode: e.interplantMode,
                interplantSharePct: e.interplantSharePct,
                borderSides: e.borderSides,
                laneIndex: e.laneIndex,
                startDate: e.startDate,
                endDate: e.endDate,
                widthContributionPct: e.widthContributionPct,
                canopyStratum: e.canopyStratum,
                heightMidCm: e.heightMidCm,
                rootStratum: e.rootStratum,
                estimatedRootCm: e.estimatedRootCm,
                color: e.color
            };
        });

        return {
            blockId: block.id,
            blockName: block.name || "",
            bedNumber: targetBed,
            widthBudgetPct: widthBudgetPct,
            canopyFit: canopyFit,
            rootFit: rootFit,
            relayWindowCheck: relayWindowCheck,
            companionPairs: companionPairs,
            antagonistPairs: antagonistPairs,
            healthStatus: healthStatus,
            notes: notes,
            plantings: plantingsOut
        };
    }

    function checkDropEligibility(planting, targetBlockId, targetBed, seasonData, cropMap, excludeId) {
        const p = planting || {};
        const season = seasonData || {};
        const blocks = season.blocks || [];
        const tunnels = season.tunnels || [];
        const plantings = season.plantings || [];
        const skipId = excludeId !== undefined ? excludeId : p.id;
        const mode = getEffectiveInterplantMode(p);

        const block = blocks.find(function (b) { return b.id === targetBlockId; });
        if (!block) {
            return {
                eligible: false,
                reasonCode: "MISSING_BLOCK",
                message: "Target block not found.",
                conflicts: [],
                canInterplantRescue: false,
                advisoryNotes: [],
                interplantMode: mode
            };
        }

        if (block.isFallow) {
            return {
                eligible: false,
                reasonCode: "FALLOW_BLOCK",
                message: (block.name || "Block") + " is fallow / under cover crop for this season.",
                conflicts: [],
                canInterplantRescue: false,
                advisoryNotes: [],
                interplantMode: mode
            };
        }

        const bedStart = Math.floor(Number(targetBed));
        const bedCount = block.shapeType === "custom" ? 1 : Math.max(0.1, Number(p.bedCount ?? 1));
        const bedSpan = Math.max(1, Math.ceil(bedCount));
        const totalBeds = Math.max(1, Number(block.bedCount || 1));

        if (!Number.isFinite(bedStart) || bedStart < 1 || (bedStart + bedSpan - 1) > totalBeds) {
            return {
                eligible: false,
                reasonCode: "OVERFLOW",
                message: "Needs " + bedSpan + " bed(s) starting at Bed " + bedStart + ", exceeding " + (block.name || "block") + " (" + totalBeds + " beds).",
                conflicts: [],
                canInterplantRescue: false,
                advisoryNotes: [],
                interplantMode: mode
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
                    hatchedBed: b,
                    canInterplantRescue: false,
                    advisoryNotes: [],
                    interplantMode: mode
                };
            }
        }

        const pCrop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
        const pRange = getPlantingDateRangeMs(p, pCrop, block, tunnels);
        const advisoryNotes = [];
        const companionPeers = [];
        const antagonistPeers = [];

        for (let i = 0; i < plantings.length; i++) {
            const other = plantings[i];
            if (!other || other.id === skipId || other.blockId !== targetBlockId || !other.bedStart) continue;
            const oStartBed = Number(other.bedStart);
            const oBedCount = block.shapeType === "custom" ? 1 : Math.max(0.1, Number(other.bedCount ?? 1));
            const oSpan = Math.max(1, Math.ceil(oBedCount));
            if ((bedStart + bedSpan - 1) < oStartBed || bedStart > (oStartBed + oSpan - 1)) continue;

            const oCrop = cropMap ? resolveCrop(cropMap, other.cropName) : null;
            const oRange = getPlantingDateRangeMs(other, oCrop, block, tunnels);
            if (!rangesOverlap(pRange[0], pRange[1], oRange[0], oRange[1])) continue;

            const rel = pairCompatibility(pCrop, p.cropName, oCrop, other.cropName);
            const otherName = other.label || (oCrop ? oCrop.name : other.cropName);
            if (rel === "conflict") {
                antagonistPeers.push(otherName);
                advisoryNotes.push("Antagonist warning: " + (p.label || p.cropName) + " conflicts with " + otherName + ".");
            } else if (rel === "companion") {
                companionPeers.push(otherName);
                advisoryNotes.push("Companion synergy with " + otherName + ".");
            }
        }

        // Non-displacing ecological layers ("border", "understory", "relay") overlay cleanly with advisories
        if (!isPrimarySoilMode(mode)) {
            const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
            const msg = advisoryNotes.length > 0
                ? (modeLabel + " interplant eligible (" + advisoryNotes[0] + ")")
                : (modeLabel + " companion layer eligible.");
            return {
                eligible: true,
                reasonCode: null,
                message: msg,
                conflicts: [],
                canInterplantRescue: false,
                advisoryNotes: advisoryNotes,
                hasAntagonist: antagonistPeers.length > 0,
                hasCompanion: companionPeers.length > 0,
                interplantMode: mode
            };
        }

        // Primary soil modes ("sole" and "lanes") check concurrent sole+lanes widthBudgetPct <= 100%
        const incomingSharePct = mode === "lanes"
            ? clamp(Number(p.interplantSharePct ?? 50) || 50, 15, 85)
            : 100;
        const conflictMap = new Map();
        let maxPeakWidthPct = incomingSharePct;

        for (let offset = 0; offset < bedSpan; offset++) {
            const b = bedStart + offset;
            const rem = bedCount - offset;
            const incomingFrac = rem >= 1 ? 1.0 : Math.max(0.1, rem);
            const incomingWidthPct = incomingSharePct * incomingFrac;
            if (incomingWidthPct > maxPeakWidthPct) maxPeakWidthPct = incomingWidthPct;

            const overlapping = [];
            for (let i = 0; i < plantings.length; i++) {
                const other = plantings[i];
                if (!other || other.id === skipId || other.blockId !== targetBlockId || !other.bedStart) continue;
                const oMode = getEffectiveInterplantMode(other);
                if (!isPrimarySoilMode(oMode)) continue;

                const oStartBed = Number(other.bedStart);
                const oBedCount = block.shapeType === "custom" ? 1 : Math.max(0.1, Number(other.bedCount ?? 1));
                const oSpan = Math.max(1, Math.ceil(oBedCount));
                if (b < oStartBed || b > oStartBed + oSpan - 1) continue;

                const oCrop = cropMap ? resolveCrop(cropMap, other.cropName) : null;
                const oRange = getPlantingDateRangeMs(other, oCrop, block, tunnels);
                if (!rangesOverlap(pRange[0], pRange[1], oRange[0], oRange[1])) continue;

                const oOffset = b - oStartBed;
                const oRem = oBedCount - oOffset;
                const oFrac = oRem >= 1 ? 1.0 : Math.max(0.1, oRem);
                const oWidthPct = (oMode === "lanes" ? clamp(Number(other.interplantSharePct ?? 50) || 50, 15, 85) : 100) * oFrac;

                overlapping.push({
                    planting: other,
                    start: Math.max(pRange[0], oRange[0]),
                    end: Math.min(pRange[1], oRange[1]),
                    widthPct: oWidthPct
                });
            }

            if (overlapping.length === 0) continue;

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
                let usedPct = 0;
                const activeAtMid = [];
                for (let oi = 0; oi < overlapping.length; oi++) {
                    const item = overlapping[oi];
                    if (item.start <= mid && mid < item.end) {
                        usedPct += item.widthPct;
                        activeAtMid.push(item.planting);
                    }
                }
                const totalWidthPct = usedPct + incomingWidthPct;
                if (totalWidthPct > maxPeakWidthPct) maxPeakWidthPct = totalWidthPct;
                if (totalWidthPct > 100.1) {
                    activeAtMid.forEach(function (cp) {
                        conflictMap.set(cp.id, cp);
                    });
                }
            }
        }

        const roundedBudget = Math.round(maxPeakWidthPct);
        if (conflictMap.size > 0) {
            const conflicts = Array.from(conflictMap.values());
            const names = conflicts.map(function (c) { return c.label || c.cropName; }).join(", ");
            return {
                eligible: false,
                reasonCode: "OCCUPIED",
                message: "Bed " + bedStart + " overlaps with " + names + " (" + roundedBudget + "% width budget).",
                conflicts: conflicts,
                widthBudgetPct: roundedBudget,
                canInterplantRescue: mode === "sole",
                advisoryNotes: advisoryNotes,
                hasAntagonist: antagonistPeers.length > 0,
                hasCompanion: companionPeers.length > 0,
                interplantMode: mode
            };
        }

        return {
            eligible: true,
            reasonCode: null,
            message: mode === "lanes"
                ? ("Alternating lane eligible (" + roundedBudget + "% bed width used).")
                : "Eligible",
            conflicts: [],
            widthBudgetPct: roundedBudget,
            canInterplantRescue: false,
            advisoryNotes: advisoryNotes,
            hasAntagonist: antagonistPeers.length > 0,
            hasCompanion: companionPeers.length > 0,
            interplantMode: mode
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
                    const mode = getEffectiveInterplantMode(p);
                    if (fam !== "Unknown" && isPrimarySoilMode(mode)) {
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

        // Precompute peak concurrent primary width budget (sole + lanes) per bed key
        const bedPeakWidthPct = new Map();
        const overWidthBeds = new Map();
        bedMap.forEach(function (idxs, key) {
            const primaryEntries = [];
            const bedNum = Number(key.split("::").pop() || 1);
            idxs.forEach(function (idx) {
                const it = items[idx];
                if (!it.isPrimarySoil) return;
                const a = assignments[idx];
                const rem = it.bedCount - Math.max(0, bedNum - a.bedStart);
                const frac = rem >= 1 ? 1.0 : Math.max(0.1, rem);
                primaryEntries.push({
                    start: it.startMs,
                    end: it.endMs,
                    widthPct: it.widthPctShare * frac
                });
            });
            if (primaryEntries.length <= 1) {
                const singlePct = primaryEntries.length === 1 ? primaryEntries[0].widthPct : 0;
                bedPeakWidthPct.set(key, singlePct);
                if (singlePct > 100.1) overWidthBeds.set(key, singlePct);
                return;
            }
            const pts = [];
            primaryEntries.forEach(function (e) { pts.push(e.start, e.end); });
            pts.sort(function (u, v) { return u - v; });
            let peak = 0;
            for (let pi = 0; pi < pts.length - 1; pi++) {
                const s = pts[pi];
                const e = pts[pi + 1];
                if (e <= s) continue;
                const mid = (s + e) / 2;
                let used = 0;
                for (let pj = 0; pj < primaryEntries.length; pj++) {
                    if (primaryEntries[pj].start <= mid && mid < primaryEntries[pj].end) {
                        used += primaryEntries[pj].widthPct;
                    }
                }
                if (used > peak) peak = used;
            }
            bedPeakWidthPct.set(key, peak);
            if (peak > 100.1) {
                overWidthBeds.set(key, peak);
                if (collectDiagnostics) {
                    const parts = key.split("::");
                    const blkId = parts.slice(0, -1).join("::");
                    const blk = context.blocksById.get(blkId);
                    diagnostics.push({
                        id: "lanes_over_" + blkId + "_" + bedNum,
                        dimension: "standardization",
                        severity: "error",
                        title: "Bed width budget exceeded (" + Math.round(peak) + "%)",
                        message: (blk ? blk.name : blkId) + " Bed " + bedNum + " has concurrent sole/lane plantings totaling " + Math.round(peak) + "% (> 100%).",
                        blockId: blkId,
                        bedStart: bedNum
                    });
                }
            }
        });

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
                        message: "Drag onto a bed or run Auto-Tune Bed Plan to schedule it.",
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
                if (hist && item.family !== "Unknown" && item.isPrimarySoil) {
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
                    if (item.isPrimarySoil && other.isPrimarySoil && other.family === item.family && item.family !== "Unknown") {
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

            // 2. FERTILITY & INTERPLANT COHORT SYNERGY DIMENSION
            let fertScore = 0.85;
            let heavyDepletion = false;
            let compGoodCount = 0;
            let compBadCount = 0;
            let sameBedAntCount = 0;
            let canopySynergyCount = 0;
            let rootSynergyCount = 0;
            let understoryHeightWarn = false;
            let hitsWidthOverflow = false;

            for (let b = a.bedStart; b < a.bedStart + item.bedSpan; b++) {
                const key = a.blockId + "::" + b;
                if (overWidthBeds.has(key)) hitsWidthOverflow = true;
                const hist = context.priorHistory.get(key);
                if (hist && item.isPrimarySoil) {
                    if (item.nutrientLevel === 3 && hist.hasSoilBuilder) {
                        fertScore = Math.min(1.0, fertScore + 0.15);
                    } else if (item.nutrientLevel === 3 && hist.lastNutrient === 3) {
                        fertScore -= 0.35;
                        heavyDepletion = true;
                    } else if (item.nutrientLevel === -1 && hist.lastNutrient >= 2) {
                        fertScore = Math.min(1.0, fertScore + 0.12);
                    }
                }
                // Check active same-bed + adjacent bed companions/antagonists & interplant stratification
                for (let adj = Math.max(1, b - 1); adj <= Math.min(block.bedCount, b + 1); adj++) {
                    const adjPeers = bedMap.get(a.blockId + "::" + adj) || [];
                    for (let pi = 0; pi < adjPeers.length; pi++) {
                        const j = adjPeers[pi];
                        if (j === i) continue;
                        const other = items[j];
                        if (adj === b && item.isPrimarySoil && other.isPrimarySoil && item.nutrientLevel === 3 && other.nutrientLevel === 3 &&
                            item.interplantMode !== "lanes" && other.interplantMode !== "lanes") {
                            fertScore -= 0.15;
                            heavyDepletion = true;
                        }
                        if (rangesOverlap(item.startMs, item.endMs, other.startMs, other.endMs)) {
                            const rel = context.compatMatrix[i][j];
                            if (rel === 2) {
                                compBadCount += 1;
                                if (adj === b) sameBedAntCount += 1;
                            } else {
                                if (rel === 1) compGoodCount += 1;
                                if (adj === b) {
                                    if (item.canopyStratum && other.canopyStratum && item.canopyStratum !== other.canopyStratum) {
                                        canopySynergyCount += 1;
                                    }
                                    if (item.rootStratum && other.rootStratum && item.rootStratum !== other.rootStratum) {
                                        rootSynergyCount += 1;
                                    }
                                    if (item.interplantMode === "understory" && other.isPrimarySoil && item.heightMidCm > other.heightMidCm * 0.95) {
                                        understoryHeightWarn = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (compGoodCount > 0) fertScore += Math.min(0.15, compGoodCount * 0.08);
            if (canopySynergyCount > 0) fertScore += Math.min(0.08, canopySynergyCount * 0.04);
            if (rootSynergyCount > 0) fertScore += Math.min(0.08, rootSynergyCount * 0.04);
            if (understoryHeightWarn) fertScore -= 0.08;
            if (hitsWidthOverflow) fertScore -= 0.16;
            if (compBadCount > 0) fertScore -= Math.min(0.58, compBadCount * 0.32 + sameBedAntCount * 0.08);
            fertSum += clamp(fertScore, 0.05, 1.0);

            if (collectDiagnostics && compBadCount > 0) {
                diagnostics.push({
                    id: "ant_" + item.id,
                    dimension: "fertility",
                    severity: "error",
                    title: sameBedAntCount > 0
                        ? ("Shared-bed antagonist conflict: " + item.displayName)
                        : ("Antagonistic neighbor near " + item.displayName),
                    message: block.name + " Bed " + a.bedStart + " has an incompatible companion on the " + (sameBedAntCount > 0 ? "same bed." : "adjacent bed."),
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
            if (!isContainerBlockType(block.type) && block.shapeType !== "custom") {
                const lenDiff = Math.abs(block.bedLengthM - context.standardLengthM);
                if (lenDiff <= 0.5) stdScore += 0.12;
                else if (lenDiff > 10) stdScore -= 0.12;
            }
            if (item.bedCount === 1 || item.bedCount === 0.5 || item.bedCount === 2) stdScore += 0.04;
            if (!hitsWidthOverflow && (canopySynergyCount > 0 || rootSynergyCount > 0) && compBadCount === 0) {
                stdScore += 0.04;
            }
            if (hitsWidthOverflow) stdScore -= 0.35;
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
            const mode = getEffectiveInterplantMode(p);
            const sharePct = clamp(Number(p.interplantSharePct ?? 50) || 50, 15, 85);
            const primarySoil = isPrimarySoilMode(mode);
            const dims = estimateCropDimensionsCm(crop);
            const canopy = classifyCanopyStratum(crop, dims.heightMidCm);
            const root = parseRootProfile(crop);
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
                interplanted: mode !== "sole",
                interplantMode: mode,
                interplantSharePct: sharePct,
                isPrimarySoil: primarySoil,
                widthPctShare: mode === "sole" ? 100 : (mode === "lanes" ? sharePct : 0),
                canopyStratum: canopy.canopyStratum,
                heightMidCm: dims.heightMidCm,
                rootStratum: root.rootStratum,
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
        if (!item.isPrimarySoil) return true;
        const startBed = bedStart;
        const endBed = startBed + item.bedSpan - 1;
        const widthScale = (item.widthPctShare || 100) / 100;

        for (let b = startBed; b <= endBed; b++) {
            const offset = b - startBed;
            const rem = item.bedCount - offset;
            const incomingFrac = (rem >= 1 ? 1.0 : Math.max(0.1, rem)) * widthScale;

            // Fast check against assigned primary-soil items on same block, overlapping bed b and dates
            const active = [];
            for (let j = 0; j < items.length; j++) {
                if (j === itemIdx || !items[j].isPrimarySoil) continue;
                const aj = assignments[j];
                if (!aj || aj.blockId !== blockId) continue;
                if (!overlapMatrix[itemIdx][j]) continue;
                const oStart = aj.bedStart;
                const oEnd = oStart + items[j].bedSpan - 1;
                if (b < oStart || b > oEnd) continue;
                const oOff = b - oStart;
                const oRem = items[j].bedCount - oOff;
                const oScale = (items[j].widthPctShare || 100) / 100;
                const oFrac = (oRem >= 1 ? 1.0 : Math.max(0.1, oRem)) * oScale;
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
                ? (isContainerBlockType(block.type)
                    ? block.name
                    : (block.name + " · Bed " + p.bedStart + (m.bedCount > 1 ? "–" + (p.bedStart + Math.ceil(m.bedCount) - 1) : "")))
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
                const depthMm = parseFirstNumber(crop && (crop.seedingDepthMm || crop["Seeding Depth (mm)"]));
                const depthTag = depthMm > 0
                    ? (" · " + (state.units === "imperial"
                        ? (formatCleanNum(depthMm / 25.4, depthMm < 10 ? 2 : 1) + " in deep")
                        : (formatCleanNum(depthMm, 1) + " mm deep")))
                    : "";
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
                    details: m.seedsNeeded + " seeds (" + m.seedGrams + " g) · " + m.rowsPerBed + " rows @ " + formatSpacing(m.inRowCm, state.units) + depthTag,
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

    function formatCleanPhRange(rawPh) {
        if (!isMeaningful(rawPh)) return "";
        return String(rawPh)
            .trim()
            .replace(/(\d+)\.00\b/g, "$1.0")
            .replace(/(\.\d)0\b/g, "$1")
            .replace(/\s*[-–—]\s*/g, "–");
    }

    function buildSowingGuide(crop, method, nurseryWeeks) {
        const depthMm = parseFirstNumber(crop && (crop.seedingDepthMm || crop["Seeding Depth (mm)"]));
        const daysToEmergence = parseFirstNumber(crop && (crop.germinationDays || crop["Days to Emergence @ 20°C"]));
        const isTransplant = method === "Transplant";
        const nWks = isTransplant ? Math.max(0, Number(nurseryWeeks || 0)) : 0;
        const phRange = formatCleanPhRange(crop && (crop.phRange || crop["pH"]));

        const depthMetricStr = depthMm !== null && depthMm > 0
            ? (formatCleanNum(depthMm, 1) + " mm deep")
            : (depthMm === 0 ? "Surface sow" : "");
        const depthImpStr = depthMm !== null && depthMm > 0
            ? (formatCleanNum(depthMm / 25.4, depthMm < 10 ? 2 : 1) + " in deep")
            : (depthMm === 0 ? "Surface sow" : "");
        const germStr = daysToEmergence ? (formatCleanNum(daysToEmergence, 0) + "d @ 20°C") : "";

        const metricParts = [isTransplant ? "Transplant" : "Direct seed"];
        const impParts = [isTransplant ? "Transplant" : "Direct seed"];
        if (isTransplant && nWks > 0) {
            const wkTxt = "Start " + formatCleanNum(nWks, 0) + " wks indoors";
            metricParts.push(wkTxt);
            impParts.push(wkTxt);
        }
        if (depthMetricStr) metricParts.push(depthMetricStr);
        if (depthImpStr) impParts.push(depthImpStr);
        if (germStr) {
            metricParts.push(germStr);
            impParts.push(germStr);
        }

        return {
            method: method,
            seedingDepthMm: depthMm !== null ? depthMm : null,
            daysToEmergence: daysToEmergence !== null ? daysToEmergence : null,
            nurseryWeeks: nWks,
            phRange: phRange,
            summaryMetric: metricParts.join(" · "),
            summaryImperial: impParts.join(" · ")
        };
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
            const nurseryWks = m.method === "Transplant"
                ? Math.max(0, Number(p.nurseryWeeksOverride ?? (p.nurseryWeeks > 0 ? p.nurseryWeeks : undefined) ?? (crop && crop.nurseryWeeks) ?? 4))
                : 0;

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
                    seederPreset: p.seederPreset || (crop && crop.seederPreset) || null,
                    sowingGuide: buildSowingGuide(crop, m.method, nurseryWks)
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
            if (i > 0 && prevEndIso && copy.startDate < prevEndIso && isPrimarySoilMode(getEffectiveInterplantMode(copy))) {
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
        const isImp = Boolean(state && state.units === "imperial");

        const headers = [
            "Season", "Block", "Bed Start", "Bed Count", "Interplanted",
            "Crop", "Latin Name", "Family", "Method",
            "Seeding Date", "Transplant Date", "Harvest Start", "Harvest End", "Effective DTM",
            "Rows/Bed", "In-Row (cm)", "Between-Row (cm)",
            "Plants", "Seeds Needed", "Seed (g)", "Nursery Trays",
            "Est Yield", "Yield Unit", "Est Value (CAD)",
            "Space Type", "Interplant Mode", "Growing Media Mix", "Sowing Guide"
        ];
        const lines = [headers.map(escapeCsv).join(",")];

        (season.plantings || []).forEach(function (p) {
            const crop = cropMap ? resolveCrop(cropMap, p.cropName) : null;
            const block = p.blockId ? blocksById.get(p.blockId) : null;
            const d = computePlantingDates(p, crop, block, tunnels, state.climateAdjusted !== false);
            const m = computePlantingMetrics(p, crop, block, state.units);
            const spaceType = formatBlockSpaceType(block);
            const interplantModeLabel = formatInterplantModeLabel(m.interplantMode, m.interplantSharePct);
            const mediaMixLabel = block
                ? (isContainerBlockType(block.type) || block.growingMedia
                    ? formatGrowingMediaMixLabel(block.growingMedia, block.type)
                    : "")
                : "";
            const nurseryWks = m.method === "Transplant"
                ? Math.max(0, Number(p.nurseryWeeksOverride ?? (p.nurseryWeeks > 0 ? p.nurseryWeeks : undefined) ?? (crop && crop.nurseryWeeks) ?? 4))
                : 0;
            const sg = buildSowingGuide(crop, m.method, nurseryWks);
            const sowingGuideStr = isImp ? (sg.summaryImperial || sg.summaryMetric) : (sg.summaryMetric || sg.summaryImperial);

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
                m.estValueCad,
                spaceType,
                interplantModeLabel,
                mediaMixLabel,
                sowingGuideStr
            ].map(escapeCsv).join(","));
        });

        return lines.join("\n");
    }

    function computeGrowingMediaSummary(state) {
        const empty = {
            totalVolumeLiters: 0,
            totalVolumeGallons: 0,
            totalCubicFeet: 0,
            containerCount: 0,
            bedCount: 0,
            ingredients: [],
            blocks: []
        };
        const season = getActiveSeason(state);
        if (!season || !Array.isArray(season.blocks)) return empty;

        let rawTotalLiters = 0;
        let containerCount = 0;
        let bedCount = 0;
        const blocksOut = [];
        const ingMap = new Map();

        season.blocks.forEach(function (b) {
            if (!b || b.isFallow) return;
            const bType = String(b.type || "field").toLowerCase();
            const isContainer = isContainerBlockType(bType);
            const hasExplicitMedia = Boolean(b.growingMedia);
            if (!isContainer && !hasExplicitMedia) return;

            let volL = 0;
            if (isContainer) {
                if (b.shapeType === "custom" && b.customShape) {
                    const normCustom = validateAndNormalizeCustomShape(b.customShape);
                    const customGeom = normCustom ? computeCustomShapeGeometry(normCustom) : null;
                    const areaM2 = customGeom ? customGeom.areaM2 : (Number(b.areaM2) || 0);
                    const depthCm = (b.containerSpec && Number(b.containerSpec.depthCm) > 0)
                        ? Number(b.containerSpec.depthCm)
                        : computeContainerGeometry(b.containerSpec || b, bType).depthCm;
                    volL = +(areaM2 * depthCm * 10).toFixed(1);
                } else {
                    volL = computeContainerGeometry(b.containerSpec || b, bType).volumeLiters;
                }
                containerCount += 1;
            } else {
                let areaM2 = Number(b.areaM2);
                if (!(areaM2 > 0)) {
                    if (b.shapeType === "custom" && b.customShape) {
                        const normCustom = validateAndNormalizeCustomShape(b.customShape);
                        const customGeom = normCustom ? computeCustomShapeGeometry(normCustom) : null;
                        areaM2 = customGeom ? customGeom.areaM2 : 0;
                    } else {
                        const cnt = Math.max(1, Number(b.bedCount || 1));
                        const lenM = Math.max(0.5, Number(b.bedLengthM || 1));
                        const widCm = Math.max(10, Number(b.bedWidthCm || 75));
                        areaM2 = cnt * lenM * (widCm / 100);
                    }
                }
                const depthCm = Number(b.bedDepthCm) > 0
                    ? Number(b.bedDepthCm)
                    : ((b.containerSpec && Number(b.containerSpec.depthCm) > 0) ? Number(b.containerSpec.depthCm) : 25);
                volL = +(areaM2 * depthCm * 10).toFixed(1);
                bedCount += 1;
            }

            if (!(volL > 0)) return;
            const normMedia = normalizeGrowingMedia(b.growingMedia, bType);
            const mixLabel = formatGrowingMediaMixLabel(normMedia, bType);
            const volGal = +(volL / LITERS_PER_US_GALLON).toFixed(2);
            const blockName = b.name || formatBlockSpaceType(b);

            rawTotalLiters += volL;
            blocksOut.push({
                blockId: b.id || "",
                blockName: blockName,
                type: bType,
                volumeLiters: volL,
                volumeGallons: volGal,
                mixLabel: mixLabel,
                hasExplicitMedia: hasExplicitMedia
            });

            normMedia.ingredients.forEach(function (item) {
                const pct = Number(item.pct);
                if (!(pct > 0)) return;
                const def = GROWING_MEDIA_BY_ID.get(item.id);
                if (!def) return;
                const ingL = (pct / 100) * volL;
                if (!ingMap.has(item.id)) {
                    ingMap.set(item.id, {
                        id: item.id,
                        label: def.label,
                        rawLiters: 0,
                        sources: []
                    });
                }
                const rec = ingMap.get(item.id);
                rec.rawLiters += ingL;
                rec.sources.push({
                    blockId: b.id || "",
                    blockName: blockName,
                    type: bType,
                    liters: +ingL.toFixed(2)
                });
            });
        });

        const totalVolumeLiters = +rawTotalLiters.toFixed(1);
        const totalVolumeGallons = +(rawTotalLiters / LITERS_PER_US_GALLON).toFixed(2);
        const totalCubicFeet = +(rawTotalLiters / LITERS_PER_CUBIC_FOOT).toFixed(2);

        const ingredientsOut = Array.from(ingMap.values()).map(function (entry) {
            const l = +entry.rawLiters.toFixed(2);
            return {
                id: entry.id,
                label: entry.label,
                liters: l,
                gallons: +(entry.rawLiters / LITERS_PER_US_GALLON).toFixed(2),
                quarts: +(entry.rawLiters / LITERS_PER_US_QUART).toFixed(2),
                cubicFeet: +(entry.rawLiters / LITERS_PER_CUBIC_FOOT).toFixed(2),
                pctOfTotal: rawTotalLiters > 0 ? +((entry.rawLiters / rawTotalLiters) * 100).toFixed(1) : 0,
                sources: entry.sources
            };
        }).sort(function (a, b) {
            if (Math.abs(b.liters - a.liters) > 1e-6) return b.liters - a.liters;
            return a.label.localeCompare(b.label);
        });

        return {
            totalVolumeLiters: totalVolumeLiters,
            totalVolumeGallons: totalVolumeGallons,
            totalCubicFeet: totalCubicFeet,
            containerCount: containerCount,
            bedCount: bedCount,
            ingredients: ingredientsOut,
            blocks: blocksOut
        };
    }

    function exportGrowingMediaCsv(state) {
        const season = getActiveSeason(state);
        if (!season) return "";
        const summary = computeGrowingMediaSummary(state);
        const headers = [
            "Ingredient", "Liters", "US Gallons", "US Quarts", "Cubic Feet", "% of Total", "Used In"
        ];
        const lines = [headers.map(escapeCsv).join(",")];

        summary.ingredients.forEach(function (ing) {
            const usedIn = (ing.sources || []).map(function (s) {
                return s.blockName + " (" + formatCleanNum(s.liters, 1) + " L)";
            }).join("; ");
            lines.push([
                ing.label,
                ing.liters,
                ing.gallons,
                ing.quarts,
                ing.cubicFeet,
                ing.pctOfTotal + "%",
                usedIn
            ].map(escapeCsv).join(","));
        });

        return lines.join("\n");
    }

    // =========================================================================
    // 8. CROSS-SITE ECOLOGY ENGINE & DATE-NUDGE HELPER (V2 / V3.1)
    // =========================================================================
    const REJECT_ECOLOGY_PLACEHOLDER_RE = /has not been found|thusfar|thus far|not documented|none known|no known|not found|not researched|no data|unknown|n\/a|^none$|^no$/i;
    const REJECT_DANGLING_FRAGMENT_RE = /^(?:on|in|under|at|of|to|for|with|and|or|by|from)\b/i;
    const REJECT_STANDALONE_PART_RE = /^(?:leaves?|stems?|roots?|fruits?|flowers?|buds?|shoots?|foliage|seedlings?|plants?|soil|pods?|tubers?|bark|seeds?|trunks?|heads?|cobs?|stalks?|twigs?|axils?)$/i;
    const PURE_POLLINATOR_TOKEN_RE = /^(?:bees?|honey\s*bees?|bumble\s*bees?|mason\s*bees?|butterfly|butterflies|hummingbirds?)$/i;

    const LATIN_PEST_COMMON_NAMES = {
        "agrotis ipsilon": "Black Cutworm (Agrotis ipsilon)",
        "pieris rapae": "Cabbage White Butterfly (Pieris rapae)",
        "trialeurodes vaporariorum": "Greenhouse Whitefly",
        "tetranychus urticae": "Two-Spotted Spider Mite",
        "plutella xylostella": "Diamondback Moth",
        "delia radicum": "Cabbage Root Maggot",
        "leptinotarsa decemlineata": "Colorado Potato Beetle",
        "trichoplusia ni": "Cabbage Looper (Trichoplusia ni)",
        "manduca sexta": "Tomato Hornworm (Manduca sexta)",
        "helicoverpa zea": "Corn Earworm (Helicoverpa zea)",
        "helicoverpa armigera": "Old World Bollworm (Helicoverpa armigera)",
        "melittia cucurbitae": "Squash Vine Borer (Melittia cucurbitae)",
        "phthorimaea operculella": "Potato Tuberworm (Phthorimaea operculella)",
        "keiferia lycopersicella": "Tomato Pinworm (Keiferia lycopersicella)",
        "acrolepiopsis assectella": "Leek Moth (Acrolepiopsis assectella)",
        "cydia nigricana": "Pea Moth (Cydia nigricana)",
        "spodoptera exigua": "Beet Armyworm (Spodoptera exigua)",
        "spodoptera frugiperda": "Fall Armyworm (Spodoptera frugiperda)",
        "spodoptera eridania": "Southern Armyworm (Spodoptera eridania)",
        "peridroma saucia": "Variegated Cutworm (Peridroma saucia)",
        "euxoa auxiliaris": "Army Cutworm (Euxoa auxiliaris)",
        "euxoa messoria": "Darksided Cutworm (Euxoa messoria)",
        "euxoa ochrogaster": "Redbacked Cutworm (Euxoa ochrogaster)",
        "euxoa tessellata": "Striped Cutworm (Euxoa tessellata)",
        "agrotis vetusta": "Muted Cutworm (Agrotis vetusta)",
        "apamea devastator": "Glassy Cutworm (Apamea devastator)",
        "mamestra curialis": "Garden Armyworm (Mamestra curialis)",
        "papaipema nebris": "Stalk Borer (Papaipema nebris)",
        "elasmopalpus lignosellus": "Lesser Cornstalk Borer (Elasmopalpus lignosellus)",
        "hellula rogatalis": "Cabbage Webworm (Hellula rogatalis)",
        "hellula phidilealis": "Cabbage Budworm (Hellula phidilealis)",
        "evergestis pallidata": "Purplebacked Cabbageworm (Evergestis pallidata)",
        "pieris brassicae": "Large White Butterfly (Pieris brassicae)",
        "diaphania nitidalis": "Pickleworm (Diaphania nitidalis)",
        "diaphania hyalinata": "Melonworm (Diaphania hyalinata)",
        "diaphania indica": "Cucumber Moth (Diaphania indica)",
        "papilio polyxenes": "Black Swallowtail (Papilio polyxenes)",
        "papilio zelicaon": "Anise Swallowtail (Papilio zelicaon)",
        "papilio machaon": "Old World Swallowtail (Papilio machaon)",
        "herpetogramma bipunctalis": "Southern Beet Webworm (Herpetogramma bipunctalis)",
        "spoladea recurvalis": "Hawaiian Beet Webworm (Spoladea recurvalis)",
        "hymenia perspectalis": "Spotted Beet Webworm (Hymenia perspectalis)",
        "etiella zinckenella": "Lima Bean Pod Borer (Etiella zinckenella)",
        "loxostege sticticalis": "Beet Webworm (Loxostege sticticalis)",
        "udea rubigalis": "Celery Leaftier (Udea rubigalis)",
        "achyra rantalis": "Garden Webworm (Achyra rantalis)",
        "achyra similalis": "Garden Webworm (Achyra similalis)",
        "anticarsia gemmatalis": "Velvetbean Caterpillar (Anticarsia gemmatalis)",
        "melanchra picta": "Zebra Caterpillar (Melanchra picta)",
        "hyphantria cunea": "Fall Webworm (Hyphantria cunea)",
        "anthocharis sara": "Sara Orangetip (Anthocharis sara)",
        "euchloe ausonides": "Large Marble Butterfly (Euchloe ausonides)",
        "discestra trifolii": "Clover Cutworm (Discestra trifolii)",
        "condica sutor": "Noctuid Foliage Caterpillar (Condica sutor)",
        "leucinodes orbonalis": "Eggplant Shoot & Fruit Borer (Leucinodes orbonalis)",
        "neoleucinodes elegantalis": "Tomato Fruit Borer (Neoleucinodes elegantalis)",
        "corcyra cephalonica": "Rice Moth (Corcyra cephalonica)",
        "cadra cautella": "Almond Moth (Cadra cautella)",
        "frankliniella occidentalis": "Western Flower Thrips",
        "thrips tabaci": "Onion Thrips",
        "myzus persicae": "Green Peach Aphid",
        "aphis gossypii": "Cotton / Melon Aphid",
        "macrosiphum euphorbiae": "Potato Aphid",
        "bactericera cockerelli": "Tomato / Potato Psyllid",
        "otiorhynchus sulcatus": "Black Vine Weevil",
        "popillia japonica": "Japanese Beetle",
        "psila rosae": "Carrot Rust Fly (Psila rosae)",
        "liriomyza bryoniae": "Tomato Leaf Miner",
        "liriomyza huidobrensis": "Pea Leaf Miner",
        "drosophila suzukii": "Spotted Wing Drosophila"
    };

    const PEST_TAG_RULES = [
        { tag: "aphid", re: /\b(?:aphids?|aphidoidea|black\s+fly|myzus|aphis|macrosiphum|aulacorthum|ericaphis)\b/i },
        { tag: "cabbageworm", re: /\b(?:cabbage\s*worms?|cabbage\s*butterfl(?:y|ies)|white\s+cabbage\s*butterfl(?:y|ies)|cabbage\s*moths?|pieris|evergestis|ascia|leptophobia|tatochila)\b/i },
        { tag: "cabbage_looper", re: /\b(?:cabbage\s*loopers?|loopers?|trichoplusia)\b/i },
        { tag: "diamondback_moth", re: /\b(?:diamondback|plutella|cabbage\s*moths?)\b/i },
        { tag: "cutworm", re: /\b(?:cutworms?|agrotis|euxoa|peridroma|apamea|discestra)\b/i },
        { tag: "hornworm", re: /\b(?:hornworms?|manduca)\b/i },
        { tag: "corn_earworm", re: /\b(?:corn\s*earworms?|helicoverpa|bollworm)\b/i },
        { tag: "armyworm", re: /\b(?:armyworms?|spodoptera|mamestra)\b/i },
        { tag: "vine_borer", re: /\b(?:squash\s*vine\s*borers?|vine\s*borers?|stalk\s*borers?|cornstalk\s*borers?|pod\s*borers?|fruit\s*borers?|borers?|melittia|elasmopalpus|papaipema|etiella|leucinodes|neoleucinodes)\b/i },
        { tag: "leek_moth", re: /\b(?:leek\s*moths?|acrolepiopsis)\b/i },
        { tag: "pea_moth", re: /\b(?:pea\s*moths?|cydia\s+nigricana)\b/i },
        { tag: "codling_moth", re: /\b(?:codling\s*moths?|cydia\s+pomonella)\b/i },
        { tag: "webworm", re: /\b(?:webworms?|herpetogramma|spoladea|hymenia|loxostege|hellula|achyra|hyphantria)\b/i },
        { tag: "tuberworm", re: /\b(?:tuberworms?|pinworms?|phthorimaea|keiferia)\b/i },
        { tag: "swallowtail", re: /\b(?:swallowtails?|parsleyworms?|papilio)\b/i },
        { tag: "caterpillar", re: /\b(?:caterpillars?|loopers?|cabbage\s*worms?|cabbageworms?|hornworms?|cutworms?|armyworms?|earworms?|webworms?|budworms?|borers?|tuberworms?|pinworms?|pickleworms?|melonworms?|leek\s*moths?|pea\s*moths?|cabbage\s*moths?|codling\s*moths?|diamondback|leafrollers?|spanworms?|fruitworms?|swallowtails?|white\s+butterfl(?:y|ies)|cabbage\s+butterfl(?:y|ies)|moth\s+caterpillars?|moth\s+eggs?|lepidoptera|noctuid|pyralid|pieris|plutella|trichoplusia|agrotis|manduca|helicoverpa|spodoptera|melittia|phthorimaea|keiferia|acrolepiopsis|cydia|ostrini|euxoa|peridroma|hellula|evergestis|diaphania|papilio|herpetogramma|spoladea|hymenia|etiella|loxostege|udea|achyra|anticarsia|melanchra|hyphantria|anthocharis|euchloe|discestra|condica|leucinodes|neoleucinodes)\b/i },
        { tag: "whitefly", re: /\b(?:whitefl(?:y|ies)|trialeurodes|bemisia)\b/i },
        { tag: "spider_mite", re: /\b(?:spider\s*mites?|spidermites?|tetranychus|two-?spotted\s+spider\s*mites?|red\s+spider\s*mites?|carmine\s+spider\s*mites?|pest\s+mites?|plant\s+mites?)\b/i },
        { tag: "broad_mite", re: /\b(?:broad\s*mites?|cyclamen\s*mites?|strawberry\s*mites?|russet\s*mites?|bulb\s*mites?|polyphagotarsonemus|phytonemus|aculops|rhizoglyphus)\b/i },
        { tag: "thrips", re: /\b(?:thrips?|thysanoptera|frankliniella|echinothrips)\b/i },
        { tag: "flea_beetle", re: /\b(?:flea\s*beetles?|flea\s*beatles?|black\s+flea\s*beetles?)\b/i },
        { tag: "colorado_potato_beetle", re: /\b(?:colorado\s*potato\s*beetles?|leptinotarsa)\b/i },
        { tag: "cucumber_beetle", re: /\b(?:cucumber\s*beetles?)\b/i },
        { tag: "asparagus_beetle", re: /\b(?:asparagus\s*beetles?|aspargus\s*beetles?)\b/i },
        { tag: "bean_beetle", re: /\b(?:mexican\s*(?:green\s*)?bean\s*beetles?)\b/i },
        { tag: "japanese_beetle", re: /\b(?:japanese\s*beetles?|popillia)\b/i },
        { tag: "turnip_beetle", re: /\b(?:red\s*turnip\s*beetles?)\b/i },
        { tag: "weevil", re: /\b(?:weevils?|otiorhynchus)\b/i },
        { tag: "wireworm", re: /\b(?:wireworms?|grubs?)\b/i },
        { tag: "cabbage_maggot", re: /\b(?:cabbage\s*(?:root\s*)?maggots?|delia\s+radicum)\b/i },
        { tag: "root_maggot", re: /\broot\s*maggots?\b/i },
        { tag: "onion_maggot", re: /\bonion\s*maggots?\b/i },
        { tag: "seed_corn_maggot", re: /\bseed-?corn\s*maggots?\b/i },
        { tag: "pepper_maggot", re: /\bpepper\s*maggots?\b/i },
        { tag: "carrot_fly", re: /\b(?:carrot\s*(?:rust\s*)?fl(?:y|ies)|psila\s+rosae)\b/i },
        { tag: "swede_midge", re: /\bswede\s*midge\b/i },
        { tag: "leafminer", re: /\b(?:leaf\s*miners?|leafminers?|laafminers?|liriomyza)\b/i },
        { tag: "slug_snail", re: /\b(?:slugs?|snails?)\b/i },
        { tag: "leafhopper", re: /\bleafhoppers?\b/i },
        { tag: "lygus", re: /\blygus(?:\s*bugs?)?\b/i },
        { tag: "squash_bug", re: /\b(?:squash\s*bugs?|stink\s*bugs?|true\s*bugs?)\b/i },
        { tag: "psyllid", re: /\b(?:psyllids?|bactericera)\b/i },
        { tag: "nematode", re: /\b(?:nematodes?|root-?knot\s*nematodes?|meloidogyne)\b/i },
        { tag: "fungus_gnat", re: /\b(?:fungus\s*gnats?|sciarid|bradysia|shore\s*fl(?:y|ies)|scatella)\b/i },
        { tag: "scale", re: /\b(?:scales?|mealybugs?|planococcus|lecanium|diaspididae)\b/i },
        { tag: "mosquito", re: /\bmosquit(?:o|oes)\b/i },
        { tag: "ant", re: /\bants?\b/i },
        { tag: "grasshopper", re: /\bgrasshoppers?\b/i },
        { tag: "mammal", re: /\b(?:deer|rabbits?|gophers?|moles?|voles?|raccoons?|squirrels?|mouse|mice)\b/i }
    ];

    const PREDATOR_PREY_RULES = [
        { re: /\b(?:aphidius|praon|aphelinus|ephedrus|aphid\s*midge|aphidoletes)\b/i, tags: ["aphid"] },
        { re: /\b(?:syrphid|hoverfl(?:y|ies)|eupeodes)\b/i, tags: ["aphid"] },
        { re: /\b(?:ladybird|ladybug|coccinell|adalia|hippodamia|didion)\b/i, tags: ["aphid", "spider_mite", "whitefly", "thrips", "scale", "psyllid"] },
        { re: /\bcoleomegilla\b/i, tags: ["aphid", "spider_mite", "thrips", "colorado_potato_beetle", "cabbage_looper", "corn_earworm", "caterpillar"] },
        { re: /\b(?:lacewings?|chrysop|hemerobi|micromus)\b/i, tags: ["aphid", "leafhopper", "spider_mite", "thrips", "whitefly", "psyllid", "scale", "cabbageworm", "cabbage_looper", "diamondback_moth", "hornworm", "corn_earworm", "armyworm", "webworm", "cutworm", "caterpillar"] },
        { re: /\bcaterpillar\s*parasitoids?\b/i, tags: ["caterpillar", "cabbageworm", "cabbage_looper", "diamondback_moth", "cutworm", "hornworm", "corn_earworm", "armyworm", "vine_borer", "leek_moth", "pea_moth", "codling_moth", "webworm", "tuberworm", "swallowtail"] },
        { re: /\b(?:parasitic\s*wasp|trichogramma|cotesia|braconid|ichneumon)\b/i, tags: ["aphid", "whitefly", "leafminer", "scale", "psyllid", "caterpillar", "cabbageworm", "cabbage_looper", "diamondback_moth", "cutworm", "hornworm", "corn_earworm", "armyworm", "vine_borer", "leek_moth", "pea_moth", "codling_moth", "webworm", "tuberworm", "swallowtail"] },
        { re: /\b(?:predatory\s*wasp|\bwasp\b)\b/i, tags: ["caterpillar", "cabbageworm", "cabbage_looper", "diamondback_moth", "cutworm", "hornworm", "corn_earworm", "armyworm", "vine_borer", "leek_moth", "pea_moth", "codling_moth", "webworm", "tuberworm", "swallowtail", "asparagus_beetle", "cucumber_beetle", "bean_beetle", "leafhopper", "swede_midge"] },
        { re: /\b(?:ground\s*beetle|carabid)\b/i, tags: ["cutworm", "slug_snail", "cabbage_maggot", "root_maggot", "onion_maggot", "seed_corn_maggot", "wireworm", "weevil", "flea_beetle", "colorado_potato_beetle", "cucumber_beetle", "bean_beetle", "turnip_beetle", "caterpillar"] },
        { re: /\b(?:orius|minute\s*pirate)\b/i, tags: ["thrips", "aphid", "spider_mite", "whitefly", "psyllid", "lygus", "cabbage_looper", "corn_earworm", "caterpillar"] },
        { re: /\b(?:predatory\s*mite|phytoseiulus|neoseiulus|amblyseius|amblydromalus|transeius|iphiseius|galendromus|mesoseiulus|anystis|stratiolaelaps|gaeolaelaps|macrocheles)\b/i, tags: ["spider_mite", "broad_mite", "thrips", "whitefly", "fungus_gnat"] },
        { re: /\bbirds?\b/i, tags: ["caterpillar", "cabbageworm", "cabbage_looper", "cutworm", "hornworm", "corn_earworm", "armyworm", "webworm", "slug_snail", "wireworm", "flea_beetle", "colorado_potato_beetle", "cucumber_beetle", "asparagus_beetle", "japanese_beetle", "turnip_beetle", "weevil", "grasshopper"] },
        { re: /\btachinid/i, tags: ["caterpillar", "cutworm", "hornworm", "armyworm", "cabbage_looper", "cabbageworm", "squash_bug", "colorado_potato_beetle", "japanese_beetle", "cucumber_beetle", "bean_beetle"] },
        { re: /\b(?:spiders?|theridiidae|erigoninae)\b/i, tags: ["aphid", "leafhopper", "lygus", "thrips", "whitefly", "flea_beetle", "caterpillar", "cabbageworm", "cabbage_looper", "diamondback_moth"] },
        { re: /\bdamselfl(?:y|ies)\b/i, tags: ["aphid", "mosquito", "leafhopper", "whitefly", "swede_midge"] },
        { re: /\bpodisus|spined\s+soldier\s+bug\b/i, tags: ["caterpillar", "cabbage_looper", "hornworm", "armyworm", "diamondback_moth", "colorado_potato_beetle", "bean_beetle"] }
    ];

    const BIOS_ROLE_KEYWORDS = [
        { re: /\baphidius\b/i, ids: ["aphidius-colemani", "aphidius-matricariae", "aphidius-ervi"] },
        { re: /\bpraon\b/i, ids: ["praon-volucre"] },
        { re: /\baphid\s*midge|\baphidoletes\b/i, ids: ["aphidoletes-aphidimyza"] },
        { re: /\bladybird|\bladybug|\bcoccinell/i, ids: ["adalia-bipunctata", "hippodamia-convergens", "coleomegilla-maculata"] },
        { re: /\blacewings?|\bchrysop|\bhemerobi|\bmicromus/i, ids: ["chrysoperla-carnea", "chrysoperla-rufilabris", "micromus-variegatus", "hemerobius-spp"] },
        { re: /\bsyrphid|\bhoverfly/i, ids: ["eupeodes-americanus"] },
        { re: /\borius\b|\bminute\s*pirate/i, ids: ["orius-insidiosus", "orius-laevigatus"] },
        { re: /\bground\s*beetle/i, ids: ["dalotia-coriaria"] },
        { re: /\bcaterpillar\s*parasitoid|\bparasitic\s*wasp|\bpredatory\s*wasp|\btrichogramma|\bcotesia/i, ids: ["trichogramma-brassicae", "cotesia-glomerata", "cotesia-vestalis", "trichogramma-pretiosum", "aphidius-colemani"] },
        { re: /\baphid/i, ids: ["aphidoidea-overview", "myzus-persicae", "aphid-natural-enemies-overview"] },
        { re: /\bwhitefl|\btrialeurodes\b|\bbemisia\b/i, ids: ["trialeurodes-vaporariorum", "encarsia-formosa", "eretmocerus-eremicus", "lecanicillium-muscari"] },
        { re: /\bspider\s*mite|\bspidermite|\btetranychus\b/i, ids: ["tetranychus-urticae", "phytoseiulus-persimilis", "neoseiulus-californicus", "stethorus-punctillum"] },
        { re: /\bthrip|\bfrankliniella\b/i, ids: ["thysanoptera-overview", "frankliniella-occidentalis", "amblyseius-swirskii", "orius-insidiosus"] },
        { re: /\bcabbage\s*worm|\bcabbageworm|\bpieris\b/i, ids: ["lepidoptera-caterpillars", "cotesia-glomerata", "trichogramma-brassicae"] },
        { re: /\bdiamondback|\bplutella\b/i, ids: ["lepidoptera-caterpillars", "cotesia-vestalis", "trichogramma-brassicae"] },
        { re: /\blooper|\bhornworm|\bcaterpillar|\bcutworm|\barmyworm|\bwebworm|\bborer|\btrichoplusia|\bagrotis|\bmanduca|\bhelicoverpa/i, ids: ["lepidoptera-caterpillars", "trichogramma-brassicae", "trichogramma-pretiosum", "cotesia-marginiventris", "steinernema-carpocapsae"] },
        { re: /\bleaf\s*miner|\bleafminer|\bliriomyza\b/i, ids: ["liriomyza-general", "diglyphus-isaea", "dacnusa-sibirica"] },
        { re: /\bfungus\s*gnat|\bbradysia\b/i, ids: ["bradysia-impatiens", "dalotia-coriaria", "steinernema-feltiae"] },
        { re: /\bvine\s*weevil|\botiorhynchus\b/i, ids: ["otiorhynchus-sulcatus", "heterorhabditis-bacteriophora"] },
        { re: /\bpsyllid|\bbactericera\b/i, ids: ["bactericera-cockerelli", "tamarixia-triozae"] },
        { re: /\bcolorado\s*potato\s*beetle|\bleptinotarsa\b/i, ids: ["podisus-maculiventris", "coleomegilla-maculata", "tachinidae-overview", "beauveria-bassiana"] },
        { re: /\bflea\s*beetle/i, ids: ["steinernema-carpocapsae", "beauveria-bassiana"] },
        { re: /\bnematode|\bmeloidogyne\b/i, ids: ["rhizobacterial-mixed-consortium"] }
    ];

    function toEcologySlug(str) {
        return normalizeKey(str)
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "item";
    }

    function normalizeEcologyTokenText(raw) {
        let clean = String(raw || "").trim();
        clean = clean.replace(/^[\s.;,]+|[\s.;,]+$/g, "").trim();
        clean = clean.replace(/,\s*(?:on|in|under)\s+(?:leaves?|stems?|roots?|cole crops?|fruit|flowers?|buds?|shoots?|foliage|seedlings?|plants?|soil|pods?|tubers?)\b.*$/i, "").trim();
        clean = clean.replace(/:\s*(?:\?\s*)?(?:on|in|under|at|with|near|within|adult\b).*$/i, "").trim();
        clean = clean
            .replace(/\bFlea\s+Beatle(s?)\b/gi, "Flea Beetle$1")
            .replace(/\bBeatle(s?)\b/gi, "Beetle$1")
            .replace(/\bCole\s+Cropa\b/gi, "Cole Crops")
            .replace(/\bCabbage\s+Maggol(s?)\b/gi, "Cabbage Maggot$1")
            .replace(/\bSuceptibility\b/gi, "Susceptibility")
            .replace(/\bAspargus\b/gi, "Asparagus")
            .replace(/\bLaafminer(s?)\b/gi, "Leafminer$1")
            .replace(/\bSpidermite(s?)\b/gi, "Spider Mite$1")
            .replace(/\bsoft-\s+bodied\b/gi, "soft-bodied")
            .replace(/\bRepls\b/gi, "Repels")
            .replace(/\bThrip\b/g, "Thrips")
            .replace(/\bthrip\b/g, "thrips");
        clean = clean.replace(/^[\s.;,]+|[\s.;,]+$/g, "").trim();
        return clean;
    }

    function isValidEcologyToken(clean) {
        if (!clean || !isMeaningful(clean) || clean.length < 2) return false;
        if (/^[\W_]+$/.test(clean)) return false;
        if (REJECT_ECOLOGY_PLACEHOLDER_RE.test(clean)) return false;
        if (REJECT_DANGLING_FRAGMENT_RE.test(clean)) return false;
        if (REJECT_STANDALONE_PART_RE.test(clean)) return false;
        return true;
    }

    function normalizeLatinPestDisplay(clean) {
        const direct = LATIN_PEST_COMMON_NAMES[normalizeKey(clean)];
        if (direct) return direct;
        const strippedFamily = String(clean)
            .replace(/\s*\((?:Noctuidae|Pyralidae|Pieridae|Sphingidae|Tortricidae|Arctiidae|Yponomeutidae|Papilionidae|Nymphalidae|Lycaenidae|Oecophoridae)\)\s*$/i, "")
            .trim();
        const mapped = LATIN_PEST_COMMON_NAMES[normalizeKey(strippedFamily)];
        return mapped || clean;
    }

    function isTruePredatorToken(label) {
        if (!label || !isValidEcologyToken(label)) return false;
        return !PURE_POLLINATOR_TOKEN_RE.test(String(label).trim());
    }

    function splitTopLevelSemicolonSegments(rawStr) {
        const str = String(rawStr || "").replace(/;\s*,/g, ";");
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
            } else if (ch === ";" && depth === 0) {
                if (cur.trim()) out.push(cur.trim());
                cur = "";
            } else {
                cur += ch;
            }
        }
        if (cur.trim()) out.push(cur.trim());
        return out;
    }

    function stripDepth0HostColonNote(segment) {
        let depth = 0;
        for (let i = 0; i < segment.length; i++) {
            const ch = segment[i];
            if (ch === "(") depth++;
            else if (ch === ")") depth = Math.max(0, depth - 1);
            else if (ch === ":" && depth === 0) {
                const rhs = segment.slice(i + 1).trim();
                if (!rhs || /^(?:(?:\?\s*)?(?:on|in|under|at|with|near|within)\b|\?|adult\b)/i.test(rhs)) {
                    return segment.slice(0, i).trim();
                }
                break;
            }
        }
        return segment;
    }

    function stripNegationClauses(str) {
        return String(str || "")
            .replace(/\b(?:does\s+not|do\s+not|not\s+parasitized\s+by|no\s+(?:effective|known)\s+biological\s+control[^.;]*|less\s+effective\s+on|distinguish\s+carefully\s+from)[^.;]*/gi, " ");
    }

    function classifyPestTags(rawText, options) {
        const text = options && options.stripNegations ? stripNegationClauses(rawText) : String(rawText || "");
        if (!text.trim()) return [];
        const tags = [];
        for (let i = 0; i < PEST_TAG_RULES.length; i++) {
            const rule = PEST_TAG_RULES[i];
            if (rule.re.test(text)) {
                tags.push(rule.tag);
            }
        }
        return tags;
    }

    function classifyRepellentTags(rawText) {
        const text = String(rawText || "");
        if (!text.trim()) return [];
        const tags = [];
        for (let i = 0; i < PEST_TAG_RULES.length; i++) {
            const rule = PEST_TAG_RULES[i];
            if (rule.tag === "caterpillar") {
                if (/\b(?:caterpillars?|moth\s+caterpillars?|lepidoptera)\b/i.test(text)) {
                    tags.push(rule.tag);
                }
            } else if (rule.re.test(text)) {
                tags.push(rule.tag);
            }
        }
        return tags;
    }

    function getPredatorPreyTags(predatorText) {
        const str = String(predatorText || "");
        const tags = new Set();
        for (let i = 0; i < PREDATOR_PREY_RULES.length; i++) {
            if (PREDATOR_PREY_RULES[i].re.test(str)) {
                PREDATOR_PREY_RULES[i].tags.forEach(function (t) { tags.add(t); });
            }
        }
        const feedsMatch = str.match(/feeds\s+on\s+([^)]+)/i);
        if (feedsMatch) {
            classifyPestTags(feedsMatch[1]).forEach(function (t) { tags.add(t); });
        }
        return Array.from(tags);
    }

    function getBiosRole(entry) {
        const cat = String((entry && entry.category) || "");
        if (/Beneficial Insects & Mites/i.test(cat) && !/Greenhouse Pests/i.test(cat)) return "beneficial";
        if (/Greenhouse Pests/i.test(cat)) return "pest";
        if (/Biocontrol|Entomopathogenic|Pseudomonads|Bacillus|Streptomyces|Plant Growth/i.test(cat)) return "biocontrol";
        if (/Insecticides|Miticides/i.test(cat)) return "chemical";
        return "biocontrol";
    }

    function getBiosRoleLabel(entryOrAction, roleOpt) {
        if (entryOrAction === "repel") return "Repellent Companion";
        if (entryOrAction === "biopesticide") return "Botanical Defense";
        if (entryOrAction === "predator") {
            const labelStr = String(roleOpt || "");
            if (/\bbirds?\b/i.test(labelStr)) return "Beneficial Bird";
            if (/predatory\s*mite/i.test(labelStr)) return "Predatory Mite";
            if (/aphidius|praon|aphelinus|ephedrus|parasitic\s*wasp|predatory\s*wasp|\bwasp\b|parasitoid/i.test(labelStr)) return "Parasitic Wasp";
            return "Beneficial Insect";
        }
        const entry = (entryOrAction && typeof entryOrAction === "object") ? entryOrAction : {};
        const role = roleOpt || getBiosRole(entry);
        if (role === "pest") return "Pest Profile";
        if (role === "chemical") return "Conventional Control";
        const idAndName = String((entry.id || "") + " " + (entry.name || entry.metabolite || "") + " " + (entry.scientificName || ""));
        if (role === "biocontrol" || /steinernema|heterorhabditis|beauveria|lecanicillium|bacillus|pseudomonas|streptomyces|pgpr|rhizobacter/i.test(idAndName)) {
            return "Microbial Ally";
        }
        if (/phytoseiulus|neoseiulus|amblyseius|amblydromalus|transeius|iphiseius|stratiolaelaps|macrocheles|gaeolaelaps|anystis|galendromus|mesoseiulus|\bmite\b/i.test(idAndName)) {
            return "Predatory Mite";
        }
        if (/aphidius|encarsia|eretmocerus|diglyphus|dacnusa|aphelinus|praon|ephedrus|anagyrus|leptomastix|aphytis|trichogramma|cotesia|tamarixia|muscidifurax|parasitoid|\bwasp\b/i.test(idAndName)) {
            return "Parasitic Wasp";
        }
        return "Beneficial Insect";
    }

    function getBiosTargetTags(entry) {
        if (!entry) return [];
        const role = getBiosRole(entry);
        const targetText = String(entry.targets || "");
        const tags = new Set(classifyPestTags(targetText, { stripNegations: true }));
        if (role === "pest") {
            classifyPestTags(String(entry.metabolite || "") + " " + String(entry.scientificName || "")).forEach(function (t) {
                tags.add(t);
            });
        }
        return Array.from(tags);
    }

    function getCanonicalPestGroupKey(cleanName) {
        let k = normalizeKey(cleanName);
        k = k.replace(/\s+/g, " ");
        if (k === "cabbage worm") k = "cabbageworm";
        if (k === "spidermite" || k === "spidermites") k = "spider mite";
        if (k === "thrip") k = "thrips";
        if (k.length > 4 && k.endsWith("s") && k !== "thrips" && !k.endsWith("us") && !k.endsWith("is") && !k.endsWith("es")) {
            k = k.slice(0, -1);
        } else if (k.endsWith("beetles")) {
            k = k.slice(0, -1);
        } else if (k.endsWith("flies")) {
            k = k.slice(0, -3) + "y";
        }
        return k;
    }

    function getCanonicalPredatorGroupKey(cleanName) {
        let k = normalizeKey(cleanName);
        if (k === "lacewings") k = "lacewing";
        if (k === "predatory ground beetles") k = "predatory ground beetle";
        if (k === "caterpillar parasitoids") k = "caterpillar parasitoid";
        return k;
    }

    function tagsIntersect(tagsA, tagsB) {
        if (!tagsA || !tagsA.length || !tagsB || !tagsB.length) return false;
        for (let i = 0; i < tagsA.length; i++) {
            if (tagsB.indexOf(tagsA[i]) !== -1) return true;
        }
        return false;
    }

    function doesRepellentMatchPest(repTags, pestTags) {
        if (!repTags || !repTags.length || !pestTags || !pestTags.length) return false;
        for (let i = 0; i < repTags.length; i++) {
            const rt = repTags[i];
            if (pestTags.indexOf(rt) !== -1) return true;
            if (rt === "root_maggot" && (pestTags.indexOf("cabbage_maggot") !== -1 || pestTags.indexOf("onion_maggot") !== -1 || pestTags.indexOf("seed_corn_maggot") !== -1)) {
                return true;
            }
            if (rt === "caterpillar" && pestTags.indexOf("caterpillar") !== -1) {
                return true;
            }
        }
        return false;
    }

    function splitSemicolonOrCommaClean(rawStr) {
        if (!isMeaningful(rawStr)) return [];
        const seen = new Set();
        const out = [];
        splitTopLevelItems(String(rawStr).replace(/;\s*,/g, ";")).forEach(function (part) {
            const clean = normalizeEcologyTokenText(part);
            if (!isValidEcologyToken(clean)) return;
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
        splitTopLevelSemicolonSegments(rawStr).forEach(function (seg) {
            const strippedSeg = stripDepth0HostColonNote(seg);
            if (!strippedSeg) return;
            splitTopLevelItems(strippedSeg).forEach(function (chunk) {
                let clean = normalizeEcologyTokenText(chunk);
                if (!isValidEcologyToken(clean)) return;
                clean = normalizeLatinPestDisplay(clean);
                if (!isValidEcologyToken(clean)) return;
                const k = normalizeKey(clean);
                if (!k || seen.has(k)) return;
                seen.add(k);
                out.push(clean);
            });
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

    function extractCleanBiopesticides(crop) {
        const raw = crop && crop["Biopesticide Produced Chemical"];
        if (!isMeaningful(raw)) return [];
        const rawStr = String(raw).trim();
        // Guard against shifted disease or companion-predator cells in garden_crops.json (e.g. Kohlrabi, Snow Pea, Tomatillos)
        if (/(?:blight|mildew|clubroot|grey mould|white mould|root rot|cercospora)/i.test(rawStr) &&
            !/(?:deters|repels|repls|affects|inhibit|impacts|terthienyl|linalool|eugenol|solanine|chaconine|capsaicin|pyrethrum|thujone|thymol|disulfide|isothiocyanate|latex)/i.test(rawStr)) {
            return [];
        }
        if (/(?:potted barley|chamomile \(|catnip \(|dill \(|lovage \(|nasturtium \()/i.test(rawStr)) {
            return [];
        }
        return splitSemicolonOrCommaClean(rawStr.replace(/,\s+and\s+(?=[A-Z])/g, ", ")).map(function (tok) {
            return /^[a-z]/.test(tok) ? (tok.charAt(0).toUpperCase() + tok.slice(1)) : tok;
        });
    }

    function extractCleanDiseases(crop) {
        const rawPrimary = crop && (crop["Disease Suceptibility"] || crop["Disease Susceptibility"]);
        if (isMeaningful(rawPrimary)) {
            return splitSemicolonOrCommaClean(rawPrimary);
        }
        const rawBio = crop && crop["Biopesticide Produced Chemical"];
        if (isMeaningful(rawBio) &&
            /(?:blight|mildew|clubroot|grey mould|white mould|root rot|cercospora)/i.test(String(rawBio)) &&
            !/(?:deters|repels|repls|affects|inhibit|impacts|terthienyl|linalool|eugenol|solanine|chaconine|capsaicin|pyrethrum|thujone|thymol|disulfide|isothiocyanate|latex)/i.test(String(rawBio))) {
            return splitSemicolonOrCommaClean(rawBio);
        }
        return [];
    }

    function getBiosIndexedCache(catalog) {
        if (!catalog || !Array.isArray(catalog.bios)) return [];
        if (catalog._biosEcoIndex && catalog._biosEcoIndexLen === catalog.bios.length) {
            return catalog._biosEcoIndex;
        }
        const indexed = [];
        catalog.bios.forEach(function (b) {
            if (!b || !b.id || b.id === "harmonia-axyridis") return;
            const role = getBiosRole(b);
            if (role === "chemical") return;
            const cropTokens = isMeaningful(b.crops)
                ? String(b.crops).split(/[;,]+/).map(normalizeKey).filter(Boolean)
                : [];
            indexed.push({
                entry: b,
                id: b.id,
                name: b.metabolite || b.scientificName || b.id,
                scientificName: b.scientificName || "",
                category: b.category || "",
                role: role,
                roleLabel: getBiosRoleLabel(b, role),
                targets: b.targets || "",
                targetTags: getBiosTargetTags(b),
                nameTags: role === "pest"
                    ? classifyPestTags(String(b.metabolite || "") + " " + String(b.scientificName || ""))
                    : [],
                cropTokens: cropTokens
            });
        });
        catalog._biosEcoIndex = indexed;
        catalog._biosEcoIndexLen = catalog.bios.length;
        return indexed;
    }

    function getCropDefenderIndex(catalog) {
        if (!catalog || !Array.isArray(catalog.crops)) return [];
        if (catalog._cropDefenderIndex && catalog._cropDefenderIndexLen === catalog.crops.length) {
            return catalog._cropDefenderIndex;
        }
        const indexed = [];
        catalog.crops.forEach(function (cand) {
            if (!cand || !cand.name) return;
            const candPreds = splitSemicolonOrCommaClean(cand["Natural Predators Attracted"]).filter(isTruePredatorToken);
            const candRepels = splitSemicolonOrCommaClean(cand["Pest Repelled"]).concat(splitSemicolonOrCommaClean(cand["Pest Deterred"]));
            if (candPreds.length === 0 && candRepels.length === 0) return;

            const repelsParsed = candRepels.map(function (rp) {
                return { text: rp, tags: classifyRepellentTags(rp) };
            });
            const predsParsed = candPreds.map(function (pr) {
                return { text: pr, shortName: extractPlantNameToken(pr), tags: getPredatorPreyTags(pr) };
            });
            const ownPestTagsSet = new Set();
            parsePestAttractedList(cand["Pest Attracted / Trapped"]).forEach(function (cp) {
                classifyPestTags(cp).forEach(function (t) {
                    if (t !== "caterpillar") ownPestTagsSet.add(t);
                });
            });
            const dims = estimateCropDimensionsCm(cand);
            const canopy = classifyCanopyStratum(cand, dims.heightMidCm);
            const isUnderstory = (canopy.canopyStratum === "groundcover" ||
                (cand.category === "Cover Crop" && dims.heightMidCm <= 35) ||
                /\b(basil|thyme|oregano|parsley|strawberry|alyssum|clover)\b/i.test(cand.name));
            const genus = (cand.latin || "").trim().split(/\s+/)[0].toLowerCase() || normalizeKey(cand.name.split("(")[0]);

            indexed.push({
                crop: cand,
                nameKey: normalizeKey(cand.name),
                genus: genus,
                repelsParsed: repelsParsed,
                predsParsed: predsParsed,
                ownPestTags: Array.from(ownPestTagsSet),
                defaultMode: isUnderstory ? "understory" : "border",
                defaultSharePct: isUnderstory ? 30 : 25
            });
        });
        catalog._cropDefenderIndex = indexed;
        catalog._cropDefenderIndexLen = catalog.crops.length;
        return indexed;
    }

    function matchCropToBios(crop, parsedLists, catalog) {
        if (!crop || !catalog || !Array.isArray(catalog.bios) || catalog.bios.length === 0) {
            return [];
        }
        const matchedMap = new Map(); // id -> { entry, score, via, role, roleLabel, tokens: Set }

        function addHit(entry, score, via, tokenOpt) {
            if (!entry || !entry.id || entry.id === "harmonia-axyridis") return;
            const role = getBiosRole(entry);
            if (role === "chemical") return;
            const roleBonus = role === "beneficial" ? 25 : (role === "pest" ? 22 : 15);
            const total = score + roleBonus;
            const prev = matchedMap.get(entry.id);
            if (!prev) {
                const tokSet = new Set();
                if (tokenOpt) tokSet.add(normalizeKey(tokenOpt));
                matchedMap.set(entry.id, {
                    entry: entry,
                    score: total,
                    via: via,
                    role: role,
                    roleLabel: getBiosRoleLabel(entry, role),
                    tokens: tokSet
                });
            } else {
                if (tokenOpt) prev.tokens.add(normalizeKey(tokenOpt));
                if (total > prev.score) {
                    prev.score = total;
                    prev.via = via;
                }
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

        const biosIndexed = getBiosIndexedCache(catalog);
        const biosIdxById = new Map(biosIndexed.map(function (item) { return [item.id, item]; }));

        // 1. Match crop name/family ONLY for microbial/soil biocontrol allies (not unrelated greenhouse pests)
        biosIndexed.forEach(function (bIdx) {
            if (bIdx.role !== "biocontrol") return;
            if (bIdx.cropTokens.length > 0) {
                for (let i = 0; i < cropSearchTokens.length; i++) {
                    const tok = cropSearchTokens[i];
                    const exactHit = bIdx.cropTokens.some(function (cl) {
                        return cl === tok || cl === tok + "s" || (tok.length >= 4 && cl.includes(tok));
                    });
                    if (exactHit) {
                        addHit(bIdx.entry, i < 2 ? 26 : 18, "Crop biocontrol ally: " + crop.name, crop.name);
                        break;
                    }
                }
            }
            if (cLatinKey && isMeaningful(bIdx.entry.hostPlantsBeeSheet)) {
                const hLow = normalizeKey(bIdx.entry.hostPlantsBeeSheet);
                if (hLow.includes(cLatinKey) || (cLatinKey.split(" ")[0].length >= 5 && hLow.includes(cLatinKey.split(" ")[0]))) {
                    addHit(bIdx.entry, 24, "Host plant sheet", crop.name);
                }
            }
        });

        // 2. Match natural predators attracted -> beneficial/biocontrol bios entries only
        (parsedLists.naturalPredators || []).forEach(function (predText) {
            const via = "Predator attracted: " + predText;
            const clean = extractPlantNameToken(predText);
            const k = normalizeKey(clean);
            const kFull = normalizeKey(predText);
            if (catalog.biosByName instanceof Map) {
                const direct = catalog.biosByName.get(k) || catalog.biosByName.get(kFull);
                if (direct && getBiosRole(direct) !== "pest") {
                    addHit(direct, 52, via, predText);
                }
            }
            for (let ri = 0; ri < BIOS_ROLE_KEYWORDS.length; ri++) {
                const rule = BIOS_ROLE_KEYWORDS[ri];
                if (rule.re.test(predText)) {
                    for (let ii = 0; ii < rule.ids.length; ii++) {
                        const hit = catalog.biosById instanceof Map ? catalog.biosById.get(rule.ids[ii]) : null;
                        if (hit && getBiosRole(hit) !== "pest") {
                            addHit(hit, 48 - ii * 2, via, predText);
                        }
                    }
                }
            }
        });

        // 3. Match active pests attracted -> ONLY pest profiles matching that pest & beneficials/biocontrols targeting that pest
        (parsedLists.pestsAttracted || []).forEach(function (pestText) {
            const via = "Pest risk: " + pestText;
            const pestTags = classifyPestTags(pestText);
            const clean = extractPlantNameToken(pestText);
            const k = normalizeKey(clean);
            const kFull = normalizeKey(pestText);

            if (catalog.biosByName instanceof Map) {
                const direct = catalog.biosByName.get(k) || catalog.biosByName.get(kFull);
                if (direct) {
                    const dIdx = biosIdxById.get(direct.id);
                    if (dIdx && (dIdx.role === "pest" || tagsIntersect(dIdx.targetTags, pestTags))) {
                        addHit(direct, 44, via, pestText);
                    }
                }
            }
            for (let ri = 0; ri < BIOS_ROLE_KEYWORDS.length; ri++) {
                const rule = BIOS_ROLE_KEYWORDS[ri];
                if (rule.re.test(pestText)) {
                    for (let ii = 0; ii < rule.ids.length; ii++) {
                        const hit = catalog.biosById instanceof Map ? catalog.biosById.get(rule.ids[ii]) : null;
                        if (hit) addHit(hit, 40 - ii * 2, via, pestText);
                    }
                }
            }
            if (pestTags.length > 0) {
                biosIndexed.forEach(function (bIdx) {
                    if (!tagsIntersect(bIdx.targetTags, pestTags)) return;
                    if (bIdx.role === "pest") {
                        if (tagsIntersect(bIdx.nameTags, pestTags)) {
                            addHit(bIdx.entry, 42, via, pestText);
                        }
                    } else {
                        addHit(bIdx.entry, 28, via, pestText);
                    }
                });
            }
        });

        // 4. Match pests repelled/deterred -> ONLY beneficial/biocontrol entries whose targets actually cover that pest
        []
            .concat((parsedLists.pestsDeterred || []).map(function (t) { return { text: t, via: "Pest deterred: " + t }; }))
            .concat((parsedLists.pestsRepelled || []).map(function (t) { return { text: t, via: "Pest repelled: " + t }; }))
            .forEach(function (item) {
                const repTags = classifyRepellentTags(item.text);
                if (repTags.length === 0) return;
                biosIndexed.forEach(function (bIdx) {
                    if (bIdx.role !== "beneficial" && bIdx.role !== "biocontrol") return;
                    if (tagsIntersect(bIdx.targetTags, repTags)) {
                        addHit(bIdx.entry, 24, item.via, item.text);
                    }
                });
            });

        return Array.from(matchedMap.values())
            .sort(function (a, b) { return b.score - a.score; })
            .slice(0, 20)
            .map(function (item) {
                return {
                    id: item.entry.id,
                    name: item.entry.metabolite || item.entry.scientificName || item.entry.id,
                    scientificName: item.entry.scientificName || "",
                    category: item.entry.category || "",
                    role: item.role,
                    roleLabel: item.roleLabel,
                    targets: item.entry.targets || "",
                    crops: item.entry.crops || "",
                    matchedVia: item.via,
                    matchedTokens: Array.from(item.tokens)
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

        const rawPredTokens = splitSemicolonOrCommaClean(crop["Natural Predators Attracted"]);
        const naturalPredators = rawPredTokens.filter(isTruePredatorToken);
        const extraPollinatorsFromPreds = rawPredTokens.filter(function (tok) {
            return PURE_POLLINATOR_TOKEN_RE.test(String(tok).trim());
        });
        const pestsDeterred = splitSemicolonOrCommaClean(crop["Pest Deterred"]);
        const pestsRepelled = splitSemicolonOrCommaClean(crop["Pest Repelled"]);
        const pestsAttracted = parsePestAttractedList(crop["Pest Attracted / Trapped"]);
        const biopesticides = extractCleanBiopesticides(crop);
        const diseases = extractCleanDiseases(crop);
        const pollinators = splitSemicolonOrCommaClean(
            [crop.Pollinators, crop["Pollinators Attracted"]].concat(extraPollinatorsFromPreds).filter(isMeaningful).join("; ")
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
            phRange: formatCleanPhRange(crop.phRange || crop["pH"]),
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

    function buildRecommendedDefendersForPest(pest, cat, presentCropKeys, activeCropsList) {
        if (!pest || !cat || !Array.isArray(cat.crops) || !Array.isArray(pest.tags) || pest.tags.length === 0) {
            return [];
        }
        const hostCropObjs = (pest.crops || []).map(function (cname) {
            return cat.cropMap ? resolveCrop(cat.cropMap, cname) : null;
        }).filter(Boolean);
        const otherActiveCrops = (activeCropsList || []).filter(function (ac) {
            return ac && !hostCropObjs.some(function (hc) { return hc.name === ac.name; });
        });
        const defenderIndex = getCropDefenderIndex(cat);
        const scored = [];

        defenderIndex.forEach(function (entry) {
            const cand = entry.crop;
            if (presentCropKeys.has(entry.nameKey)) return;

            for (let hi = 0; hi < hostCropObjs.length; hi++) {
                if (pairCompatibility(cand, cand.name, hostCropObjs[hi], hostCropObjs[hi].name) === "conflict") {
                    return;
                }
            }
            let bedPeerConflict = false;
            for (let ai = 0; ai < otherActiveCrops.length; ai++) {
                if (pairCompatibility(cand, cand.name, otherActiveCrops[ai], otherActiveCrops[ai].name) === "conflict") {
                    bedPeerConflict = true;
                    break;
                }
            }

            const matchedRepels = [];
            const seenRepelKeys = new Set();
            entry.repelsParsed.forEach(function (rp) {
                if (doesRepellentMatchPest(rp.tags, pest.tags)) {
                    const rk = normalizeKey(rp.text);
                    if (!seenRepelKeys.has(rk)) {
                        seenRepelKeys.add(rk);
                        matchedRepels.push(rp.text);
                    }
                }
            });
            const matchedPreds = [];
            const seenPredKeys = new Set();
            entry.predsParsed.forEach(function (pr) {
                if (tagsIntersect(pr.tags, pest.tags)) {
                    const pk = normalizeKey(pr.shortName);
                    if (!seenPredKeys.has(pk)) {
                        seenPredKeys.add(pk);
                        matchedPreds.push(pr.shortName);
                    }
                }
            });

            if (matchedRepels.length === 0 && matchedPreds.length === 0) return;

            let sc = 0;
            const reasons = [];
            if (matchedRepels.length > 0) {
                sc += 50 + Math.min(15, matchedRepels.length * 4);
                reasons.push("Repels " + matchedRepels.slice(0, 2).join(", "));
            }
            if (matchedPreds.length > 0) {
                sc += 35 + Math.min(20, matchedPreds.length * 5);
                reasons.push("Attracts " + matchedPreds.slice(0, 2).join(", "));
            }
            if (matchedRepels.length > 0 && matchedPreds.length > 0) sc += 20;
            if (!cand.isEstimatedDefault) sc += 15;
            if (cand.interplantable) sc += 12;
            if (cand.category === "Flower" || cand.category === "Herb") sc += 10;
            else if (cand.category === "Cover Crop") sc += 4;
            if (cand.isNativeBC) sc += 5;

            if (tagsIntersect(entry.ownPestTags, pest.tags)) {
                sc -= 45;
            }
            if (bedPeerConflict) {
                sc -= 15;
            }
            if (sc <= 10) return;

            scored.push({
                cropName: cand.name,
                genus: entry.genus,
                defaultMode: entry.defaultMode,
                defaultSharePct: entry.defaultSharePct,
                reason: reasons.slice(0, 2).join(" · "),
                score: sc
            });
        });

        scored.sort(function (a, b) {
            if (b.score !== a.score) return b.score - a.score;
            return a.cropName.localeCompare(b.cropName);
        });

        const picked = [];
        const usedGenera = new Set();
        const deferred = [];
        for (let i = 0; i < scored.length && picked.length < 3; i++) {
            const it = scored[i];
            const outItem = {
                cropName: it.cropName,
                defaultMode: it.defaultMode,
                defaultSharePct: it.defaultSharePct,
                reason: it.reason
            };
            if (it.genus && !usedGenera.has(it.genus)) {
                usedGenera.add(it.genus);
                picked.push(outItem);
            } else {
                deferred.push(outItem);
            }
        }
        for (let i = 0; i < deferred.length && picked.length < 3; i++) {
            picked.push(deferred[i]);
        }
        return picked;
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

        // Include any unscheduled Playground placedPlants so container/playground crops show in Ecology immediately
        if (Array.isArray(season.placedPlants) && season.placedPlants.length > 0) {
            const scheduledSpeciesKeys = new Set();
            scopedPlantings.forEach(function (p) {
                const c = (cat && cat.cropMap) ? resolveCrop(cat.cropMap, p.cropName) : null;
                const k = (p.blockId || "") + "::" + normalizeKey(c ? c.name : p.cropName);
                scheduledSpeciesKeys.add(k);
            });
            season.placedPlants.forEach(function (pp) {
                if (!pp || !pp.cropName) return;
                if (blockIdOpt && pp.blockId !== blockIdOpt) return;
                const c = (cat && cat.cropMap) ? resolveCrop(cat.cropMap, pp.cropName) : null;
                const canonical = c ? c.name : pp.cropName;
                const k = (pp.blockId || "") + "::" + normalizeKey(canonical);
                if (scheduledSpeciesKeys.has(k)) return;
                scheduledSpeciesKeys.add(k);
                scopedPlantings.push({
                    id: pp.id || ("virt_" + k),
                    cropName: canonical,
                    blockId: pp.blockId || null,
                    bedStart: pp.bedNumber || 1,
                    bedCount: 1,
                    startDate: pp.startDate || ((season.year || 2026) + "-05-01"),
                    interplantMode: (pp.role === "border" || pp.role === "spiller") ? "border" : (pp.role === "understory" ? "understory" : "sole")
                });
            });
        }

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
        const biosAllyAgg = new Map();
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

                // Aggregate pests (merging singular/plural variants cleanly)
                prof.pestsAttracted.forEach(function (label) {
                    const k = getCanonicalPestGroupKey(label);
                    if (!pestAgg.has(k)) {
                        pestAgg.set(k, {
                            id: toEcologySlug(k),
                            key: k,
                            name: label,
                            count: 0,
                            crops: [],
                            tags: classifyPestTags(label),
                            bioEntries: []
                        });
                    }
                    const rec = pestAgg.get(k);
                    if (rec.crops.indexOf(canonicalName) === -1) {
                        rec.crops.push(canonicalName);
                        rec.count = rec.crops.length;
                    }
                    classifyPestTags(label).forEach(function (t) {
                        if (rec.tags.indexOf(t) === -1) rec.tags.push(t);
                    });
                });

                // Aggregate natural predators attracted (merging variants cleanly)
                prof.naturalPredators.forEach(function (label) {
                    const k = getCanonicalPredatorGroupKey(label);
                    if (!predatorAgg.has(k)) {
                        predatorAgg.set(k, {
                            id: "pred-" + toEcologySlug(extractPlantNameToken(label) || k),
                            key: k,
                            name: label,
                            count: 0,
                            crops: [],
                            supportedByCrops: [],
                            roleLabel: getBiosRoleLabel("predator", label),
                            preyTags: getPredatorPreyTags(label),
                            targetsPests: [],
                            targetsPestNames: [],
                            bioEntries: []
                        });
                    }
                    const rec = predatorAgg.get(k);
                    if (rec.crops.indexOf(canonicalName) === -1) {
                        rec.crops.push(canonicalName);
                        rec.supportedByCrops.push(canonicalName);
                        rec.count = rec.crops.length;
                    }
                    prof.matchedBioEntries.forEach(function (be) {
                        if (be.role !== "beneficial" && be.role !== "biocontrol") return;
                        const tokMatch = Array.isArray(be.matchedTokens) && be.matchedTokens.some(function (mt) {
                            return mt === normalizeKey(label) || getCanonicalPredatorGroupKey(mt) === k;
                        });
                        if (tokMatch && !rec.bioEntries.some(function (x) { return x.id === be.id; })) {
                            rec.bioEntries.push({
                                id: be.id,
                                name: be.name,
                                category: be.category,
                                role: be.role,
                                roleLabel: be.roleLabel || getBiosRoleLabel(be, be.role)
                            });
                        }
                    });
                });

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
                    const combinedRepTargets = prof.pestsRepelled.concat(prof.pestsDeterred);
                    const repTargetTags = [];
                    combinedRepTargets.forEach(function (t) {
                        classifyRepellentTags(t).forEach(function (tg) {
                            if (repTargetTags.indexOf(tg) === -1) repTargetTags.push(tg);
                        });
                    });
                    if (combinedRepTargets.length > 0) {
                        const matchedRepBios = prof.matchedBioEntries.filter(function (be) {
                            if (be.role !== "beneficial" && be.role !== "biocontrol") return false;
                            const beTags = classifyPestTags(be.targets || "", { stripNegations: true });
                            return doesRepellentMatchPest(repTargetTags, beTags);
                        }).slice(0, 4);
                        biocontrolList.push({
                            id: "repel-" + toEcologySlug(canonicalName),
                            name: canonicalName + " (Repellent / Deterrent)",
                            sourceCrop: canonicalName,
                            supportedByCrops: [canonicalName],
                            action: "repel",
                            roleLabel: getBiosRoleLabel("repel"),
                            targets: combinedRepTargets,
                            _targetTags: repTargetTags,
                            targetsPests: [],
                            targetsPestNames: [],
                            bioEntries: matchedRepBios
                        });
                    }
                    if (prof.biopesticides.length > 0) {
                        const bioChemTargets = combinedRepTargets.length > 0
                            ? combinedRepTargets
                            : prof.biopesticides;
                        const bioChemTags = [];
                        prof.biopesticides.concat(combinedRepTargets).forEach(function (t) {
                            classifyRepellentTags(t).forEach(function (tg) {
                                if (bioChemTags.indexOf(tg) === -1) bioChemTags.push(tg);
                            });
                        });
                        const matchedChemBios = prof.matchedBioEntries.filter(function (be) {
                            if (be.role !== "biocontrol") return false;
                            const beTags = classifyPestTags(be.targets || "", { stripNegations: true });
                            return tagsIntersect(bioChemTags, beTags);
                        }).slice(0, 3);
                        biocontrolList.push({
                            id: "biochem-" + toEcologySlug(canonicalName),
                            name: prof.biopesticides.slice(0, 2).join("; "),
                            sourceCrop: canonicalName,
                            supportedByCrops: [canonicalName],
                            action: "biopesticide",
                            roleLabel: getBiosRoleLabel("biopesticide"),
                            targets: bioChemTargets,
                            _targetTags: bioChemTags,
                            targetsPests: [],
                            targetsPestNames: [],
                            bioEntries: matchedChemBios
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
                        if (!biosAllyAgg.has(be.id)) {
                            biosAllyAgg.set(be.id, {
                                id: "bios-" + be.id,
                                name: be.name,
                                sourceCrop: canonicalName,
                                supportedByCrops: [canonicalName],
                                action: "bios",
                                roleLabel: be.roleLabel || getBiosRoleLabel(be, be.role),
                                targets: be.targets ? [be.targets] : [],
                                _targetTags: classifyPestTags(be.targets || "", { stripNegations: true }),
                                targetsPests: [],
                                targetsPestNames: [],
                                bioEntries: [be]
                            });
                        } else {
                            const existingAlly = biosAllyAgg.get(be.id);
                            if (existingAlly.supportedByCrops.indexOf(canonicalName) === -1) {
                                existingAlly.supportedByCrops.push(canonicalName);
                                existingAlly.sourceCrop = existingAlly.supportedByCrops.join(", ");
                            }
                        }
                    }
                });
            }
        });

        biosAllyAgg.forEach(function (item) { biocontrolList.push(item); });

        // Reuse cached bios index for accurate per-pest matching
        const biosEntriesIndexed = getBiosIndexedCache(cat);

        // Sort pests by affected crop count descending, preferring named garden pests on ties
        const allSortedPests = Array.from(pestAgg.values()).sort(function (a, b) {
            if (b.count !== a.count) return b.count - a.count;
            const aNamed = /\s|\(/.test(a.name) && !/^[A-Z][a-z]+ [a-z]+$/.test(a.name) ? 1 : 0;
            const bNamed = /\s|\(/.test(b.name) && !/^[A-Z][a-z]+ [a-z]+$/.test(b.name) ? 1 : 0;
            if (bNamed !== aNamed) return bNamed - aNamed;
            return a.name.localeCompare(b.name);
        }).slice(0, 18);

        const allPredators = Array.from(predatorAgg.values()).sort(function (a, b) {
            return b.count - a.count;
        });

        // Cross-pair every active pest <-> predators, repellents, bios allies, and catalog defender recommendations
        allSortedPests.forEach(function (pest) {
            const pTags = pest.tags || [];
            const counteredByPredators = [];
            const counteredByRepellents = [];
            const counteredByBios = [];

            biosEntriesIndexed.forEach(function (bIdx) {
                if (bIdx.role === "pest" && tagsIntersect(bIdx.nameTags, pTags)) {
                    if (!pest.bioEntries.some(function (x) { return x.id === bIdx.id; })) {
                        pest.bioEntries.push({
                            id: bIdx.id,
                            name: bIdx.name,
                            category: bIdx.category,
                            role: bIdx.role,
                            roleLabel: bIdx.roleLabel
                        });
                    }
                } else if ((bIdx.role === "beneficial" || bIdx.role === "biocontrol") && tagsIntersect(bIdx.targetTags, pTags)) {
                    counteredByBios.push({
                        id: bIdx.id,
                        name: bIdx.name,
                        scientificName: bIdx.scientificName,
                        category: bIdx.category,
                        role: bIdx.role,
                        roleLabel: bIdx.roleLabel,
                        targets: bIdx.targets
                    });
                }
            });

            counteredByBios.sort(function (a, b) {
                const aSpec = a.role === "beneficial" ? 1 : 0;
                const bSpec = b.role === "beneficial" ? 1 : 0;
                if (bSpec !== aSpec) return bSpec - aSpec;
                return a.name.localeCompare(b.name);
            });

            allPredators.forEach(function (pred) {
                if (tagsIntersect(pred.preyTags, pTags)) {
                    counteredByPredators.push({
                        id: pred.id,
                        name: pred.name,
                        crops: pred.crops.slice(),
                        roleLabel: pred.roleLabel
                    });
                    if (pred.targetsPests.indexOf(pest.id) === -1) {
                        pred.targetsPests.push(pest.id);
                        pred.targetsPestNames.push(pest.name);
                    }
                }
            });

            biocontrolList.forEach(function (bioItem) {
                if (bioItem.action === "repel" && doesRepellentMatchPest(bioItem._targetTags, pTags)) {
                    counteredByRepellents.push({
                        id: bioItem.id,
                        name: bioItem.name,
                        sourceCrop: bioItem.sourceCrop,
                        action: bioItem.action,
                        roleLabel: bioItem.roleLabel
                    });
                    if (bioItem.targetsPests.indexOf(pest.id) === -1) {
                        bioItem.targetsPests.push(pest.id);
                        bioItem.targetsPestNames.push(pest.name);
                    }
                } else if ((bioItem.action === "biopesticide" || bioItem.action === "bios") && tagsIntersect(bioItem._targetTags, pTags)) {
                    if (bioItem.targetsPests.indexOf(pest.id) === -1) {
                        bioItem.targetsPests.push(pest.id);
                        bioItem.targetsPestNames.push(pest.name);
                    }
                }
            });

            pest.bioEntries = pest.bioEntries.slice(0, 4);
            pest.counteredByPredators = counteredByPredators;
            pest.counteredByRepellents = counteredByRepellents;
            pest.counteredByBios = counteredByBios.slice(0, 6);
            pest.isProtected = counteredByPredators.length > 0 || counteredByRepellents.length > 0;
            pest.recommendedDefenders = buildRecommendedDefendersForPest(pest, cat, presentCropKeys, activeCropsList);
        });

        const totalThreats = allSortedPests.length;
        const protectedCount = allSortedPests.filter(function (p) { return p.isProtected; }).length;
        const unprotectedCount = totalThreats - protectedCount;
        const coveragePct = totalThreats > 0
            ? Math.round((protectedCount / totalThreats) * 100)
            : (scopedPlantings.length > 0 ? 100 : 0);

        const finalizedPredators = allPredators.slice(0, 16).map(function (pred) {
            return {
                id: pred.id,
                name: pred.name,
                count: pred.count,
                crops: pred.crops,
                supportedByCrops: pred.supportedByCrops,
                roleLabel: pred.roleLabel,
                targetsPests: pred.targetsPests,
                targetsPestNames: pred.targetsPestNames,
                bioEntries: pred.bioEntries
            };
        });

        const finalizedBiocontrols = biocontrolList
            .slice()
            .sort(function (a, b) {
                const aAct = a.action === "repel" ? 2 : (a.action === "biopesticide" ? 1 : 0);
                const bAct = b.action === "repel" ? 2 : (b.action === "biopesticide" ? 1 : 0);
                if (b.targetsPests.length !== a.targetsPests.length) return b.targetsPests.length - a.targetsPests.length;
                if (bAct !== aAct) return bAct - aAct;
                return a.name.localeCompare(b.name);
            })
            .slice(0, 20)
            .map(function (item) {
                return {
                    id: item.id,
                    name: item.name,
                    sourceCrop: item.sourceCrop,
                    supportedByCrops: item.supportedByCrops,
                    action: item.action,
                    roleLabel: item.roleLabel,
                    targets: item.targets,
                    targetsPests: item.targetsPests,
                    targetsPestNames: item.targetsPestNames,
                    bioEntries: item.bioEntries
                };
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

                const hasTruePreds = splitSemicolonOrCommaClean(cand["Natural Predators Attracted"]).some(isTruePredatorToken);
                let sc = covers.length * 15;
                if (!cand.isEstimatedDefault) sc += 18;
                if (cand.interplantable) sc += 12;
                if (cand.isNativeBC) sc += 10;
                if (cand.category === "Flower" || cand.category === "Herb") sc += 8;
                if (hasTruePreds) sc += 10;
                candidates.push({
                    cropName: cand.name,
                    category: cand.category,
                    isNativeBC: Boolean(cand.isNativeBC),
                    bloomMonths: candBlooms,
                    coversGapMonths: covers,
                    coversLabels: covers.map(function (m) { return MONTH_ABBR[m - 1]; }),
                    reason: "Blooms " + covers.map(function (m) { return MONTH_ABBR[m - 1]; }).join(", ") +
                        (hasTruePreds ? " · Attracts beneficial predators" : " · Bridges pollinator gap"),
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
                coverage: {
                    totalThreats: totalThreats,
                    protectedCount: protectedCount,
                    unprotectedCount: unprotectedCount,
                    coveragePct: coveragePct
                },
                pests: allSortedPests,
                predators: finalizedPredators,
                biocontrols: finalizedBiocontrols,
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

            const predators = splitSemicolonOrCommaClean(cand["Natural Predators Attracted"]).filter(isTruePredatorToken);
            if (predators.length > 0) {
                score += 18;
                reasons.push("Attracts " + predators.slice(0, 2).map(extractPlantNameToken).join(", "));
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

            if (extractCleanBiopesticides(cand).length > 0) {
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
            const candDims = estimateCropDimensionsCm(cand);
            const candCanopy = classifyCanopyStratum(cand, candDims.heightMidCm);
            const targetDtm = target ? Number(target.dtmDays || 60) : 60;
            const candDtm = Number(cand.dtmDays || 60);
            let defaultMode = "lanes";
            let defaultSharePct = 50;

            if ((candCanopy.canopyStratum === "groundcover" ||
                (cand.category === "Cover Crop" && candDims.heightMidCm <= 35) ||
                /\b(basil|thyme|oregano|parsley|strawberry|alyssum|clover)\b/i.test(cand.name)) &&
                targetProf && targetProf.heightCm.mid >= 65 && candDims.heightMidCm <= targetProf.heightCm.mid * 0.6) {
                defaultMode = "understory";
            } else if (cand.category === "Flower" || (cand.category === "Herb" && repelled.length > 0) ||
                /\b(marigold|calendula|nasturtium|borage|chamomile)\b/i.test(cand.name)) {
                defaultMode = "border";
            } else if (candDtm <= 45 && targetDtm >= 60) {
                defaultMode = "relay";
            } else if (targetProf && targetProf.heightCm.mid >= 60 && candDims.heightMidCm <= 45 &&
                (candCanopy.canopyStratum === "groundcover" || candCanopy.canopyStratum === "low")) {
                defaultMode = "understory";
            } else if (cand.category === "Flower" || cand.category === "Herb") {
                defaultMode = "border";
            }

            const modeTag = defaultMode === "lanes"
                ? "Lane"
                : (defaultMode === "relay" ? "Relay" : (defaultMode === "understory" ? "Understory" : "Border"));
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
                defaultMode: defaultMode,
                defaultSharePct: defaultSharePct,
                defaultStrip: {
                    cropName: cand.name,
                    label: cand.name + " " + modeTag,
                    bedCount: 1,
                    interplanted: true,
                    interplantMode: defaultMode,
                    interplantSharePct: defaultSharePct,
                    borderSides: 2,
                    method: cand.method || "Direct Seed",
                    rowsPerBed: defaultMode === "lanes" ? (cand.rowsPerBed || 2) : (cand.rowsPerBed || 1)
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
        CUSTOM_SHAPES_STORAGE_KEY: CUSTOM_SHAPES_STORAGE_KEY,
        CUSTOM_SHAPE_FORMAT: CUSTOM_SHAPE_FORMAT,
        CUSTOM_SHAPE_VERSION: CUSTOM_SHAPE_VERSION,
        CUSTOM_SHAPE_TEMPLATES: CUSTOM_SHAPE_TEMPLATES,
        INTERPLANT_MODES: INTERPLANT_MODES,
        PREFS_COOKIE_NAME: PREFS_COOKIE_NAME,
        BC_MONTHLY_TEMP_C: BC_MONTHLY_TEMP_C,
        DEFAULT_ROTATION_CYCLES: DEFAULT_ROTATION_CYCLES,
        STANDARD_BED_PRESETS: STANDARD_BED_PRESETS,
        BLOCK_TYPES: BLOCK_TYPES,
        CONTAINER_PRESETS: CONTAINER_PRESETS,
        GROWING_MEDIA_INGREDIENTS: GROWING_MEDIA_INGREDIENTS,
        GROWING_MEDIA_PRESETS: GROWING_MEDIA_PRESETS,
        FAMILY_COLORS: FAMILY_COLORS,
        CATEGORY_COLORS: CATEGORY_COLORS,

        loadCatalog: loadCatalog,
        loadEcologicalEnrichment: loadEcologicalEnrichment,
        whenEnriched: whenEnriched,
        getCatalog: function () { return _cachedCatalog; },
        resolveCrop: resolveCrop,
        getFamilyColor: getFamilyColor,
        getCategoryColor: getCategoryColor,

        isContainerBlockType: isContainerBlockType,
        computeContainerGeometry: computeContainerGeometry,
        normalizeGrowingMedia: normalizeGrowingMedia,
        balanceGrowingMediaPct: balanceGrowingMediaPct,
        analyzeGrowingMedia: analyzeGrowingMedia,
        createContainerBlock: createContainerBlock,
        computeRecommendedDensity: computeRecommendedDensity,
        getPlaygroundBounds: getPlaygroundBounds,
        isPointInsidePlayground: isPointInsidePlayground,
        clampPointToPlayground: clampPointToPlayground,
        normalizePlacedPlant: normalizePlacedPlant,
        generateRecommendedPlaygroundPlants: generateRecommendedPlaygroundPlants,
        hydratePlacedPlantsFromSchedule: hydratePlacedPlantsFromSchedule,
        analyzePlaygroundBed: analyzePlaygroundBed,
        syncPlacedPlantsToSchedule: syncPlacedPlantsToSchedule,
        exportPlaygroundSvg: exportPlaygroundSvg,

        createCustomShapeTemplate: createCustomShapeTemplate,
        validateAndNormalizeCustomShape: validateAndNormalizeCustomShape,
        sampleCustomShapeOutline: sampleCustomShapeOutline,
        computeCustomShapeGeometry: computeCustomShapeGeometry,
        isPointInPolygon: isPointInPolygon,
        pointToPolylineDistance: pointToPolylineDistance,
        generateCustomShapePlantPoints: generateCustomShapePlantPoints,
        listCustomShapes: listCustomShapes,
        saveCustomShape: saveCustomShape,
        deleteCustomShape: deleteCustomShape,
        exportCustomShapeJson: exportCustomShapeJson,
        importCustomShapeJson: importCustomShapeJson,
        exportCustomShapeSvg: exportCustomShapeSvg,
        createCustomShapeBlock: createCustomShapeBlock,

        loadState: loadState,
        saveState: saveState,
        createStateFromPreset: createStateFromPreset,
        cloneState: cloneState,
        normalizeBlock: normalizeBlock,
        normalizeSeason: normalizeSeason,
        normalizePlanting: normalizePlanting,
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
        analyzeBedInterplanting: analyzeBedInterplanting,

        scoreCropMap: scoreCropMap,
        optimizeCropMap: optimizeCropMap,

        computeWeeklyNurseryLoad: computeWeeklyNurseryLoad,
        generateFieldTasks: generateFieldTasks,
        toggleTaskCompleted: toggleTaskCompleted,
        computeSeedOrderSummary: computeSeedOrderSummary,
        generateSuccessions: generateSuccessions,
        exportScheduleCsv: exportScheduleCsv,
        computeGrowingMediaSummary: computeGrowingMediaSummary,
        exportGrowingMediaCsv: exportGrowingMediaCsv,

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
