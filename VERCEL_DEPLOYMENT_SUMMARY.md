# Vercel部署总结

## 🎯 目标
将后端部署到Vercel，让通知系统能够正常工作。

## ✅ 已完成的配置

### 1. 后端配置修改
- **package.json**: 更新了脚本和配置，添加了Vercel部署所需的设置
- **vercel.json**: 配置了API路由和构建设置
- **api/index.js**: 创建了Vercel无服务器函数的入口文件
- **server.js**: 修改为支持本地开发和Vercel部署
- **alertRoutes.js**: 添加了Vercel环境兼容性处理

### 2. 前端配置修改
- **vercel.json**: 创建了前端部署配置，设置了后端API地址环境变量

### 3. 部署文件
- **DEPLOYMENT_GUIDE.md**: 详细的部署指南
- **deploy.sh**: Linux/Mac部署脚本
- **deploy.bat**: Windows部署脚本

## 🚀 部署步骤

### 第一步：部署后端
```bash
cd supplier-platform-backend
vercel login  # 如果未登录
vercel        # 部署
vercel --prod # 生产环境部署
```

### 第二步：更新前端配置
1. 记录后端部署后的URL（类似：`https://supplier-platform-backend-xxx.vercel.app`）
2. 更新 `supplier-platform-frontend/vercel.json` 中的 `REACT_APP_API_URL`
3. 重新部署前端：
   ```bash
   cd supplier-platform-frontend
   vercel --prod
   ```

## ⚠️ 重要注意事项

### Socket.IO限制
- **Vercel不支持WebSocket连接**
- 实时通知功能在Vercel环境中不可用
- 通知仍会被保存到内存中，但不会实时推送给用户
- 用户需要刷新页面或手动获取通知

### 替代方案
如果需要实时通知功能，建议：
1. 使用Pusher等第三方实时通知服务
2. 部署到支持WebSocket的平台（如Railway、Render、Heroku等）
3. 使用Server-Sent Events (SSE) 作为替代方案

## 🔧 测试部署
部署完成后，可以访问以下URL测试：
- `https://your-backend-url.vercel.app/api/health` - 健康检查
- `https://your-backend-url.vercel.app/api/alerts` - 通知API

## 📋 文件结构
```
supplier-platform-backend/
├── api/
│   └── index.js          # Vercel API入口
├── package.json          # 更新的配置
├── vercel.json          # Vercel部署配置
├── server.js            # 本地开发服务器
├── alertRoutes.js       # API路由
├── DEPLOYMENT_GUIDE.md  # 详细部署指南
├── deploy.sh           # Linux/Mac部署脚本
└── deploy.bat          # Windows部署脚本

supplier-platform-frontend/
└── vercel.json         # 前端部署配置
```

## 🎉 完成
现在你的后端已经准备好部署到Vercel了！按照上述步骤操作即可。
