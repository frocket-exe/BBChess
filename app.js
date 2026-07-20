const express = require('express');
const app = express();
const path = require('path');
const port = 3000;

app.use(express.static('public'));
app.set("view engine","ejs");

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/views/index.html'));
});

app.get('/players', (req, res) => {
  res.sendFile(path.join(__dirname, '/views/players.html'));
});

app.get('/tournaments', (req, res) => {
  res.sendFile(path.join(__dirname, '/views/tournaments.html'));
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});