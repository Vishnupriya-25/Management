// jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();
 
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: 'Our little secret',
  resave: false,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/todolistDB", { useNewUrlParser: true });

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);;

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user._id);
  });
  
passport.deserializeUser(function (id, done) {
    User.findById(id)
    .then((user) => {
        done(null, user);
    })
    .catch((err) => {
        done(err, null);
    });
});
  

// passport.serializeUser(function(user, done) {
//     done(null, user._id);
// });
// passport.deserializeUser(function(id, done) {
//     User.findById(id, function(err, user) {
//         done(err, user);
//     });
// });

passport.use(new GoogleStrategy({
    clientID:     process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/management",
    passReqToCallback   : true,
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(request, accessToken, refreshToken, profile, done) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: [ "email", "profile" ] })
);

app.get( "/auth/google/management",
    passport.authenticate( 'google', {
        successRedirect: "/secrets",
        failureRedirect: "/login"
}));

app.get("/login", function (req, res) {
    res.render("login");
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/secrets", function (req, res) {
    // Find all users with non-null secrets
    User.find({"secret": {$ne: null}})
        .then((foundUsers) => {
            // Render the page with the found users
            res.render("secrets", { usersWithSecrets: foundUsers });
        })
        .catch((err) => {
            console.error(err);
        });
});

// app.get("/secrets", function (req, res) {
//     User.find({"secret": {$ne: null}})
//         .then((foundUsers) => {
//             res.render("secrets", { usersWithSecrets: foundUsers });
//         })
//         .catch((err) => {
//             console.error(err);
//         });
// });

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", async function(req, res) {
    // Check if the user is authenticated before processing the submission
    if (!req.isAuthenticated()) {
        return res.redirect("/login");
    }
    const submittedSecret = req.body.secret;
    
    try {
        const foundUser = await User.findById(req.user.id);
        if (foundUser) {
            foundUser.secret = submittedSecret;
            await foundUser.save();
            res.redirect("/secrets");
        }
    } catch (err) {
        console.error(err);
    }
    //console.log(req.user.id);

    // User.findById(req.user.id)
    //     .then((foundUser) => {
    //         if (foundUser) {
    //             foundUser.secret = submittedSecret;
    //             return foundUser.save();
    //         }
    //     })
    //     .then(() => {
    //         res.redirect("/secrets");
    //     })
    //     .catch((err) => {
    //         console.log(err);
    //     });
});

app.get("/logout", function(req, res) {
    req.logout(function() {
        res.redirect("/");
    });
    // req.logout();
    // res.redirect("/");
});

app.post("/register", function (req, res) {
    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    });
});

// Implement the login route to handle user authentication
app.post("/login", function (req, res) {
    const user = new User({
        username : req.body.username ,
        password : req.body.password
    });
    req.login(user, function (err) {
        if (err) {
            console.log(err);
            //res.redirect("/login");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    });
});


app.listen(3000, function () {
    console.log("Server started on port 3000");
});
