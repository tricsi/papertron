var Game = (function() {
    "use strict";

    var time = 0,
        motors = [];

    function Motor(x, y, v) {
        this.x = x; // X coordinate
        this.y = y; // Y coordinate
        this.vec = v; // Direction vector
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
        var x = this.data[0][0],
            y = this.data[0][1],
            d = ((x2 - x1) * (y - this.y)) - ((y2 - y1) * (x - this.x)),
            n1 = ((y1 - this.y) * (x - this.x)) - ((x1 - this.x) * (y - this.y)),
            n2 = ((y1 - this.y) * (x2 - x1)) - ((x1 - this.x) * (y2 - y1)),
            r,
            s;
        if (d === 0) {
            this.stuck = n1 === 0 && n2 === 0;
        } else {
            r = n1 / d;
            s = n2 / d;
            this.stuck = (r >= 0 && r <= 1) && (s >= 0 && s <= 1);
        }
        return this.stuck;
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
                y = other.y;
            other.data.forEach(function(item, i) {
                if (i > 0 || other !== motor) {
                    if (motor.check(x, y, item[0], item[1])) {
                        result = true;
                    }
                }
                x = item[0];
                y = item[1];
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
            });
        });
        return result;
    }

    function run() {
        time++;
        motors.forEach(function(motor) {
            check(motor);
            motor.move(time);
        });
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
