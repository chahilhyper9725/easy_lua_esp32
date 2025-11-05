// ═══════════════════════════════════════════════════════════
// Lua IDE - Import/Export Manager
// Handles project/product import and full IDE backup/restore
// Supports binary assets via ZIP format
// ═══════════════════════════════════════════════════════════

import { storage } from './storage.js';
import { showConfirmation } from './notification-manager.js';

// ═══════════════════════════════════════════════════════════
// JSZIP AVAILABILITY CHECK
// ═══════════════════════════════════════════════════════════

// Wait for JSZip to be loaded (loaded via script tag)
function ensureJSZip() {
    return new Promise((resolve, reject) => {
        // Check if JSZip is already available
        if (typeof window.JSZip !== 'undefined') {
            resolve(window.JSZip);
            return;
        }

        // Poll for JSZip availability (max 2 seconds for local file)
        let attempts = 0;
        const maxAttempts = 20;
        const interval = setInterval(() => {
            attempts++;

            if (typeof window.JSZip !== 'undefined') {
                clearInterval(interval);
                resolve(window.JSZip);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.error('✗ JSZip failed to load. Check that js/jszip.min.js exists.');
                reject(new Error('JSZip library failed to load. Check that js/jszip.min.js exists.'));
            }
        }, 100);
    });
}

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
// PROJECT EXPORT (ZIP Format with Binary Assets)
// ═══════════════════════════════════════════════════════════

