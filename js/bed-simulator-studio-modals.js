/* =========================================================================
   West Coast Plant Project (plantproject.ca)
   Garden Bed Designer — Lazy-Loaded Studio Modals Module (V5)
   - Custom Graph-Paper Bed Shape Designer (Pointer Events + Bezier Curves)
   - Container & Growing Media % Mix Builder
   - Interactive Plant Playground (Section Zoom/Pan, Export SVG, Print, Hydrozones)
   - Curated BC Starter Blueprints Gallery (Non-Destructive Plan Creation)
   ========================================================================= */
(function (global) {
    "use strict";

    const DEFAULT_MEDIA_INGREDIENT_COLORS = {
        "coco-coir": "#92400e",
        "peat-moss": "#78350f",
        "perlite": "#94a3b8",
        "vermiculite": "#d97706",
        "pumice": "#64748b",
        "compost": "#3f6212",
        "worm-castings": "#14532d",
        "pine-bark": "#b45309",
        "potting-soil": "#4d7c0f",
        "garden-loam": "#854d0e",
        "coarse-sand": "#ca8a04",
        "biochar": "#334155",
        "leaf-mold": "#15803d"
    };

    const FALLBACK_SVG_ICONS = {
        plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
        redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
        print: '<polyline points="6 9 6 3 18 3 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
        upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
        check: '<polyline points="20 6 9 17 4 12"/>',
        alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        spark: '<polygon points="12 2 14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5 12 2"/>',
        folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
        copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        mix: '<line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2"/>',
        trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
        layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'
    };

    let _shapeDesigner = null;
    let _containerModal = null;
    let _playground = null;
    let _blueprintsState = null;
    let _activeCtx = null;
    let _docPointerBound = false;
    let _pgPrintTimer = null;
    let _pgPrintAfterHandler = null;
    let _pgSuppressContextUntil = 0;
    let _shapeSuppressContextUntil = 0;

    // -------------------------------------------------------------------------
    // Context & Utility Adapters
    // -------------------------------------------------------------------------
    function rememberCtx(ctx) {
        if (ctx && typeof ctx === "object") {
            _activeCtx = ctx;
        }
        return _activeCtx || {};
    }

    function core(ctx) {
        if (ctx && typeof ctx.core === "function") return ctx.core();
        if (ctx && typeof ctx.getCore === "function") return ctx.getCore();
        return global.WCPPBedSimCore;
    }

    function getState(ctx) {
        return ctx && typeof ctx.getState === "function" ? ctx.getState() : null;
    }

    function setState(ctx, nextState) {
        if (ctx && typeof ctx.setState === "function") {
            ctx.setState(nextState);
        }
    }

    function getCatalog(ctx) {
        return ctx && typeof ctx.getCatalog === "function" ? ctx.getCatalog() : null;
    }

    function getModalMode(ctx) {
        return ctx && typeof ctx.getModalMode === "function" ? ctx.getModalMode() : null;
    }

    function setModalMode(ctx, mode) {
        if (ctx && typeof ctx.setModalMode === "function") {
            ctx.setModalMode(mode);
        }
    }

    function getSelectedBlockId(ctx) {
        return ctx && typeof ctx.getSelectedBlockId === "function" ? ctx.getSelectedBlockId() : null;
    }

    function setSelectedBlockId(ctx, id) {
        if (ctx && typeof ctx.setSelectedBlockId === "function") {
            ctx.setSelectedBlockId(id);
        }
    }

    function escHtml(ctx, val) {
        if (ctx && typeof ctx.escHtml === "function") return ctx.escHtml(val);
        return String(val === null || val === undefined ? "" : val)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function stripEmojis(ctx, text) {
        if (ctx && typeof ctx.stripEmojis === "function") return ctx.stripEmojis(text);
        return String(text || "")
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{2712}\u{2714}-\u{27BF}]/gu, "")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    function svgIcon(ctx, name, size) {
        if (ctx && typeof ctx.svgIcon === "function") return ctx.svgIcon(name, size);
        const s = size || 15;
        return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (FALLBACK_SVG_ICONS[name] || "") + "</svg>";
    }

    function showToast(ctx, msg) {
        if (ctx && typeof ctx.showToast === "function") {
            ctx.showToast(msg);
        }
    }

    function getTodayIso(ctx) {
        if (ctx && typeof ctx.getTodayIso === "function") return ctx.getTodayIso();
        const now = new Date();
        return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    }

    function getMediaColors(ctx) {
        return (ctx && ctx.MEDIA_INGREDIENT_COLORS) || DEFAULT_MEDIA_INGREDIENT_COLORS;
    }

    function isContainerBlock(ctx, block) {
        if (ctx && typeof ctx.isContainerBlock === "function") return ctx.isContainerBlock(block);
        const c = core(ctx);
        return Boolean(block && c && typeof c.isContainerBlockType === "function" && c.isContainerBlockType(block.type));
    }

    function getBlockTypeLabel(ctx, block) {
        if (ctx && typeof ctx.getBlockTypeLabel === "function") return ctx.getBlockTypeLabel(block);
        if (!block) return "Field Block";
        if (block.shapeType === "custom" && block.customShape) return "Custom Shape";
        if (block.type === "pot") return "Pot / Grow Bag";
        if (block.type === "basket") return "Hanging Basket";
        if (block.type === "bench") return "Growing Bench";
        if (block.type === "greenhouse") return "Greenhouse";
        return "Field Block";
    }

    function formatContainerSummaryBadge(ctx, block, units) {
        if (ctx && typeof ctx.formatContainerSummaryBadge === "function") {
            return ctx.formatContainerSummaryBadge(block, units);
        }
        const c = core(ctx);
        if (!isContainerBlock(ctx, block)) return "";
        const geom = c.computeContainerGeometry(block.containerSpec || block, block.type);
        const typeLbl = block.type === "basket" ? "Hanging Basket" : (block.type === "bench" ? "Bench" : "Pot");
        const isImp = units === "imperial";
        const volStr = Math.round(geom.volumeLiters) + " L";
        if (geom.shapeKind === "circle") {
            const diamStr = isImp ? (Math.round(geom.diameterCm / 2.54) + '"') : (Math.round(geom.diameterCm) + " cm");
            return typeLbl + " \u00b7 " + diamStr + " \u00b7 " + volStr;
        }
        if (block.type === "bench") {
            const dimStr = isImp
                ? (c.mToFt(geom.lengthCm / 100) + "\u00d7" + c.mToFt(geom.widthCm / 100) + " ft")
                : (Math.round(geom.lengthCm) + "\u00d7" + Math.round(geom.widthCm) + " cm");
            return typeLbl + " \u00b7 " + dimStr + " \u00b7 " + volStr;
        }
        const dimStr = isImp
            ? (c.cmToIn(geom.lengthCm) + "\u00d7" + c.cmToIn(geom.widthCm) + '"')
            : (Math.round(geom.lengthCm) + "\u00d7" + Math.round(geom.widthCm) + " cm");
        return typeLbl + " \u00b7 " + dimStr + " \u00b7 " + volStr;
    }

    function formatBedSizeSummary(ctx, block, units) {
        if (ctx && typeof ctx.formatBedSizeSummary === "function") {
            return ctx.formatBedSizeSummary(block, units);
        }
        const c = core(ctx);
        if (isContainerBlock(ctx, block)) {
            const geom = c.computeContainerGeometry(block.containerSpec || block, block.type);
            const isImp = units === "imperial";
            const areaDisp = isImp ? (geom.surfaceAreaFt2 + " ft\u00b2") : (geom.surfaceAreaM2 + " m\u00b2");
            const volDisp = geom.volumeLiters + " L (" + geom.volumeGallons + " gal)";
            const depthDisp = isImp ? (c.cmToIn(geom.depthCm) + '" H') : (Math.round(geom.depthCm) + " cm H");
            if (geom.shapeKind === "circle") {
                const diamDisp = isImp ? (c.cmToIn(geom.diameterCm) + '" \u00d8') : (Math.round(geom.diameterCm) + " cm \u00d8");
                return diamDisp + " \u00d7 " + depthDisp + " \u00b7 " + volDisp + " \u00b7 " + areaDisp;
            }
            const lDisp = block.type === "bench"
                ? (isImp ? (c.mToFt(geom.lengthCm / 100) + " ft") : (Math.round(geom.lengthCm) + " cm"))
                : (isImp ? (c.cmToIn(geom.lengthCm) + '"') : (Math.round(geom.lengthCm) + " cm"));
            const wDisp = block.type === "bench"
                ? (isImp ? (c.mToFt(geom.widthCm / 100) + " ft") : (Math.round(geom.widthCm) + " cm"))
                : (isImp ? (c.cmToIn(geom.widthCm) + '"') : (Math.round(geom.widthCm) + " cm"));
            return lDisp + " \u00d7 " + wDisp + " \u00d7 " + depthDisp + " \u00b7 " + volDisp;
        }
        if (block && block.shapeType === "custom" && block.customShape) {
            const geom = typeof c.computeCustomShapeGeometry === "function" ? c.computeCustomShapeGeometry(block.customShape) : null;
            const areaM2 = geom ? geom.areaM2 : Number(block.areaM2 || 0);
            const areaStr = units === "imperial"
                ? ((geom ? geom.areaFt2 : +(areaM2 * 10.7639).toFixed(2)) + " ft\u00b2")
                : (areaM2 + " m\u00b2");
            const lenM = geom ? geom.widthCm / 100 : Number(block.bedLengthM || 1);
            const widCm = geom ? geom.heightCm : Number(block.bedWidthCm || 75);
            const l = units === "imperial" ? (c.mToFt(lenM) + " ft") : (Number(lenM).toFixed(1).replace(/\.0$/, "") + " m");
            const w = units === "imperial" ? (c.cmToIn(widCm) + " in") : (Math.round(widCm) + " cm");
            return "Custom \u00b7 " + areaStr + " (" + l + " \u00d7 " + w + ")";
        }
        const w = units === "imperial" ? (c.cmToIn(block.bedWidthCm) + " in") : (Math.round(block.bedWidthCm) + " cm");
        const l = units === "imperial" ? (c.mToFt(block.bedLengthM) + " ft") : (Number(block.bedLengthM).toFixed(1).replace(/\.0$/, "") + " m");
        return block.bedCount + " bed" + (block.bedCount === 1 ? "" : "s") + " \u00b7 " + l + " \u00d7 " + w;
    }

    function clientToSvgCoords(ctx, svg, clientX, clientY, defaultVb) {
        if (ctx && typeof ctx.clientToSvgCoords === "function") {
            return ctx.clientToSvgCoords(svg, clientX, clientY, defaultVb);
        }
        if (!svg) return null;
        try {
            if (typeof svg.getScreenCTM === "function" && typeof svg.createSVGPoint === "function") {
                const ctm = svg.getScreenCTM();
                if (ctm) {
                    const pt = svg.createSVGPoint();
                    pt.x = clientX;
                    pt.y = clientY;
                    const local = pt.matrixTransform(ctm.inverse());
                    if (Number.isFinite(local.x) && Number.isFinite(local.y)) {
                        return { x: local.x, y: local.y };
                    }
                }
            }
        } catch (_) {}
        const rect = svg.getBoundingClientRect();
        const vb = (svg.getAttribute("viewBox") || defaultVb || "0 0 400 300").split(/\s+/).map(Number);
        if (!rect || rect.width <= 0 || rect.height <= 0 || vb.length !== 4 || !(vb[2] > 0) || !(vb[3] > 0)) return null;
        const scale = Math.min(rect.width / vb[2], rect.height / vb[3]);
        const drawW = vb[2] * scale;
        const drawH = vb[3] * scale;
        const offX = (rect.width - drawW) / 2;
        const offY = (rect.height - drawH) / 2;
        return {
            x: vb[0] + ((clientX - rect.left - offX) / drawW) * vb[2],
            y: vb[1] + ((clientY - rect.top - offY) / drawH) * vb[3]
        };
    }

    function cleanupPlaygroundPrintSheet() {
        if (_pgPrintTimer) {
            clearTimeout(_pgPrintTimer);
            _pgPrintTimer = null;
        }
        if (_pgPrintAfterHandler) {
            global.removeEventListener("afterprint", _pgPrintAfterHandler);
            _pgPrintAfterHandler = null;
        }
        if (document.body) {
            document.body.classList.remove("wcpp-bs-print-sheet-active");
        }
        const existing = document.getElementById("wcppBsPrintSheet");
        if (existing) existing.remove();
    }

    function resetState() {
        cleanupPlaygroundPrintSheet();
        _shapeDesigner = null;
        _containerModal = null;
        _playground = null;
        _blueprintsState = null;
        _pgSuppressContextUntil = 0;
        _shapeSuppressContextUntil = 0;
    }

    function formatAxisMeasurement(ctx, cmVal, axisUnit) {
        const u = (axisUnit === "ft" || axisUnit === "cm" || axisUnit === "m") ? axisUnit : "m";
        if (ctx && typeof ctx.formatAxisMeasurement === "function") {
            return ctx.formatAxisMeasurement(cmVal, u);
        }
        const c = core(ctx);
        if (c && typeof c.formatAxisMeasurement === "function") {
            return c.formatAxisMeasurement(cmVal, u);
        }
        const v = Number(cmVal) || 0;
        if (u === "cm") {
            return Math.round(v) + " cm";
        }
        if (u === "ft") {
            const ft = v / 30.48;
            const roundedInt = Math.round(ft);
            if (Math.abs(ft - roundedInt) < 0.06) return roundedInt + " ft";
            return ft.toFixed(1).replace(/\.0$/, "") + " ft";
        }
        const m = v / 100;
        const mInt = Math.round(m);
        if (Math.abs(m - mInt) < 0.005) return mInt + " m";
        return m.toFixed(2).replace(/\.?0+$/, "") + " m";
    }

    function getDefaultPlaygroundGridCm(ctx, block) {
        if (ctx && typeof ctx.getDefaultPlaygroundGridCm === "function") {
            return Number(ctx.getDefaultPlaygroundGridCm(block)) || 30;
        }
        const c = core(ctx);
        if (c && typeof c.getDefaultPlaygroundGridCm === "function") {
            return Number(c.getDefaultPlaygroundGridCm(block)) || 30;
        }
        if (!block || !c || typeof c.getPlaygroundBounds !== "function") return 30;
        const bounds = c.getPlaygroundBounds(block);
        const maxDim = Math.max(Number(bounds && bounds.widthCm) || 0, Number(bounds && bounds.heightCm) || 0);
        if ((isContainerBlock(ctx, block) && block.type !== "bench") || maxDim <= 85) return 10;
        if (maxDim <= 350) return 30;
        if (maxDim <= 1200) return 50;
        return 100;
    }

    // =========================================================================
    // 1. CUSTOM GRAPH-PAPER BED SHAPE DESIGNER
    // =========================================================================
    function cloneShapePoints(pts) {
        return (pts || []).map(function (pt) {
            return {
                x: Number(pt.x),
                y: Number(pt.y),
                curve: pt.curve ? { cx: Number(pt.curve.cx), cy: Number(pt.curve.cy) } : null
            };
        });
    }

    function openShapeDesigner(ctx, opts) {
        rememberCtx(ctx);
        const c = core(ctx);
        const state = getState(ctx);
        const options = opts || {};
        const season = state ? c.getActiveSeason(state) : null;
        let baseShape = null;
        const editingBlockId = options.blockId || null;
        const editingShapeId = options.shapeId || null;
        const activeTemplateId = options.templateId || "rectangle";

        if (options.shape) {
            baseShape = typeof c.validateAndNormalizeCustomShape === "function"
                ? c.validateAndNormalizeCustomShape(options.shape)
                : null;
        }
        if (!baseShape && editingBlockId && season) {
            const blk = (season.blocks || []).find(function (b) { return b.id === editingBlockId; });
            if (blk && blk.customShape) {
                baseShape = c.validateAndNormalizeCustomShape(blk.customShape);
            }
        }
        if (!baseShape && editingShapeId && typeof c.listCustomShapes === "function") {
            const found = c.listCustomShapes().find(function (s) { return s.id === editingShapeId; });
            if (found) baseShape = found;
        }
        if (!baseShape && typeof c.createCustomShapeTemplate === "function") {
            baseShape = c.createCustomShapeTemplate(activeTemplateId, { units: state ? state.units : "metric" });
        }

        const isImp = state && state.units === "imperial";
        const defaultSnap = isImp ? 15.24 : 10;

        _shapeDesigner = {
            editingBlockId: editingBlockId,
            editingShapeId: editingShapeId || (baseShape && baseShape.id) || null,
            shapeId: (baseShape && baseShape.id) || ("shape_" + Date.now()),
            name: (baseShape && baseShape.name) || "Custom Bed Shape",
            points: cloneShapePoints(baseShape ? baseShape.points : []),
            snapStepCm: defaultSnap,
            tool: "reshape",
            activeTemplateId: options.shape || options.blockId || options.shapeId ? "" : activeTemplateId,
            selectedVertexIdx: 0,
            selectedEdgeIdx: null,
            undoStack: [],
            redoStack: [],
            drag: null,
            dragViewBox: null
        };
        setModalMode(ctx, "shape");
        if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
        ensureStudioPointerListeners(ctx);
        return Promise.resolve();
    }

    function snapShapeCoord(valCm) {
        if (!_shapeDesigner || !_shapeDesigner.snapStepCm || _shapeDesigner.snapStepCm <= 0) {
            return +(Number(valCm).toFixed(1));
        }
        const step = _shapeDesigner.snapStepCm;
        return +(Math.round(Number(valCm) / step) * step).toFixed(2);
    }

    function pushShapeUndo() {
        if (!_shapeDesigner) return;
        _shapeDesigner.undoStack.push({
            points: cloneShapePoints(_shapeDesigner.points),
            name: _shapeDesigner.name
        });
        if (_shapeDesigner.undoStack.length > 40) _shapeDesigner.undoStack.shift();
        _shapeDesigner.redoStack = [];
    }

    function undoShapeDesigner(ctx) {
        if (!_shapeDesigner || !_shapeDesigner.undoStack.length) return;
        _shapeDesigner.redoStack.push({
            points: cloneShapePoints(_shapeDesigner.points),
            name: _shapeDesigner.name
        });
        const prev = _shapeDesigner.undoStack.pop();
        _shapeDesigner.points = cloneShapePoints(prev.points);
        _shapeDesigner.name = prev.name || _shapeDesigner.name;
        _shapeDesigner.activeTemplateId = "";
        syncShapeDesignerInPlace(ctx, false);
        const ni = document.getElementById("wcppBsShapeNameInput");
        if (ni) ni.value = _shapeDesigner.name;
    }

    function redoShapeDesigner(ctx) {
        if (!_shapeDesigner || !_shapeDesigner.redoStack.length) return;
        _shapeDesigner.undoStack.push({
            points: cloneShapePoints(_shapeDesigner.points),
            name: _shapeDesigner.name
        });
        const next = _shapeDesigner.redoStack.pop();
        _shapeDesigner.points = cloneShapePoints(next.points);
        _shapeDesigner.name = next.name || _shapeDesigner.name;
        _shapeDesigner.activeTemplateId = "";
        syncShapeDesignerInPlace(ctx, false);
        const ni = document.getElementById("wcppBsShapeNameInput");
        if (ni) ni.value = _shapeDesigner.name;
    }

    function computeShapeDesignerViewBox(geom) {
        if (_shapeDesigner && _shapeDesigner.dragViewBox) {
            return _shapeDesigner.dragViewBox;
        }
        const g = geom || { minX: 0, minY: 0, maxX: 240, maxY: 120, widthCm: 240, heightCm: 120 };
        const maxSpan = Math.max(120, g.widthCm || 240, g.heightCm || 120);
        const padLeft = Math.max(54, Math.round(maxSpan * 0.24));
        const padTop = Math.max(54, Math.round(maxSpan * 0.24));
        const padRight = Math.max(48, Math.round(maxSpan * 0.22));
        const padBottom = Math.max(48, Math.round(maxSpan * 0.22));
        const vx = Math.floor((g.minX - padLeft) / 25) * 25;
        const vy = Math.floor((g.minY - padTop) / 25) * 25;
        const vw = Math.max(320, Math.ceil((g.maxX + padRight - vx) / 25) * 25);
        const vh = Math.max(240, Math.ceil((g.maxY + padBottom - vy) / 25) * 25);
        return { x: vx, y: vy, w: vw, h: vh };
    }

    function formatShapeRulerLabel(cmVal, isImp) {
        if (isImp) {
            const inches = Math.round(cmVal / 2.54);
            if (inches !== 0 && inches % 12 === 0) return (inches / 12) + "'";
            return inches + '"';
        }
        const rounded = Math.round(cmVal);
        if (Math.abs(rounded) >= 100 && rounded % 100 === 0) return (rounded / 100) + "m";
        return String(rounded);
    }

    function formatShapeEdgeLabel(ctx, cmLen, isImp) {
        const c = core(ctx);
        if (isImp) return c.formatSpacing(cmLen, "imperial");
        if (cmLen >= 100) return (cmLen / 100).toFixed(2).replace(/\.?0+$/, "") + " m";
        return Math.round(cmLen) + " cm";
    }

    function buildShapeBlueprintInnerSvg(ctx, geom, vb) {
        const state = getState(ctx);
        const pts = (_shapeDesigner && _shapeDesigner.points) || [];
        const isImp = state && state.units === "imperial";
        const uScale = Math.max(0.35, vb.w / 620);
        const maxSpan = Math.max(vb.w, vb.h);
        const minorStep = isImp ? 15.24 : (maxSpan > 620 ? 25 : 10);
        const majorStep = isImp ? 30.48 : (maxSpan > 620 ? 100 : 50);

        let gridSvg = "";
        const startGx = Math.ceil(vb.x / minorStep) * minorStep;
        for (let gx = startGx; gx <= vb.x + vb.w; gx += minorStep) {
            const isMaj = Math.abs(gx / majorStep - Math.round(gx / majorStep)) < 0.01;
            gridSvg += '<line x1="' + gx.toFixed(2) + '" y1="' + vb.y + '" x2="' + gx.toFixed(2) + '" y2="' + (vb.y + vb.h) + '" stroke="' + (isMaj ? "#cbd5e1" : "#e2e8f0") + '" stroke-width="' + (isMaj ? "1.1" : "0.65") + '" vector-effect="non-scaling-stroke"/>';
        }
        const startGy = Math.ceil(vb.y / minorStep) * minorStep;
        for (let gy = startGy; gy <= vb.y + vb.h; gy += minorStep) {
            const isMaj = Math.abs(gy / majorStep - Math.round(gy / majorStep)) < 0.01;
            gridSvg += '<line x1="' + vb.x + '" y1="' + gy.toFixed(2) + '" x2="' + (vb.x + vb.w) + '" y2="' + gy.toFixed(2) + '" stroke="' + (isMaj ? "#cbd5e1" : "#e2e8f0") + '" stroke-width="' + (isMaj ? "1.1" : "0.65") + '" vector-effect="non-scaling-stroke"/>';
        }

        const rulerTopH = 19 * uScale;
        const rulerLeftW = 28 * uScale;
        let rulersSvg = '<rect x="' + vb.x + '" y="' + vb.y + '" width="' + vb.w + '" height="' + rulerTopH.toFixed(2) + '" fill="#f1f5f9"/>' +
            '<rect x="' + vb.x + '" y="' + vb.y + '" width="' + rulerLeftW.toFixed(2) + '" height="' + vb.h + '" fill="#f1f5f9"/>';
        const rStartX = Math.ceil((vb.x + rulerLeftW) / majorStep) * majorStep;
        for (let rx = rStartX; rx <= vb.x + vb.w - 10 * uScale; rx += majorStep) {
            rulersSvg += '<line x1="' + rx.toFixed(2) + '" y1="' + (vb.y + rulerTopH - 5 * uScale).toFixed(2) + '" x2="' + rx.toFixed(2) + '" y2="' + (vb.y + rulerTopH).toFixed(2) + '" stroke="#94a3b8" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
                '<text x="' + rx.toFixed(2) + '" y="' + (vb.y + 12 * uScale).toFixed(2) + '" text-anchor="middle" font-size="' + (9 * uScale).toFixed(2) + '" font-weight="700" fill="#475569">' + escHtml(ctx, formatShapeRulerLabel(rx, isImp)) + "</text>";
        }
        const rStartY = Math.ceil((vb.y + rulerTopH) / majorStep) * majorStep;
        for (let ry = rStartY; ry <= vb.y + vb.h - 8 * uScale; ry += majorStep) {
            rulersSvg += '<line x1="' + (vb.x + rulerLeftW - 5 * uScale).toFixed(2) + '" y1="' + ry.toFixed(2) + '" x2="' + (vb.x + rulerLeftW).toFixed(2) + '" y2="' + ry.toFixed(2) + '" stroke="#94a3b8" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
                '<text x="' + (vb.x + 14 * uScale).toFixed(2) + '" y="' + (ry + 3 * uScale).toFixed(2) + '" text-anchor="middle" font-size="' + (8.5 * uScale).toFixed(2) + '" font-weight="700" fill="#475569">' + escHtml(ctx, formatShapeRulerLabel(ry, isImp)) + "</text>";
        }

        const shapePath = geom && geom.pathD
            ? '<path d="' + escHtml(ctx, geom.pathD) + '" fill="#ecfdf5" fill-opacity="0.88" stroke="#166534" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'
            : "";

        let guidesSvg = "";
        let edgeLabelsSvg = "";
        let angleLabelsSvg = "";
        let hitEdgesSvg = "";
        let pinchHandlesSvg = "";
        let vertexHandlesSvg = "";

        const n = pts.length;
        const edges = (geom && geom.edges) || [];
        const angles = (geom && geom.anglesDeg) || [];
        const gcx = geom ? geom.cx : 120;
        const gcy = geom ? geom.cy : 60;

        for (let i = 0; i < n; i++) {
            const p0 = pts[i];
            const p1 = pts[(i + 1) % n];
            const edge = edges[i];
            const lenLbl = edge ? formatShapeEdgeLabel(ctx, edge.lengthCm, isImp) : "";
            const isEdgeSel = _shapeDesigner && _shapeDesigner.selectedEdgeIdx === i;

            const hitD = p0.curve
                ? ("M " + p0.x.toFixed(2) + "," + p0.y.toFixed(2) + " Q " + p0.curve.cx.toFixed(2) + "," + p0.curve.cy.toFixed(2) + " " + p1.x.toFixed(2) + "," + p1.y.toFixed(2))
                : ("M " + p0.x.toFixed(2) + "," + p0.y.toFixed(2) + " L " + p1.x.toFixed(2) + "," + p1.y.toFixed(2));
            hitEdgesSvg += '<path d="' + hitD + '" fill="none" stroke="transparent" stroke-width="' + (16 * uScale).toFixed(1) + '" vector-effect="non-scaling-stroke" data-edge-idx="' + i + '" style="cursor:pointer;"/>';

            if (edge) {
                if (edge.isCurved && p0.curve) {
                    const chordMidX = (p0.x + p1.x) / 2;
                    const chordMidY = (p0.y + p1.y) / 2;
                    guidesSvg += '<line x1="' + chordMidX.toFixed(2) + '" y1="' + chordMidY.toFixed(2) + '" x2="' + edge.midX.toFixed(2) + '" y2="' + edge.midY.toFixed(2) + '" stroke="#0f766e" stroke-width="1.2" stroke-dasharray="3 3" stroke-opacity="0.6" vector-effect="non-scaling-stroke"/>';
                }

                let outX = edge.midX - gcx;
                let outY = edge.midY - gcy;
                const mag = Math.hypot(outX, outY) || 1;
                outX /= mag;
                outY /= mag;
                const lx = edge.midX + outX * 15 * uScale;
                const ly = edge.midY + outY * 15 * uScale;
                edgeLabelsSvg += '<text x="' + lx.toFixed(2) + '" y="' + ly.toFixed(2) + '" text-anchor="middle" font-size="' + (9.5 * uScale).toFixed(2) + '" font-weight="800" fill="' + (edge.isCurved ? "#0f766e" : "#166534") + '">' + escHtml(ctx, lenLbl) + "</text>";

                const pr = 6.5 * uScale;
                const mx = edge.midX;
                const my = edge.midY;
                const dPts = [
                    mx.toFixed(2) + "," + (my - pr).toFixed(2),
                    (mx + pr).toFixed(2) + "," + my.toFixed(2),
                    mx.toFixed(2) + "," + (my + pr).toFixed(2),
                    (mx - pr).toFixed(2) + "," + my.toFixed(2)
                ].join(" ");
                pinchHandlesSvg += '<polygon class="wcpp-bs-pinch-handle' + (edge.isCurved ? " is-curved" : "") + (isEdgeSel ? " is-active" : "") + '" data-pinch-idx="' + i + '" points="' + dPts + '" vector-effect="non-scaling-stroke">' +
                    "<title>Edge " + (i + 1) + ": " + escHtml(ctx, lenLbl) + (edge.isCurved ? " (curved \u2014 double-click to straighten)" : " (drag in or out to bend curve)") + "</title>" +
                "</polygon>";
            }

            const isVSel = _shapeDesigner && _shapeDesigner.selectedVertexIdx === i;
            if (angles[i] !== undefined) {
                let vxOff = p0.x - gcx;
                let vyOff = p0.y - gcy;
                const vMag = Math.hypot(vxOff, vyOff) || 1;
                vxOff /= vMag;
                vyOff /= vMag;
                const ax = p0.x + vxOff * 16 * uScale;
                const ay = p0.y + vyOff * 16 * uScale;
                angleLabelsSvg += '<text x="' + ax.toFixed(2) + '" y="' + ay.toFixed(2) + '" text-anchor="middle" font-size="' + (9 * uScale).toFixed(2) + '" font-weight="' + (isVSel ? "800" : "700") + '" fill="' + (isVSel ? "#0f172a" : "#475569") + '">' + angles[i] + "\u00b0</text>";
            }
            const vr = 6.8 * uScale;
            vertexHandlesSvg += '<circle class="wcpp-bs-vertex-handle' + (isVSel ? " is-active" : "") + '" data-vertex-idx="' + i + '" cx="' + p0.x.toFixed(2) + '" cy="' + p0.y.toFixed(2) + '" r="' + vr.toFixed(2) + '" vector-effect="non-scaling-stroke">' +
                "<title>Corner " + (i + 1) + (angles[i] !== undefined ? (" (" + angles[i] + "\u00b0)") : "") + " \u2014 drag to reshape</title>" +
            "</circle>";
        }

        return '<rect x="' + vb.x + '" y="' + vb.y + '" width="' + vb.w + '" height="' + vb.h + '" fill="#ffffff"/>' +
            gridSvg +
            rulersSvg +
            shapePath +
            guidesSvg +
            hitEdgesSvg +
            edgeLabelsSvg +
            angleLabelsSvg +
            pinchHandlesSvg +
            vertexHandlesSvg;
    }

    function getNormalizedShapeFromDesigner(ctx) {
        if (!_shapeDesigner) return null;
        const c = core(ctx);
        const state = getState(ctx);
        const nameInp = document.getElementById("wcppBsShapeNameInput");
        if (nameInp && nameInp.value.trim()) {
            _shapeDesigner.name = nameInp.value.trim();
        }
        return c.validateAndNormalizeCustomShape({
            id: _shapeDesigner.shapeId,
            name: _shapeDesigner.name || "Custom Bed Shape",
            units: state ? state.units : "metric",
            gridStepCm: Math.round(_shapeDesigner.snapStepCm) || 25,
            points: _shapeDesigner.points
        });
    }

    function formatShapeTitleMetrics(ctx, geom) {
        const c = core(ctx);
        const state = getState(ctx);
        const isImp = state && state.units === "imperial";
        if (!geom) {
            return { area: "--", perim: "--", bounds: "--", selection: "--" };
        }
        const area = isImp
            ? (geom.areaFt2 + " ft\u00b2 (" + geom.areaM2 + " m\u00b2)")
            : (geom.areaM2 + " m\u00b2 (" + geom.areaFt2 + " ft\u00b2)");
        const perim = isImp
            ? (geom.perimeterFt + " ft (" + geom.perimeterM + " m)")
            : (geom.perimeterM + " m (" + geom.perimeterFt + " ft)");
        const bounds = isImp
            ? (c.mToFt(geom.widthCm / 100) + " ft \u00d7 " + c.mToFt(geom.heightCm / 100) + " ft")
            : (Math.round(geom.widthCm) + " \u00d7 " + Math.round(geom.heightCm) + " cm");

        let selText = (_shapeDesigner.points || []).length + " corners";
        if (_shapeDesigner.selectedEdgeIdx !== null && geom.edges[_shapeDesigner.selectedEdgeIdx]) {
            const ed = geom.edges[_shapeDesigner.selectedEdgeIdx];
            selText = "Edge " + (_shapeDesigner.selectedEdgeIdx + 1) + ": " + formatShapeEdgeLabel(ctx, ed.lengthCm, isImp) + (ed.isCurved ? " (Curved)" : " (Straight)");
        } else if (_shapeDesigner.selectedVertexIdx !== null && geom.anglesDeg[_shapeDesigner.selectedVertexIdx] !== undefined) {
            selText = "Corner " + (_shapeDesigner.selectedVertexIdx + 1) + ": " + geom.anglesDeg[_shapeDesigner.selectedVertexIdx] + "\u00b0";
        }
        return { area: area, perim: perim, bounds: bounds, selection: selText };
    }

    function syncShapeDesignerInPlace(ctx, keepViewBox) {
        if (!_shapeDesigner) return;
        const c = core(ctx);
        const geom = c.computeCustomShapeGeometry({ points: _shapeDesigner.points });
        const svg = document.getElementById("wcppBsShapeCanvasSvg");
        if (svg && geom) {
            const vb = keepViewBox && _shapeDesigner.dragViewBox
                ? _shapeDesigner.dragViewBox
                : computeShapeDesignerViewBox(geom);
            if (!keepViewBox) {
                svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.w + " " + vb.h);
            }
            svg.innerHTML = buildShapeBlueprintInnerSvg(ctx, geom, vb);
        }
        const m = formatShapeTitleMetrics(ctx, geom);
        const areaEl = document.getElementById("wcppBsShapeAreaVal");
        const perimEl = document.getElementById("wcppBsShapePerimVal");
        const boundsEl = document.getElementById("wcppBsShapeBoundsVal");
        const selEl = document.getElementById("wcppBsShapeSelectionVal");
        if (areaEl) areaEl.textContent = m.area;
        if (perimEl) perimEl.textContent = m.perim;
        if (boundsEl) boundsEl.textContent = m.bounds;
        if (selEl) selEl.textContent = m.selection;

        const undoBtn = document.querySelector('#wcppBsModalBackdrop [data-action="shape-undo"]');
        const redoBtn = document.querySelector('#wcppBsModalBackdrop [data-action="shape-redo"]');
        const straightBtn = document.querySelector('#wcppBsModalBackdrop [data-action="shape-straighten-edge"]');
        if (undoBtn) undoBtn.disabled = _shapeDesigner.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = _shapeDesigner.redoStack.length === 0;
        if (straightBtn) {
            const hasCurved = (_shapeDesigner.points || []).some(function (pt) { return Boolean(pt.curve); });
            straightBtn.disabled = !hasCurved;
        }
    }

    function renderShapeModalHtml(ctx) {
        rememberCtx(ctx);
        if (!_shapeDesigner) return "";
        const c = core(ctx);
        const state = getState(ctx);
        const isImp = state && state.units === "imperial";
        const geom = c.computeCustomShapeGeometry({ points: _shapeDesigner.points });
        const vb = computeShapeDesignerViewBox(geom);
        const metrics = formatShapeTitleMetrics(ctx, geom);
        const templates = c.CUSTOM_SHAPE_TEMPLATES || [];
        const hasAnyCurve = (_shapeDesigner.points || []).some(function (pt) { return Boolean(pt.curve); });

        const templateBtns = templates.map(function (tpl) {
            const active = _shapeDesigner.activeTemplateId === tpl.id;
            return '<button type="button" class="wcpp-bs-shape-template-btn' + (active ? " is-active" : "") + '" data-action="shape-load-template" data-template-id="' + escHtml(ctx, tpl.id) + '" title="' + escHtml(ctx, tpl.description || tpl.name) + '">' +
                escHtml(ctx, tpl.name) +
            "</button>";
        }).join("");

        const snapChoices = isImp
            ? [{ val: 15.24, label: '6"' }, { val: 30.48, label: "1 ft" }, { val: 0, label: "Free" }]
            : [{ val: 10, label: "10 cm" }, { val: 25, label: "25 cm" }, { val: 50, label: "50 cm" }, { val: 0, label: "Free" }];

        const snapBtns = snapChoices.map(function (sc) {
            const active = Math.abs(Number(_shapeDesigner.snapStepCm || 0) - sc.val) < 0.1;
            return '<button type="button" class="wcpp-bs-seg-btn' + (active ? " is-active" : "") + '" data-action="shape-set-snap" data-snap="' + sc.val + '">' + escHtml(ctx, sc.label) + "</button>";
        }).join("");

        const toolBtns = [
            { id: "reshape", label: "Reshape" },
            { id: "add", label: "Add Corner" },
            { id: "remove", label: "Remove Corner" }
        ].map(function (tl) {
            const active = _shapeDesigner.tool === tl.id;
            return '<button type="button" class="wcpp-bs-seg-btn' + (active ? " is-active" : "") + '" data-action="shape-set-tool" data-tool="' + tl.id + '">' + escHtml(ctx, tl.label) + "</button>";
        }).join("");

        return '<div class="wcpp-bs-modal is-wide wcpp-bs-shape-modal">' +
            '<div class="wcpp-bs-modal-header">' +
                "<h2>Custom Bed Shape Designer</h2>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7 Close</button>' +
            "</div>" +
            '<div class="wcpp-bs-modal-body" style="gap:10px;">' +
                '<div class="wcpp-bs-shape-templates" style="flex-shrink:0;" role="group" aria-label="Starter Bed Templates">' +
                    '<span style="font-size:0.77rem; font-weight:800; color:var(--bs-muted); margin-right:4px;">Templates:</span>' +
                    templateBtns +
                "</div>" +
                '<div class="wcpp-bs-shape-toolbar" style="flex-shrink:0;">' +
                    '<div class="wcpp-bs-toolbar-group">' +
                        '<div class="wcpp-bs-segmented" role="group" aria-label="Shape Editing Tool">' + toolBtns + "</div>" +
                        '<div class="wcpp-bs-segmented" role="group" aria-label="Snap to Grid">' + snapBtns + "</div>" +
                    "</div>" +
                    '<div class="wcpp-bs-toolbar-group">' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="shape-undo"' + (_shapeDesigner.undoStack.length ? "" : " disabled") + ">" + svgIcon(ctx, "undo", 12) + "<span>Undo</span></button>" +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="shape-redo"' + (_shapeDesigner.redoStack.length ? "" : " disabled") + ">" + svgIcon(ctx, "redo", 12) + "<span>Redo</span></button>" +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="shape-flip-h">Flip H</button>' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="shape-rotate-90">Rotate 90\u00b0</button>' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="shape-straighten-edge"' + (hasAnyCurve ? "" : " disabled") + ">Straighten Edge</button>" +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-blueprint-wrap" style="flex-shrink:0;">' +
                    '<svg id="wcppBsShapeCanvasSvg" class="wcpp-bs-blueprint-svg" style="height:360px;max-height:48vh;" viewBox="' + vb.x + " " + vb.y + " " + vb.w + " " + vb.h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Interactive architectural graph-paper bed blueprint">' +
                        buildShapeBlueprintInnerSvg(ctx, geom, vb) +
                    "</svg>" +
                "</div>" +
                '<div id="wcppBsShapeHint" class="wcpp-bs-pg-hint' + (_shapeDesigner.tool === "add" ? " is-drop-active" : "") + '" style="flex-shrink:0;">' +
                    (_shapeDesigner.tool === "add"
                        ? "Left-click on any edge to place a new corner \u00b7 Right-click to stop placing and return to Reshape"
                        : (_shapeDesigner.tool === "remove"
                            ? "Left-click any corner handle to remove it \u00b7 Right-click to return to Reshape"
                            : "Drag circular corners to reshape angles; drag diamond edge handles inward or outward to bend arcs (double-click to straighten).")) +
                "</div>" +
                '<div class="wcpp-bs-titleblock" style="flex-shrink:0;">' +
                    '<div class="wcpp-bs-field"><label>Bed Shape Name</label><input class="wcpp-bs-input" id="wcppBsShapeNameInput" type="text" value="' + escHtml(ctx, _shapeDesigner.name) + '" placeholder="e.g. Sun Crescent Bed"></div>' +
                    '<div><strong style="display:block; font-size:0.72rem; color:var(--bs-muted); text-transform:uppercase;">Area</strong><span id="wcppBsShapeAreaVal" style="font-weight:800;">' + escHtml(ctx, metrics.area) + "</span></div>" +
                    '<div><strong style="display:block; font-size:0.72rem; color:var(--bs-muted); text-transform:uppercase;">Perimeter</strong><span id="wcppBsShapePerimVal" style="font-weight:800;">' + escHtml(ctx, metrics.perim) + "</span></div>" +
                    '<div><strong style="display:block; font-size:0.72rem; color:var(--bs-muted); text-transform:uppercase;">Width \u00d7 Depth</strong><span id="wcppBsShapeBoundsVal" style="font-weight:800;">' + escHtml(ctx, metrics.bounds) + "</span></div>" +
                    '<div><strong style="display:block; font-size:0.72rem; color:var(--bs-muted); text-transform:uppercase;">Selection</strong><span id="wcppBsShapeSelectionVal" style="font-weight:800;">' + escHtml(ctx, metrics.selection) + "</span></div>" +
                "</div>" +
                '<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="shape-save-library">' + svgIcon(ctx, "folder", 13) + "<span>Save Shape to Library</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="shape-export-json">' + svgIcon(ctx, "download", 13) + "<span>Download Shape File (.wcpp-shape.json)</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="shape-export-svg">' + svgIcon(ctx, "download", 13) + "<span>Export Blueprint (.svg)</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="shape-import-json">' + svgIcon(ctx, "upload", 13) + "<span>Upload Shape File (.json)</span></button>" +
                    '<input type="file" id="wcppBsShapeModalFileInput" accept=".json,.wcpp-shape.json,application/json" hidden>' +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-modal-footer">' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-secondary" data-action="close-modal">Cancel</button>' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary" data-action="shape-apply-to-garden">' + (_shapeDesigner.editingBlockId ? "Update Bed Shape" : "Add Shape to Garden") + "</button>" +
            "</div>" +
        "</div>";
    }

    function clientToShapeSvgCoords(ctx, svg, clientX, clientY) {
        return clientToSvgCoords(ctx, svg, clientX, clientY, "0 0 400 300");
    }

    function insertCornerOnShape(ctx, svgX, svgY, preferredEdgeIdx) {
        if (!_shapeDesigner) return;
        const pts = _shapeDesigner.points;
        if (pts.length >= 40) {
            showToast(ctx, "Maximum 40 corners per bed shape.");
            return;
        }
        const n = pts.length;
        let bestIdx = Number.isFinite(preferredEdgeIdx) ? preferredEdgeIdx : 0;
        if (!Number.isFinite(preferredEdgeIdx)) {
            let bestDist = Infinity;
            for (let i = 0; i < n; i++) {
                const a = pts[i];
                const b = pts[(i + 1) % n];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const lenSq = dx * dx + dy * dy;
                const t = lenSq > 1e-6 ? Math.max(0, Math.min(1, ((svgX - a.x) * dx + (svgY - a.y) * dy) / lenSq)) : 0;
                const px = a.x + t * dx;
                const py = a.y + t * dy;
                const d = Math.hypot(svgX - px, svgY - py);
                if (d < bestDist) {
                    bestDist = d;
                    bestIdx = i;
                }
            }
        }
        pushShapeUndo();
        const nx = snapShapeCoord(svgX);
        const ny = snapShapeCoord(svgY);
        pts[bestIdx].curve = null;
        pts.splice(bestIdx + 1, 0, { x: nx, y: ny, curve: null });
        _shapeDesigner.selectedVertexIdx = bestIdx + 1;
        _shapeDesigner.selectedEdgeIdx = null;
        _shapeDesigner.activeTemplateId = "";
        syncShapeDesignerInPlace(ctx, false);
    }

    function removeCornerFromShape(ctx, vertexIdx) {
        if (!_shapeDesigner) return;
        const pts = _shapeDesigner.points;
        if (pts.length <= 3) {
            showToast(ctx, "A bed shape requires at least 3 corners.");
            return;
        }
        const idx = Math.max(0, Math.min(pts.length - 1, Number(vertexIdx)));
        pushShapeUndo();
        const prevIdx = (idx - 1 + pts.length) % pts.length;
        pts[prevIdx].curve = null;
        pts.splice(idx, 1);
        _shapeDesigner.selectedVertexIdx = Math.min(idx, pts.length - 1);
        _shapeDesigner.selectedEdgeIdx = null;
        _shapeDesigner.activeTemplateId = "";
        syncShapeDesignerInPlace(ctx, false);
    }

    function handleShapeModalClick(ctx, act, actEl, backdrop) {
        rememberCtx(ctx);
        if (!_shapeDesigner) return false;
        const c = core(ctx);
        const state = getState(ctx);
        if (act === "close-modal") {
            if (ctx && typeof ctx.closeModal === "function") ctx.closeModal();
            return true;
        }
        if (act === "shape-load-template") {
            const tid = actEl.getAttribute("data-template-id");
            const tpl = typeof c.createCustomShapeTemplate === "function"
                ? c.createCustomShapeTemplate(tid, { units: state ? state.units : "metric", id: _shapeDesigner.shapeId })
                : null;
            if (tpl) {
                pushShapeUndo();
                _shapeDesigner.points = cloneShapePoints(tpl.points);
                if (!_shapeDesigner.editingBlockId) _shapeDesigner.name = tpl.name;
                _shapeDesigner.activeTemplateId = tid;
                _shapeDesigner.selectedVertexIdx = 0;
                _shapeDesigner.selectedEdgeIdx = null;
                if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
            }
            return true;
        }
        if (act === "shape-set-tool") {
            _shapeDesigner.tool = actEl.getAttribute("data-tool") || "reshape";
            if (backdrop) {
                backdrop.querySelectorAll('[data-action="shape-set-tool"]').forEach(function (btn) {
                    btn.classList.toggle("is-active", btn.getAttribute("data-tool") === _shapeDesigner.tool);
                });
            }
            const shHint = document.getElementById("wcppBsShapeHint");
            if (shHint) {
                shHint.classList.toggle("is-drop-active", _shapeDesigner.tool === "add");
                shHint.textContent = _shapeDesigner.tool === "add"
                    ? "Left-click on any edge to place a new corner \u00b7 Right-click to stop placing and return to Reshape"
                    : (_shapeDesigner.tool === "remove"
                        ? "Left-click any corner handle to remove it \u00b7 Right-click to return to Reshape"
                        : "Drag circular corners to reshape angles; drag diamond edge handles inward or outward to bend arcs (double-click to straighten).");
            }
            return true;
        }
        if (act === "shape-set-snap") {
            _shapeDesigner.snapStepCm = Number(actEl.getAttribute("data-snap") || 0);
            if (backdrop) {
                backdrop.querySelectorAll('[data-action="shape-set-snap"]').forEach(function (btn) {
                    btn.classList.toggle("is-active", Math.abs(Number(btn.getAttribute("data-snap") || 0) - _shapeDesigner.snapStepCm) < 0.1);
                });
            }
            return true;
        }
        if (act === "shape-undo") {
            undoShapeDesigner(ctx);
            return true;
        }
        if (act === "shape-redo") {
            redoShapeDesigner(ctx);
            return true;
        }
        if (act === "shape-flip-h") {
            const geom = c.computeCustomShapeGeometry({ points: _shapeDesigner.points });
            if (geom) {
                const midX = (geom.minX + geom.maxX) / 2;
                pushShapeUndo();
                _shapeDesigner.points.forEach(function (pt) {
                    pt.x = +(2 * midX - pt.x).toFixed(2);
                    if (pt.curve) pt.curve.cx = +(2 * midX - pt.curve.cx).toFixed(2);
                });
                _shapeDesigner.activeTemplateId = "";
                syncShapeDesignerInPlace(ctx, false);
            }
            return true;
        }
        if (act === "shape-rotate-90") {
            const geom = c.computeCustomShapeGeometry({ points: _shapeDesigner.points });
            if (geom) {
                const cx = (geom.minX + geom.maxX) / 2;
                const cy = (geom.minY + geom.maxY) / 2;
                pushShapeUndo();
                _shapeDesigner.points.forEach(function (pt) {
                    const nx = cx - (pt.y - cy);
                    const ny = cy + (pt.x - cx);
                    pt.x = +nx.toFixed(2);
                    pt.y = +ny.toFixed(2);
                    if (pt.curve) {
                        const ncx = cx - (pt.curve.cy - cy);
                        const ncy = cy + (pt.curve.cx - cx);
                        pt.curve.cx = +ncx.toFixed(2);
                        pt.curve.cy = +ncy.toFixed(2);
                    }
                });
                _shapeDesigner.activeTemplateId = "";
                syncShapeDesignerInPlace(ctx, false);
            }
            return true;
        }
        if (act === "shape-straighten-edge") {
            const pts = _shapeDesigner.points;
            const selE = _shapeDesigner.selectedEdgeIdx;
            if (selE !== null && pts[selE] && pts[selE].curve) {
                pushShapeUndo();
                pts[selE].curve = null;
                syncShapeDesignerInPlace(ctx, false);
                showToast(ctx, "Straightened edge " + (selE + 1) + ".");
            } else if (pts.some(function (pt) { return Boolean(pt.curve); })) {
                pushShapeUndo();
                pts.forEach(function (pt) { pt.curve = null; });
                syncShapeDesignerInPlace(ctx, false);
                showToast(ctx, "Straightened all curved edges.");
            }
            return true;
        }
        if (act === "shape-save-library") {
            const norm = getNormalizedShapeFromDesigner(ctx);
            if (!norm) {
                showToast(ctx, "Shape requires at least 3 valid corners and non-zero area.");
                return true;
            }
            const saved = c.saveCustomShape(norm);
            if (saved) {
                _shapeDesigner.shapeId = saved.id;
                _shapeDesigner.editingShapeId = saved.id;
                if (ctx && typeof ctx.getMode === "function" && ctx.getMode() === "simulator" && typeof ctx.renderSimulator === "function") {
                    ctx.renderSimulator();
                }
                showToast(ctx, "Saved shape to library: " + saved.name);
            }
            return true;
        }
        if (act === "shape-export-json") {
            const norm = getNormalizedShapeFromDesigner(ctx);
            const json = norm ? c.exportCustomShapeJson(norm) : "";
            if (json) {
                const slug = (norm.name || "custom-bed").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-bed";
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                a.download = slug + ".wcpp-shape.json";
                a.click();
                showToast(ctx, "Downloaded " + a.download);
            }
            return true;
        }
        if (act === "shape-export-svg") {
            const norm = getNormalizedShapeFromDesigner(ctx);
            const svgStr = norm ? c.exportCustomShapeSvg(norm) : "";
            if (svgStr) {
                const slug = (norm.name || "custom-bed").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-bed";
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }));
                a.download = slug + "-blueprint.svg";
                a.click();
                showToast(ctx, "Exported blueprint SVG.");
            }
            return true;
        }
        if (act === "shape-import-json") {
            const inp = document.getElementById("wcppBsShapeModalFileInput");
            if (inp) inp.click();
            return true;
        }
        if (act === "shape-apply-to-garden") {
            const norm = getNormalizedShapeFromDesigner(ctx);
            if (!norm) {
                showToast(ctx, "Shape requires at least 3 valid corners and non-zero area.");
                return true;
            }
            const season = state ? c.getActiveSeason(state) : null;
            if (!season) return true;
            const editBid = _shapeDesigner.editingBlockId;
            if (ctx && typeof ctx.commitStateChange === "function") {
                ctx.commitStateChange(function (st) {
                    const s = c.getActiveSeason(st);
                    if (!s) return;
                    if (editBid) {
                        const idx = s.blocks.findIndex(function (b) { return b.id === editBid; });
                        if (idx >= 0) {
                            const prev = s.blocks[idx];
                            const updated = c.createCustomShapeBlock(norm, {
                                id: prev.id,
                                name: norm.name,
                                type: prev.type,
                                pathWidthCm: prev.pathWidthCm,
                                angleDeg: prev.angleDeg,
                                beginningYear: prev.beginningYear,
                                isFallow: prev.isFallow,
                                x: prev.x,
                                y: prev.y
                            });
                            if (updated) s.blocks[idx] = updated;
                            setSelectedBlockId(ctx, editBid);
                        }
                    } else {
                        const count = (s.blocks || []).length;
                        const nb = c.createCustomShapeBlock(norm, {
                            beginningYear: s.year,
                            x: 40 + (count % 2) * 320,
                            y: 40 + Math.floor(count / 2) * 200
                        });
                        if (nb) {
                            s.blocks.push(nb);
                            setSelectedBlockId(ctx, nb.id);
                        }
                    }
                });
            }
            if (ctx && typeof ctx.closeModal === "function") ctx.closeModal();
            if (ctx && typeof ctx.setSubTab === "function") ctx.setSubTab("farm-layout");
            if (ctx && typeof ctx.getMode === "function" && ctx.getMode() !== "simulator" && typeof ctx.switchMode === "function") {
                ctx.switchMode("simulator");
            } else if (ctx && typeof ctx.renderSimulator === "function") {
                ctx.renderSimulator();
            }
            showToast(ctx, editBid ? ("Updated bed shape: " + norm.name) : ("Added custom bed to garden: " + norm.name));
            return true;
        }
        return false;
    }

    function handleShapeModalDblClick(ctx, e) {
        rememberCtx(ctx);
        if (!_shapeDesigner) return false;
        const pinch = e && e.target && e.target.closest ? e.target.closest("[data-pinch-idx]") : null;
        if (!pinch) return false;
        const idx = Number(pinch.getAttribute("data-pinch-idx"));
        if (_shapeDesigner.points[idx] && _shapeDesigner.points[idx].curve) {
            pushShapeUndo();
            _shapeDesigner.points[idx].curve = null;
            _shapeDesigner.selectedEdgeIdx = idx;
            _shapeDesigner.selectedVertexIdx = null;
            syncShapeDesignerInPlace(ctx, false);
            showToast(ctx, "Straightened edge " + (idx + 1) + ".");
            return true;
        }
        return false;
    }

    function handleShapeModalInput(ctx, t) {
        rememberCtx(ctx);
        if (!_shapeDesigner || !t) return false;
        if (t.id === "wcppBsShapeNameInput") {
            _shapeDesigner.name = t.value;
            return true;
        }
        return false;
    }

    function handleShapeModalChange(ctx, t) {
        rememberCtx(ctx);
        if (!_shapeDesigner || !t) return false;
        const c = core(ctx);
        if (t.id === "wcppBsShapeModalFileInput" && t.files && t.files[0]) {
            const reader = new FileReader();
            reader.onload = function () {
                const imported = typeof c.importCustomShapeJson === "function"
                    ? c.importCustomShapeJson(String(reader.result || ""))
                    : null;
                if (!imported) {
                    showToast(ctx, "Import failed: Invalid custom bed shape JSON.");
                    return;
                }
                pushShapeUndo();
                _shapeDesigner.points = cloneShapePoints(imported.points);
                _shapeDesigner.name = imported.name;
                _shapeDesigner.shapeId = imported.id;
                _shapeDesigner.activeTemplateId = "";
                _shapeDesigner.selectedVertexIdx = 0;
                _shapeDesigner.selectedEdgeIdx = null;
                if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
                showToast(ctx, "Loaded shape file: " + imported.name);
            };
            reader.readAsText(t.files[0]);
            return true;
        }
        return false;
    }

    function exitShapeToolToReshape(ctx) {
        if (!_shapeDesigner || _shapeDesigner.tool === "reshape") return false;
        const prevTool = _shapeDesigner.tool;
        _shapeDesigner.tool = "reshape";
        const bd = document.getElementById("wcppBsModalBackdrop");
        if (bd) {
            bd.querySelectorAll('[data-action="shape-set-tool"]').forEach(function (btn) {
                btn.classList.toggle("is-active", btn.getAttribute("data-tool") === "reshape");
            });
        }
        const shHint = document.getElementById("wcppBsShapeHint");
        if (shHint) {
            shHint.classList.remove("is-drop-active");
            shHint.textContent = "Drag circular corners to reshape angles; drag diamond edge handles inward or outward to bend arcs (double-click to straighten).";
        }
        showToast(ctx, prevTool === "add" ? "Exited Add Corner mode \u2014 now in Reshape" : "Exited Remove Corner mode \u2014 now in Reshape");
        return true;
    }

    function onShapePointerDown(ctx, e) {
        rememberCtx(ctx);
        if (!_shapeDesigner) return false;
        const svg = e.target && e.target.closest ? e.target.closest("#wcppBsShapeCanvasSvg") : null;
        if (!svg) return false;
        if (e.button === 2) {
            if (_shapeDesigner.tool === "add" || _shapeDesigner.tool === "remove") {
                e.preventDefault();
                _shapeSuppressContextUntil = Date.now() + 500;
                exitShapeToolToReshape(ctx);
                return true;
            }
            return false;
        }
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return false;
        const c = core(ctx);
        const vEl = e.target.closest("[data-vertex-idx]");
        const pEl = e.target.closest("[data-pinch-idx]");
        const eEl = e.target.closest("[data-edge-idx]");

        if (_shapeDesigner.tool === "remove") {
            if (vEl) {
                e.preventDefault();
                removeCornerFromShape(ctx, Number(vEl.getAttribute("data-vertex-idx")));
            }
            return true;
        }
        if (_shapeDesigner.tool === "add") {
            const coords = clientToShapeSvgCoords(ctx, svg, e.clientX, e.clientY);
            if (coords) {
                e.preventDefault();
                const prefEdge = eEl ? Number(eEl.getAttribute("data-edge-idx")) : (pEl ? Number(pEl.getAttribute("data-pinch-idx")) : undefined);
                insertCornerOnShape(ctx, coords.x, coords.y, prefEdge);
            }
            return true;
        }

        if (vEl) {
            e.preventDefault();
            const idx = Number(vEl.getAttribute("data-vertex-idx"));
            _shapeDesigner.dragViewBox = computeShapeDesignerViewBox(c.computeCustomShapeGeometry({ points: _shapeDesigner.points }));
            _shapeDesigner.selectedVertexIdx = idx;
            _shapeDesigner.selectedEdgeIdx = null;
            _shapeDesigner.drag = { type: "vertex", idx: idx, pointerId: e.pointerId, didMove: false };
            try { svg.setPointerCapture(e.pointerId); } catch (_) {}
            syncShapeDesignerInPlace(ctx, true);
            return true;
        }
        if (pEl) {
            e.preventDefault();
            const idx = Number(pEl.getAttribute("data-pinch-idx"));
            _shapeDesigner.dragViewBox = computeShapeDesignerViewBox(c.computeCustomShapeGeometry({ points: _shapeDesigner.points }));
            _shapeDesigner.selectedEdgeIdx = idx;
            _shapeDesigner.selectedVertexIdx = null;
            _shapeDesigner.drag = { type: "pinch", idx: idx, pointerId: e.pointerId, didMove: false };
            try { svg.setPointerCapture(e.pointerId); } catch (_) {}
            syncShapeDesignerInPlace(ctx, true);
            return true;
        }
        if (eEl) {
            const idx = Number(eEl.getAttribute("data-edge-idx"));
            _shapeDesigner.selectedEdgeIdx = idx;
            _shapeDesigner.selectedVertexIdx = null;
            syncShapeDesignerInPlace(ctx, false);
            return true;
        }
        return false;
    }

    function onShapePointerMove(ctx, e) {
        if (!_shapeDesigner || !_shapeDesigner.drag) return false;
        const svg = document.getElementById("wcppBsShapeCanvasSvg");
        const coords = clientToShapeSvgCoords(ctx, svg, e.clientX, e.clientY);
        if (!coords) return false;
        const drag = _shapeDesigner.drag;
        const pts = _shapeDesigner.points;
        if (!drag.didMove) {
            pushShapeUndo();
            drag.didMove = true;
        }
        if (drag.type === "vertex" && pts[drag.idx]) {
            const pt = pts[drag.idx];
            const nx = Math.max(-2000, Math.min(8000, snapShapeCoord(coords.x)));
            const ny = Math.max(-2000, Math.min(8000, snapShapeCoord(coords.y)));
            const dx = nx - pt.x;
            const dy = ny - pt.y;
            pt.x = nx;
            pt.y = ny;
            if (pt.curve) {
                pt.curve.cx = +(pt.curve.cx + dx * 0.5).toFixed(2);
                pt.curve.cy = +(pt.curve.cy + dy * 0.5).toFixed(2);
            }
            const prevIdx = (drag.idx - 1 + pts.length) % pts.length;
            if (pts[prevIdx] && pts[prevIdx].curve) {
                pts[prevIdx].curve.cx = +(pts[prevIdx].curve.cx + dx * 0.5).toFixed(2);
                pts[prevIdx].curve.cy = +(pts[prevIdx].curve.cy + dy * 0.5).toFixed(2);
            }
            _shapeDesigner.activeTemplateId = "";
            syncShapeDesignerInPlace(ctx, true);
            return true;
        }
        if (drag.type === "pinch" && pts[drag.idx]) {
            const p0 = pts[drag.idx];
            const p1 = pts[(drag.idx + 1) % pts.length];
            const mx = snapShapeCoord(coords.x);
            const my = snapShapeCoord(coords.y);
            p0.curve = {
                cx: +(2 * mx - 0.5 * (p0.x + p1.x)).toFixed(2),
                cy: +(2 * my - 0.5 * (p0.y + p1.y)).toFixed(2)
            };
            _shapeDesigner.activeTemplateId = "";
            syncShapeDesignerInPlace(ctx, true);
            return true;
        }
        return false;
    }

    function endShapeDrag(ctx) {
        if (!_shapeDesigner || !_shapeDesigner.drag) return false;
        const svg = document.getElementById("wcppBsShapeCanvasSvg");
        try {
            if (svg && _shapeDesigner.drag.pointerId !== undefined) {
                svg.releasePointerCapture(_shapeDesigner.drag.pointerId);
            }
        } catch (_) {}
        _shapeDesigner.drag = null;
        _shapeDesigner.dragViewBox = null;
        syncShapeDesignerInPlace(ctx, false);
        return true;
    }

    // =========================================================================
    // 2. CONTAINER & GROWING MEDIA % MIX BUILDER MODAL
    // =========================================================================
    function formatContainerDimVal(cmVal, dimUnit) {
        const v = Number(cmVal);
        if (!Number.isFinite(v) || v <= 0) return "";
        if (dimUnit === "in") return +(v / 2.54).toFixed(1);
        return +v.toFixed(1);
    }

    function parseContainerDimToCm(rawVal, dimUnit) {
        const v = Number(rawVal);
        if (!Number.isFinite(v) || v <= 0) return null;
        return dimUnit === "in" ? +(v * 2.54).toFixed(2) : +v.toFixed(2);
    }

    function getSeasonCropsForBlock(season, blockId) {
        if (!season || !blockId) return [];
        const names = [];
        const seen = new Set();
        (season.placedPlants || []).forEach(function (pp) {
            if (pp && pp.blockId === blockId && pp.cropName && !seen.has(pp.cropName)) {
                seen.add(pp.cropName);
                names.push(pp.cropName);
            }
        });
        (season.plantings || []).forEach(function (p) {
            if (p && p.blockId === blockId && p.bedStart && p.cropName && !seen.has(p.cropName)) {
                seen.add(p.cropName);
                names.push(p.cropName);
            }
        });
        return names;
    }

    function getContainerModalGeometryAndAnalysis(ctx) {
        const c = core(ctx);
        const state = getState(ctx);
        const cm = _containerModal;
        const season = state ? c.getActiveSeason(state) : null;
        const cropsInBlock = cm && cm.editingBlockId ? getSeasonCropsForBlock(season, cm.editingBlockId) : [];
        let geom;
        if (cm.isNonContainerBed && cm.editingBlockId && season) {
            const blk = (season.blocks || []).find(function (b) { return b.id === cm.editingBlockId; });
            const bounds = c.getPlaygroundBounds(blk || {});
            const depthCm = Math.max(5, Math.min(200, Number(cm.depthCm) || 25));
            const volL = +((bounds.areaM2 * 10000 * depthCm) / 1000).toFixed(1);
            geom = {
                presetId: null,
                blockType: cm.blockType,
                shapeKind: bounds.shapeKind,
                diameterCm: null,
                widthCm: bounds.heightCm,
                lengthCm: bounds.widthCm,
                depthCm: depthCm,
                bowlFactor: 1.0,
                surfaceAreaM2: bounds.areaM2,
                surfaceAreaFt2: bounds.areaFt2,
                volumeLiters: volL,
                volumeGallons: +(volL / 3.785411784).toFixed(2)
            };
        } else {
            geom = c.computeContainerGeometry({
                presetId: cm.presetId,
                shapeKind: cm.shapeKind,
                diameterCm: cm.diameterCm,
                widthCm: cm.widthCm,
                lengthCm: cm.lengthCm,
                depthCm: cm.depthCm,
                bowlFactor: cm.bowlFactor
            }, cm.blockType);
        }
        const mediaObj = {
            presetId: cm.mediaPresetId,
            name: cm.mediaName,
            ingredients: cm.ingredients
        };
        const analysis = c.analyzeGrowingMedia(mediaObj, cm.blockType, cropsInBlock, geom.volumeLiters);
        return { geom: geom, analysis: analysis, cropsInBlock: cropsInBlock };
    }

    function openContainerModal(ctx, opts) {
        rememberCtx(ctx);
        const c = core(ctx);
        const state = getState(ctx);
        const options = opts || {};
        const season = state ? c.getActiveSeason(state) : null;
        const editingBlockId = options.blockId || null;
        const existingBlk = editingBlockId && season
            ? (season.blocks || []).find(function (b) { return b.id === editingBlockId; })
            : null;
        const isNonContainerBed = Boolean(existingBlk && !isContainerBlock(ctx, existingBlk));
        const presets = c.CONTAINER_PRESETS || [];
        const dimUnit = (state && state.units === "imperial") ? "in" : "cm";

        let blockType = existingBlk
            ? (existingBlk.type || "field")
            : (options.blockType && c.isContainerBlockType(options.blockType) ? options.blockType : "pot");
        let presetObj = options.presetId
            ? presets.find(function (p) { return p.id === options.presetId; })
            : null;
        if (!presetObj && !existingBlk) {
            presetObj = presets.find(function (p) { return p.blockType === blockType; }) || presets[1] || presets[0];
        }

        let name = "";
        let presetId = null;
        let shapeKind = "circle";
        let diameterCm = 30.48;
        let widthCm = 30.48;
        let lengthCm = 30.48;
        let depthCm = 25;
        let bowlFactor = blockType === "basket" ? 0.85 : 1.0;
        let normMedia;

        if (existingBlk) {
            name = existingBlk.name || getBlockTypeLabel(ctx, existingBlk);
            if (isNonContainerBed) {
                const bounds = c.getPlaygroundBounds(existingBlk);
                shapeKind = bounds.shapeKind;
                widthCm = bounds.heightCm;
                lengthCm = bounds.widthCm;
                depthCm = (existingBlk.containerSpec && Number(existingBlk.containerSpec.depthCm)) || 25;
            } else {
                const geom = c.computeContainerGeometry(existingBlk.containerSpec || existingBlk, blockType);
                presetId = geom.presetId || null;
                shapeKind = geom.shapeKind;
                diameterCm = geom.diameterCm || 30.48;
                widthCm = geom.widthCm || 30.48;
                lengthCm = geom.lengthCm || 75;
                depthCm = geom.depthCm || 25;
                bowlFactor = geom.bowlFactor || (blockType === "basket" ? 0.85 : 1.0);
            }
            normMedia = c.normalizeGrowingMedia(existingBlk.growingMedia, blockType);
        } else {
            const p = presetObj || presets[0];
            blockType = p.blockType || blockType;
            name = p.name || "Container";
            presetId = p.id;
            shapeKind = p.shapeKind || "circle";
            diameterCm = p.diameterCm || 30.48;
            widthCm = p.widthCm || 30.48;
            lengthCm = p.lengthCm || 30.48;
            depthCm = p.depthCm || 25;
            bowlFactor = p.bowlFactor || (blockType === "basket" ? 0.85 : 1.0);
            normMedia = c.normalizeGrowingMedia(p.defaultMediaPreset, blockType);
        }

        _containerModal = {
            editingBlockId: editingBlockId,
            isNonContainerBed: isNonContainerBed,
            blockType: blockType,
            name: name,
            dimUnit: dimUnit,
            presetId: presetId,
            shapeKind: shapeKind,
            diameterCm: diameterCm,
            widthCm: widthCm,
            lengthCm: lengthCm,
            depthCm: depthCm,
            bowlFactor: bowlFactor,
            mediaPresetId: normMedia.presetId || "custom",
            mediaName: normMedia.name || "Growing Media Mix",
            ingredients: (normMedia.ingredients || []).map(function (it) {
                return { id: it.id, pct: Number(it.pct) || 0 };
            }),
            mediaDirty: Boolean(existingBlk && existingBlk.growingMedia),
            nameDirty: Boolean(existingBlk),
            returnToPlayground: Boolean(options.returnToPlayground),
            returnBedNumber: Math.max(1, Math.round(Number(options.bedNumber) || 1))
        };
        setModalMode(ctx, "container");
        if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
        return Promise.resolve();
    }

    function renderContainerMeterHtml(ctx, analysis) {
        const cm = _containerModal;
        if (!cm || !analysis) return "";
        const totalPct = analysis.totalPct;
        const balanced = analysis.isBalanced;
        const c = core(ctx);
        const colors = getMediaColors(ctx);
        const labelMap = new Map((c.GROWING_MEDIA_INGREDIENTS || []).map(function (ing) { return [ing.id, ing.label]; }));
        const segsHtml = (cm.ingredients || []).map(function (it) {
            const pct = Math.max(0, Number(it.pct) || 0);
            if (pct <= 0) return "";
            const widthPct = totalPct > 0 ? Math.min(100, (pct / Math.max(100, totalPct)) * 100) : 0;
            const col = colors[it.id] || "#166534";
            return '<div class="wcpp-bs-media-meter-seg" style="width:' + widthPct.toFixed(1) + "%;background:" + col + ';" title="' + escHtml(ctx, (labelMap.get(it.id) || it.id) + ": " + pct + "%") + '"></div>';
        }).join("");

        return '<div class="wcpp-bs-media-meter ' + (balanced ? "is-balanced" : "is-unbalanced") + '">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                "<span>Mix Total: " + totalPct + "% " + (balanced ? "(Balanced 100%)" : "(Target 100%)") + "</span>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="media-auto-balance">Auto-Balance 100%</button>' +
            "</div>" +
            '<div class="wcpp-bs-media-meter-bar" role="progressbar" aria-valuenow="' + Math.min(100, Math.round(totalPct)) + '" aria-valuemin="0" aria-valuemax="100">' +
                segsHtml +
            "</div>" +
        "</div>";
    }

    function renderContainerDiagnosticsHtml(ctx, analysis, cropsInBlock) {
        if (!analysis) return "";
        const warningsHtml = (analysis.warnings || []).map(function (w) {
            return '<div class="wcpp-bs-media-warning is-warn">' + svgIcon(ctx, "alert", 13) + " " + escHtml(ctx, w) + "</div>";
        }).join("");
        const fitNotes = Array.isArray(analysis.cropFitNotes) ? analysis.cropFitNotes.slice() : [];
        if (analysis.fertilityNote && fitNotes.indexOf(analysis.fertilityNote) === -1) {
            fitNotes.unshift(analysis.fertilityNote);
        }
        const fitHtml = fitNotes.map(function (n) {
            return '<div class="wcpp-bs-media-warning is-ok">' + svgIcon(ctx, "check", 13) + " " + escHtml(ctx, n) + "</div>";
        }).join("");
        const fertilityStatVal = analysis.fertilityLabel
            ? (escHtml(ctx, analysis.fertilityLabel) + " (" + analysis.nutrientScore + " / 100)")
            : (analysis.nutrientScore + " / 100");

        return '<div class="wcpp-bs-media-diagnostics">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                "<strong>Growing Media Diagnostics</strong>" +
                '<span class="wcpp-bs-badge">' + escHtml(ctx, analysis.drainageLabel) + " \u00b7 " + escHtml(ctx, analysis.weightRating) + "</span>" +
            "</div>" +
            '<div class="wcpp-bs-media-stat-grid">' +
                '<div class="wcpp-bs-media-stat-card"><span style="font-size:0.72rem; color:var(--bs-muted); font-weight:700;">Aeration</span><strong>' + analysis.aerationScore + " / 100</strong></div>" +
                '<div class="wcpp-bs-media-stat-card"><span style="font-size:0.72rem; color:var(--bs-muted); font-weight:700;">Water Retention</span><strong>' + analysis.retentionScore + " / 100</strong></div>" +
                '<div class="wcpp-bs-media-stat-card"><span style="font-size:0.72rem; color:var(--bs-muted); font-weight:700;">Nutrition</span><strong>' + fertilityStatVal + "</strong></div>" +
                '<div class="wcpp-bs-media-stat-card"><span style="font-size:0.72rem; color:var(--bs-muted); font-weight:700;">Weight</span><strong>' + escHtml(ctx, analysis.weightRating) + " (" + analysis.weightScore + ")</strong></div>" +
            "</div>" +
            warningsHtml +
            fitHtml +
            (!warningsHtml && !fitHtml
                ? ('<div class="wcpp-bs-media-warning is-ok">' + svgIcon(ctx, "check", 13) + " Mix ratios are balanced for " + (cropsInBlock && cropsInBlock.length ? escHtml(ctx, cropsInBlock.slice(0, 3).join(", ")) : "container & bed crops") + ".</div>")
                : "") +
        "</div>";
    }

    function renderContainerDimsSummaryHtml(ctx, geom) {
        const cm = _containerModal;
        const isImp = cm.dimUnit === "in";
        const areaStr = isImp ? (geom.surfaceAreaFt2 + " ft\u00b2 (" + geom.surfaceAreaM2 + " m\u00b2)") : (geom.surfaceAreaM2 + " m\u00b2 (" + geom.surfaceAreaFt2 + " ft\u00b2)");
        const volStr = geom.volumeLiters + " L (" + geom.volumeGallons + " gal)";
        return '<div class="wcpp-bs-media-stat-grid" style="margin-top:4px;">' +
            '<div class="wcpp-bs-media-stat-card"><span style="font-size:0.72rem; color:var(--bs-muted); font-weight:700;">Media Volume</span><strong>' + escHtml(ctx, volStr) + "</strong></div>" +
            '<div class="wcpp-bs-media-stat-card"><span style="font-size:0.72rem; color:var(--bs-muted); font-weight:700;">Planting Surface Area</span><strong>' + escHtml(ctx, areaStr) + "</strong></div>" +
            (cm.blockType === "basket" ? '<div class="wcpp-bs-media-stat-card"><span style="font-size:0.72rem; color:var(--bs-muted); font-weight:700;">Basket Geometry</span><strong>0.85 Bowl Factor</strong></div>' : "") +
        "</div>";
    }

    function syncContainerModalInPlace(ctx) {
        if (!_containerModal) return;
        const res = getContainerModalGeometryAndAnalysis(ctx);
        const geom = res.geom;
        const analysis = res.analysis;

        const dimsHost = document.getElementById("wcppBsContainerDimsSummary");
        if (dimsHost) dimsHost.innerHTML = renderContainerDimsSummaryHtml(ctx, geom);

        const volById = new Map((analysis.ingredientVolumesL || []).map(function (iv) { return [iv.id, iv.liters]; }));
        (_containerModal.ingredients || []).forEach(function (it, idx) {
            const litEl = document.querySelector('#wcppBsModalBackdrop [data-media-liters-idx="' + idx + '"]');
            if (litEl) {
                const lVal = volById.has(it.id) ? volById.get(it.id) : +(((Number(it.pct) || 0) / 100) * geom.volumeLiters).toFixed(2);
                litEl.textContent = lVal.toFixed(1) + " L";
            }
        });

        const meterHost = document.getElementById("wcppBsMediaMeterHost");
        if (meterHost) meterHost.innerHTML = renderContainerMeterHtml(ctx, analysis);

        const diagHost = document.getElementById("wcppBsMediaDiagnosticsHost");
        if (diagHost) diagHost.innerHTML = renderContainerDiagnosticsHtml(ctx, analysis, res.cropsInBlock);
    }

    function renderContainerModalHtml(ctx) {
        rememberCtx(ctx);
        if (!_containerModal) return "";
        const c = core(ctx);
        const colors = getMediaColors(ctx);
        const cm = _containerModal;
        const res = getContainerModalGeometryAndAnalysis(ctx);
        const geom = res.geom;
        const analysis = res.analysis;
        const volById = new Map((analysis.ingredientVolumesL || []).map(function (iv) { return [iv.id, iv.liters]; }));

        const typeButtons = [
            { id: "pot", label: "Pot / Grow Bag" },
            { id: "basket", label: "Hanging Basket" },
            { id: "bench", label: "Growing Bench" }
        ].map(function (t) {
            const active = cm.blockType === t.id;
            return '<button type="button" class="wcpp-bs-seg-btn' + (active ? " is-active" : "") + '" data-action="container-set-type" data-type="' + t.id + '">' + escHtml(ctx, t.label) + "</button>";
        }).join("");

        const containerPresetsHtml = (c.CONTAINER_PRESETS || []).filter(function (pr) {
            return pr.blockType === cm.blockType;
        }).map(function (pr) {
            const active = cm.presetId === pr.id;
            return '<button type="button" class="wcpp-bs-container-preset-btn' + (active ? " is-active" : "") + '" data-action="container-pick-preset" data-preset-id="' + escHtml(ctx, pr.id) + '" title="' + escHtml(ctx, pr.description || pr.name) + '">' +
                escHtml(ctx, pr.label || pr.name) +
            "</button>";
        }).join("");

        const mediaPresetsHtml = (c.GROWING_MEDIA_PRESETS || []).map(function (mp) {
            const active = cm.mediaPresetId === mp.id;
            return '<button type="button" class="wcpp-bs-media-preset-btn' + (active ? " is-active" : "") + '" data-action="media-pick-preset" data-preset-id="' + escHtml(ctx, mp.id) + '" title="' + escHtml(ctx, mp.description || mp.name) + '">' +
                escHtml(ctx, mp.label || mp.name) +
            "</button>";
        }).join("");

        const ingredientsList = c.GROWING_MEDIA_INGREDIENTS || [];
        const rowsHtml = (cm.ingredients || []).map(function (row, idx) {
            const optsHtml = ingredientsList.map(function (ing) {
                return '<option value="' + escHtml(ctx, ing.id) + '"' + (row.id === ing.id ? " selected" : "") + ">" + escHtml(ctx, ing.label) + "</option>";
            }).join("");
            const litersVal = volById.has(row.id) ? volById.get(row.id) : +(((Number(row.pct) || 0) / 100) * geom.volumeLiters).toFixed(2);
            const dotCol = colors[row.id] || "#166534";

            return '<div class="wcpp-bs-media-row">' +
                '<span style="width:10px; height:10px; border-radius:999px; background:' + dotCol + '; flex-shrink:0;" aria-hidden="true"></span>' +
                '<select class="wcpp-bs-select" data-action="media-ingredient-select" data-row-idx="' + idx + '" aria-label="Media Ingredient">' + optsHtml + "</select>" +
                '<input type="range" min="0" max="100" step="1" value="' + Math.round(row.pct) + '" data-media-range-idx="' + idx + '" aria-label="Ingredient Percentage Slider">' +
                '<input type="number" class="wcpp-bs-input" min="0" max="100" step="1" value="' + row.pct + '" data-media-num-idx="' + idx + '" aria-label="Ingredient Percentage">' +
                '<span style="font-size:0.78rem; font-weight:800; color:var(--bs-muted);">%</span>' +
                '<span class="wcpp-bs-badge" data-media-liters-idx="' + idx + '">' + litersVal.toFixed(1) + " L</span>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-action="media-remove-row" data-row-idx="' + idx + '"' + (cm.ingredients.length <= 1 ? " disabled" : "") + ' title="Remove ingredient">\u00d7</button>' +
            "</div>";
        }).join("");

        const unitLbl = cm.dimUnit === "in" ? "in" : "cm";
        const modalTitle = cm.isNonContainerBed
            ? ("Edit Bed Growing Media \u2014 " + cm.name)
            : (cm.editingBlockId ? ("Edit Container & Media \u2014 " + cm.name) : "Add Pot, Hanging Basket or Growing Bench");

        let geometrySectionHtml = "";
        if (cm.isNonContainerBed) {
            geometrySectionHtml = '<div class="wcpp-bs-card" style="padding:12px;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">' +
                    "<strong>Bed Area &amp; Topsoil Depth (for Volume Calculation)</strong>" +
                    '<div class="wcpp-bs-segmented">' +
                        '<button type="button" class="wcpp-bs-seg-btn' + (cm.dimUnit === "cm" ? " is-active" : "") + '" data-action="container-set-dim-unit" data-unit="cm">cm</button>' +
                        '<button type="button" class="wcpp-bs-seg-btn' + (cm.dimUnit === "in" ? " is-active" : "") + '" data-action="container-set-dim-unit" data-unit="in">in</button>' +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-form-grid">' +
                    '<div class="wcpp-bs-field"><label>Active Topsoil Depth (' + unitLbl + ')</label><input class="wcpp-bs-input" type="number" step="0.5" min="4" data-container-input="depth" value="' + formatContainerDimVal(cm.depthCm, cm.dimUnit) + '"></div>' +
                "</div>" +
                '<div id="wcppBsContainerDimsSummary">' + renderContainerDimsSummaryHtml(ctx, geom) + "</div>" +
            "</div>";
        } else {
            geometrySectionHtml = '<div class="wcpp-bs-card" style="padding:12px; display:flex; flex-direction:column; gap:10px;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    '<div class="wcpp-bs-mode-segmented" role="group" aria-label="Container Type">' + typeButtons + "</div>" +
                    '<div class="wcpp-bs-segmented" role="group" aria-label="Dimension Units">' +
                        '<button type="button" class="wcpp-bs-seg-btn' + (cm.dimUnit === "in" ? " is-active" : "") + '" data-action="container-set-dim-unit" data-unit="in">in</button>' +
                        '<button type="button" class="wcpp-bs-seg-btn' + (cm.dimUnit === "cm" ? " is-active" : "") + '" data-action="container-set-dim-unit" data-unit="cm">cm</button>' +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-container-presets">' + containerPresetsHtml + "</div>" +
                '<div class="wcpp-bs-form-grid">' +
                    '<div class="wcpp-bs-field"><label>Container Name</label><input class="wcpp-bs-input" type="text" data-container-input="name" value="' + escHtml(ctx, cm.name) + '"></div>' +
                    '<div class="wcpp-bs-field"><label>Shape</label><div class="wcpp-bs-segmented"><button type="button" class="wcpp-bs-seg-btn' + (cm.shapeKind === "circle" ? " is-active" : "") + '" data-action="container-set-shape" data-shape="circle">Round</button><button type="button" class="wcpp-bs-seg-btn' + (cm.shapeKind === "rectangle" ? " is-active" : "") + '" data-action="container-set-shape" data-shape="rectangle">Rectangular</button></div></div>' +
                    (cm.shapeKind === "circle"
                        ? ('<div class="wcpp-bs-field"><label>Diameter (' + unitLbl + ')</label><input class="wcpp-bs-input" type="number" step="0.5" min="4" data-container-input="diameter" value="' + formatContainerDimVal(cm.diameterCm, cm.dimUnit) + '"></div>')
                        : (
                            '<div class="wcpp-bs-field"><label>Length (' + unitLbl + ')</label><input class="wcpp-bs-input" type="number" step="0.5" min="4" data-container-input="length" value="' + formatContainerDimVal(cm.lengthCm, cm.dimUnit) + '"></div>' +
                            '<div class="wcpp-bs-field"><label>Width (' + unitLbl + ')</label><input class="wcpp-bs-input" type="number" step="0.5" min="4" data-container-input="width" value="' + formatContainerDimVal(cm.widthCm, cm.dimUnit) + '"></div>'
                        )) +
                    '<div class="wcpp-bs-field"><label>Depth (' + unitLbl + ')</label><input class="wcpp-bs-input" type="number" step="0.5" min="3" data-container-input="depth" value="' + formatContainerDimVal(cm.depthCm, cm.dimUnit) + '"></div>' +
                "</div>" +
                '<div id="wcppBsContainerDimsSummary">' + renderContainerDimsSummaryHtml(ctx, geom) + "</div>" +
            "</div>";
        }

        return '<div class="wcpp-bs-modal is-wide wcpp-bs-container-modal">' +
            '<div class="wcpp-bs-modal-header">' +
                "<h2>" + escHtml(ctx, modalTitle) + "</h2>" +
                '<div style="display:flex; gap:8px; align-items:center;">' +
                    (cm.returnToPlayground ? '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="container-back-playground">\u2190 Back to Playground</button>' : "") +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7 Close</button>' +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-modal-body">' +
                geometrySectionHtml +
                '<div class="wcpp-bs-card" style="padding:12px; display:flex; flex-direction:column; gap:10px;">' +
                    '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                        "<strong>Growing Media Type &amp; % Mix Builder</strong>" +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="media-add-row">' + svgIcon(ctx, "plus", 12) + "<span>+ Add Ingredient</span></button>" +
                    "</div>" +
                    '<div class="wcpp-bs-media-presets">' + mediaPresetsHtml + "</div>" +
                    '<div class="wcpp-bs-media-rows">' + rowsHtml + "</div>" +
                    '<div id="wcppBsMediaMeterHost">' + renderContainerMeterHtml(ctx, analysis) + "</div>" +
                    '<div id="wcppBsMediaDiagnosticsHost">' + renderContainerDiagnosticsHtml(ctx, analysis, res.cropsInBlock) + "</div>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-modal-footer">' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-secondary" data-action="close-modal">Cancel</button>' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary" data-action="container-save">' + (cm.returnToPlayground ? "Save &amp; Return to Playground" : (cm.editingBlockId ? "Save Changes" : "Add to Garden")) + "</button>" +
            "</div>" +
        "</div>";
    }

    function handleContainerModalClick(ctx, act, actEl) {
        rememberCtx(ctx);
        if (!_containerModal) return false;
        const c = core(ctx);
        const state = getState(ctx);
        if (act === "close-modal") {
            if (ctx && typeof ctx.closeModal === "function") ctx.closeModal();
            return true;
        }
        if (act === "container-set-type") {
            const nextType = actEl.getAttribute("data-type") || "pot";
            if (_containerModal.blockType !== nextType) {
                _containerModal.blockType = nextType;
                const pr = (c.CONTAINER_PRESETS || []).find(function (p) { return p.blockType === nextType; });
                if (pr) {
                    _containerModal.presetId = pr.id;
                    _containerModal.shapeKind = pr.shapeKind || "circle";
                    _containerModal.diameterCm = pr.diameterCm || 30.48;
                    _containerModal.widthCm = pr.widthCm || 30.48;
                    _containerModal.lengthCm = pr.lengthCm || 75;
                    _containerModal.depthCm = pr.depthCm || 25;
                    _containerModal.bowlFactor = pr.bowlFactor || (nextType === "basket" ? 0.85 : 1.0);
                    if (!_containerModal.nameDirty) _containerModal.name = pr.name;
                } else {
                    _containerModal.bowlFactor = nextType === "basket" ? 0.85 : 1.0;
                }
                if (!_containerModal.mediaDirty) {
                    const defMedia = c.normalizeGrowingMedia(pr && pr.defaultMediaPreset ? pr.defaultMediaPreset : null, nextType);
                    _containerModal.mediaPresetId = defMedia.presetId;
                    _containerModal.mediaName = defMedia.name;
                    _containerModal.ingredients = defMedia.ingredients.map(function (it) { return { id: it.id, pct: it.pct }; });
                }
                if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
            }
            return true;
        }
        if (act === "container-pick-preset") {
            const pid = actEl.getAttribute("data-preset-id");
            const pr = (c.CONTAINER_PRESETS || []).find(function (p) { return p.id === pid; });
            if (pr) {
                _containerModal.presetId = pr.id;
                _containerModal.blockType = pr.blockType;
                _containerModal.shapeKind = pr.shapeKind;
                _containerModal.diameterCm = pr.diameterCm || 30.48;
                _containerModal.widthCm = pr.widthCm || 30.48;
                _containerModal.lengthCm = pr.lengthCm || 75;
                _containerModal.depthCm = pr.depthCm || 25;
                _containerModal.bowlFactor = pr.bowlFactor || (pr.blockType === "basket" ? 0.85 : 1.0);
                if (!_containerModal.nameDirty) _containerModal.name = pr.name;
                if (!_containerModal.mediaDirty && pr.defaultMediaPreset) {
                    const defMedia = c.normalizeGrowingMedia(pr.defaultMediaPreset, pr.blockType);
                    _containerModal.mediaPresetId = defMedia.presetId;
                    _containerModal.mediaName = defMedia.name;
                    _containerModal.ingredients = defMedia.ingredients.map(function (it) { return { id: it.id, pct: it.pct }; });
                }
                if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
            }
            return true;
        }
        if (act === "container-set-shape") {
            const sk = actEl.getAttribute("data-shape") === "rectangle" ? "rectangle" : "circle";
            if (_containerModal.shapeKind !== sk) {
                _containerModal.shapeKind = sk;
                _containerModal.presetId = null;
                if (sk === "circle" && !Number(_containerModal.diameterCm)) {
                    _containerModal.diameterCm = Math.max(15, Number(_containerModal.widthCm) || 30.48);
                }
                if (sk === "rectangle" && (!Number(_containerModal.widthCm) || !Number(_containerModal.lengthCm))) {
                    _containerModal.widthCm = Number(_containerModal.diameterCm) || 25;
                    _containerModal.lengthCm = Number(_containerModal.diameterCm) || 60;
                }
                if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
            }
            return true;
        }
        if (act === "container-set-dim-unit") {
            const u = actEl.getAttribute("data-unit") === "in" ? "in" : "cm";
            if (_containerModal.dimUnit !== u) {
                _containerModal.dimUnit = u;
                if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
            }
            return true;
        }
        if (act === "media-pick-preset") {
            const mpId = actEl.getAttribute("data-preset-id");
            const mp = (c.GROWING_MEDIA_PRESETS || []).find(function (p) { return p.id === mpId; });
            if (mp) {
                _containerModal.mediaPresetId = mp.id;
                _containerModal.mediaName = mp.name;
                _containerModal.ingredients = (mp.ingredients || []).map(function (it) { return { id: it.id, pct: it.pct }; });
                _containerModal.mediaDirty = true;
                if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
            }
            return true;
        }
        if (act === "media-add-row") {
            const used = new Set((_containerModal.ingredients || []).map(function (it) { return it.id; }));
            const nextIng = (c.GROWING_MEDIA_INGREDIENTS || []).find(function (ing) { return !used.has(ing.id); });
            if (!nextIng) {
                showToast(ctx, "All growing media ingredients are already listed.");
                return true;
            }
            const curSum = (_containerModal.ingredients || []).reduce(function (s, it) { return s + (Number(it.pct) || 0); }, 0);
            const rem = Math.max(0, Math.round(100 - curSum));
            _containerModal.ingredients.push({ id: nextIng.id, pct: rem > 0 ? rem : 10 });
            _containerModal.mediaPresetId = "custom";
            _containerModal.mediaName = "Custom Mix";
            _containerModal.mediaDirty = true;
            if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
            return true;
        }
        if (act === "media-remove-row") {
            const idx = Number(actEl.getAttribute("data-row-idx"));
            if (_containerModal.ingredients.length > 1 && idx >= 0 && idx < _containerModal.ingredients.length) {
                _containerModal.ingredients.splice(idx, 1);
                _containerModal.mediaPresetId = "custom";
                _containerModal.mediaName = "Custom Mix";
                _containerModal.mediaDirty = true;
                if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
            }
            return true;
        }
        if (act === "media-auto-balance") {
            const balanced = c.balanceGrowingMediaPct(_containerModal.ingredients || []);
            _containerModal.ingredients = balanced;
            _containerModal.mediaDirty = true;
            if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
            showToast(ctx, "Balanced growing media mix to 100%.");
            return true;
        }
        if (act === "container-back-playground") {
            const bid = _containerModal.editingBlockId;
            const bnum = _containerModal.returnBedNumber || 1;
            openBedPlayground(ctx, bid, bnum);
            return true;
        }
        if (act === "container-save") {
            const cm = _containerModal;
            const season = state ? c.getActiveSeason(state) : null;
            if (!season) return true;
            const savedMedia = c.normalizeGrowingMedia({
                presetId: cm.mediaPresetId,
                name: cm.mediaName,
                ingredients: cm.ingredients
            }, cm.blockType);
            let targetBlockId = cm.editingBlockId;
            const returnToPg = cm.returnToPlayground;
            const returnBed = cm.returnBedNumber || 1;

            if (ctx && typeof ctx.commitStateChange === "function") {
                ctx.commitStateChange(function (st) {
                    const s = c.getActiveSeason(st);
                    if (!s) return;
                    if (cm.editingBlockId) {
                        const idx = (s.blocks || []).findIndex(function (b) { return b.id === cm.editingBlockId; });
                        if (idx >= 0) {
                            const prev = s.blocks[idx];
                            if (cm.isNonContainerBed) {
                                prev.growingMedia = savedMedia;
                            } else {
                                const updated = c.createContainerBlock({
                                    id: prev.id,
                                    name: cm.name.trim() || prev.name,
                                    type: cm.blockType,
                                    presetId: cm.presetId,
                                    shapeKind: cm.shapeKind,
                                    diameterCm: cm.diameterCm,
                                    widthCm: cm.widthCm,
                                    lengthCm: cm.lengthCm,
                                    depthCm: cm.depthCm,
                                    bowlFactor: cm.bowlFactor,
                                    growingMedia: savedMedia,
                                    pathWidthCm: prev.pathWidthCm,
                                    angleDeg: prev.angleDeg,
                                    beginningYear: prev.beginningYear,
                                    isFallow: prev.isFallow,
                                    x: prev.x,
                                    y: prev.y
                                });
                                s.blocks[idx] = updated;
                                setSelectedBlockId(ctx, updated.id);
                                targetBlockId = updated.id;
                            }
                        }
                    } else {
                        const count = (s.blocks || []).length;
                        const nb = c.createContainerBlock({
                            name: cm.name.trim() || undefined,
                            type: cm.blockType,
                            presetId: cm.presetId,
                            shapeKind: cm.shapeKind,
                            diameterCm: cm.diameterCm,
                            widthCm: cm.widthCm,
                            lengthCm: cm.lengthCm,
                            depthCm: cm.depthCm,
                            bowlFactor: cm.bowlFactor,
                            growingMedia: savedMedia,
                            beginningYear: s.year,
                            x: 40 + (count % 3) * 120,
                            y: 40 + Math.floor(count / 3) * 110
                        });
                        s.blocks.push(nb);
                        setSelectedBlockId(ctx, nb.id);
                        targetBlockId = nb.id;
                    }
                }, { rehydrate: false });
            }

            if (returnToPg && targetBlockId) {
                openBedPlayground(ctx, targetBlockId, returnBed);
                showToast(ctx, "Updated growing media mix.");
            } else {
                if (ctx && typeof ctx.closeModal === "function") ctx.closeModal();
                const stTab = ctx && typeof ctx.getSubTab === "function" ? ctx.getSubTab() : "farm-layout";
                if (stTab !== "crop-map" && stTab !== "farm-layout" && ctx && typeof ctx.setSubTab === "function") {
                    ctx.setSubTab("farm-layout");
                }
                if (ctx && typeof ctx.renderSimulator === "function") ctx.renderSimulator();
                showToast(ctx, cm.editingBlockId ? "Saved container & growing media." : "Added container to garden.");
            }
            return true;
        }
        return false;
    }

    function handleContainerModalInput(ctx, t, backdrop) {
        rememberCtx(ctx);
        if (!_containerModal || !t) return false;
        const cField = t.getAttribute("data-container-input");
        if (cField) {
            if (cField === "name") {
                _containerModal.name = t.value;
                _containerModal.nameDirty = true;
                return true;
            }
            const cmVal = parseContainerDimToCm(t.value, _containerModal.dimUnit);
            if (cmVal !== null) {
                if (cField === "diameter") _containerModal.diameterCm = cmVal;
                else if (cField === "width") _containerModal.widthCm = cmVal;
                else if (cField === "length") _containerModal.lengthCm = cmVal;
                else if (cField === "depth") _containerModal.depthCm = cmVal;
                _containerModal.presetId = null;
                syncContainerModalInPlace(ctx);
            }
            return true;
        }
        const rIdxAttr = t.getAttribute("data-media-range-idx");
        const nIdxAttr = t.getAttribute("data-media-num-idx");
        if (rIdxAttr !== null || nIdxAttr !== null) {
            const idx = Number(rIdxAttr !== null ? rIdxAttr : nIdxAttr);
            const pct = Math.max(0, Math.min(100, Number(t.value) || 0));
            const bd = backdrop || document.getElementById("wcppBsModalBackdrop");
            if (_containerModal.ingredients[idx]) {
                _containerModal.ingredients[idx].pct = pct;
                _containerModal.mediaPresetId = "custom";
                _containerModal.mediaName = "Custom Mix";
                _containerModal.mediaDirty = true;
                if (bd) {
                    if (rIdxAttr !== null) {
                        const numEl = bd.querySelector('[data-media-num-idx="' + idx + '"]');
                        if (numEl) numEl.value = pct;
                    } else {
                        const rngEl = bd.querySelector('[data-media-range-idx="' + idx + '"]');
                        if (rngEl) rngEl.value = Math.round(pct);
                    }
                }
                syncContainerModalInPlace(ctx);
            }
            return true;
        }
        return false;
    }

    function handleContainerModalChange(ctx, t) {
        rememberCtx(ctx);
        if (!_containerModal || !t) return false;
        if (t.getAttribute("data-action") === "media-ingredient-select") {
            const idx = Number(t.getAttribute("data-row-idx"));
            if (_containerModal.ingredients[idx]) {
                _containerModal.ingredients[idx].id = t.value;
                _containerModal.mediaPresetId = "custom";
                _containerModal.mediaName = "Custom Mix";
                _containerModal.mediaDirty = true;
                if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
            }
            return true;
        }
        return false;
    }

    // =========================================================================
    // 3. INTERACTIVE PLANT PLAYGROUND MODAL (+ V5 HYDROZONE PILL)
    // =========================================================================
    function getPlaygroundBlockAndBed(ctx) {
        const c = core(ctx);
        const state = getState(ctx);
        const season = state ? c.getActiveSeason(state) : null;
        if (!season || !_playground) return { season: null, block: null, bedNumber: 1 };
        const block = (season.blocks || []).find(function (b) { return b.id === _playground.blockId; }) || (season.blocks || [])[0] || null;
        if (!block) return { season: season, block: null, bedNumber: 1 };
        _playground.blockId = block.id;
        const maxBed = Math.max(1, Number(block.bedCount || 1));
        const bedNumber = Math.max(1, Math.min(maxBed, Math.round(Number(_playground.bedNumber) || 1)));
        _playground.bedNumber = bedNumber;
        return { season: season, block: block, bedNumber: bedNumber };
    }

    function getPlaygroundBedPlants(season, blockId, bedNumber) {
        if (!season || !Array.isArray(season.placedPlants)) return [];
        return season.placedPlants.filter(function (pp) {
            return pp && pp.blockId === blockId && Number(pp.bedNumber || 1) === Number(bedNumber);
        });
    }

    function setPlaygroundBedPlants(season, blockId, bedNumber, nextBedPlants) {
        if (!season) return;
        const others = (season.placedPlants || []).filter(function (pp) {
            return !(pp && pp.blockId === blockId && Number(pp.bedNumber || 1) === Number(bedNumber));
        });
        season.placedPlants = others.concat(nextBedPlants || []);
    }

    function clonePlacedPlantsList(list) {
        return (list || []).map(function (pp) { return Object.assign({}, pp); });
    }

    function pushPlaygroundUndo(ctx) {
        if (!_playground) return;
        const bCtx = getPlaygroundBlockAndBed(ctx);
        if (!bCtx.season || !bCtx.block) return;
        const snap = clonePlacedPlantsList(getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber));
        _playground.undoStack.push(snap);
        if (_playground.undoStack.length > 40) _playground.undoStack.shift();
        _playground.redoStack = [];
    }

    function undoPlayground(ctx) {
        if (!_playground || !_playground.undoStack.length) return;
        const bCtx = getPlaygroundBlockAndBed(ctx);
        if (!bCtx.season || !bCtx.block) return;
        const cur = clonePlacedPlantsList(getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber));
        _playground.redoStack.push(cur);
        const prev = _playground.undoStack.pop();
        if (ctx && typeof ctx.commitStateChange === "function") {
            ctx.commitStateChange(function (st) {
                const s = core(ctx).getActiveSeason(st);
                setPlaygroundBedPlants(s, bCtx.block.id, bCtx.bedNumber, prev);
            }, { rehydrate: false });
        }
        if (_playground.selectedSpecimenId && !prev.some(function (p) { return p.id === _playground.selectedSpecimenId; })) {
            _playground.selectedSpecimenId = null;
        }
        syncPlaygroundInPlace(ctx);
    }

    function redoPlayground(ctx) {
        if (!_playground || !_playground.redoStack.length) return;
        const bCtx = getPlaygroundBlockAndBed(ctx);
        if (!bCtx.season || !bCtx.block) return;
        const cur = clonePlacedPlantsList(getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber));
        _playground.undoStack.push(cur);
        const next = _playground.redoStack.pop();
        if (ctx && typeof ctx.commitStateChange === "function") {
            ctx.commitStateChange(function (st) {
                const s = core(ctx).getActiveSeason(st);
                setPlaygroundBedPlants(s, bCtx.block.id, bCtx.bedNumber, next);
            }, { rehydrate: false });
        }
        if (_playground.selectedSpecimenId && !next.some(function (p) { return p.id === _playground.selectedSpecimenId; })) {
            _playground.selectedSpecimenId = null;
        }
        syncPlaygroundInPlace(ctx);
    }

    function openBedPlayground(ctx, blockId, bedNumber) {
        rememberCtx(ctx);
        const c = core(ctx);
        const state = getState(ctx);
        const catalog = getCatalog(ctx);
        const season = state ? c.getActiveSeason(state) : null;
        const blocks = (season && season.blocks) || [];
        const selBid = getSelectedBlockId(ctx);
        const targetBlock = (blockId && blocks.find(function (b) { return b.id === blockId; })) ||
            (selBid && blocks.find(function (b) { return b.id === selBid; })) ||
            blocks[0] || null;
        const bId = targetBlock ? targetBlock.id : "";
        const bNum = targetBlock ? Math.max(1, Math.min(Number(targetBlock.bedCount || 1), Math.round(Number(bedNumber) || 1))) : 1;

        let defaultCrop = "Lettuce (Leaf)";
        if (season && targetBlock) {
            const existingPlaced = getPlaygroundBedPlants(season, bId, bNum);
            if (existingPlaced.length && existingPlaced[0].cropName) {
                defaultCrop = existingPlaced[0].cropName;
            } else {
                const schedMatch = (season.plantings || []).find(function (p) {
                    return p && p.blockId === bId && Number(p.bedStart || 0) === bNum;
                });
                if (schedMatch && schedMatch.cropName) defaultCrop = schedMatch.cropName;
            }
        }
        if (catalog && catalog.cropMap) {
            const resolved = c.resolveCrop(catalog.cropMap, defaultCrop);
            if (resolved) defaultCrop = resolved.name;
            else if (catalog.crops && catalog.crops[0]) defaultCrop = catalog.crops[0].name;
        }

        const defGridCm = getDefaultPlaygroundGridCm(ctx, targetBlock);
        const defAxisUnit = (state && state.units === "imperial")
            ? "ft"
            : (targetBlock && isContainerBlock(ctx, targetBlock) && targetBlock.type !== "bench" ? "cm" : "m");

        _playground = {
            blockId: bId,
            bedNumber: bNum,
            tool: "drop",
            showGrid: defGridCm > 0,
            gridStepCm: defGridCm,
            axisUnit: defAxisUnit,
            activeCropName: defaultCrop,
            cropSearchText: defaultCrop,
            cropDropdownOpen: false,
            replaceSearchText: "",
            replaceDropdownOpen: false,
            selectedSpecimenId: null,
            highlightSpecies: null,
            zone: "whole",
            densityMultiplier: 1,
            customCountOverride: "",
            keepExisting: true,
            zoomMode: "full",
            panStartCm: 0,
            timeLapseMonth: 0,
            undoStack: [],
            redoStack: [],
            drag: null
        };
        setModalMode(ctx, "playground");
        if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
        ensureStudioPointerListeners(ctx);
        if (!document.__wcppPgKeyDelBound) {
            document.__wcppPgKeyDelBound = true;
            document.addEventListener("keydown", function (ev) {
                if (!_playground || !_playground.selectedSpecimenId) return;
                if (ev.key !== "Delete" && ev.key !== "Backspace") return;
                const tag = (ev.target && ev.target.tagName || "").toUpperCase();
                if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (ev.target && ev.target.isContentEditable)) return;
                const activeCtx = _lastCtx;
                if (!activeCtx || getModalMode(activeCtx) !== "playground") return;
                const bCtx = getPlaygroundBlockAndBed(activeCtx);
                if (!bCtx.season || !bCtx.block) return;
                const delId = _playground.selectedSpecimenId;
                const curList = getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber);
                const removed = curList.find(function (pp) { return pp.id === delId; });
                if (!removed) return;
                ev.preventDefault();
                const nextList = curList.filter(function (pp) { return pp.id !== delId; });
                pushPlaygroundUndo(activeCtx);
                if (typeof activeCtx.commitStateChange === "function") {
                    activeCtx.commitStateChange(function (st) {
                        setPlaygroundBedPlants(core(activeCtx).getActiveSeason(st), bCtx.block.id, bCtx.bedNumber, nextList);
                    }, { rehydrate: false });
                }
                _playground.selectedSpecimenId = null;
                syncPlaygroundInPlace(activeCtx);
                showToast(activeCtx, "Removed " + removed.cropName + ".");
            });
        }
        return Promise.resolve();
    }

    function getPlaygroundCropDropdownHtml(ctx, query, actionName, activeCropName, containerDepthCm) {
        const catalog = getCatalog(ctx);
        if (!catalog) return "";
        const c = core(ctx);
        const matches = catalog.searchCrops(query, 35);
        if (!matches.length) {
            return '<div style="padding:10px 12px; font-size:0.82rem; color:var(--bs-muted);">No matching crops or BC natives found.</div>';
        }
        return matches.map(function (mc) {
            const density = c.computeRecommendedDensity(mc, catalog, containerDepthCm);
            const sel = activeCropName && mc.name === activeCropName;
            return '<div class="wcpp-bs-crop-option' + (sel ? " is-selected" : "") + '" data-action="' + escHtml(ctx, actionName) + '" data-crop="' + escHtml(ctx, mc.name) + '">' +
                '<div><strong>' + escHtml(ctx, mc.name) + '</strong> <small style="color:var(--bs-muted);">' + escHtml(ctx, mc.family || mc.category) + "</small></div>" +
                '<span class="wcpp-bs-badge">Rec: ' + density.plantsPerSqFt + " / ft\u00b2</span>" +
            "</div>";
        }).join("");
    }

    function getPlaygroundZoomState(ctx, bounds) {
        const pg = _playground;
        const state = getState(ctx);
        const isImp = state && state.units === "imperial";
        const totalW = Math.max(1, Number(bounds && bounds.widthCm) || 100);
        const sectionWinCm = isImp ? 304.8 : 300;
        const closeupWinCm = isImp ? 152.4 : 150;
        const canSection = totalW > sectionWinCm + 1;
        const canCloseup = totalW > closeupWinCm + 1;

        let mode = (pg && pg.zoomMode) || "full";
        if (mode === "section" && !canSection) mode = "full";
        if (mode === "closeup" && !canCloseup) mode = "full";

        const winW = mode === "closeup" ? closeupWinCm : (mode === "section" ? sectionWinCm : totalW);
        const maxPan = Math.max(0, +(totalW - winW).toFixed(2));
        const rawPan = (pg && Number.isFinite(Number(pg.panStartCm))) ? Number(pg.panStartCm) : 0;
        const startCm = mode === "full" ? 0 : Math.max(0, Math.min(maxPan, +rawPan.toFixed(2)));
        const endCm = mode === "full" ? totalW : Math.min(totalW, +(startCm + winW).toFixed(2));

        return {
            mode: mode,
            isZoomed: mode !== "full" && maxPan > 0.5,
            canSection: canSection,
            canCloseup: canCloseup,
            sectionWinCm: sectionWinCm,
            closeupWinCm: closeupWinCm,
            winW: winW,
            totalW: totalW,
            maxPan: maxPan,
            startCm: startCm,
            endCm: endCm
        };
    }

    function formatPlaygroundZoomRange(z, bounds, isImp) {
        if (!z || !bounds) return "";
        if (isImp) {
            const s = (z.startCm / 30.48).toFixed(1);
            const e = (z.endCm / 30.48).toFixed(1);
            const t = (bounds.widthCm / 30.48).toFixed(1);
            return s + " ft \u2013 " + e + " ft of " + t + " ft";
        }
        const s = (z.startCm / 100).toFixed(1);
        const e = (z.endCm / 100).toFixed(1);
        const t = (bounds.widthCm / 100).toFixed(1);
        return s + " m \u2013 " + e + " m of " + t + " m";
    }

    function formatPlaygroundFullZoomLabel(ctx, bounds, isImp) {
        const c = core(ctx);
        if (!bounds) return "Full Bed";
        if (isImp) {
            return "Full Bed (" + (bounds.widthCm >= 91 ? ((bounds.widthCm / 30.48).toFixed(1) + " ft") : (c.cmToIn(bounds.widthCm) + '"')) + ")";
        }
        return "Full Bed (" + (bounds.widthCm >= 100 ? ((bounds.widthCm / 100).toFixed(1) + " m") : (Math.round(bounds.widthCm) + " cm")) + ")";
    }

    function computePlaygroundViewBox(ctx, bounds, zoomState) {
        const z = zoomState || getPlaygroundZoomState(ctx, bounds);
        if (z.isZoomed) {
            const padLeft = Math.max(20, +(z.winW * 0.12).toFixed(2));
            const padRight = Math.max(8, +(z.winW * 0.06).toFixed(2));
            const padTop = Math.max(16, +(Math.max(bounds.heightCm, z.winW * 0.25) * 0.20).toFixed(2));
            const padBottom = Math.max(14, +(Math.max(bounds.heightCm, z.winW * 0.25) * 0.18).toFixed(2));
            return {
                x: +(z.startCm - padLeft).toFixed(2),
                y: -padTop,
                w: +(z.winW + padLeft + padRight).toFixed(2),
                h: +(bounds.heightCm + padTop + padBottom).toFixed(2),
                padX: padLeft,
                padRight: padRight,
                padY: padTop,
                padBottom: padBottom,
                zoomState: z
            };
        }
        const maxSpan = Math.max(24, bounds.widthCm, bounds.heightCm);
        const padLeft = Math.max(12, +(Math.min(165, maxSpan * 0.18)).toFixed(2));
        const padRight = Math.max(8, +(Math.min(130, maxSpan * 0.12)).toFixed(2));
        const minFontPadY = bounds.widthCm > bounds.heightCm * 4 ? +(bounds.widthCm * 0.05).toFixed(2) : 0;
        const padTop = Math.max(11, minFontPadY, +(Math.min(155, maxSpan * 0.16)).toFixed(2));
        const padBottom = Math.max(9, minFontPadY, +(Math.min(145, maxSpan * 0.14)).toFixed(2));
        return {
            x: -padLeft,
            y: -padTop,
            w: +(bounds.widthCm + padLeft + padRight).toFixed(2),
            h: +(bounds.heightCm + padTop + padBottom).toFixed(2),
            padX: padLeft,
            padRight: padRight,
            padY: padTop,
            padBottom: padBottom,
            zoomState: z
        };
    }

    function pickPlaygroundRulerStepCm(spanCm, axisUnit) {
        const s = Math.max(1, Number(spanCm) || 100);
        if (axisUnit === "ft") {
            const ftSteps = [0.5, 1, 2, 5, 10, 20, 50];
            for (let i = 0; i < ftSteps.length; i++) {
                const stepCm = ftSteps[i] * 30.48;
                if (s / stepCm <= 8.5) return stepCm;
            }
            return 50 * 30.48;
        }
        if (axisUnit === "m") {
            const mSteps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20];
            for (let i = 0; i < mSteps.length; i++) {
                const stepCm = mSteps[i] * 100;
                if (s / stepCm <= 8.5) return stepCm;
            }
            return 2000;
        }
        const cmSteps = [5, 10, 20, 25, 50, 100, 200, 500];
        for (let i = 0; i < cmSteps.length; i++) {
            if (s / cmSteps[i] <= 8.5) return cmSteps[i];
        }
        return 500;
    }

    function buildPlaygroundAxisRulersSvg(ctx, bounds, zoomState, vb, uScale) {
        const pg = _playground;
        const state = getState(ctx);
        const axisUnit = (pg && pg.axisUnit) || ((state && state.units === "imperial") ? "ft" : "m");
        const xStart = zoomState.isZoomed ? zoomState.startCm : 0;
        const xEnd = zoomState.isZoomed ? zoomState.endCm : bounds.widthCm;
        const xSpan = Math.max(1, xEnd - xStart);
        const yEnd = Math.max(1, bounds.heightCm);

        const xStep = pickPlaygroundRulerStepCm(xSpan, axisUnit);
        const yStep = pickPlaygroundRulerStepCm(yEnd, axisUnit);

        const topBaseY = -2.4 * uScale;
        const tickLen = 3.2 * uScale;
        const topLblY = -6.8 * uScale;
        const leftBaseX = xStart - 2.4 * uScale;
        const leftLblX = xStart - 6.6 * uScale;
        const tickFont = Math.max(2.6, Math.min(11 * uScale, vb.padY * 0.34, 8.2 * uScale));

        let out = '<g class="wcpp-bs-axis-ruler" data-axis-unit="' + escHtml(ctx, axisUnit) + '" pointer-events="none">';
        out += '<line class="wcpp-bs-axis-tick" x1="' + xStart.toFixed(2) + '" y1="' + topBaseY.toFixed(2) + '" x2="' + xEnd.toFixed(2) + '" y2="' + topBaseY.toFixed(2) + '" stroke="#94a3b8" stroke-width="1" vector-effect="non-scaling-stroke"/>';
        out += '<line class="wcpp-bs-axis-tick" x1="' + leftBaseX.toFixed(2) + '" y1="0" x2="' + leftBaseX.toFixed(2) + '" y2="' + yEnd.toFixed(2) + '" stroke="#94a3b8" stroke-width="1" vector-effect="non-scaling-stroke"/>';

        const xTicks = [];
        const firstX = Math.max(xStart, Math.ceil((xStart - 0.01) / xStep) * xStep);
        for (let tx = firstX; tx <= xEnd + 0.05; tx += xStep) {
            xTicks.push(+Math.min(xEnd, tx).toFixed(2));
        }
        if (!xTicks.length || Math.abs(xTicks[0] - xStart) > xStep * 0.25) {
            xTicks.unshift(+xStart.toFixed(2));
        }
        if (Math.abs(xTicks[xTicks.length - 1] - xEnd) > xStep * 0.28) {
            xTicks.push(+xEnd.toFixed(2));
        }
        xTicks.forEach(function (tx) {
            const lbl = formatAxisMeasurement(ctx, tx, axisUnit);
            out += '<line class="wcpp-bs-axis-tick" data-axis="x" x1="' + tx.toFixed(2) + '" y1="' + topBaseY.toFixed(2) + '" x2="' + tx.toFixed(2) + '" y2="' + (topBaseY - tickLen).toFixed(2) + '" stroke="#64748b" stroke-width="1.2" vector-effect="non-scaling-stroke"/>';
            out += '<text class="wcpp-bs-axis-label" data-axis="x" x="' + tx.toFixed(2) + '" y="' + topLblY.toFixed(2) + '" text-anchor="middle" font-size="' + tickFont.toFixed(2) + '" font-weight="700" fill="#475569">' + escHtml(ctx, lbl) + "</text>";
        });

        const yTicks = [];
        for (let ty = 0; ty <= yEnd + 0.05; ty += yStep) {
            yTicks.push(+Math.min(yEnd, ty).toFixed(2));
        }
        if (Math.abs(yTicks[yTicks.length - 1] - yEnd) > yStep * 0.28) {
            yTicks.push(+yEnd.toFixed(2));
        }
        yTicks.forEach(function (ty) {
            const lbl = formatAxisMeasurement(ctx, ty, axisUnit);
            out += '<line class="wcpp-bs-axis-tick" data-axis="y" x1="' + leftBaseX.toFixed(2) + '" y1="' + ty.toFixed(2) + '" x2="' + (leftBaseX - tickLen).toFixed(2) + '" y2="' + ty.toFixed(2) + '" stroke="#64748b" stroke-width="1.2" vector-effect="non-scaling-stroke"/>';
            out += '<text class="wcpp-bs-axis-label" data-axis="y" x="' + leftLblX.toFixed(2) + '" y="' + (ty + tickFont * 0.34).toFixed(2) + '" text-anchor="end" font-size="' + tickFont.toFixed(2) + '" font-weight="700" fill="#475569">' + escHtml(ctx, lbl) + "</text>";
        });

        out += "</g>";
        return out;
    }

    function buildPlaygroundSvgInner(ctx, block, bedNumber, bedPlants, analysis) {
        const c = core(ctx);
        const state = getState(ctx);
        const catalog = getCatalog(ctx);
        const bounds = c.getPlaygroundBounds(block);
        const zoomState = getPlaygroundZoomState(ctx, bounds);
        const vb = computePlaygroundViewBox(ctx, bounds, zoomState);
        const isImp = state && state.units === "imperial";
        const uScale = Math.max(0.08, vb.w / 420);

        let defsSvg = "";
        let containerSvg = "";
        let gridSvg = "";
        const rawGridStep = (_playground && _playground.gridStepCm !== undefined)
            ? Number(_playground.gridStepCm)
            : getDefaultPlaygroundGridCm(ctx, block);
        const stepCm = (_playground && _playground.showGrid && rawGridStep > 0) ? rawGridStep : 0;

        if (bounds.shapeKind === "circle") {
            const rimR = bounds.radiusCm + 2.4 * uScale;
            defsSvg = '<defs><clipPath id="wcppPgClipCircle"><circle cx="' + bounds.cx.toFixed(2) + '" cy="' + bounds.cy.toFixed(2) + '" r="' + bounds.radiusCm.toFixed(2) + '"/></clipPath></defs>';
            containerSvg += '<circle cx="' + bounds.cx.toFixed(2) + '" cy="' + bounds.cy.toFixed(2) + '" r="' + rimR.toFixed(2) + '" fill="#fffbeb" stroke="#9a3412" stroke-width="2.5" vector-effect="non-scaling-stroke"/>';
            containerSvg += '<circle data-pg-soil-surface="true" cx="' + bounds.cx.toFixed(2) + '" cy="' + bounds.cy.toFixed(2) + '" r="' + bounds.radiusCm.toFixed(2) + '" fill="#ecfdf5" stroke="#166534" stroke-width="1.8" vector-effect="non-scaling-stroke"/>';
            if (block.type === "basket") {
                [-90, 30, 150].forEach(function (deg) {
                    const rad = (deg * Math.PI) / 180;
                    const rx = bounds.cx + Math.cos(rad) * rimR;
                    const ry = bounds.cy + Math.sin(rad) * rimR;
                    containerSvg += '<line x1="' + rx.toFixed(2) + '" y1="' + ry.toFixed(2) + '" x2="' + bounds.cx.toFixed(2) + '" y2="' + bounds.cy.toFixed(2) + '" stroke="#0f766e" stroke-width="1.3" stroke-dasharray="4 3" stroke-opacity="0.65" vector-effect="non-scaling-stroke" pointer-events="none"/>';
                    containerSvg += '<circle cx="' + rx.toFixed(2) + '" cy="' + ry.toFixed(2) + '" r="' + (2.8 * uScale).toFixed(2) + '" fill="#0f766e" pointer-events="none"/>';
                });
                containerSvg += '<circle cx="' + bounds.cx.toFixed(2) + '" cy="' + bounds.cy.toFixed(2) + '" r="' + (3.2 * uScale).toFixed(2) + '" fill="#ffffff" stroke="#0f766e" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>';
            }
            if (stepCm > 0) {
                let cGrid = "";
                for (let gx = stepCm; gx < bounds.widthCm; gx += stepCm) {
                    cGrid += '<line x1="' + gx.toFixed(2) + '" y1="0" x2="' + gx.toFixed(2) + '" y2="' + bounds.heightCm.toFixed(2) + '" stroke="#e2e8f0" stroke-width="0.9" vector-effect="non-scaling-stroke"/>';
                }
                for (let gy = stepCm; gy < bounds.heightCm; gy += stepCm) {
                    cGrid += '<line x1="0" y1="' + gy.toFixed(2) + '" x2="' + bounds.widthCm.toFixed(2) + '" y2="' + gy.toFixed(2) + '" stroke="#e2e8f0" stroke-width="0.9" vector-effect="non-scaling-stroke"/>';
                }
                gridSvg += '<g clip-path="url(#wcppPgClipCircle)" pointer-events="none">' + cGrid + "</g>";
                gridSvg += '<circle cx="' + bounds.cx.toFixed(2) + '" cy="' + bounds.cy.toFixed(2) + '" r="' + (bounds.radiusCm * 0.42).toFixed(2) + '" fill="none" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" pointer-events="none"/>';
                gridSvg += '<circle cx="' + bounds.cx.toFixed(2) + '" cy="' + bounds.cy.toFixed(2) + '" r="' + (bounds.radiusCm * 0.76).toFixed(2) + '" fill="none" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" pointer-events="none"/>';
            }
        } else if (bounds.shapeKind === "custom" && bounds.pathD) {
            defsSvg = '<defs><clipPath id="wcppPgClipShape"><path d="' + escHtml(ctx, bounds.pathD) + '"/></clipPath></defs>';
            containerSvg += '<path data-pg-soil-surface="true" d="' + escHtml(ctx, bounds.pathD) + '" fill="#ecfdf5" stroke="#166534" stroke-width="2.2" vector-effect="non-scaling-stroke"/>';
            if (stepCm > 0) {
                let innerG = "";
                for (let gx = stepCm; gx < bounds.widthCm; gx += stepCm) {
                    innerG += '<line x1="' + gx.toFixed(2) + '" y1="0" x2="' + gx.toFixed(2) + '" y2="' + bounds.heightCm.toFixed(2) + '" stroke="#cbd5e1" stroke-width="1" vector-effect="non-scaling-stroke"/>';
                }
                for (let gy = stepCm; gy < bounds.heightCm; gy += stepCm) {
                    innerG += '<line x1="0" y1="' + gy.toFixed(2) + '" x2="' + bounds.widthCm.toFixed(2) + '" y2="' + gy.toFixed(2) + '" stroke="#cbd5e1" stroke-width="1" vector-effect="non-scaling-stroke"/>';
                }
                gridSvg = '<g clip-path="url(#wcppPgClipShape)" pointer-events="none">' + innerG + "</g>";
            }
        } else {
            const frameCol = block.type === "bench" ? "#92400e" : (block.type === "pot" ? "#9a3412" : "#166534");
            const rimPad = 2.2 * uScale;
            containerSvg += '<rect x="' + (-rimPad).toFixed(2) + '" y="' + (-rimPad).toFixed(2) + '" width="' + (bounds.widthCm + rimPad * 2).toFixed(2) + '" height="' + (bounds.heightCm + rimPad * 2).toFixed(2) + '" rx="' + (3 * uScale).toFixed(2) + '" fill="#fffbeb" stroke="' + frameCol + '" stroke-width="2" vector-effect="non-scaling-stroke"/>';
            containerSvg += '<rect data-pg-soil-surface="true" x="0" y="0" width="' + bounds.widthCm.toFixed(2) + '" height="' + bounds.heightCm.toFixed(2) + '" fill="#ecfdf5" stroke="#166534" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
            if (stepCm > 0) {
                for (let gx = stepCm; gx < bounds.widthCm - 0.5; gx += stepCm) {
                    gridSvg += '<line x1="' + gx.toFixed(2) + '" y1="0" x2="' + gx.toFixed(2) + '" y2="' + bounds.heightCm.toFixed(2) + '" stroke="#cbd5e1" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>';
                }
                for (let gy = stepCm; gy < bounds.heightCm - 0.5; gy += stepCm) {
                    gridSvg += '<line x1="0" y1="' + gy.toFixed(2) + '" x2="' + bounds.widthCm.toFixed(2) + '" y2="' + gy.toFixed(2) + '" stroke="#cbd5e1" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>';
                }
            }
        }

        const rulerSvg = buildPlaygroundAxisRulersSvg(ctx, bounds, zoomState, vb, uScale);

        const dimTextBase = bounds.shapeKind === "circle"
            ? ((isImp ? (c.cmToIn(bounds.widthCm) + '" \u00d8') : (Math.round(bounds.widthCm) + " cm \u00d8")) + " \u00b7 " + (isImp ? (bounds.areaFt2 + " ft\u00b2") : (bounds.areaM2 + " m\u00b2")) + (bounds.depthCm ? (" \u00b7 Depth " + (isImp ? (c.cmToIn(bounds.depthCm) + '"') : (Math.round(bounds.depthCm) + " cm"))) : ""))
            : ((isImp ? (c.mToFt(bounds.widthCm / 100) + " ft \u00d7 " + c.cmToIn(bounds.heightCm) + '"') : (Math.round(bounds.widthCm) + " \u00d7 " + Math.round(bounds.heightCm) + " cm")) + " \u00b7 " + (isImp ? (bounds.areaFt2 + " ft\u00b2") : (bounds.areaM2 + " m\u00b2")));
        const dimText = zoomState.isZoomed
            ? ("Viewing " + formatPlaygroundZoomRange(zoomState, bounds, isImp) + " \u00b7 " + dimTextBase)
            : dimTextBase;
        const dimCenterX = zoomState.isZoomed ? (zoomState.startCm + zoomState.winW / 2) : (bounds.widthCm / 2);

        const compSet = new Set();
        const antSet = new Set();
        const depthWarnSet = new Set();
        if (analysis) {
            (analysis.companionPairs || []).forEach(function (pr) { compSet.add(pr.cropA); compSet.add(pr.cropB); });
            (analysis.antagonistPairs || []).forEach(function (pr) { antSet.add(pr.cropA); antSet.add(pr.cropB); });
            (analysis.depthWarnings || []).forEach(function (dw) { depthWarnSet.add(dw.cropName); });
        }

        const isDeleteMode = _playground && _playground.tool === "delete";
        const hlSpecies = _playground && _playground.highlightSpecies;
        const tlMonth = (_playground && Number(_playground.timeLapseMonth)) || 0;
        const v6Ref = global.WCPPBedSimulatorV6 || null;
        const nodesSvg = (bedPlants || []).map(function (pp) {
            const cropObj = catalog && catalog.cropMap ? c.resolveCrop(catalog.cropMap, pp.cropName) : null;
            const canonical = cropObj ? cropObj.name : pp.cropName;
            const col = c.getCategoryColor((cropObj && cropObj.category) || "Vegetable");
            const code = (cropObj && cropObj.shortCode) || String(canonical || "PL").slice(0, 3).toUpperCase();
            const isSel = Boolean(_playground && _playground.selectedSpecimenId === pp.id);
            const isAnt = antSet.has(canonical);
            const isComp = compSet.has(canonical);
            const isDW = depthWarnSet.has(canonical);
            const dimmed = Boolean(hlSpecies && hlSpecies !== canonical);

            const cls = [
                "wcpp-bs-specimen-node",
                isSel ? "is-selected" : "",
                isAnt ? "is-antagonist" : (isComp ? "is-companion" : ""),
                isDW ? "is-depth-warn" : "",
                isDeleteMode ? "is-quick-delete" : ""
            ].filter(Boolean).join(" ");

            const tlStage = (tlMonth > 0 && v6Ref && typeof v6Ref.computeCropGrowthStage === "function")
                ? v6Ref.computeCropGrowthStage(cropObj, pp, tlMonth)
                : (tlMonth > 0 ? (function () {
                    const sm = Number(String(pp.startDate || "2026-05-01").slice(5, 7)) || 5;
                    if (tlMonth < sm) return { active: false, canopyScale: 0.25, isBlooming: false };
                    const prog = Math.min(1, (tlMonth - sm + 1) / 3);
                    return { active: true, canopyScale: 0.3 + prog * 0.7, isBlooming: tlMonth >= sm + 1 && tlMonth <= sm + 3 };
                })() : null);

            const baseR = Math.max(1.5, Number(pp.radiusCm) || 8);
            const r = tlStage ? Math.max(1.4, baseR * tlStage.canopyScale) : baseR;
            const tlOpacity = (tlStage && !tlStage.active) ? 0.35 : (dimmed ? 0.25 : 1);
            const stemR = Math.max(0.8, Math.min(3.5 * uScale, r * 0.25));
            const strokeCol = isAnt ? "#dc2626" : (isSel ? "#0f766e" : (isDW ? "#d97706" : col));
            const fontSize = Math.max(2.6, Math.min(11 * uScale, r * 0.58));
            const showLabel = r >= 4.5 * uScale || isSel;
            const density = c.computeRecommendedDensity(cropObj || pp.cropName, catalog, bounds.depthCm);

            const delBadgeR = Math.max(2.8, 9.2 * uScale);
            const delBx = Math.max(r * 0.72, delBadgeR * 0.9);
            const delBy = -Math.max(r * 0.72, delBadgeR * 0.9);
            const delBadgeSvg = isSel
                ? ('<g class="wcpp-bs-specimen-del-badge" data-pg-quick-delete-id="' + escHtml(ctx, pp.id) + '" transform="translate(' + delBx.toFixed(2) + "," + delBy.toFixed(2) + ')" style="cursor:pointer;">' +
                    '<circle cx="0" cy="0" r="' + delBadgeR.toFixed(2) + '" fill="#dc2626" stroke="#ffffff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>' +
                    '<text x="0" y="' + (delBadgeR * 0.36).toFixed(2) + '" text-anchor="middle" font-size="' + (delBadgeR * 1.35).toFixed(2) + '" font-weight="900" fill="#ffffff" pointer-events="none">\u00d7</text>' +
                    "<title>Remove this " + escHtml(ctx, canonical) + "</title>" +
                "</g>")
                : "";
            const bloomHaloSvg = (tlStage && tlStage.isBlooming)
                ? '<circle cx="0" cy="0" r="' + (r + 1.8 * uScale).toFixed(2) + '" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="3 2" vector-effect="non-scaling-stroke" pointer-events="none"/>'
                : "";

            return '<g class="' + cls + '" data-specimen-id="' + escHtml(ctx, pp.id) + '" ' +
                'data-x-cm="' + pp.xCm.toFixed(1) + '" data-y-cm="' + pp.yCm.toFixed(1) + '" ' +
                'transform="translate(' + pp.xCm.toFixed(2) + "," + pp.yCm.toFixed(2) + ')" ' +
                (tlOpacity < 1 ? ('style="opacity:' + tlOpacity + ';"') : "") + ">" +
                '<circle cx="0" cy="0" r="' + r.toFixed(2) + '" fill="' + escHtml(ctx, col) + '" fill-opacity="0.32" stroke="' + escHtml(ctx, strokeCol) + '" stroke-width="' + (isSel || isAnt ? 2.2 : 1.4) + '"' + (isAnt ? ' stroke-dasharray="3 2"' : "") + ' vector-effect="non-scaling-stroke"/>' +
                '<circle cx="0" cy="0" r="' + stemR.toFixed(2) + '" fill="' + escHtml(ctx, col) + '" stroke="#ffffff" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
                (showLabel ? '<text x="0" y="' + (stemR + fontSize * 1.05).toFixed(2) + '" text-anchor="middle" font-size="' + fontSize.toFixed(2) + '" font-weight="800" fill="#111827" pointer-events="none">' + escHtml(ctx, code) + "</text>" : "") +
                bloomHaloSvg +
                (isSel ? '<circle cx="0" cy="0" r="' + (r + 2.4 * uScale).toFixed(2) + '" fill="none" stroke="#0f766e" stroke-width="2" stroke-dasharray="4 2" vector-effect="non-scaling-stroke" pointer-events="none"/>' : "") +
                delBadgeSvg +
                "<title>" + escHtml(ctx, canonical + " (" + (pp.role || "primary") + ") \u00b7 Rec: " + density.plantsPerSqFt + " / ft\u00b2 \u00b7 (" + pp.xCm.toFixed(1) + ", " + pp.yCm.toFixed(1) + " cm)") + "</title>" +
            "</g>";
        }).join("");

        const innerHtml =
            defsSvg +
            '<rect x="' + vb.x + '" y="' + vb.y + '" width="' + vb.w + '" height="' + vb.h + '" fill="#ffffff"/>' +
            containerSvg +
            gridSvg +
            rulerSvg +
            '<text x="' + dimCenterX.toFixed(2) + '" y="' + (bounds.heightCm + vb.padY * 0.62).toFixed(2) + '" text-anchor="middle" font-size="' + (10 * uScale).toFixed(2) + '" font-weight="700" fill="#475569" pointer-events="none">' + escHtml(ctx, dimText) + "</text>" +
            nodesSvg;

        return { vb: vb, innerHtml: innerHtml, bounds: bounds, zoomState: zoomState };
    }

    function computePlaygroundTargetCountPreview(ctx, density, bounds, block, bedNumber, bedPlants) {
        const pg = _playground;
        if (!pg || !density || !bounds) return 1;
        if (pg.customCountOverride && Number(pg.customCountOverride) > 0) {
            return Math.min(600, Math.max(1, Math.round(Number(pg.customCountOverride))));
        }
        const mult = Number(pg.densityMultiplier || 1);
        const zone = pg.zone || "whole";
        if ((zone === "border-ring" || zone === "next-inner-border" || zone === "remaining-center") && block) {
            const c = core(ctx);
            const catalog = getCatalog(ctx);
            if (c && typeof c.generateRecommendedPlaygroundPlants === "function") {
                try {
                    const previewBatch = c.generateRecommendedPlaygroundPlants(block, bedNumber || pg.bedNumber || 1, pg.activeCropName, catalog, {
                        zone: zone,
                        densityMultiplier: mult,
                        keepExisting: pg.keepExisting,
                        existingPlants: bedPlants || []
                    });
                    if (Array.isArray(previewBatch) && previewBatch.length > 0) {
                        return previewBatch.length;
                    }
                } catch (_) {}
            }
        }
        if (zone === "rim" || zone === "border-ring" || zone === "next-inner-border") {
            const perimEst = bounds.shapeKind === "circle"
                ? (Math.PI * 2 * Math.max(2, bounds.radiusCm - 3))
                : 2 * Math.max(10, bounds.widthCm + bounds.heightCm);
            const perimCount = Math.max(1, Math.round((perimEst / Math.max(5, density.inRowCm)) * mult));
            const areaCap = Math.max(1, density.recommendedCountForArea(bounds.areaFt2 * 0.55 * mult));
            return Math.min(600, Math.min(perimCount, Math.max(3, areaCap)));
        }
        const frac = zone === "center" ? 0.22 : (zone === "mid-ring" ? 0.40 : (zone === "remaining-center" ? 0.55 : ((zone === "left" || zone === "right") ? 0.50 : 1.0)));
        return Math.min(600, Math.max(1, density.recommendedCountForArea(bounds.areaFt2 * frac * mult)));
    }

    function renderPlaygroundDensityCardHtml(ctx, block, bedPlants) {
        const c = core(ctx);
        const catalog = getCatalog(ctx);
        const pg = _playground;
        const bounds = c.getPlaygroundBounds(block);
        const density = c.computeRecommendedDensity(pg.activeCropName, catalog, bounds.depthCm);
        const fullRecCount = density.recommendedCountForArea(bounds.areaFt2);
        const targetPreview = computePlaygroundTargetCountPreview(ctx, density, bounds, block, pg.bedNumber, bedPlants);

        const zoneOpts = [
            { id: "whole", label: "Whole Area" },
            { id: "border-ring", label: "Inside Border (Ring 1)" },
            { id: "next-inner-border", label: "Next Inner Border (Step Inward)" },
            { id: "remaining-center", label: "Fill Remaining Center" },
            { id: "center", label: "Center / Thriller" },
            { id: "mid-ring", label: "Mid Ring / Filler" },
            { id: "rim", label: "Outer Rim / Spiller" },
            { id: "left", label: "Left Half" },
            { id: "right", label: "Right Half" }
        ].map(function (z) {
            return '<option value="' + z.id + '"' + (pg.zone === z.id ? " selected" : "") + ">" + escHtml(ctx, z.label) + "</option>";
        }).join("");

        const multBtns = [0.75, 1, 1.25].map(function (m) {
            const active = !pg.customCountOverride && Math.abs(Number(pg.densityMultiplier || 1) - m) < 0.01;
            return '<button type="button" class="wcpp-bs-seg-btn' + (active ? " is-active" : "") + '" data-action="pg-set-density-mult" data-mult="' + m + '">' + m + "\u00d7</button>";
        }).join("");

        return '<div class="wcpp-bs-density-card">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                "<strong>Recommended Plants / ft\u00b2 Auto-Fill</strong>" +
                '<span class="wcpp-bs-badge wcpp-bs-status-ok">Rec: ' + density.plantsPerSqFt + " / ft\u00b2</span>" +
            "</div>" +
            '<div style="font-size:0.8rem; color:var(--bs-text-2); font-weight:700;">' +
                "Recommended: <strong>" + density.plantsPerSqFt + " plants/ft\u00b2</strong> \u2192 <strong>" + fullRecCount + " plants</strong> for " + bounds.areaFt2 + " ft\u00b2" +
                ' <span style="color:var(--bs-muted); font-weight:600;">(' + escHtml(ctx, density.basisLabel) + ")</span>" +
            "</div>" +
            (density.depthWarning
                ? '<div class="wcpp-bs-playground-notice is-warn">' + svgIcon(ctx, "alert", 12) + " " + escHtml(ctx, density.depthWarning) + "</div>"
                : '<div style="font-size:0.75rem; color:var(--bs-muted);">' + escHtml(ctx, density.containerSuitability) + " \u00b7 Est. root depth ~" + density.rootDepthCm + " cm</div>") +
            '<div class="wcpp-bs-form-grid">' +
                '<div class="wcpp-bs-field"><label>Placement Zone</label><select class="wcpp-bs-select" data-action="pg-change-zone">' + zoneOpts + "</select></div>" +
                '<div class="wcpp-bs-field"><label>Density Multiplier</label><div class="wcpp-bs-segmented">' + multBtns + "</div></div>" +
                '<div class="wcpp-bs-field"><label>Custom Count (Opt.)</label><input class="wcpp-bs-input" type="number" min="1" max="600" placeholder="Auto (' + targetPreview + ')" data-pg-input="customCount" value="' + escHtml(ctx, pg.customCountOverride || "") + '"></div>' +
            "</div>" +
            '<label style="display:flex; align-items:center; gap:7px; font-size:0.8rem; font-weight:700; cursor:pointer;">' +
                '<input type="checkbox" data-action="pg-toggle-keep-existing"' + (pg.keepExisting ? " checked" : "") + "> Keep Existing Plants (" + (bedPlants ? bedPlants.length : 0) + " placed)" +
            "</label>" +
            '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="pg-apply-recommended">' + svgIcon(ctx, "spark", 13) + '<span id="wcppBsPgTargetPreview">Apply Recommended Plants (' + targetPreview + ")</span></button>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="pg-load-schedule">Load From Schedule</button>' +
            "</div>" +
        "</div>";
    }

    function renderPlaygroundInspectorHtml(ctx, block, bedPlants) {
        const c = core(ctx);
        const state = getState(ctx);
        const catalog = getCatalog(ctx);
        const pg = _playground;
        const bounds = c.getPlaygroundBounds(block);
        const sel = pg.selectedSpecimenId
            ? (bedPlants || []).find(function (pp) { return pp.id === pg.selectedSpecimenId; })
            : null;

        if (!sel) {
            return '<div class="wcpp-bs-specimen-inspector">' +
                "<strong>Selected Plant Inspector</strong>" +
                '<div style="font-size:0.8rem; color:var(--bs-muted);">Click any individual plant on the blueprint (or switch to <strong>Select / Move</strong>) to inspect, drag freely, replace that single specimen, duplicate nearby, or delete one-by-one.</div>' +
            "</div>";
        }

        const cropObj = catalog && catalog.cropMap ? c.resolveCrop(catalog.cropMap, sel.cropName) : null;
        const density = c.computeRecommendedDensity(cropObj || sel.cropName, catalog, bounds.depthCm);
        const isImp = state && state.units === "imperial";
        const posStr = isImp
            ? (c.cmToIn(sel.xCm) + '", ' + c.cmToIn(sel.yCm) + '"')
            : (sel.xCm.toFixed(1) + " cm, " + sel.yCm.toFixed(1) + " cm");

        const roleOpts = [
            { id: "primary", label: "Primary" },
            { id: "thriller", label: "Thriller (Center)" },
            { id: "filler", label: "Filler (Mid Ring)" },
            { id: "spiller", label: "Spiller (Rim)" },
            { id: "border", label: "Border" },
            { id: "understory", label: "Understory" },
            { id: "relay", label: "Relay" }
        ].map(function (r) {
            return '<option value="' + r.id + '"' + ((sel.role || "primary") === r.id ? " selected" : "") + ">" + escHtml(ctx, r.label) + "</option>";
        }).join("");

        const replaceDropdownHtml = getPlaygroundCropDropdownHtml(ctx, pg.replaceSearchText, "pg-replace-pick", sel.cropName, bounds.depthCm);
        const ringBadgeHtml = (sel.ringIndex || sel.role === "border")
            ? ('<span class="wcpp-bs-badge wcpp-bs-ring-badge">Border Ring ' + (Number(sel.ringIndex) || 1) + (Number(sel.insetCm) > 0 ? (" \u00b7 Inset " + Math.round(Number(sel.insetCm)) + " cm") : "") + "</span>")
            : "";

        return '<div class="wcpp-bs-specimen-inspector">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                "<strong>Selected Plant: " + escHtml(ctx, sel.cropName) + "</strong>" +
                '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">' +
                    ringBadgeHtml +
                    '<span class="wcpp-bs-badge">Rec: ' + density.plantsPerSqFt + " / ft\u00b2</span>" +
                "</div>" +
            "</div>" +
            '<div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; font-size:0.78rem; color:var(--bs-text-2);">' +
                "<span><strong>Pos:</strong> " + escHtml(ctx, posStr) + "</span>" +
                "<span>\u00b7</span>" +
                "<span><strong>Canopy:</strong> " + Math.round(sel.radiusCm * 2) + " cm</span>" +
                "<span>\u00b7</span>" +
                (density.depthWarning
                    ? '<span class="wcpp-bs-badge wcpp-bs-status-warn">Root Depth Warning (~' + density.rootDepthCm + " cm)</span>"
                    : '<span class="wcpp-bs-badge wcpp-bs-status-ok">Root Depth OK (~' + density.rootDepthCm + " cm)</span>") +
            "</div>" +
            '<div class="wcpp-bs-field">' +
                "<label>Specimen Role</label>" +
                '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">' +
                    '<select class="wcpp-bs-select" data-action="pg-specimen-role" style="flex:1 1 140px;">' + roleOpts + "</select>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="pg-specimen-auto-border" title="Place a full inside-perimeter border ring of this crop using current density multiplier &amp; max spread">' + svgIcon(ctx, "spark", 12) + "<span>Auto-Place Border Ring</span></button>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-field">' +
                "<label>Replace This Plant (Swaps 1 Specimen)</label>" +
                '<div class="wcpp-bs-crop-picker">' +
                    '<input type="text" class="wcpp-bs-crop-search" id="wcppPgReplaceSearch" value="' + escHtml(ctx, pg.replaceSearchText) + '" placeholder="Search ' + (catalog && catalog.crops ? catalog.crops.length : 389) + ' crops to swap this plant..." autocomplete="off">' +
                    '<div class="wcpp-bs-crop-dropdown" id="wcppPgReplaceDropdown"' + (pg.replaceDropdownOpen ? "" : " hidden") + ">" + replaceDropdownHtml + "</div>" +
                "</div>" +
            "</div>" +
            '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="pg-duplicate-specimen">' + svgIcon(ctx, "copy", 12) + "<span>Duplicate Nearby</span></button>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-sm" data-action="pg-delete-specimen">' + svgIcon(ctx, "trash", 12) + "<span>Delete This Plant</span></button>" +
            "</div>" +
        "</div>";
    }

    function renderPlaygroundSummaryHtml(ctx, block, analysis, season, bedNumber) {
        if (!analysis) return "";
        const c = core(ctx);
        const catalog = getCatalog(ctx);
        const pg = _playground;

        const hz = (c && typeof c.analyzeBedHydrozones === "function" && block && season)
            ? c.analyzeBedHydrozones(block, bedNumber || (pg && pg.bedNumber) || 1, season, catalog)
            : null;

        let hydroBadgeHtml = "";
        let hydroWarnHtml = "";
        if (hz) {
            const tierCls = hz.hasMismatch ? "is-mismatch" : ("is-" + escHtml(ctx, hz.dominantTier || "moderate"));
            const cadenceText = hz.summerCadenceLabel || (hz.summerDaysBetweenWatering ? ("Every " + hz.summerDaysBetweenWatering + "d (Summer)") : "");
            const badgeText = hz.hasMismatch
                ? ("Hydrozone Mismatch" + (cadenceText ? (" \u00b7 " + cadenceText) : ""))
                : (cadenceText ? ("Summer Watering: " + cadenceText) : "Hydrozone Balanced");
            const badgeTitle = hz.mismatchSummary || ((hz.notes && hz.notes.length) ? hz.notes.join(" ") : badgeText);
            hydroBadgeHtml = '<span class="wcpp-bs-badge wcpp-bs-hydrozone-badge ' + tierCls + '" id="wcppBsPgHydrozoneBadge" title="' + escHtml(ctx, badgeTitle) + '">' + escHtml(ctx, badgeText) + "</span>";
            if (hz.hasMismatch && hz.mismatchSummary) {
                hydroWarnHtml = '<div class="wcpp-bs-playground-notice is-warn" id="wcppBsPgHydrozoneWarn">' + svgIcon(ctx, "alert", 12) + " " + escHtml(ctx, hz.mismatchSummary) + "</div>";
            }
        }

        const tallyPills = (analysis.speciesTally || []).map(function (sp) {
            const active = pg && pg.highlightSpecies === sp.cropName;
            return '<button type="button" class="wcpp-bs-species-pill' + (active ? " is-active" : "") + '" data-action="pg-filter-species" data-crop="' + escHtml(ctx, sp.cropName) + '" title="Rec: ' + sp.recommendedPerSqFt + '/ft\u00b2 (target ' + sp.recommendedCount + ' for bed)">' +
                '<span style="width:8px; height:8px; border-radius:999px; background:' + escHtml(ctx, sp.color) + '; display:inline-block;"></span>' +
                "<span>" + escHtml(ctx, sp.cropName) + " (" + sp.count + ")</span>" +
            "</button>";
        }).join("");

        const compBadges = (analysis.companionPairs || []).map(function (cp) {
            return '<div class="wcpp-bs-playground-notice is-ok">' + svgIcon(ctx, "check", 12) + " " + escHtml(ctx, cp.reason) + "</div>";
        }).join("");
        const antBadges = (analysis.antagonistPairs || []).map(function (ap) {
            return '<div class="wcpp-bs-playground-notice is-conflict">' + svgIcon(ctx, "alert", 12) + " " + escHtml(ctx, ap.reason) + "</div>";
        }).join("");
        const depthNotices = (analysis.depthWarnings || []).map(function (dw) {
            return '<div class="wcpp-bs-playground-notice is-warn">' + svgIcon(ctx, "alert", 12) + " " + escHtml(ctx, dw.message) + "</div>";
        }).join("");
        const mediaWarns = ((analysis.mediaAnalysis && analysis.mediaAnalysis.warnings) || []).map(function (w) {
            return '<div class="wcpp-bs-playground-notice is-warn">' + svgIcon(ctx, "alert", 12) + " " + escHtml(ctx, w) + "</div>";
        }).join("");
        const rawFitList = ((analysis.mediaAnalysis && analysis.mediaAnalysis.cropFitNotes) || []).slice();
        if (analysis.mediaAnalysis && analysis.mediaAnalysis.fertilityNote && rawFitList.indexOf(analysis.mediaAnalysis.fertilityNote) === -1) {
            rawFitList.unshift(analysis.mediaAnalysis.fertilityNote);
        }
        const mediaFits = rawFitList.slice(0, 3).map(function (n) {
            return '<div class="wcpp-bs-playground-notice is-ok">' + svgIcon(ctx, "check", 12) + " " + escHtml(ctx, n) + "</div>";
        }).join("");

        const healthClass = analysis.healthStatus === "conflict" ? "wcpp-bs-status-conflict" : (analysis.healthStatus === "caution" ? "wcpp-bs-status-warn" : "wcpp-bs-status-ok");
        const mediaName = (analysis.mediaAnalysis && analysis.mediaAnalysis.name) || "Default Mix";

        return '<div class="wcpp-bs-playground-summary">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    "<strong>" + analysis.totalPlants + " Plant" + (analysis.totalPlants === 1 ? "" : "s") + " Placed</strong>" +
                    '<span class="wcpp-bs-badge">' + analysis.actualPlantsPerSqFt + " / ft\u00b2</span>" +
                    '<span class="wcpp-bs-badge">Canopy Fill: ' + analysis.canopyFillPct + "%</span>" +
                    '<span class="wcpp-bs-badge ' + healthClass + '">' + escHtml(ctx, analysis.healthStatus.toUpperCase()) + "</span>" +
                    hydroBadgeHtml +
                "</div>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="pg-edit-media">' + svgIcon(ctx, "mix", 12) + "<span>Edit Media Mix (" + escHtml(ctx, mediaName) + ")</span></button>" +
            "</div>" +
            '<div class="wcpp-bs-species-tally">' + (tallyPills || '<span style="color:var(--bs-muted);">No plants placed yet \u2014 click the canvas to drop a single plant, or click Apply Recommended Plants.</span>') + "</div>" +
            hydroWarnHtml +
            antBadges +
            compBadges +
            depthNotices +
            mediaWarns +
            mediaFits +
        "</div>";
    }

    function syncPlaygroundZoomAndSvgOnly(ctx) {
        if (!_playground || getModalMode(ctx) !== "playground") return;
        const c = core(ctx);
        const state = getState(ctx);
        const catalog = getCatalog(ctx);
        const bCtx = getPlaygroundBlockAndBed(ctx);
        if (!bCtx.season || !bCtx.block) return;
        const bedPlants = getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber);
        const analysis = c.analyzePlaygroundBed(bCtx.block, bCtx.bedNumber, bCtx.season.placedPlants || [], catalog);
        const rendered = buildPlaygroundSvgInner(ctx, bCtx.block, bCtx.bedNumber, bedPlants, analysis);
        const svg = document.getElementById("wcppBsPlaygroundSvg");
        if (svg) {
            svg.setAttribute("viewBox", rendered.vb.x + " " + rendered.vb.y + " " + rendered.vb.w + " " + rendered.vb.h);
            svg.innerHTML = rendered.innerHtml;
        }
        const z = rendered.zoomState;
        const bounds = rendered.bounds;
        const isImp = state && state.units === "imperial";
        _playground.zoomMode = z.mode;
        _playground.panStartCm = z.startCm;

        const bd = document.getElementById("wcppBsModalBackdrop");
        if (bd) {
            bd.querySelectorAll('[data-action="pg-set-zoom"]').forEach(function (btn) {
                const zm = btn.getAttribute("data-zoom");
                btn.classList.toggle("is-active", zm === z.mode);
                if (zm === "section") btn.disabled = !z.canSection;
                else if (zm === "closeup") btn.disabled = !z.canCloseup;
                else btn.disabled = false;
            });
            const prevBtn = bd.querySelector('[data-action="pg-pan-prev"]');
            const nextBtn = bd.querySelector('[data-action="pg-pan-next"]');
            if (prevBtn) prevBtn.disabled = !z.isZoomed || z.startCm <= 0.5;
            if (nextBtn) nextBtn.disabled = !z.isZoomed || z.startCm >= z.maxPan - 0.5;
        }

        const badge = document.getElementById("wcppBsPgZoomBadge");
        if (badge) {
            badge.textContent = z.isZoomed
                ? ("Viewing " + formatPlaygroundZoomRange(z, bounds, isImp))
                : formatPlaygroundFullZoomLabel(ctx, bounds, isImp);
        }
        const panRow = document.getElementById("wcppBsPgPanRow");
        if (panRow) panRow.hidden = !z.isZoomed;

        const slider = document.getElementById("wcppBsPgPanSlider");
        if (slider) {
            slider.min = "0";
            slider.max = String(z.maxPan);
            slider.step = "1";
            if (Math.abs(Number(slider.value) - z.startCm) > 0.5) {
                slider.value = String(z.startCm);
            }
        }
        const panLabel = document.getElementById("wcppBsPgPanLabel");
        if (panLabel) {
            panLabel.textContent = z.isZoomed
                ? ("Viewing " + formatPlaygroundZoomRange(z, bounds, isImp))
                : formatPlaygroundFullZoomLabel(ctx, bounds, isImp);
        }
    }

    function syncPlaygroundInPlace(ctx) {
        if (!_playground || getModalMode(ctx) !== "playground") return;
        const c = core(ctx);
        const catalog = getCatalog(ctx);
        const bCtx = getPlaygroundBlockAndBed(ctx);
        if (!bCtx.season || !bCtx.block) return;
        const bedPlants = getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber);
        const analysis = c.analyzePlaygroundBed(bCtx.block, bCtx.bedNumber, bCtx.season.placedPlants || [], catalog);

        syncPlaygroundZoomAndSvgOnly(ctx);
        const wrap = document.getElementById("wcppBsPlaygroundCanvasWrap");
        if (wrap) {
            wrap.classList.toggle("is-mode-drop", _playground.tool === "drop");
            wrap.classList.toggle("is-mode-select", _playground.tool === "select");
            wrap.classList.toggle("is-mode-delete", _playground.tool === "delete");
        }
        const densityHost = document.getElementById("wcppBsPgDensityHost");
        if (densityHost) densityHost.innerHTML = renderPlaygroundDensityCardHtml(ctx, bCtx.block, bedPlants);
        const inspHost = document.getElementById("wcppBsPgInspectorHost");
        if (inspHost) inspHost.innerHTML = renderPlaygroundInspectorHtml(ctx, bCtx.block, bedPlants);
        const sumHost = document.getElementById("wcppBsPgSummaryHost");
        if (sumHost) sumHost.innerHTML = renderPlaygroundSummaryHtml(ctx, bCtx.block, analysis, bCtx.season, bCtx.bedNumber);

        const undoBtn = document.querySelector('#wcppBsModalBackdrop [data-action="pg-undo"]');
        const redoBtn = document.querySelector('#wcppBsModalBackdrop [data-action="pg-redo"]');
        const clearBtn = document.querySelector('#wcppBsModalBackdrop [data-action="pg-clear-all"]');
        if (undoBtn) undoBtn.disabled = _playground.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = _playground.redoStack.length === 0;
        if (clearBtn) clearBtn.disabled = bedPlants.length === 0;
    }

    function printPlaygroundBed(ctx) {
        const state = getState(ctx);
        const catalog = getCatalog(ctx);
        if (!_playground || !state) return;
        const c = core(ctx);
        const bCtx = getPlaygroundBlockAndBed(ctx);
        if (!bCtx.season || !bCtx.block) return;

        cleanupPlaygroundPrintSheet();

        const block = bCtx.block;
        const bedNumber = bCtx.bedNumber;
        const bedPlants = getPlaygroundBedPlants(bCtx.season, block.id, bedNumber);
        const analysis = c.analyzePlaygroundBed(block, bedNumber, bCtx.season.placedPlants || [], catalog);
        const bounds = c.getPlaygroundBounds(block);
        const zoomState = getPlaygroundZoomState(ctx, bounds);
        const isImp = state.units === "imperial";

        const svgOpts = {
            units: state.units || "metric",
            showGrid: Boolean(_playground.showGrid),
            showLabels: true,
            analysis: analysis
        };
        if (zoomState.isZoomed && bounds.shapeKind === "rectangle") {
            svgOpts.sectionStartCm = zoomState.startCm;
            svgOpts.sectionEndCm = zoomState.endCm;
        }
        const rawSvg = typeof c.exportPlaygroundSvg === "function"
            ? c.exportPlaygroundSvg(block, bedNumber, bedPlants, catalog, svgOpts)
            : "";
        const inlineSvg = rawSvg.replace(/<\?xml[\s\S]*?\?>\s*/i, "");

        const bedCount = Math.max(1, Number(block.bedCount || 1));
        const spaceType = getBlockTypeLabel(ctx, block);
        const titleText = (block.name || spaceType) + (bedCount > 1 || bedNumber > 1 ? (" (Bed " + bedNumber + ")") : "");
        const sizeBadge = formatBedSizeSummary(ctx, block, state.units);

        const tallyRows = (analysis.speciesTally || []).length
            ? (analysis.speciesTally || []).map(function (sp) {
                return '<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:3px 0; border-bottom:1px solid #e2e8f0;">' +
                    '<span><span style="display:inline-block; width:9px; height:9px; border-radius:999px; background:' + escHtml(ctx, sp.color) + '; margin-right:6px;"></span><strong>' + escHtml(ctx, sp.cropName) + "</strong></span>" +
                    "<span>" + sp.count + " plants (" + sp.recommendedPerSqFt + "/ft\u00b2 rec)</span>" +
                "</div>";
            }).join("")
            : '<div style="color:#64748b;">No plants placed yet.</div>';

        let mediaHtml = '<div style="color:#475569;">Native Field Soil (No Custom Growing Media Mix)</div>';
        if (isContainerBlock(ctx, block) || block.growingMedia) {
            const normMedia = c.normalizeGrowingMedia(block.growingMedia, block.type || "field");
            const byId = new Map((c.GROWING_MEDIA_INGREDIENTS || []).map(function (ing) { return [ing.id, ing.label]; }));
            const geom = isContainerBlock(ctx, block) ? c.computeContainerGeometry(block.containerSpec || block, block.type) : null;
            const volL = geom
                ? geom.volumeLiters
                : +(bounds.areaM2 * (Number(block.bedDepthCm) || (block.containerSpec && Number(block.containerSpec.depthCm)) || 25) * 10).toFixed(1);
            const volGal = +(volL / 3.785411784).toFixed(2);
            const ingList = ((normMedia && normMedia.ingredients) || []).map(function (it) {
                const ingL = +((Number(it.pct || 0) / 100) * volL).toFixed(1);
                return '<div style="display:flex; justify-content:space-between; gap:8px; padding:2px 0;">' +
                    "<span>" + escHtml(ctx, byId.get(it.id) || it.id) + "</span>" +
                    "<strong>" + Math.round(it.pct) + "% (" + ingL + " L)</strong>" +
                "</div>";
            }).join("");
            mediaHtml = '<div style="font-weight:700; margin-bottom:4px;">' + escHtml(ctx, (normMedia && normMedia.name) || "Custom Mix") + " \u00b7 " + volL + " L (" + volGal + " gal)</div>" + ingList;
        }

        const sheet = document.createElement("div");
        sheet.id = "wcppBsPrintSheet";
        sheet.setAttribute("role", "region");
        sheet.setAttribute("aria-label", "Printable Bed Planting Map");
        sheet.innerHTML =
            '<div class="wcpp-bs-print-sheet-header">' +
                "<div>" +
                    "<h2>" + escHtml(ctx, titleText) + " \u2014 Planting Map</h2>" +
                    '<div style="font-size:0.82rem; color:#475569;">' + escHtml(ctx, spaceType) + " \u00b7 " + escHtml(ctx, sizeBadge) +
                        (zoomState.isZoomed ? (" \u00b7 Viewing " + escHtml(ctx, formatPlaygroundZoomRange(zoomState, bounds, isImp))) : "") +
                    "</div>" +
                "</div>" +
                '<div style="text-align:right; font-size:0.78rem; color:#475569;">' +
                    "<div><strong>" + escHtml(ctx, state.planName || "Garden Plan") + "</strong> (" + escHtml(ctx, String(bCtx.season.year || "")) + ")</div>" +
                    "<div>" + analysis.totalPlants + " plants \u00b7 " + analysis.actualPlantsPerSqFt + " / ft\u00b2 \u00b7 Canopy " + analysis.canopyFillPct + "%</div>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-print-sheet-svg-wrap">' + inlineSvg + "</div>" +
            '<div class="wcpp-bs-print-sheet-grid">' +
                '<div class="wcpp-bs-print-sheet-section">' +
                    "<h4>Species Tally (" + analysis.totalPlants + " Placed)</h4>" +
                    tallyRows +
                "</div>" +
                '<div class="wcpp-bs-print-sheet-section">' +
                    "<h4>Growing Media Mix</h4>" +
                    mediaHtml +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-print-sheet-footer">' +
                "<span>West Coast Plant Project (plantproject.ca) \u2014 Garden Bed Designer</span>" +
                "<span>Printed " + escHtml(ctx, getTodayIso(ctx)) + "</span>" +
            "</div>";

        document.body.appendChild(sheet);
        document.body.classList.add("wcpp-bs-print-sheet-active");

        _pgPrintAfterHandler = function () {
            cleanupPlaygroundPrintSheet();
        };
        global.addEventListener("afterprint", _pgPrintAfterHandler);
        _pgPrintTimer = setTimeout(cleanupPlaygroundPrintSheet, 1500);

        try {
            global.print();
        } catch (_) {
            cleanupPlaygroundPrintSheet();
        }
    }

    function renderPlaygroundModalHtml(ctx) {
        rememberCtx(ctx);
        if (!_playground) return "";
        const c = core(ctx);
        const state = getState(ctx);
        const catalog = getCatalog(ctx);
        const bCtx = getPlaygroundBlockAndBed(ctx);
        if (!bCtx.season || !bCtx.block) {
            return '<div class="wcpp-bs-modal is-compact"><div class="wcpp-bs-modal-header"><h2>Plant Playground</h2><button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7 Close</button></div><div class="wcpp-bs-modal-body"><p>Add a garden bed or container first to open the Plant Playground.</p></div></div>';
        }
        const block = bCtx.block;
        const bedNumber = bCtx.bedNumber;
        const pg = _playground;
        const isImp = state && state.units === "imperial";
        const bedPlants = getPlaygroundBedPlants(bCtx.season, block.id, bedNumber);
        const analysis = c.analyzePlaygroundBed(block, bedNumber, bCtx.season.placedPlants || [], catalog);
        const svgData = buildPlaygroundSvgInner(ctx, block, bedNumber, bedPlants, analysis);
        const bounds = svgData.bounds;
        const z = svgData.zoomState;
        const activeDensity = c.computeRecommendedDensity(pg.activeCropName, catalog, bounds.depthCm);

        const totalBeds = Math.max(1, Number(block.bedCount || 1));
        let bedSelHtml = "";
        if (totalBeds > 1) {
            let bOpts = "";
            for (let b = 1; b <= totalBeds; b++) {
                bOpts += '<option value="' + b + '"' + (bedNumber === b ? " selected" : "") + ">Bed " + b + "</option>";
            }
            bedSelHtml = '<select class="wcpp-bs-select" data-action="pg-change-bed" aria-label="Select Bed">' + bOpts + "</select>";
        }

        const activeCropLabel = pg.activeCropName || "Plant";
        const toolButtons = [
            { id: "drop", label: "Drop " + activeCropLabel },
            { id: "select", label: "Select / Move" },
            { id: "delete", label: "Quick Delete" }
        ].map(function (t) {
            const active = pg.tool === t.id;
            const extraId = t.id === "drop" ? ' id="wcppBsPgDropBtn"' : "";
            return '<button type="button"' + extraId + ' class="wcpp-bs-seg-btn' + (active ? " is-active" : "") + '" data-action="pg-set-tool" data-tool="' + t.id + '">' + escHtml(ctx, t.label) + "</button>";
        }).join("");

        const zoomButtons = [
            { id: "full", label: "Full Bed", enabled: true },
            { id: "section", label: isImp ? "10 ft Section" : "3 m Section", enabled: z.canSection },
            { id: "closeup", label: isImp ? "5 ft Close-Up" : "1.5 m Close-Up", enabled: z.canCloseup }
        ].map(function (zb) {
            const active = z.mode === zb.id;
            return '<button type="button" class="wcpp-bs-seg-btn' + (active ? " is-active" : "") + '" data-action="pg-set-zoom" data-zoom="' + zb.id + '"' + (zb.enabled ? "" : " disabled") + ">" + escHtml(ctx, zb.label) + "</button>";
        }).join("");

        const zoomBadgeText = z.isZoomed
            ? ("Viewing " + formatPlaygroundZoomRange(z, bounds, isImp))
            : formatPlaygroundFullZoomLabel(ctx, bounds, isImp);

        const cropDropdownHtml = getPlaygroundCropDropdownHtml(ctx, pg.cropSearchText === pg.activeCropName ? "" : pg.cropSearchText, "pg-pick-crop", pg.activeCropName, bounds.depthCm);
        const modeCls = pg.tool === "drop" ? " is-mode-drop" : (pg.tool === "delete" ? " is-mode-delete" : " is-mode-select");
        const contBadge = isContainerBlock(ctx, block)
            ? formatContainerSummaryBadge(ctx, block, state ? state.units : "metric")
            : formatBedSizeSummary(ctx, block, state ? state.units : "metric");

        return '<div class="wcpp-bs-modal is-wide wcpp-bs-playground-modal">' +
            '<div class="wcpp-bs-modal-header">' +
                '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    "<h2>Plant Playground \u2014 " + escHtml(ctx, block.name) + (totalBeds > 1 ? (" (Bed " + bedNumber + ")") : "") + "</h2>" +
                    '<span class="wcpp-bs-container-badge">' + escHtml(ctx, contBadge) + "</span>" +
                    bedSelHtml +
                "</div>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7 Close</button>' +
            "</div>" +
            '<div class="wcpp-bs-modal-body">' +
                '<div class="wcpp-bs-playground-tools">' +
                    '<div class="wcpp-bs-playground-mode-group">' +
                        '<div class="wcpp-bs-mode-segmented" role="group" aria-label="Playground Interaction Mode">' + toolButtons + "</div>" +
                        '<div class="wcpp-bs-toolbar-group">' +
                            '<button type="button" class="wcpp-bs-chip-toggle' + (pg.showGrid ? " is-on" : "") + '" data-action="pg-toggle-grid">' + escHtml(ctx, (typeof ctx.formatAxisMeasurement === "function" && typeof ctx.getDefaultPlaygroundGridCm === "function" ? ctx.formatAxisMeasurement(ctx.getDefaultPlaygroundGridCm(block), pg.axisUnit || (isImp ? "ft" : "cm")) : (isImp ? "1 ft" : "30 cm")) + " Grid: " + (pg.showGrid ? "ON" : "OFF")) + "</button>" +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="pg-undo"' + (pg.undoStack.length ? "" : " disabled") + ">" + svgIcon(ctx, "undo", 12) + "<span>Undo</span></button>" +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="pg-redo"' + (pg.redoStack.length ? "" : " disabled") + ">" + svgIcon(ctx, "redo", 12) + "<span>Redo</span></button>" +
                            '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-danger wcpp-bs-btn-xs" data-action="pg-clear-all"' + (bedPlants.length ? "" : " disabled") + ">Clear All</button>" +
                        "</div>" +
                    "</div>" +
                    '<div class="wcpp-bs-pg-zoom-bar" id="wcppBsPgZoomBar">' +
                        '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                            '<span style="font-size:0.77rem; font-weight:800; color:var(--bs-muted);">Section Zoom:</span>' +
                            '<div class="wcpp-bs-segmented" role="group" aria-label="Bed Section Zoom">' + zoomButtons + "</div>" +
                        "</div>" +
                        '<span class="wcpp-bs-badge wcpp-bs-pg-zoom-badge" id="wcppBsPgZoomBadge">' + escHtml(ctx, zoomBadgeText) + "</span>" +
                    "</div>" +
                    '<div class="wcpp-bs-pg-pan-row" id="wcppBsPgPanRow"' + (z.isZoomed ? "" : " hidden") + ">" +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="pg-pan-prev"' + (!z.isZoomed || z.startCm <= 0.5 ? " disabled" : "") + ">&#8592; Prev</button>" +
                        '<input type="range" class="wcpp-bs-pg-pan-slider" id="wcppBsPgPanSlider" min="0" max="' + z.maxPan + '" step="1" value="' + z.startCm + '" aria-label="Pan Bed Section">' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs" data-action="pg-pan-next"' + (!z.isZoomed || z.startCm >= z.maxPan - 0.5 ? " disabled" : "") + ">Next &#8594;</button>" +
                        '<span class="wcpp-bs-pg-pan-label" id="wcppBsPgPanLabel">' + escHtml(ctx, zoomBadgeText) + "</span>" +
                    "</div>" +
                    '<div class="wcpp-bs-pg-tl-row">' +
                        '<span style="font-size:0.75rem; font-weight:800; color:var(--bs-muted);">Canopy Time-Lapse:</span>' +
                        '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-xs' + (!pg.timeLapseMonth ? " wcpp-bs-btn-primary" : "") + '" data-action="pg-tl-reset">Full Size</button>' +
                        '<input type="range" id="wcppBsPgTlSlider" min="1" max="12" step="1" value="' + (pg.timeLapseMonth || 6) + '" aria-label="Playground Growth Time-Lapse Month (Jan to Dec)" style="flex:1 1 120px; max-width:220px;">' +
                        '<span class="wcpp-bs-badge" id="wcppBsPgTlBadge">' + escHtml(ctx, pg.timeLapseMonth ? (["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][pg.timeLapseMonth - 1] + " Growth") : "Mature Canopy") + "</span>" +
                    "</div>" +
                "</div>" +
                '<div class="wcpp-bs-playground-grid">' +
                    '<div>' +
                        '<div class="wcpp-bs-playground-canvas-wrap' + modeCls + '" id="wcppBsPlaygroundCanvasWrap">' +
                            '<div class="wcpp-bs-farm-drag-hud" id="wcppBsPgDragHud" hidden></div>' +
                            '<svg id="wcppBsPlaygroundSvg" viewBox="' + svgData.vb.x + " " + svgData.vb.y + " " + svgData.vb.w + " " + svgData.vb.h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Interactive to-scale bed and container plant playground">' +
                                svgData.innerHtml +
                            "</svg>" +
                        "</div>" +
                        '<div id="wcppBsPgSummaryHost">' + renderPlaygroundSummaryHtml(ctx, block, analysis, bCtx.season, bedNumber) + "</div>" +
                    "</div>" +
                    '<div>' +
                        '<div class="wcpp-bs-card" style="padding:12px; display:flex; flex-direction:column; gap:8px;">' +
                            '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
                                "<strong>Drop / Auto-Fill Crop (" + (catalog ? catalog.crops.length : 389) + " Species)</strong>" +
                                '<span class="wcpp-bs-badge wcpp-bs-status-ok" id="wcppBsPgActiveRecBadge">Rec: ' + activeDensity.plantsPerSqFt + " / ft\u00b2</span>" +
                            "</div>" +
                            '<div class="wcpp-bs-crop-picker">' +
                                '<input type="text" class="wcpp-bs-crop-search" id="wcppPgCropSearch" value="' + escHtml(ctx, pg.cropSearchText) + '" placeholder="Search crop, native, Latin name..." autocomplete="off">' +
                                '<div class="wcpp-bs-crop-dropdown" id="wcppPgCropDropdown"' + (pg.cropDropdownOpen ? "" : " hidden") + ">" + cropDropdownHtml + "</div>" +
                            "</div>" +
                            '<div id="wcppBsPgDropHint" style="font-size:0.75rem; color:var(--bs-muted);">Left-click soil to place 1 <strong>' + escHtml(ctx, pg.activeCropName) + "</strong> \u00b7 Click any placed plant to select &amp; click <strong>\u00d7</strong> to remove \u00b7 Right-click to exit placing.</div>" +
                        "</div>" +
                        '<div id="wcppBsPgDensityHost">' + renderPlaygroundDensityCardHtml(ctx, block, bedPlants) + "</div>" +
                        '<div id="wcppBsPgInspectorHost">' + renderPlaygroundInspectorHtml(ctx, block, bedPlants) + "</div>" +
                    "</div>" +
                "</div>" +
            "</div>" +
            '<div class="wcpp-bs-modal-footer">' +
                '<div class="wcpp-bs-pg-footer-actions">' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="pg-export-svg">' + svgIcon(ctx, "download", 13) + "<span>Export Map (.svg)</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="pg-print-bed">' + svgIcon(ctx, "print", 13) + "<span>Print This Bed</span></button>" +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="pg-print-qr-stakes">' + svgIcon(ctx, "print", 13) + "<span>Print QR Stakes</span></button>" +
                "</div>" +
                '<div class="wcpp-bs-toolbar-group">' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-secondary" data-action="close-modal">Done</button>' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary" data-action="pg-sync-schedule">' + svgIcon(ctx, "check", 14) + "<span>Sync to Season Schedule</span></button>" +
                "</div>" +
            "</div>" +
        "</div>";
    }

    function closePlaygroundDropdowns() {
        if (!_playground) return;
        if (_playground.cropDropdownOpen || _playground.replaceDropdownOpen) {
            _playground.cropDropdownOpen = false;
            _playground.replaceDropdownOpen = false;
            const pgDd = document.getElementById("wcppPgCropDropdown");
            const repDd = document.getElementById("wcppPgReplaceDropdown");
            if (pgDd) pgDd.hidden = true;
            if (repDd) repDd.hidden = true;
        }
    }

    function handlePlaygroundModalClick(ctx, act, actEl, backdrop, e) {
        rememberCtx(ctx);
        if (!_playground) return false;
        if (e && e.target && e.target.closest && !e.target.closest(".wcpp-bs-crop-picker")) {
            closePlaygroundDropdowns();
        }
        if (!act) return false;
        const c = core(ctx);
        const state = getState(ctx);
        const catalog = getCatalog(ctx);

        if (act === "close-modal") {
            if (ctx && typeof ctx.closeModal === "function") ctx.closeModal();
            return true;
        }
        if (act === "pg-set-tool") {
            _playground.tool = actEl.getAttribute("data-tool") || "drop";
            if (backdrop) {
                backdrop.querySelectorAll('[data-action="pg-set-tool"]').forEach(function (btn) {
                    btn.classList.toggle("is-active", btn.getAttribute("data-tool") === _playground.tool);
                });
            }
            syncPlaygroundInPlace(ctx);
            return true;
        }
        if (act === "pg-toggle-grid") {
            _playground.showGrid = !_playground.showGrid;
            const isImp = state && state.units === "imperial";
            actEl.classList.toggle("is-on", _playground.showGrid);
            actEl.textContent = (isImp ? "1 ft\u00b2 Grid: " : "25 cm Grid: ") + (_playground.showGrid ? "ON" : "OFF");
            syncPlaygroundInPlace(ctx);
            return true;
        }
        if (act === "pg-undo") {
            undoPlayground(ctx);
            return true;
        }
        if (act === "pg-redo") {
            redoPlayground(ctx);
            return true;
        }
        if (act === "pg-clear-all") {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (!bCtx.season || !bCtx.block) return true;
            pushPlaygroundUndo(ctx);
            if (ctx && typeof ctx.commitStateChange === "function") {
                ctx.commitStateChange(function (st) {
                    setPlaygroundBedPlants(c.getActiveSeason(st), bCtx.block.id, bCtx.bedNumber, []);
                }, { rehydrate: false });
            }
            _playground.selectedSpecimenId = null;
            syncPlaygroundInPlace(ctx);
            showToast(ctx, "Cleared placed plants on this bed.");
            return true;
        }
        if (act === "pg-pick-crop") {
            const crop = catalog ? c.resolveCrop(catalog.cropMap, actEl.getAttribute("data-crop")) : null;
            if (crop) {
                _playground.activeCropName = crop.name;
                _playground.cropSearchText = crop.name;
                _playground.cropDropdownOpen = false;
                const inp = document.getElementById("wcppPgCropSearch");
                if (inp) inp.value = crop.name;
                const dd = document.getElementById("wcppPgCropDropdown");
                if (dd) dd.hidden = true;
                const bCtx = getPlaygroundBlockAndBed(ctx);
                const bounds = bCtx.block ? c.getPlaygroundBounds(bCtx.block) : { depthCm: null };
                const rec = c.computeRecommendedDensity(crop, catalog, bounds.depthCm);
                const recBadge = document.getElementById("wcppBsPgActiveRecBadge");
                if (recBadge) recBadge.textContent = "Rec: " + rec.plantsPerSqFt + " / ft\u00b2";
                const dropBtn = document.getElementById("wcppBsPgDropBtn");
                if (dropBtn) dropBtn.textContent = "Drop " + crop.name;
                const dropHint = document.getElementById("wcppBsPgDropHint");
                if (dropHint) dropHint.innerHTML = "Left-click soil to place 1 <strong>" + escHtml(ctx, crop.name) + "</strong> \u00b7 Click any placed plant to select &amp; click <strong>\u00d7</strong> to remove \u00b7 Right-click to exit placing.";
                syncPlaygroundInPlace(ctx);
            }
            return true;
        }
        if (act === "pg-set-density-mult") {
            _playground.densityMultiplier = Number(actEl.getAttribute("data-mult") || 1);
            _playground.customCountOverride = "";
            syncPlaygroundInPlace(ctx);
            return true;
        }
        if (act === "pg-apply-recommended") {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (!bCtx.season || !bCtx.block) return true;
            const existing = getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber);
            const tCount = (_playground.customCountOverride && Number(_playground.customCountOverride) > 0)
                ? Math.round(Number(_playground.customCountOverride))
                : undefined;
            const batch = c.generateRecommendedPlaygroundPlants(bCtx.block, bCtx.bedNumber, _playground.activeCropName, catalog, {
                zone: _playground.zone,
                densityMultiplier: _playground.densityMultiplier,
                targetCount: tCount,
                keepExisting: _playground.keepExisting,
                existingPlants: existing,
                startDate: bCtx.season.year + "-05-01"
            });
            pushPlaygroundUndo(ctx);
            const nextPlants = _playground.keepExisting ? existing.concat(batch) : batch;
            if (ctx && typeof ctx.commitStateChange === "function") {
                ctx.commitStateChange(function (st) {
                    setPlaygroundBedPlants(c.getActiveSeason(st), bCtx.block.id, bCtx.bedNumber, nextPlants);
                }, { rehydrate: false });
            }
            if (batch.length) _playground.selectedSpecimenId = batch[0].id;
            syncPlaygroundInPlace(ctx);
            showToast(ctx, "Placed " + batch.length + " " + _playground.activeCropName + " plant" + (batch.length === 1 ? "" : "s") + ".");
            return true;
        }
        if (act === "pg-load-schedule") {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (!bCtx.season || !bCtx.block) return true;
            const hydrated = c.hydratePlacedPlantsFromSchedule(bCtx.block, bCtx.bedNumber, bCtx.season, catalog);
            if (!hydrated || !hydrated.length) {
                showToast(ctx, "No scheduled plantings on this bed yet \u2014 drop plants or apply recommended density.");
                return true;
            }
            pushPlaygroundUndo(ctx);
            if (ctx && typeof ctx.commitStateChange === "function") {
                ctx.commitStateChange(function (st) {
                    setPlaygroundBedPlants(c.getActiveSeason(st), bCtx.block.id, bCtx.bedNumber, hydrated);
                }, { rehydrate: false });
            }
            _playground.selectedSpecimenId = hydrated[0] ? hydrated[0].id : null;
            syncPlaygroundInPlace(ctx);
            showToast(ctx, "Loaded " + hydrated.length + " plant(s) from Season Schedule.");
            return true;
        }
        if (act === "pg-replace-pick" && _playground.selectedSpecimenId) {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (!bCtx.season || !bCtx.block) return true;
            const crop = catalog ? c.resolveCrop(catalog.cropMap, actEl.getAttribute("data-crop")) : null;
            if (!crop) return true;
            const bounds = c.getPlaygroundBounds(bCtx.block);
            const newDen = c.computeRecommendedDensity(crop, catalog, bounds.depthCm);
            const curPlants = clonePlacedPlantsList(getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber));
            const idx = curPlants.findIndex(function (pp) { return pp.id === _playground.selectedSpecimenId; });
            if (idx >= 0) {
                pushPlaygroundUndo(ctx);
                const margin = Math.max(1, Math.min(newDen.canopyRadiusCm * 0.35, Math.min(bounds.widthCm, bounds.heightCm) * 0.12, 6));
                const clamped = c.clampPointToPlayground(curPlants[idx].xCm, curPlants[idx].yCm, bCtx.block, margin);
                curPlants[idx].cropName = newDen.cropName;
                curPlants[idx].radiusCm = newDen.canopyRadiusCm;
                curPlants[idx].xCm = clamped.xCm;
                curPlants[idx].yCm = clamped.yCm;
                if (ctx && typeof ctx.commitStateChange === "function") {
                    ctx.commitStateChange(function (st) {
                        setPlaygroundBedPlants(c.getActiveSeason(st), bCtx.block.id, bCtx.bedNumber, curPlants);
                    }, { rehydrate: false });
                }
                _playground.replaceSearchText = "";
                _playground.replaceDropdownOpen = false;
                syncPlaygroundInPlace(ctx);
                showToast(ctx, "Replaced specimen with " + newDen.cropName + ".");
            }
            return true;
        }
        if (act === "pg-duplicate-specimen" && _playground.selectedSpecimenId) {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (!bCtx.season || !bCtx.block) return true;
            const curPlants = clonePlacedPlantsList(getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber));
            const sel = curPlants.find(function (pp) { return pp.id === _playground.selectedSpecimenId; });
            if (!sel) return true;
            const bounds = c.getPlaygroundBounds(bCtx.block);
            const margin = Math.max(1, Math.min(sel.radiusCm * 0.35, Math.min(bounds.widthCm, bounds.heightCm) * 0.12, 6));
            const step = Math.max(4, sel.radiusCm * 1.45);
            let chosen = null;
            for (let ai = 0; ai < 8; ai++) {
                const ang = (ai * Math.PI) / 4;
                const tx = sel.xCm + Math.cos(ang) * step;
                const ty = sel.yCm + Math.sin(ang) * step;
                if (c.isPointInsidePlayground(tx, ty, bCtx.block, margin)) {
                    chosen = { xCm: +tx.toFixed(1), yCm: +ty.toFixed(1) };
                    break;
                }
            }
            if (!chosen) {
                chosen = c.clampPointToPlayground(sel.xCm + step * 0.5, sel.yCm + step * 0.5, bCtx.block, margin);
            }
            pushPlaygroundUndo(ctx);
            const cloneSpec = c.normalizePlacedPlant({
                blockId: bCtx.block.id,
                bedNumber: bCtx.bedNumber,
                cropName: sel.cropName,
                xCm: chosen.xCm,
                yCm: chosen.yCm,
                radiusCm: sel.radiusCm,
                role: sel.role,
                startDate: sel.startDate,
                notes: sel.notes
            }, curPlants.length, bCtx.season.year);
            curPlants.push(cloneSpec);
            if (ctx && typeof ctx.commitStateChange === "function") {
                ctx.commitStateChange(function (st) {
                    setPlaygroundBedPlants(c.getActiveSeason(st), bCtx.block.id, bCtx.bedNumber, curPlants);
                }, { rehydrate: false });
            }
            _playground.selectedSpecimenId = cloneSpec.id;
            syncPlaygroundInPlace(ctx);
            return true;
        }
        if (act === "pg-delete-specimen" && _playground.selectedSpecimenId) {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (!bCtx.season || !bCtx.block) return true;
            const delId = _playground.selectedSpecimenId;
            const curPlants = getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber).filter(function (pp) {
                return pp.id !== delId;
            });
            pushPlaygroundUndo(ctx);
            if (ctx && typeof ctx.commitStateChange === "function") {
                ctx.commitStateChange(function (st) {
                    setPlaygroundBedPlants(c.getActiveSeason(st), bCtx.block.id, bCtx.bedNumber, curPlants);
                }, { rehydrate: false });
            }
            _playground.selectedSpecimenId = null;
            syncPlaygroundInPlace(ctx);
            showToast(ctx, "Deleted plant specimen.");
            return true;
        }
        if (act === "pg-filter-species") {
            const spName = actEl.getAttribute("data-crop");
            _playground.highlightSpecies = _playground.highlightSpecies === spName ? null : spName;
            syncPlaygroundInPlace(ctx);
            return true;
        }
        if (act === "pg-sync-schedule") {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (!bCtx.season || !bCtx.block) return true;
            let synced = [];
            if (ctx && typeof ctx.commitStateChange === "function") {
                ctx.commitStateChange(function (st) {
                    const s = c.getActiveSeason(st);
                    synced = c.syncPlacedPlantsToSchedule(s, bCtx.block.id, bCtx.bedNumber, catalog);
                }, { rehydrate: true });
            }
            const totalPlaced = synced.reduce(function (sum, pl) { return sum + (Number(pl.placedCountOverride) || 0); }, 0);
            syncPlaygroundInPlace(ctx);
            showToast(ctx, synced.length
                ? ("Synced " + synced.length + " crop(s) (" + totalPlaced + " plants) to Season Schedule & Seed Orders.")
                : "Cleared scheduled plantings for this bed.");
            return true;
        }
        if (act === "pg-edit-media") {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (bCtx.block) {
                openContainerModal(ctx, {
                    blockId: bCtx.block.id,
                    bedNumber: bCtx.bedNumber,
                    returnToPlayground: true
                });
            }
            return true;
        }
        if (act === "pg-set-zoom") {
            const nextZoom = actEl.getAttribute("data-zoom") || "full";
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (!bCtx.block) return true;
            const bounds = c.getPlaygroundBounds(bCtx.block);
            _playground.zoomMode = nextZoom;
            const z = getPlaygroundZoomState(ctx, bounds);
            _playground.zoomMode = z.mode;
            _playground.panStartCm = z.startCm;
            syncPlaygroundInPlace(ctx);
            return true;
        }
        if (act === "pg-pan-prev" || act === "pg-pan-next") {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (!bCtx.block) return true;
            const bounds = c.getPlaygroundBounds(bCtx.block);
            const z = getPlaygroundZoomState(ctx, bounds);
            if (!z.isZoomed) return true;
            const delta = act === "pg-pan-next" ? z.winW : -z.winW;
            _playground.panStartCm = Math.max(0, Math.min(z.maxPan, +(z.startCm + delta).toFixed(2)));
            syncPlaygroundInPlace(ctx);
            return true;
        }
        if (act === "pg-export-svg") {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (!bCtx.season || !bCtx.block || typeof c.exportPlaygroundSvg !== "function") return true;
            const bounds = c.getPlaygroundBounds(bCtx.block);
            const z = getPlaygroundZoomState(ctx, bounds);
            const bedPlants = getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber);
            const analysis = c.analyzePlaygroundBed(bCtx.block, bCtx.bedNumber, bCtx.season.placedPlants || [], catalog);
            const svgOpts = {
                units: (state && state.units) || "metric",
                showGrid: Boolean(_playground.showGrid),
                showLabels: true,
                analysis: analysis
            };
            if (z.isZoomed && bounds.shapeKind === "rectangle") {
                svgOpts.sectionStartCm = z.startCm;
                svgOpts.sectionEndCm = z.endCm;
            }
            const svgStr = c.exportPlaygroundSvg(bCtx.block, bCtx.bedNumber, bedPlants, catalog, svgOpts);
            if (svgStr) {
                const baseName = (bCtx.block.name || "bed") + (Number(bCtx.block.bedCount || 1) > 1 || bCtx.bedNumber > 1 ? ("-bed-" + bCtx.bedNumber) : "");
                const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bed";
                const url = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = slug + "-planting-map.svg";
                a.click();
                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
                showToast(ctx, "Exported " + a.download);
            }
            return true;
        }
        if (act === "pg-print-bed") {
            printPlaygroundBed(ctx);
            return true;
        }
        if (act === "pg-tl-reset") {
            _playground.timeLapseMonth = 0;
            const bdg = document.getElementById("wcppBsPgTlBadge");
            if (bdg) bdg.textContent = "Mature Canopy";
            syncPlaygroundInPlace(ctx);
            return true;
        }
        if (act === "pg-print-qr-stakes") {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (ctx && typeof ctx.ensureV6ModuleLoaded === "function") {
                ctx.ensureV6ModuleLoaded().then(function (v6m) {
                    if (v6m && typeof v6m.openPrintQrStakes === "function") {
                        v6m.openPrintQrStakes(ctx.getV6Ctx(), bCtx.season, bCtx.block ? bCtx.block.id : "");
                    }
                }).catch(function () { showToast(ctx, "Could not load QR Stakes module."); });
            }
            return true;
        }
        return false;
    }

    function handlePlaygroundModalFocusIn(ctx, t) {
        rememberCtx(ctx);
        if (!_playground || !t) return false;
        const c = core(ctx);
        if (t.id === "wcppPgCropSearch") {
            _playground.cropDropdownOpen = true;
            _playground.replaceDropdownOpen = false;
            const repDd = document.getElementById("wcppPgReplaceDropdown");
            if (repDd) repDd.hidden = true;
            const dd = document.getElementById("wcppPgCropDropdown");
            if (dd) {
                const bCtx = getPlaygroundBlockAndBed(ctx);
                const bounds = bCtx.block ? c.getPlaygroundBounds(bCtx.block) : { depthCm: null };
                const q = t.value === _playground.activeCropName ? "" : t.value;
                dd.innerHTML = getPlaygroundCropDropdownHtml(ctx, q, "pg-pick-crop", _playground.activeCropName, bounds.depthCm);
                dd.hidden = false;
                if (t.value === _playground.activeCropName && typeof t.select === "function") {
                    try { t.select(); } catch (_) {}
                }
            }
            return true;
        }
        if (t.id === "wcppPgReplaceSearch") {
            _playground.replaceDropdownOpen = true;
            _playground.cropDropdownOpen = false;
            const pgDd = document.getElementById("wcppPgCropDropdown");
            if (pgDd) pgDd.hidden = true;
            const dd = document.getElementById("wcppPgReplaceDropdown");
            if (dd) {
                const bCtx = getPlaygroundBlockAndBed(ctx);
                const bounds = bCtx.block ? c.getPlaygroundBounds(bCtx.block) : { depthCm: null };
                dd.innerHTML = getPlaygroundCropDropdownHtml(ctx, _playground.replaceSearchText, "pg-replace-pick", null, bounds.depthCm);
                dd.hidden = false;
            }
            return true;
        }
        return false;
    }

    function handlePlaygroundModalInput(ctx, t) {
        rememberCtx(ctx);
        if (!_playground || !t) return false;
        const c = core(ctx);
        const catalog = getCatalog(ctx);
        if (t.id === "wcppPgCropSearch") {
            _playground.cropSearchText = t.value;
            _playground.cropDropdownOpen = true;
            const dd = document.getElementById("wcppPgCropDropdown");
            if (dd && catalog) {
                const bCtx = getPlaygroundBlockAndBed(ctx);
                const bounds = bCtx.block ? c.getPlaygroundBounds(bCtx.block) : { depthCm: null };
                dd.innerHTML = getPlaygroundCropDropdownHtml(ctx, _playground.cropSearchText, "pg-pick-crop", _playground.activeCropName, bounds.depthCm);
                dd.hidden = false;
            }
            return true;
        }
        if (t.id === "wcppPgReplaceSearch") {
            _playground.replaceSearchText = t.value;
            _playground.replaceDropdownOpen = true;
            const dd = document.getElementById("wcppPgReplaceDropdown");
            if (dd && catalog) {
                const bCtx = getPlaygroundBlockAndBed(ctx);
                const bounds = bCtx.block ? c.getPlaygroundBounds(bCtx.block) : { depthCm: null };
                dd.innerHTML = getPlaygroundCropDropdownHtml(ctx, _playground.replaceSearchText, "pg-replace-pick", null, bounds.depthCm);
                dd.hidden = false;
            }
            return true;
        }
        if (t.id === "wcppBsPgPanSlider") {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (bCtx.block) {
                const bounds = c.getPlaygroundBounds(bCtx.block);
                const z0 = getPlaygroundZoomState(ctx, bounds);
                _playground.panStartCm = Math.max(0, Math.min(z0.maxPan, Number(t.value) || 0));
                syncPlaygroundZoomAndSvgOnly(ctx);
            }
            return true;
        }
        if (t.id === "wcppBsPgTlSlider") {
            const mo = Math.max(1, Math.min(12, Number(t.value) || 6));
            _playground.timeLapseMonth = mo;
            const bdg = document.getElementById("wcppBsPgTlBadge");
            if (bdg) bdg.textContent = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][mo - 1] + " Growth";
            syncPlaygroundInPlace(ctx);
            return true;
        }
        if (t.getAttribute("data-pg-input") === "customCount") {
            _playground.customCountOverride = t.value;
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (bCtx.block) {
                const bounds = c.getPlaygroundBounds(bCtx.block);
                const density = c.computeRecommendedDensity(_playground.activeCropName, catalog, bounds.depthCm);
                const prevSpan = document.getElementById("wcppBsPgTargetPreview");
                if (prevSpan) {
                    prevSpan.textContent = "Apply Recommended Plants (" + computePlaygroundTargetCountPreview(density, bounds) + ")";
                }
            }
            return true;
        }
        return false;
    }

    function handlePlaygroundModalChange(ctx, t) {
        rememberCtx(ctx);
        if (!_playground || !t) return false;
        const c = core(ctx);
        if (t.id === "wcppBsPgPanSlider") {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (bCtx.block) {
                const bounds = c.getPlaygroundBounds(bCtx.block);
                const z0 = getPlaygroundZoomState(ctx, bounds);
                _playground.panStartCm = Math.max(0, Math.min(z0.maxPan, Number(t.value) || 0));
                syncPlaygroundZoomAndSvgOnly(ctx);
            }
            return true;
        }
        if (t.id === "wcppBsPgTlSlider") {
            const mo = Math.max(1, Math.min(12, Number(t.value) || 6));
            _playground.timeLapseMonth = mo;
            const bdg = document.getElementById("wcppBsPgTlBadge");
            if (bdg) bdg.textContent = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][mo - 1] + " Growth";
            syncPlaygroundInPlace(ctx);
            return true;
        }
        const pgAct = t.getAttribute("data-action");
        if (pgAct === "pg-change-bed") {
            _playground.bedNumber = Math.max(1, Number(t.value) || 1);
            _playground.selectedSpecimenId = null;
            _playground.zoomMode = "full";
            _playground.panStartCm = 0;
            _playground.undoStack = [];
            _playground.redoStack = [];
            if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
            return true;
        }
        if (pgAct === "pg-change-zone") {
            _playground.zone = t.value || "whole";
            syncPlaygroundInPlace(ctx);
            return true;
        }
        if (pgAct === "pg-toggle-keep-existing") {
            _playground.keepExisting = Boolean(t.checked);
            return true;
        }
        if (pgAct === "pg-specimen-role" && _playground.selectedSpecimenId) {
            const bCtx = getPlaygroundBlockAndBed(ctx);
            if (bCtx.season && bCtx.block) {
                const curPlants = clonePlacedPlantsList(getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber));
                const idx = curPlants.findIndex(function (pp) { return pp.id === _playground.selectedSpecimenId; });
                if (idx >= 0) {
                    pushPlaygroundUndo(ctx);
                    curPlants[idx].role = t.value || "primary";
                    if (ctx && typeof ctx.commitStateChange === "function") {
                        ctx.commitStateChange(function (st) {
                            setPlaygroundBedPlants(c.getActiveSeason(st), bCtx.block.id, bCtx.bedNumber, curPlants);
                        }, { rehydrate: false });
                    }
                    syncPlaygroundInPlace(ctx);
                }
            }
            return true;
        }
        return false;
    }

    function onPlaygroundPointerDown(ctx, e) {
        rememberCtx(ctx);
        if (!_playground) return false;
        const svg = e.target && e.target.closest ? e.target.closest("#wcppBsPlaygroundSvg") : null;
        if (!svg) return false;
        if (e.button === 2) {
            if (_playground.tool === "drop" || _playground.tool === "delete") {
                e.preventDefault();
                _playground.tool = "select";
                const backdrop = document.getElementById("wcppBsModalBackdrop");
                if (backdrop) {
                    backdrop.querySelectorAll('[data-action="pg-set-tool"]').forEach(function (btn) {
                        btn.classList.toggle("is-active", btn.getAttribute("data-tool") === "select");
                    });
                }
                const wrap = document.getElementById("wcppBsPlaygroundCanvasWrap");
                if (wrap) {
                    wrap.classList.remove("is-mode-drop", "is-mode-delete");
                    wrap.classList.add("is-mode-select");
                }
                if (!svg.__wcppPgCtxBound) {
                    svg.__wcppPgCtxBound = true;
                    svg.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
                }
                showToast(ctx, "Exited placing mode — switched to Select / Move.");
                return true;
            }
            return false;
        }
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return false;
        const c = core(ctx);
        const catalog = getCatalog(ctx);
        const bCtx = getPlaygroundBlockAndBed(ctx);
        if (!bCtx.season || !bCtx.block) return false;

        const quickDelEl = e.target && e.target.closest ? e.target.closest("[data-pg-quick-delete-id]") : null;
        if (quickDelEl) {
            e.preventDefault();
            const delId = quickDelEl.getAttribute("data-pg-quick-delete-id");
            const curList = getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber);
            const removed = curList.find(function (pp) { return pp.id === delId; });
            const nextList = curList.filter(function (pp) { return pp.id !== delId; });
            pushPlaygroundUndo(ctx);
            if (ctx && typeof ctx.commitStateChange === "function") {
                ctx.commitStateChange(function (st) {
                    setPlaygroundBedPlants(c.getActiveSeason(st), bCtx.block.id, bCtx.bedNumber, nextList);
                }, { rehydrate: false });
            }
            if (_playground.selectedSpecimenId === delId) _playground.selectedSpecimenId = null;
            syncPlaygroundInPlace(ctx);
            showToast(ctx, "Removed " + (removed ? removed.cropName : "plant") + ".");
            return true;
        }

        const specEl = e.target.closest("[data-specimen-id]");
        const coords = clientToSvgCoords(ctx, svg, e.clientX, e.clientY);

        if (_playground.tool === "delete") {
            if (specEl) {
                e.preventDefault();
                const delId = specEl.getAttribute("data-specimen-id");
                const nextList = getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber).filter(function (pp) {
                    return pp.id !== delId;
                });
                pushPlaygroundUndo(ctx);
                if (ctx && typeof ctx.commitStateChange === "function") {
                    ctx.commitStateChange(function (st) {
                        setPlaygroundBedPlants(c.getActiveSeason(st), bCtx.block.id, bCtx.bedNumber, nextList);
                    }, { rehydrate: false });
                }
                if (_playground.selectedSpecimenId === delId) _playground.selectedSpecimenId = null;
                syncPlaygroundInPlace(ctx);
                showToast(ctx, "Deleted plant specimen.");
            }
            return true;
        }

        if (_playground.tool === "drop") {
            if (!coords) return true;
            if (specEl) {
                const hitId = specEl.getAttribute("data-specimen-id");
                const curList = getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber);
                const hitPlant = curList.find(function (pp) { return pp.id === hitId; });
                if (hitPlant) {
                    const dist = Math.hypot(coords.x - Number(hitPlant.xCm || 0), coords.y - Number(hitPlant.yCm || 0));
                    const hitCore = Math.max(2.5, Math.min(Number(hitPlant.radiusCm || 8) * 0.55, 14));
                    if (dist <= hitCore) {
                        e.preventDefault();
                        _playground.selectedSpecimenId = hitId;
                        syncPlaygroundInPlace(ctx);
                        showToast(ctx, "Selected " + hitPlant.cropName + " — click \u00d7 to remove.");
                        return true;
                    }
                }
            }
            const bounds = c.getPlaygroundBounds(bCtx.block);
            const density = c.computeRecommendedDensity(_playground.activeCropName, catalog, bounds.depthCm);
            const margin = Math.max(1, Math.min(density.canopyRadiusCm * 0.35, Math.min(bounds.widthCm, bounds.heightCm) * 0.12, 6));
            const tol = Math.max(4, Math.min(bounds.widthCm, bounds.heightCm) * 0.08);
            const hitSoil = Boolean(e.target.closest("[data-pg-soil-surface], [data-specimen-id]"));
            const inside = c.isPointInsidePlayground(coords.x, coords.y, bCtx.block, 0);
            const nearBox = coords.x >= -tol && coords.x <= bounds.widthCm + tol && coords.y >= -tol && coords.y <= bounds.heightCm + tol;
            if (!hitSoil && !inside && !nearBox) {
                showToast(ctx, "Click inside the bed or container boundary to place a plant.");
                return true;
            }
            e.preventDefault();
            const pt = c.clampPointToPlayground(coords.x, coords.y, bCtx.block, margin);
            const existing = clonePlacedPlantsList(getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber));
            const role = _playground.zone === "center" ? "thriller" : (_playground.zone === "mid-ring" ? "filler" : (_playground.zone === "rim" ? "spiller" : "primary"));
            const newSpec = c.normalizePlacedPlant({
                blockId: bCtx.block.id,
                bedNumber: bCtx.bedNumber,
                cropName: density.cropName,
                xCm: pt.xCm,
                yCm: pt.yCm,
                radiusCm: density.canopyRadiusCm,
                role: role,
                startDate: bCtx.season.year + "-05-01"
            }, existing.length, bCtx.season.year);
            pushPlaygroundUndo(ctx);
            existing.push(newSpec);
            if (ctx && typeof ctx.commitStateChange === "function") {
                ctx.commitStateChange(function (st) {
                    setPlaygroundBedPlants(c.getActiveSeason(st), bCtx.block.id, bCtx.bedNumber, existing);
                }, { rehydrate: false });
            }
            _playground.selectedSpecimenId = newSpec.id;
            syncPlaygroundInPlace(ctx);
            return true;
        }

        if (_playground.tool === "select") {
            if (!specEl) {
                if (_playground.selectedSpecimenId) {
                    _playground.selectedSpecimenId = null;
                    syncPlaygroundInPlace(ctx);
                }
                return true;
            }
            e.preventDefault();
            const specId = specEl.getAttribute("data-specimen-id");
            const curPlants = getPlaygroundBedPlants(bCtx.season, bCtx.block.id, bCtx.bedNumber);
            const pp = curPlants.find(function (x) { return x.id === specId; });
            if (!pp) return true;
            _playground.selectedSpecimenId = specId;
            _playground.drag = {
                specimenId: specId,
                pointerId: e.pointerId,
                startClientX: e.clientX,
                startClientY: e.clientY,
                origXCm: pp.xCm,
                origYCm: pp.yCm,
                curXCm: pp.xCm,
                curYCm: pp.yCm,
                radiusCm: pp.radiusCm,
                cropName: pp.cropName,
                el: specEl,
                svg: svg,
                block: bCtx.block,
                bedNumber: bCtx.bedNumber,
                didMove: false
            };
            try { svg.setPointerCapture(e.pointerId); } catch (_) {}
            return true;
        }
        return false;
    }

    function onPlaygroundPointerMove(ctx, e) {
        if (!_playground || !_playground.drag) return false;
        const drag = _playground.drag;
        if (drag.pointerId !== undefined && e.pointerId !== undefined && e.pointerId !== drag.pointerId) return false;
        const coords = clientToSvgCoords(ctx, drag.svg, e.clientX, e.clientY);
        if (!coords) return false;
        if (!drag.didMove && Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) < 3) return true;
        drag.didMove = true;
        if (drag.el) drag.el.classList.add("is-dragging");
        const c = core(ctx);
        const state = getState(ctx);
        const bounds = c.getPlaygroundBounds(drag.block);
        const margin = Math.max(1, Math.min(drag.radiusCm * 0.35, Math.min(bounds.widthCm, bounds.heightCm) * 0.12, 6));
        const pt = c.clampPointToPlayground(coords.x, coords.y, drag.block, margin);
        drag.curXCm = pt.xCm;
        drag.curYCm = pt.yCm;
        if (drag.el) {
            drag.el.setAttribute("transform", "translate(" + pt.xCm.toFixed(2) + "," + pt.yCm.toFixed(2) + ")");
        }
        const hud = document.getElementById("wcppBsPgDragHud");
        if (hud) {
            const isImp = state && state.units === "imperial";
            hud.hidden = false;
            hud.textContent = "Moving " + drag.cropName + " \u00b7 " + (isImp ? (c.cmToIn(pt.xCm) + '", ' + c.cmToIn(pt.yCm) + '"') : (pt.xCm + " cm, " + pt.yCm + " cm"));
        }
        return true;
    }

    function endPlaygroundDrag(ctx, e, isCancel) {
        if (!_playground || !_playground.drag) return false;
        const drag = _playground.drag;
        if (e && drag.pointerId !== undefined && e.pointerId !== undefined && e.pointerId !== drag.pointerId) return false;
        _playground.drag = null;
        try {
            if (drag.svg && drag.pointerId !== undefined) {
                drag.svg.releasePointerCapture(drag.pointerId);
            }
        } catch (_) {}
        if (drag.el) drag.el.classList.remove("is-dragging");
        const hud = document.getElementById("wcppBsPgDragHud");
        if (hud) {
            hud.hidden = true;
            hud.textContent = "";
        }
        if (!isCancel && drag.didMove) {
            const c = core(ctx);
            const state = getState(ctx);
            const season = state ? c.getActiveSeason(state) : null;
            if (season) {
                const curPlants = clonePlacedPlantsList(getPlaygroundBedPlants(season, drag.block.id, drag.bedNumber));
                const idx = curPlants.findIndex(function (pp) { return pp.id === drag.specimenId; });
                if (idx >= 0) {
                    pushPlaygroundUndo(ctx);
                    curPlants[idx].xCm = drag.curXCm;
                    curPlants[idx].yCm = drag.curYCm;
                    if (ctx && typeof ctx.commitStateChange === "function") {
                        ctx.commitStateChange(function (st) {
                            setPlaygroundBedPlants(c.getActiveSeason(st), drag.block.id, drag.bedNumber, curPlants);
                        }, { rehydrate: false });
                    }
                }
            }
        }
        _playground.selectedSpecimenId = drag.specimenId;
        syncPlaygroundInPlace(ctx);
        return true;
    }

    // Unified Pointer Controllers
    function onPointerDown(ctx, e) {
        const mode = getModalMode(ctx);
        if (mode === "playground") return onPlaygroundPointerDown(ctx, e);
        if (mode === "shape") return onShapePointerDown(ctx, e);
        return false;
    }

    function onMove(ctx, e) {
        const mode = getModalMode(ctx);
        if (mode === "playground" && _playground && _playground.drag) return onPlaygroundPointerMove(ctx, e);
        if (mode === "shape" && _shapeDesigner && _shapeDesigner.drag) return onShapePointerMove(ctx, e);
        return false;
    }

    function onUp(ctx, e, isCancel) {
        let handled = false;
        if (_shapeDesigner && _shapeDesigner.drag) {
            handled = endShapeDrag(ctx) || handled;
        }
        if (_playground && _playground.drag) {
            handled = endPlaygroundDrag(ctx, e, Boolean(isCancel)) || handled;
        }
        return handled;
    }

    function ensureStudioPointerListeners(ctx, backdrop) {
        rememberCtx(ctx);
        const bd = backdrop || document.getElementById("wcppBsModalBackdrop");
        if (bd && !bd.dataset.wcppBsStudioPtrBound) {
            bd.dataset.wcppBsStudioPtrBound = "1";
            bd.addEventListener("pointerdown", function (e) {
                onPointerDown(_activeCtx || ctx, e);
            });
        }
        if (!_docPointerBound) {
            _docPointerBound = true;
            document.addEventListener("pointermove", function (e) {
                onMove(_activeCtx || ctx, e);
            });
            document.addEventListener("pointerup", function (e) {
                onUp(_activeCtx || ctx, e, false);
            });
            document.addEventListener("pointercancel", function (e) {
                onUp(_activeCtx || ctx, e, true);
            });
        }
    }

    function attachShapeModalPointerEvents(ctx, backdrop) {
        ensureStudioPointerListeners(ctx, backdrop);
    }

    function attachPlaygroundPointerEvents(ctx, backdrop) {
        ensureStudioPointerListeners(ctx, backdrop);
    }

    // =========================================================================
    // 4. V5 CURATED BC STARTER BLUEPRINTS GALLERY MODAL
    // =========================================================================
    function openBlueprintsGallery(ctx, opts) {
        rememberCtx(ctx);
        _blueprintsState = {
            selectedId: (opts && opts.selectedId) || null
        };
        setModalMode(ctx, "blueprints");
        if (ctx && typeof ctx.renderModal === "function") ctx.renderModal();
        return Promise.resolve();
    }

    function buildBlueprintPreviewSvg(bpId) {
        if (bpId === "surrey-patio-balcony") {
            return '<svg viewBox="0 0 220 96" aria-hidden="true">' +
                '<rect x="4" y="4" width="212" height="88" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>' +
                '<rect x="16" y="14" width="188" height="10" rx="3" fill="#92400e" fill-opacity="0.25" stroke="#92400e" stroke-width="1.2"/>' +
                '<circle cx="46" cy="48" r="15" fill="#ecfdf5" stroke="#0f766e" stroke-width="2" stroke-dasharray="3 2"/>' +
                '<circle cx="46" cy="48" r="6" fill="#0f766e" fill-opacity="0.35"/>' +
                '<circle cx="90" cy="48" r="13" fill="#ecfdf5" stroke="#0f766e" stroke-width="2" stroke-dasharray="3 2"/>' +
                '<circle cx="90" cy="48" r="5" fill="#0f766e" fill-opacity="0.35"/>' +
                '<circle cx="132" cy="42" r="10" fill="#fffbeb" stroke="#9a3412" stroke-width="1.6"/>' +
                '<circle cx="160" cy="42" r="10" fill="#fffbeb" stroke="#9a3412" stroke-width="1.6"/>' +
                '<circle cx="188" cy="42" r="10" fill="#fffbeb" stroke="#9a3412" stroke-width="1.6"/>' +
                '<rect x="122" y="62" width="80" height="20" rx="3" fill="#fef3c7" stroke="#92400e" stroke-width="1.6"/>' +
            "</svg>";
        }
        if (bpId === "coast-salish-pollinator") {
            return '<svg viewBox="0 0 220 96" aria-hidden="true">' +
                '<rect x="4" y="4" width="212" height="88" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>' +
                '<path d="M 62,16 A 32,32 0 1,1 48,74 L 54,56 A 12,12 0 1,0 62,36 Z" fill="#ecfdf5" stroke="#166534" stroke-width="2"/>' +
                '<path d="M 108,68 Q 148,18 192,48 Q 152,44 120,76 Z" fill="#dcfce7" stroke="#15803d" stroke-width="2"/>' +
                '<circle cx="62" cy="48" r="5" fill="#d97706" fill-opacity="0.5"/>' +
                '<circle cx="148" cy="40" r="4.5" fill="#7c3aed" fill-opacity="0.45"/>' +
                '<circle cx="168" cy="44" r="4.5" fill="#0f766e" fill-opacity="0.45"/>' +
                '<rect x="14" y="14" width="12" height="68" rx="4" fill="#14532d" fill-opacity="0.24" stroke="#14532d" stroke-width="1.2"/>' +
            "</svg>";
        }
        return '<svg viewBox="0 0 220 96" aria-hidden="true">' +
            '<rect x="4" y="4" width="212" height="88" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>' +
            '<rect x="16" y="18" width="94" height="12" rx="2" fill="#ecfdf5" stroke="#166534" stroke-width="1.5"/>' +
            '<rect x="16" y="34" width="94" height="12" rx="2" fill="#ecfdf5" stroke="#166534" stroke-width="1.5"/>' +
            '<rect x="16" y="50" width="94" height="12" rx="2" fill="#ecfdf5" stroke="#166534" stroke-width="1.5"/>' +
            '<rect x="16" y="66" width="94" height="12" rx="2" fill="#ecfdf5" stroke="#166534" stroke-width="1.5"/>' +
            '<rect x="13" y="15" width="100" height="34" rx="5" fill="#0ea5e9" fill-opacity="0.14" stroke="#0369a1" stroke-width="1.3" stroke-dasharray="4 2"/>' +
            '<rect x="124" y="18" width="46" height="36" rx="4" fill="#e0f2fe" stroke="#0369a1" stroke-width="1.6"/>' +
            '<rect x="124" y="62" width="40" height="20" rx="3" fill="#e2e8f0" stroke="#475569" stroke-width="1.3"/>' +
            '<circle cx="192" cy="56" r="18" fill="#15803d" fill-opacity="0.22" stroke="#15803d" stroke-width="1.4"/>' +
        "</svg>";
    }

    function getBlueprintBadgesList(bp) {
        if (Array.isArray(bp.features) && bp.features.length) return bp.features;
        if (Array.isArray(bp.badges) && bp.badges.length) return bp.badges;
        if (Array.isArray(bp.tags) && bp.tags.length) return bp.tags;
        if (bp.id === "surrey-patio-balcony") {
            return ["Containers", "Hanging Baskets", "Media Mixes", "Cedar Fence Shade"];
        }
        if (bp.id === "coast-salish-pollinator") {
            return ["Custom Shapes", "BC Natives", "Pollinators Mar\u2013Oct", "Cedar Hedge"];
        }
        return ["4 Raised Beds", "Caterpillar Tunnel", "Greenhouse", "Shade & Interplanting"];
    }

    function renderBlueprintsModalHtml(ctx) {
        rememberCtx(ctx);
        const c = core(ctx);
        const blueprints = Array.isArray(c && c.STARTER_BLUEPRINTS) ? c.STARTER_BLUEPRINTS : [];
        const existingPlans = (c && typeof c.listSavedPlans === "function") ? c.listSavedPlans() : [];

        const cardsHtml = blueprints.length ? blueprints.map(function (bp) {
            const badges = getBlueprintBadgesList(bp);
            const badgesHtml = badges.map(function (b) {
                return '<span class="wcpp-bs-badge">' + escHtml(ctx, b) + "</span>";
            }).join("");
            const highlightsHtml = Array.isArray(bp.highlights) && bp.highlights.length
                ? ('<ul style="margin:0; padding-left:16px; font-size:0.77rem; color:var(--bs-text-2); line-height:1.4;">' +
                    bp.highlights.map(function (h) { return "<li>" + escHtml(ctx, h) + "</li>"; }).join("") +
                  "</ul>")
                : "";
            const st = bp.stats || {};
            const statParts = [];
            if (st.blocks) statParts.push(st.blocks + " spaces");
            if (st.containers) statParts.push(st.containers + " containers");
            if (st.customShapes) statParts.push(st.customShapes + " custom shapes");
            if (st.structures) statParts.push(st.structures + " shade structures");
            if (st.crops) statParts.push(st.crops + " crops/natives");
            const metaLine = statParts.length
                ? statParts.join(" \u00b7 ")
                : (bp.summary || bp.meta || "Coastal BC Zone 8a");
            return '<article class="wcpp-bs-blueprint-card" data-blueprint-id="' + escHtml(ctx, bp.id) + '">' +
                '<div class="wcpp-bs-blueprint-preview">' + buildBlueprintPreviewSvg(bp.id) + "</div>" +
                '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">' +
                    '<div>' +
                        '<h3 style="margin:0; font-size:1rem;">' + escHtml(ctx, bp.name || bp.title || bp.id) + "</h3>" +
                        (bp.subtitle ? '<div style="font-size:0.78rem; font-weight:700; color:var(--bs-primary); margin-top:2px;">' + escHtml(ctx, bp.subtitle) + "</div>" : "") +
                    "</div>" +
                    (bp.region ? '<span class="wcpp-bs-badge">' + escHtml(ctx, bp.region) + "</span>" : "") +
                "</div>" +
                '<p style="margin:0; font-size:0.82rem; color:var(--bs-text-2); line-height:1.45;">' + escHtml(ctx, bp.description || "") + "</p>" +
                highlightsHtml +
                '<div class="wcpp-bs-blueprint-badges">' + badgesHtml + "</div>" +
                '<div class="wcpp-bs-blueprint-meta" style="font-size:0.76rem; color:var(--bs-muted); font-weight:700;">' + escHtml(ctx, metaLine) + "</div>" +
                '<div class="wcpp-bs-blueprint-actions">' +
                    '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-primary wcpp-bs-btn-sm" data-action="blueprint-load" data-blueprint-id="' + escHtml(ctx, bp.id) + '">' +
                        svgIcon(ctx, "plus", 13) +
                        "<span>Load as New Saved Plan</span>" +
                    "</button>" +
                "</div>" +
            "</article>";
        }).join("") : '<p style="margin:0; font-size:0.86rem; color:var(--bs-muted);">No curated starter blueprints are registered in core yet.</p>';

        return '<div class="wcpp-bs-modal is-wide wcpp-bs-blueprints-modal">' +
            '<div class="wcpp-bs-modal-header">' +
                '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                    svgIcon(ctx, "layers", 18) +
                    "<h2>Curated BC Starter Blueprints</h2>" +
                    '<span class="wcpp-bs-badge">' + blueprints.length + " Coastal Layouts</span>" +
                "</div>" +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-sm" data-action="close-modal">\u00d7 Close</button>' +
            "</div>" +
            '<div class="wcpp-bs-modal-body">' +
                '<div style="font-size:0.84rem; color:var(--bs-text-2);">' +
                    "Start from a curated Metro Vancouver &amp; Coastal BC layout with realistic containers, custom bed curves, shade structures, and native pollinator guilds. " +
                    "<strong>Non-destructive:</strong> loading a blueprint always creates a new saved plan and leaves your existing " + existingPlans.length + " saved plan" + (existingPlans.length === 1 ? "" : "s") + " untouched." +
                "</div>" +
                '<div class="wcpp-bs-blueprints-grid">' + cardsHtml + "</div>" +
            "</div>" +
            '<div class="wcpp-bs-modal-footer">' +
                '<button type="button" class="wcpp-bs-btn wcpp-bs-btn-secondary" data-action="close-modal">Close</button>' +
            "</div>" +
        "</div>";
    }

    function deriveUniquePlanName(c, baseName) {
        const cleanBase = String(baseName || "Starter Blueprint").trim() || "Starter Blueprint";
        const plans = typeof c.listSavedPlans === "function" ? c.listSavedPlans() : [];
        const existingNames = new Set(plans.map(function (pl) { return String(pl.name || "").trim().toLowerCase(); }));
        if (!existingNames.has(cleanBase.toLowerCase())) return cleanBase;
        let idx = 2;
        while (existingNames.has((cleanBase + " (" + idx + ")").toLowerCase()) && idx < 50) {
            idx += 1;
        }
        return cleanBase + " (" + idx + ")";
    }

    function handleBlueprintsModalClick(ctx, act, actEl) {
        rememberCtx(ctx);
        if (act === "close-modal") {
            if (ctx && typeof ctx.closeModal === "function") ctx.closeModal();
            return true;
        }
        if (act === "blueprint-load") {
            const c = core(ctx);
            const catalog = getCatalog(ctx);
            const bpId = actEl.getAttribute("data-blueprint-id");
            if (!bpId || !c || typeof c.createStateFromBlueprint !== "function") {
                showToast(ctx, "Starter blueprints engine unavailable.");
                return true;
            }
            const bp = (c.STARTER_BLUEPRINTS || []).find(function (b) { return b.id === bpId; });
            const nextState = c.createStateFromBlueprint(bpId, catalog);
            if (!nextState) {
                showToast(ctx, "Unable to build blueprint: " + bpId);
                return true;
            }
            const planName = deriveUniquePlanName(c, (bp && (bp.name || bp.title)) || nextState.planName || "Starter Blueprint");
            delete nextState.planId;
            nextState.planName = planName;
            if (typeof c.saveNamedPlan === "function") {
                c.saveNamedPlan(nextState, planName);
            }

            if (ctx && typeof ctx.activatePlanState === "function") {
                ctx.activatePlanState(nextState);
            } else {
                setState(ctx, nextState);
                if (ctx && typeof ctx.rehydrateAllSeasons === "function") ctx.rehydrateAllSeasons();
                if (ctx && typeof ctx.clearSharedPlanBanner === "function") ctx.clearSharedPlanBanner();
                if (ctx && typeof ctx.setLastSavedAt === "function") ctx.setLastSavedAt(Date.now());
                if (ctx && typeof ctx.syncSavedTabDot === "function") ctx.syncSavedTabDot();
                const activeSeason = c.getActiveSeason(nextState);
                if (activeSeason && activeSeason.blocks && activeSeason.blocks[0]) {
                    setSelectedBlockId(ctx, activeSeason.blocks[0].id);
                }
                if (ctx && typeof ctx.closeModal === "function") ctx.closeModal();
                if (ctx && typeof ctx.renderSimulator === "function") ctx.renderSimulator();
            }
            showToast(ctx, "Loaded blueprint as new saved plan: " + planName);
            return true;
        }
        return false;
    }

    // =========================================================================
    // 5. UNIFIED MODAL DISPATCHERS (COMPATIBLE WITH BOTH #123 AND #120 SIGNATURES)
    // =========================================================================
    function renderModalHtml(ctx, modalMode) {
        const mode = modalMode || getModalMode(ctx);
        if (mode === "shape") return renderShapeModalHtml(ctx);
        if (mode === "container") return renderContainerModalHtml(ctx);
        if (mode === "playground") return renderPlaygroundModalHtml(ctx);
        if (mode === "blueprints") return renderBlueprintsModalHtml(ctx);
        return "";
    }

    function handleModalClick(ctx, modalModeOrBackdrop, eOrEvent, maybeBackdrop) {
        rememberCtx(ctx);
        const isModeStr = typeof modalModeOrBackdrop === "string";
        const mode = isModeStr ? modalModeOrBackdrop : getModalMode(ctx);
        const e = isModeStr ? eOrEvent : eOrEvent;
        const backdrop = isModeStr ? maybeBackdrop : modalModeOrBackdrop;
        if (!e || !e.target) return false;
        if (mode === "playground" && e.target.closest && !e.target.closest(".wcpp-bs-crop-picker")) {
            closePlaygroundDropdowns();
        }
        const actEl = e.target.closest ? e.target.closest("[data-action]") : null;
        const act = actEl ? actEl.getAttribute("data-action") : "";
        if (mode === "shape") return handleShapeModalClick(ctx, act, actEl, backdrop, e);
        if (mode === "container") return handleContainerModalClick(ctx, act, actEl, backdrop, e);
        if (mode === "playground") return handlePlaygroundModalClick(ctx, act, actEl, backdrop, e);
        if (mode === "blueprints") return handleBlueprintsModalClick(ctx, act, actEl, backdrop, e);
        return false;
    }

    function handleModalDblClick(ctx, modalModeOrBackdrop, eOrEvent, maybeBackdrop) {
        rememberCtx(ctx);
        const isModeStr = typeof modalModeOrBackdrop === "string";
        const mode = isModeStr ? modalModeOrBackdrop : getModalMode(ctx);
        const e = isModeStr ? eOrEvent : eOrEvent;
        const backdrop = isModeStr ? maybeBackdrop : modalModeOrBackdrop;
        if (mode === "shape") return handleShapeModalDblClick(ctx, e, backdrop);
        return false;
    }

    function handleModalFocusIn(ctx, modalModeOrBackdrop, targetOrEvent, maybeBackdrop) {
        rememberCtx(ctx);
        const isModeStr = typeof modalModeOrBackdrop === "string";
        const mode = isModeStr ? modalModeOrBackdrop : getModalMode(ctx);
        const target = isModeStr
            ? targetOrEvent
            : (targetOrEvent && targetOrEvent.target ? targetOrEvent.target : null);
        const backdrop = isModeStr ? maybeBackdrop : modalModeOrBackdrop;
        if (mode === "playground") return handlePlaygroundModalFocusIn(ctx, target, backdrop);
        return false;
    }

    function handleModalInput(ctx, modalModeOrBackdrop, targetOrEvent, maybeBackdrop) {
        rememberCtx(ctx);
        const isModeStr = typeof modalModeOrBackdrop === "string";
        const mode = isModeStr ? modalModeOrBackdrop : getModalMode(ctx);
        const target = isModeStr
            ? targetOrEvent
            : (targetOrEvent && targetOrEvent.target ? targetOrEvent.target : null);
        const backdrop = isModeStr ? maybeBackdrop : modalModeOrBackdrop;
        if (mode === "shape") return handleShapeModalInput(ctx, target, backdrop);
        if (mode === "container") return handleContainerModalInput(ctx, target, backdrop);
        if (mode === "playground") return handlePlaygroundModalInput(ctx, target, backdrop);
        return false;
    }

    function handleModalChange(ctx, modalModeOrBackdrop, targetOrEvent, maybeBackdrop) {
        rememberCtx(ctx);
        const isModeStr = typeof modalModeOrBackdrop === "string";
        const mode = isModeStr ? modalModeOrBackdrop : getModalMode(ctx);
        const target = isModeStr
            ? targetOrEvent
            : (targetOrEvent && targetOrEvent.target ? targetOrEvent.target : null);
        const backdrop = isModeStr ? maybeBackdrop : modalModeOrBackdrop;
        if (mode === "shape") return handleShapeModalChange(ctx, target, backdrop);
        if (mode === "container") return handleContainerModalChange(ctx, target, backdrop);
        if (mode === "playground") return handlePlaygroundModalChange(ctx, target, backdrop);
        return false;
    }

    global.WCPPBedSimStudioModals = {
        // Openers / Setup
        openShapeDesigner: openShapeDesigner,
        setupShapeDesigner: openShapeDesigner,
        openContainerModal: openContainerModal,
        setupContainerModal: openContainerModal,
        openBedPlayground: openBedPlayground,
        setupPlayground: openBedPlayground,
        openBlueprintsGallery: openBlueprintsGallery,
        setupBlueprintsGallery: openBlueprintsGallery,

        // HTML Renderers
        renderShapeModalHtml: renderShapeModalHtml,
        renderShapeDesignerModalHtml: renderShapeModalHtml,
        renderContainerModalHtml: renderContainerModalHtml,
        renderPlaygroundModalHtml: renderPlaygroundModalHtml,
        renderBlueprintsModalHtml: renderBlueprintsModalHtml,
        renderModalHtml: renderModalHtml,

        // Unified Event Dispatchers
        handleModalClick: handleModalClick,
        handleModalDblClick: handleModalDblClick,
        handleModalFocusIn: handleModalFocusIn,
        handleModalFocusin: handleModalFocusIn,
        handleModalInput: handleModalInput,
        handleModalChange: handleModalChange,

        // Per-Modal Event Handlers
        handleShapeModalClick: handleShapeModalClick,
        handleShapeModalDblClick: handleShapeModalDblClick,
        handleShapeModalInput: handleShapeModalInput,
        handleShapeModalChange: handleShapeModalChange,

        handleContainerModalClick: handleContainerModalClick,
        handleContainerModalInput: handleContainerModalInput,
        handleContainerModalChange: handleContainerModalChange,

        handlePlaygroundModalClick: handlePlaygroundModalClick,
        handlePlaygroundModalFocusIn: handlePlaygroundModalFocusIn,
        handlePlaygroundModalInput: handlePlaygroundModalInput,
        handlePlaygroundModalChange: handlePlaygroundModalChange,

        handleBlueprintsModalClick: handleBlueprintsModalClick,

        // Pointer Controllers
        attachShapeModalPointerEvents: attachShapeModalPointerEvents,
        attachPlaygroundPointerEvents: attachPlaygroundPointerEvents,
        onPointerDown: onPointerDown,
        onMove: onMove,
        onUp: onUp,

        // Lifecycle
        resetState: resetState,
        cleanupPrintSheet: cleanupPlaygroundPrintSheet
    };
})(typeof window !== "undefined" ? window : globalThis);
