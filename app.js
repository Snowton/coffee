// ***** actual stuff
require("dotenv").config()
const express = require("express");
// const bodyParser = require("body-parser") // apparently we don't need body parser anymore!
const ejs = require("ejs");
const mongoose = require("mongoose");

// auth stuff
const passport = require('passport');  
const GoogleStrategy = require('passport-google-oauth20').Strategy;  
const session = require('express-session');
const MongoStore = require('connect-mongo');

// ***** my stuff
const pastMeets = require("./cjlh_materials/past_meets.js")
const about = require("./cjlh_materials/about.js")
const sponsors = require("./cjlh_materials/sponsors.js");
const e = require("express");

// files
const multer = require('multer');
const fs = require("fs");
// const { redirect } = require("express/lib/response");






// ****** setting up mongo

mongoose.connect(process.env.MONGO || "mongodb://localhost:27017/coffeeDB", {useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
    id: String,
    email: String
})
const postSchema = new mongoose.Schema({
    title: String,
    body: String,
    url: String,
    urlBase: String,
    date: Date,
    published: Boolean,
    img: String,
    ids: [userSchema],
    files: [{
        data: Buffer,
        contentType: String,
        name: String
    }],
    pin: Number,
    creator: userSchema
});




const Post = mongoose.model("post", postSchema);
const User = mongoose.model("user", userSchema);

// ***** setting up the app

const app = express()

// const upload = multer({ dest: 'public/img/blog/multer' })
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, '/tmp/uploads/')
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, file.originalname + '-' + uniqueSuffix)
    }
})
const upload = multer({ storage: storage })
app.set("view-engine", "ejs")
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"))

const root = "https://"





// ************ setting up Google OAuth2.0

// setting up cookies

app.use(session({  
    secret: process.env.SESSION_SECRET || 'not_default_session_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO || "mongodb://localhost:27017/coffeeDB"
    })
}));

app.use(passport.initialize());  
app.use(passport.session());

passport.serializeUser((user, done) => {  
    done(null, user);
});
  
passport.deserializeUser((userDataFromCookie, done) => {  
    // let actual = User.findOneAndUpdate({id: userDataFromCookie.id}, {$set: {email: userDataFromCookie.emails[0].value}}, {useFindAndModify: false})
    User.find({id: userDataFromCookie.id}, (err, actual) => {
        done(null, actual ? {...userDataFromCookie, _id: actual._id} : userDataFromCookie);
    }) 
});

// setting up google auth

passport.use(new GoogleStrategy (  
    {
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: (process.env.CALLBACK || 'http://localhost:3000') + '/auth/google/callback',
        scope: ['email', 'profile'],
    },
    (accessToken, refreshToken, profile, cb) => {
        // console.log('Our user authenticated with Google, and Google sent us back this profile info identifying the authenticated user:', profile);
        // can put anything into req.user, we choose to send just the raw profile (i.e. email)

        console.log(profile)
        return cb(null, {id: profile.id, name: profile.name, displayName: profile.displayName, emails: profile.emails});
    },
));

app.get('/auth/google/callback',  
    passport.authenticate('google', { failureRedirect: '/', session: true }),
    (req, res) => {
        console.log('wooo we authenticated, here is our user object:', req.user);
        // res.json(req.user); // idk why they had this
        // User.findOneAndUpdate({id: req.user.id}, {$set: {email: req.user.emails[0].value}}, (err, user) => {
        //     console.log(user);
        res.redirect('/');
        // })
        // console.log(req.user.emails[0].value);
    }
);

app.get("/login", (req, res) => {
    if(!req.isAuthenticated()) {
        res.redirect("/auth/google/callback");
    } else {
        res.redirect("/")
    }
})

app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
})






// Auth

const authStuff = (req, res, next) => {
    if(req.isAuthenticated()) {
        User.findOne({id: req.user.id}, (err, user) => {
            if(user) {
                req.options = {admin: true, name: true};
                next();
            } else {
                req.options = {admin: false, name: true};
                next();
            }
        })
    } else {
        req.options = {admin: false, name: false};
        next();
    }
}

// **** BLOG stuffs

// ************************* THEIR SIDE

const htmlify = (str) => {
    return ("<p>" + str.replace(/\r\n/g, " </p> <p> ") + "</p>");
}

const homeStr = (str) => {
    // str = htmlify(str)
    str = str.split("<img")[0].slice(0, 100) + (str.length > 100 ? "..." : "")
    // length is used both here and in home.ejs
    return str
}

const homeFind = (request, cb) => {
    Post.find(request, {}, {limit: 5, sort: {pin: -1, date: -1}}, (err, posts) => {
        // console.log(posts.map(post => ({title: post.title, pin: post.pin})));
        cb(posts)
    })
}

