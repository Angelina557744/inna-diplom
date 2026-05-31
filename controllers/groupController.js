const pool = require('../db/pool');

async function getAllGroups(req, res) {
    try {
        const [groups] = await pool.query(
            `SELECT g.*, c.name as course_name FROM groups g LEFT JOIN courses c ON g.course_id = c.id`
        );
        res.json({ success: true, groups });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function createGroup(req, res) {
    const { name, course_id } = req.body;
    
    if (!name) {
        return res.status(400).json({ success: false, error: 'Название группы обязательно' });
    }
    
    try {
        const [result] = await pool.query(
            'INSERT INTO groups (name, course_id) VALUES (?, ?)',
            [name, course_id || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updateGroup(req, res) {
    const id = parseInt(req.params.id);
    const { name, course_id } = req.body;
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query(
            'UPDATE groups SET name = ?, course_id = ? WHERE id = ?',
            [name, course_id, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function deleteGroup(req, res) {
    const id = parseInt(req.params.id);
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query('DELETE FROM groups WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getSchedule(req, res) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        const [schedule] = await pool.query(
            `SELECT s.*, c.name as course_name, u.fullName as teacher_name 
             FROM schedule s 
             JOIN courses c ON s.course_id = c.id 
             JOIN users u ON c.teacher_id = u.id 
             WHERE s.group_name = (SELECT group_name FROM users WHERE id = ?) 
             ORDER BY s.day_of_week, s.start_time`,
            [req.session.userId]
        );
        res.json({ success: true, schedule });
    } catch (err) {
        res.json({ success: true, schedule: [] });
    }
}

module.exports = { getAllGroups, createGroup, updateGroup, deleteGroup, getSchedule };