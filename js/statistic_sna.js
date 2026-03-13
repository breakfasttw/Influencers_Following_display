/* global Plotly */
import { ALGO_CONFIG } from "./config.js";

/**
 * ============================================================================
 * [主要進入點] 渲染 SNA 數值比較視圖
 * ============================================================================
 */
export async function renderSnaComparisonView(algoKey) {
    const container = document.getElementById("tab-sna");
    if (!container) return;

    container.innerHTML = `<div class="text-slate-400 text-center py-20 animate-pulse font-mono tracking-widest">載入 SNA 數據中...</div>`;

    try {
        const { summaryRes, nodesData } = await fetchSnaData(algoKey);
        const processedData = processSnaData(summaryRes, nodesData, algoKey);

        const div1Html = buildClusterComparisonHtml(processedData);
        const div2Html = buildNetworkAndHeatmapHtml(processedData);
        
        // 【修改這裡】：將 div2 (Network & Heatmap) 放在前面，div1 (Cluster 表格) 放在後面
        container.innerHTML = div2Html + div1Html;

        setTimeout(() => {
            drawHeatmap(processedData);
        }, 50);

    } catch (error) {
        console.error("載入 SNA 比較資料失敗:", error);
        container.innerHTML = `<div class="text-red-400 text-center py-10 border border-red-900/50 bg-red-900/10 rounded-lg mx-4 mt-4">資料讀取失敗，請檢查 JSON 格式或網路狀態。</div>`;
    }
}

/**
 * ============================================================================
 * [資料獲取] Fetch JSON 檔案
 * ============================================================================
 */
async function fetchSnaData(algoKey) {
    const ts = Date.now();
    const summaryRes = await fetch(
        `./Output/network_summary.json?v=${ts}`,
    ).then((r) => r.json());

    let nodesPath = `./Output/nodes_edges_gd.json?v=${ts}`;
    if (algoKey === "louvain")
        nodesPath = `./Output/Louvain/nodes_edges_lv.json?v=${ts}`;
    else if (algoKey === "walktrap")
        nodesPath = `./Output/Walktrap/nodes_edges_wt.json?v=${ts}`;

    const nodesData = await fetch(nodesPath).then((r) => r.json());

    return { summaryRes, nodesData };
}

/**
 * ============================================================================
 * [資料處理] 整理 Network 總體與 Cluster 群組資料
 * ============================================================================
 */
function processSnaData(summaryRes, nodesData, algoKey) {
    const nodes = nodesData.nodes || [];
    const totalNodes = summaryRes["母體數"] || 200;
    const divisor = totalNodes > 1 ? totalNodes - 1 : 1; // 用於計算 Network Influence Score

    // Network 全域指標
    const networkMetrics = {
        "Network Density": summaryRes["密度(Density)"],
        "Network Density_0": summaryRes["密度去0(Density_0)"],
        Transitivity: summaryRes["傳遞性(Transitivity)"],
        Reciprocity: summaryRes["互惠率(Reciprocity)"],
        Assortativity: summaryRes["同質性係數(Assortativity)"],
        "Core-periphery Fit":
            summaryRes["核心邊陲結構適配度(Core-periphery Structure Fit)"],
    };

    // 找出對應演算法的 Cluster 總結資料
    const algoNameJson =
        algoKey === "greedy"
            ? "Greedy"
            : algoKey === "louvain"
              ? "Louvain"
              : "Walktrap";
    const clusterData = summaryRes[algoNameJson];

    // 將節點依照 Group 進行歸類
    const groupedNodes = {};
    nodes.forEach((n) => {
        if (!groupedNodes[n.group]) groupedNodes[n.group] = [];
        groupedNodes[n.group].push(n);
    });
    const groupKeys = Object.keys(groupedNodes).sort();

    return { networkMetrics, clusterData, groupedNodes, groupKeys, divisor };
}

/**
 * ============================================================================
 * [UI 構建] DIV 1: Cluster 數值與 Top 5 表格
 * ============================================================================
 */
