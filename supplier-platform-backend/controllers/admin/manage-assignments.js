const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
    try {
        const { userId, supplierIds } = req.body;

        if (!userId || !Array.isArray(supplierIds)) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }

        // 1. 先删除该用户现有的所有分配
        const { error: deleteError } = await supabaseAdmin
            .from('sd_supplier_assignments')
            .delete()
            .eq('sd_user_id', userId);

        if (deleteError) throw deleteError;

        // 2. 如果有选中的供应商，则批量插入新分配
        if (supplierIds.length > 0) {
            const newAssignments = supplierIds.map(supplierId => ({
                sd_user_id: userId,
                supplier_id: supplierId,
            }));

            const { error: insertError } = await supabaseAdmin
                .from('sd_supplier_assignments')
                .insert(newAssignments);

            if (insertError) throw insertError;
        }

        res.json({ success: true, message: 'Assignments updated successfully' });

    } catch (error) {
        console.error('[Manage Assignments] Error:', error);
        res.status(500).json({ error: error.message });
    }
};