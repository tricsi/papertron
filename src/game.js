var Game = (function() {

    var time = 0;
        motors = [];

    function Motor(x, y, v) {
        this.x = x; // X coordinate
        this.y = y; // Y coordinate
        this.vec = v; // Direction vector
        this.time = 0; // Time
        this.speed = 1; // Speed
        this.data = []; // Line data
        this.add();
    }

    Motor.UP = 0;
    Motor.RIGHT = 1;
    Motor.DOWN = 2;
    Motor.LEFT = 3;

    Motor.prototype.add = function() {
        this.data.push([this.x, this.y, this.vec, this.time]);
    };

    Motor.prototype.move = function(time) {
        this.x = this.data[0][0];
        this.y = this.data[0][1];
        this.vec = this.data[0][2];
        this.time = this.data[0][3];
        if (time > this.time) {
            var add = (time - this.time) * this.speed;
            switch (this.vec) {
                case Motor.LEFT:
                    this.x -= add;
                    break;
                case Motor.RIGHT:
                    this.x += add;
                    break;
                case Motor.UP:
                    this.y -= add;
                    break;
                case Motor.DOWN:
                    this.y += add;
                    break;
            }
            this.time = time;
        }
    };

    Motor.prototype.turn = function (to){
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

    Motor.prototype.check = function(x1, y1, x2, y2) {
        var x = this.data[0][0],
            y = this.data[0][1],
            d = ((x2 - x1) * (y - this.y)) - ((y2 - y1) * (x - this.x)),
            n1 = ((y1 - this.y) * (x - this.x)) - ((x1 - this.x) * (y - this.y)),
            n2 = ((y1 - this.y) * (x2 - x1)) - ((x1 - this.x) * (y2 - y1)),
            r,
            s;
        if (d == 0) {
            return n1 == 0 && n2 == 0;
        }
        r = n1 / d;
        s = n2 / d;
        return (r >= 0 && r <= 1) && (s >= 0 && s <= 1);
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
            other.data.forEach(function(item) {
                if (motor.check(x, y, item[0], item[1])) {
                    result = true;
                }
                x = item[0];
                y = item[1];
            });
        });
        return result;
    }

    function run() {
        time++;
        motors.forEach(function(motor) {
            motor.move(time);
            check(motor);
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