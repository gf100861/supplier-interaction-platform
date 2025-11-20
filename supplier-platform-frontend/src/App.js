
import { ConfigProvider as AntdConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import all contexts
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

import { NoticeProvider } from './contexts/NoticeContext';
import { SupplierProvider } from './contexts/SupplierContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { CategoryProvider } from './contexts/CategoryContext'; // <-- 1. 导入
import { AlertProvider } from './contexts/AlertContext'; // <-- 1. 在这里导入 AlertProvider
// Import all pages and components
import MainLayout from './Components/MainLayout';
import ProtectedRoute from './Components/ProtectedRoute';
import LoginPage from './Pages/LoginPage';
import NoticePage from './Pages/NoticePage';
import FileUploadPage from './Pages/FileUploadPage';
import SettingsPage from './Pages/SettingsPage';
import AuditPlanPage from './Pages/AuditPlanPage';
import DashboardPage from './Pages/DashboardPage';
import BatchNoticeCreationPage from './Pages/BatchNoticeCreationPage';
import ProblemAnalysisPage from './Pages/ProblemAnalysisPage';
import ConsolidatedReportPage from './Pages/ConsolidatedReportPage';
import AdminPage from './Pages/AdminPage';
import ForgotPasswordPage from './Pages/ForgotPasswordPage';
import ResetPasswordPage from './Pages/ResetPasswordPage';
import NotFoundPage from './Pages/NotFoundPage'
import EditNoticePage from './Pages/EditNoticePage'; // <-- 1. 导入新页面
import IntelligentSearchPage from './Pages/IntelligentSearchPage';
import MobileTransferPage from './Pages/MobileTransferPage';
import { FileSender } from './Pages/OfflineSharePage';
// This sub-component correctly applies the theme from the ThemeContext
const ThemedApp = () => {
    const { theme } = useTheme();

    return (
        <AntdConfigProvider
            locale={zhCN}
            theme={{
                algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
            }}
        >
            {/* 1. 基础 Provider (无内部依赖) */}
            <NotificationProvider>
                {/* 2. 依赖基础 Provider 的业务 Provider */}
                <ConfigProvider>
                    <SupplierProvider>
                        <CategoryProvider>
                            <AlertProvider>

                                <NoticeProvider>
                                    {/* 3. 路由和UI */}
                                    <BrowserRouter>
                                        <Routes>
                                            <Route path="/login" element={<LoginPage />} />
                                            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                                            <Route path="/reset-password" element={<ResetPasswordPage />} />
                                            <Route element={<ProtectedRoute />}>
                                                <Route path="/" element={<MainLayout />}>
                                                    <Route index element={<DashboardPage />} />
                                                    <Route path="notices" element={<NoticePage />} />
                                                    <Route path="audit-plan" element={<AuditPlanPage />} />
                                                    <Route path="batch-create" element={<BatchNoticeCreationPage />} />
                                                    <Route path="upload" element={<FileUploadPage />} />
                                                    <Route path="settings" element={<SettingsPage />} />
                                                    <Route path="analysis" element={<ProblemAnalysisPage />} />
                                                    <Route path="reports" element={<ConsolidatedReportPage />} />
                                                    <Route path="admin" element={<AdminPage />} />
                                                    <Route path="edit-notice/:id" element={<EditNoticePage />} /> {/* <-- 2. 添加新路由 */}
                                                    <Route path="intelligence-search" element={<IntelligentSearchPage />}></Route>
                                                    <Route path="offline-share" element={< FileSender/>}></Route>
                                                    <Route path="/mobile-transfer" element={<MobileTransferPage />} />
                                                    <Route path="*" element={< NotFoundPage />} />
                                                </Route>
                                            </Route>
                                        </Routes>
                                    </BrowserRouter>

                                </NoticeProvider>
                            </AlertProvider>


                        </CategoryProvider>
                    </SupplierProvider>
                </ConfigProvider>
            </NotificationProvider>

        </AntdConfigProvider>
    );
}

// The final App component wraps everything in the ThemeProvider
function App() {
    return (
        <ThemeProvider>
            <ThemedApp />
        </ThemeProvider>
    );
}

export default App;