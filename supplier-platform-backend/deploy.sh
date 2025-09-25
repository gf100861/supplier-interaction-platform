#!/bin/bash

# 后端部署到Vercel脚本

echo "🚀 开始部署后端到Vercel..."

# 检查是否安装了Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装，正在安装..."
    npm install -g vercel
fi

# 检查是否已登录
if ! vercel whoami &> /dev/null; then
    echo "🔐 请先登录Vercel..."
    vercel login
fi

echo "📦 开始部署..."
vercel

echo "✅ 部署完成！"
echo "📝 请记录部署后的URL，并更新前端的vercel.json配置"
echo "🔧 然后重新部署前端以使用新的API地址"
