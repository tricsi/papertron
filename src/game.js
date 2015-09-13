var global = typeof module === "undefined" ? window : module;
global.exports = (function () {

	/**
	 * Motor class
	 * @param {number} x Coordinate
	 * @param {number} y Coordinate
	 * @param {number} vec Direction
	 * @param {number} id Motor ID
	 * @param {string} nick Nickname
	 * @constructor
	 */
    function Motor(x, y, vec, id, nick) {
        this.x = x;
        this.y = y;
        this.vec = vec;
        this.id = id;
        this.bot = !nick;
        this.nick = nick || "Robot";
        this.time = 0; // Time
        this.data = []; // Line data
        this.stuck = false;
        this.crash = false;
        this.add();
    }

	/**
	 * Direction values
	 * @type {number}
	 */
    Motor.U = 0; //UP
    Motor.R = 1; //RIGHT
    Motor.D = 2; //DOWN
    Motor.L = 3; //LEFT

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
            addTime = this.stuck
                ? this.stuck - lastTime
                : toTime - lastTime;
        this.x = this.data[0][0];
        this.y = this.data[0][1];
        this.vec = this.data[0][2];
        switch (this.vec) {
            case Motor.L:
                this.x -= addTime;
                break;
            case Motor.R:
                this.x += addTime;
                break;
            case Motor.U:
                this.y -= addTime;
                break;
            case Motor.D:
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
        if (!this.crash) {
            switch (to) {
                case Motor.L:
                    if (--this.vec < Motor.U) {
                        this.vec = Motor.L;
                    }
                    this.add();
                    this.stuck = false;
                    break;
                case Motor.R:
                    if (++this.vec > Motor.L) {
                        this.vec = Motor.U;
                    }
                    this.add();
                    this.stuck = false;
                    break;
            }
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
                    case Motor.L:
                    case Motor.R:
                        return (x1 >= x4 && x2 <= x4) ||
                            (x2 >= x4 && x1 <= x4) ||
                            (x1 >= x3 && x2 <= x3) ||
                            (x2 >= x3 && x1 <= x3);
                    case Motor.U:
                    case Motor.D:
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
	 * Check and set next movement
	 * @param {Match} match
	 */
    Motor.prototype.ai = function (match) {
        var motor = this,
            time = motor.time,
            seed = Math.random() * motor.id,
            rand = seed - Math.floor(seed),
            dir = rand >= .5,
            toTime = time + 10 + Math.round(rand * 10),
            result = false;
        if (!motor.stuck) {
            motor.move(toTime);
            if (match.check(motor) || rand > 0.998) {
                result = dir ? Motor.R : Motor.L;
                motor.move(time);
                motor.turn(result);
                motor.move(toTime);
                if (match.check(motor)) {
                    result = dir ? Motor.L : Motor.R;
                    motor.back();
                    motor.turn(result);
                    motor.move(toTime);
                    if (match.check(motor)) {
                        motor.back();
                        result = false;
                    }
                }
            }
            motor.move(time);
        }
        return result;
    };

	/**
	 * Game match class
	 * @constructor
	 */
    function Match(mode, map) {
        this.timer = 40; //Snapshot time
        this.rubber = 5; //Rubber time
        this.distance = 60; //Wall distance
        this.start = new Date().getTime() + 5000; //Start time
        this.motors = []; //Motors
        this.bots = []; //Robots
        this.mode = parseInt(mode) || 0; //Reverse mode
        this.pos = Match.maps[parseInt(map) || 0]; //Game map
    }

    /**
     * Game maps
     */
    Match.maps = [[
        [0, 10, 2],
        [0, -10, 0],
        [-10, 0, 3],
        [10, 0, 1]
    ], [
        [0, 40, 0],
        [0, -40, 2],
        [-40, 0, 1],
        [40, 0, 3]
    ], [
        [40, 40, 0],
        [-40, -40, 2],
        [-40, 40, 1],
        [40, -40, 3]
    ]];

	/**
	 * Save snapshot
	 * @returns {object}
	 */
	Match.prototype.save = function () {
		return {
			time: this.getTime(),
			data: this.motors
		};
	};

	/**
	 * Load snapshot
	 * @params {object} snapshot
	 */
	Match.prototype.load = function (snapshot) {
		var i,
			data,
			item,
			param;
		for (i = 0; i < snapshot.data.length; i++) {
			data = snapshot.data[i];
			item = this.motors[i] || this.add(data.nick);
			for (param in data) {
				item[param] = data[param];
			}
		}
	};

    /**
     * Set start time from snapshot time
     */
    Match.prototype.setTime = function (time) {
		this.start = new Date().getTime() - (time * this.timer);
    };

	/**
	 * Get current snapshot time
	 * @returns {number}
	 */
    Match.prototype.getTime = function (milisec) {
        var time = (new Date().getTime() - this.start) / this.timer;
        return milisec ? time : Math.round(time);
    };

	/**
	 * Create new motor
	 * @param {string} nick
	 * @returns {Motor}
	 */
    Match.prototype.add = function (nick) {
        var motor = null,
            i = this.motors.length;
        if (i < this.pos.length) {
            motor = new Motor(
                this.pos[i][0],
                this.pos[i][1],
                this.pos[i][2],
                i,
                nick
            );
            this.motors.push(motor);
        } else {
            for (i = 0; i < this.motors.length; i++) {
                if (this.motors[i].bot) {
                    motor = this.motors[i];
                    motor.bot = false;
                    motor.nick = nick;
                    break;
                }
            }
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
                        case Motor.L:
                            x++;
                            break;
                        case Motor.R:
                            x--;
                            break;
                        case Motor.U:
                            y++;
                            break;
                        case Motor.D:
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
	 * Runs all robot checks
	 * @callback onTurn
	 */
    Match.prototype.ai = function (onTurn) {
        var i,
            to,
            motor,
            time = this.getTime();
        for (i = 0; i < this.motors.length; i++) {
            motor = this.motors[i];
            if (motor.bot) {
                to = motor.ai(this);
                if (to && onTurn) {
                    onTurn.call(this, to, time, i);
                }
            }
        }
    };

	/**
	 * Runs all motor checks
	 * @callback onCrash
	 */
    Match.prototype.run = function (onCrash) {
        var time = this.getTime(!onCrash),
            count = 0,
            human = 0,
            winner,
            motor,
            i;
        if (time > 0) {
            for (i = 0; i < this.motors.length; i++) {
                motor = this.motors[i];
                motor.move(time);
            }
            for (i = 0; i < this.motors.length; i++) {
                motor = this.motors[i];
                if (!motor.stuck && this.check(motor)) {
                    motor.stuck = time - 1;
                    motor.move();
                }
                if (motor.stuck && !motor.crash) {
                    motor.crash = time - motor.stuck > this.rubber;
                    if (motor.crash && onCrash) {
                        onCrash.call(this, i, time);
                    }
                }
                if (motor.crash) {
                    count++;
                } else {
                    if (!motor.bot) {
                        human++;
                    }
                    winner = i;
                }
            }
            if ((count >= i - 1 && count > 0) || human === 0) {
                return winner || 0;
            }
        }
        return false;
    };

    return {
        Motor: Motor,
        Match: Match
    };

})();
