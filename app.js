var cluster = (net = require("net")),
  path = require("path"),
  http = require("http"),
  port = 8081;

startSingle();

function startSingle() {
  var secrets = require("./includes.js");
  var server;
  var bot = require("./bot.js");
  try {
    var cert_config = require("cert_config.js");
    var fs = require("fs");
    var privateKey = fs.readFileSync(secrets.cert.privateKey).toString();
    var certificate = fs.readFileSync(secrets.cert.certificate).toString();
    var ca = fs.readFileSync(secrets.cert.ca).toString();
    var credentials = {
      key: privateKey,
      cert: certificate,
      ca: ca
    };
    var https = require("https");
    server = https.Server(credentials, routingFunction);
  } catch (err) {
    console.log("Starting without https (probably on localhost)");
    server = http.createServer(routingFunction);
  }
  bot.connect();
  server.listen(port, onListen);
}

function onListen() {
  console.log("Started with pid [" + process.pid + "]");
}

function routingFunction(req, res, next) {
  var botInterface = require("./server.js");
  try {
    var url = req.headers["x-forwarded-host"]
      ? req.headers["x-forwarded-host"]
      : req.headers.host.split(":")[0];
    var subdomain = req.headers["x-forwarded-host"]
      ? req.headers["x-forwarded-host"].split(".")
      : req.headers.host.split(":")[0].split(".");

    if (subdomain.length > 1 && subdomain[0] == "bot") {
      botInterface(req, res, next);
    }
  } catch (e) {
    console.log("Bad request for " + req.headers.host + req.url, e);
    res.statusCode = 500;
    res.write("Bad request"); //write a response to the client
    res.end(); //end the response
  }
}
