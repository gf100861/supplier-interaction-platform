import React, { useState, useMemo, useEffect } from 'react';
import { Button, Modal, Form, Input, Select, Tag, Typography, Card, Popconfirm, Empty, Avatar, Space, Tooltip, Divider, Spin, Statistic, Row, Col } from 'antd';
import { PlusOutlined, UserOutlined, DeleteOutlined, AuditOutlined, TeamOutlined, LeftOutlined, RightOutlined, CheckCircleOutlined, DownloadOutlined, UndoOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSuppliers } from '../contexts/SupplierContext';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../supabaseClient';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

// --- Styles and Helper Components (no changes here) ---
const matrixStyles = { /* ... */ };
const EventCard = ({ item, onDelete, onComplete }) => { /* ... */ };

const AuditPlanPage = () => {
    const [events, setEvents] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [eventType, setEventType] = useState('audit');
    const [form] = Form.useForm();
    const [currentYear, setCurrentYear] = useState(dayjs().year());
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const { suppliers, loading: suppliersLoading } = useSuppliers();
    const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user')), []);
    const { messageApi } = useNotification();
    const navigate = useNavigate();

    // --- Data Fetching (no changes here) ---
    const fetchData = async () => { /* ... */ };
    useEffect(() => {
        fetchData();
    }, [currentYear]);

    // --- `managedSuppliers` logic is correct and remains the same ---
    const managedSuppliers = useMemo(() => {
        if (!currentUser || !suppliers) return [];
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') {
            return suppliers;
        }
        if (currentUser.role === 'SD') {
            const managed = currentUser.managed_suppliers || [];
            return managed.map(assignment => assignment.supplier).filter(Boolean);
        }
        return [];
    }, [currentUser, suppliers]);

    // ## CORE MODIFICATION 1: Filter events based on the user's role ##
    const filteredEvents = useMemo(() => {
        if (!currentUser) return [];
        
        // Manager and Admin can see all events for the selected year
        if (currentUser.role === 'Manager' || currentUser.role === 'Admin') {
            return events;
        }
        
        // SD can only see events related to their managed suppliers
        if (currentUser.role === 'SD') {
            const managedSupplierIds = managedSuppliers.map(s => s.id);
            return events.filter(event => managedSupplierIds.includes(event.supplier_id));
        }

        return []; // Suppliers are redirected, but as a fallback, show nothing.
    }, [events, currentUser, managedSuppliers]); // Add managedSuppliers as a dependency


    // --- All other handlers and memoized calculations remain the same ---
    const planStats = useMemo(() => { /* ... */ }, [filteredEvents]);
    const matrixData = useMemo(() => { /* ... */ }, [filteredEvents]);
    const handleMarkAsComplete = async (id, currentStatus) => { /* ... */ };
    const handleDeleteEvent = async (id) => { /* ... */ };
    const showAddModal = (type, prefilled = {}) => { /* ... */ };
    const handleCancel = () => setIsModalVisible(false);
    const handleFormSubmit = async (values) => { /* ... */ };
    const prevYear = () => setCurrentYear(currentYear - 1);
    const nextYear = () => setCurrentYear(currentYear + 1);
    const handleYearChange = (year) => setCurrentYear(year);
    const generateYearOptions = () => { /* ... */ };
    const handleExportExcel = async () => { /* ... */ };

    return (
        <div style={{ padding: '0 24px 24px 24px' }}>
            {/* --- Top control bar (no changes here) --- */}
            <Card style={{ marginBottom: '16px' }}>
                { /* ... */ }
            </Card>

            <Card
                title={`${currentYear} 年度规划矩阵`}
                extra={<Button icon={<DownloadOutlined />} onClick={handleExportExcel}>导出为Excel</Button>}
            >
                {(loading || suppliersLoading) ? <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div> : (
                    <div style={matrixStyles.scrollContainer}>
                        <div style={matrixStyles.table}>
                            {/* --- Header Row (no changes here) --- */}
                            <div style={matrixStyles.headerRow}>
                                { /* ... */ }
                            </div>
                            
                            {/* ## CORE MODIFICATION 2: Render rows based on `managedSuppliers` ## */}
                            {managedSuppliers.map(supplier => (
                                <div key={supplier.id} style={matrixStyles.bodyRow}>
                                    <div style={{ ...matrixStyles.stickyCell, flex: '0 0 100px', left: 0 }}>
                                        <Text type="secondary">{supplier.parma_id}</Text>
                                    </div>
                                    <div style={{ ...matrixStyles.stickyCell, flex: '0 0 100px', left: 100 }}>
                                        <Tag>{supplier.cmt}</Tag>
                                    </div>
                                    <div style={{ ...matrixStyles.stickyCell, flex: '0 0 160px', left: 200, fontWeight: 'bold' }}>
                                        {supplier.short_code}
                                    </div>

                                    {/* Month cells rendering logic remains the same */}
                                    {Array.from({ length: 12 }).map((_, monthIndex) => {
                                        const itemsInCell = matrixData[supplier.name]?.[monthIndex] || [];
                                        return (
                                            <div key={monthIndex} style={{...matrixStyles.cell, /* ... */ }}>
                                                {/* ... (EventCard mapping) ... */}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Card>

            {/* --- Modal for adding events (no changes here) --- */}
            <Modal /* ... */ >
                { /* ... */ }
            </Modal>
        </div>
    );
};

export default AuditPlanPage;