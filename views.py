from flask import Flask, render_template, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import desc
import pys.models as MODELS
import json
import app as App

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

            url = game.id
            return redirect(url_for("enter_game") + f"{url}/?u={username}&c={colour}")
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

            castlingChecks = json.dumps({
                "b": {
                    "KS": False,
                    "QS": False
                },
                "w": {
                    "KS": False,
                    "QS": False
                }
            })

            new_game = MODELS.Game(p1_colour="1", p2_colour="0", p1_name=username, joined=1, currentBoard=new_board, taken="", castlingChecks=castlingChecks)
            App.db.session.add(new_game)
            App.db.session.commit()

            currentState = MODELS.StateHistory(gameID=new_game.id, movenum=0, colour="", state=new_board)
            App.db.session.add(currentState)
            App.db.session.commit()

            url = new_game.id
            return redirect(url_for("enter_game") + f"{url}/?u={username}&c=1")

@App.app.route("/game/<string:game_id>/", methods=["GET", "POST"])
def game(game_id):
    game = (
        App.db.session.query(MODELS.Game)
        .filter(MODELS.Game.id==game_id)
        .first()
    )

    players = [game.p1_name, game.p2_name]

    _u = request.args.get("u")
    col_words = ["black", "white"]

    if _u == players[0]:
        col_ = game.p1_colour
        colour = col_words[col_]
    elif _u == players[1]:
        col_ = game.p2_colour
        colour = col_words[col_]
    else:
        col_ = 3
        colour = ""

    return render_template("game.html", col=col_, name=_u, colour=colour, status=game.status, board=game.currentBoard)

@App.app.route("/submitMove/", methods=["POST"])
def submitMove():
    move_from = request.form["move-from"]
    move_to = request.form["move-to"]
    gameID = request.form["gameID"]
    piece = request.form["piece"]

    last_move = (
        App.db.session.query(MODELS.TestMove)
        .filter(MODELS.TestMove.gameID==gameID)
        .order_by(-MODELS.TestMove.id)
        .first()
    )

    if last_move:
        colour = [1, 0][last_move.colour]
        move_num = last_move.gamemove + colour
    else:
        colour = move_num = 1

    move = MODELS.TestMove(colour=colour, piece=piece, p_from=move_from, p_to=move_to, gameID=gameID, gamemove=move_num)
    App.db.session.add(move)
    App.db.session.commit()

    game = (
        App.db.session.query(MODELS.Game)
        .filter(MODELS.Game.id==gameID)
        .first()
    )

    index_from = ((int(move_from[1]) - 1) * 8) + "ABCDEFGH".index(move_from[0])
    index_to = ((int(move_to[1]) - 1) * 8) + "ABCDEFGH".index(move_to[0])

    board = json.loads(game.currentBoard)

    if board[index_to] != "":
        game.taken += f"{board[index_to]}|"

    board[index_to] = board[index_from]
    board[index_from] = ""

    jsonBoard = json.dumps(board)
    game.currentBoard = jsonBoard
    App.db.session.commit()

    if 1 == colour:
        colourString = "white"
    else:
        colourString = "black"
    currentState = MODELS.StateHistory(gameID=gameID, movenum=move_num, colour=colourString, state=jsonBoard)
    App.db.session.add(currentState)
    App.db.session.commit()

    if "wK" not in game.currentBoard:
        game.status = "black has won"
        App.db.session.commit()

        winner = (
            App.db.session.query(MODELS.Player)
            .filter(MODELS.Player.name==game.p2_name)
            .first()
        )
        winner.wins += 1
        App.db.session.commit()
    elif "bK" not in game.currentBoard:
        game.status = "white has won"
        App.db.session.commit()

        winner = (
            App.db.session.query(MODELS.Player)
            .filter(MODELS.Player.name==game.p1_name)
            .first()
        )
        winner.wins += 1
        App.db.session.commit()

        return "{\"status\": \"" + game.status + "\"}"