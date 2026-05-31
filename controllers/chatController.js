const pool = require('../db/pool');

async function getChatMessages(req, res) {
    const participantEmail = req.params.participantEmail;
    const currentEmail = req.session.userEmail;
    
    if (!currentEmail) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    try {
        const [messages] = await pool.query(
            `SELECT * FROM chat_messages 
             WHERE (sender_email = ? AND receiver_email = ?) 
                OR (sender_email = ? AND receiver_email = ?) 
             ORDER BY created_at ASC 
             LIMIT 100`,
            [currentEmail, participantEmail, participantEmail, currentEmail]
        );
        res.json({ success: true, messages });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

async function sendChatMessage(req, res) {
    const { receiver_email, message_text } = req.body;
    const sender_email = req.session.userEmail;
    
    if (!sender_email || !receiver_email || !message_text) {
        return res.status(400).json({ success: false, error: 'Не все данные переданы' });
    }
    
    try {
        await pool.query(
            'INSERT INTO chat_messages (sender_email, receiver_email, message_text) VALUES (?, ?, ?)',
            [sender_email, receiver_email, message_text]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
    }
}

module.exports = { getChatMessages, sendChatMessage };