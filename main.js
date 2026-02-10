// ==========================================
// 1. 全域變數宣告 (Global Variables)
// ==========================================
let graphInstance = null;
let gData = { nodes: [], links: [] };
let matrixData = null;
let isDetailedMode = false;
let communityData = [];

// [新增] 演算法設定表
const ALGO_CONFIG = {
    greedy: {
        name: "Greedy",
        path: "./Output/",
        suffix: "",
    },
    louvain: {
        name: "Louvain",
        path: "./Output/Louvain/",
        suffix: "_lv",
    },
    walktrap: {
        name: "WalkTrap",
        path: "./Output/WalkTrap/",
        suffix: "_wt",
    },
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
        // 加入 ?v=Date.now() 防止快取，確保讀到最新檔案
        const timestamp = Date.now();
        const nodesPath = `${config.path}nodes_edges${config.suffix}.json?v=${timestamp}`;
        const csvPath = `${config.path}community_grouping_report_final${config.suffix}.csv?v=${timestamp}`;
        const matrixPath = `./Output/matrix.json?v=${timestamp}`; // 假設矩陣共用，若不同也要改路徑

        // 嘗試獲取資料
        const [nodesRes, csvRes, matrixRes] = await Promise.all([
            fetch(nodesPath).then((r) =>
                r.ok
                    ? r.json()
                    : Promise.reject(`Nodes file not found: ${nodesPath}`),
            ),
            fetch(csvPath).then((r) =>
                r.ok
                    ? r.text()
                    : Promise.reject(`CSV file not found: ${csvPath}`),
            ),
            fetch(matrixPath).then((r) =>
                r.ok ? r.json() : Promise.reject("Matrix file not found"),
            ),
        ]);

        // 資料獲取成功後更新全域變數
        gData = nodesRes;
        matrixData = matrixRes;
        parseCommunityCSV(csvRes);

        // 重新建立鄰居索引 (Neighbor Index)
        gData.links.forEach((link) => {
            const a = gData.nodes.find((n) => n.id === link.source);
            const b = gData.nodes.find((n) => n.id === link.target);

            // 防呆：確保節點存在
            if (a && b) {
                !a.neighbors && (a.neighbors = []);
                !b.neighbors && (b.neighbors = []);
                a.neighbors.push(b);
                b.neighbors.push(a);

                !a.links && (a.links = []);
                !b.links && (b.links = []);
                a.links.push(link);
                b.links.push(link);
            }
        });

        // 刷新 UI
        if (graphInstance) {
            // 如果圖表已經存在，直接更新數據，這樣轉場比較平滑
            graphInstance.graphData(gData);
        } else {
            // 第一次載入，初始化圖表
            initNetwork();
            initHeatmap();
        }

        // 重新渲染圖例
        renderLegend();
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
                雙向互粉：<span style="color: #f8fafc">${node.metrics.mutual}</span>
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

// function focusNode(node) {
//     if (!graphInstance) return;

//     // Zoom 到節點
//     const distance = 200;
//     const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z || 0);

//     graphInstance.centerAt(node.x, node.y, 1000);
//     graphInstance.zoom(4, 2000);

//     searchNode = node; // 設定為搜尋目標以觸發高亮
// }

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
    // if (!keyword) return;
    // // 模糊搜尋
    // const target = gData.nodes.find((n) =>
    //     n.name.toLowerCase().includes(keyword.toLowerCase()),
    // );

    // if (target) {
    //     focusNode(target);
    // } else {
    //     alert("找不到相關網紅");
    // }
}

// let graphInstance = null;
// let gData = { nodes: [], links: [] };
// let matrixData = null;
// let isDetailedMode = false;

// // 儲存分群報表資料
// let communityData = [];

// // [新增] 演算法設定表
// const ALGO_CONFIG = {
//     greedy: {
//         name: "Greedy",
//         path: "./Output/",
//         suffix: "",
//     },
//     louvain: {
//         name: "Louvain",
//         path: "./Output/Louvain/",
//         suffix: "_lv",
//     },
//     walktrap: {
//         name: "WalkTrap",
//         path: "./Output/WalkTrap/",
//         suffix: "_wt",
//     },
// };

// // [修改] 初始化改為載入 Louvain
// document.addEventListener("DOMContentLoaded", () => {
//     switchAlgorithm("louvain");
// });

// /**
//  * [新增] 切換演算法的核心邏輯
//  */
// async function switchAlgorithm(algoKey) {
//     const config = ALGO_CONFIG[algoKey];
//     const legendContent = document.getElementById("legend-content");
//     const legendTitle = document.getElementById("legend-title");

//     // [新增] 安全檢查：如果找不到標題元素，就不要執行 innerText 賦值
//     if (legendTitle) {
//         legendTitle.innerText = `分群報表圖例 (${config.name})`;
//     }

