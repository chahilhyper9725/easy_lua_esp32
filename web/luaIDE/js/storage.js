// ═══════════════════════════════════════════════════════════
// Lua IDE - Storage Manager
// Complete localStorage implementation for IDE persistence
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// STORAGE KEYS (Constants)
// ═══════════════════════════════════════════════════════════

const KEYS = {
    SETTINGS: 'IDE_SETTINGS',
    PRODUCTS_INDEX: 'PRODUCTS_INDEX',
    PRODUCT_PREFIX: 'PRODUCT_',
    PROJECTS_INDEX: 'PROJECTS_INDEX',
    PROJECT_PREFIX: 'PROJECT_'
};

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

function getCurrentTimestamp() {
    return new Date().toISOString();
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
    if (!Array.isArray(project.files) || project.files.length === 0) return false;
    if (!project.createdAt || !project.modifiedAt) return false;

    // Validate all files
    for (const file of project.files) {
        if (!file.id || typeof file.id !== 'string') return false;
        if (!file.name || typeof file.name !== 'string' || !file.name.endsWith('.lua')) return false;
        if (typeof file.content !== 'string') return false;
        if (!file.createdAt || !file.modifiedAt) return false;
    }

    // Validate activeFileId
    if (project.activeFileId) {
        const fileExists = project.files.some(f => f.id === project.activeFileId);
        if (!fileExists) return false;
    }

    return true;
}

// ═══════════════════════════════════════════════════════════
// SETTINGS API
// ═══════════════════════════════════════════════════════════

const settings = {
    get() {
        const defaults = {
            version: "1.0.0",
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

        try {
            const stored = localStorage.getItem(KEYS.SETTINGS);
            return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
        } catch (error) {
            console.error('Error reading settings:', error);
            return defaults;
        }
    },

    set(newSettings) {
        try {
            localStorage.setItem(KEYS.SETTINGS, JSON.stringify(newSettings));
        } catch (error) {
            console.error('Error saving settings:', error);
            throw new Error('Failed to save settings');
        }
    },

    update(partial) {
        const current = this.get();
        this.set({ ...current, ...partial });
    }
};

// ═══════════════════════════════════════════════════════════
// PRODUCTS API
// ═══════════════════════════════════════════════════════════

const products = {
    // Get index array
    _getIndex() {
        try {
            const stored = localStorage.getItem(KEYS.PRODUCTS_INDEX);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error reading products index:', error);
            return [];
        }
    },

    // Save index array
    _saveIndex(index) {
        try {
            localStorage.setItem(KEYS.PRODUCTS_INDEX, JSON.stringify(index));
        } catch (error) {
            console.error('Error saving products index:', error);
            throw new Error('Failed to save products index');
        }
    },

    // Get all products
    getAll() {
        const index = this._getIndex();
        return index.map(id => this.getById(id)).filter(p => p !== null);
    },

    // Get by ID
    getById(id) {
        try {
            const stored = localStorage.getItem(KEYS.PRODUCT_PREFIX + id);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error(`Error reading product ${id}:`, error);
            return null;
        }
    },

    // Create new product
    create(productData) {
        const product = {
            id: productData.id || generateUUID(),
            name: productData.name,
            description: productData.description || '',
            createdAt: productData.createdAt || getCurrentTimestamp(),
            modifiedAt: productData.modifiedAt || getCurrentTimestamp(),
            autocomplete: productData.autocomplete || [],
            apiDocs: productData.apiDocs || '',
            isSystem: productData.isSystem || false
        };

        if (!validateProduct(product)) {
            throw new Error('Invalid product data');
        }

        try {
            // Save product
            localStorage.setItem(KEYS.PRODUCT_PREFIX + product.id, JSON.stringify(product));

            // Update index
            const index = this._getIndex();
            if (!index.includes(product.id)) {
                index.push(product.id);
                this._saveIndex(index);
            }

            return product;
        } catch (error) {
            console.error('Error creating product:', error);
            throw new Error('Failed to create product');
        }
    },

    // Update existing product
    update(id, updates) {
        const product = this.getById(id);
        if (!product) throw new Error('Product not found');

        const updated = {
            ...product,
            ...updates,
            id: product.id, // Don't allow ID change
            createdAt: product.createdAt, // Don't allow createdAt change
            modifiedAt: getCurrentTimestamp()
        };

        if (!validateProduct(updated)) {
            throw new Error('Invalid product data');
        }

        try {
            localStorage.setItem(KEYS.PRODUCT_PREFIX + id, JSON.stringify(updated));
            return updated;
        } catch (error) {
            console.error('Error updating product:', error);
            throw new Error('Failed to update product');
        }
    },

    // Delete product
    delete(id) {
        // Check if product is a system product
        const product = this.getById(id);
        if (product && product.isSystem) {
            throw new Error('Cannot delete system product. System products are built-in and protected.');
        }

        // Check if any project uses this product
        const projectsUsingProduct = projects.getAll()
            .filter(p => p.productId === id);

        if (projectsUsingProduct.length > 0) {
            throw new Error(`Cannot delete product: ${projectsUsingProduct.length} projects depend on it`);
        }

        try {
            // Remove from storage
            localStorage.removeItem(KEYS.PRODUCT_PREFIX + id);

            // Update index
            const index = this._getIndex().filter(pid => pid !== id);
            this._saveIndex(index);
        } catch (error) {
            console.error('Error deleting product:', error);
            throw new Error('Failed to delete product');
        }
    },

    // Export product as JSON
    export(id) {
        const product = this.getById(id);
        if (!product) throw new Error('Product not found');

        // Don't allow exporting system products
        if (product.isSystem) {
            throw new Error('Cannot export system product. System products are built-in and should not be exported.');
        }

        return JSON.stringify({
            type: 'LuaIDE_Product',
            version: '1.0.0',
            exportedAt: getCurrentTimestamp(),
            data: product
        }, null, 2);
    },

    // Import product from JSON
    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);

            // Validate format
            if (imported.type !== 'LuaIDE_Product') {
                throw new Error('Invalid product export format');
            }

            // Generate new ID to avoid conflicts
            const productData = {
                ...imported.data,
                id: undefined // Will be generated in create()
            };

            return this.create(productData);
        } catch (error) {
            console.error('Error importing product:', error);
            throw new Error('Failed to import product: ' + error.message);
        }
    }
};

