// ═══════════════════════════════════════════════════════════
// Lua IDE - IndexedDB Storage Manager
// Complete IndexedDB implementation with binary asset support
// ═══════════════════════════════════════════════════════════

const DB_NAME = 'LuaIDEDB';
const DB_VERSION = 1;

// Database instance (initialized once)
let dbInstance = null;

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function validateProduct(product) {
    if (!product.id || typeof product.id !== 'string') return false;
    if (!product.name || typeof product.name !== 'string' || product.name.length === 0 || product.name.length > 50) return false;
    if (!Array.isArray(product.autocomplete)) return false;
    if (typeof product.apiDocs !== 'string') return false;
    if (!product.createdAt || !product.modifiedAt) return false;
    return true;
}

function validateProject(project) {
    if (!project.id || typeof project.id !== 'string') return false;
    if (!project.name || typeof project.name !== 'string' || project.name.length === 0 || project.name.length > 50) return false;
    if (!project.productId || typeof project.productId !== 'string') return false;
    if (!project.createdAt || !project.modifiedAt) return false;
    return true;
}

function validateFile(file) {
    if (!file.id || typeof file.id !== 'string') return false;
    if (!file.projectId || typeof file.projectId !== 'string') return false;
    if (!file.name || typeof file.name !== 'string' || !file.name.endsWith('.lua')) return false;
    if (typeof file.content !== 'string') return false;
    if (!file.createdAt || !file.modifiedAt) return false;
    return true;
}

// ═══════════════════════════════════════════════════════════
// DATABASE INITIALIZATION
// ═══════════════════════════════════════════════════════════

async function initDB() {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            console.log('✓ IndexedDB initialized:', DB_NAME);
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            console.log('Upgrading database schema...');

            // Create object stores with indexes

            // Settings store (singleton)
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'id' });
                console.log('✓ Created settings store');
            }

            // Products store
            if (!db.objectStoreNames.contains('products')) {
                const productStore = db.createObjectStore('products', { keyPath: 'id' });
                productStore.createIndex('name', 'name', { unique: false });
                productStore.createIndex('isSystem', 'isSystem', { unique: false });
                console.log('✓ Created products store');
            }

            // Projects store
            if (!db.objectStoreNames.contains('projects')) {
                const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
                projectStore.createIndex('name', 'name', { unique: false });
                projectStore.createIndex('productId', 'productId', { unique: false });
                projectStore.createIndex('modifiedAt', 'modifiedAt', { unique: false });
                console.log('✓ Created projects store');
            }

            // Files store (NEW - normalized)
            if (!db.objectStoreNames.contains('files')) {
                const fileStore = db.createObjectStore('files', { keyPath: 'id' });
                fileStore.createIndex('projectId', 'projectId', { unique: false });
                fileStore.createIndex('name', 'name', { unique: false });
                fileStore.createIndex('projectId_name', ['projectId', 'name'], { unique: true });
                console.log('✓ Created files store');
            }

            // Assets store (NEW - binary files)
            if (!db.objectStoreNames.contains('assets')) {
                const assetStore = db.createObjectStore('assets', { keyPath: 'id' });
                assetStore.createIndex('projectId', 'projectId', { unique: false });
                assetStore.createIndex('type', 'type', { unique: false });
                assetStore.createIndex('name', 'name', { unique: false });
                console.log('✓ Created assets store');
            }
        };
    });
}

// ═══════════════════════════════════════════════════════════
// SETTINGS API (Singleton)
// ═══════════════════════════════════════════════════════════

const settings = {
    async get() {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('settings', 'readonly');
            const store = tx.objectStore('settings');
            const request = store.get(1);

            request.onsuccess = () => {
                const defaults = {
                    id: 1,
                    version: "2.0.0",
                    theme: "dark",
                    fontSize: 14,
                    lastActiveProjectId: null,
                    lastActiveProductId: null,
                    consoleSettings: {
                        timestamp: true,
                        autoClear: false,
                        fontSize: 13
                    },
                    editorSettings: {
                        minimap: true,
                        lineNumbers: true,
                        wordWrap: "off",
                        tabSize: 4
                    },
                    layoutSettings: {
                        sidebarWidth: 250,
                        apiDocsWidth: 300,
                        consoleHeight: 200
                    }
                };

                const stored = request.result;
                resolve(stored ? { ...defaults, ...stored } : defaults);
            };

            request.onerror = () => reject(request.error);
        });
    },

    async set(newSettings) {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');
            const request = store.put({ ...newSettings, id: 1 });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async update(partial) {
        const current = await this.get();
        await this.set({ ...current, ...partial });
    }
};

