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
 * Create element helper
 * @param {string} name
 * @param {boolean} isText
 * @returns {DOMElement}
 */
function em(value, isText) {
    return isText
        ? document.createTextNode(value)
        : document.createElement(value);
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
    if (!element) {
        return null;
    }
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

/**
 * Game module
 */
Game = (function () {

    var container, //game container
        counter, //counter value
        numbers, //counter numbers
        match, //actual match
        motor, //player's motor
        motorSound, //Motor sound
        spectate, //Spectated motor id
        running; //match running

    /**
     * Set counter classes
     * @param {number} value
     */
    function count(value) {
        txt(numbers, value || "");
        attr(numbers, "class", "");
        setTimeout(function () {
            attr(numbers, "class", "off");
        }, 700);
    }

    /**
     * Run animations and game logic
     */
    function run() {
        var time = match.getTime(),
            value = time < 0 ? Math.ceil(Math.abs(time / (1000 / match.timer))) : 0;
        if (counter !== value) {
            motorSound = null;
            count(value);
            if (value > 0) {
                Sfx.play("count");
            } else {
                Game.hide();
            }
            counter = value;
        }
        if (!counter && !motorSound && motor) {
            motorSound = Sfx.play("motor", .1, true);
        }
        match.run();
        Scene.anim();
        Scene.render(match, motor || match.motors[spectate], motor === null);
        if (running) {
            requestAnimationFrame(run);
        }
    }

    /**
     * Spectate next player
     */
    function spectateNext() {
        if (++spectate >= match.motors.length) {
            spectate = 0;
        }
        Note.show("Spectating: " + match.motors[spectate].nick);
    }

    /**
     * Stop engine sound
     */
    function stopSound() {
        if (motorSound) {
            motorSound.loop = false;
        }
    }

    return {

        /**
         * Module init
         */
        init: function () {
            container = $("#game");
            counter = 0;
            numbers = $("#count").firstChild;
            on($("#start"), "click", function () {
                emit("start");
                Game.hide();
            });
            on($("#leave"), "click", function () {
                emit("leave");
                Menu.show("open");
            });
            on(document.body, "keydown", function (e) {
                if (e.target.tagName !== "INPUT") {
                    switch (e.keyCode) {
                        case 32:
                            if (running && !motor) {
                                spectateNext();
                            }
                            break;
                        case 37:
                            if (Game.turn(3)) {
                                Scene.turn(3);
                            }
                            break;
                        case 39:
                            if (Game.turn(1)) {
                                Scene.turn(1);
                            }
                            break;
                    }
                }
            });
            on($(".texts"), "touchstart", function () {
                if (Game.turn(3)) {
                    Scene.turn(3);
                } else if (running && !motor) {
                    spectateNext();
                }
            });
            on($(".room"), "touchstart", function () {
                if (Game.turn(1)) {
                    Scene.turn(1);
                } else if (running && !motor) {
                    spectateNext();
                }
            });
        },

        /**
         * Start new match
         * @param {Object} snapshot
         * @param {number} id
         * @param {Object} params
         */
        start: function (snapshot, id, params) {
            match = new logic.Match(params.mode, params.map);
            match.load(snapshot);
            match.setTime(snapshot.time);
            motor = match.motors[id] || null;
            if (motor) {
                Scene.rotate(motor.vec * 90);
            } else {
                Scene.rotate(0);
            }
            if (!running) {
                spectate = 0;
                running = true;
                run();
            }
        },

        /**
         * Stop game
         */
        stop: function() {
            running = false;
        },

        /**
         * Load snapshot data
         * @param {array} data
         * @param {array} crash
         * @param {number} winner
         */
        load: function (data, crash, winner) {
            if (match) {
                match.load(data);
                if (crash.length) {
                    Sfx.play("exp");
                }
                if (winner !== false) {
                    Game.stop();
                    Game.show(match.motors[winner].nick + " wins!");
                    Sfx.play(motor && motor.id === winner ? "win" : "lose");
                    stopSound();
                } else if (motor && crash.indexOf(motor.id) >= 0) {
                    spectate = motor.id;
                    motor = null;
                    stopSound();
                }
            }
        },

        /**
         * Turn motor
         * @param {number} to
         */
        turn: function (to) {
            var time = match.getTime();
            if (!match || !motor || motor.crash || time < 1) {
                return false;
            }
            motor.move(time);
            motor.turn(to);
            emit("turn", to, time);
            Sfx.play("turn", .5);
            return true;
        },

        /**
         * Show start screen
         * @param {string} text
         */
        show: function (text) {
            txt($("h1", container), text);
            attr(container, "class", "");
            $("#start").focus();
            count(0);
        },

        /**
         * Hide start screen
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
        aspectRatio, //screen aspect ratio
        rotateFrom, //camera rotate value
        rotateTo, //camera rotate goal
        colors = [ //bike colors
            [249, 0, 65],
            [93, 249, 0],
            [0, 93, 249],
            [249, 93, 0]
        ],
        Bikes = [], //bike models
        Board; //boar model

    /**
     * Load shader
     * @param {string} program
     * @param {number} programType
     */
    function createShader(script, programType) {
        var shader = gl.createShader(programType);
        gl.shaderSource(shader, script);

        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
        }
        return shader;
    }

    /**
     * Create shader program
     * @param {array} shaders
     */
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

    /**
     * Create projection matrix
     * @param {number} fieldOfViewInRadians
     * @param {number} aspect
     * @param {number} near
     * @param {number} far
     * @return {array}
     */
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

    /**
     * Translation
     * @param {number} tx
     * @param {number} ty
     * @param {number} tz
     * @return {array}
     */
    function makeTranslation(tx, ty, tz) {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            tx, ty, tz, 1
        ];
    }

    /**
     * X rotation
     * @param {number} angleInRadians
     * @return {array}
     */
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

    /**
     * Y rotation
     * @param {number} angleInRadians
     * @return {array}
     */
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

    /**
     * Z rotation
     * @param {number} angleInRadians
     * @return {array}
     */
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

    /**
     * Scale
     * @param {number} tx
     * @param {number} ty
     * @param {number} tz
     * @return {array}
     */
    function makeScale(sx, sy, sz) {
        return [
            sx, 0, 0, 0,
            0, sy, 0, 0,
            0, 0, sz, 0,
            0, 0, 0, 1
        ];
    }

    /**
     * Multiply
     * @param {array} a
     * @param {array} b
     * @return {array}
     */
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

    /**
     * Inverse
     * @param {array} mat
     * @param {array} dest
     * @return {array}
     */
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

    /**
     * Transpose
     * @param {array} a
     * @return {array}
     */
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

    /**
     * Create line part
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @param {number} v
     * @param {number} s
     * @param {number} z
     * @param {number} end
     * @return {Object}
     */
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
                break;
            case 1:
                ya = -s;
                xb = s;
                yn = -1;
                break;
            case 2:
                xa = -s;
                yb = -s;
                xn = -1;
                break;
            case 3:
                ya = s;
                xb = -s;
                yn = 1;
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

    /**
     * Generate line model data
     * @param {Motor} motor
     * @param {array} color
     * @param {number} doc
     * @callback onturn
     * @return {Object}
     */
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
            t = motor.stuck || motor.time,
            s = 0;

        t -= dots[0][3];
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

    /**
     * Generate board model data
     * @param {array} color
     * @param {number} s
     * @param {number} z
     * @return {Object}
     */
    function createBoard(color, s, z) {
        var x,
            y,
            l = .2,
            d = s / 5,
            n = z > 0 ? 1 : -1,
            zn = .8,
            data;
        data = {
            color: color,
            vert: [
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
        n = .1;
        for (x = -s; x < s; x += d) {
            for (y = -s; y < s; y += d) {
                data.vert.push(
                    x + l, y + l, 0,
                    x + d - l, y + l, 0,
                    x + l, y + d - l, 0,
                    x + l, y + d - l, 0,
                    x + d - l, y + l, 0,
                    x + d - l, y + d - l, 0
                );
                data.norm.push(
                    -n, -n, zn,
                    n, -n, zn,
                    -n, n, zn,
                    -n, n, zn,
                    n, -n, zn,
                    n, n, zn
                );
            }
        }
        return data;
    }

    /**
     * Create model
     * @param {Object} data
     * @return {Object}
     */
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

    /**
     * Resize canvas
     */
    function resize() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        aspectRatio = canvas.width / canvas.height;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    /**
     * Render model
     * @param {Object} model
     * @param {Object} camera
     */
    function renderObject(model, camera) {
        var matrix,
            deg = Math.PI / 180,
            normal = [
                0, 0, 0,
                0, 0, 0,
                0, 0, 0
            ];

        matrix = makeXRotation(deg * model.rotate[0]);
        matrix = matrixMultiply(matrix, makeYRotation(deg * model.rotate[1]));
        matrix = matrixMultiply(matrix, makeZRotation(deg * model.rotate[2]));

        normal = matrixInverse(matrix, normal);
        normal = matrixTranspose(normal, normal);

        matrix = matrixMultiply(matrix, makeScale(model.scale[0], model.scale[1], model.scale[2]));
        matrix = matrixMultiply(matrix, makeTranslation(model.trans[0], model.trans[1], model.trans[2]));

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

        clear: function () {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        },

        /**
         * Render scene
         * @param {Match} match
         * @param {Motor} motor
         * @param {boolean} spectate
         */
        render: function (match, motor, spectate) {
            var camera = makeScale(1, 1, 1),
                x = motor ? -motor.x : 0,
                y = motor ? motor.y : 40,
                a = Math.PI / 180 * rotateFrom,
                d = 5.5;

            if (match && match.mode) {
                a += Math.PI;
            }

            camera = matrixMultiply(camera, makeTranslation(x, y, 0));
            camera = matrixMultiply(camera, makeZRotation(a));
            camera = matrixMultiply(camera, makeXRotation(spectate ? -.4 : -1.2));
            camera = matrixMultiply(camera, makeTranslation(0, 0, spectate ? -60 : -30));
            camera = matrixMultiply(camera, makePerspective(fieldOfViewRadians, aspectRatio, 1, 2000));

            Scene.clear();

            renderObject(Board, camera);

            //motors
            if (match) {
                match.motors.forEach(function (item, i) {
                    var bike = Bikes[i],
                        rotate = [90, 0, -90 * item.vec],
                        line;
                    line = createLine(item, colors[i], d, function (angle) {
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
            }
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
            colorLocation = gl.getAttribLocation(shaderProgram, "aColor");
            cameraLocation = gl.getUniformLocation(shaderProgram, "uCam");
            matrixLocation = gl.getUniformLocation(shaderProgram, "uModel");
            positionLocation = gl.getAttribLocation(shaderProgram, "aPos");
            normalsLocation = gl.getAttribLocation(shaderProgram, "aNorm");
            normalLocation = gl.getUniformLocation(shaderProgram, "uNorm");
            gl.enable(gl.CULL_FACE);
            gl.enable(gl.DEPTH_TEST);
            fieldOfViewRadians = Math.PI / 180 * 60;
            rotateFrom = 0;

            //Board model
            Board = createModel(createBoard([191, 153, 91], 80, 140));

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

        /**
         * Turn motor
         * @param {number} to
         */
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

        /**
         * Camera animation
         */
        anim: function () {
            var diff = rotateTo - rotateFrom;
            rotateFrom = Math.abs(diff) > 1
                ? diff / 4 + rotateFrom
                : rotateTo;
        },

        /**
         * Set camera rotation
         * @param {number} value
         */
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
            var row;
            txt(room, "");
            list.sort(function(a, b) {
                return a.nick > b.nick;
            });
            list.forEach(function (player) {
                row = em("span");
                txt(row, player.nick + " ★" + player.wins);
                room.appendChild(row);
            });
        },

        /**
         * Add new message
         * @param {string} message
         */
        add: function (message) {
            var row = em("span");
            txt(row, message);
            texts.insertBefore(row, texts.firstChild);
            Sfx.play("msg");
        },

        /**
         * Clear messages
         */
        clear: function () {
            txt(texts, "");
            text.value = "";
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
        map, //game map select
        bots, //game bots select
        mode, //game mode select
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
            map = $("[name=map]");
            bots = $("[name=bots]");
            mode = $("[name=mode]");
            nick = $("[name=nick]");
            nick.value = localStorage.getItem("nick") || "";
            on(games, "click", function(e) {
                var item = e.target;
                if (item.tagName === "LI") {
                    attr($("li.sel", games), "class", "");
                    attr(item, "class", "sel");
                    selected = attr(item, "data-val");
                }
            });
            on(container, "submit", function (e) {
                var name = Menu.nick();
                localStorage.setItem("nick", name);
                emit("open", name);
                e.preventDefault();
                nick.blur();
            });
            on($("#join"), "click", function () {
                if (selected) {
                    emit("join", selected);
                }
            });
            on($("#create"), "click", function () {
                emit("create", Menu.opts());
                Scene.clear();
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
                bots: bots.selectedIndex,
                mode: mode.selectedIndex,
                map: map.selectedIndex
            };
        },

        /**
         * Set games list
         * @param {string[]} list
         */
        games: function (list) {
            var name = selected,
                pre,
                li;
            selected = null;
            while (games.firstChild) {
                games.removeChild(games.firstChild);
            }
            list.forEach(function (item) {
                pre = em("pre");
                txt(pre, [
                    mode.options[item.mode].text + " " +
                    map.options[item.map].text,
                    "Players: " + item.count,
                    "Bots: " + item.bots
                ].join("\n"));
                li = em("li");
                txt(li, item.name);
                attr(li, "data-val", item.name);
                li.appendChild(pre);
                if (item.name === name) {
                    li.className = "sel";
                    selected = name;
                }
                games.appendChild(li);
            });
        }
    };

})();

/**
 * Sound module
 */
Sfx = (function () {

    var container, //Mute switch
        context, //AudioContext
        master, //Master volme
        buffers = {}, //BufferSources
        muted = true; //mute switch

    /**
     * Create BufferSource
     * @param {string} name
     * @param {array} config
     */
    function createSource(name, config) {
        var data = jsfxr(config);
        context.decodeAudioData(data, function (buffer) {
            buffers[name] = buffer;
        });
    }

    return {

        /**
         * Init module
         */
        init: function () {
            container = $("#sfx");
            context = new AudioContext();
            master = context.createGain();
            master.connect(context.destination);
            createSource("exp", [3, , 0.18, 0.05, 0.65, 0.97, , -0.36, 0.46, , , 0.66, 0.65, , , 0.63, 0.16, 0.5, 1, , 0.96, , , 0.45]);
            createSource("btn", [2, , 0.01, 0.82, 0.17, 0.94, 0.1, 0.74, -0.82, 0.96, 0.99, -0.82, 0.02, 0.16, 0.35, 0.04, -0.7, -0.8, 0.29, -0.62, 0.69, 0.01, 0, 0.28]);
            createSource("count", [1, , 0.12, , 0.72, 0.1, , -0.12, 0.08, , , , , 0.09, 0.02, 0.78, , -0.02, 0.09, -0.02, 0.49, , , 0.45]);
            createSource("win", [2, 0.66, 0.01, 0.17, 0.34, 0.68, , 0.16, 0.02, 0.08, 0.71, -0.82, 0.4, 0.34, -0.34, , 0.68, 0.92, 0.15, -0.1, 0.53, 0, 0.05, 0.5]);
            createSource("lose", [0, 0.16, 0.01, 0.3, 0.45, 0.28, , 0.26, -0.01, 0.15, 0.44, -0.82, 0.4, 0.33, -0.34, -0.06, 0.03, -0.19, 0.07, -0.01, 0.53, 0, 0.05, 0.5]);
            createSource("msg", [0, , 0.057, 0.17, 0.12, 0.72, , , , , , 0.58, 0.69, , , , , , 0.42, -0.18, , , , 0.5]);
            createSource("joined", [2, , 0.04, 0.54, 0.36, 0.72, , , , , , 0.24, 0.52, , , , , , 0.31, , 1, , -1, 0.5]);
            createSource("left", [0, , 0.04, 0.54, 0.36, 0.15, , , , , , 0.24, 0.52, , , , , , 0.18, -0.54, 1, , -1, 0.5]);
            createSource("turn", [1, , 0.06, , 0.21, 0.12, , 0.19, , , , , , , , 0.8, , , 1, , , , , 0.5]);
            createSource("motor", [1, , 0.54, , , 0.07, , -0.12, 0.08, , , -0.1, 1, 1, 0.9, 1, 0.2, 0.08, 0.78, -0.02, 0.49, , , 0.45]);
            on(document.body, "click", function (e) {
                var tag = e.target.tagName;
                if (tag === "A" || tag === "BUTTON") {
                    Sfx.play("btn");
                }
            });
            on(container, "click", Sfx.mute);
            Sfx.mute();
        },

        /**
         * Play sound
         * @param {string} name
         * @param {number} volume
         * @param {boolean} loop
         * @return {AudioSource}
         */
        play: function (name, volume, loop) {
            var source = null,
                gain;
            if (name in buffers) {
                gain = context.createGain();
                gain.gain.value = volume || 1;
                gain.connect(master);
                source = context.createBufferSource();
                source.loop = loop || false;
                source.buffer = buffers[name];
                source.connect(gain);
                source.start(0);
            }
            return source;
        },

        /**
         * Switch mute
         */
        mute: function () {
            muted = !muted;
            master.gain.value = muted ? 0 : 2;
            attr(container, "class", muted ? "off" : "");
        }
    };

})();

/**
 * Notification module
 */
Note = (function () {

    var container, //container element
        timer; //timer process

    /**
     * Hide the message
     */
    function hide() {
        attr(container, "class", "hide");
    }

    return {

        /**
         * Init module
         */
        init: function () {
            container = $("#note");
            on(container, "click", hide);
        },

        /**
         * Show message
         * @param {string} msg
         */
        show: function (msg) {
            txt(container, msg);
            attr(container, "class", "");
            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(hide, 3000);
        }

    };

})();

/**
 * Bind network events
 */
function bind() {

    //List games
    socket.on("games", Menu.games);

    //Server alerts
    socket.on("alert", function (message) {
        Note.show(message);
    });

    //Disconnect
    socket.on("disconnect", function () {
        Game.stop();
        Menu.show("close");
        Note.show("Connection lost!");
    });

    //Open box
    socket.on("open", function () {
        Menu.show("open");
    });

    //Join existing game
    socket.on("join", function (list, snapshot, params) {
        Menu.show("open start");
        Chat.room(list);
        Chat.clear();
        if (snapshot) {
            Game.start(snapshot, false, params);
            if (snapshot.time < 0) {
                Game.show(params.name);
            } else {
                Note.show("Wait until next round starts!");
                Game.hide();
            }
        } else {
            Scene.rotate(0);
            Scene.render();
            Game.show(params.name);
        }
    });

    //Player joined the game
    socket.on("room", function (nick, list, action) {
        Chat.room(list);
        if (action) {
            Chat.add(nick + " " + action);
            Sfx.play(action);
        }
    });

    //Chat message
    socket.on("message", function (nick, text) {
        Chat.add(nick + ": " + text);
    });

    //Game starts
    socket.on("start", Game.start);

    //Game snapshot
    socket.on("shot", function (data, crash, winner, list) {
        Game.load(data, crash, winner);
        if (list) {
            Chat.room(list);
        }
    });

}

/**
 * App init
 */
window.onload = function () {
    logic = exports;
    if (typeof io !== "undefined") {
        socket = io(location.href);
        bind();
    }
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    if (window.AudioContext) {
        Sfx.init();
    }
    Scene.init();
    Chat.init();
    Menu.init();
    Note.init();
    Game.init();
};
