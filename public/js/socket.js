let socket = null;

function initSocket(userId, userRole) {
    if (socket && socket.connected) {
        return socket;
    }
    
    socket = io({
        auth: {
            userId: userId,
            userRole: userRole
        }
    });
    
    socket.on('connect', () => {
        console.log('Socket connected');
    });
    
    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });
    
    socket.on('online-count', (count) => {
        const onlineElement = document.getElementById('onlineCount');
        if (onlineElement) {
            onlineElement.textContent = `Онлайн: ${count}`;
        }
    });
    
    socket.on('chat-message', (data) => {
        const event = new CustomEvent('newChatMessage', { detail: data });
        document.dispatchEvent(event);
    });
    
    socket.on('grade-updated', (data) => {
        const event = new CustomEvent('gradeUpdated', { detail: data });
        document.dispatchEvent(event);
        showNotification('Работа проверена', `За "${data.workTitle}" получена оценка ${data.grade}`);
    });
    
    socket.on('stream-started', (data) => {
        const event = new CustomEvent('streamStarted', { detail: data });
        document.dispatchEvent(event);
        showNotification('Началась трансляция', `${data.teacherName} ведёт лекцию "${data.courseName}"`);
    });
    
    return socket;
}

function getSocket() {
    return socket;
}

function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

function showNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body: body, icon: '/favicon.ico' });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, { body: body, icon: '/favicon.ico' });
            }
        });
    }
}

export { initSocket, getSocket, disconnectSocket };