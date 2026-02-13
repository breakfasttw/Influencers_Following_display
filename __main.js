// ==========================================
// 1. 全域變數宣告 (Global Variables)
// ==========================================
let graphInstance = null;
let gData = { nodes: [], links: [] };
let matrixData = null;
let isDetailedMode = false;
let communityData = [];

// [新增] 報表相關變數
let metricsData = [];
let currentSort = { key: "Original_Rank", asc: true };

// [新增] 演算法設定表
const ALGO_CONFIG = {
    greedy: { name: "Greedy", path: "./Output/", suffix: "_gd" }, // 配合更名
    louvain: { name: "Louvain", path: "./Output/Louvain/", suffix: "_lv" },
    walktrap: { name: "WalkTrap", path: "./Output/WalkTrap/", suffix: "_wt" },
};

// [新增] 儲存所有演算法的節點對照表
let allAlgosNodes = {
    gd: [],
    lv: [],
    wt: [],
};

// [新增] 欄位顯示名稱對照表 (你之後可以在這裡修改顯示名稱)
const COLUMN_NAMES = {
    Original_Rank: "排名",
    Person_Name: "網紅名稱",
    "In_Degree (被追蹤數)": "In_Degree",
    "Out_Degree (主動追蹤數)": "Out_Degree",
    "Mutual_Follow (互粉數)": "互粉數",
    Network_Influence_Score: "被追蹤率",
    Betweenness_Centrality: "中介度",
    distinct_following: "追蹤人數",
    group_gd: "Greedy",
    group_lv: "Louvain",
    group_wt: "Walktrap",
};

const highlightNodes = new Set();
const highlightLinks = new Set();
let searchNode = null;

// ==========================================
// 2. 初始化邏輯 (Initialization)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 預設載入 Louvain 演算法
    switchAlgorithm("louvain");
});

// ==========================================
// 3. 全域函式定義 (Global Functions)
// ==========================================

/**
 * 切換演算法的核心邏輯
 */
