const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function openDB() {
    const db = await open({
        filename: './database.db',
        driver: sqlite3.Database
    })

    return db;
}

async function getStats(playerID) {
    const db = await openDB();
    const gameResults = await db.all(`SELECT whiteID, blackID, result FROM games WHERE whiteID = ? OR blackID = ?`, playerID, playerID);
    let draws = 0;
    let wins = 0;
    let losses = 0;
    gameResults.forEach(game => {
        if(game.result == '1/2-1/2') {
            draws ++;
        } else if ((game.result == '1-0' && game.whiteID == playerID) || (game.result == '0-1' && game.blackID == playerID)) {
            wins ++;
        } else {
            losses ++;
        }
    });
    return([wins, draws, losses]);
}

async function getPlayers() {
    const db = await openDB();
    const players = await db.all(`SELECT * FROM players`);
    for await (const player of players) {
        let WDL = await getStats(player.playerID);
        player.wins = WDL[0];
        player.draws = WDL[1];
        player.losses = WDL[2];
    }
    players.sort((a, b) => parseInt(b.wins) - parseInt(a.wins));
    return players;
}


getPlayers();

module.exports = getPlayers;