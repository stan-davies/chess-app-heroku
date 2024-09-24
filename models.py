from flask_sqlalchemy import SQLAlchemy
import app as App

# !!! in postgres, the names of all tables and columns MUST be in lowercase, if you enter them in uppercase, they will simply be changed, however, if you send it uppercase names using sqlalchemy, it will be sensitive to case, and cause errors, so don't let that happen


class Move(App.db.Model):
    __tablename__ = "moves"

    id = App.db.Column(App.db.Integer, primary_key=True)
    colour = App.db.Column(App.db.Integer)
    piece = App.db.Column(App.db.String(48))
    # - these two are named as so because 'from' and 'to' are keywords in sql, i don't remember what the p stands for though
    p_from = App.db.Column(App.db.String(48))
    p_to = App.db.Column(App.db.String(48))
    # -
    gameid = App.db.Column(App.db.Integer)
    gamemove = App.db.Column(App.db.Integer)
    plyid = App.db.Column(App.db.Integer)


class Game(App.db.Model):
    __tablename__ = "games"

    id = App.db.Column(App.db.Integer, primary_key=True)
    p1_colour = App.db.Column(App.db.Integer)
    p2_colour = App.db.Column(App.db.Integer)
    p1_name = App.db.Column(App.db.String(256))
    p2_name = App.db.Column(App.db.String(256))
    joined = App.db.Column(App.db.Integer, default=0)
    status = App.db.Column(App.db.String(48), default="not started")
    currentboard = App.db.Column(App.db.String(1024))
    taken = App.db.Column(App.db.String(128))


class Player(App.db.Model):
    __tablename__ = "players"

    id = App.db.Column(App.db.Integer, primary_key=True)
    name = App.db.Column(App.db.String(128))
    wins = App.db.Column(App.db.Integer, default=0)


class StateHistory(App.db.Model):
    __tablename__ = "statehistory"

    id = App.db.Column(App.db.Integer, primary_key=True)
    gameid = App.db.Column(App.db.Integer)
    gamemove = App.db.Column(App.db.Integer)
    colour = App.db.Column(App.db.String(5))
    state = App.db.Column(App.db.String(1024))