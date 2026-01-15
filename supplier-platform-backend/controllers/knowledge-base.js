const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const corsMiddleware = cors({
    origin: true,
    methods: ['GET', 'OPTIONS'],
    credentials: true,
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

module.exports = async (req, res) => {
    const requestOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        await runMiddleware(req, res, corsMiddleware);

        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // --- GET: 获取特定供应商的历史标签 ---
        if (req.method === 'GET') {
            const { supplierParmaId } = req.query;

            if (!supplierParmaId) {
                return res.status(400).json({ error: 'Missing supplierParmaId' });
            }

            const { data, error } = await supabaseAdmin
                .from('knowledge_base')
                .select('problem_source, cause')
                .eq('supplier_parma_id', supplierParmaId);

            if (error) throw error;
            return res.json(data);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[KnowledgeBase API] Error:', error);
        res.status(500).json({ error: error.message });
    }
};