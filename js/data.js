// Static game data: cars, tracks, power-ups, cosmetics, quests, opponents
export const CARS = [
  { id: 'bubble', name: { de: 'Bubble Buggy', en: 'Bubble Buggy' }, img: 'assets/img/car_bubble.jpg',
    speed: 2, handling: 4, armor: 2, maxSpeed: 46, lateral: 13, crashMul: 1.0, body: 'beetle', color: '#ff6fb5', unlockQuest: null },
  { id: 'cane', name: { de: 'Candy Cruiser', en: 'Candy Cruiser' }, img: 'assets/img/car_cane.jpg',
    speed: 3, handling: 3, armor: 3, maxSpeed: 50, lateral: 12, crashMul: 0.9, body: 'muscle', color: '#ff3b3b', unlockQuest: 'collector' },
  { id: 'jelly', name: { de: 'Jelly Jet', en: 'Jelly Jet' }, img: 'assets/img/car_jelly.jpg',
    speed: 4, handling: 4, armor: 1, maxSpeed: 55, lateral: 14, crashMul: 1.15, body: 'sport', color: '#4de07a', unlockQuest: 'podium' },
  { id: 'lolly', name: { de: 'Lolly Lowrider', en: 'Lolly Lowrider' }, img: 'assets/img/car_lolly.jpg',
    speed: 4, handling: 3, armor: 3, maxSpeed: 56, lateral: 12, crashMul: 0.85, body: 'lowrider', color: '#b44bff', unlockQuest: 'winner' },
  { id: 'gummy', name: { de: 'Gummy Truck', en: 'Gummy Truck' }, img: 'assets/img/car_gummy.jpg',
    speed: 3, handling: 2, armor: 5, maxSpeed: 52, lateral: 10, crashMul: 0.55, body: 'truck', color: '#ff9a2e', unlockQuest: 'marathon' },
  { id: 'rocket', name: { de: 'Rocket Rush', en: 'Rocket Rush' }, img: 'assets/img/car_rocket.jpg',
    speed: 5, handling: 5, armor: 2, maxSpeed: 62, lateral: 15, crashMul: 1.0, body: 'hover', color: '#2ee6ff', unlockQuest: 'champion' },
];

export const TRACKS = [
  { id: 'candy', name: { de: 'Zuckerwatte-Highway', en: 'Cotton Candy Highway' }, length: 2200, stars: 1,
    sky: '#8ce4ff', skyTop: '#4fb8ff', fog: '#d8f6ff', ground: '#7ee36b', hillTop: '#ffb3e0', road: '#6b4f8f', edge: '#ff63b8', hills: 1, pano: [['#b9a6ff', 0.6], ['#ffb3e0', 0.68], ['#a6f0ff', 0.76]], aiSpeed: 0.86, density: 0.8, coinMul: 1 },
  { id: 'choco', name: { de: 'Schoko-Canyon', en: 'Choco Canyon' }, length: 3400, stars: 2,
    sky: '#ffb15c', skyTop: '#ff6f91', fog: '#ffe0b0', ground: '#9a6a3a', hillTop: '#f7c9a0', road: '#4a2d1f', edge: '#ffd23f', hills: 1.4, pano: [['#c46a8a', 0.55], ['#7a4a2a', 0.64], ['#e8a86a', 0.74]], aiSpeed: 0.95, density: 1.0, coinMul: 1.4 },
  { id: 'neon', name: { de: 'Neon-Jelly-Nacht', en: 'Neon Jelly Night' }, length: 4800, stars: 3,
    sky: '#2a1360', skyTop: '#0a0520', fog: '#4a2a8a', ground: '#3a1c66', hillTop: '#7a3fb0', road: '#1d1035', edge: '#2ef2ff', hills: 1.2, pano: [['#1a0b3a', 0.58], ['#3a1a6a', 0.66], ['#5a2f9a', 0.75]], aiSpeed: 1.02, density: 1.25, coinMul: 1.9, night: true },
];

export const POWERUPS = [
  { id: 'nitro', img: 'assets/img/pu_nitro.jpg', price: 150, color: '#ff7a1a' },
  { id: 'shield', img: 'assets/img/pu_shield.jpg', price: 200, color: '#2ee6ff' },
  { id: 'magnet', img: 'assets/img/pu_magnet.jpg', price: 120, color: '#ff3b6b' },
  { id: 'slowmo', img: 'assets/img/pu_slowmo.jpg', price: 180, color: '#b44bff' },
  { id: 'doubler', img: 'assets/img/pu_doubler.jpg', price: 250, color: '#ffd23f' },
];

export const PAINTS = [
  { id: 'p_pink', name: { de: 'Bubblegum-Pink', en: 'Bubblegum Pink' }, color: '#ff6fb5', price: 0 },
  { id: 'p_cyan', name: { de: 'Eis-Cyan', en: 'Ice Cyan' }, color: '#2ee6ff', price: 6 },
  { id: 'p_lemon', name: { de: 'Zitronen-Gelb', en: 'Lemon Yellow' }, color: '#ffe23f', price: 6 },
  { id: 'p_grape', name: { de: 'Trauben-Lila', en: 'Grape Purple' }, color: '#9b4dff', price: 8 },
  { id: 'p_mint', name: { de: 'Minz-Grün', en: 'Mint Green' }, color: '#4dff9b', price: 8 },
  { id: 'p_choco', name: { de: 'Schoko-Braun', en: 'Choco Brown' }, color: '#7a4a2a', price: 10 },
  { id: 'p_gold', name: { de: 'Karamell-Gold', en: 'Caramel Gold' }, color: '#ffb12e', price: 15 },
  { id: 'p_black', name: { de: 'Lakritz-Schwarz', en: 'Licorice Black' }, color: '#2a2233', price: 20 },
];

