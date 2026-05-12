import { describe, expect, it } from 'vitest';

import { DateQuestionText } from './date-question-text';

describe('DateQuestionText', () => {
  const textTools = new DateQuestionText();

  describe('removeText', () => {
    it('removes a matching word from the question (normalized)', () => {
      expect(textTools.removeText('sales in 2017', '2017')).toBe('sales in');
    });

    it('removes a multi-word phrase (normalized)', () => {
      expect(textTools.removeText('sales last year by region', 'last year')).toBe(
        'sales by region',
      );
    });

    it('removes diacritic-insensitive text', () => {
      expect(textTools.removeText('vendas mês passado', 'mês passado')).toBe('vendas');
    });

    it('returns original normalized question when text not found (normalized)', () => {
      expect(textTools.removeText('total sales', 'region')).toBe('total sales');
    });

    it('handles empty text gracefully', () => {
      expect(textTools.removeText('sales', '')).toBeTruthy();
    });
  });

  describe('removeRange', () => {
    it('removes a range from the question by index and length', () => {
      expect(textTools.removeRange('sales in 2017 by region', 9, 4)).toBe('sales in by region');
    });

    it('trims resulting extra spaces', () => {
      expect(textTools.removeRange('sales  2017 region', 7, 4)).toBe('sales region');
    });
  });
});
