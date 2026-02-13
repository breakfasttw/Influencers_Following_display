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
    帶貨分潤: "#F5A623",
    寵物: "#7ED321",
    旅遊: "#D0021B",
    家庭母嬰: "#BD10E0",
    影視評論: "#9013FE",
    汽機車: "#417505",
    美食料理: "#F8E71C",
    知識教育: "#50E3C2",
    理財創業: "#B8E986",
    運動健身: "#000000",
    時事討論: "#4A4A4A",
    時尚潮流: "#FF4081",
    表演藝術: "#795548",
    遊戲電玩: "#3F51B5",
    美妝保養: "#E91E63",
    高階經理人: "#607D8B",
    綜合其他: "#9E9E9E",
    default: "#64748b", // 意外處理預設色
};
