import { escapeRegExp, norm } from '../../../shared/utils/utils';

export class DateQuestionText {
  removeText(question, text) {
    const normalizedQuestion = norm(question);
    const normalizedText = norm(text);
    const normalizedPattern = new RegExp(
      `\\b${escapeRegExp(normalizedText).replace(/\s+/g, '\\s+')}\\b`,
    );
    const normalizedResult = normalizedQuestion
      .replace(normalizedPattern, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (normalizedResult !== normalizedQuestion) return normalizedResult;
    const originalPattern = new RegExp(`\\b${escapeRegExp(text).replace(/\s+/g, '\\s+')}\\b`, 'i');
    return String(question || '')
      .replace(originalPattern, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  removeRange(question, index, length) {
    return `${question.slice(0, index)} ${question.slice(index + length)}`
      .replace(/\s+/g, ' ')
      .trim();
  }
}
