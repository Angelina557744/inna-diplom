const pool = require('../db/pool');

async function getAllCourses(req, res) {
    try {
        const [courses] = await pool.query(
            `SELECT c.*, u.fullName as teacher_name 
             FROM courses c 
             LEFT JOIN users u ON c.teacher_id = u.id 
             ORDER BY c.created_at DESC`
        );
        res.json({ success: true, courses });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getCourseById(req, res) {
    const id = parseInt(req.params.id);
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        const [courses] = await pool.query(
            `SELECT c.*, u.fullName as teacher_name 
             FROM courses c 
             LEFT JOIN users u ON c.teacher_id = u.id 
             WHERE c.id = ?`,
            [id]
        );
        
        if (courses.length === 0) {
            return res.status(404).json({ success: false, error: 'Курс не найден' });
        }
        
        const [lessons] = await pool.query(
            'SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order',
            [id]
        );
        
        res.json({ success: true, course: courses[0], lessons });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function createCourse(req, res) {
    const { name, description, teacher_id } = req.body;
    
    if (!name) {
        return res.status(400).json({ success: false, error: 'Название курса обязательно' });
    }
    
    try {
        const [result] = await pool.query(
            'INSERT INTO courses (name, description, teacher_id) VALUES (?, ?, ?)',
            [name, description, teacher_id || req.session.userId]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updateCourse(req, res) {
    const id = parseInt(req.params.id);
    const { name, description, teacher_id } = req.body;
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query(
            'UPDATE courses SET name = ?, description = ?, teacher_id = ? WHERE id = ?',
            [name, description, teacher_id, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function deleteCourse(req, res) {
    const id = parseInt(req.params.id);
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query('DELETE FROM courses WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function enrollCourse(req, res) {
    const { courseId } = req.body;
    const studentId = req.session.userId;
    
    if (!courseId) {
        return res.status(400).json({ success: false, error: 'ID курса обязателен' });
    }
    
    if (!studentId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        await pool.query(
            'INSERT IGNORE INTO course_enrollments (student_id, course_id) VALUES (?, ?)',
            [studentId, courseId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getStudentProgress(req, res) {
    const studentId = parseInt(req.params.studentId);
    
    if (!studentId) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        const [progress] = await pool.query(
            `SELECT 
                c.id as courseId, 
                c.name as courseName, 
                COUNT(DISTINCT l.id) as totalLessons, 
                COUNT(DISTINCT CASE WHEN lp.completed = 1 THEN lp.lesson_id END) as completedLessons,
                ROUND(AVG(g.value)) as averageGrade,
                MAX(lp.completed_at) as lastActivity
             FROM courses c 
             LEFT JOIN lessons l ON l.course_id = c.id 
             LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = ?
             LEFT JOIN grades g ON g.submission_id IN (SELECT id FROM submissions WHERE student_id = ? AND course_id = c.id)
             WHERE c.id IN (SELECT course_id FROM course_enrollments WHERE student_id = ?)
             GROUP BY c.id`,
            [studentId, studentId, studentId]
        );
        
        const progressWithPercent = progress.map(p => ({
            ...p,
            percent: p.totalLessons > 0 ? Math.round((p.completedLessons / p.totalLessons) * 100) : 0
        }));
        
        res.json({ success: true, progress: progressWithPercent });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updateLessonProgress(req, res) {
    const { courseId, lessonId } = req.body;
    const studentId = req.session.userId;
    
    if (!lessonId) {
        return res.status(400).json({ success: false, error: 'ID урока обязателен' });
    }
    
    if (!studentId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        await pool.query(
            `INSERT INTO lesson_progress (student_id, lesson_id, completed, completed_at) 
             VALUES (?, ?, 1, NOW()) 
             ON DUPLICATE KEY UPDATE completed = 1, completed_at = NOW()`,
            [studentId, lessonId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = { getAllCourses, getCourseById, createCourse, updateCourse, deleteCourse, enrollCourse, getStudentProgress, updateLessonProgress };