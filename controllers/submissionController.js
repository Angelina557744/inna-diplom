const pool = require('../db/pool');
const fs = require('fs');

async function getAllSubmissions(req, res) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        let query = `SELECT s.*, u.fullName as student_fullname FROM submissions s LEFT JOIN users u ON s.student_id = u.id`;
        let params = [];
        
        if (req.session.userRole === 'student') {
            query += ' WHERE s.student_id = ?';
            params.push(req.session.userId);
        }
        
        query += ' ORDER BY s.submitted_at DESC';
        
        const [submissions] = await pool.query(query, params);
        res.json({ success: true, submissions });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function createSubmission(req, res) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    const { title, course_id, group_name, student_name } = req.body;
    const file = req.file;
    
    if (!title || !course_id) {
        return res.status(400).json({ success: false, error: 'Название и ID курса обязательны' });
    }
    
    try {
        const [users] = await pool.query('SELECT fullName, group_name FROM users WHERE id = ?', [req.session.userId]);
        const user = users[0] || {};
        
        const [result] = await pool.query(
            `INSERT INTO submissions (student_id, student_name, course_id, group_name, title, file_name, file_type, file_data, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [req.session.userId, student_name || user.fullName || 'Студент', course_id, group_name || user.group_name || '', title, file ? file.filename : null, file ? file.mimetype : null, file ? `/uploads/${file.filename}` : null]
        );
        
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function gradeSubmission(req, res) {
    const submissionId = parseInt(req.params.id);
    const { grade, comment } = req.body;
    
    if (!submissionId) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    if (grade === undefined || grade < 0 || grade > 100) {
        return res.status(400).json({ success: false, error: 'Оценка должна быть от 0 до 100' });
    }
    
    try {
        await pool.query(
            "UPDATE submissions SET grade = ?, comment = ?, status = 'checked' WHERE id = ?",
            [grade, comment, submissionId]
        );
        
        await pool.query(
            'INSERT INTO grades (submission_id, teacher_id, value, comment) VALUES (?, ?, ?, ?)',
            [submissionId, req.session.userId, grade, comment]
        );
        
        const [submission] = await pool.query('SELECT student_id, title FROM submissions WHERE id = ?', [submissionId]);
        
        if (submission.length > 0 && req.io) {
            req.io.emit('grade-updated', { studentId: submission[0].student_id, workTitle: submission[0].title, grade });
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function deleteSubmission(req, res) {
    const id = parseInt(req.params.id);
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        const [submissions] = await pool.query('SELECT file_data FROM submissions WHERE id = ?', [id]);
        
        if (submissions.length > 0 && submissions[0].file_data) {
            const filePath = submissions[0].file_data.replace('/uploads/', 'uploads/');
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        await pool.query('DELETE FROM submissions WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getUserGrades(req, res) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        const [grades] = await pool.query(
            `SELECT g.id, g.value, g.comment, g.created_at, c.name as course_name, s.title as submission_title 
             FROM grades g 
             JOIN submissions s ON g.submission_id = s.id 
             JOIN courses c ON s.course_id = c.id 
             WHERE s.student_id = ? 
             ORDER BY g.created_at DESC`,
            [req.session.userId]
        );
        res.json({ success: true, grades });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = { getAllSubmissions, createSubmission, gradeSubmission, deleteSubmission, getUserGrades };