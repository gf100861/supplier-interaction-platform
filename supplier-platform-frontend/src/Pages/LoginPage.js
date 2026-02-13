import React, { useState, useEffect, useRef } from 'react';
import { Typography, Divider } from 'antd';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Hexagon, Globe, Sun, Moon } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';
import './LoginPage.css';

const { Text, Link } = Typography;

// --- 🔧 新增：定义后端 API 基础地址 ---

const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const BACKEND_URL = isDev
    ? 'http://localhost:3001'  // 本地开发环境
    : 'https://supplier-interaction-platform-backend.vercel.app'; // Vercel 生产环境


// --- 1. 多语言字典配置 ---
const TRANSLATIONS = {
    zh: {
        sloganTitle: "量化工作价值，驱动供应链卓越表现。",
        sloganDesc: "专为 SDE 与 Buyer 打造的智能化工作台。记录每一次拜访，追踪每一个 RFQ，让数据说话。",
        welcome: "欢迎回来",
        subWelcome: "请输入您的企业账号以访问工作台",
        emailLabel: "邮箱",
        emailPlace: "请输入注册邮箱",
        pwdLabel: "密码",
        pwdPlace: "请输入密码",
        forgot: "忘记密码?",
        loginBtn: "登录系统",
        loggingIn: "登录中...",
        footer: "© 2026 Supplier Development System."
    },
    en: {
        sloganTitle: "Quantify Value, Drive Supply Chain Excellence.",
        sloganDesc: "Intelligent workspace for SDEs & Buyers. Track every visit, trace every RFQ, let data speak.",
        welcome: "Welcome Back",
        subWelcome: "Please enter your enterprise account to access.",
        emailLabel: "Email",
        emailPlace: "Enter your email",
        pwdLabel: "Password",
        pwdPlace: "Enter password",
        forgot: "Forgot Password?",
        loginBtn: "Sign In",
        loggingIn: "Signing in...",
        footer: "© 2026 Supplier Development System."
    }
};
// --- 错误翻译函数 (保持不变) ---
const translateError = (errorMsg) => {
    const msg = typeof errorMsg === 'string' ? errorMsg : (errorMsg?.message || '未知错误');
    if (msg.includes('Invalid login credentials')) return '登录凭证无效或已过期，请尝试重新登录';
    if (msg.includes('User not found')) return '用户不存在';
    if (msg.includes('JWT expired')) return '登录会话已过期，请刷新页面';
    if (msg.includes('Failed to fetch')) return '无法连接到服务器，请联系Louis';
    return msg;
};

// --- 工具函数：获取或生成 Session ID ---
const getSessionId = () => {
    let sid = sessionStorage.getItem('app_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        sessionStorage.setItem('app_session_id', sid);
    }
    return sid;
};

// --- IP 获取 ---
let cachedIpAddress = null;
const getClientIp = async () => {
    if (cachedIpAddress) return cachedIpAddress;
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        cachedIpAddress = data.ip;
        return data.ip;
    } catch (error) {
        return 'unknown';
    }
};

