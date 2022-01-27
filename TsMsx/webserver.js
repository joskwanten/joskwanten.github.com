const express = require('express')
const app = express()
const port = 3000

app.use(express.static('.'))

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/*', (req, res) => {
  // Trick to do module loading
  if (!req.originalUrl.match(/.js$/)) {
    res.redirect(`${req.protocol}://${req.get('host')}${req.originalUrl}.js`);
  }
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})