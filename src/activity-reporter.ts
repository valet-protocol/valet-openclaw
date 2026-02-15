import type { ActivityRecord } from './activity-tracker.js';

export interface ActivitySummary {
  period_start: string;
  period_end: string;
  total_requests: number;
  success_rate: number;
  by_service: Record<string, { total: number; errors: number }>;
  by_status: Record<string, number>;
  by_source: { agent: number; service: number };
}

export class ActivityReporter {
  constructor(private records: ActivityRecord[]) {}

  summary(): ActivitySummary {
    const total = this.records.length;

    const byService: Record<string, { total: number; errors: number }> = {};
    const byStatus: Record<string, number> = {};
    let successCount = 0;
    let agentCount = 0;
    let serviceCount = 0;

    for (const r of this.records) {
      // By service
      if (!byService[r.service]) {
        byService[r.service] = { total: 0, errors: 0 };
      }
      byService[r.service].total++;
      if (r.status >= 400) {
        byService[r.service].errors++;
      }

      // By status
      const key = `${r.status}`;
      byStatus[key] = (byStatus[key] || 0) + 1;

      // Success count (2xx)
      if (r.status >= 200 && r.status < 300) {
        successCount++;
      }

      // By source
      if (r.source === 'service') {
        serviceCount++;
      } else {
        agentCount++;
      }
    }

    const timestamps = this.records.map(r => r.timestamp).sort();

    return {
      period_start: timestamps[0] || '',
      period_end: timestamps[timestamps.length - 1] || '',
      total_requests: total,
      success_rate: total > 0 ? successCount / total : 0,
      by_service: byService,
      by_status: byStatus,
      by_source: { agent: agentCount, service: serviceCount }
    };
  }

  format(): string {
    const s = this.summary();
    const lines: string[] = [];

    lines.push(`Activity Summary (${s.period_start} - ${s.period_end}):`);
    lines.push('');
    lines.push(`Total Requests: ${s.total_requests.toLocaleString()}`);
    lines.push(`Success Rate: ${Math.round(s.success_rate * 100)}%`);

    // By source
    if (s.by_source.service > 0) {
      lines.push('');
      lines.push('By Source:');
      lines.push(`  - Agent-reported: ${s.by_source.agent.toLocaleString()}`);
      lines.push(`  - Service-verified: ${s.by_source.service.toLocaleString()}`);
    }

    // By service
    lines.push('');
    lines.push('By Service:');
    for (const [service, counts] of Object.entries(s.by_service)) {
      const errorNote = counts.errors > 0 ? `${counts.errors} errors` : '0 errors';
      lines.push(`  - ${service}: ${counts.total.toLocaleString()} requests (${errorNote})`);
    }

    // By status category
    const categories: Record<string, Record<string, number>> = {};
    for (const [code, count] of Object.entries(s.by_status)) {
      const num = parseInt(code);
      let category: string;
      if (num < 300) category = '2xx (Success)';
      else if (num < 400) category = '3xx (Redirect)';
      else if (num < 500) category = '4xx (Client Error)';
      else category = '5xx (Server Error)';

      if (!categories[category]) categories[category] = {};
      categories[category][code] = count;
    }

    lines.push('');
    lines.push('By Status:');
    for (const [category, codes] of Object.entries(categories)) {
      const categoryTotal = Object.values(codes).reduce((a, b) => a + b, 0);
      lines.push(`  - ${category}: ${categoryTotal.toLocaleString()}`);
      // Show individual codes for error categories
      if (!category.startsWith('2xx')) {
        for (const [code, count] of Object.entries(codes)) {
          lines.push(`    - ${code}: ${count.toLocaleString()}`);
        }
      }
    }

    return lines.join('\n');
  }
}
