import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { Table, Button, Form, Select, DatePicker, Typography, Card, Popconfirm, Input, Upload, Empty, Space, Tooltip, Image, InputNumber, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, EditOutlined, UploadOutlined, FileExcelOutlined, DownloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useSuppliers } from '../contexts/SupplierContext';
import { noticeCategories } from '../data/_mockData';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { useNotification } from '../contexts/NotificationContext';
import { Buffer } from 'buffer';
import { useNotices } from '../contexts/NoticeContext';
window.Buffer = Buffer;

const { Title, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// --- 可编辑单元格组件 ---
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
    if (editable) {
        childNode = editing ? (
            <Form.Item style={{ margin: 0 }} name={dataIndex} rules={[{ required: dataIndex !== 'comments', message: `${title} is required.` }]}>
                {inputType === 'textarea' ? (
                    <TextArea ref={inputRef} onPressEnter={save} onBlur={save} autoSize />
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
// --- 可编辑单元格组件结束 ---


// --- 列配置中心 ---
const categoryColumnConfig = {
    '产品质量': [
        { title: '标题', dataIndex: 'title', editable: true, width: '20%' },
        { title: '缺陷描述', dataIndex: 'description', editable: true, width: '25%', onCell: () => ({ inputType: 'textarea' }) },
        { title: '缺陷等级', dataIndex: 'defectLevel', width: 150, render: (text, record, handleCellChange) => (
            <Select value={text} style={{ width: '100%' }} onChange={(value) => handleCellChange(record.key, 'defectLevel', value)}>
                <Option value="严重">严重</Option>
                <Option value="主要">主要</Option>
                <Option value="次要">次要</Option>
            </Select>
        )},
    ],
    '现场管理': [
        { title: '问题点', dataIndex: 'title', editable: true, width: '20%' },
        { title: '具体描述', dataIndex: 'description', editable: true, width: '25%', onCell: () => ({ inputType: 'textarea' }) },
        { title: '5S评分 (1-5)', dataIndex: 'score', width: 150, render: (text, record, handleCellChange) => (
            <InputNumber min={1} max={5} value={text} style={{ width: '100%' }} onChange={(value) => handleCellChange(record.key, 'score', value)} />
        )},
    ],
    '文档资质': [ { title: '标题', dataIndex: 'title', editable: true, width: '20%' }, { title: '描述', dataIndex: 'description', editable: true, width: '40%', onCell: () => ({ inputType: 'textarea' }) } ],
    '安全规范': [ { title: '标题', dataIndex: 'title', editable: true, width: '20%' }, { title: '描述', dataIndex: 'description', editable: true, width: '40%', onCell: () => ({ inputType: 'textarea' }) } ],
    '其他': [ { title: '标题', dataIndex: 'title', editable: true, width: '20%' }, { title: '描述', dataIndex: 'description', editable: true, width: '40%', onCell: () => ({ inputType: 'textarea' }) } ],
};


const BatchNoticeCreationPage = () => {
    const [globalForm] = Form.useForm();
    const { suppliers } = useSuppliers();
    const [dataSource, setDataSource] = useState([]);
    const [globalSettings, setGlobalSettings] = useState(null);
    const [count, setCount] = useState(0);
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const [previewImage, setPreviewImage] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const { messageApi } = useNotification();
     const { addNotices } = useNotices(); 

    const handleCellChange = (key, dataIndex, value) => {
        const newData = [...dataSource];
        const index = newData.findIndex((item) => key === item.key);
        if (index > -1) {
            const item = newData[index];
            newData.splice(index, 1, { ...item, [dataIndex]: value });
            setDataSource(newData);
        }
    };

    const handlePreview = (file) => {
        setPreviewImage(file.url || file.thumbUrl);
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

        // 定义所有类型都共用的列
        const commonColumns = [
            { title: '图片', dataIndex: 'images', width: 120, render: (_, record) => ( <Upload listType="picture-card" fileList={record.images || []} beforeUpload={() => false} onChange={(info) => handleUploadChange(record.key, 'images', info)} accept="image/*" onPreview={handlePreview}>{(record.images || []).length >= 1 ? null : <div><PlusOutlined /></div>}</Upload> )},
            { title: '附件', dataIndex: 'attachments', width: 120, render: (_, record) => ( <Upload fileList={record.attachments || []} beforeUpload={() => false} onChange={(info) => handleUploadChange(record.key, 'attachments', info)}><Button icon={<UploadOutlined />}>上传</Button></Upload> ) },
            { title: '备注 (Comments)', dataIndex: 'comments', editable: true, onCell: () => ({ inputType: 'textarea' }) },
            { title: '操作', dataIndex: 'operation', width: 80, render: (_, record) => ( <Popconfirm title="确定删除吗?" onConfirm={() => handleDelete(record.key)}><Button type="link" danger icon={<DeleteOutlined />} /></Popconfirm> )},
        ];

        // 组合动态列和通用列
        const allColumns = [...baseColumns, ...commonColumns];

        // 返回最终用于 antd Table 的列定义
        return allColumns.map(col => {
            if (!col.editable) return col;
            return {
                ...col,
                onCell: (record) => ({ record, editable: col.editable, dataIndex: col.dataIndex, title: col.title, handleSave, inputType: col.onCell?.()?.inputType }),
            };
        });
    }, [globalSettings, handleSave]); // handleSave 需要作为依赖项


    const handleAdd = () => {
        if (!globalSettings) { messageApi.error('请先确认顶部的全局设置！'); return; }
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
            const selectedSupplier = suppliers.find(s => s.id === values.supplierId);
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
            messageApi.error('请先确认顶部的全局设置！');
            return;
        }

        const validDataSource = dataSource.filter(item =>
            (typeof item.title === 'string' && item.title.trim() !== '') ||
            (typeof item.description === 'string' && item.description.trim() !== '')
        );

        if (validDataSource.length === 0) {
            messageApi.error('请至少填写一条有效的整改项！空的或未填写的记录不会被提交。');
            return;
        }

        const batchId = `BATCH-${dayjs().format('YYYYMMDDHHmmss')}-${Math.random().toString(36).substring(2, 8)}`;
        
        const batchNotices = validDataSource.map(item => {
            const { key, images, attachments, ...details } = item;
            const noticeId = `N-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            return {
                id: noticeId,
                batchId: batchId,
                category: globalSettings.category,
                title: details.title,
                assignedSupplierId: globalSettings.supplierId,
                assignedSupplierName: globalSettings.supplierName,
                status: '待供应商提交行动计划',
                sdNotice: {
                    creatorId: currentUser.id,
                    description: details.description || '',
                    creator: currentUser.name,
                    createTime: globalSettings.createTime.format('YYYY-MM-DD'),
                    images: images,
                    attachments: attachments,
                    details: details,
                },
                history: [],
            };
        });
        
        console.log("--- 准备批量提交到后端的通知单数据 (已过滤空行) ---");
        console.log(JSON.stringify(batchNotices, null, 2));

        // --- 核心修改：调用中央 context 的 addNotices 函数 ---
        await addNotices(batchNotices);

        // 只保留这一句成功提示，确保在异步操作成功后才显示
        messageApi.success(`成功提交 ${batchNotices.length} 条通知单！`);

        setDataSource([]);
        setGlobalSettings(null);
        globalForm.resetFields();
    };
    const handleDownloadTemplate = async () => {
        const category = globalForm.getFieldValue('category');
        if (!category) {
            messageApi.error('请先选择问题类型，再下载对应的模板！');
            return;
        }
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('模板');
        
        // 使用与UI完全相同的列配置来生成模板
        const baseColumns = categoryColumnConfig[category] || [];
        const excelColumns = [...baseColumns, { title: '备注 (Comments)'}, { title: '图片 (Images)'}].map(c => ({
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

            // --- 核心修正：让期望的表头与下载模板的表头完全一致 ---
            const baseColumns = categoryColumnConfig[globalSettings.category] || [];
            const expectedHeaders = [
                ...baseColumns.map(col => col.title), 
                '备注 (Comments)', 
                '图片 (Images)' // <--- 把“图片”这一列加回到验证逻辑中
            ];
            const actualHeadersRaw = (worksheet.getRow(1).values || []);
            // exceljs 的 .values 会包含一个空项在前面，并且可能比实际列数长
            const actualHeaders = actualHeadersRaw.slice(1, expectedHeaders.length + 1);

            if (JSON.stringify(expectedHeaders) !== JSON.stringify(actualHeaders)) {
                 messageApi.error({ 
                    content: `Excel模板表头不匹配！当前需要“${globalSettings.category}”类型的模板。请下载最新模板。`, 
                    key: 'excelParse', 
                    duration: 5 
                });
                 console.log("期望的表头:", expectedHeaders);
                 console.log("实际的表头:", actualHeaders);
                 return false;
            }

            // --- 图片解析逻辑 (保持不变) ---
            const imageMap = new Map();
            worksheet.getImages().forEach(image => {
                const startRow = image.range.tl.nativeRow;
                const img = workbook.getImage(image.imageId);
                if (!img || !img.buffer) { 
                    console.warn(`无法读取第 ${startRow + 1} 行的图片数据。`);
                    return; 
                }
                const imageBase64 = `data:image/${img.extension || 'png'};base64,${Buffer.from(img.buffer).toString('base64')}`;
                if (!imageMap.has(startRow)) { imageMap.set(startRow, []); }
                imageMap.get(startRow).push({ uid: `-${Math.random()}`, name: `image_${startRow}.${img.extension || 'png'}`, status: 'done', url: imageBase64 });
            });

            // --- 数据解析逻辑 (保持不变) ---
            const importedData = [];
            let currentDataIndex = count;
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber === 1) return;

                const newRowData = {
                    key: currentDataIndex,
                    images: imageMap.get(rowNumber - 1) || [],
                    attachments: [],
                };
                
                // 根据动态列配置来读取数据
                baseColumns.forEach((col, index) => {
                    newRowData[col.dataIndex] = row.values[index + 1] || '';
                });
                // 单独读取备注列
                newRowData['comments'] = row.values[baseColumns.length + 1] || '';

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
                    <Form.Item name="supplierId" label="供应商" rules={[{ required: true }]}>
                        <Select style={{ width: 200 }} placeholder="选择供应商" disabled={!!globalSettings}>
                            {suppliers.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="category" label="问题类型" rules={[{ required: true }]}>
                        <Select style={{ width: 180 }} placeholder="选择问题类型" disabled={!!globalSettings} onChange={(value) => {
                            if (dataSource.length > 0) {
                                messageApi.warning('切换类型将清空现有数据！');
                                setDataSource([]);
                            }
                        }}>
                           {noticeCategories.map(cat => <Option key={cat} value={cat}>{cat}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="createTime" label="创建时间" rules={[{ required: true }]}>
                        <DatePicker disabled={!!globalSettings} />
                    </Form.Item>
                    <Form.Item>
                        {globalSettings ? ( <Button icon={<EditOutlined />} onClick={onModifySettings}>修改设置</Button> ) 
                        : ( <Button type="primary" icon={<CheckCircleOutlined />} onClick={onConfirmSettings}>确认设置</Button> )}
                    </Form.Item>
                </Form>
            </Card>

            <Card>
                <Space style={{ marginBottom: 16 }}>
                    <Button onClick={handleAdd} type="primary" icon={<PlusOutlined />}>手动添加一行</Button>
                    <Upload accept=".xlsx" showUploadList={false} beforeUpload={handleExcelImport} disabled={!globalSettings}>
                        <Tooltip title={!globalSettings ? "请先确认顶部的全局设置" : "只能上传 .xlsx 格式文件"}>
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
                    locale={{ emptyText: ( <Empty description={globalSettings ? "请点击“手动添加一行”或从Excel导入" : "请先在上方确认全局设置"}/> )}}
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