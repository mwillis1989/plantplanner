/* =========================================================================
   West Coast Plant Project (plantproject.ca)
   Curator Admin Engine, IndexedDB Override Layer, GitHub Publisher & Citation Tool
   ========================================================================= */
(function (global) {
    "use strict";

    if (global.WCPPAdmin) return;

    const DB_NAME = "wcpp_curator_db";
    const DB_VERSION = 1;
    const STORE_NAME = "overrides";
    const LS_PASS_KEY = "wcpp_curator_passhash_v1";
    const SS_AUTH_KEY = "wcpp_curator_unlocked_v1";
    const LS_STAY_KEY = "wcpp_curator_stay_v1";
    const LS_GH_REPO = "wcpp_gh_repo";
    const LS_GH_BRANCH = "wcpp_gh_branch";
    const LS_GH_TOKEN = "wcpp_gh_token";
    const SS_GH_TOKEN = "wcpp_gh_token_session";

    // Deterministic string hash that works in non-HTTPS contexts (localhost, file://, https)
    function hashStr(str) {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
    }

    const DEFAULT_HASH = "2dcf4s7k8vc";

    let _db = null;
    let _overrides = {}; // { [datasetKey]: { patches: {}, added: [], deleted: [], addedColumns: [], fullReplace?: [] } }
    let _modalEl = null;
    let _failedAttempts = 0;
    let _lockoutUntil = 0;

    function getGhToken() {
        return sessionStorage.getItem(SS_GH_TOKEN) || localStorage.getItem(LS_GH_TOKEN) || "";
    }

    function emptyBucket() {
        return { patches: {}, added: [], deleted: [], addedColumns: [] };
    }

    function openDatabase() {
        return new Promise((resolve) => {
            if (!global.indexedDB) {
                try {
                    const fallback = JSON.parse(localStorage.getItem("wcpp_curator_fallback_v1") || "{}");
                    _overrides = fallback && typeof fallback === "object" ? fallback : {};
                } catch (_) { _overrides = {}; }
                resolve(null);
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function (e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "datasetKey" });
                }
            };
            req.onsuccess = function (e) {
                _db = e.target.result;
                const tx = _db.transaction(STORE_NAME, "readonly");
                const store = tx.objectStore(STORE_NAME);
                const getAllReq = store.getAll();
                getAllReq.onsuccess = function () {
                    const rows = getAllReq.result || [];
                    rows.forEach(item => {
                        if (item && item.datasetKey) {
                            _overrides[item.datasetKey] = Object.assign(emptyBucket(), item.data || {});
                        }
                    });
                    resolve(_db);
                };
                getAllReq.onerror = function () { resolve(_db); };
            };
            req.onerror = function () { resolve(null); };
        });
    }

    function persistBucket(datasetKey) {
        const payload = _overrides[datasetKey] || emptyBucket();
        return new Promise((resolve) => {
            if (!_db) {
                try {
                    localStorage.setItem("wcpp_curator_fallback_v1", JSON.stringify(_overrides));
                } catch (_) {}
                resolve();
                return;
            }
            const tx = _db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put({ datasetKey, data: payload });
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    }

    function getBucket(datasetKey) {
        if (!_overrides[datasetKey]) _overrides[datasetKey] = emptyBucket();
        return _overrides[datasetKey];
    }

    function isLoggedIn() {
        return sessionStorage.getItem(SS_AUTH_KEY) === "true" || localStorage.getItem(LS_STAY_KEY) === "true";
    }

    function verifyPassphrase(candidate) {
        const stored = localStorage.getItem(LS_PASS_KEY) || DEFAULT_HASH;
        return hashStr(String(candidate || "")) === stored;
    }

    function setLoggedIn(active, stayLoggedIn) {
        if (active) {
            sessionStorage.setItem(SS_AUTH_KEY, "true");
            if (stayLoggedIn) localStorage.setItem(LS_STAY_KEY, "true");
            else localStorage.removeItem(LS_STAY_KEY);
        } else {
            sessionStorage.removeItem(SS_AUTH_KEY);
            localStorage.removeItem(LS_STAY_KEY);
            sessionStorage.removeItem(SS_GH_TOKEN);
        }
        syncUIState();
        global.dispatchEvent(new CustomEvent("wcpp:curator-changed", { detail: { loggedIn: active } }));
    }

    function countDatasetChanges(datasetKey) {
        const b = _overrides[datasetKey];
        if (!b) return 0;
        let c = Object.keys(b.patches || {}).length + (b.added || []).length + (b.deleted || []).length + (b.addedColumns || []).length;
        if (Array.isArray(b.fullReplace)) c += 1;
        return c;
    }

    function countAllChanges() {
        return Object.keys(_overrides).reduce((sum, k) => sum + countDatasetChanges(k), 0);
    }

    function syncUIState() {
        const active = isLoggedIn();
        const stateKey = active ? "1" : "0";
        if (document.body) {
            document.body.classList.toggle("curator-mode", active);
        }
        const headerBtn = document.getElementById("headerCuratorBtn");
        if (headerBtn && headerBtn.dataset.curatorState !== stateKey) {
            headerBtn.dataset.curatorState = stateKey;
            headerBtn.classList.toggle("curator-active", active);
            headerBtn.innerHTML = active
                ? `<span aria-hidden="true">●</span><span class="btn-label-desktop">Curator ON</span>`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><span class="btn-label-desktop">Curator</span>`;
        }
        const mobileBtn = document.getElementById("mobileCuratorBtn");
        if (mobileBtn && mobileBtn.dataset.curatorState !== stateKey) {
            mobileBtn.dataset.curatorState = stateKey;
            mobileBtn.textContent = active ? "● Curator ON (Settings)" : "Curator Login";
        }
        const ddBtn = document.getElementById("desktopDdCuratorBtn");
        if (ddBtn && ddBtn.dataset.curatorState !== stateKey) {
            ddBtn.dataset.curatorState = stateKey;
            ddBtn.innerHTML = active
                ? `<span>● Curator ON (Settings)</span><span>⚙</span>`
                : `<span>Curator Login</span><span>🔒</span>`;
        }
        renderFloatingDock();
    }

    function renderFloatingDock() {
        if (!document.body) return;
        let dock = document.getElementById("wcppCuratorDock");
        if (!dock) {
            dock = document.createElement("div");
            dock.id = "wcppCuratorDock";
            dock.className = "curator-floating-bar";
            document.body.appendChild(dock);
        }
        const changeCount = countAllChanges();
        dock.innerHTML = `
            <span class="curator-dock-badge">● Curator Mode <span class="curator-change-count">${changeCount} edit${changeCount === 1 ? "" : "s"}</span></span>
            <a href="admin.html" class="curator-btn curator-btn-primary">Data Studio</a>
            <button type="button" class="curator-btn" id="dockSettingsBtn">⚙ Publish / Settings</button>
            <button type="button" class="curator-btn curator-btn-danger" id="dockLogoutBtn">Lock</button>
        `;
        dock.querySelector("#dockSettingsBtn").onclick = () => openLoginModal();
        dock.querySelector("#dockLogoutBtn").onclick = () => logout();
    }

    function logout() {
        setLoggedIn(false, false);
        showAdminToast("Curator Mode locked.");
    }

    function showAdminToast(msg) {
        const existing = document.getElementById("toast");
        if (existing) {
            existing.textContent = msg;
            existing.classList.add("show");
            clearTimeout(existing._tid);
            existing._tid = setTimeout(() => existing.classList.remove("show"), 2600);
            return;
        }
        let el = document.getElementById("wcppAdminToast");
        if (!el) {
            el = document.createElement("div");
            el.id = "wcppAdminToast";
            el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#166534;color:#fff;padding:10px 20px;border-radius:999px;font-weight:800;font-size:0.9rem;z-index:3500;box-shadow:0 8px 24px rgba(0,0,0,0.25);";
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.display = "block";
        clearTimeout(el._tid);
        el._tid = setTimeout(() => { el.style.display = "none"; }, 2600);
    }

    function escapeHTML(str) {
        return String(str == null ? "" : str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function closeModal() {
        if (_modalEl) {
            _modalEl.remove();
            _modalEl = null;
        }
    }

    function createModalShell(title, bodyHtml, footerHtml, wide = false) {
        closeModal();
        const backdrop = document.createElement("div");
        backdrop.className = "wcpp-modal-backdrop";
        backdrop.innerHTML = `
            <div class="wcpp-modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
                <div class="wcpp-modal-header">
                    <h2>${title}</h2>
                    <button type="button" class="wcpp-modal-close" aria-label="Close">✕</button>
                </div>
                <div class="wcpp-modal-body">${bodyHtml}</div>
                <div class="wcpp-modal-footer">${footerHtml}</div>
            </div>
        `;
        backdrop.querySelector(".wcpp-modal-close").onclick = closeModal;
        backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
        document.body.appendChild(backdrop);
        _modalEl = backdrop;
        return backdrop;
    }

    // =====================================================================
    // OVERRIDE MERGING & PERSISTENCE API
    // =====================================================================
    function applyOverrides(datasetKey, baseRecords, idField = "URL_Slug") {
        const b = getBucket(datasetKey);
        const source = Array.isArray(b.fullReplace) ? b.fullReplace : (Array.isArray(baseRecords) ? baseRecords : []);
        const deletedSet = new Set((b.deleted || []).map(String));
        const extraCols = Array.isArray(b.addedColumns) ? b.addedColumns : [];

        const out = [];
        const seenIds = new Set();

        for (let i = 0; i < source.length; i++) {
            const raw = source[i];
            const idVal = String(raw[idField] || raw.id || raw.name || `row-${i}`);
            if (deletedSet.has(idVal)) continue;
            seenIds.add(idVal);

            const rec = Object.assign({}, raw);
            extraCols.forEach(c => { if (!(c in rec)) rec[c] = ""; });
            if (b.patches && b.patches[idVal]) {
                Object.assign(rec, b.patches[idVal]);
            }
            out.push(rec);
        }

        if (Array.isArray(b.added)) {
            b.added.forEach((rawAdded, idx) => {
                const idVal = String(rawAdded[idField] || rawAdded.id || rawAdded.name || `added-${idx}`);
                if (deletedSet.has(idVal) || seenIds.has(idVal)) return;
                const rec = Object.assign({}, rawAdded);
                extraCols.forEach(c => { if (!(c in rec)) rec[c] = ""; });
                if (b.patches && b.patches[idVal]) {
                    Object.assign(rec, b.patches[idVal]);
                }
                out.push(rec);
            });
        }

        return out;
    }

    async function savePatch(datasetKey, recordId, fieldUpdates) {
        const b = getBucket(datasetKey);
        const key = String(recordId);
        b.patches[key] = Object.assign({}, b.patches[key] || {}, fieldUpdates);
        await persistBucket(datasetKey);
        syncUIState();
    }

    async function revertPatchField(datasetKey, recordId, colKey) {
        const b = getBucket(datasetKey);
        const key = String(recordId);
        if (b.patches[key]) {
            delete b.patches[key][colKey];
            if (Object.keys(b.patches[key]).length === 0) delete b.patches[key];
            await persistBucket(datasetKey);
            syncUIState();
        }
    }

    async function addRecord(datasetKey, record) {
        const b = getBucket(datasetKey);
        b.added.push(record);
        await persistBucket(datasetKey);
        syncUIState();
    }

    async function deleteRecord(datasetKey, recordId) {
        const b = getBucket(datasetKey);
        const key = String(recordId);
        if (!b.deleted.includes(key)) b.deleted.push(key);
        b.added = (b.added || []).filter(r => String(r.URL_Slug || r.id || r.name || "") !== key);
        await persistBucket(datasetKey);
        syncUIState();
    }

    async function addColumn(datasetKey, colName) {
        const b = getBucket(datasetKey);
        if (!b.addedColumns.includes(colName)) {
            b.addedColumns.push(colName);
            await persistBucket(datasetKey);
            syncUIState();
        }
    }

    async function setFullReplace(datasetKey, recordsArray) {
        const b = getBucket(datasetKey);
        b.fullReplace = recordsArray;
        b.patches = {};
        b.added = [];
        b.deleted = [];
        await persistBucket(datasetKey);
        syncUIState();
    }

    async function clearDatasetOverrides(datasetKey) {
        delete _overrides[datasetKey];
        if (_db) {
            await new Promise((resolve) => {
                const tx = _db.transaction(STORE_NAME, "readwrite");
                tx.objectStore(STORE_NAME).delete(datasetKey);
                tx.oncomplete = resolve;
                tx.onerror = resolve;
            });
        } else {
            try { localStorage.setItem("wcpp_curator_fallback_v1", JSON.stringify(_overrides)); } catch (_) {}
        }
        syncUIState();
    }

    // =====================================================================
    // CURATOR LOGIN & SETTINGS MODAL
    // =====================================================================
    const EYE_OPEN_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const EYE_OFF_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    function bindPasswordToggles(modal) {
        if (!modal) return;
        modal.querySelectorAll(".wcpp-pass-toggle[data-target]").forEach(btn => {
            btn.onclick = () => {
                const targetId = btn.getAttribute("data-target");
                const input = modal.querySelector(`#${targetId}`);
                if (!input) return;
                const show = input.type === "password";
                input.type = show ? "text" : "password";
                btn.setAttribute("aria-pressed", show ? "true" : "false");
                btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
                btn.innerHTML = show ? `${EYE_OFF_SVG}<span>Hide</span>` : `${EYE_OPEN_SVG}<span>Show</span>`;
                input.focus();
            };
        });
    }

    function openLoginModal() {
        const logged = isLoggedIn();
        if (!logged) {
            const modal = createModalShell(
                "🔒 Curator Login",
                `
                <p class="wcpp-help-text" style="margin:0;">
                    Sign in to unlock inline editing across all plant planners, pest cards, calendars, and resources.
                    Changes save automatically to your browser's local database, and you can export or publish them straight to GitHub Pages.
                </p>
                <div class="wcpp-field-group">
                    <label for="curatorPassInput">Curator Passcode</label>
                    <div class="wcpp-pass-wrap">
                        <input type="password" id="curatorPassInput" class="wcpp-input" placeholder="Enter curator passcode..." autofocus />
                        <button type="button" class="wcpp-pass-toggle" data-target="curatorPassInput" aria-pressed="false" aria-label="Show password">${EYE_OPEN_SVG}<span>Show</span></button>
                    </div>
                </div>
                <label style="display:flex; align-items:center; gap:8px; font-size:0.86rem; cursor:pointer;">
                    <input type="checkbox" id="curatorStayCheck" checked />
                    <span>Keep Curator Mode unlocked on this browser</span>
                </label>
                <div id="curatorLoginErr" style="color:#dc2626; font-size:0.84rem; font-weight:800; display:none;"></div>
                `,
                `
                <button type="button" class="wcpp-pill-btn" id="loginCancelBtn">Cancel</button>
                <button type="button" class="wcpp-pill-btn primary" id="loginSubmitBtn">🔓 Unlock Curator Mode</button>
                `
            );
            bindPasswordToggles(modal);
            modal.querySelector("#loginCancelBtn").onclick = closeModal;
            const doSubmit = () => {
                const err = modal.querySelector("#curatorLoginErr");
                if (Date.now() < _lockoutUntil) {
                    const secs = Math.max(1, Math.ceil((_lockoutUntil - Date.now()) / 1000));
                    err.textContent = `Too many failed attempts. Please wait ${secs}s and try again.`;
                    err.style.display = "block";
                    return;
                }
                const pass = modal.querySelector("#curatorPassInput").value;
                const stay = modal.querySelector("#curatorStayCheck").checked;
                if (verifyPassphrase(pass)) {
                    _failedAttempts = 0;
                    _lockoutUntil = 0;
                    setLoggedIn(true, stay);
                    closeModal();
                    showAdminToast("🛠️ Curator Mode unlocked!");
                } else {
                    _failedAttempts += 1;
                    if (_failedAttempts >= 5) {
                        _lockoutUntil = Date.now() + 30000;
                        err.textContent = "Too many failed attempts. Please wait a few seconds and try again.";
                    } else {
                        err.textContent = "Incorrect passcode. Please try again.";
                    }
                    err.style.display = "block";
                }
            };
            modal.querySelector("#loginSubmitBtn").onclick = doSubmit;
            modal.querySelector("#curatorPassInput").addEventListener("keydown", (e) => { if (e.key === "Enter") doSubmit(); });
            return;
        }

        // Logged-in Settings & GitHub Publishing Modal
        const ghRepo = localStorage.getItem(LS_GH_REPO) || "mwillis1989/plantplanner";
        const ghBranch = localStorage.getItem(LS_GH_BRANCH) || "main";
        const ghToken = getGhToken();
        const rememberTokenChecked = Boolean(localStorage.getItem(LS_GH_TOKEN));
        const changeCount = countAllChanges();

        const modal = createModalShell(
            "🛠️ Curator Settings & GitHub Sync",
            `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding:10px 14px; border-radius:12px; background:var(--wcpp-tag-bg);">
                <div>
                    <strong style="color:var(--wcpp-primary);">Status: Active (${changeCount} local override${changeCount === 1 ? "" : "s"})</strong>
                    <div class="wcpp-help-text">Open the full Data Studio to bulk edit, sync Google Sheets, or export datasets.</div>
                </div>
                <a href="admin.html" class="wcpp-pill-btn primary">📊 Open Data Studio →</a>
            </div>
            <div class="wcpp-field-group">
                <label for="cfgNewPass">Change Curator Passcode (leave blank to keep current)</label>
                <div class="wcpp-pass-wrap">
                    <input type="password" id="cfgNewPass" class="wcpp-input" placeholder="Enter new personal passcode..." />
                    <button type="button" class="wcpp-pass-toggle" data-target="cfgNewPass" aria-pressed="false" aria-label="Show password">${EYE_OPEN_SVG}<span>Show</span></button>
                </div>
            </div>
            <hr style="border:0; border-top:1px solid var(--wcpp-border); margin:4px 0;">
            <strong style="font-size:0.9rem; color:var(--wcpp-primary);">Optional: Direct GitHub Commit Settings</strong>
            <p class="wcpp-help-text" style="margin:0;">Save your GitHub repository &amp; Personal Access Token (stored in this session by default, or remembered locally if checked) to publish updated JSON files straight to your live site.</p>
            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px;">
                <div class="wcpp-field-group">
                    <label for="cfgGhRepo">GitHub Repo (owner/repo)</label>
                    <input type="text" id="cfgGhRepo" class="wcpp-input" value="${escapeHTML(ghRepo)}" />
                </div>
                <div class="wcpp-field-group">
                    <label for="cfgGhBranch">Branch</label>
                    <input type="text" id="cfgGhBranch" class="wcpp-input" value="${escapeHTML(ghBranch)}" />
                </div>
            </div>
            <div class="wcpp-field-group">
                <label for="cfgGhToken">GitHub Personal Access Token (optional)</label>
                <div class="wcpp-pass-wrap">
                    <input type="password" id="cfgGhToken" class="wcpp-input" value="${escapeHTML(ghToken)}" placeholder="ghp_... or github_pat_..." />
                    <button type="button" class="wcpp-pass-toggle" data-target="cfgGhToken" aria-pressed="false" aria-label="Show password">${EYE_OPEN_SVG}<span>Show</span></button>
                </div>
            </div>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.84rem; cursor:pointer;">
                <input type="checkbox" id="cfgRememberToken" ${rememberTokenChecked ? "checked" : ""} />
                <span>Remember GitHub token on this browser (uncheck to clear when tab closes or locked)</span>
            </label>
            <div style="display:flex; flex-direction:column; gap:6px; padding-top:4px;">
                <button type="button" class="wcpp-pill-btn primary" id="cfgPublishSiteBtn" style="justify-content:center;">🚀 Publish All Updated Site Files to GitHub</button>
                <div id="cfgPublishStatus" class="wcpp-help-text" style="display:none; font-weight:700;"></div>
            </div>
            `,
            `
            <button type="button" class="wcpp-pill-btn danger" id="cfgLogoutBtn">🔒 Lock Curator Mode</button>
            <button type="button" class="wcpp-pill-btn" id="cfgCloseBtn">Close</button>
            <button type="button" class="wcpp-pill-btn primary" id="cfgSaveBtn">💾 Save Settings</button>
            `
        );

        bindPasswordToggles(modal);
        modal.querySelector("#cfgLogoutBtn").onclick = () => { closeModal(); logout(); };
        modal.querySelector("#cfgCloseBtn").onclick = closeModal;
        const saveSettingsFromModal = () => {
            const newPass = modal.querySelector("#cfgNewPass").value.trim();
            if (newPass) {
                localStorage.setItem(LS_PASS_KEY, hashStr(newPass));
            }
            const repo = modal.querySelector("#cfgGhRepo").value.trim() || "mwillis1989/plantplanner";
            const branch = modal.querySelector("#cfgGhBranch").value.trim() || "main";
            localStorage.setItem(LS_GH_REPO, repo);
            localStorage.setItem(LS_GH_BRANCH, branch);
            const tok = modal.querySelector("#cfgGhToken").value.trim();
            const rememberTok = modal.querySelector("#cfgRememberToken").checked;
            if (tok) {
                if (rememberTok) {
                    localStorage.setItem(LS_GH_TOKEN, tok);
                    sessionStorage.removeItem(SS_GH_TOKEN);
                } else {
                    sessionStorage.setItem(SS_GH_TOKEN, tok);
                    localStorage.removeItem(LS_GH_TOKEN);
                }
            } else {
                localStorage.removeItem(LS_GH_TOKEN);
                sessionStorage.removeItem(SS_GH_TOKEN);
            }
            return { repo, branch, token: tok };
        };
        modal.querySelector("#cfgSaveBtn").onclick = () => {
            saveSettingsFromModal();
            closeModal();
            showAdminToast("✓ Curator settings saved!");
        };
        modal.querySelector("#cfgPublishSiteBtn").onclick = async () => {
            const btn = modal.querySelector("#cfgPublishSiteBtn");
            const statusEl = modal.querySelector("#cfgPublishStatus");
            const cfg = saveSettingsFromModal();
            if (!cfg.token) {
                statusEl.style.display = "block";
                statusEl.style.color = "#dc2626";
                statusEl.textContent = "Please paste your GitHub Personal Access Token above first.";
                return;
            }
            btn.disabled = true;
            statusEl.style.display = "block";
            statusEl.style.color = "var(--wcpp-secondary, #0f766e)";
            statusEl.textContent = "Preparing site files for upload...";
            try {
                const res = await publishAllSiteFilesToGitHub({
                    repo: cfg.repo,
                    branch: cfg.branch,
                    token: cfg.token,
                    onProgress: (msg) => { statusEl.textContent = msg; }
                });
                statusEl.style.color = "var(--wcpp-primary, #166534)";
                statusEl.textContent = `✓ Published ${res.count} files to ${cfg.repo} (${cfg.branch})! GitHub Pages will rebuild shortly.`;
                showAdminToast(`🚀 Published ${res.count} files to GitHub!`);
            } catch (err) {
                statusEl.style.color = "#dc2626";
                statusEl.textContent = err && err.message ? err.message : "GitHub upload failed.";
            } finally {
                btn.disabled = false;
            }
        };
    }

    // =====================================================================
    // INLINE CELL EDITOR MODAL
    // =====================================================================
    function openCellEditor({ datasetKey, recordId, recordTitle, colKey, colLabel, currentValue, onSave }) {
        if (!isLoggedIn()) {
            openLoginModal();
            return;
        }
        const b = getBucket(datasetKey);
        const isPatched = Boolean(b.patches[recordId] && colKey in b.patches[recordId]);

        const modal = createModalShell(
            `✏️ Edit Attribute: ${escapeHTML(colLabel || colKey)}`,
            `
            <div style="font-size:0.86rem; color:var(--wcpp-muted);">
                Editing record: <strong style="color:var(--wcpp-text);">${escapeHTML(recordTitle || recordId)}</strong>
                <span style="opacity:0.75;">(Field key: <code>${escapeHTML(colKey)}</code>)</span>
            </div>
            <div class="wcpp-field-group">
                <label for="cellEditTextarea">Attribute Value</label>
                <textarea id="cellEditTextarea" class="wcpp-textarea" style="min-height:140px;">${escapeHTML(currentValue || "")}</textarea>
            </div>
            <p class="wcpp-help-text" style="margin:0;">
                Tip: For tag or companion columns (such as <code>Bloom_Months</code>, <code>Light_Tags</code>, or <code>Companion_Plants</code>), separate multiple items with semicolons (<code>; </code>).
            </p>
            `,
            `
            ${isPatched ? `<button type="button" class="wcpp-pill-btn danger" id="cellRevertBtn">↩ Revert Field</button>` : ""}
            <button type="button" class="wcpp-pill-btn" id="cellCancelBtn">Cancel</button>
            <button type="button" class="wcpp-pill-btn primary" id="cellSaveBtn">💾 Save Change</button>
            `
        );

        modal.querySelector("#cellCancelBtn").onclick = closeModal;
        modal.querySelector("#cellSaveBtn").onclick = async () => {
            const newVal = modal.querySelector("#cellEditTextarea").value;
            await savePatch(datasetKey, recordId, { [colKey]: newVal });
            closeModal();
            if (typeof onSave === "function") onSave(newVal);
            showAdminToast(`✓ Saved "${colLabel || colKey}"`);
        };
        const revertBtn = modal.querySelector("#cellRevertBtn");
        if (revertBtn) {
            revertBtn.onclick = async () => {
                await revertPatchField(datasetKey, recordId, colKey);
                closeModal();
                if (typeof onSave === "function") onSave(null, true);
                showAdminToast(`Reverted local edit for "${colLabel || colKey}"`);
            };
        }
    }

    // =====================================================================
    // FULL RECORD ADD / EDIT MODAL
    // =====================================================================
    function openRecordModal({ datasetKey, title, fields, initialRecord, isNew = false, idField = "URL_Slug", onSave, onDelete }) {
        if (!isLoggedIn()) {
            openLoginModal();
            return;
        }
        const rec = Object.assign({}, initialRecord || {});
        const fieldList = fields && fields.length
            ? fields
            : Object.keys(rec).filter(k => !k.startsWith("_")).map(k => ({ key: k, label: k.replace(/_/g, " ") }));

        const fieldsHtml = fieldList.map(f => {
            const val = rec[f.key] != null ? rec[f.key] : "";
            const isLong = String(val).length > 85 || /notes|description|summary|ethno|bibliography|narrative|citations|details/i.test(f.key);
            return `
                <div class="wcpp-field-group rec-modal-field" data-search="${escapeHTML((f.label + " " + f.key).toLowerCase())}">
                    <label for="rf_${escapeHTML(f.key)}">${escapeHTML(f.label)} <small style="opacity:0.6; font-weight:600;">(${escapeHTML(f.key)})</small></label>
                    ${f.type === "select" && Array.isArray(f.options)
                        ? `<select id="rf_${escapeHTML(f.key)}" data-key="${escapeHTML(f.key)}" class="wcpp-select">${f.options.map(opt => `<option value="${escapeHTML(opt)}" ${String(val) === String(opt) ? "selected" : ""}>${escapeHTML(opt)}</option>`).join("")}</select>`
                        : (isLong
                            ? `<textarea id="rf_${escapeHTML(f.key)}" data-key="${escapeHTML(f.key)}" class="wcpp-textarea" placeholder="${escapeHTML(f.placeholder || "")}">${escapeHTML(val)}</textarea>`
                            : `<input type="text" id="rf_${escapeHTML(f.key)}" data-key="${escapeHTML(f.key)}" class="wcpp-input" value="${escapeHTML(val)}" placeholder="${escapeHTML(f.placeholder || "")}" />`
                        )
                    }
                </div>
            `;
        }).join("");

        const modal = createModalShell(
            title || (isNew ? "➕ Add New Record" : "✏️ Edit Record"),
            `
            ${fieldList.length > 8 ? `<input type="text" id="recFieldFilterInput" class="wcpp-input" placeholder="🔍 Filter attribute fields (e.g. latin, bloom, ph, salish, seed)..." style="position:sticky; top:0; z-index:2;" />` : ""}
            <div id="recFieldsContainer" style="display:flex; flex-direction:column; gap:12px;">${fieldsHtml}</div>
            `,
            `
            ${!isNew && typeof onDelete === "function" ? `<button type="button" class="wcpp-pill-btn danger" id="recDeleteBtn">🗑️ Delete Record</button>` : ""}
            <button type="button" class="wcpp-pill-btn" id="recCancelBtn">Cancel</button>
            <button type="button" class="wcpp-pill-btn primary" id="recSaveBtn">💾 ${isNew ? "Add Record" : "Save All Changes"}</button>
            `,
            true
        );

        const filterInput = modal.querySelector("#recFieldFilterInput");
        if (filterInput) {
            filterInput.addEventListener("input", () => {
                const q = filterInput.value.trim().toLowerCase();
                modal.querySelectorAll(".rec-modal-field").forEach(el => {
                    el.style.display = !q || el.getAttribute("data-search").includes(q) ? "flex" : "none";
                });
            });
        }

        modal.querySelector("#recCancelBtn").onclick = closeModal;

        const delBtn = modal.querySelector("#recDeleteBtn");
        if (delBtn && typeof onDelete === "function") {
            delBtn.onclick = async () => {
                if (!confirm("Remove this entry from the dataset? (You can restore default entries later in Data Studio.)")) return;
                const recId = rec[idField] || rec.id || rec.name || "";
                await deleteRecord(datasetKey, recId);
                closeModal();
                onDelete(recId);
                showAdminToast("🗑️ Entry removed.");
            };
        }

        modal.querySelector("#recSaveBtn").onclick = async () => {
            const updated = Object.assign({}, rec);
            modal.querySelectorAll("[data-key]").forEach(el => {
                updated[el.getAttribute("data-key")] = el.value;
            });
            if (isNew) {
                if (!updated[idField]) {
                    const seed = updated.Latin_Name || updated.Common_Name_Primary || updated.name || updated.Title || ("custom-" + Date.now());
                    updated[idField] = String(seed).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || ("item-" + Date.now());
                }
                await addRecord(datasetKey, updated);
            } else {
                const recId = updated[idField] || updated.id || updated.name || "";
                await savePatch(datasetKey, recId, updated);
            }
            closeModal();
            if (typeof onSave === "function") onSave(updated, isNew);
            showAdminToast(isNew ? "➕ Added new record!" : "💾 Record updated!");
        };
    }

    // =====================================================================
    // ADD ATTRIBUTE COLUMN MODAL
    // =====================================================================
    function openAddColumnModal({ datasetKey, onAdd }) {
        if (!isLoggedIn()) { openLoginModal(); return; }
        const modal = createModalShell(
            "➕ Add Custom Attribute Column",
            `
            <p class="wcpp-help-text" style="margin:0;">Add a new attribute row/column to this comparison matrix so you can track additional botanical, soil, or research fields.</p>
            <div class="wcpp-field-group">
                <label for="newColNameInput">Attribute / Column Name</label>
                <input type="text" id="newColNameInput" class="wcpp-input" placeholder="e.g. Salt_Spray_Notes or Winter_Hardiness_Trial" autofocus />
            </div>
            `,
            `
            <button type="button" class="wcpp-pill-btn" id="colCancelBtn">Cancel</button>
            <button type="button" class="wcpp-pill-btn primary" id="colAddBtn">➕ Add Attribute</button>
            `
        );
        modal.querySelector("#colCancelBtn").onclick = closeModal;
        modal.querySelector("#colAddBtn").onclick = async () => {
            const raw = modal.querySelector("#newColNameInput").value.trim();
            if (!raw) return;
            const colKey = raw.replace(/\s+/g, "_");
            await addColumn(datasetKey, colKey);
            closeModal();
            if (typeof onAdd === "function") onAdd(colKey);
            showAdminToast(`✓ Added column "${colKey}"`);
        };
    }

    // =====================================================================
    // EXPORT & DIRECT GITHUB PUBLISHING
    // =====================================================================
    function exportJSON(filename, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    }

    function exportCSV(filename, records, columns) {
        if (!records || !records.length) { showAdminToast("Nothing to export."); return; }
        const cols = columns && columns.length ? columns : Object.keys(records[0]).filter(k => !k.startsWith("_"));
        const esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
        let csv = "\uFEFF" + cols.map(esc).join(",") + "\n";
        records.forEach(r => { csv += cols.map(c => esc(r[c] || "")).join(",") + "\n"; });
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    }

    async function publishToGitHub(filePath, contentString, commitMessage) {
        const repo = localStorage.getItem(LS_GH_REPO) || "mwillis1989/plantplanner";
        const branch = localStorage.getItem(LS_GH_BRANCH) || "main";
        const token = getGhToken();
        if (!token) {
            throw new Error("No GitHub Token configured. Open Curator Settings to save a Personal Access Token, or use Download JSON.");
        }
        const cleanPath = filePath.replace(/^\/+/, "");
        const apiUrl = `https://api.github.com/repos/${repo}/contents/${cleanPath}`;
        const headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };

        let sha = null;
        const checkRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
        if (checkRes.ok) {
            const info = await checkRes.json();
            sha = info.sha;
        }

        // UTF-8 safe base64 encoding
        const utf8Bytes = new TextEncoder().encode(contentString);
        let binary = "";
        for (let i = 0; i < utf8Bytes.length; i += 0x8000) {
            binary += String.fromCharCode.apply(null, utf8Bytes.subarray(i, i + 0x8000));
        }
        const b64 = btoa(binary);

        const body = {
            message: commitMessage || `Curator update: ${cleanPath}`,
            content: b64,
            branch
        };
        if (sha) body.sha = sha;

        const putRes = await fetch(apiUrl, { method: "PUT", headers, body: JSON.stringify(body) });
        if (!putRes.ok) {
            const errData = await putRes.json().catch(() => ({}));
            throw new Error(errData.message || `GitHub API error (${putRes.status})`);
        }
        return await putRes.json();
    }

    const SITE_PUBLISH_FILES = [
        "header.html", "sidebar.html", "footer.html",
        "index.html", "orders.html", "articles.html", "nativeplants.html",
        "garden.html", "calendar.html", "calculators.html", "latin.html",
        "bios.html", "support.html", "admin.html", "plant-planner.html",
        "404.html", "robots.txt", "sitemap.xml",
        "plant-planner.css", "plant-planner-search.js",
        "css/site.css", "js/site.js", "js/admin.js",
        "data/orders_inventory.json", "manifest.json", "sw.js", "icon.svg"
    ];

    async function publishAllSiteFilesToGitHub(opts = {}) {
        const onProgress = typeof opts === "function" ? opts : (opts.onProgress || (() => {}));
        const repo = opts.repo || localStorage.getItem(LS_GH_REPO) || "mwillis1989/plantplanner";
        const branch = opts.branch || localStorage.getItem(LS_GH_BRANCH) || "main";
        const token = opts.token || getGhToken();
        if (!token) {
            throw new Error("No GitHub Token configured. Open Curator Settings to enter a Personal Access Token.");
        }

        const loaded = [];
        for (let i = 0; i < SITE_PUBLISH_FILES.length; i++) {
            const path = SITE_PUBLISH_FILES[i];
            onProgress(`Reading local file (${i + 1}/${SITE_PUBLISH_FILES.length}): ${path}`);
            const res = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
            if (!res.ok) {
                throw new Error(`Failed to load ${path} (HTTP ${res.status})`);
            }
            loaded.push({ path, content: await res.text() });
        }

        const headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };
        const commitMsg = "Add live inventory & pre-order badges, related articles, global search, and PWA support";

        try {
            onProgress("Fetching current GitHub branch state...");
            const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, { headers });
            if (!refRes.ok) {
                const err = await refRes.json().catch(() => ({}));
                throw new Error(err.message || `GitHub ref error (${refRes.status})`);
            }
            const refData = await refRes.json();
            const latestSha = refData.object.sha;

            const commitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits/${latestSha}`, { headers });
            if (!commitRes.ok) throw new Error(`GitHub commit error (${commitRes.status})`);
            const commitData = await commitRes.json();
            const baseTreeSha = commitData.tree.sha;

            onProgress(`Uploading ${loaded.length} files in one commit...`);
            const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    base_tree: baseTreeSha,
                    tree: loaded.map(f => ({
                        path: f.path,
                        mode: "100644",
                        type: "blob",
                        content: f.content
                    }))
                })
            });
            if (!treeRes.ok) {
                const err = await treeRes.json().catch(() => ({}));
                throw new Error(err.message || `GitHub tree error (${treeRes.status})`);
            }
            const treeData = await treeRes.json();

            const newCommitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    message: commitMsg,
                    tree: treeData.sha,
                    parents: [latestSha]
                })
            });
            if (!newCommitRes.ok) throw new Error(`GitHub commit create error (${newCommitRes.status})`);
            const newCommitData = await newCommitRes.json();

            const updateRefRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ sha: newCommitData.sha })
            });
            if (!updateRefRes.ok) throw new Error(`GitHub ref update error (${updateRefRes.status})`);
            return { count: loaded.length, commitSha: newCommitData.sha, mode: "atomic" };
        } catch (treeErr) {
            if (String(treeErr.message || "").includes("401") || String(treeErr.message || "").includes("Bad credentials")) {
                throw treeErr;
            }
            for (let i = 0; i < loaded.length; i++) {
                onProgress(`Uploading (${i + 1}/${loaded.length}): ${loaded[i].path}...`);
                await publishToGitHub(loaded[i].path, loaded[i].content, `${commitMsg} (${loaded[i].path})`);
            }
            return { count: loaded.length, mode: "sequential" };
        }
    }

    // =====================================================================
    // RESEARCHER CITATION GENERATOR (APA, BibTeX, RIS) & SCHEMA.ORG JSON-LD
    // =====================================================================
    function buildCitationStrings() {
        const now = new Date();
        const year = now.getFullYear();
        const isoDate = now.toISOString().slice(0, 10);
        const rawTitle = (document.title || "West Coast Plant Project Resource").replace(/\s*[–—|-]\s*West Coast Plant Project.*$/i, "").trim();
        const url = global.location.href;
        const slugKey = ("wcpp" + year + "_" + rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18));

        const apa = `West Coast Plant Project. (${year}). ${rawTitle} [Interactive botanical & horticultural dataset]. Retrieved ${isoDate}, from ${url}`;
        const bibtex = `@misc{${slugKey},\n  author = {{West Coast Plant Project}},\n  title = {${rawTitle}},\n  year = {${year}},\n  url = {${url}},\n  note = {Accessed: ${isoDate}; Surrey Royal Heights Seed & Book Library, British Columbia}\n}`;
        const ris = `TY  - DATA\nAU  - West Coast Plant Project\nPY  - ${year}\nTI  - ${rawTitle}\nPB  - West Coast Plant Project (Surrey Royal Heights Seed & Book Library)\nUR  - ${url}\nDA  - ${isoDate}\nER  - `;
        return { rawTitle, url, year, isoDate, apa, bibtex, ris };
    }

    function openCitationModal() {
        const c = buildCitationStrings();
        let activeFmt = "apa";

        const modal = createModalShell(
            "📖 Cite This Resource & Dataset",
            `
            <p class="wcpp-help-text" style="margin:0;">
                Ready-to-paste academic citations including your active URL query filters and species selection:
            </p>
            <div class="wcpp-tabs">
                <button type="button" class="wcpp-tab-btn active" data-fmt="apa">APA 7th</button>
                <button type="button" class="wcpp-tab-btn" data-fmt="bibtex">BibTeX</button>
                <button type="button" class="wcpp-tab-btn" data-fmt="ris">RIS (Zotero / EndNote)</button>
            </div>
            <pre class="wcpp-code-box" id="citationOutputBox">${escapeHTML(c.apa)}</pre>
            <div style="font-size:0.8rem; color:var(--wcpp-muted); background:var(--wcpp-bg); border:1px solid var(--wcpp-border); padding:10px 12px; border-radius:10px; line-height:1.45;">
                <strong>Data License &amp; Indigenous Knowledge Notice:</strong> Botanical &amp; agronomic compilations are shared under <strong>CC BY-NC-SA 4.0</strong>. Coast Salish (Hul’qumi’num, Halq̓eméylem, hən̓q̓əmin̓əm̓, SENĆOŦEN) and First Nations plant names represent Traditional Knowledge (TK) held by their respective Indigenous Nations and communities.
            </div>
            `,
            `
            <button type="button" class="wcpp-pill-btn" id="citDownloadRis">⬇ Download .ris</button>
            <button type="button" class="wcpp-pill-btn" id="citDownloadBib">⬇ Download .bib</button>
            <button type="button" class="wcpp-pill-btn primary" id="citCopyBtn">📋 Copy Citation</button>
            `
        );

        const outBox = modal.querySelector("#citationOutputBox");
        modal.querySelectorAll(".wcpp-tab-btn").forEach(btn => {
            btn.onclick = () => {
                activeFmt = btn.getAttribute("data-fmt");
                modal.querySelectorAll(".wcpp-tab-btn").forEach(b => b.classList.toggle("active", b === btn));
                outBox.textContent = c[activeFmt];
            };
        });

        modal.querySelector("#citCopyBtn").onclick = () => {
            navigator.clipboard.writeText(c[activeFmt]).then(() => showAdminToast("✓ Citation copied to clipboard!"));
            if (global.WCPPAnalytics) global.WCPPAnalytics.track("share", { method: "citation_" + activeFmt, content_type: "dataset", item_id: global.location.pathname });
        };
        modal.querySelector("#citDownloadRis").onclick = () => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([c.ris], { type: "application/x-research-info-systems;charset=utf-8" }));
            a.download = "plantproject-citation.ris";
            a.click();
            if (global.WCPPAnalytics) global.WCPPAnalytics.track("file_download", { file_name: "plantproject-citation.ris", file_extension: "ris" });
        };
        modal.querySelector("#citDownloadBib").onclick = () => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([c.bibtex], { type: "application/x-bibtex;charset=utf-8" }));
            a.download = "plantproject-citation.bib";
            a.click();
            if (global.WCPPAnalytics) global.WCPPAnalytics.track("file_download", { file_name: "plantproject-citation.bib", file_extension: "bib" });
        };
    }

    function injectSchemaOrgMetadata() {
        if (!document.head || document.getElementById("wcppSchemaJsonLd")) return;
        const robotsMeta = document.querySelector('meta[name="robots"]');
        if (robotsMeta && /noindex/i.test(robotsMeta.getAttribute("content") || "")) return;
        if (document.querySelector('script[type="application/ld+json"]')) return;

        const descMeta = document.querySelector('meta[name="description"]');
        const canonLink = document.querySelector('link[rel="canonical"]');
        const description = (descMeta && descMeta.getAttribute("content")) || "Open-source West Coast botanical, native plant, and garden planning resource hosted by the Surrey Royal Heights Seed & Book Library.";
        const canonicalUrl = (canonLink && canonLink.getAttribute("href")) || ("https://www.plantproject.ca" + global.location.pathname);

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "wcppSchemaJsonLd";
        const schema = {
            "@context": "https://schema.org",
            "@type": "Dataset",
            "name": document.title || "West Coast Plant Project",
            "description": description,
            "url": canonicalUrl,
            "isAccessibleForFree": true,
            "license": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
            "creator": {
                "@type": "Organization",
                "name": "West Coast Plant Project (Surrey Royal Heights Seed & Book Library)",
                "url": "https://www.plantproject.ca/"
            }
        };
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
    }

    // Initialize immediately
    const readyPromise = openDatabase().then(() => {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => { syncUIState(); injectSchemaOrgMetadata(); });
        } else {
            syncUIState();
            injectSchemaOrgMetadata();
        }
        global.dispatchEvent(new CustomEvent("wcpp:admin-ready"));
        return _overrides;
    });

    global.WCPPAdmin = {
        ready: readyPromise,
        isLoggedIn,
        logout,
        syncUIState,
        openLoginModal,
        openCellEditor,
        openRecordModal,
        openAddColumnModal,
        openCitationModal,
        applyOverrides,
        getOverrides: getBucket,
        savePatch,
        revertPatchField,
        addRecord,
        deleteRecord,
        addColumn,
        setFullReplace,
        clearDatasetOverrides,
        countDatasetChanges,
        countAllChanges,
        exportJSON,
        exportCSV,
        publishToGitHub,
        publishAllSiteFilesToGitHub,
        toast: showAdminToast,
        escapeHTML
    };
})(window);
