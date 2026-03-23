"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
// @ts-nocheck
figma.showUI(__html__, { width: 360, height: 480, themeColors: true });
let isScanning = false;
// 数据缓存池，防止多次 await 相同的底层变量耗散性能
const cacheVariables = new Map();
const cacheCollections = new Map();
// 简单的 yield 机制，让出主线程给 Figma UI
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));
figma.on('selectionchange', () => {
    if (!isScanning)
        figma.ui.postMessage({ type: 'selectionchange' });
});
figma.on('currentpagechange', () => {
    if (!isScanning)
        figma.ui.postMessage({ type: 'currentpagechange' });
});
/**
 * 带有超时释放机制的节点遍历函数
 * 确保数万级别的图层遍历不会导致 Plugin is taking too long 或者界面卡住假死。
 */
function traverseWithYield(node_1, callback_1, layerTypes_1) {
    return __awaiter(this, arguments, void 0, function* (node, callback, layerTypes, maxExecutionTimeMs = 20) {
        let startTime = Date.now();
        function walk(n_1) {
            return __awaiter(this, arguments, void 0, function* (n, inheritedMatch = false) {
                if (!isScanning)
                    return;
                let isDirectMatch = false;
                if (n.type !== 'PAGE' && n.type !== 'DOCUMENT') {
                    if (layerTypes.component && n.type === 'COMPONENT')
                        isDirectMatch = true;
                    if (layerTypes.instance && n.type === 'INSTANCE')
                        isDirectMatch = true;
                    if (layerTypes.text && n.type === 'TEXT')
                        isDirectMatch = true;
                    if (layerTypes.shape && ['RECTANGLE', 'ELLIPSE', 'POLYGON', 'STAR', 'VECTOR', 'BOOLEAN_OPERATION', 'LINE'].includes(n.type))
                        isDirectMatch = true;
                    if (layerTypes.frame && ['FRAME', 'GROUP', 'SECTION'].includes(n.type))
                        isDirectMatch = true;
                }
                const effectiveMatch = isDirectMatch || inheritedMatch;
                if (n.type !== 'PAGE' && n.type !== 'DOCUMENT') {
                    callback(n, effectiveMatch);
                }
                if ('children' in n) {
                    for (const child of n.children) {
                        if (!isScanning)
                            return;
                        if (Date.now() - startTime > maxExecutionTimeMs) {
                            yield yieldToMain();
                            startTime = Date.now();
                        }
                        yield walk(child, effectiveMatch);
                    }
                }
            });
        }
        yield walk(node);
    });
}
// 向上溯源寻找它所在的画板/容器名称
function getTopFirstFrameName(node) {
    let curr = node.parent;
    while (curr && curr.type !== 'PAGE' && curr.type !== 'DOCUMENT') {
        if (curr.type === 'FRAME' || curr.type === 'SECTION') {
            return curr.name;
        }
        curr = curr.parent;
    }
    return 'Canvas (Outside Frame)';
}
/**
 * 校验节点是否属于当前文档。
 * Figma 桌面端 getNodeByIdAsync 在多文件打开时会跨文档命中，
 * 必须通过向上遍历到 root 判断是否与 figma.root 一致。
 */
