var COB = {
    canvas: '',
    context: '',
    width: 900,
    height: 600,
    // width: window.innerWidth - 4, //910
    // height: window.innerHeight - 4, //540
    keysDown: {},
    keys: {
        UP: 38,
        DOWN: 40,
        LEFT: 37,
        RIGHT: 39
    },
    background: {
        url: 'images/battlefield-2b.jpg',
        image: null,
        ready: 0
    },
    player: {
        x: 0,
        y: 0,
        url: 'images/animals-2.png',
        image: '',
        ready: 0,
        positions: {
            DOWN: {
                width: 25,
                height: 40,
                x: [10, 60, 105],
                currentX: 0,
                lastX: 0,
                y: [0, 190],
                total_width: 145
            },
            LEFT: {
                width: 40,
                height: 25,
                x: [5, 50, 100],
                currentX: 0,
                lastX: 0,
                y: [60, 250],
                total_width: 145
            },
            RIGHT: {
                width: 40,
                height: 25,
                x: [0, 50, 100],
                currentX: 0,
                lastX: 0,
                y: [110, 300],
                total_width: 145
            },
            UP: {
                width: 25,
                height: 30,
                x: [10, 60, 105],
                currentX: 0,
                lastX: 0,
                y: [155, 340],
                total_width: 145
            }
        },
        position: '',
        imageColumn: 0,
        imageRow: 0,
        imageX: 0,
        imageY: 0,
        ballsCaught: -1
    },
    players: [],
    socket: '',
    ball: {
        x: 0,
        y: 0,
        url: 'images/ball.png',
        width: 32,
        height: 32,
        image: '',
        ready: 0
    },
    requestAnimationFrame: window.requestAnimationFrame || 
        window.webkitRequestAnimationFrame || 
        window.mozRequestAnimationFrame || 
        window.oRequestAnimationFrame || 
        window.msRequestAnimationFrame || 
        function(callback, element){
            window.setTimeout(callback, 1000 / 60);
        },
    speed: 5,
    init: function(nick) {
        COB.ranking = document.createElement('div');
        COB.ranking.classList.add('ranking');
        document.body.appendChild(COB.ranking);
        
        var rankingTitle = document.createElement('h3');
        rankingTitle.innerHTML = 'Ranking';
        COB.ranking.appendChild(rankingTitle);

        COB.supportMessage = document.createElement('div');
        COB.supportMessage.innerHTML = 'Screen Size Required<br />' + COB.width + ' x ' + COB.height;
        COB.supportMessage.classList.add('support-message', 'hide');
        document.body.appendChild(COB.supportMessage);

        COB.canvas = document.createElement("canvas");
        COB.context = COB.canvas.getContext("2d");
        COB.canvas.width = COB.width;
        COB.canvas.height = COB.height;
        document.body.appendChild(COB.canvas);
        
        COB.background.image = new Image();
        COB.background.image.src = COB.background.url;
        COB.background.image.onload = COB.imageLoaded(COB.background);

        COB.player.image = new Image();
        COB.player.image.src = COB.player.url;
        COB.player.imageColumn = COB.getRandom(0, 3);
        COB.player.imageRow = COB.getRandom(0, 1);
        COB.player.x = COB.getRandom(100, COB.canvas.width * 0.8);
        COB.player.y = COB.getRandom(50, COB.canvas.height * 0.6);
        COB.player.nick = nick;
        COB.player.position = COB.player.positions.DOWN;
        COB.player.image.onload = COB.imageLoaded(COB.player);

        COB.resize();
        // COB.socket = io("http://localhost", {port: 20000});
        COB.socket = io.connect("http://localhost", {port: 20000, transports: ["websocket"]});
        COB.setEventHandlers();
        COB.update();
    },
    imageLoaded: function(image) {
        image.ready = 1;
    },
    getRandom: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    sortByKey: function(array, key) {
        var x, y;
        return array.sort(function (a, b) {
            x = a[key], y = b[key];
            return (x < y) ? 1 : ((x > y) ? -1 : 0);
        });
    },
    setEventHandlers: function() {
        window.addEventListener('keydown', COB.keydown, false);
        window.addEventListener('keyup', COB.keyup, false);
        window.addEventListener('resize', COB.resize, false);
        COB.socket.on("connect", COB.socketConnected);
        COB.socket.on("disconnect", COB.socketDisconnect);
        COB.socket.on("new player", COB.newPlayer);
        COB.socket.on("move player", COB.movePlayer);
        COB.socket.on("remove player", COB.removePlayer);
        COB.socket.on("new ball", COB.newBall);
    },
    keydown: function(e) {
        COB.keysDown[e.keyCode] = '';
    },
    keyup: function(e) {
        delete COB.keysDown[e.keyCode];
    },
    resize: function() {
        if (window.innerWidth < COB.width || window.innerHeight < COB.height) {
            COB.canvas.classList.add('hide');
            COB.ranking.classList.add('hide');
            COB.supportMessage.classList.remove('hide');
        } else {
            COB.canvas.classList.remove('hide');
            COB.ranking.classList.remove('hide');
            COB.supportMessage.classList.add('hide');
        }
        
        // COB.canvas.style.width = (window.innerWidth - 4) + 'px';
        // COB.canvas.style.height = (window.innerHeight - 4) + 'px';
        // COB.canvas.width = window.innerWidth - 4;
        // COB.canvas.height = window.innerHeight - 4;
        /*var devicePixelRatio = window.devicePixelRatio || 1,
            backingStoreRatio = COB.context.webkitBackingStorePixelRatio ||
                            COB.context.mozBackingStorePixelRatio ||
                            COB.context.msBackingStorePixelRatio ||
                            COB.context.oBackingStorePixelRatio ||
                            COB.context.backingStorePixelRatio || 1,
            ratio = devicePixelRatio / backingStoreRatio;
            console.log(devicePixelRatio, backingStoreRatio)
        if (devicePixelRatio !== backingStoreRatio) {
            var oldWidth = COB.canvas.width;
            var oldHeight = COB.canvas.height;

            COB.canvas.width = oldWidth * ratio;
            COB.canvas.height = oldHeight * ratio;

            COB.canvas.style.width = oldWidth + 'px';
            COB.canvas.style.height = oldHeight + 'px';

            COB.context.scale(ratio, ratio);
        }*/

        //evaluar si es mas alto la web o el canvas
        //crear un ratio en cada lado para poder achicarlo
        /*var currentWidth = COB.canvas.width;
        var currentHeight = COB.canvas.height;
        if (window.innerWidth < currentWidth) {
            ratioWidth = window.innerWidth / currentWidth;
            newHeight = currentHeight * ratioWidth;
            ratioHeight = window.innerHeight / newHeight;
        }
        if (window.innerHeight < currentHeight) {
            ratioHeight = window.innerHeight / currentHeight;
            ratioWidth = currentWidth * ratioHeight;
        }

        console.log("h", COB.canvas.height);
        console.log("h2", window.innerHeight);
        var ratio = COB.canvas.width / COB.canvas.height;
        var oldWidth = COB.canvas.width;
        var oldHeight = COB.canvas.height;
        COB.canvas.width = oldWidth * ratio;
        COB.canvas.height = oldHeight * ratio;
        COB.canvas.style.width = oldWidth + 'px';
        COB.canvas.style.height = oldHeight + 'px';
        COB.context.scale(ratio, ratio);*/
    },
    socketConnected: function() {
        COB.socket.emit("new player", {
            imageColumn: COB.player.imageColumn,
            imageRow: COB.player.imageRow,
            x: COB.player.x,
            y: COB.player.y,
            nick: COB.player.nick
        });
    },
    socketDisconnect: function() {
    },
    newPlayer: function(data) {
        var newPlayer = {};
        newPlayer.image = new Image();
        newPlayer.image.src = COB.player.url;
        newPlayer.imageColumn = data.imageColumn;
        newPlayer.imageRow = data.imageRow;
        newPlayer.x = data.x;
        newPlayer.y = data.y;
        newPlayer.nick = data.nick;
        newPlayer.position = COB.player.positions.DOWN;
        newPlayer.image.onload = COB.imageLoaded(newPlayer);
        newPlayer.id = data.id;
        newPlayer.ballsCaught = data.ballsCaught;
        COB.players.push(newPlayer);

        COB.updateRanking();
    },
    movePlayer: function(data) {
        var playerIndex = COB.getPlayerIndexById(data.id);
        if (playerIndex === false) {
            return;
        }
        COB.players[playerIndex].x = data.x;
        COB.players[playerIndex].y = data.y;
        COB.players[playerIndex].position = COB.player.positions[data.position];
    },
    removePlayer: function(data) {
        var playerIndex = COB.getPlayerIndexById(data.id);
        if (playerIndex === false) {
            return;
        }
        COB.players.splice(playerIndex, 1);
        COB.updateRanking();
    },
    drawPlayer: function(player) {
        if (player.ready) {
            player.imageX = player.position.x[0] + player.position.total_width * player.imageColumn;
            player.imageY = player.position.y[player.imageRow];
            COB.context.drawImage(player.image, player.imageX, player.imageY, player.position.width, player.position.height, player.x, player.y, player.position.width, player.position.height);

            if (player.position.currentX === 0) {
                player.position.currentX = 1;
                player.position.lastX = 0;
            } else if (player.position.currentX === 1) {
                player.position.currentX = player.position.lastX === 0 ? 2 : 0;
                player.position.lastX = 1;
            } else {
                player.position.currentX = 1;
                player.position.lastX = 2;
            }
        }
    },
    getPlayerIndexById: function(id) {
        for (var i = 0; i < COB.players.length; i++) {
            if (COB.players[i].id == id) return i;
        }
        return false;
    },
    updateRanking: function() {
        var playersTop = JSON.parse(JSON.stringify(COB.players)), rankingRow;
        playersTop.push(COB.player);
        playersTop = COB.sortByKey(playersTop, 'ballsCaught');
        rankingRow = COB.ranking.getElementsByTagName('span');
        while (rankingRow[0]) COB.ranking.removeChild(rankingRow[0]);
        for (i = 0; i < playersTop.length; i++) {
            rankingRow = document.createElement('span');
            rankingRow.innerHTML = playersTop[i].nick + ': ' + playersTop[i].ballsCaught;
            COB.ranking.appendChild(rankingRow);
        }
    },
    newBall: function(data) {
        if (data.id) {
            var playerIndex = COB.getPlayerIndexById(data.id);
            if (playerIndex === false) {
            } else {
                ++COB.players[playerIndex].ballsCaught;
            }
        } else {
            ++COB.player.ballsCaught;
        }

        COB.ball.image = new Image();
        COB.ball.image.src = COB.ball.url;
        COB.ball.x = data.x;
        COB.ball.y = data.y;
        COB.ball.image.onload = COB.imageLoaded(COB.ball);

        COB.updateRanking();
    },
    update: function() {
        var prevX = COB.player.x, prevY = COB.player.y, position = 'DOWN';
        if (COB.keys.UP in COB.keysDown) {
            if (COB.player.y - COB.speed >= 0) {
                COB.player.y -= COB.speed;
            }
            COB.player.position = COB.player.positions.UP;
            position = 'UP';
        }
        if (COB.keys.DOWN in COB.keysDown) {
            if (COB.player.y + COB.player.positions.DOWN.height + COB.speed <= COB.canvas.height) {
                if (COB.player.y + COB.player.positions.DOWN.height <= 640) {
                    COB.player.y += COB.speed;
                }
            }
            COB.player.position = COB.player.positions.DOWN;
            position = 'DOWN';
        }
        if (COB.keys.LEFT in COB.keysDown) {
            if (COB.player.x - COB.speed >= 0) {
                COB.player.x -= COB.speed;
            }
            COB.player.position = COB.player.positions.LEFT;
            position = 'LEFT';
        }
        if (COB.keys.RIGHT in COB.keysDown) {
            if (COB.player.x + COB.player.positions.RIGHT.width + COB.speed <= COB.canvas.width) {
                COB.player.x += COB.speed;
            }
            COB.player.position = COB.player.positions.RIGHT;
            position = 'RIGHT';
        }

        if (COB.player.x <= (COB.ball.x + COB.ball.width) && COB.ball.x <= (COB.player.x + COB.ball.width) && COB.player.y <= (COB.ball.y + COB.ball.height) && COB.ball.y <= (COB.player.y + COB.ball.height)) {
            COB.socket.emit("new ball");
        }

        if (prevX != COB.player.x || prevY != COB.player.y) {
            COB.socket.emit("move player", {
                x: COB.player.x,
                y: COB.player.y,
                position: position
            });
        }

        COB.draw();
        COB.requestAnimationFrame.call(window, COB.update);
    },
    draw: function() {
        if (COB.background.ready) {
            COB.context.drawImage(COB.background.image, 0, 0, COB.background.image.width, COB.background.image.height, 0, 0, COB.canvas.width, COB.canvas.height);
        }

        COB.drawPlayer(COB.player);

        for (var i = 0; i < COB.players.length; i++) {
            COB.drawPlayer(COB.players[i]);
        }

        if (COB.ball.ready) {
            COB.catchNewBall = false;
            COB.context.drawImage(COB.ball.image, COB.ball.x, COB.ball.y);
        }
    }
};

do {
    var name = prompt("Nick ?");
    if (name != 'null' && name != '') COB.init(name);
} while (name == 'null' || name == '');