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
      // Use DB_PATH environment variable or PRODUCTION DEFAULT
      const dbPath = process.env.DB_PATH || '/home/ldawg7624/chat-data/chat.db';
      
      // SAFETY CHECK: Refuse to start if using forbidden in-repo DB path
      if (dbPath.includes('/apps/pi-global/chat.db')) {
        console.error('========================================');
        console.error('[DB] ❌ FATAL: FORBIDDEN DATABASE PATH!');
        console.error(`[DB] Path: ${dbPath}`);
        console.error('[DB] This is the in-repo path that causes data loss.');
        console.error('[DB] Production path: /home/ldawg7624/chat-data/chat.db');
        console.error('========================================');
        throw new Error('Forbidden database path detected');
      }
      
      // Ensure the directory exists before creating the database file
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        console.log(`[DB] Creating database directory: ${dbDir}`);
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      // Log the resolved DB path prominently
      console.log('========================================');
      console.log('[DB] DATABASE CONFIGURATION');
      console.log('[DB] Resolved DB path:', dbPath);
      console.log('[DB] DB directory:', dbDir);
      console.log('[DB] DB_PATH env var:', process.env.DB_PATH || '(not set)');
      console.log('[DB] File exists:', fs.existsSync(dbPath) ? 'YES' : 'NO (will be created)');
      console.log('========================================');
      
      db = new Database(dbPath);
      
      // VERIFY SCHEMA: Check what columns exist in the messages table
      console.log('[DB-SCHEMA] ========================================');
      console.log('[DB-SCHEMA] Checking existing schema...');
      try {
        const columnsStmt = db.prepare("PRAGMA table_info(messages)");
        const existingColumns = columnsStmt.all();
        if (existingColumns.length > 0) {
          console.log('[DB-SCHEMA] Table "messages" exists with columns:');
          existingColumns.forEach(col => {
            console.log(`[DB-SCHEMA]   - ${col.name} (${col.type}, pk=${col.pk}, notnull=${col.notnull}, dflt=${col.dflt_value})`);
          });
        } else {
          console.log('[DB-SCHEMA] Table "messages" does not exist yet (will be created)');
        }
      } catch (schemaError) {
        console.log('[DB-SCHEMA] Could not read schema (table may not exist yet):', schemaError.message);
      }
      console.log('[DB-SCHEMA] ========================================');
      
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
          caption TEXT,
          isAdmin INTEGER DEFAULT 0
        )
      `);
      
      // Create index on timestamp for efficient sorting
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp DESC)
      `);
      
      // Migration: Add isAdmin column if it doesn't exist (for existing databases)
      try {
        const columnsStmt = db.prepare("PRAGMA table_info(messages)");
        const columns = columnsStmt.all();
        const hasIsAdmin = columns.some(col => col.name === 'isAdmin');
        
        if (!hasIsAdmin) {
          console.log('[DB] Running migration: Adding isAdmin column');
          db.exec('ALTER TABLE messages ADD COLUMN isAdmin INTEGER DEFAULT 0');
          console.log('[DB] Migration complete: isAdmin column added');
        }
      } catch (migrationError) {
        console.warn('[DB] Migration check failed (non-fatal):', migrationError.message);
      }
      
      // Migration: Add adminStyleMeta column if it doesn't exist (for admin styling persistence)
      try {
        const columnsStmt = db.prepare("PRAGMA table_info(messages)");
        const columns = columnsStmt.all();
        const hasAdminStyleMeta = columns.some(col => col.name === 'adminStyleMeta');
        
        if (!hasAdminStyleMeta) {
          console.log('[DB] Running migration: Adding adminStyleMeta column');
          db.exec('ALTER TABLE messages ADD COLUMN adminStyleMeta TEXT');
          console.log('[DB] Migration complete: adminStyleMeta column added');
        }
      } catch (migrationError) {
        console.warn('[DB] Migration check failed (non-fatal):', migrationError.message);
      }
      
      // VERIFY FINAL SCHEMA after migrations
      console.log('[DB-SCHEMA] ========================================');
      console.log('[DB-SCHEMA] Final schema after initialization:');
      const finalColumnsStmt = db.prepare("PRAGMA table_info(messages)");
      const finalColumns = finalColumnsStmt.all();
      finalColumns.forEach(col => {
        console.log(`[DB-SCHEMA]   - ${col.name} (${col.type})`);
      });
      console.log('[DB-SCHEMA] ========================================');
      
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
      const error = new Error('Database not initialized');
      console.error('[DB-INSERT] ❌ FATAL: Database not initialized');
      return reject(error);
    }
    
    try {
      // Validate required fields with fallbacks
      if (!msg.id || typeof msg.id !== 'string') {
        const error = new Error(`Invalid message ID: ${JSON.stringify(msg.id)}`);
        console.error('[DB-INSERT] ❌ VALIDATION ERROR:', error.message);
        console.error('[DB-INSERT] Message payload:', JSON.stringify(msg, null, 2));
        return reject(error);
      }
      
      // Apply fallbacks for required fields
      const type = msg.type || 'text';
      const senderId = msg.senderId || 'unknown';
      const timestamp = Number(msg.timestamp) || Date.now();
      const isAdmin = msg.isAdmin ? 1 : 0;
      
      console.log(`[DB-INSERT] ========================================`);
      console.log(`[DB-INSERT] Attempting to save message`);
      console.log(`[DB-INSERT] id=${msg.id}`);
      console.log(`[DB-INSERT] type=${type}`);
      console.log(`[DB-INSERT] senderId=${senderId}`);
      console.log(`[DB-INSERT] timestamp=${timestamp}`);
      console.log(`[DB-INSERT] text=${msg.text ? msg.text.substring(0, 50) : 'null'}`);
      
      // Extract filename from URL if present (for file/image/audio messages)
      let storedFilename = null;
      if (msg.url) {
        const urlPath = msg.url.split('?')[0]; // Remove query params
        storedFilename = path.basename(urlPath);
      }
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO messages 
        (id, type, senderId, nickname, timestamp, text, html, url, filename, storedFilename, mime, size, caption, isAdmin, adminStyleMeta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Serialize adminStyleMeta to JSON if present
      const adminStyleMetaJson = msg.adminStyleMeta ? JSON.stringify(msg.adminStyleMeta) : null;
      
      const result = stmt.run(
        msg.id,
        type,
        senderId,
        msg.nickname || null,
        timestamp,
        msg.text || null,
        msg.html || null,
        msg.url || null,
        msg.filename || null,
        storedFilename,
        msg.mime || null,
        msg.size || null,
        msg.caption || null,
        isAdmin,
        adminStyleMetaJson
      );
      
      console.log(`[DB-INSERT] ✓ INSERT successful: changes=${result.changes}`);
      
      // Verify the message was saved by counting total messages
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM messages');
      const { count } = countStmt.get();
      console.log(`[DB-INSERT] ✓ COUNT after insert: ${count}`);
      
      // Verify the specific message exists
      const verifyStmt = db.prepare('SELECT id, type, text FROM messages WHERE id = ?');
      const savedMsg = verifyStmt.get(msg.id);
      if (!savedMsg) {
        const error = new Error(`VERIFY FAILED: Message ${msg.id} not found after insert!`);
        console.error(`[DB-INSERT] ❌ ${error.message}`);
        return reject(error);
      }
      console.log(`[DB-INSERT] ✓ VERIFY: Message ${msg.id} confirmed in database`);
      console.log(`[DB-INSERT] ========================================`);
      
      resolve();
    } catch (error) {
      console.error('[DB-INSERT] ❌ SQL ERROR:', error.message);
      console.error('[DB-INSERT] ❌ Error stack:', error.stack);
      console.error('[DB-INSERT] ❌ Message payload:', JSON.stringify(msg, null, 2));
      console.error('[DB-INSERT] ========================================');
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
        
        // Restore isAdmin flag (stored as INTEGER 0 or 1)
        // Always set this field, not just when truthy, to preserve false values
        msg.isAdmin = Boolean(row.isAdmin);
        
        // Deserialize adminStyleMeta if present
        if (row.adminStyleMeta) {
          try {
            msg.adminStyleMeta = JSON.parse(row.adminStyleMeta);
          } catch (e) {
            console.error('[DB] Error parsing adminStyleMeta:', e);
          }
        }
        
        return msg;
      });
      
      console.log(`[DB] ✓ Retrieved ${messages.length} messages from database (limit=${limit})`);
      
      // Log first and last message timestamps for debugging
      if (messages.length > 0) {
        const firstMsg = messages[0];
        const lastMsg = messages[messages.length - 1];
        console.log(`[DB] History range: ${new Date(firstMsg.timestamp).toISOString()} to ${new Date(lastMsg.timestamp).toISOString()}`);
      }
      
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
      const uploadsDir = process.env.UPLOAD_DIR || '/home/ldawg7624/chat-data/uploads';
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