//     // 更新標題
//     legendTitle.innerText = `分群報表圖例 (${config.name})`;
//     legendContent.innerHTML = `<p class="text-slate-500 text-sm text-center py-10">正在切換至 ${config.name} 演算法...</p>`;

//     try {
//         // 構建檔案路徑
//         const nodesPath = `${config.path}nodes_edges${config.suffix}.json`;
//         const csvPath = `${config.path}community_grouping_report_final${config.suffix}.csv`;

//         // 嘗試獲取資料
//         const [nodesRes, csvRes] = await Promise.all([
//             fetch(nodesPath).then((r) =>
//                 r.ok ? r.json() : Promise.reject("Nodes not found"),
//             ),
//             fetch(csvPath).then((r) =>
//                 r.ok ? r.text() : Promise.reject("CSV not found"),
//             ),
//         ]);

//         // 資料獲取成功後更新全局變數
//         gData = nodesRes;
//         parseCommunityCSV(csvRes);

//         // 重新處理連線索引 (這部分保留你原有的 logic)
//         gData.links.forEach((link) => {
//             const a = gData.nodes.find((n) => n.id === link.source);
//             const b = gData.nodes.find((n) => n.id === link.target);
//             if (a && b) {
//                 // 加個保險以免 nodes 跟 links 不對應
//                 !a.neighbors && (a.neighbors = []);
//                 !b.neighbors && (b.neighbors = []);
//                 a.neighbors.push(b);
//                 b.neighbors.push(a);
//                 !a.links && (a.links = []);
//                 !b.links && (b.links = []);
//                 a.links.push(link);
//                 b.links.push(link);
//             }
//         });

//         // 刷新 UI
//         if (graphInstance) {
//             graphInstance.graphData(gData); // 直接更新數據而非重新 init 以維持效能
//         } else {
//             initNetwork();
//         }
//         renderLegend();
//     } catch (error) {
//         console.error(`Error loading ${algoKey}:`, error);
//         // [新增] 若資料缺失，顯示提示訊息
//         legendContent.innerHTML = `
//             <div class="text-center py-10">
//                 <p class="text-amber-500 text-sm mb-2">⚠️ 尚未有分群結果</p>
//                 <p class="text-slate-600 text-xs">請確認 ${config.path} 目錄下的資料是否已產出</p>
//             </div>
//         `;
//         // 如果原本有圖，可以選擇清除或保留舊圖，這裡建議清除以防誤導
//         if (graphInstance) graphInstance.graphData({ nodes: [], links: [] });
//     }
// }

// const highlightNodes = new Set();
// const highlightLinks = new Set();
// let searchNode = null;

// // 初始化
// Promise.all([
//     fetch("./Output/nodes_edges.json").then((res) => res.json()),
//     fetch("./Output/matrix.json").then((res) => res.json()),
//     // [修正] 確保這裡抓取的是 text 格式
//     fetch("./Output/community_grouping_report_final.csv?v=" + Date.now()).then(
//         (res) => res.text(),
//     ),
// ]).then(([nodesEdges, matrix, csvResponseText]) => {
//     gData = nodesEdges;
//     matrixData = matrix;

//     // 解析 CSV 並渲染圖例
//     parseCommunityCSV(csvResponseText);

//     // 建立鄰居索引，以利互動式的高亮（Highlight）
//     gData.links.forEach((link) => {
//         // 將鄰居節點與相關連線存入節點物件中
//         const a = gData.nodes.find(
//             (n) => n.id === (link.source.id || link.source),
//         );
//         const b = gData.nodes.find(
//             (n) => n.id === (link.target.id || link.target),
//         );
//         if (a && b) {
//             !a.neighbors && (a.neighbors = []);
//             !b.neighbors && (b.neighbors = []);
//             a.neighbors.push(b);
//             b.neighbors.push(a);
//             !a.links && (a.links = []);
//             !b.links && (b.links = []);
//             a.links.push(link);
//             b.links.push(link);
//         }
//     });
//     initNetwork();
//     initHeatmap();
//     renderLegend(); //  初始渲染圖例
// });

// // [新增] CSV 解析函數 (針對格式：派系名稱,成員總數,核心領袖,所有成員)
// function parseCommunityCSV(text) {
//     if (!text) return;
//     const lines = text.split("\n").filter((line) => line.trim() !== "");
//     const headers = lines[0].split(",");

//     communityData = lines.slice(1).map((line) => {
//         // 考慮到「所有成員」欄位內含 | 號，簡單用 split(",") 即可，因為成員列表是最後一欄
//         const parts = line.split(",");
//         return {
//             name: parts[0],
//             count: parts[1],
//             leader: parts[2],
//             members: parts[3] ? parts[3].split("|").map((m) => m.trim()) : [],
//         };
//     });
// }