// --- [API] 通用系统日志上报函数 ---
const logSystemEvent = async (params) => {
    const {
        category = 'SYSTEM',
        eventType,
        severity = 'INFO',
        message,
        email = null,
        userId = null,
        meta = {}
    } = params;

    try {
        const apiPath = isDev ? '/api/system-log' : '/api/system-log';
        const targetUrl = `${BACKEND_URL}${apiPath}`;
        const clientIp = await getClientIp();
        const sessionId = getSessionId();

        const environmentInfo = {
            ip_address: clientIp,
            session_id: sessionId,
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            windowSize: `${window.innerWidth}x${window.innerHeight}`,
            url: window.location.href,
            referrer: document.referrer
        };

        //  使用 API_BASE_URL 拼接完整路径
        await fetch(`${targetUrl}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category,
                event_type: eventType,
                severity,
                message,
                user_email: email,
                user_id: userId,
                metadata: {
                    ...environmentInfo,
                    ...meta,
                    timestamp_client: new Date().toISOString()
                }
            })
        });

    } catch (e) {
        console.warn("Logger exception:", e);
    }
};





// --- 1. 定义轮播的句子数组 ---
const SLOGAN_SENTENCES = [
    "打破部门壁垒，实时追踪每一个问题的生命周期，从发现到解决。",
    "通过强大的数据分析，识别重复问题，量化供应商表现，驱动持续改进。",
    "自动化流程，简化沟通，让每一位SD和供应商都能聚焦于核心价值。",
    "连接每一个环节，实现智能决策。"
];

// --- 2. 新增：高级打字机 Hook (支持数组循环 + 删除效果) ---
const useTypewriterLoop = (sentences, typeSpeed = 100, deleteSpeed = 50, pauseTime = 2000) => {
    const [text, setText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [loopNum, setLoopNum] = useState(0);
    const [typingSpeed, setTypingSpeed] = useState(typeSpeed);

    useEffect(() => {
        let timer;

        const handleType = () => {
            const i = loopNum % sentences.length;
            const fullText = sentences[i];

            setText(isDeleting
                ? fullText.substring(0, text.length - 1)
                : fullText.substring(0, text.length + 1)
            );

            // 动态调整速度
            setTypingSpeed(isDeleting ? deleteSpeed : typeSpeed);

            // 逻辑判断
            if (!isDeleting && text === fullText) {
                // 打字完成，停顿一下，准备删除
                setTypingSpeed(pauseTime);
                setIsDeleting(true);
            } else if (isDeleting && text === '') {
                // 删除完成，切换到下一句，开始打字
                setIsDeleting(false);
                setLoopNum(loopNum + 1);
                setTypingSpeed(500); // 稍微停顿一下再开始打下一句
            }
        };

        timer = setTimeout(handleType, typingSpeed);

        return () => clearTimeout(timer);
    }, [text, isDeleting, loopNum, sentences, typeSpeed, deleteSpeed, pauseTime]);

    return text;
};

// --- Main Login Page ---
const LoginPage = () => {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const { messageApi } = useNotification();
    const [loading, setLoading] = useState(false);

    // 记录页面初始化时间
    const pageInitTime = useRef(Date.now());
    // 记录表单交互
    const [isAutoFill, setIsAutoFill] = useState(false);


    // --- 2. 新增状态：深色模式 & 语言 ---
    // 优先读取本地缓存，如果没有则默认 'zh' 和 false
    const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'zh');
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('app_theme') === 'dark');

    // 获取当前语言的文本
    const t = TRANSLATIONS[lang];

    // --- 3. 处理深色模式切换 ---
    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
            localStorage.setItem('app_theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('app_theme', 'light');
        }
    }, [isDarkMode]);

    // --- 4. 处理语言切换 ---
    const toggleLang = () => {
        const newLang = lang === 'zh' ? 'en' : 'zh';
        setLang(newLang);
        localStorage.setItem('app_lang', newLang);
    };

    useEffect(() => {
        // 全局错误监听
        const handleRuntimeError = (event) => {
            logSystemEvent({
                category: 'RUNTIME',
                eventType: 'JS_ERROR',
                severity: 'ERROR',
                message: event.message,
                meta: { filename: event.filename, lineno: event.lineno, stack: event.error?.stack }
            });
        };
        const handleUnhandledRejection = (event) => {
            logSystemEvent({
                category: 'RUNTIME',
                eventType: 'UNHANDLED_PROMISE',
                severity: 'ERROR',
                message: event.reason?.message || 'Unknown Promise Error',
                meta: { reason: JSON.stringify(event.reason) }
            });
        };

        window.addEventListener('error', handleRuntimeError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // 页面访问埋点
        logSystemEvent({
            category: 'INTERACTION',
            eventType: 'PAGE_VIEW',
            severity: 'INFO',
            message: 'User visited Login Page'
        });

        return () => {
            window.removeEventListener('error', handleRuntimeError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    // 监听输入框变化
    const handleFormChange = (changedValues) => {
        if (Date.now() - pageInitTime.current < 500) {
            setIsAutoFill(true);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault(); // 1. 阻止浏览器默认刷新页面的行为

        // 2. 从表单中提取数据
        const formData = new FormData(e.currentTarget);
        const values = {
            email: formData.get('email'),
            password: formData.get('password'),
        };

        // 3. 手动调用你原本的逻辑
        onFinish(values);
    };

    const onFinish = async (values) => {
        setLoading(true);
        const submitTime = Date.now();
        const stayDuration = submitTime - pageInitTime.current;

        // 1. 记录尝试
        logSystemEvent({
            category: 'AUTH',
            eventType: 'LOGIN_ATTEMPT',
            severity: 'INFO',
            message: 'User attempting to login',
            email: values.email,
            meta: { stay_duration_ms: stayDuration, is_likely_autofill: isAutoFill }
        });

        try {
            // ✅ 修改点 2: 使用 API_BASE_URL 拼接完整路径
            // 后端对应 server.js 中的 app.post('/api/auth/login', ...)
            const apiPath = isDev ? '/api/auth/login' : '/api/auth/login';
            const targetUrl = `${BACKEND_URL}${apiPath}`;
            const response = await fetch(`${targetUrl}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: values.email,
                    password: values.password
                })
            });

            const result = await response.json();

            if (!response.ok) {
                // 如果后端返回错误，抛出异常
                throw new Error(result.error || '登录失败');
            }

            // result 应该包含 { user: ..., session: ... }
            const userData = result.user;
            const sessionData = result.session; // 👈 获取后端返回的 session

            if (sessionData) {
                const { error: setSessionError } = await supabase.auth.setSession({
                    access_token: sessionData.access_token,
                    refresh_token: sessionData.refresh_token,
                });

                if (setSessionError) {
                    console.error("前端设置 Session 失败:", setSessionError);
                    // 可以选择抛出错误，或者继续（但刷新后会掉登录）
                }

                localStorage.setItem('access_token', sessionData.access_token);
            }

            const apiDuration = Date.now() - submitTime;

            // 2. 记录成功
            logSystemEvent({
                category: 'AUTH',
                eventType: 'LOGIN_SUCCESS',
                severity: 'INFO',
                message: 'Login successful',
                email: values.email,
                userId: userData.id,
                meta: {
                    api_duration_ms: apiDuration,
                    role: userData.role,
                    stay_duration_ms: stayDuration
                }
            });

            messageApi.success('登录成功!');
            localStorage.setItem('user', JSON.stringify(userData));

            navigate('/');

        } catch (error) {
            const apiDuration = Date.now() - submitTime;
            const translatedMsg = translateError(error.message);
            messageApi.error(translatedMsg);

            // 3. 记录失败
            logSystemEvent({
                category: 'AUTH',
                eventType: 'LOGIN_FAILED',
                severity: 'WARN',
                message: translatedMsg,
                email: values.email,
                meta: {
                    original_error: error.message,
                    api_duration_ms: apiDuration,
                    stay_duration_ms: stayDuration,
                    is_likely_autofill: isAutoFill,
                }
            });
        } finally {
            setLoading(false);
        }
    };

    const typedSlogan = useTypewriterLoop(SLOGAN_SENTENCES);

    return (



        <div className="flex min-h-screen w-full bg-white">

            {/* --- ✨ 右上角悬浮控制栏 (UI 协调的核心) --- */}
            <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
                {/* 语言切换按钮 */}
                <button
                    onClick={toggleLang}
                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 backdrop-blur-md border border-slate-200/20 shadow-sm hover:bg-slate-100/20 transition-all text-slate-600 dark:text-slate-300 dark:hover:text-white"
                >
                    <Globe className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">{lang}</span>
                </button>

                {/* 深色模式切换按钮 */}
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-slate-200/20 shadow-sm hover:bg-slate-100/20 transition-all text-slate-600 dark:text-yellow-400"
                >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>
            {/* --- 左侧：视觉装饰区 (Desktop Only) --- */}
            <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-12 text-white">
                {/* 背景装饰：动态感的圆环/光晕 */}

                <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none overflow-hidden">
                    {/* 1. 蓝色光晕 - 增加呼吸动画 */}
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600 rounded-full blur-3xl mix-blend-screen animate-blob"></div>

                    {/* 2. 紫色光晕 - 增加呼吸动画 + 延迟 */}
                    <div className="absolute top-1/3 left-1/2 w-[500px] h-[500px] bg-purple-600 rounded-full blur-3xl mix-blend-screen -translate-x-1/2 animate-blob animation-delay-2000"></div>

                    {/* 3. (可选) 新增一个青色光晕在底部，增加层次感 */}
                    <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-cyan-600 rounded-full blur-3xl mix-blend-screen animate-blob animation-delay-4000"></div>
                </div>

                {/* 顶部 Logo 区域 */}
                <div className="relative z-10 flex items-center gap-2">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <Hexagon className="w-6 h-6 text-white fill-current" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">Action Portal</span>
                </div>

                {/* 中间 Slogan */}
                <div className="relative z-10 max-w-lg">
                    <h2 className="text-4xl font-bold leading-tight mb-6">
                        协作共赢，<br />
                        驱动供应链卓越表现
                    </h2>

                    {/* 👇 替换原本静态的 <p> 标签 */}
                    <div className="h-24"> {/* 给一个固定高度，防止文字换行时页面抖动 */}
                        <p className="text-slate-400 text-lg leading-relaxed font-mono">
                            {typedSlogan}
                            {/* 光标闪烁效果 */}
                            <span className="animate-pulse border-r-2 border-blue-500 ml-1"></span>
                        </p>
                    </div>
                </div>

                {/* 底部版权/信息 */}
                <div className="relative z-10 text-sm text-slate-500">
                    © {new Date().getFullYear()} Volvo Construction Equipment. All Rights Reserved.
                </div>
            </div>

            {/* --- 右侧：登录表单区 --- */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative overflow-hidden">
                <div className="w-full max-w-md space-y-8">
                    {/* 光斑 1：蓝色 (左上) */}
                    <div className="absolute top-0 left-0 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>

                    {/* 光斑 2：紫色 (右上) - 延迟2秒 */}
                    <div className="absolute top-0 right-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

                    {/* 光斑 3：粉色 (底部) - 延迟4秒 */}
                    <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>


                    {/* 移动端 Logo (仅在手机显示) */}
                    <div className="flex lg:hidden items-center gap-2 mb-8">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <Hexagon className="w-6 h-6 text-white fill-current" />
                        </div>
                        <span className="text-xl font-bold text-slate-900">Action Portal</span>
                    </div>

                    {/* 欢迎语 */}
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                            欢迎回来
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            请输入您的账号以访问工作台
                        </p>
                    </div>


                    <form
                        className="mt-8 space-y-6"
                        onSubmit={handleSubmit}      // ✅ 正确：绑定原生提交事件
                        onChange={handleFormChange}  // ✅ 正确：原生监听输入变化用 onChange
                        autoComplete="off"
                    >
                        <div className="space-y-5">

                            {/* 邮箱输入 */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                                    邮箱
                                </label>
                                <div className="mt-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder="请输入注册邮箱"
                                    />
                                </div>
                            </div>

                            {/* 密码输入 */}
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                                    密码
                                </label>
                                <div className="mt-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder="请输入密码"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="text-slate-400 hover:text-slate-600 focus:outline-none"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-5 w-5" />
                                            ) : (
                                                <Eye className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-end mt-2">
                                    <Link href="/forgot-password" target="_blank">忘记密码？</Link>
                                </div>
                            </div>
                        </div>

                        {/* 登录按钮 */}
                        <button
                            type="primary"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    登录中...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    登录系统 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            )}
                        </button>
                    </form>
                    <p className="mt-2 text-center text-sm text-slate-600">
                        还没有账号?{" "}
                        <Link href="mailto:louis.xin@volvo.com" className="font-medium text-blue-600 hover:text-blue-400">
                            联系管理员开通
                        </Link>
                    </p>

                    <Divider style={{ margin: '10px 0' }} />

                    <div style={{ textAlign: 'center', marginTop: '12px' }} >
                        <Text type="secondary" style={{ fontSize: '12px' }} className="font-medium text-blue-600 hover:text-blue-500">
                            <Link href="/help-center" target="_blank" style={{ fontSize: '12px' }}>帮助中心</Link>
                            <Divider type="vertical" />
                            <Link href="/privacy-settings" target="_blank" style={{ fontSize: '12px' }}>隐私政策</Link>
                        </Text>
                    </div>
                </div>
            </div>
        </div>


    );
};

export default LoginPage;