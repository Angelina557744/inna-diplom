const express = require('express');
const router = express.Router();
const { getAllCourses, getCourseById, createCourse, updateCourse, deleteCourse, enrollCourse, getStudentProgress, updateLessonProgress } = require('../controllers/courseController');
const { isAuthenticated, isTeacher, isAdmin } = require('../middleware/auth');

router.get('/', isAuthenticated, getAllCourses);
router.get('/:id', isAuthenticated, getCourseById);
router.post('/', isAuthenticated, isTeacher, createCourse);
router.put('/:id', isAuthenticated, isTeacher, updateCourse);
router.delete('/:id', isAuthenticated, isAdmin, deleteCourse);
router.post('/enroll', isAuthenticated, enrollCourse);
router.get('/progress/:studentId', isAuthenticated, getStudentProgress);
router.post('/progress', isAuthenticated, updateLessonProgress);

module.exports = router;