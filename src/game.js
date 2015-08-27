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
	 * Check and set next movement
	 * @param {Match} match
	 */
	Motor.prototype.ai = function (match) {
		var motor = this,
			time = motor.time,
			dir = Math.random() >= .5,
			toTime = time + 10 + Math.round(Math.random() * 10),
			result = false;
		if (!motor.stuck) {
			motor.move(toTime);
			if (match.check(motor)) {
				result = dir ? Motor.RIGHT : Motor.LEFT;
				motor.move(time);
				motor.turn(result);
				motor.move(toTime);
				if (match.check(motor)) {
					result = dir ? Motor.LEFT : Motor.RIGHT;
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
	function Match(mode) {
		this.timer = 40; // Snapshot time
		this.distance = 100; // Wall distance
		this.start = new Date().getTime() + 3000; // Start time
		this.motors = []; // Motors
		this.bots = []; // Robots
        this.mode = mode || 0; // Reverse mode
		this.pos = [
            [0, 50, Motor.UP],
            [0, -50, Motor.DOWN],
            [-50, 0, Motor.RIGHT],
            [50, 0, Motor.LEFT]
        ];
	}

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
		this.start = new Date().getTime() - (snapshot.time * this.timer);
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
		var i = this.motors.length,
			x = this.pos[i][0],
			y = this.pos[i][1],
			v = this.pos[i][2];
		var motor = new Motor(x, y, v, i, nick);
		this.motors.push(motor);
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
				if (to) {
					onTurn.call(this, to, time, i);
				}
			}
		}
	};

	/**
	 * Runs all motor checks
	 * @callback onStuck
	 */
	Match.prototype.run = function (onStuck) {
		var time = this.getTime(!onStuck),
			count = 0,
			human = 0,
			winner,
			motor,
			i;
		if (time > 0) {
			for (i = 0; i < this.motors.length; i++) {
				motor = this.motors[i];
				if (!motor.stuck) {
					motor.move(time);
				}
			}
			for (i = 0; i < this.motors.length; i++) {
				motor = this.motors[i];
				if (motor.stuck) {
					count++;
				} else if (this.check(motor)) {
					motor.stuck = time;
					if (onStuck) {
						onStuck.call(this, i, time);
					}
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
