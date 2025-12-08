import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Typography, Upload, Button, notification, message, Spin, Space, Modal, Alert, List, Popconfirm, Avatar, DatePicker, Input } from 'antd';
import { ShareAltOutlined, UploadOutlined, InboxOutlined, DownloadOutlined, QrcodeOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;
const { RangePicker } = DatePicker;
const { Search } = Input;

// --- 日志系统工具函数 (复用自 LoginPage.js) ---

// 1. Session ID 管理
const getSessionId = () => {
    let sid = sessionStorage.getItem('app_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        sessionStorage.setItem('app_session_id', sid);
    }
    return sid;
};

// 2. IP 获取与缓存
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

// 3. 通用日志上报函数
const logSystemEvent = async (params) => {
    const { 
        category = 'SYSTEM', 
        eventType, 
        severity = 'INFO', 
        message, 
        email = null, 
        userId = null, 
        meta = {} 
    } = params;

    try {
        const clientIp = await getClientIp();
        const sessionId = getSessionId();

        const environmentInfo = {
            ip_address: clientIp,
            session_id: sessionId,
            userAgent: navigator.userAgent,
            url: window.location.href,
            page: 'OfflineSharePage' // 标记来源页面
        };

        // Fire-and-forget
        supabase.from('system_logs').insert([{
            category,
            event_type: eventType,
            severity,
            message,
            user_email: email, // 如果有 email 可以传入
            user_id: userId,
            metadata: {
                ...environmentInfo,
                ...meta,
                timestamp_client: new Date().toISOString()
            }
        }]).then(({ error }) => {
            if (error) console.warn("Log upload failed:", error);
        });
    } catch (e) {
        console.error("Logger exception:", e);
    }
};

// --- 二维码加载器 ---
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

// --- 主组件: FileSender (文件发送/管理页) ---
export const FileSender = () => {
    const [fileList, setFileList] = useState([]);
    const [loading, setLoading] = useState(false);
    const { messageApi, notificationApi } = useNotification();
    const currentUser = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch (e) { return null; }
    }, []);
    
    const [isQrModalVisible, setIsQrModalVisible] = useState(false);
    const qrCodeRef = useRef(null);

    const [syncedFiles, setSyncedFiles] = useState([]);
    const [filesLoading, setFilesLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState(null);

    // --- 全局错误监听与页面访问日志 ---
    useEffect(() => {
        // 1. 记录页面访问
        if (currentUser) {
            logSystemEvent({
                category: 'INTERACTION',
                eventType: 'PAGE_VIEW',
                severity: 'INFO',
                message: 'User visited File Share Page',
                userId: currentUser.id,
                email: currentUser.email
            });
        }

        // 2. 运行时错误监听
        const handleRuntimeError = (event) => {
            logSystemEvent({
                category: 'RUNTIME',
                eventType: 'JS_ERROR',
                severity: 'ERROR',
                message: event.message,
                userId: currentUser?.id,
                meta: { filename: event.filename, lineno: event.lineno, stack: event.error?.stack }
            });
        };
        const handleUnhandledRejection = (event) => {
            logSystemEvent({
                category: 'RUNTIME',
                eventType: 'UNHANDLED_PROMISE',
                severity: 'ERROR',
                message: event.reason?.message || 'Unknown Promise Error',
                userId: currentUser?.id,
                meta: { reason: JSON.stringify(event.reason) }
            });
        };

        window.addEventListener('error', handleRuntimeError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleRuntimeError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [currentUser]);

    // --- 下载文件逻辑 ---
    const handleDownload = async (fileRow) => {
        const key = `download-${fileRow.id}`;
        message.loading({ content: `正在准备下载 ${fileRow.file_name}...`, key });
        
        // 日志：记录下载行为
        logSystemEvent({
            category: 'FILE',
            eventType: 'FILE_DOWNLOAD',
            message: `Downloading file: ${fileRow.file_name}`,
            userId: currentUser?.id,
            meta: { file_id: fileRow.id, file_name: fileRow.file_name }
        });

        try {
            const { data, error } = await supabase.storage
                .from('file_sync')
                .download(fileRow.file_path);
            
            if (error) throw error;
            
            saveAs(data, fileRow.file_name);
            message.success({ content: '下载已开始！', key });

        } catch (error) {
            console.error('下载失败:', error);
            message.error({ content: `下载失败: ${error.message}`, key });
            
            // 日志：记录下载失败
            logSystemEvent({
                category: 'FILE',
                eventType: 'DOWNLOAD_FAILED',
                severity: 'ERROR',
                message: `Download failed: ${error.message}`,
                userId: currentUser?.id,
                meta: { file_id: fileRow.id, error: error.message }
            });
        }
    };

    // --- 删除文件逻辑 ---
    const handleDelete = async (fileRow) => {
         const key = `delete-${fileRow.id}`;
         message.loading({ content: `正在删除 ${fileRow.file_name}...`, key });

         try {
            // 1. 从 Storage 删除
            const { error: storageError } = await supabase.storage
                .from('file_sync')
                .remove([fileRow.file_path]);

            if (storageError) {
                 console.error("Storage deletion failed:", storageError.message);
                 // 即使 Storage 删除失败，也记录日志并尝试删 DB
                 logSystemEvent({
                    category: 'FILE',
                    eventType: 'DELETE_STORAGE_FAILED',
                    severity: 'WARN',
                    message: `Storage delete failed: ${storageError.message}`,
                    userId: currentUser?.id,
                    meta: { file_path: fileRow.file_path }
                });
            }

            // 2. 从数据库删除
            const { error: dbError } = await supabase
                .from('user_files')
                .delete()
                .eq('id', fileRow.id);

            if (dbError) throw dbError;

            message.success({ content: '文件已删除！', key });
            
            // 日志：记录删除成功
            logSystemEvent({
                category: 'FILE',
                eventType: 'FILE_DELETED',
                message: `File deleted: ${fileRow.file_name}`,
                userId: currentUser?.id,
                meta: { file_id: fileRow.id, file_name: fileRow.file_name }
            });

        } catch (error) {
             console.error('删除失败:', error);
             message.error({ content: `删除失败: ${error.message}`, key });
             
             // 日志：记录删除失败
             logSystemEvent({
                category: 'FILE',
                eventType: 'DELETE_FAILED',
                severity: 'ERROR',
                message: `Delete failed: ${error.message}`,
                userId: currentUser?.id,
                meta: { file_id: fileRow.id, error: error.message }
            });
        }
    };

    // --- 二维码生成 ---
    useEffect(() => {
        if (isQrModalVisible && qrCodeRef.current && currentUser?.id) {
            loadQrCodeScript().then(() => {
                if (window.QRious) {
                    const mobileUrl = `${window.location.origin}/mobile-transfer?uid=${currentUser.id}`;
                    new window.QRious({
                        element: qrCodeRef.current,
                        value: mobileUrl,
                        size: 256,
                        level: 'H'
                    });
                    
                    // 日志：记录用户打开了手机上传二维码
                    logSystemEvent({
                        category: 'INTERACTION',
                        eventType: 'QR_CODE_GENERATED',
                        message: 'User opened mobile upload QR code',
                        userId: currentUser.id
                    });
                }
            }).catch(err => {
                console.error(err);
                messageApi.error("无法加载二维码生成器，请刷新页面重试。");
            });
        }
    }, [isQrModalVisible, messageApi, currentUser]);

    // --- 文件加载与 Realtime 订阅 ---
    useEffect(() => {
        if (!currentUser?.id) {
            setFilesLoading(false);
            return;
        }

        const fetchFiles = async () => {
            setFilesLoading(true);
            try {
                const { data, error } = await supabase
                    .from('user_files')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                setSyncedFiles(data || []);
            } catch (error) {
                console.error("加载已同步文件失败:", error);
                messageApi.error(`加载文件列表失败: ${error.message}`);
                
                logSystemEvent({
                    category: 'FILE',
                    eventType: 'FETCH_LIST_FAILED',
                    severity: 'ERROR',
                    message: error.message,
                    userId: currentUser.id
                });
            } finally {
                setFilesLoading(false);
            }
        };

        fetchFiles();

        const channel = supabase
            .channel(`user_files_page:${currentUser.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'user_files', filter: `user_id=eq.${currentUser.id}` },
                (payload) => {
                    // console.log('Realtime 收到新文件:', payload);
                    setSyncedFiles(prevFiles => [payload.new, ...prevFiles]);
                    
                    // 仅当文件来源不是当前设备时，才显得比较有意思（这里简单记录所有同步）
                    if (payload.new.source_device !== 'web') {
                         logSystemEvent({
                            category: 'SYNC',
                            eventType: 'FILE_RECEIVED_REALTIME',
                            message: `Received file from ${payload.new.source_device || 'other device'}`,
                            userId: currentUser.id,
                            meta: { file_id: payload.new.id, device: payload.new.source_device }
                        });
                    }

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
                { event: 'DELETE', schema: 'public', table: 'user_files', filter: `user_id=eq.${currentUser.id}` },
                (payload) => {
                    setSyncedFiles(prevFiles => prevFiles.filter(file => file.id !== payload.old.id));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    
    }, [currentUser, notificationApi, messageApi]);

    const handleFileChange = ({ fileList }) => {
        setFileList(fileList);
    };

    // --- 上传并同步逻辑 (核心修改：添加时长统计) ---
    const handleUploadAndSync = async () => {
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

        // 1. 记录开始时间 和 总文件大小
        const startTime = Date.now();
        // originFileObj.size 是文件的字节数
        const totalSizeBytes = fileList.reduce((acc, file) => acc + (file.originFileObj?.size || 0), 0);

        // 日志：开始上传
        logSystemEvent({
            category: 'FILE',
            eventType: 'UPLOAD_ATTEMPT',
            message: `Attempting to upload ${fileList.length} files`,
            userId: currentUser.id,
            meta: { 
                file_count: fileList.length,
                total_size_bytes: totalSizeBytes // 记录本次上传总量
            }
        });

        const uploadPromises = fileList.map(async (fileInfo) => {
            const file = fileInfo.originFileObj;
            if (!file) throw new Error(`无法获取文件 ${fileInfo.name}`);
            
            const fileExt = file.name.split('.').pop();
            const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${fileExt ? '.' + fileExt : ''}`;
            const filePath = `${currentUser.id}/${safeFileName}`;

            // 1. Upload Storage
            const { error: uploadError } = await supabase.storage
                .from('file_sync')
                .upload(filePath, file);

            if (uploadError) throw new Error(`上传 ${file.name} 失败: ${uploadError.message}`);

            // 2. Insert DB
            const { error: insertError } = await supabase
                .from('user_files')
                .insert({
                    user_id: currentUser.id,
                    file_name: file.name,
                    file_path: filePath,
                    source_device: 'web'
                });
            
            if (insertError) {
                 await supabase.storage.from('file_sync').remove([filePath]);
                 throw new Error(`上传 ${file.name} 成功，但同步记录失败: ${insertError.message}`);
            }

            return file.name;
        });

        try {
            const uploadedFiles = await Promise.all(uploadPromises);
            
            // 2. 记录结束时间，计算耗时
            const endTime = Date.now();
            const durationMs = endTime - startTime;
            
            // 3. 计算简单平均速度 (KB/s)
            // (Total Bytes / 1024) / (Duration ms / 1000)
            const speedKbps = totalSizeBytes > 0 && durationMs > 0 
                ? (totalSizeBytes / 1024) / (durationMs / 1000) 
                : 0;

            messageApi.success({ 
                // 显示本次耗时给用户看
                content: `成功同步 ${uploadedFiles.length} 个文件！(耗时: ${(durationMs / 1000).toFixed(1)}秒)`, 
                key: 'syncing', 
                duration: 3 
            });
            setFileList([]);

            // 日志：上传成功 (包含关键的预测指标数据)
            logSystemEvent({
                category: 'FILE',
                eventType: 'UPLOAD_SUCCESS',
                severity: 'INFO',
                message: `Successfully uploaded ${uploadedFiles.length} files`,
                userId: currentUser.id,
                meta: { 
                    file_count: uploadedFiles.length,
                    total_size_bytes: totalSizeBytes,
                    duration_ms: durationMs,
                    average_speed_kbps: speedKbps.toFixed(2)
                }
            });

        } catch (error) {
            // 计算失败时的耗时也有分析价值（例如超时）
            const durationMs = Date.now() - startTime;

            messageApi.error({ 
                content: error.message, 
                key: 'syncing', 
                duration: 5 
            });

            // 日志：上传失败
            logSystemEvent({
                category: 'FILE',
                eventType: 'UPLOAD_FAILED',
                severity: 'ERROR',
                message: `Upload failed: ${error.message}`,
                userId: currentUser.id,
                meta: { 
                    error: error.message,
                    duration_ms: durationMs 
                }
            });
        } finally {
            setLoading(false);
        }
    };

    const filteredFiles = useMemo(() => {
        return syncedFiles.filter(file => {
            const matchesSearch = file.file_name.toLowerCase().includes(searchTerm.toLowerCase());
            let matchesDate = true;
            if (dateRange && dateRange[0] && dateRange[1]) {
                const fileDate = dayjs(file.created_at);
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

            <Card 
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>已同步的文件 ({filteredFiles.length})</span>
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
                    dataSource={filteredFiles}
                    pagination={{ pageSize: 5 }}
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

// 导出页面组件
export default FileSender;