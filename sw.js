/* =========================================================================
   West Coast Plant Project (plantproject.ca) — Offline Service Worker
   Caches shell pages, scripts, styles, and core datasets for fast & offline use.
   ========================================================================= */
const CACHE_NAME = "wcpp-cache-v20261121c";
const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./orders.html",
    "./garden.html",
    "./nativeplants.html",
    "./plant-planner.html",
    "./calendar.html",
    "./calculators.html",
    "./bios.html",
    "./latin.html",
    "./articles.html",
    "./updates.html",
    "./admin.html",
    "./support.html",
    "./404.html",
    "./header.html",
    "./sidebar.html",
    "./footer.html",
    "./css/site.css",
    "./plant-planner.css",
    "./js/site.js",
    "./js/admin.js",
    "./plant-planner-search.js",
    "./data/article_hashtags.json",
    "./data/articles_base.json",
    "./data/bios_base.json",
    "./data/blog_posts.json",
    "./data/calendar_base.json",
    "./data/garden_crops.json",
    "./data/latin_base.json",
    "./data/orders_inventory.json",
    "./data/orders_config.json",
    "./data/plants_212.json",
    "./data/preorders_base.json",
    "./data/sidebar_spotlight.json",
    "./data/site_updates.json",
    "./manifest.json",
    "./favicon.ico",
    "./icon.svg",
    "./icon-192.png",
    "./icon-512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    if (/\/(sitemap\.xml|robots\.txt)$/i.test(url.pathname)) {
        return;
    }

    // Network-first for HTML, CSS, JS & JSON data so UI updates and live inventory stay fresh when online,
    // falling back cleanly to cache when offline.
    const isDynamicDoc = req.mode === "navigate" || /\.(html|css|js|json|csv)(\?|$)/i.test(url.pathname);
    if (isDynamicDoc) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
                    }
                    return res;
                })
                .catch(() => caches.match(req).then((m) => {
                    if (m) return m;
                    return caches.match(req, { ignoreSearch: true }).then((m2) => {
                        if (m2) return m2;
                        if (req.mode === "navigate" && !/admin\.html$/i.test(url.pathname)) {
                            return caches.match("./index.html");
                        }
                        return Response.error();
                    });
                }))
        );
        return;
    }

    // Stale-while-revalidate for JS / CSS / static assets
    event.respondWith(
        caches.match(req).then((cached) => {
            const netFetch = fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
                    }
                    return res;
                })
                .catch(() => cached);
            return cached || netFetch;
        })
    );
});
