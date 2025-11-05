# IndexedDB Migration Plan - Complete Architecture Redesign

## 🎯 **Migration Goals**

### Why IndexedDB?
1. **Storage Capacity**: 500MB+ (vs localStorage's 5MB)
2. **Binary Support**: Store images, fonts, compiled assets natively
3. **Performance**: Async API + indexing for fast queries
4. **Transactions**: ACID guarantees for data integrity
5. **Schema Evolution**: Built-in versioning system
6. **Better Architecture**: Normalized data structure

### What Changes
- ✅ Complete storage.js rewrite
- ✅ Async/await API throughout
- ✅ Normalized data (files separate from projects)
- ✅ Binary asset support (images, fonts, etc.)
- ✅ Transaction support for atomic operations
- ✅ Indexed queries for performance
- ✅ Export/import with ZIP format for binaries
- ❌ NO backward compatibility (fresh start)

---

## 📊 **Database Schema**

### Database Name: `LuaIDEDB`
### Version: 1

### Object Stores (Tables):

#### 1. **`settings`** (Singleton)
```javascript
{
  id: 1,  // Always 1 (single settings object)
  version: "2.0.0",
  theme: "dark",
  fontSize: 14,
  lastActiveProjectId: "uuid",
  lastActiveProductId: "uuid",
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
}
```
**Indexes**: None (singleton)

---

#### 2. **`products`**
```javascript
{
  id: "uuid",  // Primary key (keyPath)
  name: "ESP32 Basic",
  description: "Standard ESP32...",
  isSystem: true,
  autocomplete: [
    {
      label: "pinMode",
      kind: "Function",
      insertText: "pinMode(${1:pin}, ${2:mode})",
      documentation: "Configure pin mode",
      detail: "pinMode(pin: number, mode: number)"
    },
    // ... more items
  ],
  apiDocs: "# ESP32 API\n\n...",  // Markdown string
  createdAt: 1697654321000,  // Unix timestamp
  modifiedAt: 1697654321000
}
```
**Indexes**:
- `id` (primary key, unique)
- `name` (unique index for fast lookup)
- `isSystem` (for filtering system products)

---

#### 3. **`projects`**
```javascript
{
  id: "uuid",  // Primary key
  name: "LED Blink",
  productId: "uuid",  // Foreign key to products
  activeFileId: "uuid",  // Foreign key to files
  createdAt: 1697654321000,
  modifiedAt: 1697654321000
  // NOTE: files[] array REMOVED - files stored separately
}
```
**Indexes**:
- `id` (primary key, unique)
- `name` (for fast name lookup)
- `productId` (for querying projects by product)
- `modifiedAt` (for sorting by recent)

---

#### 4. **`files`** (NEW - Normalized)
```javascript
{
  id: "uuid",  // Primary key
  projectId: "uuid",  // Foreign key to projects
  name: "main.lua",
  content: "-- Lua code here\nprint('Hello')",
  type: "text/x-lua",  // MIME type
  size: 1024,  // Bytes (calculated from content)
  createdAt: 1697654321000,
  modifiedAt: 1697654321000
}
```
**Indexes**:
- `id` (primary key, unique)
- `projectId` (for getting all files in project)
- `name` (for searching files by name)
- `[projectId, name]` (compound index for unique file names per project)

**Benefits of Separate Files Store**:
- ✅ Don't load entire project to access one file
- ✅ Fast file operations (update one file without touching project)
- ✅ Better for large files (streaming, chunking)
- ✅ Can index/search files independently
- ✅ Easier to implement file sharing between projects (future)

---

#### 5. **`assets`** (NEW - Binary Files)
```javascript
{
  id: "uuid",  // Primary key
  projectId: "uuid",  // Foreign key to projects
  name: "logo.png",
  type: "image/png",  // MIME type
  data: Blob,  // Binary data (native Blob object)
  size: 10240,  // Bytes
  thumbnail: Blob,  // Optional thumbnail for images
  createdAt: 1697654321000,
  modifiedAt: 1697654321000
}
```
**Indexes**:
- `id` (primary key, unique)
- `projectId` (for getting all assets in project)
- `type` (for filtering by asset type)
- `name` (for searching)

**Supported Asset Types**:
- Images: `image/png`, `image/jpeg`, `image/svg+xml`, `image/gif`
- Fonts: `font/woff`, `font/woff2`, `font/ttf`
- Audio: `audio/wav`, `audio/mp3` (for sound effects)
- Data: `application/json` (for config files)
- Binary: `application/octet-stream` (for compiled assets)

---

## 🏗️ **Storage API Architecture**

### Wrapper Library Choice: **`idb`** by Jake Archibald
- Small (1.5KB gzipped)
- Promise-based
- Clean async/await syntax
- Well-tested
- CDN: `https://cdn.jsdelivr.net/npm/idb@7/build/index.js`

### API Structure

```javascript
// storage.js - New IndexedDB Implementation

import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/build/index.js';

const DB_NAME = 'LuaIDEDB';
const DB_VERSION = 1;

// Database instance (initialized once)
let db = null;

// ═══════════════════════════════════════════════════════════
// DATABASE INITIALIZATION
// ═══════════════════════════════════════════════════════════

async function initDB() {
  if (db) return db;

  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Create object stores with indexes

      // Settings store (singleton)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('name', 'name', { unique: true });
        productStore.createIndex('isSystem', 'isSystem');
      }

      // Projects store
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('name', 'name');
        projectStore.createIndex('productId', 'productId');
        projectStore.createIndex('modifiedAt', 'modifiedAt');
      }

      // Files store (NEW - normalized)
      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id' });
        fileStore.createIndex('projectId', 'projectId');
        fileStore.createIndex('name', 'name');
        fileStore.createIndex('projectId_name', ['projectId', 'name'], { unique: true });
      }

      // Assets store (NEW - binary files)
      if (!db.objectStoreNames.contains('assets')) {
        const assetStore = db.createObjectStore('assets', { keyPath: 'id' });
        assetStore.createIndex('projectId', 'projectId');
        assetStore.createIndex('type', 'type');
        assetStore.createIndex('name', 'name');
      }
    }
  });

  return db;
}

// ═══════════════════════════════════════════════════════════
// SETTINGS API (Singleton)
// ═══════════════════════════════════════════════════════════

const settings = {
  async get() {
    const db = await initDB();
    const stored = await db.get('settings', 1);

    // Default settings
    const defaults = {
      id: 1,
      version: "2.0.0",
      theme: "dark",
      fontSize: 14,
      lastActiveProjectId: null,
      lastActiveProductId: null,
      consoleSettings: { timestamp: true, autoClear: false, fontSize: 13 },
      editorSettings: { minimap: true, lineNumbers: true, wordWrap: "off", tabSize: 4 },
      layoutSettings: { sidebarWidth: 250, apiDocsWidth: 300, consoleHeight: 200 }
    };

    return stored ? { ...defaults, ...stored } : defaults;
  },

  async set(newSettings) {
    const db = await initDB();
    await db.put('settings', { ...newSettings, id: 1 });
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
    return await db.getAll('products');
  },

  async getById(id) {
    const db = await initDB();
    return await db.get('products', id);
  },

  async getByName(name) {
    const db = await initDB();
    return await db.getFromIndex('products', 'name', name);
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

    // Validate
    if (!validateProduct(product)) {
      throw new Error('Invalid product data');
    }

    await db.add('products', product);
    return product;
  },

  async update(id, updates) {
    const db = await initDB();
    const product = await db.get('products', id);
    if (!product) throw new Error('Product not found');

    const updated = {
      ...product,
      ...updates,
      id: product.id,  // Prevent ID change
      createdAt: product.createdAt,  // Prevent createdAt change
      modifiedAt: Date.now()
    };

    if (!validateProduct(updated)) {
      throw new Error('Invalid product data');
    }

    await db.put('products', updated);
    return updated;
  },

  async delete(id) {
    const db = await initDB();

    // Check if product is system product
    const product = await db.get('products', id);
    if (product?.isSystem) {
      throw new Error('Cannot delete system product');
    }

    // Check if any projects depend on this product
    const projectsIndex = db.transaction('projects').objectStore('projects').index('productId');
    const dependentProjects = await projectsIndex.getAll(id);

    if (dependentProjects.length > 0) {
      throw new Error(`Cannot delete product: ${dependentProjects.length} projects depend on it`);
    }

    await db.delete('products', id);
  }
};

// ═══════════════════════════════════════════════════════════
// PROJECTS API
// ═══════════════════════════════════════════════════════════

const projects = {
  async getAll() {
    const db = await initDB();
    return await db.getAll('projects');
  },

  async getById(id) {
    const db = await initDB();
    return await db.get('projects', id);
  },

  async getByProductId(productId) {
    const db = await initDB();
    return await db.getAllFromIndex('projects', 'productId', productId);
  },

  async create(projectData) {
    const db = await initDB();

    // Validate product exists
    if (projectData.productId) {
      const product = await db.get('products', projectData.productId);
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

    // Use transaction to create project + files atomically
    const tx = db.transaction(['projects', 'files'], 'readwrite');

    // Add project
    await tx.objectStore('projects').add(project);

    // Add files (if provided) or create default main.lua
    const filesToCreate = projectData.files && projectData.files.length > 0
      ? projectData.files
      : [{
          name: 'main.lua',
          content: '-- New Lua file\nprint("Hello World!")\n'
        }];

    let firstFileId = null;
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
      await tx.objectStore('files').add(file);
    }

    // Set active file
    project.activeFileId = projectData.activeFileId || firstFileId;
    await tx.objectStore('projects').put(project);

    await tx.done;

    return project;
  },

  async update(id, updates) {
    const db = await initDB();
    const project = await db.get('projects', id);
    if (!project) throw new Error('Project not found');

    const updated = {
      ...project,
      ...updates,
      id: project.id,
      createdAt: project.createdAt,
      modifiedAt: Date.now()
    };

    await db.put('projects', updated);
    return updated;
  },

  async delete(id) {
    const db = await initDB();

    // Use transaction to delete project + all files + all assets
    const tx = db.transaction(['projects', 'files', 'assets'], 'readwrite');

    // Delete project
    await tx.objectStore('projects').delete(id);

    // Delete all files
    const filesIndex = tx.objectStore('files').index('projectId');
    const files = await filesIndex.getAll(id);
    for (const file of files) {
      await tx.objectStore('files').delete(file.id);
    }

    // Delete all assets
    const assetsIndex = tx.objectStore('assets').index('projectId');
    const assets = await assetsIndex.getAll(id);
    for (const asset of assets) {
      await tx.objectStore('assets').delete(asset.id);
    }

    await tx.done;
  },

  async setActiveFile(projectId, fileId) {
    const db = await initDB();
    const project = await db.get('projects', projectId);
    if (!project) throw new Error('Project not found');

    const file = await db.get('files', fileId);
    if (!file || file.projectId !== projectId) {
      throw new Error('File not found in this project');
    }

    project.activeFileId = fileId;
    project.modifiedAt = Date.now();
    await db.put('projects', project);
  }
};

// ═══════════════════════════════════════════════════════════
// FILES API (NEW - Normalized)
// ═══════════════════════════════════════════════════════════

const files = {
  async getAll() {
    const db = await initDB();
    return await db.getAll('files');
  },

  async getById(id) {
    const db = await initDB();
    return await db.get('files', id);
  },

  async getByProjectId(projectId) {
    const db = await initDB();
    return await db.getAllFromIndex('files', 'projectId', projectId);
  },

  async create(fileData) {
    const db = await initDB();

    // Validate project exists
    const project = await db.get('projects', fileData.projectId);
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

    await db.add('files', file);

    // Update project's modifiedAt
    project.modifiedAt = Date.now();
    await db.put('projects', project);

    return file;
  },

  async update(id, updates) {
    const db = await initDB();
    const file = await db.get('files', id);
    if (!file) throw new Error('File not found');

    const updated = {
      ...file,
      ...updates,
      id: file.id,
      projectId: file.projectId,  // Prevent moving files between projects
      createdAt: file.createdAt,
      modifiedAt: Date.now(),
      size: (updates.content || file.content).length
    };

    // Use transaction to update file + project
    const tx = db.transaction(['files', 'projects'], 'readwrite');
    await tx.objectStore('files').put(updated);

    const project = await tx.objectStore('projects').get(file.projectId);
    if (project) {
      project.modifiedAt = Date.now();
      await tx.objectStore('projects').put(project);
    }

    await tx.done;

    return updated;
  },

  async delete(id) {
    const db = await initDB();
    const file = await db.get('files', id);
    if (!file) throw new Error('File not found');

    // Check if this is the last file in project
    const projectFiles = await db.getAllFromIndex('files', 'projectId', file.projectId);
    if (projectFiles.length === 1) {
      throw new Error('Cannot delete the last file in a project');
    }

    // Use transaction
    const tx = db.transaction(['files', 'projects'], 'readwrite');
    await tx.objectStore('files').delete(id);

    // Update project
    const project = await tx.objectStore('projects').get(file.projectId);
    if (project) {
      // If deleted file was active, switch to first remaining file
      if (project.activeFileId === id) {
        const remainingFiles = projectFiles.filter(f => f.id !== id);
        project.activeFileId = remainingFiles[0]?.id || null;
      }
      project.modifiedAt = Date.now();
      await tx.objectStore('projects').put(project);
    }

    await tx.done;
  },

  async rename(id, newName) {
    const db = await initDB();
    const file = await db.get('files', id);
    if (!file) throw new Error('File not found');

    file.name = newName.endsWith('.lua') ? newName : newName + '.lua';
    file.modifiedAt = Date.now();

    await db.put('files', file);
    return file;
  }
};

// ═══════════════════════════════════════════════════════════
// ASSETS API (NEW - Binary Files)
// ═══════════════════════════════════════════════════════════

const assets = {
  async getAll() {
    const db = await initDB();
    return await db.getAll('assets');
  },

  async getById(id) {
    const db = await initDB();
    return await db.get('assets', id);
  },

  async getByProjectId(projectId) {
    const db = await initDB();
    return await db.getAllFromIndex('assets', 'projectId', projectId);
  },

  async create(assetData) {
    const db = await initDB();

    // Validate project exists
    const project = await db.get('projects', assetData.projectId);
    if (!project) throw new Error('Project not found');

    const asset = {
      id: assetData.id || generateUUID(),
      projectId: assetData.projectId,
      name: assetData.name,
      type: assetData.type || 'application/octet-stream',
      data: assetData.data,  // Blob
      size: assetData.data.size,
      thumbnail: assetData.thumbnail || null,  // Optional
      createdAt: assetData.createdAt || Date.now(),
      modifiedAt: assetData.modifiedAt || Date.now()
    };

    await db.add('assets', asset);
    return asset;
  },

  async update(id, updates) {
    const db = await initDB();
    const asset = await db.get('assets', id);
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

    await db.put('assets', updated);
    return updated;
  },

  async delete(id) {
    const db = await initDB();
    await db.delete('assets', id);
  }
};

// ═══════════════════════════════════════════════════════════
// TRANSACTION API (for complex atomic operations)
// ═══════════════════════════════════════════════════════════

async function transaction(callback) {
  const db = await initDB();

  // Provide a wrapper with all APIs for transaction context
  const txWrapper = {
    products,
    projects,
    files,
    assets,
    settings
  };

  return await callback(txWrapper);
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function validateProduct(product) {
  if (!product.id || !product.name) return false;
  if (!Array.isArray(product.autocomplete)) return false;
  if (typeof product.apiDocs !== 'string') return false;
  return true;
}

// ═══════════════════════════════════════════════════════════
// EXPORT PUBLIC API
// ═══════════════════════════════════════════════════════════

export const storage = {
  initDB,
  settings,
  products,
  projects,
  files,
  assets,
  transaction
};
```

---

## 📦 **Export/Import with Binary Support**

### Export Format: **ZIP with JSON Manifest**

```javascript
// import-export.js - New Implementation

import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js';
import { storage } from './storage.js';

// ═══════════════════════════════════════════════════════════
// PROJECT EXPORT (with assets)
// ═══════════════════════════════════════════════════════════

export async function exportProject(projectId) {
  const zip = new JSZip();

  // Get project
  const project = await storage.projects.getById(projectId);
  if (!project) throw new Error('Project not found');

  // Get all files
  const files = await storage.files.getByProjectId(projectId);

  // Get all assets
  const assets = await storage.assets.getByProjectId(projectId);

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
      path: `files/${f.id}.lua`,  // Path in ZIP
      createdAt: f.createdAt,
      modifiedAt: f.modifiedAt
    })),
    assets: assets.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      size: a.size,
      path: `assets/${a.id}`,  // Path in ZIP
      createdAt: a.createdAt,
      modifiedAt: a.modifiedAt
    }))
  };

  // Add manifest.json
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Add all files
  for (const file of files) {
    zip.file(`files/${file.id}.lua`, file.content);
  }

  // Add all assets
  for (const asset of assets) {
    const assetData = await storage.assets.getById(asset.id);
    zip.file(`assets/${asset.id}`, assetData.data);  // Blob
  }

  // Generate ZIP
  const blob = await zip.generateAsync({ type: 'blob' });

  // Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name}.zip`;
  a.click();
  URL.revokeObjectURL(url);

  return {
    success: true,
    message: `Project "${project.name}" exported with ${files.length} files and ${assets.length} assets`
  };
}

