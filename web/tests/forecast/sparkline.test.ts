import { createElement } from 'react';
import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sparkline } from '../../src/components/forecast/Sparkline';
it('breaks lines at missing days and describes the latest real value', () => {
 const html = renderToStaticMarkup(createElement(Sparkline, { label: 'Rain', unit: 'mm', values: [
  { date: '2026-11-10', value: 0 }, { date: '2026-11-11', value: null },
  { date: '2026-11-12', value: 2 }, { date: '2026-11-13', value: 3 },
  { date: '2026-11-14', value: null },
 ] }));
 expect((html.match(/<path /g) ?? [])).toHaveLength(2);
 expect(html).toContain('Overall increase, latest 3 mm on 2026-11-13');
 expect(html).toContain('2026-11-13');
});
it('describes an empty series', () => {
 expect(renderToStaticMarkup(createElement(Sparkline, { label: 'Rain', unit: 'mm', values: [] }))).toContain('Rain: No data');
});
