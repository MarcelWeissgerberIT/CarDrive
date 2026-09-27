// App controller: screens, shop, garage, quests, race flow
import { I18N, t } from './i18n.js';
import { CARS, TRACKS, POWERUPS, PAINTS, RIMS, DECALS, QUESTS, OPPONENTS, PLACE_BONUS } from './data.js';
import { Save } from './save.js';
import { Audio } from './audio.js';
import { RaceGame } from './game.js';
import { Preview } from './garage.js';
import { Input } from './input.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const S = Save.load();
I18N.init(S.lang);

const game = new RaceGame($('#game'));
const preview = new Preview($('#preview'));
const input = new Input({ wheelEl: $('#wheel'), zoneEl: $('#steerzone'), onSteer: v => { game.steerInput = v; } });
let currentTrack = TRACKS[0];
let shopTab = 'powerups', cosTab = 'paint';

// ---------- helpers ----------
const carById = id => CARS.find(c => c.id === id);
const cosmetic = (id) => PAINTS.find(p => p.id === id) || RIMS.find(r => r.id === id) || DECALS.find(d => d.id === id);
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1800); }
function show(id) { $$('.screen').forEach(s => s.classList.add('hidden')); $('#' + id).classList.remove('hidden'); refreshCurrency(); }
function refreshCurrency() { $$('.v-coins').forEach(e => e.textContent = S.coins); $$('.v-gems').forEach(e => e.textContent = S.gems); $('#quest-dot').classList.toggle('hidden', !QUESTS.some(q => questDone(q) && !S.claimed.includes(q.id))); }
function questDone(q) { return (S.stats[q.stat] || 0) >= q.target; }
function applyLang() {
  $$('[data-t]').forEach(e => { const d = e.querySelector('.dot'); e.textContent = t(e.dataset.t); if (d) e.appendChild(d); });
  $('#btn-lang').textContent = I18N.lang.toUpperCase();
  $$('.seg button').forEach(b => b.classList.toggle('active', b.dataset.lang === I18N.lang));
  $('#set-sound').textContent = S.sound ? t('on') : t('off'); $('#set-sound').classList.toggle('on', S.sound);
  $('#set-tilt').textContent = S.tilt ? t('on') : t('off'); $('#set-tilt').classList.toggle('on', S.tilt);
  $('#steer-hint').textContent = t('steerHint');
  renderMenuCar();
}
function renderMenuCar() { const c = carById(S.selectedCar); $('#menu-car-img').src = c.img; $('#menu-car-name').textContent = I18N.pick(c.name); }
function starText(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }
function paintColor() { return cosmetic(S.paint).color; }
function rimColor() { return cosmetic(S.rim).color; }
function decalEmoji() { return cosmetic(S.decal).emoji; }

// ---------- audio unlock ----------
function unlockAudio() { Audio.init(); Audio.resume(); Audio.setEnabled(S.sound); }
window.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('click', e => { if (e.target.closest('button')) Audio.click(); }, true);

// ---------- menu ----------
$('#btn-play').onclick = () => { renderTracks(); show('tracks'); };
$('#btn-garage').onclick = () => { renderGarage(); show('garage'); preview.start(); };
$('#btn-shop').onclick = () => { renderShop(); show('shop'); };
$('#btn-quests').onclick = () => { renderQuests(); show('quests'); };
$('#btn-settings').onclick = () => $('#settings').classList.remove('hidden');
$('#btn-lang').onclick = () => { I18N.set(I18N.lang === 'de' ? 'en' : 'de'); S.lang = I18N.lang; Save.save(); applyLang(); };
$$('.back').forEach(b => b.onclick = () => { preview.stop(); show('menu'); });
$('#settings .close').onclick = () => $('#settings').classList.add('hidden');
$$('.seg button').forEach(b => b.onclick = () => { I18N.set(b.dataset.lang); S.lang = I18N.lang; Save.save(); applyLang(); });
$('#set-sound').onclick = () => { S.sound = !S.sound; Save.save(); Audio.setEnabled(S.sound); applyLang(); };
$('#set-tilt').onclick = async () => { S.tilt = !S.tilt; S.tilt = await input.enableTilt(S.tilt); Save.save(); applyLang(); };

