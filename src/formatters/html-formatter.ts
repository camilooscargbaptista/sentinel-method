import { ValidationResult } from '../types';

/**
 * Gera relatório HTML profissional — design futurista, dark mode,
 * radar chart SVG, tabela interativa, otimizado para print/PDF.
 * Self-contained: zero dependências externas.
 */
export function formatHTML(result: ValidationResult): string {
  const scored = result.results.filter(r => r.score !== undefined);
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length)
    : 0;

  const statusText = result.success ? 'PASSED' : 'FAILED';
  const statusColor = result.success ? '#00e5a0' : '#ff4757';
  const errorCount = result.results.reduce((s, r) => s + r.issues.filter(i => i.severity === 'error').length, 0);
  const warnCount = result.summary.warnings;
  const infoCount = result.results.reduce((s, r) => s + r.issues.filter(i => i.severity === 'info').length, 0);
  const durationStr = result.duration !== undefined
    ? (result.duration >= 1000 ? `${(result.duration / 1000).toFixed(2)}s` : `${result.duration}ms`)
    : '—';

  // Grade do score agregado
  const gradeMap = (s: number) => s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F';
  const grade = gradeMap(avgScore);
  const gradeColor = avgScore >= 80 ? '#00e5a0' : avgScore >= 60 ? '#ffa502' : '#ff4757';

  // ── Radar Chart SVG ──
  const radarSize = 200;
  const radarCenter = radarSize;
  const radarRadius = radarSize * 0.75;
  const radarData = scored.map(r => (r.score ?? 0) / 100);
  const radarLabels = scored.map(r => {
    const short: Record<string, string> = {
      'Testing Coverage': 'Testing',
      'Security Scanning': 'Security',
      'Performance Benchmarks': 'Performance',
      'Maintainability Checker': 'Maintainability',
      'Dependency Analysis': 'Dependencies',
      'Documentation Coverage': 'Docs',
      'Code Style': 'Style',
      'Architecture Analysis': 'Architecture',
      'API Contracts': 'API',
      'Accessibility (WCAG)': 'A11y',
      'Internationalization': 'i18n',
      'Error Handling': 'Errors',
      'Type Safety': 'Types',
      'Dead Code Detection': 'Dead Code',
    };
    return short[r.validator] || r.validator;
  });
  const n = radarData.length;

  // Grids intermediários (25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = gridLevels.map(level => {
    const pts = Array.from({ length: n }, (_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return `${radarCenter + radarRadius * level * Math.cos(angle)},${radarCenter + radarRadius * level * Math.sin(angle)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#2a2f3a" stroke-width="1"/>`;
  }).join('');

  // Eixos
  const axisLines = Array.from({ length: n }, (_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x2 = radarCenter + radarRadius * Math.cos(angle);
    const y2 = radarCenter + radarRadius * Math.sin(angle);
    return `<line x1="${radarCenter}" y1="${radarCenter}" x2="${x2}" y2="${y2}" stroke="#2a2f3a" stroke-width="1"/>`;
  }).join('');

  // Polígono de dados
  const dataPoints = radarData.map((v, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `${radarCenter + radarRadius * v * Math.cos(angle)},${radarCenter + radarRadius * v * Math.sin(angle)}`;
  }).join(' ');

  // Labels
  const radarLabelsSvg = radarLabels.map((label, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const lx = radarCenter + (radarRadius + 28) * Math.cos(angle);
    const ly = radarCenter + (radarRadius + 28) * Math.sin(angle);
    const anchor = Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
    return `<text x="${lx}" y="${ly + 4}" text-anchor="${anchor}" font-size="11" fill="#8b95a5">${label}</text>`;
  }).join('');

  // Pontos nos vértices do polígono de dados
  const dataDots = radarData.map((v, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const cx = radarCenter + radarRadius * v * Math.cos(angle);
    const cy = radarCenter + radarRadius * v * Math.sin(angle);
    return `<circle cx="${cx}" cy="${cy}" r="4" fill="#00e5a0" stroke="#0a0e17" stroke-width="2"/>`;
  }).join('');

  // ── Bar chart horizontal ──
  const barHeight = 28;
  const barGap = 10;
  const barChartHeight = scored.length * (barHeight + barGap) + 16;
  const barMaxWidth = 320;
  const barBars = scored.map((r, i) => {
    const y = i * (barHeight + barGap) + 8;
    const score = r.score ?? 0;
    const barWidth = Math.max((score / 100) * barMaxWidth, 2);
    const color = score >= 80 ? '#00e5a0' : score >= 60 ? '#ffa502' : '#ff4757';
    const label = radarLabels[i] || r.validator;
    return `
      <text x="0" y="${y + 18}" font-size="12" fill="#8b95a5">${label}</text>
      <rect x="130" y="${y + 2}" width="${barWidth}" height="${barHeight - 4}" rx="4" fill="${color}" opacity="0.9"/>
      <rect x="130" y="${y + 2}" width="${barMaxWidth}" height="${barHeight - 4}" rx="4" fill="#1e2330" opacity="0.3"/>
      <rect x="130" y="${y + 2}" width="${barWidth}" height="${barHeight - 4}" rx="4" fill="${color}" opacity="0.9"/>
      <text x="${130 + barMaxWidth + 12}" y="${y + 18}" font-size="12" fill="${color}" font-weight="700">${score}%</text>
      <text x="${130 + barMaxWidth + 50}" y="${y + 18}" font-size="11" fill="#555e6e">${gradeMap(score)}</text>`;
  }).join('');

  // ── Validator cards ──
  const validatorCards = result.results.map(vr => {
    const score = vr.score;
    const icon = vr.passed ? '✅' : '❌';
    const errors = vr.issues.filter(i => i.severity === 'error').length;
    const warns = vr.issues.filter(i => i.severity === 'warning').length;
    const infos = vr.issues.filter(i => i.severity === 'info').length;

    const topIssues = vr.issues.slice(0, 5).map(issue => {
      const sevClass = issue.severity === 'error' ? 'sev-error' : issue.severity === 'warning' ? 'sev-warn' : 'sev-info';
      const loc = issue.file ? `<span class="issue-loc">${issue.file.split('/').pop()}${issue.line ? ':' + issue.line : ''}</span>` : '';
      return `<div class="issue-row"><span class="sev-badge ${sevClass}">${issue.severity.toUpperCase()}</span><span class="issue-msg">${issue.message}</span>${loc}</div>`;
    }).join('');

    const moreCount = vr.issues.length - 5;
    const moreLabel = moreCount > 0 ? `<div class="issue-more">+ ${moreCount} more issues</div>` : '';

    return `
    <div class="validator-card ${vr.passed ? '' : 'failed'}">
      <div class="vc-header">
        <div class="vc-title">${icon} ${vr.validator}</div>
        <div class="vc-score">${score !== undefined ? `<span style="color:${(score ?? 0) >= 80 ? '#00e5a0' : (score ?? 0) >= 60 ? '#ffa502' : '#ff4757'}">${score}%</span>` : '—'}</div>
      </div>
      <div class="vc-meta">
        ${errors > 0 ? `<span class="meta-error">${errors} errors</span>` : ''}
        ${warns > 0 ? `<span class="meta-warn">${warns} warnings</span>` : ''}
        ${infos > 0 ? `<span class="meta-info">${infos} info</span>` : ''}
        ${vr.issues.length === 0 ? '<span class="meta-clean">No issues found</span>' : ''}
      </div>
      ${topIssues ? `<div class="vc-issues">${topIssues}${moreLabel}</div>` : ''}
    </div>`;
  }).join('');

  // ── Issues grouped by validator (with pagination + prompt gen) ──
  const allIssues = result.results.flatMap(vr =>
    vr.issues.map(issue => ({ ...issue, validatorName: vr.validator })),
  );
  const PAGE_SIZE = 15;
  const issueGroups = result.results
    .filter(vr => vr.issues.length > 0)
    .map((vr, groupIdx) => {
      const issues = vr.issues;
      const totalPages = Math.ceil(issues.length / PAGE_SIZE);
      const rows = issues.map((issue, i) => {
        const sevClass = issue.severity === 'error' ? 'sev-error' : issue.severity === 'warning' ? 'sev-warn' : 'sev-info';
        const file = issue.file ? issue.file.split('/').pop() : '—';
        const page = Math.floor(i / PAGE_SIZE);
        return `<tr class="ig-row" data-group="${groupIdx}" data-page="${page}"${page > 0 ? ' style="display:none"' : ''}>
          <td><span class="sev-badge ${sevClass}">${issue.severity.toUpperCase()}</span></td>
          <td><code>${issue.code}</code></td>
          <td class="td-msg">${issue.message}</td>
          <td class="td-loc">${file}${issue.line ? ':' + issue.line : ''}</td>
        </tr>`;
      }).join('');

      const errors = issues.filter(i => i.severity === 'error').length;
      const warns = issues.filter(i => i.severity === 'warning').length;
      const infos = issues.filter(i => i.severity === 'info').length;
      const badges = [
        errors > 0 ? `<span class="sev-badge sev-error">${errors} errors</span>` : '',
        warns > 0 ? `<span class="sev-badge sev-warn">${warns} warnings</span>` : '',
        infos > 0 ? `<span class="sev-badge sev-info">${infos} info</span>` : '',
      ].filter(Boolean).join(' ');

      // Prompt data embedded as JSON — includes validator metadata + issues
      const promptPayload = {
        validator: vr.validator,
        passed: vr.passed,
        score: vr.score ?? null,
        threshold: vr.threshold ?? null,
        errorCount: errors,
        warnCount: warns,
        infoCount: infos,
        issues: issues.map(iss => ({
          sev: iss.severity,
          code: iss.code,
          msg: iss.message,
          file: iss.file ? iss.file.split('/').pop() : null,
          fullPath: iss.file ?? null,
          line: iss.line ?? null,
          suggestion: iss.suggestion ?? null,
        })),
      };
      const promptJson = JSON.stringify(promptPayload).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

      return `
      <div class="issue-group">
        <div class="ig-header" onclick="toggleGroup(${groupIdx})">
          <div class="ig-left">
            <span class="ig-arrow" id="arrow-${groupIdx}">▶</span>
            <strong>${vr.validator}</strong>
            <span class="ig-count">${issues.length} issues</span>
            ${badges}
          </div>
          <div class="ig-actions">
            <div class="spec-dropdown" onclick="event.stopPropagation()">
              <button class="btn-prompt" onclick="toggleSpecMenu(${groupIdx})">🚀 Gerar Spec ▾</button>
              <div class="spec-menu" id="sm-${groupIdx}">
                <button onclick="genSpec(${groupIdx},'full')">📦 Spec Completa</button>
                <button onclick="genSpec(${groupIdx},'bdd')">🧪 BDD Scenarios</button>
                <button onclick="genSpec(${groupIdx},'tdd')">🔬 TDD Specs</button>
                <button onclick="genSpec(${groupIdx},'tasks')">📋 Tasks + Stories</button>
                <button onclick="genSpec(${groupIdx},'solid')">🏗️ SOLID + C4</button>
                <button onclick="genSpec(${groupIdx},'agent')">🤖 Agent Prompt</button>
              </div>
            </div>
          </div>
        </div>
        <div class="ig-body" id="igb-${groupIdx}" style="display:none">
          <table class="issues-table">
            <thead><tr><th>Severity</th><th>Code</th><th>Message</th><th>Location</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${totalPages > 1 ? `<div class="ig-pagination" id="igp-${groupIdx}"></div>` : ''}
        </div>
        <script type="application/json" id="pd-${groupIdx}">${promptJson}</script>
      </div>`;
    }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sentinel Report — ${statusText}</title>
<style>
  :root { --bg: #0a0e17; --surface: #111827; --surface2: #1a1f2e; --border: #1e2736; --text: #e2e8f0; --text2: #8b95a5; --accent: #00e5a0; --danger: #ff4757; --warn: #ffa502; --info: #3b82f6; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
  .page { max-width: 1100px; margin: 0 auto; padding: 40px 32px; }

  /* ── Header ── */
  .hero { text-align: center; padding: 48px 0 40px; position: relative; }
  .hero::before { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 600px; height: 300px; background: radial-gradient(ellipse, ${result.success ? 'rgba(0,229,160,0.08)' : 'rgba(255,71,87,0.08)'} 0%, transparent 70%); pointer-events: none; }
  .hero-logo { font-size: 14px; letter-spacing: 4px; text-transform: uppercase; color: var(--text2); margin-bottom: 16px; }
  .hero h1 { font-size: 42px; font-weight: 800; letter-spacing: -1px; margin-bottom: 12px; background: linear-gradient(135deg, #fff 0%, #8b95a5 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .hero-status { display: inline-flex; align-items: center; gap: 10px; padding: 10px 28px; border-radius: 50px; font-weight: 700; font-size: 15px; letter-spacing: 1px; color: ${statusColor}; border: 2px solid ${statusColor}; background: ${result.success ? 'rgba(0,229,160,0.08)' : 'rgba(255,71,87,0.08)'}; }
  .hero-status .dot { width: 10px; height: 10px; border-radius: 50%; background: ${statusColor}; box-shadow: 0 0 12px ${statusColor}; }
  .hero-meta { margin-top: 20px; color: var(--text2); font-size: 13px; }

  /* ── Stats Grid ── */
  .stats-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 32px; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 16px; text-align: center; transition: border-color 0.2s; }
  .stat-card:hover { border-color: var(--accent); }
  .stat-val { font-size: 32px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text2); margin-top: 6px; }

  /* ── Charts Row ── */
  .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 28px; }
  .card-title { font-size: 16px; font-weight: 700; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
  .card-title::before { content: ''; display: inline-block; width: 3px; height: 18px; border-radius: 2px; background: var(--accent); }

  /* ── Grade Circle ── */
  .grade-section { display: flex; align-items: center; justify-content: center; gap: 32px; margin-bottom: 32px; }
  .grade-ring { position: relative; width: 140px; height: 140px; }
  .grade-ring svg { transform: rotate(-90deg); }
  .grade-ring .grade-letter { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 48px; font-weight: 900; color: ${gradeColor}; }
  .grade-info { text-align: left; }
  .grade-info .score-big { font-size: 48px; font-weight: 800; color: ${gradeColor}; }
  .grade-info .score-label { font-size: 13px; color: var(--text2); }

  /* ── Validator Cards ── */
  .validators-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 32px; }
  .validator-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px; }
  .validator-card.failed { border-left: 3px solid var(--danger); }
  .vc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .vc-title { font-weight: 700; font-size: 15px; }
  .vc-score { font-size: 20px; font-weight: 800; }
  .vc-meta { display: flex; gap: 12px; margin-bottom: 12px; font-size: 12px; }
  .meta-error { color: var(--danger); } .meta-warn { color: var(--warn); } .meta-info { color: var(--info); } .meta-clean { color: var(--accent); }
  .vc-issues { border-top: 1px solid var(--border); padding-top: 12px; }
  .issue-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 12px; }
  .issue-msg { flex: 1; color: var(--text2); }
  .issue-loc { color: #555e6e; font-family: monospace; font-size: 11px; }
  .issue-more { color: #555e6e; font-size: 11px; padding-top: 8px; }

  /* ── Severity Badges ── */
  .sev-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
  .sev-error { background: rgba(255,71,87,0.15); color: var(--danger); }
  .sev-warn { background: rgba(255,165,2,0.15); color: var(--warn); }
  .sev-info { background: rgba(59,130,246,0.15); color: var(--info); }

  /* ── Issues Table ── */
  .issues-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .issues-table th { text-align: left; padding: 12px 10px; border-bottom: 2px solid var(--border); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text2); }
  .issues-table td { padding: 10px; border-bottom: 1px solid var(--border); }
  .issues-table tr:hover { background: rgba(0,229,160,0.03); }
  .td-validator { color: var(--text2); white-space: nowrap; }
  .td-msg { max-width: 400px; }
  .td-loc { font-family: monospace; font-size: 11px; color: #555e6e; white-space: nowrap; }
  code { background: var(--surface2); padding: 2px 8px; border-radius: 4px; font-size: 11px; color: var(--accent); }

  /* ── Issue Groups ── */
  .issue-group { border: 1px solid var(--border); border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
  .ig-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; cursor: pointer; background: var(--surface2); transition: background 0.2s; }
  .ig-header:hover { background: rgba(0,229,160,0.05); }
  .ig-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .ig-arrow { font-size: 10px; color: var(--text2); transition: transform 0.2s; display: inline-block; }
  .ig-arrow.open { transform: rotate(90deg); }
  .ig-count { background: var(--surface); padding: 2px 10px; border-radius: 20px; font-size: 11px; color: var(--text2); }
  .ig-body { padding: 0 16px 16px; }
  .ig-actions { display: flex; gap: 8px; }
  .btn-prompt { background: linear-gradient(135deg, rgba(0,229,160,0.12), rgba(0,229,160,0.05)); border: 1px solid rgba(0,229,160,0.3); color: var(--accent); padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-prompt:hover { background: rgba(0,229,160,0.2); border-color: var(--accent); }
  .spec-dropdown { position: relative; }
  .spec-menu { display: none; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 6px; min-width: 200px; z-index: 100; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
  .spec-menu.show { display: block; }
  .spec-menu button { display: block; width: 100%; text-align: left; background: none; border: none; color: var(--text); padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: background 0.15s; }
  .spec-menu button:hover { background: rgba(0,229,160,0.1); color: var(--accent); }

  /* ── Pagination ── */
  .ig-pagination { display: flex; gap: 4px; justify-content: center; padding-top: 12px; }
  .pg-btn { background: var(--surface2); border: 1px solid var(--border); color: var(--text2); padding: 4px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.15s; }
  .pg-btn:hover { border-color: var(--accent); color: var(--accent); }
  .pg-btn.active { background: var(--accent); color: var(--bg); border-color: var(--accent); font-weight: 700; }

  /* ── Prompt Modal ── */
  .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 1000; justify-content: center; align-items: center; }
  .modal-overlay.show { display: flex; }
  .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; width: 95%; max-width: 960px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  .modal-tabs { display: flex; gap: 4px; padding: 0 24px; flex-wrap: wrap; }
  .modal-tab { background: var(--surface2); border: 1px solid var(--border); color: var(--text2); padding: 6px 14px; border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.15s; }
  .modal-tab:hover { border-color: var(--accent); color: var(--accent); }
  .modal-tab.active { background: var(--accent); color: var(--bg); border-color: var(--accent); font-weight: 700; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border); }
  .modal-title { font-weight: 700; font-size: 16px; }
  .modal-close { background: none; border: none; color: var(--text2); font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
  .modal-close:hover { background: var(--surface2); color: var(--text); }
  .modal-sub { padding: 12px 24px 0; font-size: 13px; color: var(--text2); }
  .modal-text { flex: 1; margin: 12px 24px; padding: 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; line-height: 1.6; resize: none; min-height: 300px; }
  .modal-actions { display: flex; gap: 12px; align-items: center; padding: 16px 24px; border-top: 1px solid var(--border); }
  .btn-copy { background: var(--accent); color: var(--bg); border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: opacity 0.2s; }
  .btn-copy:hover { opacity: 0.85; }
  .copy-feedback { font-size: 13px; color: var(--accent); font-weight: 600; }

  /* ── Footer ── */
  .footer { text-align: center; padding: 40px 0 20px; color: #3d4555; font-size: 12px; border-top: 1px solid var(--border); margin-top: 40px; }
  .footer a { color: var(--accent); text-decoration: none; }

  /* ── Print / PDF ── */
  @media print {
    body { background: #fff; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px; max-width: 100%; }
    .hero::before { display: none; }
    .card, .stat-card, .validator-card { border-color: #ddd; background: #fafafa; break-inside: avoid; }
    .hero h1 { background: none; -webkit-text-fill-color: #111; color: #111; }
    .hero-status { border-color: ${statusColor}; }
    .stats-grid { grid-template-columns: repeat(3, 1fr); }
    .charts-row { grid-template-columns: 1fr 1fr; }
  }

  @media (max-width: 768px) {
    .stats-grid { grid-template-columns: repeat(3, 1fr); }
    .charts-row { grid-template-columns: 1fr; }
    .hero h1 { font-size: 28px; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Hero -->
  <div class="hero">
    <div class="hero-logo">Sentinel Method</div>
    <h1>Quality Gate Report</h1>
    <div class="hero-status"><span class="dot"></span> QUALITY GATE ${statusText}</div>
    <div class="hero-meta">${result.sourceDirectory} &middot; ${result.timestamp} &middot; ${durationStr}</div>
  </div>

  <!-- Stats -->
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-val">${result.summary.totalFiles}</div><div class="stat-label">Files</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--accent)">${result.summary.passedChecks}</div><div class="stat-label">Passed</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--danger)">${result.summary.failedChecks}</div><div class="stat-label">Failed</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--danger)">${errorCount}</div><div class="stat-label">Errors</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--warn)">${warnCount}</div><div class="stat-label">Warnings</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--info)">${infoCount}</div><div class="stat-label">Info</div></div>
  </div>

  <!-- Grade + Charts -->
  <div class="charts-row">
    <div class="card">
      <div class="card-title">Aggregate Score</div>
      <div class="grade-section">
        <div class="grade-ring">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="60" fill="none" stroke="var(--surface2)" stroke-width="10"/>
            <circle cx="70" cy="70" r="60" fill="none" stroke="${gradeColor}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${Math.round(377 * avgScore / 100)} 377"/>
          </svg>
          <div class="grade-letter">${grade}</div>
        </div>
        <div class="grade-info">
          <div class="score-big">${avgScore}%</div>
          <div class="score-label">Average across ${scored.length} validators</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Radar Overview</div>
      <svg width="${radarSize * 2}" height="${radarSize * 2}" viewBox="0 0 ${radarSize * 2} ${radarSize * 2}">
        ${gridPolygons}
        ${axisLines}
        <polygon points="${dataPoints}" fill="rgba(0,229,160,0.15)" stroke="#00e5a0" stroke-width="2"/>
        ${dataDots}
        ${radarLabelsSvg}
      </svg>
    </div>
  </div>

  <!-- Bar Chart -->
  <div class="card" style="margin-bottom:32px">
    <div class="card-title">Score Breakdown</div>
    <svg width="100%" height="${barChartHeight}" viewBox="0 0 520 ${barChartHeight}">
      ${barBars}
    </svg>
  </div>

  <!-- Validator Details -->
  <div class="card" style="margin-bottom:32px">
    <div class="card-title">Validator Details</div>
    <div class="validators-grid">
      ${validatorCards}
    </div>
  </div>

  <!-- Issues by Validator (grouped + paginated) -->
  ${allIssues.length > 0 ? `
  <div class="card">
    <div class="card-title">All Issues (${allIssues.length})</div>
    ${issueGroups}
  </div>` : ''}


  <!-- Footer -->
  <div class="footer">
    <p>Generated by <strong>Sentinel Method v2.0</strong> &mdash; Girardelli Tecnologia</p>
    <p style="margin-top:4px">Print this page (Ctrl+P / Cmd+P) to export as PDF</p>
  </div>

</div>
<script>
/* ── Toggle issue groups ── */
function toggleGroup(g){
  var b=document.getElementById('igb-'+g),a=document.getElementById('arrow-'+g);
  if(b.style.display==='none'){b.style.display='block';a.classList.add('open');initPagination(g);}
  else{b.style.display='none';a.classList.remove('open');}
}

/* ── Pagination ── */
function initPagination(g){
  var rows=document.querySelectorAll('.ig-row[data-group="'+g+'"]');
  var pages=new Set();rows.forEach(function(r){pages.add(r.dataset.page);});
  var total=pages.size;if(total<=1)return;
  var c=document.getElementById('igp-'+g);if(!c||c.children.length>0)return;
  for(var p=0;p<total;p++){
    var btn=document.createElement('button');btn.className='pg-btn'+(p===0?' active':'');
    btn.textContent=''+(p+1);btn.dataset.group=g;btn.dataset.page=p;
    btn.onclick=function(){goPage(parseInt(this.dataset.group),parseInt(this.dataset.page));};
    c.appendChild(btn);
  }
}
function goPage(g,p){
  document.querySelectorAll('.ig-row[data-group="'+g+'"]').forEach(function(r){
    r.style.display=parseInt(r.dataset.page)===p?'':'none';
  });
  var btns=document.getElementById('igp-'+g);if(!btns)return;
  Array.from(btns.children).forEach(function(b,i){b.className='pg-btn'+(i===p?' active':'');});
}

/* ── Spec Dropdown ── */
var openMenu=null;
function toggleSpecMenu(g){
  var m=document.getElementById('sm-'+g);
  if(openMenu&&openMenu!==m){openMenu.classList.remove('show');}
  m.classList.toggle('show');
  openMenu=m.classList.contains('show')?m:null;
}
document.addEventListener('click',function(e){
  if(openMenu&&!e.target.closest('.spec-dropdown')){openMenu.classList.remove('show');openMenu=null;}
});

/* ── Helpers ── */
function groupByFile(issues){
  var m={};issues.forEach(function(d){var k=d.file||'(general)';if(!m[k])m[k]=[];m[k].push(d);});return m;
}
function issueList(issues){
  return issues.map(function(d){
    var loc=d.line?' (linha '+d.line+')':'';
    return '- ['+d.sev.toUpperCase()+'] '+d.code+': '+d.msg+loc+(d.suggestion?'\\n  Sugestão: '+d.suggestion:'');
  }).join('\\n');
}

/* ── Validator-specific context maps ── */
var VCtx={
  'Security Scanning':{
    area:'Segurança',
    owasp:true,
    solid:['SRP','DIP'],
    c4:'Identifique os componentes que processam input externo e trace o fluxo de dados até o ponto vulnerável.',
    bddFocus:'cenários de ataque e validação de input',
    tddFocus:'testes de sanitização, encoding, e rejeição de payloads maliciosos',
    agentRole:'Security Engineer especialista em OWASP Top 10 e CWE'
  },
  'Testing Coverage':{
    area:'Cobertura de Testes',
    owasp:false,
    solid:['SRP'],
    c4:'Mapeie quais componentes/módulos possuem menor cobertura e priorize por criticidade de negócio.',
    bddFocus:'cenários de negócio não cobertos por testes',
    tddFocus:'specs unitários para funções/métodos descobertos',
    agentRole:'QA Engineer especialista em test strategy e cobertura'
  },
  'Performance Benchmarks':{
    area:'Performance',
    owasp:false,
    solid:['SRP','OCP','ISP'],
    c4:'Identifique hot paths e gargalos no diagrama de componentes. Trace latência end-to-end.',
    bddFocus:'cenários de carga, tempo de resposta e limites de recursos',
    tddFocus:'testes de benchmark e regressão de performance',
    agentRole:'Performance Engineer especialista em profiling e otimização'
  },
  'Maintainability Checker':{
    area:'Manutenibilidade',
    owasp:false,
    solid:['SRP','OCP','LSP','ISP','DIP'],
    c4:'Analise acoplamento entre componentes. Identifique god classes e dependências circulares.',
    bddFocus:'cenários de refatoração que validam comportamento preservado',
    tddFocus:'testes de caracterização antes do refactor + testes unitários pós-refactor',
    agentRole:'Software Architect especialista em clean code e refactoring patterns'
  },
  'Dependency Analysis':{
    area:'Dependências',
    owasp:false,
    solid:['DIP','OCP'],
    c4:'Mapeie o grafo de dependências. Identifique dependências transitivas e pontos de falha.',
    bddFocus:'cenários de build, compatibilidade e isolamento de módulos',
    tddFocus:'testes de integração para validar dependências corretas',
    agentRole:'DevOps Engineer especialista em dependency management e supply chain security'
  },
  'Documentation Coverage':{
    area:'Documentação',
    owasp:false,
    solid:[],
    c4:'Documente a arquitetura do sistema usando C4 model (Context, Container, Component, Code).',
    bddFocus:null,
    tddFocus:null,
    agentRole:'Technical Writer especialista em documentação de API e arquitetura'
  },
  'Code Style':{
    area:'Estilo de Código',
    owasp:false,
    solid:['SRP','OCP'],
    c4:null,
    bddFocus:null,
    tddFocus:'testes de linting automatizado e conformidade com style guide',
    agentRole:'Senior Developer especialista em clean code e code review'
  },
  'Architecture Analysis':{
    area:'Arquitetura',
    owasp:false,
    solid:['SRP','OCP','LSP','ISP','DIP'],
    c4:'Analise dependências circulares, violações de camadas e god classes. Documente usando C4 model completo.',
    bddFocus:'cenários de isolamento de camadas e inversão de dependência',
    tddFocus:'testes de integração entre módulos e validação de contratos entre camadas',
    agentRole:'Software Architect especialista em clean architecture, DDD e design patterns'
  },
  'API Contracts':{
    area:'Contratos de API',
    owasp:true,
    solid:['SRP','ISP','DIP'],
    c4:'Mapeie todos os endpoints, seus contratos de entrada/saída, middlewares e dependências externas.',
    bddFocus:'cenários de contrato de API: request/response, error handling, validação de input',
    tddFocus:'testes de integração de API, contract testing, schema validation',
    agentRole:'Backend Engineer especialista em REST API design e API-first development'
  },
  'Accessibility (WCAG)':{
    area:'Acessibilidade',
    owasp:false,
    solid:[],
    c4:'Identifique componentes de UI que precisam de remedição WCAG. Mapeie fluxos de navegação por teclado.',
    bddFocus:'cenários de acessibilidade: screen reader, navegação por teclado, contraste, ARIA',
    tddFocus:'testes automatizados de acessibilidade com axe-core, jest-axe, pa11y',
    agentRole:'Frontend Engineer especialista em WCAG 2.1 e design inclusivo'
  },
  'Internationalization':{
    area:'Internacionalização',
    owasp:false,
    solid:['OCP','DIP'],
    c4:'Mapeie componentes com strings hardcoded. Identifique o fluxo de tradução e formatação de dados.',
    bddFocus:'cenários de tradução, formatação de datas/moedas por locale, pluralização',
    tddFocus:'testes de formatação com diferentes locales (en-US, pt-BR, ja-JP, ar-SA)',
    agentRole:'Frontend Engineer especialista em i18n/L10n e react-intl/next-intl'
  },
  'Error Handling':{
    area:'Tratamento de Erros',
    owasp:false,
    solid:['SRP','OCP'],
    c4:'Mapeie o fluxo de erros do sistema: onde são gerados, propagados, logados e apresentados ao usuário.',
    bddFocus:'cenários de erro: falhas de rede, timeout, dados inválidos, erros inesperados',
    tddFocus:'testes de error boundary, retry logic, graceful degradation',
    agentRole:'Senior Engineer especialista em resilience patterns e error recovery'
  },
  'Type Safety':{
    area:'Segurança de Tipos',
    owasp:false,
    solid:['LSP','DIP'],
    c4:null,
    bddFocus:null,
    tddFocus:'testes de type narrowing, discriminated unions e validação de runtime types',
    agentRole:'TypeScript Engineer especialista em type-level programming e strict mode'
  },
  'Dead Code Detection':{
    area:'Código Morto',
    owasp:false,
    solid:['SRP'],
    c4:'Identifique módulos com alta porcentagem de código morto. Priorize remoção por impacto no bundle size.',
    bddFocus:null,
    tddFocus:'testes de regressão após remoção de código morto',
    agentRole:'Senior Developer especialista em refactoring e codebase hygiene'
  }
};
var defaultCtx={area:'Qualidade',owasp:false,solid:['SRP'],c4:null,bddFocus:'cenários de validação',tddFocus:'testes unitários',agentRole:'Senior Software Engineer'};

/* ── Spec Generators ── */
var specSections={};

function buildContext(p){
  var byF=groupByFile(p.issues);
  var files=Object.keys(byF);
  var s='# Contexto — '+p.validator+'\\n';
  s+='Score: '+(p.score!==null?p.score+'%':'N/A')+' | Threshold: '+(p.threshold!==null?p.threshold+'%':'N/A')+' | Status: '+(p.passed?'PASS':'FAIL')+'\\n';
  s+='Errors: '+p.errorCount+' | Warnings: '+p.warnCount+' | Info: '+p.infoCount+'\\n';
  s+='Arquivos afetados: '+files.length+'\\n\\n';
  s+='## Issues por Arquivo\\n';
  files.forEach(function(f){
    s+='\\n### '+f+'\\n';
    s+=issueList(byF[f])+'\\n';
  });
  return s;
}

function buildBDD(p,ctx){
  if(!ctx.bddFocus) return '# BDD Scenarios\\n\\n> Não aplicável para este validator.\\n';
  var byF=groupByFile(p.issues);
  var files=Object.keys(byF);
  var s='# BDD Scenarios (Gherkin)\\n';
  s+='> Foco: '+ctx.bddFocus+'\\n\\n';
  s+='Gere cenários BDD (Given/When/Then) para cada problema encontrado.\\n';
  s+='Use a linguagem do domínio do projeto. Cada cenário deve ser executável.\\n\\n';
  files.forEach(function(f){
    var issues=byF[f];
    s+='## Feature: Correção de '+ctx.area+' em '+f+'\\n\\n';
    issues.forEach(function(d,i){
      s+='  Scenario: '+d.code+' — '+d.msg.substring(0,60)+'\\n';
      s+='    Given o arquivo "'+f+'"'+(d.line?' na linha '+d.line:'')+' contém o problema '+d.code+'\\n';
      s+='    When a correção for aplicada\\n';
      s+='    Then o código deve passar na validação de '+ctx.area.toLowerCase()+'\\n';
      if(d.suggestion) s+='    And deve seguir a sugestão: "'+d.suggestion+'"\\n';
      s+='    And nenhuma funcionalidade existente deve quebrar\\n\\n';
    });
  });
  s+='## Cenários de Regressão\\n\\n';
  s+='  Scenario: Nenhum novo issue introduzido\\n';
  s+='    Given o projeto após todas as correções\\n';
  s+='    When o Sentinel Method executar o validator '+p.validator+'\\n';
  s+='    Then o score deve ser >= '+(p.threshold||70)+'%\\n';
  s+='    And não deve haver novos errors ou warnings\\n';
  return s;
}

function buildTDD(p,ctx){
  if(!ctx.tddFocus) return '# TDD Specs\\n\\n> Não aplicável para este validator.\\n';
  var byF=groupByFile(p.issues);
  var files=Object.keys(byF);
  var s='# TDD Specs (Test-Driven Development)\\n';
  s+='> Foco: '+ctx.tddFocus+'\\n\\n';
  s+='Crie os testes ANTES de implementar as correções (Red → Green → Refactor).\\n';
  s+='Use o framework de testes do projeto (Jest, Mocha, Pytest, JUnit, etc).\\n\\n';
  files.forEach(function(f){
    var issues=byF[f];
    var testFile=f.replace(/\\.([a-z]+)$/i,'.test.$1');
    s+='## '+testFile+'\\n\\n';
    s+='\\n';
    s+="describe('"+f+" - "+ctx.area+"', () => {\\n";
    issues.forEach(function(d){
      s+="  describe('"+d.code+"', () => {\\n";
      var safeMsg=d.msg.replace(/'/g,"").substring(0,80);
      s+="    it('should fix: "+safeMsg+"', () => {\\n";
      s+='      // TODO: Implementar teste que valida a correcao\\n';
      if(d.suggestion) s+="      // Sugestao: "+d.suggestion+"\\n";
      s+='      // Arrange: setup do cenario\\n';
      s+='      // Act: executar a operacao\\n';
      s+='      // Assert: verificar que o problema foi resolvido\\n';
      s+='    });\\n\\n';
      s+="    it('should not break existing functionality', () => {\\n";
      s+='      // Teste de regressao\\n';
      s+='    });\\n';
      s+='  });\\n\\n';
    });
    s+='});\\n\\n';
  });
  return s;
}

function buildTasks(p,ctx){
  var byF=groupByFile(p.issues);
  var files=Object.keys(byF);
  var s='# User Stories & Tasks\\n\\n';
  s+='## Epic: Melhorar '+ctx.area+' do Projeto\\n\\n';
  s+='### User Stories\\n\\n';
  s+='**US-01**: Como desenvolvedor, quero corrigir os '+p.errorCount+' errors de '+ctx.area.toLowerCase()+'\\n';
  s+='para que o projeto passe no quality gate do Sentinel (threshold: '+(p.threshold||70)+'%).\\n\\n';
  s+='**Acceptance Criteria:**\\n';
  s+='- [ ] Score do validator >= '+(p.threshold||70)+'%\\n';
  s+='- [ ] Zero errors de severidade "error"\\n';
  s+='- [ ] Testes existentes continuam passando\\n';
  s+='- [ ] Code review aprovado\\n\\n';
  if(p.warnCount>0){
    s+='**US-02**: Como tech lead, quero reduzir os '+p.warnCount+' warnings de '+ctx.area.toLowerCase()+'\\n';
    s+='para melhorar a qualidade geral do codebase.\\n\\n';
  }
  s+='### Tasks (priorizadas por severidade)\\n\\n';
  var taskNum=1;
  // Errors first, then warnings, then info
  ['error','warning','info'].forEach(function(sev){
    var sevIssues=p.issues.filter(function(d){return d.sev===sev;});
    if(sevIssues.length===0)return;
    s+='#### '+sev.toUpperCase()+'S ('+sevIssues.length+')\\n\\n';
    sevIssues.forEach(function(d){
      s+='- [ ] **Task-'+String(taskNum).padStart(2,'0')+'**: '+d.code+' em '+(d.file||'(geral)');
      if(d.line) s+=':'+d.line;
      s+='\\n';
      s+='  - Descrição: '+d.msg+'\\n';
      if(d.suggestion) s+='  - Sugestão: '+d.suggestion+'\\n';
      s+='  - Estimativa: '+(sev==='error'?'2-4h':'1-2h')+'\\n';
      s+='  - Prioridade: '+(sev==='error'?'🔴 Alta':sev==='warning'?'🟡 Média':'🔵 Baixa')+'\\n';
      taskNum++;
    });
    s+='\\n';
  });
  s+='### Definition of Done\\n';
  s+='- [ ] Todas as tasks completadas\\n';
  s+='- [ ] Sentinel score >= '+(p.threshold||70)+'%\\n';
  s+='- [ ] Testes escritos e passando\\n';
  s+='- [ ] Documentação atualizada se necessário\\n';
  s+='- [ ] PR revisado e aprovado\\n';
  return s;
}

function buildSOLID(p,ctx){
  var byF=groupByFile(p.issues);
  var files=Object.keys(byF);
  var s='# SOLID Analysis & C4 Architecture\\n\\n';
  if(ctx.solid&&ctx.solid.length>0){
    s+='## Princípios SOLID Relevantes\\n\\n';
    var solidDesc={
      SRP:'**Single Responsibility Principle** — Cada módulo/classe deve ter apenas uma razão para mudar.',
      OCP:'**Open/Closed Principle** — Aberto para extensão, fechado para modificação.',
      LSP:'**Liskov Substitution Principle** — Subtipos devem ser substituíveis por seus tipos base.',
      ISP:'**Interface Segregation Principle** — Interfaces específicas são melhores que uma interface geral.',
      DIP:'**Dependency Inversion Principle** — Dependa de abstrações, não de implementações concretas.'
    };
    ctx.solid.forEach(function(p2){
      s+=solidDesc[p2]||p2;
      s+='\\n\\n';
    });
    s+='### Análise por Arquivo\\n\\n';
    s+='Para cada arquivo com issues, analise quais princípios SOLID estão sendo violados:\\n\\n';
    files.forEach(function(f){
      s+='- **'+f+'** ('+byF[f].length+' issues): Avalie se há violação de '+ctx.solid.join(', ')+'\\n';
    });
    s+='\\n';
  }
  if(ctx.c4){
    s+='## C4 Model — Visão Arquitetural\\n\\n';
    s+='### Instruções\\n'+ctx.c4+'\\n\\n';
    s+='### Nível 1 — Context\\n';
    s+='Descreva como o sistema se relaciona com usuários e sistemas externos.\\n';
    s+='Identifique quais pontos de entrada são afetados pelas issues encontradas.\\n\\n';
    s+='### Nível 2 — Container\\n';
    s+='Mapeie os containers (API, frontend, banco, etc) e identifique\\n';
    s+='em quais containers estão os arquivos afetados.\\n\\n';
    s+='### Nível 3 — Component\\n';
    s+='Detalhe os componentes internos afetados:\\n\\n';
    files.forEach(function(f){
      s+='- **'+f+'**: Componente a ser documentado com suas responsabilidades e dependências\\n';
    });
    s+='\\n### Nível 4 — Code\\n';
    s+='Gere diagramas UML ou Mermaid para os módulos que precisam de refatoração.\\n';
  }
  if(!ctx.solid||ctx.solid.length===0&&!ctx.c4){
    s+='> Análise SOLID/C4 não é o foco principal deste validator,\\n';
    s+='mas as violações devem ser consideradas no contexto da refatoração geral.\\n';
  }
  return s;
}

function buildAgent(p,ctx){
  var byF=groupByFile(p.issues);
  var files=Object.keys(byF);
  var s='# Agent Prompt — '+p.validator+'\\n\\n';
  s+='Você é um '+ctx.agentRole+'.\\n';
  s+='Analise os seguintes issues encontrados pelo Sentinel e crie um plano de ação detalhado.\\n\\n';
  s+='## Contexto\\n\\n';
  s+='- **Validator**: '+p.validator+'\\n';
  s+='- **Score**: '+(p.score!==null?p.score+'%':'N/A')+'\\n';
  s+='- **Threshold**: '+(p.threshold!==null?p.threshold+'%':'N/A')+'\\n';
  s+='- **Status**: '+(p.passed?'✅ PASSOU':'❌ FALHOU')+'\\n';
  s+='- **Errors**: '+p.errorCount+', **Warnings**: '+p.warnCount+', **Info**: '+p.infoCount+'\\n\\n';
  s+='## Issues por Arquivo\\n\\n';
  files.forEach(function(f){
    s+='### '+f+'\\n\\n';
    s+='Questões encontradas:\\n';
    byF[f].forEach(function(d){
      s+='- ['+d.sev.toUpperCase()+'] '+d.code+': '+d.msg;
      if(d.line) s+=' (linha '+d.line+')';
      s+='\\n';
      if(d.suggestion) s+='  Sugestão: '+d.suggestion+'\\n';
    });
    s+='\\n';
  });
  s+='## Seu Objetivo\\n\\n';
  s+='1. **Analise**: Compreenda cada issue e seu impacto\\n';
  s+='2. **Priorize**: Ordene por severidade e dependência\\n';
  s+='3. **Planeie**: Escreva um plano de implementação com milestones\\n';
  s+='4. **Justifique**: Explique por que cada correção é necessária\\n';
  s+='5. **Recomende**: Sugira padrões, libraries, ou arquitetura a usar\\n\\n';
  s+='## Saída Esperada\\n\\n';
  s+='Um documento detalhado com:\\n';
  s+='- Análise técnica profunda\\n';
  s+='- Plano de ação com estimativas\\n';
  s+='- Código ou pseudo-código quando apropriado\\n';
  s+='- Testes para validar as correções\\n';
  s+='- Referências a padrões e best practices\\n';
  return s;
}

function showModal(g){
  var data=document.getElementById('pd-'+g);
  if(!data)return;
  var p=JSON.parse(data.textContent);
  var tabs={'context':'Context','bdd':p.issues?'BDD':'','tdd':p.issues?'TDD':'','tasks':'Tasks','solid':'SOLID','agent':'Agent'};
  var tabsHtml=Object.keys(tabs).map(function(t){return tabs[t]?'<div class="modal-tab'+(t==='context'?' active':'')+'" onclick="switchTab('+g+',"'+t+'")" style="cursor:pointer">'+tabs[t]+'</div>':''}).join('');
  var specsSeen={};
  specsSeen.context=buildContext(p);
  specsSeen.bdd=buildBDD(p,VCtx[p.validator]||defaultCtx);
  specsSeen.tdd=buildTDD(p,VCtx[p.validator]||defaultCtx);
  specsSeen.tasks=buildTasks(p,VCtx[p.validator]||defaultCtx);
  specsSeen.solid=buildSOLID(p,VCtx[p.validator]||defaultCtx);
  specsSeen.agent=buildAgent(p,VCtx[p.validator]||defaultCtx);
  specSections[g]=specsSeen;
  var overlay=document.getElementById('modalOverlay')||createModal();
  var header=overlay.querySelector('.modal-header .modal-title');
  header.textContent=p.validator+' Specs';
  var tabsContainer=overlay.querySelector('.modal-tabs');
  tabsContainer.innerHTML=tabsHtml;
  var textArea=overlay.querySelector('.modal-text');
  textArea.value=specsSeen.context;
  overlay.classList.add('show');
}

function createModal(){
  var overlay=document.createElement('div');
  overlay.id='modalOverlay';
  overlay.className='modal-overlay';
  overlay.innerHTML='<div class="modal"><div class="modal-header"><div class="modal-title"></div><button class="modal-close" onclick="document.getElementById('+"'"+'modalOverlay'+"'"').classList.remove('+"'"+'show'+"'"+')">×</button></div><div class="modal-tabs"></div><div class="modal-sub">Click to select format:</div><textarea class="modal-text" id="modalText" readonly></textarea><div class="modal-actions"><button class="btn-copy" onclick="copyPrompt()">📋 Copiar</button><button class="btn-copy" style="background:var(--info)" onclick="copyAll()">📦 Copiar Tudo</button><span class="copy-feedback" id="copyFeedback"></span></div></div>';
  overlay.onclick=function(e){if(e.target===overlay)overlay.classList.remove('show');};
  document.body.appendChild(overlay);
  return overlay;
}

function switchTab(g,t){
  var tabs=document.querySelectorAll('.modal-tab');
  tabs.forEach(function(tab){tab.classList.remove('active');});
  event.target.classList.add('active');
  var textArea=document.getElementById('modalText');
  textArea.value=specSections[g][t];
}

function copyPrompt(){
  var text=document.getElementById('modalText').value;
  navigator.clipboard.writeText(text).then(function(){
    var feedback=document.getElementById('copyFeedback');
    feedback.textContent='Copiado!';
    setTimeout(function(){feedback.textContent='';},2000);
  });
}

function copyAll(){
  var allText='';
  Object.keys(specSections).forEach(function(g){
    Object.keys(specSections[g]).forEach(function(t){
      allText+='\\n\\n=== '+t.toUpperCase()+' ===\\n'+specSections[g][t];
    });
  });
  navigator.clipboard.writeText(allText).then(function(){
    var feedback=document.getElementById('copyFeedback');
    feedback.textContent='Tudo copiado!';
    setTimeout(function(){feedback.textContent='';},2000);
  });
}

function genSpec(g,format){
  showModal(g);
  setTimeout(function(){switchTab(g,format);},50);
}
</script>

</body>
</html>`;
}
