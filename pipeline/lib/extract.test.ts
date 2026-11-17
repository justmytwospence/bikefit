import { describe, expect, it } from 'vitest';
import { familyName, geometryTables, jsonLdSizes } from './extract';

const rows = `<table><tr><th></th><th>S</th><th>M</th></tr>
<tr><td>Stack</td><td>520</td><td>540</td></tr><tr><td>Reach</td><td>370</td><td>380</td></tr>
<tr><td>Seat Tube Angle</td><td>73.5</td><td>73</td></tr><tr><td>Head Tube Angle</td><td>72</td><td>72.5</td></tr>
<tr><td>Wheelbase</td><td>980</td><td>990</td></tr></table>`;
const cols = `<table><tr><th>Size</th><th>Stack</th><th>Reach</th><th>Seat Tube Angle</th><th>Head Tube Angle</th><th>Wheelbase</th></tr>
<tr><td>S</td><td>520</td><td>370</td><td>73.5</td><td>72</td><td>980</td></tr>
<tr><td>M</td><td>540</td><td>380</td><td>73</td><td>72.5</td><td>990</td></tr></table>`;

describe('geometryTables', () => {
  it('reads both orientations the same', () => {
    expect(geometryTables(rows)).toEqual(geometryTables(cols));
    expect(geometryTables(rows)[0][1]).toEqual({ size: 'M', stack: 540, reach: 380, seatTubeAngle: 73, headTubeAngle: 72.5, wheelbase: 990 });
  });
  it('expands colspan', () => {
    const t = rows.replace('<th>M</th>', '<th colspan="1">M</th>').replace('<td>Stack</td><td>520</td><td>540</td>', '<td>Stack</td><td colspan="2">520</td>');
    expect(geometryTables(t)[0].map((s) => s.stack)).toEqual([520, 520]);
  });
  it('ignores other tables', () => expect(geometryTables('<table><tr><td>a</td></tr></table>')).toEqual([]));
});

describe('jsonLdSizes', () => {
  it('reads PropertyValue geometry once per size', () => {
    const v = (size: string, stack: number) => ({
      '@type': 'Product', size,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Stack', value: stack, unitText: 'mm' },
        { '@type': 'PropertyValue', name: 'Reach', value: 400, unitText: 'mm' },
        { '@type': 'PropertyValue', name: 'Effective Stack', value: 999, unitText: 'mm' },
      ],
    });
    const data = { '@type': 'ProductGroup', hasVariant: [v('M', 560), v('M', 560), v('L', 580)] };
    const s = jsonLdSizes(`<script type="application/ld+json">${JSON.stringify(data)}</script>`);
    expect(s).toEqual([{ size: 'M', stack: 560, reach: 400 }, { size: 'L', stack: 580, reach: 400 }]);
  });
});

describe('familyName', () => {
  it('drops build words and numbers', () => {
    expect(familyName('Ultimate CF SLX 8 Di2')).toBe('Ultimate CF SLX');
    expect(familyName('Tarmac SL9 Expert - Shimano Ultegra Di2')).toBe('Tarmac SL9');
  });
});
