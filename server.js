const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');
require('dotenv').config();

const pool = require('./db/pool');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true,
        methods: ['GET', 'POST']
    }
});

const sessionStore = new MySQLStore({}, pool);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://picsum.photos", "https://placehold.co"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "ws:", "wss:"],
            frameSrc: ["'none'"]
        }
    }
}));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: 'Слишком много запросов, попробуйте позже' },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Превышен лимит попыток входа' },
    skipSuccessfulRequests: true
});

app.use(cors({
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'cons-press-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
}));


const onlineUsers = new Map(); // ключ - email, значение - socket.id

io.use((socket, next) => {
    const auth = socket.handshake.auth;
    if (!auth || !auth.userId || !auth.userRole) {
        return next(new Error('Unauthorized'));
    }
    next();
});

io.on('connection', (socket) => {
    const userEmail = socket.handshake.auth.userId; // здесь передаётся email
    const userRole = socket.handshake.auth.userRole;

    onlineUsers.set(userEmail, socket.id);
    io.emit('online-count', onlineUsers.size);
    console.log(`✅ User connected: ${userEmail}, online: ${onlineUsers.size}`);

    // Обработчик входящих сообщений
    socket.on('chat-message', async (data) => {
        const { from, to, text } = data;
        if (!from || !to || !text) return;

        try {
            // Сохраняем в БД
            await pool.query(
                `INSERT INTO chat_messages (sender_email, receiver_email, message_text, created_at) 
                 VALUES (?, ?, ?, NOW())`,
                [from, to, text]
            );

            // Отправляем получателю, если он онлайн
            const receiverSocketId = onlineUsers.get(to);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('chat-message', {
                    from, to, text,
                    time: new Date().toLocaleTimeString()
                });
            }

            // Подтверждение отправителю
            socket.emit('chat-message', {
                from, to, text,
                time: new Date().toLocaleTimeString()
            });
        } catch (err) {
            console.error('WebSocket message error:', err);
        }
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(userEmail);
        io.emit('online-count', onlineUsers.size);
        console.log(`❌ User disconnected: ${userEmail}, online: ${onlineUsers.size}`);
    });
});

app.use((req, res, next) => {
    req.db = pool;
    req.io = io;
    next();
});

const uploadsDir = 'uploads';
const recordingsDir = 'recordings';

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

const submissionStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, uniqueSuffix + '-' + originalName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'text/html', 'text/css',
        'application/javascript',
        'video/mp4', 'video/webm'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Неподдерживаемый тип файла'));
    }
};

const uploadSubmission = multer({ 
    storage: submissionStorage, 
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: fileFilter
});

