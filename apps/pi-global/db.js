const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let db = null;

/**
 * Initialize the SQLite database
 * Creates the messages table if it doesn't exist
 */
function initDb() {
  return new Promise((resolve, reject) => {
    try {
      // Use DB_PATH environment variable or default to ./chat.db
      const dbPath = process.env.DB_PATH || path.join(__dirname, 'chat.db');
      
      // FAIL LOUDLY if DB_PATH is not set in production
      if (!process.env.DB_PATH) {
        console.warn('[DB] ⚠️  WARNING: DB_PATH environment variable not set, using default');
      }
      
      // Log the resolved DB path prominently
      console.log('========================================');
      console.log('[DB] DATABASE CONFIGURATION');
      console.log('[DB] Resolved DB path:', dbPath);
      console.log('[DB] DB_PATH env var:', process.env.DB_PATH || '(not set)');
      console.log('[DB] File exists:', fs.existsSync(dbPath) ? 'YES' : 'NO (will be created)');
      console.log('========================================');
      
      db = new Database(dbPath);
      
      // Create messages table
      db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          senderId TEXT NOT NULL,
          nickname TEXT,
          timestamp INTEGER NOT NULL,
          text TEXT,
          html TEXT,
          url TEXT,
          filename TEXT,
          storedFilename TEXT,
          mime TEXT,
          size INTEGER,
          caption TEXT
        )
      `);
      
      // Create index on timestamp for efficient sorting
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp DESC)
      `);
      
      // Get count of messages in DB
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM messages');
      const { count } = countStmt.get();
      
      console.log('[DB] Database initialized successfully');
      console.log('[DB] Current message count:', count);
      console.log('========================================');
      
      resolve();
    } catch (error) {
      console.error('[DB] ❌ FATAL: Database initialization error:', error);
      console.error('[DB] This will prevent persistence from working!');
      reject(error);
    }
  });
}

/**
 * Save a message to the database
 * @param {Object} msg - Message object to save
 */
function saveMessage(msg) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('Database not initialized'));
    }
    
    try {
      // Extract filename from URL if present (for file/image/audio messages)
      let storedFilename = null;
      if (msg.url) {
        const urlPath = msg.url.split('?')[0]; // Remove query params
        storedFilename = path.basename(urlPath);
      }
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO messages 
        (id, type, senderId, nickname, timestamp, text, html, url, filename, storedFilename, mime, size, caption)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        msg.id,
        msg.type,
        msg.senderId,
        msg.nickname || null,
        msg.timestamp || Date.now(),
        msg.text || null,
        msg.html || null,
        msg.url || null,
        msg.filename || null,
        storedFilename,
        msg.mime || null,
        msg.size || null,
        msg.caption || null
      );
      
      console.log(`[DB] Saved message: id=${msg.id}, type=${msg.type}`);
      resolve();
    } catch (error) {
      console.error('[DB] Save error:', error);
      reject(error);
    }
  });
}

/**
 * Get recent messages from the database
 * @param {number} limit - Maximum number of messages to retrieve
 * @returns {Promise<Array>} Array of message objects
 */
