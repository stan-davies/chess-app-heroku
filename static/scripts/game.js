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
    document.latestBoard;
    document.currentStartIndex;
    document.currentEndIndex;
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

//     getGameState();

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
    function legalCheck(_piece, _start_id, _end_id, _endContents) {
        var col = _piece.charAt(0);

        // get the type of piece
        var pieceType;
        if (_piece.length == 2) {
            pieceType = _piece[1];
        } else {
            // for bishops, name is longer so indexing must be different
            pieceType = _piece[2];
        };

        // convert square id's to numerical positions
        console.log("start: " + _start_id + " end: " + _end_id);
        var startPos = ["ABCDEFGH".indexOf(_start_id.charAt(0)) + 1, parseInt(_start_id.charAt(1))];
        var endPos = ["ABCDEFGH".indexOf(_end_id.charAt(0)) + 1, parseInt(_end_id.charAt(1))];

        // creates a vector of the movement of the piece
        var vector = [endPos[0] - startPos[0], endPos[1] - startPos[1]];

        // convert vectors to unity vectors where necessary
        let uVector;
        if (pieceType == "R" || pieceType == "B" || pieceType == "Q") {
            uVector = unitise(vector);
        };

        // determine which functions to apply by piece
        var check = false;
        // ! switch case
        if (pieceType == "R") {
            // combination of check for movement and if there are pieces in the way, this is only needed for R, B & Q
            check = (pdCheck(uVector)[0] && pathway_clear_check(vector, startPos));
        } else if (pieceType == "B") {
            check = (pdCheck(uVector)[1] && pathway_clear_check(vector, startPos));
        } else if (pieceType == "Q") {
            var pd = pdCheck(uVector);
            var movementCheck = (pd[0] || pd[1]);
            console.log("movement check: " + movementCheck);
            let block_check = pathway_clear_check(vector, startPos);
            console.log("blocked check: " + block_check);
            check = (movementCheck && block_check);
        } else if (pieceType == "K") {
            check = kingCheck(vector, _start_id, _end_id, col);
        } else if (pieceType == "N") {
            check = nCheck(vector);
        } else {
            check = pCheck(_start_id, vector, col, _endContents);
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

            if (correctColumnIndex == "ABCDEFGH".indexOf(_from.charAt(0)) && correctRowIndex == parseInt(_from.charAt(1)) - 1) {
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

        if (!pathway_clear_check(kingVector, kingFromCoords)) {
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

        if (!pathway_clear_check(rookVector, rookFromCoords)) {
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

        // make this align with the new design elswhere in the code
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
    function pCheck(_from_id, _vector, _piece, _endContents) {
        var col = "bw".indexOf(_piece);
        var yDirection = [-1, 1][col];

        // have to do this to compare arrays
        var vector = JSON.stringify(_vector);

        // simple one forward check
        if (vector == JSON.stringify([0, yDirection]) && _endContents == "") {
            return true;
        // two forward check
        } else if ((_from_id.charAt(1) == 2 || _from_id.charAt(1) == 7) && vector == JSON.stringify([0, 2 * yDirection]) && _endContents == "") {
            return true;
        // check for captures
        } else if (_endContents != "" && (vector == JSON.stringify([-1, yDirection]) || vector == JSON.stringify([1, yDirection]))) {
            return true;
        } else {
            return false;
        };
    };

    // function checks if another piece is in the way of the one you are trying to move
    // from and to given as (x, y)
    // used for queen, rook, bishop
    function pathway_clear_check(_vector, _start_pos) {
        let current_pos = _start_pos;

        let mag = Math.floor(calcMagnitude(_vector));

        let current_piece;
        for (let i = 0; i < mag - 1; i++) {
                current_pos = addVec(current_pos, unitise(_vector));
                
                // reached end square
                if (current_pos == addVec(_start_pos, _vector)) {
                        console.log("reached the end square");
                        return true;
                };

                // [y * 8 + x]
                current_piece = document.latestBoard[(current_pos[1] - 1) * 8 + (current_pos[0] - 1)];

                console.log("i: " + i + ", piece at (" + current_pos[0] + ", " + current_pos[1] + "): " + current_piece);
                
                // something in the pathway
                if (current_piece != "") {
                        console.log("something in the way");
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

            let startSquarePiece = currentStart.dataset.piece;
            let destinationSquarePiece = currentEnd.dataset.piece;
            
            // visually makes move
            currentEnd.dataset.piece = currentStart.dataset.piece;
            currentStart.dataset.piece = "";

            // currentStart.style.opacity = "1";

            let valid = validateMove(startSquarePiece, destinationSquarePiece);
            if (!valid) {
                // return pieces
                currentStart.dataset.piece = currentEnd.dataset.piece;
                currentEnd.dataset.piece = "";
                currentStart.style.opacity = "1";
            } else {
                makeMove(currentStart.dataset.piece, currentStart.id, currentEnd.id);
                // currentStart.style.opacity = "1";
            };
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

        // no more ajax, read score back instead
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

    function validateMove(startSquarePiece, destinationSquarePiece) {
        // ensures the from & to are not null
        if (currentStart.id == null || currentEnd.id == null) {
            currentStart.style.opacity = "1";
            alert("choose a valid move");
            return false;
        };

        // ensure you aren't trying to move an opponents piece
        var pieceCol = "bw".indexOf(startSquarePiece.charAt(0));
        if (pieceCol != document.myColour && document.game_status != "test") {
            currentStart.style.opacity = "1";
            alert("not your piece");
            return false;
        };

        // ensures you're moving to either an empty square or a square containing an enemy piece
        if (destinationSquarePiece != "" && destinationSquarePiece.charAt(0) == startSquarePiece.charAt(0)) {
            currentStart.style.opacity = "1";
            alert("cannot move piece here");
            return false;
        };

        // checks that move is legal
        let check = legalCheck(startSquarePiece, currentStart.id, currentEnd.id, destinationSquarePiece);
        if (check === false) {
            currentStart.style.opacity = "1";
            alert("legalCheck returned false");
            return false;
        };

        if (castling) {
            castling = false;
            return false;
        };


        // run it, try it, sort out edge cases

        var enemyCol = ["w", "b"][pieceCol];
        var enemyPieces = [];
        var friendlyKingPos;
        // iterates through the board, from A8 to H1
        for (var i = 0; i < document.latestBoard.length; i++) {
            // this is the enemy pieces
            if (document.latestBoard[i].charAt(0) == enemyCol) {
                var column = "ABCDEFGH"[i % 8];
                var row = Math.floor(i / 8) + 1;
                var id = column + String(row);
                // if this square is the square we are moving to, we don't care if it contains an enemy, and we know it doesn't contian our king (next selection)
                if (id == currentEnd.id) {
                        continue;
                }
                var square = document.getElementById(column + row);
                // pieces[returnData[i]] = square;
                // stores DOM elements corresponding to all of the required squares
                // therefore, this could all have been done by iterating through the DOM objects, however doing it from the database is 'safer'
                // we could optionally check each square against the board to ensure everything is as it should be, it a disagreement is found, overwrite the board, although that should be done for every square, and not here
                enemyPieces.push(id);
            };

            // this is our king
            if (document.latestBoard[i].charAt(0) != enemyCol && document.latestBoard[i].charAt(1) == "K") {
                var column = "ABCDEFGH"[i % 8];
                var row = Math.floor(i / 8) + 1;
                var square = document.getElementById(column + row);
                friendlyKingPos = square;
            };
        };

        let kingSafe = true;

        enemyPieces.forEach((sqID) => {
            let attacking_piece = document.latestBoard["ABCDEFGH".indexOf(sqID.charAt(0)) * 8 + Number(sqID.charAt(1)) - 1];

            if (sqID != friendlyKingPos.id) {
                enemyCanTakeKing = legalCheck(attacking_piece, sqID, friendlyKingPos.id, friendlyKingPos.dataset.piece);
                if (enemyCanTakeKing === true) {
                    kingSafe = false;
                    alert("cannot move king into check");
                    return;
                };
            };
        });

        return kingSafe;
    };

    function makeMove(_piece, _from, _to) {
        // updates database with new move, piece is moved graphically later in 'getGameState' when board is updated
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
            currentStart.style.opacity = "1";
            // i dont think this is required because making a move will fire an event which SSE willl tell the client about anyway and then update the board in that
            // getGameState();
            
        }, error: function(resp) {
            console.log(resp);
        }});
    };

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

    function poll(data) {
        let status = data["status"];
        let moves = data["moves"];
        let nextPlay = data["next-play"];
        let taken = data["taken"];
        let boardData = JSON.parse(data["board"]);
        document.moveId = nextPlay[1];
        document.col = nextPlay[0];
        document.latestBoard = boardData;

        if (status.indexOf("has won") > -1) {
            frozen = true;
        };

        $(".square").each(function(index) {
            var i = "ABCDEFGH".indexOf(this.dataset.column);
            var j = this.dataset.row - 1;
            this.dataset.piece = boardData[(j * 8) + i];
        });

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

        console.timeEnd("timer");
    };

    let eventSource = new EventSource(`/poll/${document.gameID}/${document.myColour}`);

    // first move boundary condition

    eventSource.onmessage = (event) => {
        console.log("got a move");
        if (document.frozen) {
            console.log("frozen");
            return;
        };
        
        let liveData = JSON.parse(event.data);
        console.log(liveData.moves[liveData.moves.length - 1]);
        console.log(liveData);
        console.time("timer");
        poll(liveData);
    };

    eventSource.onerror = (event) => {
        console.log(event);
        if (event.target.readyState === EventSource.CLOSED) {
            console.error('EventSource connection was closed.');
        } else if (event.target.readyState === EventSource.CONNECTING) {
            console.error('EventSource connection is reconnecting.');
        } else {
            console.error('EventSource encountered an error.');
        }
        eventSource.close();
        setTimeout(() => {
            eventSource = new EventSource(`/poll/${document.gameID}/${document.myColour}`);
        }, 5000);
    };
});