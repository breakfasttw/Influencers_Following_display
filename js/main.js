import { ALGO_CONFIG } from "./config.js";
import {
    initNetwork,
    renderLegend,
    focusNode,
    handleSearch,
} from "./network.js";
import {
    parseCommunityCSV,
    parseMetricsCSV,
    renderMetricsTable,
} from "./report.js";

// ==========================================
// 全域狀態 (State)
// ==========================================
let graphInstance = null;
let gData = { nodes: [], links: [] };
let communityData = [];
let metricsData = [];
let currentSort = { key: "Original_Rank", asc: true };
let allAlgosNodes = { gd: [], lv: [], wt: [] };

// ==========================================
// 初始化
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    switchAlgorithm("louvain");

    // 綁定搜尋按鈕 (假設你 HTML 裡有搜尋按鈕或是 Enter 觸發)
    document
        .getElementById("influencer-search")
        ?.addEventListener("keypress", (e) => {
            if (e.key === "Enter") handleSearch(gData);
        });
});

// ==========================================
// 核心邏輯：切換演算法
// ==========================================
async function switchAlgorithm(algoKey) {
    const config = ALGO_CONFIG[algoKey];
    const legendContent = document.getElementById("legend-content");
    const legendTitle = document.getElementById("legend-title");

    if (legendTitle) legendTitle.innerText = `分群圖例 (${config.name})`;
    if (legendContent)
        legendContent.innerHTML = `<p class="text-slate-500 text-sm text-center py-10">正在切換...</p>`;

    try {
        const timestamp = Date.now();
        const [nodesGD, nodesLV, nodesWT, csvRes, metricsRes] =
            await Promise.all([
                fetch(`./Output/nodes_edges_gd.json?v=${timestamp}`).then((r) =>
                    r.json(),
                ),
                fetch(
                    `./Output/Louvain/nodes_edges_lv.json?v=${timestamp}`,
                ).then((r) => r.json()),
                fetch(
                    `./Output/WalkTrap/nodes_edges_wt.json?v=${timestamp}`,
                ).then((r) => (r.ok ? r.json() : { nodes: [] })),
                fetch(
                    `${config.path}community_grouping_report_final${config.suffix}.csv?v=${timestamp}`,
                ).then((r) => r.text()),
                fetch(
                    `./Output/network_metrics_report.csv?v=${timestamp}`,
                ).then((r) => r.text()),
            ]);

        allAlgosNodes.gd = nodesGD.nodes;
        allAlgosNodes.lv = nodesLV.nodes;
        allAlgosNodes.wt = nodesWT.nodes;

        gData =
            algoKey === "greedy"
                ? nodesGD
                : algoKey === "louvain"
                  ? nodesLV
                  : nodesWT;
        communityData = parseCommunityCSV(csvRes);

        if (graphInstance) graphInstance.graphData(gData);
        else graphInstance = initNetwork(gData);
        // 2. 執行解析 (傳入 text 資料與對照表物件)
        parseMetricsCSV(metricsRes, allAlgosNodes);

        // 3. 渲染畫面
        renderMetricsTable();
    } catch (error) {
        console.error("載入失敗:", error);
    }
}

// ==========================================
// 曝露給全域的函式 (供 HTML onclick 使用)
// ==========================================

// 新增這一段：讓按鈕點擊能抓到搜尋功能，並傳入當前的 gData
window.handleSearch = () => handleSearch(gData);

window.switchAlgorithm = switchAlgorithm;

window.switchTab = (tab) => {
    document
        .getElementById("tab-network")
        .classList.toggle("hidden", tab !== "network");
    document
        .getElementById("tab-matrix")
        .classList.toggle("hidden", tab !== "data-report");
    document
        .getElementById("btn-network")
        .classList.toggle("tab-active", tab === "network");
    document
        .getElementById("btn-data-report")
        .classList.toggle("tab-active", tab === "heatmap");

    const isNetwork = tab === "network";
    document
        .getElementById("btn-legend-open")
        .classList.toggle("hidden", !isNetwork);
    document
        .getElementById("switch-algorithm")
        .classList.toggle("hidden", !isNetwork);
    document
        .getElementById("legend-panel")
        .classList.toggle("hidden", !isNetwork);
    document
        .getElementById("search-section")
        .classList.toggle("hidden", !isNetwork);
};

window.focusNodeByName = (name) => {
    const node = gData.nodes.find((n) => n.name === name);
    if (node) {
        focusNode(node);
        if (window.innerWidth < 1024) window.toggleLegend();
    }
};

window.resetView = () => {
    if (graphInstance) graphInstance.zoomToFit(1000);
};
