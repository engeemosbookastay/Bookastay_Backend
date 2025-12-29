import { syncFromAirbnb } from './services/airbnbSync.js';

console.log('Starting manual Airbnb sync test...');
console.log('This will fetch bookings from Airbnb and add them to your database.');

syncFromAirbnb()
  .then(() => {
    console.log('Sync test completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Sync test failed:', err);
    process.exit(1);
  });
