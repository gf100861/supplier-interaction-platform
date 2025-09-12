// src/hooks/useFilteredNotices.js
import { useMemo } from 'react';

export const useFilteredNotices = (notices, currentUser, searchTerm) => {
    // 1. 根据当前用户角色筛选可见的通知单
    const userVisibleNotices = useMemo(() => {
        if (!currentUser) return [];
        switch (currentUser.role) {
            case 'Supplier':
                return notices.filter(n => n.assignedSupplierId === currentUser.id);
            case 'SD':
                return notices.filter(n => n.sdNotice.creatorId === currentUser.id);
            case 'Manager':
                return notices;
            default:
                return [];
        }
    }, [notices, currentUser]);

    // 2. 根据搜索词进行过滤
    const searchedNotices = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
        if (!lowerCaseSearchTerm) return userVisibleNotices;
        return userVisibleNotices.filter(notice =>
            notice.title.toLowerCase().includes(lowerCaseSearchTerm) ||
            notice.assignedSupplierName.toLowerCase().includes(lowerCaseSearchTerm) ||
            notice.id.toLowerCase().includes(lowerCaseSearchTerm) ||
            (notice.category && notice.category.toLowerCase().includes(lowerCaseSearchTerm))
        );
    }, [searchTerm, userVisibleNotices]);

    // 3. 将筛选后的通知单分为批处理和独立项
    const groupedNotices = useMemo(() => {
        const grouped = {};
        const singles = [];
        searchedNotices.forEach(notice => {
            if (notice.batchId) {
                if (!grouped[notice.batchId]) {
                    grouped[notice.batchId] = [];
                }
                grouped[notice.batchId].push(notice);
            } else {
                singles.push(notice);
            }
        });
        const batchItems = Object.values(grouped).map(batch => ({
            isBatch: true,
            batchId: batch[0].batchId,
            notices: batch,
            representative: batch[0],
        }));
        return [...batchItems, ...singles];
    }, [searchedNotices]);

    // 返回扁平化的搜索结果和分组后的结果，以供不同场景使用
    return { searchedNotices, groupedNotices };
};