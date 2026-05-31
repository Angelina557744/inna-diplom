const express = require('express');
const router = express.Router();
const { getSiteContent, updateSiteContent, getSliderCourses, updateSliderCourses, getPartners, updatePartners, getApplications, updateApplication } = require('../controllers/contentController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.get('/site-content', getSiteContent);
router.put('/site-content', isAuthenticated, isAdmin, updateSiteContent);
router.get('/slider-courses', getSliderCourses);
router.put('/slider-courses', isAuthenticated, isAdmin, updateSliderCourses);
router.get('/partners', getPartners);
router.put('/partners', isAuthenticated, isAdmin, updatePartners);
router.get('/applications', isAuthenticated, isAdmin, getApplications);
router.put('/applications/:id', isAuthenticated, isAdmin, updateApplication);

module.exports = router;