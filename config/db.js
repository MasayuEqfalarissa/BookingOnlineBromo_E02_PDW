const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT || 4000, // 1. Tambahkan konfigurasi PORT (TiDB menggunakan port 4000)
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true // 2. WAJIB menggunakan SSL untuk koneksi ke TiDB Cloud aman
  }
};

let pool;

async function initDB() {
  try {
    // Pada TiDB Cloud, database default biasanya sudah otomatis dibuatkan saat registrasi (misal: 'test' atau 'booking_bromo')
    // Jadi kita langsung membuat pool koneksi ke target database tersebut
    pool = mysql.createPool({
      ...dbConfig,
      database: process.env.DB_NAME || 'test', // Sesuaikan dengan nama DB di TiDB, defaultnya 'test'
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`Terhubung ke database TiDB Cloud: ${process.env.DB_NAME || 'test'}`);

    // Buat tabel-tabel jika belum ada
    await createTables();
    
    // Masukkan data default (seeding)
    await seedData();

  } catch (error) {
    console.error('Gagal menginisialisasi database TiDB:', error);
    process.exit(1);
  }
}

async function createTables() {
  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      role ENUM('admin', 'customer') NOT NULL DEFAULT 'customer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const packagesTable = `
    CREATE TABLE IF NOT EXISTS packages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      description TEXT NOT NULL,
      price_per_person DECIMAL(10, 2) NOT NULL,
      image_url VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const bookingsTable = `
    CREATE TABLE IF NOT EXISTS bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      package_id INT NOT NULL,
      travel_date DATE NOT NULL,
      total_participants INT NOT NULL,
      total_price DECIMAL(10, 2) NOT NULL,
      status ENUM('pending', 'waiting_verification', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
      booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );
  `;

  const paymentsTable = `
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      amount_paid DECIMAL(10, 2) NOT NULL,
      bank_name VARCHAR(50) NOT NULL,
      account_holder VARCHAR(100) NOT NULL,
      payment_proof_url VARCHAR(255) NOT NULL,
      status ENUM('pending', 'verified', 'failed') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );
  `;

  await pool.query(usersTable);
  await pool.query(packagesTable);
  await pool.query(bookingsTable);
  await pool.query(paymentsTable);
  console.log('Tabel-tabel database berhasil diverifikasi/dibuat.');
}

async function seedData() {
  const bcrypt = require('bcryptjs');

  const [admins] = await pool.query("SELECT * FROM users WHERE role = 'admin'");
  if (admins.length === 0) {
    const hashedPassword = await bcrypt.hash('admin', 10);
    await pool.query(
      "INSERT INTO users (username, email, password, phone, role) VALUES (?, ?, ?, ?, 'admin')",
      ['admin', 'admin@bromo.com', hashedPassword, '081234567890']
    );
    console.log('User Admin default berhasil dibuat (username: admin, pass: admin)');
  }

  const [packages] = await pool.query("SELECT * FROM packages");
  if (packages.length === 0) {
    const defaultPackages = [
      [
        'Paket Bromo Sunrise (Open Trip)',
        'Saksikan keindahan matahari terbit Bromo yang legendaris di Penanjakan 1, dilanjutkan menjelajahi Kawah Bromo, Pasir Berbisik, Savana, dan Bukit Teletubbies menggunakan Jeep 4x4. Paket sudah termasuk penjemputan dari Malang/Surabaya, driver, BBM, tiket masuk TNBTS, dan air mineral.',
        350000.00,
        '/images/packages/bromo_sunrise.jpg'
      ],
      [
        'Paket Bromo Milky Way & Sunrise (Private)',
        'Bagi pecinta fotografi malam, nikmati pemandangan galaksi Bintang Bromo (Milky Way) yang spektakuler dari spot terbaik di malam hari sebelum menyaksikan Sunrise yang memukau. Paket eksklusif private jeep dengan fotografer berpengalaman.',
        750000.00,
        '/images/packages/bromo_milkyway.jpg'
      ],
      [
        'Paket Bromo Camping & Adventure',
        'Rasakan sensasi berkemah di bawah jutaan bintang di kawasan kaldera Bromo. Termasuk perlengkapan tenda premium, api unggun, makan malam hangat khas pegunungan, pemandu lokal, dan jelajah kawah serta bukit Teletubbies keesokan harinya.',
        950000.00,
        '/images/packages/bromo_camping.jpg'
      ],
      [
        'Sewa Jeep Bromo (Private 4x4 Jeep)',
        'Sewa Jeep Toyota Land Cruiser 4x4 pribadi untuk rombongan Anda sendiri. Rute mencakup: Penanjakan/Kedaluh (Sunrise), Kawah Bromo (Pura Luhur Poten), Pasir Berbisik, dan Bukit Teletubbies. Maksimal 6 orang per jeep. Penjemputan di area Cemoro Lawang / Tosari / Wonokitri.',
        650000.00,
        '/images/packages/sewa_jeep.jpg'
      ]
    ];

    for (const pkg of defaultPackages) {
      await pool.query(
        "INSERT INTO packages (name, description, price_per_person, image_url) VALUES (?, ?, ?, ?)",
        pkg
      );
    }
    console.log('Data Paket Wisata default berhasil ditambahkan.');
  }
}

function query(sql, params) {
  return pool.query(sql, params);
}

module.exports = {
  initDB,
  query,
  getPool: () => pool
};