// ═══════════════════════════════════════════════════════════
// PRODUCTS API
// ═══════════════════════════════════════════════════════════

const products = {
    async getAll() {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('products', 'readonly');
            const store = tx.objectStore('products');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getById(id) {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('products', 'readonly');
            const store = tx.objectStore('products');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    async create(productData) {
        const db = await initDB();

        const product = {
            id: productData.id || generateUUID(),
            name: productData.name,
            description: productData.description || '',
            isSystem: productData.isSystem || false,
            autocomplete: productData.autocomplete || [],
            apiDocs: productData.apiDocs || '',
            createdAt: productData.createdAt || Date.now(),
            modifiedAt: productData.modifiedAt || Date.now()
        };

        if (!validateProduct(product)) {
            throw new Error('Invalid product data');
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction('products', 'readwrite');
            const store = tx.objectStore('products');
            const request = store.add(product);

            request.onsuccess = () => resolve(product);
            request.onerror = () => {
                console.error('Failed to create product:', request.error);
                reject(new Error('Failed to create product'));
            };
        });
    },

    async update(id, updates) {
        const db = await initDB();
        const product = await this.getById(id);
        if (!product) throw new Error('Product not found');

        const updated = {
            ...product,
            ...updates,
            id: product.id,
            createdAt: product.createdAt,
            modifiedAt: Date.now()
        };

        if (!validateProduct(updated)) {
            throw new Error('Invalid product data');
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction('products', 'readwrite');
            const store = tx.objectStore('products');
            const request = store.put(updated);

            request.onsuccess = () => resolve(updated);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(id) {
        const db = await initDB();

        // Check if product is system product
        const product = await this.getById(id);
        if (product?.isSystem) {
            throw new Error('Cannot delete system product');
        }

        // Check if any projects depend on this product
        const dependentProjects = await projects.getByProductId(id);
        if (dependentProjects.length > 0) {
            throw new Error(`Cannot delete product: ${dependentProjects.length} projects depend on it`);
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction('products', 'readwrite');
            const store = tx.objectStore('products');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

// ═══════════════════════════════════════════════════════════
// PROJECTS API
// ═══════════════════════════════════════════════════════════

const projects = {
    async getAll() {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getById(id) {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    async getByProductId(productId) {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const index = store.index('productId');
            const request = index.getAll(productId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async create(projectData) {
        const db = await initDB();

        // Validate product exists
        if (projectData.productId) {
            const product = await products.getById(projectData.productId);
            if (!product) throw new Error('Product not found');
        }

        const project = {
            id: projectData.id || generateUUID(),
            name: projectData.name,
            productId: projectData.productId,
            activeFileId: null,
            createdAt: projectData.createdAt || Date.now(),
            modifiedAt: projectData.modifiedAt || Date.now()
        };

        if (!validateProject(project)) {
            throw new Error('Invalid project data');
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction(['projects', 'files'], 'readwrite');
            const projectStore = tx.objectStore('projects');
            const fileStore = tx.objectStore('files');

            // Add project
            const addProjectRequest = projectStore.add(project);

            addProjectRequest.onsuccess = async () => {
                // Add files (if provided) or create default main.lua
                const filesToCreate = projectData.files && projectData.files.length > 0
                    ? projectData.files
                    : [{
                        name: 'main.lua',
                        content: '-- New Lua file\nprint("Hello World!")\n'
                    }];

                let firstFileId = null;
                let filesCreated = 0;

                for (const fileData of filesToCreate) {
                    const file = {
                        id: fileData.id || generateUUID(),
                        projectId: project.id,
                        name: fileData.name.endsWith('.lua') ? fileData.name : fileData.name + '.lua',
                        content: fileData.content || '',
                        type: 'text/x-lua',
                        size: (fileData.content || '').length,
                        createdAt: fileData.createdAt || Date.now(),
                        modifiedAt: fileData.modifiedAt || Date.now()
                    };

                    if (!firstFileId) firstFileId = file.id;

                    const addFileRequest = fileStore.add(file);
                    addFileRequest.onsuccess = () => {
                        filesCreated++;
                        if (filesCreated === filesToCreate.length) {
                            // All files added, update project with activeFileId
                            project.activeFileId = projectData.activeFileId || firstFileId;
                            const updateProjectRequest = projectStore.put(project);
                            updateProjectRequest.onsuccess = () => resolve(project);
                            updateProjectRequest.onerror = () => reject(updateProjectRequest.error);
                        }
                    };
                    addFileRequest.onerror = () => reject(addFileRequest.error);
                }
            };

            addProjectRequest.onerror = () => reject(addProjectRequest.error);
            tx.onerror = () => reject(tx.error);
        });
    },

    async update(id, updates) {
        const db = await initDB();
        const project = await this.getById(id);
        if (!project) throw new Error('Project not found');

        const updated = {
            ...project,
            ...updates,
            id: project.id,
            createdAt: project.createdAt,
            modifiedAt: Date.now()
        };

        if (!validateProject(updated)) {
            throw new Error('Invalid project data');
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            const request = store.put(updated);

            request.onsuccess = () => resolve(updated);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(id) {
        const db = await initDB();

        return new Promise(async (resolve, reject) => {
            try {
                // Get all files to delete
                const filesToDelete = await files.getByProjectId(id);

                // Get all assets to delete
                const assetsToDelete = await assets.getByProjectId(id);

                const tx = db.transaction(['projects', 'files', 'assets'], 'readwrite');
                const projectStore = tx.objectStore('projects');
                const fileStore = tx.objectStore('files');
                const assetStore = tx.objectStore('assets');

                // Delete project
                projectStore.delete(id);

                // Delete all files
                for (const file of filesToDelete) {
                    fileStore.delete(file.id);
                }

                // Delete all assets
                for (const asset of assetsToDelete) {
                    assetStore.delete(asset.id);
                }

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            } catch (error) {
                reject(error);
            }
        });
    },

    async setActiveFile(projectId, fileId) {
        const db = await initDB();
        const project = await this.getById(projectId);
        if (!project) throw new Error('Project not found');

        const file = await files.getById(fileId);
        if (!file || file.projectId !== projectId) {
            throw new Error('File not found in this project');
        }

        project.activeFileId = fileId;
        project.modifiedAt = Date.now();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            const request = store.put(project);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // Legacy compatibility - get file through project
    async getFile(projectId, fileId) {
        return await files.getById(fileId);
    },

    // Legacy compatibility - add file
    async addFile(projectId, fileData) {
        return await files.create({ ...fileData, projectId });
    },

    // Legacy compatibility - update file
    async updateFile(projectId, fileId, content) {
        return await files.update(fileId, { content });
    },

    // Legacy compatibility - rename file
    async renameFile(projectId, fileId, newName) {
        return await files.rename(fileId, newName);
    },

    // Legacy compatibility - delete file
    async deleteFile(projectId, fileId) {
        return await files.delete(fileId);
    }
};

// ═══════════════════════════════════════════════════════════
// FILES API (NEW - Normalized)
// ═══════════════════════════════════════════════════════════

const files = {
    async getAll() {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getById(id) {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    async getByProjectId(projectId) {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const index = store.index('projectId');
            const request = index.getAll(projectId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async create(fileData) {
        const db = await initDB();

        // Validate project exists
        const project = await projects.getById(fileData.projectId);
        if (!project) throw new Error('Project not found');

        const file = {
            id: fileData.id || generateUUID(),
            projectId: fileData.projectId,
            name: fileData.name.endsWith('.lua') ? fileData.name : fileData.name + '.lua',
            content: fileData.content || '-- New Lua file\n',
            type: 'text/x-lua',
            size: (fileData.content || '').length,
            createdAt: fileData.createdAt || Date.now(),
            modifiedAt: fileData.modifiedAt || Date.now()
        };

        if (!validateFile(file)) {
            throw new Error('Invalid file data');
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction(['files', 'projects'], 'readwrite');
            const fileStore = tx.objectStore('files');
            const projectStore = tx.objectStore('projects');

            const addFileRequest = fileStore.add(file);

            addFileRequest.onsuccess = () => {
                // Update project's modifiedAt
                project.modifiedAt = Date.now();
                const updateProjectRequest = projectStore.put(project);
                updateProjectRequest.onsuccess = () => resolve(file);
                updateProjectRequest.onerror = () => reject(updateProjectRequest.error);
            };

            addFileRequest.onerror = () => reject(addFileRequest.error);
        });
    },

    async update(id, updates) {
        const db = await initDB();
        const file = await this.getById(id);
        if (!file) throw new Error('File not found');

        const updated = {
            ...file,
            ...updates,
            id: file.id,
            projectId: file.projectId,
            createdAt: file.createdAt,
            modifiedAt: Date.now(),
            size: (updates.content !== undefined ? updates.content : file.content).length
        };

        if (!validateFile(updated)) {
            throw new Error('Invalid file data');
        }

        return new Promise(async (resolve, reject) => {
            try {
                const project = await projects.getById(file.projectId);

                const tx = db.transaction(['files', 'projects'], 'readwrite');
                const fileStore = tx.objectStore('files');
                const projectStore = tx.objectStore('projects');

                const updateFileRequest = fileStore.put(updated);

                updateFileRequest.onsuccess = () => {
                    if (project) {
                        project.modifiedAt = Date.now();
                        const updateProjectRequest = projectStore.put(project);
                        updateProjectRequest.onsuccess = () => resolve(updated);
                        updateProjectRequest.onerror = () => reject(updateProjectRequest.error);
                    } else {
                        resolve(updated);
                    }
                };

                updateFileRequest.onerror = () => reject(updateFileRequest.error);
            } catch (error) {
                reject(error);
            }
        });
    },

    async delete(id) {
        const db = await initDB();
        const file = await this.getById(id);
        if (!file) throw new Error('File not found');

        // Check if this is the last file in project
        const projectFiles = await this.getByProjectId(file.projectId);
        if (projectFiles.length === 1) {
            throw new Error('Cannot delete the last file in a project');
        }

        return new Promise(async (resolve, reject) => {
            try {
                const project = await projects.getById(file.projectId);

                const tx = db.transaction(['files', 'projects'], 'readwrite');
                const fileStore = tx.objectStore('files');
                const projectStore = tx.objectStore('projects');

                const deleteFileRequest = fileStore.delete(id);

                deleteFileRequest.onsuccess = () => {
                    if (project) {
                        // If deleted file was active, switch to first remaining file
                        if (project.activeFileId === id) {
                            const remainingFiles = projectFiles.filter(f => f.id !== id);
                            project.activeFileId = remainingFiles[0]?.id || null;
                        }
                        project.modifiedAt = Date.now();
                        const updateProjectRequest = projectStore.put(project);
                        updateProjectRequest.onsuccess = () => resolve();
                        updateProjectRequest.onerror = () => reject(updateProjectRequest.error);
                    } else {
                        resolve();
                    }
                };

                deleteFileRequest.onerror = () => reject(deleteFileRequest.error);
            } catch (error) {
                reject(error);
            }
        });
    },

    async rename(id, newName) {
        const file = await this.getById(id);
        if (!file) throw new Error('File not found');

        const updatedName = newName.endsWith('.lua') ? newName : newName + '.lua';
        return await this.update(id, { name: updatedName });
    }
};

// ═══════════════════════════════════════════════════════════
// ASSETS API (NEW - Binary Files)
// ═══════════════════════════════════════════════════════════

const assets = {
    async getAll() {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('assets', 'readonly');
            const store = tx.objectStore('assets');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getById(id) {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('assets', 'readonly');
            const store = tx.objectStore('assets');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    async getByProjectId(projectId) {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('assets', 'readonly');
            const store = tx.objectStore('assets');
            const index = store.index('projectId');
            const request = index.getAll(projectId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async create(assetData) {
        const db = await initDB();

        // Validate project exists
        const project = await projects.getById(assetData.projectId);
        if (!project) throw new Error('Project not found');

        const asset = {
            id: assetData.id || generateUUID(),
            projectId: assetData.projectId,
            name: assetData.name,
            type: assetData.type || 'application/octet-stream',
            data: assetData.data,  // Blob
            size: assetData.data.size,
            thumbnail: assetData.thumbnail || null,
            createdAt: assetData.createdAt || Date.now(),
            modifiedAt: assetData.modifiedAt || Date.now()
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction('assets', 'readwrite');
            const store = tx.objectStore('assets');
            const request = store.add(asset);

            request.onsuccess = () => resolve(asset);
            request.onerror = () => reject(request.error);
        });
    },

    async update(id, updates) {
        const db = await initDB();
        const asset = await this.getById(id);
        if (!asset) throw new Error('Asset not found');

        const updated = {
            ...asset,
            ...updates,
            id: asset.id,
            projectId: asset.projectId,
            createdAt: asset.createdAt,
            modifiedAt: Date.now(),
            size: updates.data ? updates.data.size : asset.size
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction('assets', 'readwrite');
            const store = tx.objectStore('assets');
            const request = store.put(updated);

            request.onsuccess = () => resolve(updated);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(id) {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction('assets', 'readwrite');
            const store = tx.objectStore('assets');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

// ═══════════════════════════════════════════════════════════
// EXPORT PUBLIC API
// ═══════════════════════════════════════════════════════════

export const storage = {
    initDB,
    settings,
    products,
    projects,
    files,
    assets
};
