Notice 移动端热修包（2026-07-06）
================================

修复内容：
1. 修复部分小米/Android 浏览器把照片压缩成 1x1 空白 JPEG 的问题。
2. Notice 列表灰色摘要显示 description，不再用 title 冒充 description。
3. 手工创建 Notice 页面增加始终可见的“录像 / 选择视频”按钮。

重要说明：
Sherry 已创建的以下三张照片在云端已经是不可恢复的 1x1 JPEG，部署热修后仍需从原手机重新上传：
- N-20260706-AYO06X
- N-20260706-C3D7VZ
- N-20260706-E3HVCE

部署（默认项目路径 /opt/sd-project）：
1. 上传 sd-notice-mobile-hotfix-20260706.tar.gz 到腾讯云服务器，例如 /tmp。
2. 执行：
   sudo tar -xzf /tmp/sd-notice-mobile-hotfix-20260706.tar.gz -C /opt/sd-project
   cd /opt/sd-project
   sudo bash apply-notice-hotfix.sh

脚本会自动识别 /var/www/supplier-frontend 或 /var/www/sd-portal，复制前端文件并重启 PM2 的 sd-backend。
若 Nginx 使用其他目录：
   sudo FRONTEND_ROOT=/实际前端目录 bash apply-notice-hotfix.sh

部署后建议：
- 手机浏览器彻底刷新一次页面（或清理该站点缓存）。
- 用小米手机重新上传一张照片，确认图片不再为空白。
- 打开 Notice 列表，确认灰色摘要是 description。
- 打开“手工输入新的审核结果”，确认“录像 / 选择视频”按钮可见。
