let graphInstance = null;
let gData = { nodes: [], links: [] };
let matrixData = null;
let isDetailedMode = false;

// 儲存分群報表資料
let communityData = [];

const highlightNodes = new Set();
const highlightLinks = new Set();
let searchNode = null;

// 初始化
Promise.all([
    fetch("./Output/nodes_edges.json").then((res) => res.json()),
    fetch("./Output/matrix.json").then((res) => res.json()),
    // [修正] 確保這裡抓取的是 text 格式
    fetch("./Output/community_grouping_report_final.csv?v=" + Date.now()).then(
        (res) => res.text(),
    ),
]).then(([nodesEdges, matrix, csvResponseText]) => {
    gData = nodesEdges;
    matrixData = matrix;

    // 解析 CSV 並渲染圖例
    parseCommunityCSV(csvResponseText);

    // 建立鄰居索引，以利互動式的高亮（Highlight）
    gData.links.forEach((link) => {
        // 將鄰居節點與相關連線存入節點物件中
        const a = gData.nodes.find(
            (n) => n.id === (link.source.id || link.source),
        );
        const b = gData.nodes.find(
            (n) => n.id === (link.target.id || link.target),
        );
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
    initNetwork();
    initHeatmap();
    renderLegend(); //  初始渲染圖例
});

// [新增] CSV 解析函數 (針對格式：派系名稱,成員總數,核心領袖,所有成員)
function parseCommunityCSV(text) {
    if (!text) return;
    const lines = text.split("\n").filter((line) => line.trim() !== "");
    const headers = lines[0].split(",");

    communityData = lines.slice(1).map((line) => {
        // 考慮到「所有成員」欄位內含 | 號，簡單用 split(",") 即可，因為成員列表是最後一欄
        const parts = line.split(",");
        return {
            name: parts[0],
            count: parts[1],
            leader: parts[2],
            members: parts[3] ? parts[3].split("|").map((m) => m.trim()) : [],
        };
    });
}

// [新增] 渲染圖例面板
function renderLegend() {
    const container = document.getElementById("legend-content");
    if (!communityData.length) return;

    let html = `<table class="legend-table text-sm text-left">`;

    communityData.forEach((item, index) => {
        // 直接使用 CSV 的派系名稱與 JSON 節點的 group 欄位進行比對
        // item.name 來自 community_grouping_report_final.csv (例如 "主要派系 1")
        // n.group 來自 nodes_edges.json (也是 "主要派系 1")
        const representativeNode = gData.nodes.find(
            (n) => n.group === item.name,
        );

        // 抓取該節點定義的顏色，若無對應則給予深灰色預設值
        const color = representativeNode ? representativeNode.color : "#475569";

        html += `
            <tr class="legend-row-header">
                <td class="p-2 w-4" style="background-color: ${color}; border-radius: 8px 0 0 8px;"></td>
                <td class="p-2 ">${item.name}</td>
                <td class="p-2 text-xs">
                    <span class="leader-link" onclick="focusNodeByName('${item.leader}')"> 👑 ${item.leader}</span>
                </td>
                <td class="p-2 text-slate-400">${item.count}人</td>
                <td class="p-2 text-right">
                    <button onclick="toggleAccordion(${index})" class="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-[11px]">清單</button>
                </td>
            </tr>
            <tr>
                <td colspan="5">
                    <div id="accordion-${index}" class="accordion-content text-xs text-slate-400 leading-relaxed">
                        ${item.members.join("、")}
                    </div>
                </td>
            </tr>
        `;
    });

    html += `</table>`;
    container.innerHTML = html;
}

// [新增] 切換圖例面板開關
function toggleLegend() {
    const panel = document.getElementById("legend-panel");
    const openBtn = document.getElementById("btn-legend-open");

    // 1. 切換面板顯示狀態
    panel.classList.toggle("open");

    // 2. 根據面板狀態決定按鈕是否消失
    // 如果面板現在是開啟的 (含有 'open')，就讓按鈕消失 (加入 'hidden')
    if (panel.classList.contains("open")) {
        openBtn.classList.add("hidden");
    } else {
        openBtn.classList.remove("hidden");
    }
}

// [新增] 手風琴開闔邏輯
function toggleAccordion(index) {
    const content = document.getElementById(`accordion-${index}`);
    content.classList.toggle("expanded");
}

// [新增] 透過名稱搜尋並聚焦節點 (供圖例點擊使用)
function focusNodeByName(name) {
    const node = gData.nodes.find((n) => n.name === name);
    if (node) {
        focusNode(node);
        // 如果在手機版，點擊後自動收合圖例以便觀看
        if (window.innerWidth < 1024) toggleLegend();
    } else {
        alert("未找到該網紅節點");
    }
}

function initNetwork() {
    const elem = document.getElementById("network-viz");
    graphInstance = ForceGraph()(elem)
        .graphData(gData)
        .nodeId("id")
        .width(elem.clientWidth)
        .height(elem.clientHeight)

        // --- 加回數據顯示 (Hover Tooltip) ---
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

        // 用來區分「雙向互粉」與單向追蹤，讓視覺上不會所有線都疊在一起
        .linkCurvature((l) => (l.type === "mutual" ? 0.3 : 0))
        .linkDirectionalArrowLength(3) // 利用 linkDirectionalArrowLength 顯示追蹤的方向性。
        .nodeColor((node) =>
            highlightNodes.has(node) || node === searchNode
                ? "#fbbf24"
                : node.color,
        )
        .linkColor((link) =>
            highlightLinks.has(link) ? "#60a5fa" : "rgba(148, 163, 184, 0.1)",
        )
        .linkWidth((link) => (highlightLinks.has(link) ? 2.5 : 0.5))
        .onNodeDrag((node) => {
            highlightNodes.clear();
            highlightLinks.clear();
            if (node) {
                highlightNodes.add(node);
                node.neighbors &&
                    node.neighbors.forEach((neighbor) =>
                        highlightNodes.add(neighbor),
                    );
                node.links &&
                    node.links.forEach((link) => highlightLinks.add(link));
            }
            searchNode = node;
        })
        .onNodeDragEnd((node) => {
            node.fx = node.x;
            node.fy = node.y;
        })
        .nodeCanvasObject((node, ctx, globalScale) => {
            // 自定義節點外觀
            const isFocus = node === searchNode || highlightNodes.has(node);
            const label = node.name;
            const radius = Math.sqrt(node.val) * 2; // 節點半徑由 node.val 決定

            // 透過 Set 儲存目前選中的節點與連線，動態更新 Canvas 的 shadowBlur 產生發光效果
            if (isFocus) {
                ctx.shadowColor = node === searchNode ? "#fbbf24" : "#60a5fa";
                ctx.shadowBlur = 15;
                ctx.fillStyle = node === searchNode ? "#fbbf24" : "#60a5fa";
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 1, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            ctx.fillStyle = node.color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.fill();

            if (globalScale > 2 || isFocus) {
                const fontSize = isFocus ? 16 / globalScale : 12 / globalScale;
                ctx.font = `${isFocus ? "bold " : ""}${fontSize}px Iansui`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = isFocus ? "#e062e2" : "#c4c6c6";
                ctx.fillText(label, node.x, node.y + radius + fontSize + 2);
            }
        })
        .onNodeClick((node) => focusNode(node));
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

// 關鍵字搜尋
function handleSearch() {
    const input = document.getElementById("influencer-search").value.trim();
    const node = gData.nodes.find((n) => n.name.includes(input));
    if (node) focusNode(node);
    else alert("未找到網紅");
}

function focusNode(node) {
    searchNode = node;
    highlightNodes.clear();
    highlightLinks.clear();
    highlightNodes.add(node);
    node.neighbors && node.neighbors.forEach((n) => highlightNodes.add(n));
    node.links && node.links.forEach((l) => highlightLinks.add(l));
    graphInstance.centerAt(node.x, node.y, 1000);
    graphInstance.zoom(3, 1000);
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