function buildClusterComparisonHtml(data) {
    const { clusterData, groupedNodes, groupKeys, divisor } = data;

    let html = `
        <div class="flex flex-col bg-slate-800/40 rounded-xl border border-slate-700/50 shadow-lg">
            <div class="p-4 bg-slate-800 rounded-t-xl border-b border-slate-700 font-bold text-blue-400">
                📊 Cluster SNA 數值比較
            </div>
            <div class="w-full overflow-auto max-h-[65vh] relative custom-scrollbar">
                <div class="flex flex-row p-4 gap-4 w-max">
                    
                    <div class="flex flex-col gap-4 w-[110px] shrink-0 bg-slate-900 rounded-xl border border-slate-700 p-2 sticky left-0 z-40 shadow-[4px_0_15px_rgba(0,0,0,0.5)]">
                        <div class="h-8 font-bold text-slate-300 border-b border-slate-700 flex items-center justify-center text-xs">SNA 指標</div>
                        <div class="h-10 font-bold text-emerald-400 flex items-center justify-center px-1 bg-emerald-900/10 rounded border border-emerald-900/30 text-[10px] text-center leading-tight">Cluster Density</div>
                        <div class="h-[140px] font-bold text-sky-400 flex items-center justify-center px-1 border-b border-slate-700/50 text-[10px] text-center leading-tight">Within-mod<br>Degree</div>
                        <div class="h-[140px] font-bold text-sky-400 flex items-center justify-center px-1 border-b border-slate-700/50 text-[10px] text-center leading-tight">Participation<br>Coefficient</div>
                        <div class="h-[140px] font-bold text-orange-300 flex items-center justify-center px-1 border-b border-slate-700/50 text-[10px] text-center leading-tight">InDegree</div>
                        <div class="h-[140px] font-bold text-orange-300 flex items-center justify-center px-1 border-b border-slate-700/50 text-[10px] text-center leading-tight">OutDegree</div>
                        <div class="h-[140px] font-bold text-orange-300 flex items-center justify-center px-1 border-b border-slate-700/50 text-[10px] text-center leading-tight">Mutual<br>Follow</div>
                        <div class="h-[140px] font-bold text-orange-300 flex items-center justify-center px-1 border-b border-slate-700/50 text-[10px] text-center leading-tight">Net Influence<br>Score</div>
                        <div class="h-[140px] font-bold text-purple-300 flex items-center justify-center px-1 border-b border-slate-700/50 text-[10px] text-center leading-tight">Betweenness<br>Centrality</div>
                        <div class="h-[140px] font-bold text-purple-300 flex items-center justify-center px-1 border-b border-slate-700/50 text-[10px] text-center leading-tight">Eigenvector<br>Centrality</div>
                        <div class="h-[140px] font-bold text-purple-300 flex items-center justify-center px-1 border-b border-slate-700/50 text-[10px] text-center leading-tight">Local<br>Clustering</div>
                        <div class="h-[140px] font-bold text-purple-300 flex items-center justify-center px-1 text-[10px] text-center leading-tight">Core-periphery<br>Coreness</div>
                    </div>
    `;

    groupKeys.forEach((gk, i) => {
        const groupMembers = groupedNodes[gk];
        // 處理鍵值對應，支援 "Group_0" 或 "Group_A" 的格式
        const summaryGroupKey = `Group_${gk.charCodeAt(0) - 65}`; 
        let clusterDensity = clusterData["Cluster Density"][`Group_${i}`] || clusterData["Cluster Density"][summaryGroupKey] || 0;
        const memberListStr = groupMembers.map(m => m.name).join("、");

        html += `
            <div class="flex flex-col gap-4 w-[280px] shrink-0 bg-slate-900/50 rounded-xl border border-slate-700 p-4 hover:border-blue-500/40 transition-colors">
                
                <div class="relative group h-8 font-bold text-blue-400 border-b border-slate-700 flex justify-center items-center cursor-help">
                    Group ${gk} <span class="text-xs font-normal text-white ml-1">(${groupMembers.length})</span>
                    <div class="absolute hidden group-hover:block z-50 bg-slate-800 border border-slate-600 p-4 rounded shadow-2xl text-xs w-[320px] left-1/2 -translate-x-1/2 top-full mt-2 max-h-[300px] overflow-y-auto">
                        <div class="text-blue-400 font-bold mb-2 border-b border-slate-700 pb-1 text-left sticky top-0 bg-slate-800">成員名單</div>
                        <div class="text-slate-300 whitespace-normal leading-relaxed text-left">${memberListStr}</div>
                    </div>
                </div>
                
                <div class="h-10 font-bold text-emerald-300 flex items-center justify-center bg-emerald-900/10 border border-emerald-900/30 rounded font-mono text-sm">
                    ${clusterDensity.toFixed(4)}
                </div>
                
                ${buildTop5Table(groupMembers, 'cluster', 'Within-module Degree', divisor)}
                ${buildTop5Table(groupMembers, 'cluster', 'Participation Coefficient', divisor)}
                
                ${buildTop5Table(groupMembers, 'metrics', 'in_degree', divisor)}
                ${buildTop5Table(groupMembers, 'metrics', 'out_degree', divisor)}
                ${buildTop5Table(groupMembers, 'metrics', 'mutual', divisor)}
                ${buildTop5Table(groupMembers, 'metrics', 'network_influence', divisor)}
                
                ${buildTop5Table(groupMembers, 'metrics', 'between_centrality', divisor)}
                ${buildTop5Table(groupMembers, 'metrics', 'Eigenvector Centrality', divisor)}
                ${buildTop5Table(groupMembers, 'metrics', 'Local Clustering Coefficient', divisor)}
                ${buildTop5Table(groupMembers, 'metrics', 'Core-periphery Coreness', divisor)}
            </div>
        `;
    });

    html += `</div></div></div>`; 
    return html;
}

