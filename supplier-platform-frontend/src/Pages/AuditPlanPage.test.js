import fs from 'fs';
import path from 'path';

describe('AuditPlanPage interaction safeguards', () => {
    const pageSource = fs.readFileSync(path.join(__dirname, 'AuditPlanPage.js'), 'utf8');
    const pageStyles = fs.readFileSync(path.join(__dirname, 'AuditPlanPage.css'), 'utf8');

    test('column resizing uses throttled pointer events with bounded widths', () => {
        expect(pageSource).toContain("document.addEventListener('pointermove', handlePointerMove)");
        expect(pageSource).toContain("document.removeEventListener('pointermove', handlePointerMove)");
        expect(pageSource).toContain('requestAnimationFrame(() =>');
        expect(pageSource).toContain('Math.min(480, Math.max(100, startWidth + moveEvent.clientX - startX))');
        expect(pageSource).toContain('onPointerDown={handleResizePointerDown(index)}');
    });

    test('fullscreen matrix fits the viewport and owns its scroll area', () => {
        expect(pageSource).toContain('width="100vw"');
        expect(pageSource).toContain('wrapClassName="audit-plan-fullscreen-modal"');
        expect(pageSource).toContain('className="audit-plan-fullscreen-table"');
        expect(pageStyles).toMatch(/\.audit-plan-fullscreen-modal \.ant-modal\s*\{[\s\S]*width:\s*100vw\s*!important;/);
        expect(pageStyles).toMatch(/\.audit-plan-fullscreen-table\s*\{[\s\S]*overflow:\s*auto;/);
    });
});
