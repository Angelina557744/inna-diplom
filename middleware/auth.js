const pool = require('../db/pool');

async function isAuthenticated(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    next();
}

async function isAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    try {
        const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [req.session.userId]);
        if (users.length === 0 || users[0].role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Доступ запрещен' });
        }
        next();
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
}

async function isTeacher(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    try {
        const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [req.session.userId]);
        if (users.length === 0 || (users[0].role !== 'teacher' && users[0].role !== 'admin')) {
            return res.status(403).json({ success: false, error: 'Доступ запрещен' });
        }
        next();
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
}

module.exports = { isAuthenticated, isAdmin, isTeacher };