function belongsToCurrentFile(node) {
    let curr = node;
    while (curr) {
        if (curr.id === figma.root.id)
            return true;
        if (curr.type === 'DOCUMENT')
            return false; // 到达某个 document 但不是当前的
        curr = curr.parent;
    }
    return false;
}
// 获取 Variable（只返回属于当前文件的变量）
function getVariable(id) {
    return __awaiter(this, void 0, void 0, function* () {
        if (cacheVariables.has(id))
            return cacheVariables.get(id);
        try {
            const v = yield figma.variables.getVariableByIdAsync(id);
            // 防止跨文件：remote 变量来自 Library 没有问题；
            // 但如果是一个 local 变量却属于另一个文件，则过滤掉
            cacheVariables.set(id, v);
            return v;
        }
        catch (e) {
            cacheVariables.set(id, null);
            return null;
        }
    });
}
// 获取 Collection
function getCollection(id) {
    return __awaiter(this, void 0, void 0, function* () {
        if (cacheCollections.has(id))
            return cacheCollections.get(id);
        try {
            const c = yield figma.variables.getVariableCollectionByIdAsync(id);
            cacheCollections.set(id, c);
            return c;
        }
        catch (e) {
            cacheCollections.set(id, null);
            return null;
        }
    });
}
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (msg.type === 'start-scan') {
        isScanning = true;
        // 1. 清理全局缓存
        cacheVariables.clear();
        cacheCollections.clear();
        const { scope, types, sources, layerTypes } = msg.payload;
        // 2. 确定扫描范围（显式锁定在当前文档的页面内）
        let roots = [figma.currentPage];
        if (scope === 'file') {
            roots = figma.root.children; // 所有页面
        }
        else if (scope === 'selection') {
            roots = figma.currentPage.selection;
        }
        const results = [];
        // 3. 预先构建"本地集合白名单"：
        //    Figma 桌面端在多文件打开时，getVariableByIdAsync / getVariableCollectionByIdAsync
        //    可能跨文档命中其他文件的 local 变量（v.remote === false 但并不属于当前文件）。
        //    通过 getLocalVariableCollectionsAsync 只获取当前文档的集合 ID，
        //    之后对 !v.remote 变量做白名单校验，确保来源准确。
        const localCollectionIds = new Set();
        // 双重映射: key -> libraryName AND collectionName -> libraryName
        // key 匹配作主路径；name 匹配作 fallback（兼容 key 格式差异）
        const libraryMappingByKey = new Map();
        const libraryMappingByName = new Map();
        try {
            const localCollections = yield figma.variables.getLocalVariableCollectionsAsync();
            localCollections.forEach(c => localCollectionIds.add(c.id));
            // 获取已添加到本文件的团队库变量集合，用于识别具体库名
            const libCollections = yield figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
            libCollections.forEach(lc => {
                libraryMappingByKey.set(lc.key, lc.libraryName);
                // 集合名映射作 fallback（映射优先保留第一个，避免同名集合覆盖）
                if (!libraryMappingByName.has(lc.name)) {
                    libraryMappingByName.set(lc.name, lc.libraryName);
                }
            });
            figma.notify(`Found ${libCollections.length} library variable collections`, { timeout: 3000 });
        }
        catch (e) {
            figma.notify(`teamLibrary error: ${e === null || e === void 0 ? void 0 : e.message}`, { timeout: 3000 });
        }
        // 辅助：获取图层所属页面名称
        const getPageName = (node) => {
            let curr = node;
            while (curr && curr.type !== 'PAGE') {
                curr = curr.parent;
            }
            return curr ? curr.name : 'Unknown Page';
        };
        // 开始遍历
        for (const root of roots) {
            if (!isScanning)
                break;
            const currentPageName = getPageName(root);
            yield traverseWithYield(root, (node, matchLayer) => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e, _f;
                // 简单处理：当前仅对目标类型的图层做真实处理
                if (matchLayer && types.variables && 'boundVariables' in node) {
                    const bound = node.boundVariables;
                    if (bound) {
                        const varIds = new Set();
                        const varIdToKeys = new Map();
                        for (const key in bound) {
                            const val = bound[key];
                            if (Array.isArray(val)) {
                                val.forEach(v => {
                                    if (v && v.type === 'VARIABLE_ALIAS') {
                                        varIds.add(v.id);
                                        const keys = varIdToKeys.get(v.id) || [];
                                        if (!keys.includes(key))
                                            keys.push(key);
                                        varIdToKeys.set(v.id, keys);
                                    }
                                });
                            }
                            else if (val && val.type === 'VARIABLE_ALIAS') {
                                varIds.add(val.id);
                                const keys = varIdToKeys.get(val.id) || [];
                                if (!keys.includes(key))
                                    keys.push(key);
                                varIdToKeys.set(val.id, keys);
                            }
                        }
                        for (const varId of varIds) {
                            const v = yield getVariable(varId);
                            if (v) {
                                // ── 跨文档防火墙 ──────────────────────────────────────────────────
                                // v.remote === false 代表"当前文件的 Local 变量"。
                                // 但 Figma 桌面端多文件打开时，getVariableByIdAsync
                                // 可能命中其他文件的 local 变量，其 collectionId 并不在本文件的白名单中。
                                // 若校验失败，直接跳过，不展示、也不标记为 missing。
                                if (!v.remote && !localCollectionIds.has(v.variableCollectionId)) {
                                    continue; // ← 核心过滤：来自其他文档的 local 变量
                                }
                                const c = yield getCollection(v.variableCollectionId);
                                const isMissingVariable = !c || !c.variableIds.includes(v.id);
                                if (isMissingVariable) {
                                    if (sources.missing) {
                                        results.push({
                                            id: node.id,
                                            name: node.name,
                                            type: node.type,
                                            variableName: v.name,
                                            collectionName: 'Missing',
                                            groupName: 'Missing Tokens',
                                            frameName: getTopFirstFrameName(node),
                                            pageName: currentPageName,
                                            source: 'missing',
                                            isLocked: node.locked,
                                            isHidden: !node.visible,
                                            variableType: 'MISSING',
                                            boundPropertyKeys: (_a = varIdToKeys.get(varId)) !== null && _a !== void 0 ? _a : [],
                                            libraryName: 'Missing'
                                        });
                                    }
                                }
                                else {
                                    const parts = v.name.split('/');
                                    const groupName = parts.length > 1 ? parts[0] : 'Global';
                                    const varName = parts.length > 1 ? parts.slice(1).join('/') : v.name;
                                    const source = v.remote ? 'linked' : 'local';
                                    if ((source === 'linked' && sources.linked) || (source === 'local' && sources.local)) {
                                        results.push({
                                            id: node.id,
                                            name: node.name,
                                            type: node.type,
                                            variableName: varName,
                                            collectionName: c ? c.name : 'Unknown Collection',
                                            groupName: groupName,
                                            frameName: getTopFirstFrameName(node),
                                            pageName: currentPageName,
                                            source: source,
                                            isLocked: node.locked,
                                            isHidden: !node.visible,
                                            variableType: v.resolvedType,
                                            value: v.valuesByMode[Object.keys(v.valuesByMode)[0]],
                                            boundPropertyKeys: (_b = varIdToKeys.get(varId)) !== null && _b !== void 0 ? _b : [],
                                            libraryName: source === 'local' ? 'Local Library' : (() => {
                                                if (!c)
                                                    return 'Unlinked Library';
                                                return libraryMappingByKey.get(c.key)
                                                    || libraryMappingByName.get(c.name)
                                                    || 'Unlinked Library';
                                            })()
                                        });
                                    }
                                }
                            }
                            else if (sources.missing) {
                                results.push({
                                    id: node.id,
                                    name: node.name,
                                    type: node.type,
                                    variableName: 'Unknown (Missing Token)',
                                    collectionName: 'Missing',
                                    groupName: 'Missing Tokens',
                                    frameName: getTopFirstFrameName(node),
                                    pageName: currentPageName,
                                    source: 'missing',
                                    isLocked: node.locked,
                                    isHidden: !node.visible,
                                    variableType: 'MISSING',
                                    boundPropertyKeys: (_c = varIdToKeys.get(varId)) !== null && _c !== void 0 ? _c : [],
                                    libraryName: 'Missing'
                                });
                            }
                        }
                    }
                }
                // 提取 Typography Styles
                if (matchLayer && types.styles && 'textStyleId' in node) {
                    if (node.textStyleId && typeof node.textStyleId === 'string') {
                        const style = figma.getStyleById(node.textStyleId);
                        if (style && style.type === 'TEXT') {
                            const parts = style.name.split('/');
                            const groupName = parts.length > 1 ? parts[0] : 'Global';
                            const styleName = parts.length > 1 ? parts.slice(1).join('/') : style.name;
                            const source = style.remote ? 'linked' : 'local';
                            if ((source === 'linked' && sources.linked) || (source === 'local' && sources.local)) {
                                results.push({
                                    id: node.id,
                                    name: node.name,
                                    type: node.type,
                                    variableId: style.id,
                                    variableName: styleName,
                                    collectionName: 'Typography',
                                    groupName: groupName,
                                    frameName: getTopFirstFrameName(node),
                                    pageName: currentPageName,
                                    source: source,
                                    isLocked: node.locked,
                                    isHidden: !node.visible,
                                    variableType: 'TYPOGRAPHY',
                                    libraryName: source === 'local' ? 'Local Library' : 'Unlinked Library'
                                });
                            }
                        }
                        else if (!style && sources.missing) {
                            results.push({
                                id: node.id,
                                name: node.name,
                                type: node.type,
                                variableId: null,
                                variableName: 'Unknown TextStyle',
                                collectionName: 'Typography',
                                groupName: 'Missing Styles',
                                frameName: getTopFirstFrameName(node),
                                pageName: currentPageName,
                                source: 'missing',
                                isLocked: node.locked,
                                isHidden: !node.visible,
                                variableType: 'MISSING',
                                libraryName: 'Missing'
                            });
                        }
                    }
                }
                // 提取 Color Styles
                const colorStyleIds = new Set();
                if ('fillStyleId' in node && typeof node.fillStyleId === 'string' && node.fillStyleId)
                    colorStyleIds.add(node.fillStyleId);
                if ('strokeStyleId' in node && typeof node.strokeStyleId === 'string' && node.strokeStyleId)
                    colorStyleIds.add(node.strokeStyleId);
                for (const styleId of colorStyleIds) {
                    const style = figma.getStyleById(styleId);
                    if (style && (style.type === 'PAINT' || style.type === 'COLOR')) {
                        const parts = style.name.split('/');
                        const source = style.remote ? 'linked' : 'local';
                        if ((source === 'linked' && sources.linked) || (source === 'local' && sources.local)) {
                            let colorValue = null;
                            if (style.paints && style.paints.length > 0) {
                                const paint = style.paints[0];
                                if (paint.type === 'SOLID')
                                    colorValue = Object.assign(Object.assign({}, paint.color), { a: (_d = paint.opacity) !== null && _d !== void 0 ? _d : 1 });
                            }
                            results.push({
                                id: node.id,
                                name: node.name,
                                type: node.type,
                                variableId: style.id,
                                variableName: parts.length > 1 ? parts.slice(1).join('/') : style.name,
                                collectionName: 'Color Styles',
                                groupName: parts.length > 1 ? parts[0] : 'Global',
                                frameName: getTopFirstFrameName(node),
                                pageName: currentPageName,
                                source: source,
                                isLocked: node.locked,
                                isHidden: !node.visible,
                                variableType: 'COLOR',
                                value: colorValue,
                                libraryName: source === 'local' ? 'Local Library' : 'Unlinked Library'
                            });
                        }
                    }
                    else if (!style && sources.missing) {
                        results.push({
                            id: node.id,
                            name: node.name,
                            type: node.type,
                            variableId: null,
                            variableName: `Missing Color Style`,
                            collectionName: 'Styles',
                            groupName: 'Missing Styles',
                            frameName: getTopFirstFrameName(node),
                            pageName: currentPageName,
                            source: 'missing',
                            isLocked: node.locked,
                            isHidden: !node.visible,
                            variableType: 'MISSING',
                            libraryName: 'Missing'
                        });
                    }
                }
                // 识别脱离引用 (Unlinked)
                if (matchLayer && sources.unlinked) {
                    let isHardcoded = false;
                    if ('fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
                        const hasVisibleFill = node.fills.some(f => f.visible !== false);
                        if (hasVisibleFill && !((_e = node.boundVariables) === null || _e === void 0 ? void 0 : _e.fills))
                            isHardcoded = true;
                    }
                    if (!isHardcoded && 'strokes' in node && node.strokes !== figma.mixed && Array.isArray(node.strokes)) {
                        const hasVisibleStroke = node.strokes.some(s => s.visible !== false);
                        if (hasVisibleStroke && !((_f = node.boundVariables) === null || _f === void 0 ? void 0 : _f.strokes))
                            isHardcoded = true;
                    }
                    if (isHardcoded) {
                        results.push({
                            id: node.id,
                            name: node.name,
                            type: node.type,
                            variableId: null,
                            variableName: 'Unlinked Properties',
                            collectionName: 'Hardcoded',
                            groupName: 'Unlinked',
                            frameName: getTopFirstFrameName(node),
                            pageName: currentPageName,
                            source: 'unlinked',
                            isLocked: node.locked,
                            isHidden: !node.visible,
                            variableType: 'UNKNOWN',
                            libraryName: 'Hardcoded'
                        });
                    }
                }
            }), layerTypes);
        }
        // 回传数据
        if (isScanning) {
            figma.ui.postMessage({ type: 'scan-complete', payload: results });
            isScanning = false;
        }
    }
    // 响应取消中断
    if (msg.type === 'cancel-scan') {
        isScanning = false;
    }
    // 点击三级菜单明细的快速缩放定位联动
    if (msg.type === 'zoom-to-node') {
        try {
            const node = yield figma.getNodeByIdAsync(msg.payload.id);
            if (node && node.type !== 'DOCUMENT' && node.type !== 'PAGE' && belongsToCurrentFile(node)) {
                const sceneNode = node;
                // 如果目标图层不在当前页，先切换页面
                const parentPage = sceneNode.parent && sceneNode.parent.type !== 'PAGE'
                    ? (function findPage(n) {
                        let curr = n;
                        while (curr) {
                            if (curr.type === 'PAGE')
                                return curr;
                            curr = curr.parent;
                        }
                        return null;
                    })(sceneNode)
                    : sceneNode.parent;
                if (parentPage && figma.currentPage.id !== parentPage.id) {
                    figma.currentPage = parentPage;
                }
                figma.currentPage.selection = [sceneNode];
                figma.viewport.scrollAndZoomIntoView([sceneNode]);
            }
            else if (!node || !belongsToCurrentFile(node)) {
                figma.notify("该图层不属于当前文件，无法定位");
            }
        }
        catch (e) {
            figma.notify("图层定位失败 (可能已被删除)");
        }
    }
    // ── 查询所有可用变量（供 Popover 搜索使用）──────────────────────────────
    if (msg.type === 'get-all-variables') {
        try {
            const localVars = yield figma.variables.getLocalVariablesAsync();
            const collectionsMap = new Map();
            for (const v of localVars) {
                if (!collectionsMap.has(v.variableCollectionId)) {
                    const c = yield getCollection(v.variableCollectionId);
                    collectionsMap.set(v.variableCollectionId, c ? c.name : 'Unknown');
                }
            }
            const payload = localVars.map(v => {
                var _a;
                return ({
                    id: v.id,
                    name: v.name,
                    collectionName: (_a = collectionsMap.get(v.variableCollectionId)) !== null && _a !== void 0 ? _a : 'Unknown',
                    resolvedType: v.resolvedType,
                });
            });
            figma.ui.postMessage({ type: 'all-variables', payload });
        }
        catch (e) {
            figma.ui.postMessage({ type: 'all-variables', payload: [] });
        }
    }
    // ── Helper: 将变量绑定应用到单个节点（replace 或 detach）─────────────────
    // 关键：fills/strokes 的颜色变量储存在 paint-level（paint.boundVariables.color）
    // 而非通过 node.setBoundVariable('fills', v) 操作，后者对颜色变量无效。
    // 只有标量属性（opacity / width / height 等）才走 setBoundVariable。
    function applyVariableBinding(sceneNode, targetVarId // null = detach
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const bound = (_a = sceneNode.boundVariables) !== null && _a !== void 0 ? _a : {};
            let anySuccess = false;
            // 1. Paint-level fields: fills & strokes
            for (const field of ['fills', 'strokes']) {
                if (!(field in bound))
                    continue;
                const paints = sceneNode[field];
                if (!paints || paints === figma.mixed || !Array.isArray(paints))
                    continue;
                const newPaints = paints.map((paint) => {
                    var _a;
                    // Only touch paints that have a color variable bound
                    if (!((_a = paint.boundVariables) === null || _a === void 0 ? void 0 : _a.color))
                        return paint;
                    if (targetVarId === null) {
                        // Detach: strip out boundVariables from this paint
                        const { boundVariables: _bv } = paint, rest = __rest(paint, ["boundVariables"]);
                        return rest;
                    }
                    else {
                        // Replace: swap the variable alias
                        return Object.assign(Object.assign({}, paint), { boundVariables: Object.assign(Object.assign({}, paint.boundVariables), { color: { type: 'VARIABLE_ALIAS', id: targetVarId } }) });
                    }
                });
                try {
                    sceneNode[field] = newPaints;
                    anySuccess = true;
                }
                catch (e) {
                    return { success: false, reason: `无法写入 ${field}: ${e === null || e === void 0 ? void 0 : e.message}` };
                }
            }
            // 2. Scalar fields: opacity, width, height, cornerRadius, etc.
            //    These correctly use setBoundVariable
            const scalarFields = Object.keys(bound).filter(k => k !== 'fills' && k !== 'strokes');
            for (const key of scalarFields) {
                try {
                    if (targetVarId === null) {
                        sceneNode.setBoundVariable(key, null);
                    }
                    else {
                        const targetVar = yield figma.variables.getVariableByIdAsync(targetVarId);
                        if (targetVar)
                            sceneNode.setBoundVariable(key, targetVar);
                    }
                    anySuccess = true;
                }
                catch (_) { /* ignore incompatible property types */ }
            }
            return anySuccess
                ? { success: true }
                : { success: false, reason: '未找到可操作的变量绑定' };
        });
    }
    // ── 批量替换变量引用 ────────────────────────────────────────────────────
    if (msg.type === 'batch-replace') {
        const { nodes: nodePayloads, targetVariableId } = msg.payload;
        // 验证目标变量是否存在
        let targetVarExists = false;
        try {
            const tv = yield figma.variables.getVariableByIdAsync(targetVariableId);
            targetVarExists = !!tv;
        }
        catch (_) { }
        const results = [];
        // 获取目标变量的元数据
        let targetMetaData = null;
        try {
            const tv = yield figma.variables.getVariableByIdAsync(targetVariableId);
            if (tv) {
                const coll = yield getCollection(tv.variableCollectionId);
                const parts = tv.name.split('/');
                targetMetaData = {
                    variableName: parts.length > 1 ? parts.slice(1).join('/') : tv.name,
                    collectionName: coll ? coll.name : 'Unknown Collection',
                    groupName: parts.length > 1 ? parts[0] : 'Global',
                    source: tv.remote ? 'linked' : 'local',
                    variableType: tv.resolvedType
                };
            }
        }
        catch (_) { }
        if (!targetMetaData) {
            figma.ui.postMessage({
                type: 'batch-replace-result',
                payload: nodePayloads.map(({ id }) => ({ id, success: false, reason: '目标变量不存在' })),
            });
            return;
        }
        for (const { id } of nodePayloads) {
            try {
                const node = yield figma.getNodeByIdAsync(id);
                if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE' || !belongsToCurrentFile(node)) {
                    results.push({ id: id, success: false, reason: '图层已不存在或不属于当前文件' });
                    continue;
                }
                const sceneNode = node;
                const wasLocked = sceneNode.locked;
                if (wasLocked)
                    sceneNode.locked = false;
                const r = yield applyVariableBinding(sceneNode, targetVariableId);
                if (wasLocked)
                    sceneNode.locked = true;
                if (r.success) {
                    results.push({ id: id, success: true, newData: targetMetaData });
                }
                else {
                    results.push({ id: id, success: false, reason: r.reason });
                }
            }
            catch (e) {
                results.push({ id: id, success: false, reason: (_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : '替换失败' });
            }
        }
        figma.ui.postMessage({ type: 'batch-replace-result', payload: results });
    }
    // ── 批量解绑（Detach to hardcoded）──────────────────────────────────────
    if (msg.type === 'batch-detach') {
        const { nodes: nodePayloads } = msg.payload;
        const results = [];
        let successCount = 0;
        for (const { id } of nodePayloads) {
            try {
                const node = yield figma.getNodeByIdAsync(id);
                if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE' || !belongsToCurrentFile(node)) {
                    results.push({ id: id, success: false, reason: '图层已不存在或不属于当前文件' });
                    continue;
                }
                const sceneNode = node;
                const wasLocked = sceneNode.locked;
                if (wasLocked)
                    sceneNode.locked = false;
                const r = yield applyVariableBinding(sceneNode, null);
                if (wasLocked)
                    sceneNode.locked = true;
                if (r.success) {
                    results.push({
                        id: id,
                        success: true,
                        newData: {
                            variableName: 'Unlinked Properties',
                            collectionName: 'Hardcoded',
                            groupName: 'Unlinked',
                            source: 'unlinked',
                            variableType: 'UNKNOWN'
                        }
                    });
                    successCount++;
                }
                else {
                    results.push({ id: id, success: false, reason: r.reason });
                }
            }
            catch (e) {
                results.push({ id: id, success: false, reason: (_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : '解绑失败' });
            }
        }
        figma.ui.postMessage({ type: 'batch-detach-result', payload: results });
        if (successCount > 0) {
            figma.notify(`已解绑 ${successCount} 个变量引用。可按 Ctrl+Z / ⌘Z 撤销。`, { timeout: 4000 });
        }
    }
});
