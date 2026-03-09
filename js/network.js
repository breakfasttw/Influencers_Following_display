// [新增] 引入數據與顏色配置
import { metricsData } from "./report.js";
import { CATEGORY_COLORS } from "./config.js";

// 導入共用變數與資料
let graphInstance = null;
const highlightNodes = new Set();
const highlightLinks = new Set();
let searchNode = null; // 當前被點擊或搜尋的中心點

/**
 * [新增] 渲染網路摘要資訊 (母體特徵與演算結果)
 * @param {Object} data 來自 network_summary.json 的內容
 * @param {string} algoKey 當前選擇的演算法 key (greedy, louvain, walktrap)
 */
export function renderNetworkSummary(data, algoKey) {
    const container = document.getElementById("summary-section");
    if (!container || !data) return;

    // 格式化百分比的輔助函式
    const toPercent4 = (val) => (parseFloat(val) * 100).toFixed(4) + "%";
    const toPercent2 = (val) => (parseFloat(val) * 100).toFixed(2) + "%";

    // 演算法 Key 與 JSON 內部 Key 的對應表
    const algoMap = {
        greedy: "Greedy",
        louvain: "Louvain",
        walktrap: "Walktrap",
    };
    const currentAlgoData = data[algoMap[algoKey]];

    const html = `
        <div class="summary-block bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
            <div class="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 flex items-center">
                <span class="w-1 h-3 bg-blue-500 mr-2"></span>母體特徵
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div class="flex justify-between border-b border-slate-700/30 pb-1">
                    <span class="text-slate-400 hover:text-white hover:cursor-pointer" title = "網紅總數">母體數</span>
                    <span class="text-slate-200 font-mono">${Math.floor(data["母體數"])}</span>
                </div>
                <div class="flex justify-between border-b border-slate-700/30 pb-1">
                    <span class="text-slate-400 hover:text-white hover:cursor-pointer" title = "無被追蹤也未追蹤他人">0-Degree</span>
                    <span class="text-slate-200 font-mono">${Math.floor(data["0-Degree"])}</span>
                </div>
                <div class="flex justify-between border-b border-slate-700/30 pb-1">
                    <span class="text-slate-400">密度(Density)</span>
                    <span class="text-slate-200 font-mono">${toPercent2(data["密度(Density)"])}</span>
                </div>
                <div class="flex justify-between border-b border-slate-700/30 pb-1">
                    <span class="text-slate-400">互惠率(Reciprocity)</span>
                    <span class="text-slate-200 font-mono">${toPercent2(data["互惠率(Reciprocity)"])}</span>
                </div>
                <div class="flex justify-between border-b border-slate-700/30 pb-1">
                    <span class="text-slate-400">傳遞性(Transitivity)</span>
                    <span class="text-slate-200 font-mono">${toPercent2(data["傳遞性(Transitivity)"])}</span>
                </div>
                <div class="flex justify-between border-b border-slate-700/30 pb-1">
                    <span class="text-slate-400">團體凝聚力(Avg Clustering)</span>
                    <span class="text-slate-200 font-mono">${toPercent2(data["團體凝聚力(Avg Clustering)"])}</span>
                </div>
            </div>
        </div>

        <div class="summary-block bg-blue-900/10 rounded-lg p-3 border border-blue-500/20">
            <div class="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-2 flex items-center">
                <span class="w-1 h-3 bg-blue-400 mr-2"></span>演算結果 (${algoKey.toUpperCase()})
            </div>
            <div class="grid grid-cols-1 gap-2 text-xs">
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Group Count</span>
                    <span class="text-blue-300 font-bold text-sm font-mono">${Math.floor(currentAlgoData["Group_Count"])}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Modularity Score (Q)</span>
                    <span class="text-emerald-400 font-bold font-mono">${(parseFloat(currentAlgoData["Modularity_Score_Q"]) * 100).toFixed(4)}%</span>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

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
                中介度：<span style="color: #f8fafc">${(node.between_centrality * 100).toFixed(2) + "%"}</span><br/>
                總粉絲數：<span style="color: #f8fafc">${node.metrics.Followers.toLocaleString()}</span><br/>
                總追蹤他人：<span style="color: #f8fafc">${node.metrics.Following.toLocaleString()}</span><br/>
                總貼文數：<span style="color: #f8fafc">${node.metrics.posts.toLocaleString()}</span><br/>
                類別：<span style="color: #f8fafc">${node.category}</span><br/>
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
        // [關鍵] 將成員名單轉為字串傳入 toggleAccordion
        const membersStr = JSON.stringify(item.members).replace(/"/g, "&quot;");
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
                    <button onclick="toggleAccordion(${index}, ${membersStr})" class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors">名單</button>
                </td>
            </tr>
            <tr>
                <td colspan="5" class="p-0">
                    <div id="accordion-${index}" class="accordion-content text-xs text-white bg-slate-900/50">
                        <div id="stats-container-${index}" class="p-4 border-b border-slate-700 hidden">
                            <div class="text-blue-400 font-bold mb-2">網紅類別統計</div>
                            <div class="flex flex-col gap-4">
                                <div id="chart-${index}" class="w-full h-64"></div>
                                <div id="top5-${index}" class="w-full bg-slate-800/50 rounded p-2"></div>
                            </div>
                        </div>
                        <div class="p-4 leading-relaxed">
                            <div class="text-slate-400 mb-1">成員名單：</div>
                            ${sortedMembers}
                        </div>
                    </div>
                </td>
            </tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
}

// 為了讓 HTML onclick 能叫到
// [修改] 加入繪圖邏輯
window.toggleAccordion = (index, members) => {
    const content = document.getElementById(`accordion-${index}`);
    const statsContainer = document.getElementById(`stats-container-${index}`);
    if (!content) return;

    const isExpanding = !content.classList.contains("expanded");
    content.classList.toggle("expanded");

    if (isExpanding && statsContainer) {
        statsContainer.classList.remove("hidden");
        renderGroupStats(index, members);
    }
};

// [新增] 核心統計與繪圖函式
function renderGroupStats(index, members) {
    // 1. 篩選出該群組成員的資料
    const groupMetrics = metricsData.filter((d) =>
        members.includes(d.Person_Name),
    );

    // 2. 統計類別 (處理 "類別1,類別2" 的情況)
    const catCounts = {};
    groupMetrics.forEach((d) => {
        const cats = String(d.category || "未分類")
            .split(",")
            .map((c) => c.trim());
        cats.forEach((c) => {
            if (c) catCounts[c] = (catCounts[c] || 0) + 1;
        });
    });

    // 3. 格式化數據
    const total = Object.values(catCounts).reduce((a, b) => a + b, 0);
    const sortedCats = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1]) // 依照數量由高到低
        .map(([name, count]) => ({
            name,
            count,
            percentage: ((count / total) * 100).toFixed(1),
        }));

    // 4. 繪製 Plotly 圓餅圖
    const plotData = [
        {
            values: sortedCats.map((d) => d.count),
            labels: sortedCats.map((d) => d.name),
            type: "pie",
            hole: 0.4,
            marker: {
                colors: sortedCats.map(
                    (d) =>
                        CATEGORY_COLORS[d.name] || CATEGORY_COLORS["default"],
                ),
            },
            textinfo: "label",
            hoverinfo: "label+value+percent",
            automargin: true,
        },
    ];

    const layout = {
        showlegend: false,
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { color: "#cbd5e1", size: 10 },
        margin: { t: 10, b: 10, l: 10, r: 10 },
        height: 250,
    };

    Plotly.newPlot(`chart-${index}`, plotData, layout, {
        displayModeBar: false,
    });

    // 5. 渲染 Top 5 表格
    const top5Html = `
        <table class="w-full text-[10px] text-left">
            <thead>
                <tr class="text-slate-500 border-b border-slate-700">
                    <th class="pb-1">排名</th>
                    <th class="pb-1">類別</th>
                    <th class="pb-1 text-right">占比</th>
                </tr>
            </thead>
            <tbody>
                ${sortedCats
                    .slice(0, 5)
                    .map(
                        (d, i) => `
                    <tr class="border-b border-slate-700/50">
                        <td class="py-1">${i + 1}</td>
                        <td class="py-1 text-blue-300">${d.name} (${d.count})</td>
                        <td class="py-1 text-right text-slate-400">${d.percentage}%</td>
                    </tr>
                `,
                    )
                    .join("")}
            </tbody>
        </table>
    `;
    document.getElementById(`top5-${index}`).innerHTML = top5Html;
}

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
