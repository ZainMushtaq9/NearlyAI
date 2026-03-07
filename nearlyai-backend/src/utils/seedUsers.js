const bcrypt = require('bcrypt');
const getDb = require('./db');

async function seedUsers() {
    const db = await getDb();
    const hash = await bcrypt.hash('Test1234!', 10);

    const users = [
        { name: 'Admin NearlyAI', email: 'admin@nearlyai.com', password: hash, role: 'admin' },
        { name: 'Customer Demo', email: 'customer_demo@test.com', password: hash, role: 'customer' },
        { name: 'Owner Demo', email: 'owner_demo@test.com', password: hash, role: 'owner' },
        { name: 'Zain Mushtaq', email: 'zainmushtaq5439@gmail.com', password: hash, role: 'admin' }
    ];

    const insert = await db.prepare('INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
    for (const u of users) await insert.run(u.name, u.email, u.password, u.role);
    await insert.finalize();

    // Seed some demo businesses
    const biz = [
        { owner: 3, name: 'Ali Tailors', desc: 'Premium stitching & alterations in DHA. Bridal, casual, and formal wear specialist.', cat: 1, city: 'Lahore', area: 'DHA Phase 5', addr: 'Shop 12, DHA Phase 5 Market', phone: '0300-1234567', lat: 31.4697, lng: 74.3762 },
        { owner: 3, name: 'Fresh Bakers', desc: 'Artisan bakery serving fresh bread, cakes, and pastries daily.', cat: 2, city: 'Lahore', area: 'Gulberg', addr: 'MM Alam Road, Gulberg III', phone: '0321-9876543', lat: 31.5204, lng: 74.3587 },
        { owner: 3, name: 'Star Tutors Academy', desc: 'Expert tutoring for O/A Levels, FSc, and university prep.', cat: 3, city: 'Karachi', area: 'Clifton', addr: 'Block 5, Clifton', phone: '0333-5551234', lat: 24.8138, lng: 67.0300 },
        { owner: 3, name: 'Quick Fix Repairs', desc: 'Mobile phone, laptop, and electronics repair center.', cat: 6, city: 'Islamabad', area: 'F-8 Markaz', addr: 'Shop 45, F-8 Markaz', phone: '0345-7778899', lat: 33.7100, lng: 73.0400 },
        { owner: 3, name: 'Green Gym Fitness', desc: 'Modern gym with cardio, weights, and personal training.', cat: 9, city: 'Lahore', area: 'Johar Town', addr: 'Block F, Johar Town', phone: '0312-4445566', lat: 31.4600, lng: 74.2700 }
    ];

    const bizInsert = await db.prepare('INSERT OR IGNORE INTO businesses (id, owner_id, name, description, category_id, city, area, address, phone, lat, lng, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < biz.length; i++) {
        const b = biz[i];
        await bizInsert.run(i + 1, b.owner, b.name, b.desc, b.cat, b.city, b.area, b.addr, b.phone, b.lat, b.lng, i < 2 ? 1 : 0);
    }
    await bizInsert.finalize();

    // Add some reviews
    await db.run("INSERT OR IGNORE INTO reviews (id, business_id, customer_id, rating, comment) VALUES (1, 1, 2, 5, 'Excellent stitching quality!')");
    await db.run("INSERT OR IGNORE INTO reviews (id, business_id, customer_id, rating, comment) VALUES (2, 2, 2, 4, 'Great cakes, a bit pricey')");

    // Recalculate ratings
    for (let id = 1; id <= 2; id++) {
        const stats = await db.get('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE business_id = ?', id);
        await db.run('UPDATE businesses SET avg_rating = ?, review_count = ? WHERE id = ?', stats.avg || 0, stats.cnt, id);
    }

    console.log('✅ NearlyAI seeded: admin@nearlyai.com / customer_demo@test.com / owner_demo@test.com (password: Test1234!)');
    console.log('   + 5 demo businesses + 2 reviews');
}

if (require.main === module) {
    seedUsers();
}
module.exports = seedUsers;
