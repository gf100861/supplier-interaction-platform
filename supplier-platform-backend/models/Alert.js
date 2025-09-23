const mongoose = require('mongoose');
const { Schema } = mongoose;

const AlertSchema = new Schema({
    id: { type: String, required: true, unique: true },
    senderId: { type: String, required: true },
    recipientId: { type: String, required: true },
    message: { type: String, required: true },
    link: String,
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false },
});

module.exports = mongoose.model('Alert', AlertSchema);