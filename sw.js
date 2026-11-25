/* =========================================================================
   West Coast Plant Project (plantproject.ca) — High-Speed Offline Service Worker
   - Lean core shell precache (no 6.8 MB first-visit bandwidth stampede)
   - Fast Network-First for HTML navigations (live updates appear immediately)
   - Instant (<2ms) Stale-While-Revalidate for partials, CSS, JS, JSON & icons
   ========================================================================= */
const CACHE_NAME = "wcpp-cache-v20261124c";
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

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)))
        ).catch(() => {})
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

function shouldCacheResponse(url, res) {
    if (!res || !res.ok) return false;
    // Skip caching huge >8MB master JSON in SW CacheStorage so storage stays nimble
    if (/plants_master_4590\.json/i.test(url.pathname)) return false;
    return true;
}

async function maybeTransformSidebarPartial(url, isNavigation, res) {
    if (isNavigation || !res || !res.ok || !/\/sidebar\.html$/i.test(url.pathname)) {
        return res;
    }
    const raw = await res.clone().text();
    if (!raw || raw.includes("data-wcpp-lazy-src=")) return res;
    const rewritten = raw.replace(
        /<iframe\b([^>]*?)\bsrc=(["'])(https:\/\/(?:open\.spotify\.com|www\.google\.com\/maps)\/[^"']+)\2([^>]*)>/gi,
        '<iframe$1src="about:blank" data-wcpp-lazy-src=$2$3$2$4>'
    );
    return new Response(rewritten, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" }
    });
}

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (/\/(sitemap\.xml|robots\.txt)$/i.test(url.pathname)) return;

    const isNavigation = req.mode === "navigate";
    const isPartialHtml = /\/(header|sidebar|footer)\.html$/i.test(url.pathname);

    // 1. Full Page HTML Navigations: Network-First with fast offline cache fallback
    if (isNavigation && !isPartialHtml) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (shouldCacheResponse(url, res)) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
                    }
                    return res;
                })
                .catch(() =>
                    caches.match(req).then((m) =>
                        m || caches.match(req, { ignoreSearch: true }).then((m2) =>
                            m2 || (!/admin\.html$/i.test(url.pathname) ? caches.match("./index.html") : Response.error())
                        )
                    )
                )
        );
        return;
    }

    // 2. Partials (header/sidebar/footer), CSS, JS, JSON datasets & static icons:
    //    Instant Stale-While-Revalidate (returns cached copy in <2ms, refreshes in background)
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
            cache.match(req).then((exactMatch) => {
                const matchPromise = exactMatch
                    ? Promise.resolve(exactMatch)
                    : (isPartialHtml ? cache.match(req, { ignoreSearch: true }) : Promise.resolve(null));

                return matchPromise.then((cached) => {
                    const networkFetch = fetch(req)
                        .then(async (res) => {
                            const finalRes = await maybeTransformSidebarPartial(url, isNavigation, res);
                            if (shouldCacheResponse(url, finalRes)) {
                                cache.put(req, finalRes.clone()).catch(() => {});
                            }
                            return finalRes;
                        })
                        .catch(() => cached || Response.error());

                    if (cached) {
                        return maybeTransformSidebarPartial(url, isNavigation, cached);
                    }
                    return networkFetch;
                });
            })
        )
    );
});
