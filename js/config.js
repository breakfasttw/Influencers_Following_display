// ==========================================
// 演算法設定表
// ==========================================
export const ALGO_CONFIG = {
    greedy: { name: "Greedy", path: "./Output/", suffix: "_gd" },
    louvain: { name: "Louvain", path: "./Output/Louvain/", suffix: "_lv" },
    walktrap: { name: "WalkTrap", path: "./Output/WalkTrap/", suffix: "_wt" },
};

// ==========================================
// 欄位顯示名稱對照表
// ==========================================
export const COLUMN_NAMES = {
    Original_Rank: "排名",
    Person_Name: "網紅",
    "In_Degree (被追蹤數)": "InD",
    "Out_Degree (主動追蹤數)": "OutD",
    "Mutual_Follow (互粉數)": "互粉數",
    Network_Influence_Score: "被追蹤率",
    Betweenness_Centrality: "中介度",
    followers: "總粉",
    distinct_following: "總追",
    category: "類別",
    group_gd: "GD",
    group_lv: "LV",
    group_wt: "WT",
};

// [新增] 類別顏色對照表
export const CATEGORY_COLORS = {
    "3C科技": "#4A90E2",
    遊戲電玩: "#2ff9db",
    汽機車: "#1c8ca5",
    影視評論: "#50e3ad",
    理財創業: "#587495",
    運動健身: "#8ab1c5",
    高階經理人: "#2e2d2d",

    知識教育: "#B8E986",
    時事討論: "#65a55d",
    旅遊: "#91e432",
    美食料理: "#F8E71C",
    寵物: "#acb924",
    趣味搞笑: "#ffffff",
    表演藝術: "#d1b3e4",

    家庭母嬰: "#f1ba4b",
    帶貨分潤: "#d5981e",
    時尚潮流: "#FF4081",
    美妝保養: "#E91E63",

    綜合其他: "#948e8e",
    default: "#64748b", // 意外處理預設色
};
