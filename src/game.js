var Game = (function() {
    "use strict";

    var size = 250,
        start = new Date().getTime() + 3000,
        motors = [];

    function Motor(x, y, v, l) {
        this.x = x; // X coordinate
        this.y = y; // Y coordinate
        this.vec = v; // Direction vector
        this.length = l; // Length
        this.time = 0; // Time
        this.speed = 1; // Speed
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
        if (this.stuck) {
            return false;
        }
        this.x = this.data[0][0];
        this.y = this.data[0][1];
        this.vec = this.data[0][2];
        this.time = this.data[0][3];
        if (toTime > this.time) {
            var addTime = (toTime - this.time) * this.speed;
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
        }
        return false;
    };

    Motor.prototype.turn = function (to) {
        if (this.stuck) {
            return false;
        }
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

    Motor.prototype.check = function(x1, y1, x2, y2) {
        var x3 = this.x,
            y3 = this.y,
            x4 = this.data[0][0],
            y4 = this.data[0][1],
            d, n1, n2, r, s;
        if (x3 === x4 && y3 === y4) { //not line
            return false;
        }
        d = ((x2 - x1) * (y4 - y3)) - ((y2 - y1) * (x4 - x3));
        n1 = ((y1 - y3) * (x4 - x3)) - ((x1 - x3) * (y4 - y3));
        n2 = ((y1 - y3) * (x2 - x1)) - ((x1 - x3) * (y2 - y1));
        if (d !== 0) { //not parallel
            r = n1 / d;
            s = n2 / d;
            this.stuck = (r >= 0 && r <= 1) && (s >= 0 && s <= 1);
        } else if (n1 === 0 && n2 === 0) { //overlap
            switch (this.vec) {
                case Motor.LEFT:
                case Motor.RIGHT:
                    this.stuck = (x1 >= x4 && x2 <= x4) ||
                        (x2 >= x4 && x1 <= x4) ||
                        (x1 >= x3 && x2 <= x3) ||
                        (x2 >= x3 && x1 <= x3);
                    break;
                case Motor.UP:
                case Motor.DOWN:
                    this.stuck = (y1 >= y4 && y2 <= y4) ||
                        (y2 >= y4 && y1 <= y4) ||
                        (y1 >= y3 && y2 <= y3) ||
                        (y2 >= y3 && y1 <= y3);
                    break;
            }
        }
        return this.stuck;
    };

    Motor.prototype.wall = function(distance) {
        if (this.x > distance || this.x < -distance || this.y > distance || this.y < -distance) {
            this.stuck = true;
            return true;
        }
        return false;
    };

    function add(x, y, v) {
        var motor = new Motor(x, y, v);
        motors.unshift(motor);
        return motor;
    }

    function check(motor)
    {
        var result = false;
        motors.forEach(function(other) {
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
        return result;
    }

    function getTime() {
        return (new Date().getTime() - start) / 25;
    }

    function run() {
        var time = getTime();
        if (time > 0) {
            motors.forEach(function(motor) {
                motor.move(time);
                if (!motor.wall(size)) {
                    check(motor);
                }
            });
        }
    }

    return {
        motors: motors,
        Motor: Motor,
        check: check,
        add: add,
        run: run
    };

})();

module.exports = Game;
