// ***** actual stuff
require("dotenv").config()
const express = require("express");
// const bodyParser = require("body-parser") // apparently we don't need body parser anymore!
const ejs = require("ejs");
const mongoose = require("mongoose");
const passport = require('passport');  
const GoogleStrategy = require('passport-google-oauth20').Strategy;  
const session = require('express-session');
const _ = require("lodash/collection")

// ***** my stuff
const pastMeets = require("./cjlh_materials/past_meets.js")
const about = require("./cjlh_materials/about.js")
const sponsors = require("./cjlh_materials/sponsors.js")







// ****** setting up mongo

mongoose.connect(process.env.MONGO || "mongodb://localhost:27017/coffeeDB", {useNewUrlParser: true, useUnifiedTopology: true });

const postSchema = new mongoose.Schema({
    title: String,
    body: String,
    url: String,
    date: Date
});

const userSchema = new mongoose.Schema({
    id: String
})

const Post = mongoose.model("post", postSchema);
const User = mongoose.model("user", userSchema);

// ***** setting up the app

const app = express()

app.set("view-engine", "ejs")
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"))

const root = "https://"





// ************ setting up Google OAuth2.0

// setting up cookies

app.use(session({  
    secret: process.env.SESSION_SECRET || 'default_session_secret',
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());  
app.use(passport.session());

passport.serializeUser((user, done) => {  
    done(null, user);
});
  
passport.deserializeUser((userDataFromCookie, done) => {  
    done(null, userDataFromCookie);
});

// setting up google auth

passport.use(new GoogleStrategy (  
    {
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: (process.env.CALLBACK || 'http://localhost:3000') + '/auth/google/callback',
        scope: ['email'],
    },
    (accessToken, refreshToken, profile, cb) => {
        // console.log('Our user authenticated with Google, and Google sent us back this profile info identifying the authenticated user:', profile);
        // can put anything into req.user, we choose to send just the raw profile (i.e. email)

        return cb(null, profile.id);
    },
));

app.get('/auth/google/callback',  
    passport.authenticate('google', { failureRedirect: '/', session: true }),
    (req, res) => {
        console.log('wooo we authenticated, here is our user object:', req.user);
        // res.json(req.user); // idk why they had this
        res.redirect('/');
    }
);

app.get("/login", (req, res) => {
    if(!req.isAuthenticated()) {
        res.redirect("/auth/google/callback");
    } else {
        res.redirect("/")
    }
})








// **** BLOG stuffs

// ************************* THEIR SIDE

app.get("/", (req, res) => {
    Post.find({}, {}, {limit: 10, sort: {date: -1}}, (err, posts) => {
        if(req.isAuthenticated()) {
            User.findOne({id: req.user}, (err, user) => {
                if(user) {
                    res.render("blog/home.ejs", {posts: posts});
                } else res.render("blog/home.ejs", {posts: posts});
            })
        } else {
            res.render("blog/home.ejs", {posts: posts});
        }
    })
})

app.get("/posts/:post", (req, res) => {
    Post.findOne({url: req.params.post}, (err, post) => {
        if(req.isAuthenticated()) {
            User.findOne({id: req.user}, (err, user) => {
                if(user) {
                    res.render("blog/post.ejs", {post: {title: post.title, body: post.body}})
                } else res.render("blog/post.ejs", {post: {title: post.title, body: post.body}});
            })
        } else {
            res.render("blog/post.ejs", {post: {title: post.title, body: post.body}});
        }
    })
})

app.get("/blog", (req, res) => {
    const years = {}

    Post.find({}, {_id: 0, body: 0}, {sort: {date: -1}}, (err, posts) => {
        if(posts) {
            for(post of posts) {
                year = post.date.getYear() + 1900
                if(!years[year]) {
                    years[year] = {};
                }

                months = years[year]
                month = post.date.toLocaleString('default', { month: 'long' })

                if(!months[month]) {
                    months[month] = []
                }

                months[month] = [...months[month], post]
            }

            if(req.isAuthenticated()) {
                User.findOne({id: req.user}, (err, user) => {
                    if(user) {
                        res.render("blog/blog.ejs", {years: years});
                    } else res.render("blog/blog.ejs", {years: years});
                })
            } else {
                res.render("blog/blog.ejs", {years: years});
            }
        } else {
            console.log(err)
        }
    })
})






// ********************* MY SIDE

app.route("/compose").get((req, res) => {
    if(req.isAuthenticated()) {
        User.findOne({id: req.user}, (err, user) => {
            if(user) {
                res.render("blog/compose.ejs", {post: {}});
            } else res.redirect("/");
        })
    } else {
        res.redirect("/");
    }
}).post((req, res) => {
    if(req.isAuthenticated()) {
        User.findOne({id: req.user}, (err, user) => {
            if(user) {
                let now = Date.now();

                const post = new Post({
                    title: req.body.title,
                    body: req.body.message,
                    url: req.body.title.toLowerCase().replace(/\s/g, "-"),
                    date: now
                })

                post.save(err => {
                    if(!err) res.redirect("/");
                })
            } else res.redirect("/");
        })
    } else {
        res.redirect("/");
    }
})

app.route("/compose/:post").get((req, res) => {
    if(req.isAuthenticated()) {
        User.findOne({id: req.user}, (err, user) => {
            if(user) {
                Post.findOne({url: req.params.post}, (err, post) => {
                    res.render("blog/compose.ejs", {post: post})
                });
            } else res.redirect("/");
        })
    } else {
        res.redirect("/");
    }
}).post((req, res) => {
    if(req.isAuthenticated()) {
        User.findOne({id: req.user}, (err, user) => {
            if(user) {
                Post.updateOne({url: req.params.post}, {title: req.body.title, body: req.body.message}, (err, post) => {
                    if(!err) res.redirect("/");
                });
            } else res.redirect("/");
        })
    } else {
        res.redirect("/");
    }
})











// ******* CJLH stuffs

const cjlhroot = "/cjlh/"

// lots of static pages to be served up

app.get(cjlhroot, (req, res) => {
    res.render("cjlh/index.ejs", {pastMeets: pastMeets, about: about, url: root + req.headers.host + cjlhroot});
})

app.get(cjlhroot + "meet", (req, res) => {
    res.render("cjlh/meet.ejs", {pastMeets: pastMeets, url: root + req.headers.host + cjlhroot});
})

app.get(cjlhroot + "past-meets", (req, res) => {
    res.render("cjlh/past-meets.ejs", {pastMeets: pastMeets, url: root + req.headers.host + cjlhroot})
})

app.get(cjlhroot + "about", (req, res) => {
    res.render("cjlh/about.ejs", {about: about, sponsors: sponsors, url: root + req.headers.host + cjlhroot})
})

app.get(cjlhroot + "*", (req, res) => {
    res.render("cjlh/404.ejs")
})

app.listen(process.env.PORT || 3000, (err) => {
    if (!err) console.log("successfully started on port 3000 or process.env.PORT");
    else console.log(err);
})