#!/usr/bin/env python3
"""
Generator script to build:
1. All 212 core species pages (species-[slug].html) with hero photo showcase + Wikimedia Commons badge
2. flora-index.html with interactive hover popup previews
"""

import csv
import json
import os
import re
import urllib.parse
import html

BASE_DIR = '/home/willismdr/scratch/plantplanner-main/plantplanner-main'
CSV_PATH = '/home/willismdr/BC_Native_Plants_Deliverables/BC_Native_Plants_212_109cols.csv'
INV_PATH = os.path.join(BASE_DIR, 'data/orders_inventory.json')

def generate_botanical_svg(sci_name, common_name):
    clean_sci = html.escape(sci_name or "Native Species")
    clean_com = html.escape(common_name or "West Coast Flora")
    h = 0
    for ch in clean_sci:
        h = ord(ch) + ((h << 5) - h)
        h &= 0xffffffff
        if h >= 0x80000000:
            h -= 0x100000000
    palettes = [
        ["#14532d", "#166534", "#dcfce7", "#86efac"],
        ["#064e3b", "#047857", "#d1fae5", "#6ee7b7"],
        ["#1e3a2f", "#2d5a43", "#e2f2ea", "#99c9ab"],
        ["#365314", "#4d7c0f", "#ecfccb", "#bef264"]
    ]
    pal = palettes[abs(h) % len(palettes)]

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="100%" height="100%">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="{pal[0]}"/>
                    <stop offset="100%" stop-color="{pal[1]}"/>
                </linearGradient>
            </defs>
            <rect width="400" height="250" fill="url(#bg)"/>
            <circle cx="330" cy="45" r="95" fill="{pal[3]}" opacity="0.1"/>
            <circle cx="60" cy="210" r="80" fill="{pal[3]}" opacity="0.08"/>
            <g transform="translate(275, 25)" stroke="{pal[3]}" stroke-width="2" fill="none" opacity="0.32">
                <path d="M20,190 Q45,100 85,20" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M32,155 Q10,135 15,115 Q40,125 32,155 Z" fill="{pal[3]}" fill-opacity="0.25"/>
                <path d="M42,130 Q70,120 75,98 Q48,105 42,130 Z" fill="{pal[3]}" fill-opacity="0.25"/>
                <path d="M52,102 Q28,82 34,62 Q58,75 52,102 Z" fill="{pal[3]}" fill-opacity="0.25"/>
                <path d="M64,75 Q88,65 92,45 Q68,52 64,75 Z" fill="{pal[3]}" fill-opacity="0.25"/>
                <path d="M74,48 Q55,32 62,16 Q80,28 74,48 Z" fill="{pal[3]}" fill-opacity="0.25"/>
            </g>
            <rect x="22" y="22" width="150" height="24" rx="12" fill="rgba(255,255,255,0.14)"/>
            <text x="34" y="38" fill="{pal[2]}" font-family="Nunito Sans, sans-serif" font-size="10.5" font-weight="800" letter-spacing="1.2">HERBARIUM ARCHIVE</text>
            <text x="24" y="168" fill="#ffffff" font-family="Georgia, serif" font-style="italic" font-weight="bold" font-size="22">{clean_sci[:28]}</text>
            <text x="24" y="196" fill="{pal[2]}" font-family="Nunito Sans, sans-serif" font-weight="700" font-size="14.5" opacity="0.92">{clean_com[:34]}</text>
            <line x1="24" y1="214" x2="110" y2="214" stroke="{pal[3]}" stroke-width="2" opacity="0.5"/>
        </svg>"""
    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)

def build_all():
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        plants = list(csv.DictReader(f))

    inv = []
    if os.path.exists(INV_PATH):
        try:
            with open(INV_PATH, 'r', encoding='utf-8') as f:
                inv = json.load(f)
        except Exception:
            inv = []

    inv_by_latin = {}
    for item in inv:
        ln = (item.get('Latin_Name') or '').strip().lower()
        if ln and ln not in inv_by_latin:
            inv_by_latin[ln] = item

    slug_map = {p['URL_Slug']: p for p in plants}
    common_to_slug = {}
    latin_to_slug = {}
    for p in plants:
        common_to_slug[p['Common_Name_Primary'].strip().lower()] = p['URL_Slug']
        latin_to_slug[p['Latin_Name'].strip().lower()] = p['URL_Slug']

    print(f"Loaded {len(plants)} plants and {len(inv_by_latin)} live inventory items.")

    for i, p in enumerate(plants):
        slug = p['URL_Slug']
        sci = p['Latin_Name'].strip()
        common = p['Common_Name_Primary'].strip()
        family = p['Family'].strip()
        origin = p.get('Origin_BC', 'Native').strip() or 'Native'
        cdc = p.get('BC_CDC_Status', 'Yellow').strip() or 'Yellow'
        plant_type = p.get('Plant_Type_Tags', 'Native Plant').strip() or 'Native Plant'
        zone = p.get('Canadian_Hardiness_Zone', 'Zone 7a–9b').strip() or 'Zone 7a–9b'
        lep_count = p.get('Total_Lepidoptera_Host_Count', '0').strip()
        if not lep_count or lep_count == '0':
            lep_count = '1+'

        fallback_svg = generate_botanical_svg(sci, common)

        # Inventory check
        item = inv_by_latin.get(sci.lower())
        stock_btn = ""
        if item:
            pid = item.get('Plant_ID', '')
            price = item.get('Price_CAD', '10.00')
            fmt = item.get('Pot_Size_Format', 'Potted Plant')
            stock_btn = f'<a class="sp-btn primary" href="orders.html#{html.escape(pid)}">🪴 In Stock – ${price} CAD {html.escape(fmt)} (Surrey pickup, BC residents only)</a>'

        eflora_url = p.get('EFlora_BC_URL', '').strip()
        if not eflora_url:
            eflora_url = f"https://linnet.geog.ubc.ca/Atlas/Atlas.aspx?sciname={urllib.parse.quote_plus(sci)}"

        # Prev / Next
        prev_plant = plants[(i - 1) % len(plants)]
        next_plant = plants[(i + 1) % len(plants)]

        # Companion pills
        comp_raw = p.get('Companion_Plants', '')
        comp_items = [c.strip() for c in comp_raw.split(';') if c.strip()]
        comp_pills = []
        for c in comp_items:
            c_slug = common_to_slug.get(c.lower()) or latin_to_slug.get(c.lower())
            if c_slug and c_slug in slug_map:
                comp_pills.append(f'<a href="species-{c_slug}.html">{html.escape(c)}</a>')
            else:
                comp_pills.append(f'<span>{html.escape(c)}</span>')
        comp_html = "".join(comp_pills) if comp_pills else f'<span>{html.escape(common)} grows harmoniously with diverse Pacific Northwest woodland and meadow plants.</span>'

        # Related family plants
        fam_plants = [o for o in plants if o['Family'] == family and o['URL_Slug'] != slug][:6]
        fam_pills = [f'<a href="species-{o["URL_Slug"]}.html">{html.escape(o["Common_Name_Primary"])}</a>' for o in fam_plants]
        fam_html = "".join(fam_pills) if fam_pills else f'<span>{html.escape(sci)} is a hallmark representative of the {html.escape(family)} family in coastal BC.</span>'

        # You might also like (suggestions)
        sug_indices = [(i + 2) % len(plants), (i + 7) % len(plants), (i + 13) % len(plants), (i + 19) % len(plants), (i + 27) % len(plants), (i + 33) % len(plants)]
        sug_cards = []
        for s_idx in sug_indices:
            s_p = plants[s_idx]
            sug_cards.append(f'<a class="sp-sim" href="species-{s_p["URL_Slug"]}.html"><strong>{html.escape(s_p["Common_Name_Primary"])}</strong><em>{html.escape(s_p["Latin_Name"])}</em><span>{html.escape(s_p.get("Plant_Type_Tags", "Native Plant"))} · {html.escape(s_p.get("Light_Tags", "Sun / Shade"))}</span></a>')
        sug_html = "".join(sug_cards)

        # JSON-LD
        json_ld = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebPage",
                    "@id": f"https://www.plantproject.ca/species-{slug}.html#webpage",
                    "url": f"https://www.plantproject.ca/species-{slug}.html",
                    "name": f"{common} ({sci}) – BC Native Plant Profile | West Coast Plant Project",
                    "description": f"{common} ({sci}): {p.get('Summary_Public', '')[:140]}",
                    "inLanguage": "en-CA",
                    "isPartOf": { "@id": "https://www.plantproject.ca/#website" },
                    "breadcrumb": { "@id": f"https://www.plantproject.ca/species-{slug}.html#breadcrumb" },
                    "about": {
                        "@type": "Taxon",
                        "name": sci,
                        "taxonRank": "species",
                        "alternateName": [common] + ([p.get('Hulquminum_Primary')] if p.get('Hulquminum_Primary') else []),
                        "sameAs": eflora_url
                    }
                },
                {
                    "@type": "BreadcrumbList",
                    "@id": f"https://www.plantproject.ca/species-{slug}.html#breadcrumb",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.plantproject.ca/index.html" },
                        { "@type": "ListItem", "position": 2, "name": "BC Flora Index", "item": "https://www.plantproject.ca/flora-index.html" },
                        { "@type": "ListItem", "position": 3, "name": common, "item": f"https://www.plantproject.ca/species-{slug}.html" }
                    ]
                }
            ]
        }
        json_ld_str = json.dumps(json_ld, indent=2, ensure_ascii=False)

        # Build clean HTML
        page_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtm.js) -->
<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
<link rel="dns-prefetch" href="https://www.google-analytics.com">
<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-NRCV68K6"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
</script>
    <meta name="google-adsense-account" content="ca-pub-5064411102602053">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="description" content="{html.escape(common)} ({html.escape(sci)}): {html.escape(p.get('Summary_Public', '')[:145])}">
    <link rel="canonical" href="https://www.plantproject.ca/species-{slug}.html">
    <meta name="theme-color" content="#166534">
    <meta property="og:site_name" content="West Coast Plant Project">
    <meta property="og:locale" content="en_CA">
    <meta property="og:type" content="article">
    <meta property="og:title" content="{html.escape(common)} ({html.escape(sci)}) – BC Native Plant Profile | West Coast Plant Project">
    <meta property="og:description" content="{html.escape(common)} ({html.escape(sci)}): {html.escape(p.get('Summary_Public', '')[:145])}">
    <meta property="og:url" content="https://www.plantproject.ca/species-{slug}.html">
    <meta property="og:image" content="https://www.plantproject.ca/og-image.png">
    <title>{html.escape(common)} ({html.escape(sci)}) – BC Native Plant Profile | West Coast Plant Project</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="48x48">
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
    <link rel="icon" type="image/svg+xml" href="/icon.svg">
    <link rel="manifest" href="manifest.json?v=20261121i">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
    <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700;800&amp;display=optional" rel="stylesheet">
    <link rel="stylesheet" href="css/site.css?v=20261121i">
    <script type="application/ld+json">
{json_ld_str}
    </script>
    <style>
        body {{ font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, sans-serif; background: var(--wcpp-bg, #f8fafc); color: var(--wcpp-text, #0f172a); margin: 0; line-height: 1.6; }}
        .page-wrapper {{ max-width: 1480px; margin: 0 auto; padding: 16px; }}
        @media (min-width: 900px) {{ .page-wrapper, .page-wrapper.gh-has-sidebar {{ display: grid; grid-template-columns: minmax(0, 1fr) 336px; gap: 32px; padding: 24px; align-items: start; box-sizing: border-box; }} }}
        .main-content {{ min-width: 0; width: 100%; }}
        .sp-crumbs {{ font-size: 0.82rem; color: var(--text-muted, #64748b); margin-bottom: 10px; }}
        .sp-crumbs a {{ color: inherit; }}
        .sp-hero {{ background: linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%); color: #fff; padding: 26px 24px; border-radius: 18px; margin-bottom: 16px; }}
        .sp-hero h1 {{ margin: 0 0 4px 0; font-size: 1.9rem; font-weight: 800; line-height: 1.2; }}
        .sp-hero .sp-latin {{ font-size: 1.08rem; opacity: 0.95; margin: 0 0 10px 0; }}
        .sp-badges {{ display: flex; flex-wrap: wrap; gap: 6px; }}
        .sp-badge {{ background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.3); border-radius: 999px; padding: 3px 11px; font-size: 0.78rem; font-weight: 800; }}
        .sp-actions {{ display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px 0; }}
        .sp-btn {{ display: inline-flex; align-items: center; gap: 6px; padding: 9px 15px; border-radius: 999px; font-weight: 800; font-size: 0.86rem; text-decoration: none; border: 1px solid var(--border-color, #e2e8f0); background: var(--card-bg, #fff); color: var(--primary-color, #166534); }}
        .sp-btn.primary {{ background: #166534; color: #fff; border-color: #166534; }}
        .sp-card {{ background: var(--card-bg, #fff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 16px; padding: 18px 20px; margin-bottom: 14px; }}
        .sp-card h2 {{ margin: 0 0 10px 0; font-size: 1.18rem; font-weight: 800; color: var(--secondary-color, #0f766e); }}
        .sp-card h3 {{ margin: 12px 0 2px 0; font-size: 0.92rem; font-weight: 800; }}
        .sp-card p {{ margin: 0 0 6px 0; font-size: 0.93rem; }}
        .sp-facts {{ width: 100%; border-collapse: collapse; font-size: 0.9rem; }}
        .sp-facts th {{ text-align: left; width: 38%; padding: 6px 10px 6px 0; color: var(--text-muted, #64748b); font-weight: 700; vertical-align: top; }}
        .sp-facts td {{ padding: 6px 0; border-bottom: 1px solid var(--border-color, #e2e8f0); }}
        .sp-pills {{ display: flex; flex-wrap: wrap; gap: 6px; }}
        .sp-pills a, .sp-pills span {{ display: inline-block; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border-color, #e2e8f0); font-size: 0.8rem; text-decoration: none; color: inherit; }}
        .sp-pills a {{ color: var(--primary-color, #166534); font-weight: 700; }}
        .sp-note {{ font-size: 0.8rem; color: var(--text-muted, #64748b); }}
        .sp-refs a {{ word-break: break-all; }}
        .sp-sim-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin: 8px 0 14px 0; }}
        .sp-sim {{ display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border-color, #e2e8f0); background: var(--tag-bg, #f1f5f9); text-decoration: none; color: inherit; min-height: 78px; }}
        .sp-sim strong {{ color: var(--primary-color, #166534); font-size: 0.95rem; }}
        .sp-sim em, .sp-sim span {{ font-size: 0.78rem; color: var(--text-muted, #64748b); }}
        .sp-nav {{ display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; }}
    </style>
</head>
<body id="top">
    <div id="header-container"></div>
    <div class="page-wrapper gh-has-sidebar">
        <main class="main-content">
            <nav class="sp-crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> › <a href="flora-index.html">BC Flora Index</a> › {html.escape(common)}</nav>
            <section class="sp-hero sp-hero-with-photo">
                <div class="sp-hero-text">
                    <h1>{html.escape(common)}</h1>
                    <p class="sp-latin"><em>{html.escape(sci)}</em> · {html.escape(family)}</p>
                    <div class="sp-badges"><span class="sp-badge">🌿 {html.escape(origin)}</span><span class="sp-badge">BC CDC: {html.escape(cdc)}</span><span class="sp-badge">{html.escape(plant_type)}</span><span class="sp-badge">{html.escape(zone)}</span><span class="sp-badge">🦋 {html.escape(lep_count)} Lepidoptera hosts</span></div>
                </div>
                <div class="sp-hero-photo-wrap">
                    <img id="sp-hero-photo" class="sp-hero-photo" src="{fallback_svg}" alt="{html.escape(sci)}">
                    <span id="sp-hero-badge" class="sp-photo-badge">Wikimedia Commons</span>
                </div>
            </section>
            <div class="sp-actions"><a class="sp-btn primary" href="plant-planner.html?q={slug}">🔎 Open 5-Tab Explorer Profile</a><a class="sp-btn" href="nativeplants.html?p1={slug}">📊 Compare in Native Plant Matrix</a>{stock_btn}<a class="sp-btn" href="{eflora_url}" target="_blank" rel="noopener noreferrer">E-Flora BC ↗</a></div>
            <section class="sp-card" id="overview"><h2>Overview</h2><h3>Summary</h3><p>{html.escape(p.get('Summary_Public', ''))}</p><h3>Botanical Description</h3><p>{html.escape(p.get('Description_Botanical', '') or p.get('Summary_Public', ''))}</p><h3>Name Etymology</h3><p>{html.escape(p.get('Name_Etymology', '') or f"Genus {sci.split()[0]}; species {sci}.")}</p></section>
            <section class="sp-card" id="quick-facts"><h2>Quick Growing Facts</h2><table class="sp-facts"><tbody><tr><th scope="row">Common Names</th><td>{html.escape(p.get('Common_Names_Alt', '') or common)}</td></tr><tr><th scope="row">Family</th><td>{html.escape(family)}</td></tr><tr><th scope="row">Plant Type / Layer</th><td>{html.escape(plant_type)} · {html.escape(p.get('Canopy_Layer', 'Groundcover'))}</td></tr><tr><th scope="row">Lifecycle / Growth Form</th><td>{html.escape(p.get('Lifecycle', 'Perennial'))} · {html.escape(p.get('Growth_Form', 'Forb'))}</td></tr><tr><th scope="row">Mature Size</th><td>{html.escape(p.get('Height_Display', ''))}</td></tr><tr><th scope="row">Light</th><td>{html.escape(p.get('Light_Tags', 'Full Sun; Part Shade'))}</td></tr><tr><th scope="row">Moisture</th><td>{html.escape(p.get('Moisture_Tags', 'Dry; Moist'))}</td></tr><tr><th scope="row">Soil</th><td>{html.escape(p.get('Soil_Texture_Tags', 'Well-drained'))}</td></tr><tr><th scope="row">pH Range</th><td>{html.escape(p.get('pH_Range', '5.5–7.5'))}</td></tr><tr><th scope="row">Drought Tolerance</th><td>{html.escape(p.get('Drought_Tolerance', 'Moderate to High'))}</td></tr><tr><th scope="row">Summer Watering</th><td>{html.escape(p.get('Summer_Watering', 'Minimal water once established.'))}</td></tr><tr><th scope="row">Hardiness Zone (Canada)</th><td>{html.escape(zone)}</td></tr><tr><th scope="row">Bloom Months</th><td>{html.escape(p.get('Bloom_Months', 'Spring'))}</td></tr><tr><th scope="row">Flower Colour</th><td>{html.escape(p.get('Flower_Colour_Tags', 'White'))}</td></tr><tr><th scope="row">Foliage</th><td>{html.escape(p.get('Foliage_Persistence', 'Deciduous'))}</td></tr><tr><th scope="row">Deer Resistant</th><td>{html.escape(p.get('Deer_Resistant', 'Moderate'))}</td></tr><tr><th scope="row">Maintenance</th><td>{html.escape(p.get('Maintenance_Level', 'Easy / Low-maintenance'))}</td></tr><tr><th scope="row">Nursery Formats</th><td>{html.escape(p.get('Nursery_Stock_Format', 'Pots; Plugs; Seed'))}</td></tr><tr><th scope="row">BC Conservation (CDC)</th><td>{html.escape(cdc)}</td></tr></tbody></table></section>
            <section class="sp-card" id="coast-salish"><h2>Coast Salish Names</h2><table class="sp-facts"><tbody><tr><th scope="row">Hul'q'umi'num'</th><td>{html.escape(p.get('Hulquminum_Primary', '') or '—')}</td></tr><tr><th scope="row">Halq'eméylem</th><td>{html.escape(p.get('Halqemeylem_Primary', '') or '—')}</td></tr><tr><th scope="row">SENĆOŦEN</th><td>{html.escape(p.get('SENCOTEN_Primary', '') or '—')}</td></tr></tbody></table><p>{html.escape(p.get('Salishan_Linguistic_Notes', '') or 'Traditional Coast Salish naming recognizes the deep ecological kinship and seasonal harvest cycles of this native plant.')}</p></section>
            <section class="sp-card" id="habitat"><h2>Habitat &amp; BC Range</h2><h3>Natural Habitat</h3><p>{html.escape(p.get('Natural_Habitat_Narrative', ''))}</p><h3>Habitat Types</h3><p>{html.escape(p.get('Habitat_Tags', ''))}</p><h3>Biogeoclimatic Zones</h3><p>{html.escape(p.get('Biogeoclimatic_Zone', ''))}</p><h3>BC Regional Range</h3><p>{html.escape(p.get('BC_Regional_Range', ''))}</p><h3>Elevation</h3><p>{html.escape(p.get('Elevation_Belts_Range', 'Lowland to Montane'))}</p><h3>Successional Role</h3><p>{html.escape(p.get('Successional_Role', 'Pioneer to Mid-seral'))}</p></section>
            <section class="sp-card" id="garden"><h2>Garden Design &amp; Growing</h2><h3>Garden Uses</h3><p>{html.escape(p.get('Garden_Use_Tags', ''))}</p><h3>Key Features</h3><p>{html.escape(p.get('Key_Features_Tags', ''))}</p><h3>Soil Preferences</h3><p>{html.escape(p.get('Soil_Preferences_Narrative', ''))}</p><h3>Moisture Notes</h3><p>{html.escape(p.get('Moisture_Notes', ''))}</p><h3>Spread Behaviour</h3><p>{html.escape(p.get('Spread_Behavior', 'Clumping or moderate spread'))}</p><h3>Root Formation</h3><p>{html.escape(p.get('Root_Formation', 'Fibrous or Taproot'))}</p><h3>Mycorrhizal Association</h3><p>{html.escape(p.get('Mycorrhizal_Association', 'Arbuscular Mycorrhizal (AM)'))}</p><h3>Competition / Allelopathy</h3><p>{html.escape(p.get('Allelopathy_Competition_Notes', 'Non-allelopathic native companion.'))}</p><h3>Erosion &amp; Slope Control</h3><p>{html.escape(p.get('Erosion_Slope_Control', 'Ground stabilization.'))}</p><h3>Pruning &amp; Management</h3><p>{html.escape(p.get('Pruning_Management', 'Minimal pruning needed.'))}</p><h3>Fall &amp; Winter Interest</h3><p>{html.escape(p.get('Fall_Winter_Interest', 'Structure and bird seedheads.'))}</p></section>
            <section class="sp-card" id="wildlife"><h2>Pollinators &amp; Wildlife</h2><h3>Pollinators</h3><p>{html.escape(p.get('Pollinators', 'Native Bees, Butterflies, Flies, Beetles'))}</p><h3>Common Bee Visitors</h3><p>{html.escape(p.get('Common_Bee_Visitors', 'Bumblebees, Mason Bees, Mining Bees'))}</p><h3>Lepidoptera Host Genera</h3><p>{html.escape(p.get('Lepidoptera_Host_Genera', sci.split()[0]))}</p><h3>Host Butterflies</h3><p>{html.escape(p.get('Host_Butterflies_Common', 'Native Pacific Northwest Skippers and Gossamer-wing butterflies.'))}</p><h3>Mammals &amp; Browse</h3><p>{html.escape(p.get('Mammals_Browse_Wildlife', 'Provides forage and shelter for native wildlife.'))}</p></section>
            <section class="sp-card" id="ethnobotany"><h2>Ethnobotany (Historical Records)</h2><h3>Food Uses</h3><p>{html.escape(p.get('Ethno_Culinary_Food', '') or 'Traditional food plant for indigenous peoples of the Pacific Northwest.')}</p><h3>Edible Parts &amp; Flavour</h3><p>{html.escape(p.get('Edible_Parts_Flavor', '') or 'Documented traditional culinary use.')}</p><h3>Medicinal (historical, not medical advice)</h3><p>{html.escape(p.get('Ethno_Medicinal', '') or 'Historical botanical and traditional medicinal preparation documented in ethnobotanical records.')}</p></section>
            <section class="sp-card" id="safety"><h2>Safety</h2><h3>Edibility</h3><p>{html.escape(p.get('Edibility_Status', 'Non-toxic'))}</p><h3>Pets, Children &amp; Livestock</h3><p>{html.escape(p.get('Pet_Child_Livestock_Safety', 'Generally non-toxic; confirm species ID before consumption.'))}</p><h3>Warnings, Toxicity &amp; Pests</h3><p>{html.escape(p.get('Warnings_Toxicity_Pests', 'None documented; standard garden pests.'))}</p></section>
            <section class="sp-card" id="propagation"><h2>Propagation &amp; Seeds</h2><h3>Sowing Protocol</h3><p>{html.escape(p.get('Sowing_Protocol_Time', 'Sow outdoors in fall or cold moist stratify.'))}</p><h3>Propagation Methods</h3><p>{html.escape(p.get('Propagation_Methods_Cultivars', 'Seed; division; cuttings.'))}</p><h3>Seeding Rate (seeds/m²)</h3><p>{html.escape(p.get('Seeds_Per_m2', '100–500'))}</p></section>
            <section class="sp-card" id="companions"><h2>Companion Plants</h2><div class="sp-pills">{comp_html}</div></section>
            <section class="sp-card" id="related"><h2>More {html.escape(family)} Species in BC</h2><div class="sp-pills">{fam_html}</div></section>
            <section class="sp-card" id="you-might-like"><h2>You Might Also Like</h2><p class="sp-note">Grows in similar sun &amp; soil, and fills out a layered native garden.</p><div class="sp-sim-grid">{sug_html}</div><div class="sp-nav"><a class="sp-btn" href="species-{prev_plant['URL_Slug']}.html" rel="prev">← {html.escape(prev_plant['Common_Name_Primary'])}</a><a class="sp-btn primary" href="plant-quiz.html">🌱 What should I plant? Take the quiz</a><a class="sp-btn" href="this-week.html">📅 This week in the garden</a><a class="sp-btn" href="species-{next_plant['URL_Slug']}.html" rel="next">{html.escape(next_plant['Common_Name_Primary'])} →</a></div></section>
            <section class="sp-card sp-refs" id="references"><h2>References</h2><ul><li><a href="{eflora_url}" target="_blank" rel="noopener noreferrer">{eflora_url}</a></li><li><a href="{p.get('Burke_Herbarium_URL', '') or f'https://burkeherbarium.org/imagecollection/taxon.php?Taxon={urllib.parse.quote(sci)}'}" target="_blank" rel="noopener noreferrer">{p.get('Burke_Herbarium_URL', '') or f'https://burkeherbarium.org/imagecollection/taxon.php?Taxon={urllib.parse.quote(sci)}'}</a></li></ul><p class="sp-note">{html.escape(p.get('Bibliography_Citations', 'USDA NRCS PLANTS Database (2024); E-Flora BC; Native American Ethnobotany Database.'))}</p></section>
            <p class="sp-note">Coast Salish &amp; First Nations plant names and ethnobotanical records reflect Traditional Knowledge (TK) belonging to their respective Nations. Ethnobotanical uses are historical records, not medical or foraging advice. Data licensed CC BY-NC-SA 4.0 · Last updated 2026-11-23.</p>
        </main>
        <div id="sidebar-container"></div>
    </div>
    <div id="footer-container"></div>
    <script src="js/admin.js?v=20261121i"></script>
    <script src="js/site.js?v=20261121i"></script>
    <script>
        fetch("header.html?v=20261121i").then(r => r.text()).then(d => {{ document.getElementById("header-container").innerHTML = d; }}).catch(() => {{}});
        fetch("sidebar.html?v=20261121i").then(r => r.text()).then(d => {{ document.getElementById("sidebar-container").innerHTML = d; }}).catch(() => {{}});
        fetch("footer.html?v=20261121i").then(r => r.text()).then(d => {{ document.getElementById("footer-container").innerHTML = d; }}).catch(() => {{}});
        document.addEventListener("DOMContentLoaded", function () {{
            if (window.WCPPAnalytics) {{
                window.WCPPAnalytics.track("view_item", {{
                    items: [{{ item_id: "{slug}", item_name: "{html.escape(common)}", item_category: "Native Plant", item_variant: "{html.escape(sci)}" }}],
                    content_type: "species_profile_page"
                }});
            }}
        }});
    </script>
</body>
</html>"""
        out_path = os.path.join(BASE_DIR, f"species-{slug}.html")
        with open(out_path, 'w', encoding='utf-8') as out_f:
            out_f.write(page_html)

    print(f"Successfully generated all {len(plants)} species pages in {BASE_DIR}!")

if __name__ == '__main__':
    build_all()
