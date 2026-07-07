require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Supplier = require('./models/Supplier');
const Notice = require('./models/Notice');
const Alert = require('./models/Alert');
const { mockUsers, suppliersList, mockNoticesData } = require('./_mockData');

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log("✅ 成功连接到数据库，准备开始填充数据...");

        // 1. 清空所有旧数据
        await User.deleteMany({});
        await Supplier.deleteMany({});
        await Notice.deleteMany({});
        await Alert.deleteMany({});
        console.log("🧹 已清空所有旧数据。");

        // 2. 创建供应商
        const supplierDocs = {};
        for (const sup of suppliersList) {
            const newSupplier = new Supplier({
                name: sup.name,
                parmaId: sup.parmaId,
                // --- 核心修正：使用一个保证唯一的方法来生成 shortCode ---
                shortCode: `S${sup.parmaId.slice(-4)}`, // 例如: "P-1001" -> "S1001"
                cmt: sup.cmt,
            });
            const savedSupplier = await newSupplier.save();
            supplierDocs[sup.id] = savedSupplier;
        }
        console.log(`✅ 成功创建 ${Object.keys(supplierDocs).length} 个供应商。`);

        // 3. 创建用户并建立关系 (逻辑不变)
        for (const [username, userData] of Object.entries(mockUsers)) {
            // ... (这部分逻辑保持不变)
        }
        console.log(`✅ 成功创建 ${Object.keys(mockUsers).length} 个用户并建立关联。`);
        
        // 4. 批量创建通知单 (逻辑不变)
        if (mockNoticesData && mockNoticesData.length > 0) {
            await Notice.insertMany(mockNoticesData);
            console.log(`✅ 成功创建 ${mockNoticesData.length} 条通知单。`);
        }
        
        console.log("🎉 数据填充成功！");

    } catch (error) {
        console.error("❌ 数据填充失败:", error);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 已断开数据库连接。");
    }
};

seedDatabase();