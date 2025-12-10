import React, { useState, useEffect } from 'react';
import { 
    FileExcelOutlined, FilePdfOutlined, FileTextOutlined, 
    DatabaseOutlined, LineChartOutlined, 
    RobotOutlined, SearchOutlined, ThunderboltFilled,
    CheckCircleFilled, CloudServerOutlined, SafetyCertificateFilled,
    ReloadOutlined
} from '@ant-design/icons';
import { Typography } from 'antd';
import './SystemIntroVideo.css';

const { Title, Text } = Typography;

const SystemIntroVideo = () => {
    const [scene, setScene] = useState(0); // 0: Init, 1: Digitization, 2: AI, 3: Outro

    useEffect(() => {
        let timer;

        // 使用链式时间轴：当前场景进入后，预约下一个场景
        if (scene === 0) {
            // 0 -> 1: 初始启动
            timer = setTimeout(() => setScene(1), 100);
        } else if (scene === 1) {
            // 1 -> 2: 数字化场景展示 5秒
            timer = setTimeout(() => setScene(2), 4000);
        } else if (scene === 2) {
            // 2 -> 3: AI场景展示 6秒
            timer = setTimeout(() => setScene(3), 6000);
        }
        // 场景 3 是终点，不需要设置定时器

        return () => clearTimeout(timer);
    }, [scene]);

    const handleReplay = () => {
        setScene(0); // 重置为 0，触发 useEffect 重新开始流程
    };

    return (
        <div className="video-container">
            {/* 动态科技背景 */}
            <div className="tech-background">
                <div className="grid-overlay"></div>
                <div className="floating-particle p1"></div>
                <div className="floating-particle p2"></div>
                <div className="floating-particle p3"></div>
            </div>

            {/* --- 场景 1: 数字化 (Digitization) --- */}
            <div className={`scene scene-1 ${scene === 1 ? 'active' : scene > 1 ? 'exit' : ''}`}>
                <div className="data-stream-container">
                    {/* 飞入的文件 */}
                    <div className="flying-file f1"><FileExcelOutlined /></div>
                    <div className="flying-file f2"><FilePdfOutlined /></div>
                    <div className="flying-file f3"><FileTextOutlined /></div>
                    <div className="flying-file f4"><FileExcelOutlined /></div>
                    
                    {/* 中央处理核心 */}
                    <div className="core-processor">
                        <div className="core-ring"></div>
                        <div className="core-inner">
                            <DatabaseOutlined className="db-icon" />
                        </div>
                        <div className="data-beams">
                            <div className="beam b1"></div>
                            <div className="beam b2"></div>
                            <div className="beam b3"></div>
                        </div>
                    </div>

                    {/* 结果图表 */}
                    <div className="result-card">
                        <LineChartOutlined className="chart-icon" />
                        <div className="card-glint"></div>
                    </div>
                </div>
                
                <div className="scene-text-wrapper">
                    <Title level={3} className="main-title">全流程数字化</Title>
                    <Text className="sub-title">Data Driven · 透明高效</Text>
                </div>
            </div>

            {/* --- 场景 2: AI 智能 (AI Intelligence) --- */}
            <div className={`scene scene-2 ${scene === 2 ? 'active' : scene > 2 ? 'exit' : ''}`}>
                <div className="ai-container">
                    <div className="brain-hologram">
                        <div className="holo-ring r1"></div>
                        <div className="holo-ring r2"></div>
                        <RobotOutlined className="robot-main" />
                    </div>
                    
                    <div className="search-interface">
                        <div className="search-bar-glass">
                            <SearchOutlined className="search-icon-anim" />
                            <span className="typewriter">查询：历史防锈油质量问题...</span>
                        </div>
                        
                        {/* 知识图谱连接线 */}
                        <div className="neural-network">
                            <div className="connection c1"></div>
                            <div className="connection c2"></div>
                            <div className="node n1"><ThunderboltFilled /> <span>缺陷库</span></div>
                            <div className="node n2"><CloudServerOutlined /> <span>历史归档</span></div>
                            <div className="node n3"><SafetyCertificateFilled /> <span>8D报告</span></div>
                        </div>
                    </div>
                </div>

                <div className="scene-text-wrapper">
                    <Title level={3} className="main-title">AI 智慧赋能</Title>
                    <Text className="sub-title">Intelligent Search · 辅助决策</Text>
                </div>
            </div>

            {/* --- 场景 3: 定版 (Outro) --- */}
            <div className={`scene scene-3 ${scene === 3 ? 'active' : ''}`}>
                <div className="outro-container">
                    <div className="logo-halo"></div>
                    <div className="logo-box">
                        <img src="/system-logo.png" alt="Logo" className="final-logo" onError={(e) => e.target.style.display='none'} />
                    </div>
                    
                    <div className="text-reveal">
                        <Title level={2} style={{ color: '#fff', marginBottom: 12 }}>供应商交互平台</Title>
                        <div className="features-pill">
                            <span>协同</span><span className="sep">/</span>
                            <span>洞察</span><span className="sep">/</span>
                            <span>提升</span><span className="sep">/</span>
                            <span>创新</span>
                        </div>
                    </div>
                    
                    {/* 直接显示 Replay 按钮 */}
                    <button className="replay-btn-glass" onClick={handleReplay}>
                        <ReloadOutlined /> 重播演示
                    </button>
                </div>
            </div>
            
            {/* 底部进度条 */}
            <div className="cinematic-bar">
                <div className={`cinematic-fill ${scene > 0 && scene < 3 ? 'playing' : scene === 3 ? 'finished' : ''}`}></div>
            </div>
        </div>
    );
};

export default SystemIntroVideo;