function getRecentMessages(limit) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('Database not initialized'));
    }
    
    try {
      // Get the most recent N messages by selecting from the end
      const stmt = db.prepare(`
        SELECT * FROM messages 
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      
      const rows = stmt.all(limit);
      
      // Reverse to return in chronological order (oldest first)
      rows.reverse();
      
      // Convert rows back to message objects
      const messages = rows.map(row => {
        const msg = {
          id: row.id,
          type: row.type,
          senderId: row.senderId,
          timestamp: row.timestamp
        };
        
        // Add optional fields if present
        if (row.nickname) msg.nickname = row.nickname;
        if (row.text) msg.text = row.text;
        if (row.html) msg.html = row.html;
        if (row.url) msg.url = row.url;
        if (row.filename) msg.filename = row.filename;
        if (row.mime) msg.mime = row.mime;
        if (row.size) msg.size = row.size;
        if (row.caption) msg.caption = row.caption;
        
        return msg;
      });
      
      console.log(`[DB] Retrieved ${messages.length} messages (limit=${limit})`);
      resolve(messages);
    } catch (error) {
      console.error('[DB] Retrieve error:', error);
      reject(error);
    }
  });
}

/**
 * Delete a message by ID from the database
 * @param {string} id - Message ID to delete
 * @returns {Promise<string|null>} The stored filename if the message had one, null otherwise
 */
function deleteMessageById(id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('Database not initialized'));
    }
    
    try {
      // First, get the message to check if it has a file
      const selectStmt = db.prepare('SELECT storedFilename FROM messages WHERE id = ?');
      const row = selectStmt.get(id);
      
      // Delete the message
      const deleteStmt = db.prepare('DELETE FROM messages WHERE id = ?');
      deleteStmt.run(id);
      
      const storedFilename = row ? row.storedFilename : null;
      console.log(`[DB] Deleted message: id=${id}, storedFilename=${storedFilename}`);
      
      resolve(storedFilename);
    } catch (error) {
      console.error('[DB] Delete error:', error);
      reject(error);
    }
  });
}

/**
 * Prune messages to keep only the most recent 'limit' messages
 * Deletes files that are no longer referenced by any message
 * @param {number} limit - Maximum number of messages to keep
 * @returns {Promise<void>}
 */
function pruneToLimit(limit) {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('Database not initialized'));
    }
    
    try {
      // Get current count
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM messages');
      const { count } = countStmt.get();
      
      if (count <= limit) {
        // No pruning needed
        resolve();
        return;
      }
      
      // Get messages to delete (oldest messages beyond the limit)
      const toDelete = count - limit;
      const selectStmt = db.prepare(`
        SELECT id, storedFilename FROM messages 
        ORDER BY timestamp ASC 
        LIMIT ?
      `);
      const messagesToDelete = selectStmt.all(toDelete);
      
      // Collect filenames that will be deleted
      const filenamesToCheck = messagesToDelete
        .filter(msg => msg.storedFilename)
        .map(msg => msg.storedFilename);
      
      // Delete the old messages
      const deleteStmt = db.prepare('DELETE FROM messages WHERE id = ?');
      const deleteTransaction = db.transaction((messages) => {
        for (const msg of messages) {
          deleteStmt.run(msg.id);
        }
      });
      deleteTransaction(messagesToDelete);
      
      console.log(`[DB] Pruned ${toDelete} messages (${count} -> ${limit})`);
      
      // Check which files should be deleted
      // Only delete files that are no longer referenced by ANY remaining message
      const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
      for (const filename of filenamesToCheck) {
        // Check if this filename is still referenced
        const checkStmt = db.prepare('SELECT COUNT(*) as count FROM messages WHERE storedFilename = ?');
        const { count: refCount } = checkStmt.get(filename);
        
        if (refCount === 0) {
          // No more references, safe to delete
          const filePath = path.join(uploadsDir, filename);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              console.log(`[DB] Deleted unreferenced file: ${filename}`);
            } catch (err) {
              console.error(`[DB] Failed to delete file ${filename}:`, err.message);
            }
          }
        } else {
          console.log(`[DB] Kept file ${filename} (still referenced by ${refCount} message(s))`);
        }
      }
      
      resolve();
    } catch (error) {
      console.error('[DB] Prune error:', error);
      reject(error);
    }
  });
}

/**
 * Wipe all messages from the database
 * @returns {Promise<number>} Number of messages deleted
 */
function wipeAllMessages() {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('Database not initialized'));
    }
    
    try {
      // Get count before wiping
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM messages');
      const { count } = countStmt.get();
      
      // Delete all messages
      const deleteStmt = db.prepare('DELETE FROM messages');
      deleteStmt.run();
      
      console.log(`[DB] Wiped all messages: ${count} messages deleted`);
      resolve(count);
    } catch (error) {
      console.error('[DB] Wipe error:', error);
      reject(error);
    }
  });
}

module.exports = {
  initDb,
  saveMessage,
  getRecentMessages,
  deleteMessageById,
  pruneToLimit,
  wipeAllMessages
};
