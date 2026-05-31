const pool = require('../db/pool');

async function getSiteContent(req, res) {
    try {
        const [rows] = await pool.query('SELECT key, value FROM site_content');
        const content = {};
        rows.forEach(row => { content[row.key] = row.value; });
        res.json({ success: true, content });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updateSiteContent(req, res) {
    const content = req.body;
    
    try {
        for (const [key, value] of Object.entries(content)) {
            await pool.query(
                'INSERT INTO site_content (key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
                [key, value]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getSliderCourses(req, res) {
    try {
        const [courses] = await pool.query('SELECT * FROM slider_courses ORDER BY sort_order');
        res.json({ success: true, courses });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updateSliderCourses(req, res) {
    const courses = Array.isArray(req.body) ? req.body : req.body.courses || [];
    
    try {
        await pool.query('DELETE FROM slider_courses');
        
        for (let i = 0; i < courses.length; i++) {
            const c = courses[i];
            await pool.query(
                'INSERT INTO slider_courses (title, img, link, sort_order) VALUES (?, ?, ?, ?)',
                [c.title, c.img, c.link, i]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getPartners(req, res) {
    try {
        const [partners] = await pool.query('SELECT * FROM partners ORDER BY sort_order');
        res.json({ success: true, partners });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updatePartners(req, res) {
    const partners = Array.isArray(req.body) ? req.body : req.body.partners || [];
    
    try {
        await pool.query('DELETE FROM partners');
        
        for (let i = 0; i < partners.length; i++) {
            const p = partners[i];
            await pool.query(
                'INSERT INTO partners (name, img, link, sort_order) VALUES (?, ?, ?, ?)',
                [p.name, p.img, p.link, i]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getApplications(req, res) {
    try {
        const [apps] = await pool.query('SELECT * FROM applications ORDER BY created_at DESC');
        res.json({ success: true, applications: apps });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updateApplication(req, res) {
    const id = parseInt(req.params.id);
    const { status, admin_comment } = req.body;
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query(
            'UPDATE applications SET status = ?, admin_comment = ? WHERE id = ?',
            [status, admin_comment || null, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = { getSiteContent, updateSiteContent, getSliderCourses, updateSliderCourses, getPartners, updatePartners, getApplications, updateApplication };