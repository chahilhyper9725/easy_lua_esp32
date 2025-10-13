// ═══════════════════════════════════════════════════════════
// Lua IDE - Import/Export Manager
// Handles project/product import and full IDE backup/restore
// ═══════════════════════════════════════════════════════════

import { storage } from './storage.js';
import { showConfirmation } from './notification-manager.js';

// ═══════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════

function validateProject(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid project data: not an object');
    }

    if (!data.name || typeof data.name !== 'string') {
        throw new Error('Invalid project: missing or invalid name');
    }

    if (!data.productId || typeof data.productId !== 'string') {
        throw new Error('Invalid project: missing or invalid productId');
    }

    if (!Array.isArray(data.files)) {
        throw new Error('Invalid project: files must be an array');
    }

    // Validate each file
    data.files.forEach((file, index) => {
        if (!file.name || typeof file.name !== 'string') {
            throw new Error(`Invalid file at index ${index}: missing or invalid name`);
        }
        if (typeof file.content !== 'string') {
            throw new Error(`Invalid file at index ${index}: content must be a string`);
        }
    });

    return true;
}

function validateProduct(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid product data: not an object');
    }

    if (!data.name || typeof data.name !== 'string') {
        throw new Error('Invalid product: missing or invalid name');
    }

    if (!Array.isArray(data.autocomplete)) {
        throw new Error('Invalid product: autocomplete must be an array');
    }

    // Validate autocomplete items
    data.autocomplete.forEach((item, index) => {
        if (!item.label || typeof item.label !== 'string') {
            throw new Error(`Invalid autocomplete item at index ${index}: missing label`);
        }
        if (!item.kind || typeof item.kind !== 'string') {
            throw new Error(`Invalid autocomplete item at index ${index}: missing kind`);
        }
    });

    if (typeof data.apiDocs !== 'string') {
        throw new Error('Invalid product: apiDocs must be a string');
    }

    return true;
}

function validateBackup(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid backup data: not an object');
    }

    if (!data.version || typeof data.version !== 'string') {
        throw new Error('Invalid backup: missing version');
    }

    if (!data.timestamp || typeof data.timestamp !== 'string') {
        throw new Error('Invalid backup: missing timestamp');
    }

    if (!Array.isArray(data.products)) {
        throw new Error('Invalid backup: products must be an array');
    }

    if (!Array.isArray(data.projects)) {
        throw new Error('Invalid backup: projects must be an array');
    }

    if (!data.settings || typeof data.settings !== 'object') {
        throw new Error('Invalid backup: invalid settings');
    }

    return true;
}

// ═══════════════════════════════════════════════════════════
// PROJECT IMPORT
// ═══════════════════════════════════════════════════════════

export async function importProject(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Validate project data
                validateProject(data);

                // Check if product exists
                const product = storage.products.getById(data.productId);
                if (!product) {
                    throw new Error(`Product '${data.productId}' not found. Import the product first.`);
                }

                // Check for duplicate project name
                const existingProjects = storage.projects.getAll();
                const duplicate = existingProjects.find(p => p.name === data.name);

                if (duplicate) {
                    const confirmed = await showConfirmation({
                        title: 'Duplicate Project',
                        message: `Project "${data.name}" already exists. Import as "${data.name} (Copy)"?`,
                        confirmText: 'Import as Copy',
                        cancelText: 'Cancel',
                        type: 'warning'
                    });
                    if (confirmed) {
                        data.name = `${data.name} (Copy)`;
                    } else {
                        reject(new Error('Import cancelled: duplicate project name'));
                        return;
                    }
                }

                // Import project
                const project = storage.projects.create(data);

                resolve({
                    success: true,
                    project: project,
                    message: `Project "${project.name}" imported successfully!`
                });

            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

// ═══════════════════════════════════════════════════════════
// PRODUCT IMPORT
// ═══════════════════════════════════════════════════════════

export async function importProduct(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Validate product data
                validateProduct(data);

                // Check for duplicate product name
                const existingProducts = storage.products.getAll();
                const duplicate = existingProducts.find(p => p.name === data.name);

                if (duplicate) {
                    const confirmed = await showConfirmation({
                        title: 'Duplicate Product',
                        message: `Product "${data.name}" already exists. Import as "${data.name} (Copy)"?`,
                        confirmText: 'Import as Copy',
                        cancelText: 'Cancel',
                        type: 'warning'
                    });
                    if (confirmed) {
                        data.name = `${data.name} (Copy)`;
                    } else {
                        reject(new Error('Import cancelled: duplicate product name'));
                        return;
                    }
                }

                // Import product
                const product = storage.products.create(data);

                resolve({
                    success: true,
                    product: product,
                    message: `Product "${product.name}" imported successfully!`
                });

            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

// ═══════════════════════════════════════════════════════════
// FULL IDE BACKUP
// ═══════════════════════════════════════════════════════════

export function createFullBackup() {
    try {
        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),

            // Export all products
            products: storage.products.getAll(),

            // Export all projects
            projects: storage.projects.getAll(),

            // Export settings
            settings: storage.settings.get(),

            // Metadata
            metadata: {
                productCount: storage.products.getAll().length,
                projectCount: storage.projects.getAll().length,
                totalFiles: storage.projects.getAll().reduce((sum, p) => sum + p.files.length, 0)
            }
        };

        const json = JSON.stringify(backup, null, 2);
        const filename = `lua-ide-backup-${formatDateForFilename(new Date())}.json`;

        downloadFile(json, filename, 'application/json');

        return {
            success: true,
            message: `Backup created: ${filename}`,
            stats: backup.metadata
        };

    } catch (error) {
        throw new Error('Failed to create backup: ' + error.message);
    }
}

