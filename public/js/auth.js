import { getCurrentUser } from './api.js';

let currentUser = null;

async function initAuth() {
    const user = await getCurrentUser();
    if (user.success) {
        currentUser = user.user;
        return currentUser;
    }
    return null;
}

function isAuthenticated() {
    return currentUser !== null;
}

function isAdmin() {
    return currentUser && currentUser.role === 'admin';
}

function isTeacher() {
    return currentUser && (currentUser.role === 'teacher' || currentUser.role === 'admin');
}

function isStudent() {
    return currentUser && currentUser.role === 'student';
}

function getUser() {
    return currentUser;
}

function setUser(user) {
    currentUser = user;
}

function clearUser() {
    currentUser = null;
}

export { initAuth, isAuthenticated, isAdmin, isTeacher, isStudent, getUser, setUser, clearUser };