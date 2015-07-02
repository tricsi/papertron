"use strict";

module.exports = (function() {

    function connect(socket) {
        console.log("user connected");
        socket.emit("hello", "Hello Socket.IO!");
        socket.on("disconnect", function () {
            console.log("user disconnected");
        });
    }

    return {
        connect: connect
    };

})();
