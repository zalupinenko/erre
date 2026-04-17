// База данных в формате JSON (для разработки)
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Начальные данные
const initialData = {
  users: [],
  wallets: [],
  buyOffers: [],
  sellOffers: [],
  deals: [],
  withdrawRequests: [],
  topupRequests: [],
  authCodes: [],
  settings: {
    usdRubRate: 95.0,
    minWithdraw: 10,
    maxWithdraw: 10000,
    withdrawalFee: 1.5
  }
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load database
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading DB:', error);
  }
  
  // Return initial data if file doesn't exist or error occurred
  return initialData;
}

// Save database
function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving DB:', error);
    return false;
  }
}

// Get collection
function getCollection(collectionName) {
  const db = loadDB();
  return db[collectionName] || [];
}

// Find document
function find(collectionName, predicate) {
  const collection = getCollection(collectionName);
  return collection.find(predicate);
}

// Find all documents matching predicate
function findAll(collectionName, predicate) {
  const collection = getCollection(collectionName);
  if (!predicate) return collection;
  return collection.filter(predicate);
}

// Insert document
function insert(collectionName, document) {
  const db = loadDB();
  if (!db[collectionName]) {
    db[collectionName] = [];
  }
  
  // Add metadata
  document.createdAt = new Date().toISOString();
  document.updatedAt = new Date().toISOString();
  
  if (!document.id) {
    const { v4: uuidv4 } = require('uuid');
    document.id = uuidv4();
  }
  
  db[collectionName].push(document);
  saveDB(db);
  return document;
}

// Update document
function update(collectionName, id, updates) {
  const db = loadDB();
  const index = db[collectionName]?.findIndex(doc => doc.id === id);
  
  if (index === -1) {
    return null;
  }
  
  updates.updatedAt = new Date().toISOString();
  db[collectionName][index] = { ...db[collectionName][index], ...updates };
  saveDB(db);
  return db[collectionName][index];
}

// Delete document
function remove(collectionName, id) {
  const db = loadDB();
  const initialLength = db[collectionName]?.length || 0;
  db[collectionName] = db[collectionName]?.filter(doc => doc.id !== id) || [];
  
  if (db[collectionName].length < initialLength) {
    saveDB(db);
    return true;
  }
  return false;
}

// Initialize DB with admin user
function initializeDB() {
  const db = loadDB();
  
  // Create default admin user if not exists
  const adminExists = db.users?.some(u => u.role === 'admin');
  if (!adminExists) {
    const { v4: uuidv4 } = require('uuid');
    db.users = db.users || [];
    db.users.push({
      id: uuidv4(),
      telegramId: 'admin',
      username: 'admin',
      firstName: 'Admin',
      role: 'admin',
      balance: 1000000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    saveDB(db);
    console.log('Admin user created');
  }
  
  return db;
}

module.exports = {
  loadDB,
  saveDB,
  getCollection,
  find,
  findAll,
  insert,
  update,
  remove,
  initializeDB,
  initialData
};
