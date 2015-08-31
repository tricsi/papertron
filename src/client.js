/* global io */
/* global jsfxr */
var socket, //server connection
    Scene, //Game scene module
    Sfx, //Sound module
    Chat, //Chat module
    Game, //Game module
    Menu, //Menu module
    Note, //Notification module
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
 * Text setter / getter
 * @param {Object} element
 * @param {string} text
 */
function txt(element, text) {
    if (!element) {
        return "";
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element.textContent;
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
        counter, //counter value
        numbers, //counter numbers
        match, //actual match
        motor, //player's motor
        motorSound, //Motor sound
        running; //match running

    function count(value) {
        for (var i = 0; i < numbers.length; i++) {
            numbers.item(i).className = value === 3 - i ? "on" : "";
        }
    }

    /**
     * Run animations and game logic
     */
    function run() {
        var time = match.getTime(),
            value = time < 0 ? Math.ceil(Math.abs(time / (1000 / match.timer))) : 0;
        if (counter !== value) {
            count(value);
            if (value > 0) {
                Sfx.play("count");
            }
            counter = value;
        }
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
            counter = 0;
            numbers = $("#count").childNodes;
            on(container, "click", function (e) {
                e.preventDefault();
                var id = attr(e.target, "href");
                switch (id) {
                    case "#start":
                        emit("start");
                        break;
                    case "#leave":
                        emit("leave");
                        Menu.show("open");
                        break;
                }
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
            on($(".texts"), "touchstart", function () {
                if (Game.turn(logic.Motor.LEFT)) {
                    Scene.turn(logic.Motor.LEFT);
                }
            });
            on($(".room"), "touchstart", function () {
                if (Game.turn(logic.Motor.RIGHT)) {
                    Scene.turn(logic.Motor.RIGHT);
                }
            });
        },

        /**
         * Start new match
         */
        start: function (snapshot, id, params) {
            Game.hide();
            match = new logic.Match(params.mode, params.map);
            match.load(snapshot);
            match.setTime(snapshot.time);
            motor = match.motors[id] || null;
            Scene.rotate(motor ? motor.vec * 90 : 0);
            motorSound = Sfx.play("motor", true);
            running = true;
            run();
        },

        /**
         * Stop game
         */
        stop: function() {
            running = false;
        },

        /**
         * Load snapshot data
         * @params {array} data
         * @params {array} stuck
         * @params {number} winner
         */
        load: function (data, stuck, winner) {
            if (match) {
                match.load(data);
                if (stuck.length) {
                    Sfx.play("exp");
                }
                if (winner !== false) {
                    Game.stop();
                    Game.show(match.motors[winner].nick + " wins!");
                    Sfx.play(motor && motor.id === winner ? "win" : "lose");
                }
            }
        },

        /**
         * Turn motor
         */
        turn: function (to) {
            var time = match.getTime();
            if (!match || !motor || motor.stuck || time < 1) {
                return false;
            }
            motor.move(time);
            motor.turn(to);
            emit("turn", to, time);
            return true;
        },

        /**
         * Show game
         */
        show: function (text) {
            if (motorSound) {
                motorSound.stop();
            }
            txt($("h1", container), text);
            attr(container, "class", "");
            count(0);
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

    var gl, //WebGL context
        canvas, //canvas object
        shaderProgram, //shader program
        vertexShader, //vertex shader
        fragmentShader, //fragment shader
        colorLocation, //color location param
        cameraLocation, //matrix location param
        matrixLocation, //matrix location param
        positionLocation, //position location param
        normalsLocation, //lighting normal vectors
        normalLocation, //light normal
        fieldOfViewRadians, //FOV param
        aspectRatio,
        rotateFrom,
        rotateTo,
        colors = [
            [160, 16, 0],
            [0, 160, 16],
            [0, 16, 160],
            [160, 16, 160]
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
                xn = 3;
                break;
            case 1:
                ya = -s;
                xb = s;
                yn = -3;
                break;
            case 2:
                xa = -s;
                yb = -s;
                xn = -3;
                break;
            case 3:
                ya = s;
                xb = -s;
                yn = 3;
                break;
        }
        data.vert = [
            x1 + xa + xb, y1 + ya + yb, 0,
            x1, y1, z,
            x2, y2, z,
            x1 - xa + xb, y1 - ya + yb, 0,
            x2, y2, z,
            x1, y1, z,
            x2 + xa - xb, y2 + ya - yb, 0,
            x1 + xa + xb, y1 + ya + yb, 0,
            x2, y2, z,
            x2 - xa - xb, y2 - ya - yb, 0,
            x2, y2, z,
            x1 - xa + xb, y1 - ya + yb, 0
        ];
        data.norm = [
            xn, yn, 0,
            xn, yn, 0,
            xn, yn, 0,
            -xn, -yn, 0,
            -xn, -yn, 0,
            -xn, -yn, 0,
            xn, yn, 0,
            xn, yn, 0,
            xn, yn, 0,
            -xn, -yn, 0,
            -xn, -yn, 0,
            -xn, -yn, 0
        ];
        if (end & 1) {
            data.vert.push(
                x1 + xa + xb, y1 + ya + yb, 0,
                x1 - xa + xb, y1 - ya + yb, 0,
                x1, y1, z
                );
            data.norm.push(
                yn, xn, 0,
                yn, xn, 0,
                yn, xn, 0
                );
        }
        if (end & 2) {
            data.vert.push(
                x2 + xa - xb, y2 + ya - yb, 0,
                x2, y2, z,
                x2 - xa - xb, y2 - ya - yb, 0
                );
            data.norm.push(
                yn, -xn, 0,
                yn, -xn, 0,
                yn, -xn, 0
                );
        }
        return data;
    }

    function createLine(motor, color, dec, onturn) {
        var i,
            end,
            part,
            dots = motor.data,
            data = {
                color: color,
                vert: [],
                norm: []
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
                    onturn(-t / dec);
                    break;
                case 1:
                case -3:
                    onturn(t / dec);
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
            end = 0;
            if (i === s) {
                end = 1;
            }
            if (i === dots.length - 1) {
                end = end | 2;
            }
            part = createPart(x, -y, dots[i][0], -dots[i][1], dots[i][2], .2, 2, end);
            data.vert = data.vert.concat(part.vert);
            data.norm = data.norm.concat(part.norm);
            x = dots[i][0];
            y = dots[i][1];
        }
        return data;
    }

    function createBoard(color, s, z) {
        var n = z > 0 ? 3 : -3;
        return {
            color: color,
            vert: [
                -s, -s, 0,
                s, -s, 0,
                -s, s, 0,
                -s, s, 0,
                s, -s, 0,
                s, s, 0,
                -s, -s, 0,
                -s, -s, z,
                s, -s, 0,
                s, -s, 0,
                -s, -s, z,
                s, -s, z,
                s, s, 0,
                s, -s, 0,
                s, -s, z,
                s, s, 0,
                s, -s, z,
                s, s, z,
                -s, s, 0,
                s, s, 0,
                s, s, z,
                -s, s, 0,
                s, s, z,
                -s, s, z,
                -s, -s, 0,
                -s, s, 0,
                -s, s, z,
                -s, -s, z,
                -s, -s, 0,
                -s, s, z
            ],
            norm: [
                -1, -1, 1,
                1, -1, 1,
                -1, 1, 1,
                -1, 1, 1,
                1, -1, 1,
                1, 1, 1,
                0, n, 0,
                0, n, 0,
                0, n, 0,
                0, n, 0,
                0, n, 0,
                0, n, 0,
                -n, 0, 0,
                -n, 0, 0,
                -n, 0, 0,
                -n, 0, 0,
                -n, 0, 0,
                -n, 0, 0,
                0, -n, 0,
                0, -n, 0,
                0, -n, 0,
                0, -n, 0,
                0, -n, 0,
                0, -n, 0,
                n, 0, 0,
                n, 0, 0,
                n, 0, 0,
                n, 0, 0,
                n, 0, 0,
                n, 0, 0
            ]
        };
    }

    function createModel(data) {
        var model = {
            scale: [1, 1, 1],
            trans: [0, 0, 0],
            rotate: [0, 0, 0]
        },
            color = [],
            i;

        //coordinates
        model.vert = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, model.vert);
        gl.enableVertexAttribArray(positionLocation);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vert), gl.STATIC_DRAW);

        //normals
        model.norm = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, model.norm);
        gl.enableVertexAttribArray(normalsLocation);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.norm), gl.STATIC_DRAW);

        //colors
        for (i = 0; i < data.vert.length; i++) {
            color.push(data.color[i % data.color.length]);
        }
        model.color = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, model.color);
        gl.enableVertexAttribArray(colorLocation);
        gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(color), gl.STATIC_DRAW);

        model.size = data.vert.length / 3;
        return model;
    }

    function resize() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        aspectRatio = canvas.width / canvas.height;
        gl.viewport(0, 0, canvas.width, canvas.height);
        scrollTo(0, 1);
    }

    function renderObject(model, camera) {
        var matrix,
            deg = Math.PI / 180,
            normal = [
                0, 0, 0,
                0, 0, 0,
                0, 0, 0
            ];

        matrix = makeScale(model.scale[0], model.scale[1], model.scale[2]);
        matrix = matrixMultiply(matrix, makeXRotation(deg * model.rotate[0]));
        matrix = matrixMultiply(matrix, makeYRotation(deg * model.rotate[1]));
        matrix = matrixMultiply(matrix, makeZRotation(deg * model.rotate[2]));
        matrix = matrixMultiply(matrix, makeTranslation(model.trans[0], model.trans[1], model.trans[2]));

        normal = matrixInverse(matrix, normal);
        normal = matrixTranspose(normal, normal);

        gl.uniformMatrix4fv(cameraLocation, false, camera);
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

        //render
        gl.drawArrays(gl.TRIANGLES, 0, model.size);
    }

    return {

        /**
         * Render scene
         * @param {Match} match
         * @param {Motor} motor
         */
        render: function (match, motor) {
            var camera = makeScale(1, 1, 1),
                x = motor ? -motor.x : 0,
                y = motor ? motor.y : 0,
                a = Math.PI / 180 * rotateFrom,
                d = 5.5;

            if (match.mode) {
                a += Math.PI;
            }

            camera = matrixMultiply(camera, makeTranslation(x, y, 0));
            camera = matrixMultiply(camera, makeZRotation(a));
            camera = matrixMultiply(camera, makeXRotation(-1.2));
            camera = matrixMultiply(camera, makeTranslation(0, 0, motor ? -30 : -100));
            camera = matrixMultiply(camera, makePerspective(fieldOfViewRadians, aspectRatio, 1, 2000));

            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            renderObject(Board, camera);

            //motors
            match.motors.forEach(function (item, i) {
                var bike = Bikes[i],
                    rotate = [90, 0, -90 * item.vec],
                    line;
                line = createLine(item, colors[i], d, function (angle) {
                    rotate[1] = -30 * (angle > 0 ? angle - .5 : angle + .5);
                    rotate[2] = 90 * (angle - item.vec);
                });
                if (line) {
                    renderObject(createModel(line), camera);
                }
                bike.scale = [.25, .25, .25];
                bike.trans = [item.x, -item.y, 0];
                bike.rotate = rotate;
                renderObject(bike, camera);
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
            cameraLocation = gl.getUniformLocation(shaderProgram, "u_camera");
            matrixLocation = gl.getUniformLocation(shaderProgram, "u_matrix");
            positionLocation = gl.getAttribLocation(shaderProgram, "a_position");
            normalsLocation = gl.getAttribLocation(shaderProgram, "a_normals");
            normalLocation = gl.getUniformLocation(shaderProgram, "u_normal");
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.DEPTH_TEST);
            fieldOfViewRadians = Math.PI / 180 * 60;
            rotateFrom = 0;

            //Board model
            Board = createModel(createBoard([192, 128, 64], 70, 140));

            //Bike models
            colors.forEach(function (color) {
                Bikes.push(createModel({
                    color: color,
                    vert: [2, 8, 4, -2, 8, 4, -1, 8, 8, 2, 8, 4, 1, 8, 8, 2, 4, 8, -1, 0, 8, 1, 0, 8, 1, 1, 8, -2, 8, 4, -1, 8, 0, -2, 4, 0, 1, 0, 0, -1, 0, 0, -2, 4, 0, -1, 1, 8, -1, 1, 12, -1, 7, 12, -1, 7, 8, -2, 4, 8, -1, 1, 8, 1, 1, 8, 2, 4, 8, 1, 7, 8, 1, 7, 8, 1, 7, 12, 1, 1, 12, 2, 8, 16, 1, 8, 20, 2, 4, 20, 1, 1, 12, 1, 7, 12, 2, 4, 12, -1, 7, 12, -1, 1, 12, -2, 4, 12, 1, 1, 12, 1, 0, 12, -1, 0, 12, 1, 8, 20, -1, 8, 20, -2, 4, 20, -2, 0, 16, -1, 0, 20, -2, 4, 20, 2, 8, 16, -2, 8, 16, -1, 8, 20, 1, 8, 12, -1, 8, 12, -2, 8, 16, -2, 8, 16, -0.8, 4, 16, -2, 4, 20, -2, 4, 12, -0.8, 4, 16, -2, 8, 16, -2, 4, 12, -1, 0, 12, -2, 0, 16, 2, 4, 20, -2, 4, 20, -1, 0, 20, 2, 0, 16, 0.8, 4, 16, 2, 4, 20, 2, 4, 12, 0.8, 4, 16, 2, 0, 16, 2, 4, 12, 1, 8, 12, 2, 8, 16, 2, 4, 0, -2, 4, 0, -1, 8, 0, -2, 0, 4, -0.8, 4, 4, -2, 4, 0, -2, 4, 8, -0.8, 4, 4, -2, 0, 4, -2, 4, 8, -1, 8, 8, -2, 8, 4, 2, 0, 4, 0.8, 4, 4, 2, 4, 8, 2, 4, 0, 0.8, 4, 4, 2, 0, 4, 2, 4, 0, 1, 8, 0, 2, 8, 4, 1, 8, 0, -1, 8, 0, -2, 8, 4, -1, 7, 4, -1, 7, 16, -1, 8.6, 16, 1, 11, 4, -1, 11, 4, -1, 8.6, 16, -1, 7, 4, -1, 11, 4, 1, 11, 4, 1, 7, 4, 1, 11, 4, 1, 8.6, 16, 1, 7, 16, 1, 8.6, 16, -1, 8.6, 16, 1, 7, 12, 1, 7, 8, 1, 7, 4, -1, 7, 8, -1, 7, 12, -1, 7, 16, 1, 8, 8, 2, 8, 4, -1, 8, 8, 0.8, 4, 4, 2, 8, 4, 2, 4, 8, -1, 1, 8, -1, 0, 8, 1, 1, 8, -0.8, 4, 4, -2, 8, 4, -2, 4, 0, 2, 4, 0, 1, 0, 0, -2, 4, 0, -1, 7, 8, -1, 1, 8, -1, 7, 12, -2, 4, 8, -1, 7, 8, -1, 8, 8, -2, 4, 8, -1, 0, 8, -1, 1, 8, 2, 4, 8, 1, 1, 8, 1, 0, 8, 2, 4, 8, 1, 8, 8, 1, 7, 8, 1, 1, 8, 1, 7, 8, 1, 1, 12, 0.8, 4, 16, 2, 8, 16, 2, 4, 20, 2, 4, 12, 1, 0, 12, 1, 1, 12, 1, 7, 12, 1, 8, 12, 2, 4, 12, -2, 4, 12, -1, 8, 12, -1, 7, 12, -1, 1, 12, -1, 0, 12, -2, 4, 12, -1, 1, 12, 1, 1, 12, -1, 0, 12, 2, 4, 20, 1, 8, 20, -2, 4, 20, -0.8, 4, 16, -2, 0, 16, -2, 4, 20, 1, 8, 20, 2, 8, 16, -1, 8, 20, 2, 8, 16, 1, 8, 12, -2, 8, 16, -1, 8, 20, -2, 8, 16, -2, 4, 20, -1, 8, 12, -2, 4, 12, -2, 8, 16, -0.8, 4, 16, -2, 4, 12, -2, 0, 16, 1, 0, 20, 2, 4, 20, -1, 0, 20, 1, 0, 20, 2, 0, 16, 2, 4, 20, 1, 0, 12, 2, 4, 12, 2, 0, 16, 0.8, 4, 16, 2, 4, 12, 2, 8, 16, 1, 8, 0, 2, 4, 0, -1, 8, 0, -1, 0, 0, -2, 0, 4, -2, 4, 0, -1, 0, 8, -2, 4, 8, -2, 0, 4, -0.8, 4, 4, -2, 4, 8, -2, 8, 4, 1, 0, 8, 2, 0, 4, 2, 4, 8, 1, 0, 0, 2, 4, 0, 2, 0, 4, 0.8, 4, 4, 2, 4, 0, 2, 8, 4, 2, 8, 4, 1, 8, 0, -2, 8, 4, -1, 11, 4, -1, 7, 4, -1, 8.6, 16, 1, 8.6, 16, 1, 11, 4, -1, 8.6, 16, 1, 7, 4, -1, 7, 4, 1, 11, 4, 1, 7, 16, 1, 7, 4, 1, 8.6, 16, -1, 7, 16, 1, 7, 16, -1, 8.6, 16, 1, 7, 16, 1, 7, 12, 1, 7, 4, -1, 7, 4, -1, 7, 8, -1, 7, 16],
                    norm: [0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0.9, 0.2, 0.2, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, -1, 0, 0, -0.9, 0.2, -0.2, -1, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0.9, 0.2, 0.2, 1, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, -1, 0, 0, -0.9, -0.2, 0.2, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -0.9, -0.2, -0.2, -1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0.9, 0.2, -0.2, 1, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -0.9, 0.2, 0.2, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0.9, 0.2, -0.2, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0.2, 0, 1, 0.2, 0, 1, 0.2, 0, 0, -1, 0, 0, -1, 0, 0, -1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0.9, -0.4, 0, 0, -1, 0, 0.1, 0.9, 0.5, -0.7, 0.7, 0, -1, 0, 0, -0.1, 0.4, 0.9, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, -0.9, 0.2, 0.2, -1, 0, 0, -1, 0, 0, -0.9, 0.2, -0.2, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0.9, -0.2, 0.2, 1, 0, 0, 1, 0, 0, 0.9, -0.2, -0.2, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, -0.9, -0.2, -0.2, -1, 0, 0, -1, 0, 0, -0.9, -0.2, 0.2, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0.9, -0.2, 0.2, 1, 0, 0, 1, 0, 0, 0.9, -0.2, -0.2, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0.2, 0, 1, 0.2, 0, 1, 0.2, 0, 0, -1, 0, 0, -1, 0, 0, -1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0.1, 0.4, 0.9, 0.9, -0.4, 0, 0.1, 0.9, 0.5, -0.1, 0.9, 0.5, -0.7, 0.7, 0, -0.1, 0.4, 0.9]
                }));
            });

            on(window, "resize", resize);
            resize();
        },

        turn: function (to) {
            switch (to) {
                case 1:
                    rotateTo += 90;
                    break;
                case 3:
                    rotateTo -= 90;
                    break;
            }
        },

        anim: function () {
            var diff = rotateTo - rotateFrom;
            rotateFrom = Math.abs(diff) > 1
                ? diff / 4 + rotateFrom
                : rotateTo;
        },

        rotate: function (value) {
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
            text = $("[name=text]", container);
            texts = $(".texts", container);
            room = $(".room", container);
            on(text, "keydown", function (e) {
                var value = text.value.trim();
                if (e.keyCode === 13 && value !== "") {
                    emit("message", value);
                    Chat.add(Menu.nick() + ": " + value);
                    text.value = "";
                }
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
            Sfx.play("msg");
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
        selected, //selected game
        games, //game list
        game, //game name
        nick, //nickname
        ping; //ping timer

    return {

        /**
         * Module init
         */
        init: function () {
            container = $("body");
            games = $("ul");
            game = $("[name=game]");
            nick = $("[name=nick]");
            nick.value = localStorage.getItem("nick") || "";
            on(games, "click", function(e) {
                var item = e.target;
                if (item.tagName === "LI") {
                    if (selected) {
                        attr(selected, "class", "");
                    }
                    if (selected === item) {
                        selected = null;
                    } else {
                        attr(item, "class", "sel");
                        selected = item;
                    }
                }
            });
            on(container, "submit", function (e) {
                var name = Menu.nick();
                localStorage.setItem("nick", name);
                e.preventDefault();
                emit("open", name);
                nick.blur();
            });
            on(container, "click", function (e) {
                 switch (attr(e.target, "href")) {
                    case "#join":
                        e.preventDefault();
                        if (selected) {
                            emit("join", txt(selected));
                        }
                        break;
                    case "#create":
                        e.preventDefault();
                        emit("create", Menu.opts());
                        break;
                }
            });
        },

        /**
         * Show menu
         */
        show: function (name) {
            if (name === "open") {
                if (!game.value) {
                    game.value = Menu.nick() + "'s game";
                }
                emit("games");
                ping = setInterval(function () {
                    emit("games");
                }, 3000);
            } else if (ping) {
                clearInterval(ping);
            }
            attr(container, "class", name);
        },

        /**
         * Get nickname
         * @return string
         */
        nick: function () {
            return nick.value.trim();
        },

        /**
         * Game options
         * @return object
         */
        opts: function () {
            return {
                name: game.value.trim(),
                bots: $("select[name=bots]").selectedIndex,
                mode: $("select[name=mode]").selectedIndex,
                map: $("select[name=map]").selectedIndex
            };
        },

        /**
         * Set games list
         * @param {string[]} list
         */
        games: function (list) {
            var name = txt(selected),
                element;
            selected = null;
            while (games.firstChild) {
                games.removeChild(games.firstChild);
            }
            list.forEach(function (item) {
                element = document.createElement("LI");
                element.appendChild(document.createTextNode(item.name));
                if (item.name === name) {
                    element.className = "sel";
                    selected = element;
                }
                games.appendChild(element);
            });
        }
    };

})();

Sfx = (function () {

    var container,
        context,
        volume,
        buffers = {},
        muted = true;

    function createSource(name, config) {
        var url = jsfxr(config),
            request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";
        request.onload = function () {
            context.decodeAudioData(request.response, function (buffer) {
                buffers[name] = buffer;
            });
        };
        request.send();
    }

    return {

        init: function () {
            var body = document.body,
                targets = ["A", "BUTTON"];
            container = $("#sfx");
            context = new AudioContext();
            volume = context.createGain();
            volume.connect(context.destination);
            createSource("exp", [3, , 0.18, 0.05, 0.65, 0.97, , -0.36, 0.46, , , 0.66, 0.65, , , 0.63, 0.16, 0.5, 1, , 0.96, , , 0.45]);
            createSource("btn", [2, , 0.04, 0.54, 0.36, 0.15, , , , , , 0.24, 0.52, , , , , , 0.31, , 1, , -1, 0.5]);
            createSource("over", [2, , 0.01, 0.82, 0.17, 0.94, 0.1, 0.74, -0.82, 0.96, 0.99, -0.82, 0.02, 0.16, 0.35, 0.04, -0.7, -0.8, 0.29, -0.62, 0.69, 0.01, 0, 0.28]);
            createSource("count", [1, , 0.12, , 0.72, 0.09, , -0.12, 0.08, , , , , 0.09, 0.02, 0.78, , -0.02, 0.09, -0.02, 0.49, , , 0.45]);
            createSource("win", [2, 0.66, 0.01, 0.17, 0.34, 0.68, , 0.16, 0.02, 0.08, 0.71, -0.82, 0.4, 0.34, -0.34, , 0.68, 0.92, 0.15, -0.1, 0.53, 0, 0.05, 0.5]);
            createSource("lose", [0, 0.16, 0.01, 0.3, 0.45, 0.28, , 0.26, -0.01, 0.15, 0.44, -0.82, 0.4, 0.33, -0.34, -0.06, 0.03, -0.19, 0.07, -0.01, 0.53, 0, 0.05, 0.5]);
            createSource("msg", [0, , 0.057, 0.17, 0.12, 0.72, , , , , , 0.58, 0.69, , , , , , 0.42, -0.18, , , , 0.5]);
            createSource("joined", [2, , 0.04, 0.54, 0.36, 0.72, , , , , , 0.24, 0.52, , , , , , 0.31, , 1, , -1, 0.5]);
            createSource("left", [0, , 0.04, 0.54, 0.36, 0.15, , , , , , 0.24, 0.52, , , , , , 0.18, -0.54, 1, , -1, 0.5]);
            createSource("motor", [1, , 1, , , 0.06, , -0.12, 0.08, 0.27, , -0.1, 1, 1, 0.9, 1, 0.2, 0.08, 0.78, -0.02, 0.49, , , 0.45]);
            on(body, "click", function (e) {
                if (targets.indexOf(e.target.tagName) !== -1) {
                    Sfx.play("btn");
                }
            });
            on(body, "mouseover", function (e) {
                if (targets.indexOf(e.target.tagName) !== -1) {
                    Sfx.play("over");
                }
            });
            on(container, "click", Sfx.mute);
            Sfx.mute();
        },

        play: function (name, loop) {
            var source = null;
            if (name in buffers) {
                source = context.createBufferSource();
                source.loop = loop || false;
                source.buffer = buffers[name];
                source.connect(volume);
                source.start(0);
            }
            return source;
        },

        mute: function () {
            muted = !muted;
            volume.gain.value = muted ? 0 : 1;
            attr(container, "class", muted ? "off" : "");
        }
    };

})();

Note = (function () {

    var container;

    function hide() {
        attr(container, "class", "hide");
    }

    return {

        init: function () {
            container = $("#note");
            on(container, "click", hide);
        },

        show: function (msg) {
            txt(container, msg);
            attr(container, "class", "");
            setTimeout(hide, 3000);
        }

    };

})();

/**
 * Bind events
 */
function bind() {

    socket.on("games", Menu.games);

    socket.on("alert", function (message) {
        Note.show(message);
    });

    socket.on("disconnect", function () {
        Game.stop();
        Menu.show("close");
        Note.show("Connection lost!");
    });

    socket.on("open", function () {
        Menu.show("open");
    });

    socket.on("join", function (list, snapshot, params) {
        Menu.show("start");
        Chat.room(list);
        if (snapshot) {
            Game.start(snapshot, false, params);
            Game.hide();
        } else {
            Game.show(params.name);
        }
    });

    socket.on("joined", function (nick, list) {
        Chat.add(nick + " joined");
        Chat.room(list);
        Sfx.play("joined");
    });

    socket.on("left", function (nick, list) {
        Chat.add(nick + " left");
        Chat.room(list);
        Sfx.play("left");
    });

    socket.on("message", function (nick, text) {
        Chat.add(nick + ": " + text);
    });

    socket.on("start", Game.start);

    socket.on("shot", Game.load);

}

/**
 * App init
 */
window.onload = function () {
    logic = exports;
    if (typeof io !== "undefined") {
        socket = io({
            transports: ["websocket"]
        });
        bind();
    }
    if (window.AudioContext) {
        Sfx.init();
    }
    Scene.init();
    Chat.init();
    Menu.init();
    Note.init();
    Game.init();
};
