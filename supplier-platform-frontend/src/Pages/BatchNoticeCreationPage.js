import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { Table, Button, Form, Select, DatePicker, Typography, Card, Popconfirm, Input, Upload, Empty, Space, Tooltip, Image, InputNumber, Modal, Row, Col, Switch, Alert, Progress } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, EditOutlined, UploadOutlined, FileExcelOutlined, DownloadOutlined, InboxOutlined, ThunderboltOutlined, CaretRightOutlined } from '@ant-design/icons';
import { useSuppliers } from '../contexts/SupplierContext';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { useNotification } from '../contexts/NotificationContext';
import { Buffer } from 'buffer';
import { useNotices } from '../contexts/NoticeContext';
import { useCategories } from '../contexts/CategoryContext';
import { supabase } from '../supabaseClient'; // ✅ 真实引入 supabase

window.Buffer = Buffer;

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;

// 🔧 环境配置
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001' 
    : window.location.origin; // 必须是这句！

const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_COMPRESSION_QUALITY = 0.72;
const MAX_FILE_UPLOAD_CONCURRENCY = 2;
const MAX_ROW_PROCESS_CONCURRENCY = 2;
const NOTICE_INSERT_CHUNK_SIZE = 5;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryAsync = async (task, retries = 2, delayMs = 800) => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await task();
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                await sleep(delayMs * (attempt + 1));
            }
        }
    }
    throw lastError;
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
    const results = new Array(items.length);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    });

    await Promise.all(workers);
    return results;
};

const chunkArray = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

// --- 日志系统工具函数 (复用逻辑) ---
const getSessionId = () => {
    let sid = sessionStorage.getItem('app_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        sessionStorage.setItem('app_session_id', sid);
    }
    return sid;
};

let cachedIpAddress = null;
const getClientIp = async () => {
    if (cachedIpAddress) return cachedIpAddress;
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        cachedIpAddress = data.ip;
        return data.ip;
    } catch (error) {
        return 'unknown';
    }
};

const logSystemEvent = async (params) => {
    const { category = 'SYSTEM', eventType, severity = 'INFO', message, userId = null, meta = {} } = params;
    try {
        const targetUrl = `${BACKEND_URL}/api/system-log`;
        const clientIp = await getClientIp();
        const sessionId = getSessionId();
        await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category,
                event_type: eventType,
                severity,
                message,
                user_id: userId,
                metadata: {
                    ip_address: clientIp,
                    session_id: sessionId,
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    page: 'BatchNoticeCreationPage',
                    ...meta,
                    timestamp_client: new Date().toISOString()
                }
            })
        });
    } catch (e) {
        console.error("Logger exception:", e);
    }
};

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

// 仅用于本地预览的 Base64 转换
const getBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });

// 🌟 核心：专门负责把文件传到 Supabase 并返回链接的函数
const getImageMimeType = (file, fallback = 'image/jpeg') => {
    const type = file?.type || '';
    if (type.startsWith('image/') && !['image/gif', 'image/svg+xml'].includes(type)) {
        return type === 'image/png' ? 'image/jpeg' : type;
    }
    return fallback;
};

