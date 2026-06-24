import React, { useState, useRef } from 'react';
import { extractTextFromFile } from '../utils/file-parser';
import { UploadCloud, File, CheckCircle, Loader2, AlertCircle, Play } from 'lucide-react';

// 👇 加上你自己的环境配置
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BACKEND_URL = isDev
    ? 'http://localhost:3001' 
    : window.location.origin;

const BatchMaterialParser = () => {
  const [filesData, setFilesData] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalJsonArray, setFinalJsonArray] = useState([]);

  // 递归读取文件夹内的文件
  const traverseFileTree = async (item, path = '') => {
    let files = [];
    if (item.isFile) {
      const file = await new Promise((resolve) => item.file(resolve));
      // 过滤掉隐藏文件和不支持的文件
      if (!file.name.startsWith('.') && file.name.match(/\.(pdf|docx|txt)$/i)) {
        files.push(file);
      }
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      const entries = await new Promise((resolve) => {
        dirReader.readEntries((results) => resolve(results));
      });
      for (let entry of entries) {
        files = files.concat(await traverseFileTree(entry, path + item.name + '/'));
      }
    }
    return files;
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const items = e.dataTransfer.items;
    let extractedFiles = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i].webkitGetAsEntry();
      if (item) {
        const result = await traverseFileTree(item);
        extractedFiles = extractedFiles.concat(result);
      }
    }

    // 初始化文件状态
    const newFilesData = extractedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      name: file.name,
      status: 'pending', // pending, extracting, ai-analyzing, success, error
      jsonResult: null,
      errorMsg: ''
    }));

    setFilesData(prev => [...prev, ...newFilesData]);
  };

  // 开始批量处理
  const startProcessing = async () => {
    setIsProcessing(true);
    let results = [...finalJsonArray];

    for (let i = 0; i < filesData.length; i++) {
      let currentFile = filesData[i];
      if (currentFile.status === 'success') continue;

      try {
        updateFileState(currentFile.id, { status: 'extracting' });
        const textContent = await extractTextFromFile(currentFile.file);

        updateFileState(currentFile.id, { status: 'ai-analyzing' });
        
        // 【关键修改】：使用 FormData 构建请求
        const formData = new FormData();
        formData.append('file', currentFile.file); // 原始文件用于上传 Storage
        formData.append('inputData', textContent); // 提取的文本用于 AI
        formData.append('model', 'qwen-plus');

        const response = await fetch(`${BACKEND_URL}/api/ai/analyze-learning`, {
           method: 'POST',
           // 注意：使用 FormData 时，不要手动设置 Content-Type，浏览器会自动处理 boundary
           body: formData
        });

        const resData = await response.json();
        
        if (!resData.success) throw new Error(resData.error || "解析失败");

        updateFileState(currentFile.id, { 
          status: 'success', 
          jsonResult: resData.data 
        });
        results.push(resData.data);

      } catch (error) {
        updateFileState(currentFile.id, { 
          status: 'error', 
          errorMsg: error.message 
        });
      }
    }

    setFinalJsonArray(results);
    setIsProcessing(false);
  };

  const updateFileState = (id, newState) => {
    setFilesData(prev => prev.map(f => f.id === id ? { ...f, ...newState } : f));
  };

  // 渲染单个文件的状态图标
  const renderStatusIcon = (status) => {
    switch(status) {
      case 'pending': return <div className="w-4 h-4 rounded-full bg-gray-200" />;
      case 'extracting': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'ai-analyzing': return <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">学习资料 AI 批量解析工作台</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 左侧：拖拽区与文件列表 */}
        <div className="space-y-4">
          <div 
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <UploadCloud className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700">拖拽整个文件夹或多个文件到这里</h3>
            <p className="text-sm text-gray-500 mt-2">支持 PDF, DOCX, TXT 格式 (浏览器本地直接提取文本，极速安全)</p>
          </div>

          {filesData.length > 0 && (
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <span className="font-medium text-gray-700">待处理队列 ({filesData.length})</span>
                <button 
                  onClick={startProcessing}
                  disabled={isProcessing}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {isProcessing ? '处理中...' : '开始 AI 解析'}
                </button>
              </div>
              <ul className="max-h-[500px] overflow-y-auto divide-y">
                {filesData.map((item) => (
                  <li key={item.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate" title={item.name}>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <span className="text-xs text-gray-500">
                        {item.status === 'extracting' && '提取文本中...'}
                        {item.status === 'ai-analyzing' && 'AI 分析中...'}
                        {item.status === 'error' && item.errorMsg}
                      </span>
                      {renderStatusIcon(item.status)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 右侧：最终的 JSON 结果展示区 */}
        <div className="bg-gray-900 rounded-xl shadow-inner flex flex-col h-[700px]">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-white font-medium">生成的 JSON 数据</h3>
            <button 
              onClick={() => navigator.clipboard.writeText(JSON.stringify(finalJsonArray, null, 2))}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
            >
              一键复制
            </button>
          </div>
          <div className="p-4 flex-1 overflow-auto">
            <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
              {finalJsonArray.length === 0 
                ? '// 等待处理...\n[]' 
                : JSON.stringify(finalJsonArray, null, 2)}
            </pre>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BatchMaterialParser;