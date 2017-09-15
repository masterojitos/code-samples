var socket,
    players = [],
    ball = {},
    lastsecond = null,
    newsecond = null;

function getRandom(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

function init() {
    var express = require('express'),
        app = express(),
        server = require('http').createServer(app),
        io = require('socket.io');

    app.use(express.static(__dirname + '/public'));

    server.listen(20000);
    socket = io.listen(server);
    socket.configure(function() {
        socket.set("transports", ["websocket"]);
        socket.set("log level", 2);
    });
    socket.sockets.on("connection", onSocketConnection);

    ball.x = getRandom(100, 910 * 0.8);
    ball.y = getRandom(50, 540 * 0.6);
};

function onSocketConnection(client) {
    console.log("New player has connected: " + client.id);
    client.emit("new ball", {
        x: ball.x,
        y: ball.y
    });
    client.on("disconnect", onClientDisconnect);
    client.on("new player", onNewPlayer);
    client.on("move player", onMovePlayer);
    client.on("new ball", onBallCaught);
};

function onClientDisconnect() {
    console.log("Player has disconnected: " + this.id);

    var playerIndex = getPlayerIndexById(this.id);
    if (playerIndex === false) {
        console.log("Player not found: " + this.id);
        return;
    };
    players.splice(playerIndex, 1);

    this.broadcast.emit("remove player", {
        id: this.id
    });
};

function onNewPlayer(data) {
    var newPlayer = {};
    newPlayer.imageColumn = data.imageColumn;
    newPlayer.imageRow = data.imageRow;
    newPlayer.x = data.x;
    newPlayer.y = data.y;
    newPlayer.ballsCaught = 0;
    newPlayer.id = this.id;
    newPlayer.nick = data.nick;

    this.broadcast.emit("new player", {
        imageColumn: newPlayer.imageColumn,
        imageRow: newPlayer.imageRow,
        x: newPlayer.x,
        y: newPlayer.y,
        id: newPlayer.id,
        ballsCaught: 0,
        nick: newPlayer.nick
    });

    var i, existingPlayer;
    for (i = 0; i < players.length; i++) {
        existingPlayer = players[i];
        this.emit("new player", {
            imageColumn: existingPlayer.imageColumn,
            imageRow: existingPlayer.imageRow,
            x: existingPlayer.x,
            y: existingPlayer.y,
            id: existingPlayer.id,
            ballsCaught: existingPlayer.ballsCaught,
            nick: existingPlayer.nick
        });
    };

    players.push(newPlayer);
};

function onMovePlayer(data) {
    var playerIndex = getPlayerIndexById(this.id);
    if (playerIndex === false) {
        console.log("Player not found: " + this.id);
        return;
    };
    var existingPlayer = players[playerIndex];
    existingPlayer.x = data.x;
    existingPlayer.y = data.y;
    existingPlayer.position = data.position;

    this.broadcast.emit("move player", {
        x: existingPlayer.x,
        y: existingPlayer.y,
        position: existingPlayer.position,
        id: existingPlayer.id
    });
};

function getPlayerIndexById(id) {
    for (var i = 0; i < players.length; i++) {
        if (players[i].id == id) return i;
    };
    return false;
};

function onBallCaught() {
    newsecond = new Date().getSeconds();
    if (lastsecond === 59 && newsecond === 0) newsecond = 60;
    if (lastsecond !== null && (lastsecond === newsecond || lastsecond === newsecond - 1)) return false;

    var playerIndex = getPlayerIndexById(this.id);
    if (playerIndex === false) {
        console.log("Player not found: " + this.id);
        return;
    };
    ++players[playerIndex].ballsCaught;

    if (lastsecond === 59 && newsecond === 60) newsecond = 0;
    lastsecond = newsecond;

    ball.x = getRandom(100, 910 * 0.8);
    ball.y = getRandom(50, 540 * 0.6);
    this.emit("new ball", {
        x: ball.x,
        y: ball.y
    });
    this.broadcast.emit("new ball", {
        x: ball.x,
        y: ball.y,
        id: players[playerIndex].id
    });
};

init();