const compressImageFile = async (file, originalName = 'image.jpg') => {
    const fileType = file?.type || '';
    if (!fileType.startsWith('image/') || ['image/gif', 'image/svg+xml'].includes(fileType)) {
        return file;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = objectUrl;
        });

        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, width, height);

        const mimeType = getImageMimeType(file);
        const compressedBlob = await new Promise((resolve) => {
            canvas.toBlob(resolve, mimeType, IMAGE_COMPRESSION_QUALITY);
        });

        if (!compressedBlob || compressedBlob.size >= file.size) {
            return file;
        }

        const outputName = mimeType === 'image/jpeg' && !/\.jpe?g$/i.test(originalName)
            ? (originalName.includes('.') ? originalName.replace(/\.[^.]+$/, '.jpg') : `${originalName}.jpg`)
            : originalName;

        return new File([compressedBlob], outputName, {
            type: mimeType,
            lastModified: Date.now(),
        });
    } catch (error) {
        console.warn('Image compression skipped:', error);
        return file;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

const uploadFileToSupabase = async (file, originalName) => {
    try {
        const fileExt = originalName ? originalName.split('.').pop() : 'png';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        // 1. 上传文件到 attachments 存储桶
        await retryAsync(async () => {
            const { error } = await supabase.storage
                .from('attachments')
                .upload(filePath, file, {
                    contentType: file?.type || undefined,
                    cacheControl: '3600',
                });

            if (error) throw error;
        });

        // 2. 获取公开链接
        const { data: publicUrlData } = supabase.storage
            .from('attachments')
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
    } catch (error) {
        console.error('上传 Supabase 失败:', error);
        throw error;
    }
};

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

    useEffect(() => {
        if (currentUser) {
            logSystemEvent({
                category: 'INTERACTION',
                eventType: 'PAGE_VIEW',
                message: 'User visited Batch Notice Creation Page',
                userId: currentUser.id
            });
        }
    }, [currentUser]);

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
                return value !== null && value !== undefined && String(value).trim() !== '';
            });
            return isValid;
        });

        if (validDataSource.length === 0) {
            messageApi.error('请至少填写一条有效的整改项！（例如: 标题、描述等关键字段不能为空）');
            return;
        }

        messageApi.loading({ content: '正在处理数据，上传文件并生成 AI 向量...', key: 'submitting', duration: 0 });
        const batchId = `BATCH-${dayjs().format('YYYYMMDDHHmmss')}-${Math.random().toString(36).substring(2, 8)}`;

        const processRowDataAndEmbed = async (item, index) => {
            try {
                // 🌟 核心升级：图片转存至 Supabase (支持手工与Excel导入)
                const processFiles = async (fileList = []) => {
                    return mapWithConcurrency(fileList, MAX_FILE_UPLOAD_CONCURRENCY, async file => {
                        try {
                            // 1. 如果是手动添加的图片/附件 (存在 originFileObj)
                            if (file.originFileObj && !file.url) {
                                const uploadFile = await compressImageFile(file.originFileObj, file.name);
                                const uploadName = uploadFile.name || file.name;
                                const publicUrl = await uploadFileToSupabase(uploadFile, uploadName);
                                return {
                                    uid: file.uid,
                                    name: uploadName,
                                    status: 'done',
                                    url: publicUrl,
                                    size: uploadFile.size,
                                    type: uploadFile.type || file.type,
                                };
                            }
                            // 2. 如果是从 Excel 导入的 Base64 格式图片 (避免导致 413 Payload Too Large)
                            if (file.url && file.url.startsWith('data:image')) {
                                const response = await fetch(file.url);
                                const blob = await response.blob();
                                const fileName = file.name || 'excel_image.png';
                                const uploadFile = await compressImageFile(blob, fileName);
                                const uploadName = uploadFile.name || fileName;
                                const publicUrl = await uploadFileToSupabase(uploadFile, uploadName);
                                return {
                                    uid: file.uid,
                                    name: uploadName,
                                    status: 'done',
                                    url: publicUrl,
                                    size: uploadFile.size,
                                    type: uploadFile.type || blob.type,
                                };
                            }
                            // 3. 已经是正常的网络 URL，直接返回
                            return file;
                        } catch (err) {
                            console.error(`处理文件 ${file.name} 失败:`, err);
                            throw err; 
                        }
                    });
                };

                const processedImages = await processFiles(item.images);
                const processedAttachments = await processFiles(item.attachments);

                const { key: _k, images: _i, attachments: _a, ...details } = item;

                const noticeCode = `N-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${index}`;

                return {
                    notice_code: noticeCode,
                    batch_id: batchId,
                    category: globalSettings.category,
                    title: details.title || details.parameter || details.criteria || 'New Notice',
                    assigned_supplier_id: globalSettings.supplierId,
                    assigned_supplier_name: globalSettings.supplierName,
                    status: '待提交Action Plan',
                    creator_id: currentUser.id,
                    embedding: null,
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
            } catch (error) {
                console.error(`Error processing row ${index}:`, error);
                throw error; 
            }
        };

        try {
            let processedRows = 0;
            const batchNoticesToInsert = await mapWithConcurrency(
                validDataSource,
                MAX_ROW_PROCESS_CONCURRENCY,
                async (item, index) => {
                    const notice = await processRowDataAndEmbed(item, index);
                    processedRows += 1;
                    messageApi.loading({
                        content: `正在处理数据：${processedRows}/${validDataSource.length} 行已完成...`,
                        key: 'submitting',
                        duration: 0
                    });
                    return notice;
                }
            );

            const insertChunks = chunkArray(batchNoticesToInsert, NOTICE_INSERT_CHUNK_SIZE);
            for (let i = 0; i < insertChunks.length; i++) {
                messageApi.loading({
                    content: `正在提交通知单：第 ${i + 1}/${insertChunks.length} 批...`,
                    key: 'submitting',
                    duration: 0
                });
                await addNotices(insertChunks[i]);
            }
            messageApi.success({ content: `成功提交 ${batchNoticesToInsert.length} 条通知单！`, key: 'submitting', duration: 3 });

            logSystemEvent({
                category: 'DATA',
                eventType: 'BATCH_CREATE_SUCCESS',
                severity: 'INFO',
                message: `Successfully created ${batchNoticesToInsert.length} notices`,
                userId: currentUser.id,
                meta: { batch_id: batchId, count: batchNoticesToInsert.length }
            });

            setDataSource([]);
            setGlobalSettings(null);
            globalForm.resetFields();

        } catch (error) {
            console.error(error);
            messageApi.error({ content: `提交失败: ${error.message}`, key: 'submitting', duration: 3 });

            logSystemEvent({
                category: 'DATA',
                eventType: 'BATCH_CREATE_FAILED',
                severity: 'ERROR',
                message: `Batch create failed: ${error.message}`,
                userId: currentUser.id,
                meta: { batch_id: batchId, error: error.message }
            });
        }
    };

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

            if (JSON.stringify(expectedHeaders) !== JSON.stringify(actualHeaders)) {
                messageApi.error({ content: `Excel模板表头不匹配！当前需要“${globalSettings.category}”类型的模板。`, key: 'excelParse', duration: 5 });
                logSystemEvent({
                    category: 'DATA',
                    eventType: 'EXCEL_IMPORT_ERROR',
                    severity: 'WARN',
                    message: 'Excel template headers mismatch',
                    userId: currentUser?.id,
                    meta: { expected: expectedHeaders, actual: actualHeaders }
                });
                return false;
            }

            const imageMap = new Map();
            worksheet.getImages().forEach(image => {
                const startRow = image.range.tl.nativeRow;
                const img = workbook.getImage(image.imageId);
                if (!img || !img.buffer) return;
                // Excel 解析出的图片也是 Base64 格式
                const imageBase64 = `data:image/${img.extension || 'png'};base64,${Buffer.from(img.buffer).toString('base64')}`;
                if (!imageMap.has(startRow)) { imageMap.set(startRow, []); }
                imageMap.get(startRow).push({ uid: `-${Math.random()}`, name: `excel_image_${startRow}.${img.extension || 'png'}`, status: 'done', url: imageBase64 });
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

            logSystemEvent({
                category: 'DATA',
                eventType: 'EXCEL_IMPORT_SUCCESS',
                severity: 'INFO',
                message: `Successfully imported ${importedData.length} rows from Excel`,
                userId: currentUser?.id,
                meta: { count: importedData.length }
            });

        } catch (error) {
            console.error("Excel 解析失败:", error);
            messageApi.error({ content: `文件解析失败: ${error.message}`, key: 'excelParse', duration: 4 });

            logSystemEvent({
                category: 'DATA',
                eventType: 'EXCEL_PARSE_EXCEPTION',
                severity: 'ERROR',
                message: error.message,
                userId: currentUser?.id,
                meta: { error_stack: error.stack }
            });
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
