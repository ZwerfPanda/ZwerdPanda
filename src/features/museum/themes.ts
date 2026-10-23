import type { StopTheme } from '../../data/types';

/** What each kind of stop looks like: its name in the form, an emoji, its mood. */
export const STOP_THEMES: Record<StopTheme, { label: string; emoji: string; deco: string }> = {
  home: { label: 'Thuis', emoji: '🏠', deco: '🏠 ☀️ 🚆 ♡ 🏠' },
  station: { label: 'Groot station', emoji: '🚉', deco: '🚉 🕗 🤫 🚉' },
  platform: { label: 'Klein station, ’s avonds', emoji: '🌙', deco: '🌙 ✦ 🚆 ✦ 🌙' },
  bubbletea: { label: 'Bubble tea', emoji: '🧋', deco: '🧋 ♡ 🧋 ♡ 🧋' },
  mall: { label: 'Winkelcentrum & matcha', emoji: '🛍️', deco: '🍵 💍 🛍️ 💋 🍵' },
  birds: { label: 'Vogels & flamingo’s', emoji: '🦩', deco: '🦩 🌿 🦩 🌿' },
  pasta: { label: 'Uit eten', emoji: '🍝', deco: '🍝 🕯️ 🍔 🕯️ 🍝' },
  hotel: { label: 'Hotelkamertje', emoji: '🗝️', deco: '🗝️ ✦ 🤫 ✦ 🗝️' },
  themepark: { label: 'Pretpark', emoji: '🎢', deco: '🎢 🎡 🧸 🎡 🎢' },
  roadtrip: { label: 'Pretpark & roadtrip', emoji: '🚗', deco: '🎢 🚗 🌙 💤 🚗' },
  cinema: { label: 'Bioscoop', emoji: '🍿', deco: '🍿 🎬 👀 🎬 🍿' },
  chicken: { label: 'Kip!', emoji: '🍗', deco: '🍗 ♡ 🍗 ♡ 🍗' },
  ikea: { label: 'IKEA', emoji: '🌭', deco: '🌭 💛 💙 🌭' },
  amsterdam: { label: 'Amsterdam', emoji: '🚲', deco: '🚲 🏮 🍵 🏮 🚲' },
  miniature: { label: 'Mini-stadje', emoji: '🏰', deco: '🏰 🌷 😅 🌷 🏰' },
  pumpkin: { label: 'Halloween & pompoenen', emoji: '🎃', deco: '🦇 🎃 🕸️ 👻 🎃 🦇' },
  spa: { label: 'Spa', emoji: '🫧', deco: '🫧 🕯️ 🌿 🫧' },
  holiday: { label: 'Vakantie', emoji: '✈️', deco: '✈️ ☀️ 🧳 ☀️ ✈️' },
  christmas: { label: 'Kerst', emoji: '🎄', deco: '❄️ 🎄 ✨ 🎁 ❄️' },
  date: { label: 'Gewoon een date', emoji: '♡', deco: '♡ ✦ ♡ ✦ ♡' },
};

export const THEME_ORDER = Object.keys(STOP_THEMES) as StopTheme[];
