import sqlite3
import urllib.request
import os
import time
import math
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from functools import wraps
from datetime import datetime

# --- AI SETUP ---
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if GEMINI_AVAILABLE and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# --- APP SETUP ---
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "nearlyai_super_secret_key_2024")
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB max upload

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data'), exist_ok=True)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'nearlyai.db')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ══════════════════════════════════════════════════════════
#  DATABASE
# ══════════════════════════════════════════════════════════
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop('db', None)
    if db:
        db.close()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'customer' CHECK(role IN ('customer','owner','admin')),
            phone TEXT,
            city TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            icon TEXT
        );

        CREATE TABLE IF NOT EXISTS businesses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            category_id INTEGER,
            city TEXT,
            area TEXT,
            address TEXT,
            phone TEXT,
            whatsapp TEXT,
            opening_hours TEXT,
            lat REAL,
            lng REAL,
            cover_image TEXT,
            marker_image TEXT,
            verified INTEGER DEFAULT 0,
            suspended INTEGER DEFAULT 0,
            avg_rating REAL DEFAULT 0.0,
            review_count INTEGER DEFAULT 0,
            view_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        );

        CREATE TABLE IF NOT EXISTS business_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_id INTEGER NOT NULL,
            photo_url TEXT NOT NULL,
            is_primary INTEGER DEFAULT 0,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL,
            rating INTEGER CHECK(rating >= 1 AND rating <= 5),
            comment TEXT,
            flagged INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
            FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(business_id, customer_id)
        );

        CREATE TABLE IF NOT EXISTS deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            discount_percent INTEGER,
            valid_until TEXT,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS favourites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            business_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
            UNIQUE(user_id, business_id)
        );

        CREATE TABLE IF NOT EXISTS ai_query_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    print("[OK] NearlyAI database initialized - 7 tables ready.")
    conn.close()