app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(200).json({ success: false, error: 'Не авторизован' });
    }
    try {
        const [users] = await pool.query('SELECT id, email, fullName, role, phone, group_name, rating, userId, photoData, specialization, status, block_until FROM users WHERE id = ?', [req.session.userId]);
        if (users.length === 0) {
            return res.status(200).json({ success: false });
        }
        res.json({ success: true, user: users[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Укажите email и пароль' });
    }
    
    try {
        const [users] = await pool.query('SELECT id, email, fullName, role, password, status, block_until FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
        }
        
        const user = users[0];
        const isValid = bcrypt.compareSync(password, user.password);
        
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
        }
        
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.userEmail = user.email;
        
        res.json({ success: true, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
        
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.post('/api/auth/register', async (req, res) => {
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
        const [result] = await pool.query('INSERT INTO users (email, password, fullName, role, phone, group_name, rating, userId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "active")', [email, hashedPassword, fullName, role, phone || '', userGroup, rating, userId]);
        req.session.userId = result.insertId;
        req.session.userRole = role;
        res.json({ success: true, user: { id: result.insertId, email, fullName, role, userId, group_name: userGroup, rating, status: 'active' } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка регистрации' });
    }
});

app.get('/api/statistics', async (req, res) => {
    try {
        const [[{ students }]] = await pool.query("SELECT COUNT(*) as students FROM users WHERE role = 'student'");
        const [[{ teachers }]] = await pool.query("SELECT COUNT(*) as teachers FROM users WHERE role = 'teacher'");
        const [[{ courses }]] = await pool.query("SELECT COUNT(*) as courses FROM courses");
        const [[{ groupCount }]] = await pool.query("SELECT COUNT(*) as groupCount FROM `groups`");
        
        const stats = {
            students: students || 0,
            teachers: teachers || 0,
            courses: courses || 0,
            groups: groupCount || 0
        };
        res.json({ success: true, stats: stats });
    } catch (err) {
        console.error('Statistics error:', err);
        res.status(500).json({ success: false, error: 'Ошибка загрузки статистики: ' + err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        let query = 'SELECT id, email, fullName, role, phone, group_name, specialization, rating, userId, status FROM users';
        let params = [];
        
        if (req.query.role) {
            query += ' WHERE role = ?';
            params.push(req.query.role);
        }
        
        query += ' ORDER BY id DESC';
        
        const [users] = await pool.query(query, params);
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.post('/api/users', async (req, res) => {
    const { email, password, fullName, role, phone, group_name, specialization, status, block_until } = req.body;
    
    if (!email || !fullName) {
        return res.status(400).json({ success: false, error: 'Email и ФИО обязательны' });
    }
    
    try {
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: 'Пользователь с таким email уже существует' });
        }
        
        const hashedPassword = bcrypt.hashSync(password || '123456', 10);
        const userId = (role === 'teacher' ? 'TCH-' : 'ST-') + Date.now().toString().slice(-6);
        const rating = role === 'teacher' ? 'Стаж: 1 год' : 'Эл. дневник: 4.8';
        
        const [result] = await pool.query(
            `INSERT INTO users (email, password, fullName, role, phone, group_name, specialization, rating, userId, status, block_until) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [email, hashedPassword, fullName, role, phone || '', group_name || '', specialization || '', rating, userId, status || 'active', block_until || null]
        );
        
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('Create user error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { fullName, email, phone, group_name, specialization, status, block_until, password } = req.body;
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        const updates = [];
        const values = [];
        
        if (fullName !== undefined) {
            updates.push('fullName = ?');
            values.push(fullName);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        if (phone !== undefined) {
            updates.push('phone = ?');
            values.push(phone);
        }
        if (group_name !== undefined) {
            updates.push('group_name = ?');
            values.push(group_name);
        }
        if (specialization !== undefined) {
            updates.push('specialization = ?');
            values.push(specialization);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            values.push(status);
        }
        if (block_until !== undefined) {
            updates.push('block_until = ?');
            values.push(block_until || null);
        }
        if (password && password.length > 0) {
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
        console.error('Update user error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/courses', async (req, res) => {
    try {
        let courses;
        if (req.session.userRole === 'student') {
            // Студент видит только курсы, на которые он записан
            const [rows] = await pool.query(`
                SELECT c.* 
                FROM courses c
                INNER JOIN course_enrollments ce ON c.id = ce.course_id
                WHERE ce.student_id = ?
                ORDER BY c.created_at DESC
            `, [req.session.userId]);
            courses = rows;
        } else {
            // Админ и преподаватель видят все курсы
            const [rows] = await pool.query('SELECT * FROM courses ORDER BY created_at DESC');
            courses = rows;
        }
        res.json({ success: true, courses });
    } catch (err) {
        console.error('Courses error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/groups', async (req, res) => {
    try {
        const [groups] = await pool.query('SELECT * FROM `groups` ORDER BY name');
        res.json({ success: true, groups });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/streams', async (req, res) => {
    try {
        const [streams] = await pool.query(`
            SELECT s.*, u.fullName as teacher_name, c.name as course_name 
            FROM streams s 
            LEFT JOIN users u ON s.teacher_id = u.id 
            LEFT JOIN courses c ON s.course_id = c.id
            ORDER BY s.created_at DESC
        `);
        res.json({ success: true, streams });
    } catch (err) {
        console.error('Get streams error:', err);
        res.status(500).json({ success: false, error: 'Ошибка загрузки трансляций' });
    }
});

app.post('/api/submissions/upload', uploadSubmission.single('file'), async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    const { title, course_id, group_name, student_name } = req.body;
    const file = req.file;
    
    if (!title) {
        return res.status(400).json({ success: false, error: 'Название работы обязательно' });
    }
    
    try {
        const [users] = await pool.query('SELECT fullName, group_name FROM users WHERE id = ?', [req.session.userId]);
        const user = users[0] || {};
        
        const [result] = await pool.query(
            `INSERT INTO submissions (student_id, student_name, course_id, group_name, title, file_name, file_type, file_data, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                req.session.userId, 
                student_name || user.fullName || 'Студент', 
                course_id || 1, 
                group_name || user.group_name || '', 
                title, 
                file ? file.filename : null, 
                file ? file.mimetype : null, 
                file ? `/uploads/${file.filename}` : null
            ]
        );
        
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сохранения файла' });
    }
});

app.post('/api/streams', async (req, res) => {
    const { title, teacher_id, course_id, scheduled_for, status } = req.body;
    
    if (!title) {
        return res.status(400).json({ success: false, error: 'Название трансляции обязательно' });
    }
    
    try {
        let formattedDate = null;
        if (scheduled_for) {
            const date = new Date(scheduled_for);
            formattedDate = date.toISOString().slice(0, 19).replace('T', ' ');
        }
        
        const [result] = await pool.query(
            `INSERT INTO streams (title, teacher_id, course_id, status, scheduled_for, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [title, teacher_id || null, course_id || null, status || 'planned', formattedDate]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('Create stream error:', err);
        res.status(500).json({ success: false, error: 'Ошибка создания трансляции' });
    }
});

app.put('/api/streams/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { title, status, viewers, overlay_text, teacher_id, course_id, scheduled_for } = req.body;
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        const updates = [];
        const values = [];
        
        if (title !== undefined) { updates.push('title = ?'); values.push(title); }
        if (status !== undefined) { updates.push('status = ?'); values.push(status); }
        if (viewers !== undefined) { updates.push('viewers = ?'); values.push(viewers); }
        if (overlay_text !== undefined) { updates.push('overlay_text = ?'); values.push(overlay_text); }
        if (teacher_id !== undefined) { updates.push('teacher_id = ?'); values.push(teacher_id); }
        if (course_id !== undefined) { updates.push('course_id = ?'); values.push(course_id); }
        if (scheduled_for !== undefined) {
            let formattedDate = null;
            if (scheduled_for) {
                const date = new Date(scheduled_for);
                formattedDate = date.toISOString().slice(0, 19).replace('T', ' ');
            }
            updates.push('scheduled_for = ?');
            values.push(formattedDate);
        }
        
        if (status === 'active') {
            updates.push('started_at = NOW()');
        }
        if (status === 'ended') {
            updates.push('ended_at = NOW()');
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'Нет данных для обновления' });
        }
        
        values.push(id);
        await pool.query(`UPDATE streams SET ${updates.join(', ')} WHERE id = ?`, values);
        res.json({ success: true });
    } catch (err) {
        console.error('Update stream error:', err);
        res.status(500).json({ success: false, error: 'Ошибка обновления' });
    }
});

app.patch('/api/streams/:id/viewers', async (req, res) => {
    const id = parseInt(req.params.id);
    const { viewers } = req.body;
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query('UPDATE streams SET viewers = ? WHERE id = ?', [viewers, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Update viewers error:', err);
        res.status(500).json({ success: false, error: 'Ошибка обновления' });
    }
});

app.get('/api/streams/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        const [streams] = await pool.query(`
            SELECT s.*, u.fullName as teacher_name, c.name as course_name 
            FROM streams s 
            LEFT JOIN users u ON s.teacher_id = u.id 
            LEFT JOIN courses c ON s.course_id = c.id
            WHERE s.id = ?
        `, [id]);
        
        if (streams.length === 0) {
            return res.status(404).json({ success: false, error: 'Трансляция не найдена' });
        }
        
        res.json({ success: true, stream: streams[0] });
    } catch (err) {
        console.error('Get stream error:', err);
        res.status(500).json({ success: false, error: 'Ошибка загрузки трансляции' });
    }
});

app.put('/api/users/:id/photo', async (req, res) => {
    const id = parseInt(req.params.id);
    const { photoData } = req.body;
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    if (!photoData) {
        return res.status(400).json({ success: false, error: 'Нет данных фото' });
    }
    
    try {
        await pool.query('UPDATE users SET photoData = ? WHERE id = ?', [photoData, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Update photo error:', err);
        res.status(500).json({ success: false, error: 'Ошибка обновления фото' });
    }
});
app.delete('/api/streams/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query('DELETE FROM streams WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete stream error:', err);
        res.status(500).json({ success: false, error: 'Ошибка удаления' });
    }
});

app.get('/api/submissions', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        let query = `SELECT s.*, u.fullName as student_name 
                     FROM submissions s 
                     LEFT JOIN users u ON s.student_id = u.id`;
        let params = [];
        
        if (req.session.userRole === 'student') {
            query += ' WHERE s.student_id = ?';
            params.push(req.session.userId);
        }
        
        query += ' ORDER BY s.submitted_at DESC';
        
        const [submissions] = await pool.query(query, params);
        res.json({ success: true, submissions });
    } catch (err) {
        console.error('Get submissions error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.put('/api/submissions/:id/grade', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    const submissionId = parseInt(req.params.id);
    const { grade, comment } = req.body;

    if (isNaN(submissionId)) {
        return res.status(400).json({ success: false, error: 'Неверный ID работы' });
    }
    if (grade === undefined || grade < 0 || grade > 100) {
        return res.status(400).json({ success: false, error: 'Оценка должна быть от 0 до 100' });
    }

    try {
        const [sub] = await pool.query('SELECT id FROM submissions WHERE id = ?', [submissionId]);
        if (sub.length === 0) {
            return res.status(404).json({ success: false, error: 'Работа не найдена' });
        }
        await pool.query(
            "UPDATE submissions SET grade = ?, comment = ?, status = 'checked' WHERE id = ?",
            [grade, comment, submissionId]
        );
        await pool.query(
            'INSERT INTO grades (submission_id, teacher_id, value, comment) VALUES (?, ?, ?, ?)',
            [submissionId, req.session.userId, grade, comment]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Grade error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сохранения оценки' });
    }
});

app.get('/api/games/progress', async (req, res) => {
    try {
        const [progress] = await pool.query(`
            SELECT gp.*, u.fullName as player_name 
            FROM game_progress gp 
            JOIN users u ON gp.user_id = u.id 
            ORDER BY gp.high_score DESC
            LIMIT 50
        `);
        res.json({ success: true, progress });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/partners', async (req, res) => {
    try {
        const [partners] = await pool.query('SELECT * FROM partners ORDER BY sort_order');
        res.json({ success: true, partners });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/site-content', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT `key`, `value` FROM site_content');
        const content = {};
        rows.forEach(row => { content[row.key] = row.value; });
        res.json({ success: true, content });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/slider-courses', async (req, res) => {
    try {
        const [courses] = await pool.query('SELECT * FROM slider_courses ORDER BY sort_order');
        res.json({ success: true, courses });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/content/site-content', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT `key`, `value` FROM site_content');
        const content = {};
        rows.forEach(row => { content[row.key] = row.value; });
        res.json({ success: true, content });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/content/slider-courses', async (req, res) => {
    try {
        const [courses] = await pool.query('SELECT * FROM slider_courses ORDER BY sort_order');
        res.json({ success: true, courses });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/content/partners', async (req, res) => {
    try {
        const [partners] = await pool.query('SELECT * FROM partners ORDER BY sort_order');
        res.json({ success: true, partners });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.get('/api/content/applications', async (req, res) => {
    try {
        const [apps] = await pool.query('SELECT * FROM applications ORDER BY created_at DESC');
        res.json({ success: true, applications: apps });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

app.post('/api/content/applications', async (req, res) => {
    const { sender_name, sender_email, type, content } = req.body;
    
    if (!sender_name || !content) {
        return res.status(400).json({ success: false, error: 'Имя и сообщение обязательны' });
    }
    
    try {
        const [result] = await pool.query(
            `INSERT INTO applications (sender_name, sender_email, type, content, status, created_at) 
             VALUES (?, ?, ?, ?, 'pending', NOW())`,
            [sender_name, sender_email || null, type || 'question', content]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('Save application error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сохранения заявки' });
    }
});

app.put('/api/content/applications/:id', async (req, res) => {
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
        console.error('Update application error:', err);
        res.status(500).json({ success: false, error: 'Ошибка обновления' });
    }
});




app.post('/api/chat', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { receiver_email, message_text } = req.body;
    if (!receiver_email || !message_text) {
        return res.status(400).json({ success: false, error: 'Не все поля заполнены' });
    }
    const sender_email = req.session.userEmail;
    if (!sender_email) {
        return res.status(400).json({ success: false, error: 'Отправитель не определён' });
    }
    try {
        await pool.query(
            'INSERT INTO chat_messages (sender_email, receiver_email, message_text, created_at) VALUES (?, ?, ?, NOW())',
            [sender_email, receiver_email, message_text]
        );
        // Отправить получателю
        const receiverSocketId = onlineUsers.get(receiver_email);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('chat-message', {
                from: sender_email,
                to: receiver_email,
                text: message_text,
                time: new Date().toLocaleTimeString()
            });
        }
        // Опционально: отправить и отправителю, чтобы он мгновенно увидел сообщение (но мы уже вызываем loadChatMessages)
        // const senderSocketId = onlineUsers.get(sender_email);
        // if (senderSocketId) io.to(senderSocketId).emit(...);
        res.json({ success: true });
    } catch (err) {
        console.error('Send message error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


app.get('/api/my-course-applications', async (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'student') {
        return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    try {
        const [apps] = await pool.query(
            `SELECT * FROM applications 
             WHERE sender_email = ? AND type = 'course_enrollment' 
             ORDER BY created_at DESC`,
            [req.session.userEmail]
        );
        res.json({ success: true, applications: apps });
    } catch (err) {
        console.error('Get student applications error:', err);
        res.status(500).json({ success: false, error: 'Ошибка загрузки заявок' });
    }
});

app.post('/api/admin/enroll-student', async (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'admin') {
        return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    const { courseId, studentEmail } = req.body;
    if (!courseId || !studentEmail) {
        return res.status(400).json({ success: false, error: 'Не хватает данных' });
    }
    try {
        const [students] = await pool.query('SELECT id FROM users WHERE email = ? AND role = "student"', [studentEmail]);
        if (students.length === 0) {
            return res.status(404).json({ success: false, error: 'Студент с таким email не найден' });
        }
        const studentId = students[0].id;
        await pool.query(
            'INSERT IGNORE INTO course_enrollments (student_id, course_id) VALUES (?, ?)',
            [studentId, courseId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Enroll student error:', err);
        res.status(500).json({ success: false, error: 'Ошибка зачисления' });
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/foto', express.static(path.join(__dirname, 'public', 'foto')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/recordings', express.static(path.join(__dirname, 'recordings')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/lickab.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'lickab.html')));
app.get('/kurs.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'kurs.html')));
app.get('/spesial.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'spesial.html')));
app.get('/igra.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'igra.html')));
app.get('/teacher.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'teacher.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manifest.json')));
app.get('/offline.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'offline.html')));

// ==================== ИГРЫ ====================

app.get('/api/games/questions', async (req, res) => {
    try {
        const [questions] = await pool.query(`
            SELECT * FROM game_questions 
            ORDER BY game, FIELD(difficulty, 'easy', 'normal', 'hard')
        `);
        
        const result = {};
        for (const q of questions) {
            if (!result[q.game]) {
                result[q.game] = { easy: [], normal: [], hard: [] };
            }
            
            let options = q.options;
            if (typeof options === 'string') {
                try {
                    options = JSON.parse(options);
                } catch(e) {
                    options = [];
                }
            }
            
            result[q.game][q.difficulty].push({
                id: q.id,
                q: q.question_text,
                options: options,
                correct: q.correct_index,
                course_id: q.course_id
            });
        }
        
        res.json({ success: true, questions: result });
    } catch (err) {
        console.error('Get questions error:', err);
        res.status(500).json({ success: false, error: 'Ошибка загрузки вопросов' });
    }
});

app.post('/api/games/questions', async (req, res) => {
    const { game, difficulty, question_text, options, correct_index, course_id } = req.body;
    
    if (!game || !question_text || !options || correct_index === undefined) {
        return res.status(400).json({ success: false, error: 'Не все данные переданы' });
    }
    
    try {
        const [result] = await pool.query(`
            INSERT INTO game_questions (game, difficulty, question_text, options, correct_index, course_id) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [game, difficulty, question_text, JSON.stringify(options), correct_index, course_id || null]);
        
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('Create question error:', err);
        res.status(500).json({ success: false, error: 'Ошибка создания вопроса' });
    }
});

app.put('/api/games/questions/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { question_text, options, correct_index } = req.body;
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query(`
            UPDATE game_questions 
            SET question_text = ?, options = ?, correct_index = ? 
            WHERE id = ?
        `, [question_text, JSON.stringify(options), correct_index, id]);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Update question error:', err);
        res.status(500).json({ success: false, error: 'Ошибка обновления вопроса' });
    }
});

app.delete('/api/games/questions/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'Неверный ID' });
    }
    
    try {
        await pool.query('DELETE FROM game_questions WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete question error:', err);
        res.status(500).json({ success: false, error: 'Ошибка удаления вопроса' });
    }
});

app.get('/api/games/config', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT `key`, `value` FROM game_configs");
        const config = {};
        for (const row of rows) {
            try {
                config[row.key] = JSON.parse(row.value);
            } catch(e) {
                config[row.key] = row.value;
            }
        }
        res.json({ success: true, config });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка загрузки настроек' });
    }
});

app.put('/api/games/config', async (req, res) => {
    const config = req.body;
    
    try {
        for (const [key, value] of Object.entries(config)) {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            await pool.query(`
                INSERT INTO game_configs (key, value) VALUES (?, ?) 
                ON DUPLICATE KEY UPDATE value = VALUES(value)
            `, [key, stringValue]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Save config error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сохранения настроек' });
    }
});

app.post('/api/games/progress', async (req, res) => {
    const { game, high_score, questions_answered } = req.body;
    const userId = req.session.userId;
    
    if (!game || high_score === undefined) {
        return res.status(400).json({ success: false, error: 'Не все данные переданы' });
    }
    
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        const [result] = await pool.query(`
            INSERT INTO game_progress (user_id, game, high_score, questions_answered, last_played) 
            VALUES (?, ?, ?, ?, NOW()) 
            ON DUPLICATE KEY UPDATE 
                high_score = GREATEST(high_score, VALUES(high_score)), 
                questions_answered = questions_answered + VALUES(questions_answered), 
                last_played = NOW()
        `, [userId, game, high_score, questions_answered || 0]);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Save progress error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сохранения прогресса' });
    }
});

app.delete('/api/submissions/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const id = parseInt(req.params.id);
    try {
        const [sub] = await pool.query('SELECT file_data FROM submissions WHERE id = ?', [id]);
        if (sub.length && sub[0].file_data) {
            const filePath = path.join(__dirname, sub[0].file_data);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await pool.query('DELETE FROM submissions WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});
app.get('/api/chat/:participantEmail', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    const currentEmail = req.session.userEmail;
    if (!currentEmail) {
        return res.status(400).json({ success: false, error: 'Email пользователя не найден в сессии' });
    }
    const participantEmail = req.params.participantEmail;
    try {
        const [messages] = await pool.query(
            `SELECT * FROM chat_messages 
             WHERE (sender_email = ? AND receiver_email = ?) 
                OR (sender_email = ? AND receiver_email = ?)
             ORDER BY created_at ASC LIMIT 200`,
            [currentEmail, participantEmail, participantEmail, currentEmail]
        );
        res.json({ success: true, messages });
    } catch (err) {
        console.error('Get messages error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});


const PORT = process.env.PORT || 3000;

async function initDirectories() {
    const dirs = ['uploads', 'recordings', 'public/css', 'public/js/pages', 'public/foto'];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

app.post('/api/admin/enroll-student', async (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'admin') {
        return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }
    const { courseId, studentEmail } = req.body;
    if (!courseId || !studentEmail) {
        return res.status(400).json({ success: false, error: 'Не хватает данных' });
    }
    try {
        const [students] = await pool.query('SELECT id FROM users WHERE email = ? AND role = "student"', [studentEmail]);
        if (students.length === 0) {
            return res.status(404).json({ success: false, error: 'Студент не найден' });
        }
        const studentId = students[0].id;
        await pool.query(
            'INSERT IGNORE INTO course_enrollments (student_id, course_id) VALUES (?, ?)',
            [studentId, courseId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Enroll student error:', err);
        res.status(500).json({ success: false, error: 'Ошибка зачисления' });
    }
});

initDirectories().then(() => {
    server.listen(PORT, () => {
        console.log('Server running on http://127.0.0.1:' + PORT);
    });
}).catch(err => {
    console.error('Startup failed:', err);
    process.exit(1);
});