// ---------- tracks ----------
function renderTracks() {
  const list = $('#track-list'); list.innerHTML = '';
  TRACKS.forEach((tr, i) => {
    const unlocked = S.tracksUnlocked.includes(tr.id);
    const card = document.createElement('div'); card.className = 'card track-card' + (unlocked ? '' : ' locked');
    card.innerHTML = `<div class="sky" style="background:linear-gradient(${tr.sky},${tr.fog});--road:${tr.road};--edge:${tr.edge}"></div>
      <div class="name">${I18N.pick(tr.name)}</div>
      <div class="desc">${t('length')}: ${(tr.length / 1000).toFixed(1)} ${t('km')} · ${t('difficulty')}: <span class="stars">${starText(tr.stars)}</span></div>
      <div class="desc">${unlocked ? (S.best[tr.id] ? '🏆 ' + t('place' + S.best[tr.id]) : '') : t(i === 1 ? 'unlockTrack2' : 'unlockTrack3')}</div>
      <button class="big-btn ${unlocked ? 'pink' : 'grey'}" ${unlocked ? '' : 'disabled'}>${t('start')}</button>`;
    card.querySelector('button').onclick = () => startRace(tr);
    list.appendChild(card);
  });
  $('#opp-list').innerHTML = OPPONENTS.map(o => `<img src="${o.img}" title="${o.name}" alt="${o.name}">`).join('');
}

// ---------- garage ----------
function renderGarage() {
  const list = $('#car-list'); list.innerHTML = '';
  CARS.forEach(c => {
    const owned = S.ownedCars.includes(c.id), sel = S.selectedCar === c.id;
    const card = document.createElement('div'); card.className = 'card' + (owned ? '' : ' locked') + (sel ? ' sel' : '');
    const q = c.unlockQuest ? QUESTS.find(q => q.id === c.unlockQuest) : null;
    card.innerHTML = `<img src="${c.img}" alt=""><div class="name">${I18N.pick(c.name)}</div>
      <div class="bars">${['speed', 'handling', 'armor'].map(k => `<div class="bar"><span>${t(k)}</span><i><b style="width:${c[k] * 20}%"></b></i></div>`).join('')}</div>
      ${owned ? `<button class="big-btn ${sel ? 'green' : 'cyan'}">${sel ? t('selected') : t('select')}</button>` : `<div class="desc">${t('unlockBy')} <b>${q ? I18N.pick(q.name) : ''}</b></div>`}`;
    if (owned) card.querySelector('button').onclick = () => { S.selectedCar = c.id; Save.save(); renderGarage(); renderMenuCar(); };
    list.appendChild(card);
  });
  $('#preview-name').textContent = I18N.pick(carById(S.selectedCar).name);
  preview.setCar({ body: carById(S.selectedCar).body, color: paintColor(), rim: rimColor(), decal: decalEmoji() });
  renderCosmetics();
}
$$('.cos-tabs .tab').forEach(b => b.onclick = () => { cosTab = b.dataset.tab; $$('.cos-tabs .tab').forEach(x => x.classList.toggle('active', x === b)); renderCosmetics(); });
function renderCosmetics() {
  const list = $('#cos-list'); list.innerHTML = '';
  const items = cosTab === 'paint' ? PAINTS : cosTab === 'rim' ? RIMS : DECALS;
  items.forEach(it => {
    const owned = S.ownedCosmetics.includes(it.id), sel = S[cosTab] === it.id;
    const el = document.createElement('div'); el.className = 'swatch' + (sel ? ' sel' : '') + (owned ? '' : ' locked');
    el.title = I18N.pick(it.name);
    if (it.color) el.style.background = it.color; else el.textContent = it.emoji || '🚫';
    el.onclick = () => { if (!owned) { toast('💎 ' + t('shop')); return; } S[cosTab] = it.id; Save.save(); renderGarage(); };
    list.appendChild(el);
  });
}

