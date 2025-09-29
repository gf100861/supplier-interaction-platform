# 通过GitHub集成部署到Vercel指南

## 🎯 当前状态
✅ 代码已推送到GitHub: `https://github.com/gf100861/supplier-interaction-platform.git`
✅ 后端Vercel配置文件已准备就绪
✅ 前端Vercel配置文件已准备就绪

## 🚀 部署步骤

### 第一步：部署后端

1. **访问Vercel控制台**
   - 打开浏览器，访问 [https://vercel.com](https://vercel.com)
   - 使用GitHub账号登录

2. **导入项目**
   - 点击 "New Project"
   - 选择 "Import Git Repository"
   - 找到你的仓库：`gf100861/supplier-interaction-platform`

3. **配置后端部署**
   - **Project Name**: `supplier-platform-backend`
   - **Root Directory**: `supplier-platform-backend`
   - **Framework Preset**: `Other`
   - **Build Command**: `npm run build` (或留空)
   - **Output Directory**: 留空
   - **Install Command**: `npm install`

4. **环境变量设置**
   - 在 "Environment Variables" 部分添加：
     - `NODE_ENV` = `production`

5. **部署**
   - 点击 "Deploy"
   - 等待部署完成
   - 记录部署后的URL（类似：`https://supplier-platform-backend-xxx.vercel.app`）

### 第二步：部署前端

1. **创建新项目**
   - 在Vercel控制台点击 "New Project"
   - 再次选择同一个GitHub仓库

2. **配置前端部署**
   - **Project Name**: `supplier-platform-frontend`
   - **Root Directory**: `supplier-platform-frontend`
   - **Framework Preset**: `Create React App`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

3. **环境变量设置**
   - 在 "Environment Variables" 部分添加：
     - `REACT_APP_API_URL` = `https://your-backend-url.vercel.app`（替换为第一步得到的后端URL）

4. **部署**
   - 点击 "Deploy"
   - 等待部署完成

## 🔧 测试部署

### 测试后端API
访问以下URL测试后端是否正常工作：
- `https://your-backend-url.vercel.app/api/health` - 健康检查
- `https://your-backend-url.vercel.app/api/alerts` - 通知API

### 测试前端
访问前端URL，检查：
- 页面是否正常加载
- 通知功能是否工作（虽然实时推送不可用）
- API调用是否正常

## ⚠️ 重要注意事项

### Socket.IO限制
- **Vercel不支持WebSocket连接**
- 实时通知功能在Vercel环境中不可用
- 通知仍会被保存，但不会实时推送给用户
- 用户需要刷新页面或手动获取通知

### 替代方案
如果需要实时通知功能，建议：
1. **使用Pusher**：集成Pusher服务实现实时通知
2. **使用Server-Sent Events (SSE)**：作为WebSocket的替代方案
3. **部署到其他平台**：如Railway、Render、Heroku等支持WebSocket的平台

## 📋 部署后的URL结构

```
后端API: https://supplier-platform-backend-xxx.vercel.app
├── /api/health          - 健康检查
├── /api/alerts          - 通知API
└── /api/alerts/:userId  - 获取用户通知

前端应用: https://supplier-platform-frontend-xxx.vercel.app
└── 所有前端页面和功能
```

## 🔄 更新部署

当你需要更新代码时：
1. 修改代码
2. 提交并推送到GitHub：
   ```bash
   git add .
   git commit -m "更新描述"
   git push origin master
   ```
3. Vercel会自动检测到更改并重新部署

## 🆘 故障排除

### 常见问题
1. **部署失败**：检查package.json中的依赖和脚本
2. **API不工作**：检查vercel.json配置和API路由
3. **前端无法连接后端**：检查环境变量REACT_APP_API_URL

### 查看日志
- 在Vercel控制台的 "Functions" 标签页查看API日志
- 在 "Deployments" 标签页查看部署日志

## 🎉 完成！

部署完成后，你的应用就可以通过互联网访问了！
- 前端：`https://supplier-platform-frontend-xxx.vercel.app`
- 后端：`https://supplier-platform-backend-xxx.vercel.app`

