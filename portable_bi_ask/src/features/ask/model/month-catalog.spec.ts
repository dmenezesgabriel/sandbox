import { describe, expect, it } from 'vitest';

import { MonthCatalog } from './month-catalog';

describe('MonthCatalog', () => {
  describe('with en-US locale', () => {
    const catalog = new MonthCatalog('en-US');

    describe('find', () => {
      it('finds a full English month name', () => {
        const result = catalog.find('sales in January 2017');
        expect(result).not.toBeNull();
        expect(result!.number).toBe(1);
        expect(result!.year).toBe(2017);
      });

      it('finds a short English month name without year', () => {
        const result = catalog.find('sales in Jan');
        expect(result).not.toBeNull();
        expect(result!.number).toBe(1);
        expect(result!.year).toBeNull();
      });

      it('returns null for text without months', () => {
        expect(catalog.find('sales by region')).toBeNull();
      });

      it('finds month at start of text', () => {
        const result = catalog.find('March sales');
        expect(result).not.toBeNull();
        expect(result!.number).toBe(3);
      });
    });

    describe('has', () => {
      it('returns true for text containing a month name', () => {
        expect(catalog.has('January sales')).toBe(true);
      });

      it('returns false for text without month names', () => {
        expect(catalog.has('total sales')).toBe(false);
      });
    });
  });

  describe('with pt-BR locale', () => {
    const catalog = new MonthCatalog('pt-BR');

    it('finds a Portuguese month name', () => {
      const result = catalog.find('vendas em Janeiro');
      expect(result).not.toBeNull();
      expect(result!.number).toBe(1);
    });

    it('finds a Portuguese short month name', () => {
      const result = catalog.find('vendas em Jan');
      expect(result).not.toBeNull();
      expect(result!.number).toBe(1);
    });
  });
});