// ---------- shop ----------
$$('.shop-tabs .tab').forEach(b => b.onclick = () => { shopTab = b.dataset.tab; $$('.shop-tabs .tab').forEach(x => x.classList.toggle('active', x === b)); renderShop(); });
function renderShop() {
  const list = $('#shop-list'); list.innerHTML = '';
  const add = (html, onBuy) => { const c = document.createElement('div'); c.className = 'card'; c.innerHTML = html; const b = c.querySelector('button'); if (b) b.onclick = onBuy; list.appendChild(c); return c; };
  if (shopTab === 'powerups') POWERUPS.forEach(p => add(`<img src="${p.img}" alt=""><span class="inv">${t('inventory')}: ${S.inventory[p.id] || 0}</span><div class="name">${t(p.id)}</div><div class="desc">${t(p.id + 'Desc')}</div>
      <button class="big-btn yellow">🪙 ${p.price}</button>`, () => buy('coins', p.price, () => { S.inventory[p.id] = (S.inventory[p.id] || 0) + 1; })));
  else if (shopTab === 'exchange') add(`<div class="swatch-big" style="background:linear-gradient(#d9f8ff,#7fe9ff)">💎</div><div class="name">${t('exchange')}</div><div class="desc">${t('exchangeDesc')}</div><button class="big-btn cyan">${t('exchangeBtn')}</button>`, () => buy('coins', 500, () => { S.gems += 5; }, true));
  else {
    const items = shopTab === 'paints' ? PAINTS : shopTab === 'rims' ? RIMS : DECALS;
    const key = shopTab === 'paints' ? 'paint' : shopTab === 'rims' ? 'rim' : 'decal';
    items.forEach(it => {
      const owned = S.ownedCosmetics.includes(it.id), eq = S[key] === it.id;
      const vis = it.color ? `<div class="swatch-big" style="background:${it.color}">${shopTab === 'rims' ? '⚙️' : ''}</div>` : `<div class="swatch-big" style="background:#ffe3f1">${it.emoji || '🚫'}</div>`;
      add(`${vis}<div class="name">${I18N.pick(it.name)}</div><button class="big-btn ${owned ? (eq ? 'green' : 'cyan') : 'purple'}" ${eq ? 'disabled' : ''}>${owned ? (eq ? t('equipped') : t('equip')) : '💎 ' + it.price}</button>`,
        () => { if (owned) { S[key] = it.id; Save.save(); renderShop(); } else buy('gems', it.price, () => { S.ownedCosmetics.push(it.id); S[key] = it.id; }); });
    });
  }
}
function buy(cur, price, apply, noCount) {
  if (S[cur] < price) { toast(t('notEnough', { cur: t(cur) })); Audio.fail(); return; }
  S[cur] -= price; apply(); if (!noCount) S.stats.purchases++; Save.save(); Audio.buy(); toast(t('boughtOk')); refreshCurrency(); renderShop();
}

// ---------- quests ----------
function renderQuests() {
  const list = $('#quest-list'); list.innerHTML = '';
  QUESTS.forEach(q => {
    const val = Math.min(S.stats[q.stat] || 0, q.target), done = questDone(q), claimed = S.claimed.includes(q.id);
    const el = document.createElement('div'); el.className = 'quest' + (done ? ' done' : '') + (claimed ? ' claimed' : '');
    const rw = q.reward.car ? `<img src="${carById(q.reward.car).img}" alt=""> ${I18N.pick(carById(q.reward.car).name)}` : q.reward.coins ? `🪙 ${q.reward.coins}` : `💎 ${q.reward.gems}`;
    const fmt = q.stat === 'distance' ? `${(val / 1000).toFixed(1)}/${q.target / 1000} ${t('km')}` : `${val}/${q.target}`;
    el.innerHTML = `<div><div class="qname">${I18N.pick(q.name)}</div><div class="qdesc">${I18N.pick(q.desc)} · ${fmt}</div><div class="qbar"><b style="width:${val / q.target * 100}%"></b></div></div>
      <div class="qreward">${rw}</div><button class="big-btn ${done && !claimed ? 'green' : 'grey'}" ${done && !claimed ? '' : 'disabled'}>${claimed ? t('claimed') : t('claim')}</button>`;
    el.querySelector('button').onclick = () => claimQuest(q);
    list.appendChild(el);
  });
}
function claimQuest(q) {
  if (S.claimed.includes(q.id) || !questDone(q)) return;
  S.claimed.push(q.id);
  if (q.reward.coins) S.coins += q.reward.coins;
  if (q.reward.gems) S.gems += q.reward.gems;
  if (q.reward.car && !S.ownedCars.includes(q.reward.car)) { S.ownedCars.push(q.reward.car); toast('🚗 ' + t('carUnlocked') + ' ' + I18N.pick(carById(q.reward.car).name)); }
  Save.save(); Audio.fanfare(); renderQuests(); refreshCurrency();
}

