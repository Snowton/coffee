const express = require("express");
// const bodyParser = require("body-parser") // apparently we don't need body parser anymore!
const ejs = require("ejs")

const app = express()

app.set("view-engine", "ejs")
app.use(express.urlencoded());

app.get("/", (req, res) => {
    res.send("glad to have you here");
})

app.listen(process.env.PORT || 3000, (err) => {
    if (!err) console.log("successfully started on port 3000 or process.env.PORT");
    else console.log(err);
})