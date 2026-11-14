import type { PowerDay } from '@/lib/forecast/power';

export type SparklineProps = { label: string; values: PowerDay[]; unit: string };

/** Missing days break the line; single readings remain visible as dots. */
export function Sparkline({ label, values, unit }: SparklineProps) {
  const valid = values.flatMap((point, index) => point.value !== null && Number.isFinite(point.value) ? [{ ...point, value: point.value, index }] : []);
  const first = valid[0];
  const last = valid[valid.length - 1];
  const trend = !last ? 'No data' : valid.length === 1 ? 'One reading' : last.value > first.value ? 'Overall increase' : last.value < first.value ? 'Overall decrease' : 'No overall change';
  const min = Math.min(...valid.map(point => point.value));
  const max = Math.max(...valid.map(point => point.value));
  const x = (index: number) => values.length <= 1 ? 50 : 2 + index * 96 / (values.length - 1);
  const y = (value: number) => min === max ? 20 : 36 - (value - min) * 32 / (max - min);
  const paths: string[] = [];
  let current = '';
  values.forEach((point, index) => {
    if (point.value === null || !Number.isFinite(point.value)) {
      if (current) paths.push(current);
      current = '';
    } else current += `${current ? ' L' : 'M'}${x(index)},${y(point.value)}`;
  });
  if (current) paths.push(current);
  const description = `${label}: ${trend}${last ? `, latest ${Number(last.value.toFixed(2))} ${unit} on ${last.date}` : ''}`;
  return <div style={{ color: 'var(--ink)' }}>
    <div>{label}</div>
    <svg viewBox="0 0 100 40" width="100%" height="40" role="img" aria-label={description} preserveAspectRatio="none">
      {paths.map((path, index) => <path key={index} d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
      {valid.map(point => <circle key={point.index} cx={x(point.index)} cy={y(point.value)} r="1.3" fill="var(--accent)" />)}
    </svg>
    <div>{last ? <><strong>{Number(last.value.toFixed(2))} {unit}</strong> <span style={{ color: 'var(--ink-2)' }}>{last.date}</span></> : 'No data'}</div>
  </div>;
}
export default Sparkline;
