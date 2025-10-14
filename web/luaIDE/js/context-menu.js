// ═══════════════════════════════════════════════════════════
// Lua IDE - Context Menu Manager
// Handles right-click context menus for products, projects, and files
// ═══════════════════════════════════════════════════════════

import { storage } from './storage.js';
import { showSuccess, showError, showWarning } from './notification-manager.js';

let contextMenu = null;
let currentTarget = null;
let currentType = null; // 'product', 'project', or 'file'

// ═══════════════════════════════════════════════════════════
// INITIALIZE CONTEXT MENU
// ═══════════════════════════════════════════════════════════

export function initializeContextMenu() {
    // Create context menu element
    contextMenu = document.createElement('div');
    contextMenu.id = 'context-menu';
    contextMenu.className = 'context-menu';
    contextMenu.style.display = 'none';
    document.body.appendChild(contextMenu);

    // Close context menu on click outside
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    // Close context menu on scroll
    document.addEventListener('scroll', hideContextMenu, true);

    console.log('✓ Context menu initialized');
}

// ═══════════════════════════════════════════════════════════
// SHOW/HIDE CONTEXT MENU
// ═══════════════════════════════════════════════════════════

export function showContextMenu(e, type, target, data) {
    e.preventDefault();
    e.stopPropagation();

    currentTarget = target;
    currentType = type;

    // Build menu items based on type
    let menuItems = [];

    if (type === 'product') {
        const isSystem = data.isSystem || false;
        menuItems = [
            { icon: '🔄', label: 'Rename', action: () => renameProduct(data.id), disabled: isSystem },
            { icon: '🗑️', label: 'Delete', action: () => deleteProduct(data.id), disabled: isSystem },
            { separator: true },
            { icon: '📤', label: 'Export', action: () => exportProduct(data.id), disabled: isSystem },
        ];
    } else if (type === 'project') {
        menuItems = [
            { icon: '🔄', label: 'Rename', action: () => renameProject(data.id) },
            { icon: '🗑️', label: 'Delete', action: () => deleteProject(data.id) },
            { separator: true },
            { icon: '📤', label: 'Export', action: () => exportProject(data.id) },
        ];
    } else if (type === 'file') {
        const project = storage.projects.getById(data.projectId);
        const isLastFile = project && project.files.length === 1;
        menuItems = [
            { icon: '🔄', label: 'Rename', action: () => renameFile(data.projectId, data.fileId) },
            { icon: '🗑️', label: 'Delete', action: () => deleteFile(data.projectId, data.fileId), disabled: isLastFile },
            { separator: true },
            { icon: '📄', label: 'Duplicate', action: () => duplicateFile(data.projectId, data.fileId) },
        ];
    }

    // Build HTML
    let html = '';
    menuItems.forEach(item => {
        if (item.separator) {
            html += '<div class="context-menu-separator"></div>';
        } else {
            const disabledClass = item.disabled ? ' disabled' : '';
            html += `
                <div class="context-menu-item${disabledClass}" data-action="${menuItems.indexOf(item)}">
                    <span class="context-menu-icon">${item.icon}</span>
                    <span class="context-menu-label">${item.label}</span>
                </div>
            `;
        }
    });

    contextMenu.innerHTML = html;

    // Attach event listeners
    contextMenu.querySelectorAll('.context-menu-item:not(.disabled)').forEach((item, index) => {
        const menuItem = menuItems.filter(mi => !mi.separator)[index];
        item.addEventListener('click', () => {
            menuItem.action();
            hideContextMenu();
        });
    });

    // Position and show menu
    const x = e.clientX;
    const y = e.clientY;

    contextMenu.style.display = 'block';

    // Adjust position if menu would go off-screen
    const menuRect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (x + menuRect.width > viewportWidth) {
        contextMenu.style.left = (viewportWidth - menuRect.width - 5) + 'px';
    } else {
        contextMenu.style.left = x + 'px';
    }

    if (y + menuRect.height > viewportHeight) {
        contextMenu.style.top = (viewportHeight - menuRect.height - 5) + 'px';
    } else {
        contextMenu.style.top = y + 'px';
    }
}

export function hideContextMenu() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
    currentTarget = null;
    currentType = null;
}

// ═══════════════════════════════════════════════════════════
// PRODUCT ACTIONS
// ═══════════════════════════════════════════════════════════

function renameProduct(productId) {
    const product = storage.products.getById(productId);
    if (!product) {
        showError('Product not found');
        return;
    }

    if (product.isSystem) {
        showError('Cannot rename system products');
        return;
    }

    const newName = prompt('Enter new product name:', product.name);
    if (newName && newName.trim() !== '' && newName !== product.name) {
        try {
            storage.products.update(productId, { name: newName.trim() });
            showSuccess(`Product renamed to "${newName}"`);

            // Notify main app to update UI
            document.dispatchEvent(new CustomEvent('product:renamed', {
                detail: { productId }
            }));
        } catch (error) {
            showError('Failed to rename product: ' + error.message);
        }
    }
}

