import React, { Suspense, lazy } from 'react';
import { ConfigProvider as AntdConfigProvider, Spin, theme as antdTheme } from 'antd';
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

const LoginPage = lazy(() => import('./Pages/LoginPage'));
const NoticePage = lazy(() => import('./Pages/NoticePage'));
const FileUploadPage = lazy(() => import('./Pages/FileUploadPage'));
const SettingsPage = lazy(() => import('./Pages/SettingsPage'));
const AuditPlanPage = lazy(() => import('./Pages/AuditPlanPage'));
const DashboardPage = lazy(() => import('./Pages/DashboardPage'));
const BatchNoticeCreationPage = lazy(() => import('./Pages/BatchNoticeCreationPage'));
const ProblemAnalysisPage = lazy(() => import('./Pages/ProblemAnalysisPage'));
const ConsolidatedReportPage = lazy(() => import('./Pages/ConsolidatedReportPage'));
const AdminPage = lazy(() => import('./Pages/AdminPage'));
const ForgotPasswordPage = lazy(() => import('./Pages/ForgotPasswordPage'));
const NotFoundPage = lazy(() => import('./Pages/NotFoundPage'));
const EditNoticePage = lazy(() => import('./Pages/EditNoticePage'));
const IntelligentSearchPage = lazy(() => import('./Pages/IntelligentSearchPage'));
const MobileTransferPage = lazy(() => import('./Pages/MobileTransferPage'));
const HelpCenterPage = lazy(() => import('./Pages/help-center'));
const FileSender = lazy(() => import('./Pages/OfflineSharePage').then(module => ({ default: module.FileSender })));
const HistoricalImportPage = lazy(() => import('./Pages/HistoricalImportPage'));
const UpdatePasswordPage = lazy(() => import('./Pages/UpdatePasswordPage'));
const PrivacySettingsPage = lazy(() => import('./Pages/PrivacySettingsPage'));
const BatchMaterialParser = lazy(() => import('./Pages/BatchMaterialParser'));

const RouteFallback = () => (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
    </div>
);
// ResetPasswordPage is not currently routed.
// This sub-component correctly applies the theme from the ThemeContext
const ThemedApp = () => {
    const { theme } = useTheme();
    const { antdLocale } = useLanguage();

    return (
        <AntdConfigProvider
            locale={antdLocale}
            wave={{ disabled: true }}
            theme={{
                algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: {
                    motion: false,
                },
            }}
        >
            <NotificationProvider>
                <ConfigProvider>
                    <SupplierProvider>
                        <CategoryProvider>
                            <AlertProvider>
                                <NoticeProvider>
                                    <BrowserRouter>
                                        <Suspense fallback={<RouteFallback />}>
                                        <Routes>
                                            {/* --- 公开/认证路由 (无侧边栏) --- */}
                                            <Route path="/login" element={<LoginPage />} />
                                            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                                            
                                            {/* 关键修改：UpdatePasswordPage 移到这里，与 Login 平级 */}
                                            <Route path="/update-password" element={<UpdatePasswordPage />} />
                                            
                                            {/* 帮助中心通常也是公开的或者独立布局 */}
                                            <Route path="/help-center" element={<HelpCenterPage />} />
                                            
                                            {/* 移动端上传页面通常也是独立�?*/}
                                            <Route path="/mobile-transfer" element={<MobileTransferPage />} />
                                            <Route path="/privacy-settings" element={<PrivacySettingsPage />} />

                                            {/* --- 受保护路�?(有侧边栏 MainLayout) --- */}
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
                                                    <Route path="batch-material-parser" element={<BatchMaterialParser />} />
                                                    
                                                    {/* 404 页面放在受保护区域内部，或者外部都可以，视需求而定 */}
                                                    <Route path="*" element={<NotFoundPage />} />
                                                </Route>
                                            </Route>
                                        </Routes>
                                        </Suspense>
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
