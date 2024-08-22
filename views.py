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
