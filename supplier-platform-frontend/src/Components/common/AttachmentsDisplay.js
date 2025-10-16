import React from 'react';
import { Typography, Space, Button, message } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';

const { Text } = Typography;

export const AttachmentsDisplay = ({ attachments, title = "附件", showTitle = true, size = "small" }) => {
    if (!attachments || attachments.length === 0) {
        return null;
    }

    // --- ✨ 核心修正：移除了复杂的 handleDownload 函数 ---
    // 我们将直接使用 antd Button 的原生 href 和 download 功能，这更简单可靠。

   

    return (
        <div style={{ marginTop: 12 }}>
            {showTitle && <Text strong><PaperClipOutlined style={{ marginRight: 8 }} />{title}:</Text>}
            
            <div style={{ marginTop: 8 }}>
                <Space wrap>
                    {attachments.map((file, i) => (
                        <Button
                            key={i}
                            type="dashed"
                            size={size}
                            icon={<PaperClipOutlined />}
                            // --- ✨ 核心修正：直接在按钮上提供下载链接 ---
                            // antd 的 Button 组件在设置 href 后会渲染为一个 <a> 标签。
                            // `download` 属性会强制浏览器下载文件，而不是在新标签页中打开它。
                            // 这种方法适用于所有 URL 类型，包括您正在使用的 Base64 data URLs。
                            href={file.url}
                            download={file.name || 'download'}
                        >
                            {file.name}
                        </Button>
                    ))}
                </Space>
            </div>
        </div>
    );
};

