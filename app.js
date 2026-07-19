const express = require('express');
const app = express();
const router = express.Router();
const port = 3000;

// app.get('/', (req, res) => {
//   res.send('Hello World!');
// });

app.get('/', (req, res) => {
  res.render('../views/index');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});