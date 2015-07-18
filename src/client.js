/**
 * Client application
 */
window.onload = (function () {
    "use strict";

    var socket, //server connection
        Scene, //Game scene module
        Sfx, //Sound module
        Chat, //Chat module
        Game, //Game module
        Menu; //Menu module

    /**
     * Query selector helper
     * @param {string} query
     * @param {Object} element
     */
    function $(query, element) {
        element = element || document;
        return element.querySelector(query);
    }

    /**
     * Event handler helper
     * @param {Object} element
     * @param {string} event
     * @callback handler
     */
    function on(element, event, handler) {
        element.addEventListener(event, handler, false);
    }

    /**
     * Attribute helper
     * @param {Object} element
     * @param {string} name
     * @param {string} value
     */
    function attr(element, name, value) {
        if (value !== undefined) {
            element.setAttribute(name, value);
        }
        return element.getAttribute(name);
    }

    /**
     * Motor class
     * @param {number} x Coordinate
     * @param {number} y Coordinate
     * @param {number} vec Direction
     * @param {number} id Motor ID
     * @constructor
     */
    function Motor(x, y, vec, id) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vec = vec;
        this.time = 0; // Time
        this.data = []; // Line data
        this.stuck = false;
        this.add();
    }

    /**
     * Direction values
     * @type {number}
     */
    Motor.UP = 0;
    Motor.RIGHT = 1;
    Motor.DOWN = 2;
    Motor.LEFT = 3;

    /**
     * Add current coordinates to data array
     */
    Motor.prototype.add = function () {
        this.data.unshift([this.x, this.y, this.vec, this.time]);
    };

    /**
     * Move motor to current direction
     * @param {number} toTime snapshot time
     */
    Motor.prototype.move = function (toTime) {
        var lastTime = this.data[0][3],
            addTime = toTime - lastTime;
        this.x = this.data[0][0];
        this.y = this.data[0][1];
        this.vec = this.data[0][2];
        switch (this.vec) {
            case Motor.LEFT:
                this.x -= addTime;
                break;
            case Motor.RIGHT:
                this.x += addTime;
                break;
            case Motor.UP:
                this.y -= addTime;
                break;
            case Motor.DOWN:
                this.y += addTime;
                break;
        }
        this.time = toTime;
    };

    /**
     * Turn motor to left or right direction
     * @param to
     */
    Motor.prototype.turn = function (to) {
        switch (to) {
            case Motor.LEFT:
                if (--this.vec < Motor.UP) {
                    this.vec = Motor.LEFT;
                }
                this.add();
                break;
            case Motor.RIGHT:
                if (++this.vec > Motor.LEFT) {
                    this.vec = Motor.UP;
                }
                this.add();
                break;
        }
    };

    /**
     * Go back to previous point
     */
    Motor.prototype.back = function () {
        this.x = this.data[0][0];
        this.y = this.data[0][1];
        this.vec = this.data[0][2];
        this.time = this.data[0][3];
        this.data.shift();
    };

    /**
     * Check line segment collation
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @returns {boolean}
     */
    Motor.prototype.check = function (x1, y1, x2, y2) {
        var x3 = this.x,
            y3 = this.y,
            x4 = this.data[0][0],
            y4 = this.data[0][1],
            d, n1, n2, r, s;
        if (x3 !== x4 || y3 !== y4) { //not line
            d = ((x2 - x1) * (y4 - y3)) - ((y2 - y1) * (x4 - x3));
            n1 = ((y1 - y3) * (x4 - x3)) - ((x1 - x3) * (y4 - y3));
            n2 = ((y1 - y3) * (x2 - x1)) - ((x1 - x3) * (y2 - y1));
            if (d !== 0) { //not parallel
                r = n1 / d;
                s = n2 / d;
                return (r >= 0 && r <= 1) && (s >= 0 && s <= 1);
            } else if (n1 === 0 && n2 === 0) { //overlap
                switch (this.vec) {
                    case Motor.LEFT:
                    case Motor.RIGHT:
                        return (x1 >= x4 && x2 <= x4) ||
                            (x2 >= x4 && x1 <= x4) ||
                            (x1 >= x3 && x2 <= x3) ||
                            (x2 >= x3 && x1 <= x3);
                    case Motor.UP:
                    case Motor.DOWN:
                        return (y1 >= y4 && y2 <= y4) ||
                            (y2 >= y4 && y1 <= y4) ||
                            (y1 >= y3 && y2 <= y3) ||
                            (y2 >= y3 && y1 <= y3);
                }
            }
        }
        return false;
    };

    /**
     * Check wall collation
     * @param {number} distance
     * @returns {boolean}
     */
    Motor.prototype.wall = function (distance) {
        return this.x > distance || this.x < -distance || this.y > distance || this.y < -distance;
    };

    /**
     * Robot driver
     * @param {Motor} motor
     * @param {Match} match
     * @constructor
     */
    function Bot(motor, match) {
        this.motor = motor;
        this.match = match;
    }

    /**
     * Check and set next movement
     */
    Bot.prototype.check = function () {
        var motor = this.motor,
            match = this.match,
            time = motor.time,
            dir = Math.random() >= .5,
            toTime = time + 10 + Math.round(Math.random() * 10);
        if (!motor.stuck) {
            motor.move(toTime);
            if (match.check(motor)) {
                motor.move(time);
                motor.turn(dir ? Motor.RIGHT : Motor.LEFT);
                motor.move(toTime);
                if (match.check(motor)) {
                    motor.back();
                    motor.turn(dir ? Motor.LEFT : Motor.RIGHT);
                    motor.move(toTime);
                    if (match.check(motor)) {
                        motor.back();
                    }
                }
            }
            motor.move(time);
        }
    };

    /**
     * Game match class
     * @constructor
     */
    function Match() {
        this.timer = 25; // Snapshot time
        this.distance = 125; // Wall distance
        this.start = new Date().getTime() + 2000; // Start time
        this.motors = []; // Motors
        this.bots = []; // Robots
        this.win = false;
    }

    /**
     * Create new motor
     * @param {number} x Coordinate
     * @param {number} y Coordinate
     * @param {number} vec Direction
     * @param {boolean} isBot
     * @returns {Motor}
     */
    Match.prototype.add = function (x, y, vec, isBot) {
        var motor = new Motor(x, y, vec, this.motors.length);
        this.motors.push(motor);
        if (isBot) {
            this.bots.push(new Bot(motor, this));
        }
        return motor;
    };

    /**
     * Check motor collations
     * @param {Motor} motor
     * @returns {boolean}
     */
    Match.prototype.check = function (motor) {
        var result = motor.wall(this.distance);
        if (!result) {
            this.motors.forEach(function (other) {
                var x = other.x,
                    y = other.y,
                    i = 0,
                    item;
                while (!result && i < other.data.length) {
                    item = other.data[i];
                    switch (item[2]) {
                        case Motor.LEFT:
                            x++;
                            break;
                        case Motor.RIGHT:
                            x--;
                            break;
                        case Motor.UP:
                            y++;
                            break;
                        case Motor.DOWN:
                            y--;
                            break;
                    }
                    if (i > 0 || other !== motor) { //skip self check
                        result = motor.check(x, y, item[0], item[1]);
                    }
                    x = item[0];
                    y = item[1];
                    i++;
                }
            });
        }
        return result;
    };

    /**
     * Get current snapshot time
     * @returns {number}
     */
    Match.prototype.getTime = function () {
        return Math.round((new Date().getTime() - this.start) / this.timer);
    };

    /**
     * Runs all robot checks
     */
    Match.prototype.ai = function () {
        this.bots.forEach(function (bot) {
            bot.check();
        });
    };

    /**
     * Runs all motor checks
     */
    Match.prototype.run = function () {
        var time = this.getTime(),
            result = false,
            count = 0,
            winner,
            motor,
            i;
        if (time > 0) {
            for (i = 0; i < this.motors.length; i++) {
                motor = this.motors[i];
                if (motor.stuck) {
                    count++;
                } else {
                    motor.move(time);
                    if (this.check(motor)) {
                        motor.stuck = time;
                        result = true;
                        count++;
                    } else {
                        winner = i;
                    }
                }
            }
            if (count >= i - 1 && count > 0) {
                this.win = winner || 0;
                console.log("winner " + this.win);
            }
        }
        return result;
    };

    /**
     * Scene renderer module
     */
    Scene = (function () {

        var container,  //canvas container
            canvas, //canvas element
            ctx, //canvas context
            width,  //canvas width
            height, //canvas height
            rotate, //canvas rotation
            colors = ["#00c", "#c00", "#0f0", "#f0c"]; //motor colors

        /**
         * Render 2D scene
         * @param {Match} match
         * @param {Motor} motor
         */
        function render(match, me) {
            container.style.transform = "rotateX(45deg) translateY(100px) scale(1.5) rotateZ(" + rotate + "deg)";
            canvas.style.transform = "translate(" + (-me.x * 2) + "px," + (-me.y * 2) + "px)";
            ctx.save();
            ctx.clearRect(0, 0, width, height);
            ctx.translate(Math.round(width / 2), Math.round(height / 2));
            match.motors.forEach(function (motor, color) {
                ctx.save();
                //Lines
                ctx.beginPath();
                ctx.scale(2, 2);
                ctx.moveTo(motor.x, motor.y);
                for (var i = 0; i < motor.data.length; i++) {
                    ctx.lineTo(motor.data[i][0], motor.data[i][1]);
                }
                ctx.strokeStyle = colors[color];
                ctx.stroke();
                //Arrow
                ctx.beginPath();
                ctx.translate(motor.x, motor.y);
                ctx.rotate(motor.vec / 2 * Math.PI);
                ctx.moveTo(0, -1);
                ctx.lineTo(1.5, 3);
                ctx.lineTo(-1.5, 3);
                ctx.closePath();
                ctx.fillStyle = colors[color];
                ctx.fill();
                ctx.restore();
            });
            ctx.restore();
        }

        return {

            /**
             * Init scene
             */
            init: function init() {
                container = $("#container");
                canvas = $("canvas");
                ctx = canvas.getContext("2d");
                width = canvas.width;
                height = canvas.height;
                rotate = 0;
            },

            rotate: function (value, reset) {
                rotate = reset ? value : rotate + value;
            },

            render: render
        };

    })();

    /**
     * Chat module
     */
    Chat = (function () {

        var container, //chat form
            text, //chat input
            texts, //chat messages
            room; //players list

        return {

            /**
             * Module init
             */
            init: function () {
                container = $("#chat");
                text = $("input", container);
                texts = $(".texts", container);
                room = $(".room", container);
                on(container, "submit", function (e) {
                    var value = text.value.trim(),
                        nick = Menu.nick();
                    if (value !== "") {
                        socket.emit("message", value);
                        Chat.add(nick + ": " + value);
                    }
                    text.value = "";
                    e.preventDefault();
                });
            },

            /**
             * Set room members
             * @param {string[]} list
             */
            room: function (list) {
                room.innerHTML = "";
                list.forEach(function (nick) {
                    room.appendChild(document.createTextNode(nick));
                    room.appendChild(document.createElement("br"));
                });
                Game.players = list;
            },

            /**
             * Add new message
             * @param {string} message
             */
            add: function (message) {
                var br = document.createElement("br");
                texts.insertBefore(br, texts.firstChild);
                texts.insertBefore(document.createTextNode(message), br);
            },

            /**
             * Show chat
             */
            show: function () {
                attr(container, "class", "");
            },

            /**
             * Hide chat
             */
            hide: function () {
                attr(container, "class", "hide");
            }
        };

    })();

    /**
     * Game menu
     */
    Menu = (function () {

        var container, //menu container
            games, //game list
            nick; //nickname

        return {

            /**
             * Module init
             */
            init: function () {
                container = $("#menu");
                games = $("select", container);
                nick = $("input", container);
                on(container, "click", function (e) {
                    var id = attr(e.target, "href");
                    switch (id) {
                        case "#join":
                            socket.emit("join", Menu.nick(), Menu.game());
                            break;
                    }
                    console.log(id);
                });
            },

            /**
             * Show menu
             */
            show: function () {
                socket.emit("games");
                attr(container, "class", "");
                Game.hide();
                Chat.hide();
            },

            /**
             * Hide menu
             */
            hide: function () {
                var game = Menu.game() || Menu.nick();
                attr(container, "class", "hide");
                Game.show(game + "'s game");
                Chat.show();
            },

            /**
             * Get nickname
             * @return string
             */
            nick: function () {
                return nick.value.trim();
            },

            /**
             * Get game name
             * @return string
             */
            game: function () {
                return games.value;
            },

            /**
             * Set games list
             * @param {string[]} list
             */
            games: function (list) {
                while (games.options.length) {
                    games.remove(0);
                }
                games.add(new Option("NEW GAME", ""));
                list.forEach(function (game) {
                    games.add(new Option(game + "'s game", game));
                });
                games.selectedIndex = 0;
            }
        };

    })();

    Sfx = (function () {

        var sounds;

        return {
            init: function () {
                sounds = {
                    exp: new Audio(jsfxr([3, , 0.1608, 0.5877, 0.4919, 0.1058, , , , , , , , , , 0.7842, -0.1553, -0.2125, 1, , , , , 0.5])),
                    btn: new Audio(jsfxr([0, , 0.0373, 0.3316, 0.1534, 0.785, , , , , , , , , , , , , 1, , , , , 0.5])),
                    turn: new Audio(jsfxr([1, , 0.18, , 0.1, 0.3465, , 0.2847, , , , , , 0.4183, , , , , 0.5053, , , , , 0.5]))
                };
            },
            play: function (name) {
                sounds[name].play();
            }
        };

    })();

    Game = (function () {

        var container, //game container
            match, //actual match
            motor, //player's motor
            ai; //ai timer

        /**
         * Run animations and game logic
         */
        function run() {
            if (match.run()) {
                Sfx.play("exp");
            }
            Scene.render(match, motor);
            if (match.win === false) {
                requestAnimationFrame(run);
            } else {
                Game.show(Game.players[match.win] + " win!");
                clearInterval(ai);
            }
        }

        return {

            /**
             * Module init
             */
            init: function () {
                container = $("#game");
                on(container, "click", function (e) {
                    var id = attr(e.target, "href");
                    switch (id) {
                        case "#start":
                            Game.start(0, true);
                            break;
                        case "#leave":
                            socket.emit("leave");
                            Menu.show();
                            break;
                    }
                    console.log(id);
                });
                on(document.body, "keydown", function (e) {
                    switch (e.keyCode) {
                        case 37:
                            if (Game.turn(Motor.LEFT)) {
                                Scene.rotate(90);
                            }
                            break;
                        case 39:
                            if (Game.turn(Motor.RIGHT)) {
                                Scene.rotate(-90);
                            }
                            break;
                    }
                });
            },

            /**
             * Player names
             */
            players: [],

            /**
             * Start new match
             */
            start: function (bots, server) {
                var me = Menu.nick(),
                    pos = [
                        [0, 100, Motor.UP],
                        [0, -100, Motor.DOWN],
                        [-100, 0, Motor.RIGHT],
                        [100, 0, Motor.LEFT]
                    ];

                match = new Match();

                Game.players.forEach(function (nick, i) {
                    var x = pos[i][0],
                        y = pos[i][1],
                        v = pos[i][2],
                        player = match.add(x, y, v);
                    if (nick === me) {
                        Scene.rotate(v * -90, true);
                        motor = player;
                    }
                });

                if (server) {
                    socket.emit("start", bots);
                    ai = setInterval(function () {
                        match.ai();
                    }, 25);
                }
                run();

                Game.hide();
            },

            /**
             * Turn motor
             */
            turn: function (to, time, id) {
                var player;
                if (!match || match.win !== false) {
                    return false;
                }
                player = match.motors[id] || motor;
                time = time || match.getTime();
                if (!player || time < 1) {
                    return false;
                }
                if (id === undefined) {
                    if (player.stuck) {
                        return false;
                    }
                    socket.emit("turn", to, time);
                }
                player.move(time);
                player.turn(to);
                Sfx.play("turn");
                return true;
            },

            /**
             * Show game
             */
            show: function (title) {
                $("h1", container).innerHTML = title;
                attr(container, "class", "");
            },

            /**
             * Hide game
             */
            hide: function () {
                attr(container, "class", "hide");
            }
        };

    })();

    /**
     * Bind events
     */
    function bind() {

        socket.on("connect", function () {
            socket.emit("games");
        });

        socket.on("games", function (list) {
            Menu.games(list);
        });

        socket.on("join", function (list) {
            Menu.hide();
            Chat.room(list);
        });

        socket.on("joined", function (nick, list) {
            Chat.add(nick + " joined");
            Chat.room(list);
        });

        socket.on("left", function (nick, list) {
            Chat.add(nick + " left");
            Chat.room(list);
        });

        socket.on("message", function (nick, text) {
            Chat.add(nick + ": " + text);
        });

        socket.on("start", function (bots) {
            Game.start(bots, false);
        });

        socket.on("turn", function (to, time, id) {
            Game.turn(to, time, id);
        });

        on(document.body, "click", function (e) {
            switch (e.target.tagName) {
                case "A":
                    Sfx.play("btn");
                    break;
            }
        });
    }

    /**
     * App init
     */
    return function () {
        Sfx.init();
        Scene.init();
        Chat.init();
        Menu.init();
        Game.init();
        socket = io();
        bind();
    };

})();
