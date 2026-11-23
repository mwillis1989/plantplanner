/**
 * BC Native Plants — Upgraded 114-Column Search, Multi-Select Filter,
 * Card Renderer, 5-Tab Botanical/Ethnobotanical Modal & Seed Calculator
 *
 * Designed for drop-in use on GitHub Pages with the 114-column Google Sheet
 * CSV feed, Apps Script CORS proxy fallback, or static JSON/CSV bundle.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Configuration & Endpoints                                          */
  /* ------------------------------------------------------------------ */
  const CONFIG = {
    defaultDataset: 'core212',
    datasets: {
      core212: {
        label: 'BC Native Garden & Ethnobotany Plants',
        jsonUrl: './data/plants_212.json',
        localCsvUrl: './data/BC_Native_Plants_212_109cols.csv',
        fallbackJsonUrl: './bc_native_plants_109.json',
        fallbackCsvUrl: './bc_native_plants_109.csv',
      },
      master4590: {
        label: 'All BC Flora (Complete Combined Catalog)',
        jsonUrl: './data/plants_master_4590.json',
        localCsvUrl: './data/BC_Native_Plants_Master_4590_109cols.csv',
        fallbackJsonUrl: './plants_master_4590.json',
        fallbackCsvUrl: './BC_Native_Plants_Master_4590_109cols.csv',
      },
    },
    jsonUrl: './data/plants_212.json',
    localCsvUrl: './data/BC_Native_Plants_212_109cols.csv',
    googleSheetUrl:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vRRmEoZFMjr1zswChFvcC8fv0yVfbKUjgwm2WZi0Qztk_Of7GL_SkWORVdIygnzL1X3-gxh1s7Wctxt/pub?gid=78942440&single=true&output=csv',
    proxyUrl:
      'https://script.google.com/macros/s/AKfycbwcYEZ5ulu6yTQ9MkC2p7bkWoB0g4DJtWqv15NbITnwMpBgigAp45YLvrbbcNhQn44/exec?url=',
    pageSize: 212,
  };
  const DATASET_CACHE = {};

  /* Preserved auto-linker terms from original planner */
  const BIO_LINK_MAP = {
    'W̱SÁNEĆ': 'bios.html#wsanec',
    'SENĆOŦEN': 'bios.html#sencoten',
    "Hul'qumi'num": 'bios.html#hulquminum',
    "Halq'eméylem": 'bios.html#halqemeylem',
    'hən̓q̓əmin̓əm̓': 'bios.html#downriver',
    'Garry Oak': 'bios.html#garry-oak',
    'Nancy Turner': 'bios.html#turner',
  };

  /* ------------------------------------------------------------------ */
  /* Coast Salish Diacritic & Phonetic Normalization (matches Python)   */
  /* ------------------------------------------------------------------ */
  const SALISH_CHAR_MAP = {
    'Ƚ': 'l', 'ƚ': 'l', 'ł': 'l', 'ɬ': 'l', 'Ł': 'l',
    'ƛ': 'tl',
    'č': 'c', 'Č': 'c',
    'š': 's', 'Š': 's',
    'ʷ': 'w',
    'ʔ': "'", 'ʼ': "'", '’': "'", '‘': "'", '¸': "'", 'ʕ': "'",
    'Ⱦ': 't', 'Ŧ': 't', 'ŧ': 't', 'θ': 'th',
    'Á': 'a', 'á': 'a', 'Í': 'i', 'í': 'i', 'Ć': 'c', 'ć': 'c',
    'Ḵ': 'k', 'ḵ': 'k', 'Ḱ': 'k', 'ḱ': 'k', 'Ȼ': 'c', 'ȼ': 'c',
    'Ⱥ': 'a', 'ⱥ': 'a', 'Ṯ': 't', 'ṯ': 't',
    'ə': 'e', 'ɛ': 'e',
    'ŋ': 'ng', 'Ŋ': 'ng',
  };

  function applySalishMap(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      out += Object.prototype.hasOwnProperty.call(SALISH_CHAR_MAP, ch) ? SALISH_CHAR_MAP[ch] : ch;
    }
    return out;
  }

  /**
   * Diacritic-insensitive & phonetic normalizer matching Section 2.1 specs.
   */
  function normalizeText(str) {
    if (str === null || str === undefined) return '';
    let s = String(str);
    s = applySalishMap(s);
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = applySalishMap(s);
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /** Split `; `-delimited columns strictly per Part 1 & Part 2 spec. */
  function parseList(val) {
    if (!val) return [];
    return String(val)
      .split('; ')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ------------------------------------------------------------------ */
  /* RFC-4180 CSV Parser                                                */
  /* ------------------------------------------------------------------ */
  function parseCSV(csvText) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i];
      const next = csvText[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] || '').trim();
      });
      return obj;
    });
  }

  function unpackDatasetRows(data) {
    if (typeof global.unpackDatasetJson === 'function') {
      const unpacked = global.unpackDatasetJson(data);
      if (Array.isArray(unpacked)) return unpacked;
    }
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.columns) && Array.isArray(data.rows)) {
      const cols = data.columns;
      return data.rows.map((r) => {
        const obj = {};
        for (let i = 0; i < cols.length; i++) obj[cols[i]] = r[i] || '';
        return obj;
      });
    }
    return [];
  }

  function applyCuratorOverridesIfReady(dsKey, rows) {
    if (global.WCPPAdmin && typeof global.WCPPAdmin.applyOverrides === 'function') {
      const adminKey = dsKey === 'master4590' ? 'native_master4590' : 'native_core212';
      return global.WCPPAdmin.applyOverrides(adminKey, rows, 'URL_Slug');
    }
    return rows;
  }

  async function loadPlantDataset(customOptions) {
    const custom = customOptions || {};
    const opts = Object.assign({}, CONFIG, custom);
    const dsKey =
      opts.datasetKey && opts.datasets && opts.datasets[opts.datasetKey]
        ? opts.datasetKey
        : opts.defaultDataset;
    const dsCfg = (opts.datasets && opts.datasets[dsKey]) || {};
    const hasCustomUrls = Boolean(custom.jsonUrl || custom.localCsvUrl);

    if (global.WCPPAdmin && global.WCPPAdmin.ready) {
      await global.WCPPAdmin.ready;
    }

    if (!hasCustomUrls && DATASET_CACHE[dsKey]) {
      return applyCuratorOverridesIfReady(dsKey, DATASET_CACHE[dsKey]);
    }

    const jsonCandidates = hasCustomUrls
      ? [custom.jsonUrl].filter(Boolean)
      : [dsCfg.jsonUrl, dsCfg.fallbackJsonUrl].filter(Boolean);
    if (!jsonCandidates.length && opts.jsonUrl) jsonCandidates.push(opts.jsonUrl);

    const csvCandidates = hasCustomUrls
      ? [custom.localCsvUrl].filter(Boolean)
      : [dsCfg.localCsvUrl, dsCfg.fallbackCsvUrl].filter(Boolean);
    if (!csvCandidates.length && opts.localCsvUrl) csvCandidates.push(opts.localCsvUrl);

    // 1. Prefer fast local/GitHub Pages JSON feed if present (array or compact columnar {columns, rows})
    for (const url of jsonCandidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const unpacked = unpackDatasetRows(data);
          if (Array.isArray(unpacked) && unpacked.length > 0) {
            if (!hasCustomUrls) DATASET_CACHE[dsKey] = unpacked;
            return applyCuratorOverridesIfReady(dsKey, unpacked);
          }
        }
      } catch (_) {
        /* fall through */
      }
    }
    // 2. Fallback to local 114-column CSV
    for (const url of csvCandidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          const parsed = parseCSV(text);
          if (parsed.length > 0) {
            if (!hasCustomUrls) DATASET_CACHE[dsKey] = parsed;
            return applyCuratorOverridesIfReady(dsKey, parsed);
          }
        }
      } catch (_) {
        /* fall through */
      }
    }
    // 3. Published Google Sheet CSV with Apps Script CORS proxy fallback
    if (opts.googleSheetUrl && !opts.googleSheetUrl.includes('PLACEHOLDER')) {
      for (const targetUrl of [
        opts.googleSheetUrl,
        opts.proxyUrl + encodeURIComponent(opts.googleSheetUrl),
      ]) {
        try {
          const res = await fetch(targetUrl);
          if (res.ok) {
            const parsed = parseCSV(await res.text());
            if (parsed.length > 0) {
              if (!hasCustomUrls) DATASET_CACHE[dsKey] = parsed;
              return applyCuratorOverridesIfReady(dsKey, parsed);
            }
          }
        } catch (_) {
          /* try next */
        }
      }
    }
    throw new Error(`Unable to load 114-column BC Native Plants dataset (${dsKey}).`);
  }

  /* ------------------------------------------------------------------ */
  /* Seed Calculator, Herbarium SVG, Bee & CDC Tooltip Helpers          */
  /* ------------------------------------------------------------------ */
  function estimateSeedsPerGram(plant) {
    const spg = parseFloat(plant.Seeds_Per_Gram);
    if (Number.isFinite(spg) && spg > 0) return { spg, estimated: false };
    const pt = `${plant.Plant_Type_Tags || ''} ${plant.Growth_Form || ''}`.toLowerCase();
    if (pt.includes('fern')) return { spg: 5000, estimated: true };
    if (pt.includes('tree') || pt.includes('conifer')) return { spg: 60, estimated: true };
    if (pt.includes('shrub')) return { spg: 250, estimated: true };
    if (pt.includes('grass') || pt.includes('sedge') || pt.includes('rush') || pt.includes('graminoid')) {
      return { spg: 1200, estimated: true };
    }
    if (pt.includes('aquatic')) return { spg: 400, estimated: true };
    return { spg: 850, estimated: true };
  }

  function calculateSeedNeeded(plant, areaM2, customDensity) {
    const area = Number(areaM2);
    if (!Number.isFinite(area) || area <= 0) {
      return { valid: false, reason: 'Enter a positive garden area in square meters (m²).' };
    }
    const densityInput = Number(customDensity);
    const defaultDensity = parseFloat(plant.Seeds_Per_m2);
    const spm2 = Number.isFinite(densityInput) && densityInput > 0
      ? densityInput
      : (Number.isFinite(defaultDensity) && defaultDensity > 0 ? defaultDensity : 350);

    const { spg, estimated } = estimateSeedsPerGram(plant);
    const totalSeeds = Math.round(area * spm2);
    const grams = Number((totalSeeds / spg).toFixed(2));
    const effectiveCov = Number((spg / spm2).toFixed(2));
    return {
      valid: true,
      grams,
      totalSeeds,
      areaM2: area,
      density: spm2,
      seedsPerGram: spg,
      effectiveCov,
      estimatedSpg: estimated,
      method: estimated ? 'Editable density + growth-form benchmark seeds/g' : 'Editable density + documented Seeds_Per_Gram',
    };
  }

  function getCdcTooltip(status) {
    const s = String(status || '').trim().toLowerCase();
    if (s === 'red') {
      return 'BC CDC Red List: Extirpated, Endangered, or Threatened species in British Columbia (highest conservation priority).';
    }
    if (s === 'blue') {
      return 'BC CDC Blue List: Special Concern in British Columbia — species vulnerable to human activities or natural events.';
    }
    if (s === 'yellow') {
      return 'BC CDC Yellow List: Apparently Secure or Secure in British Columbia — indigenous species not currently at risk.';
    }
    return `BC CDC Status: ${status || 'Unknown'}`;
  }

  function getSubtaxonShort(plant) {
    const sub = String(plant.Present_Subtaxa_BC || '').trim();
    const lat = String(plant.Latin_Name || '').trim();
    if (!sub || sub === lat || sub.includes(';')) return '';
    if (lat && sub.toLowerCase().startsWith(lat.toLowerCase() + ' ')) {
      return sub.slice(lat.length + 1).trim();
    }
    return sub;
  }

  function deriveCommonBeeVisitors(plant) {
    if (plant.Common_Bee_Visitors) return String(plant.Common_Bee_Visitors);
    const pol = String(plant.Pollinators || '');
    const low = pol.toLowerCase();
    const ptype = String(plant.Plant_Type_Tags || '').toLowerCase();
    const lat = String(plant.Latin_Name || '').toLowerCase();
    const niche = String(plant.Special_Ecological_Niche || '').toLowerCase();
    const hasInsect = low.includes('bee') || low.includes('bumble') || low.includes('hummingbird') || low.includes('butterfl') || low.includes('insect') || low.includes('moth') || low.includes('flies') || low.includes('beetle');
    if (low.includes('none') || ((low.includes('wind') || low.includes('spore')) && !hasInsect)) {
      return 'Wind-pollinated / Spore-bearing (no floral nectar; provides overwintering stems, duff, or bare mineral soil habitat for cavity- & ground-nesting bees)';
    }
    const guilds = [];
    if (low.includes('bumble') || low.includes('bee') || niche.includes('bee')) {
      guilds.push('Bumblebees (Bombus occidentalis, B. vosnesenskii, B. mixtus)');
    }
    if (ptype.includes('shrub') || ptype.includes('tree') || low.includes('native bees')) {
      guilds.push('Mason & Orchard Bees (Osmia lignaria, Osmia spp.)');
      guilds.push('Mining & Digger Bees (Andrena spp., Colletes spp.)');
    }
    if (lat.includes('rosa') || lat.includes('symphoricarpos') || lat.includes('rubus') || lat.includes('spiraea') || String(plant.Flower_Colour_Tags || '').match(/Yellow|Purple|Pink|Blue/i)) {
      guilds.push('Leafcutter & Resin Bees (Megachile spp.)');
      guilds.push('Sweat Bees (Halictus & Lasioglossum spp.)');
    }
    if (!guilds.length) {
      return 'Generalist BC Native Bees (Bombus, Andrena, Halictus spp.)';
    }
    return guilds.join('; ');
  }

  function classifyGardenLayer(plant) {
    const h = parseFloat(plant.Height_Max_cm) || 0;
    const cl = String(plant.Canopy_Layer || '').toLowerCase();
    const rf = String(plant.Root_Formation || '').toLowerCase();
    const sb = String(plant.Spread_Behavior || '').toLowerCase();
    const aggressive = rf.includes('rhizom') || rf.includes('stolon') || sb.includes('aggressive') || sb.includes('colonies');

    if (cl.includes('canopy') || h >= 700) {
      return { rank: 6, label: 'Backbone Canopy Tree', zone: 'Back / Overstory (>7 m)', aggressive };
    }
    if (cl.includes('understory') || h >= 300) {
      return { rank: 5, label: 'Understory Tree / Tall Shrub', zone: 'Back Structural Layer (3–7 m)', aggressive };
    }
    if (cl.includes('tall shrub') || h >= 140) {
      return { rank: 4, label: 'Back-of-Border Shrub / Tall Perennial', zone: 'Back Border (1.4–3 m)', aggressive };
    }
    if (cl.includes('low shrub') || h >= 65) {
      return { rank: 3, label: 'Mid-Border Layer', zone: 'Mid Border (65–140 cm)', aggressive };
    }
    if (h >= 30) {
      return { rank: 2, label: 'Front-Mid Herbaceous Layer', zone: 'Front-Mid Layer (30–65 cm)', aggressive };
    }
    return { rank: 1, label: 'Front Edge / Groundcover', zone: 'Front Sunny Edge (<30 cm)', aggressive };
  }

  function getFlowerColorHex(colorTags) {
    const first = (parseList(colorTags)[0] || 'Green').toLowerCase();
    const map = {
      white: '#dce5df', yellow: '#d9a404', orange: '#e07a2f', pink: '#c95c78',
      red: '#c0392b', purple: '#7d4e9e', blue: '#3b73a8', green: '#2d6a4f', brown: '#8d6e63',
    };
    return map[first] || '#2d6a4f';
  }

  function generateHerbariumSVG(plant) {
    const type = (plant.Plant_Type_Tags || '').toLowerCase();
    const color = (parseList(plant.Flower_Colour_Tags)[0] || 'Green').toLowerCase();
    const palette = {
      white: '#f4f4ef', yellow: '#e9c46a', orange: '#f4a261', pink: '#e5989b',
      red: '#e76f51', purple: '#b388eb', blue: '#74b3ce', green: '#74c69d', brown: '#b08968',
    };
    const accent = palette[color] || '#74c69d';
    const isFern = type.includes('fern');
    const isGrass = type.includes('grass') || type.includes('sedge') || type.includes('rush');
    const isTree = type.includes('tree');
    let pathD = 'M312 124 V52 M312 94 C294 82 284 68 292 54 C302 64 306 78 312 88 M312 84 C330 72 340 58 332 44 C322 54 318 68 312 78';
    if (isFern) pathD = 'M312 126 Q310 76 312 30 M312 108 L288 98 M312 108 L336 98 M312 88 L286 78 M312 88 L338 78 M312 68 L292 58 M312 68 L332 58 M312 48 L300 40 M312 48 L324 40';
    if (isGrass) pathD = 'M312 126 Q302 78 286 40 M312 126 Q312 72 312 30 M312 126 Q322 78 338 40 M312 126 Q294 90 278 64 M312 126 Q330 90 344 64';
    if (isTree) pathD = 'M312 126 V64 M312 96 L292 74 M312 84 L334 64 M312 72 L298 46 M312 66 L328 42';

    const rawCom = String(plant.Common_Name_Primary || plant.Latin_Name || 'Native Species');
    const rawSci = String(plant.Latin_Name || 'Botanical Taxon');
    const comTrunc = rawCom.length > 26 ? `${rawCom.slice(0, 24)}…` : rawCom;
    const sciTrunc = rawSci.length > 30 ? `${rawSci.slice(0, 28)}…` : rawSci;
    const comFontSize = comTrunc.length > 20 ? 14.5 : 17;
    const famLabel = String(plant.Family || '').slice(0, 22);
    const htLabel = String(plant.Height_Display || '').slice(0, 22);

    return `<svg viewBox="0 0 360 150" preserveAspectRatio="xMidYMid meet" class="herbarium-svg" aria-hidden="true">
      <rect x="0" y="0" width="360" height="150" rx="8" fill="#143628"/>
      <rect x="8" y="8" width="344" height="134" rx="6" fill="none" stroke="rgba(167,243,208,0.22)" stroke-width="1"/>
      <circle cx="312" cy="75" r="40" fill="${accent}" opacity="0.16"/>
      <path d="${pathD}" stroke="#a7f3d0" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      ${!isFern && !isGrass ? `<circle cx="312" cy="46" r="7" fill="${accent}"/>` : ''}
      <text x="24" y="29" fill="#a7f3d0" font-family="Nunito Sans, sans-serif" font-size="10.5" font-weight="800" letter-spacing="0.9">INTERACTIVE HERBARIUM</text>
      <text x="24" y="62" fill="#ffffff" font-family="Nunito Sans, sans-serif" font-size="${comFontSize}" font-weight="800">${escapeHTML(comTrunc)}</text>
      <text x="24" y="84" fill="#d1fae5" font-family="Georgia, serif" font-style="italic" font-size="13">${escapeHTML(sciTrunc)}</text>
      ${famLabel ? `<text x="24" y="109" fill="#9bd8be" font-family="Nunito Sans, sans-serif" font-size="10.5" font-weight="700">${escapeHTML(famLabel)}</text>` : ''}
      ${htLabel ? `<text x="24" y="128" fill="#74c69d" font-family="Nunito Sans, sans-serif" font-size="10" font-weight="700">${escapeHTML(htLabel)}</text>` : ''}
    </svg>`;
  }

  /* ------------------------------------------------------------------ */
  /* State & Multi-Facet Filter Engine                                  */
  /* ------------------------------------------------------------------ */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const FACET_GROUPS = [
    { key: 'Plant_Type_Tags', label: 'Plant Type', containerId: 'facet-plant-type' },
    { key: 'Canopy_Layer', label: 'Canopy Layer', containerId: 'facet-canopy-layer' },
    { key: 'Light_Tags', label: 'Sun / Light', containerId: 'facet-light', options: ['Full Sun', 'Part Shade', 'Full Shade'] },
    { key: 'Moisture_Tags', label: 'Moisture', containerId: 'facet-moisture', options: ['Dry', 'Moist', 'Wet'] },
    { key: 'Soil_Texture_Tags', label: 'Soil Texture', containerId: 'facet-soil', options: ['Sandy / Gravelly', 'Loam', 'Clay', 'Rocky / Shallow', 'Rich / Organic'] },
    { key: 'Flower_Colour_Tags', label: 'Flower Colour', containerId: 'facet-flower-colour' },
    { key: 'Garden_Use_Tags', label: 'Garden Use', containerId: 'facet-garden-use' },
    { key: 'Key_Features_Tags', label: 'Ecological & Garden Features', containerId: 'facet-key-features' },
    { key: 'Root_Formation', label: 'Root Systems', containerId: 'facet-root-formation' },
    { key: 'Deer_Resistant', label: 'Deer Resistance', containerId: 'facet-deer-resistant', options: ['Yes', 'Moderate', 'No'] },
    { key: 'Maintenance_Level', label: 'Maintenance Level', containerId: 'facet-maintenance-level' },
    { key: 'Drought_Tolerance', label: 'Drought Tolerance', containerId: 'facet-drought-tolerance', options: ['High', 'Moderate', 'Low'] },
    { key: 'Pollinators', label: 'Pollinators & Bees', containerId: 'facet-pollinators', options: ['Bumblebees', 'Native Bees', 'Butterflies', 'Hummingbirds', 'Moths', 'Flies', 'Beetles', 'Wasps', 'Wind'] },
  ];

  function createPlannerApp(initialData, initialDatasetKey) {
    const state = {
      datasetKey: initialDatasetKey || CONFIG.defaultDataset,
      plants: [],
      filtered: [],
      search: '',
      facets: {},
      bloomMonths: new Set(),
      heightMaxLimit: 4000,
      spreadMaxLimit: 1500,
      heightMaxFilter: 4000,
      spreadMaxFilter: 1500,
      sortBy: 'common-asc',
      viewMode: 'cards', // 'cards' | 'table'
      comparedSlugs: new Set(),
      originFilter: 'all', // 'all' | 'native' | 'introduced'
      localStockFilter: 'all', // 'all' | 'any-local' | 'in-stock' | 'pre-order'
      activeModalSlug: null,
      activeModalTab: 'tab-overview',
      visibleCount: CONFIG.pageSize,
      simMonth: -1, // -1 = All Year, 0..11 = Jan..Dec
      simSort: 'height-asc', // 'height-asc' | 'bloom-asc' | 'name-asc'
    };

    FACET_GROUPS.forEach((fg) => {
      state.facets[fg.key] = new Set();
    });

    function prepareRecords(rawList) {
      let maxH = 200;
      let maxS = 200;
      state.plants = rawList.map((row) => {
        const hMaxNum = parseFloat(row.Height_Max_cm) || 0;
        const sMaxNum = parseFloat(row.Spread_Max_cm) || 0;
        if (hMaxNum > maxH) maxH = Math.ceil(hMaxNum / 50) * 50;
        if (sMaxNum > maxS) maxS = Math.ceil(sMaxNum / 50) * 50;

        const beeVisitors = String(row.Common_Bee_Visitors || deriveCommonBeeVisitors(row));
        const subtaxonShort = getSubtaxonShort(row);
        const layerInfo = classifyGardenLayer(row);

        // Precompute unified normalized search haystack across all primary + keywords columns
        const haystackRaw = [
          row.URL_Slug,
          row.Latin_Name,
          row.Synonyms_Basionyms,
          row.Present_Subtaxa_BC,
          row.Common_Name_Primary,
          row.Common_Names_Alt,
          row.Hulquminum_Primary,
          row.Halqemeylem_Primary,
          row.Hulquminum_Downriver_Primary,
          row.SENCOTEN_Primary,
          row.Salishan_Alternates_Dialects,
          row.Indigenous_Part_Morphemes,
          row.Other_First_Nations_Names,
          row.Search_Keywords_Index,
          row.Family,
          row.Root_Formation,
          row.Allelopathy_Competition_Notes,
          row.Mycorrhizal_Association,
          row.Canadian_Hardiness_Zone,
          row.Drought_Tolerance,
          row.Maintenance_Level,
          row.Pollinators,
          row.Common_Bee_Visitors,
          row.Nursery_Stock_Format,
          beeVisitors,
        ]
          .filter(Boolean)
          .join(' | ');

        return Object.assign({}, row, {
          _normSearch: normalizeText(haystackRaw),
          _hMin: parseFloat(row.Height_Min_cm) || 0,
          _hMax: hMaxNum,
          _sMin: parseFloat(row.Spread_Min_cm) || 0,
          _sMax: sMaxNum,
          _lepCount: parseInt(row.Total_Lepidoptera_Host_Count, 10) || 0,
          _bloomList: parseList(row.Bloom_Months),
          _beeVisitors: beeVisitors,
          _subtaxonShort: subtaxonShort,
          _layerRank: layerInfo.rank,
          _layerLabel: layerInfo.label,
          _layerZone: layerInfo.zone,
          _isAggressiveSpreader: layerInfo.aggressive,
        });
      });
      state.heightMaxLimit = Math.max(300, Math.min(8000, maxH));
      state.spreadMaxLimit = Math.max(150, Math.min(3000, maxS));
      state.heightMaxFilter = state.heightMaxLimit;
      state.spreadMaxFilter = state.spreadMaxLimit;
    }

    function getSearchPhrases(rawSearch) {
      if (!rawSearch) return [];
      return String(rawSearch)
        .split(/[,;|]+/)
        .map((s) => normalizeText(s))
        .filter(Boolean);
    }

    function plantMatchesPhrase(p, phraseNorm) {
      const terms = phraseNorm.split(' ').filter(Boolean);
      if (!terms.length) return false;
      for (let i = 0; i < terms.length; i++) {
        if (!p._normSearch.includes(terms[i])) return false;
      }
      return true;
    }

    function matchesFilters(p) {
      if (state.search) {
        const phrases = getSearchPhrases(state.search);
        if (phrases.length > 0) {
          let anyPhraseHit = false;
          for (let i = 0; i < phrases.length; i++) {
            if (plantMatchesPhrase(p, phrases[i])) {
              anyPhraseHit = true;
              break;
            }
          }
          if (!anyPhraseHit) return false;
        }
      }
      for (const fg of FACET_GROUPS) {
        const sel = state.facets[fg.key];
        if (sel && sel.size > 0) {
          const vals = parseList(p[fg.key]);
          const rawLow = String(p[fg.key] || '').toLowerCase();
          let hit = false;
          sel.forEach((choice) => {
            if (vals.includes(choice)) hit = true;
            else if (fg.key === 'Pollinators' && rawLow.includes(choice.toLowerCase())) hit = true;
          });
          if (!hit) return false;
        }
      }
      if (state.bloomMonths.size > 0) {
        let mHit = false;
        state.bloomMonths.forEach((m) => {
          if (p._bloomList.includes(m)) mHit = true;
        });
        if (!mHit) return false;
      }
      if (p._hMax > 0 && p._hMax > state.heightMaxFilter) return false;
      if (p._sMax > 0 && p._sMax > state.spreadMaxFilter) return false;
      if (state.originFilter && state.originFilter !== 'all') {
        const isNative = String(p.Origin_BC || '').toLowerCase() === 'native';
        if (state.originFilter === 'native' && !isNative) return false;
        if (state.originFilter === 'introduced' && isNative) return false;
      }
      if (state.localStockFilter && state.localStockFilter !== 'all' && global.WCPPInventory && global.WCPPInventory.isLoaded()) {
        const sum = global.WCPPInventory.getSummary({
          commonName: p.Common_Name_Primary,
          latinName: p.Latin_Name,
          slug: p.URL_Slug,
        });
        if (state.localStockFilter === 'any-local' && !sum.matches.length) return false;
        if (state.localStockFilter === 'in-stock' && !sum.inStock.length) return false;
        if (state.localStockFilter === 'pre-order' && !sum.preOrder.length) return false;
      }
      return true;
    }

    function sortFiltered() {
      const mode = state.sortBy;
      state.filtered.sort((a, b) => {
        if (mode === 'latin-asc') {
          return (a.Latin_Name || '').localeCompare(b.Latin_Name || '');
        }
        if (mode === 'height-asc') {
          return (a._hMax || 999999) - (b._hMax || 999999);
        }
        if (mode === 'hosts-desc') {
          return b._lepCount - a._lepCount || (a.Common_Name_Primary || '').localeCompare(b.Common_Name_Primary || '');
        }
        return (a.Common_Name_Primary || '').localeCompare(b.Common_Name_Primary || '');
      });
    }

    function pickRepresentativeSlugsForSearch(maxCount = 4) {
      const phrases = getSearchPhrases(state.search);
      if (phrases.length <= 1) {
        return state.filtered.slice(0, maxCount).map((p) => p.URL_Slug);
      }
      const picked = [];
      const seen = new Set();
      // Pass 1: pick best match (preferring primary common name match) for each phrase
      phrases.forEach((ph) => {
        if (picked.length >= maxCount) return;
        const candidates = state.filtered.filter((p) => !seen.has(p.URL_Slug) && plantMatchesPhrase(p, ph));
        candidates.sort((a, b) => {
          const aPri = normalizeText(a.Common_Name_Primary || '').includes(ph) ? 0 : 1;
          const bPri = normalizeText(b.Common_Name_Primary || '').includes(ph) ? 0 : 1;
          return aPri - bPri;
        });
        if (candidates[0]) {
          seen.add(candidates[0].URL_Slug);
          picked.push(candidates[0].URL_Slug);
        }
      });
      // Pass 2: fill remaining slots up to maxCount from remaining matches
      for (let i = 0; i < state.filtered.length && picked.length < maxCount; i++) {
        const slug = state.filtered[i].URL_Slug;
        if (slug && !seen.has(slug)) {
          seen.add(slug);
          picked.push(slug);
        }
      }
      return picked;
    }

    function buildMatrixCompareHref(slugsOverride) {
      const slugs = Array.isArray(slugsOverride) && slugsOverride.length
        ? slugsOverride.slice(0, 4)
        : (state.comparedSlugs.size
          ? Array.from(state.comparedSlugs).slice(0, 4)
          : pickRepresentativeSlugsForSearch(4));
      const params = new URLSearchParams();
      if (state.datasetKey && state.datasetKey !== CONFIG.defaultDataset) {
        params.set('dataset', state.datasetKey);
      }
      slugs.forEach((slug, idx) => {
        if (slug) params.set(`p${idx + 1}`, slug);
      });
      const qs = params.toString();
      return qs ? `nativeplants.html?${qs}` : 'nativeplants.html';
    }

    function syncMatrixCompareLinks() {
      const link = document.getElementById('cardToMatrixLink');
      if (!link) return;
      link.href = buildMatrixCompareHref();
      const cnt = state.comparedSlugs.size;
      link.textContent = cnt > 0
        ? `4-Plant Matrix Comparator (${Math.min(4, cnt)} selected) →`
        : '4-Plant Matrix Comparator →';
    }

    function applyFiltersAndRender() {
      state.filtered = state.plants.filter(matchesFilters);
      sortFiltered();
      const phrases = getSearchPhrases(state.search);
      if (phrases.length > 1) {
        state.comparedSlugs.clear();
        pickRepresentativeSlugsForSearch(4).forEach((s) => state.comparedSlugs.add(s));
      }
      syncStateToURL();
      renderActiveChips();
      renderResults();
      renderBloomMatrix();
      syncMatrixCompareLinks();
      renderExplorerRelatedArticles();
    }

    function buildCardArticleSubject(plant, preferredCategory) {
      if (!plant) return {};
      return {
        commonName: plant.Common_Name_Primary || '',
        latinName: plant.Latin_Name || '',
        family: plant.Family || '',
        tags: [plant.Key_Features_Tags, plant.Plant_Type_Tags, plant.Soil_Texture_Tags, plant.Moisture_Tags, plant.Garden_Use_Tags].filter(Boolean).join('; '),
        habitat: [plant.Habitat_Tags, plant.Natural_Habitat_Narrative, plant.Plant_Guild_Associations, plant.Mycorrhizal_Association, plant.Biogeoclimatic_Zone, plant.Fire_Ecology].filter(Boolean).join(' '),
        pollinators: [plant.Pollinators, plant.Common_Bee_Visitors, plant.Host_Butterflies_Common, plant.Host_Moths_Common, plant.Birds_Interactions].filter(Boolean).join(' '),
        ethnoNotes: [plant.Hulquminum_Primary, plant.Halqemeylem_Primary, plant.Hulquminum_Downriver_Primary, plant.SENCOTEN_Primary, plant.Ethno_Culinary_Food, plant.Ethno_Medicinal, plant.Ethno_Material_Tech, plant.Ethno_Ceremonial_Spiritual].filter(Boolean).join(' '),
        companions: plant.Companion_Plants || '',
        soilNotes: [plant.Soil_Preferences_Narrative, plant.Drought_Tolerance, plant.Moisture_Notes].filter(Boolean).join(' '),
        category: 'native',
        preferredCategory: preferredCategory || ''
      };
    }

    function renderExplorerRelatedArticles() {
      const box = document.getElementById('plannerRelatedArticles');
      if (!box || !global.WCPPArticles) return;
      const sourceList = state.comparedSlugs.size
        ? state.plants.filter((p) => state.comparedSlugs.has(p.URL_Slug))
        : state.filtered.slice(0, 5);
      if (!sourceList.length) {
        box.innerHTML = '';
        box.hidden = true;
        return;
      }
      box.hidden = false;
      const subjects = sourceList.map((p) => buildCardArticleSubject(p));
      const title = state.comparedSlugs.size
        ? `📰 Related Articles for ${sourceList.length} Selected Species`
        : (state.search ? `📰 Related Articles Matching "${state.search}"` : '📰 Related Articles for Current Filter Selection');
      box.innerHTML = global.WCPPArticles.renderSectionHTML(subjects, { maxCount: 3, strip: true, title });
    }

    /* ---------------------------------------------------------------- */
    /* DOM Rendering                                                    */
    /* ---------------------------------------------------------------- */
    function renderFacets() {
      const originBox = document.getElementById('facet-origin-bc');
      if (originBox) {
        const originOpts = [
          ['all', 'All Species'],
          ['native', '🌿 BC Native Only'],
          ['introduced', 'Introduced / Non-Native'],
        ];
        originBox.innerHTML = originOpts
          .map(([val, lbl]) => {
            const checked = state.originFilter === val ? 'checked' : '';
            return `<label class="facet-pill">
              <input type="radio" name="originFilter" data-origin-bc="${val}" value="${val}" ${checked} />
              <span>${lbl}</span>
            </label>`;
          })
          .join('');
      }

      const stockBox = document.getElementById('facet-local-stock');
      if (stockBox) {
        const stockOpts = [
          ['all', 'All Species'],
          ['in-stock', '🌱 In Stock Now'],
          ['pre-order', '📅 Pre-Order'],
        ];
        stockBox.innerHTML = stockOpts
          .map(([val, lbl]) => {
            const checked = state.localStockFilter === val ? 'checked' : '';
            return `<label class="facet-pill">
              <input type="radio" name="localStockFilter" data-local-stock="${val}" value="${val}" ${checked} />
              <span>${lbl}</span>
            </label>`;
          })
          .join('');
      }

      FACET_GROUPS.forEach((fg) => {
        const container = document.getElementById(fg.containerId);
        if (!container) return;
        let options = fg.options;
        if (!options) {
          const counts = {};
          state.plants.forEach((p) => {
            parseList(p[fg.key]).forEach((tag) => {
              counts[tag] = (counts[tag] || 0) + 1;
            });
          });
          options = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
        }
        container.innerHTML = options
          .map((opt) => {
            const checked = state.facets[fg.key].has(opt) ? 'checked' : '';
            const safeOpt = escapeHTML(opt);
            return `<label class="facet-pill">
              <input type="checkbox" data-facet-key="${escapeHTML(fg.key)}" value="${safeOpt}" ${checked} />
              <span>${safeOpt}</span>
            </label>`;
          })
          .join('');
      });

      const bloomBox = document.getElementById('facet-bloom-months');
      if (bloomBox) {
        bloomBox.innerHTML = MONTHS.map((m) => {
          const active = state.bloomMonths.has(m) ? 'active' : '';
          return `<button type="button" class="month-pill ${active}" data-month="${m}" aria-pressed="${active ? 'true' : 'false'}">${m}</button>`;
        }).join('');
      }

      const hSlider = document.getElementById('heightMaxSlider');
      const hReadout = document.getElementById('heightMaxValue');
      if (hSlider) {
        hSlider.max = String(state.heightMaxLimit);
        hSlider.value = String(state.heightMaxFilter);
        if (hReadout) hReadout.textContent = state.heightMaxFilter >= state.heightMaxLimit ? 'Any' : `≤ ${state.heightMaxFilter} cm`;
      }
      const sSlider = document.getElementById('spreadMaxSlider');
      const sReadout = document.getElementById('spreadMaxValue');
      if (sSlider) {
        sSlider.max = String(state.spreadMaxLimit);
        sSlider.value = String(state.spreadMaxFilter);
        if (sReadout) sReadout.textContent = state.spreadMaxFilter >= state.spreadMaxLimit ? 'Any' : `≤ ${state.spreadMaxFilter} cm`;
      }
    }

    function renderActiveChips() {
      const countEl = document.getElementById('resultCount');
      if (countEl) {
        const nativeCount = state.filtered.filter((p) => String(p.Origin_BC || '').toLowerCase() === 'native').length;
        const introCount = state.filtered.length - nativeCount;
        countEl.textContent = `Showing ${state.filtered.length.toLocaleString()} of ${state.plants.length.toLocaleString()} species (${nativeCount.toLocaleString()} BC Native • ${introCount.toLocaleString()} Introduced / Non-Native)`;
      }
      const bar = document.getElementById('activeFilterChips');
      if (!bar) return;
      const chips = [];
      if (state.search) {
        chips.push(`<button type="button" class="active-chip" data-clear="search">Search: "${escapeHTML(state.search)}" ×</button>`);
      }
      if (state.originFilter && state.originFilter !== 'all') {
        const origLbl = state.originFilter === 'native' ? 'BC Native Only' : 'Introduced / Non-Native';
        chips.push(`<button type="button" class="active-chip" data-clear-origin="1">Origin: ${escapeHTML(origLbl)} ×</button>`);
      }
      if (state.localStockFilter && state.localStockFilter !== 'all') {
        const lblMap = { 'any-local': 'Local Nursery Stock', 'in-stock': 'In Stock Now', 'pre-order': 'Pre-Order' };
        chips.push(`<button type="button" class="active-chip" data-clear-stock="1">Library: ${escapeHTML(lblMap[state.localStockFilter] || state.localStockFilter)} ×</button>`);
      }

      FACET_GROUPS.forEach((fg) => {
        state.facets[fg.key].forEach((val) => {
          chips.push(
            `<button type="button" class="active-chip" data-clear-facet="${escapeHTML(fg.key)}" data-clear-val="${escapeHTML(val)}">${escapeHTML(fg.label)}: ${escapeHTML(val)} ×</button>`
          );
        });
      });
      state.bloomMonths.forEach((m) => {
        chips.push(`<button type="button" class="active-chip" data-clear-month="${m}">Bloom: ${m} ×</button>`);
      });
      bar.innerHTML = chips.join('');
    }

    function renderFirstNationsBar(p) {
      const items = [
        ['Hul’qumi’num', p.Hulquminum_Primary],
        ['Halq̓eméylem', p.Halqemeylem_Primary],
        ['hən̓q̓əmin̓əm̓', p.Hulquminum_Downriver_Primary],
        ['SENĆOŦEN', p.SENCOTEN_Primary],
      ].filter((pair) => pair[1]);
      if (!items.length) return '';
      return `<div class="fn-names-bar">
        ${items
          .map(
            ([lang, term]) =>
              `<span class="fn-badge" title="${escapeHTML(lang)}"><small>${escapeHTML(lang)}</small> <strong>${escapeHTML(term)}</strong></span>`
          )
          .join('')}
      </div>`;
    }

    function renderCard(p) {
      const types = parseList(p.Plant_Type_Tags);
      const lights = parseList(p.Light_Tags);
      const moist = parseList(p.Moisture_Tags);
      const blooms = p._bloomList.length ? p._bloomList.join(', ') : (types.includes('Fern') ? 'Spores' : '—');
      const spreadTxt = p.Spread_Min_cm && p.Spread_Max_cm ? `${p.Spread_Min_cm}–${p.Spread_Max_cm} cm` : '—';
      const firstNursery = parseList(p.Nursery_Product_URLs)[0] || '';
      const isCompared = state.comparedSlugs.has(p.URL_Slug);
      const isNative = String(p.Origin_BC || '').toLowerCase() === 'native';
      const showCdc = isNative && p.BC_CDC_Status && String(p.BC_CDC_Status).toLowerCase() !== 'exotic';
      const cdcTip = showCdc ? getCdcTooltip(p.BC_CDC_Status) : '';
      const invBadge = (global.WCPPInventory && global.WCPPInventory.isLoaded())
        ? global.WCPPInventory.renderBadge({ commonName: p.Common_Name_Primary, latinName: p.Latin_Name, slug: p.URL_Slug }, { compact: true, showPreorderFallback: true, pageTheme: 'plant-planner' })
        : '';

      return `<article class="plant-card ${isNative ? 'is-native-card' : 'is-introduced-card'}" data-slug="${escapeHTML(p.URL_Slug)}">
        <div class="plant-card-header">
          <div class="plant-thumb">${generateHerbariumSVG(p)}</div>
          <div class="plant-titles">
            <div class="card-badges-top">
              <div class="card-badges-line card-badges-type-line">
                ${(types.length ? types : ['Botanical Taxon']).map((t) => `<span class="type-badge">${escapeHTML(t)}</span>`).join('')}
              </div>
              <div class="card-badges-line card-badges-status-line">
                ${showCdc ? `<span class="cdc-badge cdc-${escapeHTML(p.BC_CDC_Status.toLowerCase())} has-tooltip" tabindex="0" data-tooltip="${escapeHTML(cdcTip)}" title="${escapeHTML(cdcTip)}">BC CDC: ${escapeHTML(p.BC_CDC_Status)}</span>` : ''}
                ${isNative
                  ? `<span class="origin-badge origin-native" title="Indigenous BC Native Species">🌿 BC Native</span>`
                  : `<span class="origin-badge origin-introduced" title="Introduced / Non-Native in British Columbia">Introduced / Non-Native</span>`}
              </div>
            </div>
            <h3 class="plant-common">${escapeHTML(p.Common_Name_Primary || p.Latin_Name)}</h3>
            <p class="plant-latin"><em>${escapeHTML(p.Latin_Name)}</em>${p._subtaxonShort ? ` <span class="subtaxon-tag">${escapeHTML(p._subtaxonShort)}</span>` : ''}</p>
            ${p.Family ? `<p class="plant-family">${escapeHTML(p.Family)}</p>` : ''}
          </div>
        </div>
        ${renderFirstNationsBar(p)}
        <div class="plant-card-body">
          <p class="plant-summary">${escapeHTML(p.Summary_Public || p.Description_Botanical || '')}</p>
          <dl class="quick-stats">
            <div><dt>Light</dt><dd>${escapeHTML(lights.join(' / ') || '—')}</dd></div>
            <div><dt>Moisture</dt><dd>${escapeHTML(moist.join(' / ') || '—')}</dd></div>
            <div><dt>Height</dt><dd>${escapeHTML(p.Height_Display || '—')}</dd></div>
            <div><dt>Spread</dt><dd>${escapeHTML(spreadTxt)}</dd></div>
            <div><dt>Bloom</dt><dd>${escapeHTML(blooms)}</dd></div>
            <div><dt>Lep. Hosts</dt><dd>${p._lepCount} species</dd></div>
          </dl>
        </div>
        <div class="plant-card-footer">
          <button type="button" class="btn btn-primary open-modal-btn" data-slug="${escapeHTML(p.URL_Slug)}">Details &amp; 5 Tabs</button>
          <button type="button" class="btn btn-ghost compare-toggle-btn ${isCompared ? 'active' : ''}" data-compare-slug="${escapeHTML(p.URL_Slug)}">${isCompared ? '✓ Comparing' : '+ Compare'}</button>
          ${isCuratorUnlocked() ? `<button type="button" class="btn btn-ghost quick-edit-plant-btn" data-edit-slug="${escapeHTML(p.URL_Slug)}" title="Quick edit this plant in Curator Mode">✏️ Quick Edit</button>` : ''}
          ${invBadge}
          ${global.WCPPGardenPlan ? global.WCPPGardenPlan.renderButton({ commonName: p.Common_Name_Primary, latinName: p.Latin_Name, slug: p.URL_Slug, category: 'native' }, { compact: true }) : ''}
          <div class="card-ext-links">
            ${p.EFlora_BC_URL ? `<a href="${escapeHTML(p.EFlora_BC_URL)}" target="_blank" rel="noopener noreferrer" title="E-Flora BC">E-Flora</a>` : ''}
            ${p.Burke_Herbarium_URL ? `<a href="${escapeHTML(p.Burke_Herbarium_URL)}" target="_blank" rel="noopener noreferrer" title="Burke Herbarium">Burke</a>` : ''}
            ${firstNursery ? `<a href="${escapeHTML(firstNursery)}" target="_blank" rel="noopener noreferrer" title="BC Nursery">Nursery</a>` : ''}
          </div>
        </div>
      </article>`;
    }

    function renderResults() {
      const grid = document.getElementById('cardsGrid');
      const tableWrap = document.getElementById('comparisonTableWrap');
      if (!grid) return;

      const loadMoreWrap = document.getElementById('loadMoreWrap');
      const showAllBtn = document.getElementById('showAllBtn');
      if (state.viewMode === 'table') {
        grid.hidden = true;
        if (loadMoreWrap) loadMoreWrap.hidden = true;
        if (tableWrap) {
          tableWrap.hidden = false;
          renderComparisonTable(tableWrap);
        }
        return;
      }
      grid.hidden = false;
      if (tableWrap) tableWrap.hidden = true;

      if (state.filtered.length === 0) {
        const switchCatalogBtn = state.datasetKey !== 'master4590'
          ? `<button type="button" class="btn btn-secondary" id="emptySwitchMasterBtn" style="margin-left:8px;">Search Complete BC Native Flora Catalog →</button>`
          : '';
        grid.innerHTML = `<div class="empty-state">
          <h3>No matching native plants found</h3>
          <p>Try clearing some moisture, bloom-month, or Coast Salish search filters${state.datasetKey !== 'master4590' ? ', or search across the complete combined BC flora catalog.' : '.'}</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
            <button type="button" class="btn btn-primary" id="emptyResetBtn">Reset All Filters</button>
            ${switchCatalogBtn}
          </div>
        </div>`;
        if (loadMoreWrap) loadMoreWrap.hidden = true;
        const resetBtn = document.getElementById('emptyResetBtn');
        if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);
        const switchBtn = document.getElementById('emptySwitchMasterBtn');
        if (switchBtn) {
          switchBtn.addEventListener('click', () => {
            const dsEl = document.getElementById('datasetSelect');
            if (dsEl) {
              dsEl.value = 'master4590';
              dsEl.dispatchEvent(new Event('change'));
            }
          });
        }
        return;
      }

      const slice = state.filtered.slice(0, state.visibleCount);
      grid.innerHTML = slice.map(renderCard).join('');

      if (loadMoreWrap) {
        const remaining = Math.max(0, state.filtered.length - state.visibleCount);
        loadMoreWrap.hidden = remaining <= 0;
        if (showAllBtn) {
          showAllBtn.textContent = `Show All ${state.filtered.length} Matching Species`;
        }
      }
    }

    function renderComparisonTable(container) {
      const list = state.comparedSlugs.size
        ? state.plants.filter((p) => state.comparedSlugs.has(p.URL_Slug))
        : state.filtered.slice(0, 12);
      if (!list.length) {
        container.innerHTML = '<p class="empty-note">Select species to compare or broaden filters.</p>';
        return;
      }
      const matrixUrl = buildMatrixCompareHref(list.map((p) => p.URL_Slug));
      container.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
        <span style="font-size:0.86rem; font-weight:700; color:var(--text-secondary);">Showing ${list.length} species${state.comparedSlugs.size ? ' (selected for comparison)' : ' (top matches)'}</span>
        <a href="${escapeHTML(matrixUrl)}" class="btn btn-primary">Compare Selected in 114-Col Matrix →</a>
      </div>
      <div class="table-scroll"><table class="comparison-matrix">
        <thead><tr>
          <th>Species &amp; BC Origin</th><th>Canopy Layer &amp; Height</th><th>Hul’qumi’num / SENĆOŦEN</th><th>Light / Moisture / Drought</th><th>Common Bee Visitors &amp; Host Insects</th><th>Bloom Months</th><th>Lep. Hosts</th>
        </tr></thead>
        <tbody>
          ${list
            .map(
              (p) => {
                const isNat = String(p.Origin_BC || '').toLowerCase() === 'native';
                return `<tr>
            <td>
              <button type="button" class="link-btn open-modal-btn" data-slug="${escapeHTML(p.URL_Slug)}"><strong>${escapeHTML(p.Common_Name_Primary)}</strong><br><em>${escapeHTML(p.Latin_Name)}</em>${p._subtaxonShort ? ` <small>${escapeHTML(p._subtaxonShort)}</small>` : ''}</button>
              <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
                <span class="origin-badge ${isNat ? 'origin-native' : 'origin-introduced'}">${isNat ? '🌿 BC Native' : 'Introduced'}</span>
                ${isCuratorUnlocked() ? `<button type="button" class="inline-field-edit-btn" data-edit-slug="${escapeHTML(p.URL_Slug)}">✏️ Edit</button>` : ''}
              </div>
            </td>
            <td>${escapeHTML(p._layerLabel || '—')}<br><small>${escapeHTML(p.Height_Display || '—')} • Spread ${escapeHTML(p.Spread_Min_cm)}–${escapeHTML(p.Spread_Max_cm)} cm</small></td>
            <td>${escapeHTML([p.Hulquminum_Primary, p.SENCOTEN_Primary].filter(Boolean).join(' / ') || '—')}</td>
            <td>${escapeHTML(parseList(p.Light_Tags).join(', '))}<br><small>${escapeHTML(parseList(p.Moisture_Tags).join(', '))} • Drought: ${escapeHTML(p.Drought_Tolerance || '—')}</small></td>
            <td><small>${escapeHTML(p._beeVisitors || '—')}${p.Host_Bees_Insects_Damage ? `<br><strong style="color:var(--primary-color);">Host Insects:</strong> ${escapeHTML(String(p.Host_Bees_Insects_Damage).slice(0, 140))}${String(p.Host_Bees_Insects_Damage).length > 140 ? '…' : ''}` : ''}</small></td>
            <td>${escapeHTML(p._bloomList.join(' • ') || '—')}</td>
            <td>${p._lepCount}</td>
          </tr>`;
              }
            )
            .join('')}
        </tbody>
      </table></div>`;
    }

    function renderBloomMatrix() {
      const box = document.getElementById('bloomSimulatorGrid');
      if (!box) return;
      const baseSample = state.comparedSlugs.size
        ? state.plants.filter((p) => state.comparedSlugs.has(p.URL_Slug))
        : state.filtered.slice(0, 14);
      if (!baseSample.length) {
        box.innerHTML = '';
        return;
      }

      const sample = baseSample.slice().sort((a, b) => {
        if (state.simSort === 'height-asc') {
          return (a._hMax || 9999) - (b._hMax || 9999) || (a._layerRank || 0) - (b._layerRank || 0);
        }
        if (state.simSort === 'bloom-asc') {
          const fa = a._bloomList.length ? MONTHS.indexOf(a._bloomList[0]) : 99;
          const fb = b._bloomList.length ? MONTHS.indexOf(b._bloomList[0]) : 99;
          return fa - fb || (a._hMax || 9999) - (b._hMax || 9999);
        }
        return (a.Common_Name_Primary || '').localeCompare(b.Common_Name_Primary || '');
      });

      const maxSimH = Math.max(60, ...sample.map((p) => p._hMax || 30));
      const activeMonthName = state.simMonth >= 0 ? MONTHS[state.simMonth] : '';
      const activeBloomers = activeMonthName
        ? sample.filter((p) => p._bloomList.includes(activeMonthName))
        : sample;

      const frontPlants = sample.filter((p) => (p._layerRank || 1) <= 2).map((p) => p.Common_Name_Primary).slice(0, 4);
      const midPlants = sample.filter((p) => (p._layerRank || 1) === 3 || (p._layerRank || 1) === 4).map((p) => p.Common_Name_Primary).slice(0, 4);
      const backPlants = sample.filter((p) => (p._layerRank || 1) >= 5).map((p) => p.Common_Name_Primary).slice(0, 4);
      const spreaders = sample.filter((p) => p._isAggressiveSpreader && (p._hMax || 0) >= 40).map((p) => p.Common_Name_Primary);

      const monthButtons = [
        `<button type="button" class="sim-pill-btn ${state.simMonth === -1 ? 'active' : ''}" data-sim-month="-1">All Months (${sample.length})</button>`,
      ].concat(
        MONTHS.map((m, idx) => {
          const cnt = sample.filter((p) => p._bloomList.includes(m)).length;
          return `<button type="button" class="sim-pill-btn ${state.simMonth === idx ? 'active' : ''}" data-sim-month="${idx}">${m} (${cnt})</button>`;
        })
      ).join('');

      const sortButtons = [
        ['height-asc', '📏 Layer by Height (Front → Back)'],
        ['bloom-asc', '🌸 Sort by First Bloom'],
        ['name-asc', '🔤 Alphabetical'],
      ]
        .map(([k, lbl]) => `<button type="button" class="sim-pill-btn ${state.simSort === k ? 'active' : ''}" data-sim-sort="${k}">${lbl}</button>`)
        .join('');

      const layerParts = [];
      if (frontPlants.length) layerParts.push(`<strong>Front Edge (&lt;65 cm):</strong> ${escapeHTML(frontPlants.join(', '))}`);
      if (midPlants.length) layerParts.push(`<strong>Mid Border (65 cm–3 m):</strong> ${escapeHTML(midPlants.join(', '))}`);
      if (backPlants.length) layerParts.push(`<strong>Canopy / Structural (&gt;3 m):</strong> ${escapeHTML(backPlants.join(', '))}`);

      const advisorHtml = `<div class="bloom-layer-advisor">
        <div><strong>Vertical Canopy Layering Plan${activeMonthName ? ` — ${activeMonthName}: ${activeBloomers.length} of ${sample.length} blooming` : ''}:</strong> ${layerParts.join(' &nbsp;→&nbsp; ') || 'Select or filter species to model canopy tiers.'}</div>
        ${spreaders.length && frontPlants.length ? `<div class="advisor-warn">⚠ Crowding Tip: Vigorous spreaders (${escapeHTML(spreaders.slice(0, 4).join(', '))}) should be spaced 60–100 cm behind low front-edge species (${escapeHTML(frontPlants.slice(0, 2).join(', '))}) or given root barriers so they don't shade them out.</div>` : ''}
      </div>`;

      const rowsHtml = sample
        .map((p) => {
          const isBloomingSelected = !activeMonthName || p._bloomList.includes(activeMonthName);
          const barPct = p._hMax > 0 ? Math.max(8, Math.round((Math.log10(p._hMax + 10) / Math.log10(maxSimH + 10)) * 100)) : 12;
          const swatch = getFlowerColorHex(p.Flower_Colour_Tags);
          const bars = MONTHS.map((m, idx) => {
            const on = p._bloomList.includes(m);
            const colSel = state.simMonth === idx ? 'sim-col-active' : '';
            const styleAttr = on ? `style="background:${swatch};border-color:${swatch};color:#102219;"` : '';
            return `<span class="bloom-cell ${on ? 'on' : ''} ${colSel}" ${styleAttr} title="${escapeHTML(p.Common_Name_Primary)}: ${m}${on ? ' (Blooming)' : ''}">${on ? m[0] : ''}</span>`;
          }).join('');
          return `<div class="bloom-row ${isBloomingSelected ? '' : 'dimmed'}">
            <div class="bloom-name-col">
              <button type="button" class="bloom-label open-modal-btn" data-slug="${escapeHTML(p.URL_Slug)}">${escapeHTML(p.Common_Name_Primary)}</button>
              <span class="bloom-tier-sub">${escapeHTML(p._layerZone)}</span>
            </div>
            <div class="bloom-height-col" title="${escapeHTML(p.Height_Display || '')}">
              <div class="height-bar-track"><div class="height-bar-fill" style="width:${barPct}%"></div></div>
              <span class="height-bar-text">${escapeHTML(p.Height_Display || (p._hMax ? `${p._hMax} cm` : 'Height varies'))}</span>
            </div>
            <div class="bloom-cells">${bars}</div>
          </div>`;
        })
        .join('');

      box.innerHTML = `<div class="bloom-sim-toolbar">
        <div class="bloom-month-scrubber" aria-label="Simulate active bloom month">${monthButtons}</div>
        <div class="bloom-sort-bar" aria-label="Sort canopy layering">${sortButtons}</div>
      </div>${advisorHtml}${rowsHtml}`;
    }

    /* ---------------------------------------------------------------- */
    /* 5-Tab Modal View & Companion Linking                             */
    /* ---------------------------------------------------------------- */
    function decorateNarrative(raw) {
      let safe = escapeHTML(raw || '');
      Object.keys(BIO_LINK_MAP).forEach((term) => {
        const safeTerm = escapeHTML(term);
        const re = new RegExp(`\\b(${safeTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'g');
        safe = safe.replace(re, `<a class="bio-link-pill" href="${BIO_LINK_MAP[term]}" target="_blank" rel="noopener noreferrer">$1</a>`);
      });
      return safe;
    }

    function isCuratorUnlocked() {
      return Boolean(global.WCPPAdmin && typeof global.WCPPAdmin.isLoggedIn === 'function' && global.WCPPAdmin.isLoggedIn());
    }

    function renderFieldRow(label, val, useLinks, colKey) {
      if (!val) return '';
      const editBtn = (isCuratorUnlocked() && colKey)
        ? ` <button type="button" class="inline-field-edit-btn" data-edit-cell-col="${escapeHTML(colKey)}" data-edit-cell-label="${escapeHTML(label)}" title="Quick edit ${escapeHTML(label)} in Curator Mode">✏️ Edit</button>`
        : '';
      return `<div class="detail-item">
        <h4><span>${escapeHTML(label)}</span>${editBtn}</h4>
        <p>${useLinks ? decorateNarrative(val) : escapeHTML(val)}</p>
      </div>`;
    }

    function getCuratorAdminDatasetKey() {
      return state.datasetKey === 'master4590' ? 'native_master4590' : 'native_core212';
    }

    function syncCuratorToolbarButtons() {
      const logged = isCuratorUnlocked();
      if (document.body) {
        document.body.classList.toggle('curator-mode', logged);
      }
      const heroBtn = document.getElementById('heroCuratorQuickBtn');
      if (heroBtn) {
        heroBtn.textContent = logged ? '🔓 Curator Mode ON (Settings)' : '🔒 Curator Quick Edit Sign-In';
        heroBtn.classList.toggle('curator-unlocked', logged);
      }
      const toolBtn = document.getElementById('toolbarCuratorBtn');
      if (toolBtn) {
        toolBtn.textContent = logged ? '🔓 Curator Mode ON' : '🔒 Quick Edit Sign-In';
        toolBtn.classList.toggle('curator-unlocked', logged);
      }
      ['heroAddPlantBtn', 'toolbarAddPlantBtn', 'modalQuickEditBtn'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = !logged;
      });
    }

    async function refreshDatasetAndUI(reopenSlug, reopenTab) {
      try {
        const nextData = await loadPlantDataset(Object.assign({}, window.BC_PLANTS_CONFIG || {}, { datasetKey: state.datasetKey }));
        prepareRecords(nextData);
        renderFacets();
        applyFiltersAndRender();
        if (reopenSlug) {
          openPlantModal(reopenSlug);
          if (reopenTab) switchModalTab(reopenTab);
        }
      } catch (_) {}
    }

    function openNativePlantCellQuickEditor(slug, colKey, colLabel) {
      if (!isCuratorUnlocked() || !global.WCPPAdmin || typeof global.WCPPAdmin.openCellEditor !== 'function') return;
      const plant = state.plants.find((p) => p.URL_Slug === slug);
      if (!plant || !colKey) return;
      const activeDsKey = getCuratorAdminDatasetKey();
      const otherDsKey = activeDsKey === 'native_master4590' ? 'native_core212' : 'native_master4590';
      const curTab = state.activeModalTab;
      global.WCPPAdmin.openCellEditor({
        datasetKey: activeDsKey,
        recordId: plant.URL_Slug,
        recordTitle: plant.Common_Name_Primary || plant.Latin_Name || plant.URL_Slug,
        colKey,
        colLabel: colLabel || colKey.replace(/_/g, ' '),
        currentValue: plant[colKey] || '',
        onSave: async (newVal, reverted) => {
          if (!reverted && global.WCPPAdmin && typeof global.WCPPAdmin.savePatch === 'function') {
            try { await global.WCPPAdmin.savePatch(otherDsKey, plant.URL_Slug, { [colKey]: newVal }); } catch (_) {}
          }
          await refreshDatasetAndUI(plant.URL_Slug, curTab);
        },
      });
    }

    function openNativePlantQuickEditor(slug, isNew = false) {
      if (!isCuratorUnlocked() || !global.WCPPAdmin || typeof global.WCPPAdmin.openRecordModal !== 'function') return;
      const existing = !isNew && slug ? state.plants.find((p) => p.URL_Slug === slug) : null;
      if (!isNew && !existing) return;
      const activeDsKey = getCuratorAdminDatasetKey();
      const otherDsKey = activeDsKey === 'native_master4590' ? 'native_core212' : 'native_master4590';
      const curTab = state.activeModalTab;

      const templateObj = existing || state.plants[0] || {};
      const priorityFields = [
        { key: 'Common_Name_Primary', label: 'Primary Common Name' },
        { key: 'Latin_Name', label: 'Latin / Scientific Name' },
        { key: 'Origin_BC', label: 'Origin in BC', type: 'select', options: ['Native', 'Introduced'] },
        { key: 'BC_CDC_Status', label: 'BC CDC Conservation Status', type: 'select', options: ['Yellow', 'Blue', 'Red', 'Exotic'] },
        { key: 'Family', label: 'Plant Family' },
        { key: 'Plant_Type_Tags', label: 'Plant Type Tags (; separated)', placeholder: 'e.g. Wildflower (Forb); Shrub' },
        { key: 'Present_Subtaxa_BC', label: 'Present Subtaxa in BC' },
        { key: 'Taxonomic_Authority', label: 'Taxonomic Authority' },
        { key: 'Common_Names_Alt', label: 'Alternate Common Names (; separated)' },
        { key: 'Summary_Public', label: 'Public Garden Summary' },
        { key: 'Description_Botanical', label: 'Technical Botanical Description' },
        { key: 'Natural_Habitat_Narrative', label: 'Natural Habitat & Range Narrative' },
        { key: 'Light_Tags', label: 'Sun / Light Tags (; separated)', placeholder: 'Full Sun; Part Shade; Full Shade' },
        { key: 'Moisture_Tags', label: 'Soil Moisture Tags (; separated)', placeholder: 'Dry; Moist; Wet' },
        { key: 'Height_Display', label: 'Height Display (e.g. 20–60 cm)' },
        { key: 'Height_Min_cm', label: 'Min Height (cm)' },
        { key: 'Height_Max_cm', label: 'Max Height (cm)' },
        { key: 'Spread_Min_cm', label: 'Min Spread (cm)' },
        { key: 'Spread_Max_cm', label: 'Max Spread (cm)' },
        { key: 'Bloom_Months', label: 'Bloom Months (; separated)', placeholder: 'Apr; May; Jun' },
        { key: 'Flower_Colour_Tags', label: 'Flower Colour Tags (; separated)' },
        { key: 'Canopy_Layer', label: 'Canopy Layer' },
        { key: 'Lifecycle', label: 'Lifecycle' },
        { key: 'Growth_Form', label: 'Growth Form' },
        { key: 'Root_Formation', label: 'Root Formation' },
        { key: 'Deer_Resistant', label: 'Deer Resistant', type: 'select', options: ['Yes', 'Moderate', 'No'] },
        { key: 'Drought_Tolerance', label: 'Drought Tolerance', type: 'select', options: ['High', 'Moderate', 'Low'] },
        { key: 'Maintenance_Level', label: 'Maintenance Level' },
        { key: 'Canadian_Hardiness_Zone', label: 'Canadian Hardiness Zone' },
        { key: 'pH_Range', label: 'Soil pH Range' },
        { key: 'Hulquminum_Primary', label: "Island Hul'qumi'num Name" },
        { key: 'Halqemeylem_Primary', label: 'Upriver Halq̓eméylem Name' },
        { key: 'Hulquminum_Downriver_Primary', label: 'Downriver hən̓q̓əmin̓əm̓ Name' },
        { key: 'SENCOTEN_Primary', label: 'SENĆOŦEN Name' },
        { key: 'Ethno_Culinary_Food', label: 'Culinary & Food Preservation' },
        { key: 'Ethno_Medicinal', label: 'Medicinal Applications' },
        { key: 'Ethno_Material_Tech', label: 'Material Technology & Woodwork' },
        { key: 'Ethno_Ceremonial_Spiritual', label: 'Ceremonial & Oral Tradition' },
        { key: 'Common_Bee_Visitors', label: 'Common Bee Visitors (BC Native Apoidea)' },
        { key: 'Host_Bees_Insects_Damage', label: 'Host Bees & Insects (Genus species)' },
        { key: 'Pollinators', label: 'Pollinators (; separated)' },
        { key: 'Companion_Plants', label: 'Companion Plants (; separated)' },
        { key: 'Garden_Use_Tags', label: 'Garden Use Tags (; separated)' },
        { key: 'Key_Features_Tags', label: 'Ecological & Garden Features (; separated)' },
        { key: 'URL_Slug', label: 'URL Slug (unique ID)' },
      ];
      const priorityKeySet = new Set(priorityFields.map((f) => f.key));
      const extraFields = Object.keys(templateObj)
        .filter((k) => !k.startsWith('_') && !priorityKeySet.has(k))
        .map((k) => ({ key: k, label: k.replace(/_/g, ' ') }));
      const allFields = priorityFields.concat(extraFields);

      const initialRec = isNew
        ? { Origin_BC: 'Native', BC_CDC_Status: 'Yellow', Plant_Type_Tags: 'Wildflower (Forb)' }
        : Object.keys(existing).reduce((acc, k) => {
            if (!k.startsWith('_')) acc[k] = existing[k];
            return acc;
          }, {});

      global.WCPPAdmin.openRecordModal({
        datasetKey: activeDsKey,
        title: isNew
          ? '➕ Add New Plant to Catalog'
          : `✏️ Quick Edit: ${existing.Common_Name_Primary || existing.Latin_Name}`,
        fields: allFields,
        initialRecord: initialRec,
        isNew,
        idField: 'URL_Slug',
        onSave: async (updatedRec) => {
          const targetSlug = updatedRec.URL_Slug || (existing && existing.URL_Slug);
          if (!isNew && targetSlug && global.WCPPAdmin && typeof global.WCPPAdmin.savePatch === 'function') {
            try { await global.WCPPAdmin.savePatch(otherDsKey, targetSlug, updatedRec); } catch (_) {}
          }
          await refreshDatasetAndUI(state.activeModalSlug ? targetSlug : null, curTab);
        },
        onDelete: isNew
          ? undefined
          : async () => {
              if (state.activeModalSlug === slug) closePlantModal();
              await refreshDatasetAndUI(null, null);
            },
      });
    }

    function findPlantByCompanionName(compName) {
      const target = normalizeText(compName);
      if (!target) return undefined;
      const targetLoose = target.replace(/[-–]+/g, ' ').replace(/\s+/g, ' ').trim();
      const splitTokens = (val) =>
        String(val || '')
          .split(/[;,]/)
          .map((x) => normalizeText(x))
          .filter(Boolean);
      const eqMatch = (tok) =>
        tok === target || tok.replace(/[-–]+/g, ' ').replace(/\s+/g, ' ').trim() === targetLoose;

      return (
        state.plants.find(
          (p) =>
            eqMatch(normalizeText(p.Common_Name_Primary)) ||
            normalizeText(p.Latin_Name) === target
        ) ||
        state.plants.find(
          (p) =>
            splitTokens(p.Common_Names_Alt).some(eqMatch) ||
            splitTokens(p.Synonyms_Basionyms).some((tok) => tok === target)
        ) ||
        (targetLoose.includes(' ')
          ? state.plants.find((p) => {
              const escaped = targetLoose.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const boundaryRe = new RegExp(`(?:^|\\s|;|,)${escaped}(?:$|\\s|;|,)`);
              return (
                boundaryRe.test(normalizeText(p.Common_Name_Primary).replace(/[-–]+/g, ' ')) ||
                splitTokens(p.Common_Names_Alt).some((tok) =>
                  boundaryRe.test(tok.replace(/[-–]+/g, ' '))
                )
              );
            })
          : undefined)
      );
    }

    function openPlantModal(slug) {
      const plant = state.plants.find((p) => p.URL_Slug === slug);
      if (!plant) return;
      state.activeModalSlug = slug;

      if (global.WCPPAnalytics) {
        global.WCPPAnalytics.track('view_item', {
          items: [{
            item_id: plant.URL_Slug || plant.Row_ID || slug,
            item_name: plant.Common_Name_Primary || plant.Latin_Name,
            item_category: plant.Plant_Type || 'Native Plant',
            item_variant: plant.Latin_Name || ''
          }]
        });
      }

      const modal = document.getElementById('plantDetailModal');
      if (!modal) return;

      const isNative = String(plant.Origin_BC || '').toLowerCase() === 'native';
      const showCdc = isNative && plant.BC_CDC_Status && String(plant.BC_CDC_Status).toLowerCase() !== 'exotic';

      document.getElementById('modalCommonName').textContent = plant.Common_Name_Primary || plant.Latin_Name;
      document.getElementById('modalLatinAuth').innerHTML = `<div><em>${escapeHTML(plant.Latin_Name)}</em>${plant._subtaxonShort ? ` <span class="subtaxon-tag">${escapeHTML(plant._subtaxonShort)}</span>` : ''} ${escapeHTML(plant.Taxonomic_Authority || '')}</div>${plant.Family ? `<div class="modal-family-line">${escapeHTML(plant.Family)}</div>` : ''}`;
      const modalCdcTip = showCdc ? getCdcTooltip(plant.BC_CDC_Status) : '';
      document.getElementById('modalSubMeta').innerHTML = [
        isNative
          ? `<span class="origin-badge origin-native">🌿 BC Native</span>`
          : `<span class="origin-badge origin-introduced">Introduced / Non-Native</span>`,
        showCdc ? `<span class="cdc-badge cdc-${escapeHTML(plant.BC_CDC_Status.toLowerCase())} has-tooltip" tabindex="0" data-tooltip="${escapeHTML(modalCdcTip)}" title="${escapeHTML(modalCdcTip)}">BC CDC: ${escapeHTML(plant.BC_CDC_Status)}</span>` : '',
        plant.USDA_Symbol ? `USDA: ${escapeHTML(plant.USDA_Symbol)}` : '',
      ]
        .filter(Boolean)
        .join(' &nbsp;|&nbsp; ');

      const curUnlocked = isCuratorUnlocked();
      const modalQuickEditBtn = document.getElementById('modalQuickEditBtn');
      if (modalQuickEditBtn) {
        modalQuickEditBtn.setAttribute('data-edit-slug', plant.URL_Slug);
        modalQuickEditBtn.hidden = !curUnlocked;
      }

      // Tab 1: Overview & Garden Design
      const companions = parseList(plant.Companion_Plants);
      const compHtml = companions.length
        ? `<div class="detail-item"><h4><span>Compatible Native Companions (Click to Explore)</span>${curUnlocked ? ` <button type="button" class="inline-field-edit-btn" data-edit-cell-col="Companion_Plants" data-edit-cell-label="Compatible Native Companions">✏️ Edit</button>` : ''}</h4>
            <div class="companion-pills">${companions
              .map((c) => {
                const match = findPlantByCompanionName(c);
                return `<button type="button" class="companion-pill" data-companion-name="${escapeHTML(c)}" data-companion-slug="${escapeHTML(match ? match.URL_Slug : '')}">${escapeHTML(c)}${match ? ' ↗' : ' 🔍'}</button>`;
              })
              .join('')}</div></div>`
        : '';

      const stockBoxInner = global.WCPPInventory
        ? global.WCPPInventory.renderCardBox({ commonName: plant.Common_Name_Primary, latinName: plant.Latin_Name, slug: plant.URL_Slug }, { pageTheme: 'plant-planner' })
        : '';
      const localStockBox = stockBoxInner
        ? `<div class="detail-item"><h4>Surrey Royal Heights Live Stock &amp; Pre-Orders</h4>${stockBoxInner}</div>`
        : '';

      const subjectCtx = buildCardArticleSubject(plant);

      document.getElementById('tab-overview').innerHTML = `
        ${localStockBox}
        ${renderFieldRow('Garden Summary', plant.Summary_Public, true, 'Summary_Public')}
        <div class="meta-pills-row">
          ${parseList(plant.Garden_Use_Tags).map((u) => `<span class="meta-tag">${escapeHTML(u)}</span>`).join('')}
          ${parseList(plant.Key_Features_Tags).map((f) => `<span class="meta-tag accent">${escapeHTML(f)}</span>`).join('')}
        </div>
        ${renderFieldRow('Summer Watering Once Established', plant.Summer_Watering, false, 'Summer_Watering')}
        ${renderFieldRow('Moisture & Hydrology', `${plant.Moisture_Tags || ''} — ${plant.Moisture_Notes || ''}`.replace(/^ — | — $/g, ''), false, 'Moisture_Notes')}
        ${renderFieldRow('Drought Tolerance', plant.Drought_Tolerance, false, 'Drought_Tolerance')}
        ${renderFieldRow('Canadian Hardiness Zone', plant.Canadian_Hardiness_Zone, false, 'Canadian_Hardiness_Zone')}
        ${renderFieldRow('Soil Preferences & Texture', [plant.Soil_Texture_Tags, plant.Soil_Preferences_Narrative, plant.pH_Range ? `pH ${plant.pH_Range}` : ''].filter(Boolean).join(' • '), false, 'Soil_Preferences_Narrative')}
        ${renderFieldRow('Mycorrhizal & Root Symbiosis', plant.Mycorrhizal_Association, false, 'Mycorrhizal_Association')}
        ${renderFieldRow('Coastal Salinity / Calcareous Tolerance', [plant.Salinity_Coastal_Tolerance, plant.CaCO3_Tolerance].filter(Boolean).join(' • '), false, 'Salinity_Coastal_Tolerance')}
        ${renderFieldRow('Garden Spread & Form', `${plant.Growth_Form || ''} (${plant.Root_Formation || ''} — ${plant.Spread_Behavior || ''})`, false, 'Growth_Form')}
        ${renderFieldRow('Allelopathy & Competition Notes', plant.Allelopathy_Competition_Notes, false, 'Allelopathy_Competition_Notes')}
        ${compHtml}
      `;

      // Tab 2: Coast Salish & Indigenous Knowledge
      document.getElementById('tab-indigenous').innerHTML = `
        <div class="salish-grid">
          <div class="salish-box"><span>Island Hul’qumi’num${curUnlocked ? ` <button type="button" class="inline-field-edit-btn" data-edit-cell-col="Hulquminum_Primary" data-edit-cell-label="Island Hul'qumi'num">✏️</button>` : ''}</span><strong>${escapeHTML(plant.Hulquminum_Primary || 'Not documented')}</strong></div>
          <div class="salish-box"><span>Upriver Halq̓eméylem${curUnlocked ? ` <button type="button" class="inline-field-edit-btn" data-edit-cell-col="Halqemeylem_Primary" data-edit-cell-label="Upriver Halq̓eméylem">✏️</button>` : ''}</span><strong>${escapeHTML(plant.Halqemeylem_Primary || 'Not documented')}</strong></div>
          <div class="salish-box"><span>Downriver hən̓q̓əmin̓əm̓${curUnlocked ? ` <button type="button" class="inline-field-edit-btn" data-edit-cell-col="Hulquminum_Downriver_Primary" data-edit-cell-label="Downriver hən̓q̓əmin̓əm̓">✏️</button>` : ''}</span><strong>${escapeHTML(plant.Hulquminum_Downriver_Primary || 'Not documented')}</strong></div>
          <div class="salish-box"><span>SENĆOŦEN${curUnlocked ? ` <button type="button" class="inline-field-edit-btn" data-edit-cell-col="SENCOTEN_Primary" data-edit-cell-label="SENĆOŦEN">✏️</button>` : ''}</span><strong>${escapeHTML(plant.SENCOTEN_Primary || 'Not documented')}</strong></div>
        </div>
        ${renderFieldRow('Dialect & Alternate Spellings', plant.Salishan_Alternates_Dialects, false, 'Salishan_Alternates_Dialects')}
        ${renderFieldRow('Harvested Plant Part Terms', plant.Indigenous_Part_Morphemes, false, 'Indigenous_Part_Morphemes')}
        ${renderFieldRow('Other BC & PNW First Nations Names', plant.Other_First_Nations_Names, false, 'Other_First_Nations_Names')}
        ${renderFieldRow('Linguistic Commentary', plant.Salishan_Linguistic_Notes, true, 'Salishan_Linguistic_Notes')}
        <div class="ethno-cards-grid">
          <div class="ethno-card"><h4><span>Culinary & Food Preservation</span>${curUnlocked ? ` <button type="button" class="inline-field-edit-btn" data-edit-cell-col="Ethno_Culinary_Food" data-edit-cell-label="Culinary & Food Preservation">✏️ Edit</button>` : ''}</h4><p>${escapeHTML(plant.Ethno_Culinary_Food || 'No culinary records in consolidated sources.')}</p>${plant.Edible_Parts_Flavor ? `<p class="sub-note"><strong>Edibility (${escapeHTML(plant.Edibility_Status)}):</strong> ${escapeHTML(plant.Edible_Parts_Flavor)}</p>` : ''}</div>
          <div class="ethno-card"><h4><span>Medicinal Applications</span>${curUnlocked ? ` <button type="button" class="inline-field-edit-btn" data-edit-cell-col="Ethno_Medicinal" data-edit-cell-label="Medicinal Applications">✏️ Edit</button>` : ''}</h4><p>${escapeHTML(plant.Ethno_Medicinal || 'No medicinal records in consolidated sources.')}</p></div>
          <div class="ethno-card"><h4><span>Material Technology, Cordage & Woodwork</span>${curUnlocked ? ` <button type="button" class="inline-field-edit-btn" data-edit-cell-col="Ethno_Material_Tech" data-edit-cell-label="Material Technology & Woodwork">✏️ Edit</button>` : ''}</h4><p>${escapeHTML(plant.Ethno_Material_Tech || 'No material technology records in consolidated sources.')}</p></div>
          <div class="ethno-card"><h4><span>Ceremonial, Spiritual & Oral Tradition</span>${curUnlocked ? ` <button type="button" class="inline-field-edit-btn" data-edit-cell-col="Ethno_Ceremonial_Spiritual" data-edit-cell-label="Ceremonial & Oral Tradition">✏️ Edit</button>` : ''}</h4><p>${escapeHTML(plant.Ethno_Ceremonial_Spiritual || 'No ceremonial records in consolidated sources.')}</p></div>
        </div>
        ${renderFieldRow('Safety, Livestock & Pests / Warnings', [plant.Pet_Child_Livestock_Safety, plant.Warnings_Toxicity_Pests].filter(Boolean).join(' — '), false, 'Warnings_Toxicity_Pests')}
      `;

      // Tab 3: Pollinators, Butterflies & Wildlife
      const bfCom = parseList(plant.Host_Butterflies_Common);
      const bfSci = parseList(plant.Host_Butterflies_Scientific);
      const mCom = parseList(plant.Host_Moths_Common);
      const mSci = parseList(plant.Host_Moths_Scientific);

      const pairHosts = (coms, scis) => {
        const len = Math.max(coms.length, scis.length);
        if (!len) return '<p>None documented in consolidated host records.</p>';
        let li = '';
        for (let i = 0; i < len; i++) {
          const c = coms[i] || '';
          const s = scis[i] || '';
          li += `<li>${c ? `<strong>${escapeHTML(c)}</strong> ` : ''}${s ? `<em>${escapeHTML(s)}</em>` : ''}</li>`;
        }
        return `<ul class="host-list">${li}</ul>`;
      };

      document.getElementById('tab-wildlife').innerHTML = `
        ${renderFieldRow('Common Bee Visitors (BC Native Apoidea)', plant.Common_Bee_Visitors || plant._beeVisitors, false, 'Common_Bee_Visitors')}
        ${renderFieldRow('Host Bees & Insects (Genus species)', plant.Host_Bees_Insects_Damage, false, 'Host_Bees_Insects_Damage')}
        ${renderFieldRow('Pollinators & Scent', [plant.Pollinators, plant.Scent_Profile].filter(Boolean).join(' • '), false, 'Pollinators')}
        ${renderFieldRow('Bird Interactions', plant.Birds_Interactions, false, 'Birds_Interactions')}
        ${renderFieldRow('Mammals & Browse Value', `${plant.Mammals_Browse_Wildlife || ''} (Deer Resistant: ${escapeHTML(plant.Deer_Resistant || 'No')})`, false, 'Mammals_Browse_Wildlife')}
        <div class="lep-summary-banner">Documented Larval Host Genus: <strong><em>${escapeHTML(plant.Lepidoptera_Host_Genera)}</em></strong> — <strong>${plant._lepCount}</strong> species catalogued</div>
        <details class="collapsible-host" open>
          <summary>Butterfly Larval Hosts (${Math.max(bfCom.length, bfSci.length)})</summary>
          ${pairHosts(bfCom, bfSci)}
        </details>
        <details class="collapsible-host">
          <summary>Moth Larval Hosts (${Math.max(mCom.length, mSci.length)})</summary>
          ${pairHosts(mCom, mSci)}
        </details>
      `;

      const modalRelEl = document.getElementById('modalRelatedArticles');
      if (modalRelEl) {
        modalRelEl.innerHTML = global.WCPPArticles
          ? global.WCPPArticles.renderSectionHTML(subjectCtx, { maxCount: 3, strip: true, title: `📰 Related Articles for ${plant.Common_Name_Primary || plant.Latin_Name}` })
          : '';
      }

      // Tab 4: Botanical Morphology & Ecology
      document.getElementById('tab-botany').innerHTML = `
        ${renderFieldRow('Technical Botanical Description', plant.Description_Botanical, false, 'Description_Botanical')}
        ${renderFieldRow('Stems, Twigs & Bark', plant.Stems_Bark_Morphology, false, 'Stems_Bark_Morphology')}
        ${renderFieldRow('Leaf Arrangement & Dimensions', [plant.Leaf_Type_Arrangement, plant.Leaf_Dimensions_cm_mm].filter(Boolean).join(' • '), false, 'Leaf_Type_Arrangement')}
        ${renderFieldRow('Flower Architecture & Dimensions', [plant.Flower_Inflorescence_Type, plant.Flower_Measurements_mm_cm].filter(Boolean).join(' • '), false, 'Flower_Inflorescence_Type')}
        ${renderFieldRow('Fruit & Seed Morphology', plant.Fruit_Seed_Type_Dimensions, false, 'Fruit_Seed_Type_Dimensions')}
        ${renderFieldRow('Maturity Timeline & Lifespan', plant.Maturity_Timeline_Lifespan, false, 'Maturity_Timeline_Lifespan')}
        ${renderFieldRow('USDA Guide & Research Insights', plant.Discovered_Drive_Details, false, 'Discovered_Drive_Details')}
        ${renderFieldRow('Natural Habitat & Continental Range', plant.Natural_Habitat_Narrative, false, 'Natural_Habitat_Narrative')}
        ${renderFieldRow('BC Biogeoclimatic Zones, Range & Elevation', [plant.Biogeoclimatic_Zone, plant.BC_Regional_Range, plant.Elevation_Belts_Range].filter(Boolean).join(' • '), false, 'BC_Regional_Range')}
        ${renderFieldRow('Successional Role, Fire Ecology & Niche', [plant.Successional_Role, plant.Fire_Ecology, plant.Special_Ecological_Niche, plant.Plant_Guild_Associations].filter(Boolean).join(' • '), false, 'Special_Ecological_Niche')}
        ${renderFieldRow('1960s Saanich Peninsula Vegetation Study', plant.Saanich_Study_Data, false, 'Saanich_Study_Data')}
      `;

      // Tab 5: Propagation & Seed Calculator
      const defaultDensity = parseFloat(plant.Seeds_Per_m2) || 350;
      const spgInfo = estimateSeedsPerGram(plant);
      document.getElementById('tab-propagation').innerHTML = `
        <div class="seed-calc-card">
          <h4>Garden Seed Quantity Calculator</h4>
          <div class="calc-metrics">
            <span><strong>Seeds/g:</strong> ${escapeHTML(plant.Seeds_Per_Gram ? plant.Seeds_Per_Gram : `~${spgInfo.spg} (est.)`)}</span>
            <span><strong>Target Seeding Density (Seeds/m²):</strong> <strong class="seed-density-readout">${escapeHTML(String(defaultDensity))} seeds/m²</strong></span>
            <span><strong>Coverage:</strong> <strong class="seed-coverage-readout">${escapeHTML(String(Number((spgInfo.spg / defaultDensity).toFixed(2))))} m²/g</strong></span>
          </div>
          <div class="calc-input-row">
            <label>
              <span>Planting area (m²):</span>
              <input type="number" id="seedAreaInput" min="0.1" step="0.5" value="10" />
            </label>
            <label>
              <span>Target Density (Seeds/m²):</span>
              <input type="number" class="seed-density-input" min="1" max="5000" step="10" value="${escapeHTML(String(defaultDensity))}" />
            </label>
          </div>
          <div class="seed-preset-row">
            <button type="button" class="seed-preset-btn" data-density="${Math.max(5, Math.round(defaultDensity * 0.5))}">Low / Interplant (${Math.max(5, Math.round(defaultDensity * 0.5))}/m²)</button>
            <button type="button" class="seed-preset-btn active" data-density="${Math.round(defaultDensity)}">Standard Restoration (${Math.round(defaultDensity)}/m²)</button>
            <button type="button" class="seed-preset-btn" data-density="${Math.min(5000, Math.round(defaultDensity * 2))}">High / Erosion Control (${Math.min(5000, Math.round(defaultDensity * 2))}/m²)</button>
          </div>
          <div id="seedCalcOutput" class="calc-result" aria-live="polite"></div>
        </div>
        ${renderFieldRow('Seed Collection & Cleaning', plant.Seed_Collection_Harvest, false, 'Seed_Collection_Harvest')}
        ${renderFieldRow('Stratification & Dormancy Protocol', plant.Stratification_Dormancy, false, 'Stratification_Dormancy')}
        ${renderFieldRow('Sowing Guidelines & Timing', plant.Sowing_Protocol_Time, false, 'Sowing_Protocol_Time')}
        ${renderFieldRow('Vegetative Propagation & Cultivars', plant.Propagation_Methods_Cultivars, false, 'Propagation_Methods_Cultivars')}
        ${renderFieldRow('Pruning & Long-Term Management', plant.Pruning_Management, false, 'Pruning_Management')}
        ${renderFieldRow('BC/PNW Nursery Availability', plant.Nursery_Availability, false, 'Nursery_Availability')}
        ${renderFieldRow('Recommended Nursery Stock Formats', plant.Nursery_Stock_Format, false, 'Nursery_Stock_Format')}
        ${localStockBox}
      `;

      const areaInput = document.getElementById('seedAreaInput');
      const densityEl = modal.querySelector('.seed-density-input');
      const densityReadout = modal.querySelector('.seed-density-readout');
      const coverageReadout = modal.querySelector('.seed-coverage-readout');
      const presetBtns = modal.querySelectorAll('.seed-preset-btn');
      const updateCalc = () => {
        const curDensity = densityEl ? Number(densityEl.value) : defaultDensity;
        const out = calculateSeedNeeded(plant, areaInput ? areaInput.value : 10, curDensity);
        const target = document.getElementById('seedCalcOutput');
        if (densityReadout && out.valid) densityReadout.textContent = `${out.density} seeds/m²`;
        if (coverageReadout && out.valid) coverageReadout.textContent = `${out.effectiveCov} m²/g`;
        if (!target) return;
        if (out.valid) {
          target.innerHTML = `For <strong>${out.areaM2} m²</strong> at <strong>${out.density} seeds/m²</strong>: sow <strong>${out.grams} g</strong> of clean pure live seed (<strong>${out.totalSeeds.toLocaleString()} seeds</strong>)${out.estimatedSpg ? ' <small class="muted">(uses growth-form seed weight estimate; also commonly planted via plugs/divisions)</small>' : ''}.`;
        } else {
          target.innerHTML = `<span class="muted">${escapeHTML(out.reason)}</span>`;
        }
      };
      if (areaInput) areaInput.addEventListener('input', updateCalc);
      if (densityEl) {
        densityEl.addEventListener('input', () => {
          presetBtns.forEach((b) => b.classList.remove('active'));
          updateCalc();
        });
      }
      presetBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const val = Number(btn.getAttribute('data-density'));
          if (densityEl && Number.isFinite(val) && val > 0) {
            densityEl.value = String(val);
            presetBtns.forEach((b) => b.classList.toggle('active', b === btn));
            updateCalc();
          }
        });
      });
      updateCalc();

      // External Action Buttons & Citations
      const extFooter = document.getElementById('modalExternalActions');
      if (extFooter) {
        const matrixHref = state.datasetKey && state.datasetKey !== CONFIG.defaultDataset
          ? `nativeplants.html?p1=${encodeURIComponent(plant.URL_Slug)}&dataset=${encodeURIComponent(state.datasetKey)}`
          : `nativeplants.html?p1=${encodeURIComponent(plant.URL_Slug)}`;
        const btns = [
          curUnlocked ? `<button type="button" class="btn btn-secondary quick-edit-plant-btn" data-edit-slug="${escapeHTML(plant.URL_Slug)}">✏️ Quick Edit All Attributes</button>` : '',
          global.WCPPGardenPlan ? global.WCPPGardenPlan.renderButton({ commonName: plant.Common_Name_Primary, latinName: plant.Latin_Name, slug: plant.URL_Slug, category: 'native' }, { compact: false }) : '',
          `<a class="btn btn-primary" href="${matrixHref}">Compare in 4-Slot Matrix →</a>`,
        ].filter(Boolean);
        if (plant.EFlora_BC_URL) btns.push(`<a class="btn btn-secondary" href="${escapeHTML(plant.EFlora_BC_URL)}" target="_blank" rel="noopener noreferrer">E-Flora BC Atlas ↗</a>`);
        if (plant.Burke_Herbarium_URL) btns.push(`<a class="btn btn-secondary" href="${escapeHTML(plant.Burke_Herbarium_URL)}" target="_blank" rel="noopener noreferrer">Burke Herbarium ↗</a>`);
        parseList(plant.Nursery_Product_URLs).forEach((u, idx) => {
          btns.push(`<a class="btn btn-primary" href="${escapeHTML(u)}" target="_blank" rel="noopener noreferrer">Native Nursery${idx ? ' ' + (idx + 1) : ''} ↗</a>`);
        });
        const seenRefLabels = new Set();
        parseList(plant.Other_Reference_URLs).forEach((u) => {
          if (seenRefLabels.size >= 3) return;
          const href = /^https?:\/\//i.test(u) ? u : `https://${u}`;
          let label = href.replace(/^https?:\/\/(?:www\.)?([^/]+).*$/, '$1');
          if (href.includes('usda.gov')) label = 'USDA PLANTS';
          else if (href.includes('pfaf.org')) label = 'PFAF';
          else if (href.includes('calscape.org')) label = 'Calscape';
          else {
            try { label = new URL(href).hostname.replace(/^www\./i, ''); } catch (_) {}
          }
          if (seenRefLabels.has(label)) return;
          seenRefLabels.add(label);
          btns.push(`<a class="btn btn-ghost" href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)} ↗</a>`);
        });
        extFooter.innerHTML = btns.join('');
      }

      const citEl = document.getElementById('modalCitations');
      if (citEl) {
        citEl.textContent = plant.Bibliography_Citations ? `Sources: ${plant.Bibliography_Citations}` : '';
      }

      switchModalTab('tab-overview');
      modal.hidden = false;
      document.body.classList.add('modal-open');
    }

    function closePlantModal() {
      const modal = document.getElementById('plantDetailModal');
      if (modal) modal.hidden = true;
      document.body.classList.remove('modal-open');
      state.activeModalSlug = null;
    }

    function switchModalTab(tabId) {
      state.activeModalTab = tabId;
      document.querySelectorAll('#plantDetailModal .tab-btn').forEach((btn) => {
        const active = btn.getAttribute('data-tab') === tabId;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('#plantDetailModal .tab-panel').forEach((panel) => {
        panel.hidden = panel.id !== tabId;
      });
    }

    /* ---------------------------------------------------------------- */
    /* URL State & Filter Reset                                         */
    /* ---------------------------------------------------------------- */
    function syncStateToURL() {
      if (typeof window === 'undefined' || !window.history || !window.location) return;
      const params = new URLSearchParams();
      if (state.datasetKey && state.datasetKey !== CONFIG.defaultDataset) params.set('dataset', state.datasetKey);
      if (state.search) params.set('q', state.search);
      if (state.sortBy !== 'common-asc') params.set('sort', state.sortBy);
      if (state.originFilter && state.originFilter !== 'all') params.set('origin', state.originFilter);
      if (state.localStockFilter && state.localStockFilter !== 'all') params.set('stock', state.localStockFilter);
      if (state.bloomMonths.size) params.set('bloom', Array.from(state.bloomMonths).join(','));
      FACET_GROUPS.forEach((fg) => {
        if (state.facets[fg.key].size) params.set(fg.key, Array.from(state.facets[fg.key]).join('|'));
      });
      const qStr = params.toString();
      const nextUrl = qStr ? `${window.location.pathname}?${qStr}` : window.location.pathname;
      window.history.replaceState(null, '', nextUrl);
    }

    function loadStateFromURL() {
      if (typeof window === 'undefined' || !window.location) return;
      const params = new URLSearchParams(window.location.search);
      const dsParam = params.get('dataset');
      if (dsParam && CONFIG.datasets[dsParam]) {
        state.datasetKey = dsParam;
      }
      const dsSel = document.getElementById('datasetSelect');
      if (dsSel) dsSel.value = state.datasetKey;
      if (params.get('q')) {
        state.search = params.get('q');
      } else {
        const pList = [params.get('p1'), params.get('p2'), params.get('p3'), params.get('p4')].filter(Boolean);
        if (pList.length) state.search = pList.join(', ');
      }
      if (state.search) {
        const inp = document.getElementById('universalSearchInput');
        if (inp) inp.value = state.search;
      }
      if (params.get('sort')) {
        state.sortBy = params.get('sort');
        const sel = document.getElementById('sortSelect');
        if (sel) sel.value = state.sortBy;
      }
      if (params.get('origin')) {
        const ov = params.get('origin');
        if (['all', 'native', 'introduced'].includes(ov)) {
          state.originFilter = ov;
        }
      }
      if (params.get('stock')) {
        const sv = params.get('stock');
        if (['all', 'any-local', 'in-stock', 'pre-order'].includes(sv)) {
          state.localStockFilter = sv;
        }
      }
      if (params.get('bloom')) {
        params.get('bloom').split(',').filter(Boolean).forEach((m) => state.bloomMonths.add(m));
      }
      FACET_GROUPS.forEach((fg) => {
        const v = params.get(fg.key);
        if (v) v.split('|').filter(Boolean).forEach((item) => state.facets[fg.key].add(item));
      });
    }

    function resetAllFilters() {
      state.search = '';
      state.originFilter = 'all';
      state.localStockFilter = 'all';
      const inp = document.getElementById('universalSearchInput');
      if (inp) inp.value = '';
      FACET_GROUPS.forEach((fg) => state.facets[fg.key].clear());
      state.bloomMonths.clear();
      state.heightMaxFilter = state.heightMaxLimit;
      state.spreadMaxFilter = state.spreadMaxLimit;
      state.visibleCount = CONFIG.pageSize;
      renderFacets();
      applyFiltersAndRender();
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(t._tid);
      t._tid = setTimeout(() => t.classList.remove('show'), 2600);
    }

    function exportFilteredCSV() {
      const cols = ['Row_ID', 'Latin_Name', 'Common_Name_Primary', 'Origin_BC', 'BC_CDC_Status', 'Hulquminum_Primary', 'Halqemeylem_Primary', 'Hulquminum_Downriver_Primary', 'SENCOTEN_Primary', 'Light_Tags', 'Moisture_Tags', 'Height_Display', 'Canadian_Hardiness_Zone', 'Mycorrhizal_Association', 'Allelopathy_Competition_Notes', 'Common_Bee_Visitors', 'Nursery_Stock_Format', 'Bloom_Months', 'Total_Lepidoptera_Host_Count'];
      const lines = [cols.join(',')];
      state.filtered.forEach((r) => {
        lines.push(cols.map((c) => `"${String(r[c] || '').replace(/"/g, '""')}"`).join(','));
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bc_native_plants_filtered.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (global.WCPPAnalytics) {
        global.WCPPAnalytics.track('file_download', {
          file_name: 'bc_native_plants_filtered.csv',
          file_extension: 'csv',
          content_count: state.filtered.length
        });
      }
    }

    /* ---------------------------------------------------------------- */
    /* Event Wiring                                                     */
    /* ---------------------------------------------------------------- */
    function bindEvents() {
      const searchEl = document.getElementById('universalSearchInput');
      if (searchEl) {
        searchEl.addEventListener('input', (e) => {
          state.search = e.target.value;
          state.visibleCount = CONFIG.pageSize;
          applyFiltersAndRender();
          if (global.WCPPAnalytics) {
            global.WCPPAnalytics.trackDebounced('plant_planner_search', 'search', {
              search_term: (e.target.value || '').trim().slice(0, 100),
              search_source: 'card_explorer',
              dataset: state.datasetKey
            }, 750);
          }
        });
      }

      const datasetEl = document.getElementById('datasetSelect');
      if (datasetEl) {
        datasetEl.addEventListener('change', async (e) => {
          const nextKey = e.target.value;
          const countEl = document.getElementById('resultCount');
          if (countEl) countEl.textContent = `Loading ${(CONFIG.datasets[nextKey] || {}).label || nextKey}...`;
          try {
            const nextData = await loadPlantDataset(Object.assign({}, window.BC_PLANTS_CONFIG || {}, { datasetKey: nextKey }));
            state.datasetKey = nextKey;
            state.visibleCount = CONFIG.pageSize;
            state.comparedSlugs.clear();
            FACET_GROUPS.forEach((fg) => state.facets[fg.key].clear());
            state.bloomMonths.clear();
            prepareRecords(nextData);
            renderFacets();
            applyFiltersAndRender();
            showToast(`Loaded ${nextData.length} species`);
            if (global.WCPPAnalytics) {
              global.WCPPAnalytics.track('select_content', {
                content_type: 'plant_dataset',
                item_id: nextKey
              });
            }
          } catch (err) {
            datasetEl.value = state.datasetKey;
            showToast(err.message || 'Dataset switch failed');
          }
        });
      }

      const sortEl = document.getElementById('sortSelect');
      if (sortEl) {
        sortEl.addEventListener('change', (e) => {
          state.sortBy = e.target.value;
          applyFiltersAndRender();
        });
      }

      const sidebar = document.getElementById('filterSidebar');
      if (sidebar) {
        sidebar.addEventListener('change', (e) => {
          const inp = e.target;
          if (inp.matches('input[data-origin-bc]')) {
            state.originFilter = inp.value || 'all';
            state.visibleCount = CONFIG.pageSize;
            applyFiltersAndRender();
            return;
          }
          if (inp.matches('input[data-local-stock]')) {
            state.localStockFilter = inp.value || 'all';
            state.visibleCount = CONFIG.pageSize;
            applyFiltersAndRender();
            if (global.WCPPAnalytics) {
              global.WCPPAnalytics.track('select_content', {
                content_type: 'local_stock_filter',
                item_id: state.localStockFilter,
                tier_label: state.localStockFilter,
                action: 'selected'
              });
            }
            return;
          }
          if (inp.matches('input[data-facet-key]')) {
            const k = inp.getAttribute('data-facet-key');
            if (inp.checked) state.facets[k].add(inp.value);
            else state.facets[k].delete(inp.value);
            state.visibleCount = CONFIG.pageSize;
            applyFiltersAndRender();
            if (global.WCPPAnalytics) {
              global.WCPPAnalytics.track('select_content', {
                content_type: 'plant_trait_filter',
                item_id: (k + ':' + inp.value).slice(0, 100),
                dataset: k,
                action: inp.checked ? 'checked' : 'unchecked'
              });
            }
          }
        });
        sidebar.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-month]');
          if (btn) {
            const m = btn.getAttribute('data-month');
            if (state.bloomMonths.has(m)) state.bloomMonths.delete(m);
            else state.bloomMonths.add(m);
            btn.classList.toggle('active', state.bloomMonths.has(m));
            btn.setAttribute('aria-pressed', state.bloomMonths.has(m) ? 'true' : 'false');
            state.visibleCount = CONFIG.pageSize;
            applyFiltersAndRender();
            if (global.WCPPAnalytics) {
              global.WCPPAnalytics.track('select_content', {
                content_type: 'bloom_month_filter',
                item_id: m,
                action: state.bloomMonths.has(m) ? 'selected' : 'deselected'
              });
            }
          }
        });
      }

      const hSlider = document.getElementById('heightMaxSlider');
      if (hSlider) {
        hSlider.addEventListener('input', (e) => {
          state.heightMaxFilter = Number(e.target.value);
          const r = document.getElementById('heightMaxValue');
          if (r) r.textContent = state.heightMaxFilter >= state.heightMaxLimit ? 'Any' : `≤ ${state.heightMaxFilter} cm`;
          applyFiltersAndRender();
        });
      }
      const sSlider = document.getElementById('spreadMaxSlider');
      if (sSlider) {
        sSlider.addEventListener('input', (e) => {
          state.spreadMaxFilter = Number(e.target.value);
          const r = document.getElementById('spreadMaxValue');
          if (r) r.textContent = state.spreadMaxFilter >= state.spreadMaxLimit ? 'Any' : `≤ ${state.spreadMaxFilter} cm`;
          applyFiltersAndRender();
        });
      }

      document.addEventListener('click', (e) => {
        const editCellBtn = e.target.closest('[data-edit-cell-col]');
        if (editCellBtn && state.activeModalSlug) {
          e.stopPropagation();
          openNativePlantCellQuickEditor(
            state.activeModalSlug,
            editCellBtn.getAttribute('data-edit-cell-col'),
            editCellBtn.getAttribute('data-edit-cell-label')
          );
          return;
        }
        const editPlantBtn = e.target.closest('[data-edit-slug]');
        if (editPlantBtn) {
          e.stopPropagation();
          const editSlug = editPlantBtn.getAttribute('data-edit-slug');
          if (editSlug) openNativePlantQuickEditor(editSlug, false);
          return;
        }
        const modalBtn = e.target.closest('.open-modal-btn');
        if (modalBtn) {
          openPlantModal(modalBtn.getAttribute('data-slug'));
          return;
        }
        const simMonthBtn = e.target.closest('[data-sim-month]');
        if (simMonthBtn) {
          state.simMonth = parseInt(simMonthBtn.getAttribute('data-sim-month'), 10);
          renderBloomMatrix();
          return;
        }
        const simSortBtn = e.target.closest('[data-sim-sort]');
        if (simSortBtn) {
          state.simSort = simSortBtn.getAttribute('data-sim-sort');
          renderBloomMatrix();
          return;
        }
        const cmpBtn = e.target.closest('[data-compare-slug]');
        if (cmpBtn) {
          const slug = cmpBtn.getAttribute('data-compare-slug');
          const wasCompared = state.comparedSlugs.has(slug);
          if (wasCompared) state.comparedSlugs.delete(slug);
          else state.comparedSlugs.add(slug);
          if (global.WCPPAnalytics) {
            const p = state.plants.find((x) => x.URL_Slug === slug);
            global.WCPPAnalytics.track('select_content', {
              content_type: 'plant_compare',
              item_id: slug,
              dataset: p ? (p.Common_Name_Primary || p.Latin_Name || slug) : slug,
              action: wasCompared ? 'removed' : 'added'
            });
          }
          renderResults();
          renderBloomMatrix();
          syncMatrixCompareLinks();
          renderExplorerRelatedArticles();
          return;
        }
        const compPill = e.target.closest('.companion-pill');
        if (compPill) {
          const targetSlug = compPill.getAttribute('data-companion-slug');
          const compName = compPill.getAttribute('data-companion-name');
          if (global.WCPPAnalytics) {
            global.WCPPAnalytics.track('select_content', {
              content_type: 'companion_plant',
              item_id: (targetSlug || compName || '').slice(0, 100),
              dataset: compName || targetSlug || ''
            });
          }
          if (targetSlug) {
            openPlantModal(targetSlug);
          } else if (compName) {
            closePlantModal();
            state.search = compName;
            const inp = document.getElementById('universalSearchInput');
            if (inp) inp.value = compName;
            applyFiltersAndRender();
          }
          return;
        }
        const tabBtn = e.target.closest('#plantDetailModal .tab-btn');
        if (tabBtn) {
          const tabId = tabBtn.getAttribute('data-tab');
          if (global.WCPPAnalytics) {
            global.WCPPAnalytics.track('select_content', {
              content_type: 'plant_modal_tab',
              item_id: tabId || '',
              dataset: state.activeModalSlug || ''
            });
          }
          switchModalTab(tabId);
          return;
        }
        const chip = e.target.closest('.active-chip');
        if (chip) {
          if (chip.getAttribute('data-clear') === 'search') {
            state.search = '';
            const inp = document.getElementById('universalSearchInput');
            if (inp) inp.value = '';
          } else if (chip.hasAttribute('data-clear-origin')) {
            state.originFilter = 'all';
          } else if (chip.hasAttribute('data-clear-stock')) {
            state.localStockFilter = 'all';
          } else if (chip.hasAttribute('data-clear-facet')) {
            state.facets[chip.getAttribute('data-clear-facet')].delete(chip.getAttribute('data-clear-val'));
          } else if (chip.hasAttribute('data-clear-month')) {
            state.bloomMonths.delete(chip.getAttribute('data-clear-month'));
          }
          renderFacets();
          applyFiltersAndRender();
        }
      });

      ['heroCuratorQuickBtn', 'toolbarCuratorBtn'].forEach((btnId) => {
        const el = document.getElementById(btnId);
        if (el) {
          el.addEventListener('click', () => {
            if (global.WCPPAdmin && typeof global.WCPPAdmin.openLoginModal === 'function') {
              global.WCPPAdmin.openLoginModal();
            }
          });
        }
      });

      ['heroAddPlantBtn', 'toolbarAddPlantBtn'].forEach((btnId) => {
        const el = document.getElementById(btnId);
        if (el) {
          el.addEventListener('click', () => {
            openNativePlantQuickEditor(null, true);
          });
        }
      });

      const closeBtn = document.getElementById('modalCloseBtn');
      if (closeBtn) closeBtn.addEventListener('click', closePlantModal);
      const modalBackdrop = document.getElementById('plantDetailModal');
      if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
          if (e.target === modalBackdrop) closePlantModal();
        });
      }
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.activeModalSlug && !document.querySelector('.wcpp-modal-backdrop')) {
          closePlantModal();
        }
      });

      const clearAll = document.getElementById('clearAllBtn');
      if (clearAll) clearAll.addEventListener('click', resetAllFilters);

      const loadMoreBtn = document.getElementById('loadMoreBtn');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          state.visibleCount += CONFIG.pageSize;
          renderResults();
        });
      }
      const showAllBtn = document.getElementById('showAllBtn');
      if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
          state.visibleCount = Math.max(state.filtered.length, CONFIG.pageSize);
          renderResults();
        });
      }

      const viewCardsBtn = document.getElementById('viewCardsBtn');
      const viewTableBtn = document.getElementById('viewTableBtn');
      if (viewCardsBtn && viewTableBtn) {
        viewCardsBtn.addEventListener('click', () => {
          state.viewMode = 'cards';
          viewCardsBtn.classList.add('active');
          viewTableBtn.classList.remove('active');
          renderResults();
        });
        viewTableBtn.addEventListener('click', () => {
          state.viewMode = 'table';
          viewTableBtn.classList.add('active');
          viewCardsBtn.classList.remove('active');
          renderResults();
        });
      }

      const shareBtn = document.getElementById('shareBtn');
      if (shareBtn && navigator.clipboard) {
        shareBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(window.location.href).then(() => showToast('Search link copied!'));
          if (global.WCPPAnalytics) {
            global.WCPPAnalytics.track('share', {
              method: 'copy_link',
              content_type: 'plant_explorer',
              item_id: state.datasetKey
            });
          }
        });
      }
      const dlBtn = document.getElementById('downloadBtn');
      if (dlBtn) dlBtn.addEventListener('click', exportFilteredCSV);

      const themeBtn = document.getElementById('themeToggleBtn');
      if (themeBtn) {
        themeBtn.addEventListener('click', () => {
          if (typeof global.toggleSiteTheme === 'function') {
            global.toggleSiteTheme();
          } else {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
          }
        });
        if (localStorage.getItem('theme') === 'dark') {
          document.body.classList.add('dark-mode');
        }
      }

      global.addEventListener('wcpp:inventory-ready', () => {
        applyFiltersAndRender();
      });

      global.addEventListener('wcpp:articles-ready', () => {
        renderExplorerRelatedArticles();
        if (state.activeModalSlug) {
          const curTab = state.activeModalTab;
          openPlantModal(state.activeModalSlug);
          if (curTab) switchModalTab(curTab);
        }
      });

      global.addEventListener('wcpp:curator-changed', async () => {
        syncCuratorToolbarButtons();
        await refreshDatasetAndUI(state.activeModalSlug, state.activeModalTab);
      });
    }

    /* ---------------------------------------------------------------- */
    /* Init                                                             */
    /* ---------------------------------------------------------------- */
    if (Array.isArray(initialData)) {
      prepareRecords(initialData);
      loadStateFromURL();
      renderFacets();
      bindEvents();
      syncCuratorToolbarButtons();
      applyFiltersAndRender();
    }

    return {
      state,
      prepareRecords,
      applyFiltersAndRender,
      openPlantModal,
      closePlantModal,
      openNativePlantQuickEditor,
      calculateSeedNeeded,
      resetAllFilters,
    };
  }

  /* Load preserved site chrome (header/sidebar/footer includes) + data */
  async function bootstrap() {
    if (typeof document === 'undefined') return;
    ['header-container', 'sidebar-container', 'footer-container'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.dataset.src) {
        fetch(el.dataset.src)
          .then((r) => (r.ok ? r.text() : ''))
          .then((html) => {
            if (html) el.innerHTML = html;
          })
          .catch(() => {});
      }
    });

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlDs = urlParams.get('dataset');
      const initialDs = urlDs && CONFIG.datasets[urlDs] ? urlDs : CONFIG.defaultDataset;
      const cfg = Object.assign({}, window.BC_PLANTS_CONFIG || {}, { datasetKey: initialDs });
      const data = await loadPlantDataset(cfg);
      window.bcPlantPlanner = createPlannerApp(data, initialDs);
    } catch (err) {
      const grid = document.getElementById('cardsGrid');
      if (grid) {
        grid.innerHTML = `<div class="empty-state"><h3>Dataset Load Error</h3><p>${escapeHTML(err.message)}</p></div>`;
      }
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  }

  global.BCNativePlantsApp = {
    normalizeText,
    parseList,
    parseCSV,
    calculateSeedNeeded,
    createPlannerApp,
    loadPlantDataset,
    FACET_GROUPS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