def seed_data():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Check if already seeded
    c.execute("SELECT COUNT(*) FROM categories")
    if c.fetchone()[0] > 0:
        conn.close()
        return

    # Seed categories
    categories = [
        ('Tailor & Boutique', 'Clothes stitching, alterations, bridal wear', '🧵'),
        ('Bakery & Sweets', 'Fresh bread, cakes, traditional sweets', '🍰'),
        ('Tutor & Academy', 'Home tutors, coaching centers, language classes', '📚'),
        ('Electrician & Plumber', 'Home repair, wiring, pipe fixing', '🔧'),
        ('Salon & Spa', 'Haircuts, makeup, grooming services', '✂️'),
        ('Mobile & Electronics Repair', 'Screen fixing, software issues, laptop repair', '📱'),
        ('Grocery & Mart', 'Daily essentials, fresh produce, meat', '🛒'),
        ('Pharmacy & Clinic', 'Medicines, general physician, lab tests', '💊'),
        ('Gym & Fitness', 'Workout, yoga, personal training', '🏋️'),
        ('Car Wash & Mechanic', 'Auto repair, detailing, oil change', '🚗'),
        ('Real Estate Agent', 'Property buying, selling, rent', '🏡'),
        ('Event & Caterer', 'Wedding planning, food catering, decoration', '🎉'),
        ('Dhaba & Restaurant', 'Local food, fast food, dine-in', '🍲'),
        ('Travel & Rent-a-Car', 'Ticketing, tours, vehicle rental', '✈️'),
        ('Tailor Material / Laces', 'Fabric accessories, buttons, threads', '🎀'),
    ]
    c.executemany("INSERT OR IGNORE INTO categories (name, description, icon) VALUES (?, ?, ?)", categories)

    # Seed users
    admin_pw = generate_password_hash("Test1234!")
    users = [
        ('Admin NearlyAI', 'admin@nearlyai.com', admin_pw, 'admin', '0300-0000000', 'Lahore'),
        ('Customer Demo', 'customer@nearlyai.com', generate_password_hash("Test1234!"), 'customer', '0321-1111111', 'Lahore'),
        ('Owner Demo', 'owner@nearlyai.com', generate_password_hash("Test1234!"), 'owner', '0333-2222222', 'Lahore'),
    ]
    c.executemany("INSERT OR IGNORE INTO users (name, email, password, role, phone, city) VALUES (?, ?, ?, ?, ?, ?)", users)

    # Seed businesses
    businesses = [
        (3, 'Ali Tailors', 'Premium stitching & alterations in DHA. Specialist in bridal, casual, and formal wear with 15 years of experience.', 1, 'Lahore', 'DHA Phase 5', 'Shop 12, DHA Phase 5 Market', '0300-1234567', '0300-1234567', 'Mon-Sat 9am-8pm', 31.4697, 74.3762, None, None, 1, 0, 'active'),
        (3, 'Fresh Bakers', 'Artisan bakery serving fresh bread, cakes, and pastries daily. Famous for our walnut brownies and cream rolls.', 2, 'Lahore', 'Gulberg', 'MM Alam Road, Gulberg III', '0321-9876543', '0321-9876543', 'Daily 7am-10pm', 31.5204, 74.3587, None, None, 1, 0, 'active'),
        (3, 'Star Tutors Academy', 'Expert tutoring for O/A Levels, FSc, and university prep. Qualified faculty with proven results.', 3, 'Karachi', 'Clifton', 'Block 5, Clifton', '0333-5551234', '0333-5551234', 'Mon-Fri 3pm-9pm', 24.8138, 67.0300, None, None, 0, 0, 'pending'),
        (3, 'Quick Fix Repairs', 'Mobile phone, laptop, and electronics repair center. Same-day screen replacement and data recovery.', 6, 'Islamabad', 'F-8 Markaz', 'Shop 45, F-8 Markaz', '0345-7778899', '0345-7778899', 'Mon-Sat 10am-7pm', 33.7100, 73.0400, None, None, 0, 0, 'pending'),
        (3, 'Green Gym Fitness', 'Modern gym with cardio, weights, and personal training. Join our community for a healthier lifestyle.', 9, 'Lahore', 'Johar Town', 'Block F, Johar Town', '0312-4445566', '0312-4445566', 'Daily 5am-11pm', 31.4600, 74.2700, None, None, 1, 0, 'active'),
    ]
    for b in businesses:
        c.execute("""INSERT OR IGNORE INTO businesses
            (owner_id, name, description, category_id, city, area, address, phone, whatsapp, opening_hours, lat, lng, cover_image, marker_image, verified, suspended, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", b)

    # Seed reviews
    c.execute("INSERT OR IGNORE INTO reviews (business_id, customer_id, rating, comment) VALUES (1, 2, 5, 'Excellent stitching quality! Best tailor in DHA.')")
    c.execute("INSERT OR IGNORE INTO reviews (business_id, customer_id, rating, comment) VALUES (2, 2, 4, 'Great cakes and pastries. A bit pricey but worth it.')")

    # Recalculate ratings
    for bid in [1, 2]:
        c.execute("SELECT AVG(rating), COUNT(*) FROM reviews WHERE business_id=?", (bid,))
        row = c.fetchone()
        c.execute("UPDATE businesses SET avg_rating=?, review_count=? WHERE id=?", (row[0] or 0, row[1], bid))

    # Seed a deal
    c.execute("INSERT OR IGNORE INTO deals (business_id, title, description, discount_percent, valid_until) VALUES (1, 'Eid Special', 'Get 20% off on all bridal wear orders this month!', 20, '2026-04-15')")

    conn.commit()
    conn.close()
    print("[OK] NearlyAI seeded: admin@nearlyai.com / customer@nearlyai.com / owner@nearlyai.com (password: Test1234!)")


# ══════════════════════════════════════════════════════════
#  AUTH DECORATORS
# ══════════════════════════════════════════════════════════
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please login to continue.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                flash('Please login to continue.', 'warning')
                return redirect(url_for('login'))
            if session.get('role') not in roles:
                flash('You do not have permission to access this page.', 'danger')
                return redirect(url_for('index'))
            return f(*args, **kwargs)
        return decorated
    return decorator


# ══════════════════════════════════════════════════════════
#  CONTEXT PROCESSORS
# ══════════════════════════════════════════════════════════
@app.context_processor
def inject_globals():
    db = get_db()
    categories = db.execute("SELECT * FROM categories ORDER BY name").fetchall()
    cities = db.execute("SELECT DISTINCT city FROM businesses WHERE status='active' ORDER BY city").fetchall()
    return dict(
        all_categories=categories,
        all_cities=[c['city'] for c in cities if c['city']],
        current_year=datetime.now().year
    )


# ══════════════════════════════════════════════════════════
#  PUBLIC ROUTES
# ══════════════════════════════════════════════════════════
@app.route('/')
def index():
    db = get_db()
    featured = db.execute("""
        SELECT b.*, c.name as category_name, c.icon as category_icon
        FROM businesses b LEFT JOIN categories c ON b.category_id=c.id
        WHERE b.status='active' AND b.verified=1
        ORDER BY b.avg_rating DESC, b.view_count DESC LIMIT 6
    """).fetchall()
    categories = db.execute("SELECT * FROM categories ORDER BY name").fetchall()
    stats = {
        'businesses': db.execute("SELECT COUNT(*) FROM businesses WHERE status='active'").fetchone()[0],
        'users': db.execute("SELECT COUNT(*) FROM users").fetchone()[0],
        'reviews': db.execute("SELECT COUNT(*) FROM reviews").fetchone()[0],
        'categories': db.execute("SELECT COUNT(*) FROM categories").fetchone()[0],
    }
    return render_template('index.html', featured=featured, categories=categories, stats=stats)


@app.route('/search')
def search():
    db = get_db()
    query = request.args.get('q', '').strip()
    city = request.args.get('city', '').strip()
    category_id = request.args.get('category', '', type=str).strip()
    verified = request.args.get('verified', '', type=str).strip()
    min_rating = request.args.get('rating', '', type=str).strip()
    sort = request.args.get('sort', 'rating')

    sql = """SELECT b.*, c.name as category_name, c.icon as category_icon
             FROM businesses b LEFT JOIN categories c ON b.category_id=c.id
             WHERE b.status='active'"""
    params = []

    if query:
        sql += " AND (b.name LIKE ? OR b.description LIKE ? OR b.area LIKE ?)"
        params += [f'%{query}%', f'%{query}%', f'%{query}%']
    if city:
        sql += " AND b.city=?"
        params.append(city)
    if category_id:
        sql += " AND b.category_id=?"
        params.append(int(category_id))
    if verified == '1':
        sql += " AND b.verified=1"
    if min_rating:
        sql += " AND b.avg_rating>=?"
        params.append(float(min_rating))

    if sort == 'rating':
        sql += " ORDER BY b.avg_rating DESC, b.review_count DESC"
    elif sort == 'views':
        sql += " ORDER BY b.view_count DESC"
    elif sort == 'newest':
        sql += " ORDER BY b.created_at DESC"
    else:
        sql += " ORDER BY b.avg_rating DESC"

    businesses = db.execute(sql, params).fetchall()
    return render_template('listings.html', businesses=businesses, query=query, city=city,
                           category_id=category_id, verified=verified, min_rating=min_rating, sort=sort)


@app.route('/business/<int:biz_id>')
def business_detail(biz_id):
    db = get_db()
    biz = db.execute("""
        SELECT b.*, c.name as category_name, c.icon as category_icon
        FROM businesses b LEFT JOIN categories c ON b.category_id=c.id
        WHERE b.id=?
    """, (biz_id,)).fetchone()
    if not biz:
        flash('Business not found.', 'danger')
        return redirect(url_for('search'))

    # Increment view count
    db.execute("UPDATE businesses SET view_count=view_count+1 WHERE id=?", (biz_id,))
    db.commit()

    reviews = db.execute("""
        SELECT r.*, u.name as reviewer_name
        FROM reviews r JOIN users u ON r.customer_id=u.id
        WHERE r.business_id=? AND r.flagged=0
        ORDER BY r.created_at DESC
    """, (biz_id,)).fetchall()

    photos = db.execute("SELECT * FROM business_photos WHERE business_id=?", (biz_id,)).fetchall()
    deals = db.execute("SELECT * FROM deals WHERE business_id=? AND active=1", (biz_id,)).fetchall()

    is_favourite = False
    user_review = None
    if 'user_id' in session:
        fav = db.execute("SELECT id FROM favourites WHERE user_id=? AND business_id=?",
                         (session['user_id'], biz_id)).fetchone()
        is_favourite = fav is not None
        user_review = db.execute("SELECT * FROM reviews WHERE business_id=? AND customer_id=?",
                                 (biz_id, session['user_id'])).fetchone()

    return render_template('business_detail.html', biz=biz, reviews=reviews, photos=photos,
                           deals=deals, is_favourite=is_favourite, user_review=user_review)


# ══════════════════════════════════════════════════════════
#  AUTH ROUTES
# ══════════════════════════════════════════════════════════
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        db = get_db()
        user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            session['role'] = user['role']
            flash(f'Welcome back, {user["name"]}!', 'success')
            if user['role'] == 'admin':
                return redirect(url_for('admin_dashboard'))
            elif user['role'] == 'owner':
                return redirect(url_for('owner_dashboard'))
            return redirect(url_for('index'))
        flash('Invalid email or password.', 'danger')
    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        role = request.form.get('role', 'customer')
        phone = request.form.get('phone', '').strip()
        city = request.form.get('city', '').strip()

        if not name or not email or not password:
            flash('All fields are required.', 'danger')
            return render_template('register.html')

        if role not in ('customer', 'owner'):
            role = 'customer'

        db = get_db()
        existing = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
        if existing:
            flash('Email already registered.', 'danger')
            return render_template('register.html')

        db.execute("INSERT INTO users (name, email, password, role, phone, city) VALUES (?,?,?,?,?,?)",
                   (name, email, generate_password_hash(password), role, phone, city))
        db.commit()
        user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        session['user_id'] = user['id']
        session['user_name'] = user['name']
        session['role'] = user['role']
        flash(f'Account created! Welcome, {name}!', 'success')
        if role == 'owner':
            return redirect(url_for('register_business'))
        return redirect(url_for('index'))
    return render_template('register.html')


@app.route('/logout')
def logout():
    session.clear()
    flash('Logged out successfully.', 'info')
    return redirect(url_for('index'))


# ══════════════════════════════════════════════════════════
#  BUSINESS OWNER ROUTES
# ══════════════════════════════════════════════════════════
@app.route('/register-business', methods=['GET', 'POST'])
@role_required('owner')
def register_business():
    db = get_db()
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        category_id = request.form.get('category_id', type=int)
        city = request.form.get('city', '').strip()
        area = request.form.get('area', '').strip()
        address = request.form.get('address', '').strip()
        phone = request.form.get('phone', '').strip()
        whatsapp = request.form.get('whatsapp', '').strip()
        opening_hours = request.form.get('opening_hours', '').strip()
        lat = request.form.get('lat')
        lng = request.form.get('lng')

        cover_image = request.files.get('cover_image')
        marker_image = request.files.get('marker_image')
        cover_filename = ''
        marker_filename = ''

        if cover_image and cover_image.filename and allowed_file(cover_image.filename):
            fname = secure_filename(cover_image.filename)
            unique_fname = f"{int(time.time())}_{fname}"
            cover_image.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_fname))
            cover_filename = unique_fname
            
        if marker_image and marker_image.filename and allowed_file(marker_image.filename):
            fname = secure_filename(marker_image.filename)
            unique_fname = f"marker_{int(time.time())}_{fname}"
            marker_image.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_fname))
            marker_filename = unique_fname

        # Convert empty strings to None for coordinates
        lat = float(lat) if lat else None
        lng = float(lng) if lng else None

        if not name or not city or not area:
            flash('Business name, city and area are required.', 'danger')
            categories = db.execute("SELECT * FROM categories ORDER BY name").fetchall()
            return render_template('register_business.html', categories=categories)

        db.execute("""INSERT INTO businesses
            (owner_id, name, description, category_id, city, area, address, phone, whatsapp, opening_hours, lat, lng, cover_image, marker_image, status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (session['user_id'], name, description, category_id, city, area, address, phone, whatsapp, opening_hours, lat, lng, cover_filename, marker_filename, 'pending'))
        db.commit()
        biz = db.execute("SELECT id FROM businesses WHERE owner_id=? ORDER BY id DESC LIMIT 1", (session['user_id'],)).fetchone()

        # Handle photo uploads
        if 'photos' in request.files:
            files = request.files.getlist('photos')
            for i, f in enumerate(files[:5]):
                if f and allowed_file(f.filename):
                    fname = secure_filename(f"{biz['id']}_{i}_{f.filename}")
                    f.save(os.path.join(app.config['UPLOAD_FOLDER'], fname))
                    db.execute("INSERT INTO business_photos (business_id, photo_url, is_primary) VALUES (?,?,?)",
                               (biz['id'], f'/uploads/{fname}', 1 if i == 0 else 0))
            db.commit()

        flash('Business registered! It will be visible after admin verification.', 'success')
        return redirect(url_for('owner_dashboard'))

    categories = db.execute("SELECT * FROM categories ORDER BY name").fetchall()
    return render_template('register_business.html', categories=categories)


@app.route('/edit-business/<int:biz_id>', methods=['GET', 'POST'])
@role_required('owner')
def edit_business(biz_id):
    db = get_db()
    biz = db.execute("SELECT * FROM businesses WHERE id=? AND owner_id=?", (biz_id, session['user_id'])).fetchone()
    if not biz:
        flash('Business not found or access denied.', 'danger')
        return redirect(url_for('owner_dashboard'))

    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        category_id = request.form.get('category_id', type=int)
        phone = request.form.get('phone', '').strip()
        whatsapp = request.form.get('whatsapp', '').strip()
        opening_hours = request.form.get('opening_hours', '').strip()
        address = request.form.get('address', '').strip()
        area = request.form.get('area', '').strip()
        city = request.form.get('city', '').strip()
        lat = request.form.get('lat')
        lng = request.form.get('lng')

        cover_image = request.files.get('cover_image')
        marker_image = request.files.get('marker_image')

        lat = float(lat) if lat else None
        lng = float(lng) if lng else None

        # Update base details
        db.execute("""
            UPDATE businesses 
            SET category_id=?, name=?, description=?, phone=?, whatsapp=?, opening_hours=?, address=?, area=?, city=?, lat=?, lng=?
            WHERE id=?
        """, (category_id, name, description, phone, whatsapp, opening_hours, address, area, city, lat, lng, biz_id))

        if cover_image and cover_image.filename and allowed_file(cover_image.filename):
            # Delete old cover image if it exists
            if biz['cover_image']:
                old_filepath = os.path.join(app.config['UPLOAD_FOLDER'], biz['cover_image'])
                if os.path.exists(old_filepath):
                    os.remove(old_filepath)
            fname = secure_filename(cover_image.filename)
            unique_fname = f"{int(time.time())}_{fname}"
            cover_image.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_fname))
            db.execute("UPDATE businesses SET cover_image=? WHERE id=?", (unique_fname, biz_id))
            
        if marker_image and marker_image.filename and allowed_file(marker_image.filename):
            # Delete old marker image if it exists
            if biz['marker_image']:
                old_filepath = os.path.join(app.config['UPLOAD_FOLDER'], biz['marker_image'])
                if os.path.exists(old_filepath):
                    os.remove(old_filepath)
            fname = secure_filename(marker_image.filename)
            unique_fname = f"marker_{int(time.time())}_{fname}"
            marker_image.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_fname))
            db.execute("UPDATE businesses SET marker_image=? WHERE id=?", (unique_fname, biz_id))

        db.commit()

        # Handle new photo uploads
        if 'photos' in request.files:
            files = request.files.getlist('photos')
            for i, f in enumerate(files[:5]):
                if f and f.filename and allowed_file(f.filename):
                    fname = secure_filename(f"{biz_id}_{datetime.now().timestamp()}_{f.filename}")
                    f.save(os.path.join(app.config['UPLOAD_FOLDER'], fname))
                    db.execute("INSERT INTO business_photos (business_id, photo_url) VALUES (?,?)",
                               (biz_id, f'/uploads/{fname}'))
            db.commit()

        flash('Business updated!', 'success')
        return redirect(url_for('owner_dashboard'))

    categories = db.execute("SELECT * FROM categories ORDER BY name").fetchall()
    photos = db.execute("SELECT * FROM business_photos WHERE business_id=?", (biz_id,)).fetchall()
    return render_template('edit_business.html', biz=biz, categories=categories, photos=photos)


