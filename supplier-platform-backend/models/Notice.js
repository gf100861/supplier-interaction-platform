const mongoose = require('mongoose');
const { Schema } = mongoose;

const NoticeSchema = new Schema({
    id: { type: String, required: true, unique: true },
    batchId: String,
    category: String,
    title: String,
    assignedSupplierId: String,
    assignedSupplierName: String,
    status: String,
    isRepeat: Boolean,
    repeatCount: Number,
    relatedCaseId: String,
    isReviewed: Boolean,
    sdNotice: {
        creatorId: String,
        description: String,
        creator: String,
        createTime: String,
        images: Array,
        attachments: Array,
        details: Object, // 存储动态字段
    },
    history: Array,
});

module.exports = mongoose.model('Notice', NoticeSchema);