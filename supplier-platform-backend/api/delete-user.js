const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// 初始化 CORS 中间件
const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version', 'Content-Length', 'Content-MD5', 'Date', 'X-Api-Version'],
    credentials: true,
});

// 辅助函数：运行中间件
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

module.exports = async (req, res) => {
    // 1. 运行 CORS 中间件
    try {
        await runMiddleware(req, res, corsMiddleware);
    } catch (e) {
        console.error("CORS Middleware Error:", e);
        return res.status(500).json({ error: 'Internal Server Error (CORS)' });
    }

    // 2. 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. 检查请求方法
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- 业务逻辑 ---

    // 初始化 Supabase (使用 Service Role Key)
    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: '缺少必要参数: userId' });
    }

    try {
        console.log(`正在尝试删除用户: ${userId}`);

        // 步骤 A: 尝试删除 Supabase Auth 用户 (最关键的一步)
        // 注意：deleteUser 需要 service_role 权限
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
            console.error("Supabase Auth 删除失败:", authDeleteError);
            // 如果 Auth 用户不存在，可能已经被删除了，我们继续尝试清理 public 表
            if (!authDeleteError.message.includes('User not found')) {
                throw new Error(`Auth 用户删除失败: ${authDeleteError.message}`);
            }
        }

        // 步骤 B: 确保从 public.users 表中删除 (如果未设置级联删除)
        const { error: publicDeleteError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', userId);

        if (publicDeleteError) {
            console.warn("Public profile 删除失败 (可能已级联删除):", publicDeleteError);
        }

        // 步骤 C: 清理关联关系 (可选，如果数据库没做级联删除)
        // 删除该用户作为 SD 的分配记录
        await supabaseAdmin.from('sd_supplier_assignments').delete().eq('sd_user_id', userId);
        
        // 注意：通常不建议物理删除该用户创建的通知单(notices)，因为这会破坏历史数据完整性。
        // 如果需要，可以将这些通知单的 creator_id 设为 null 或转移给其他 admin。

        return res.status(200).json({ success: true, message: '用户已成功删除' });

    } catch (error) {
        console.error('Delete user failed:', error);
        return res.status(500).json({ error: error.message });
    }
};