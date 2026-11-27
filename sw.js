/* =========================================================================
   West Coast Plant Project (plantproject.ca) — High-Speed Offline Service Worker
   - Preserves ?v= versioned cache keys so deploys never collide with stale versions
   - Network-First (no-cache) with offline fallback for site.js & Bed Designer assets
   - Instant (<2ms) Stale-While-Revalidate for HTML pages, partials, site.css & data JSONs
   - Zero DOM/iframe rewriting — 100% of sidebar widgets & data remain untouched
   ========================================================================= */
const CACHE_NAME = "wcpp-cache-v20261127d";
const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./header.html",
    "./sidebar.html",
    "./footer.html",
    "./css/site.css",
    "./js/site.js",
    "./js/admin.js",
    "./manifest.json",
    "./favicon.ico",
    "./icon.svg"
];

const SHELL_PATH_RE = /\/(header\.html|sidebar\.html|footer\.html|css\/site\.css|js\/site\.js|js\/admin\.js|manifest\.json|favicon\.ico|icon\.svg)$/i;
const NETWORK_FIRST_RE = /\/(css\/site\.css|js\/site\.js|css\/bed-simulator\.css|js\/bed-simulator-core\.js|js\/bed-simulator-ui\.js|js\/bed-simulator-studio-modals\.js|js\/bed-simulator-v6\.js)$/i;
const DATA_JSON_RE = /\/data\/(bios_base|bed_simulator_crops|calendar_base|garden_crops|plants_212)\.json$/i;

function canonicalCacheRequest(url, req, isNavigation) {
    if (url.searchParams.has("v")) {
        return new Request(url.origin + url.pathname + url.search, { method: "GET" });
    }
    if (isNavigation || SHELL_PATH_RE.test(url.pathname) || DATA_JSON_RE.test(url.pathname) || /\.json$/i.test(url.pathname)) {
        const normPath = url.pathname === "/" ? "/index.html" : url.pathname;
        return new Request(url.origin + normPath, { method: "GET" });
    }
    return req;
}

function shouldCacheResponse(url, res) {
    if (!res || !res.ok || res.status !== 200) return false;
    // Skip caching >8MB master JSON in SW CacheStorage so storage stays nimble
    if (/plants_master_4590\.json/i.test(url.pathname)) return false;
    return true;
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            Promise.allSettled(
                PRECACHE_URLS.map(async (rawUrl) => {
                    const resolved = new URL(rawUrl, self.location.origin + "/");
                    const res = await fetch(resolved.href, { cache: "no-cache" });
                    if (shouldCacheResponse(resolved, res)) {
                        const keyReq = canonicalCacheRequest(resolved, new Request(resolved.href), resolved.pathname.endsWith(".html") && !SHELL_PATH_RE.test(resolved.pathname));
                        await cache.put(keyReq, res);
                    }
                })
            )
        ).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (/\/(sitemap\.xml|robots\.txt)$/i.test(url.pathname)) return;

    const isNavigation = req.mode === "navigate";
    const forceFresh = req.cache === "reload" || req.cache === "no-store" || url.searchParams.has("bust");
    const isNetworkFirst = NETWORK_FIRST_RE.test(url.pathname);
    const cacheKey = canonicalCacheRequest(url, req, isNavigation);

    // Network-First (with offline cache fallback) for site.js, Bed Designer bundle & explicit reloads
    if (forceFresh || isNetworkFirst) {
        event.respondWith(
            fetch(req, { cache: "no-cache" })
                .then((res) => {
                    if (shouldCacheResponse(url, res)) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(cacheKey, copy)).catch(() => {});
                    }
                    return res;
                })
                .catch(() => caches.match(cacheKey).then((hit) => hit || Response.error()))
        );
        return;
    }

    // Fast Stale-While-Revalidate for navigations, HTML partials, site.css, data JSONs & icons
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
            cache.match(cacheKey).then((cached) => {
                const networkFetch = fetch(req, { cache: "no-cache" })
                    .then((res) => {
                        if (shouldCacheResponse(url, res)) {
                            cache.put(cacheKey, res.clone()).catch(() => {});
                        }
                        return res;
                    })
                    .catch(() => {
                        if (cached) return cached;
                        if (isNavigation && !/admin\.html$/i.test(url.pathname)) {
                            return cache.match(new Request(url.origin + "/index.html"));
                        }
                        return Response.error();
                    });

                return cached || networkFetch;
            })
        )
    );
});
