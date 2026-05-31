const express = require('express');
const router = express.Router();
const { getAllSubmissions, createSubmission, gradeSubmission, deleteSubmission, getUserGrades } = require('../controllers/submissionController');
const { isAuthenticated, isTeacher } = require('../middleware/auth');
const { uploadSubmission } = require('../middleware/upload');

router.get('/', isAuthenticated, getAllSubmissions);
router.post('/upload', isAuthenticated, uploadSubmission.single('file'), createSubmission);
router.put('/:id/grade', isAuthenticated, isTeacher, gradeSubmission);
router.delete('/:id', isAuthenticated, isTeacher, deleteSubmission);
router.get('/grades/my', isAuthenticated, getUserGrades);

module.exports = router;