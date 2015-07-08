var Game = (function() {
    "use strict";

    function Motor(x, y, v, i) {
        this.id = i; // Motor ID
        this.x = x; // X coordinate
        this.y = y; // Y coordinate
        this.vec = v; // Direction vector
        this.time = 0; // Time
        this.data = []; // Line data
        this.stuck = false;
        this.add();
    }

    Motor.UP = 0;
    Motor.RIGHT = 1;
    Motor.DOWN = 2;
    Motor.LEFT = 3;

    Motor.prototype.add = function() {
        this.data.unshift([this.x, this.y, this.vec, this.time]);
    };

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
        return true;
    };

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
        return true;
    };

    Motor.prototype.back = function() {
        this.x = this.data[0][0];
        this.y = this.data[0][1];
        this.vec = this.data[0][2];
        this.time = this.data[0][3];
        this.data.shift();
    };

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

    Motor.prototype.wall = function(distance) {
        return this.x > distance || this.x < -distance || this.y > distance || this.y < -distance;
    };

    function Match() {
        this.timer = 25;
        this.distance = 125;
        this.start = new Date().getTime() + 2000;
        this.motors = [];
    }

    Match.prototype.add = function (x, y, v) {
        var motor = new Motor(x, y, v, this.motors.length);
        this.motors.push(motor);
        return motor;
    };

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

    Match.prototype.getTime = function () {
        return Math.round((new Date().getTime() - this.start) / this.timer);
    };

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

    function Bot(motor, match) {
        this.motor = motor;
        this.match = match;
    }

    Bot.prototype.check = function() {
        var motor = this.motor,
            time = motor.time,
            dir = Math.random() >= .5,
            toTime = time + 10 + Math.round(Math.random() * 10);
        if (!motor.stuck) {
            motor.move(toTime);
            if (this.match.check(motor)) {
                motor.move(time);
                motor.turn(dir ? Motor.RIGHT : Motor.LEFT);
                motor.move(toTime);
                if (this.match.check(motor)) {
                    motor.back();
                    motor.turn(dir ? Motor.LEFT : Motor.RIGHT);
                    motor.move(toTime);
                    if (this.match.check(motor)) {
                        motor.back();
                    }
                }
            }
            motor.move(time);
        }
    };

    return {
        Motor: Motor,
        Match: Match,
        Bot: Bot
    };

})();

module.exports = Game;
