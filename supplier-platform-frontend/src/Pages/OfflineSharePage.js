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

const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001'  // 本地开发环境
    : 'https://supplier-interaction-platform-backend.vercel.app'; // Vercel 生产环境

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
        const apiPath = isDev ? '/api/system-log' : '/api/system-log';
        const targetUrl = `${BACKEND_URL}${apiPath}`;
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
        await fetch(`${targetUrl}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category,
                event_type: eventType,
                severity,
                message,
                user_email: email,
                user_id: userId,
                metadata: {
                    ...environmentInfo,
                    ...meta,
                    timestamp_client: new Date().toISOString()
                }
            })
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

    // --- 下载文件逻辑 (已修改为后端鉴权) ---
    const handleDownload = async (fileRow) => {
        const key = `download-${fileRow.id}`;
        message.loading({ content: `正在准备下载 ${fileRow.file_name}...`, key });

        // 日志：记录下载请求
        logSystemEvent({
            category: 'FILE',
            eventType: 'FILE_DOWNLOAD_INIT',
            message: `Requesting download url for: ${fileRow.file_name}`,
            userId: currentUser?.id,
            meta: { file_id: fileRow.id }
        });

        try {
            // 1. 请求后端获取临时下载链接 (Signed URL)
            const response = await fetch(`${BACKEND_URL}/api/file-sync/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'download',
                    filePath: fileRow.file_path
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to get download URL');
            }

            const { downloadUrl } = await response.json();

            // 2. 使用临时链接下载文件流
            // 注意：虽然有了 URL，为了触发浏览器下载行为并重命名文件，
            // 我们通常还是需要 fetch blob，然后用 file-saver 保存。
            const fileRes = await fetch(downloadUrl);
            if (!fileRes.ok) throw new Error('File download stream failed');

            const blob = await fileRes.blob();

            // 3. 保存文件
            saveAs(blob, fileRow.file_name);
            message.success({ content: '下载成功！', key });

        } catch (error) {
            console.error('下载失败:', error);
            message.error({ content: `下载失败: ${error.message}`, key });

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
    // --- 删除文件逻辑 (已修改为调用后端) ---
    const handleDelete = async (fileRow) => {
        const key = `delete-${fileRow.id}`;
        message.loading({ content: `正在删除 ${fileRow.file_name}...`, key });

        try {
            // ✅ 改为调用后端 API
            // 后端会同时处理：1.从Storage删除文件 2.从Database删除记录
            const response = await fetch(`${BACKEND_URL}/api/file-sync/files`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileId: fileRow.id,
                    filePath: fileRow.file_path
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Delete failed');
            }

            messageApi.success({ content: '文件已删除！', key });

            // 手动更新本地列表，提升 UI 响应速度 (虽然 Realtime 也会推，但这样更快)
            setSyncedFiles(prev => prev.filter(f => f.id !== fileRow.id));

            // 日志：记录删除成功
            logSystemEvent({
                category: 'FILE',
                eventType: 'FILE_DELETED',
                message: `File deleted via Backend: ${fileRow.file_name}`,
                userId: currentUser?.id,
                meta: { file_id: fileRow.id, file_name: fileRow.file_name }
            });

        } catch (error) {
            console.error('删除失败:', error);
            messageApi.error({ content: `删除失败: ${error.message}`, key });

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
                // ✅ 改为调用后端
                const response = await fetch(`${BACKEND_URL}/api/file-sync/files?userId=${currentUser.id}`);
                if (!response.ok) throw new Error('Fetch files failed');

                const data = await response.json();
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

    // --- 上传并同步逻辑 (核心修改：添加时长统计 + exe拦截) ---
    // --- 上传并同步逻辑 (已修改为调用后端) ---
    const handleUploadAndSync = async () => {
        if (fileList.length === 0) {
            messageApi.warning('请先选择要同步的文件！');
            return;
        }
        if (!currentUser?.id) {
            messageApi.error('无法同步：用户未登录。');
            return;
        }

        // --- 1. 安全检查：拦截 .exe 文件 ---
        const hasExe = fileList.some(file => file.name.toLowerCase().endsWith('.exe'));
        if (hasExe) {
            messageApi.error('安全限制：不支持上传 .exe 可执行文件。');

            // 记录拦截日志
            logSystemEvent({
                category: 'FILE',
                eventType: 'UPLOAD_BLOCKED',
                severity: 'WARN',
                message: 'Upload blocked due to .exe file extension',
                userId: currentUser.id,
                meta: { file_names: fileList.map(f => f.name) }
            });
            return;
        }

        setLoading(true);
        messageApi.loading({ content: '正在同步文件...', key: 'syncing', duration: 0 });

        // 2. 记录开始时间 和 总文件大小
        const startTime = Date.now();
        // originFileObj.size 是文件的字节数
        const totalSizeBytes = fileList.reduce((acc, file) => acc + (file.originFileObj?.size || 0), 0);

        // 日志：开始上传
        logSystemEvent({
            category: 'FILE',
            eventType: 'UPLOAD_ATTEMPT',
            message: `Attempting to upload ${fileList.length} files via Backend`,
            userId: currentUser.id,
            meta: {
                file_count: fileList.length,
                total_size_bytes: totalSizeBytes
            }
        });

        // 3. 构建上传队列
        const uploadPromises = fileList.map(async (fileInfo) => {
            const file = fileInfo.originFileObj;
            if (!file) throw new Error(`无法获取文件 ${fileInfo.name}`);

            // ✅ 改为调用后端 API 上传
            const formData = new FormData();
            formData.append('file', file);
            formData.append('targetUserId', currentUser.id); // 明确告知后端这是哪个用户的文件

            const response = await fetch(`${BACKEND_URL}/api/file-sync/upload`, {
                method: 'POST',
                // fetch 会自动设置 Content-Type 为 multipart/form-data，不需要手动设置 header
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `上传 ${file.name} 失败`);
            }

            return file.name;
        });

        try {
            const uploadedFiles = await Promise.all(uploadPromises);

            // 4. 记录结束时间，计算耗时
            const endTime = Date.now();
            const durationMs = endTime - startTime;

            // 5. 计算简单平均速度 (KB/s)
            const speedKbps = totalSizeBytes > 0 && durationMs > 0
                ? (totalSizeBytes / 1024) / (durationMs / 1000)
                : 0;

            messageApi.success({
                content: `成功同步 ${uploadedFiles.length} 个文件！(耗时: ${(durationMs / 1000).toFixed(1)}秒)`,
                key: 'syncing',
                duration: 3
            });
            setFileList([]);

            // 日志：上传成功
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
                    <p className="ant-upload-hint">支持单个或多个文件。文件将被安全存储并同步到您的账户。（不支持 .exe 格式）</p>
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