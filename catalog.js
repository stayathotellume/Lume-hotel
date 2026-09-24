'use strict';
/* The Lume Hotel: default catalogue. Applied once at first-run setup (optional) and editable afterwards in
   the admin dashboard (Rooms, Settings). This is configuration, not sample data: there are no guests,
   reservations, messages or staff in it. */
const ROOM_TYPES = [
  { slug: 'deluxe', name: 'Deluxe Room', price: 80000, capacity: 3, beds: '1 King bed or 2 Twin beds', size: 48, view: 'Garden and pool view',
    short: 'A calm, light-filled room with a private terrace over the gardens and pool.',
    description: 'A serene room for two, with a plush king bed, a writing desk and a private terrace over the gardens and infinity pool. Marble bathroom with a deep soaking tub and rain shower, Italian linens and warm lamplight make it easy to slow down after a day in the sun.',
    amenities: ['Private terrace', 'Air-conditioning', '55-inch smart TV', 'Marble bathroom with soaking tub', 'Rain shower', 'Nespresso machine', 'Stocked mini-bar', 'In-room safe', 'Free high-speed Wi-Fi', 'Bathrobes and slippers', 'Turndown service', 'Bluetooth sound system'], rooms: { count: 24, floors: [1, 2], per: 12 } },
  { slug: 'premier', name: 'Premier Room', price: 95000, capacity: 3, beds: '1 King bed and a daybed', size: 64, view: 'Sea view',
    short: 'More space, a freestanding tub and a sea-view terrace that catches the last light.',
    description: 'Generous space to spread out, with a freestanding tub by the window, a daybed lounge and a wide terrace facing the Sibuyan Sea. A pillow menu, evening turndown and a welcome sunset drink come as standard.',
    amenities: ['Sea-view terrace', 'Freestanding soaking tub', 'Daybed lounge', 'Pillow menu', 'Air-conditioning', '65-inch smart TV', 'Nespresso machine', 'Stocked mini-bar', 'In-room safe', 'Free high-speed Wi-Fi', 'Welcome sunset drink', 'Evening turndown'], rooms: { count: 16, floors: [3, 4], per: 8 } },
  { slug: 'executive', name: 'Executive Suite', price: 115000, capacity: 4, beds: '1 King bed and a sofa bed', size: 96, view: 'Sea view',
    short: 'A separate living room, walk-in wardrobe and a sea-view terrace with a plunge pool.',
    description: 'A true suite with a separate living room, dining nook and walk-in wardrobe. The terrace faces the water and has a private plunge pool. The bathroom has a deep tub, double rain shower and double vanity, and lounge access with evening canapés is included.',
    amenities: ['Separate living room', 'Private plunge pool terrace', 'Sofa bed', 'Walk-in wardrobe', 'Bathtub and double rain shower', 'Double vanity', 'Dining nook for two', 'Executive lounge access', 'Evening canapés and cocktails', 'Stocked mini-bar', 'Butler on request', 'Free high-speed Wi-Fi'], rooms: { count: 10, floors: [5], per: 10 } },
  { slug: 'lume', name: 'Lume Suite', price: 135000, capacity: 5, beds: '1 King bed and 1 Queen bed', size: 160, view: 'Panoramic sea view',
    short: 'Our signature suite: two bedrooms, a wraparound terrace and sunset daybeds.',
    description: 'Our signature suite, named for the light it is built around. Two bedrooms open to a wraparound terrace with sunset daybeds and a private infinity plunge pool. Living and dining rooms are made for slow evenings, and a dedicated butler, daily breakfast for every guest and airport transfers are included.',
    amenities: ['Two bedrooms', 'Wraparound terrace', 'Private infinity plunge pool', 'Sunset daybeds', 'Living and dining rooms', 'Dedicated butler', 'Daily breakfast for all guests', 'Return airport transfers', 'Freestanding bathtub', 'Walk-in wardrobe', 'Premium sound system', 'Welcome cocktails'], rooms: { count: 6, floors: [6], per: 6 } },
  { slug: 'villa', name: 'Jawili Beach Villa', price: 150000, capacity: 6, beds: '2 King bedrooms', size: 240, view: 'Private beachfront',
    short: 'A private villa on our own stretch of Jawili beach, with a pool, butler and beach dining.',
    description: 'The executive stay: a private beachfront villa on our reserved stretch of Jawili beach. Two king bedrooms, an open living pavilion, a private pool and a beach cabana are yours alone, with a dedicated butler, daily spa credit, private beach dining and a chauffeured transfer from Kalibo.',
    amenities: ['Private beach access', 'Private pool', 'Beach cabana', 'Two king bedrooms', 'Open living pavilion', 'Dedicated butler', 'Daily spa credit', 'Private beach dining', 'Chauffeured airport transfer', 'Outdoor rain shower', 'Kitchenette', 'Free high-speed Wi-Fi'], rooms: { count: 4, prefix: 'V' } }
];
const ADDONS = [
  { id: 'breakfast', label: 'Daily breakfast at Lumina', desc: '₱1,800 per adult and ₱900 per child, per night', model: 'person_night', price: 1800, child_price: 900 },
  { id: 'airport', label: 'Luxury airport transfer from Kalibo', desc: '₱6,500 per one-way transfer in a private SUV', model: 'stay', price: 6500 },
  { id: 'latecheckout', label: 'Late check-out until 4:00 PM', desc: '₱8,000, subject to availability', model: 'stay', price: 8000 },
  { id: 'spa', label: 'Lume Spa signature ritual', desc: '₱9,500 per person for a 90-minute treatment', model: 'person', price: 9500 },
  { id: 'beachdinner', label: 'Private beachfront dinner', desc: '₱28,000 for two, on the private Jawili beach', model: 'stay', price: 28000 },
  { id: 'tour', label: 'Grand Aklan tour', desc: '₱14,500 per adult and ₱7,250 per child, private full-day guided tour', model: 'person', price: 14500, child_price: 7250 }
];
const DEFAULT_SETTINGS = {
  hotel: { name: 'The Lume Hotel', tagline: 'Where Comfort Shines ✨', address: 'Jawili, Tangalan, Aklan, Philippines', phone: '09163013007', email: 'stayathotellume@gmail.com' },
  checkin: '3:00 PM', checkout: '12:00 noon', free_cancel_hours: 72, extra_adult: 7500, service_rate: 0.10, vat_rate: 0.12, max_nights: 30, hold_minutes: 30,
  bank: { bank_name: '', account_name: '', account_number: '', instructions: '' },
  social: { facebook: '', instagram: '', tiktok: '' },
  photos: {}
};
module.exports = { ROOM_TYPES, ADDONS, DEFAULT_SETTINGS };

