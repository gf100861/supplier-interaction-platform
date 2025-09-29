import { useMemo } from 'react';

export const useFilteredNotices = (notices, currentUser, searchTerm, selectedCategories) => {

    const userVisibleNotices = useMemo(() => {
        if (!currentUser || !notices) return [];
        // ... (用户角色过滤逻辑保持不变)
        return notices; // 简化示例
    }, [notices, currentUser]);

    const searchedNotices = useMemo(() => {
        let data = userVisibleNotices;

        // --- 分类筛选 ---
        if (selectedCategories && selectedCategories.length > 0) {
            data = data.filter(n => selectedCategories.includes(n.category));
        }

        // --- 多关键词“交集”搜索 (带详细日志) ---
        const keywords = searchTerm.toLowerCase().split(';').map(k => k.trim()).filter(Boolean);
        
        console.log(`--- [诊断日志] 开始关键词搜索 ---`);
        console.log(` -> 搜索词: "${searchTerm}"`);
        console.log(` -> 解析后的关键词数组:`, keywords);

        if (keywords.length > 0) {
            data = data.filter(notice => {
                const searchableText = [
                    notice.title,
                    notice.noticeCode,
                    notice.sdNotice?.description,
                    notice.assignedSupplierName,
                    notice.category,
                ].join(' ').toLowerCase();

                // .every() 确保所有关键词都必须存在于 searchableText 中
                const isMatch = keywords.every(keyword => searchableText.includes(keyword));
                
                console.log(` -> 检查: "${notice.title}" | 是否匹配所有关键词: ${isMatch ? '✔️' : '❌'}`);
                
                return isMatch;
            });
        }
        
        console.log(` -> 搜索完成，共找到 ${data.length} 条匹配结果。`);
        console.log(`--- [诊断日志] 关键词搜索结束 ---`);

        return data;
    }, [userVisibleNotices, searchTerm, selectedCategories]);

    const groupedNotices = useMemo(() => {
        // ... (分组逻辑保持不变)
        const grouped = {};
        const singles = [];
        searchedNotices.forEach(notice => {
            if (notice.batchId) {
                if (!grouped[notice.batchId]) grouped[notice.batchId] = [];
                grouped[notice.batchId].push(notice);
            } else {
                singles.push(notice);
            }
        });
        const batchItems = Object.values(grouped).map(batch => ({ isBatch: true, batchId: batch[0].batchId, notices: batch, representative: batch[0] }));
        return [...batchItems, ...singles];
    }, [searchedNotices]);

    return { userVisibleNotices, searchedNotices, groupedNotices };
};