export const RIMS = [
  { id: 'r_silver', name: { de: 'Silber', en: 'Silver' }, color: '#d8d8e6', price: 0 },
  { id: 'r_gold', name: { de: 'Gold', en: 'Gold' }, color: '#ffc63a', price: 8 },
  { id: 'r_pink', name: { de: 'Neon-Pink', en: 'Neon Pink' }, color: '#ff3fb0', price: 10 },
  { id: 'r_cyan', name: { de: 'Neon-Cyan', en: 'Neon Cyan' }, color: '#2ef2ff', price: 10 },
];

export const DECALS = [
  { id: 'd_none', name: { de: 'Kein Sticker', en: 'No sticker' }, emoji: '', price: 0 },
  { id: 'd_star', name: { de: 'Stern', en: 'Star' }, emoji: '⭐', price: 5 },
  { id: 'd_heart', name: { de: 'Herz', en: 'Heart' }, emoji: '💖', price: 5 },
  { id: 'd_fire', name: { de: 'Flamme', en: 'Flame' }, emoji: '🔥', price: 7 },
  { id: 'd_lolly', name: { de: 'Lolli', en: 'Lolly' }, emoji: '🍭', price: 7 },
  { id: 'd_bolt', name: { de: 'Blitz', en: 'Bolt' }, emoji: '⚡', price: 9 },
  { id: 'd_bear', name: { de: 'Gummibär', en: 'Gummy Bear' }, emoji: '🧸', price: 12 },
];

// Quests: stat key + target; reward: coins/gems/car
export const QUESTS = [
  { id: 'first', name: { de: 'Erste Fahrt', en: 'First Ride' }, desc: { de: 'Beende 1 Rennen', en: 'Finish 1 race' }, stat: 'races', target: 1, reward: { coins: 200 } },
  { id: 'collector', name: { de: 'Sammler', en: 'Collector' }, desc: { de: 'Sammle 300 Münzen', en: 'Collect 300 coins' }, stat: 'coinsTotal', target: 300, reward: { car: 'cane' } },
  { id: 'dodger', name: { de: 'Ausweichkünstler', en: 'Dodge Master' }, desc: { de: 'Weiche 150 Hindernissen aus', en: 'Dodge 150 obstacles' }, stat: 'dodged', target: 150, reward: { gems: 5 } },
  { id: 'podium', name: { de: 'Podium', en: 'Podium' }, desc: { de: 'Erreiche 3x die Top 3', en: 'Finish top 3 three times' }, stat: 'podiums', target: 3, reward: { car: 'jelly' } },
  { id: 'turbo', name: { de: 'Turbo-Fan', en: 'Turbo Fan' }, desc: { de: 'Nutze 10x Nitro', en: 'Use nitro 10 times' }, stat: 'nitroUsed', target: 10, reward: { coins: 300 } },
  { id: 'winner', name: { de: 'Sieger', en: 'Winner' }, desc: { de: 'Gewinne 3 Rennen', en: 'Win 3 races' }, stat: 'wins', target: 3, reward: { car: 'lolly' } },
  { id: 'clean', name: { de: 'Unkaputtbar', en: 'Unbreakable' }, desc: { de: 'Beende ein Rennen ohne Crash', en: 'Finish a race with no crash' }, stat: 'cleanRaces', target: 1, reward: { gems: 15 } },
  { id: 'shopper', name: { de: 'Shopping-Queen', en: 'Shopaholic' }, desc: { de: 'Kaufe 3 Artikel im Shop', en: 'Buy 3 shop items' }, stat: 'purchases', target: 3, reward: { gems: 10 } },
  { id: 'marathon', name: { de: 'Marathon', en: 'Marathon' }, desc: { de: 'Fahre insgesamt 20 km', en: 'Drive 20 km in total' }, stat: 'distance', target: 20000, reward: { car: 'gummy' } },
  { id: 'champion', name: { de: 'Champion', en: 'Champion' }, desc: { de: 'Gewinne 10 Rennen', en: 'Win 10 races' }, stat: 'wins', target: 10, reward: { car: 'rocket' } },
  { id: 'rich', name: { de: 'Zucker-Millionär', en: 'Sugar Tycoon' }, desc: { de: 'Sammle 5000 Münzen', en: 'Collect 5000 coins' }, stat: 'coinsTotal', target: 5000, reward: { gems: 30 } },
];

export const OPPONENTS = [
  { id: 'gus', name: 'Gummy Gus', img: 'assets/img/ai_gus.jpg', color: '#ff9a2e', skill: 0.95 },
  { id: 'betty', name: 'Bonbon Betty', img: 'assets/img/ai_betty.jpg', color: '#ff4fc3', skill: 1.0 },
  { id: 'vendo', name: 'Vendo-Bot', img: 'assets/img/ai_vendo.jpg', color: '#8be6ff', skill: 1.05 },
];

export const PLACE_BONUS = [300, 200, 120, 60];
