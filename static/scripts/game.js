$( document ).ready(function() {
    document.gameID = window.location.pathname.split('/')[2];
    const urlParams = new URLSearchParams(window.location.search);
    document.username = urlParams.get("u");
    document.myColour = urlParams.get("c");
    document.game_status = $("#status").data().name;

    document.moveId = 1;
    document.col = 1;
    document.moveOffset = 0;
    document.frozen = false;
    document.plyCounter = 0;
    const dragObj = document.getElementById("dragObj");
    let followMouse = false;
    var nextPlayer = 1;
    var currentStart;
    var currentEnd;
    var hasMoved = false;
    var startObj;
    var startBack;
    var movesLength = 0;
    var lastMove = {
        "w": {
            "from": "",
            "to": ""
        },
        "b": {
            "from": "",
            "to": ""
        }
    };
    var piecestocheck = [];
    let castling = false;

    let currentPlyObject = null;

    getGameState();

    if (document.game_status == "test") {
        $("#in-progress").css("visibility", "visible");
        $("#not-started").css("visibility", "hidden");
        $("#greeting").html(`this is test game ${document.gameID}`);
        $("#result").css("visibility", "hidden");
        $("#test-controls").css("visibility", "visible");
        $("#taken").css("display", "none");
        $("#resign").css("display", "none")
    };

    let moveHistory = "";

    // ! _ec=""
    function legalCheck(_piece, _start, _end, _endContents) {
        var fromS = _start.id;
        var toS = _end.id;
        // ! charAt
        var col = _piece[0];

        // get the type of piece
        var pieceType;
        if (_piece.length == 2) {
            pieceType = _piece[1];
        } else {
            // for bishops, name is longer so indexing must be different
            pieceType = _piece[2];
        };

        // convert square id's to numerical positions
        // ! columnOfSquare
        var fromS0 = String(fromS).charAt(0);
        var startPos = ["ABCDEFGH".indexOf(fromS0) + 1, parseInt(fromS.charAt(1))];
        var endPos = ["ABCDEFGH".indexOf(toS.charAt(0)) + 1, parseInt(toS.charAt(1))];

        // creates a vector of the movement of the piece
        var vector = [endPos[0] - startPos[0], endPos[1] - startPos[1]];

        // convert vectors to unity vectors where necessary
        if (pieceType == "R" || pieceType == "B" || pieceType == "Q") {
            uVector = unitise(vector);
        };

        // determine which functions to apply by piece
        var check = false;
        // ! switch case
        if (pieceType == "R") {
            // combination of check for movement and if there are pieces in the way, this is only needed for R, B & Q
            check = (pdCheck(uVector)[0] && blockedCheck(vector, uVector, startPos, toS));
        } else if (pieceType == "B") {
            check = (pdCheck(uVector)[1] && blockedCheck(vector, uVector, startPos, toS));
        } else if (pieceType == "Q") {
            var pd = pdCheck(uVector);
            var movementCheck = (pd[0] || pd[1]);
            check = (movementCheck && blockedCheck(vector, uVector, startPos, toS));
        } else if (pieceType == "K") {
            check = kingCheck(vector, fromS, toS, col);
        } else if (pieceType == "N") {
            check = nCheck(vector);
        } else {
            check = pCheck(_start, _end, vector, col, _endContents);
        };

        return check;
    };

    // finds a given vectors magnitude
    function calcMagnitude(_vector) {
        var magnitude = Math.sqrt(Math.pow(_vector[0], 2) + Math.pow(_vector[1], 2));
        return magnitude;
    };

    // convert to unit vector
    function unitise(_vector) {
        var magnitude = calcMagnitude(_vector);
        var unitVector = [_vector[0] / magnitude, _vector[1] / magnitude];
        // we only want to round it for diagonal vectors because we need the parts to always have a size of 1 so that the blockedCheck works and if we round orthogonal vectors then ones that are slightly off get accepted
        if (Math.abs(unitVector[0]) == Math.abs(unitVector[1])) {
            unitVector = [Math.round(unitVector[0]), Math.round(unitVector[1])];
        };
        return unitVector;
    };

    // ! names of this lot

    // function checks if you are moving a piece diagonally or perpendicularly
    function pdCheck(_uVector) {
        var D = false;
        var P = false;

        if(Math.abs(_uVector[0]) == Math.abs(_uVector[1])) {
            D = true;
        } else if (_uVector[0] == 0 || _uVector[1] == 0) {
            P = true;
        };

        return [P, D];
    };

    function kCheck(_vector, _from, _to, _col) {
        var pd = pdCheck(_vector);
        var mag = calcMagnitude(_vector);
        var uvec = unitise(_vector);
        var from = $(`#${_from}`)[0];
        var col = from.dataset.piece[0];
        // basic check to validate king movement
        if (mag < 2 && (pd[0] || pd[1])) {
            return true;
        };
    };

    function kingCheck(_vector, _from, _to, _col) {
        let mag = calcMagnitude(_vector);

        // generic king movement check
        if (mag < 2) {
            return true;
        };

        // castling pre-check (basic steps)
        if (Math.abs(_vector[0]) == 2 && _vector[1] == 0) {
            let correctRowIndex = ("w" === _col) ? 0 : 7;
            let correctColumnIndex = 4;

            if (correctColumnIndex == "ABCDEFGH".indexOf(_from[0]) && correctRowIndex == parseInt(_from[1]) - 1) {
                let direction = _vector[0] / Math.abs(_vector[0]);
                return castlingCheck(direction, correctRowIndex, correctColumnIndex, _col);
            };
        } else {
            return false;
        };

        return false;
    };

    function castlingCheck(_direction, _correctRowIndex, _correctColumnIndex, _col) {
        // all vector mathematics is done taking the board as whites perspective
        let idealCornerColumn = (_direction > 0) ? "H" : "A";
        let supposedRookSquare = document.getElementById(`${idealCornerColumn}${_correctRowIndex + 1}`);
        if (!("R" === supposedRookSquare.dataset.piece.charAt(1))) {
            return false;
        };

        // # king blocked check
        // v: [2 * direction, 0]
        let kingVector = [2 * _direction, 0];
        // u: [1 * direction, 0]
        let kingUVector = [_direction, 0];
        // f: (corRow, corCol)
        let kingFromCoords = [_correctColumnIndex + 1, _correctRowIndex + 1];
        // t: (corRow + v.x, corCol)
        let kingToCoords = [kingFromCoords[0] + kingVector[0], kingFromCoords[1]];

        if (!blockedCheck(kingVector, kingUVector, kingFromCoords, kingToCoords)) {
            return false;
        };

        // # rook blocked check
        // v: [(direction * -1) * (direction > 0 ? 2 : -3), 0]
        let rookVector = [(_direction > 0 ? -2 : 3), 0];
        // u: [-1 * direction, 0]
        let rookUVector = [-_direction, 0];
        // f: ("ABCDEFGH".charAt(supposedRookSquare.id.charAt(0)), kingToCoords[1])
        let rookFromCoords = [(_direction > 0 ? 8 : 1), kingToCoords[1]];
        // t: (kingFromCoords[0] + direction, kingToCoords[1])
        let rookToCoords = [kingFromCoords[0] + _direction, kingFromCoords[1]];

        if (!blockedCheck(rookVector, rookUVector, rookFromCoords, rookToCoords)) {
            return false;
        };

        // # has king moved yet
        if (moveHistory.includes(`${_col}K`)) {
            return false;
        };

        // # has rook moved yet
        if (moveHistory.includes(`${_col}R-${supposedRookSquare.id}`)) {
            return false;
        };

        let side = (_direction > 0 ? "kingside" : "queenside");
        let dat = {
            "game-id": document.gameID,
            "colour": _col,
            "side": side
        };

        $.ajax({url: "/castle/", type: 'POST', data: dat, success: function(result) {
            getGameState();
            console.log(result);
        }, error: function(resp) {
            console.log(resp);
        }});

        castling = true;

        return true;
    };

    // check if a vector describes a knights movement
    function nCheck(_vector) {
        var magnitude = calcMagnitude(_vector);
        // the magnitude of the vector of any legal knights move should always be root 5 so check if it is
        // ! make that a constant
        if (magnitude == 2.23606797749979) {
            return true;
        } else {
            return false;
        };
    };

    // check if a vector describes a legal pawns move, excluding en passante
    function pCheck(_from, _to, _vector, _piece, _endContents) {
        var fromId = _from.id;
        var col = "bw".indexOf(_piece);
        var yDirection = [-1, 1][col];

        // have to do this to compare arrays
        var vector = JSON.stringify(_vector);

        // simple one forward check
        if (vector == JSON.stringify([0, yDirection]) && _endContents == "") {
            return true;
        // two forward check
        } else if ((fromId[1] == 2 || fromId[1] == 7) && vector == JSON.stringify([0, 2 * yDirection]) && _endContents == "") {
            return true;
        // check for captures
        } else if (_endContents != "" && (vector == JSON.stringify([-1, yDirection]) || vector == JSON.stringify([1, yDirection]))) {
            return true;
        } else {
            return false;
        };
    };

    // function checks if another piece is in the way of the one you are trying to move
    // ! calculate unit vector from vector
    // from and to given as (x, y)
    function blockedCheck(_vector, _uVec, _from, _to) {
        var current = _from;
        var currentId;

        var mag = Math.floor(calcMagnitude(_vector));
        for (var i = 0; i < mag - 1; i++) {
            current = addVec(current, _uVec);
            // ! charAt
            currentId = "ABCDEFGH"[current[0] - 1] + current[1];
            // ? get rid of this
            if (currentId == _to) {
                return true;
            } else if ($(`#${currentId}`)[0].dataset.piece != "") {
                return false;
            };
        };

        return true;
    };

    function addVec(_pos, _vec) {
        var result = [0, 0];
        result[0] = _pos[0] + _vec[0];
        result[1] = _pos[1] + _vec[1];

        return result;
    };

    const squares = document.querySelectorAll(".square");

    function changePseudoElementBackground(selector, newColor) {
        // Iterate over all stylesheets in the document
        for (const styleSheet of document.styleSheets) {
            let rules;
            try {
                rules = styleSheet.cssRules || styleSheet.rules;

            } catch (e) {
                console.log(e);
                // Skip the stylesheet if it cannot be accessed
                continue;
            }
            // Iterate over all rules within the stylesheet
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                // Check if the rule is for the specified selector's ::after pseudo-element
                if(rule.selectorText === selector + '::after') {
                    rule.style.backgroundColor = newColor;
                    return; // Exit after the first match
                }
            }
        }
    }

    function handleMouseDown(event) {
        event.preventDefault();

        const square = event.target;
        console.log("mouse down event detected on: " + square.id);

        if (square.dataset.piece == "") {
            currentStart = null;
            return;
        };

        square.style.opacity = "0";

        setMousePos();

        dragObj.style.backgroundImage = "url('/static/assets/" + square.dataset.piece.toLowerCase() + ".png')";

        dragObj.style.display = "block";

        followMouse = true;

        currentStart = square;
    };

    // something about frozen
    function handleMouseUp(event) {
        if (null == currentStart) {
            currentEnd = null;
            return;
        };

        followMouse = false;
        dragObj.style.display = "none";

        if (event.target.id != currentStart.id) {
            currentEnd = event.target;

            if (document.col != document.myColour) {
                currentStart.style.opacity = "1";
                alert("not your turn");
                return;
            };

            validateMove();
        } else {
            currentStart.style.opacity = "1";
        };
    };

    function handleMouseMove(event) {
        if (followMouse) {
            setMousePos();
        };
    };

    function setMousePos() {
        let x = event.pageX - 65;
        let y = event.pageY - 65;

        dragObj.style.left = x + "px";
        dragObj.style.top = y + "px";
    };

    squares.forEach(square => { square.addEventListener('mousedown', handleMouseDown); square.addEventListener('mouseup', handleMouseUp); });

    document.addEventListener('mousemove', handleMouseMove);

    $("#close").click(function() {
        $("#info-window").hide();

        hasMoved = false;
        startObj.css("background", startBack);
    });

    // once you have selected a piece, if you press remove this removes the piece
    $("#remove").click(function() {
        changeOccupancy(currentStart.id, "");
        hasMoved = false;
        startObj.css("background", startBack);
        $("#info-window").hide();
    });

    // once you have selected a piece, this adds a piece in there using the given specs
    $("#add").click(function() {
        var piece = $("#p-to").val();
        var colour = $("#p-col").val();
        var change = colour + piece;

        changeOccupancy(currentStart.id, change);
        hasMoved = false;
        startObj.css("background", startBack);
        $("#info-window").hide();
    });

    // changes the layout of the whole board
    $("#update-board").click(function() {
        var command = $("#command").val();
        var dat = {
            "id": document.gameID,
            "command": command
        };

        $.ajax({url: "/boardChange/", type: 'POST', data: dat, success: function() {
            getGameState();
        }, error: function(resp) {
            console.log(resp);
        }});
    });

    $("#state-button").click(function() {
        var dat = {
            "id": document.gameID,
            "command": ""
        };

        if ($(this).val() == "save state") {
            dat["command"] = "save state";
        } else {
            dat["command"] = "load saved state";
        };

        $.ajax({url: "/saveState/", type: 'POST', data: dat, success: function(result) {
            $("#state-button").val(result);
            getGameState();
        }, error: function(resp) {
            console.log(resp);
        }});
    });

    $("#resign").click(function() {
        var resDat = {
            "id": document.gameID,
            "col": document.myColour
        };

        console.log(resDat);

        $.ajax({url: "/resign/", type: "POST", data: resDat, success: function(result) {
            document.game_status = result;
        }, error: function(resp) {
            console.log(resp);
        }});
    });

    $("#forwards").click(function() {
        if (document.moveOffset > 0) {
            document.moveOffset--;
            getPastState();
        };
    });

    $("#backwards").click(function() {
        if (document.moveOffset < document.plyCounter) {
            document.moveOffset++;
            getPastState();
        };
        console.log("offset: ", document.moveOffset, " num. plies ", document.plyCounter);
    });

    function getPastState() {
        let data = {
            "gameID": document.gameID,
            "offset": document.moveOffset
        };

        $.ajax({url: "/getPastBoard/", type: "POST", data: data, success: function(stateJsonString) {
            if (0 == document.moveOffset) {
                document.frozen = false;
            } else {
                document.frozen = true;
            }

            let state = JSON.parse(stateJsonString);

            $(".square").each(function(index) {
                var i = "ABCDEFGH".indexOf(this.dataset.column);
                var j = this.dataset.row - 1;
                this.dataset.piece = state[(j * 8) + i];
            });

            // highlighting
            if (currentPlyObject != null) {
                currentPlyObject.style.setProperty("background", "none");
                currentPlyObject.style.setProperty("color", "rgb(50, 50, 50)");
            };

            if (document.moveOffset < document.plyCounter) {
                let score = document.getElementById("score-data");
                let rows = score.querySelectorAll("tr");
                let row = rows[rows.length - Math.floor(document.moveOffset / 2) - 1];
                if (document.moveOffset % 2 == 0) {
                    currentPlyObject = row.querySelectorAll("td")[2];
                } else {
                    currentPlyObject = row.querySelectorAll("td")[1];
                };

                currentPlyObject.style.setProperty("background", "rgb(220, 100, 100)");
                currentPlyObject.style.setProperty("colour", "rgb(210, 210, 210)");
            };
        }, error: function(response) {
            console.log(response);
        }});
    };

    function validateMove() {
        // ensures the from & to are not null
        if (currentStart.id == null || currentEnd.id == null) {
            currentStart.style.opacity = "1";
            alert("choose a valid move");
            return;
        };

        // ensure you aren't trying to move an opponents piece
        var pieceCol = "bw".indexOf(currentStart.dataset.piece[0]);
        if (pieceCol != document.myColour && document.game_status != "test") {
            currentStart.style.opacity = "1";
            alert("not your piece");
            return;
        };

        // ensures you're moving to either an empty square or a square containing an enemy piece
        if (currentEnd.dataset.piece != "" && currentEnd.dataset.piece[0] == currentStart.dataset.piece[0]) {
            currentStart.style.opacity = "1";
            alert("cannot move piece here");
            return;
        };

        var piece = currentStart.dataset.piece;

        // checks that move is legal
        let check = legalCheck(piece, currentStart, currentEnd, currentEnd.dataset.piece);
        if (check === false) {
            currentStart.style.opacity = "1";
            alert("not a legal move");
            return;
        };

        if (castling) {
            castling = false;
            return;
        };

        var enemyCol = ["w", "b"][pieceCol];
        // ! having the two different functions is now an obselete setup
        if (piece[1] == "K") {
            getPieces(enemyCol, kingCallBack);
        } else {
            getPieces(enemyCol, otherCallBack);
        };
    };

    // enemy pieces contains a list containing ID's of squares occupied by enemy pieces
    // kingpos contains the DOM element that is the square occupied by the current players king
    function kingSafetyCallBack(_enemyPieces, _kingPos) {
        let startPiece = currentStart.dataset.piece;
        let endPiece = currentEnd.dataset.piece;

        let kingSquare;
        if (_kingPos.id === currentStart.id) {
            kingSquare = currentEnd;
        } else {
            kingSquare = _kingPos;
        };

        // temporarily enact move
        currentStart.dataset.piece = "";
        currentEnd.dataset.piece = startPiece;

        let canMove = true;

        _enemyPieces.forEach((squareID) => {
            if (squareID == currentEnd.id) {
                return;
            };

            let square = document.getElementById(squareID);
            // takes (attacking piece, attcking piece square, defending piece square, defending piece) adn the defending piece is always the king
            // 'kingSquare' is used over '_kingPos' incase the king was the piece moved
            let canAttackCheck = legalCheck(square.dataset.piece, square, kingSquare, kingSquare.dataset.piece);

            if (true === canAttackCheck) {
                alert("cannot move king into check!");
                canMove = false;
                return;
            };
        });

        // undo the temporary move
        currentStart.dataset.piece = startPiece;
        currentEnd.dataset.piece = endPiece;

        return canMove;
    };

    // the next two functions can now be removed

    // ! possible optimisation to collapse these two callback functions into one
    // ! make sure to add an alert for if you are in check as well as if you are trying to move into check

    // iterates through each of the enemy pieces and determines if that piece can legally move onto the square the king intends to move to
    function kingCallBack(_pieces, _kingPos) {
        var piece = currentStart.dataset.piece;
        var from = currentStart.id;
        var to = currentEnd.id;

        var kingColour = ["w", "b"][["w", "b"].indexOf(currentStart.dataset.piece[0])];  // charAt   also make it better because none of it is needed, we do not need an inversion here   tell it what colour is playing rather than having to work it out
        var kingName = kingColour + "K";

        var check = false;

        _pieces.forEach((sqID) => {
            var sq = document.getElementById(sqID);
            enemyCheck = legalCheck(sq.dataset.piece, sq, currentEnd, kingName);
            if (enemyCheck === true) {
                check = true;
                alert("cannot move king into check");
                return;
            };
        });

        if (!check) {
            makeMove(piece, from, to);
        };
    };

    // ! rename this to something more explanatory if not collapsing the two callbacks into one
    function otherCallBack(_pieces, _kingPos) {
        var startPiece = currentStart.dataset.piece;
        var endPiece = currentEnd.dataset.piece;
        var from = currentStart.id;
        var to = currentEnd.id;

        currentStart.dataset.piece = "";
        currentEnd.dataset.piece = startPiece;

        var kingColour = _kingPos.dataset.piece[0];
        var kingID = _kingPos.id;

        var check = false;

        _pieces.forEach((sqID) => {
            // ensures current piece isn't your own - happens if you have taken enemy piece
            var sq = document.getElementById(sqID);
            // first char indicates piece colour
            var pieceCol = sq.dataset.piece[0];
            if (pieceCol != kingColour) {
                enemyCheck = legalCheck(sq.dataset.piece, sq, _kingPos, kingID);
                console.log("legalC: " + sq.dataset.piece + " " + sq.id + " " + enemyCheck);
                if (enemyCheck === true) {
                    check = true;
                    alert("cannot move king into check");
                    return;
                };
            };
        });

        currentStart.dataset.piece = startPiece;
        currentEnd.dataset.piece = endPiece;

        if (!check) {
            makeMove(startPiece, from, to);
        };
    };

    function makeMove(_piece, _from, _to) {
        // updates database with new move, piece is moved later in 'getGameState' when board is updated
        var dat = {
            "move-from": _from,
            "move-to": _to,
            "gameID": document.gameID,
            "piece": _piece
        };

        if (_piece[0] == "w") {
            var col = 'w';
        } else {
            var col = 'b';
        }

        // updates what the last move was for this colour, this variable is used in legality checking
        lastMove[col]['from'] = _from;
        lastMove[col]['to'] = _to;

        $.ajax({url: "/submitMove/", type: 'POST', data: dat, success: function(result) {
            console.log("move json: " + result);
            var returnData = JSON.parse(result);
            if (returnData["status"].split(" ")[1] == "has") {
                $("#in-progress").css("visibility", "hidden");
                $("#not-started").css("visibility", "hidden");
                $("#won").css("visibility", "visible");
            };
            getGameState();
            setTimeout(() => { currentStart.style.opacity = "1"; }, 100);
        }, error: function(resp) {
            console.log(resp);
        }});
    };

    function getPieces(_col, callBack) {
        var dat = {
            "gameID": document.gameID,
            "type": document.game_status
        };

        $.ajax({url: "/getCurrentBoard/", type: 'POST', data: dat, success: function(result) {
            var returnData = JSON.parse(JSON.parse(result));
            // data looks like:
                // {
                    // "bp", "bK", "bR", "", ...
                // }
                // bp is at A8, then B8, C8, etc, empty string indicated no piece is present

            // var pieces = {};
            var pieces = [];
            var kingPos;
            // iterates through the board, from A8 to H1
            for (var i = 0; i < returnData.length; i++) {
                // this is the enemy pieces
                if (returnData[i][0] == _col) {  // charAt
                    var column = "ABCDEFGH"[i % 8];
                    var row = Math.floor(i / 8) + 1;
                    var id = column + String(row);
                    var square = document.getElementById(column + row);
                    // pieces[returnData[i]] = square;
                    // stores DOM elements corresponding to all of the required squares
                    // therefore, this could all have been done by iterating through the DOM objects, however doing it from the database is 'safer'
                    // we could optionally check each square against the board to ensure everything is as it should be, it a disagreement is found, overwrite the board, although that should be done for every square, and not here
                    pieces.push(id);
                };

                // this is our king
                if (returnData[i][0] != _col && returnData[i][1] == "K") {
                    var column = "ABCDEFGH"[i % 8];
                    var row = Math.floor(i / 8) + 1;
                    var square = document.getElementById(column + row);
                    kingPos = square;
                };
            };

            if (kingSafetyCallBack(pieces, kingPos)) {
                makeMove(currentStart.dataset.piece, currentStart.id, currentEnd.id);
            } else {
                currentStart.style.opacity = "1";
            };


        }, error: function(resp) {
            console.log(resp);
            piecestocheck = [];
        }});
    };

    function kingSafety() {
        piecestocheck.forEach(function(p) {
            kingCheck = legalCheck(p[0], p[1][0], currentEnd);
            if (kingCheck === true) {
                // colours in squares that can attack the king if moved to the given position
                // p[1].css("background", "red");
                resolve(false);
            };
        });
        resolve(true);
    }

    function getGameState() {
        var dat = {
            "gameID": document.gameID
        };

        $.ajax({url: "/getCurrentBoard/", type: 'POST', data: dat, success: function(result) {
            var returnData = JSON.parse(JSON.parse(result));
            $(".square").each(function(index) {
                var i = "ABCDEFGH".indexOf(this.dataset.column);
                var j = this.dataset.row - 1;
                this.dataset.piece = returnData[(j * 8) + i];

                let piece = document.createElement('img');
                piece
            });
        }, error: function(resp) {
            console.log(resp);
        }});
    };
    
    function changeOccupancy(_id, _changeTo) {
        // ! better name + let it
        dat = {
            "id": document.gameID,
            "type": document.game_status,
            "square_id": _id,
            "piece": _changeTo
        };

        $.ajax({url: "/changeOccupancy/", type: 'POST', data: dat, success: function(result) {
            getGameState();
            console.log("it returned");
        }, error: function(resp) {
            console.log(resp);
        }});
    };

    function poll() {
        if (document.frozen) {
            return;
        };

        // ! use fetch
        $.ajax({url: "/poll/", type: 'POST', data: {"id": document.gameID, "type": document.game_status }, success: function(result) {
            var data = JSON.parse(result);
            var status = data["status"];
            var moves = data["moves"];
            var nextPlay = data["next-play"];
            var taken = data["taken"];
            document.moveId = nextPlay[1];
            document.col = nextPlay[0];

            if (status.indexOf("has won") > -1) {
                frozen = true;
            };

            if (moves.length > movesLength) {
                getGameState();
                movesLength = moves.length;
            };

            document.plyCounter = moves.length;

            // put this data in a global array so that we can have a look at it in castlingCheck if we need to, this can be used for en passant too
            if (moves.length > 0) {
                $("#result").html("");

                const score = document.getElementById("score-data");
                score.innerHTML = "";

                moveHistory = "";

                for (let i = 0; i < moves.length / 2; i++) {
                    let row = document.createElement("tr");

                    let num = document.createElement("td");
                    num.textContent = i + 1;
                    row.appendChild(num);

                    let piece;
                    let move;

                    let whitesMove = document.createElement("td");
                    piece = moves[i * 2].piece.charAt(1) == "p" ? "" : moves[i * 2].piece.charAt(1);
                    move = piece + moves[i * 2].to.toLowerCase();
                    if ("K" == piece && "e" == moves[i * 2].from.toLowerCase().charAt(0)) {
                        if ("g" == moves[i * 2].to.toLowerCase().charAt(0)) {
                            move = "O-O";
                        } else if ("c" == moves[i * 2].to.toLowerCase().charAt(0)) {
                            move = "O-O-O";
                        };
                    };
                    whitesMove.textContent = move;
                    row.appendChild(whitesMove);

                    if ((i * 2) + 1 < moves.length) {
                        let blacksMove = document.createElement("td");
                        piece = moves[(i * 2) + 1].piece.charAt(1) == "p" ? "" : moves[(i * 2) + 1].piece.charAt(1);
                        move = piece + moves[(i * 2) + 1].to.toLowerCase();
                        if ("K" == piece && "e" == moves[(i * 2) + 1].from.toLowerCase().charAt(0)) {
                            if ("g" == moves[(i * 2) + 1].to.toLowerCase().charAt(0)) {
                                move = "O-O";
                            } else if ("c" == moves[(i * 2) + 1].to.toLowerCase().charAt(0)) {
                                move = "O-O-O";
                            };
                        };
                        blacksMove.textContent = move;
                        row.appendChild(blacksMove);
                    };

                    score.appendChild(row);
                };
            };

            var takenPieces = taken.split("|");
            $("#taken").html("");
            var yourTaken = "";
            var enemyTaken = "";
            takenPieces.forEach( function(piece) {
                if (piece == "") {
                    return;
                }

                let currentTaken = `<img src='/static/assets/${piece.toLowerCase()}.png'>`;
                if (piece[0] == ["w", "b"][document.myColour]) {
                    yourTaken += currentTaken;
                } else {
                    enemyTaken += currentTaken;
                };
            });

            $("#taken").append(enemyTaken);
            $("#taken").append(yourTaken);

            document.game_status = status;

            if (document.game_status == "not started") {
                $("#in-progress").css("visibility", "hidden");
                $("#not-started").css("visibility", "visible");
            } else if (document.game_status == "in progress") {
                $("#in-progress").css("visibility", "visible");
                $("#not-started").css("visibility", "hidden");
            } else {
                $("#in-progress").css("visibility", "visible");
                $("#not-started").css("visibility", "hidden");
                document.frozen = true;
            };

            $("#won").html("game is over, " + document.game_status);
        }, error: function(resp) {
            console.log(resp);
        }});
    };

    console.log(document.game_status);
    if (document.game_status != "test") {
        var interval = setInterval(poll, 1000);
    } else {
        var interval = setInterval(getGameState, 1000);
    };
});