const blogFind = (request, cb) => {
    const years = []

    Post.find(request, {_id: 0, body: 0}, {sort: {date: -1}}, (err, posts) => {
        if(posts) {
            for(post of posts) {
                year = post.date.getYear() + 1900
                post.ids.push(post.creator)

                if(years.length === 0 || years[years.length - 1].year != year) {
                    years[years.length] = {year: year, months: []}
                    currentYear = year
                }

                // if(!years[year]) {
                //     years[year] = {};
                // }

                // console.log(years);

                months = years[years.length - 1].months
                month = post.date.toLocaleString('default', { month: 'long' })


                if(months.length === 0 || months[months.length - 1].month != month) {
                    months[months.length] = {month: month, posts: []}
                }

                months[months.length - 1].posts = [...months[months.length - 1].posts, post]
            }

            cb(years);
        } else {
            console.log(err)
        }
    })
}

app.get("/", authStuff, (req, res) => {
    homeFind(req.options.admin ? {} : {published: true}, (posts) => {
        posts.map(post => {
            post.body = homeStr(post.body)
            post.ids.push(post.creator)
            return post
        })
        res.render("blog/home.ejs", {posts: posts, admin: req.options.admin, id: req.user ? req.user.id : null, name: req.options.name ? (req.user.name.givenName ? req.user.name.givenName : req.user.displayName) : false });
    })
})

app.get("/posts/:post", authStuff, (req, res) => {
    // console.log(req.params.post);
    Post.findOne({url: encodeURIComponent(req.params.post)}, (err, post) => {
        if(err || !post) res.render("blog/404.ejs", {route: req.originalUrl}) // 404
        else {
            // post.body = "<p> " + JSON.stringify(post.body).slice(1, -1) + " </p>"
            post.body = htmlify(post.body)
            post.ids.push(post.creator)
            res.render("blog/post.ejs", {post: post, admin: req.options.admin, id: req.user ? req.user.id : null});
        }
    })
})

app.get("/blog", authStuff, (req, res) => {
    blogFind(req.options.admin ? {} : {published: true}, (years) => {
        res.render("blog/blog.ejs", {years: years, admin: req.options.admin, id: req.user ? req.user.id : null});
    })
})






// ********************* MY SIDE

// DO NOT input titles that are a previous title + "-[integer number]"
const getUrl = (title, oldUrlBase, cb) => {
    let newUrl = encodeURIComponent(title.toLowerCase().replace(/\s/g, "-"))
    const newUrlBase = newUrl
    if(newUrl != oldUrlBase) {
        Post.find({urlBase: newUrl}, {url: 1}, {sort: {url: 1}}, (err, posts) => {
            if(posts) {
                let count = 0;
                newUrl = newUrl + (posts.length > 0 ? "-" + (posts.length + 1) : "")
    
                for(post of posts) {
                    const possible = url + (count > 0 ? "-" + count : "")
                    if(possible != post.url) {
                        newUrl = possible;
                        break;
                    }
                    count++;
                }
            }
            cb(newUrl, newUrlBase);
        })
    } else cb(newUrl, newUrlBase);
}

const updateAndRedirect = (url, request, redirect, res) => {
    Post.updateOne({url: url}, request[0], (err) => {
        if(!err) {
            if(request[1]) {
                Post.updateOne({url: url}, request[1], (err, post) => {
                    if(!err) redirectPost(redirect, url, res)
                })
            }
            else redirectPost(redirect, request[0].url ? request[0].url : url, res)
        }
        else console.log(err);
    });
}

const redirectPost = (redirect, url, res) => {
    if(redirect) {
        res.redirect("/");
    } else {
        res.redirect("/compose/" + url)
    }
}

const generateRequest = (body, files, user, oldUrlBase, next) => {
    let request = [{}]
    let redirect = false

    if(body.publish) {
        request[0].published = true
        redirect = true
    } else if(body.unpublish) {
        request[0].published = false
        redirect = true
    }

    // no title in posts page or home page !!
    if(body.title) {
        request = [{
            title: body.title,
            body: body.message,
            img: body.img,
            pin: Math.max(0, body.pin),
            ids: [{_id: user._id, id: user.id, email: user.emails[0].value}],
        }]

        if(body.imageDelete) {
            request.push(({}))
            request[1]["$pull"] = {"files": {name: {$in: body.imageDelete}}}
        }
        // const path = "/tmp/uploads/" + req.file.filename;
        if(files) {
            files = files.map(file => {
                return ({
                    contentType: file.mimetype,
                    data: fs.readFileSync("/tmp/uploads/" + file.filename),
                    name: file.filename
                })
            })
            request[0]["$push"] = {"files": {$each: files}}
        }

        body.ids=body.ids.split(",")
        User.find({email: {$in: body.ids}}, (err, users) => {
            if(users) {
                request[0]["ids"]=users
            }
            getUrl(body.title, oldUrlBase, (url, urlBase) => {
                request[0].url = url
                request[0].urlBase = urlBase
                next(redirect, request)
            })
        })
    } else next(redirect, request)
}

