// ═══════════════════════════════════════════════════════════
// Lua IDE - Notification Manager
// Professional toast notifications and confirmation dialogs
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// NOTIFICATION TYPES
// ═══════════════════════════════════════════════════════════

const NotificationType = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

// ═══════════════════════════════════════════════════════════
// NOTIFICATION STATE
// ═══════════════════════════════════════════════════════════

const NotificationState = {
    container: null,
    confirmDialog: null,
    activeNotifications: [],
    notificationId: 0
};

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

export function initializeNotifications() {
    // Create toast container
    NotificationState.container = document.createElement('div');
    NotificationState.container.id = 'notification-container';
    NotificationState.container.className = 'notification-container';
    document.body.appendChild(NotificationState.container);

    // Create confirmation dialog container
    NotificationState.confirmDialog = document.createElement('div');
    NotificationState.confirmDialog.id = 'confirm-dialog';
    NotificationState.confirmDialog.className = 'confirm-dialog-overlay';
    NotificationState.confirmDialog.style.display = 'none';
    document.body.appendChild(NotificationState.confirmDialog);

    console.log('✓ Notification system initialized');
}

// ═══════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

export function showNotification(message, type = NotificationType.INFO, duration = 4000) {
    const id = NotificationState.notificationId++;

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('data-notification-id', id);

    // Icon based on type
    let icon = '';
    switch (type) {
        case NotificationType.SUCCESS:
            icon = '✓';
            break;
        case NotificationType.ERROR:
            icon = '✕';
            break;
        case NotificationType.WARNING:
            icon = '⚠';
            break;
        case NotificationType.INFO:
            icon = 'ℹ';
            break;
    }

    notification.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-message">${escapeHtml(message)}</div>
        <button class="notification-close">×</button>
    `;

    // Close button handler
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        dismissNotification(id);
    });

    // Add to container
    NotificationState.container.appendChild(notification);
    NotificationState.activeNotifications.push({ id, element: notification });

    // Animate in
    setTimeout(() => {
        notification.classList.add('notification-show');
    }, 10);

    // Auto-dismiss after duration (if not error)
    if (duration > 0 && type !== NotificationType.ERROR) {
        setTimeout(() => {
            dismissNotification(id);
        }, duration);
    }

    return id;
}

export function dismissNotification(id) {
    const notification = NotificationState.activeNotifications.find(n => n.id === id);
    if (!notification) return;

    // Animate out
    notification.element.classList.remove('notification-show');
    notification.element.classList.add('notification-hide');

    // Remove after animation
    setTimeout(() => {
        if (notification.element.parentNode) {
            notification.element.parentNode.removeChild(notification.element);
        }
        NotificationState.activeNotifications = NotificationState.activeNotifications.filter(n => n.id !== id);
    }, 300);
}

export function dismissAllNotifications() {
    NotificationState.activeNotifications.forEach(notification => {
        dismissNotification(notification.id);
    });
}

// ═══════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════

export function showSuccess(message, duration = 4000) {
    return showNotification(message, NotificationType.SUCCESS, duration);
}

export function showError(message, duration = 0) {
    // Errors don't auto-dismiss by default
    return showNotification(message, NotificationType.ERROR, duration);
}

export function showWarning(message, duration = 5000) {
    return showNotification(message, NotificationType.WARNING, duration);
}

export function showInfo(message, duration = 4000) {
    return showNotification(message, NotificationType.INFO, duration);
}

// ═══════════════════════════════════════════════════════════
// CONFIRMATION DIALOG
// ═══════════════════════════════════════════════════════════

export function showConfirmation(options) {
    return new Promise((resolve) => {
        const {
            title = 'Confirm',
            message,
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            type = 'warning' // 'warning', 'danger', 'info'
        } = options;

        // Icon based on type
        let icon = '⚠';
        if (type === 'danger') icon = '⚠';
        if (type === 'info') icon = 'ℹ';

        // Create dialog content
        NotificationState.confirmDialog.innerHTML = `
            <div class="confirm-dialog confirm-dialog-${type}">
                <div class="confirm-header">
                    <span class="confirm-icon">${icon}</span>
                    <h3 class="confirm-title">${escapeHtml(title)}</h3>
                </div>
                <div class="confirm-body">
                    <p class="confirm-message">${escapeHtml(message)}</p>
                </div>
                <div class="confirm-footer">
                    <button class="confirm-btn confirm-btn-cancel">${escapeHtml(cancelText)}</button>
                    <button class="confirm-btn confirm-btn-confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

        // Show dialog
        NotificationState.confirmDialog.style.display = 'flex';

        // Get buttons
        const confirmBtn = NotificationState.confirmDialog.querySelector('.confirm-btn-confirm');
        const cancelBtn = NotificationState.confirmDialog.querySelector('.confirm-btn-cancel');

        // Confirm handler
        const handleConfirm = () => {
            hideConfirmation();
            resolve(true);
        };

        // Cancel handler
        const handleCancel = () => {
            hideConfirmation();
            resolve(false);
        };

        // Attach handlers
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);

        // ESC key to cancel
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        // Click outside to cancel
        NotificationState.confirmDialog.addEventListener('click', (e) => {
            if (e.target === NotificationState.confirmDialog) {
                handleCancel();
            }
        });
    });
}

function hideConfirmation() {
    NotificationState.confirmDialog.style.display = 'none';
    NotificationState.confirmDialog.innerHTML = '';
}

// ═══════════════════════════════════════════════════════════
// LOADING INDICATOR
// ═══════════════════════════════════════════════════════════

let loadingOverlay = null;

export function showLoading(message = 'Loading...') {
    // Create loading overlay if it doesn't exist
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        document.body.appendChild(loadingOverlay);
    }

    loadingOverlay.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-message">${escapeHtml(message)}</div>
    `;

    loadingOverlay.style.display = 'flex';
}

export function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
