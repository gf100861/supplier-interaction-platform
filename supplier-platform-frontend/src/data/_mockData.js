import React from 'react';
import { Select, InputNumber } from 'antd';
const { Option } = Select;

export const mockUsers = {
    'philip': { id: 'sd_01', password: '123', role: 'Manager', name: 'Philip Wang (Manager)', email: '325579336a@gmail.com', },
    'xiaobing': { id: 'sd_02', password: '123', role: 'SD', name: 'Xiaobing Wu (SD)', email: '325579336a@gmail.com' },
    // --- 新增用户 ---
    'anna': { id: 'sd_03', password: '123', role: 'SD', name: 'Anna Li (SD)', email: 'anna.li@example.com' },
    // 为供应商添加邮箱
    'zhangsan': { id: 'sup_A', password: '123', role: 'Supplier', name: '张三 (供应商A)', email: '325579336a@gmail.com' },
    'lisi': { id: 'sup_B', password: '123', role: 'Supplier', name: '李四 (供应商B)', email: '325579336a@gmail.com' },
};

// --- 审计计划数据 ---
export const mockAuditPlanData = [
    { id: 'PLAN-001', year: 2025, plannedMonth: 3, supplierId: 'sup_A', supplierName: '供应商A',category: '现场管理', auditProject: 'ISO9001 年度复审', auditor: 'Philip Wang (Manager)', status: 'completed', completionDate: '2025-03-15' },
    { id: 'PLAN-002', year: 2025, plannedMonth: 5, supplierId: 'sup_B', supplierName: '供应商B', category: '产品质量',auditProject: '生产线安全规范审计', auditor: 'Philip Wang (Manager)', status: 'pending', completionDate: null },
    { id: 'PLAN-004', year: 2025, plannedMonth: 9, supplierId: 'sup_C', supplierName: '供应商C', category: '现场管理',auditProject: '原材料可追溯性体系审查', auditor: 'Philip Wang (Manager)', status: 'pending', completionDate: null },
    { id: 'PLAN-005', year: 2025, plannedMonth: 8, supplierId: 'sup_B', supplierName: '供应商B', category: '文档资质',auditProject: '仓库物料管理流程审计', auditor: 'Xiaobing Wu (SD)', status: 'pending', completionDate: null },
    { id: 'PLAN-006', year: 2025, plannedMonth: 10, supplierId: 'sup_C', supplierName: '供应商C',category: '现场管理', auditProject: '供应商社会责任评估', auditor: 'Xiaobing Wu (SD)', status: 'completed', completionDate: '2025-10-21' },
];

