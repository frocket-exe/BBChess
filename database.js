const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function openDB() {
    const db = await open({
        filename: './database.db',
        driver: sqlite3.Database
    })

    return db;
}

async function getAge(dob) {
    const dateOfBirth = Date.parse(dob);
    let diff_ms = Date.now() - dateOfBirth;
    let age_dt = new Date(diff_ms); 
    return Math.abs(age_dt.getUTCFullYear() - 1970);
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
    return([wins, losses, draws]);
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

async function getExternalElo(playerID) {
    const db = await openDB();
    const player = await db.get(`SELECT lichessUN, chessComUN, eloLastUpdate, lichessElo, chessComLastElo, chessComBestElo FROM players WHERE playerID = ?`, playerID);
    let lichessElo;
    let chessComLastElo;
    let chessComBestElo;
    const currentUnixTime = Math.floor(Date.now()/1000);
    const timeSinceUpdate = currentUnixTime - player.eloLastUpdate;
    if (timeSinceUpdate >= 86400) {
        console.log("It's been more than 24h")
        if (player.lichessUN !== null) {
            const lichessData = (await fetch("https://lichess.org/api/user/" + player.lichessUN));
            const lichessDataJson = await lichessData.json();
            lichessElo = (lichessDataJson.perfs.rapid.rating);
        } else {
            lichessElo = null;
        }
        if (player.chessComUN !== null) {
            const chessComData = (await fetch("https://api.chess.com/pub/player/" + player.chessComUN + "/stats"));
            const chessComDataJson = await chessComData.json();
            chessComLastElo = chessComDataJson.chess_rapid.last.rating;
            chessComBestElo = chessComDataJson.chess_rapid.best.rating;
        } else {
            chessComLastElo = null;
            chessComBestElo = null;
        }
        await db.run(`UPDATE players SET eloLastUpdate = ?, lichessElo = ?, chessComLastElo = ?, chessComBestElo = ? WHERE playerID = ?;`, currentUnixTime, lichessElo, chessComLastElo, chessComBestElo, playerID);
    } else {
        lichessElo = player.lichessElo;
        chessComLastElo = player.chessComLastElo;
        chessComBestElo = player.chessComBestElo;
    }
    return [lichessElo, chessComLastElo, chessComBestElo];
}

async function getPlayerData(playerID) {
    const db = await openDB();
    const player = await db.get(`SELECT * FROM players WHERE playerID = ?`, playerID);
    player.age = await getAge(player.dob);
    let WDL = await getStats(player.playerID);
    player.wins = WDL[0];
    player.draws = WDL[1];
    player.losses = WDL[2];
    player.rating = {};
    const playerRatings =  await getExternalElo(playerID);
    player.rating.lichessElo = playerRatings[0];
    player.rating.chessComLastElo = playerRatings[1];
    player.rating.chessComBestElo = playerRatings[2];
    player.links = {'lichess': 'https://lichess.org/@/' + player.lichessUN, 'chessCom': 'https://chess.com/member/' + player.chessComUN};
    const tournaments = await db.all(`SELECT tournamentID, finalPosition FROM tournamentPlayers WHERE playerID = ?`, playerID);
    for await (const tournament of tournaments) {
        tournamentData = await db.get(`SELECT name, slug FROM tournaments WHERE tournamentID = ?`, tournament.tournamentID);
        tournament.name = tournamentData.name;
        tournament.slug = tournamentData.slug;
    }
    player.tournaments = tournaments;
    const games = await db.all(`SELECT * FROM games WHERE whiteID = ? OR blackID = ?`, playerID, playerID);
    for await(const game of games) {
        if(game.result == '1/2-1/2') {
            game.resultStr = "Draw";
        } else if ((game.result == '1-0' && game.whiteID == playerID) || (game.result == '0-1' && game.blackID == playerID)) {
            game.resultStr = "Win";
        } else {
            game.resultStr = "Loss";
        }
        const whiteName = await db.get(`SELECT fName FROM players WHERE playerID = ?`, game.whiteID);
        const blackName = await db.get(`SELECT fName FROM players WHERE playerID = ?`, game.blackID);
        game.whiteName = whiteName.fName;
        game.blackName = blackName.fName;
    };
    games.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    player.games = games;
    const achievements = await db.all(`SELECT * FROM achievements WHERE playerID = ?`, playerID);
    player.achievements = achievements;
    return(player);
}


async function slugToID(playerSlug) {
    const db = await openDB();
    const player = await db.get(`SELECT playerID FROM players WHERE fName = ?`, playerSlug);
    return (player.playerID);
}

async function pgnToURL(pgn) {
    const formData = new URLSearchParams();
    formData.append('pgn', pgn);

    try {
        const response = await fetch("https://lichess.org/api/import", {
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('Lichess Board URL:', data.url);
        return data.url;

    } catch (error) {
        console.error('Error importing PGN:', error);
    }
}


module.exports = {getPlayers, getPlayerData, slugToID};