@app.route('/delete-business/<int:biz_id>', methods=['POST'])
@role_required('owner')
def delete_business(biz_id):
    db = get_db()
    db.execute("DELETE FROM businesses WHERE id=? AND owner_id=?", (biz_id, session['user_id']))
    db.commit()
    flash('Business deleted.', 'info')
    return redirect(url_for('owner_dashboard'))


@app.route('/delete-photo/<int:photo_id>', methods=['POST'])
@role_required('owner')
def delete_photo(photo_id):
    db = get_db()
    photo = db.execute("""SELECT bp.* FROM business_photos bp
                          JOIN businesses b ON bp.business_id=b.id
                          WHERE bp.id=? AND b.owner_id=?""",
                       (photo_id, session['user_id'])).fetchone()
    if photo:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], os.path.basename(photo['photo_url']))
        if os.path.exists(filepath):
            os.remove(filepath)
        db.execute("DELETE FROM business_photos WHERE id=?", (photo_id,))
        db.commit()
        flash('Photo deleted.', 'info')
    return redirect(request.referrer or url_for('owner_dashboard'))


@app.route('/owner/dashboard')
@role_required('owner')
def owner_dashboard():
    db = get_db()
    businesses = db.execute("""
        SELECT b.*, c.name as category_name, c.icon as category_icon
        FROM businesses b LEFT JOIN categories c ON b.category_id=c.id
        WHERE b.owner_id=? ORDER BY b.created_at DESC
    """, (session['user_id'],)).fetchall()

    total_views = sum(b['view_count'] for b in businesses)
    total_reviews = sum(b['review_count'] for b in businesses)
    biz_ids = [b['id'] for b in businesses]

    total_queries = 0
    if biz_ids:
        placeholders = ','.join('?' * len(biz_ids))
        total_queries = db.execute(f"SELECT COUNT(*) FROM ai_query_log WHERE business_id IN ({placeholders})", biz_ids).fetchone()[0]

    recent_reviews = []
    if biz_ids:
        placeholders = ','.join('?' * len(biz_ids))
        recent_reviews = db.execute(f"""
            SELECT r.*, u.name as reviewer_name, b.name as business_name
            FROM reviews r JOIN users u ON r.customer_id=u.id
            JOIN businesses b ON r.business_id=b.id
            WHERE r.business_id IN ({placeholders})
            ORDER BY r.created_at DESC LIMIT 10
        """, biz_ids).fetchall()

    return render_template('owner_dashboard.html', businesses=businesses,
                           total_views=total_views, total_reviews=total_reviews,
                           total_queries=total_queries, recent_reviews=recent_reviews)


