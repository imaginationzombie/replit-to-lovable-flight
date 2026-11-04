export const SERVICE_LOCATIONS = [
  { label: 'DuBois & Sandy Twp, PA', corridor: 'DuBois 15801', latitude: 41.1192, longitude: -78.7600 },
  { label: 'Lewistown, PA', corridor: 'Lewistown 17044', latitude: 41.1612, longitude: -79.0831 },
  { label: 'Punxsutawney, PA', corridor: 'Punxsutawney 15767', latitude: 40.9437, longitude: -78.9709 },
  { label: 'Reynoldsville, PA', corridor: 'Reynoldsville 15851', latitude: 41.0970, longitude: -78.8886 },
  { label: 'Sykesville, PA', corridor: 'Sykesville 15865', latitude: 41.0503, longitude: -78.8223 },
  { label: 'Falls Creek, PA', corridor: 'Falls Creek 15840', latitude: 41.1451, longitude: -78.8045 },
  { label: 'Brockway, PA', corridor: 'Brockway 15824', latitude: 41.2492, longitude: -78.7995 },
  { label: 'Lewistown, PA', corridor: 'Lewistown 17044', latitude: 40.5992, longitude: -77.5714 },
];

export function nearestServiceLocation(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const radians = value => value * Math.PI / 180;
  let nearest = null;
  let bestDistance = Infinity;
  for (const area of SERVICE_LOCATIONS) {
    const distance = Math.sin(radians(area.latitude - latitude) / 2) ** 2
      + Math.cos(radians(latitude)) * Math.cos(radians(area.latitude))
      * Math.sin(radians(area.longitude - longitude) / 2) ** 2;
    if (distance < bestDistance) { nearest = area; bestDistance = distance; }
  }
  return nearest;
}

export function initializeServiceLocation() {
  const selects = ['mobile-service-location', 'estimator-service-location']
    .map(id => document.getElementById(id))
    .filter(element => element instanceof HTMLSelectElement);
  const status = document.getElementById('service-location-status');
  if (!selects.length || !status) return;
  for (const select of selects) {
    for (const area of SERVICE_LOCATIONS) {
      select.add(new Option(area.label, area.corridor));
    }
    select.value = document.querySelector('.territory-btn.border-primary')?.getAttribute('data-corridor') || SERVICE_LOCATIONS[0].corridor;
  }
  let manuallySelected = false;
  function apply(area) {
    for (const select of selects) select.value = area.corridor;
    document.dispatchEvent(new CustomEvent('service-location-selected', { detail: area }));
  }
  for (const select of selects) {
    select.addEventListener('change', () => {
      manuallySelected = true;
      const area = SERVICE_LOCATIONS.find(item => item.corridor === select.value);
      if (area) { apply(area); status.textContent = 'Selected: ' + area.label; }
    });
  }
  document.addEventListener('service-location-updated', event => {
    manuallySelected = true;
    for (const select of selects) select.value = event.detail.corridor;
    status.textContent = 'Selected: ' + event.detail.label;
  });
  if (!window.matchMedia('(max-width: 767px)').matches) return;
  if (!navigator.geolocation) { status.textContent = 'Location unavailable. Choose your service area.'; return; }
  status.textContent = 'Finding your nearest service area…';
  navigator.geolocation.getCurrentPosition(position => {
    if (manuallySelected) return;
    const area = nearestServiceLocation(position.coords.latitude, position.coords.longitude);
    if (!area) { status.textContent = 'Choose your service area.'; return; }
    apply(area);
    status.textContent = 'Nearest service area: ' + area.label;
  }, () => {
    if (!manuallySelected) status.textContent = 'Location unavailable. Choose your service area.';
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeServiceLocation);
  else initializeServiceLocation();
}