/** Interpret the model estimate and experimental fire-weather input. */
export function usualWord(p: number, usual: number): 'usualLower' | 'usualSame' | 'usualHigher' {
 const ratio = usual === 0 ? (p === 0 ? 1 : Infinity) : p / usual;
 return ratio < .67 ? 'usualLower' : ratio <= 1.5 ? 'usualSame' : 'usualHigher';
}
export function weatherWord(fwi: number | null | undefined): 'weatherNone' | 'weatherLow' | 'weatherModerate' | 'weatherStrong' | 'weatherVeryStrong' {
 return fwi == null ? 'weatherNone' : fwi < 11.2 ? 'weatherLow' : fwi < 21.3 ? 'weatherModerate' : fwi < 38 ? 'weatherStrong' : 'weatherVeryStrong';
}