async function switchAlgorithm(algoKey) {
    const config = ALGO_CONFIG[algoKey];
    const legendContent = document.getElementById("legend-content");
    const legendTitle = document.getElementById("legend-title");

    // 更新標題 (加入防呆檢查)
    if (legendTitle) {
        legendTitle.innerText = `分群圖例 (${config.name})`;
    }

    if (legendContent) {
        legendContent.innerHTML = `<p class="text-slate-500 text-sm text-center py-10">正在切換至 ${config.name} 演算法...</p>`;
    }

    try {
        // 構建檔案路徑
        // [修改] 一口氣抓取所有需要的檔案
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
                ).then((r) => (r.ok ? r.json() : { nodes: [] })), // 考慮 Walktrap 可能尚未產出
                fetch(
                    `${config.path}community_grouping_report_final${config.suffix}.csv?v=${timestamp}`,
                ).then((r) => r.text()),
                fetch(
                    `./Output/network_metrics_report.csv?v=${timestamp}`,
                ).then((r) => r.text()),
                fetch(`./Output/network_summary.json?v=${timestamp}`).then(
                    (r) => r.text(),
                ),
            ]);

        // 儲存對照表
        allAlgosNodes.gd = nodesGD.nodes;
        allAlgosNodes.lv = nodesLV.nodes;
        allAlgosNodes.wt = nodesWT.nodes;

        // 設定當前社交網路圖資料
        if (algoKey === "greedy") gData = nodesGD;
        else if (algoKey === "louvain") gData = nodesLV;
        else gData = nodesWT;

        // 解析報表 (此處會進行資料合併)
        parseCommunityCSV(csvRes);
        parseMetricsCSV(metricsRes);

        // 刷新 UI
        if (graphInstance) graphInstance.graphData(gData);
        else initNetwork();

        renderLegend();
        renderMetricsTable();

        // const nodesPath = `${config.path}nodes_edges${config.suffix}.json?v=${timestamp}`;
        // const csvPath = `${config.path}community_grouping_report_final${config.suffix}.csv?v=${timestamp}`;
        // const matrixPath = `./Output/matrix.json?v=${timestamp}`; // 假設矩陣共用，若不同也要改路徑
        // const metricsPath = `./Output/network_metrics_report.csv?v=${timestamp}`;
        // const summaryPath = `./Output/network_summary.json?v=${timestamp}`;

        // 嘗試獲取資料
        // const [nodesRes, csvRes, matrixRes, metricsRes] = await Promise.all([
        //     fetch(nodesPath).then((r) =>
        //         r.ok
        //             ? r.json()
        //             : Promise.reject(`Nodes file not found: ${nodesPath}`),
        //     ),
        //     fetch(csvPath).then((r) =>
        //         r.ok
        //             ? r.text()
        //             : Promise.reject(`CSV file not found: ${csvPath}`),
        //     ),
        //     fetch(matrixPath).then((r) =>
        //         r.ok ? r.json() : Promise.reject("Matrix file not found"),
        //     ),
        //     fetch(metricsPath).then((r) =>
        //         r.ok ? r.text() : Promise.reject("Metrics error"),
        //     ),
        //     fetch(summaryPath).then((r) =>
        //         r.ok ? r.text() : Promise.reject("summaryPath error"),
        //     ),
        // ]);

        // 資料獲取成功後更新全域變數
        // gData = nodesRes;
        // matrixData = matrixRes;
        // parseCommunityCSV(csvRes);
        // parseMetricsCSV(metricsRes); // [新增]
        // renderMetricsTable(); // [新增]

        // 重新建立鄰居索引 (Neighbor Index)
        // gData.links.forEach((link) => {
        //     const a = gData.nodes.find((n) => n.id === link.source);
        //     const b = gData.nodes.find((n) => n.id === link.target);

        //     // 防呆：確保節點存在
        //     if (a && b) {
        //         !a.neighbors && (a.neighbors = []);
        //         !b.neighbors && (b.neighbors = []);
        //         a.neighbors.push(b);
        //         b.neighbors.push(a);

        //         !a.links && (a.links = []);
        //         !b.links && (b.links = []);
        //         a.links.push(link);
        //         b.links.push(link);
        //     }
        // });

        // // 刷新 UI
        // if (graphInstance) {
        //     // 如果圖表已經存在，直接更新數據，這樣轉場比較平滑
        //     graphInstance.graphData(gData);
        // } else {
        //     // 第一次載入，初始化圖表
        //     initNetwork();
        // }

        // // 重新渲染圖例
        // renderLegend();
    } catch (error) {
        console.error(`Error loading ${algoKey}:`, error);
        // 若資料缺失，顯示提示訊息
        if (legendContent) {
            legendContent.innerHTML = `
                <div class="text-center py-10">
                    <p class="text-amber-500 text-sm mb-2">⚠️ 尚未有分群結果</p>
                    <p class="text-slate-600 text-xs">無法讀取資料：<br>${error}</p>
                    <p class="text-slate-600 text-xs mt-2">請確認 ${config.path} 目錄下的資料是否已產出</p>
                </div>
            `;
        }
        // 清空圖表避免誤導
        if (graphInstance) {
            graphInstance.graphData({ nodes: [], links: [] });
        }
    }
}

function parseCommunityCSV(text) {
    if (!text) return;
    const lines = text.split("\n").filter((line) => line.trim() !== "");
    // 跳過標題列 (slice(1))
    communityData = lines.slice(1).map((line) => {
        const parts = line.split(",");
        // 根據 CSV 格式：派系名稱,成員總數,核心領袖,所有成員
        return {
            name: parts[0],
            count: parts[1],
            leader: parts[2],
            members: parts[3] ? parts[3].split("|").map((m) => m.trim()) : [],
        };
    });
}

function renderLegend() {
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
                <td class="p-2 text-slate-200  text-xs ">${item.name}</td>
                <td class="p-2">
                    <span class="leader-link text-xs text-blue-400 cursor-pointer hover:text-blue-300 hover:underline" onclick="focusNodeByName('${item.leader}')">
                        👑${item.leader}
                    </span>
                </td>
                <td class="p-2 text-white text-xs text-right">${item.count}人</td>
                <td class="p-2 text-right">
                    <button onclick="toggleAccordion(${index})" class="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors">
                        名單
                    </button>
                </td>
            </tr>
            <tr>
                <td colspan="5" class="p-0">
                    <div id="accordion-${index}" class="accordion-content text-xs text-white bg-slate-900/50 px-4">
                        <div class="py-2 leading-relaxed">
                            ${sortedMembers}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `</table>`;
    container.innerHTML = html;
}

