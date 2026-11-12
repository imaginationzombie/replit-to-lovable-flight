import { expect,it } from 'vitest';
import { officeEstimate,movingEstimate } from '../lib/service-estimates';
import { SERVICE_BASE } from '../lib/pricing';
it('office estimates are 10% below the published $72 two-hour benchmark',()=>{expect(officeEstimate(2,1,4)).toEqual({billableHours:2,benchmark:72,perVisit:64.8,total:259.2});});
it('two-cleaner office estimate is below the $132 comparison',()=>{expect(officeEstimate(2,2,1).perVisit).toBe(118.8);});
it('DuBois moving labor is 10% below $81 per two-person crew hour',()=>{expect(movingEstimate(2,'DuBois & Sandy Twp').total).toBe(145.8);});
it('Lewistown moving labor is 10% below $100 per crew hour',()=>{expect(movingEstimate(3,'Lewistown, PA').total).toBe(270);});
it('yardwork is not available for new cleaning bookings',()=>{expect(Object.keys(SERVICE_BASE)).not.toContain('Fall & Seasonal Property Care');});
