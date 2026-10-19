import { copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const brainDir = 'C:\\Users\\Wajid\\.gemini\\antigravity\\brain\\d663595d-bd46-451a-a7db-2703144fca4d';
const targetDir = resolve('public/images/food');

// 1. Copy generated images
try {
  copyFileSync(resolve(brainDir, 'burger_zinger_1792321247215.jpg'), resolve(targetDir, 'burger.jpg'));
  console.log('Copied burger.jpg');
} catch (e) {
  console.error('Error copying burger:', e.message);
}

try {
  copyFileSync(resolve(brainDir, 'pizza_tikka_1792321273823.jpg'), resolve(targetDir, 'pizza.jpg'));
  console.log('Copied pizza.jpg');
} catch (e) {
  console.error('Error copying pizza:', e.message);
}

try {
  copyFileSync(resolve(brainDir, 'bbq_tikka_1792321303981.jpg'), resolve(targetDir, 'bbq.jpg'));
  console.log('Copied bbq.jpg');
} catch (e) {
  console.error('Error copying bbq:', e.message);
}

// 2. Curated royalty-free food photos from Unsplash for remaining categories
const downloads = [
  { name: 'wings.jpg', url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&auto=format&fit=crop&q=80', description: 'Crispy fried wings', author: 'Unsplash' },
  { name: 'wrap.jpg', url: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&auto=format&fit=crop&q=80', description: 'Chicken shawarma wrap', author: 'Unsplash' },
  { name: 'fries.jpg', url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80', description: 'Golden french fries', author: 'Unsplash' },
  { name: 'fish.jpg', url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&auto=format&fit=crop&q=80', description: 'Fried fish with lemon', author: 'Unsplash' },
  { name: 'shakes.jpg', url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80', description: 'Gourmet ice cream shake', author: 'Unsplash' },
  { name: 'drinks.jpg', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80', description: 'Chilled soda drink', author: 'Unsplash' },
  { name: 'nuggets.jpg', url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80', description: 'Crispy chicken nuggets and snacks', author: 'Unsplash' },
  { name: 'desserts.jpg', url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80', description: 'Chocolate dessert', author: 'Unsplash' },
  { name: 'platter.jpg', url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80', description: 'BBQ and food combo feast platter', author: 'Unsplash' },
  { name: 'chai.jpg', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80', description: 'Kashmiri chai / hot beverage', author: 'Unsplash' }
];

async function runDownloads() {
  const sources = [
    { file: 'burger.jpg', description: 'Zinger Burger custom MT Bites visual', license: 'Generated asset for MT Bites POS' },
    { file: 'pizza.jpg', description: 'Chicken Tikka Pizza custom MT Bites visual', license: 'Generated asset for MT Bites POS' },
    { file: 'bbq.jpg', description: 'Tikka Boti & Seekh Kabab custom MT Bites visual', license: 'Generated asset for MT Bites POS' }
  ];

  for (const item of downloads) {
    try {
      console.log(`Downloading ${item.name}...`);
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(resolve(targetDir, item.name), buffer);
      console.log(`Saved ${item.name} (${Math.round(buffer.length / 1024)} KB)`);
      sources.push({
        file: item.name,
        description: item.description,
        source: item.url,
        license: 'Unsplash License - Free for commercial and operational POS use'
      });
    } catch (e) {
      console.error(`Failed ${item.name}:`, e.message);
    }
  }

  writeFileSync(resolve(targetDir, 'sources.json'), JSON.stringify(sources, null, 2));
  console.log('Wrote sources.json');
}

runDownloads();
