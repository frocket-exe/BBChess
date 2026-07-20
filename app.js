const express = require('express');
const app = express();
const path = require('path');
const port = 3000;
const asyncHandler = require('express-async-handler');

const dbFunctions = require('./database');

app.use(express.static('public'));
app.set("view engine","ejs");

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/views/index.html'));
});

app.get('/players', asyncHandler(async (req, res) => {
    const playerData = await dbFunctions.getPlayers();
    if(!playerData) {
        res.status(404);
        throw new Error('Players not found');
    } else {
        res.render('players', {playerData: playerData});
    }
}));

app.get('/players/:id', asyncHandler(async (req, res) => {
  const playerID = await dbFunctions.slugToID(req.params.id)
  const playerObj = await dbFunctions.getPlayerData(playerID);
  if(!playerObj) {
        res.status(404);
        throw new Error('Players not found');
    } else {
    res.render('player', {player: playerObj});
    }
  // res.render('player-test', {player: req.params.id});
}));

app.get('/tournaments', (req, res) => {
    res.sendFile(path.join(__dirname, '/views/tournaments.html'));
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});