from flask_sqlalchemy import SQLAlchemy

db = None

def setDB(_db):
    db = _db

class Move(db.Model):
    __tablename__ = "moves"

    id = db.Column(db.Integer, primary_key=True)
    colour = db.Column(db.Integer)
    piece = db.Column(db.String(48))
    # - these two are named as so because 'from' and 'to' are keywords in sql, i don't remember what the p stands for though
    p_from = db.Column(db.String(48))
    p_to = db.Column(db.String(48))
    # -
    gameID = db.Column(db.Integer)
    ply = db.Column(db.Integer)

class Game(db.Model):
    __tablename__ = "games"

    id = db.Column(db.Integer, primary_key=True)
    p1_colour = db.Column(db.Integer)
    p2_colour = db.Column(db.Integer)
    p1_name = db.Column(db.String(256))
    p2_name = db.Column(db.String(256))
    joined = db.Column(db.Integer, default=0)
    status = db.Column(db.String(48), default="not started")
    currentBoard = db.Column(db.String(1024))
    taken = db.Column(db.String(128))

class Player(db.Model):
    __tablename__ = "players"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128))
    wins = db.Column(db.Integer, default=0)

class StateHistory(db.Model):
    __tablename__ = "stateHistory"

    id = db.Column(db.Integer, primary_key=True)
    gameID = db.Column(db.Integer)
    gamemove = db.Column(db.Integer)
    colour = db.Column(db.String(5))
    state = db.Column(db.String(1024))