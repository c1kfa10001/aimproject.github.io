$(document).ready(function () {
    data = {
        'players': new Storage('players'),
    };
    navigation = new Navigation();
    navigation.showLogin();
});

function Player(playerData) {
    this.data = playerData;
    if (this.data.level === undefined) this.data.level = 1;
    if (this.data.xp === undefined) this.data.xp = 0;

    this.getProgress = function () {
        var xpRequired = 0;
        var exponent = 1;
        for (var i = 1; i < this.data.level; i++) {
            xpRequired += 150 * exponent;
            exponent = exponent * 1.03;
        }
        const xpRequiredNextLevel = xpRequired + 150 * exponent;
        return parseInt((this.data.xp - xpRequired) / (xpRequiredNextLevel - xpRequired) * 100);
    };

    this.getDifficulty = function () {
        return Math.min(this.data.level, 100);
    };

    this.addXp = function (xp) {
        this.data.xp += xp;
        while (this.getProgress() >= 100) {
            this.data.level++;
        }
        data.player.save(this.data);
    };
}

function GameUi() {
    const board = new Board(data.game.read());
    const player = new Player(data.player.read());
    const computer = new ComputerPlayer(player.getDifficulty(), board, 2);
    const gameUi = this;

    // render the game in html
    this.renderGame = function () {
        // make all cells not selectable by default
        $(".cell").removeClass('available');
        $(".cell").off("click");
        // remove all stones
        $(".cell > .stone").removeClass("p1");
        $(".cell > .stone").removeClass("p2");
        // put current stones
        for (var r = 0; r < board.data.size; r++) {
            for (var c = 0; c < board.data.size; c++) {
                if (board.data.map[r][c] == 0) continue; // no stones in this cell
                $(`#cell_${r}_${c} > .stone`).addClass(`p${board.data.map[r][c]}`);
            }
        }
        // mark available cells
        const moves = board.getMoves();
        for (var i in moves) {
            const move = moves[i];
            if (move === 'pass') continue; // nothing to draw in the UI
            const cell = $(`#cell_${move[0]}_${move[1]}`);
            cell.addClass('available');
            if (board.data.nextPlayer === 1) {
                cell.on('click', () => gameUi.makeMove(move[0], move[1]));
            }
        }

        // show loading if computer is taking turn
        if (board.data.nextPlayer === 2) {
            $("#loadingPage").show();
        } else {
            $("#loadingPage").hide();
        }

        // set scores
        $("#playerScore").text(board.countStones(1));
        $("#computerScore").text(board.countStones(2));

        // game over
        const result = board.gameOver();
        switch (result) {
            case -1:
                $(".results").hide();
                $(".resultnewgame").hide();
                break;
            case 0:
                $(".results").text("It's a TIE!");
                $(".results").show();
                $("#loadingPage").hide();
                $(".resultnewgame").show();
                player.addXp(2 * board.countStones(1)); // double xp for tie
                navigation.showUser();
                data.game.delete();
                break;
            case 1:
                $(".results").text("You WON!");
                $(".results").show();
                $("#loadingPage").hide();
                $(".resultnewgame").show();
                player.addXp(3 * board.countStones(1)); // triple xp for winning
                navigation.showUser();
                data.game.delete();
                break;
            case 2:
                $(".results").text("You LOST!");
                $(".results").show();
                $("#loadingPage").hide();
                $(".resultnewgame").show();
                player.addXp(board.countStones(1)); // number of stones as xp for losing
                navigation.showUser();
                data.game.delete();
                break;
        }
    };

    // make player move
    this.makeMove = function (r, c) {
        board.playMove([r, c]);
        this.autoProgressGame(() => {
            data.game.save(board.data);
            this.renderGame();
        });
    };

    // make computer moves and player-forced pass moves
    this.autoProgressGame = function (callback) {
        // check if game ended
        if (board.gameOver() !== -1) { 
            callback();
            return;
        }
        // make computer move if it's its turn
        if (board.data.nextPlayer === 2) {
            this.renderGame();
            setTimeout(() => {
                computer.play();
                gameUi.autoProgressGame(callback);
            }, 0);
            return;
        }
        // auto-pass if it's the only action
        var moves = board.getMoves();
        var isPass = moves.length === 1 && moves[0] === 'pass';
        if (isPass) {
            board.playMove('pass'); // play pass
            if (board.gameOver() !== -1) return; // game ended
            this.renderGame();
            setTimeout(() => {
                computer.play(); // computer play
                gameUi.autoProgressGame(callback);
            }, 0);
            return;
        }
        callback();
    };

    // put initial html
    console.log(board.data);
    var html = '';
    // row headers
    html += '<div class="row flex-nowrap"><div class="col cell-header cell-col-header"></div>'
    for (var c = 0; c < board.data.size; c++) {
        html += `<div class='col cell-header'>${c+1}</div>`;
    }
    html += '</div>';
    for (var r = 0; r < board.data.size; r++) {
        html += '<div class="row flex-nowrap">'
        html += `<div class='col cell-col-header'>${String.fromCharCode(65 + r)}</div>`;
        for (var c = 0; c < board.data.size; c++) {
            html += `<div class="col cell" id="cell_${r}_${c}"><div class="container stone"></div></div>`;
        }
        html += '</div>';
    }
    $('#board').html(html);
    // first render
    this.autoProgressGame(() => {
        data.game.save(board.data);
        this.renderGame();
    });
}

