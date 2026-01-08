const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
    try {
        const { userId, username, phone, password } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        // 1. 更新业务表 (public.users) 中的基本信息
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .update({ username, phone })
            .eq('id', userId);

        if (profileError) throw profileError;

        // 2. 如果提供了新密码，调用 Supabase Auth API 修改密码
        if (password && password.trim() !== '') {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                { password: password }
            );
            if (authError) throw authError;
        }

        res.json({ success: true, message: 'User updated successfully' });

    } catch (error) {
        console.error('[Admin Update User] Error:', error);
        res.status(500).json({ error: error.message });
    }
};