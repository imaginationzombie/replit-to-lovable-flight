// Active town settings contain no customer or staff data.
const aliases = [
  ['DuBois & Sandy Twp', /dubois|sandy twp/i],
  ['Punxsutawney', /punxsutawney|punxsy/i],
  ['Reynoldsville', /reynoldsville/i],
  ['Sykesville', /sykesville/i],
  ['Falls Creek / Brockway', /falls creek|brockway/i],
  ['Lewistown, PA', /lewistown/i],
];
function matches(text) { return aliases.filter(([,pattern]) => pattern.test(text)).map(([name]) => name); }
async function refreshTowns() {
  let active = [];
  try {
    const response = await fetch('/api/public/service-towns',{ cache: 'no-store' });
    if (!response.ok) throw new Error('Unavailable');
    active = (await response.json()).filter(town => town.active).map(town => town.name);
  } catch { /* Never advertise unavailable towns when settings cannot be read. */ }
  const available = text => matches(text).some(name => active.includes(name));
  const cards = document.querySelectorAll('.territory-btn,.territory-card,.territory-chip,.loc-btn,#step-location .grid > a,[data-service-town]');
  const wasSelected = new Set([...cards].filter(card => card.classList.contains('active') || card.classList.contains('border-primary') || card.querySelector('input:checked')));
  for (const card of cards) {
    const text = card.getAttribute('data-service-town') || card.getAttribute('data-territory') || card.getAttribute('data-loc-name') || card.textContent;
    card.toggleAttribute('data-town-inactive',!available(text));
    if ('disabled' in card) card.disabled = !available(text);
    for (const input of card.querySelectorAll('input')) input.disabled = !available(text);
  }
  for (const select of document.querySelectorAll('select')) {
    const options = [...select.options];
    if (!options.some(option => matches(option.textContent).length)) continue;
    for (const option of options) {
      if (!matches(option.textContent).length) continue;
      option.hidden = !available(option.textContent);
      option.disabled = option.hidden;
    }
    const selected = select.selectedOptions[0];
    if (selected?.disabled) {
      select.value = options.find(option => !option.disabled && matches(option.textContent).length)?.value ?? '';
      select.dispatchEvent(new Event('change',{ bubbles: true }));
    }
  }
  for (const container of new Set([...cards].map(card => card.parentElement))) {
    if (!container) continue;
    const siblings = [...container.children].filter(child => [...cards].includes(child));
    const selected = siblings.some(card => wasSelected.has(card) && !card.hasAttribute('data-town-inactive'));
    if (!selected) {
      const next = siblings.find(card => !card.hasAttribute('data-town-inactive'));
      if (next) { const input = next.querySelector('input[type=radio]'); if (input) input.click(); else next.click(); }
    }
  }
  document.querySelectorAll('[data-active-town-list]').forEach(element => { element.textContent = active.join(' · ') || 'No active service towns'; });
}
const style = document.createElement('style');
style.textContent = '[data-town-inactive] { display: none !important; }';
document.head.appendChild(style);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',refreshTowns);
else refreshTowns();
setInterval(refreshTowns,15000);