// // [新增] 渲染圖例面板
// function renderLegend() {
//     const container = document.getElementById("legend-content");
//     if (!communityData.length) return;

//     let html = `<table class="legend-table text-sm text-left">`;

//     communityData.forEach((item, index) => {
//         // 直接使用 CSV 的派系名稱與 JSON 節點的 group 欄位進行比對
//         // item.name 來自 community_grouping_report_final.csv (例如 "主要派系 1")
//         // n.group 來自 nodes_edges.json (也是 "主要派系 1")
//         const representativeNode = gData.nodes.find(
//             (n) => n.group === item.name,
//         );

//         // 抓取該節點定義的顏色，若無對應則給予深灰色預設值
//         const color = representativeNode ? representativeNode.color : "#475569";

//         html += `
//             <tr class="legend-row-header">
//                 <td class="p-2 w-4" style="background-color: ${color}; border-radius: 8px 0 0 8px;"></td>
//                 <td class="p-2 ">${item.name}</td>
//                 <td class="p-2 text-xs">
//                     <span class="leader-link" onclick="focusNodeByName('${item.leader}')"> 👑 ${item.leader}</span>
//                 </td>
//                 <td class="p-2 text-slate-400">${item.count}人</td>
//                 <td class="p-2 text-right">
//                     <button onclick="toggleAccordion(${index})" class="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-[11px]">清單</button>
//                 </td>
//             </tr>
//             <tr>
//                 <td colspan="5">
//                     <div id="accordion-${index}" class="accordion-content text-xs text-slate-400 leading-relaxed">
//                         ${item.members.join("、")}
//                     </div>
//                 </td>
//             </tr>
//         `;
//     });

//     html += `</table>`;
//     container.innerHTML = html;
// }

// // [新增] 切換圖例面板開關
// function toggleLegend() {
//     const panel = document.getElementById("legend-panel");
//     const openBtn = document.getElementById("btn-legend-open");

//     // 1. 切換面板顯示狀態
//     panel.classList.toggle("open");

//     // 2. 根據面板狀態決定按鈕是否消失
//     // 如果面板現在是開啟的 (含有 'open')，就讓按鈕消失 (加入 'hidden')
//     if (panel.classList.contains("open")) {
//         openBtn.classList.add("hidden");
//     } else {
//         openBtn.classList.remove("hidden");
//     }
// }

// // [新增] 手風琴開闔邏輯
// function toggleAccordion(index) {
//     const content = document.getElementById(`accordion-${index}`);
//     content.classList.toggle("expanded");
// }

// // [新增] 透過名稱搜尋並聚焦節點 (供圖例點擊使用)
// function focusNodeByName(name) {
//     const node = gData.nodes.find((n) => n.name === name);
//     if (node) {
//         focusNode(node);
//         // 如果在手機版，點擊後自動收合圖例以便觀看
//         if (window.innerWidth < 1024) toggleLegend();
//     } else {
//         alert("未找到該網紅節點");
//     }
// }

// function initNetwork() {
//     const elem = document.getElementById("network-viz");
//     graphInstance = ForceGraph()(elem)
//         .graphData(gData)
//         .nodeId("id")
//         .width(elem.clientWidth)
//         .height(elem.clientHeight)

//         // --- 加回數據顯示 (Hover Tooltip) ---
//         .nodeLabel(
//             (node) => `
//             <div style="color: #60a5fa; font-weight: bold; margin-bottom: 4px;">${node.name}</div>
//             <div style="color: #a2abb8; font-size: 12px;">
//                 派系：${node.group}<br/>
//                 <hr style="border-color: #334155; margin: 4px 0;"/>
//                 被追蹤數：<span style="color: #f8fafc">${node.metrics.in_degree}</span><br/>
//                 追蹤他人：<span style="color: #f8fafc">${node.metrics.out_degree}</span><br/>
//                 雙向互粉：<span style="color: #f8fafc">${node.metrics.mutual}</span>
//             </div>
//         `,
//         )

//         // 用來區分「雙向互粉」與單向追蹤，讓視覺上不會所有線都疊在一起
//         .linkCurvature((l) => (l.type === "mutual" ? 0.3 : 0))
//         .linkDirectionalArrowLength(3) // 利用 linkDirectionalArrowLength 顯示追蹤的方向性。
//         .nodeColor((node) =>
//             highlightNodes.has(node) || node === searchNode
//                 ? "#fbbf24"
//                 : node.color,
//         )
//         .linkColor((link) =>
//             highlightLinks.has(link) ? "#60a5fa" : "rgba(148, 163, 184, 0.1)",
//         )
//         .linkWidth((link) => (highlightLinks.has(link) ? 2.5 : 0.5))
//         .onNodeDrag((node) => {
//             highlightNodes.clear();
//             highlightLinks.clear();
//             if (node) {
//                 highlightNodes.add(node);
//                 node.neighbors &&
//                     node.neighbors.forEach((neighbor) =>
//                         highlightNodes.add(neighbor),
//                     );
//                 node.links &&
//                     node.links.forEach((link) => highlightLinks.add(link));
//             }
//             searchNode = node;
//         })
//         .onNodeDragEnd((node) => {
//             node.fx = node.x;
//             node.fy = node.y;
//         })
//         .nodeCanvasObject((node, ctx, globalScale) => {
//             // 自定義節點外觀
//             const isFocus = node === searchNode || highlightNodes.has(node);
//             const label = node.name;
//             const radius = Math.sqrt(node.val) * 2; // 節點半徑由 node.val 決定

