import { describe, expect, it } from 'vitest';
import { areaDistanceMiles, eligibleAreas, validateTravel } from '../lib/travel-areas';
import { SERVICE_AREAS } from '../lib/pricing';
describe('housekeeper travel choices', () => {
 it('only accepts selected locations', () => { expect(eligibleAreas(['Lewistown, PA'],'',null)).toEqual(['Lewistown, PA']); });
 it('limits a DuBois 15-mile radius without admitting Lewistown', () => { expect(eligibleAreas(SERVICE_AREAS,'DuBois & Sandy Twp',15)).toEqual(['DuBois & Sandy Twp','Reynoldsville','Sykesville','Falls Creek / Brockway']); expect(areaDistanceMiles('DuBois & Sandy Twp','Lewistown, PA')).toBeGreaterThan(70); });
 it('allows no locations when none are selected', () => { expect(eligibleAreas([],'',null)).toEqual([]); });
 it('keeps the base town at zero radius', () => { expect(eligibleAreas(SERVICE_AREAS,'Lewistown, PA',0)).toEqual(['Lewistown, PA']); });
 it('requires a base location for a distance', () => { expect(() => validateTravel('', '15')).toThrow(); expect(validateTravel('Lewistown, PA','15')).toBe(15); expect(validateTravel('','')).toBeNull(); });
});
