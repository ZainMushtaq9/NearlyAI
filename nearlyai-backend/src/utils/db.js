const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let dbInstance = null;
async function getDb() {
    if (dbInstance) return dbInstance;
    dbInstance = await open({
        filename: path.join(dataDir, 'nearlyai.db'),
        driver: sqlite3.Database
    });
    await dbInstance.run('PRAGMA journal_mode = WAL');
    await dbInstance.run('PRAGMA foreign_keys = ON');
    return dbInstance;
}

module.exports = getDb;
