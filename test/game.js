describe("game", function() {
    "use strict";

    var assert = require("assert"),
        game = require("../src/game.js");

    var motor;

    describe("Motor", function() {

        describe("check", function() {

            motor = new game.Motor(0, 0, game.Motor.RIGHT);
            motor.move(40);

            it("return true when crossing", function() {
                assert.equal(true, motor.check(10, 10, 10, -10));
            });

            it("return true when contacting", function() {
                assert.equal(true, motor.check(0, 10, 0, -10));
            });

            it("return false when not crossing", function() {
                assert.equal(false, motor.check(50, 10, 50, -10));
            });

            it("return false when paralel", function() {
                assert.equal(false, motor.check(0, 10, 10, 10));
            });

            it("return true when fade", function() {
                assert.equal(true, motor.check(0, 0, 10, 0));
            });

        });

        describe("turn", function() {

            it("can turn left", function() {
                motor = new game.Motor(0, 0, game.Motor.UP);
                motor.turn(game.Motor.LEFT);
                assert.equal(game.Motor.LEFT, motor.vec);
            });

            it("can turn right", function() {
                motor = new game.Motor(0, 0, game.Motor.UP);
                motor.turn(game.Motor.RIGHT);
                assert.equal(game.Motor.RIGHT, motor.vec);
            });

        });

        describe("move", function() {

            it("can move up", function() {
                motor = new game.Motor(0, 0, game.Motor.UP);
                motor.move(50);
                assert.equal(-50, motor.y);
            });

            it("can move down", function() {
                motor = new game.Motor(0, 0, game.Motor.DOWN);
                motor.move(50);
                assert.equal(50, motor.y);
            });

            it("can move left", function() {
                motor = new game.Motor(0, 0, game.Motor.LEFT);
                motor.move(50);
                assert.equal(-50, motor.x);
            });

            it("can move right", function() {
                motor = new game.Motor(0, 0, game.Motor.RIGHT);
                motor.move(50);
                assert.equal(50, motor.x);
            });

        });

    });

    describe("add", function() {

        it("can add motor", function() {
            motor = game.add(0, 0, 0);
            assert.equal(1, game.motors.length);
        });

    });

});
