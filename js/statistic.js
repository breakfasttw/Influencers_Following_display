/* global Plotly */
import { CATEGORY_COLORS } from "./config.js";
import { metricsData } from "./report.js";

/**
 * [新增] 核心統計與繪圖進入點
 * 將原本散落在 network.js 的邏輯集中管理，便於未來擴充其他圖表 (如盒鬚圖)
 * @param {number} index 群組索引
 * @param {Array} members 該群組的成員名單 (姓名字串陣列)
 */
export function renderClusterAnalysis(index, members) {
    // 1. 篩選出該群組成員的資料
    const groupMetrics = metricsData.filter((d) =>
        members.includes(d.Person_Name),
    );

    if (!groupMetrics.length) return;

    // 2. 執行各項圖表渲染
    renderCategoryPieChart(index, groupMetrics);

    // 盒鬚圖：貼文數、粉絲數、追蹤數
    renderPostsBoxPlot(index, groupMetrics);
    renderFollowersBoxPlot(index, groupMetrics);
    renderFollowingBoxPlot(index, groupMetrics);
}

/**
 * [原本的邏輯] 繪製類別圓餅圖與 Top 5 表格
 */
function renderCategoryPieChart(index, groupMetrics) {
    // 統計類別 (處理 "類別1,類別2" 的情況)
    const catCounts = {};
    groupMetrics.forEach((d) => {
        const cats = String(d.category || "未分類")
            .split(",")
            .map((c) => c.trim());
        cats.forEach((c) => {
            if (c) catCounts[c] = (catCounts[c] || 0) + 1;
        });
    });

    // 格式化數據
    const total = Object.values(catCounts).reduce((a, b) => a + b, 0);
    const sortedCats = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1]) // 依照數量由高到低
        .map(([name, count]) => ({
            name,
            count,
            percentage: ((count / total) * 100).toFixed(1),
        }));

    // 繪製 Plotly 圓餅圖
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

    // 渲染 Top 5 表格
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
    const top5Container = document.getElementById(`top5-${index}`);
    if (top5Container) top5Container.innerHTML = top5Html;
}

/**
 * [新增] 繪製貼文數 (posts) 盒鬚圖
 */
function renderPostsBoxPlot(index, groupMetrics) {
    const data = groupMetrics.map((d) => d.posts || 0);
    drawBoxPlot(`posts-chart-${index}`, data, "貼文數分布 (Posts)", "#60a5fa");
}

/**
 * [新增] 繪製粉絲數 (Followers) 盒鬚圖
 */
function renderFollowersBoxPlot(index, groupMetrics) {
    const data = groupMetrics.map((d) => d.Followers || 0);
    drawBoxPlot(
        `followers-chart-${index}`,
        data,
        "粉絲數分布 (Followers)",
        "#fbbf24",
    );
}

/**
 * [新增] 繪製追蹤數 (Following) 盒鬚圖
 */
function renderFollowingBoxPlot(index, groupMetrics) {
    const data = groupMetrics.map((d) => d.Following || 0);
    drawBoxPlot(
        `following-chart-${index}`,
        data,
        "追蹤數分布 (Following)",
        "#34d399",
    );
}

/**
 * 內部共用繪圖工具：產生盒鬚圖
 */
