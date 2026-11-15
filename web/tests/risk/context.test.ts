import { expect, it } from 'vitest';
import { usualWord, weatherWord } from '../../src/lib/risk/context';

it('uses the approved usual thresholds including both boundaries and zero', () => {
 expect(usualWord(.669, 1)).toBe('usualLower');
 expect(usualWord(.67, 1)).toBe('usualSame');
 expect(usualWord(1.5, 1)).toBe('usualSame');
 expect(usualWord(1.501, 1)).toBe('usualHigher');
 expect(usualWord(0, 0)).toBe('usualSame');
 expect(usualWord(.01, 0)).toBe('usualHigher');
});
it('uses the approved fire-weather thresholds including missing values', () => {
 expect([null, 11.19, 11.2, 21.3, 38].map(weatherWord)).toEqual(['weatherNone', 'weatherLow', 'weatherModerate', 'weatherStrong', 'weatherVeryStrong']);
});
