import os

from flask import Flask, render_template, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import desc
import pys.models as MODELS
import json

app = Flask(__name__)
env_config = os.getenv("APP_SETTINGS", "config.DevelopmentConfig")
app.config.from_object(env_config)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://uadjvu5175esqk:pa922e6eb711f6b69b1a478043cac3d71f7c71f94afe988790405a864c3dfa37f@c97r84s7psuajm.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/dbdl7l466g8acq'
db = SQLAlchemy(app)
MODELS.setDB(db)


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "GET":
        games = (
            db.session.query(MODELS.Game)
            .all()
        )

        players = (
            db.session.query(MODELS.Player)
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
                db.session.query(MODELS.Game)
                .filter(MODELS.Game.id==game_id)
                .first()
            )

            game.joined += 1

            if game.status == "not started" and username != game.p1_name:
                game.p2_name = username
                game.status = "in progress"

            db.session.commit()

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
            db.session.add(new_game)
            db.session.commit()


            currentState = MODELS.StateHistory(gameID=new_game.id, movenum=0, colour="", state=new_board)
            db.session.add(currentState)
            db.session.commit()


            url = new_game.id
            return redirect(url_for("enter_game") + f"{url}/?u={username}&c=1")



@app.route("/error/")
def error():
    raise Exception("This is a new, updated error!")

