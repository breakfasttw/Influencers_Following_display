let graphInstance = null;
let gData = { nodes: [], links: [] };
let matrixData = null;
let isDetailedMode = false;

const highlightNodes = new Set();
const highlightLinks = new Set();
let searchNode = null;

// 初始化
Promise.all([
    fetch("./Output/nodes_edges.json").then((res) => res.json()),
    fetch("./Output/matrix.json").then((res) => res.json()),
]).then(([nodesEdges, matrix]) => {
    gData = nodesEdges;
    matrixData = matrix;

    // 建立鄰居索引
    gData.links.forEach((link) => {
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
});

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
            <div style="color: #94a3b8; font-size: 12px;">
                派系：${node.group}<br/>
                <hr style="border-color: #334155; margin: 4px 0;"/>
                被追蹤數：<span style="color: #f8fafc">${node.metrics.in_degree}</span><br/>
                追蹤他人：<span style="color: #f8fafc">${node.metrics.out_degree}</span><br/>
                雙向互粉：<span style="color: #f8fafc">${node.metrics.mutual}</span>
            </div>
        `,
        )

        .linkCurvature((l) => (l.type === "mutual" ? 0.3 : 0))
        .linkDirectionalArrowLength(3)
        .nodeColor((node) =>
            highlightNodes.has(node) || node === searchNode
                ? "#fbbf24"
                : node.color,
        )
        .linkColor((link) =>
            highlightLinks.has(link) ? "#60a5fa" : "rgba(148, 163, 184, 0.1)",
        )
        .linkWidth((link) => (highlightLinks.has(link) ? 2 : 0.5))
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
            const isFocus = node === searchNode || highlightNodes.has(node);
            const label = node.name;
            const radius = Math.sqrt(node.val) * 2;

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
                ctx.fillStyle = isFocus ? "#ffffff" : "#f8fafc";
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