# ══════════════════════════════════════════════════════════
#  DEALS
# ══════════════════════════════════════════════════════════
@app.route('/owner/deals')
@role_required('owner')
def owner_deals():
    db = get_db()
    businesses = db.execute("SELECT id, name FROM businesses WHERE owner_id=?", (session['user_id'],)).fetchall()
    biz_ids = [b['id'] for b in businesses]
    deals = []
    if biz_ids:
        placeholders = ','.join('?' * len(biz_ids))
        deals = db.execute(f"""
            SELECT d.*, b.name as business_name
            FROM deals d JOIN businesses b ON d.business_id=b.id
            WHERE d.business_id IN ({placeholders})
            ORDER BY d.created_at DESC
        """, biz_ids).fetchall()
    return render_template('deals.html', deals=deals, businesses=businesses)


@app.route('/owner/deals/add', methods=['POST'])
@role_required('owner')
def add_deal():
    db = get_db()
    business_id = request.form.get('business_id', type=int)
    # Verify ownership
    biz = db.execute("SELECT id FROM businesses WHERE id=? AND owner_id=?", (business_id, session['user_id'])).fetchone()
    if not biz:
        flash('Access denied.', 'danger')
        return redirect(url_for('owner_deals'))

    db.execute("INSERT INTO deals (business_id, title, description, discount_percent, valid_until) VALUES (?,?,?,?,?)",
               (business_id, request.form.get('title'), request.form.get('description'),
                request.form.get('discount_percent', type=int), request.form.get('valid_until')))
    db.commit()
    flash('Deal posted!', 'success')
    return redirect(url_for('owner_deals'))