export const allPossibleStatuses = [
    '待供应商处理',
    '待SD关闭',
    '已完成',
    '已作废'
];
export const mockNoticesData = [
    // --- 原有数据（补全字段）---
{ 
        id: 'N-20250815-001',
        category: '现场管理',
        title: '现场物料堆放不规范问题', 
        assignedSupplierId: 'sup_A', 
        assignedSupplierName: '供应商A', 
        status: '待供应商处理', // 新状态
        sdNotice: { 
            creatorId: 'sd_01', 
            description: '现场抽检发现，A类物料未按规定分区堆放...', 
            creator: 'Philip Wang (Manager)', 
            createTime: '2025-08-15 10:00:00',
            images: [
                { uid: 'init-img-1', name: '现场照片1.png', url: 'https://gw.alipayobjects.com/zos/antfincdn/LlvErxo8H9/photo-1503185912284-5271ff81b9a8.jpeg' }
            ],
            attachments: []
        }, 
        history: [] 
    },

    {
    id: "N-20250815-002",
    category: "产品质量",
    title: "产品包装有破损",
    assignedSupplierId: "sup_B",
    assignedSupplierName: "供应商B",
    status: "待SD审核证据", // 1. 状态应为 '待SD审核证据'
    sdNotice: {
        creatorId: "sd_01",
        description: "入库检验时发现批次号 [P20250814] 的产品外包装有明显破损。",
        creator: "Philip Wang (Manager)",
        createTime: "2025-08-14 14:00:00",
        images: [],
        attachments: []
    },
    history: [ // 2. 历史记录应包含多个步骤
        {
            type: "supplier_plan_submission", // 第一步：提交计划
            submitter: "李四 (供应商B)",
            time: "2025-08-15 09:00:00",
            actionPlans: [
                { "plan": "隔离所有包装破损产品，并进行内部评审", "responsible": "李四-质量主管", "deadline": "2025-08-20" }
            ]
        },
        {
            type: "sd_plan_approval", // 第二步：计划被批准
            submitter: "Philip Wang (Manager)",
            time: "2025-08-15 11:00:00",
            description: "计划已批准，请尽快执行。"
        },
        {
            type: "supplier_evidence_submission", // 第三步：提交证据
            submitter: "李四 (供应商B)",
            time: "2025-08-16 10:00:00",
            description: "已完成整改，详情见附件图片。",
            images: [{ "uid": "supp-img-1", "name": "repack.png", "url": "https://gw.alipayobjects.com/zos/rmsportal/mqaQswcyDLcXyDKnZfES.png" }]
        }
    ]
},
  
    { 
        id: 'N-20250815-003', 
        batchId: 'BATCH-TEST-001',
        category: '文档资质',
        title: '资质文件过期提醒', 
        assignedSupplierId: 'sup_A', 
        assignedSupplierName: '供应商A', 
        status: '待供应商上传证据', 
        sdNotice: { 
            creatorId: 'sd_01', 
            description: '系统检测到贵司的ISO9001认证即将在30天后过期，请尽快更新并上传新证书。', 
            creator: 'Philip Wang (Manager)', 
            createTime: '2025-08-12 16:00:00',
            images: [],
            attachments: []
        }, 
        history: [
            { type: 'supplier_plan_submission', submitter: '张三 (供应商A)', time: '2025-08-13 11:00:00', description: '计划在本周内完成年度审核并获取新证书。', responsible: '张三-行政部', deadline: '2025-08-22' }, 
            { type: 'sd_plan_approval', submitter: 'Philip Wang (Manager)', time: '2025-08-13 14:00:00', description: '计划已批准，请在获取新证书后立即上传。' }
        ] 
    },
    { 
        id: 'N-20250815-004', 
        category: '安全规范', 
        title: '安全出口通道堵塞', 
        assignedSupplierId: 'sup_A', 
        assignedSupplierName: '供应商A', 
        status: '已完成', 
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
            { type: 'sd_evidence_approval', submitter: 'Philip Wang (Manager)', time: '2025-08-10 12:00:00', description: '证据审核通过，问题关闭。' }
        ] 
    },
    // --- 为 Xiaobing Wu 添加更多数据 ---
    { id: 'N-20250720-001', category: '产品质量', title: '产品尺寸超差', assignedSupplierId: 'sup_B', assignedSupplierName: '供应商B', status: '已完成', sdNotice: { creatorId: 'sd_02', description: '批号为P20250719的货物，抽检发现尺寸超上限公差0.2mm。', creator: 'Xiaobing Wu (SD)', createTime: '2025-07-20 11:00:00' },
        history: [
            { type: 'supplier_plan_submission', submitter: '李四 (供应商B)', time: '2025-07-20 14:00:00', description: '全检并隔离此批次产品。', responsible: '李四-生产', deadline: '2025-07-22' },
            { type: 'sd_plan_approval', submitter: 'Xiaobing Wu (SD)', time: '2025-07-20 16:00:00', description: '同意' },
            { type: 'supplier_evidence_submission', submitter: '李四 (供应商B)', time: '2025-07-21 10:00:00', description: '隔离完成。', images: [] },
            { type: 'sd_evidence_approval', submitter: 'Xiaobing Wu (SD)', time: '2025-07-21 11:00:00', description: 'OK' }
        ]
    },

    // --- 为新SD "Anna Li" 添加的数据 ---
    { id: 'N-20250715-001', category: '安全规范', title: '化学品标签不清晰', assignedSupplierId: 'sup_C', assignedSupplierName: '供应商C', status: '已完成', sdNotice: { creatorId: 'sd_03', description: '化学品仓库部分原料桶标签模糊不清，存在误用风险。', creator: 'Anna Li (SD)', createTime: '2025-07-15 09:30:00' },
        history: [
            { type: 'supplier_plan_submission', submitter: '王五 (供应商C)', time: '2025-07-15 11:00:00', description: '立即更换所有不清晰的标签。', responsible: '王五-仓管', deadline: '2025-07-16' },
            { type: 'sd_plan_approval', submitter: 'Anna Li (SD)', time: '2025-07-15 13:00:00', description: '同意' },
            { type: 'supplier_evidence_submission', submitter: '王五 (供应商C)', time: '2025-07-16 09:00:00', description: '已全部更换，见图。', images: [{ uid: 'random-uid-1', name: 'new-labels.png', url: 'https://gw.alipayobjects.com/zos/rmsportal/mqaQswcyDLcXyDKnZfES.png' }] },
            { type: 'sd_evidence_approval', submitter: 'Anna Li (SD)', time: '2025-07-16 10:00:00', description: 'OK' }
        ]
    },
    { id: 'N-20250818-001', category: '产品质量', title: '来料有划痕', assignedSupplierId: 'sup_C', assignedSupplierName: '供应商C', status: '待SD审核证据', sdNotice: { creatorId: 'sd_03', description: '8月18日批次的XX物料表面有明显划痕。', creator: 'Anna Li (SD)', createTime: '2025-08-18 14:00:00' },
        history: [
            { type: 'supplier_plan_submission', submitter: '王五 (供应商C)', time: '2025-08-19 10:00:00', description: '将加强运输保护。', responsible: '王五-物流', deadline: '2025-08-25' },
            { type: 'sd_plan_approval', submitter: 'Anna Li (SD)', time: '2025-08-19 11:00:00', description: '同意，请提供改进后的包装照片作为证据。' },
            { type: 'supplier_evidence_submission', submitter: '王五 (供应商C)', time: '2025-08-20 15:00:00', description: '改进后的包装照片已上传。', images: [{ uid: 'random-uid-2', name: 'new-packaging.png', url: 'https://gw.alipayobjects.com/zos/antfincdn/LlvErxo8H9/photo-1503185912284-5271ff81b9a8.jpeg' }] }
        ]
    },
    { id: 'N-20250820-001', batchId: 'BATCH-ANNA-001', category: '现场管理', title: '废料未及时清理', assignedSupplierId: 'sup_C', assignedSupplierName: '供应商C', status: '待供应商提交行动计划', sdNotice: { creatorId: 'sd_03', description: '二号车间角落的废料桶已满，未按规定及时清理。', creator: 'Anna Li (SD)', createTime: '2025-08-20 16:00:00' }, history: [] },
    { id: 'N-20250820-002', batchId: 'BATCH-ANNA-001', category: '文档资质', title: '操作员培训记录缺失', assignedSupplierId: 'sup_C', assignedSupplierName: '供应商C', status: '待供应商提交行动计划', sdNotice: { creatorId: 'sd_03', description: '新上岗的几位操作员，其培训记录未在系统中归档。', creator: 'Anna Li (SD)', createTime: '2025-08-20 16:05:00' }, history: [] }
];


