const pool = require('../db/pool');
const bcrypt = require('bcryptjs');

async function getAllUsers(req, res) {
    try {
        const [users] = await pool.query(
            'SELECT id, email, fullName, role, phone, group_name, specialization, rating, userId, status, block_until, created_at FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getUserById(req, res) {
    const id = parseInt(req.params.id);
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        const [users] = await pool.query(
            'SELECT id, email, fullName, role, phone, group_name, specialization, rating, userId, photoData, status, block_until FROM users WHERE id = ?',
            [id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ success: false, error: 'Пользователь не найден' });
        }
        
        res.json({ success: true, user: users[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updateUser(req, res) {
    const id = parseInt(req.params.id);
    const { phone, email, group_name, photoData, fullName, password } = req.body;
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        const updates = [];
        const values = [];
        
        if (phone !== undefined) {
            updates.push('phone = ?');
            values.push(phone);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        if (group_name !== undefined) {
            updates.push('group_name = ?');
            values.push(group_name);
        }
        if (photoData !== undefined) {
            updates.push('photoData = ?');
            values.push(photoData);
        }
        if (fullName !== undefined) {
            updates.push('fullName = ?');
            values.push(fullName);
        }
        if (password !== undefined && password.length > 0) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            updates.push('password = ?');
            values.push(hashedPassword);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'Нет данных для обновления' });
        }
        
        values.push(id);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function createUser(req, res) {
    const { email, password, fullName, role, phone, group_name, specialization, status, block_until } = req.body;
    
    if (!email || !fullName) {
        return res.status(400).json({ success: false, error: 'Email и ФИО обязательны' });
    }
    
    try {
        const hashedPassword = bcrypt.hashSync(password || '123456', 10);
        const userId = (role === 'teacher' ? 'TCH-' : 'ST-') + Date.now();
        const rating = role === 'teacher' ? 'Стаж: 1 год' : 'Эл. дневник: 4.8';
        
        const [result] = await pool.query(
            `INSERT INTO users (email, password, fullName, role, phone, group_name, specialization, rating, userId, status, block_until) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [email, hashedPassword, fullName, role, phone || '', group_name || '', specialization || '', rating, userId, status || 'active', block_until || null]
        );
        
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updateUsersBatch(req, res) {
    const { users } = req.body;
    
    if (!Array.isArray(users)) {
        return res.status(400).json({ success: false, error: 'Неверный формат данных' });
    }
    
    try {
        for (const user of users) {
            await pool.query(
                `UPDATE users SET fullName = ?, email = ?, role = ?, group_name = ?, specialization = ?, status = ?, block_until = ? WHERE id = ?`,
                [user.fullName || user.fullname, user.email, user.role, user.group_name, user.specialization, user.status || 'active', user.block_until || user.blockUntil || null, user.id]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function deleteUser(req, res) {
    const id = parseInt(req.params.id);
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = { getAllUsers, getUserById, updateUser, createUser, updateUsersBatch, deleteUser };