@app.route('/owner/deals/delete/<int:deal_id>', methods=['POST'])
@role_required('owner')
def delete_deal(deal_id):
    db = get_db()
    db.execute("""DELETE FROM deals WHERE id=? AND business_id IN
                  (SELECT id FROM businesses WHERE owner_id=?)""", (deal_id, session['user_id']))
    db.commit()
    flash('Deal removed.', 'info')
    return redirect(url_for('owner_deals'))


# ══════════════════════════════════════════════════════════
#  REVIEWS
# ══════════════════════════════════════════════════════════
@app.route('/review/<int:biz_id>', methods=['POST'])
@role_required('customer')
def submit_review(biz_id):
    db = get_db()
    rating = request.form.get('rating', type=int)
    comment = request.form.get('comment', '').strip()

    if not rating or rating < 1 or rating > 5:
        flash('Please select a rating (1-5 stars).', 'danger')
        return redirect(url_for('business_detail', biz_id=biz_id))

    existing = db.execute("SELECT id FROM reviews WHERE business_id=? AND customer_id=?",
                          (biz_id, session['user_id'])).fetchone()
    if existing:
        flash('You have already reviewed this business.', 'warning')
        return redirect(url_for('business_detail', biz_id=biz_id))

    db.execute("INSERT INTO reviews (business_id, customer_id, rating, comment) VALUES (?,?,?,?)",
               (biz_id, session['user_id'], rating, comment))

    # Recalculate business rating
    stats = db.execute("SELECT AVG(rating), COUNT(*) FROM reviews WHERE business_id=? AND flagged=0", (biz_id,)).fetchone()
    db.execute("UPDATE businesses SET avg_rating=?, review_count=? WHERE id=?",
               (round(stats[0] or 0, 1), stats[1], biz_id))
    db.commit()
    flash('Review submitted! Thank you.', 'success')
    return redirect(url_for('business_detail', biz_id=biz_id))


# ══════════════════════════════════════════════════════════
#  FAVOURITES
# ══════════════════════════════════════════════════════════
@app.route('/favourite/<int:biz_id>', methods=['POST'])
@login_required
def toggle_favourite(biz_id):
    db = get_db()
    existing = db.execute("SELECT id FROM favourites WHERE user_id=? AND business_id=?",
                          (session['user_id'], biz_id)).fetchone()
    if existing:
        db.execute("DELETE FROM favourites WHERE id=?", (existing['id'],))
        db.commit()
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'status': 'removed'})
        flash('Removed from favourites.', 'info')
    else:
        db.execute("INSERT INTO favourites (user_id, business_id) VALUES (?,?)",
                   (session['user_id'], biz_id))
        db.commit()
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'status': 'added'})
        flash('Added to favourites!', 'success')
    return redirect(request.referrer or url_for('index'))


@app.route('/favourites')
@login_required
def favourites_page():
    db = get_db()
    favourites = db.execute("""
        SELECT b.*, c.name as category_name, c.icon as category_icon
        FROM favourites f JOIN businesses b ON f.business_id=b.id
        LEFT JOIN categories c ON b.category_id=c.id
        WHERE f.user_id=? ORDER BY f.created_at DESC
    """, (session['user_id'],)).fetchall()
    return render_template('favourites.html', favourites=favourites)


