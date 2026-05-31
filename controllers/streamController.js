const pool = require('../db/pool');

async function getAllStreams(req, res) {
    try {
        const [streams] = await pool.query(
            'SELECT * FROM streams ORDER BY created_at DESC'
        );
        res.json({ success: true, streams });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function createStream(req, res) {
    const { title, scheduled_for } = req.body;
    
    if (!title) {
        return res.status(400).json({ success: false, error: 'Название трансляции обязательно' });
    }
    
    try {
        const [result] = await pool.query(
            'INSERT INTO streams (title, teacher_id, status, scheduled_for) VALUES (?, ?, "planned", ?)',
            [title, req.session.userId, scheduled_for || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updateStream(req, res) {
    const id = parseInt(req.params.id);
    const { status, overlay_text, viewers } = req.body;
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        const updates = [];
        const values = [];
        
        if (status !== undefined) {
            updates.push('status = ?');
            values.push(status);
        }
        if (overlay_text !== undefined) {
            updates.push('overlay_text = ?');
            values.push(overlay_text);
        }
        if (viewers !== undefined) {
            updates.push('viewers = ?');
            values.push(viewers);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'Нет данных для обновления' });
        }
        
        values.push(id);
        await pool.query(`UPDATE streams SET ${updates.join(', ')} WHERE id = ?`, values);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function deleteStream(req, res) {
    const id = parseInt(req.params.id);
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query('DELETE FROM streams WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function uploadRecording(req, res) {
    const { courseId, title } = req.body;
    const file = req.file;
    
    if (!courseId || !title || !file) {
        return res.status(400).json({ success: false, error: 'Не все данные переданы' });
    }
    
    try {
        await pool.query(
            'INSERT INTO lecture_recordings (course_id, title, file_path, teacher_id, created_at) VALUES (?, ?, ?, ?, NOW())',
            [courseId, title, `/recordings/${file.filename}`, req.session.userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getRecordings(req, res) {
    const courseId = parseInt(req.params.courseId);
    
    if (!courseId) {
        return res.status(400).json({ success: false, error: 'Неверный ID курса' });
    }
    
    try {
        const [recordings] = await pool.query(
            'SELECT * FROM lecture_recordings WHERE course_id = ? ORDER BY created_at DESC',
            [courseId]
        );
        res.json({ success: true, recordings });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = { getAllStreams, createStream, updateStream, deleteStream, uploadRecording, getRecordings };