"use strict";

var http = require("http"),
    fs = require("fs"),
    game = require("./src/server");

var port = Number(process.env.PORT || 3000),
    server,
    types = {
        appcache: "text/cache-manifest",
        css: "text/css",
        eot: "font/eot",
        gif: "image/gif",
        html: "text/html",
        js: "text/javascript",
        jpg: "image/jpeg",
        json: "application/json",
        manifest: "text/cache-manifest",
        otf: "font/otf",
        png: "image/png",
        svg: "image/svg+xml",
        svgz: "image/svg+xml",
        ttf: "font/ttf",
        webapp: "application/x-web-app-manifest+json",
        woff: "application/font-woff"
    };

// Simple static server
server = http.createServer(function(req, res) {
    var path = "./src" + req.url.replace(/^([^\?]+).*$/, "$1").replace(/\/$/, "/index.html"),
        match = path.match(/\.([a-z0-9]+)$/i),
        ext = match ? match[1].toLowerCase() : null,
        type = ext in types ? types[ext] : "text/plain";
    fs.exists(path, function(exists) {
        if (exists) {
            res.writeHead(200, {"Content-Type": type});
            res.end(fs.readFileSync(path));
        } else {
            res.writeHead(404);
            res.end();
        }
    });
});

// Bind Socket.IO
game.listen(server);

// Start server
server.listen(port, function(){
    console.log("Server listening on port " + port);
});
