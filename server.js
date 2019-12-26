var express = require("express");
var app = express();

const path = require("path");
var exphbs = require("express-handlebars");
var hbs = exphbs.create({
  defaultLayout: __dirname + "/layouts/main",
  layoutsDir: __dirname + "/layouts",
  partialsDir: __dirname + "/partials"
});

var bot = require("./bot.js");
var mpromise = require("mpromise");
var mongojs = require("mongojs");
var secrets = require("./includes.js");
var crypto = require("crypto");
var dbase = mongojs(secrets.mongojs, ["channels"]);
var compression = require("compression");
var passport = require("passport");
var twitchStrategy = require("passport-twitch-new").Strategy;

app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");
app.use(compression({ filter: shouldCompress }));

function shouldCompress(req, res) {
  if (req.headers["x-no-compression"]) {
    // don't compress responses with this request header
    return false;
  }

  // fallback to standard filter function
  return compression.filter(req, res);
}
app.set("trust proxy", "127.0.0.1");

var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var cookieSession = require("cookie-session");
var referrerPolicy = require("referrer-policy");
var helmet = require("helmet");
var featurePolicy = require("feature-policy");
app.use(
  featurePolicy({
    features: {
      fullscreen: ["*"],
      //vibrate: ["'none'"],
      payment: ["'none'"],
      microphone: ["'none'"],
      camera: ["'none'"],
      speaker: ["*"],
      syncXhr: ["'self'"]
      //notifications: ["'self'"]
    }
  })
);
app.use(
  helmet({
    frameguard: false
  })
);

app.use("/assets", express.static(__dirname + "/assets"));
app.enable("view cache");
app.set("views", __dirname + "/layouts");
app.use(cookieParser());
app.use(cookieSession({ secret: secrets.cookieSession }));
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new twitchStrategy(
    {
      clientID: secrets.twitchConfig.clientID,
      clientSecret: secrets.twitchConfig.clientSecret,
      callbackURL: secrets.twitchConfig.redirectURI,
      scope: "user_read"
    },
    function(accessToken, refreshToken, profile, done) {
      dbase.channels.find({ channel: "#" + profile.login }, function(
        err,
        chan
      ) {
        if (chan.length > 0) {
          chan[0].twitchId = profile.id;
          if (
            chan[0].userpass != "" &&
            chan[0].userpass != undefined &&
            chan[0].userpass != null
          ) {
            chan[0].userpass = "userpass set";
          }
          if (
            chan[0].adminpass != "" &&
            chan[0].adminpass != undefined &&
            chan[0].adminpass != null
          ) {
            chan[0].adminpass = "adminpass set";
          }
          return done(err, chan[0]);
        } else {
          var upsertDocument = {
            channel: `#${profile.login}`,
            zoffchannel: "",
            zoffchannel_initialized: false,
            time: 0,
            twitchId: profile.id,
            adminpass: "",
            userpass: ""
          };
          dbase.channels.update(
            { channel: "#" + profile.login },
            upsertDocument,
            { upsert: true },
            function() {
              return done(err, upsertDocument);
            }
          );
        }
      });
    }
  )
);

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

app.get("/", function(req, res) {
  var data = {
    year: 2019
  };
  if (req.user) {
    dbase.channels.find({ channel: req.user.channel }, function(err, chan) {
      if (chan.length > 0) {
        if (chan[0].userpass != "" && chan[0].userpass != undefined) {
          chan[0].userpass = "userpass set";
        }
        if (chan[0].adminpass != "" && chan[0].adminpass != undefined) {
          chan[0].adminpass = "adminpass set";
        }
        data.user = chan[0];
      } else {
        data.user = req.user;
      }
      if (data.user.commands == undefined) {
        data.user.commands = [];
      }
      res.render("authenticated", data);
    });
  } else {
    res.render("not_authenticated", data);
  }
});

app.post("/saveCommand", function(req, res) {
  if (req.user) {
    dbase.channels.update(
      { channel: req.user.channel },
      { $pull: { commands: { key: req.body.key } } },
      function(err) {
        dbase.channels.update(
          { channel: req.user.channel },
          {
            $addToSet: {
              commands: { key: req.body.key, value: req.body.value.toString() }
            }
          },
          function(err) {
            if (err) {
              res.status(500).send({ error: true });
              return;
            }
            res.status(200).send({ error: false });
          }
        );
      }
    );
  } else {
    res.status(403).send({ error: true });
  }
});

app.post("/deleteCommand", function(req, res) {
  if (req.user) {
    dbase.channels.update(
      { channel: req.user.channel },
      { $pull: { commands: { key: req.body.key } } },
      function(err) {
        if (err) {
          res.status(500).send({ error: true });
          return;
        }
        res.status(200).send({ error: false });
      }
    );
  } else {
    res.status(403).send({ error: true });
  }
});

app.post("/save", function(req, res) {
  if (req.user) {
    if (req.body.saveObject.zoffchannel) {
      req.body.saveObject.zoffchannel_initialized = true;
    }
    if (req.body.saveObject.time != undefined) {
      try {
        req.body.saveObject.time = parseInt(req.body.saveObject.time);
      } catch (e) {
        res.status(500).send({ error: true });
        return;
      }
    }

    if (req.body.saveObject.adminpass != "") {
      req.body.saveObject.adminpass = crypto.encrypt(
        req.body.saveObject.adminpass
      );
    }

    if (req.body.saveObject.userpass != "") {
      req.body.saveObject.userpass = crypto.encrypt(
        req.body.saveObject.userpass
      );
    }

    dbase.channels.update(
      { channel: req.user.channel },
      { $set: req.body.saveObject },
      { upsert: true },
      function(err, docs) {
        if (!req.user.zoffchannel_initialized) {
          bot.join_channel_from_outside(
            req.user.channel,
            req.body.saveObject.zoffchannel
          );
        }
        res.status(200).send({ error: false, data: req.body });
      }
    );
  } else {
    res.status(403).send({ error: true });
  }
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

app.post("/delete", function(req, res) {
  if (req.user) {
    dbase.channels.remove({ channel: req.user.channel }, function(err, docs) {
      bot.leaveChannel(req.user.channel);
      res.status(200).send({ error: false });
    });
  } else {
    res.status(403).send({ error: true });
  }
});

app.get("/auth/twitch", passport.authenticate("twitch", { forceVerify: true }));
app.get(
  "/auth/twitch/callback",
  passport.authenticate("twitch", { failureRedirect: "/" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/");
  }
);

module.exports = app;
