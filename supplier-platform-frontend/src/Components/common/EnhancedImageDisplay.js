// src/Components/common/EnhancedImageDisplay.js
import React from 'react';
import { Image, Space, Typography } from 'antd';
import { PictureOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * 增强的图片显示组件
 * 支持更大的图片尺寸和更好的预览体验
 */
export const EnhancedImageDisplay = ({ 
    images, 
    title = "图片证据", 
    size = "large", // small: 150px, medium: 200px, large: 250px, xlarge: 300px
    showTitle = true,
    style = {}
}) => {
    if (!images || images.length === 0) {
        return (
            <div style={{ marginTop: 12 }}>
                {showTitle && <Text strong><PictureOutlined /> {title}:</Text>}
                <br />
                <Text type="secondary">（未上传图片证据）</Text>
            </div>
        );
    }

    // 根据size参数设置图片尺寸
    const getImageSize = () => {
        switch (size) {
            case 'small': return 150;
            case 'medium': return 200;
            case 'large': return 250;
            case 'xlarge': return 300;
            default: return 250;
        }
    };

    const imageSize = getImageSize();

    return (
        <div style={{ marginTop: 12, ...style }}>
            {showTitle && <Text strong><PictureOutlined /> {title}:</Text>}
            <br />
            <Image.PreviewGroup>
                <Space wrap style={{ marginTop: 8 }}>
                    {images.map((image, imgIndex) => (
                        <Image
                            key={imgIndex}
                            width={imageSize}
                            height={imageSize}
                            src={image.url || image.thumbUrl}
                            style={{ 
                                objectFit: 'cover',
                                borderRadius: '8px',
                                border: '1px solid #d9d9d9',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                            placeholder={
                                <div style={{ 
                                    width: imageSize, 
                                    height: imageSize, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: '8px',
                                    border: '1px solid #d9d9d9'
                                }}>
                                    <Text type="secondary">加载中...</Text>
                                </div>
                            }
                            onError={(e) => {
                                console.error('图片加载失败:', image);
                                e.target.style.display = 'none';
                            }}
                        />
                    ))}
                </Space>
            </Image.PreviewGroup>
        </div>
    );
};

/**
 * 图片轮播组件 - 用于显示多张图片的轮播效果
 */
export const ImageCarousel = ({ images, title = "图片证据", height = 300 }) => {
    if (!images || images.length === 0) {
        return (
            <div style={{ marginTop: 12 }}>
                <Text strong><PictureOutlined /> {title}:</Text>
                <br />
                <Text type="secondary">（未上传图片证据）</Text>
            </div>
        );
    }

    return (
        <div style={{ marginTop: 12 }}>
            <Text strong><PictureOutlined /> {title}:</Text>
            <div style={{ marginTop: 8 }}>
                <Image.PreviewGroup>
                    {images.map((image, imgIndex) => (
                        <Image
                            key={imgIndex}
                            height={height}
                            style={{ 
                                objectFit: 'contain', 
                                width: '100%', 
                                backgroundColor: '#f0f2f5', 
                                borderRadius: '8px',
                                marginBottom: 8
                            }}
                            src={image.url || image.thumbUrl}
                            placeholder={
                                <div style={{ 
                                    height: height, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: '8px'
                                }}>
                                    <Text type="secondary">加载中...</Text>
                                </div>
                            }
                        />
                    ))}
                </Image.PreviewGroup>
            </div>
        </div>
    );
};