function toggleLegend() {
    const panel = document.getElementById("legend-panel");
    const openBtn = document.getElementById("btn-legend-open");

    if (panel) {
        panel.classList.toggle("open");
        // 如果面板開啟，隱藏按鈕；否則顯示按鈕
        if (panel.classList.contains("open")) {
            if (openBtn) openBtn.classList.add("hidden");
        } else {
            if (openBtn) openBtn.classList.remove("hidden");
        }
    }
}

function toggleAccordion(index) {
    const content = document.getElementById(`accordion-${index}`);
    if (content) {
        content.classList.toggle("expanded");
    }
}

function focusNodeByName(name) {
    if (!graphInstance) return;
    const node = gData.nodes.find((n) => n.name === name);
    if (node) {
        focusNode(node);
        // 手機版自動收合
        if (window.innerWidth < 1024) toggleLegend();
    } else {
        alert(`未找到網紅：${name}，目前為 0-Degree`);
    }
}

function initNetwork() {
    const elem = document.getElementById("network-viz");

    graphInstance = ForceGraph()(elem)
        .graphData(gData)
        .nodeId("id")
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
        .nodeCanvasObject((node, ctx, globalScale) => {
            const label = node.name;
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;

            // 繪製節點 (實心圓)
            ctx.beginPath();
            const r = Math.sqrt(node.val) * 4; // 調整大小係數
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
            ctx.fillStyle = node.color || "#cbd5e1";
            ctx.fill();

            // 搜尋高亮光暈效果
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

            // 繪製文字標籤 (僅在特定條件下顯示，避免過於雜亂)
            if (
                globalScale >= 1.5 ||
                highlightNodes.has(node) ||
                node === searchNode
            ) {
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                // [新增] 決定顏色邏輯
                // 判斷是否為「選中狀態」：即 searchNode (搜尋點) 或其鄰居 (highlightNodes)
                const isHighlighted =
                    node === searchNode || highlightNodes.has(node);

                // 背景顏色：選中時用純黑，未選中用半透明黑
                const bgColor = isHighlighted
                    ? "rgba(0, 0, 0, 1)"
                    : "rgba(0, 0, 0, 0.6)";

                // 文字顏色：選中時用粉紅色，未選中用白色
                const textColor = isHighlighted ? "#eaed15" : "#ffffff"; // #FF69B4 是標準 HotPink

                const textWidth = ctx.measureText(label).width;
                // 1. 繪製文字背景
                ctx.fillStyle = bgColor;
                ctx.fillRect(
                    node.x - textWidth / 2 - 2,
                    node.y + r + 2,
                    textWidth + 4,
                    fontSize + 4,
                );

                // 2. 繪製文字內容
                ctx.fillStyle = textColor;
                ctx.fillText(label, node.x, node.y + r + fontSize / 2 + 4);
            }
        })
        .linkSource("source")
        .linkTarget("target")
        .linkDirectionalArrowLength(3.5)
        .linkDirectionalArrowRelPos(1)
        .linkCurvature(0.2) // 讓雙向連結可見
        .linkWidth((link) => (highlightLinks.has(link) ? 2 : 0.5))
        .linkColor((link) =>
            highlightLinks.has(link) ? "#fbbf24" : "rgba(148, 163, 184, 0.2)",
        ) // slate-400
        .onNodeClick(focusNode)
        .onNodeHover((node) => {
            // [修改] 滑鼠懸停時，同時保留 searchNode 的高亮
            updateHighlightSets(node);
            elem.style.cursor = node ? "pointer" : null;
            // 滑鼠懸停互動
            // highlightNodes.clear();
            // highlightLinks.clear();
            // if (node) {
            //     highlightNodes.add(node);
            //     node.neighbors.forEach((neighbor) =>
            //         highlightNodes.add(neighbor),
            //     );
            //     node.links.forEach((link) => highlightLinks.add(link));
            // }
            // 觸發重新渲染 (update frame)
            // 這裡不需呼叫 graphData，ForceGraph 會自動處理 hover 狀態，
            // 但因為我們用了 nodeCanvasObject，需要手動告知
            elem.style.cursor = node ? "pointer" : null;
        });

    // 設定初始視角
    graphInstance.d3Force("charge").strength(-100); // 調整排斥力
}
/**
 * [新增] 統一管理高亮集合的函式
 * 邏輯：高亮集合 = (搜尋選中的節點及其關聯) + (滑鼠懸停的節點及其關聯)
 */