// ═══════════════════════════════════════════════════════════
// FULL IDE RESTORE
// ═══════════════════════════════════════════════════════════

export async function restoreFromBackup(file, mode = 'merge') {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const backup = JSON.parse(e.target.result);

                // Validate backup data
                validateBackup(backup);

                // Show preview and confirm
                const stats = backup.metadata;
                const confirmMessage = mode === 'replace'
                    ? `This will DELETE all existing data and restore:\n• ${stats.productCount} products\n• ${stats.projectCount} projects\n• ${stats.totalFiles} files\n\nBackup date: ${new Date(backup.timestamp).toLocaleString()}\n\nThis action CANNOT be undone!\n\nContinue?`
                    : `This will add:\n• ${stats.productCount} products\n• ${stats.projectCount} projects\n• ${stats.totalFiles} files\n\nBackup date: ${new Date(backup.timestamp).toLocaleString()}\n\nDuplicates will be skipped.\n\nContinue?`;

                const confirmed = await showConfirmation({
                    title: mode === 'replace' ? '⚠️ REPLACE ALL DATA?' : 'Merge Backup Data?',
                    message: confirmMessage,
                    confirmText: mode === 'replace' ? 'Replace All' : 'Merge',
                    cancelText: 'Cancel',
                    type: mode === 'replace' ? 'danger' : 'warning'
                });

                if (!confirmed) {
                    reject(new Error('Restore cancelled by user'));
                    return;
                }

                let results = {
                    productsAdded: 0,
                    projectsAdded: 0,
                    skipped: 0,
                    errors: []
                };

                // Replace mode: clear all data first
                if (mode === 'replace') {
                    localStorage.clear();
                    console.log('✓ All data cleared for restore');
                }

                // Restore products
                backup.products.forEach(productData => {
                    try {
                        // Check for duplicates in merge mode
                        if (mode === 'merge') {
                            const existing = storage.products.getAll().find(p => p.name === productData.name);
                            if (existing) {
                                results.skipped++;
                                return;
                            }
                        }

                        storage.products.create(productData);
                        results.productsAdded++;
                    } catch (error) {
                        results.errors.push(`Product "${productData.name}": ${error.message}`);
                    }
                });

                // Restore projects
                backup.projects.forEach(projectData => {
                    try {
                        // Check for duplicates in merge mode
                        if (mode === 'merge') {
                            const existing = storage.projects.getAll().find(p => p.name === projectData.name);
                            if (existing) {
                                results.skipped++;
                                return;
                            }
                        }

                        storage.projects.create(projectData);
                        results.projectsAdded++;
                    } catch (error) {
                        results.errors.push(`Project "${projectData.name}": ${error.message}`);
                    }
                });

                // Restore settings
                if (backup.settings) {
                    storage.settings.set(backup.settings);
                }

                const message = mode === 'replace'
                    ? `✓ Backup restored!\n\n• ${results.productsAdded} products\n• ${results.projectsAdded} projects\n\nPlease reload the page.`
                    : `✓ Backup merged!\n\n• ${results.productsAdded} products added\n• ${results.projectsAdded} projects added\n• ${results.skipped} duplicates skipped\n\nPlease reload the page.`;

                resolve({
                    success: true,
                    message: message,
                    results: results
                });

            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read backup file'));
        };

        reader.readAsText(file);
    });
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function formatDateForFilename(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}-${hours}${minutes}`;
}

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
