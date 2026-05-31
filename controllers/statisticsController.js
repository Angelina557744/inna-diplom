const pool = require('../db/pool');

async function getStatistics(req, res) {
    try {
        const [[{ students }]] = await pool.query("SELECT COUNT(*) as students FROM users WHERE role = 'student'");
        const [[{ teachers }]] = await pool.query("SELECT COUNT(*) as teachers FROM users WHERE role = 'teacher'");
        const [[{ courses }]] = await pool.query('SELECT COUNT(*) as courses FROM courses');
        const [[{ groups }]] = await pool.query('SELECT COUNT(*) as groups FROM groups');
        const [[{ submissions }]] = await pool.query('SELECT COUNT(*) as submissions FROM submissions');
        const [[{ activeStreams }]] = await pool.query("SELECT COUNT(*) as activeStreams FROM streams WHERE status = 'active'");
        
        res.json({ success: true, stats: { students, teachers, courses, groups, submissions, activeStreams } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getActivityLog(req, res) {
    try {
        const [logs] = await pool.query(
            'SELECT l.*, u.fullName as admin_name FROM activity_log l LEFT JOIN users u ON l.admin_id = u.id ORDER BY l.created_at DESC LIMIT 100'
        );
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function createActivityLog(req, res) {
    const { action } = req.body;
    
    if (!action) {
        return res.status(400).json({ success: false, error: 'Действие не указано' });
    }
    
    try {
        await pool.query(
            'INSERT INTO activity_log (admin_id, action) VALUES (?, ?)',
            [req.session.userId || null, action]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getNotifications(req, res) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        const [notifications] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.session.userId]
        );
        res.json({ success: true, notifications });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function markNotificationRead(req, res) {
    const id = parseInt(req.params.id);
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [id, req.session.userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = { getStatistics, getActivityLog, createActivityLog, getNotifications, markNotificationRead };