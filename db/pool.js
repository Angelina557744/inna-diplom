const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'conspress',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4'
};

if (!process.env.DB_PASSWORD) {
    console.error('ERROR: DB_PASSWORD environment variable is required');
    process.exit(1);
}

const pool = mysql.createPool(dbConfig);

module.exports = pool;