// ═══════════════════════════════════════════════════════════
// PROJECTS API
// ═══════════════════════════════════════════════════════════

const projects = {
    // Get index array
    _getIndex() {
        try {
            const stored = localStorage.getItem(KEYS.PROJECTS_INDEX);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error reading projects index:', error);
            return [];
        }
    },

    // Save index array
    _saveIndex(index) {
        try {
            localStorage.setItem(KEYS.PROJECTS_INDEX, JSON.stringify(index));
        } catch (error) {
            console.error('Error saving projects index:', error);
            throw new Error('Failed to save projects index');
        }
    },

    // Get all projects
    getAll() {
        const index = this._getIndex();
        return index.map(id => this.getById(id)).filter(p => p !== null);
    },

    // Get by ID
    getById(id) {
        try {
            const stored = localStorage.getItem(KEYS.PROJECT_PREFIX + id);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error(`Error reading project ${id}:`, error);
            return null;
        }
    },

    // Create new project
    create(projectData) {
        // Ensure product exists
        if (projectData.productId) {
            const product = products.getById(projectData.productId);
            if (!product) {
                throw new Error('Product not found');
            }
        }

        const project = {
            id: projectData.id || generateUUID(),
            name: projectData.name,
            productId: projectData.productId,
            activeFileId: null,
            createdAt: projectData.createdAt || getCurrentTimestamp(),
            modifiedAt: projectData.modifiedAt || getCurrentTimestamp(),
            files: []
        };

        // Add files if provided
        if (projectData.files && Array.isArray(projectData.files)) {
            project.files = projectData.files.map(fileData => ({
                id: fileData.id || generateUUID(),
                name: fileData.name.endsWith('.lua') ? fileData.name : fileData.name + '.lua',
                content: fileData.content || '',
                createdAt: fileData.createdAt || getCurrentTimestamp(),
                modifiedAt: fileData.modifiedAt || getCurrentTimestamp()
            }));
        }

        // If no files, create a default main.lua
        if (project.files.length === 0) {
            project.files.push({
                id: generateUUID(),
                name: 'main.lua',
                content: '-- New Lua file\nprint("Hello World!")\n',
                createdAt: getCurrentTimestamp(),
                modifiedAt: getCurrentTimestamp()
            });
        }

        // Set active file to the first file or the provided activeFileId
        if (projectData.activeFileId && project.files.some(f => f.id === projectData.activeFileId)) {
            project.activeFileId = projectData.activeFileId;
        } else {
            project.activeFileId = project.files[0].id;
        }

        if (!validateProject(project)) {
            throw new Error('Invalid project data');
        }

        try {
            // Save project
            localStorage.setItem(KEYS.PROJECT_PREFIX + project.id, JSON.stringify(project));

            // Update index
            const index = this._getIndex();
            if (!index.includes(project.id)) {
                index.push(project.id);
                this._saveIndex(index);
            }

            return project;
        } catch (error) {
            console.error('Error creating project:', error);
            throw new Error('Failed to create project');
        }
    },

    // Update existing project
    update(id, updates) {
        const project = this.getById(id);
        if (!project) throw new Error('Project not found');

        const updated = {
            ...project,
            ...updates,
            id: project.id, // Don't allow ID change
            createdAt: project.createdAt, // Don't allow createdAt change
            modifiedAt: getCurrentTimestamp()
        };

        if (!validateProject(updated)) {
            throw new Error('Invalid project data');
        }

        try {
            localStorage.setItem(KEYS.PROJECT_PREFIX + id, JSON.stringify(updated));
            return updated;
        } catch (error) {
            console.error('Error updating project:', error);
            throw new Error('Failed to update project');
        }
    },

    // Delete project
    delete(id) {
        try {
            // Remove from storage
            localStorage.removeItem(KEYS.PROJECT_PREFIX + id);

            // Update index
            const index = this._getIndex().filter(pid => pid !== id);
            this._saveIndex(index);
        } catch (error) {
            console.error('Error deleting project:', error);
            throw new Error('Failed to delete project');
        }
    },

    // Export project as JSON
    export(id) {
        const project = this.getById(id);
        if (!project) throw new Error('Project not found');

        return JSON.stringify({
            type: 'LuaIDE_Project',
            version: '1.0.0',
            exportedAt: getCurrentTimestamp(),
            data: project
        }, null, 2);
    },

    // Import project from JSON
    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);

            // Validate format
            if (imported.type !== 'LuaIDE_Project') {
                throw new Error('Invalid project export format');
            }

            // Generate new ID to avoid conflicts
            const projectData = {
                ...imported.data,
                id: undefined // Will be generated in create()
            };

            return this.create(projectData);
        } catch (error) {
            console.error('Error importing project:', error);
            throw new Error('Failed to import project: ' + error.message);
        }
    },

    // ─────────────────────────────────────────────────────────────
    // FILE OPERATIONS
    // ─────────────────────────────────────────────────────────────

    addFile(projectId, fileData) {
        const project = this.getById(projectId);
        if (!project) throw new Error('Project not found');

        const file = {
            id: generateUUID(),
            name: fileData.name.endsWith('.lua') ? fileData.name : fileData.name + '.lua',
            content: fileData.content || '-- New Lua file\n',
            createdAt: getCurrentTimestamp(),
            modifiedAt: getCurrentTimestamp()
        };

        project.files.push(file);
        project.modifiedAt = getCurrentTimestamp();

        this.update(projectId, project);
        return file;
    },

    updateFile(projectId, fileId, content) {
        const project = this.getById(projectId);
        if (!project) throw new Error('Project not found');

        const file = project.files.find(f => f.id === fileId);
        if (!file) throw new Error('File not found');

        file.content = content;
        file.modifiedAt = getCurrentTimestamp();
        project.modifiedAt = getCurrentTimestamp();

        this.update(projectId, project);
    },

    renameFile(projectId, fileId, newName) {
        const project = this.getById(projectId);
        if (!project) throw new Error('Project not found');

        const file = project.files.find(f => f.id === fileId);
        if (!file) throw new Error('File not found');

        // Ensure .lua extension
        file.name = newName.endsWith('.lua') ? newName : newName + '.lua';
        file.modifiedAt = getCurrentTimestamp();
        project.modifiedAt = getCurrentTimestamp();

        this.update(projectId, project);
    },

    deleteFile(projectId, fileId) {
        const project = this.getById(projectId);
        if (!project) throw new Error('Project not found');

        // Don't allow deleting the last file
        if (project.files.length === 1) {
            throw new Error('Cannot delete the last file in a project');
        }

        // Remove file
        project.files = project.files.filter(f => f.id !== fileId);

        // If deleted file was active, switch to first file
        if (project.activeFileId === fileId) {
            project.activeFileId = project.files[0].id;
        }

        project.modifiedAt = getCurrentTimestamp();
        this.update(projectId, project);
    },

    setActiveFile(projectId, fileId) {
        const project = this.getById(projectId);
        if (!project) throw new Error('Project not found');

        const file = project.files.find(f => f.id === fileId);
        if (!file) throw new Error('File not found');

        project.activeFileId = fileId;
        this.update(projectId, project);
    },

    getFile(projectId, fileId) {
        const project = this.getById(projectId);
        if (!project) return null;

        return project.files.find(f => f.id === fileId) || null;
    }
};

