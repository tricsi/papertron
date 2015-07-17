/**
 * Client application
 */
window.onload = (function () {
    "use strict";

    var socket, //server connection
        myMatch, //actual game
        myMotor; //player's motor

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
    Motor.prototype.add = function() {
        this.data.unshift([this.x, this.y, this.vec, this.time]);
    };

    /**
     * Move motor to current direction
     * @param {number} toTime snapshot time
     */
    Motor.prototype.move = function(toTime) {
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
    Motor.prototype.back = function() {
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
    Motor.prototype.check = function(x1, y1, x2, y2) {
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
    Motor.prototype.wall = function(distance) {
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
    Bot.prototype.check = function() {
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
    Match.prototype.check = function (motor)
    {
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
    Match.prototype.ai = function() {
        this.bots.forEach(function(bot) {
            bot.check();
        });
    };

    /**
     * Runs all motor checks
     */
    Match.prototype.run = function () {
        var time = this.getTime(),
            motor,
            i;
        if (time > 0) {
            for (i = 0; i < this.motors.length; i++) {
                motor = this.motors[i];
                if (!motor.stuck) {
                    motor.move(time);
                    motor.stuck = this.check(motor);
                }
            }
        }
    };

    /**
     * Scene renderer module
     */
    var Scene = (function () {

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
            container.style.transform = "rotateX(45deg) translateY(100px) scale(1) rotateZ(" + rotate + "deg)";
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

        /**
         * Init scene
         */
        function init() {
            container = $("#container");
            canvas = $("canvas");
            ctx = canvas.getContext("2d");
            width = canvas.width;
            height = canvas.height;
            rotate = 0;
        }

        return {
            init: init,
            render: render,
            rotate: rotate
        };

    })();

    /**
     * Chat module
     */
    var Chat = (function () {

        var container, //chat form
            text, //chat input
            texts, //chat messages
            room; //players list

        /**
         * Show chat
         */
        function show() {
            container.className = "";
        }

        /**
         * Hide chat
         */
        function hide() {
            container.className = "hide";
        }

        /**
         * Add chat message
         * @param {string} message
         */
        function addMesage(message) {
            var br = document.createElement("br");
            texts.insertBefore(br, texts.firstChild);
            texts.insertBefore(document.createTextNode(message), br);
        }

        /**
         * Update room
         * @param {string[]} list
         */
        function setRoom(list) {
            room.innerHTML = "";
            list.forEach(function (nick) {
                room.appendChild(document.createTextNode(nick));
                room.appendChild(document.createElement("br"));
            });
        }

        /**
         * Bind chat events
         */
        function bind() {
            on(container, "submit", function (e) {
                var value = text.value.trim(),
                    nick = Menu.nick();
                if (value !== "") {
                    socket.emit("message", value);
                    addMesage(nick + ": " + value);
                }
                text.value = "";
                e.preventDefault();
            });
        }

        /**
         * Init chat
         */
        function init() {
            container = $("form");
            text = $("input", container);
            texts = $("div.texts", container);
            room = $("div.room", container);
            bind();
        }

        return {
            init: init,
            show: show,
            hide: hide,
            room: setRoom,
            add: addMesage
        };

    })();

    /**
     * Game menu
     */
    var Menu = (function () {

        var container, //menu container
            events, //menu events
            games, //game list
            nick, //nickname
            navs; //menu navigations

        /**
         * Add menu event
         * @param {string} event
         * @callback callback
         */
        function addEvent(event, callback) {
            events[event] = callback;
        }

        /**
         * Show menu
         */
        function show() {
            container.className = "";
            Chat.hide();
        }

        /**
         * Hide menu
         */
        function hide() {
            container.className = "hide";
            Chat.show();
        }

        /**
         * Get nickname
         */
        function getNick() {
            return nick.value.trim();
        }

        /**
         * Get game name
         */
        function getGame() {
            return games.value;
        }

        /**
         * Update game list
         * @param {string[]} list
         */
        function setGames(list) {
            while (games.options.length) {
                games.remove(0);
            }
            games.add(new Option("NEW GAME", "", true));
            list.forEach(function (game) {
                games.add(new Option(game + "'s game", game));
            });
        }

        /**
         * Bind menu events
         */
        function bind() {
            on(container, "click", function (e) {
                var i,
                    id,
                    item;
                if (e.target.tagName === "A") {
                    id = e.target.getAttribute("href").substr(1);
                    for (i = 0; i < navs.length; i++) {
                        item = navs.item(i);
                        if (item.id !== id) {
                            item.className = "hide";
                        } else {
                            item.className = "";
                        }
                    }
                }
                if (id in events) {
                    events[id].call(Menu);
                }
                e.preventDefault();
            });
        }

        /**
         * Module init
         */
        function init() {
            container = $("#menu");
            events = {};
            games = $("select", container);
            nick = $("input", container);
            navs = container.getElementsByTagName("nav");
            bind();
        }

        return {
            init: init,
            show: show,
            hide: hide,
            on: addEvent,
            nick: getNick,
            game: getGame,
            games: setGames
        };

    })();

    /**
     * Run animations and game logic
     */
    function anim() {
        requestAnimationFrame(anim);
        myMatch.run();
        Scene.render(myMatch, myMotor);
    }

    /**
     * Bind events
     */
    function bind() {

        Menu.on("join", function () {
            socket.emit("join", Menu.nick(), Menu.game());
        });

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

        on(document.body, "keydown", function (e) {
            switch (e.keyCode) {
                case 37:
                    myMotor.turn(Motor.LEFT);
                    Scene.rotate += 90;
                    e.preventDefault();
                    break;
                case 39:
                    myMotor.turn(Motor.RIGHT);
                    Scene.rotate -= 90;
                    e.preventDefault();
                    break;
            }
        });
    }

    /**
     * App init
     */
    return function () {
        myMatch = new Match();
        myMotor = myMatch.add(0, 100, Motor.UP);
        myMatch.add(0, -100, Motor.DOWN, true);
        myMatch.add(-100, 0, Motor.RIGHT, true);
        myMatch.add(100, 0, Motor.LEFT, true);
        Scene.init();
        Chat.init();
        Menu.init();
        socket = io();
        bind();
        //anim();
        setInterval(function () {
            myMatch.ai();
        }, 25);
    };

})();
