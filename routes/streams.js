const express = require('express');
const router = express.Router();
const { getAllStreams, createStream, updateStream, deleteStream, uploadRecording, getRecordings } = require('../controllers/streamController');
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { uploadRecording: uploadRecordingMiddleware } = require('../middleware/upload');

router.get('/', isAuthenticated, getAllStreams);
router.post('/', isAuthenticated, isTeacher, createStream);
router.put('/:id', isAuthenticated, isTeacher, updateStream);
router.delete('/:id', isAuthenticated, isTeacher, deleteStream);
router.post('/recordings/upload', isAuthenticated, isTeacher, uploadRecordingMiddleware.single('recording'), uploadRecording);
router.get('/recordings/:courseId', isAuthenticated, getRecordings);

module.exports = router;