function Navigation(storage) {

    this.showLogin = function () {
        $('.user').hide();
        this.showPage('loadingPage');
        const players = data.players.exists() ? data.players.read() : [];
        if (players.length > 0) {
            $.each(players, function (i, item) {
                $("#selectedUser").append($('<option>', { value: item, text: item }));
            });
        } else {
            $("#loginDivider").hide();
            $("#selectUser").hide();
        }
        this.showPage('login');
    };

    this.createUser = function () {
        const userName = $("#registeredUser").val();
        const players = data.players.exists() ? data.players.read() : [];
        if (players.indexOf(userName) < 0) { // add to the list only if it's a new user - for existing users we will just override their data to the default
            players.push(userName);
            data.players.save(players);
        }
        const player = new Player({ name: userName });
        data.player = new Storage(`player-${userName}`);
        data.game = new Storage(`game-${userName}`);
        data.player.save(player.data);
        this.showHome();
    };

    this.selectUser = function () {
        const userName = $("#selectedUser").val();
        data.player = new Storage(`player-${userName}`);
        data.game = new Storage(`game-${userName}`);
        if (!data.player.exists) {
            const player = new Player({ name: userName });
            data.player.save(player.data);
        }
        this.showHome();
    }

    this.showUser = function () {
        const player = new Player(data.player.read());
        $(".username").text(player.data.name);
        $(".level").text(`Level ${player.data.level}`);
        $(".xp").text(`${player.data.xp} XP`);
        $(".progress-bar").width(`${player.getProgress()}%`);
        $('.user').show();
    };

    this.showHome = function () {
        this.showUser();
        this.showPage('loadingPage');
        $("#continueGameBtn").prop('disabled', !data.game.exists());
        this.showPage('home');
    };

    this.showCreateGame = function () {
        this.showUser();
        this.showPage('createGame');
    };

    this.newGame = function () {
        this.showUser();
        this.showPage('loadingPage');
        const size = parseInt($('#gameSize').val());
        const board = new Board({ size: size });
        data.game.save(board.data);
        gameUi = new GameUi();
        this.showPage('game');
    };

    this.showPage = function (page) {
        $('.page').hide();
        $(`#${page}`).show();
    };

    this.continueLastGame = function () {
        this.showUser();
        this.showPage('loadingPage');
        gameUi = new GameUi();
        this.showPage('game');
    };
}

