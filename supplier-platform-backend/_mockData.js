// --- 用户数据 ---
const mockUsers = {
    'philip': { id: 'sd_01', password: '123', role: 'Manager', name: 'Philip Wang (Manager)', email: 'philip.wang@example.com' },
    'xiaobing': { id: 'sd_02', password: '123', role: 'SD', name: 'Xiaobing Wu (SD)', email: 'xiaobing.wu@example.com' },
    'anna': { id: 'sd_03', password: '123', role: 'SD', name: 'Anna Li (SD)', email: 'anna.li@example.com' },
    'zhangsan': { id: 'sup_A', password: '123', role: 'Supplier', name: '张三 (供应商A)', email: 'zhangsan@supplier-a.com' },
    'lisi': { id: 'sup_B', password: '123', role: 'Supplier', name: '李四 (供应商B)', email: 'lisi@supplier-b.com' },
    'wangwu': { id: 'sup_C', password: '123', role: 'Supplier', name: '王五 (供应商C)', email: 'wangwu@supplier-c.com' },
};


const suppliersList = [
    { id: 'sup_A', name: '供应商A', parmaId: 'P-1001', cmt: 'CMT-Alpha', defaultSdName: 'Philip Wang (Manager)' },
    { id: 'sup_B', name: '供应商B', parmaId: 'P-1002', cmt: 'CMT-Beta', defaultSdName: 'Xiaobing Wu (SD)' },
    { id: 'sup_C', name: '供应商C', parmaId: 'P-1003', cmt: 'CMT-Alpha', defaultSdName: 'Philip Wang (Manager)' },
    { id: 'sup_D', name: '供应商D', parmaId: 'P-1004', cmt: 'CMT-Gamma', defaultSdName: 'Xiaobing Wu (SD)' },
];
// --- 整改通知单数据 ---
const mockNoticesData = [
    // --- 原有数据（补全字段）---
    {
        id: 'N-20250815-001',
        batchId: 'BATCH-TEST-001',
        category: '现场管理',
        title: '现场物料堆放不规范问题',
        assignedSupplierId: 'sup_A',
        assignedSupplierName: '供应商A',
        status: '待供应商提交行动计划',
        isReviewed: false, // <-- 新增字段，默认为 false
        sdNotice: {
            creatorId: 'sd_01',
            description: '现场抽检发现，A类物料未按规定分区堆放，存在混料风险。请提供整改行动计划。',
            creator: 'Philip Wang (Manager)',
            createTime: '2025-08-15 10:00:00',
            // --- 核心修改：直接在这里存放初始证据 ---
            images: [
                { uid: 'init-img-1', name: 'initial-evidence.png', url: 'https://gw.alipayobjects.com/zos/antfincdn/x43I27A55%26/photo-1438109491414-7198515b166b.webp' }
            ],
            attachments: []
        },
        history: []
    },
    {
        id: 'N-20250815-002',
        batchId: 'BATCH-TEST-001',
        category: '产品质量',
        title: '产品包装有破损',
        assignedSupplierId: 'sup_B',
        assignedSupplierName: '供应商B',
        status: '待SD审核行动计划',
        isReviewed: false, // <-- 新增字段，默认为 false
        sdNotice: {
            creatorId: 'sd_01',
            description: '入库检验时发现批次号 [P20250814] 的产品外包装有明显破损，请先提交处理计划。',
            creator: 'Philip Wang (Manager)',
            createTime: '2025-08-14 14:00:00',
            images: [
                { uid: 'init-img-1', name: 'initial-evidence.png', url: 'https://gw.alipayobjects.com/zos/antfincdn/x43I27A55%26/photo-1438109491414-7198515b166b.webp' }
            ],
            attachments: []
        },
        history: [{
            type: 'supplier_plan_submission',
            submitter: '李四 (供应商B)',
            time: '2025-08-15 09:00:00',
            description: '行动计划如下：\n1. 立即隔离所有包装破损产品。\n2. 追溯运输过程。',
            responsible: '李四-质量主管',
            deadline: '2025-08-20',
            actionPlans: [
                { plan: '隔离所有包装破损产品，并进行内部评审', responsible: '李四-质量主管', deadline: '2025-08-20' },
                { plan: '追溯运输过程，找出根本原因', responsible: '王五-物流', deadline: '2025-08-22' },
            ]
        }]
    },
    {
        id: 'N-20250815-003',
        batchId: 'BATCH-TEST-001',
        category: '文档资质',
        title: '资质文件过期提醒',
        assignedSupplierId: 'sup_A',
        assignedSupplierName: '供应商A',
        status: '待供应商上传证据',
        isReviewed: false, // <-- 新增字段，默认为 false
        sdNotice: {
            creatorId: 'sd_01',
            description: '系统检测到贵司的ISO9001认证即将在30天后过期，请尽快更新并上传新证书。',
            creator: 'Philip Wang (Manager)',
            createTime: '2025-08-12 16:00:00',
            images: [
                { uid: 'init-img-1', name: 'initial-evidence.png', url: 'https://gw.alipayobjects.com/zos/antfincdn/x43I27A55%26/photo-1438109491414-7198515b166b.webp' }
            ],
            attachments: []
        },
        history: [
            { type: 'supplier_plan_submission', submitter: '张三 (供应商A)', time: '2025-08-13 11:00:00', description: '计划在本周内完成年度审核并获取新证书。', responsible: '张三-行政部', deadline: '2025-08-22' },
            { type: 'sd_plan_approval', submitter: 'Philip Wang (Manager)', time: '2025-08-13 14:00:00', description: '计划已批准，请在获取新证书后立即上传。', }
        ]
    },
    {
        id: 'N-20250815-004',
        category: '安全规范',
        title: '安全出口通道堵塞',
        assignedSupplierId: 'sup_A',
        assignedSupplierName: '供应商A',
        status: '已完成',
        isReviewed: false, // <-- 新增字段，默认为 false
        sdNotice: {
            creatorId: 'sd_01',
            description: '巡检发现仓库#3的安全出口通道被杂物堵塞，严重违反安全规定，请立即整改。',
            creator: 'Philip Wang (Manager)',
            createTime: '2025-08-10 09:00:00',
            images: [], // 即使没有，也最好有一个空数组
            attachments: []
        },
        history: [
            { type: 'supplier_plan_submission', submitter: '张三 (供应商A)', time: '2025-08-10 10:00:00', description: '立即安排人员清理，预计1小时内完成。', responsible: '张三-仓管', deadline: '2025-08-10' },
            { type: 'sd_plan_approval', submitter: 'Philip Wang (Manager)', time: '2025-08-10 10:30:00', description: '同意计划，请完成后拍照上传作为证据。' },
            { type: 'supplier_evidence_submission', submitter: '张三 (供应商A)', time: '2025-08-10 11:15:00', description: '通道已清理完毕。', images: [{ uid: '-1', name: 'cleanup.png', url: 'https://gw.alipayobjects.com/zos/antfincdn/LlvErxo8H9/photo-1503185912284-5271ff81b9a8.jpeg' }] },
            { type: 'sd_evidence_approval', submitter: 'Philip Wang (Manager)', time: '2025-08-10 12:00:00', description: '证据审核通过，问题关闭。' },

        ]
    },
    // --- 为 Xiaobing Wu 添加更多数据 ---
    {
        id: 'N-20250720-001',
        category: '产品质量',
        title: '产品尺寸超差',
        assignedSupplierId: 'sup_B',
        assignedSupplierName: '供应商B',
        status: '已完成',
        isReviewed: false, // <-- 新增字段，默认为 false
        sdNotice: {
            creatorId: 'sd_02',
            description: '批号为P20250719的货物，抽检发现尺寸超上限公差0.2mm。',
            creator: 'Xiaobing Wu (SD)',
            createTime: '2025-07-20 11:00:00',
            images: [], // <-- 补上
            attachments: [] // <-- 补上
        },
        history: [
            { type: 'supplier_plan_submission', submitter: '李四 (供应商B)', time: '2025-07-20 14:00:00', description: '全检并隔离此批次产品。', responsible: '李四-生产', deadline: '2025-07-22' },
            { type: 'sd_plan_approval', submitter: 'Xiaobing Wu (SD)', time: '2025-07-20 16:00:00', description: '同意' },
            { type: 'supplier_evidence_submission', submitter: '李四 (供应商B)', time: '2025-07-21 10:00:00', description: '隔离完成。', images: [] },
            { type: 'sd_evidence_approval', submitter: 'Xiaobing Wu (SD)', time: '2025-07-21 11:00:00', description: 'OK' }
        ]
    },
    {
        id: 'N-20250715-001',
        category: '安全规范',
        title: '化学品标签不清晰',
        assignedSupplierId: 'sup_C',
        assignedSupplierName: '供应商C',
        status: '已完成',
        isReviewed: false, // <-- 新增字段，默认为 false
        sdNotice: {
            creatorId: 'sd_03',
            description: '化学品仓库部分原料桶标签模糊不清，存在误用风险。',
            creator: 'Anna Li (SD)',
            createTime: '2025-07-15 09:30:00',
            images: [], // <-- 补上
            attachments: [] // <-- 补上
        },
        history: [
            { type: 'supplier_plan_submission', submitter: '王五 (供应商C)', time: '2025-07-15 11:00:00', description: '立即更换所有不清晰的标签。', responsible: '王五-仓管', deadline: '2025-07-16' },
            { type: 'sd_plan_approval', submitter: 'Anna Li (SD)', time: '2025-07-15 13:00:00', description: '同意' },
            { type: 'supplier_evidence_submission', submitter: '王五 (供应商C)', time: '2025-07-16 09:00:00', description: '已全部更换，见图。', images: [{ uid: 'random-uid-1', name: 'new-labels.png', url: 'https://gw.alipayobjects.com/zos/rmsportal/mqaQswcyDLcXyDKnZfES.png' }] },
            {
                type: 'sd_evidence_approval', submitter: 'Anna Li (SD)', time: '2025-07-16 10:00:00', description: 'OK', actionPlans: [
                    { plan: '隔离所有包装破损产品，并进行内部评审', responsible: '李四-质量主管', deadline: '2025-08-20' },
                    { plan: '追溯运输过程，找出根本原因', responsible: '王五-物流', deadline: '2025-08-22' },
                ]
            }
        ]
    },
    {
        id: 'N-20250818-001',
        category: '产品质量',
        title: '来料有划痕',
        assignedSupplierId: 'sup_C',
        assignedSupplierName: '供应商C',
        status: '待SD审核证据',
        isReviewed: false, // <-- 新增字段，默认为 false
        sdNotice: {
            creatorId: 'sd_03',
            description: '8月18日批次的XX物料表面有明显划痕。',
            creator: 'Anna Li (SD)',
            createTime: '2025-08-18 14:00:00',
            images: [], // <-- 补上
            attachments: [] // <-- 补上
        },
        history: [
            { type: 'supplier_plan_submission', submitter: '王五 (供应商C)', time: '2025-08-19 10:00:00', description: '将加强运输保护。', responsible: '王五-物流', deadline: '2025-08-25' },
            { type: 'sd_plan_approval', submitter: 'Anna Li (SD)', time: '2025-08-19 11:00:00', description: '同意，请提供改进后的包装照片作为证据。' },
            { type: 'supplier_evidence_submission', submitter: '王五 (供应商C)', time: '2025-08-20 15:00:00', description: '改进后的包装照片已上传。', images: [{ uid: 'random-uid-2', name: 'new-packaging.png', url: 'https://gw.alipayobjects.com/zos/antfincdn/LlvErxo8H9/photo-1503185912284-5271ff81b9a8.jpeg' }] }
        ]
    },
    {
        id: 'N-20250820-001',
        batchId: 'BATCH-ANNA-001',
        category: '现场管理',
        title: '废料未及时清理',
        assignedSupplierId: 'sup_C',
        assignedSupplierName: '供应商C',
        status: '待供应商提交行动计划',
        isReviewed: false, // <-- 新增字段，默认为 false
        sdNotice: {
            creatorId: 'sd_03',
            description: '二号车间角落的废料桶已满，未按规定及时清理。',
            creator: 'Anna Li (SD)',
            createTime: '2025-08-20 16:00:00',
            images: [], // <-- 补上
            attachments: [] // <-- 补上
        },
        history: []
    },
    {
        id: 'N-20250820-002',
        batchId: 'BATCH-ANNA-001',
        category: '文档资质',
        title: '操作员培训记录缺失',
        assignedSupplierId: 'sup_C',
        assignedSupplierName: '供应商C',
        status: '待供应商提交行动计划',
        isReviewed: false, // <-- 新增字段，默认为 false
        sdNotice: {
            creatorId: 'sd_03',
            description: '新上岗的几位操作员，其培训记录未在系统中归档。',
            creator: 'Anna Li (SD)',
            createTime: '2025-08-20 16:05:00',
            images: [], // <-- 补上
            attachments: [] // <-- 补上
        },
        history: []
    }
];


const noticeCategoryDetails = {
    '产品质量': { id: 'QC', name: '产品质量', color: 'blue' },
    '现场管理': { id: 'SM', name: '现场管理', color: 'orange' },
    '文档资质': { id: 'DOC', name: '文档资质', color: 'purple' },
    '安全规范': { id: 'SAFE', name: '安全规范', color: 'red' },
    '其他':     { id: 'OTH', name: '其他', color: 'grey' }
};

// 我们仍然可以从这个对象方便地生成类别名称数组
const noticeCategories = Object.keys(noticeCategoryDetails);
// 使用 module.exports 导出数据，这是 Node.js 的标准方式
module.exports = {
    mockUsers,
    suppliersList,
    mockNoticesData,
    // 导出新数据

};