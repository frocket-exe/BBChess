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

async function getPlayerGames(playerID) {
    const db = await openDB();
    const player = await db.get(`SELECT * FROM players WHERE playerID = ?`, playerID);
    const lichessData = (await fetch("https://lichess.org/api/user/" + player.lichessUN)).json();
    const chessComData = (await fetch("https://api.chess.com/pub/player/" + player.chessComUN + "/stats")).json();
    const tournaments = await db.all(`SELECT * FROM tournamentPlayers WHERE playerID = ?`, playerID);
    const games = await db.all(`SELECT * FROM games WHERE whiteID = ? OR blackID = ?`, playerID, playerID);
    console.log(player);
    console.log(lichessData);
    console.log(chessComData);
    console.log(tournaments);
    console.log(games);
}

async function pgnToURL(pgn) {
    // 1. Clean the PGN string to fix formatting issues
    const cleanedPgn = pgn.trim().replace(/^\s+/gm, '');

    const formData = new URLSearchParams();
    formData.append('pgn', cleanedPgn);

    try {
        const response = await fetch("https://lichess.org", {
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
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


// getPlayerGames(1);
pgn = `[Event "WNRRR"]
[Site "?"]
[Date "2025.12.23"]
[Round "?"]
[White "Sam"]
[Black "John"]
[Result "1-0"]
[WhiteElo "?"]
[BlackElo "?"]

1. d4 d5 2. e4 e6 3. Nc3 Nc6 4. Nf3 Bb4 5. Bd3 Nf6 6. O-O g6 7. exd5 Ne7 8. dxe6 fxe6 9. Bh6 Kf7 10. Ne5+ Kg8 11. Qf3 Nf5 12. Bxf5 exf5 13. a3 Qd6 14. axb4 Bd7 15. Qxb7 Re8 16. Ra6 Qxd4 17. Nxd7 Qxd7 18. Rxf6 Qd4 19. Qd5+ Qxd5 20. Nxd5 c6 21. Nf4 a6 22. Ne6 a5 23. Rf8+ Rxf8 24. Bxf8 Kf7 25. Re1 h6 26. Bg7 Rg8 27. Bxh6 Re8 28. Ng5+ Kf6 29. Rxe8 c5 30. Re6#* 1-0`
pgnToURL(pgn);

module.exports = getPlayers;