function updateHighlightSets(hoverNode = null) {
    highlightNodes.clear();
    highlightLinks.clear();

    // 收集需要計算高亮的「核心點」
    const coreNodes = [];
    if (searchNode) coreNodes.push(searchNode);
    if (hoverNode) coreNodes.push(hoverNode);

    coreNodes.forEach((node) => {
        highlightNodes.add(node);
        if (node.neighbors) {
            node.neighbors.forEach((neighbor) => highlightNodes.add(neighbor));
        }
        if (node.links) {
            node.links.forEach((link) => highlightLinks.add(link));
        }
    });
}

/**
 * [修改] 聚焦節點邏輯
 */
function focusNode(node) {
    if (!graphInstance) return;

    const distance = 200;
    graphInstance.centerAt(node.x, node.y, 1000);
    graphInstance.zoom(4, 2000);

    // 設定全域搜尋節點
    searchNode = node;

    // [重要] 更新高亮集合並觸發重繪
    updateHighlightSets();
}

function handleSearch(keyword) {
    // 邏輯：如果有傳 keyword 進來就用它，沒有就去抓 ID 為 'influencer-search' 的元素值
    const inputElement = document.getElementById("influencer-search");
    const searchVal = (
        typeof keyword === "string" ? keyword : inputElement.value
    ).trim();

    if (!searchVal) {
        alert("請輸入搜尋關鍵字");
        return;
    }

    // 模糊搜尋邏輯
    const target = gData.nodes.find((n) =>
        n.name.toLowerCase().includes(searchVal.toLowerCase()),
    );

    if (target) {
        focusNode(target);
    } else {
        alert(`找不到與「${searchVal}」相關的網紅`);
    }
}

function unlockNodes() {
    gData.nodes.forEach((n) => {
        n.fx = null;
        n.fy = null;
    });
    searchNode = null;
    highlightNodes.clear();
    highlightLinks.clear();
}

function resetView() {
    graphInstance.zoomToFit(1000);
}

function switchTab(tab) {
    document
        .getElementById("tab-network")
        .classList.toggle("hidden", tab !== "network");
    document
        .getElementById("tab-matrix")
        .classList.toggle("hidden", tab !== "heatmap");
    document
        .getElementById("btn-network")
        .classList.toggle("tab-active", tab === "network");
    document
        .getElementById("btn-heatmap")
        .classList.toggle("tab-active", tab === "heatmap");
    if (tab === "heatmap") Plotly.Plots.resize("heatmap-viz");
    document
        .getElementById("btn-legend-open")
        .classList.toggle("hidden", tab === "heatmap");
    document
        .getElementById("switch-algorithm")
        .classList.toggle("hidden", tab === "heatmap");
    document
        .getElementById("legend-panel")
        .classList.toggle("hidden", tab === "heatmap");
    document
        .getElementById("search-section")
        .classList.toggle("hidden", tab === "heatmap");
}

/**
 * [新增] 解析指標報表 CSV
 */

/**
 * [修改] 解析指標報表並合併分群結果
 */
function parseMetricsCSV(text) {
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    const headers = lines[0].split(",");

    metricsData = lines.slice(1).map((line) => {
        const values = line.split(",");
        let obj = {};
        headers.forEach((header, i) => {
            const val = values[i].trim();
            obj[header.trim()] = isNaN(val) ? val : parseFloat(val);
        });

        // [核心新增] 交叉對照分群結果
        const name = obj["Person_Name"];

        const findGroup = (nodeList) => {
            const node = nodeList.find((n) => n.name === name);
            return node ? node.group : "尚未有資料";
        };

        obj["group_gd"] = findGroup(allAlgosNodes.gd);
        obj["group_lv"] = findGroup(allAlgosNodes.lv);
        obj["group_wt"] = findGroup(allAlgosNodes.wt);

        return obj;
    });
}
// function parseMetricsCSV(text) {
//     const lines = text.split("\n").filter((l) => l.trim() !== "");
//     const headers = lines[0].split(",");

