# 后端部署到Vercel指南

## 部署步骤

### 1. 准备工作
确保你已经完成了以下配置：
- ✅ 修改了 `package.json` 配置
- ✅ 更新了 `vercel.json` 配置文件
- ✅ 创建了 `api/index.js` 入口文件
- ✅ 修改了 `server.js` 和 `alertRoutes.js` 以支持Vercel环境

### 2. 部署到Vercel

#### 方法一：通过Vercel CLI
```bash
# 安装Vercel CLI
npm i -g vercel

# 在supplier-platform-backend目录下登录
cd supplier-platform-backend
vercel login

# 部署
vercel

# 生产环境部署
vercel --prod
```

#### 方法二：通过GitHub集成
1. 将代码推送到GitHub仓库
2. 在Vercel控制台连接GitHub仓库
3. 选择 `supplier-platform-backend` 目录作为根目录
4. 设置环境变量（如果需要）

### 3. 获取部署后的URL
部署成功后，你会得到一个类似这样的URL：
```
https://supplier-platform-backend-xxx.vercel.app
```

### 4. 更新前端配置
部署完成后，需要更新前端的API地址：

1. **更新前端vercel.json**：
   ```json
   {
     "env": {
       "REACT_APP_API_URL": "https://your-actual-backend-url.vercel.app"
     }
   }
   ```

2. **重新部署前端**：
   ```bash
   cd supplier-platform-frontend
   vercel --prod
   ```

### 5. 测试部署
访问以下URL测试API是否正常工作：
- `https://your-backend-url.vercel.app/api/health` - 健康检查
- `https://your-backend-url.vercel.app/api/alerts` - 通知API

### 6. 注意事项

#### Socket.IO限制
- Vercel的无服务器环境不支持WebSocket连接
- 实时通知功能在Vercel环境中不可用
- 通知仍会被保存，但不会实时推送给用户
- 用户需要刷新页面或手动获取通知

#### 替代方案
如果需要实时通知功能，建议：
1. 使用Pusher等第三方服务
2. 部署到支持WebSocket的平台（如Railway、Render等）
3. 使用Server-Sent Events (SSE) 作为替代

### 7. 环境变量
如果需要设置环境变量，在Vercel控制台的Project Settings > Environment Variables中添加：
- `NODE_ENV=production`
- 其他必要的环境变量

### 8. 监控和日志
- 在Vercel控制台查看部署状态和日志
- 使用Vercel Analytics监控API使用情况

