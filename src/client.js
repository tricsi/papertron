/* global io */
/* global jsfxr */
var socket, //server connection
    Scene, //Game scene module
    Sfx, //Sound module
    Chat, //Chat module
    Game, //Game module
    Menu, //Menu module
    logic; //Game logic

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
 * Send network message
 */
function emit() {
    if (socket) {
        socket.emit.apply(socket, arguments);
    }
}

Game = (function () {

    var container, //game container
        bots, //robot select
        match, //actual match
        motor, //player's motor
        running; //match running

    /**
     * Run animations and game logic
     */
    function run() {
        match.run();
        Scene.anim();
        Scene.render(match, motor);
        if (running) {
            requestAnimationFrame(run);
        }
    }

    return {

        /**
         * Module init
         */
        init: function () {
            container = $("#game");
            bots = $("select", container);
            on(container, "click", function (e) {
                var id = attr(e.target, "href");
                switch (id) {
                    case "#start":
                        emit("start", parseInt(bots.value));
                        break;
                    case "#leave":
                        emit("leave");
                        Menu.show();
                        break;
                }
                e.preventDefault();
            });
            on(document.body, "keydown", function (e) {
                switch (e.keyCode) {
                    case 37:
                        if (Game.turn(logic.Motor.LEFT)) {
                            Scene.turn(logic.Motor.LEFT);
                        }
                        break;
                    case 39:
                        if (Game.turn(logic.Motor.RIGHT)) {
                            Scene.turn(logic.Motor.RIGHT);
                        }
                        break;
                }
            });
            on($(".texts"), "touchstart", function() {
                if (Game.turn(logic.Motor.LEFT)) {
                    Scene.turn(logic.Motor.LEFT);
                }
            });
            on($(".room"), "touchstart", function() {
                if (Game.turn(logic.Motor.RIGHT)) {
                    Scene.turn(logic.Motor.RIGHT);
                }
            });
        },

        /**
         * Start new match
         */
        start: function (snapshot, id) {
            match = new logic.Match();
            match.load(snapshot);
            motor = match.motors[id] || null;
            Scene.rotate(motor ? motor.vec * -90 : 0);
            running = true;
            run();
        },

        /**
         * Stops game
         */
        stop: function () {
            running = false;
        },

        /**
         * Turn motor
         */
        turn: function (to, time, id) {
            var player;
            if (!match) {
                return false;
            }
            player = match.motors[id] || motor;
            time = time || match.getTime();
            if (!player || player.stuck || time < 1) {
                return false;
            }
            if (id === undefined) {
                emit("turn", to, time, id);
            }
            player.move(time);
            player.turn(to);
            Sfx.play("turn");
            return true;
        },

        /**
         * Load snapshot data
         * @params {array} snapshot
         */
        load: function (snapshot) {
            if (match) {
                match.load(snapshot);
            }
        },

        /**
         * Show game
         */
        show: function (winner) {
            $("h1", container).innerHTML = winner !== undefined
                ? match.motors[winner].nick + " wins!"
                : "New Game";
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
 * Scene renderer module
 */
Scene = (function () {

    var canvas, //canvas object
        gl, //WebGL context
        shaderProgram, //shader program
        vertexShader, //vertex shader
        fragmentShader, //fragment shader
        colorLocation, //color location param
        matrixLocation, //matrix location param
        positionLocation, //position location param
        normalsLocation, //lighting normal vectors
        normalLocation, //light normal
        fieldOfViewRadians, //FOV param
        aspectRatio,
        rotateFrom,
        rotateTo,
        colors = [
            [255, 0, 0],
            [0, 255, 0],
            [0, 0, 255],
            [255, 0, 255]
        ],
        Bikes = [],
        Board;

    function createShader(script, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, script);

        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
        }
        return shader;
    }

    function createProgram(shaders) {
        var program = gl.createProgram();
        for (var i = 0; i < shaders.length; i++) {
            gl.attachShader(program, shaders[i]);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.deleteProgram(program);
        } else {
            gl.useProgram(program);
        }
        return program;
    }

    function makePerspective(fieldOfViewInRadians, aspect, near, far) {
        var f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewInRadians),
            rangeInv = 1.0 / (near - far);
        return [
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0
        ];
    }

    function makeTranslation(tx, ty, tz) {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            tx, ty, tz, 1
        ];
    }

    function makeXRotation(angleInRadians) {
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);
        return [
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1
        ];
    }

    function makeYRotation(angleInRadians) {
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);
        return [
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 0, 1
        ];
    }

    function makeZRotation(angleInRadians) {
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);
        return [
            c, s, 0, 0,
            -s, c, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    }

    function makeScale(sx, sy, sz) {
        return [
            sx, 0, 0, 0,
            0, sy, 0, 0,
            0, 0, sz, 0,
            0, 0, 0, 1
        ];
    }

    function matrixMultiply(a, b) {
        var a00 = a[0 * 4 + 0],
            a01 = a[0 * 4 + 1],
            a02 = a[0 * 4 + 2],
            a03 = a[0 * 4 + 3],
            a10 = a[1 * 4 + 0],
            a11 = a[1 * 4 + 1],
            a12 = a[1 * 4 + 2],
            a13 = a[1 * 4 + 3],
            a20 = a[2 * 4 + 0],
            a21 = a[2 * 4 + 1],
            a22 = a[2 * 4 + 2],
            a23 = a[2 * 4 + 3],
            a30 = a[3 * 4 + 0],
            a31 = a[3 * 4 + 1],
            a32 = a[3 * 4 + 2],
            a33 = a[3 * 4 + 3],
            b00 = b[0 * 4 + 0],
            b01 = b[0 * 4 + 1],
            b02 = b[0 * 4 + 2],
            b03 = b[0 * 4 + 3],
            b10 = b[1 * 4 + 0],
            b11 = b[1 * 4 + 1],
            b12 = b[1 * 4 + 2],
            b13 = b[1 * 4 + 3],
            b20 = b[2 * 4 + 0],
            b21 = b[2 * 4 + 1],
            b22 = b[2 * 4 + 2],
            b23 = b[2 * 4 + 3],
            b30 = b[3 * 4 + 0],
            b31 = b[3 * 4 + 1],
            b32 = b[3 * 4 + 2],
            b33 = b[3 * 4 + 3];
        return [
            a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30,
            a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31,
            a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32,
            a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33,
            a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30,
            a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31,
            a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32,
            a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33,
            a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30,
            a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31,
            a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32,
            a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33,
            a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30,
            a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31,
            a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32,
            a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33
        ];
    }

    function matrixInverse(mat, dest) {
        var a00 = mat[0], a01 = mat[1], a02 = mat[2],
            a10 = mat[4], a11 = mat[5], a12 = mat[6],
            a20 = mat[8], a21 = mat[9], a22 = mat[10],

            b01 = a22 * a11 - a12 * a21,
            b11 = -a22 * a10 + a12 * a20,
            b21 = a21 * a10 - a11 * a20,

            d = a00 * b01 + a01 * b11 + a02 * b21,
            id;

        if (!d) { return null; }
        id = 1 / d;

        dest[0] = b01 * id;
        dest[1] = (-a22 * a01 + a02 * a21) * id;
        dest[2] = (a12 * a01 - a02 * a11) * id;
        dest[3] = b11 * id;
        dest[4] = (a22 * a00 - a02 * a20) * id;
        dest[5] = (-a12 * a00 + a02 * a10) * id;
        dest[6] = b21 * id;
        dest[7] = (-a21 * a00 + a01 * a20) * id;
        dest[8] = (a11 * a00 - a01 * a10) * id;

        return dest;
    }

    function matrixTranspose(a) {
        var a01 = a[1], a02 = a[2], a12 = a[5];
        a[1] = a[3];
        a[2] = a[6];
        a[3] = a01;
        a[5] = a[7];
        a[6] = a02;
        a[7] = a12;
        return a;
    }

    function createPart(x1, y1, x2, y2, v, s, z, end) {
        var xa = 0,
            ya = 0,
            xb = 0,
            yb = 0,
            xn = 0,
            yn = 0,
            data = {};
        switch (v) {
            case 0:
                xa = s;
                yb = s;
                xn = 1;
                yn = 1;
                break;
            case 1:
                ya = -s;
                xb = s;
                xn = 1;
                yn = -1;
                break;
            case 2:
                xa = -s;
                yb = -s;
                xn = -1;
                yn = -1;
                break;
            case 3:
                ya = s;
                xb = -s;
                xn = -1;
                yn = 1;
                break;
        }
        data.vert = [
            x1 + xa + xb, y1 + ya + yb, 0,
            x1, y1, z,
            x2, y2, z,
            x1 - xa + xb, y1 - ya + yb, 0,
            x2 + xa - xb, y2 + ya - yb, 0,
            x2 - xa - xb, y2 - ya - yb, 0
        ];
        data.norm = [
            xn, yn, s,
            0, 0, 1,
            0, 0, 1,
            -xn, yn, s,
            xn, -yn, s,
            -xn, -yn, s
        ];
        data.idx = [
            0, 1, 2,
            3, 2, 1,
            4, 0, 2,
            5, 2, 3
        ];
        if (end & 1) {
            data.idx.push(0, 3, 1);
        }
        if (end & 2) {
            data.idx.push(4, 2, 5);
        }
        return data;
    }

    function createLine(motor, color, dec, onturn) {
        var i,
            j,
            k,
            end,
            part,
            dots = motor.data,
            data = {
                color: color,
                vert: [],
                norm: [],
                idx: []
            },
            x = motor.x,
            y = motor.y,
            t = motor.time - dots[0][3],
            s = 0;

        if (t < dec) {
            if (dots.length < 2) {
                return null;
            }
            s = 1;
            t = dec - t - .5;
            x = dots[0][0];
            y = dots[0][1];
            switch (dots[0][2] - dots[1][2]) {
                case -1:
                case 3:
                    onturn.call(Scene, -t / dec);
                    break;
                case 1:
                case -3:
                    onturn.call(Scene, t / dec);
                    break;
            }

        } else {
            t = dec;
        }

        switch (dots[s][2]) {
            case 0:
                y += t;
                break;
            case 1:
                x -= t;
                break;
            case 2:
                y -= t;
                break;
            case 3:
                x += t;
                break;
        }

        for (i = s; i < dots.length; i++) {
            j = data.vert.length / 3;
            end = 0;
            if (i === s) {
                end = 1;
            }
            if (i === dots.length - 1) {
                end = end | 2;
            }
            part = createPart(x, -y, dots[i][0], -dots[i][1], dots[i][2], .3, 2, end);
            data.vert = data.vert.concat(part.vert);
            data.norm = data.norm.concat(part.norm);
            for (k = 0; k < part.idx.length; k++) {
                data.idx.push(part.idx[k] + j);
            }
            x = dots[i][0];
            y = dots[i][1];
        }
        return data;
    }

    function createModel(data) {
        var model = {
                scale: [1, 1, 1],
                trans: [0, 0, 0],
                rotate: [0, 0, 0]
            },
            color = [],
            i;

        //normals
        model.norm = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, model.norm);
        gl.enableVertexAttribArray(normalsLocation);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.norm), gl.STATIC_DRAW);

        //coordinates
        model.vert = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, model.vert);
        gl.enableVertexAttribArray(positionLocation);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vert), gl.STATIC_DRAW);

        //colors
        for (i = 0; i < data.vert.length; i++) {
            color.push(data.color[i % data.color.length]);
        }

        model.color = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, model.color);
        gl.enableVertexAttribArray(colorLocation);
        gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(color), gl.STATIC_DRAW);

        //index
        model.idx = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.idx);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.idx), gl.STATIC_DRAW);
        model.size = data.idx.length;

        return model;
    }

    function resize() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        aspectRatio = canvas.width / canvas.height;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function renderObject(model, x, y, angle) {
        var matrix,
            normal = [
                0, 0, 0,
                0, 0, 0,
                0, 0, 0
            ];

        matrix = makeScale(model.scale[0], model.scale[1], model.scale[2]);
        matrix = matrixMultiply(matrix, makeZRotation(model.rotate[2]));
        matrix = matrixMultiply(matrix, makeXRotation(model.rotate[0]));
        matrix = matrixMultiply(matrix, makeYRotation(model.rotate[1]));
        matrix = matrixMultiply(matrix, makeTranslation(model.trans[0], model.trans[1], model.trans[2]));

        normal = matrixInverse(matrix, normal);
        normal = matrixTranspose(normal, normal);

        matrix = matrixMultiply(matrix, makeTranslation(x, y, 0));
        matrix = matrixMultiply(matrix, makeZRotation(Math.PI / 180 * angle));
        matrix = matrixMultiply(matrix, makeXRotation(-1));
        matrix = matrixMultiply(matrix, makeTranslation(0, 0, -50));
        matrix = matrixMultiply(matrix, makePerspective(fieldOfViewRadians, aspectRatio, 1, 2000));

        gl.uniformMatrix4fv(matrixLocation, false, matrix);
        gl.uniformMatrix3fv(normalLocation, false, normal);

        //normals
        gl.bindBuffer(gl.ARRAY_BUFFER, model.norm);
        gl.vertexAttribPointer(normalsLocation, 3, gl.FLOAT, false, 0, 0);

        //coordinates
        gl.bindBuffer(gl.ARRAY_BUFFER, model.vert);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

        //colors
        gl.bindBuffer(gl.ARRAY_BUFFER, model.color);
        gl.vertexAttribPointer(colorLocation, 3, gl.UNSIGNED_BYTE, true, 0, 0);

        //index
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.idx);

        //render
        gl.drawElements(gl.TRIANGLES, model.size, gl.UNSIGNED_SHORT, 0);
    }

    return {

        /**
         * Render scene
         * @param {Match} match
         * @param {Motor} motor
         */
        render: function (match, motor) {
            var x = motor ? -motor.x : 0,
                y = motor ? motor.y : 0,
                a = rotateFrom;

            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            renderObject(Board, x, y, a);

            //motors
            match.motors.forEach(function (item, i) {
                var bike = Bikes[i],
                    turn = 0,
                    line;
                line = createLine(item, colors[i], 5, function(angle) {
                    turn = angle;
                });
                if (line) {
                    renderObject(createModel(line), x, y, a);
                }
                bike.trans = [item.x, -item.y, 0];
                bike.rotate = [0, 0, Math.PI / 2 * (turn - item.vec)];
                renderObject(bike, x, y, a);
            });
        },

        /**
         * Init scene
         */
        init: function () {
            canvas = $("#scene");
            gl = canvas.getContext("experimental-webgl");
            vertexShader = createShader($("#vert").text, gl.VERTEX_SHADER);
            fragmentShader = createShader($("#frag").text, gl.FRAGMENT_SHADER);
            shaderProgram = createProgram([vertexShader, fragmentShader]);
            colorLocation = gl.getAttribLocation(shaderProgram, "a_color");
            matrixLocation = gl.getUniformLocation(shaderProgram, "u_matrix");
            positionLocation = gl.getAttribLocation(shaderProgram, "a_position");
            normalsLocation = gl.getAttribLocation(shaderProgram, "a_normals");
            normalLocation = gl.getUniformLocation(shaderProgram, "u_normal");
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.DEPTH_TEST);
            fieldOfViewRadians = Math.PI / 180 * 60;
            rotateFrom = 0;

            //Board model
            Board = createModel({
                color: [255, 255, 255],
                vert: [
                    -100, -100, 0,
                    100, -100, 0,
                    -100, 100, 0,
                    100, 100, 0
                ],
                norm: [
                    0, 0, 1,
                    0, 0, 1,
                    0, 0, 1,
                    0, 0, 1
                ],
                idx: [
                    0, 1, 2,
                    1, 3, 2
                ]
            });

            //Bike models
            colors.forEach(function (color) {
                Bikes.push(createModel({
                    color: color,
                    vert: [
                        1, -5, 0,
                        0, 0, 0,
                        0, -5, 2,
                        -1, -5, 0
                    ],
                    norm: [
                        0, 1, 0,
                        0, 0, 1,
                        0, 0, 1,
                        0, -1, 0
                    ],
                    idx: [
                        0, 1, 2,
                        2, 1, 3,
                        2, 3, 0
                    ]
                }));
            });

            on(window, "resize", resize);
            resize();
        },

        turn: function(to) {
            switch (to) {
                case 1:
                    rotateTo += 90;
                    break;
                case 3:
                    rotateTo -= 90;
                    break;
            }
        },

        anim: function() {
            var diff = rotateTo - rotateFrom;
            rotateFrom = Math.abs(diff) > 1
                ? diff / 4 + rotateFrom
                : rotateTo;
        },

        rotate: function(value) {
            rotateTo = value;
            rotateFrom = value;
        }

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
                    emit("message", value);
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
        nick, //nickname
        ping;

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
                        emit("join", Menu.nick(), Menu.game());
                        break;
                }
                e.preventDefault();
            });
        },

        /**
         * Show menu
         */
        show: function () {
            emit("games");
            attr(container, "class", "");
            Game.hide();
            Chat.hide();
            ping = setInterval(function () {
                emit("games");
            }, 3000);
        },

        /**
         * Hide menu
         */
        hide: function () {
            attr(container, "class", "hide");
            Game.show();
            Chat.show();
            clearInterval(ping);
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
            var selected = games.value;
            games.selectedIndex = 0;
            while (games.options.length > 1) {
                games.remove(1);
            }
            list.forEach(function (game, index) {
                games.add(new Option(game + "'s game", game));
                if (game === selected) {
                    games.selectedIndex = index + 1;
                }
            });
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
                over: new Audio(jsfxr([2, , 0.0551, , 0.131, 0.37, , 0.1096, , , , , , 0.1428, , 0.6144, , , 1, , , , , 0.5])),
                turn: new Audio(jsfxr([1, , 0.18, , 0.1, 0.3465, , 0.2847, , , , , , 0.4183, , , , , 0.5053, , , , , 0.5]))
            };
            on(document.body, "click", function (e) {
                if (e.target.tagName === "A") {
                    Sfx.play("btn");
                }
            });
            on(document.body, "mouseover", function (e) {
                if (e.target.tagName === "A") {
                    Sfx.play("over");
                }
            });
        },
        play: function (name) {
            sounds[name].play();
        }
    };

})();

