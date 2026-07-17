import {
    getActionPlanLines,
    getEvidenceLines,
    getLatestActionPlanDeadline,
    hydrateReportGroups,
} from './consolidatedReportData';

describe('consolidated report data', () => {
    test('uses the latest supplier action plan submission', () => {
        const history = [
            {
                type: 'supplier_plan_submission',
                actionPlans: [{ plan: 'Old plan', responsible: 'Old owner', deadline: '2026-08-01' }],
            },
            { type: 'sd_plan_rejection', description: 'Please revise' },
            {
                type: 'supplier_plan_submission',
                actionPlans: [{ plan: 'Revised plan', responsible: 'New owner', deadline: '2026-08-15' }],
            },
        ];

        expect(getActionPlanLines(history)).toEqual([
            'Revised plan | 负责人: New owner',
        ]);
        expect(getLatestActionPlanDeadline(history)).toBe('2026-08-15');
    });

    test('does not fall back to stale content when the latest submission is empty', () => {
        const history = [
            { type: 'supplier_plan_submission', actionPlans: [{ plan: 'Old plan' }] },
            { type: 'supplier_plan_submission', actionPlans: [] },
            { type: 'supplier_evidence_submission', actionPlans: [{ evidenceDescription: 'Old evidence' }] },
            { type: 'supplier_evidence_submission', actionPlans: [] },
        ];

        expect(getActionPlanLines(history)).toEqual([]);
        expect(getEvidenceLines(history)).toEqual([]);
    });

    test('uses the latest evidence and supports image, attachment, and URL variants', () => {
        const history = [
            {
                type: 'supplier_evidence_submission',
                actionPlans: [{ evidenceDescription: 'Old evidence' }],
            },
            { type: 'sd_evidence_rejection', description: 'Please upload clearer evidence' },
            {
                type: 'supplier_evidence_submission',
                actionPlans: [{
                    action_plan: 'Revised plan',
                    evidence_description: 'Completed on site',
                    evidence_images: ['https://example.com/photo.jpg'],
                    evidence_attachments: [{ fileName: 'report.pdf', downloadUrl: 'https://example.com/report.pdf' }],
                }],
            },
        ];

        const evidence = getEvidenceLines(history);
        expect(evidence).toHaveLength(1);
        expect(evidence[0]).toContain('Revised plan');
        expect(evidence[0]).toContain('Completed on site');
        expect(evidence[0]).toContain('https://example.com/photo.jpg');
        expect(evidence[0]).toContain('report.pdf: https://example.com/report.pdf');
        expect(evidence[0]).not.toContain('Old evidence');
    });

    test('hydrates lightweight notices before deriving action plan and evidence', async () => {
        const groupedData = {
            Audit: [{ id: 'notice-1', isLightweight: true, history: [], actions: [], findings: [] }],
        };
        const fetchDetail = jest.fn().mockResolvedValue({
            id: 'notice-1',
            history: [
                {
                    type: 'supplier_plan_submission',
                    actionPlans: [
                        { plan: 'Fix tooling', deadline: '2026-09-10' },
                        { plan: 'Validate tooling', deadline: '2026-09-25' },
                    ],
                },
                {
                    type: 'supplier_evidence_submission',
                    actionPlans: [{ plan: 'Fix tooling', evidenceDescription: 'Tooling fixed' }],
                },
            ],
        });

        const hydrated = await hydrateReportGroups({
            groupedData,
            categories: ['Audit'],
            fetchDetail,
        });

        expect(fetchDetail).toHaveBeenCalledWith('notice-1');
        expect(hydrated.Audit[0].actions[0]).toContain('Fix tooling');
        expect(hydrated.Audit[0].evidence[0]).toContain('Tooling fixed');
        expect(hydrated.Audit[0].findings).toEqual(hydrated.Audit[0].evidence);
        expect(hydrated.Audit[0].deadline).toBe('2026-09-25');
    });
});
