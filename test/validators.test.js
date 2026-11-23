const { validateQuestion } = require('../backend/utils/validators');

describe('API input validation', () => {
  test('accepts a normal question', () => expect(validateQuestion({ question: '  Hello  ' })).toBe('Hello'));
  test('rejects missing questions', () => expect(() => validateQuestion({})).toThrow('Question is required'));
  test('rejects documentIds that are not arrays', () => expect(() => validateQuestion({ question: 'Hello', documentIds: 'doc-1' })).toThrow(/array/));
});
