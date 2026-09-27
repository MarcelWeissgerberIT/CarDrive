// Persistent save game in localStorage
const KEY = 'cardrive_save_v1';
const DEFAULT = {
  lang: null, sound: true, tilt: false,
  coins: 250, gems: 5,
  selectedCar: 'bubble', ownedCars: ['bubble'],
  paint: 'p_pink', rim: 'r_silver', decal: 'd_none',
  ownedCosmetics: ['p_pink', 'r_silver', 'd_none'],
  inventory: { nitro: 1, shield: 1, magnet: 0, slowmo: 0, doubler: 0 },
  stats: { races: 0, wins: 0, podiums: 0, coinsTotal: 0, dodged: 0, nitroUsed: 0, distance: 0, purchases: 0, cleanRaces: 0 },
  claimed: [], tracksUnlocked: ['candy'], best: {},
};

export const Save = {
  data: null,
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      this.data = raw ? deepMerge(structuredClone(DEFAULT), JSON.parse(raw)) : structuredClone(DEFAULT);
    } catch (e) { this.data = structuredClone(DEFAULT); }
    return this.data;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
  reset() { this.data = structuredClone(DEFAULT); this.save(); },
};

function deepMerge(base, over) {
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') deepMerge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}
