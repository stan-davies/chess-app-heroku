import os

from flask import Flask, render_template
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
env_config = os.getenv("APP_SETTINGS", "config.DevelopmentConfig")
app.config.from_object(env_config)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://uadjvu5175esqk:pa922e6eb711f6b69b1a478043cac3d71f7c71f94afe988790405a864c3dfa37f@c97r84s7psuajm.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/dbdl7l466g8acq'
db = SQLAlchemy(app)

class Player(db.Model):
    __tablename__ =  "players"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    wins = db.Column(db.Integer, default=0)

@app.route("/")
def index():
    results = Player.query.all()
    return render_template('index.html', results=results)
    secret_key = app.config.get("SECRET_KEY")
    return f"The configured secret key is {secret_key}. TEST TEST TEST aaaa"
