import { ActivityReporter } from './activity-reporter';
import type { ActivityRecord } from './activity-tracker';

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    agent_id: 'agent:ed25519:testkey',
    timestamp: '2026-02-14T12:00:00Z',
    service: 'api.example.com',
    method: 'GET',
    path: '/test',
    status: 200,
    source: 'agent',
    ...overrides
  };
}

describe('ActivityReporter', () => {
  describe('summary', () => {
    it('returns zeroed summary for empty records', () => {
      const reporter = new ActivityReporter([]);
      const s = reporter.summary();

      expect(s.total_requests).toBe(0);
      expect(s.success_rate).toBe(0);
      expect(s.period_start).toBe('');
      expect(s.period_end).toBe('');
      expect(s.by_source).toEqual({ agent: 0, service: 0 });
    });

    it('counts total requests', () => {
      const records = [makeRecord(), makeRecord(), makeRecord()];
      const s = new ActivityReporter(records).summary();
      expect(s.total_requests).toBe(3);
    });

    it('calculates success rate from 2xx statuses only', () => {
      const records = [
        makeRecord({ status: 200 }),
        makeRecord({ status: 201 }),
        makeRecord({ status: 301 }),
        makeRecord({ status: 404 }),
        makeRecord({ status: 500 })
      ];
      const s = new ActivityReporter(records).summary();
      expect(s.success_rate).toBe(2 / 5);
    });

    it('groups by service with error counts', () => {
      const records = [
        makeRecord({ service: 'gmail.com', status: 200 }),
        makeRecord({ service: 'gmail.com', status: 200 }),
        makeRecord({ service: 'gmail.com', status: 500 }),
        makeRecord({ service: 'calendar.com', status: 200 }),
        makeRecord({ service: 'calendar.com', status: 403 })
      ];
      const s = new ActivityReporter(records).summary();

      expect(s.by_service['gmail.com']).toEqual({ total: 3, errors: 1 });
      expect(s.by_service['calendar.com']).toEqual({ total: 2, errors: 1 });
    });

    it('groups by status code', () => {
      const records = [
        makeRecord({ status: 200 }),
        makeRecord({ status: 200 }),
        makeRecord({ status: 429 }),
        makeRecord({ status: 500 })
      ];
      const s = new ActivityReporter(records).summary();

      expect(s.by_status['200']).toBe(2);
      expect(s.by_status['429']).toBe(1);
      expect(s.by_status['500']).toBe(1);
    });

    it('counts agent vs service sources', () => {
      const records = [
        makeRecord({ source: 'agent' }),
        makeRecord({ source: 'agent' }),
        makeRecord({ source: 'service' })
      ];
      const s = new ActivityReporter(records).summary();

      expect(s.by_source).toEqual({ agent: 2, service: 1 });
    });

    it('derives period from earliest and latest timestamps', () => {
      const records = [
        makeRecord({ timestamp: '2026-02-14T10:00:00Z' }),
        makeRecord({ timestamp: '2026-02-14T08:00:00Z' }),
        makeRecord({ timestamp: '2026-02-14T14:00:00Z' })
      ];
      const s = new ActivityReporter(records).summary();

      expect(s.period_start).toBe('2026-02-14T08:00:00Z');
      expect(s.period_end).toBe('2026-02-14T14:00:00Z');
    });
  });

  describe('format', () => {
    it('includes total requests and success rate', () => {
      const records = [
        makeRecord({ status: 200 }),
        makeRecord({ status: 500 })
      ];
      const output = new ActivityReporter(records).format();

      expect(output).toContain('Total Requests: 2');
      expect(output).toContain('Success Rate: 50%');
    });

    it('shows source breakdown only when service records exist', () => {
      const agentOnly = [makeRecord({ source: 'agent' })];
      expect(new ActivityReporter(agentOnly).format()).not.toContain('By Source:');

      const mixed = [
        makeRecord({ source: 'agent' }),
        makeRecord({ source: 'service' })
      ];
      const output = new ActivityReporter(mixed).format();
      expect(output).toContain('By Source:');
      expect(output).toContain('Agent-reported: 1');
      expect(output).toContain('Service-verified: 1');
    });

    it('shows per-service breakdown', () => {
      const records = [
        makeRecord({ service: 'gmail.com', status: 200 }),
        makeRecord({ service: 'gmail.com', status: 500 })
      ];
      const output = new ActivityReporter(records).format();

      expect(output).toContain('gmail.com: 2 requests (1 errors)');
    });

    it('shows individual status codes for error categories but not for 2xx', () => {
      const records = [
        makeRecord({ status: 200 }),
        makeRecord({ status: 200 }),
        makeRecord({ status: 429 }),
        makeRecord({ status: 500 })
      ];
      const output = new ActivityReporter(records).format();

      expect(output).toContain('2xx (Success): 2');
      expect(output).toContain('4xx (Client Error): 1');
      expect(output).toContain('    - 429: 1');
      expect(output).toContain('5xx (Server Error): 1');
      expect(output).toContain('    - 500: 1');
      // 2xx should NOT have individual code breakdown
      expect(output).not.toContain('    - 200:');
    });
  });
});