export const suppliersList = [
    { 
        id: 'sup_A', 
        name: '供应商A', 
        parmaId: 'P-1001', 
        cmt: 'CMT-Alpha', 
        defaultSdName: 'Philip Wang (Manager)' 
    },
    { 
        id: 'sup_B', 
        name: '供应商B', 
        parmaId: 'P-1002', 
        cmt: 'CMT-Beta', 
        defaultSdName: 'Xiaobing Wu (SD)' 
    },
    { 
        id: 'sup_C', 
        name: '供应商C', 
        parmaId: 'P-1003', 
        cmt: 'CMT-Alpha', 
        defaultSdName: 'Philip Wang (Manager)' 
    },
    // 即使某个供应商在审计计划中没有任务，也应该在这里定义
    { 
        id: 'sup_D', 
        name: '供应商D', 
        parmaId: 'P-1004', 
        cmt: 'CMT-Gamma', 
        defaultSdName: 'Xiaobing Wu (SD)' 
    }, 
];


   export const mockEventsData = [
    { id: 'EVT-001', type: 'audit', category: '产品质量', year: 2025, plannedMonth: 3, supplierId: 'sup_A', supplierName: '供应商A', auditProject: 'ISO9001 年度复审', auditor: 'Philip Wang (Manager)', status: 'completed', completionDate: '2025-03-15' },
    { id: 'EVT-002', type: 'audit', category: '安全规范', year: 2025, plannedMonth: 5, supplierId: 'sup_B', supplierName: '供应商B', auditProject: '生产线安全规范审计', auditor: 'Philip Wang (Manager)', status: 'pending', completionDate: null },
    { id: 'EVT-003', type: 'qrm', category: '现场管理', year: 2025, plannedMonth: 5, supplierId: 'sup_A', auditProject: 'Q2 QRM 会议', auditor: 'Xiaobing Wu (SD)', status: 'pending', completionDate: null },
    { id: 'EVT-004', type: 'audit', category: '产品质量', year: 2025, plannedMonth: 9, supplierId: 'sup_C', supplierName: '供应商C', auditProject: '原材料可追溯性体系审查', auditor: 'Philip Wang (Manager)', status: 'pending', completionDate: null },
    { id: 'EVT-005', type: 'audit', category: '现场管理', year: 2025, plannedMonth: 8, supplierId: 'sup_B', supplierName: '供应商B', auditProject: '仓库物料管理流程审计', auditor: 'Xiaobing Wu (SD)', status: 'pending', completionDate: null },
    { id: 'EVT-006', type: 'qrm', category: '文档资质', year: 2025, plannedMonth: 11, supplierId: 'sup_C', auditProject: 'Q4 QRM 会议', auditor: 'Xiaobing Wu (SD)', status: 'completed', completionDate: '2025-10-21' },
];

