const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
    try {
        // --- GET: 获取公告列表 ---
        if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin
                .from('system_notices')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.json(data);
        }

        // --- POST: 发布新公告 ---
        if (req.method === 'POST') {
            const { type, content, is_active } = req.body;
            
            const { data, error } = await supabaseAdmin
                .from('system_notices')
                .insert([{ type, content, is_active: is_active ?? true }])
                .select();

            if (error) throw error;
            return res.status(201).json(data);
        }

        // --- DELETE: 删除公告 ---
        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Missing id' });

            const { error } = await supabaseAdmin
                .from('system_notices')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[System Notices API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};