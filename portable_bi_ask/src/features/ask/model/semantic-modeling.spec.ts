import { beforeEach, describe, expect, it } from 'vitest';

import { AutoFieldRoleDetector, type FieldSignature } from './semantic-modeling';

function sig(overrides: Partial<FieldSignature>): FieldSignature {
  return {
    table: 'tbl',
    column: 'col',
    type: 'VARCHAR',
    samples: [],
    cardinality: 10,
    rowCount: 100,
    ...overrides,
  };
}

describe('AutoFieldRoleDetector', () => {
  let detector: AutoFieldRoleDetector;

  beforeEach(() => {
    detector = new AutoFieldRoleDetector();
  });

  describe('detectRole', () => {
    it('returns key for an id-pattern column name', () => {
      expect(detector.detectRole(sig({ column: 'customer_id', type: 'INTEGER' })).role).toBe('key');
    });

    it('returns time for a date-pattern column name', () => {
      expect(detector.detectRole(sig({ column: 'order_date', type: 'VARCHAR' })).role).toBe('time');
    });

    it('returns time when the majority of samples look like dates', () => {
      const samples = Array(10).fill('2024-01-15');
      expect(
        detector.detectRole(sig({ column: 'created_at', type: 'VARCHAR', samples })).role,
      ).toBe('time');
    });

    it('returns dimension for a low-cardinality numeric field', () => {
      expect(
        detector.detectRole(
          sig({ column: 'priority', type: 'INTEGER', cardinality: 3, rowCount: 1000 }),
        ).role,
      ).toBe('dimension');
    });

    it('returns measure for a numeric field with a measure-pattern name', () => {
      expect(
        detector.detectRole(
          sig({ column: 'total_amount', type: 'DOUBLE', cardinality: 500, rowCount: 1000 }),
        ).role,
      ).toBe('measure');
    });

    it('returns measure for a high-cardinality numeric field without a special name', () => {
      expect(
        detector.detectRole(
          sig({ column: 'score', type: 'DOUBLE', cardinality: 900, rowCount: 1000 }),
        ).role,
      ).toBe('measure');
    });

    it('returns dimension for a low-cardinality string field', () => {
      expect(
        detector.detectRole(
          sig({ column: 'status', type: 'VARCHAR', cardinality: 4, rowCount: 500 }),
        ).role,
      ).toBe('dimension');
    });
  });
});