function Storage(key) {
    this.exists = function () {
        return localStorage.getItem(key) !== null;
    }

    this.read = function () {
        return JSON.parse(localStorage.getItem(key));
    };

    this.save = function (value) {
        localStorage.setItem(key, JSON.stringify(value));
    };

    this.delete = function () {
        localStorage.removeItem(key);
    }
}

function Board(data) {
    // line directions we can take (v for vertical step, h for horizontal step)
    const steps = [
        { v: -1, h: -1 },
        { v: -1, h: 0 },
        { v: -1, h: 1 },
        { v: 0, h: -1 },
        { v: 0, h: 1 },
        { v: 1, h: -1 },
        { v: 1, h: 0 },
        { v: 1, h: 1 },
    ];

    // returns true if coordinates are outside the playable area
    this.isOutsideMap = function (r, c) {
        return r < 0 || c < 0 || r >= this.data.size || c >= this.data.size;
    };

    // returns the number of stones we can flip in {step} direction if we put a rock for {player} at row {r} column {c}
    this.getStepPoints = function (step, r, c, player) {
        var points = 0;
        var cr = r + step.v;
        var cc = c + step.h;
        const other = this.otherPlayer(player);
        // count opponent consecutive stones in this direction
        while (!this.isOutsideMap(cr, cc) && this.data.map[cr][cc] === other) {
            points++;
            cr += step.v;
            cc += step.h;
        }
        if (this.isOutsideMap(cr, cc)) return 0; // did not find player stone in that direction
        if (this.data.map[cr][cc] === player) return points; // we can flip all stones in between
        return 0; // empty space after opponent in this direction so we cannot flip anything
    };

    // returns the number of stones we can flip in all directions if we put a rock for {player} at row {r} column {c}
    this.isValidMove = function (r, c, player) {
        for (const i in steps) {
            if (this.getStepPoints(steps[i], r, c, player) > 0) return true;
        }
        return false;
    };

    // returns the moves available for specified {player}
    this.getMovesForPlayer = function (player) {
        const moves = [];
        for (var r = 0; r < this.data.size; r++) {
            for (var c = 0; c < this.data.size; c++) {
                if (this.data.map[r][c] !== 0) continue; // cell already occupied
                if (this.isValidMove(r, c, player)) {
                    moves.push([r, c]);
                }
            }
        }
        if (moves.length === 0) {
            moves.push('pass');
        }
        return moves;
    };

    // returns true if specified {player} has any valid moves, false otherwise
    this.playerHasMoves = function (player) {
        for (var r = 0; r < this.data.size; r++) {
            for (var c = 0; c < this.data.size; c++) {
                if (this.data.map[r][c] !== 0) continue; // cell already occupied
                if (this.isValidMove(r, c, player)) {
                    return true;
                }
            }
        }
        return false;
    };

    // return possible moves for the current player
    this.getMoves = function () {
        if (this.data.cachedMoves === undefined) {
            this.data.cachedMoves = this.getMovesForPlayer(this.data.nextPlayer);
        }
        return this.data.cachedMoves;
    };

    // plays the specified move in the game
    this.playMove = function (move) {
        if (move !== 'pass') {
            // turn stones that are captured
            for (const s in steps) {
                const step = steps[s];
                const points = this.getStepPoints(step, move[0], move[1], this.data.nextPlayer);
                for (var i = 1; i <= points; i++) {
                    this.data.map[move[0] + step.v * i][move[1] + step.h * i] = this.data.nextPlayer;
                }
            }
            // mark cell
            this.data.map[move[0]][move[1]] = this.data.nextPlayer;
        }
        this.data.nextPlayer = this.otherPlayer(this.data.nextPlayer);
        this.clearCache();
        this.data.round++;
    };

    this.clearCache = function () {
        this.data.cachedMoves = undefined; // invalide moves cache from last round
        this.data.gameOver = undefined; // invalidate cache for game over state
    }

    this.precomputeCache = function () {
        this.gameOver();
        this.getMoves();
    };

    // return -1 if the game is not over, 0 if the game is completed with a tie, otherwise the number of the winning player, used cached data when available
    this.gameOver = function () {
        if (this.data.gameOver === undefined) {
            this.data.gameOver = this.computeGameOver();
        }
        return this.data.gameOver;
    };

    // return -1 if the game is not over, 0 if the game is completed with a tie, otherwise the number of the winning player
    this.computeGameOver = function () {
        if (this.playerHasMoves(this.data.nextPlayer)) return -1; // game not over yet
        if (this.playerHasMoves(this.otherPlayer(this.data.nextPlayer))) return -1; // game not over yet, this player can pass and the other can make a move
        const p1Stones = this.countStones(1);
        const p2Stones = this.countStones(2);
        if (p1Stones === p2Stones) return 0; // tie
        else if (p1Stones > p2Stones) return 1; // p1 won
        else return 2; // p2 won
    };

    // count the number of stones for {player}
    this.countStones = function (player) {
        var stones = 0;
        for (var r = 0; r < this.data.size; r++) {
            for (var c = 0; c < this.data.size; c++) {
                if (this.data.map[r][c] == player) stones++;
            }
        }
        return stones;
    };

    this.initMap = function () {
        this.data.map = new Array(this.data.size);
        for (var r = 0; r < this.data.size; r++) {
            this.data.map[r] = new Array(this.data.size);
            for (var c = 0; c < this.data.size; c++) {
                this.data.map[r][c] = 0;
            }
        }
        const lowerMid = this.data.size / 2 - 1;
        const upperMid = this.data.size / 2;
        this.data.map[lowerMid][lowerMid] = this.data.map[upperMid][upperMid] = 1;
        this.data.map[lowerMid][upperMid] = this.data.map[upperMid][lowerMid] = 2;
    };

    this.randomPlayer = function () {
        return parseInt(Math.round(Math.random()) + 1);
    };

    this.otherPlayer = function (player) {
        if (player == 1) return 2;
        else return 1;
    };
        
    this.data = data;
    if (this.data.size === undefined) this.data.size = 8;
    if (this.data.size % 2 !== 0) throw "Only even map sizes allowed!";
    if (this.data.map === undefined) this.initMap();
    if (this.data.nextPlayer === undefined) this.data.nextPlayer = this.randomPlayer();
    if (this.data.round === undefined) this.data.round = 1;
}

