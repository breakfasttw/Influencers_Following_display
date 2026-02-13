// 導入共用變數與資料
let graphInstance = null;
const highlightNodes = new Set();
const highlightLinks = new Set();
let searchNode = null; // 當前被點擊或搜尋的中心點

// 初始化圖台
export function initNetwork(gData) {
    const elem = document.getElementById("network-viz");

    // --- 1. 資料預處理：建立鄰居與連線的雙向關聯 ---
    // 這步是讓「亮起關聯節點」功能生效的關鍵
    gData.links.forEach((link) => {
        const a = gData.nodes.find(
            (n) => n.id === (link.source.id || link.source),
        );
        const b = gData.nodes.find(
            (n) => n.id === (link.target.id || link.target),
        );

        if (!a.neighbors) a.neighbors = [];
        if (!b.neighbors) b.neighbors = [];
        a.neighbors.push(b);
        b.neighbors.push(a);

        if (!a.links) a.links = [];
        if (!b.links) b.links = [];
        a.links.push(link);
        b.links.push(link);
    });

    graphInstance = ForceGraph()(elem)
        .graphData(gData)
        .nodeId("id")
        .cooldownTicks(500) // 讓引擎只跑 100 次迭代就強制停止，避免跑太久
        .onEngineStop(() => {
            // --- 關鍵：鎖定座標 ---
            // 當引擎停止時，把目前的座標固定住，這樣後續觸發 graphData 也不會再晃動
            gData.nodes.forEach((node) => {
                node.fx = node.x;
                node.fy = node.y;
            });
            console.log("力學佈局已完成並鎖定座標。");
        })
        //--- 加回數據顯示 (Hover Tooltip) ---
        .nodeLabel(
            (node) => `
            <div style="color: #60a5fa; font-weight: bold; margin-bottom: 4px;">${node.name}</div>
            <div style="color: #a2abb8; font-size: 12px;">
                派系：${node.group}<br/>
                <hr style="border-color: #334155; margin: 4px 0;"/>
                被追蹤數：<span style="color: #f8fafc">${node.metrics.in_degree}</span><br/>
                追蹤他人：<span style="color: #f8fafc">${node.metrics.out_degree}</span><br/>
                雙向互粉：<span style="color: #f8fafc">${node.metrics.mutual}</span><br/>
                總追蹤他人：<span style="color: #f8fafc">${node.metrics.distinct_following}</span>
            </div>
        `,
        )
        //.nodeLabel((node) => `${node.name} (Group: ${node.group})`)
        .nodeVal((node) => node.val) // 節點大小
        .nodeColor((node) => node.color)
        // .nodeColor((node) => {
        //     // 增加 50% 的透明度 (80 in hex = 128 in decimal)
        //     return node.color + "20";
        // })

        // --- 2. 節點與文字標籤渲染 (控制 Z-index) ---
        .nodeCanvasObject((node, ctx, globalScale) => {
            const label = node.name;
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            const r = Math.sqrt(node.val) * 4; // 調整大小係數
            // 判斷是否為「選中狀態」：即 searchNode (搜尋點) 或其鄰居 (highlightNodes)
            const isHighlighted =
                node === searchNode || highlightNodes.has(node);

            // A. 繪製圓圈 (最低層) (節點-實心圓)
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
            ctx.fillStyle = node.color || "#cbd5e1";
            ctx.fill();

            // 如果是被選中/搜尋的節點，加強光暈
            if (highlightNodes.has(node) || node === searchNode) {
                ctx.shadowColor = "#fbbf24"; // Amber-400
                ctx.shadowBlur = 20;
                ctx.fill();
                ctx.shadowBlur = 0; // 重置

                // 加粗邊框
                ctx.lineWidth = 3 / globalScale;
                ctx.strokeStyle = "#fff";
                ctx.stroke();
            }

            //B. 繪製文字標籤 (位於圓圈之上)
            if (globalScale >= 1.5 || isHighlighted) {
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                // 背景顏色：選中時用純黑，未選中用半透明黑
                const bgColor = isHighlighted
                    ? "rgba(0, 0, 0, 1)"
                    : "rgba(0, 0, 0, 0.6)";
                // 文字顏色：選中時用粉紅色，未選中用白色
                const textColor = isHighlighted ? "#eaed15" : "#ffffff"; // #FF69B4 是標準 HotPink

                const textWidth = ctx.measureText(label).width;
                // 繪製文字背景
                ctx.fillStyle = bgColor;
                ctx.fillRect(
                    node.x - textWidth / 2 - 2,
                    node.y + r + 2,
                    textWidth + 4,
                    fontSize + 4,
                );

                ctx.fillStyle = textColor;
                ctx.fillText(label, node.x, node.y + r + fontSize / 2 + 4);
            }
        })

        .linkSource("source")
        .linkTarget("target")
        .linkDirectionalArrowLength(3.5)
        .linkDirectionalArrowRelPos(1)
        .linkCurvature(0.2) // 讓雙向連結可見

        // --- 3. 連線寬度與顏色 (高亮時置頂) ---
        .linkWidth((link) => (highlightLinks.has(link) ? 2.5 : 0.5))
        .linkColor((link) =>
            highlightLinks.has(link) ? "#fbbf24" : "rgba(148, 163, 184, 0.15)",
        )
        .onNodeClick((node) => focusNode(node))
        .onNodeHover((node) => {
            // updateHighlightSets(node);
            // 這裡不再呼叫 updateHighlightSets，避免滑鼠滑過造成不必要的運算
            elem.style.cursor = node ? "pointer" : null;
        });

    // 設定初始視角
    graphInstance.d3Force("charge").strength(-130); // 調整排斥力，負相斥正相吸
    return graphInstance;
}