export async function exportProject(projectId) {
    try {
        // Ensure JSZip is loaded
        const JSZip = await ensureJSZip();

        // Get project
        const project = await storage.projects.getById(projectId);
        if (!project) throw new Error('Project not found');

        // Get all files
        const files = await storage.files.getByProjectId(projectId);

        // Get all assets
        const assets = await storage.assets.getByProjectId(projectId);

        // Create ZIP
        const zip = new JSZip();

        // Create manifest
        const manifest = {
            type: 'LuaIDE_Project_v2',
            version: '2.0.0',
            exportedAt: new Date().toISOString(),
            project: {
                id: project.id,
                name: project.name,
                productId: project.productId,
                activeFileId: project.activeFileId,
                createdAt: project.createdAt,
                modifiedAt: project.modifiedAt
            },
            files: files.map(f => ({
                id: f.id,
                name: f.name,
                type: f.type,
                size: f.size,
                path: `files/${f.id}.lua`,
                createdAt: f.createdAt,
                modifiedAt: f.modifiedAt
            })),
            assets: assets.map(a => ({
                id: a.id,
                name: a.name,
                type: a.type,
                size: a.size,
                path: `assets/${a.id}`,
                createdAt: a.createdAt,
                modifiedAt: a.modifiedAt
            }))
        };

        // Add manifest.json
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        // Add all files
        const filesFolder = zip.folder('files');
        for (const file of files) {
            filesFolder.file(`${file.id}.lua`, file.content);
        }

        // Add all assets
        if (assets.length > 0) {
            const assetsFolder = zip.folder('assets');
            for (const assetInfo of assets) {
                const asset = await storage.assets.getById(assetInfo.id);
                if (asset && asset.data) {
                    assetsFolder.file(assetInfo.id, asset.data);
                }
            }
        }

        // Generate ZIP
        const blob = await zip.generateAsync({ type: 'blob' });

        // Download
        downloadFile(blob, `${project.name}.zip`, 'application/zip');

        return {
            success: true,
            message: `Project "${project.name}" exported with ${files.length} files and ${assets.length} assets`
        };

    } catch (error) {
        console.error('Export failed:', error);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════
// PROJECT IMPORT (from ZIP)
// ═══════════════════════════════════════════════════════════

export async function importProject(file) {
    return new Promise(async (resolve, reject) => {
        try {
            // Ensure JSZip is loaded
            const JSZip = await ensureJSZip();

            const zip = new JSZip();
            const zipData = await zip.loadAsync(file);

            // Read manifest
            const manifestFile = zipData.file('manifest.json');
            if (!manifestFile) {
                throw new Error('Invalid project export: manifest.json not found');
            }

            const manifest = JSON.parse(await manifestFile.async('text'));

            // Validate format
            if (manifest.type !== 'LuaIDE_Project_v2') {
                throw new Error('Invalid project export format. Expected v2 format.');
            }

            // Validate project data
            validateProject(manifest.project);

            // Check if product exists
            const product = await storage.products.getById(manifest.project.productId);
            if (!product) {
                throw new Error(`Product not found. Please import the product first.`);
            }

            // Check for duplicate project name
            const existingProjects = await storage.products.getAll();
            const duplicate = existingProjects.find(p => p.name === manifest.project.name);

            if (duplicate) {
                const confirmed = await showConfirmation({
                    title: 'Duplicate Project',
                    message: `Project "${manifest.project.name}" already exists. Import as "${manifest.project.name} (Copy)"?`,
                    confirmText: 'Import as Copy',
                    cancelText: 'Cancel',
                    type: 'warning'
                });
                if (confirmed) {
                    manifest.project.name = `${manifest.project.name} (Copy)`;
                } else {
                    reject(new Error('Import cancelled: duplicate project name'));
                    return;
                }
            }

            // Create project
            const project = await storage.projects.create({
                name: manifest.project.name,
                productId: manifest.project.productId
            });

            // Import files
            for (const fileInfo of manifest.files) {
                const fileData = await zipData.file(fileInfo.path).async('text');
                await storage.files.create({
                    projectId: project.id,
                    name: fileInfo.name,
                    content: fileData
                });
            }

            // Import assets
            for (const assetInfo of manifest.assets) {
                const assetBlob = await zipData.file(assetInfo.path).async('blob');
                await storage.assets.create({
                    projectId: project.id,
                    name: assetInfo.name,
                    type: assetInfo.type,
                    data: assetBlob
                });
            }

            resolve({
                success: true,
                project: project,
                message: `Project "${project.name}" imported with ${manifest.files.length} files and ${manifest.assets.length} assets`
            });

        } catch (error) {
            console.error('Import failed:', error);
            reject(error);
        }
    });
}

// ═══════════════════════════════════════════════════════════
// PRODUCT IMPORT/EXPORT (JSON format - no binary assets)
// ═══════════════════════════════════════════════════════════

export async function exportProduct(productId) {
    try {
        const product = await storage.products.getById(productId);
        if (!product) throw new Error('Product not found');

        if (product.isSystem) {
            throw new Error('Cannot export system products');
        }

        const exportData = {
            type: 'LuaIDE_Product',
            version: '2.0.0',
            exportedAt: new Date().toISOString(),
            data: product
        };

        const json = JSON.stringify(exportData, null, 2);
        downloadFile(json, `${product.name}.json`, 'application/json');

        return {
            success: true,
            message: `Product "${product.name}" exported successfully`
        };
    } catch (error) {
        console.error('Export failed:', error);
        throw error;
    }
}

export async function importProduct(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Validate product data
                if (!data.data) {
                    throw new Error('Invalid product export: missing data field');
                }

                validateProduct(data.data);

                // Check for duplicate product name
                const existingProducts = await storage.products.getAll();
                const duplicate = existingProducts.find(p => p.name === data.data.name);

                if (duplicate) {
                    const confirmed = await showConfirmation({
                        title: 'Duplicate Product',
                        message: `Product "${data.data.name}" already exists. Import as "${data.data.name} (Copy)"?`,
                        confirmText: 'Import as Copy',
                        cancelText: 'Cancel',
                        type: 'warning'
                    });
                    if (confirmed) {
                        data.data.name = `${data.data.name} (Copy)`;
                    } else {
                        reject(new Error('Import cancelled: duplicate product name'));
                        return;
                    }
                }

                // Import product (remove id to generate new one)
                const productData = {
                    ...data.data,
                    id: undefined,  // Will be generated
                    isSystem: false  // Imported products are never system products
                };

                const product = await storage.products.create(productData);

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
// FULL IDE BACKUP (ZIP Format)
// ═══════════════════════════════════════════════════════════

export async function createFullBackup() {
    try {
        // Ensure JSZip is loaded
        const JSZip = await ensureJSZip();

        const zip = new JSZip();

        // Get all data
        const allSettings = await storage.settings.get();
        const allProducts = await storage.products.getAll();
        const allProjects = await storage.projects.getAll();
        const allFiles = await storage.files.getAll();
        const allAssets = await storage.assets.getAll();

        // Create manifest
        const manifest = {
            type: 'LuaIDE_Backup_v2',
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            metadata: {
                productCount: allProducts.length,
                projectCount: allProjects.length,
                fileCount: allFiles.length,
                assetCount: allAssets.length
            }
        };

        // Add manifest and data files
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        zip.file('settings.json', JSON.stringify(allSettings, null, 2));
        zip.file('products.json', JSON.stringify(allProducts, null, 2));
        zip.file('projects.json', JSON.stringify(allProjects, null, 2));
        zip.file('files.json', JSON.stringify(allFiles, null, 2));

        // Create assets metadata file (without binary data)
        const assetsMetadata = allAssets.map(a => ({
            id: a.id,
            projectId: a.projectId,
            name: a.name,
            type: a.type,
            size: a.size,
            createdAt: a.createdAt,
            modifiedAt: a.modifiedAt
        }));
        zip.file('assets-metadata.json', JSON.stringify(assetsMetadata, null, 2));

        // Add binary assets
        if (allAssets.length > 0) {
            const assetsFolder = zip.folder('assets');
            for (const assetInfo of allAssets) {
                const asset = await storage.assets.getById(assetInfo.id);
                if (asset && asset.data) {
                    const extension = getExtensionFromMime(asset.type);
                    assetsFolder.file(`${asset.id}.${extension}`, asset.data);
                }
            }
        }

        // Generate ZIP
        const blob = await zip.generateAsync({ type: 'blob' });

        // Download
        const filename = `lua-ide-backup-${formatDateForFilename(new Date())}.zip`;
        downloadFile(blob, filename, 'application/zip');

        return {
            success: true,
            message: `Backup created: ${filename}`,
            stats: manifest.metadata
        };

    } catch (error) {
        console.error('Backup failed:', error);
        throw new Error('Failed to create backup: ' + error.message);
    }
}

// ═══════════════════════════════════════════════════════════
// FULL IDE RESTORE (from ZIP)
// ═══════════════════════════════════════════════════════════

export async function restoreFromBackup(file, mode = 'merge') {
    return new Promise(async (resolve, reject) => {
        try {
            // Ensure JSZip is loaded
            const JSZip = await ensureJSZip();

            const zip = new JSZip();
            const zipData = await zip.loadAsync(file);

            // Read manifest
            const manifestFile = zipData.file('manifest.json');
            if (!manifestFile) {
                throw new Error('Invalid backup: manifest.json not found');
            }

            const manifest = JSON.parse(await manifestFile.async('text'));

            // Validate backup
            validateBackup(manifest);

            // Show preview and confirm
            const stats = manifest.metadata;
            const confirmMessage = mode === 'replace'
                ? `This will DELETE all existing data and restore:\n• ${stats.productCount} products\n• ${stats.projectCount} projects\n• ${stats.fileCount} files\n• ${stats.assetCount} assets\n\nBackup date: ${new Date(manifest.timestamp).toLocaleString()}\n\nThis action CANNOT be undone!\n\nContinue?`
                : `This will add:\n• ${stats.productCount} products\n• ${stats.projectCount} projects\n• ${stats.fileCount} files\n• ${stats.assetCount} assets\n\nBackup date: ${new Date(manifest.timestamp).toLocaleString()}\n\nDuplicates will be skipped.\n\nContinue?`;

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
                filesAdded: 0,
                assetsAdded: 0,
                skipped: 0,
                errors: []
            };

            // Replace mode: clear all data first
            if (mode === 'replace') {
                // Delete the entire database and recreate it
                const dbName = 'LuaIDEDB';
                indexedDB.deleteDatabase(dbName);
                await storage.initDB();  // Recreate
                console.log('✓ All data cleared for restore');
            }

            // Read data files
            const settingsData = JSON.parse(await zipData.file('settings.json').async('text'));
            const productsData = JSON.parse(await zipData.file('products.json').async('text'));
            const projectsData = JSON.parse(await zipData.file('projects.json').async('text'));
            const filesData = JSON.parse(await zipData.file('files.json').async('text'));
            const assetsMetadata = JSON.parse(await zipData.file('assets-metadata.json').async('text'));

            // Restore settings
            if (settingsData) {
                await storage.settings.set(settingsData);
            }

            // Restore products
            for (const productData of productsData) {
                try {
                    // Check for duplicates in merge mode
                    if (mode === 'merge') {
                        const existing = await storage.products.getAll();
                        if (existing.find(p => p.name === productData.name)) {
                            results.skipped++;
                            continue;
                        }
                    }

                    await storage.products.create({
                        ...productData,
                        id: undefined  // Generate new ID
                    });
                    results.productsAdded++;
                } catch (error) {
                    results.errors.push(`Product "${productData.name}": ${error.message}`);
                }
            }

            // Restore projects (without files for now)
            const projectIdMap = {};  // Map old IDs to new IDs
            for (const projectData of projectsData) {
                try {
                    // Check for duplicates in merge mode
                    if (mode === 'merge') {
                        const existing = await storage.projects.getAll();
                        if (existing.find(p => p.name === projectData.name)) {
                            results.skipped++;
                            continue;
                        }
                    }

                    const newProject = await storage.projects.create({
                        name: projectData.name,
                        productId: projectData.productId,
                        files: []  // Will add files separately
                    });
                    projectIdMap[projectData.id] = newProject.id;
                    results.projectsAdded++;
                } catch (error) {
                    results.errors.push(`Project "${projectData.name}": ${error.message}`);
                }
            }

            // Restore files
            for (const fileData of filesData) {
                try {
                    const newProjectId = projectIdMap[fileData.projectId];
                    if (!newProjectId) continue;  // Project wasn't imported

                    await storage.files.create({
                        projectId: newProjectId,
                        name: fileData.name,
                        content: fileData.content
                    });
                    results.filesAdded++;
                } catch (error) {
                    results.errors.push(`File "${fileData.name}": ${error.message}`);
                }
            }

            // Restore assets (binary files)
            for (const assetMeta of assetsMetadata) {
                try {
                    const newProjectId = projectIdMap[assetMeta.projectId];
                    if (!newProjectId) continue;  // Project wasn't imported

                    const extension = getExtensionFromMime(assetMeta.type);
                    const assetPath = `assets/${assetMeta.id}.${extension}`;
                    const assetFile = zipData.file(assetPath);

                    if (assetFile) {
                        const assetBlob = await assetFile.async('blob');
                        await storage.assets.create({
                            projectId: newProjectId,
                            name: assetMeta.name,
                            type: assetMeta.type,
                            data: assetBlob
                        });
                        results.assetsAdded++;
                    }
                } catch (error) {
                    results.errors.push(`Asset "${assetMeta.name}": ${error.message}`);
                }
            }

            const message = mode === 'replace'
                ? `✓ Backup restored!\n\n• ${results.productsAdded} products\n• ${results.projectsAdded} projects\n• ${results.filesAdded} files\n• ${results.assetsAdded} assets\n\nPlease reload the page.`
                : `✓ Backup merged!\n\n• ${results.productsAdded} products added\n• ${results.projectsAdded} projects added\n• ${results.filesAdded} files added\n• ${results.assetsAdded} assets added\n• ${results.skipped} duplicates skipped\n\nPlease reload the page.`;

            resolve({
                success: true,
                message: message,
                results: results
            });

        } catch (error) {
            console.error('Restore failed:', error);
            reject(error);
        }
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
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function getExtensionFromMime(mimeType) {
    const mimeMap = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif',
        'image/svg+xml': 'svg',
        'font/woff': 'woff',
        'font/woff2': 'woff2',
        'font/ttf': 'ttf',
        'audio/wav': 'wav',
        'audio/mp3': 'mp3',
        'application/json': 'json',
        'application/octet-stream': 'bin'
    };

    return mimeMap[mimeType] || 'bin';
}

// Export product function for direct use
export { exportProduct as exportProductDirect };
