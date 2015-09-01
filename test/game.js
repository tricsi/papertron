describe("game", function() {
    "use strict";

    var assert = require("assert"),
        game = require("../src/game.js");

    var motor,
        match;

    describe("Motor", function() {

        describe("check", function() {

            it("return true when crossing", function() {
                motor = new game.Motor(0, 0, game.Motor.R, 0);
                motor.move(40);
                assert.equal(true, motor.check(10, 10, 10, -10));
            });

            it("return true when contacting", function() {
                motor = new game.Motor(0, 0, game.Motor.R, 0);
                motor.move(40);
                assert.equal(true, motor.check(0, 10, 0, -10));
            });

            it("return false when not crossing", function() {
                motor = new game.Motor(0, 0, game.Motor.R, 0);
                motor.move(40);
                assert.equal(false, motor.check(50, 10, 50, -10));
            });

            it("return false when paralel", function() {
                motor = new game.Motor(0, 0, game.Motor.R, 0);
                motor.move(40);
                assert.equal(false, motor.check(0, 10, 10, 10));
            });

            it("return true when overlap X", function() {
                motor = new game.Motor(0, 0, game.Motor.R, 0);
                motor.move(40);
                assert.equal(true, motor.check(-10, 0, 10, 0));
            });

            it("return false when not overlap X", function() {
                motor = new game.Motor(0, 0, game.Motor.R, 0);
                motor.move(40);
                assert.equal(false, motor.check(50, 0, 60, 0));
            });

            it("return true when overlap Y", function() {
                motor = new game.Motor(0, 0, game.Motor.D, 0);
                motor.move(40);
                assert.equal(true, motor.check(0, -10, 0, 10));
            });

            it("return false when not overlap Y", function() {
                motor = new game.Motor(0, 0, game.Motor.D, 0);
                motor.move(40);
                assert.equal(false, motor.check(0, 50, 0, 60));
            });
        });

        describe("turn", function() {

            it("can turn left", function() {
                motor = new game.Motor(0, 0, game.Motor.U);
                motor.turn(game.Motor.L);
                assert.equal(game.Motor.L, motor.vec);
            });

            it("can turn right", function() {
                motor = new game.Motor(0, 0, game.Motor.U);
                motor.turn(game.Motor.R);
                assert.equal(game.Motor.R, motor.vec);
            });

        });

        describe("move", function() {

            it("can move up", function() {
                motor = new game.Motor(0, 0, game.Motor.U);
                motor.move(50);
                assert.equal(-50, motor.y);
            });

            it("can move down", function() {
                motor = new game.Motor(0, 0, game.Motor.D);
                motor.move(50);
                assert.equal(50, motor.y);
            });

            it("can move left", function() {
                motor = new game.Motor(0, 0, game.Motor.L);
                motor.move(50);
                assert.equal(-50, motor.x);
            });

            it("can move right", function() {
                motor = new game.Motor(0, 0, game.Motor.R);
                motor.move(50);
                assert.equal(50, motor.x);
            });

        });

    });

    describe("Match", function() {

        describe("add", function() {

            it("can add motor", function() {
                match = new game.Match();
                motor = match.add(0, 0, 0);
                assert.equal(1, match.motors.length);
            });

        });

        describe("check", function() {

            it("can check motor after turn", function() {
                match = new game.Match();
                motor = match.add(0, 0, game.Motor.U);
                motor.move(50);
                motor.turn(game.Motor.R);
                assert.equal(false, match.check(motor));
            });

            it("check self overlap", function() {
                match = new game.Match();
                motor = match.add(0, 0, game.Motor.U);
                motor.move(50);
                motor.turn(game.Motor.R);
                motor.move(60);
                motor.turn(game.Motor.L);
                motor.move(70);
                motor.turn(game.Motor.L);
                motor.move(90);
                motor.turn(game.Motor.L);
                motor.move(160);
                motor.turn(game.Motor.L);
                motor.move(170);
                motor.turn(game.Motor.L);
                motor.move(190);
                assert.equal(true, match.check(motor));
            });

        });
    });

});
