@echo off
echo 🚀 开始部署后端到Vercel...

REM 检查是否安装了Vercel CLI
vercel --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Vercel CLI 未安装，正在安装...
    npm install -g vercel
)

REM 检查是否已登录
vercel whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔐 请先登录Vercel...
    vercel login
)

echo 📦 开始部署...
vercel

echo ✅ 部署完成！
echo 📝 请记录部署后的URL，并更新前端的vercel.json配置
echo 🔧 然后重新部署前端以使用新的API地址
pause

