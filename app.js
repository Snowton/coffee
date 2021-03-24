// ***** actual stuff
const express = require("express");
// const bodyParser = require("body-parser") // apparently we don't need body parser anymore!
const ejs = require("ejs")

// ***** my stuff
const pastMeets = require("./cjlh_materials/past_meets.js")
const about = require("./cjlh_materials/about.js")
const sponsors = require("./cjlh_materials/sponsors.js")

const app = express()

app.set("view-engine", "ejs")
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"))

const root = "https://"


// ******* CJLH stuffs
const cjlhroot = "/cjlh/"

app.get(cjlhroot, (req, res) => {
    res.render("cjlh/index.ejs", {pastMeets: pastMeets, about: about, url: root + req.headers.host + cjlhroot});
})

app.get(cjlhroot + "meet", (req, res) => {
    res.render("cjlh/meet.ejs", {pastMeets: pastMeets, url: root + cjlhroot});
})

app.get(cjlhroot + "past-meets", (req, res) => {
    res.render("cjlh/past-meets.ejs", {pastMeets: pastMeets, url: root + cjlhroot})
})

app.get(cjlhroot + "about", (req, res) => {
    res.render("cjlh/about.ejs", {about: about, sponsors: sponsors, url: root + cjlhroot})
})

app.listen(process.env.PORT || 3000, (err) => {
    if (!err) console.log("successfully started on port 3000 or process.env.PORT");
    else console.log(err);
})