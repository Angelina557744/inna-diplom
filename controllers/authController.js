const pool = require('../db/pool');
const bcrypt = require('bcryptjs');

async function register(req, res) {
    const { email, password, fullName, role, phone, group_name } = req.body;
    
    if (!email || !password || !fullName) {
        return res.status(400).json({ success: false, error: 'Заполните обязательные поля' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, error: 'Некорректный формат email' });
    }
    if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Пароль должен содержать минимум 6 символов' });
    }
    
    try {
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const userId = (role === 'teacher' ? 'TCH-' : 'ST-') + Date.now();
        const rating = role === 'teacher' ? 'Стаж: 1 год' : 'Эл. дневник: 4.8';
        const userGroup = group_name || (role === 'teacher' ? 'Кафедра ИТ' : 'Группа ИВТ-21');

        const [result] = await pool.query(
            `INSERT INTO users (email, password, fullName, role, phone, group_name, rating, userId, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [email, hashedPassword, fullName, role, phone || '', userGroup, rating, userId]
        );
        
        req.session.userId = result.insertId;
        req.session.userRole = role;
        
        res.json({ 
            success: true, 
            user: { 
                id: result.insertId, 
                email, 
                fullName, 
                role, 
                userId, 
                group_name: userGroup, 
                rating, 
                status: 'active' 
            } 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка регистрации' });
    }
}

async function login(req, res) {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Укажите email и пароль' });
    }
    
    try {
        const [users] = await pool.query(
            'SELECT id, email, fullName, role, password, status, block_until FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
        }
        
        const user = users[0];
        
        if (user.status === 'blocked' && user.block_until && new Date(user.block_until) > new Date()) {
            return res.status(403).json({ 
                success: false, 
                error: 'Аккаунт заблокирован до ' + new Date(user.block_until).toLocaleString('ru-RU') 
            });
        }
        
        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
        }
        
        if (user.status === 'blocked') {
            await pool.query("UPDATE users SET status = 'active', block_until = NULL WHERE id = ?", [user.id]);
        }
        
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.userEmail = user.email;
        
        res.json({ 
            success: true, 
            user: { 
                id: user.id, 
                email: user.email, 
                fullName: user.fullName, 
                role: user.role 
            } 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка входа' });
    }
}

async function logout(req, res) {
    req.session.destroy();
    res.json({ success: true });
}

async function getMe(req, res) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        const [users] = await pool.query(
            'SELECT id, email, fullName, role, phone, group_name, rating, userId, photoData, specialization, status, block_until FROM users WHERE id = ?',
            [req.session.userId]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Пользователь не найден' });
        }
        
        res.json({ success: true, user: users[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = { register, login, logout, getMe };