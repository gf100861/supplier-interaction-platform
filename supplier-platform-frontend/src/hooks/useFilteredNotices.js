import { useMemo } from 'react';

export const useFilteredNotices = (notices, currentUser, searchTerm, selectedCategories) => {

    const userVisibleNotices = useMemo(() => {
        if (!currentUser || !notices) return [];
        // ... (用户角色过滤逻辑保持不变)
        return notices; // 简化示例
    }, [notices, currentUser]);

   const groupedNotices = useMemo(() => {
        const batchGroups = {}; // 用于存放真正的批量任务
        const dailyGroups = {}; // 用于存放按“供应商+日期”分组的单个任务
        
        searchedNotices.forEach(notice => {
            if (notice.batchId) {
                // 如果有 batchId, 按老方法分组
                if (!batchGroups[notice.batchId]) batchGroups[notice.batchId] = [];
                batchGroups[notice.batchId].push(notice);
            } else {
                // 如果没有 batchId，创建一个新的分组键
                const dateKey = dayjs(notice.sdNotice?.createTime).format('YYYY-MM-DD');
                const dailyGroupKey = `${notice.assignedSupplierId}-${dateKey}`;
                
                if (!dailyGroups[dailyGroupKey]) dailyGroups[dailyGroupKey] = [];
                dailyGroups[dailyGroupKey].push(notice);
            }
        });

        // 1. 处理真正的批量任务包
        const batchItems = Object.values(batchGroups).map(batch => ({ 
            isBatch: true, 
            batchId: batch[0].batchId, 
            notices: batch, 
            representative: batch[0] 
        }));

        // 2. 处理“每日”任务包
        const dailyItems = [];
        Object.values(dailyGroups).forEach(group => {
            if (group.length > 1) {
                // 如果一个“供应商+日期”组合下有多个任务，也把它变成一个“批量包”
                dailyItems.push({
                    isBatch: true, // 标记为批量，以便UI复用
                    batchId: `daily-${group[0].assignedSupplierId}-${dayjs(group[0].sdNotice?.createTime).format('YYYYMMDD')}`, // 创建一个唯一的虚拟 batchId
                    notices: group,
                    representative: group[0]
                });
            } else {
                // 如果只有一个任务，就还把它当作单个项
                dailyItems.push(group[0]);
            }
        });
        
        // 3. 将两者合并
        return [...batchItems, ...dailyItems];

    }, [searchedNotices]);

    return { userVisibleNotices, searchedNotices, groupedNotices };
};