# ══════════════════════════════════════════════════════════
#  AI ROUTES (API)
# ══════════════════════════════════════════════════════════
@app.route('/api/ai/generate-profile', methods=['POST'])
@role_required('owner')
def ai_generate_profile():
    data = request.get_json()
    business_name = data.get('business_name', '')
    category = data.get('category', '')
    services = data.get('services', '')
    city = data.get('city', '')
    area = data.get('area', '')

    if not GEMINI_AVAILABLE or not GEMINI_API_KEY:
        # Fallback: generate a simple description
        desc = f"{business_name} is a trusted {category.lower()} located in {area}, {city}. "
        desc += f"We specialize in {services}. " if services else ""
        desc += "Visit us for quality services at affordable prices. Your satisfaction is our priority!"
        return jsonify({'description': desc})

    try:
        prompt = f"""Write a short, friendly business description (2-3 sentences) for a local
        Pakistani business. Business name: {business_name}. Category: {category}.
        Located in {area}, {city}. Services offered: {services}.
        Make it welcoming, mention location, highlight key services.
        Do NOT use bullet points — write in flowing paragraph form."""

        model = genai.GenerativeModel('gemini-1.5-flash')
        result = model.generate_content(prompt)
        return jsonify({'description': result.text})
    except Exception as e:
        desc = f"{business_name} is a trusted {category.lower()} located in {area}, {city}. "
        desc += f"We offer {services}. " if services else ""
        desc += "Visit us today for the best experience!"
        return jsonify({'description': desc, 'note': 'AI unavailable, using fallback.'})


@app.route('/api/ai/query', methods=['POST'])
def ai_customer_query():
    data = request.get_json()
    business_id = data.get('business_id')
    question = data.get('question', '').strip()

    if not question:
        return jsonify({'error': 'Please ask a question.'}), 400

    db = get_db()
    biz = db.execute("SELECT * FROM businesses WHERE id=?", (business_id,)).fetchone()
    if not biz:
        return jsonify({'error': 'Business not found.'}), 404

    if not GEMINI_AVAILABLE or not GEMINI_API_KEY:
        answer = f"Thank you for your interest in {biz['name']}! "
        answer += f"We are located at {biz['area']}, {biz['city']}. "
        if biz['phone']:
            answer += f"Please contact us directly at {biz['phone']} for more information."
        else:
            answer += "Please visit us for more details."
        db.execute("INSERT INTO ai_query_log (business_id, question, answer) VALUES (?,?,?)",
                   (business_id, question, answer))
        db.commit()
        return jsonify({'answer': answer, 'note': 'AI unavailable, showing basic info.'})

    try:
        prompt = f"""You are an assistant for the business: {biz['name']}.
        Business description: {biz['description']}.
        Category: see context. Location: {biz['area']}, {biz['city']}.
        Phone: {biz['phone']}. Hours: {biz['opening_hours'] or 'Not specified'}.

        A customer asks: '{question}'

        Answer helpfully based only on the business information above.
        If you cannot answer, say 'Please contact the business directly at {biz['phone']}'.
        Keep your answer under 3 sentences."""

        model = genai.GenerativeModel('gemini-1.5-flash')
        result = model.generate_content(prompt)
        answer = result.text

        db.execute("INSERT INTO ai_query_log (business_id, question, answer) VALUES (?,?,?)",
                   (business_id, question, answer))
        db.commit()
        return jsonify({'answer': answer})
    except Exception as e:
        answer = f"I'm sorry, I couldn't process your question right now. Please contact {biz['name']} directly at {biz['phone'] or 'their location'}."
        db.execute("INSERT INTO ai_query_log (business_id, question, answer) VALUES (?,?,?)",
                   (business_id, question, answer))
        db.commit()
        return jsonify({'answer': answer})


@app.route('/api/ai/near-me', methods=['POST'])
def ai_near_me():
    data = request.get_json()
    user_lat = data.get('lat')
    user_lng = data.get('lng')
    requirement = data.get('requirement', '').strip()

    if user_lat is None or user_lng is None:
        return jsonify({'error': 'Location is required to find nearby shops.'}), 400

    try:
        user_lat = float(user_lat)
        user_lng = float(user_lng)
    except ValueError:
        return jsonify({'error': 'Invalid location data.'}), 400

    db = get_db()
    all_bizs = db.execute("""
        SELECT b.*, c.name as category_name, c.icon as category_icon
        FROM businesses b LEFT JOIN categories c ON b.category_id=c.id
        WHERE b.status='active' AND b.lat IS NOT NULL AND b.lng IS NOT NULL
    """).fetchall()

    if not all_bizs:
        return jsonify({'recommendation': 'Sorry, there are currently no verified active businesses with locations in our database.', 'businesses': []})

    # Haversine distance calculation in Python
    R = 6371.0
    nearby = []
    for biz in all_bizs:
        dlat = math.radians(biz['lat'] - user_lat)
        dlng = math.radians(biz['lng'] - user_lng)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(user_lat)) * math.cos(math.radians(biz['lat'])) * math.sin(dlng / 2)**2
        c_val = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        distance = R * c_val
        if distance <= 50.0:
            nearby.append({'biz': biz, 'distance': distance})

    nearby.sort(key=lambda x: x['distance'])
    top_nearby = nearby[:10]

    # Build businesses list for frontend cards
    biz_cards = []
    for item in top_nearby[:5]:
        b = item['biz']
        biz_cards.append({
            'id': b['id'],
            'name': b['name'],
            'lat': b['lat'],
            'lng': b['lng'],
            'category_icon': b['category_icon'] or '🏪',
            'category_name': b['category_name'] or '',
            'marker_image': b['marker_image'] or '',
            'distance_km': round(item['distance'], 1),
            'avg_rating': round(b['avg_rating'] or 0, 1),
            'area': b['area'] or '',
            'city': b['city'] or '',
            'phone': b['phone'] or '',
            'url': f"/business/{b['id']}"
        })

    if not top_nearby:
        return jsonify({'recommendation': "Sorry, we couldn't find any registered businesses within a 50km radius of your location.", 'businesses': []})

    if not GEMINI_AVAILABLE or not GEMINI_API_KEY:
        res = "Here are the closest shops to you:"
        for item in top_nearby[:3]:
            res += f" {item['biz']['name']} ({item['biz']['category_name']}) is {item['distance']:.1f} km away in {item['biz']['area']}."
        return jsonify({'recommendation': res, 'businesses': biz_cards, 'note': 'AI unavailable, using fallback list.'})

    try:
        context_list = ""
        for item in top_nearby:
            b = item['biz']
            context_list += f"- {b['name']} ({b['category_name']}), {item['distance']:.1f} km away. Address: {b['address']}, {b['area']}. Rating: {b['avg_rating']} stars.\n"

        prompt = f"""You are 'NearlyAI', a helpful assistant recommending local Pakistani shops to a user based on their GPS location.
User Requirement/Query: '{requirement if requirement else "Find some good nearby places to visit or shop."}'

Here are the nearest businesses to the user within a 50km radius, sorted by distance:
{context_list}

Based ONLY on this list, recommend the most relevant 2 or 3 places that match their requirement.
If no place matches the specific requirement, suggest the closest highly-rated options.
Speak directly to the user in a friendly, helpful tone. Keep it concise (3-4 sentences). Do not use bullet points."""

        model = genai.GenerativeModel('gemini-1.5-flash')
        result = model.generate_content(prompt)
        return jsonify({'recommendation': result.text, 'businesses': biz_cards})
    except Exception as e:
        return jsonify({'recommendation': 'Sorry, the AI is having trouble right now. Please try searching manually.', 'businesses': biz_cards, 'error': str(e)})


