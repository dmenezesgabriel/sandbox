from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/api/hello")
def hello_world():
    return "<p>Hello, World from /api/hello!1</p>"

@app.route("/api/data")
def data():
    return jsonify({"message": "This is JSON from /api/data"})
