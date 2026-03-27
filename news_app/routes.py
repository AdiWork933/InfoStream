from flask import Blueprint, jsonify, render_template

from .services.news_service import news_service

bp = Blueprint("news", __name__)


@bp.route("/")
def homepage():
    return render_template("index.html")


@bp.route("/api/news")
def api_news():
    payload, status_code = news_service.get_news_payload()
    return jsonify(payload), status_code
