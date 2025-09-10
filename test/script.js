(function () {
  const STORE = {
    theme: 'pref:theme',
    ticksPrefix: 'chk:',
    profile: 'trip:profile',
    traveler: 'trip:traveler',
    qtyPrefix: 'qty:' // key = qty:<itemKey>:<travId>
  };

  // ---------- THEME ----------
  const html = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem(STORE.theme) || 'light';
  html.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  themeToggle.addEventListener('click', () => {
    const now = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', now);
    localStorage.setItem(STORE.theme, now);
    themeToggle.textContent = now === 'dark' ? '☀️' : '🌙';
  });

  // ---------- PRINT / RESET / SAVE / LOAD / CLEAR ----------
  document.getElementById('printBtn')?.addEventListener('click', () => window.print());

  document.getElementById('resetBtn')?.addEventListener('click', () => {
    // clear ticks & qty only
    clearLocalByPrefix(STORE.ticksPrefix);
    clearLocalByPrefix(STORE.qtyPrefix);
    // reset checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      dim(cb);
    });
    // reset quantities on screen
    document.querySelectorAll('.qty .count').forEach(el => el.textContent = '0');
    document.querySelectorAll('.qty .label:last-child').forEach(el => el.textContent = '(Total: 0)');
    toast('Reset complete.');
  });

  // SAVE (download snapshot)
  document.getElementById('saveBtn')?.addEventListener('click', () => {
    const snapshot = collectSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g,'').slice(0,15);
    a.download = `travel-checklist-${stamp}.json`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Saved to file.');
  });

  // LOAD (import snapshot)
  const loadBtn = document.getElementById('loadBtn');
  const loadFile = document.getElementById('loadFile');
  loadBtn?.addEventListener('click', () => loadFile.click());
  loadFile?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      applySnapshot(data);
      toast('Loaded. Refreshing…');
      setTimeout(() => window.location.reload(), 300);
    } catch (err) {
      console.error(err);
      alert('Could not load file. Is it a valid JSON export?');
    } finally {
      loadFile.value = '';
    }
  });

  // CLEAR ALL (everything, including profile & theme)
  document.getElementById('clearAllBtn')?.addEventListener('click', () => {
    if (!confirm('Clear ALL saved data (ticks, quantities, profile, traveler, theme)?')) return;
    clearLocalByPrefix(STORE.ticksPrefix);
    clearLocalByPrefix(STORE.qtyPrefix);
    localStorage.removeItem(STORE.profile);
    localStorage.removeItem(STORE.traveler);
    localStorage.removeItem(STORE.theme);
    toast('All cleared. Refreshing…');
    setTimeout(() => window.location.reload(), 300);
  });

  function clearLocalByPrefix(prefix) {
    const keys = Object.keys(localStorage);
    keys.forEach(k => { if (k.startsWith(prefix)) localStorage.removeItem(k); });
  }

  // ---------- PROFILE ----------
  const tripForm = document.getElementById('tripForm');
  const tripBanner = document.getElementById('tripBanner');

  const defaultProfile = {
    from: 'Lebanon',
    to: 'Cyprus',
    month: 'August',
    adults: 2,
    children: 1,
    childAges: '6',
    rentCar: true,
    showMilitary: false
  };

  const profile = loadProfile();
  applyProfileToForm(profile);
  applyProfile(profile);

  document.getElementById('applyProfile')?.addEventListener('click', () => {
    const newProf = {
      from: document.getElementById('from').value.trim() || '—',
      to: document.getElementById('to').value.trim() || '—',
      month: document.getElementById('month').value,
      adults: clampInt(document.getElementById('adults').value, 1, 6, 2),
      children: clampInt(document.getElementById('children').value, 0, 6, 0),
      childAges: document.getElementById('childAges').value.trim(),
      rentCar: document.getElementById('rentCar').checked,
      showMilitary: document.getElementById('showMilitary').checked
    };
    saveProfile(newProf);
    applyProfile(newProf);
    toast('Profile applied.');
  });

  function clampInt(v, min, max, def) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return def;
    return Math.max(min, Math.min(max, n));
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(STORE.profile);
      return raw ? { ...defaultProfile, ...JSON.parse(raw) } : { ...defaultProfile };
    } catch {
      return { ...defaultProfile };
    }
  }

  function saveProfile(p) {
    localStorage.setItem(STORE.profile, JSON.stringify(p));
  }

  function applyProfileToForm(p) {
    tripForm.querySelector('#from').value = p.from;
    tripForm.querySelector('#to').value = p.to;
    tripForm.querySelector('#month').value = p.month;
    tripForm.querySelector('#adults').value = p.adults;
    tripForm.querySelector('#children').value = p.children;
    tripForm.querySelector('#childAges').value = p.childAges;
    tripForm.querySelector('#rentCar').checked = p.rentCar;
    tripForm.querySelector('#showMilitary').checked = p.showMilitary;
  }

  function applyProfile(p) {
    const heatTip = (['June','July','August','September'].includes(p.month)) ? ' • Heat/UV strong—pack SPF 50, hats, water.' : '';
    tripBanner.textContent = `Trip: ${p.from} ➜ ${p.to} • When: ${p.month} • Travelers: ${p.adults} adult(s) + ${p.children} child(ren)${heatTip}`;
    showSection('kid', p.children > 0);
    showSection('driving', !!p.rentCar);
    showSection('military', !!p.showMilitary, true);
    rebuildTravelerSwitcher(p);
    refreshAllQuantities();
  }

  function showSection(sectionKey, show, isDetails = false) {
    const sel = isDetails ? `details[data-section="${sectionKey}"]` : `section[data-section="${sectionKey}"]`;
    const el = document.querySelector(sel);
    if (!el) return;
    el.style.display = show ? '' : 'none';
  }

  // ---------- CHECKBOX PERSIST ----------
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    const k = keyForCheckbox(cb);
    const saved = localStorage.getItem(k);
    if (saved === '1') cb.checked = true;
    dim(cb);
    cb.addEventListener('change', function(){
      const key = keyForCheckbox(this);
      if (this.checked) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
      dim(this);
    });
  });

  function keyForCheckbox(input) {
    const item = input.closest('.item');
    const section = input.closest('[data-section]');
    const secKey = section?.getAttribute('data-section') || 'sec';
    const label = item?.innerText?.replace(/\s+/g,' ').trim() || 'item';
    return `${STORE.ticksPrefix}${secKey}::${label}`;
  }

  function dim(input) {
    const item = input.closest('.item');
    if (item) item.classList.toggle('dimmed', input.checked);
  }

  // ---------- TRAVELER SWITCHER & QUANTITIES ----------
  let currentTravelerId = localStorage.getItem(STORE.traveler) || 'A1';

  function rebuildTravelerSwitcher(p) {
    const wrap = document.getElementById('travSwitch');
    wrap.innerHTML = '';
    const pills = [];
    for (let i = 1; i <= p.adults; i++) pills.push({ id: `A${i}`, label: `Adult ${i}` });
    for (let j = 1; j <= p.children; j++) pills.push({ id: `C${j}`, label: `Child ${j}` });

    if (pills.length === 0) return;

    if (!pills.some(x => x.id === currentTravelerId)) currentTravelerId = pills[0].id;
    localStorage.setItem(STORE.traveler, currentTravelerId);

    pills.forEach(pill => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill' + (pill.id === currentTravelerId ? ' active' : '');
      b.textContent = pill.label;
      b.dataset.trav = pill.id;
      b.addEventListener('click', () => {
        currentTravelerId = pill.id;
        localStorage.setItem(STORE.traveler, currentTravelerId);
        wrap.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        refreshAllQuantities();
      });
      wrap.appendChild(b);
    });
  }

  // Build controls for each .qty
  document.querySelectorAll('.qty').forEach(q => buildQtyControl(q));

  function buildQtyControl(container) {
    const itemKey = container.dataset.quant;
    if (!itemKey) return;

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'Qty for selected traveler';

    const control = document.createElement('div');
    control.className = 'control';

    const minus = document.createElement('button');
    minus.type = 'button'; minus.textContent = '−';

    const count = document.createElement('span');
    count.className = 'count'; count.textContent = '0';

    const plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+';

    control.append(minus, count, plus);

    const total = document.createElement('span');
    total.className = 'label';
    total.style.marginLeft = '6px';
    total.textContent = '(Total: 0)';

    container.append(label, control, total);

    const updateVisibleCount = () => {
      const n = getQty(itemKey, currentTravelerId);
      count.textContent = String(n);
      const t = getTotalQty(itemKey);
      total.textContent = `(Total: ${t})`;
    };

    plus.addEventListener('click', () => {
      const n = getQty(itemKey, currentTravelerId) + 1;
      setQty(itemKey, currentTravelerId, n);
      updateVisibleCount();
    });

    minus.addEventListener('click', () => {
      const n = Math.max(0, getQty(itemKey, currentTravelerId) - 1);
      setQty(itemKey, currentTravelerId, n);
      updateVisibleCount();
    });

    updateVisibleCount();
  }

  function refreshAllQuantities() {
    document.querySelectorAll('.qty').forEach(q => {
      const itemKey = q.dataset.quant;
      const count = q.querySelector('.count');
      const total = q.querySelector('.label:last-child');
      if (!itemKey || !count || !total) return;
      count.textContent = String(getQty(itemKey, currentTravelerId));
      total.textContent = `(Total: ${getTotalQty(itemKey)})`;
    });
  }

  function qtyKey(itemKey, travId) {
    return `${STORE.qtyPrefix}${itemKey}:${travId}`;
  }
  function getQty(itemKey, travId) {
    const v = localStorage.getItem(qtyKey(itemKey, travId));
    return v ? parseInt(v, 10) || 0 : 0;
  }
  function setQty(itemKey, travId, n) {
    localStorage.setItem(qtyKey(itemKey, travId), String(n));
  }
  function getTotalQty(itemKey) {
    let total = 0;
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(`${STORE.qtyPrefix}${itemKey}:`)) {
        total += parseInt(localStorage.getItem(k), 10) || 0;
      }
    });
    return total;
  }

  // ---------- EXPORT / IMPORT SNAPSHOT ----------
  function collectSnapshot() {
    const snapshot = {
      version: 1,
      theme: localStorage.getItem(STORE.theme) || 'light',
      profile: loadProfile(),
      traveler: localStorage.getItem(STORE.traveler) || 'A1',
      ticks: {},
      qty: {}
    };
    // collect ticks
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(STORE.ticksPrefix)) snapshot.ticks[k] = localStorage.getItem(k);
    });
    // collect qty
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(STORE.qtyPrefix)) snapshot.qty[k] = localStorage.getItem(k);
    });
    return snapshot;
  }

  function applySnapshot(data) {
    if (!data || typeof data !== 'object') throw new Error('Invalid snapshot');
    // clear old
    clearLocalByPrefix(STORE.ticksPrefix);
    clearLocalByPrefix(STORE.qtyPrefix);
    // write new
    if (data.theme) localStorage.setItem(STORE.theme, data.theme);
    if (data.profile) localStorage.setItem(STORE.profile, JSON.stringify({ ...loadProfile(), ...data.profile }));
    if (data.traveler) localStorage.setItem(STORE.traveler, data.traveler);
    if (data.ticks) Object.entries(data.ticks).forEach(([k, v]) => localStorage.setItem(k, v));
    if (data.qty) Object.entries(data.qty).forEach(([k, v]) => localStorage.setItem(k, v));
  }

  // ---------- Tiny toast ----------
  function toast(msg) {
    try {
      const t = document.createElement('div');
      t.textContent = msg;
      t.style.position = 'fixed';
      t.style.bottom = '16px';
      t.style.left = '50%';
      t.style.transform = 'translateX(-50%)';
      t.style.background = 'rgba(0,0,0,.75)';
      t.style.color = '#fff';
      t.style.padding = '8px 12px';
      t.style.borderRadius = '10px';
      t.style.zIndex = '9999';
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 1300);
    } catch {}
  }
})();
