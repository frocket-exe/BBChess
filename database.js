const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function openDB() {
    const db = await open({
        filename: './database.db',
        driver: sqlite3.Database
    })

    return db;
}

async function getPlayers() {
    const db = await openDB();
    const players = await db.all(`SELECT * FROM players`);
    return players;
}


module.exports = getPlayers;