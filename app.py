import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
env_config = os.getenv("APP_SETTINGS", "config.DevelopmentConfig")
app.config.from_object(env_config)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://uadjvu5175esqk:pa922e6eb711f6b69b1a478043cac3d71f7c71f94afe988790405a864c3dfa37f@c97r84s7psuajm.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/dbdl7l466g8acq'
db = SQLAlchemy(app)

import models
import views