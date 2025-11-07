import React, { useState } from 'react';
import { Card, Typography, Upload, Button, Empty, message, Alert } from 'antd';
import { ShareAltOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons';
import { useNotification } from '../contexts/NotificationContext';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

const OfflineSharePage = () => {
    const [fileList, setFileList] = useState([]);
    const [loading, setLoading] = useState(false);
    const { messageApi } = useNotification();

    const handleFileChange = ({ file, fileList }) => {
        // --- 1. 核心修正：允许保留多个文件 ---
        setFileList(fileList);
    };

    // --- 核心：Web Share API 的调用逻辑 (此逻辑已支持蓝牙) ---
    const handleShare = async () => {
        // --- 2. 核心修正：检查文件列表是否为空 ---
        if (fileList.length === 0) {
            messageApi.warning('请先选择至少一个要分享的文件！');
            return;
        }

        // --- 3. 核心修正：获取所有要分享的文件 ---
        const filesToShare = fileList.map(f => f.originFileObj).filter(Boolean);
        
        if (filesToShare.length === 0) {
            messageApi.error('无法获取文件，请重新选择。');
            return;
        }

        if (!navigator.share) {
            messageApi.error('您的浏览器不支持 Web Share API。请尝试在手机或桌面版 Chrome/Edge 上使用此功能。');
            return;
        }
        
        // --- 4. 核心修正：检查是否能分享多个文件 ---
        if (navigator.canShare && navigator.canShare({ files: filesToShare })) {
            setLoading(true);
            try {
                // --- 5. 核心修正：分享所有文件 ---
                await navigator.share({
                    title: filesToShare.length > 1 ? `${filesToShare.length} 个文件` : filesToShare[0].name,
                    text: `来自供应商平台的 ${filesToShare.length} 个离线文件分享`,
                    files: filesToShare,
                });
                messageApi.success('文件已成功分享！');
                setFileList([]); // 分享成功后清空列表
            } catch (error) {
                if (error.name !== 'AbortError') { 
                    console.error('分享失败:', error);
                    messageApi.error(`分享失败: ${error.message}`);
                }
            } finally {
                setLoading(false);
            }
        } else {
            messageApi.error('您的浏览器不支持分享这些文件。');
        }
    };

    return (
        <div style={{ maxWidth: 800, margin: 'auto', padding: '24px 0' }}>
            <Card>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={4}>离线文件分享</Title>
                    <Paragraph type="secondary">
                        此功能用于在现场（如工厂）无互联网连接时，通过您设备的原生分享菜单（包含 蓝牙、AirDrop、Nearby Share或其他应用）将文件发送到手机。
                    </Paragraph>
                    
                    <Alert
                      message="Beta 功能提示"
                      description="此离线分享功能依赖于您设备和浏览器的原生支持。它最适用于现代手机浏览器 (Chrome/Safari) 和桌面版 Chrome/Edge。可能会因管理员设置功能受限。"
                      type="info"
                      showIcon
                      style={{ marginBottom: 24, textAlign: 'left' }}
                    />
                </div>
                
                <Dragger
                    fileList={fileList}
                    onChange={handleFileChange}
                    beforeUpload={() => false} // 阻止自动上传
                    multiple={true} // --- 6. 核心修正：确保允许多选 ---
                >
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    {/* --- 7. 核心修正：更新提示文本 --- */}
                    <p className="ant-upload-text">点击或拖拽文件到此区域</p>
                    <p className="ant-upload-hint">选择一个或多个您想要离线发送的文件（如PDF, Excel, 图片等）。</p>
                </Dragger>

                <Button
                    type="primary"
                    icon={<ShareAltOutlined />}
                    size="large"
                    loading={loading}
                    disabled={fileList.length === 0}
                    onClick={handleShare}
                    style={{ width: '100%', marginTop: 24 }}
                >
                    {loading ? '准备分享中...' : '启动原生分享'}
                </Button>
            </Card>
        </div>
    );
};

export default OfflineSharePage;