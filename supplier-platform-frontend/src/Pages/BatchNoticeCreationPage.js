import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
// 1. 引入 Checkbox, Collapse 等组件
import { Table, Button, Form, Select, DatePicker, Typography, Card, Popconfirm, Input, Upload, Empty, Space, Tooltip, Image, InputNumber, Modal, Checkbox, Collapse, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, EditOutlined, UploadOutlined, FileExcelOutlined, DownloadOutlined, InboxOutlined, ApiOutlined, GoogleOutlined } from '@ant-design/icons';
import { useSuppliers } from '../contexts/SupplierContext';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { useNotification } from '../contexts/NotificationContext';
import { Buffer } from 'buffer';
import { useNotices } from '../contexts/NoticeContext';
import { useCategories } from '../contexts/CategoryContext';
window.Buffer = Buffer;

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;
const { Panel } = Collapse;

// ... (EditableContext, EditableRow, getBase64, EditableCell 保持不变) ...
const EditableContext = React.createContext(null);

const EditableRow = ({ index, ...props }) => {
    const [form] = Form.useForm();
    return (
        <Form form={form} component={false}>
            <EditableContext.Provider value={form}>
                <tr {...props} />
            </EditableContext.Provider>
        </Form>
    );
};

const getBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });

const EditableCell = ({ title, editable, children, dataIndex, record, handleSave, inputType = 'input', ...restProps }) => {
    const [editing, setEditing] = useState(false);
    const inputRef = useRef(null);
    const form = useContext(EditableContext);

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
        }
    }, [editing]);

    const toggleEdit = () => {
        setEditing(!editing);
        form.setFieldsValue({ [dataIndex]: record[dataIndex] });
    };

    const save = async () => {
        try {
            const values = await form.validateFields();
            toggleEdit();
            handleSave({ ...record, ...values });
        } catch (errInfo) {
            console.log('Save failed:', errInfo);
        }
    };

    let childNode = children;
    const optionalFields = ['comments', 'product'];
    if (editable) {
        childNode = editing ? (
            <Form.Item
                style={{ margin: 0 }}
                name={dataIndex}
                rules={[{
                    required: !optionalFields.includes(dataIndex),
                    message: `${title} is required.`
                }]}
            >
                {inputType === 'textarea' ? (
                    <TextArea ref={inputRef} onPressEnter={save} onBlur={save} autoSize={{ minRows: 3, maxRows: 8 }} />
                ) : (
                    <Input ref={inputRef} onPressEnter={save} onBlur={save} />
                )}
            </Form.Item>
        ) : (
            <div className="editable-cell-value-wrap" style={{ paddingRight: 24, minHeight: 22, whiteSpace: 'pre-wrap' }} onClick={toggleEdit}>
                {children || ' '}
            </div>
        );
    }
    return <td {...restProps}>{childNode}</td>;
};

// ... (categoryColumnConfig 保持不变) ...
const categoryColumnConfig = {
    'SEM': [
        { title: 'Criteria n°', dataIndex: 'criteria', editable: true, width: '10%' },
        { title: 'SEM Parameter', dataIndex: 'parameter', editable: true, width: '15%', onCell: () => ({ inputType: 'textarea' }) },
        { title: 'Gap description', dataIndex: 'description', editable: true, width: '25%', onCell: () => ({ inputType: 'textarea' }) },
        {
            title: 'Actual SEM points', dataIndex: 'score', width: 150, render: (text, record, handleCellChange) => (
                <InputNumber min={1} max={5} value={text} style={{ width: '100%' }} onChange={(value) => handleCellChange(record.key, 'score', value)} />
            )
        },
    ],
    'Process Audit': [
        { title: 'PRODUCT', dataIndex: 'product', editable: true, width: '20%' },
        { title: 'PROCESS/QUESTIONS', dataIndex: 'title', editable: true, width: '20%' },
        { title: 'FINDINGS/DEVIATIONS', dataIndex: 'description', editable: true, width: '25%', onCell: () => ({ inputType: 'textarea' }) },
    ],
    '文档资质': [{ title: '标题', dataIndex: 'title', editable: true, width: '20%' }, { title: '描述', dataIndex: 'description', editable: true, width: '40%', onCell: () => ({ inputType: 'textarea' }) }],
    '安全规范': [{ title: '标题', dataIndex: 'title', editable: true, width: '20%' }, { title: '描述', dataIndex: 'description', editable: true, width: '40%', onCell: () => ({ inputType: 'textarea' }) }],
    '其他': [{ title: '标题', dataIndex: 'title', editable: true, width: '20%' }, { title: '描述', dataIndex: 'description', editable: true, width: '40%', onCell: () => ({ inputType: 'textarea' }) }],
};

