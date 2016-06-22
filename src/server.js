var logic = require("./game.js"); //game.logic

var io = require("socket.io")(), //server
    lag = 0, //lag compensation
    games = [], //game list
    names = [], //nicknames
    store = {}; //game data

io.on("connect", function (socket) {

    /**
     * Game players nick
     */
    function nicks() {
        var list = [],
            game = socket.game;
        if (store[game]) {
            store[game].players.forEach(function(client) {
                list.push({
                    nick: client.nick,
                    wins: client.wins
                });
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
            crash = [],
            match,
            data,
            list = null,
            game = store[socket.game];
        if (!game || !game.match) {
            return;
        }
        match = game.match;
        setTimeout(run, match.timer);

        winner = match.run(function (id) {
            crash.push(id);
            game.changed = true;
        });

        if (winner === false) {
            match.ai(function () {
                game.changed = true;
            });
        } else if (match.motors.length) {
            game.players.forEach(function (client) {
                if (client.motor && client.motor.id === winner) {
                    client.wins++;
                    list = nicks();
                }
            });
        }

        if (game.changed) {
            data = snapshot();
            socket.emit("shot", data, crash, winner, list);
            socket.to(socket.game).emit("shot", data, crash, winner, list);
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
     * Update game list
     */
    function updateGames() {
        var name,
            game;
        games = [];
        for (name in store) {
            game = store[name];
            game.params.count = game.players.length;
            games.push(game.params);
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
            players = store[game].players;
            players.splice(players.indexOf(socket), 1);
            console.log(nick + " leave " + game);
            if (players.length === 0) {
                delete store[game];
                console.log("Game deleted: " + game);
            } else {
                socket.to(game).emit("room", nick, nicks(), "left");
            }
            socket.game = null;
            updateGames();
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
        if (!nick) {
            socket.emit("alert", "Invalid name!");
        } else if (names.indexOf(nick) >= 0) {
            socket.emit("alert", "Name exists!");
        } else {
            removeNick();
            names.push(nick);
            socket.nick = nick;
            socket.wins = 0;
            socket.game = null;
            socket.emit("open");
            console.log(nick + " connected");
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
    socket.on("create", function (params) {
        var game = params.name;
        if (!game) {
            socket.emit("alert", "Invalid name!");
        } else if (game in store) {
            socket.emit("alert", "Game exists!");
        } else {
            socket.leave(socket.game);
            leave();
            store[game] = {
                params: params,
                players: [socket],
                changed: false
            };
            socket.join(game);
            socket.game = game;
            socket.emit("join", nicks(), null, params);
            updateGames();
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
            socket.to(game).emit("room", nick, list, "joined");
            updateGames();
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
        var bots,
            data,
            params,
            game = store[socket.game];
        if (game) {
            params = game.params;
            if (!game.match) {
                game.match = new logic.Match(params.mode, params.map);
                game.players.forEach(function(client) {
                    client.motor = null;
                });
                socket.motor = game.match.add(socket.nick);
                bots = game.params.bots;
                while (bots-- > 0) {
                    game.match.add();
                }
                setTimeout(run, lag);
                console.log(socket.nick + " started " + socket.game + " with bot number " + params.bots);
            } else {
                socket.motor = game.match.add(socket.nick);
                console.log(socket.nick + " ready " + socket.game);
            }
            data = snapshot();
            game.players.forEach(function(client) {
                var id = client.motor ? client.motor.id : false;
                client.emit("start", data, id, params);
            });
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

});

module.exports = io;