/**
 * Bind events
 */
function bind() {

    socket.on("connect", function () {
        emit("games");
    });

    socket.on("games", function (list) {
        Menu.games(list);
    });

    socket.on("join", function (list, snapshot) {
        Menu.hide();
        Chat.room(list);
        if (snapshot) {
            Game.start(snapshot, false);
            Game.hide();
        }
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

    socket.on("start", function (snapshot, id) {
        Game.start(snapshot, id);
        Game.hide();
    });

    socket.on("turn", function (to, time, id) {
        Game.turn(to, time, id);
    });

    socket.on("stuck", function (snapshot) {
        Game.load(snapshot);
        Sfx.play("exp");
    });

    socket.on("win", function (winner) {
        Game.stop();
        Game.show(winner);
    });
}

/**
 * App init
 */
window.onload = function () {
    logic = exports;
    Sfx.init();
    Scene.init();
    Chat.init();
    Menu.init();
    Game.init();
    if (typeof io !== "undefined") {
        socket = io();
        bind();
        Menu.show();
    } else {
        var match = new logic.Match(),
            motor = match.add("Player");
        motor.move(50);
        motor.turn(3);
        motor.move(52);
        motor.turn(1);
        motor.move(55);
        /*
        motor.turn(1);
        motor.move(200);
        */
        Scene.render(match, motor);
        //@TODO offline mode
    }
};
