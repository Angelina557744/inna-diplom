const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixAdmin() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'conspress',
    });

    const password = 'admin123';
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    console.log('New password hash:', hashedPassword);
    
    await pool.query(`DELETE FROM users WHERE email = 'admin@cons.ru'`);
    
    await pool.query(`
        INSERT INTO users (email, password, fullName, role, phone, group_name, userId, status, created_at) 
        VALUES (?, ?, ?, 'admin', '+7 (999) 000-00-00', 'Админ-панель', 'ADM-001', 'active', NOW())
    `, ['admin@cons.ru', hashedPassword, 'Администратор']);
    
    console.log('Admin created successfully!');
    console.log('Email: admin@cons.ru');
    console.log('Password: admin123');
    
    process.exit(0);
}

fixAdmin();