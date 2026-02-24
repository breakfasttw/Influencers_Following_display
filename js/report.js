import {
    COLUMN_NAMES,
    CATEGORY_COLORS,
    COLUMN_EXPLANATIONS,
} from "./config.js";

// 將資料狀態管理在 report.js 內部，解決作用域問題
export let metricsData = []; // [修改] 加上 export，讓 network.js 可以讀取此數據進行圖表統計
let currentSort = { key: "Original_Rank", asc: true };

// ==========================================
// 解析 CSV 資料的共用函式
// ==========================================

export function parseCommunityCSV(text) {
    if (!text) return [];
    const lines = text.split("\n").filter((line) => line.trim() !== "");
    // 跳過標題列 (slice(1))
    return lines.slice(1).map((line) => {
        const parts = line.split(",");
        return {
            name: parts[0],
            count: parts[1],
            leader: parts[2],
            members: parts[3] ? parts[3].split("|").map((m) => m.trim()) : [],
        };
    });
}

/**
 * 核心修正：CSV 欄位分割器
 * 解決原本 Regex 會跳過空欄位 (,,) 導致欄位位移的問題
 */
function splitCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

/**
 * [修改] 解析指標報表，支援引號欄位處理
 */
export function parseMetricsCSV(text, allAlgosNodes) {
    if (!text) return [];

    const lines = text.split("\n").filter((l) => l.trim() !== "");
    // 取得標題列並修剪空白
    const headers = splitCSVLine(lines[0]).map((h) => h.trim());

    metricsData = lines.slice(1).map((line) => {
        const values = splitCSVLine(line);
        let obj = {};

        headers.forEach((header, i) => {
            if (!header) return; // 跳過 CSV 中標題為空的欄位 (例如 ig_url 後面那個)

            let val = (values[i] || "").trim();
            // 去除頭尾引號 (如 "運動健身,旅遊" -> 運動健身,旅遊)
            val = val.replace(/^"|"$/g, "");

            // 判斷是否為數字（先移除數字間可能的空格）
            const cleanNum = val.replace(/\s/g, "");
            obj[header] =
                isNaN(cleanNum) || cleanNum === "" ? val : parseFloat(cleanNum);
        });

        // 交叉對照分群結果 (保留你原本的邏輯)
        const name = obj["Person_Name"];
        const findGroup = (nodeList) => {
            if (!nodeList || nodeList.length === 0) return "-";
            const node = nodeList.find((n) => n.name === name);
            return node ? node.group : "-";
        };

        obj["group_gd"] = findGroup(allAlgosNodes.gd);
        obj["group_lv"] = findGroup(allAlgosNodes.lv);
        obj["group_wt"] = findGroup(allAlgosNodes.wt);

        return obj;
    });

    return metricsData;
}

/**
 * 處理排序點擊
 */
// [核心修正] 讓 HTML onclick 能找到這個函式
window.handleTableSort = function (key) {
    if (currentSort.key === key) {
        currentSort.asc = !currentSort.asc;
    } else {
        currentSort.key = key;
        currentSort.asc = true;
    }
    renderMetricsTable();
};

export function renderMetricsTable() {
    const container = document.getElementById("data-report");
    if (!metricsData || !metricsData.length) return;

    const sortedData = [...metricsData].sort((a, b) => {
        let v1 = a[currentSort.key],
            v2 = b[currentSort.key];
        if (typeof v1 === "string")
            return currentSort.asc
                ? v1.localeCompare(v2)
                : v2.localeCompare(v1);
        return currentSort.asc ? (v1 || 0) - (v2 || 0) : (v2 || 0) - (v1 || 0);
    });

    const headers = Object.keys(COLUMN_NAMES);

    // 2. 構建 HTML
    // 注意：外層包了一個 h-[calc(100vh-180px)] 的 div，這是 sticky 生效的關鍵
    let html = `
        <div class="w-full h-[calc(100vh-180px)] overflow-y-auto border border-slate-700/50 rounded-lg shadow-inner">
            <table class="metrics-table w-full text-left text-xs text-slate-300 border-collapse">
                <thead class="sticky top-0 z-10">
                    <tr class="bg-slate-800 shadow-sm">
                        ${headers
                            .map((h) => {
                                // [新增] 取得對應的說明文字，若無則留空
                                const explanation =
                                    COLUMN_EXPLANATIONS[h] || "";

                                return `
                                    <th 
                                        class="p-3 cursor-pointer hover:bg-slate-700 transition-colors border-b border-slate-600 bg-slate-800" 
                                        onclick="handleTableSort('${h}')"
                                        title="${explanation}" 
                                    >
                                        <div class="flex items-center ${typeof metricsData[0][h] === "number" ? "justify-end" : "justify-start"}">
                                            <span class="whitespace-nowrap border-b border-dotted border-slate-500">${COLUMN_NAMES[h]}</span>
                                            <span class="sort-icon ml-1 ${currentSort.key === h ? "sort-active" : "opacity-20"}">
                                                ${currentSort.key === h ? (currentSort.asc ? "▲" : "▼") : "↕"}
                                            </span>
                                        </div>
                                    </th>`;
                            })
                            .join("")}
                    </tr>
                </thead>
                <tbody class="bg-slate-900/40">
                    ${sortedData
                        .map(
                            (row) => `
                        <tr class="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                            ${headers
                                .map((h) => {
                                    let displayVal = row[h];
                                    let alignClass = "text-left",
                                        customStyle = "";

                                    if (h === "category" || h === "Category") {
                                        const cats = String(displayVal || "")
                                            .split(",")
                                            .filter((c) => c.trim() !== "");
                                        displayVal = `<div class="flex flex-col gap-1 items-start py-1">
                                        ${cats
                                            .map((cat) => {
                                                const color =
                                                    CATEGORY_COLORS[
                                                        cat.trim()
                                                    ] ||
                                                    CATEGORY_COLORS["default"];
                                                return `<span class="px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap" 
                                                          style="background-color: ${color}20; border-color: ${color}; color: ${color};">
                                                        ${cat.trim()}
                                                    </span>`;
                                            })
                                            .join("")}
                                    </div>`;
                                    } else if (
                                        typeof displayVal === "number" &&
                                        !isNaN(displayVal)
                                    ) {
                                        alignClass = "text-right";
                                        displayVal = displayVal.toLocaleString(
                                            "en-US",
                                            displayVal % 1 !== 0
                                                ? {
                                                      minimumFractionDigits: 2,
                                                      maximumFractionDigits: 2,
                                                  }
                                                : {},
                                        );
                                    } else {
                                        if (h.includes("group"))
                                            customStyle =
                                                "text-green-400 italic";
                                        if (h === "Person_Name") {
                                            customStyle =
                                                "text-blue-400 font-medium";
                                            const url = row["ig_url"] || "#";
                                            displayVal = `<a href="${url}" target="_blank" class="hover:underline hover:text-blue-300 inline-flex items-center gap-1">${displayVal}</a>`;
                                        }
                                        if (!displayVal) displayVal = "-";
                                    }
                                    return `<td class="p-3 ${alignClass} ${customStyle}">${displayVal}</td>`;
                                })
                                .join("")}
                        </tr>`,
                        )
                        .join("")}
                </tbody>
            </table>
        </div>`;
    container.innerHTML = html;
}

// 超連結符號
/*/
<svg
    class="w-3 h-3 opacity-50"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
>
    <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
</svg>;
*/
