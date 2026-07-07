import React, { useMemo, useState } from 'react';
import { Button, Modal, Space, Typography } from 'antd';
import { EyeOutlined, PaperClipOutlined } from '@ant-design/icons';

const { Text } = Typography;

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'];

const getFileUrl = (file) => {
    if (!file) return '';
    if (typeof file === 'string') return file;
    return file.url || file.thumbUrl || file.preview || '';
};

const getFileName = (file, index) => {
    if (!file || typeof file === 'string') {
        const url = typeof file === 'string' ? file : '';
        return decodeURIComponent(url.split('/').pop()?.split('?')[0] || `attachment-${index + 1}`);
    }
    return file.name || `attachment-${index + 1}`;
};

const isVideoFile = (file, index) => {
    const name = getFileName(file, index).toLowerCase();
    const url = getFileUrl(file).toLowerCase().split('?')[0];
    const type = typeof file === 'object' ? (file.type || '').toLowerCase() : '';

    return type.startsWith('video/')
        || VIDEO_EXTENSIONS.some(ext => name.endsWith(ext) || url.endsWith(ext));
};

export const AttachmentsDisplay = ({ attachments, title = '附件', showTitle = true, size = 'small' }) => {
    const [previewFile, setPreviewFile] = useState(null);

    const previewUrl = useMemo(() => getFileUrl(previewFile), [previewFile]);
    const previewName = useMemo(() => getFileName(previewFile, 0), [previewFile]);

    if (!attachments || attachments.length === 0) {
        return null;
    }

    return (
        <div style={{ marginTop: 12 }}>
            {showTitle && <Text strong><PaperClipOutlined style={{ marginRight: 8 }} />{title}:</Text>}

            <div style={{ marginTop: 8 }}>
                <Space wrap>
                    {attachments.map((file, i) => {
                        const url = getFileUrl(file);
                        const name = getFileName(file, i);
                        const canPreviewVideo = isVideoFile(file, i) && !!url;

                        return (
                            <Space.Compact key={`${name}-${i}`}>
                                {canPreviewVideo && (
                                    <Button
                                        size={size}
                                        icon={<EyeOutlined />}
                                        onClick={() => setPreviewFile(file)}
                                    >
                                        预览
                                    </Button>
                                )}
                                <Button
                                    type="dashed"
                                    size={size}
                                    icon={<PaperClipOutlined />}
                                    href={url}
                                    download={name}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {name}
                                </Button>
                            </Space.Compact>
                        );
                    })}
                </Space>
            </div>

            <Modal
                open={!!previewFile}
                title={previewName}
                footer={null}
                onCancel={() => setPreviewFile(null)}
                width={820}
                destroyOnClose
            >
                {previewUrl ? (
                    <video
                        src={previewUrl}
                        controls
                        style={{ width: '100%', maxHeight: '70vh', background: '#000' }}
                    >
                        您的浏览器暂不支持视频预览，请下载后查看。
                    </video>
                ) : (
                    <Text type="secondary">无法获取附件地址，请下载后查看。</Text>
                )}
            </Modal>
        </div>
    );
};