/**
 * ============================================================================
 * [元件] 產生 Top 5 表格 HTML
 * ============================================================================
 */
function buildTop5Table(groupMembers, metricType, metricKey, divisor) {
    let sorted = [...groupMembers]
        .sort((a, b) => {
            let valA =
                metricType === "cluster"
                    ? a.metrics_cluster?.[metricKey] || 0
                    : a.metrics?.[metricKey] || 0;
            let valB =
                metricType === "cluster"
                    ? b.metrics_cluster?.[metricKey] || 0
                    : b.metrics?.[metricKey] || 0;

            // 客製化：動態計算 Network Influence Score (InDegree / (母體數 - 1))
            if (metricKey === "network_influence") {
                valA = (a.metrics?.in_degree || 0) / divisor;
                valB = (b.metrics?.in_degree || 0) / divisor;
            }
            return valB - valA;
        })
        .slice(0, 5);

    let rows = sorted
        .map((n, idx) => {
            let val =
                metricType === "cluster"
                    ? n.metrics_cluster?.[metricKey] || 0
                    : n.metrics?.[metricKey] || 0;
            if (metricKey === "network_influence")
                val = (n.metrics?.in_degree || 0) / divisor;

            let displayVal =
                typeof val === "number"
                    ? Number.isInteger(val)
                        ? val
                        : val.toFixed(4)
                    : val;

            return `
            <tr class="border-b border-slate-700/30 hover:bg-slate-700/50 transition-colors">
                <td class="py-1 text-slate-500">${idx + 1}</td>
                <td class="py-1 text-blue-300 truncate max-w-[120px]" title="${n.name}">${n.name}</td>
                <td class="py-1 text-right text-slate-400 font-mono">${displayVal}</td>
            </tr>
        `;
        })
        .join("");

    return `
        <div class="h-[140px] overflow-y-hidden border-b border-slate-700/50 pb-2">
            <table class="w-full text-[10px] text-left">
                <thead>
                    <tr class="text-slate-500 border-b border-slate-700">
                        <th class="pb-1 w-5">#</th>
                        <th class="pb-1">Name</th>
                        <th class="pb-1 text-right">Value</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

/**
 * ============================================================================
 * [UI 構建] DIV 2: Network 全域指標與 Heatmap 容器
 * ============================================================================
 */
function buildNetworkAndHeatmapHtml(data) {
    const { networkMetrics } = data;

    return `
        <div class="flex flex-col lg:flex-row gap-6 mt-4 mb-6">
            <div class="flex-[1] bg-slate-800/40 rounded-xl border border-slate-700/50 shadow-lg p-6 min-w-[250px]">
                <div class="font-bold text-emerald-400 border-b border-slate-700 pb-3 mb-4 text-lg">🌐 Network SNA</div>
                <table class="w-full text-left text-sm text-slate-300">
                    <tbody>
                        ${Object.entries(networkMetrics).map(([k, v]) => `
                            <tr class="border-b border-slate-700/30 hover:bg-slate-700/50 transition-colors">
                                <td class="py-4 font-medium text-slate-200 pr-2">${k}</td>
                                <td class="py-4 text-right font-mono text-emerald-300 font-bold">${typeof v === 'number' ? v.toFixed(4) : v}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>

            <div class="flex-[3] bg-slate-800/40 rounded-xl border border-slate-700/50 shadow-lg p-6 min-w-[300px]">
                <div class="font-bold text-amber-400 border-b border-slate-700 pb-3 mb-4 text-lg">🔥 Inter-cluster Edge Density</div>
                <div id="sna-heatmap" class="w-full h-[320px]"></div>
            </div>
        </div>
    `;
}

/**
 * ============================================================================
 * [圖表繪製] 渲染 Plotly Heatmap
 * ============================================================================
 */
function drawHeatmap(data) {
    const { clusterData, groupKeys } = data;
    const interClusterData = clusterData["Inter-cluster Edge Density"];

    const xyLabels = groupKeys.map((k) => `Group ${k}`);

    // 分成兩個圖層矩陣：一個給實際數值，一個專給對角線（純白底 + Dash）
    const mainZ = [];
    const mainText = [];
    const diagZ = [];
    const diagText = [];

    // 構建矩陣資料
    groupKeys.forEach((rowKey, rIdx) => {
        const mainZRow = [];
        const mainTextRow = [];
        const diagZRow = [];
        const diagTextRow = [];

        groupKeys.forEach((colKey, cIdx) => {
            const rName = `Group_${rIdx}`;
            const cName = `Group_${cIdx}`;

            if (rIdx === cIdx) {
                // 對角線 (自己對自己)：主圖層不畫，對角線圖層填滿
                mainZRow.push(null);
                mainTextRow.push("");
                diagZRow.push(1); // 給個隨意常數值，用於觸發白色
                diagTextRow.push("-");
            } else {
                // 非對角線：實際數值
                let val = 0;
                if (
                    interClusterData[rName] &&
                    interClusterData[rName][cName] !== undefined
                ) {
                    val = interClusterData[rName][cName];
                }
                mainZRow.push(val);
                mainTextRow.push(val === 0 ? "0" : val.toFixed(3));
                diagZRow.push(null);
                diagTextRow.push("");
            }
        });
        mainZ.push(mainZRow);
        mainText.push(mainTextRow);
        diagZ.push(diagZRow);
        diagText.push(diagTextRow);
    });

    // 追蹤 1: 純白色對角線底圖 (強制填白)
    const traceDiag = {
        z: diagZ,
        x: xyLabels,
        y: xyLabels,
        type: "heatmap",
        colorscale: [
            [0, "#ffffff"],
            [1, "#ffffff"],
        ], // 強制純白
        showscale: false, // 隱藏這層的顏色條
        hoverinfo: "none",
        text: diagText,
        texttemplate: "%{text}",
        textfont: { color: "rgba(0,0,0,0.5)", size: 16, family: "monospace" },
        xgap: 2,
        ygap: 2,
    };

    // 追蹤 2: 實際數值熱力圖
    const traceMain = {
        z: mainZ,
        x: xyLabels,
        y: xyLabels,
        type: "heatmap",
        colorscale: "YlOrRd",
        reversescale: true,
        hoverongaps: false,
        text: mainText,
        texttemplate: "%{text}",
        textfont: { color: "rgba(0,0,0,0.7)", size: 10, family: "monospace" },
        xgap: 2,
        ygap: 2,
    };

    const heatmapLayout = {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { color: "#94a3b8" },
        margin: { t: 50, b: 10, l: 60, r: 10 }, // 調整邊距：頂部加大(t:50)，底部縮小(b:10)
        autosize: true,
        xaxis: {
            side: "top", // 【修改】將 X 軸標籤移至上方
            tickfont: { size: 11 },
            tickangle: 0,
            automargin: true,
            showgrid: false, // 【修改】關閉網格線，去除 null 空白處的十字架
            zeroline: false,
        },
        yaxis: {
            autorange: "reversed",
            tickfont: { size: 11 },
            tickangle: 0,
            automargin: true,
            showgrid: false, // 【修改】關閉網格線，去除 null 空白處的十字架
            zeroline: false,
        },
    };

    // 疊加渲染 (traceDiag 給對角線白底與 dash，traceMain 給數值與顏色)
    Plotly.newPlot("sna-heatmap", [traceDiag, traceMain], heatmapLayout, {
        displayModeBar: false,
        responsive: true,
    });
}