function deleteProduct(productId) {
    const product = storage.products.getById(productId);
    if (!product) {
        showError('Product not found');
        return;
    }

    if (product.isSystem) {
        showError('Cannot delete system products');
        return;
    }

    const confirmed = confirm(`Delete product "${product.name}"?\n\nThis will fail if any projects depend on it.`);
    if (confirmed) {
        try {
            storage.products.delete(productId);
            showSuccess(`Product "${product.name}" deleted`);

            // Notify main app to update UI
            document.dispatchEvent(new CustomEvent('product:deleted', {
                detail: { productId }
            }));
        } catch (error) {
            showError('Failed to delete product: ' + error.message);
        }
    }
}

function exportProduct(productId) {
    const product = storage.products.getById(productId);
    if (!product) {
        showError('Product not found');
        return;
    }

    if (product.isSystem) {
        showError('Cannot export system products');
        return;
    }

    try {
        const json = storage.products.export(productId);
        downloadFile(json, `${product.name}.json`, 'application/json');
        showSuccess(`Product "${product.name}" exported`);
    } catch (error) {
        showError('Failed to export product: ' + error.message);
    }
}

// ═══════════════════════════════════════════════════════════
// PROJECT ACTIONS
// ═══════════════════════════════════════════════════════════

function renameProject(projectId) {
    const project = storage.projects.getById(projectId);
    if (!project) {
        showError('Project not found');
        return;
    }

    const newName = prompt('Enter new project name:', project.name);
    if (newName && newName.trim() !== '' && newName !== project.name) {
        try {
            storage.projects.update(projectId, { name: newName.trim() });
            showSuccess(`Project renamed to "${newName}"`);

            // Notify main app to update UI
            document.dispatchEvent(new CustomEvent('project:renamed', {
                detail: { projectId }
            }));
        } catch (error) {
            showError('Failed to rename project: ' + error.message);
        }
    }
}

function deleteProject(projectId) {
    const project = storage.projects.getById(projectId);
    if (!project) {
        showError('Project not found');
        return;
    }

    const confirmed = confirm(`Delete project "${project.name}"?\n\nThis will delete all files in the project. This action cannot be undone.`);
    if (confirmed) {
        try {
            storage.projects.delete(projectId);
            showSuccess(`Project "${project.name}" deleted`);

            // Notify main app to update UI
            document.dispatchEvent(new CustomEvent('project:deleted', {
                detail: { projectId }
            }));
        } catch (error) {
            showError('Failed to delete project: ' + error.message);
        }
    }
}

function exportProject(projectId) {
    const project = storage.projects.getById(projectId);
    if (!project) {
        showError('Project not found');
        return;
    }

    try {
        const json = storage.projects.export(projectId);
        downloadFile(json, `${project.name}.json`, 'application/json');
        showSuccess(`Project "${project.name}" exported`);
    } catch (error) {
        showError('Failed to export project: ' + error.message);
    }
}

// ═══════════════════════════════════════════════════════════
// FILE ACTIONS
// ═══════════════════════════════════════════════════════════

function renameFile(projectId, fileId) {
    const file = storage.projects.getFile(projectId, fileId);
    if (!file) {
        showError('File not found');
        return;
    }

    // Remove .lua extension for prompt
    const currentName = file.name.replace(/\.lua$/, '');
    const newName = prompt('Enter new file name (without .lua):', currentName);

    if (newName && newName.trim() !== '' && newName !== currentName) {
        try {
            storage.projects.renameFile(projectId, fileId, newName.trim());
            showSuccess(`File renamed to "${newName}.lua"`);

            // Notify main app to update UI
            document.dispatchEvent(new CustomEvent('file:renamed', {
                detail: { projectId, fileId }
            }));
        } catch (error) {
            showError('Failed to rename file: ' + error.message);
        }
    }
}

function deleteFile(projectId, fileId) {
    const file = storage.projects.getFile(projectId, fileId);
    if (!file) {
        showError('File not found');
        return;
    }

    const project = storage.projects.getById(projectId);
    if (project && project.files.length === 1) {
        showError('Cannot delete the last file in a project');
        return;
    }

    const confirmed = confirm(`Delete file "${file.name}"?\n\nThis action cannot be undone.`);
    if (confirmed) {
        try {
            storage.projects.deleteFile(projectId, fileId);
            showSuccess(`File "${file.name}" deleted`);

            // Notify main app to update UI
            document.dispatchEvent(new CustomEvent('file:deleted', {
                detail: { projectId, fileId }
            }));
        } catch (error) {
            showError('Failed to delete file: ' + error.message);
        }
    }
}

function duplicateFile(projectId, fileId) {
    const file = storage.projects.getFile(projectId, fileId);
    if (!file) {
        showError('File not found');
        return;
    }

    try {
        const baseName = file.name.replace(/\.lua$/, '');
        const copyName = `${baseName}_copy`;

        const newFile = storage.projects.addFile(projectId, {
            name: copyName,
            content: file.content
        });

        showSuccess(`File duplicated as "${newFile.name}"`);

        // Notify main app to update UI
        document.dispatchEvent(new CustomEvent('file:created', {
            detail: { projectId, fileId: newFile.id }
        }));
    } catch (error) {
        showError('Failed to duplicate file: ' + error.message);
    }
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