# ══════════════════════════════════════════════════════════
#  ADMIN ROUTES
# ══════════════════════════════════════════════════════════
@app.route('/admin/dashboard')
@role_required('admin')
def admin_dashboard():
    db = get_db()
    stats = {
        'total_businesses': db.execute("SELECT COUNT(*) FROM businesses").fetchone()[0],
        'active_businesses': db.execute("SELECT COUNT(*) FROM businesses WHERE status='active'").fetchone()[0],
        'pending_businesses': db.execute("SELECT COUNT(*) FROM businesses WHERE status='pending'").fetchone()[0],
        'suspended_businesses': db.execute("SELECT COUNT(*) FROM businesses WHERE suspended=1").fetchone()[0],
        'verified_businesses': db.execute("SELECT COUNT(*) FROM businesses WHERE verified=1").fetchone()[0],
        'total_users': db.execute("SELECT COUNT(*) FROM users").fetchone()[0],
        'customers': db.execute("SELECT COUNT(*) FROM users WHERE role='customer'").fetchone()[0],
        'owners': db.execute("SELECT COUNT(*) FROM users WHERE role='owner'").fetchone()[0],
        'total_reviews': db.execute("SELECT COUNT(*) FROM reviews").fetchone()[0],
        'flagged_reviews': db.execute("SELECT COUNT(*) FROM reviews WHERE flagged=1").fetchone()[0],
        'total_deals': db.execute("SELECT COUNT(*) FROM deals WHERE active=1").fetchone()[0],
        'total_queries': db.execute("SELECT COUNT(*) FROM ai_query_log").fetchone()[0],
    }
    pending = db.execute("""
        SELECT b.*, c.name as category_name, u.name as owner_name
        FROM businesses b LEFT JOIN categories c ON b.category_id=c.id
        JOIN users u ON b.owner_id=u.id
        WHERE b.status='pending' ORDER BY b.created_at DESC
    """).fetchall()

    recent_users = db.execute("SELECT * FROM users ORDER BY created_at DESC LIMIT 10").fetchall()

    return render_template('admin_dashboard.html', stats=stats, pending=pending, recent_users=recent_users)


@app.route('/admin/businesses')
@role_required('admin')
def admin_businesses():
    db = get_db()
    businesses = db.execute("""
        SELECT b.*, c.name as category_name, u.name as owner_name, u.email as owner_email
        FROM businesses b LEFT JOIN categories c ON b.category_id=c.id
        JOIN users u ON b.owner_id=u.id
        ORDER BY b.created_at DESC
    """).fetchall()
    return render_template('admin_businesses.html', businesses=businesses)


@app.route('/admin/verify/<int:biz_id>', methods=['POST'])
@role_required('admin')
def admin_verify(biz_id):
    db = get_db()
    db.execute("UPDATE businesses SET verified=1, status='active' WHERE id=?", (biz_id,))
    db.commit()
    flash('Business verified and activated!', 'success')
    return redirect(request.referrer or url_for('admin_dashboard'))


@app.route('/admin/activate/<int:biz_id>', methods=['POST'])
@role_required('admin')
def admin_activate(biz_id):
    db = get_db()
    db.execute("UPDATE businesses SET status='active', suspended=0 WHERE id=?", (biz_id,))
    db.commit()
    flash('Business activated!', 'success')
    return redirect(request.referrer or url_for('admin_businesses'))


@app.route('/admin/suspend/<int:biz_id>', methods=['POST'])
@role_required('admin')
def admin_suspend(biz_id):
    db = get_db()
    db.execute("UPDATE businesses SET suspended=1, status='suspended' WHERE id=?", (biz_id,))
    db.commit()
    flash('Business suspended.', 'warning')
    return redirect(request.referrer or url_for('admin_businesses'))


