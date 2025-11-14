import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Upload, Button, notification, message, Spin, Space } from 'antd';
import { ShareAltOutlined, UploadOutlined, InboxOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';
import { saveAs } from 'file-saver'; // 用于下载文件

const { Title, Paragraph } = Typography;
const { Dragger } = Upload;

// --- 组件 A: 文件发送器 ---
// (用于替换您现有的 OfflineSharePage.js 页面内容)
export const FileSender = () => {
    const [fileList, setFileList] = useState([]);
    const [loading, setLoading] = useState(false);
    const { messageApi } = useNotification();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);

    const handleFileChange = ({ fileList }) => {
        setFileList(fileList);
    };

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

        const uploadPromises = fileList.map(async (fileInfo) => {
            const file = fileInfo.originFileObj;
            if (!file) {
                throw new Error(`无法获取文件 ${fileInfo.name}`);
            }
            
            // 1. 创建唯一的文件路径，包含用户ID
            const filePath = `${currentUser.id}/${Date.now()}-${file.name}`;

            // 2. 上传到 Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('file_sync') // 必须匹配 SQL 中创建的 Bucket ID
                .upload(filePath, file);

            if (uploadError) {
                throw new Error(`上传 ${file.name} 失败: ${uploadError.message}`);
            }

            // 3. 在数据库中创建通知记录
            const { error: insertError } = await supabase
                .from('user_files') // 必须匹配 SQL 中创建的表
                .insert({
                    user_id: currentUser.id,
                    file_name: file.name,
                    file_path: filePath,
                    source_device: 'web' // 假设这是从网页端发送的
                });
            
            if (insertError) {
                 // （可选）如果数据库插入失败，尝试删除刚上传的文件以进行清理
                 await supabase.storage.from('file_sync').remove([filePath]);
                 throw new Error(`上传 ${file.name} 成功，但同步记录失败: ${insertError.message}`);
            }

            return file.name; // 返回成功的文件名
        });

        try {
            const uploadedFiles = await Promise.all(uploadPromises);
            messageApi.success({ 
                content: `成功同步 ${uploadedFiles.length} 个文件！`, 
                key: 'syncing', 
                duration: 3 
            });
            setFileList([]); // 清空列表
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

    return (
        <div style={{ maxWidth: 800, margin: 'auto', padding: '24px 0' }}>
            <Card>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={4}>跨设备文件同步</Title>
                    <Paragraph type="secondary">
                        上传文件到您的私有云端。文件将实时推送到您已登录的其他设备（如电脑或手机）。
                    </Paragraph>
                </div>
                
                <Dragger
                    fileList={fileList}
                    onChange={handleFileChange}
                    beforeUpload={() => false} // 阻止自动上传
                    multiple={true}
                >
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    <p className="ant-upload-text">点击或拖拽文件到此区域</p>
                    <p className="ant-upload-hint">支持单个或多个文件。文件将被安全存储并同步到您的账户。</p>
                </Dragger>

                <Button
                    type="primary"
                    icon={<ShareAltOutlined />}
                    size="large"
                    loading={loading}
                    disabled={fileList.length === 0}
                    onClick={handleUploadAndSync}
                    style={{ width: '100%', marginTop: 24 }}
                >
                    {loading ? '正在同步...' : '上传并同步'}
                </Button>
            </Card>
        </div>
    );
};

// --- 组件 B: 文件接收器 ---
// (应放置在您的 MainLayout.js 或其他常驻组件中)