export const noticeCategoryDetails = {
    '产品质量': { id: 'QC', name: '产品质量', color: 'blue' },
    '现场管理': { id: 'SM', name: '现场管理', color: 'orange' },
    '文档资质': { id: 'DOC', name: '文档资质', color: 'purple' },
    '安全规范': { id: 'SAFE', name: '安全规范', color: 'red' },
    '其他':     { id: 'OTH', name: '其他', color: 'grey' }
};

// 我们仍然可以从这个对象方便地生成类别名称数组
export const noticeCategories = Object.keys(noticeCategoryDetails);


// --- 核心修改 2：清理 categoryColumnConfig，移除您添加的 id 对象 ---
export const categoryColumnConfig = {
    '产品质量': [
        { title: '标题', dataIndex: 'title', editable: true },
        { title: '缺陷描述', dataIndex: 'description', editable: true, onCell: () => ({ inputType: 'textarea' }) },
        { title: '缺陷等级', dataIndex: 'defectLevel', render: (text, record, handleCellChange) => (
            <Select value={text || '次要'} style={{ width: '100%' }} onChange={(value) => handleCellChange(record.key, 'defectLevel', value)}>
                <Option value="严重">严重</Option>
                <Option value="主要">主要</Option>
                <Option value="次要">次要</Option>
            </Select>
        )},
        // {id: 'SEM'} <--- 移除这一行
    ],
    '现场管理': [
        { title: '问题点', dataIndex: 'title', editable: true },
        { title: '具体描述', dataIndex: 'description', editable: true, onCell: () => ({ inputType: 'textarea' }) },
        { title: '5S评分 (1-5)', dataIndex: 'score', render: (text, record, handleCellChange) => (
            <InputNumber min={1} max={5} value={text || 1} style={{ width: '100%' }} onChange={(value) => handleCellChange(record.key, 'score', value)} />
        )},
        // , <--- 移除这里的逗号
        // {id: 'PA'} <--- 移除这一行
    ],
    '文档资质': [ { title: '标题', dataIndex: 'title', editable: true }, { title: '描述', dataIndex: 'description', editable: true, onCell: () => ({ inputType: 'textarea' }) } /*, {id:'CA'}*/ ], // 移除
    '安全规范': [ { title: '标题', dataIndex: 'title', editable: true }, { title: '描述', dataIndex: 'description', editable: true, onCell: () => ({ inputType: 'textarea' }) } /*, {id:'NCR'}*/ ], // 移除
    '其他': [ { title: '标题', dataIndex: 'title', editable: true }, { title: '描述', dataIndex: 'description', editable: true, onCell: () => ({ inputType: 'textarea' }) } /*, {id:'QC'}*/ ],   // 移除
};