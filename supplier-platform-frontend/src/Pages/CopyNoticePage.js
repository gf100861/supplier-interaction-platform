import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { Table, Button, Form, Select, DatePicker, Typography, Card, Popconfirm, Input, Upload, Empty, Space, Tooltip, Image, InputNumber, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, EditOutlined, UploadOutlined, FileExcelOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { useSuppliers } from '../contexts/SupplierContext';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { useNotification } from '../contexts/NotificationContext';
import { Buffer } from 'buffer';
import { useNotices } from '../contexts/NoticeContext';
import { useCategories } from '../contexts/CategoryContext';
window.Buffer = Buffer;

const { Title, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;

// --- 可编辑单元格组件和列配置中心 (保持不变) ---
// ...

const BatchNoticeCreationPage = () => {
    // ... (所有 state 和大部分 handler 函数保持不变) ...
    const { messageApi } = useNotification();

    // --- 核心修正：升级 handleExcelImport 函数 ---
    const handleExcelImport = async (file) => {
        if (!globalSettings?.category) {
            messageApi.error('请先选择问题类型并点击“确认设置”，再导入对应的文件！');
            return false;
        }
        messageApi.loading({ content: '正在解析Excel文件...', key: 'excelParse' });
        try {
            const workbook = new ExcelJS.Workbook();
            const buffer = await file.arrayBuffer();
            await workbook.xlsx.load(buffer);
            const worksheet = workbook.getWorksheet(1);

            const baseColumns = categoryColumnConfig[globalSettings.category] || [];
            // ... (表头验证逻辑保持不变)

            const imageMap = new Map();
            worksheet.getImages().forEach(image => { /* ... (图片解析逻辑不变) ... */ });

            const importedData = [];
            let currentDataIndex = count;
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber === 1) return;

                const newRowData = {
                    key: currentDataIndex,
                    images: imageMap.get(rowNumber - 1) || [],
                    attachments: [],
                };
                
                // --- 在这里使用更健壮的单元格读取方法 ---
                baseColumns.forEach((col, colIndex) => {
                    const cell = row.getCell(colIndex + 1);
                    let cellValue = '';

                    if (cell.value) {
                        // 如果是富文本对象，则提取所有文本
                        if (cell.value.richText) {
                            cellValue = cell.value.richText.map(rt => rt.text).join('');
                        } 
                        // 如果是普通对象（例如日期），转换为字符串
                        else if (typeof cell.value === 'object') {
                            cellValue = cell.value.toString();
                        } 
                        // 其他情况
                        else {
                            cellValue = cell.value;
                        }
                    }
                    newRowData[col.dataIndex] = cellValue;
                });

                // 单独读取备注列
                const commentsCell = row.getCell(baseColumns.length + 1);
                newRowData['comments'] = commentsCell.value ? commentsCell.value.toString() : '';

                importedData.push(newRowData);
                currentDataIndex++;
            });

            setDataSource(prevData => [...prevData, ...importedData]);
            setCount(currentDataIndex);
            messageApi.success({ content: `成功导入 ${importedData.length} 条数据！`, key: 'excelParse' });

        } catch (error) {
            console.error("Excel 解析失败:", error);
            messageApi.error({ content: `文件解析失败: ${error.message}`, key: 'excelParse', duration: 4 });
        }
        return false;
    };
    
    // ... (其他所有函数和 JSX 渲染部分都保持不变) ...
    
    return (
        <div>
           {/* ... */}
        </div>
    );
};

export default BatchNoticeCreationPage;