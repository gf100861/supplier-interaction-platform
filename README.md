# 供应商与SD信息交换平台 (Supplier & SD Interaction Platform)

这是一个用于管理供应商整改流程、年度审计计划和实时沟通的全栈Web应用平台。

## ✨ 主要功能 (Features)

- **实时通知系统**: 基于 WebSocket 的系统内提醒，确保信息即时同步。
- **动态表单**: 根据不同的“问题类型”，动态生成不同的表单和表格列。
- **角色权限管理**: 针对“经理 (Manager)”、“SD”和“供应商 (Supplier)”三种角色，提供不同的操作和数据可见性。
- **数据可视化**: 通过仪表盘和分析页面，提供KPI监控、趋势分析和业绩排行。
- **报告与导出**: 强大的综合报告中心，支持多维度筛选和动态表头Excel导出。
- **前后端分离**: 基于 React (前端) 和 Node.js/Express (后端) 的现代化架构。

## 🛠️ 技术栈 (Tech Stack)

- **前端**: React, Ant Design, React Router, Socket.io-client
- **后端**: Node.js, Express, Socket.io
- **数据模拟**: In-memory JavaScript objects
- **Excel处理**: ExcelJS

## 🚀 如何运行 (Getting Started)

1.  **启动后端服务器**:
    ```bash
    cd supplier-platform-backend
    npm install
    npm start
    ```
    服务器将在 `http://localhost:3001` 运行。

2.  **启动前端应用**:
    ```bash
    cd supplier-platform-frontend
    npm install
    npm start
    ```
    应用将在 `http://localhost:3000` 运行。