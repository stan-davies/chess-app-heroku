from flask import Flask, render_template, request, redirect, url_for, Response
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import desc
import models as MODELS
import json
import app as App
from time import sleep
from sys import stdout


movesPlayed = 0


@App.app.route("/", methods=["GET", "POST"])
def index():
        if request.method == "GET":
                games = (
                App.db.session.query(MODELS.Game)
                .all()
                )

                players = (
                App.db.session.query(MODELS.Player)
                .order_by(desc(MODELS.Player.wins))
                .all()
                )

                return render_template("menu.html", games=games, players=players)
        else:
                username = request.form["choose-player"]
                enter_type = request.form["enter-type"]

                if enter_type == "join":
                        game_id = request.form["game"]

                        game = (
                                App.db.session.query(MODELS.Game)
                                .filter(MODELS.Game.id==game_id)
                                .first()
                        )

                        game.joined += 1

                        if game.status == "not started" and username != game.p1_name:
                                game.p2_name = username
                                game.status = "in progress"

                        App.db.session.commit()

                        if username == game.p1_name:
                                colour = 1
                        elif username == game.p2_name:
                                colour = 0
                        else:
                                colour = None;
                
                        # data looks like:
                        # status: 'in progress', player: 'n' (n for none)
                        game_data = {"status": game.status, "player": 'n'};
                        join_event = MODELS.Event(gameid=game_id, data=json.dumps(game_data), message="join");
                        App.db.session.add(join_event);
                        App.db.session.commit();
                
                        url = game.id
                        return redirect(url_for("index") + f"game/{url}/?u={username}&c={colour}")
                else:
                        new_board = json.dumps([
                                "wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR",
                                "wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp",
                                "", "", "", "", "", "", "", "",
                                "", "", "", "", "", "", "", "",
                                "", "", "", "", "", "", "", "",
                                "", "", "", "", "", "", "", "",
                                "bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp",
                                "bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"
                        ])

                        new_game = MODELS.Game(p1_colour="1", p2_colour="0", p1_name=username, joined=1, currentboard=new_board, taken="")
                        App.db.session.add(new_game)
                        App.db.session.commit()

                        currentState = MODELS.StateHistory(gameid=new_game.id, gamemove=0, colour="", state=new_board)
                        App.db.session.add(currentState)
                        App.db.session.commit()

                        # data looks like:
                        # status: 'in progress', player: 'n' (n for none)
                        game_data = {"status": new_game.status, "player": 'n'};
                        create_event = MODELS.Event(gameid=new_game.id, data=json.dumps(game_data), message="create");
                        App.db.session.add(create_event);
                        App.db.session.commit();

                        url = new_game.id
                        return redirect(url_for("index") + f"game/{url}/?u={username}&c=1")


@App.app.route("/game/<string:game_id>/", methods=["GET", "POST"])
def game(game_id):
        game = (
                App.db.session.query(MODELS.Game)
                .filter(MODELS.Game.id==game_id)
                .first()
        )

        players = [game.p1_name, game.p2_name]

        username = request.args.get("u")
        col_words = ["black", "white"]

        if username == players[0]:
                col_ = game.p1_colour
                colour = col_words[col_]
        elif username == players[1]:
                col_ = game.p2_colour
                colour = col_words[col_]
        else:
                col_ = 3
                colour = ""

        return render_template("game.html", col=col_, name=username, colour=colour, status=game.status, board=game.currentboard)


