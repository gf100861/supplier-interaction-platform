import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Typography, Upload, Button, notification, message, Spin, Space, Modal, Alert, List, Popconfirm, Avatar, DatePicker, Input } from 'antd';
import { ShareAltOutlined, UploadOutlined, InboxOutlined, DownloadOutlined, QrcodeOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons'; // 2. 导入新图标
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs'; // 3. 导入 dayjs 用于格式化日期

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;
const { RangePicker } = DatePicker; // 2. 解构 RangePicker
const { Search } = Input; // 3. 解构 Search

// 4. 提取 QR 码加载器 (保持不变)
const loadQrCodeScript = () => {
    return new Promise((resolve, reject) => {
        const existingScript = document.getElementById('qrious-script');
        if (existingScript) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.id = 'qrious-script';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load QR code script'));
        document.body.appendChild(script);
    });
};


// --- 组件 A: 文件发送器 (现在也包含接收器逻辑) ---
export const FileSender = () => {
    const [fileList, setFileList] = useState([]);
    const [loading, setLoading] = useState(false);
    const { messageApi, notificationApi } = useNotification(); // 5. 获取 notificationApi
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const [isQrModalVisible, setIsQrModalVisible] = useState(false);
    const qrCodeRef = useRef(null);

    // --- 6. 新增 State 用于显示已同步的文件列表 ---
    const [syncedFiles, setSyncedFiles] = useState([]);
    const [filesLoading, setFilesLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');

    const [dateRange, setDateRange] = useState(null);

    // --- 7. (来自 FileReceiver) 下载文件的函数 ---
    // (注意：此版本 *不会* 在下载后删除记录)
    const handleDownload = async (fileRow) => {
        const key = `download-${fileRow.id}`;
        message.loading({ content: `正在准备下载 ${fileRow.file_name}...`, key });
        try {
            const { data, error } = await supabase.storage
                .from('file_sync')
                .download(fileRow.file_path); // 使用安全路径下载
            
            if (error) throw error;
            
            saveAs(data, fileRow.file_name); // 使用原始文件名保存
            message.success({ content: '下载已开始！', key });

            // (可选) 我们不再自动删除它
            // await supabase.from('user_files').delete().eq('id', fileRow.id);

        } catch (error) {
            console.error('下载失败:', error);
            message.error({ content: `下载失败: ${error.message}`, key });
        }
    };

    // --- 8. 新增：删除文件的函数 ---
    const handleDelete = async (fileRow) => {
         const key = `delete-${fileRow.id}`;
         message.loading({ content: `正在删除 ${fileRow.file_name}...`, key });
        try {
            // 1. 从 Storage 删除
            const { error: storageError } = await supabase.storage
                .from('file_sync')
                .remove([fileRow.file_path]);

            if (storageError) {
                 // 即便存储删除失败，也继续尝试删除数据库记录
                 console.error("Storage deletion failed:", storageError.message);
                 // throw storageError; // 我们可以选择不在这里抛出，而是继续
            }

            // 2. 从数据库删除
            const { error: dbError } = await supabase
                .from('user_files')
                .delete()
                .eq('id', fileRow.id);

            if (dbError) throw dbError;

            message.success({ content: '文件已删除！', key });
            // (UI 将通过 Realtime 自动更新, 无需手动 setSyncedFiles)

        } catch (error) {
             console.error('删除失败:', error);
             message.error({ content: `删除失败: ${error.message}`, key });
        }
    };


    // --- 9. useEffect Hook，用于在弹窗打开时生成 QR 码 ---
   useEffect(() => {
        if (isQrModalVisible && qrCodeRef.current && currentUser?.id) { // 确保拿到 currentUser.id
            loadQrCodeScript().then(() => {
                if (window.QRious) {
                    // 构建移动端专属链接
                    // 例如: https://your-domain.com/mobile-transfer?uid=user_123
                    const mobileUrl = `${window.location.origin}/mobile-transfer?uid=${currentUser.id}`;

                    new window.QRious({
                        element: qrCodeRef.current,
                        value: mobileUrl, // 使用新链接
                        size: 256,
                        level: 'H'
                    });
                }
            }).catch(err => {
                console.error(err);
                messageApi.error("无法加载二维码生成器，请刷新页面重试。");
            });
        }
    }, [isQrModalVisible, messageApi, currentUser]); // 添加 currentUser 依赖

    // --- 10. useEffect Hook，用于加载初始文件 + 监听实时变化 ---
    useEffect(() => {
        if (!currentUser?.id) {
            setFilesLoading(false);
            return; // 未登录
        }

        // 10a. 加载初始文件列表
        const fetchFiles = async () => {
            setFilesLoading(true);
            try {
                const { data, error } = await supabase
                    .from('user_files')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .order('created_at', { ascending: false }); // 最新在最前
                
                if (error) throw error;
                setSyncedFiles(data || []);
            } catch (error) {
                console.error("加载已同步文件失败:", error);
                messageApi.error(`加载文件列表失败: ${error.message}`);
            } finally {
                setFilesLoading(false);
            }
        };

        fetchFiles();

        // 10b. 设置 Realtime 订阅 (合并 FileReceiver 的逻辑)
        const channel = supabase
            .channel(`user_files_page:${currentUser.id}`) // 使用唯一的频道名称
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'user_files',
                    filter: `user_id=eq.${currentUser.id}`
                },
                (payload) => {
                    console.log('Realtime 收到新文件:', payload);
                    // 将新文件添加到列表顶部
                    setSyncedFiles(prevFiles => [payload.new, ...prevFiles]);
                    
                    // 弹出通知 (与 MainLayout 中的 FileReceiver 功能相同)
                    notificationApi.info({
                        message: '收到一个新文件',
                        description: `文件 "${payload.new.file_name}" 已同步。`,
                        placement: 'topRight',
                        icon: <DownloadOutlined style={{ color: '#1890ff' }} />,
                        key: payload.new.id
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'user_files',
                    filter: `user_id=eq.${currentUser.id}`
                },
                (payload) => {
                    console.log('Realtime 收到删除:', payload);
                    // 从列表中移除
                    setSyncedFiles(prevFiles => prevFiles.filter(file => file.id !== payload.old.id));
                }
            )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') {
                    console.log('已连接文件同步页面通道。');
                 }
                 if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('文件同步页面通道连接失败: ', err);
                 }
            });

        // 清理订阅
        return () => {
            supabase.removeChannel(channel);
        };
    
    }, [currentUser, notificationApi, messageApi]); // 依赖项


    const handleFileChange = ({ fileList }) => {
        setFileList(fileList);
    };

    const handleUploadAndSync = async () => {
        // ... (此函数保持不变) ...
        if (fileList.length === 0) {
            messageApi.warning('请先选择要同步的文件！');
            return;
        }
        if (!currentUser?.id) {
            messageApi.error('无法同步：用户未登录。');
            return;
        }

        setLoading(true);
        messageApi.loading({ content: '正在同步文件...', key: 'syncing', duration: 0 });

        const uploadPromises = fileList.map(async (fileInfo) => {
            const file = fileInfo.originFileObj;
            if (!file) {
                throw new Error(`无法获取文件 ${fileInfo.name}`);
            }
            
            const fileExt = file.name.split('.').pop();
            const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${fileExt ? '.' + fileExt : ''}`;
            const filePath = `${currentUser.id}/${safeFileName}`;

            const { error: uploadError } = await supabase.storage
                .from('file_sync')
                .upload(filePath, file);

            if (uploadError) {
                throw new Error(`上传 ${file.name} 失败: ${uploadError.message}`);
            }

            const { error: insertError } = await supabase
                .from('user_files')
                .insert({
                    user_id: currentUser.id,
                    file_name: file.name,
                    file_path: filePath,
                    source_device: 'web' // 假设这是从网页端发送的
                });
            
            if (insertError) {
                 await supabase.storage.from('file_sync').remove([filePath]);
                 throw new Error(`上传 ${file.name} 成功，但同步记录失败: ${insertError.message}`);
            }

            return file.name;
        });

        try {
            const uploadedFiles = await Promise.all(uploadPromises);
            messageApi.success({ 
                content: `成功同步 ${uploadedFiles.length} 个文件！`, 
                key: 'syncing', 
                duration: 3 
            });
            setFileList([]);
        } catch (error) {
            messageApi.error({ 
                content: error.message, 
                key: 'syncing', 
                duration: 5 
            });
        } finally {
            setLoading(false);
        }
    };

    const filteredFiles = useMemo(() => {
        return syncedFiles.filter(file => {
            // 搜索过滤
            const matchesSearch = file.file_name.toLowerCase().includes(searchTerm.toLowerCase());

            // 日期过滤
            let matchesDate = true;
            if (dateRange && dateRange[0] && dateRange[1]) {
                const fileDate = dayjs(file.created_at);
                // 使用 startOf 和 endOf 确保涵盖所选日期的全天
                matchesDate = fileDate.isAfter(dateRange[0].startOf('day')) && 
                              fileDate.isBefore(dateRange[1].endOf('day'));
            }

            return matchesSearch && matchesDate;
        });
    }, [syncedFiles, searchTerm, dateRange]);

    return (
        <div style={{ maxWidth: 800, margin: 'auto', padding: '24px 0' }}>
            <Card>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={4}>跨设备文件同步</Title>
                    <Paragraph type="secondary">
                        上传文件到您的私有云端。文件将实时推送到您已登录的其他设备（如电脑或手机）。
                    </Paragraph>
                     <Alert
                      message="如何从手机上传？"
                      description="点击下方的“从手机上传”按钮，用您的手机扫描弹出的二维码。在手机浏览器中登录同一个账户，即可上传文件并同步回电脑。"
                      type="info"
                      showIcon
                      style={{ marginBottom: 24, textAlign: 'left' }}
                    />
                </div>
                
                <Dragger
                    fileList={fileList}
                    onChange={handleFileChange}
                    beforeUpload={() => false}
                    multiple={true}
                >
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    <p className="ant-upload-text">点击或拖拽文件到此区域</p>
                    <p className="ant-upload-hint">支持单个或多个文件。文件将被安全存储并同步到您的账户。</p>
                </Dragger>

                <Space style={{ width: '100%', marginTop: 24 }} direction="vertical" size="middle">
                    <Button
                        type="primary"
                        icon={<ShareAltOutlined />}
                        size="large"
                        loading={loading}
                        disabled={fileList.length === 0}
                        onClick={handleUploadAndSync}
                        style={{ width: '100%' }}
                    >
                        {loading ? '正在同步...' : '上传并同步'}
                    </Button>
                    
                    <Button
                        icon={<QrcodeOutlined />}
                        size="large"
                        onClick={() => setIsQrModalVisible(true)}
                        style={{ width: '100%' }}
                    >
                        从手机上传文件
                    </Button>
                </Space>
            </Card>

            {/* --- 11. 新增：显示已同步文件的卡片 --- */}
           <Card 
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>已同步的文件 ({filteredFiles.length})</span>
                        {/* 筛选控件 */}
                        <Space size="small" style={{ fontWeight: 'normal' }}>
                            <Search
                                placeholder="搜索文件名"
                                allowClear
                                onSearch={setSearchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: 200 }}
                            />
                            <RangePicker 
                                onChange={setDateRange} 
                                style={{ width: 240 }}
                                placeholder={['开始日期', '结束日期']}
                            />
                        </Space>
                    </div>
                } 
                style={{ marginTop: 24 }}
            >
                <List
                    loading={filesLoading}
                    dataSource={filteredFiles} // 使用过滤后的数据
                    pagination={{ pageSize: 5 }} // 添加分页
                    renderItem={(file) => (
                        <List.Item
                            actions={[
                                <Button type="link" icon={<DownloadOutlined />} onClick={() => handleDownload(file)}>下载</Button>,
                                <Popconfirm title="确定删除此文件吗？" description="文件将从云端永久删除。" onConfirm={() => handleDelete(file)} okText="删除" cancelText="取消">
                                    <Button danger type="link" icon={<DeleteOutlined />} />
                                </Popconfirm>
                            ]}
                        >
                            <List.Item.Meta
                                avatar={<Avatar icon={<FileTextOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                                title={<Text strong>{file.file_name}</Text>}
                                description={`同步于: ${dayjs(file.created_at).format('YYYY-MM-DD HH:mm')}`}
                            />
                        </List.Item>
                    )}
                    locale={{ emptyText: "没有找到符合条件的文件。" }}
                />
            </Card>


            {/* QR 码弹窗 */}
            <Modal 
                title="从手机上传" 
                open={isQrModalVisible} 
                onCancel={() => setIsQrModalVisible(false)} 
                footer={null}
            >
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Paragraph>1. 请使用您手机的浏览器或微信扫描下方二维码。</Paragraph>
                    <canvas ref={qrCodeRef} style={{ border: '1px solid #f0f0f0', borderRadius: '8px' }}></canvas>
                    <Paragraph style={{ marginTop: '16px' }}>2. 在手机浏览器中**登录您的账户**。</Paragraph>
                    <Paragraph type="secondary">3. 登录后，您将看到相同的上传界面，上传的文件将实时同步到这里。</Paragraph>
                </div>
            </Modal>
        </div>
    );
};

// --- 组件 B: 文件接收器 ---
// (此组件现在仅用于 MainLayout.js)
export const FileReceiver = () => {
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const { notificationApi } = useNotification();

    useEffect(() => {
        if (!currentUser?.id) {
            return;
        }

        const handleDownload = async (fileRow) => {
            const key = `download-${fileRow.id}`;
            message.loading({ content: `正在准备下载 ${fileRow.file_name}...`, key });
            try {
                const { data, error } = await supabase.storage
                    .from('file_sync')
                    .download(fileRow.file_path); 
                
                if (error) throw error;
                
                saveAs(data, fileRow.file_name);
                message.success({ content: '下载已开始！', key });

                // --- ✨ 推荐修改：在通知处下载 *不* 应该删除文件 ---
                // await supabase.from('user_files').delete().eq('id', fileRow.id);

            } catch (error) {
                console.error('下载失败:', error);
                message.error({ content: `下载失败: ${error.message}`, key });
            }
        };

        const channel = supabase
            .channel(`user_files:${currentUser.id}`) // 注意：这个 Channel 名称应与 Page 上的不同
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'user_files',
                    filter: `user_id=eq.${currentUser.id}`
                },
                (payload) => {
                    console.log('收到新文件通知 (Layout):', payload);
                    const newFile = payload.new;
                    
                    // 仅当来源不是 'web' 时才通知 (避免自己通知自己)
                    // (如果您希望所有设备都收到通知，可以移除此 if 判断)
                    if (newFile.source_device !== 'web') {
                        notificationApi.info({
                            message: '收到一个新文件',
                            description: `文件 "${newFile.file_name}" 已从您的另一台设备同步。`,
                            placement: 'topRight',
                            duration: 10,
                            icon: <DownloadOutlined style={{ color: '#1890ff' }} />,
                            btn: (
                                <Button type="primary" size="small" onClick={() => handleDownload(newFile)}>
                                    立即下载
                                </Button>
                            ),
                            key: newFile.id
                        });
                    }
                }
            )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') {
                    console.log('已连接实时文件同步通道 (Layout)。');
                 }
                 if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('文件同步通道连接失败 (Layout): ', err);
                 }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    
    }, [currentUser, notificationApi]);

    return null; 
};