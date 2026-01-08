const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
    try {
        // --- GET: 获取反馈列表 ---
        if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin
                .from('feedback')
                .select('*, user:users ( username )')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.json(data);
        }

        // --- PATCH: 更新状态或回复 ---
        if (req.method === 'PATCH') {
            const { id, status, admin_response } = req.body;
            
            // 构建更新对象（只更新传过来的字段）
            const updates = {};
            if (status) updates.status = status;
            if (admin_response !== undefined) updates.admin_response = admin_response;

            const { data, error } = await supabaseAdmin
                .from('feedback')
                .update(updates)
                .eq('id', id)
                .select();

            if (error) throw error;
            return res.json(data);
        }

        // --- DELETE: 删除反馈 ---
        if (req.method === 'DELETE') {
            const { id } = req.query; // 从 URL 参数获取 ID
            if (!id) return res.status(400).json({ error: 'Missing id' });

            const { error } = await supabaseAdmin
                .from('feedback')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Feedback API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};