const LS_API_KEY_KEY = 'gemini_api_key_local_storage';

const BatchNoticeCreationPage = () => {
    const [globalForm] = Form.useForm();
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const [dataSource, setDataSource] = useState([]);
    const [globalSettings, setGlobalSettings] = useState(null);
    const [count, setCount] = useState(0);
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const [previewImage, setPreviewImage] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const { messageApi } = useNotification();
    const { addNotices } = useNotices();
    const { categories, loading: categoriesLoading } = useCategories();

    // --- 新增：API Key 状态 ---
    const [apiKey, setApiKey] = useState('');
    const [rememberApiKey, setRememberApiKey] = useState(false);

    // --- 新增：加载 API Key ---
    useEffect(() => {
        const savedKey = localStorage.getItem(LS_API_KEY_KEY);
        if (savedKey) {
            setApiKey(savedKey);
            setRememberApiKey(true);
        }
    }, []);

    const handleApiKeyChange = (e) => {
        const newKey = e.target.value;
        setApiKey(newKey);
        if (rememberApiKey) {
            localStorage.setItem(LS_API_KEY_KEY, newKey);
        }
    };

    const handleRememberChange = (e) => {
        const checked = e.target.checked;
        setRememberApiKey(checked);
        if (checked) {
            localStorage.setItem(LS_API_KEY_KEY, apiKey);
        } else {
            localStorage.removeItem(LS_API_KEY_KEY);
        }
    };

    // --- 新增：Embedding 生成函数 ---
    const getGeminiEmbedding = async (text) => {
        if (!text || !text.trim() || !apiKey) return null;
        // 简单截断防止超长
        const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 8000);

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: "models/text-embedding-004",
                        content: { parts: [{ text: cleanText }] }
                    })
                }
            );

            if (!response.ok) throw new Error("Embedding API request failed");
            const result = await response.json();
            return result.embedding.values;
        } catch (error) {
            console.error("生成向量失败:", error);
            // 批量时不打断流程，只记录错误
            return null;
        }
    };

    const managedSuppliers = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'Manager') return suppliers;
        if (currentUser.role === 'SD') {
            const managed = currentUser.managed_suppliers || [];
            return managed.map(assignment => assignment.supplier);
        }
        return [];
    }, [currentUser, suppliers]);

    const sortedCategories = useMemo(() => {
        if (!categories || categories.length === 0) return [];
        const desiredOrder = ['Process Audit', 'SEM'];
        return [...categories].sort((a, b) => {
            const indexA = desiredOrder.indexOf(a);
            const indexB = desiredOrder.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [categories]);

    // ... (handleCellChange, handlePreview, handleDelete, handleSave, handleUploadChange 保持不变) ...
    const handleCellChange = (key, dataIndex, value) => {
        const newData = [...dataSource];
        const index = newData.findIndex((item) => key === item.key);
        if (index > -1) {
            const item = newData[index];
            newData.splice(index, 1, { ...item, [dataIndex]: value });
            setDataSource(newData);
        }
    };

    const handlePreview = async (file) => {
        if (!file.url && !file.preview && file.originFileObj) {
            file.preview = await getBase64(file.originFileObj);
        }
        setPreviewImage(file.url || file.preview);
        setPreviewTitle(file.name || '图片预览');
        setIsPreviewVisible(true);
    };

    const handleDelete = (key) => {
        setDataSource(dataSource.filter((item) => item.key !== key));
    };

    const handleSave = (row) => {
        const newData = [...dataSource];
        const index = newData.findIndex((item) => row.key === item.key);
        const item = newData[index];
        newData.splice(index, 1, { ...item, ...row });
        setDataSource(newData);
    };

    const handleUploadChange = (key, dataIndex, { fileList }) => {
        const newData = [...dataSource];
        const index = newData.findIndex((item) => key === item.key);
        if (index > -1) {
            const item = newData[index];
            newData.splice(index, 1, { ...item, [dataIndex]: fileList });
            setDataSource(newData);
        }
    };

    const columns = useMemo(() => {
        if (!globalSettings?.category) {
            return [];
        }

        let baseColumns = categoryColumnConfig[globalSettings.category] || [];

        baseColumns = baseColumns.map(col => {
            if (col.render && !col.editable) {
                return { ...col, render: (text, record) => col.render(text, record, handleCellChange) };
            }
            return col;
        });

        const commonColumns = [
            {
                title: '图片',
                dataIndex: 'images',
                width: 200,
                render: (_, record) => (
                    <Dragger
                        multiple
                        listType="picture"
                        fileList={record.images || []}
                        beforeUpload={() => false}
                        onChange={(info) => handleUploadChange(record.key, 'images', info)}
                        accept="image/*"
                        onPreview={handlePreview}
                    >
                        <div style={{ padding: '8px 0' }}>
                            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                            <p className="ant-upload-text" style={{ fontSize: '12px' }}>点击或拖拽</p>
                        </div>
                    </Dragger>
                )
            },
            {
                title: '附件',
                dataIndex: 'attachments',
                width: 120,
                render: (_, record) => (
                    <div>
                        <Upload
                            multiple
                            fileList={record.attachments || []}
                            beforeUpload={() => false}
                            onChange={(info) => handleUploadChange(record.key, 'attachments', info)}
                        >
                            <Button icon={<UploadOutlined />}>上传</Button>
                        </Upload>
                        <Tooltip title="暂不支持 .txt 格式，请打包为 .zip 或使用其他格式。">
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>格式提示</Text>
                        </Tooltip>
                    </div>
                )
            },
            { title: '操作', dataIndex: 'operation', width: 80, render: (_, record) => (<Popconfirm title="确定删除吗?" onConfirm={() => handleDelete(record.key)}><Button type="link" danger icon={<DeleteOutlined />} /></Popconfirm>) },
        ];

        const allColumns = [...baseColumns, ...commonColumns];

        return allColumns.map(col => {
            if (!col.editable) return col;
            return {
                ...col,
                onCell: (record) => ({ record, editable: col.editable, dataIndex: col.dataIndex, title: col.title, handleSave, inputType: col.onCell?.()?.inputType }),
            };
        });
    }, [globalSettings, handleSave]);

    // ... (handleAdd, onConfirmSettings, onModifySettings 保持不变) ...
    const handleAdd = () => {
        if (!globalSettings) { messageApi.error('请点击"确认设置"的按钮！'); return; }
        const newRowData = { key: count, images: [], attachments: [] };
        const dynamicColumns = categoryColumnConfig[globalSettings.category] || [];
        dynamicColumns.forEach(col => {
            newRowData[col.dataIndex] = col.dataIndex === 'score' ? 1 : (col.dataIndex === 'defectLevel' ? '次要' : '');
        });
        setDataSource([...dataSource, newRowData]);
        setCount(count + 1);
    };

    const onConfirmSettings = async () => {
        try {
            const values = await globalForm.validateFields();
            if (globalSettings?.category !== values.category && dataSource.length > 0) {
                messageApi.warning('问题类型已更改，表格数据已被清空。');
                setDataSource([]);
            }
            const selectedSupplier = managedSuppliers.find(s => s.id === values.supplierId);
            setGlobalSettings({
                ...values,
                supplierName: selectedSupplier.name,
            });
            messageApi.success('全局设置已锁定，现在可以添加条目了。');
        } catch (errorInfo) {
            messageApi.error('请填写所有必填的全局设置项！');
        }
    };

    const onModifySettings = () => {
        if (dataSource.length > 0) {
            messageApi.warning('请先清空下方的条目，才能修改全局设置。');
            return;
        }
        setGlobalSettings(null);
    };

    const handleSubmitAll = async () => {
        if (!globalSettings) {
            messageApi.error('请点击“确认设置”按钮！');
            return;
        }

        const validDataSource = dataSource.filter(item => {
            const dynamicFields = categoryColumnConfig[globalSettings.category] || [];
            const keyFields = dynamicFields
                .filter(col => col.dataIndex !== 'comments' && col.dataIndex !== 'score')
                .map(col => col.dataIndex);

            if (keyFields.length === 0) {
                keyFields.push('title', 'description');
            }
            const isValid = keyFields.some(key => {
                const value = item[key];
                const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
                return hasValue;
            });
            return isValid;
        });

        if (validDataSource.length === 0) {
            messageApi.error('请至少填写一条有效的整改项！（例如: 标题、描述等关键字段不能为空）');
            return;
        }

        // --- 核心修正：加载提示 ---
        messageApi.loading({ content: '正在处理数据并生成 AI 向量...', key: 'submitting', duration: 0 });

        const batchId = `BATCH-${dayjs().format('YYYYMMDDHHmmss')}-${Math.random().toString(36).substring(2, 8)}`;

        // --- 核心逻辑升级：并行处理图片转码 + 并行生成向量 ---
        const processRowDataAndEmbed = async (item, index) => {
            // 1. 处理文件 (Base64)
            const processFiles = async (fileList = []) => {
                return Promise.all(fileList.map(async file => {
                    if (file.originFileObj && !file.url) {
                        const base64Url = await getBase64(file.originFileObj);
                        return { uid: file.uid, name: file.name, status: 'done', url: base64Url };
                    }
                    return file;
                }));
            };

            const processedImages = await processFiles(item.images);
            const processedAttachments = await processFiles(item.attachments);

            // 通用逻辑：把 details 里所有有价值的文本拼起来
            // 比如 SEM 的 parameter/description，Process 的 title/description
            const { key: _k, images: _i, attachments: _a, ...details } = item;

            // --- 核心修改开始：使用列标题作为语义标签 ---

            // 1. 获取当前分类的列配置
            const currentColumns = categoryColumnConfig[globalSettings.category] || [];

            // 2. 生成带明确语义标签的文本
            // 逻辑：尝试在配置中找到 dataIndex 对应的 title，如果找不到就用原 key
            const textParts = Object.entries(details)
                .filter(([k, v]) => k !== 'score' && k !== 'key' && v)
                .map(([k, v]) => {
                    const colConfig = currentColumns.find(col => col.dataIndex === k);
                    // 如果能找到配置，就用配置里的 Title (例如 "Gap description")
                    // 如果找不到，就映射一些通用词 (例如 "comments" -> "备注")
                    // 否则直接用 key
                    let label = k;
                    if (colConfig) {
                        label = colConfig.title;
                    } else if (k === 'comments') {
                        label = '备注';
                    }

                    return `[${label}]: ${v}`;
                });

            console.log('Text parts for embedding:', textParts);

            const textToEmbed = `
                [Category]: ${globalSettings.category}
                [Supplier]: ${globalSettings.supplierName}
                ${textParts.join('\n')}
            `.trim();

            // 3. 生成向量 (如果 Key 存在)
            let embeddingVector = null;
            if (apiKey) {
                embeddingVector = await getGeminiEmbedding(textToEmbed);
            }

            // 4. 构建最终对象
            const noticeCode = `N-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${index}`;

            return {
                notice_code: noticeCode,
                batch_id: batchId,
                category: globalSettings.category,
                title: details.title || details.parameter || 'New Notice',
                assigned_supplier_id: globalSettings.supplierId,
                assigned_supplier_name: globalSettings.supplierName,
                status: '待提交Action Plan',
                creator_id: currentUser.id,
                // *** 存入向量 ***
                embedding: embeddingVector,
                sd_notice: {
                    creatorId: currentUser.id,
                    description: details.description || '',
                    creator: currentUser.name,
                    createTime: globalSettings.createTime.format('YYYY-MM-DD'),
                    images: processedImages,
                    attachments: processedAttachments,
                    details: details,
                },
                history: [],
            };
        };

        try {
            // 使用 Promise.all 并发处理每一行 (图片转码 + AI Embedding)
            const batchNoticesToInsert = await Promise.all(validDataSource.map((item, index) => processRowDataAndEmbed(item, index)));

            // 提交到 Supabase
            await addNotices(batchNoticesToInsert);
            messageApi.success({ content: `成功提交 ${batchNoticesToInsert.length} 条通知单！`, key: 'submitting', duration: 3 });

            setDataSource([]);
            setGlobalSettings(null);
            globalForm.resetFields();

        } catch (error) {
            console.error(error);
            messageApi.error({ content: `提交失败: ${error.message}`, key: 'submitting', duration: 3 });
        }
    };

    // ... (handleDownloadTemplate, handleExcelImport 保持不变) ...
    const handleDownloadTemplate = async () => {
        const category = globalForm.getFieldValue('category');
        if (!category) {
            messageApi.error('请先选择问题类型，再下载对应的模板！');
            return;
        }
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('模板');
        const baseColumns = categoryColumnConfig[category] || [];
        const excelColumns = [...baseColumns].map(c => ({
            header: c.title,
            key: c.dataIndex,
            width: c.title.length > 20 ? 50 : 30
        }));
        worksheet.columns = excelColumns;
        messageApi.success(`已开始下载“${category}”类型的模板。`);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${category}类问题导入模板.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
            const expectedHeaders = [...baseColumns.map(col => col.title)];
            const actualHeadersRaw = (worksheet.getRow(1).values || []);
            const actualHeaders = actualHeadersRaw.slice(1, expectedHeaders.length + 1);

            console.log('Expected Headers:', expectedHeaders);

            console.log('Actual Headers:', actualHeaders);

            if (JSON.stringify(expectedHeaders) !== JSON.stringify(actualHeaders)) {
                messageApi.error({ content: `Excel模板表头不匹配！当前需要“${globalSettings.category}”类型的模板。`, key: 'excelParse', duration: 5 });
                return false;
            }

            const imageMap = new Map();
            worksheet.getImages().forEach(image => {
                const startRow = image.range.tl.nativeRow;
                const img = workbook.getImage(image.imageId);
                if (!img || !img.buffer) return;
                const imageBase64 = `data:image/${img.extension || 'png'};base64,${Buffer.from(img.buffer).toString('base64')}`;
                if (!imageMap.has(startRow)) { imageMap.set(startRow, []); }
                imageMap.get(startRow).push({ uid: `-${Math.random()}`, name: `image_${startRow}.${img.extension || 'png'}`, status: 'done', url: imageBase64 });
            });

            const importedData = [];
            let currentDataIndex = count;
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber === 1) return;
                const newRowData = {
                    key: currentDataIndex,
                    images: imageMap.get(rowNumber - 1) || [],
                    attachments: [],
                };
                baseColumns.forEach((col, colIndex) => {
                    const cell = row.getCell(colIndex + 1);
                    let cellValue = '';
                    if (cell.value) {
                        if (cell.value.richText) {
                            cellValue = cell.value.richText.map(rt => rt.text).join('');
                        } else if (typeof cell.value === 'object') {
                            cellValue = cell.value.toString();
                        } else {
                            cellValue = cell.value;
                        }
                    }
                    newRowData[col.dataIndex] = cellValue;
                });
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

    return (
        <div>
            <Card style={{ marginBottom: 16 }}>
                <Title level={4}>批量创建整改通知单</Title>
                <Paragraph type="secondary">请先选择应用于所有条目的全局信息，然后点击“确认设置”进行锁定。</Paragraph>
                <Form form={globalForm} layout="inline">
                    <Form.Item name="supplierId" label="供应商" rules={[{ required: true, message: '请选择一个供应商' }]}>
                        <Select
                            showSearch
                            style={{ width: 200 }}
                            placeholder="选择供应商"
                            disabled={!!globalSettings || suppliersLoading}
                            loading={suppliersLoading}
                            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                            options={managedSuppliers.map(s => ({ value: s.id, label: `${s.short_code} (${s.name})` }))}
                        />
                    </Form.Item>

                    <Form.Item name="category" label="问题类型" rules={[{ required: true }]} initialValues={{ createTime: dayjs() }}>
                        <Select style={{ width: 180 }} placeholder="选择问题类型" disabled={!!globalSettings} loading={categoriesLoading} onChange={(value) => {
                            if (dataSource.length > 0) {
                                messageApi.warning('切换类型将清空现有数据！');
                                setDataSource([]);
                            }
                        }}>
                            {sortedCategories.map(cat => <Option key={cat} value={cat}>{cat}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="createTime" label="创建时间" rules={[{ required: true }]}>
                        <DatePicker disabled={!!globalSettings} />
                    </Form.Item>
                    <Form.Item>
                        {globalSettings ? (
                            <Button icon={<EditOutlined />} onClick={onModifySettings}>修改设置</Button>
                        ) : (
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                onClick={onConfirmSettings}
                                disabled={suppliersLoading || categoriesLoading}
                                loading={suppliersLoading || categoriesLoading}
                            >
                                {suppliersLoading || categoriesLoading ? '加载中...' : '确认设置'}
                            </Button>
                        )}
                    </Form.Item>
                </Form>
            </Card>

            <Card>
                <Space style={{ marginBottom: 16 }}>
                    <Button onClick={handleAdd} type="primary" icon={<PlusOutlined />}>手动添加一行</Button>
                    <Upload accept=".xlsx" showUploadList={false} beforeUpload={handleExcelImport} disabled={!globalSettings}>
                        <Tooltip title={!globalSettings ? "请点击“确认设置”按钮！" : "只能上传 .xlsx 格式文件"}>
                            <Button icon={<FileExcelOutlined />}>从Excel导入</Button>
                        </Tooltip>
                    </Upload>
                    <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载模板</Button>
                </Space>
                <Table
                    components={{ body: { row: EditableRow, cell: EditableCell } }}
                    rowClassName={() => 'editable-row'}
                    bordered
                    dataSource={dataSource}
                    columns={columns}
                    pagination={false}
                    locale={{ emptyText: (<Empty description={globalSettings ? "请点击“手动添加一行”或从Excel导入" : "请先在上方确认全局设置"} />) }}
                />
            </Card>

            {/* --- 新增：API Key 设置区域 (批量版) --- */}
            <Collapse ghost style={{ marginTop: 16 }}>
                <Panel header={<><ApiOutlined /> AI 增强设置 (配置后可为每条数据生成智能检索向量)</>} key="1">
                    <Form.Item label={<><GoogleOutlined /> Google Gemini API Key</>} help="设置 Key 后，系统将在提交时自动为每一行数据生成问题向量。">
                        <Input.Password
                            placeholder="请输入您的 Gemini API Key"
                            value={apiKey}
                            onChange={handleApiKeyChange}
                        />
                    </Form.Item>
                    <Form.Item>
                        <Checkbox checked={rememberApiKey} onChange={handleRememberChange}>
                            在本地记住 API Key (下次无需输入)
                        </Checkbox>
                    </Form.Item>
                </Panel>
            </Collapse>

            <div style={{ marginTop: 24, textAlign: 'right' }}>
                <Button type="primary" size="large" onClick={handleSubmitAll} disabled={dataSource.length === 0}>
                    批量提交 {dataSource.length > 0 ? `(${dataSource.length}条)` : ''}
                </Button>
            </div>

            <Modal open={isPreviewVisible} title={previewTitle} footer={null} onCancel={() => setIsPreviewVisible(false)}>
                <Image width="100%" src={previewImage} />
            </Modal>
        </div>
    );
};

export default BatchNoticeCreationPage;