function drawBoxPlot(elementId, values, title, color) {
    const trace = {
        y: values,
        type: "box",
        name: "",
        boxpoints: "all", // 顯示所有點
        jitter: 0.3, // 散佈點的隨機程度
        pointpos: -1.8, // 散佈點相對於盒子的位置
        marker: { size: 3, color: color, opacity: 0.6 },
        line: { width: 1.5, color: color },
        fillcolor: color + "20", // 增加透明背景
    };

    const layout = {
        title: { text: title, font: { size: 12, color: color }, x: 0.05 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { color: "#94a3b8", size: 10 },
        margin: { t: 40, b: 20, l: 40, r: 10 },
        height: 180,
        yaxis: {
            gridcolor: "rgba(255,255,255,0.05)",
            zerolinecolor: "rgba(255,255,255,0.1)",
        },
        xaxis: { showticklabels: false },
    };

    Plotly.newPlot(elementId, [trace], layout, { displayModeBar: false });
}

/**
 * [新增] 渲染橫向分群比較視圖
 */
export function renderClusterComparisonView() {
    const container = document.getElementById("tab-cluster");
    if (!container) return;

    const rawCommunityData = window.getCommunityData
        ? window.getCommunityData()
        : [];
    const validCommunities = rawCommunityData.filter(
        (c) => c.name !== "0-Degree",
    );

    let html = `
        <div class="flex flex-row overflow-x-auto min-w-full px-6 gap-6 h-full items-start">
            <div class="flex flex-col gap-6 p-4 bg-slate-900/80 rounded-xl border border-slate-700/30 w-28 shrink-0 shadow-lg">
                <div class="sticky top-0 z-40 bg-slate-900 h-[60px] -mt-4 -mx-4 mb-4 border-b border-slate-700"></div>
                
                <div class="h-[250px] flex items-center justify-center font-bold text-slate-500 border-b border-slate-700/50 text-xs text-center">類別佔比</div>
                <div class="h-[140px] flex items-center justify-center font-bold text-slate-500 border-b border-slate-700/50 text-xs text-center">Top 5 類別</div>
                <div class="h-[180px] flex items-center justify-center font-bold text-slate-500 border-b border-slate-700/50 text-xs text-center">貼文分佈</div>
                <div class="h-[180px] flex items-center justify-center font-bold text-slate-500 border-b border-slate-700/50 text-xs text-center">粉絲分佈</div>
                <div class="h-[180px] flex items-center justify-center font-bold text-slate-500 text-xs text-center">追蹤分佈</div>
            </div>
    `;

    validCommunities.forEach((comm, idx) => {
        const memberList = comm.members.join("、");

        html += `
            <div class="flex flex-col gap-6 min-w-[350px] shrink-0 bg-slate-800/40 rounded-2xl p-6 border border-slate-700/50 hover:border-blue-500/30 transition-all">
                
                <div class="sticky top-0 z-30 -mt-6 -mx-6 mb-2 bg-slate-900 border-b border-slate-700">
                    <div class="relative group py-4 text-blue-400 font-black text-center cursor-help">
                        Group ${comm.name} <span class="text-xs font-normal text-white ml-1">(${comm.count}人)</span>
                        
                        <div class="member-tooltip">
                            <div class="text-blue-400 font-bold mb-2 border-b border-slate-700 pb-1 text-left">網紅名單 (${comm.count})</div>
                            <div class="text-left text-slate-300 font-normal">${memberList}</div>
                        </div>
                    </div>
                </div>

                <div id="comp-pie-${idx}" class="w-full h-[250px]"></div>
                <div id="comp-top5-${idx}" class="w-full bg-slate-800/50 rounded-lg p-3 min-h-[140px]"></div>
                <div id="comp-posts-${idx}" class="w-full h-[180px]"></div>
                <div id="comp-followers-${idx}" class="w-full h-[180px]"></div>
                <div id="comp-following-${idx}" class="w-full h-[180px]"></div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;

    // 繪圖邏輯保持不變...
    requestAnimationFrame(() => {
        validCommunities.forEach((comm, idx) => {
            const groupMetrics = metricsData.filter((d) =>
                comm.members.includes(d.Person_Name),
            );
            if (groupMetrics.length > 0)
                drawComparisonCharts(idx, groupMetrics);
        });
    });
}

/**
 * [修改] 繪圖工具：解決縮小問題並調整邊距
 */
function drawComparisonCharts(idx, groupMetrics) {
    const commonConfig = { displayModeBar: false, responsive: true };

    // --- A. 類別數據計算 ---
    const catCounts = {};
    groupMetrics.forEach((d) => {
        const cats = String(d.category || "未分類")
            .split(",")
            .map((c) => c.trim());
        cats.forEach((c) => {
            if (c) catCounts[c] = (catCounts[c] || 0) + 1;
        });
    });

    const total = Object.values(catCounts).reduce((a, b) => a + b, 0);

    // [關鍵修正]：將資料轉換為物件格式，並預先算好百分比
    const sortedCats = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
            name,
            count,
            percentage: total > 0 ? ((count / total) * 100).toFixed(1) : "0.0",
        }));

    // --- B. 渲染圓餅圖 ---
    // 因為資料結構改了，這裡的 map 也要改為物件存取方式
    Plotly.newPlot(
        `comp-pie-${idx}`,
        [
            {
                values: sortedCats.map((d) => d.count),
                labels: sortedCats.map((d) => d.name),
                type: "pie",
                hole: 0.5,
                marker: {
                    colors: sortedCats.map(
                        (d) =>
                            CATEGORY_COLORS[d.name] ||
                            CATEGORY_COLORS["default"],
                    ),
                },
                textinfo: "none",
                hoverinfo: "label+value+percent",
            },
        ],
        {
            showlegend: false,
            paper_bgcolor: "rgba(0,0,0,0)",
            margin: { t: 10, b: 10, l: 10, r: 10 },
            height: 250,
            autosize: true,
        },
        commonConfig,
    );

    // --- C. 渲染 Top 5 表格 (修正後的物件存取) ---
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
                        <td class="py-1 text-blue-300 truncate max-w-[120px]" title="${d.name}">
                            ${d.name} (${d.count})
                        </td>
                        <td class="py-1 text-right text-slate-400 font-mono">${d.percentage}%</td>
                    </tr>
                `,
                    )
                    .join("")}
            </tbody>
        </table>
    `;
    const top5Container = document.getElementById(`comp-top5-${idx}`);
    if (top5Container) top5Container.innerHTML = top5Html;

    // --- D. 渲染盒鬚圖 (保持不變) ---
    const boxMargin = { t: 15, b: 25, l: 45, r: 10 };
    drawEnhancedBoxPlot(
        `comp-posts-${idx}`,
        groupMetrics.map((d) => d.posts || 0),
        "#60a5fa",
        boxMargin,
    );
    drawEnhancedBoxPlot(
        `comp-followers-${idx}`,
        groupMetrics.map((d) => d.Followers || 0),
        "#fbbf24",
        boxMargin,
    );
    drawEnhancedBoxPlot(
        `comp-following-${idx}`,
        groupMetrics.map((d) => d.Following || 0),
        "#34d399",
        boxMargin,
    );
}

/**
 * [新增] 強化版盒鬚圖繪製，專為比較頁面設計
 */
function drawEnhancedBoxPlot(elementId, values, color, margin) {
    const trace = {
        y: values,
        type: "box",
        name: "",
        boxpoints: "all",
        jitter: 0.4,
        pointpos: -1.8,
        marker: { size: 3, color: color, opacity: 0.5 },
        line: { width: 1.5, color: color },
        fillcolor: color + "15",
    };

    const layout = {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { color: "#94a3b8", size: 9 },
        margin: margin,
        height: 180,
        autosize: true, // 核心：強制自動適應容器
        yaxis: {
            gridcolor: "rgba(255,255,255,0.05)",
            zeroline: false,
            tickfont: { size: 9 },
        },
        xaxis: { showticklabels: false, zeroline: false },
    };

    Plotly.newPlot(elementId, [trace], layout, {
        displayModeBar: false,
        responsive: true,
    });
}

// 曝露給全域
window.renderClusterComparisonView = renderClusterComparisonView;
