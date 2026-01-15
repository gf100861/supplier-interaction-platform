import React, { useState } from 'react';
import { Card, Input, Button, Alert, Typography, Space, Divider, message } from 'antd';
import { UnlockOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import CryptoJS from 'crypto-js';
import { useNotification } from '../contexts/NotificationContext';
const { TextArea } = Input;
const { Title, Text } = Typography;

/**
 * 前端解密函数
 */
export function decryptMysteelData(responseJson) {


  try {
    if (!responseJson || !responseJson.responseSecretKey || !responseJson.responseKeyOffset || !responseJson.response) {
      throw new Error("输入JSON缺少必要的字段 (responseSecretKey, responseKeyOffset, response)");
    }

    // 1. 解析 Key 和 IV
    const key = CryptoJS.enc.Base64.parse(responseJson.responseSecretKey);
    const iv = CryptoJS.enc.Base64.parse(responseJson.responseKeyOffset);

    // 2. 解密
    const decrypted = CryptoJS.AES.decrypt(
      responseJson.response,
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );

    // 3. 转为 UTF-8
    const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedStr) {
        throw new Error("解密结果为空，可能是 Key/IV 不匹配或密文损坏");
    }

    // 4. 解析 JSON
    return JSON.parse(decryptedStr);

  } catch (error) {
    console.error("解密流程错误:", error);
    throw error; // 抛出错误以便 UI 捕获
  }
}

const SecretDecryptPage = () => {
  const [inputValue, setInputValue] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

    const { messageApi } = useNotification();

  const handleDecrypt = () => {
    setError(null);
    setResult(null);

    if (!inputValue.trim()) {
      messageApi.warning('请输入加密的 JSON 数据');
      return;
    }

    try {
      // 1. 尝试将输入的字符串解析为 JSON 对象
      const inputObj = JSON.parse(inputValue);

      // 2. 调用解密函数
      const data = decryptMysteelData(inputObj);
      
      // 3. 设置结果
      setResult(data);
      messageApi.success('解密成功！');

    } catch (err) {
      messageApi.error(err.message ||'解密失败，请检查输入格式是否正确');
      setError(err.message || '解密失败，请检查输入格式是否正确');
    }
  };

  const handleClear = () => {
    setInputValue('');
    setResult(null);
    setError(null);
  };

  const handleCopyResult = () => {
      if(result) {
          navigator.clipboard.writeText(JSON.stringify(result, null, 2));
          messageApi.success('结果已复制到剪贴板');
      }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <Card title={<span><UnlockOutlined /> 数据解密调试工具</span>} bordered={false}>
        
        <Alert 
          message="使用说明"
          description="请在下方粘贴包含 'response', 'responseSecretKey', 'responseKeyOffset' 的完整 JSON 对象字符串。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div style={{ marginBottom: 16 }}>
          <Text strong>加密数据输入 (JSON):</Text>
          <TextArea
            rows={6}
            placeholder='Example: {"response": "...", "responseSecretKey": "...", "responseKeyOffset": "..."}'
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{ marginTop: 8, fontFamily: 'monospace' }}
          />
        </div>

        <Space style={{ marginBottom: 24 }}>
          <Button type="primary" icon={<UnlockOutlined />} onClick={handleDecrypt} size="large">
            开始解密
          </Button>
          <Button icon={<DeleteOutlined />} onClick={handleClear} size="large">
            清空
          </Button>
        </Space>

        {/* 错误显示区 */}
        {error && (
          <Alert
            message="解密错误"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* 结果显示区 */}
        {result && (
          <div style={{ border: '1px solid #d9d9d9', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong type="success">解密结果:</Text>
                <Button type="link" size="small" icon={<CopyOutlined />} onClick={handleCopyResult}>复制结果</Button>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <pre style={{ 
                margin: 0, 
                padding: '12px', 
                background: '#fff', 
                border: '1px solid #eee', 
                borderRadius: '4px',
                overflowX: 'auto',
                fontSize: '12px',
                fontFamily: 'Consolas, check-circle, Menlo, monospace'
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SecretDecryptPage;