// Ai player code. difficulty param is a number between from 0 to 100 with higher numbers resulting in better AI play.
function ComputerPlayer(difficulty, board, playerNumber) {
    // game wrapper class to connect with the generic MCTS implementation
    function game() {

        this.getState = function () {
            return board.data;
        };
        this.setState = function (state) {
            board.data = state;
        };
        this.cloneState = function () {
            board.precomputeCache();
            return JSON.parse(JSON.stringify(this.getState()));
        };
        this.moves = function () {
            return board.getMoves();
        };
        this.playMove = function (move) {
            board.playMove(move);
        };
        this.gameOver = function () {
            return board.gameOver() !== -1;
        };
        this.winner = function () {
            const res = board.gameOver();
            if (res === 0) return -1; // MCTS impl requires -1 for draws
            return res;
        };
    }

    const minIterations = 100;
    const maxIterations = 10000;
    const iterations = parseInt(minIterations + (maxIterations - minIterations) * difficulty / 100);
    const exploration = 1.41; // reasonable default exploration param for MCTS

    this.ai = new MCTS(new game(), playerNumber, iterations, exploration);

    this.play = function () {
        const move = this.ai.selectMove(); // run the MCTS to get the best possible move
        console.log("computer chose move", move);
        board.playMove(move); // make the move on the board
        return move; // return the move we made
    };
}

