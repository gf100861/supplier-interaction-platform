const mongoose = require('mongoose');
const { Schema } = mongoose;

const SupplierSchema = new Schema({
    name: { type: String, required: true },
    // 供应商代码，例如 'P-1001'
    parmaId: { type: String, required: true, unique: true, index: true }, 
    // 供应商简写，例如 'ABC'
    shortCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    cmt: String,
    
    // --- 关系定义 ---
    // 这个供应商的主要联系人（将是一个'Supplier'角色的User）
    primaryContact: { type: Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Supplier', SupplierSchema);