/**
 * 統一管理高亮集合的函式
 * 邏輯：高亮集合 = (搜尋選中的節點及其關聯) + (滑鼠懸停的節點及其關聯)
 */
/**
 * [修正] 更新高亮集合 - 現在只處理被選中的 searchNode
 * 移除 hoverNode 參數，避免滑鼠經過時觸發高亮
 */
function updateHighlightSets() {
    highlightNodes.clear();
    highlightLinks.clear();

    // 如果沒有選中任何節點，就直接重繪（清除所有高亮）並退出
    if (!searchNode) {
        if (graphInstance) {
            const data = graphInstance.graphData();
            // 重置排序（可選，通常維持原樣即可）
            graphInstance.graphData(data);
        }
        return;
    }

    // 僅將當前選中節點 (searchNode) 及其關聯物件加入高亮
    highlightNodes.add(searchNode);
    if (searchNode.neighbors) {
        searchNode.neighbors.forEach((neighbor) =>
            highlightNodes.add(neighbor),
        );
    }
    if (searchNode.links) {
        searchNode.links.forEach((link) => highlightLinks.add(link));
    }

    // 處理 Z-index：將高亮物件移到陣列最後面，確保最後繪製（位於最上層）
    if (graphInstance) {
        const data = graphInstance.graphData();

        // 排序連線：高亮線段在後
        data.links.sort((a, b) => {
            const aH = highlightLinks.has(a) ? 1 : 0;
            const bH = highlightLinks.has(b) ? 1 : 0;
            return aH - bH;
        });

        // 排序節點：高亮節點在後 (最上層)
        data.nodes.sort((a, b) => {
            const aH = highlightNodes.has(a) ? 1 : 0;
            const bH = highlightNodes.has(b) ? 1 : 0;
            return aH - bH;
        });

        graphInstance.graphData(data);
    }
}

// 聚焦節點
export function focusNode(node) {
    if (!graphInstance) return;
    searchNode = node; // 設定全域搜尋節點

    graphInstance.centerAt(node.x, node.y, 1000);
    graphInstance.zoom(4, 2000);

    // [重要] 更新高亮集合並觸發重繪
    updateHighlightSets();
}
// 搜尋功能
export function handleSearch(gData) {
    const inputElement = document.getElementById("influencer-search");
    const searchVal = inputElement.value.trim();
    if (!searchVal) {
        alert("請輸入搜尋關鍵字");
        return;
    }
    const target = gData.nodes.find((n) =>
        n.name.toLowerCase().includes(searchVal.toLowerCase()),
    );
    if (target) focusNode(target);
    else alert(`找不到與「${searchVal}」相關的網紅`);
}

// 圖例渲染
export function renderLegend(communityData, gData) {
    const container = document.getElementById("legend-content");
    if (!container || !communityData.length) return;
    let html = `<table class="legend-table text-sm text-left w-full">`;
    communityData.forEach((item, index) => {
        // 嘗試找出顏色
        const representativeNode = gData.nodes.find(
            (n) => n.group === item.name,
        );
        const color = representativeNode
            ? representativeNode.color || representativeNode.fill
            : "#475569";
        const sortedMembers = [...item.members].sort().join("、");
        html += `
            <tr class="legend-row-header border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                <td class="p-2 w-3" style="background-color: ${color}; border-radius: 8px 0 0 8px;"></td>
                <td class="p-2 text-slate-200 text-xs ">${item.name}</td>
                <td class="p-2">
                    <span class="leader-link text-xs text-blue-400 cursor-pointer hover:text-blue-300 hover:underline" onclick="focusNodeByName('${item.leader}')">
                        👑${item.leader}
                    </span>
                </td>
                <td class="p-2 text-white text-xs text-right">${item.count}人</td>
                <td class="p-2 text-right">
                    <button onclick="toggleAccordion(${index})" class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors">名單</button>
                </td>
            </tr>
            <tr>
                <td colspan="5" class="p-0">
                    <div id="accordion-${index}" class="accordion-content text-xs text-white bg-slate-900/50 px-4">
                        <div class="py-2 leading-relaxed">${sortedMembers}</div>
                    </div>
                </td>
            </tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
}

// 為了讓 HTML onclick 能叫到
window.toggleAccordion = (index) => {
    const content = document.getElementById(`accordion-${index}`);
    if (content) content.classList.toggle("expanded");
};

window.toggleLegend = () => {
    const panel = document.getElementById("legend-panel");
    const openBtn = document.getElementById("btn-legend-open");
    if (panel) {
        panel.classList.toggle("open");
        if (panel.classList.contains("open")) openBtn?.classList.add("hidden");
        else openBtn?.classList.remove("hidden");
    }
};

window.unlockNodes = () => {
    // 這裡需要存取 main.js 的 gData，或透過參數傳遞，暫時清空標記
    searchNode = null;
    highlightNodes.clear();
    highlightLinks.clear();
};