// Generic Monte Carlo Tree Search implementation, taken from https://github.com/SethPipho/monte-carlo-tree-search-js/blob/master/src/MCTS.js
class MCTSNode {
    constructor(moves, parent) {
        this.parent = parent
        this.visits = 0
        this.wins = 0
        this.numUnexpandedMoves = moves.length
        this.children = new Array(this.numUnexpandedMoves).fill(null) //temporary store move for debugging purposes
    }
}


class MCTS {
    constructor(game, player, iterations, exploration) {
        this.game = game
        this.player = player
        this.iterations = iterations
        this.exploration = exploration

        if (this.iterations == undefined) {
            this.iterations = 500
        }
        if (this.exploration == undefined) {
            this.exploration = 1.41
        }
    }

    selectMove() {
        const originalState = this.game.getState()
        const possibleMoves = this.game.moves()
        const root = new MCTSNode(possibleMoves, null)

        for (let i = 0; i < this.iterations; i++) {
            this.game.setState(originalState)
            const clonedState = this.game.cloneState()
            this.game.setState(clonedState)

            let selectedNode = this.selectNode(root)
            //if selected node is terminal and we lost, make sure we never choose that move
            if (this.game.gameOver()) {
                if (this.game.winner() != this.player && this.game.winner() != -1) {
                    selectedNode.parent.wins = Number.MIN_SAFE_INTEGER
                }
            }
            let expandedNode = this.expandNode(selectedNode)
            this.playout(expandedNode)

            let reward;
            if (this.game.winner() == -1) { reward = 0 }
            else if (this.game.winner() == this.player) { reward = 1 }
            else { reward = -1 }
            this.backprop(expandedNode, reward)
        }

        //choose move with most wins
        let maxWins = -Infinity
        let maxIndex = -1
        for (let i in root.children) {
            const child = root.children[i]
            if (child == null) { continue }
            if (child.wins > maxWins) {
                maxWins = child.wins
                maxIndex = i
            }
        }

        this.game.setState(originalState);
        return possibleMoves[maxIndex]
    }
    selectNode(root) {

        const c = this.exploration

        while (root.numUnexpandedMoves == 0) {
            let maxUBC = -Infinity
            let maxIndex = -1
            let Ni = root.visits
            for (let i in root.children) {
                const child = root.children[i]
                const ni = child.visits
                const wi = child.wins
                const ubc = this.computeUCB(wi, ni, c, Ni)
                if (ubc > maxUBC) {
                    maxUBC = ubc
                    maxIndex = i
                }
            }
            const moves = this.game.moves()
            this.game.playMove(moves[maxIndex])

            root = root.children[maxIndex]
            if (this.game.gameOver()) {
                return root
            }
        }
        return root
    }

    expandNode(node) {
        if (this.game.gameOver()) {
            return node
        }
        let moves = this.game.moves()
        const childIndex = this.selectRandomUnexpandedChild(node)
        this.game.playMove(moves[childIndex])

        moves = this.game.moves()
        const newNode = new MCTSNode(moves, node)
        node.children[childIndex] = newNode
        node.numUnexpandedMoves -= 1

        return newNode
    }

    playout(node) {
        while (!this.game.gameOver()) {
            const moves = this.game.moves()
            const randomChoice = Math.floor(Math.random() * moves.length)
            this.game.playMove(moves[randomChoice])
        }
        return this.game.winner()
    }
    backprop(node, reward) {
        while (node != null) {
            node.visits += 1
            node.wins += reward
            node = node.parent
        }
    }

    // returns index of a random unexpanded child of node
    selectRandomUnexpandedChild(node) {
        const choice = Math.floor(Math.random() * node.numUnexpandedMoves) //expand random nth unexpanded node
        let count = -1
        for (let i in node.children) {
            const child = node.children[i]
            if (child == null) {
                count += 1
            }
            if (count == choice) {
                return i
            }
        }
    }

    computeUCB(wi, ni, c, Ni) {
        return (wi / ni) + c * Math.sqrt(Math.log(Ni) / ni)
    }
}