// ═══════════════════════════════════════════════════════════
// BACKUP API
// ═══════════════════════════════════════════════════════════

const backup = {
    // Export all IDE data
    export() {
        const data = {
            type: 'LuaIDE_Backup',
            version: '1.0.0',
            exportedAt: getCurrentTimestamp(),
            data: {
                settings: settings.get(),
                products: products.getAll(),
                projects: projects.getAll()
            }
        };

        return JSON.stringify(data, null, 2);
    },

    // Import full backup
    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);

            // Validate format
            if (imported.type !== 'LuaIDE_Backup') {
                throw new Error('Invalid backup format');
            }

            // Clear existing data
            this.clear();

            // Import settings
            if (imported.data.settings) {
                settings.set(imported.data.settings);
            }

            // Import products
            if (imported.data.products) {
                imported.data.products.forEach(product => {
                    products.create(product);
                });
            }

            // Import projects
            if (imported.data.projects) {
                imported.data.projects.forEach(project => {
                    projects.create(project);
                });
            }
        } catch (error) {
            console.error('Error importing backup:', error);
            throw new Error('Failed to import backup: ' + error.message);
        }
    },

    // Clear all IDE data
    clear() {
        try {
            // Get all keys
            const productsIndex = products._getIndex();
            const projectsIndex = projects._getIndex();

            // Remove all products
            productsIndex.forEach(id => {
                localStorage.removeItem(KEYS.PRODUCT_PREFIX + id);
            });

            // Remove all projects
            projectsIndex.forEach(id => {
                localStorage.removeItem(KEYS.PROJECT_PREFIX + id);
            });

            // Remove indices and settings
            localStorage.removeItem(KEYS.PRODUCTS_INDEX);
            localStorage.removeItem(KEYS.PROJECTS_INDEX);
            localStorage.removeItem(KEYS.SETTINGS);
        } catch (error) {
            console.error('Error clearing data:', error);
            throw new Error('Failed to clear data');
        }
    }
};

// ═══════════════════════════════════════════════════════════
// EXPORT STORAGE API
// ═══════════════════════════════════════════════════════════

export const storage = {
    settings,
    products,
    projects,
    backup
};