//             // 透過 Set 儲存目前選中的節點與連線，動態更新 Canvas 的 shadowBlur 產生發光效果
//             if (isFocus) {
//                 ctx.shadowColor = node === searchNode ? "#fbbf24" : "#60a5fa";
//                 ctx.shadowBlur = 15;
//                 ctx.fillStyle = node === searchNode ? "#fbbf24" : "#60a5fa";
//                 ctx.beginPath();
//                 ctx.arc(node.x, node.y, radius + 1, 0, 2 * Math.PI);
//                 ctx.fill();
//                 ctx.shadowBlur = 0;
//             }

//             ctx.fillStyle = node.color;
//             ctx.beginPath();
//             ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
//             ctx.fill();

//             if (globalScale > 2 || isFocus) {
//                 const fontSize = isFocus ? 16 / globalScale : 12 / globalScale;
//                 ctx.font = `${isFocus ? "bold " : ""}${fontSize}px Iansui`;
//                 ctx.textAlign = "center";
//                 ctx.textBaseline = "middle";
//                 ctx.fillStyle = isFocus ? "#e062e2" : "#c4c6c6";
//                 ctx.fillText(label, node.x, node.y + radius + fontSize + 2);
//             }
//         })
//         .onNodeClick((node) => focusNode(node));
// }

// // 關鍵字搜尋
// function handleSearch() {
//     const input = document.getElementById("influencer-search").value.trim();
//     const node = gData.nodes.find((n) => n.name.includes(input));
//     if (node) focusNode(node);
//     else alert("未找到網紅");
// }

// function focusNode(node) {
//     searchNode = node;
//     highlightNodes.clear();
//     highlightLinks.clear();
//     highlightNodes.add(node);
//     node.neighbors && node.neighbors.forEach((n) => highlightNodes.add(n));
//     node.links && node.links.forEach((l) => highlightLinks.add(l));
//     graphInstance.centerAt(node.x, node.y, 1000);
//     graphInstance.zoom(3, 1000);
// }

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
        .getElementById("tab-heatmap")
        .classList.toggle("hidden", tab !== "heatmap");
    document
        .getElementById("btn-network")
        .classList.toggle("tab-active", tab === "network");
    document
        .getElementById("btn-heatmap")
        .classList.toggle("tab-active", tab === "heatmap");
    if (tab === "heatmap") Plotly.Plots.resize("heatmap-viz");
}

function initHeatmap() {
    const trace = {
        z: matrixData.z,
        x: matrixData.x,
        y: matrixData.y,
        type: "heatmap",
        colorscale: [
            [0, "#0f172a"],
            [0.5, "#3b82f6"],
            [1, "#93c5fd"],
        ],
        hovertemplate:
            "追蹤者: %{y}<br>被追蹤者: %{x}<br>強度: %{z}<extra></extra>",
    };

    const layout = {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        margin: { l: 150, r: 50, b: 150, t: 20 },
        xaxis: {
            tickangle: 45,
            color: "#94a3b8",
            automargin: true,
            // 根據模式決定是否強制顯示所有 tick
            tickmode: isDetailedMode ? "linear" : "auto",
            dtick: isDetailedMode ? 1 : undefined,
        },
        yaxis: {
            autorange: "reversed",
            color: "#94a3b8",
            scaleanchor: "x",
            automargin: true,
            tickmode: isDetailedMode ? "linear" : "auto",
            dtick: isDetailedMode ? 1 : undefined,
        },
    };

    Plotly.newPlot("heatmap-viz", [trace], layout, {
        responsive: true,
        scrollZoom: true,
    });
}

// 切換精細模式 (顯示所有姓名)
function toggleDetailedLabels() {
    isDetailedMode = !isDetailedMode;
    const btn = document.getElementById("btn-toggle-labels");
    btn.innerText = isDetailedMode
        ? "📉 恢復自動縮放 (一般模式)"
        : "🔍 顯示所有姓名 (精細模式)";
    btn.classList.toggle("bg-blue-600/80");
    btn.classList.toggle("bg-green-600/80");
    initHeatmap(); // 重新渲染以更新 axis 設定
}
