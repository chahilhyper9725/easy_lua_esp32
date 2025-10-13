# Storage Architecture - Implementation Details

## 🏗️ Storage Schema

### Key Naming Convention

```
IDE_SETTINGS              → Global settings
PRODUCTS_INDEX            → Array of product IDs
PRODUCT_{uuid}            → Individual product data
PROJECTS_INDEX            → Array of project IDs
PROJECT_{uuid}            → Individual project data
```

---

## 📊 Data Models

### Settings Model
```javascript
{
    version: "1.0.0",
    theme: "dark" | "light",
    fontSize: 12-20,
    lastActiveProjectId: "uuid" | null,
    lastActiveProductId: "uuid" | null,
    consoleSettings: {
        timestamp: boolean,
        autoClear: boolean,
        fontSize: 12-16
    },
    editorSettings: {
        minimap: boolean,
        lineNumbers: boolean,
        wordWrap: "on" | "off",
        tabSize: 2 | 4
    },
    layoutSettings: {
        sidebarWidth: 250,
        apiDocsWidth: 300,
        consoleHeight: 200
    }
}
```

### Product Model
```javascript
{
    id: "uuid-v4",
    name: "string (required, 1-50 chars)",
    description: "string (optional, max 500 chars)",
    createdAt: "ISO8601 datetime",
    modifiedAt: "ISO8601 datetime",
    autocomplete: [
        {
            label: "string (function/keyword name)",
            kind: "Function" | "Keyword" | "Constant" | "Variable",
            insertText: "string (with placeholders ${1:param})",
            documentation: "string (optional description)",
            detail: "string (optional signature)"
        }
    ],
    apiDocs: "string (markdown/html content)"
}
```

### Project Model
```javascript
{
    id: "uuid-v4",
    name: "string (required, 1-50 chars)",
    productId: "uuid (required, must exist)",
    activeFileId: "uuid (must be valid file ID in files array)",
    createdAt: "ISO8601 datetime",
    modifiedAt: "ISO8601 datetime",
    files: [
        {
            id: "uuid-v4",
            name: "string (required, must end with .lua)",
            content: "string (lua code)",
            createdAt: "ISO8601 datetime",
            modifiedAt: "ISO8601 datetime"
        }
    ]
}
```

---

## 🔧 Storage Manager Implementation

### storage.js Structure

```javascript
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

function generateUUID() { /* ... */ }
function getCurrentTimestamp() { /* ... */ }
function validateProduct(product) { /* ... */ }
function validateProject(project) { /* ... */ }

// ═══════════════════════════════════════════════════════════
// SETTINGS API
// ═══════════════════════════════════════════════════════════

const settings = {
    get() {
        const defaults = { /* default settings */ };
        const stored = localStorage.getItem(KEYS.SETTINGS);
        return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    },

    set(settings) {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
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
        const stored = localStorage.getItem(KEYS.PRODUCTS_INDEX);
        return stored ? JSON.parse(stored) : [];
    },

    // Save index array
    _saveIndex(index) {
        localStorage.setItem(KEYS.PRODUCTS_INDEX, JSON.stringify(index));
    },

    // Get all products
    getAll() {
        const index = this._getIndex();
        return index.map(id => this.getById(id)).filter(p => p !== null);
    },

    // Get by ID
    getById(id) {
        const stored = localStorage.getItem(KEYS.PRODUCT_PREFIX + id);
        return stored ? JSON.parse(stored) : null;
    },

    // Create new product
    create(productData) {
        const product = {
            id: generateUUID(),
            name: productData.name,
            description: productData.description || '',
            createdAt: getCurrentTimestamp(),
            modifiedAt: getCurrentTimestamp(),
            autocomplete: productData.autocomplete || [],
            apiDocs: productData.apiDocs || ''
        };

        if (!validateProduct(product)) {
            throw new Error('Invalid product data');
        }

        // Save product
        localStorage.setItem(KEYS.PRODUCT_PREFIX + product.id, JSON.stringify(product));

        // Update index
        const index = this._getIndex();
        index.push(product.id);
        this._saveIndex(index);

        return product;
    },

    // Update existing product
    update(id, updates) {
        const product = this.getById(id);
        if (!product) throw new Error('Product not found');

        const updated = {
            ...product,
            ...updates,
            id: product.id, // Don't allow ID change
            modifiedAt: getCurrentTimestamp()
        };

        if (!validateProduct(updated)) {
            throw new Error('Invalid product data');
        }

        localStorage.setItem(KEYS.PRODUCT_PREFIX + id, JSON.stringify(updated));
        return updated;
    },

    // Delete product
    delete(id) {
        // Check if any project uses this product
        const projectsUsingProduct = storage.projects.getAll()
            .filter(p => p.productId === id);

        if (projectsUsingProduct.length > 0) {
            throw new Error(`Cannot delete product: ${projectsUsingProduct.length} projects depend on it`);
        }

        // Remove from storage
        localStorage.removeItem(KEYS.PRODUCT_PREFIX + id);

        // Update index
        const index = this._getIndex().filter(pid => pid !== id);
        this._saveIndex(index);
    },

    // Export product as JSON
    export(id) {
        const product = this.getById(id);
        if (!product) throw new Error('Product not found');

        return JSON.stringify({
            type: 'LuaIDE_Product',
            version: '1.0.0',
            exportedAt: getCurrentTimestamp(),
            data: product
        }, null, 2);
    },

    // Import product from JSON
    import(jsonString) {
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
    }
};

// ═══════════════════════════════════════════════════════════
// PROJECTS API
// ═══════════════════════════════════════════════════════════

const projects = {
    // Similar structure to products...
    _getIndex() { /* ... */ },
    _saveIndex(index) { /* ... */ },
    getAll() { /* ... */ },
    getById(id) { /* ... */ },
    create(projectData) { /* ... */ },
    update(id, updates) { /* ... */ },
    delete(id) { /* ... */ },
    export(id) { /* ... */ },
    import(jsonString) { /* ... */ },

    // ─────────────────────────────────────────────────────────────
    // FILE OPERATIONS
    // ─────────────────────────────────────────────────────────────

    addFile(projectId, fileData) {
        const project = this.getById(projectId);
        if (!project) throw new Error('Project not found');

        const file = {
            id: generateUUID(),
            name: fileData.name.endsWith('.lua') ? fileData.name : fileData.name + '.lua',
            content: fileData.content || '',
            createdAt: getCurrentTimestamp(),
            modifiedAt: getCurrentTimestamp()
        };

        project.files.push(file);
        project.modifiedAt = getCurrentTimestamp();

        // If this is the first file, make it active
        if (!project.activeFileId) {
            project.activeFileId = file.id;
        }

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
    },

    // Clear all IDE data
    clear() {
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
```

