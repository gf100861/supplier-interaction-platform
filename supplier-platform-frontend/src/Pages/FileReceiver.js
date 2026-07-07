import React, { useEffect, useMemo } from 'react';
import { Button, notification, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';
import { saveAs } from 'file-saver';

// --- 组件 B: 文件接收器 ---
// (这是一个后台组件，不需要渲染任何UI)
export const FileReceiver = () => {
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const { notificationApi } = useNotification(); // 使用 antd 的 notification

    useEffect(() => {
        if (!currentUser?.id) {
            return; // 未登录，不监听
        }

        // --- 1. 下载文件的辅助函数 ---
        const handleDownload = async (fileRow) => {
            const key = `download-${fileRow.id}`;
            message.loading({ content: `正在准备下载 ${fileRow.file_name}...`, key });
            try {
                const { data, error } = await supabase.storage
                    .from('file_sync')
                    .download(fileRow.file_path);
                
                if (error) throw error;
                
                // 使用 file-saver 来触发下载
                saveAs(data, fileRow.file_name);
                message.success({ content: '下载已开始！', key });

                // (可选) 下载后自动删除通知
                await supabase.from('user_files').delete().eq('id', fileRow.id);

            } catch (error) {
                console.error('下载失败:', error);
                message.error({ content: `下载失败: ${error.message}`, key });
            }
        };

        // --- 2. 设置 Realtime 订阅 ---
        const channel = supabase
            .channel(`user_files:${currentUser.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'user_files',
                    filter: `user_id=eq.${currentUser.id}` // 关键：只监听自己的文件
                },
                (payload) => {
                    console.log('收到新文件通知:', payload);
                    const newFile = payload.new;
                    
                    // 3. 弹出通知
                    notificationApi.info({
                        message: '收到一个新文件',
                        description: `文件 "${newFile.file_name}" 已从您的另一台设备同步。`,
                        placement: 'topRight',
                        duration: 10, // 持续 10 秒
                        icon: <DownloadOutlined style={{ color: '#1890ff' }} />,
                        btn: (
                            <Button type="primary" size="small" onClick={() => handleDownload(newFile)}>
                                立即下载
                            </Button>
                        ),
                        key: newFile.id // 使用文件 ID 作为唯一键
                    });
                }
            )
            .subscribe((status, err) => {
                 if (status === 'SUBSCRIBED') {
                    console.log('已连接实时文件同步通道。');
                 }
                 if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('文件同步通道连接失败: ', err);
                 }
            });

        // --- 4. 清理订阅 ---
        return () => {
            supabase.removeChannel(channel);
        };
    
    }, [currentUser, notificationApi]); // 依赖 currentUser 和 notificationApi

    return null; 
};