@App.app.route("/submitMove/", methods=["POST"])
def submitMove():
        move_from = request.form["move-from"]
        move_to = request.form["move-to"]
        gameid = request.form["gameID"]
        piece = request.form["piece"]

        last_move = (
                App.db.session.query(MODELS.Move)
                .filter(MODELS.Move.gameid==gameid)
                .order_by(-MODELS.Move.id)
                .first()
        )

        if last_move:
                plyid = last_move.plyid + 1
                colour = 1 - last_move.colour
                move_num = last_move.gamemove + colour
        else:
                colour = move_num = plyid = 1

        move = MODELS.Move(colour=colour, piece=piece, p_from=move_from, p_to=move_to, gameid=gameid, gamemove=move_num, plyid=plyid)
        App.db.session.add(move)
        App.db.session.commit()

        game = (
                App.db.session.query(MODELS.Game)
                .filter(MODELS.Game.id==gameid)
                .first()
        )

        index_from = ((int(move_from[1]) - 1) * 8) + "ABCDEFGH".index(move_from[0])
        index_to = ((int(move_to[1]) - 1) * 8) + "ABCDEFGH".index(move_to[0])

        board = json.loads(game.currentboard)

        if board[index_to] != "":
                game.taken += f"{board[index_to]}|"

        board[index_to] = board[index_from]
        board[index_from] = ""

        jsonBoard = json.dumps(board)
        game.currentboard = jsonBoard
        App.db.session.commit()

        if 1 == colour:
                colourString = "white"
        else:
                colourString = "black"
        currentState = MODELS.StateHistory(gameid=gameid, gamemove=move_num, colour=colourString, state=jsonBoard)
        App.db.session.add(currentState)
        App.db.session.commit()

        if "wK" not in game.currentboard:
                game.status = "black has won"
                App.db.session.commit()

                winner = (
                        App.db.session.query(MODELS.Player)
                        .filter(MODELS.Player.name==game.p2_name)
                        .first()
                )
                winner.wins += 1
                App.db.session.commit()
        elif "bK" not in game.currentboard:
                game.status = "white has won"
                App.db.session.commit()

                winner = (
                        App.db.session.query(MODELS.Player)
                        .filter(MODELS.Player.name==game.p1_name)
                        .first()
                )
                winner.wins += 1
                App.db.session.commit()

        #     global movesPlayed
        #     movesPlayed += 1

        # data looks like:
        # status: 'in progress', player: 'w'
        game_data = {"status": game.status, "player": colourString[0]};
        move_event = MODELS.Event(gameid=gameid, data=json.dumps(game_data), message="move");
        App.db.session.add(move_event);
        App.db.session.commit();

        return "{\"status\": \"" + game.status + "\"}"


def fetchData(gameID):
        with App.app.app_context():
                game = (
                        App.db.session.query(MODELS.Game)
                        .filter(MODELS.Game.id==gameID)
                        .first()
                )

                moves = (
                        App.db.session.query(MODELS.Move)
                        .filter(MODELS.Move.gameid==gameID)
                        .all()
                )

        if len(moves) > 0:
                next_plyid = moves[-1].plyid + 1
                # colours where 1: white & 0: black
                next_player_colour = 1 - moves[-1].colour
                # move number
                next_move = moves[-1].gamemove + next_player_colour
        else:
                next_plyid = 1
                next_player_colour = 1
                next_move = 1

        data = {
                "status": game.status,
                "moves": [
                        {
                                "num": m.gamemove,
                                "col": m.colour,
                                "from": m.p_from,
                                "to": m.p_to,
                                "piece": m.piece
                        } for m in moves
                ],
                "next-play": [
                        next_player_colour,
                        next_move
                ],
                "taken": game.taken,
                "board": game.currentboard
        }
        
        encoded = json.dumps(data)

        return f"id: {len(moves)}\n\ndata: {encoded}\n\n"


def get_event(gameid):
        with App.app.app_context():
                latest_event = (
                        App.db.session.query(MODELS.Event)
                        .filter(MODELS.Event.gameid==gameid)
                        .order_by(desc(MODELS.Event.timestamp))
                        .first()
                )

        return latest_event


    

def pollData(gameid, playerColour):
        #     yield fetchData(gameID)

        #     global movesPlayed

        last_event = get_event(gameid)
        yield fetchData(gameid)

        #     lastMoves = 0
        # last_event_id = int(request.headers.get('Last-Event-ID', 0))
        while True:
                latest_event = get_event(gameid)

                if (None == last_event):
                        if (None == latest_event):
                              sleep(5)
                              continue
                        else:
                             yield fetchData(gameid)
                             last_event = latest_event 
                             sleep(1)
                             continue
                             

                if (last_event.id == latest_event.id):
                       sleep(1)
                       continue

                # send the status only
                if ("join" == latest_event.message):
                        yield fetchData(gameid)
                        last_event = latest_event
                # send everything
                elif ("move" == latest_event.message and json.loads(latest_event.data)["player"] != playerColour):
                        yield fetchData(gameid)
                        last_event = latest_event

                sleep(1)
                

                # with App.app.app_context():
                #     moves = (
                #         App.db.session.query(MODELS.Move)
                #         .filter(MODELS.Move.gameid==gameID)
                #         .all()
                #     )

                # # nobody has moved yet / only one move made
                # # moves increased
                # # player colour not the same as the last moves colour
                # moves_from_db = len(moves)

                # print(f"{moves_from_db = }", file=stdout)
                # print(f"{lastMoves = }", file=stdout)
                
                # if (lastMoves < moves_from_db and int(playerColour) != int(moves[-1].colour)):
                #     yield fetchData(gameID)
                #     lastMoves = moves_from_db
                # sleep(1)