/* Photo slots: every place the website shows a photograph. Until a photo is uploaded, the site shows an illustration. */
const STATIC_SLOTS = [
  ['ext-1', 'Home: hotel by day (wide, used as the hero photo)', 'Home'], ['lobby-0', 'Home: lobby (portrait)', 'Home'], ['map', 'Location: aerial or coast view', 'Home'],
  ['beach-0', 'Feature: private Jawili beach', 'Signature experiences'], ['spa-1', 'Feature: Lume Spa', 'Signature experiences'], ['bar-0', 'Feature: Sunset Bar', 'Signature experiences'], ['tour-0', 'Feature: Grand Aklan tour', 'Signature experiences'],
  ['dish-0', 'Dish: chicken inubaran', 'Dining'], ['dish-1', 'Dish: kinilaw na tanigue', 'Dining'], ['dish-2', 'Dish: seared tuna belly', 'Dining'], ['dish-3', 'Dish: ube and mango halo-halo', 'Dining'], ['rest-0', 'Lumina restaurant interior', 'Dining'],
  ['pool-0', 'Pool at sunset', 'Gallery'], ['pool-1', 'Pool by day', 'Gallery'], ['spa-0', 'Spa treatment room', 'Gallery'],
  ['beach-1', 'Private beach: dinner setup', 'Gallery'],
  ['ext-0', 'Exterior at dusk', 'Gallery'], ['ext-2', 'Exterior at night', 'Gallery'],
  ['sur-0', 'Surroundings: Jawili shoreline', 'Gallery'], ['sur-1', 'Surroundings: waterfall', 'Gallery'], ['sur-2', 'Surroundings: coast palms', 'Gallery'],
  ['tour-1', 'Grand Aklan tour: nature', 'Gallery'],
  ['exp-0', 'Guest experience: breakfast', 'Gallery'], ['exp-1', 'Guest experience: evening', 'Gallery'], ['exp-2', 'Guest experience: lantern walk', 'Gallery']
];
function photoSlots(types) {
  const out = STATIC_SLOTS.map(([key, label, group]) => ({ key, label, group }));
  (types || []).forEach(t => { for (let i = 0; i < 4; i++) out.push({ key: `room-${t.slug}-${i}`, label: `${t.name}: ${['bedroom', 'bathroom', 'terrace or view', 'living area'][i]}`, group: 'Rooms' }); });
  return out;
}
const validSlot = (slot, types) => photoSlots(types).some(s => s.key === slot);
module.exports.photoSlots = photoSlots; module.exports.validSlot = validSlot;
