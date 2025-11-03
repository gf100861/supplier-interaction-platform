import React, { useState } from 'react';
import { Card, Typography, Upload, Button, Empty, message } from 'antd';
import { ShareAltOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons';
import { useNotification } from '../contexts/NotificationContext';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

const OfflineSharePage = () => {
    const [fileList, setFileList] = useState([]);
    const [loading, setLoading] = useState(false);
    const { messageApi } = useNotification();

    const handleFileChange = ({ file, fileList }) => {
        // 只保留最新选择的一个文件
        setFileList(fileList.slice(-1));
    };

    // --- 2. 核心：Web Share API 的调用逻辑 ---
    const handleShare = async () => {
        if (fileList.length === 0) {
            messageApi.warning('请先选择一个要分享的文件！');
            return;
        }

        // 1. 检查浏览器是否支持 Web Share API
        if (!navigator.share) {
            messageApi.error('您的浏览器不支持 Web Share API。请尝试在手机或桌面版 Chrome/Edge 上使用此功能。');
            return;
        }

        const fileToShare = fileList[0].originFileObj;
        if (!fileToShare) {
            messageApi.error('无法获取文件，请重新选择。');
            return;
        }
        
        // 2. 检查浏览器是否能分享文件
        if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
            setLoading(true);
            try {
                // 3. 调用原生的分享菜单
                await navigator.share({
                    title: fileToShare.name,
                    text: `来自供应商平台的离线文件分享`,
                    files: [fileToShare],
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
            messageApi.error('您的浏览器不支持分享此类文件。');
        }
    };

    return (
        <div style={{ maxWidth: 800, margin: 'auto', padding: '24px 0' }}>
            <Card>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={4}>离线文件分享</Title>
                    <Paragraph type="secondary">
                        此功能用于在现场（如工厂）无互联网连接时，通过蓝牙或Wi-Fi（如 AirDrop / Nearby Share）将文件点对点发送给供应商。
                    </Paragraph>
                </div>
                
                <Dragger
                    fileList={fileList}
                    onChange={handleFileChange}
                    beforeUpload={() => false} // 阻止自动上传
                    multiple={true}
                >
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    <p className="ant-upload-text">点击或拖拽单个文件到此区域</p>
                    <p className="ant-upload-hint">选择一个您想要离线发送的文件（如PDF, Excel, 图片等）。</p>
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