// ---------- race ----------
const hud = { place: $('#hud-place'), progress: $('#hud-progress'), racers: $('#hud-racers'), coins: $('#hud-coins'), speed: $('#hud-speed'), effects: $('#hud-effects'), pus: $('#hud-powerups'), cd: $('#countdown'), lines: $('#speedlines'), flash: $('#flash') };
let raceInventory = null, lastCd = null;
function startRace(track) {
  currentTrack = track; unlockAudio(); preview.stop();
  raceInventory = { ...S.inventory };
  const car = carById(S.selectedCar);
  $$('.screen').forEach(s => s.classList.add('hidden')); $('#hud').classList.remove('hidden');
  $('#results').classList.add('hidden'); $('#steer-hint').classList.remove('hidden');
  hud.racers.innerHTML = `<img class="racer-av you" src="${car.img}" alt="">` + OPPONENTS.map(o => `<img class="racer-av" data-id="${o.id}" src="${o.img}" alt="">`).join('');
  buildPowerupButtons(); lastCd = null; hud.cd.textContent = ''; hud.lines.classList.remove('on');
  input.set(0); input.tiltEnabled = S.tilt;
  try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* not supported */ }
  game.resize();
  game.start({ track, car, paint: paintColor(), rim: rimColor(), decal: decalEmoji(), inventory: raceInventory, cb: {
    onHud: updateHud, onCountdown: n => { hud.cd.textContent = n > 0 ? n : t('go'); hud.cd.classList.remove('pop'); void hud.cd.offsetWidth; hud.cd.classList.add('pop'); if (n <= 0) { setTimeout(() => hud.cd.textContent = '', 900); setTimeout(() => $('#steer-hint').classList.add('hidden'), 3500); } },
    onEvent: onRaceEvent, onFinishLine: p => { hud.cd.textContent = t('finish'); hud.cd.classList.add('pop'); }, onFinish: onFinish,
  } });
}
function buildPowerupButtons() {
  hud.pus.innerHTML = '';
  POWERUPS.filter(p => p.id !== 'doubler').forEach(p => {
    const b = document.createElement('button'); b.className = 'pu-btn'; b.style.backgroundImage = `url(${p.img})`; b.dataset.id = p.id;
    b.innerHTML = `<span class="cnt">${raceInventory[p.id] || 0}</span>`;
    b.onpointerdown = e => { e.stopPropagation(); if (game.usePowerup(p.id)) { b.querySelector('.cnt').textContent = raceInventory[p.id]; } };
    hud.pus.appendChild(b);
  });
}
function updateHud(h) {
  hud.place.textContent = h.place; hud.coins.textContent = h.coins; hud.speed.textContent = Math.round(h.speed * 3.2);
  hud.progress.style.width = (h.progress * 100) + '%';
  for (const r of h.racers) { const el = r.id === 'you' ? hud.racers.querySelector('.you') : hud.racers.querySelector(`[data-id="${r.id}"]`); if (el) el.style.left = (r.p * 100) + '%'; }
  const E = h.effects; const fx = [];
  if (E.nitro > 0) fx.push(`🔥 ${t('nitro')} ${E.nitro.toFixed(0)}s`); if (E.shield > 0) fx.push(`🛡️ ${t('shield')}`);
  if (E.magnet > 0) fx.push(`🧲 ${t('magnet')} ${E.magnet.toFixed(0)}s`); if (E.slowmo > 0) fx.push(`⏳ ${t('slowmo')} ${E.slowmo.toFixed(0)}s`); if (E.doubler > 0) fx.push(`✨ ${t('activeDoubler')}`);
  hud.effects.innerHTML = fx.map(f => `<span class="pill">${f}</span>`).join('');
  hud.lines.classList.toggle('on', E.nitro > 0);
  hud.pus.querySelectorAll('.pu-btn').forEach(b => { b.disabled = !(h.inventory[b.dataset.id] > 0) || h.state !== 'race'; });
}
function onRaceEvent(type, v) {
  if (type === 'crash') { hud.flash.classList.add('hit'); setTimeout(() => hud.flash.classList.remove('hit'), 80); if (navigator.vibrate) navigator.vibrate(120); }
  if (type === 'bump' && navigator.vibrate) navigator.vibrate(40);
  if (type === 'coin') { const p = document.createElement('div'); p.className = 'coin-pop'; p.textContent = '+' + v; const r = hud.coins.getBoundingClientRect(); p.style.left = r.left + 'px'; p.style.top = (r.top + 30) + 'px'; $('#hud').appendChild(p); setTimeout(() => p.remove(), 700); }
}
$('#btn-pause').onclick = () => { game.setPaused(true); $('#pause').classList.remove('hidden'); };
$('#btn-resume').onclick = () => { $('#pause').classList.add('hidden'); game.setPaused(false); };
$('#btn-quit').onclick = () => { $('#pause').classList.add('hidden'); game.stop(); S.inventory = raceInventory; Save.save(); show('menu'); };
document.addEventListener('visibilitychange', () => { if (document.hidden && game.running && game.state !== 'done' && !game.paused) $('#btn-pause').click(); });

