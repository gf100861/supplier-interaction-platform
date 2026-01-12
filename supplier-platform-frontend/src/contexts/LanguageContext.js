import React, { createContext, useContext, useState, useEffect } from 'react';
import zhCN from 'antd/es/locale/zh_CN';
import enUS from 'antd/es/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';

// 翻译字典
const translations = {
    zh: {
        // App Title
        'app.title': '供应商与SD信息交换平台',
        
        // Menu Items
        'menu.dashboard': '仪表盘',
        'menu.auditPlan': '年度计划',
        'menu.noticeGroup': '通知单处理',
        'menu.notices': '整改通知单列表',
        'menu.manualUpload': '手工导入任务',
        'menu.batchCreate': '批量导入任务',
        'menu.intelligenceSearch': 'AI 检索通知单',
        'menu.analysis': '经验使用',
        'menu.reports': '综合报告',
        'menu.offlineShare': '文件互传',
        'menu.settings': '系统设置和建议',
        'menu.admin': '系统管理',
        'menu.historicalImport': '历史数据导入',

        // Header & Common
        'header.welcome': '欢迎您',
        'header.logout': '登出',
        'header.switchLang': 'English',
        'common.success': '操作成功',
        'common.logoutSuccess': '您已成功登出！',
        'menu.helpCenter': '帮助中心',

        // --- 新增：Dashboard 专用翻译 ---
        'dashboard.myDashboard': '我的仪表盘',
        'dashboard.myDashboardDesc': '查看与您公司相关的核心问题指标。',
        'dashboard.opsDashboard': '运营仪表盘',
        'dashboard.opsDashboardDesc': '监控关键绩效指标 (KPI) 与行动预警。',
        'dashboard.tourButton': '功能引导',
        
        // 统计卡片
        'dashboard.stat.historyOpen': '通知单历史未完成',
        'dashboard.stat.recentOpen': '最近30天未完成',
        'dashboard.stat.evidenceDue': '未来30天需提交证据',
        'dashboard.stat.closedMonth': '本月已关闭 (通知)',
        'dashboard.stat.allOpen': '所有未关闭 (通知)',
        'dashboard.stat.planOverdue': '过往未完成 (年度计划)',
        'dashboard.stat.planPending': '本月待办 (年度计划)',
        
        // 模块标题
        'dashboard.coreMetrics': '核心指标 (通知单 & 计划)',
        'dashboard.monthlyPlan': '月度计划概览',
        'dashboard.actionAlert': '行动预警：近30天待处理 (通知单)',
        'dashboard.highlights': '亮点展示：近期最受欢迎改善',
        
        // 列表与详情
        'dashboard.filter.bySupplier': '按供应商',
        'dashboard.filter.byType': '按类型',
        'dashboard.filter.allSuppliers': '所有供应商',
        'dashboard.filter.allTypes': '所有类型',
        'dashboard.list.pastPending': '当月及过往待办',
        'dashboard.list.nextMonthPending': '下月待办', 
        'dashboard.list.noBacklog': '暂无积压计划。',
        'dashboard.list.noNextMonth': '下月暂无计划。',
        'dashboard.list.itemsPending': '项待处理',
        'dashboard.action.process': '去处理',
        'dashboard.empty.noAlerts': '太棒了！近30天内没有积压任务。',
        'dashboard.tag.from': '来自',
        'dashboard.action.viewDetails': '查看详情',
        'dashboard.desc.noDetails': '无详细描述',
        'dashboard.text.likes': '个赞',
        'dashboard.empty.noLikes': '近期暂无获得点赞的改善案例。',

        // Tour (引导)
        'tour.step1.title': '核心指标',
        'tour.step1.desc': '这里展示了当前月份及历史累计的关键业务指标，包括已关闭通知单、未关闭通知单及计划完成情况。',
        'tour.step2.title': '月度计划概览',
        'tour.step2.desc': 'SD 和 经理可以在此处查看和管理月度审计、QRM会议等计划的执行进度。',
        'tour.step3.title': '行动预警',
        'tour.step3.desc': '系统会自动筛选出近30天内未处理的紧急事项，点击“去处理”可快速跳转并筛选出对应供应商的通知单。',
        'tour.step4.title': '亮点展示',
        'tour.step4.desc': '展示近期获得点赞最多的优秀整改案例，供大家学习参考。',
    
    },
    en: {
        // App Title
        'app.title': 'Supplier & SD Interaction Platform',

        // Menu Items
        'menu.dashboard': 'Dashboard',
        'menu.auditPlan': 'Annual Plan',
        'menu.noticeGroup': 'Notice Manage',
        'menu.notices': 'Notice List',
        'menu.manualUpload': 'Manual Upload',
        'menu.batchCreate': 'Batch Import',
        'menu.intelligenceSearch': 'AI Search',
        'menu.analysis': 'Experience Analysis',
        'menu.reports': 'Reports print',
        'menu.offlineShare': 'File Transfer',
        'menu.settings': 'Settings & Suggestions',
        'menu.admin': 'System Admin',
        'menu.historicalImport': 'Historical Data Import',
         'menu.helpCenter': 'Help Center',

        // Header & Common
        'header.welcome': 'Welcome',
        'header.logout': 'Logout',
        'header.switchLang': '中文',
        'common.success': 'Success',
        'common.logoutSuccess': 'Logged out successfully!',


        // --- NEW: Dashboard Translations ---
        'dashboard.myDashboard': 'My Dashboard',
        'dashboard.myDashboardDesc': 'View core issue metrics related to your company.',
        'dashboard.opsDashboard': 'Operations Dashboard',
        'dashboard.opsDashboardDesc': 'Monitor KPIs and action alerts.',
        'dashboard.tourButton': 'Tour Guide',

        // Statistics
        'dashboard.stat.historyOpen': 'All Open Notices',
        'dashboard.stat.recentOpen': 'Open (Last 30 Days)',
        'dashboard.stat.evidenceDue': 'Evidence Due (Next 30 Days)',
        'dashboard.stat.closedMonth': 'Closed This Month',
        'dashboard.stat.allOpen': 'Total Open Notices',
        'dashboard.stat.planOverdue': 'Overdue Plans',
        'dashboard.stat.planPending': 'Pending Plans (This Month)',

        // Section Titles
        'dashboard.coreMetrics': 'Core Metrics (Notices & Plans)',
        'dashboard.monthlyPlan': 'Monthly Plan Overview',
        'dashboard.actionAlert': 'Action Alerts: Pending (Last 30 Days)',
        'dashboard.highlights': 'Highlights: Top Improvements',

        // Lists & Details
        'dashboard.filter.bySupplier': 'By Supplier',
        'dashboard.filter.byType': 'By Type',
        'dashboard.filter.allSuppliers': 'All Suppliers',
        'dashboard.filter.allTypes': 'All Types',
        'dashboard.list.pastPending': 'Current & Past Pending',
        'dashboard.list.nextMonthPending': 'Pending in Next Month',
        'dashboard.list.noBacklog': 'No backlog plans.',
        'dashboard.list.noNextMonth': 'No plans for next month.',
        'dashboard.list.itemsPending': 'items pending',
        'dashboard.action.process': 'Process',
        'dashboard.empty.noAlerts': 'Great! No backlog tasks in the last 30 days.',
        'dashboard.tag.from': 'From',
        'dashboard.action.viewDetails': 'View Details',
        'dashboard.desc.noDetails': 'No details available',
        'dashboard.text.likes': 'Likes',
        'dashboard.empty.noLikes': 'No liked improvement cases recently.',

        // Tour
        'tour.step1.title': 'Core Metrics',
        'tour.step1.desc': 'Shows key business metrics for the current month and historical totals.',
        'tour.step2.title': 'Monthly Plan',
        'tour.step2.desc': 'SDs and Managers can view and manage the progress of monthly audits and QRM meetings.',
        'tour.step3.title': 'Action Alerts',
        'tour.step3.desc': 'Automatically filters urgent items pending for the last 30 days. Click "Process" to jump to the relevant notices.',
        'tour.step4.title': 'Highlights',
        'tour.step4.desc': 'Showcases highly-rated improvement cases for reference and learning.',
    }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    // 默认读取本地存储，如果没有则默认为 'zh'
    const [language, setLanguage] = useState(localStorage.getItem('app_language') || 'zh');

    useEffect(() => {
        console.log('LanguageContext: 语言已更新为:', language);
        localStorage.setItem('app_language', language);
        // 同步设置 dayjs 的语言
        dayjs.locale(language === 'zh' ? 'zh-cn' : 'en');
    }, [language]);

    const toggleLanguage = () => {
        setLanguage(prev => {
            const newLang = prev === 'zh' ? 'en' : 'zh';
            return newLang;
        });
    };

    // 翻译函数
    const t = (key) => {
        const translated = translations[language][key];
        return translated || key;
    };

    // 获取 Ant Design 的语言包
    const antdLocale = language === 'zh' ? zhCN : enUS;

    return (
        <LanguageContext.Provider value={{ language, toggleLanguage, t, antdLocale }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};