// ═══════════════════════════════════════════════════════════
// PROJECT IMPORT (from ZIP)
// ═══════════════════════════════════════════════════════════

export async function importProject(file) {
  const zip = new JSZip();
  const zipData = await zip.loadAsync(file);

  // Read manifest
  const manifestFile = zipData.file('manifest.json');
  if (!manifestFile) throw new Error('Invalid project export: manifest.json not found');

  const manifest = JSON.parse(await manifestFile.async('text'));

  // Validate format
  if (manifest.type !== 'LuaIDE_Project_v2') {
    throw new Error('Invalid project export format');
  }

  // Check if product exists
  const product = await storage.products.getById(manifest.project.productId);
  if (!product) {
    throw new Error(`Product not found. Import product first.`);
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

  return {
    success: true,
    project,
    message: `Project "${project.name}" imported with ${manifest.files.length} files and ${manifest.assets.length} assets`
  };
}

// ═══════════════════════════════════════════════════════════
// FULL IDE BACKUP
// ═══════════════════════════════════════════════════════════

export async function createFullBackup() {
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

  // Add data
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('settings.json', JSON.stringify(allSettings, null, 2));
  zip.file('products.json', JSON.stringify(allProducts, null, 2));
  zip.file('projects.json', JSON.stringify(allProjects, null, 2));
  zip.file('files.json', JSON.stringify(allFiles, null, 2));

  // Add assets
  const assetsFolder = zip.folder('assets');
  for (const asset of allAssets) {
    const assetData = await storage.assets.getById(asset.id);
    assetsFolder.file(`${asset.id}.${getExtensionFromMime(asset.type)}`, assetData.data);
  }

  // Generate ZIP
  const blob = await zip.generateAsync({ type: 'blob' });

  // Download
  const filename = `lua-ide-backup-${formatDateForFilename(new Date())}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return {
    success: true,
    message: `Backup created: ${filename}`,
    stats: manifest.metadata
  };
}
```

---

## 🔄 **Migration Checklist**

### Phase 1: Core Infrastructure ✅
- [ ] Add `idb` library to index.html
- [ ] Add `jszip` library to index.html
- [ ] Create new `storage-v2.js` with IndexedDB
- [ ] Test database initialization
- [ ] Test CRUD operations for all stores

### Phase 2: Update Application Layer ✅
- [ ] Update `app.js` - add `await` to all storage calls
- [ ] Update `editor-manager.js` - use `storage.files` API
- [ ] Update `import-export.js` - ZIP-based export/import
- [ ] Update all other modules with `async/await`

### Phase 3: New Features ✅
- [ ] Asset upload UI (drag-and-drop images)
- [ ] Asset manager panel
- [ ] Image preview in file explorer
- [ ] File size indicators

### Phase 4: Testing ✅
- [ ] Test project create/delete
- [ ] Test file operations
- [ ] Test asset upload/download
- [ ] Test export/import with assets
- [ ] Test full backup/restore
- [ ] Test concurrent operations (transactions)

### Phase 5: Cleanup ✅
- [ ] Remove old `storage.js`
- [ ] Rename `storage-v2.js` to `storage.js`
- [ ] Update documentation

---

## 📈 **Performance Improvements**

### Query Performance
```javascript
// OLD (localStorage): O(n) - load ALL projects
const projects = storage.projects.getAll();
const espProjects = projects.filter(p => p.productId === 'esp32');

// NEW (IndexedDB): O(log n) - indexed query
const espProjects = await storage.projects.getByProductId('esp32');
```

### File Operations
```javascript
// OLD: Load entire project to update one file
const project = storage.projects.getById(projectId);
const file = project.files.find(f => f.id === fileId);
file.content = newContent;
storage.projects.update(projectId, project);

// NEW: Update file directly
await storage.files.update(fileId, { content: newContent });
```

### Binary Assets
```javascript
// OLD: Base64 encode (33% larger, slow)
const image = base64Encode(imageBlob);
localStorage.setItem('image', image);

// NEW: Native Blob storage (no encoding)
await storage.assets.create({
  projectId: 'xxx',
  name: 'logo.png',
  type: 'image/png',
  data: imageBlob  // Direct Blob storage
});
```

---

## 🎯 **Next Steps**

1. **Review this plan** - confirm architecture decisions
2. **Create `storage-v2.js`** - implement new IndexedDB API
3. **Update `import-export.js`** - ZIP-based exports
4. **Update all modules** - add async/await
5. **Add asset UI** - drag-and-drop upload panel
6. **Test thoroughly** - all CRUD operations
7. **Deploy** - replace old localStorage implementation

---

## ❓ **Questions to Decide**

1. **Asset Upload Limit**: Max file size per asset? (e.g., 10MB)
2. **Asset Types**: Which MIME types to support?
3. **Compression**: Compress text files in export ZIP?
4. **Migration Tool**: Create tool to migrate old localStorage data? (you said no backward compat, but useful for existing users)
5. **Asset Preview**: Show image thumbnails in file explorer?

**Ready to implement?** Let me know and I'll start coding the new `storage-v2.js`! 🚀
