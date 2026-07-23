const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const strftime = require('strftime');

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

function dateStr(date) {
    const d = Date.parse(date);
    const dStr = strftime('%d/%m/%Y', new Date(d));
    return(dStr);
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
    players.sort((a, b) => parseFloat(b.bbcElo) - parseFloat(a.bbcElo));
    return players;
}

function calcElo(game, whitePlayer, blackPlayer) {
    const kWhite = Math.max(20, 69-whitePlayer.gamesPlayed);
    const kBlack = Math.max(20, 69-blackPlayer.gamesPlayed);
    const whiteID = game.whiteID;
    const blackID = game.blackID;
    const whiteInitialRating = whitePlayer.bbcElo;
    const blackInitialRating = blackPlayer.bbcElo;
    const whiteExpectation = 1/(1+10**((blackInitialRating-whiteInitialRating)/400));
    const blackExpectation = 1/(1+10**((whiteInitialRating-blackInitialRating)/400));
    let whiteResult;
    let blackResult;
    if (game.result == "1-0") {
        whiteResult = 1;
        blackResult = 0;
    } else if (game.result == "0-1") {
        whiteResult = 0;
        blackResult = 1;
    } else {
        whiteResult = 0.5;
        blackResult = 0.5;
    }
    const newWhiteElo = (whiteInitialRating + kWhite * (whiteResult-whiteExpectation));
    const newBlackElo = (blackInitialRating + kBlack * (blackResult-blackExpectation));
    return [newWhiteElo, newBlackElo];
}

async function calcAllGamesElo() {
    const db = await openDB();
    const players = await db.all(`SELECT playerID, fName, bbcElo FROM players`);
    const games = await db.all(`SELECT gameID, whiteID, blackID, result, date FROM games WHERE rated = 1`);
    for await (const player of players) {
        const playerGames = await db.all(`SELECT gameID FROM games WHERE whiteID = ? OR blackID = ?`, player.playerID, player.playerID);
        player.gamesPlayed = playerGames.length;
    }
    games.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    for await (const game of games) {
        const whitePlayer = players.filter(obj => {return obj.playerID === game.whiteID})[0]
        const blackPlayer = players.filter(obj => {return obj.playerID === game.blackID})[0]
        const eloResults = calcElo(game, whitePlayer, blackPlayer);
        whitePlayer.bbcElo = eloResults[0];
        blackPlayer.bbcElo = eloResults[1];
    }
    for await (const player of players) {
        await db.run(`UPDATE players SET bbcElo = ? WHERE playerID = ?;`, player.bbcElo, player.playerID);
    }
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
    player.dobStr = dateStr(player.dob);
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
        game.dateStr = dateStr(game.date);
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

function timeControl(startTime) {
    let timeControlStr;
    if (startTime < 3) {
        timeControlStr = "Bullet";
    } else if (startTime < 10) {
        timeControlStr = "Blitz";
    } else if (startTime < 60) {
        timeControlStr = "Rapid";
    } else {
        timeControlStr = "Classical";
    }
    return(timeControlStr);
}

function getTense(startD, endD) {
    const startDate = Date.parse(startD);
    const endDate = Date.parse(endD);
    const currentDate = Date.now();
    let status;
    if (endDate < currentDate) {
        status = "Past";
    } else if (startDate > currentDate) {
        status = "Upcoming";
    } else {
        status = "Current";
    }
    return status;
}

async function getTournaments(){
    const db = await openDB();
    const tournaments = await db.all(`SELECT * FROM tournaments`);
    for await (const tournament of tournaments) {
        const startDateStr = dateStr(tournament.startDate);
        const endDateStr = dateStr(tournament.endDate);
        tournament.startDateStr = startDateStr;
        tournament.endDateStr = endDateStr;
        console.log(startDateStr);
        console.log(endDateStr);
        const timeCon = timeControl(tournament.baseTime);
        tournament.timeControl = timeCon;
        const status = getTense(tournament.startDate, tournament.endDate);
        tournament.status = status;
        const players = await db.all(`SELECT * FROM tournamentPlayers WHERE tournamentID = ?`, tournament.tournamentID);
        const winnerID = await db.get(`SELECT playerID FROM tournamentPlayers WHERE tournamentID = ? AND finalPosition = 1`, tournament.tournamentID);
        const winner = await db.get(`SELECT fName FROM players WHERE playerID = ?`, winnerID.playerID);
        tournament.winner = winner.fName;
        const playerCount = players.length;
        tournament.playerCount = playerCount;
    }
    tournaments.sort((a, b) => Date.parse(a.endDate) - Date.parse(b.endDate));
    tournaments.sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
    return(tournaments);
}

async function getTournamentData(tournamentSlug) {
    const db = await openDB();
    const tournament = await db.get(`SELECT * FROM tournaments WHERE slug = ?`, tournamentSlug);
    const timeCon = timeControl(tournament.baseTime);
    tournament.startDateStr = dateStr(tournament.startDate);
    tournament.endDateStr = dateStr(tournament.endDate);
    tournament.timeControl = timeCon;
    const status = getTense(tournament.startDate, tournament.endDate);
    tournament.status = status;
    const players = await db.all(`SELECT * FROM tournamentPlayers WHERE tournamentID = ?`, tournament.tournamentID);
    for await (const player of players) {
        const playerInfo = await db.get(`SELECT fName, sName FROM players WHERE playerID = ?`, player.playerID);
        player.fName = playerInfo.fName;
        player.sName = playerInfo.sName;
        player.wins = 0;
        player.losses = 0;
        player.draws = 0;
    }
    players.sort((a, b) => parseInt(a.finalPosition) - parseInt(b.finalPosition));
    tournament.players = players;
    const games = await db.all(`SELECT * FROM games WHERE tournamentID = ?`, tournament.tournamentID);
    games.forEach(game => {
        game.dateStr = dateStr(game.date);
        const whitePlayer = tournament.players.find(player => {return player.playerID === game.whiteID})
        const blackPlayer = tournament.players.find(player => {return player.playerID === game.blackID})
        game.whiteName = whitePlayer.fName;
        game.blackName = blackPlayer.fName;
        if (game.result == "1-0") {
            whitePlayer.wins ++;
            blackPlayer.losses ++;
        } else if (game.result == "0-1") {
            whitePlayer.losses ++;
            blackPlayer.wins ++;
        } else {
            whitePlayer.draws ++;
            blackPlayer.draws ++;
        }
    })
    players.forEach(player => {
        const score = player.wins + (player.draws/2);
        player.score = score;
    })
    games.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    tournament.games = games;
    return tournament;
}


module.exports = {getPlayers, getPlayerData, slugToID, getTournaments, getTournamentData};