function onFinish(r) {
  const st = S.stats; const T = currentTrack;
  const bonus = Math.round(PLACE_BONUS[r.place - 1] * T.coinMul), coins = Math.round(r.coins * T.coinMul), gems = r.place === 1 ? T.stars * 2 : r.place === 2 ? 1 : 0;
  S.coins += bonus + coins; S.gems += gems; S.inventory = r.inventory;
  st.races++; st.coinsTotal += bonus + coins; st.dodged += r.dodged; st.nitroUsed += r.nitroUsed; st.distance += r.distance;
  if (r.place === 1) st.wins++; if (r.place <= 3) st.podiums++; if (r.crashes === 0) st.cleanRaces++;
  if (!S.best[T.id] || r.place < S.best[T.id]) S.best[T.id] = r.place;
  if (T.id === 'candy' && r.place <= 3 && !S.tracksUnlocked.includes('choco')) S.tracksUnlocked.push('choco');
  if (T.id === 'choco' && r.place === 1 && !S.tracksUnlocked.includes('neon')) S.tracksUnlocked.push('neon');
  Save.save();
  $('#res-place').textContent = t('youPlaced', { pos: t('place' + r.place) }) + (r.place === 1 ? ' 🏆' : r.place <= 3 ? ' 🎉' : '');
  $('#res-rows').innerHTML = `<div><span>${t('placeBonus')}</span><span>🪙 ${bonus}</span></div><div><span>${t('coinsCollected')}</span><span>🪙 ${coins}</span></div>
    ${gems ? `<div><span>${t('gems')}</span><span>💎 ${gems}</span></div>` : ''}<div><span>${t('crashes')}</span><span>💥 ${r.crashes}</span></div><div class="total"><span>${t('total')}</span><span>🪙 ${bonus + coins}</span></div>`;
  const newly = QUESTS.filter(q => questDone(q) && !S.claimed.includes(q.id));
  $('#res-quests').innerHTML = newly.map(q => `<div>🏅 ${t('newQuest')} ${I18N.pick(q.name)}</div>`).join('');
  $('#results').classList.remove('hidden'); refreshCurrency();
}
$('#btn-again').onclick = () => { $('#results').classList.add('hidden'); game.stop(); startRace(currentTrack); };
$('#btn-menu').onclick = () => { $('#results').classList.add('hidden'); game.stop(); show('menu'); };

// ---------- boot ----------
applyLang(); refreshCurrency(); show('menu');
window.CarDrive = { game, save: S };
if (S.tilt) input.enableTilt(true);
window.addEventListener('resize', () => { if (!$('#garage').classList.contains('hidden')) preview.resize(); });
