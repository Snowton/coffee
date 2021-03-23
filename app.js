// ***** actual stuff
const express = require("express");
// const bodyParser = require("body-parser") // apparently we don't need body parser anymore!
const ejs = require("ejs")

// ***** my stuff
const pastMeets = require("./cjlh_materials/past_meets.js")
const about = require("./cjlh_materials/about.js")

const app = express()

app.set("view-engine", "ejs")
app.use(express.urlencoded({extended: true}));

const cjlhroot = "cjlh"

app.get("/", (req, res) => {
    res.render("cjlh/index.ejs", {pastMeets: pastMeets, about: about});
})

app.get("/meet", (req, res) => {
    res.render("cjlh/meet.ejs", {pastMeets: pastMeets, about: about});
})

app.listen(process.env.PORT || 3000, (err) => {
    if (!err) console.log("successfully started on port 3000 or process.env.PORT");
    else console.log(err);
})