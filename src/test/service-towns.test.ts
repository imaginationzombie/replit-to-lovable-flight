import { describe,it,expect } from 'vitest';
import { activeTownNames, activeTownSelection } from '@/lib/service-towns';
describe('active service towns', () => {
  const towns = ['DuBois & Sandy Twp','Punxsutawney','Reynoldsville','Sykesville','Falls Creek / Brockway','Lewistown, PA'].map((name,sort_order) => ({ name,sort_order,active: name === 'Lewistown, PA' }));
  it('offers only Lewistown when every other town is inactive', () => {
    expect(activeTownNames(towns)).toEqual(['Lewistown, PA']);
  });
  it('removes a deactivated town from new-booking selections', () => {
    expect(activeTownSelection('DuBois & Sandy Twp',activeTownNames(towns))).toBe('Lewistown, PA');
  });
  it('supports admin reactivation', () => {
    expect(activeTownNames(towns.map(t => ({ ...t, active: t.active || t.name === 'Punxsutawney' })))).toEqual(['Punxsutawney','Lewistown, PA']);
  });
  it('offers no towns when all are inactive', () => {
    expect(activeTownSelection('Lewistown, PA',[])).toBe('');
  });
});