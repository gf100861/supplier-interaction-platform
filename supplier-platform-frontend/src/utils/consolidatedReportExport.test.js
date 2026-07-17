import { createConsolidatedReportWorkbook, REPORT_COLUMNS } from './consolidatedReportExport';

describe('consolidated report workbook', () => {
    test('keeps webpage column order and includes product, action plan, and evidence', async () => {
        const category = 'Process Audit';
        const groupedData = {
            [category]: [{
                title: 'Audit item',
                status: '已完成',
                deadline: '2026-08-20',
                supplier: { parmaId: 'P001', shortCode: 'SUP-A' },
                sdNotice: { createTime: '2026-07-17T08:00:00Z', details: { product: 'Brake System' } },
                details: { product: 'Brake System', title: 'Torque check', description: 'Out of tolerance' },
                actions: [],
                findings: [],
                history: [
                    { type: 'supplier_plan_submission', actionPlans: [{ plan: 'Replace fixture', responsible: 'Alex', deadline: '2026-08-20' }] },
                    { type: 'supplier_evidence_submission', actionPlans: [{
                        evidenceDescription: 'Fixture replaced',
                        evidenceImages: [{ name: 'photo.jpg', url: 'https://example.com/photo.jpg' }],
                        evidenceAttachments: [{ name: 'report.pdf', url: 'https://example.com/report.pdf' }],
                    }] },
                ],
            }],
        };

        const workbook = createConsolidatedReportWorkbook({
            groupedData,
            categories: [category],
            generatedAt: new Date('2026-07-17T10:00:00Z'),
        });
        const worksheet = workbook.getWorksheet(category);
        const headers = worksheet.getRow(4).values.slice(1);
        expect(headers).toEqual(REPORT_COLUMNS.map(column => column.header));
        expect(worksheet.getRow(5).getCell(3).value).toBe('Brake System');
        expect(worksheet.getRow(5).getCell(7).value).toContain('Replace fixture');
        expect(worksheet.getRow(5).getCell(7).value).not.toContain('2026-08-20');
        expect(worksheet.getRow(5).getCell(8).value).toContain('photo.jpg');
        expect(worksheet.getRow(5).getCell(8).value).toContain('report.pdf');
        expect(worksheet.getRow(5).getCell(10).value).toBe('2026-08-20');
        expect(worksheet.views[0]).toMatchObject({ state: 'frozen', xSplit: 3, ySplit: 4 });

        const buffer = await workbook.xlsx.writeBuffer();
        expect(buffer.byteLength).toBeGreaterThan(5000);
    });
});