@App.app.route("/poll/<string:gameid>/<string:playerColour>", methods=["GET", "POST"])
def poll(gameid, playerColour):
        return Response(pollData(gameid, playerColour), mimetype='text/event-stream')


# merge the following two functions
@App.app.route("/getCurrentBoard/", methods=["POST"])
def getCurrentBoard():
    game_id = request.form["gameID"]

    game = (
        App.db.session.query(MODELS.Game)
        .filter(MODELS.Game.id==game_id)
        .first()
    )

    board = game.currentboard

    data = json.dumps(board)

    return data


@App.app.route("/getPastBoard/", methods=["POST"])
def getPastBoard():
    gameid = request.form["gameID"]
    offset = int(request.form["offset"])

    # if offset is the length of the gamemoves then return a default board
    # and don't store anything in db

    game_states = (
        App.db.session.query(MODELS.StateHistory)
        .filter(MODELS.StateHistory.gameid==gameid)
        .order_by(MODELS.StateHistory.gamemove)
        .all()
    )

    if len(game_states) < offset:
        offset = 0

    state_row = game_states[len(game_states) - (offset + 1)]

    return state_row.state;


@App.app.route("/castle/", methods=["POST"])
def castle():
    gameid = request.form["game-id"]
    colour = request.form["colour"]
    side = request.form["side"]

    game = (
        App.db.session.query(MODELS.Game)
        .filter(MODELS.Game.id==gameid)
        .first()
    )

    gameboard = json.loads(game.currentboard)

    if colour == "w" and side == "kingside":
        gameboard[7] = ""
        gameboard[5] = "wR"
        gameboard[4] = ""
        gameboard[6] = "wK"

        move_from = "e1"
        move_to = "g1"
    elif colour == "w" and side == "queenside":
        gameboard[0] = ""
        gameboard[3] = "wR"
        gameboard[4] = ""
        gameboard[2] = "wK"

        move_from = "e1"
        move_to = "c1"
    elif colour == "b" and side == "kingside":
        gameboard[63] = ""
        gameboard[61] = "bR"
        gameboard[60] = ""
        gameboard[62] = "bK"

        move_from = "e8"
        move_to = "g8"
    elif colour == "b" and side == "queenside":
        gameboard[56] = ""
        gameboard[59] = "bR"
        gameboard[60] = ""
        gameboard[58] = "bK"

        move_from = "e8"
        move_to = "c8"


    jsonBoard = json.dumps(gameboard)
    game.currentboard = jsonBoard
    App.db.session.commit()

    last_move = (
        App.db.session.query(MODELS.Move)
        .filter(MODELS.Move.gameid==gameid)
        .order_by(-MODELS.Move.id)
        .first()
    )

    if last_move:
        col = [1, 0][last_move.colour]
        move_num = last_move.gamemove + col   # col = 1 for white and 0 for black
    else:
        col = move_num = 1


    move = MODELS.Move(colour=col, piece=f"{side[0]}K", p_from=move_from, p_to=move_to, gameid=gameid, gamemove=move_num)
    App.db.session.add(move)
    App.db.session.commit()


    if 1 == colour:
        colourString = "white"
    else:
        colourString = "black"

    currentState = MODELS.StateHistory(gameid=gameid, gamemove=move_num, colour=colourString, state=jsonBoard)
    App.db.session.add(currentState)
    App.db.session.commit()

    # lol i forgot about this
    return "okay"


@App.app.route("/add_account/", methods=["POST"])
def add_account():
    new_account_name = request.form["account-name"]

    new_account = MODELS.Player(name=new_account_name)
    App.db.session.add(new_account)
    App.db.session.commit()

    return redirect(url_for("index"))


@App.app.route("/resign/", methods=["POST"])
def resign():
    gameid = request.form["id"]
    losing_colour = int(request.form["col"])

    winner = ["black", "white"][losing_colour]

    game = (
        App.db.session.query(MODELS.Game)
        .filter(MODELS.Game.id==gameid)
        .first()
    )

    game.status = f"{winner} has won"
    App.db.session.commit()

    return game.status