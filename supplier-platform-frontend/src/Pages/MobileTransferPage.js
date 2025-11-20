import React, { useState, useEffect } from 'react';
import { Layout, Upload, Button, Typography, message, Card, Spin, Result } from 'antd';
import { CloudUploadOutlined, CheckCircleFilled, LoadingOutlined } from '@ant-design/icons';
import { supabase } from '../supabaseClient';
import { useSearchParams } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text } = Typography;

const MobileTransferPage = () => {
    const [searchParams] = useSearchParams();
    const [targetUserId, setTargetUserId] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [successKey, setSuccessKey] = useState(0);

    useEffect(() => {
        // 从 URL 参数中获取目标用户 ID (?uid=...)
        const uid = searchParams.get('uid');
        if (uid) {
            setTargetUserId(uid);
        } else {
            message.error("无效的连接二维码");
        }
    }, [searchParams]);

    const customRequest = async ({ file, onSuccess, onError }) => {
        if (!targetUserId) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            // 生成唯一文件名
            const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${fileExt ? '.' + fileExt : ''}`;
            // 关键：上传到目标用户的文件夹路径，这样 PC 端能监听到
            const filePath = `${targetUserId}/${safeFileName}`;

            // 1. 上传文件
            const { error: uploadError } = await supabase.storage
                .from('file_sync')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. 写入数据库记录 (触发 PC 端 Realtime)
            const { error: insertError } = await supabase
                .from('user_files')
                .insert({
                    user_id: targetUserId, // 归属于 PC 端用户
                    file_name: file.name,
                    file_path: filePath,
                    source_device: 'mobile_scan' // 标记来源
                });

            if (insertError) throw insertError;

            onSuccess("ok");
            message.success(`${file.name} 发送成功！`);
            setSuccessKey(prev => prev + 1); // 触发动画
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