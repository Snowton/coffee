// ***** actual stuff
require("dotenv").config()
const express = require("express");
// const bodyParser = require("body-parser") // apparently we don't need body parser anymore!
const ejs = require("ejs");
const mongoose = require("mongoose");
const passport = require('passport');  
const GoogleStrategy = require('passport-google-oauth20').Strategy;  
const session = require('express-session');
const _ = require("lodash")

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
                    res.render("blog/home.ejs", {posts: posts, admin: true});
                } else res.render("blog/home.ejs", {posts: posts, admin: false});
            })
        } else {
            res.render("blog/home.ejs", {posts: posts, admin: false});
        }
    })
})

app.get("/posts/:post", (req, res) => {
    Post.findOne({url: req.params.post}, (err, post) => {
        if(err || !post) res.redirect("/"); // 404
        else {
            post.body = "<p>" + JSON.stringify(post.body).slice(1, -1) + "</p>"
            post.body = (post.body.replace(/\\r\\n/g, "</p><p>"))
            console.log(post.body)
            if(req.isAuthenticated()) {
                User.findOne({id: req.user}, (err, user) => {
                    if(user) {
                        res.render("blog/post.ejs", {post: {title: post.title, body: post.body, admin: true}})
                    } else res.render("blog/post.ejs", {post: {title: post.title, body: post.body, admin: false}});
                })
            } else {
                res.render("blog/post.ejs", {post: {title: post.title, body: post.body, admin: false}});
            }
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
                        res.render("blog/blog.ejs", {years: years, admin: true});
                    } else res.render("blog/blog.ejs", {years: years, admin: false});
                })
            } else {
                res.render("blog/blog.ejs", {years: years, admin: false});
            }
        } else {
            console.log(err)
        }
    })
})






// ********************* MY SIDE

// DO NOT input titles that are a previous title + "-[integer number]"
const getUrl = (title, cb) => {
    let url = title.toLowerCase().replace(/\s/g, "-")
    Post.find({title: title}, {url: 1}, {sort: {url: 1}}, (err, posts) => {
        if(posts) {
            let count = 0;
            console.log(posts)

            newUrl = url + (posts.length > 0 ? "-" + (posts.length + 1) : "")

            for(post of posts) {
                console.log(url + (count > 0 ? "-" + count : ""), post.url)
                if((url + (count > 0 ? "-" + count : "")) != post.url) {
                    newUrl = url + (count > 0 ? "-" + count : "");
                    break;
                }
                console.log(count)
                count++;
            }
        }

        console.log(newUrl)
        cb(newUrl);
    })
}

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
                getUrl(req.body.title, (url) => {
                    let now = Date.now();

                    console.log(url)

                    const post = new Post({
                        title: req.body.title,
                        body: req.body.message,
                        url: url,
                        date: now
                    })

                    post.save(err => {
                        if(!err) res.redirect("/");
                    })
                })
            } else res.redirect("/"); // 404
        })
    } else {
        res.redirect("/"); // 404
    }
})

app.route("/compose/:post").get((req, res) => {
    if(req.isAuthenticated()) {
        User.findOne({id: req.user}, (err, user) => {
            if(user) {
                Post.findOne({url: req.params.post}, (err, post) => {
                    if(!err) {
                        res.render("blog/compose.ejs", {post: post})
                    } else {
                        res.redirect("/"); // 404
                    }
                });
            } else res.redirect("/"); // 404
        })
    } else {
        res.redirect("/"); // 404
    }
}).post((req, res) => {
    if(req.isAuthenticated()) {
        User.findOne({id: req.user}, (err, user) => {
            if(user) {
                getUrl(req.body.title, (url) => {
                    Post.updateOne({url: req.params.post}, {title: req.body.title, body: req.body.message, url: url}, (err, post) => {
                        if(!err) res.redirect("/");
                        else console.log(err);
                    });
                })
            } else res.redirect("/"); // 404
        })
    } else {
        res.redirect("/"); // 404
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