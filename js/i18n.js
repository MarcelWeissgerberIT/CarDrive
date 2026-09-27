// Simple i18n: German + English
const STR = {
  de: {
    play: 'Rennen', garage: 'Garage', shop: 'Shop', quests: 'Quests', settings: 'Einstellungen',
    back: 'Zurück', select: 'Auswählen', selected: 'Ausgewählt', locked: 'Gesperrt', buy: 'Kaufen',
    owned: 'Gekauft', equip: 'Anlegen', equipped: 'Angelegt', claim: 'Abholen', claimed: 'Abgeholt',
    coins: 'Münzen', gems: 'Juwelen', language: 'Sprache', sound: 'Sound', tilt: 'Neigungssteuerung',
    on: 'An', off: 'Aus', start: 'Start!', resume: 'Weiter', quit: 'Aufgeben', pause: 'Pause',
    chooseTrack: 'Strecke wählen', opponents: 'Gegner', length: 'Länge', difficulty: 'Schwierigkeit',
    unlockTrack2: 'Erreiche auf dem Zuckerwatte-Highway das Podium.',
    unlockTrack3: 'Gewinne ein Rennen im Schoko-Canyon.',
    speed: 'Tempo', handling: 'Lenkung', armor: 'Panzerung',
    unlockBy: 'Freischalten durch Quest:', notEnough: 'Nicht genug {cur}!',
    powerups: 'Power-ups', paints: 'Lackierungen', rims: 'Felgen', decals: 'Sticker', exchange: 'Tausch',
    exchangeDesc: '500 Münzen gegen 5 Juwelen tauschen', exchangeBtn: 'Tauschen',
    inventory: 'Vorrat', reward: 'Belohnung', progress: 'Fortschritt',
    position: 'Platz', finish: 'Ziel!', results: 'Ergebnis', youPlaced: 'Du wurdest {pos}.',
    placeBonus: 'Platz-Bonus', coinsCollected: 'Gesammelte Münzen', crashes: 'Crashs', total: 'Gesamt',
    again: 'Nochmal', menu: 'Menü', newQuest: 'Quest erfüllt!', carUnlocked: 'Neues Fahrzeug!',
    ready: 'Bereit?', go: 'LOS!', tapToStart: 'Tippen zum Starten', you: 'Du',
    steerHint: 'Ziehe am Lenkrad oder wische unten, um zu lenken!',
    boughtOk: 'Gekauft!', paint: 'Lack', rim: 'Felge', decal: 'Sticker',
    dailyTip: 'Tipp: Fahre in Kurven leicht gegen die Drift!',
    km: 'km', m: 'm', place1: 'Erster', place2: 'Zweiter', place3: 'Dritter', place4: 'Vierter',
    nitro: 'Nitro', shield: 'Schild', magnet: 'Magnet', slowmo: 'Zeitlupe', doubler: 'Münz-Doppler',
    nitroDesc: 'Turbo-Schub für 4 Sekunden', shieldDesc: 'Schützt einmal vor einem Crash',
    magnetDesc: 'Zieht 8 Sekunden lang Münzen an', slowmoDesc: 'Verlangsamt alles für 5 Sekunden',
    doublerDesc: 'Doppelte Münzen für das ganze Rennen (automatisch)',
    activeDoubler: 'Doppler aktiv', loading: 'Lädt...',
    credits: 'Grafiken generiert mit OpenArt', version: 'Version',
    none: 'Keiner', noDecal: 'Kein Sticker',
  },
  en: {
    play: 'Race', garage: 'Garage', shop: 'Shop', quests: 'Quests', settings: 'Settings',
    back: 'Back', select: 'Select', selected: 'Selected', locked: 'Locked', buy: 'Buy',
    owned: 'Owned', equip: 'Equip', equipped: 'Equipped', claim: 'Claim', claimed: 'Claimed',
    coins: 'Coins', gems: 'Gems', language: 'Language', sound: 'Sound', tilt: 'Tilt steering',
    on: 'On', off: 'Off', start: 'Start!', resume: 'Resume', quit: 'Quit', pause: 'Pause',
    chooseTrack: 'Choose a track', opponents: 'Opponents', length: 'Length', difficulty: 'Difficulty',
    unlockTrack2: 'Reach the podium on Cotton Candy Highway.',
    unlockTrack3: 'Win a race in Choco Canyon.',
    speed: 'Speed', handling: 'Handling', armor: 'Armor',
    unlockBy: 'Unlock by completing quest:', notEnough: 'Not enough {cur}!',
    powerups: 'Power-ups', paints: 'Paint jobs', rims: 'Rims', decals: 'Stickers', exchange: 'Exchange',
    exchangeDesc: 'Trade 500 coins for 5 gems', exchangeBtn: 'Trade',
    inventory: 'Inventory', reward: 'Reward', progress: 'Progress',
    position: 'Place', finish: 'Finish!', results: 'Results', youPlaced: 'You finished {pos}.',
    placeBonus: 'Place bonus', coinsCollected: 'Coins collected', crashes: 'Crashes', total: 'Total',
    again: 'Again', menu: 'Menu', newQuest: 'Quest complete!', carUnlocked: 'New vehicle!',
    ready: 'Ready?', go: 'GO!', tapToStart: 'Tap to start', you: 'You',
    steerHint: 'Drag the wheel or swipe at the bottom to steer!',
    boughtOk: 'Purchased!', paint: 'Paint', rim: 'Rim', decal: 'Sticker',
    dailyTip: 'Tip: steer gently against the drift in curves!',
    km: 'km', m: 'm', place1: '1st', place2: '2nd', place3: '3rd', place4: '4th',
    nitro: 'Nitro', shield: 'Shield', magnet: 'Magnet', slowmo: 'Slow-mo', doubler: 'Coin doubler',
    nitroDesc: 'Turbo boost for 4 seconds', shieldDesc: 'Blocks one crash',
    magnetDesc: 'Attracts coins for 8 seconds', slowmoDesc: 'Slows everything for 5 seconds',
    doublerDesc: 'Double coins for the whole race (automatic)',
    activeDoubler: 'Doubler active', loading: 'Loading...',
    credits: 'Artwork generated with OpenArt', version: 'Version',
    none: 'None', noDecal: 'No sticker',
  },
};

export const I18N = {
  lang: 'en',
  init(saved) {
    this.lang = saved || ((navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en');
    document.documentElement.lang = this.lang;
  },
  set(l) { this.lang = l; document.documentElement.lang = l; },
  t(key, params) {
    let s = (STR[this.lang] && STR[this.lang][key]) ?? STR.en[key] ?? key;
    if (params) for (const k in params) s = s.replace('{' + k + '}', params[k]);
    return s;
  },
  // pick from {de:..., en:...}
  pick(obj) { return obj[this.lang] ?? obj.en; },
};
export const t = (k, p) => I18N.t(k, p);