---

## 🎯 Usage Examples

### Creating a Product
```javascript
const esp32 = storage.products.create({
    name: 'ESP32 Basic',
    description: 'Standard ESP32 with Arduino API',
    autocomplete: [
        {
            label: 'pinMode',
            kind: 'Function',
            insertText: 'pinMode(${1:pin}, ${2:mode})',
            documentation: 'Configure pin mode'
        }
    ],
    apiDocs: '# ESP32 API\n## GPIO Functions\n...'
});
```

### Creating a Project
```javascript
const project = storage.projects.create({
    name: 'LED Blink',
    productId: esp32.id,
    files: [
        {
            name: 'main.lua',
            content: 'print("Hello World")'
        }
    ]
});
```

### Adding File to Project
```javascript
storage.projects.addFile(project.id, {
    name: 'utils.lua',
    content: '-- Utility functions'
});
```

### Exporting Project
```javascript
const json = storage.projects.export(project.id);
// Download or share json string
```

### Full Backup
```javascript
const backup = storage.backup.export();
// Save to file for safekeeping
```

---

## 🔐 Validation Rules

### Product Validation
- ✅ name: required, 1-50 chars
- ✅ id: valid UUID v4
- ✅ autocomplete: array of valid completion items
- ✅ apiDocs: string

### Project Validation
- ✅ name: required, 1-50 chars
- ✅ productId: must reference existing product
- ✅ files: array with at least one file
- ✅ activeFileId: must be valid file ID
- ✅ Each file must have .lua extension

### File Validation
- ✅ name: required, must end with .lua
- ✅ content: string
- ✅ id: valid UUID v4

---

## 🚨 Error Handling

All functions throw descriptive errors:
- `Product not found`
- `Project not found`
- `File not found`
- `Invalid product data`
- `Cannot delete last file`
- `Cannot delete product: X projects depend on it`
- `Invalid export format`

---

## 📈 Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Only load active project/product
2. **Caching**: Keep active data in memory
3. **Indexed Access**: Use index arrays for fast lookup
4. **Batch Operations**: Update once after multiple changes
5. **Compression**: Consider LZ compression for large docs

### Memory Management
- Clear unused project data when switching
- Limit autocomplete suggestions to reasonable size
- Paginate file list if > 50 files

---

## 🔄 Migration Strategy

If storage schema changes in future versions:

```javascript
function migrateStorage(fromVersion, toVersion) {
    if (fromVersion === '1.0.0' && toVersion === '1.1.0') {
        // Apply migration steps
    }
}
```

Store version in settings to detect when migration needed.
