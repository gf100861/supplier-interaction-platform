import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { Table, Button, Form, Select, DatePicker, Typography, Card, Popconfirm, Input, Upload, Empty, Space, Tooltip, Image, InputNumber, Modal} from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, EditOutlined, UploadOutlined, FileExcelOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { useSuppliers } from '../contexts/SupplierContext';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { useNotification } from '../contexts/NotificationContext';
import { Buffer } from 'buffer';
import { useNotices } from '../contexts/NoticeContext';
import { useCategories } from '../contexts/CategoryContext'; // 1. 导入新的 Hook
window.Buffer = Buffer;

const { Title, Paragraph,Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload; // 2. 引入 Dragger 组件

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
    if (editable) {
        childNode = editing ? (
            <Form.Item style={{ margin: 0 }} name={dataIndex} rules={[{ required: dataIndex !== 'comments', message: `${title} is required.` }]}>
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
// --- 可编辑单元格组件结束 ---


// --- 列配置中心 ---
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
    // const { categories, loading: categoriesLoading } = useCategories();
    //  const { suppliers } = useSuppliers();
    const { categories, loading: categoriesLoading } = useCategories();

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
        // 如果文件没有 url (不是已上传文件)，也没有 preview (我们还没生成过预览)
        // 并且它是一个新上传的文件 (有 originFileObj)
        if (!file.url && !file.preview && file.originFileObj) {
            // 就为它生成一个高清的 Base64 预览图
            file.preview = await getBase64(file.originFileObj);
        }

        // 使用我们生成的高清 preview，或者已有的 url
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

        // 定义所有类型都共用的列
        const commonColumns = [
            // --- 3. 核心修改：重写“图片”列的渲染逻辑 ---
           { 
                title: '图片', 
                dataIndex: 'images', 
                width: 200, // 适当调整宽度
                render: (_, record) => (
                    <Dragger
                        multiple
                        listType="picture"
                        fileList={record.images || []}
                        beforeUpload={() => false}
                        onChange={(info) => handleUploadChange(record.key, 'images', info)}
                        accept="image/*"
                        onPreview={handlePreview}
                        // 移除固定的 height，让其自适应
                    >
                        <div style={{ padding: '8px 0' }}> {/* 使用 div 包裹并增加内边距 */}
                            <p className="ant-upload-drag-icon">
                                <InboxOutlined />
                            </p>
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
                            // --- multiple 属性也在这里启用 ---
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

            // 直接在 managedSuppliers (当前用户可见的供应商列表) 中查找
            const selectedSupplier = managedSuppliers.find(s => s.id === values.supplierId);

            setGlobalSettings({
                ...values,
                // 现在 selectedSupplier 一定能被找到
                supplierName: selectedSupplier.name,
            });
            messageApi.success('全局设置已锁定，现在可以添加条目了。');
        } catch (errorInfo) {
            // 这里的 catch 现在只会在表单未填写完整时触发
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

        const validDataSource = dataSource.filter(item =>
            (typeof item.title === 'string' && item.title.trim() !== '') ||
            (typeof item.description === 'string' && item.description.trim() !== '')
        );

        if (validDataSource.length === 0) {
            messageApi.error('请至少填写一条有效的整改项！');
            return;
        }

        messageApi.loading({ content: '正在处理并提交数据...', key: 'submitting' });

        // --- 核心修正 2：在提交前，异步处理所有行的数据，特别是图片 ---
        const processRowData = async (item) => {
            // 这个函数负责将单行数据中的新图片文件转换为高清Base64
            const processFiles = async (fileList = []) => {
                return Promise.all(fileList.map(async file => {
                    if (file.originFileObj && !file.url) { // 如果是新上传的文件
                        const base64Url = await getBase64(file.originFileObj);
                        // 返回一个只包含高清 url 的干净对象
                        return { uid: file.uid, name: file.name, status: 'done', url: base64Url };
                    }
                    return file; // 如果已经是处理过的文件，直接返回
                }));
            };

            const processedImages = await processFiles(item.images);
            const processedAttachments = await processFiles(item.attachments);

            return {
                ...item,
                images: processedImages,
                attachments: processedAttachments,
            };
        };

        // 等待所有行的数据都处理完毕
        const processedDataSource = await Promise.all(validDataSource.map(processRowData));

        const batchId = `BATCH-${dayjs().format('YYYYMMDDHHmmss')}-${Math.random().toString(36).substring(2, 8)}`;


        // 构建符合 Supabase Schema 的数据数组
        const batchNoticesToInsert = processedDataSource.map((item, index) => {
            const { key, images, attachments, ...details } = item;

            // 生成给用户看的业务ID
            const noticeCode = `N-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${index}`;

            console.log(details)

            return {
                // Supabase 会自动生成 uuid 主键，我们不需要提供 id, 根据不同的审核类型来修改
                notice_code: noticeCode,
                batch_id: batchId,
                category: globalSettings.category,
                title: details.title || details.parameter || 'New Notice',
                assigned_supplier_id: globalSettings.supplierId, // 假设 suppliers context 里的 id 是 uuid
                assigned_supplier_name: globalSettings.supplierName,
                status: '待供应商处理', // 使用简化的新流程状态
                creator_id: currentUser.id, // 假设 currentUser.id 是 uuid
                sd_notice: { // 将所有初始信息存入 jsonb 字段
                    creatorId: currentUser.id,
                    description: details.description || '',
                    creator: currentUser.name,
                    createTime: globalSettings.createTime.format('YYYY-MM-DD'),
                    images: images,
                    attachments: attachments,
                    details: details, // 存储所有动态字段
                },
                history: [],
            };
        });

        try {
            // 调用中央 context 的 addNotices 函数，它会与 Supabase 交互
            await addNotices(batchNoticesToInsert);
            messageApi.success(`成功提交 ${batchNoticesToInsert.length} 条通知单！`);

            // 成功后再清空前端
            setDataSource([]);
            setGlobalSettings(null);
            globalForm.resetFields();

        } catch (error) {
            messageApi.error(`提交失败: ${error.message}`);
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

        // 使用与UI完全相同的列配置来生成模板
        const baseColumns = categoryColumnConfig[category] || [];
        const excelColumns = [...baseColumns, { title: '备注 (Comments)' }, { title: '图片 (Images)' }].map(c => ({
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
                            disabled={!!globalSettings || suppliersLoading} // 加载时也禁用
                            loading={suppliersLoading} // 显示加载动画
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={managedSuppliers.map(s => ({
                                value: s.id,
                                label: `${s.short_code} (${s.name})`
                            }))}
                        />
                    </Form.Item>

                    <Form.Item name="category" label="问题类型" rules={[{ required: true }]}>
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
                        {/* 3. --- 核心修正：为确认按钮也添加 loading 状态 --- */}
                        {globalSettings ? (
                            <Button icon={<EditOutlined />} onClick={onModifySettings}>修改设置</Button>
                        ) : (
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                onClick={onConfirmSettings}
                                // 当任何一个依赖的数据在加载时，都禁用并显示加载状态
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