//     metricsData = lines.slice(1).map((line) => {
//         const values = line.split(",");
//         let obj = {};
//         headers.forEach((header, i) => {
//             const val = values[i].trim();
//             // 自動轉換數字型態以便排序
//             obj[header.trim()] = isNaN(val) ? val : parseFloat(val);
//         });
//         return obj;
//     });
// }

/**
 * [新增] 處理排序點擊
 */
function handleTableSort(key) {
    if (currentSort.key === key) {
        currentSort.asc = !currentSort.asc;
    } else {
        currentSort.key = key;
        currentSort.asc = true;
    }
    renderMetricsTable();
}

/**
 * [整合版] 渲染報表表格
 * 包含：數字置右、千分位、浮點數四捨五入補零、演算法分群對照
 */
function renderMetricsTable() {
    const container = document.getElementById("heatmap-viz");
    if (!metricsData || !metricsData.length) return;

    // 1. 排序邏輯：支援字串字典序與數字大小序
    const sortedData = [...metricsData].sort((a, b) => {
        let v1 = a[currentSort.key];
        let v2 = b[currentSort.key];

        if (typeof v1 === "string") {
            return currentSort.asc
                ? v1.localeCompare(v2)
                : v2.localeCompare(v1);
        } else {
            // 處理數字型別排序
            const n1 = v1 || 0;
            const n2 = v2 || 0;
            return currentSort.asc ? n1 - n2 : n2 - n1;
        }
    });

    // 取得所有要顯示的欄位 Key (來自 COLUMN_NAMES 物件)
    const headers = Object.keys(COLUMN_NAMES);

    // 2. 構建 HTML
    let html = `
        <table class="metrics-table w-full text-left text-sm text-slate-300 border-collapse">
            <thead class="bg-slate-700/50 text-slate-100 sticky top-0 z-10 shadow-sm">
                <tr>
                    ${headers
                        .map((h) => {
                            // 判斷該欄位第一筆資料是否為數字，決定標題是否靠右
                            const isNumeric =
                                typeof metricsData[0][h] === "number";
                            return `
                            <th class="p-4 cursor-pointer hover:bg-slate-600 transition-colors border-b border-slate-600" onclick="handleTableSort('${h}')">
                                <div class="flex items-center ${isNumeric ? "justify-end" : "justify-start"}">
                                    <span class="whitespace-nowrap">${COLUMN_NAMES[h]}</span>
                                    <span class="sort-icon ml-1 ${currentSort.key === h ? "sort-active" : "opacity-20"}">
                                        ${currentSort.key === h ? (currentSort.asc ? "▲" : "▼") : "↕"}
                                    </span>
                                </div>
                            </th>
                        `;
                        })
                        .join("")}
                </tr>
            </thead>
            <tbody>
                ${sortedData
                    .map(
                        (row) => `
                    <tr class="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        ${headers
                            .map((h) => {
                                let displayVal = row[h];
                                let alignClass = "text-left"; // 預設靠左
                                let customStyle = ""; // 額外樣式

                                // --- 邏輯 A：處理數字型別 (排序、千分位、浮點數) ---
                                if (
                                    typeof displayVal === "number" &&
                                    !isNaN(displayVal)
                                ) {
                                    alignClass = "text-right"; // 數字一律靠右

                                    if (displayVal % 1 !== 0) {
                                        // 情況 1：浮點數 -> 四捨五入到小數第二位，不足補 0 (例如 45.00)
                                        displayVal = displayVal.toLocaleString(
                                            "en-US",
                                            {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            },
                                        );
                                    } else {
                                        // 情況 2：整數 -> 維持整數並加上千分位
                                        displayVal =
                                            displayVal.toLocaleString("en-US");
                                    }
                                }
                                // --- 邏輯 B：處理字串型別 (網紅名稱、演算法分群) ---
                                else {
                                    alignClass = "text-left";
                                    // 如果是演算法分群欄位，加上灰色斜體區隔
                                    if (h.includes("group")) {
                                        customStyle = "text-slate-500 italic";
                                    }
                                    // 如果是網紅名稱，加上藍色加粗
                                    if (h === "Person_Name") {
                                        customStyle =
                                            "text-blue-400 font-medium";
                                    }
                                    // 若為 null 或 undefined 的處理
                                    if (
                                        displayVal === null ||
                                        displayVal === undefined
                                    ) {
                                        displayVal = "-";
                                    }
                                }

                                return `
                                <td class="p-4 ${alignClass} ${customStyle} whitespace-nowrap">
                                    ${displayVal}
                                </td>
                            `;
                            })
                            .join("")}
                    </tr>
                `,
                    )
                    .join("")}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

/**
 * [新增] 渲染報表表格
 */
// function renderMetricsTable() {
//     const container = document.getElementById("heatmap-viz");
//     if (!metricsData.length) return;

//     // 排序邏輯
//     const sortedData = [...metricsData].sort((a, b) => {
//         let v1 = a[currentSort.key];
//         let v2 = b[currentSort.key];

//         if (typeof v1 === "string") {
//             return currentSort.asc
//                 ? v1.localeCompare(v2)
//                 : v2.localeCompare(v1);
//         } else {
//             return currentSort.asc ? v1 - v2 : v2 - v1;
//         }
//     });

//     const headers = Object.keys(COLUMN_NAMES);

//     // 2. 構建 HTML
//     let html = `
//         <table class="metrics-table w-full text-left text-sm text-slate-300">
//             <thead class="bg-slate-700/50 text-slate-100 sticky top-0">
//                 <tr>
//                     ${headers
//                         .map(
//                             (h) => `
//                         <th class="p-4 cursor-pointer hover:bg-slate-600 transition-colors" onclick="handleTableSort('${h}')">
//                             <div class="flex items-center ${typeof metricsData[0][h] === "number" ? "justify-end" : ""}">
//                                 ${COLUMN_NAMES[h]}
//                                 <span class="sort-icon ${currentSort.key === h ? "sort-active" : ""}">
//                                     ${currentSort.key === h ? (currentSort.asc ? "▲" : "▼") : "↕"}
//                                 </span>
//                             </div>
//                         </th>
//                     `,
//                         )
//                         .join("")}
//                 </tr>
//             </thead>
//             <tbody>
//                 ${sortedData
//                     .map(
//                         (row) => `
//                     <tr class="border-b border-slate-700/50">
//                         ${headers
//                             .map((h) => {
//                                 let displayVal = row[h];
//                                 let alignClass = ""; // 預設靠左

