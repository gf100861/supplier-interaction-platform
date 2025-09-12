import React, { useState, useMemo } from 'react';
import { Card, Row, Col, Typography, DatePicker, Select, Space, Empty } from 'antd';
import { Bar, Pie, Column, Line } from '@ant-design/charts'; // Import Line chart
import { useSuppliers } from '../contexts/SupplierContext';
import { mockNoticesData, noticeCategories } from '../data/_mockData';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const ProblemAnalysisPage = () => {
    const { suppliers } = useSuppliers();

    const [dateRange, setDateRange] = useState([dayjs().startOf('year'), dayjs().endOf('year')]);
    const [selectedSuppliers, setSelectedSuppliers] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);

    const filteredData = useMemo(() => {
        const cleanData = mockNoticesData.map(n => ({ ...n, category: n.category || '未分类' }));

        return cleanData.filter(notice => {
            const createTime = dayjs(notice.sdNotice.createTime);
            const [start, end] = dateRange || [];
            const isDateMatch = !start || (createTime.isAfter(start) && createTime.isBefore(end));
            const isSupplierMatch = selectedSuppliers.length === 0 || selectedSuppliers.includes(notice.assignedSupplierId);
            const isCategoryMatch = selectedCategories.length === 0 || selectedCategories.includes(notice.category);
            return isDateMatch && isSupplierMatch && isCategoryMatch;
        });
    }, [dateRange, selectedSuppliers, selectedCategories]);

    // Data for Bar Chart (Supplier Problems) - Stays the same
    const supplierProblemData = useMemo(() => {
        const counts = filteredData.reduce((acc, notice) => {
            acc[notice.assignedSupplierName] = (acc[notice.assignedSupplierName] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts)
            .map(([name, count]) => ({ supplier: name, count }))
            .sort((a, b) => a.count - b.count);
    }, [filteredData]);

    // --- NEW: Data processing specifically for the Line Chart ---
    const monthlyTrendData = useMemo(() => {
        const monthlyCounts = filteredData.reduce((acc, notice) => {
            const month = dayjs(notice.sdNotice.createTime).format('YYYY-MM');
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(monthlyCounts)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month)); // Sort by month
    }, [filteredData]);



    // --- Chart Configurations ---
    const barConfig = {
        data: supplierProblemData,
        xField: 'count',
        yField: 'supplier',
        seriesField: 'supplier',
        legend: false,
    };

    // --- NEW: Configuration for the Line Chart ---
    const lineConfig = {
        data: monthlyTrendData,
        xField: 'month',
        yField: 'count',
        point: { shapeField: 'square', sizeField: 4 },
        interaction: { tooltip: { marker: false } },
        style: { lineWidth: 2 },
        tooltip: { formatter: (datum) => ({ name: '问题数量', value: datum.count }) }
    };
    
    // Other chart configs...

    return (
        <div>
            <Card style={{ marginBottom: 16 }}>
                <Title level={4}>历史问题追踪与分析</Title>
                <Paragraph type="secondary">通过筛选供应商、问题类型和时间范围，洞察问题趋势与分布。</Paragraph>
                <Space wrap>
                    <RangePicker value={dateRange} onChange={setDateRange} />
                    <Select
                        mode="multiple"
                        allowClear
                        style={{ width: 250 }}
                        placeholder="筛选供应商 (默认全部)"
                        onChange={setSelectedSuppliers}
                        options={suppliers.map(s => ({ label: s.name, value: s.id }))}
                    />
                    <Select
                        mode="multiple"
                        allowClear
                        style={{ width: 250 }}
                        placeholder="筛选问题类型 (默认全部)"
                        onChange={setSelectedCategories}
                        options={noticeCategories.map(c => ({ label: c, value: c }))}
                    />
                </Space>
            </Card>

            {filteredData.length > 0 ? (
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <Card title="各供应商问题数量统计">
                            <Bar {...barConfig} height={Math.max(200, supplierProblemData.length * 40)} />
                        </Card>
                    </Col>
                    
                    {/* --- Corrected Line Chart Section --- */}
                    <Col span={24}>
                        <Card title="月度问题趋势">
                            <Line {...lineConfig} height={300} />
                        </Card>
                    </Col>
                    
                    {/* Pie charts and Stacked Bar charts would go here... */}

                </Row>
            ) : (
                <Card><Empty description="根据当前筛选条件，暂无数据可供分析。" /></Card>
            )}
        </div>
    );
};

export default ProblemAnalysisPage;