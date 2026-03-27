from flask import Flask

from .routes import bp as routes_bp
from .services.news_service import news_service


def create_app() -> Flask:
    app = Flask(__name__)
    app.register_blueprint(routes_bp)

    # Warm cache and start periodic refresh worker.
    news_service.start()

    return app
