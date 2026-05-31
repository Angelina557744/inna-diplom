const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = 'uploads';
const recordingsDir = 'recordings';

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/html', 'text/css', 'application/javascript'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Неподдерживаемый тип файла'), false);
    }
};

const submissionStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + Buffer.from(file.originalname, 'latin1').toString('utf8'));
    }
});

const recordingStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'recordings/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const uploadSubmission = multer({ storage: submissionStorage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: fileFilter });
const uploadRecording = multer({ storage: recordingStorage, limits: { fileSize: 500 * 1024 * 1024 }, fileFilter: fileFilter });

module.exports = { uploadSubmission, uploadRecording };