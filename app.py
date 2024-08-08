import os

from flask import Flask, render_template
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
env_config = os.getenv("APP_SETTINGS", "config.DevelopmentConfig")
app.config.from_object(env_config)
app.config['SQLALCHEMY_DATABASE_URI'] = 'your-database-uri'
db = SQLAlchemy(app)

class MyModel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80))
    value = db.Column(db.String(120))

@app.route("/")
def index():
    results = MyModel.query.all()
    return render_template('index.html', results=results)
    secret_key = app.config.get("SECRET_KEY")
    return f"The configured secret key is {secret_key}. TEST TEST TEST aaaa"
