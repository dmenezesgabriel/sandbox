from flask import Flask, jsonify
import sqlite3

app = Flask(__name__)

@app.route("/api/hello")
def hello_world():
    return "<p>Hello</p>", 200, {"Content-Type": "text/html"}

@app.route("/api/data")
def data():
    version =  sqlite3.connect(":memory:").execute("select sqlite_version()").fetchall()
    return jsonify({"sqlite_version": version})
    # return jsonify({"message": "This is JSON from /api/data"})