@app.route('/admin/reviews')
@role_required('admin')
def admin_reviews():
    db = get_db()
    reviews = db.execute("""
        SELECT r.*, u.name as reviewer_name, u.email as reviewer_email,
               b.name as business_name
        FROM reviews r JOIN users u ON r.customer_id=u.id
        JOIN businesses b ON r.business_id=b.id
        ORDER BY r.flagged DESC, r.created_at DESC
    """).fetchall()
    return render_template('admin_reviews.html', reviews=reviews)


@app.route('/admin/review/flag/<int:review_id>', methods=['POST'])
@role_required('admin')
def admin_flag_review(review_id):
    db = get_db()
    db.execute("UPDATE reviews SET flagged=1 WHERE id=?", (review_id,))
    db.commit()
    flash('Review flagged.', 'warning')
    return redirect(url_for('admin_reviews'))


@app.route('/admin/review/unflag/<int:review_id>', methods=['POST'])
@role_required('admin')
def admin_unflag_review(review_id):
    db = get_db()
    db.execute("UPDATE reviews SET flagged=0 WHERE id=?", (review_id,))
    db.commit()
    flash('Review unflagged.', 'info')
    return redirect(url_for('admin_reviews'))


@app.route('/admin/review/delete/<int:review_id>', methods=['POST'])
@role_required('admin')
def admin_delete_review(review_id):
    db = get_db()
    review = db.execute("SELECT business_id FROM reviews WHERE id=?", (review_id,)).fetchone()
    if review:
        db.execute("DELETE FROM reviews WHERE id=?", (review_id,))
        # Recalculate
        stats = db.execute("SELECT AVG(rating), COUNT(*) FROM reviews WHERE business_id=? AND flagged=0",
                           (review['business_id'],)).fetchone()
        db.execute("UPDATE businesses SET avg_rating=?, review_count=? WHERE id=?",
                   (round(stats[0] or 0, 1), stats[1], review['business_id']))
        db.commit()
    flash('Review removed.', 'info')
    return redirect(url_for('admin_reviews'))


@app.route('/admin/categories')
@role_required('admin')
def admin_categories():
    db = get_db()
    categories = db.execute("""
        SELECT c.*, COUNT(b.id) as biz_count
        FROM categories c LEFT JOIN businesses b ON c.id=b.category_id
        GROUP BY c.id ORDER BY c.name
    """).fetchall()
    return render_template('admin_categories.html', categories=categories)


@app.route('/admin/categories/add', methods=['POST'])
@role_required('admin')
def admin_add_category():
    db = get_db()
    name = request.form.get('name', '').strip()
    description = request.form.get('description', '').strip()
    icon = request.form.get('icon', '📦').strip()
    if name:
        db.execute("INSERT OR IGNORE INTO categories (name, description, icon) VALUES (?,?,?)",
                   (name, description, icon))
        db.commit()
        flash(f'Category "{name}" added!', 'success')
    return redirect(url_for('admin_categories'))


@app.route('/admin/categories/delete/<int:cat_id>', methods=['POST'])
@role_required('admin')
def admin_delete_category(cat_id):
    db = get_db()
    db.execute("DELETE FROM categories WHERE id=?", (cat_id,))
    db.commit()
    flash('Category deleted.', 'info')
    return redirect(url_for('admin_categories'))


@app.route('/admin/users')
@role_required('admin')
def admin_users():
    db = get_db()
    users = db.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
    return render_template('admin_users.html', users=users)


@app.route('/admin/user/delete/<int:user_id>', methods=['POST'])
@role_required('admin')
def admin_delete_user(user_id):
    if user_id == session.get('user_id'):
        flash('Cannot delete yourself.', 'danger')
        return redirect(url_for('admin_users'))
    db = get_db()
    db.execute("DELETE FROM users WHERE id=?", (user_id,))
    db.commit()
    flash('User deleted.', 'info')
    return redirect(url_for('admin_users'))


# ══════════════════════════════════════════════════════════
#  DYNAMIC DATA API (add category/city on the fly)
# ══════════════════════════════════════════════════════════
@app.route('/api/add-category', methods=['POST'])
@login_required
def api_add_category():
    data = request.get_json()
    name = data.get('name', '').strip()
    icon = data.get('icon', '').strip() or '📦'
    description = data.get('description', '').strip()
    if not name:
        return jsonify({'error': 'Category name is required.'}), 400
    db = get_db()
    existing = db.execute("SELECT id, name, icon FROM categories WHERE name=?", (name,)).fetchone()
    if existing:
        return jsonify({'id': existing['id'], 'name': existing['name'], 'icon': existing['icon'], 'exists': True})
    db.execute("INSERT INTO categories (name, description, icon) VALUES (?,?,?)", (name, description, icon))
    db.commit()
    cat = db.execute("SELECT id, name, icon FROM categories WHERE name=?", (name,)).fetchone()
    return jsonify({'id': cat['id'], 'name': cat['name'], 'icon': cat['icon'], 'exists': False})


@app.route('/api/add-city', methods=['POST'])
@login_required
def api_add_city():
    data = request.get_json()
    city = data.get('city', '').strip()
    if not city or len(city) < 2:
        return jsonify({'error': 'City name is required (min 2 chars).'}), 400
    # Store the city by adding a placeholder in businesses if needed — for now just echo back
    # Cities come from distinct businesses, so we just return the new city name for the UI
    return jsonify({'city': city, 'success': True})


# ══════════════════════════════════════════════════════════
#  STATIC FILE SERVING (uploads)
# ══════════════════════════════════════════════════════════
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    from flask import send_from_directory
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# ══════════════════════════════════════════════════════════
#  INIT & RUN
# ══════════════════════════════════════════════════════════
init_db()
seed_data()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5006, debug=True)
