const API_URL = window.location.origin;

async function apiRequest(url, options = {}) {
    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        credentials: 'include'
    });
    return response.json();
}

async function registerUser(data) {
    return apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function loginUser(email, password) {
    return apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
}

async function logoutUser() {
    return apiRequest('/api/auth/logout', { method: 'POST' });
}

async function getCurrentUser() {
    return apiRequest('/api/auth/me');
}

async function updateUserProfile(id, data) {
    return apiRequest(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function getAllCourses() {
    return apiRequest('/api/courses');
}

async function enrollInCourse(courseId) {
    return apiRequest('/api/courses/enroll', {
        method: 'POST',
        body: JSON.stringify({ courseId })
    });
}

async function getCourseProgress(studentId) {
    return apiRequest(`/api/courses/progress/${studentId}`);
}

async function uploadSubmission(formData) {
    const response = await fetch(`${API_URL}/api/submissions/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
    });
    return response.json();
}

async function getAllSubmissions() {
    return apiRequest('/api/submissions');
}

async function gradeSubmission(id, grade, comment) {
    return apiRequest(`/api/submissions/${id}/grade`, {
        method: 'PUT',
        body: JSON.stringify({ grade, comment })
    });
}

async function getMyGrades() {
    return apiRequest('/api/submissions/grades/my');
}

async function getAllGroups() {
    return apiRequest('/api/groups');
}

async function createGroup(name, courseId) {
    return apiRequest('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name, course_id: courseId })
    });
}

async function deleteGroup(id) {
    return apiRequest(`/api/groups/${id}`, { method: 'DELETE' });
}

async function getMySchedule() {
    return apiRequest('/api/groups/schedule/my');
}

async function getAllStreams() {
    return apiRequest('/api/streams');
}

async function createStream(title, scheduledFor) {
    return apiRequest('/api/streams', {
        method: 'POST',
        body: JSON.stringify({ title, scheduled_for: scheduledFor })
    });
}

async function updateStream(id, data) {
    return apiRequest(`/api/streams/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function deleteStream(id) {
    return apiRequest(`/api/streams/${id}`, { method: 'DELETE' });
}

async function getGameConfig() {
    return apiRequest('/api/games/config');
}

async function updateGameConfig(config) {
    return apiRequest('/api/games/config', {
        method: 'PUT',
        body: JSON.stringify(config)
    });
}

async function getGameQuestions() {
    return apiRequest('/api/games/questions');
}

async function updateGameProgress(game, highScore, questionsAnswered) {
    return apiRequest('/api/games/progress', {
        method: 'POST',
        body: JSON.stringify({ game, high_score: highScore, questions_answered: questionsAnswered })
    });
}

async function getSiteContent() {
    return apiRequest('/api/content/site-content');
}

async function updateSiteContent(content) {
    return apiRequest('/api/content/site-content', {
        method: 'PUT',
        body: JSON.stringify(content)
    });
}

async function getSliderCourses() {
    return apiRequest('/api/content/slider-courses');
}

async function updateSliderCourses(courses) {
    return apiRequest('/api/content/slider-courses', {
        method: 'PUT',
        body: JSON.stringify(courses)
    });
}

async function getPartners() {
    return apiRequest('/api/content/partners');
}

async function updatePartners(partners) {
    return apiRequest('/api/content/partners', {
        method: 'PUT',
        body: JSON.stringify(partners)
    });
}

async function getApplications() {
    return apiRequest('/api/content/applications');
}

async function updateApplication(id, status, comment) {
    return apiRequest(`/api/content/applications/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, admin_comment: comment })
    });
}

async function getStatistics() {
    return apiRequest('/api/statistics');
}

async function getActivityLog() {
    return apiRequest('/api/statistics/activity-log');
}

async function getNotifications() {
    return apiRequest('/api/statistics/notifications');
}

async function markNotificationRead(id) {
    return apiRequest(`/api/statistics/notifications/${id}/read`, { method: 'PUT' });
}

async function sendChatMessage(receiverEmail, messageText) {
    return apiRequest('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ receiver_email: receiverEmail, message_text: messageText })
    });
}

async function getChatMessages(participantEmail) {
    return apiRequest(`/api/chat/${participantEmail}`);
}

export {
    registerUser, loginUser, logoutUser, getCurrentUser, updateUserProfile,
    getAllCourses, enrollInCourse, getCourseProgress, uploadSubmission,
    getAllSubmissions, gradeSubmission, getMyGrades, getAllGroups, createGroup,
    deleteGroup, getMySchedule, getAllStreams, createStream, updateStream,
    deleteStream, getGameConfig, updateGameConfig, getGameQuestions,
    updateGameProgress, getSiteContent, updateSiteContent, getSliderCourses,
    updateSliderCourses, getPartners, updatePartners, getApplications,
    updateApplication, getStatistics, getActivityLog, getNotifications,
    markNotificationRead, sendChatMessage, getChatMessages
};