//                                 // [新增邏輯] 判斷是否為數字型別
//                                 if (
//                                     typeof displayVal === "number" &&
//                                     !isNaN(displayVal)
//                                 ) {
//                                     alignClass = "text-right"; // 1. 數字欄位靠右對齊

//                                     // 2. 判斷是否為浮點數欄位
//                                     // 邏輯：檢查該欄位值是否包含小數點 (非整數)
//                                     if (displayVal % 1 !== 0) {
//                                         // 浮點數：四捨五入並補足兩位小數點，再加上千分位
//                                         displayVal = displayVal.toLocaleString(
//                                             "en-US",
//                                             {
//                                                 minimumFractionDigits: 2,
//                                                 maximumFractionDigits: 2,
//                                             },
//                                         );
//                                     } else {
//                                         // 整數：維持整數並加上千分位
//                                         displayVal =
//                                             displayVal.toLocaleString("en-US");
//                                     }
//                                 }

//                                 return `
//                                 <td class="p-4 ${alignClass} ${h === "Person_Name" ? "text-blue-400 font-medium text-left" : ""}">
//                                     ${displayVal}
//                                 </td>
//                             `;
//                             })
//                             .join("")}
//                     </tr>
//                 `,
//                     )
//                     .join("")}
//             </tbody>
//         </table>
//     `;
//     container.innerHTML = html;
// }
