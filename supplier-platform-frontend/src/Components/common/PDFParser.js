import React, { useState } from 'react';
import { Upload, Button, Card, Spin, message, Typography, Space, Descriptions } from 'antd';
import { UploadOutlined, FilePdfOutlined } from '@ant-design/icons';
import * as pdfjsLib from 'pdfjs-dist';

// 设置 Worker 源 (必须步骤)
// 注意：实际项目中通常将 worker 文件放在 public 目录或通过 CDN 引入
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const { Title, Paragraph } = Typography;

const PDFParser = ({ onParseComplete }) => {
    const [loading, setLoading] = useState(false);
    const [parsedData, setParsedData] = useState(null);

    const extractTextFromPDF = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';

        // 遍历每一页提取文本
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // 将每一页的文本项拼接
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    };

    // --- 核心：针对 Volvo 8D 报告的规则解析器 ---
    const parseVolvo8D = (text) => {
        // 这是一个基于关键词的简单启发式解析
        // 实际 PDF 提取出的文字往往不仅没换行，顺序也可能混乱
        console.log("Raw PDF Text:", text); 

        let summary = "未识别到问题描述";
        let solution = "未识别到原因/对策";

        // 1. 尝试提取 Problem description (现象)
        // 逻辑：寻找 "Problem description" 或 "Phenomenon" 之后的文字
        const problemMatch = text.match(/(?:Problem description|Phenomenon)([\s\S]{10,300}?)(?:3\.|Cause|Analysis)/i);
        if (problemMatch && problemMatch[1]) {
            summary = problemMatch[1].trim();
        }

        // 2. 尝试提取 Root Cause (根本原因)
        // 逻辑：寻找 "Root Cause" 之后的文字
        const causeMatch = text.match(/(?:Root Cause|Why happened)([\s\S]{10,500}?)(?:Permanent|Corrective Action)/i);
        if (causeMatch && causeMatch[1]) {
            solution = causeMatch[1].trim();
        }

        return { title: '8D 报告自动解析', summary, solution };
    };

    const handleUpload = async (file) => {
        setLoading(true);
        try {
            const text = await extractTextFromPDF(file);
            const result = parseVolvo8D(text);
            
            setParsedData(result);
            message.success('PDF 解析成功 (纯前端模式)');
            
            // 回调给父组件填充表单
            if (onParseComplete) {
                onParseComplete(result);
            }
        } catch (error) {
            console.error(error);
            message.error('PDF 解析失败，请确认文件是否加密或为扫描件');
        } finally {
            setLoading(false);
        }
        return false; // 阻止默认上传
    };

    return (
        <Card size="small" style={{ marginTop: 16, border: '1px dashed #d9d9d9' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                        <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                        <Text strong>纯前端 PDF 解析器 (Beta)</Text>
                    </Space>
                    <Upload beforeUpload={handleUpload} showUploadList={false} accept=".pdf">
                        <Button icon={<UploadOutlined />} loading={loading}>选择本地 PDF</Button>
                    </Upload>
                </div>
                
                <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                    利用浏览器能力直接读取 PDF 文字层，不经过服务器。适用于非扫描版 PDF。
                </Paragraph>

                {parsedData && (
                    <div style={{ marginTop: 16, background: '#f5f5f5', padding: 12, borderRadius: 6 }}>
                        <Descriptions title="解析预览" column={1} size="small">
                            <Descriptions.Item label="摘要提取">{parsedData.summary}</Descriptions.Item>
                            <Descriptions.Item label="原因/对策">{parsedData.solution}</Descriptions.Item>
                        </Descriptions>
                    </div>
                )}
            </Space>
        </Card>
    );
};

export default PDFParser;