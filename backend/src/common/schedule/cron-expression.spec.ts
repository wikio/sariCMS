import { isValidCron } from './cron-expression';

describe('isValidCron', () => {
  it.each([
    '15 3 * * *',
    '0 3 * * *',
    '*/5 * * * *',
    '0 0 1 1 *',
    '30 2 * * 0',
    '0 4 * * 7',
    '5,20,45 * * * *',
    '0 9-17 * * 1-5',
    '0 */6 * * *',
    '0 0 1-15/2 * *',
    '0 0 * JAN,MAR,DEC *',
    '0 0 * * MON,FRI',
    '0 0 * jan-mar *',
    '59 23 31 12 6',
  ])('accepte « %s »', (expr) => {
    expect(isValidCron(expr)).toBe(true);
  });

  it.each([
    '',
    '   ',
    '*',
    '* *',
    '* * *',
    '* * * *',
    '* * * * * *',
    '60 * * * *',
    '* 24 * * *',
    '* * 32 * *',
    '* * * 13 *',
    '* * * * 8',
    '0 9-17 * * 1-5 *',
    '10-5 * * * *',
    '*/0 * * * *',
    '*/* * * * *',
    '5/10 * * * *',
    '1,2, * * * *',
    ',1 * * * *',
    'a b c d e',
    '0 0 FOO * *',
    '0 0 * FOO *',
    '-1 * * * *',
    '0 -1 * * *',
    '0 0 1-2-3 * *',
    '0 0 * * SUN-',
  ])('refuse « %s »', (expr) => {
    expect(isValidCron(expr)).toBe(false);
  });

  it('tolère les espaces superflus autour de l’expression', () => {
    expect(isValidCron('  15 3 * * *  ')).toBe(true);
    expect(isValidCron('15   3  *  *  *')).toBe(true);
  });

  it('refuse ce qui n’est pas une chaîne', () => {
    expect(isValidCron(undefined as unknown as string)).toBe(false);
    expect(isValidCron(null as unknown as string)).toBe(false);
    expect(isValidCron(15 as unknown as string)).toBe(false);
  });
});
