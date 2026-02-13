## 專案結構

/
├── index.html
├── style.css
├── js/
│ ├── config.js # [共用] 存放所有常數、欄位名稱對照、演算法設定
│ ├── utils.js # [共用] 存放格式化工具、共用的資料請求邏輯
│ ├── network.js # [社交網路] 負責 Force-Graph 渲染與搜尋功能
│ ├── report.js # [報表] 負責 D3 表格渲染與排序邏輯 (原本的 heatmap)
│ └── main.js # [入口] 負責頁籤切換控制與初始化全站資料
└── Output/ # 資料夾
└── ...
