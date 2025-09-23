const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
    // 我们将使用 username 作为登录的关键字段，并确保它是唯一的
    username: { type: String, required: true, unique: true, index: true }, 
    password: { type: String, required: true }, // 在真实项目中，密码应该被加密
    name: { type: String, required: true },
    role: { type: String, required: true, enum: ['Manager', 'SD', 'Supplier'] },
    email: { type: String, required: true },
    phone: String, // 电话为可选
    
    // --- 关系定义 ---
    // 如果是供应商角色的用户，他们会关联到一个 Supplier 文档
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },

    // 如果是SD或Manager，他们可以管理多个供应商
    managedSuppliers: [{ type: Schema.Types.ObjectId, ref: 'Supplier' }]
});

module.exports = mongoose.model('User', UserSchema);