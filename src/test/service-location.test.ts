import { describe, expect, it } from 'vitest';
import { nearestServiceLocation } from '../../public/service-location.js';

describe('nearest service area', () => {
  it('selects Lewistown for a customer in Lewistown', () => {
    expect(nearestServiceLocation(40.5992, -77.5714)?.corridor).toBe('Lewistown 17044');
  });
  it('selects DuBois for a customer in DuBois', () => {
    expect(nearestServiceLocation(41.1192, -78.7600)?.corridor).toBe('DuBois 15801');
  });
  it('does not select an area from invalid coordinates', () => {
    expect(nearestServiceLocation(100, -78)).toBeNull();
  });
});