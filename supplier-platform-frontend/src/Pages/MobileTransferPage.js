import React, { useState, useEffect } from 'react';
import { Layout, Upload, Button, Typography, message, Card, Spin } from 'antd';
import { CloudUploadOutlined, CheckCircleFilled, LoadingOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text } = Typography;

// 🔧 环境配置 (确保后端地址正确)
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
// const BACKEND_URL = isDev
//     ? 'http://localhost:3001'
//     : 'https://supplier-interaction-platform-backend.vercel.app';
const BACKEND_URL = isDev
    ? 'http://localhost:3001' 
    : window.location.origin; // 必须是这句！

const MobileTransferPage = () => {
    const [searchParams] = useSearchParams();
    const [targetUserId, setTargetUserId] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [successKey, setSuccessKey] = useState(0);

    useEffect(() => {
        const uid = searchParams.get('uid');
        if (uid) {
            setTargetUserId(uid);
        } else {
            message.error("无效的连接二维码");
        }
    }, [searchParams]);

    // ✅ 修改后的上传逻辑
    const customRequest = async ({ file, onSuccess, onError }) => {
        if (!targetUserId) return;

        setUploading(true);
        try {
            // 1. 构建 FormData
            const formData = new FormData();
            formData.append('file', file);
            formData.append('targetUserId', targetUserId);

            // 2. 调用后端 API
            const response = await fetch(`${BACKEND_URL}/api/file-sync/upload`, {
                method: 'POST',
                // 注意：fetch 会自动设置 Content-Type 为 multipart/form-data，不要手动设置 headers
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Upload failed');
            }

            onSuccess("ok");
            message.success(`${file.name} 发送成功！`);
            setSuccessKey(prev => prev + 1);
        } catch (err) {
            console.error(err);
            onError(err);
            message.error("发送失败，请重试");
        } finally {
            setUploading(false);
        }
    };

    if (!targetUserId) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                <p>正在解析连接...</p>
            </div>
        );
    }

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Card style={{ borderRadius: 16, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <div style={{ marginBottom: 24 }}>
                        <CloudUploadOutlined style={{ fontSize: 64, color: '#1890ff' }} />
                        <Title level={3} style={{ marginTop: 16 }}>文件快传</Title>
                        <Text type="secondary">已连接到您的电脑端</Text>
                    </div>

                    <Upload
                        customRequest={customRequest}
                        showUploadList={false}
                        multiple
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" // 建议限制一下类型
                    >
                        <Button 
                            type="primary" 
                            shape="round" 
                            size="large" 
                            style={{ height: '56px', fontSize: '18px', width: '100%', padding: '0 40px' }}
                            loading={uploading}
                            icon={!uploading && <CloudUploadOutlined />}
                        >
                            {uploading ? '正在传输...' : '点击选择文件 / 拍照'}
                        </Button>
                    </Upload>

                    <div style={{ marginTop: 24 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            支持图片、视频及各类文档
                        </Text>
                    </div>
                </Card>

                {successKey > 0 && (
                    <div style={{ marginTop: 40, textAlign: 'center', animation: 'fadeIn 0.5s' }}>
                        <CheckCircleFilled style={{ fontSize: 48, color: '#52c41a' }} />
                        <br />
                        <Text strong style={{ fontSize: 16, color: '#52c41a' }}>发送成功</Text>
                    </div>
                )}
            </Content>
        </Layout>
    );
};

export default MobileTransferPage;