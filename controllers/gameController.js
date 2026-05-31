const pool = require('../db/pool');

async function getGameConfig(req, res) {
    try {
        const [rows] = await pool.query("SELECT key, value FROM game_configs");
        const config = {};
        
        rows.forEach(row => {
            try {
                config[row.key] = JSON.parse(row.value);
            } catch(e) {
                config[row.key] = row.value;
            }
        });
        
        res.json({ success: true, config });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updateGameConfig(req, res) {
    const config = req.body;
    
    try {
        for (const [key, value] of Object.entries(config)) {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            await pool.query(
                "INSERT INTO game_configs (key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
                [key, stringValue]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getGameQuestions(req, res) {
    try {
        const [questions] = await pool.query(
            'SELECT * FROM game_questions ORDER BY game, FIELD(difficulty, "easy", "normal", "hard")'
        );
        
        const result = {};
        questions.forEach(q => {
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
                q: q.question_text,
                options: options,
                correct: q.correct_index
            });
        });
        
        res.json({ success: true, questions: result });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function createGameQuestion(req, res) {
    const { game, difficulty, question_text, options, correct_index } = req.body;
    
    if (!game || !question_text || !options || correct_index === undefined) {
        return res.status(400).json({ success: false, error: 'Не все данные переданы' });
    }
    
    try {
        await pool.query(
            'INSERT INTO game_questions (game, difficulty, question_text, options, correct_index) VALUES (?, ?, ?, ?, ?)',
            [game, difficulty, question_text, JSON.stringify(options), correct_index]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function getGameProgress(req, res) {
    try {
        const [progress] = await pool.query(
            `SELECT gp.*, u.fullName as player_name 
             FROM game_progress gp 
             JOIN users u ON gp.user_id = u.id 
             ORDER BY gp.high_score DESC`
        );
        res.json({ success: true, progress });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function updateGameProgress(req, res) {
    const { game, high_score, questions_answered } = req.body;
    const userId = req.session.userId;
    
    if (!game || high_score === undefined) {
        return res.status(400).json({ success: false, error: 'Не все данные переданы' });
    }
    
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        await pool.query(
            `INSERT INTO game_progress (user_id, game, high_score, questions_answered, last_played) 
             VALUES (?, ?, ?, ?, NOW()) 
             ON DUPLICATE KEY UPDATE 
             high_score = GREATEST(high_score, VALUES(high_score)), 
             questions_answered = questions_answered + VALUES(questions_answered), 
             last_played = NOW()`,
            [userId, game, high_score, questions_answered || 0]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = { getGameConfig, updateGameConfig, getGameQuestions, createGameQuestion, getGameProgress, updateGameProgress };