/**
 * Get database info for debugging
 * @returns {Promise<Object>} Database info including count, path, and latest message
 */
function getDatabaseInfo() {
  return new Promise((resolve, reject) => {
    if (!db) {
      return reject(new Error('Database not initialized'));
    }
    
    try {
      const dbPath = process.env.DB_PATH || '/home/ldawg7624/chat-data/chat.db';
      
      // Get total count
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM messages');
      const { count } = countStmt.get();
      
      // Get last message
      const lastStmt = db.prepare('SELECT id, type, text, nickname, timestamp FROM messages ORDER BY timestamp DESC LIMIT 1');
      const lastMessage = lastStmt.get();
      
      const info = {
        dbPath,
        count,
        lastId: lastMessage ? lastMessage.id : null,
        lastType: lastMessage ? lastMessage.type : null,
        lastText: lastMessage ? (lastMessage.text || '(no text)').substring(0, 100) : null,
        lastNickname: lastMessage ? lastMessage.nickname : null,
        lastTimestamp: lastMessage ? lastMessage.timestamp : null,
        lastTimestampFormatted: lastMessage ? new Date(lastMessage.timestamp).toISOString() : null
      };
      
      resolve(info);
    } catch (error) {
      console.error('[DB] Error getting database info:', error);
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
  wipeAllMessages,
  getDatabaseInfo
};
