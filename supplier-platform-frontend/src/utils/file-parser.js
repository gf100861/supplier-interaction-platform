// src/utils/file-parser.js
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// 【完美兼容方案】使用 v3 版本的 legacy entry，完美适配 React Webpack
import pdfWorker from 'pdfjs-dist/build/pdf.worker.entry';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const extractTextFromFile = async (file) => {
  const extension = file.name.split('.').pop().toLowerCase();

  try {
    if (extension === 'pdf') {
      return await parsePDF(file);
    } else if (extension === 'docx') {
      return await parseWord(file);
    } else if (['txt', 'md', 'csv'].includes(extension)) {
      return await parseText(file);
    } else {
      throw new Error("不支持的文件格式，目前仅支持 PDF, DOCX, TXT");
    }
  } catch (error) {
    console.error(`解析文件 ${file.name} 失败:`, error);
    throw error;
  }
};

const parsePDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  // v3 版本的标准调用方式
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
};

const parseWord = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

const parseText = async (file) => {
  return await file.text();
};