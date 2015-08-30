var logic = require("./game.js"); //game.logic

var io = require("socket.io")(), //server
    games = [], //game list
    names = [], //nicknames
    store = {}; //game data

io.on("connect", function (socket) {

    var match; //actual match

    socket.nick = "Player";
    socket.game = null;

    /**
     * Game players nick
     */
    function nicks() {
        var list = [],
            game = socket.game;
        if (store[game]) {
            store[game].players.forEach(function(client) {
                list.push(client.nick);
            });
        }
        return list;
    }

    /**
     * Get match snapshot
     */
    function snapshot() {
        var game = socket.game;
        return store[game] && store[game].match
            ? store[game].match.save()
            : null;
    }

    /**
     * Thread run
     */
    function run() {
        var winner,
            stuck = [],
            data,
            game = store[socket.game];
        if (!game || !game.match) {
            return;
        }
        setTimeout(run, 1000 / game.match.timer);
        winner = match.run(function (id) {
            stuck.push(id);
            game.changed = true;
        });
        if (winner === false) {
            match.ai(function () {
                game.changed = true;
            });
        }
        if (game.changed) {
            data = snapshot();
            socket.emit("shot", data, stuck, winner);
            socket.to(socket.game).emit("shot", data, stuck, winner);
            game.changed = false;
        }
        if (winner !== false) {
            game.match = null;
            console.log(match.motors[winner].nick + " wins");
        }
    }

    /**
     * Remove nickname
     */
    function removeNick() {
        var index = names.indexOf(socket.nick);
        if (index >= 0) {
            names.splice(index, 1);
        }
    }

    /**
     * Leave game
     */
    function leave() {
        var nick = socket.nick,
            game = socket.game,
            players;
        if (game) {
            socket.game = null;
            players = store[game].players;
            players.splice(players.indexOf(socket), 1);
            console.log(nick + " leave " + game);
            if (players.length === 0) {
                games.splice(games.indexOf(game), 1);
                delete store[game];
                console.log("room deleted: " + game);
            } else {
                socket.to(game).emit("left", nick, nicks());
            }
        }
    }

    /**
     * Client disconnects
     */
    socket.on("disconnect", function () {
        leave();
        removeNick();
        console.log(socket.nick + " disconnected");
    });

    /**
     * Open game
     */
    socket.on("open", function (nick) {
        if (!nick || !nick.match(/^[0-9a-zA-Z]+$/)) {
            socket.emit("alert", "Invalid name!");
        } else if (names.indexOf(nick) >= 0) {
            socket.emit("alert", "Name exists!");
        } else {
            removeNick();
            names.push(nick);
            socket.nick = nick;
            socket.emit("open");
        }
    });

    /**
     * List games
     */
    socket.on("games", function () {
        socket.emit("games", games);
        console.log(socket.nick + " get games");
    });

    /**
     * Create new game
     */
    socket.on("create", function (game, params) {
        if (!game) {
            socket.emit("alert", "Invalid name!");
        } else if (games.indexOf(game) >= 0) {
            socket.emit("alert", "Game exists!");
        } else {
            socket.leave(socket.game);
            leave();
            games.push(game);
            store[game] = {
                params: params,
                players: [socket],
                changed: false
            };
            socket.join(game);
            socket.game = game;
            socket.emit("join", [socket.nick]);
            console.log(socket.nick + " created " + game);
        }
    });

    /**
     * Player join or create game
     */
    socket.on("join", function (game) {
        var list,
            nick = socket.nick;
        game = game || nick;
        if (nick && store[game] && store[game].players.indexOf(socket) === -1) {
            socket.join(game);
            socket.game = game;
            store[game].players.push(socket);
            list = nicks();
            socket.emit("join", list, snapshot(), store[game].params);
            socket.to(game).emit("joined", nick, list);
            console.log(nick + " join to " + game);
        }
    });

    /**
     * Player leave
     */
    socket.on("leave", function () {
        socket.leave(socket.game);
        leave();
    });

    /**
     * Chat message
     */
    socket.on("message", function (message) {
        if (socket.game) {
            socket.to(socket.game).emit("message", socket.nick, message);
            console.log(socket.nick + " message to " + socket.game);
        }
    });

    /**
     * Player start game
     */
    socket.on("start", function () {
        var i,
            data,
            bots,
            player,
            params,
            game = store[socket.game];
       if (game) {
            params = game.params;
            bots = params.bots;
            match = new logic.Match(params.mode);
            for (i = 0; i < game.players.length; i++) {
                player = game.players[i];
                player.motor = i < 4 ? match.add(player.nick) : false;
            }
            while (i++ < 4 && bots-- > 0) {
                player = match.add();
            }
            game.match = match;
            data = snapshot();
            game.players.forEach(function(client) {
                var id = client.motor ? client.motor.id : false;
                client.emit("start", data, id, params);
            });
            run();
            console.log(socket.nick + " started " + socket.game + " with bot number " + params.bots);
        }
    });

    /**
     * Player turn
     */
    socket.on("turn", function (to, time) {
        var motor;
        if (store[socket.game]) {
            motor = socket.motor;
            motor.move(time);
            motor.turn(to);
            store[socket.game].changed = true;
            console.log(socket.nick + " turn " + to + " at " + time);
        }
    });

    console.log(socket.nick + " connected");
});

module.exports = io;
