const getDb = require('./db');

async function seedCategories() {
    const db = await getDb();

    const categories = [
        { name: 'Tailor & Boutique', icon: '🧵', desc: 'Clothes stitching, alterations, bridal wear' },
        { name: 'Bakery & Sweets', icon: '🍰', desc: 'Fresh bread, cakes, traditional sweets' },
        { name: 'Tutor & Academy', icon: '📚', desc: 'Home tutors, coaching centers, language classes' },
        { name: 'Electrician & Plumber', icon: '🔧', desc: 'Home repair, wiring, pipe fixing' },
        { name: 'Salon & Spa', icon: '✂️', desc: 'Haircuts, makeup, grooming services' },
        { name: 'Mobile & Electronics Repair', icon: '📱', desc: 'Screen fixing, software issues, laptop repair' },
        { name: 'Grocery & Mart', icon: '🛒', desc: 'Daily essentials, fresh produce, meat' },
        { name: 'Pharmacy & Clinic', icon: '💊', desc: 'Medicines, general physician, lab tests' },
        { name: 'Gym & Fitness', icon: '🏋️', desc: 'Workout, yoga, personal training' },
        { name: 'Car Wash & Mechanic', icon: '🚗', desc: 'Auto repair, detailing, oil change' },
        { name: 'Real Estate Agent', icon: '🏡', desc: 'Property buying, selling, rent' },
        { name: 'Event & Caterer', icon: '🎉', desc: 'Wedding planning, food catering, decoration' },
        { name: 'Dhaba & Restaurant', icon: '🍲', desc: 'Local food, fast food, dine-in' },
        { name: 'Travel & Rent-a-Car', icon: '✈️', desc: 'Ticketing, tours, vehicle rental' },
        { name: 'Tailor Material / Laces', icon: '🎀', desc: 'Fabric accessories, buttons, threads' }
    ];

    await db.exec('BEGIN TRANSACTION');
    try {
        const stmt = await db.prepare(`INSERT OR IGNORE INTO categories (name, description, icon) VALUES (?, ?, ?)`);
        for (const cat of categories) {
            await stmt.run(cat.name, cat.desc, cat.icon);
        }
        await stmt.finalize();
        await db.exec('COMMIT');
        console.log('✅ Seeded 15 local business categories for NearlyAI.');
    } catch (err) {
        await db.exec('ROLLBACK');
        console.error('Error seeding categories:', err);
    }
}

if (require.main === module) {
    seedCategories();
}
module.exports = seedCategories;
