import React from 'react';
import { ConfigProvider as AntdConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import all contexts
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { NoticeProvider } from './contexts/NoticeContext';
import { SupplierProvider } from './contexts/SupplierContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { CategoryProvider } from './contexts/CategoryContext';
import { AlertProvider } from './contexts/AlertContext';

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
// import ResetPasswordPage from './Pages/ResetPasswordPage'; // 如果不再使用可以注释掉
import NotFoundPage from './Pages/NotFoundPage'
import EditNoticePage from './Pages/EditNoticePage';
import IntelligentSearchPage from './Pages/IntelligentSearchPage';
import MobileTransferPage from './Pages/MobileTransferPage';
import HelpCenterPage from './Pages/help-center';
import { FileSender } from './Pages/OfflineSharePage';
import HistoricalImportPage from './Pages/HistoricalImportPage';
import UpdatePasswordPage from './Pages/UpdatePasswordPage';
import PrivacySettingsPage from './Pages/PrivacySettingsPage';
// This sub-component correctly applies the theme from the ThemeContext
const ThemedApp = () => {
    const { theme } = useTheme();
    const { antdLocale } = useLanguage();

    return (
        <AntdConfigProvider
            locale={antdLocale}
            theme={{
                algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
            }}
        >
            <NotificationProvider>
                <ConfigProvider>
                    <SupplierProvider>
                        <CategoryProvider>
                            <AlertProvider>
                                <NoticeProvider>
                                    <BrowserRouter>
                                        <Routes>
                                            {/* --- 公开/认证路由 (无侧边栏) --- */}
                                            <Route path="/login" element={<LoginPage />} />
                                            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                                            
                                            {/* 关键修改：UpdatePasswordPage 移到这里，与 Login 平级 */}
                                            <Route path="/update-password" element={<UpdatePasswordPage />} />
                                            
                                            {/* 帮助中心通常也是公开的或者独立布局 */}
                                            <Route path="/help-center" element={<HelpCenterPage />} />
                                            
                                            {/* 移动端上传页面通常也是独立的 */}
                                            <Route path="/mobile-transfer" element={<MobileTransferPage />} />
                                            <Route path="/privacy-settings" element={<PrivacySettingsPage />} />

                                            {/* --- 受保护路由 (有侧边栏 MainLayout) --- */}
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
                                                    <Route path="edit-notice/:id" element={<EditNoticePage />} />
                                                    <Route path="intelligence-search" element={<IntelligentSearchPage />} />
                                                    <Route path="offline-share" element={<FileSender />} />
                                                    <Route path="historical-import" element={<HistoricalImportPage />} />
                                                    
                                                    {/* 404 页面放在受保护区域内部，或者外部都可以，视需求而定 */}
                                                    <Route path="*" element={<NotFoundPage />} />
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

function App() {
    return (
        <ThemeProvider>
            <LanguageProvider>
                <ThemedApp />
            </LanguageProvider>
        </ThemeProvider>
    );
}

export default App;