app.route("/compose").get(authStuff, (req, res) => {
    if(req.options.admin) {
        html = "[Compiled code will appear here.]"
        res.render("blog/compose.ejs", {post: {}});
    } else {
        res.render("blog/404.ejs", {route: req.originalUrl}) // 404
    }
}).post(authStuff, upload.array('files'), (req, res) => {
    if(req.options.admin) {
        let now = Date.now();
        generateRequest(req.body, req.files, req.user, null, (redirect, request) => {
            request[0].date = now
            request[0].creator = {_id: req.user._id, id: req.user.id, email: req.user.emails[0].value}
    
            const post = new Post(request[0])
    
            post.save(err => {
                if(!err) {
                    redirectPost(redirect, request[0].url, res)
                }
            })
        })
    } else res.render("blog/404.ejs", {route: req.originalUrl}) // 404
})

app.route("/compose/:post").get(authStuff, (req, res) => {
    if(req.options.admin) {
        Post.findOne({url: encodeURIComponent(req.params.post)}, (err, post) => {
            if(post && post.ids.concat(post.creator).map(user => user.id).includes(req.user.id)) {
                html = htmlify(post.body)
                if(html === "") html = "[Compiled code will appear here.]"
                if(!err) {
                    res.render("blog/compose.ejs", {post: post, html: html})
                } else {
                    res.render("blog/404.ejs") // 404
                }
            } else res.render("blog/404.ejs", {route: req.originalUrl})// 404
        });
    } else res.render("blog/404.ejs", {route: req.originalUrl})// 404
}).post(authStuff, upload.array('files'), (req, res) => {
    // console.log(req.body);
    if(req.options.admin) {
        Post.findOne({url: encodeURIComponent(req.params.post)}, (err, post) => {
            if(post && post.ids.concat(post.creator).map(user => user.id).includes(req.user.id)) {
                generateRequest(req.body, req.files, req.user, post.urlBase, (redirect, request) => {
                    updateAndRedirect(encodeURIComponent(req.params.post), request, redirect, res)
                })
            } else res.render("blog/404.ejs", {route: req.originalUrl})// 404
        })
    } else res.render("blog/404.ejs", {route: req.originalUrl})// 404
})

app.get("/files/:post/:img", authStuff, (req, res) => {
    Post.findOne({url: encodeURIComponent(req.params.post)}, (err, post) => {
        const found = post.files.find(file => file.name === req.params.img)
        if(found) {
            res.writeHead(200, {
                'Content-Length': found.data.length,
                'Content-Type': found.contentType
            });
            res.end(found.data)
        } else res.render("blog/404.ejs", {route: req.originalUrl})
    })
})

// app.post("/compose/:post/image", authStuff, upload.array('files'), (req, res) => {
//     if(req.options.admin) {
//         let request = {"$push" : {"files": {$each: []}}}
//         for (item of req.files) {
//             request["$addToSet"]["files"]["$each"].push(item.filename)
//         }
//         updateAndRedirect(req.params.post, request, false, res)
//     } else res.render("blog/404.ejs", {route: req.params[0]})// 404
// })









// ******* CJLH stuffs

// THINGS TO CHANGE EACH MEET
/*

* nav bar (title only)
* const currentmeet
* add agenda file with same name as currentmeet
* add past meet to past_meets.js

*/

const cjlhroot = "/cjlh/"

const currentMeet = "phiday"

// lots of static pages to be served up

app.get(cjlhroot, (req, res) => {
    res.render("cjlh/index.ejs", {url: root + req.headers.host + cjlhroot});
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

app.get(cjlhroot + "agenda", (req, res) => {
    res.redirect(cjlhroot + "agendas/" + currentMeet);
})

app.get(cjlhroot + "agendas/:meet", (req, res) => {
    res.render("cjlh/agendas/" + req.params.meet + ".ejs", {url: root + req.headers.host + cjlhroot}, (err, result) => {
        if(err) {
            res.render("cjlh/404.ejs")
            console.log(err)
        } else {
            res.send(result)
        }
        // console.log(err, result)
    })
})

app.get(cjlhroot + "*", (req, res) => {
    res.render("cjlh/404.ejs")
})




// ************* CATCH-ALL 404

app.get("*", (req, res) => {
    res.render("blog/404.ejs", {route: req.originalUrl}) // 404
})

app.listen(process.env.PORT || 3000, (err) => {
    if (!err) console.log("successfully started on port 3000 or process.env.PORT");
    else console.log(err);

    // const dir = '/tmp/uploads/';

    // if (!fs.existsSync(dir)){
    //     fs.mkdirSync(dir);
    // }

    Post.find({title: "hello!"}, function (err, docs){
        for (doc of docs) {
            doc.url = encodeURIComponent(doc.title.toLowerCase().replace(/\s/g, "-"))
            doc.urlBase = encodeURIComponent(doc.title.toLowerCase().replace(/\s/g, "-"))
            doc.save();
        }
    });  
})